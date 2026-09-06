// Headless arena runner for benchmarking agent strategies.
//
// Usage:
//   node scripts/arena.js --pairs 100 --profiles scripts/arena-profiles.json
//   node scripts/arena.js --pairs 50 --profiles scripts/arena-profiles.json \
//     --matchups "Nit,TAG"                # single pairwise matchup
//   node scripts/arena.js --pairs 50 --profiles scripts/arena-profiles.json \
//     --matchups "*"                      # all pairwise matchups
//
// A "pair" is a duplicate-deck mirrored match: one deck is drawn, played
// once (agent A in seat 0, agent B in seat 1), then replayed with strategies
// swapped. This cancels much of the dealing variance so bb/100 estimates
// converge with far fewer hands than independent play.
//
// Output: bb/100 with 95% CI plus VPIP, PFR, aggression factor, fold rate,
// and fallback rate per agent. Full JSON dump written to data/arena/.

import fs from 'node:fs';
import path from 'node:path';
import { Game, Streets, Actions } from '../src/engine/game.js';
import { freshShuffledDeck } from '../src/engine/deck.js';
import { estimateEquity } from '../src/engine/equity.js';
import { getAgentAction } from '../src/agent/handler.js';
import { newCostMeter, addCost, usdPer100Hands, formatUsd, priceFor } from '../src/agent/providers/pricing.js';
import { providerIdFor } from '../src/agent/providers/index.js';
import { compilePolicy, inferProfileFromStyleRisk } from '../src/agent/policy.js';
// COST-1: the arena is where the reduction gets a NUMBER. Both halves of the
// decision path are here — the router that decides, and the compiled policy
// that answers the ones it keeps — so a run reports calls per 100 hands
// alongside bb/100, and "we cut the bill by 60%" can be checked rather than
// asserted. `--route off` reproduces the pre-COST-1 baseline exactly.
import { routeFor, Route, newRouteCounter, countRoute, formatRoutes } from '../src/server/router.js';
import { chooseFromPolicy } from '../src/agent/policyPlay.js';
import {
  ATTR_KEYS,
  effectiveAttrs,
  readMinHands,
  attributeImpact,
  birthAttributes,
  ensureAttributes,
  applySessionGrowth,
  newEvidence,
  addEvidence,
  decisionEvidence,
  handEvidence,
  logAttrChange,
} from '../src/agent/attributes.js';
import { perceivedMath } from '../src/agent/handler.js';
import {
  recordHand as recordHandForOpponentStats,
  getRead as getOpponentRead,
  reset as resetOpponentStats,
  setPersistEnabled as setOpponentStatsPersist,
} from '../src/server/opponentStats.js';

// Arena never pollutes production opponent state.
setOpponentStatsPersist(false);
resetOpponentStats();

// ── CLI ──────────────────────────────────────────────────────────────────────

// ATTR-1: seat A's six attributes. Seat B always stays at neutral 50, so a
// bb/100 delta between two runs of the SAME strategy is attribute impact and
// nothing else. "off" additionally forces ATTRIBUTE_IMPACT=0, which is the
// control: it must reproduce the pre-attribute baseline.
const ATTRIBUTE_LEVELS = { off: 50, low: 25, mid: 50, high: 80, grow: null };

function parseArgs(argv) {
  const out = {
    pairs: 100, profiles: 'scripts/arena-profiles.json', matchups: '*',
    sb: 10, bb: 20, buyIn: 2000, reads: true, attributes: 'mid',
    // MODEL-1c: null means "whatever AI_MODEL says", which is the old behaviour.
    model: null, modelB: null,
    // COST-1: the router, on by default. `--route off` sends every decision to
    // the model, which is the pre-COST-1 baseline and the control half of the
    // measurement.
    route: true,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pairs')     out.pairs    = parseInt(argv[++i], 10);
    else if (a === '--profiles') out.profiles = argv[++i];
    else if (a === '--matchups') out.matchups = argv[++i];
    else if (a === '--sb')   out.sb       = parseInt(argv[++i], 10);
    else if (a === '--bb')   out.bb       = parseInt(argv[++i], 10);
    else if (a === '--buy-in') out.buyIn  = parseInt(argv[++i], 10);
    else if (a === '--no-reads') out.reads = false;
    // MODEL-1c: --model sets both seats; --model-b overrides seat B, which is
    // what turns a same-strategy TAG mirror into a model A/B. Seat A carries
    // the variable in every other arena dimension too (attributes), so the
    // convention is consistent.
    else if (a === '--route')   out.route  = String(argv[++i] ?? '').toLowerCase() !== 'off';
    else if (a === '--no-route') out.route = false;
    else if (a === '--model')   out.model  = argv[++i];
    else if (a === '--model-b') out.modelB = argv[++i];
    else if (a === '--attributes') {
      out.attributes = String(argv[++i] ?? '').toLowerCase();
      if (!(out.attributes in ATTRIBUTE_LEVELS)) {
        console.error(`--attributes must be one of: ${Object.keys(ATTRIBUTE_LEVELS).join(' | ')}`);
        process.exit(1);
      }
      // Set before anything reads the knob; attributes.js reads it live.
      if (out.attributes === 'off') process.env.ATTRIBUTE_IMPACT = '0';
    }
    else if (a === '--help' || a === '-h') {
      console.log('usage: node scripts/arena.js --pairs N --profiles path.json [--matchups "A,B"|"*"] [--no-reads]\n' +
                  '         [--attributes off|low|mid|high|grow] [--model <id>] [--model-b <id>]\n' +
                  '         [--route off]   COST-1: off = every decision to the model (the baseline)');
      process.exit(0);
    }
  }
  return out;
}

// ── Stat trackers ────────────────────────────────────────────────────────────

function newStats() {
  return {
    handsSeatedAsHero: 0,          // hands played (across all pairs, both sides)
    netChips: 0,                   // total net chips won/lost (post-hand stack delta)
    pairSumsByMatchup: [],         // for CI: per-pair chip deltas summed across mirrored halves
    decisions: 0,
    preflopVoluntary: 0,           // for VPIP: preflop calls/raises (excluding forced blind)
    preflopRaised: 0,              // for PFR
    handsSawPreflop: 0,            // denominator for VPIP/PFR (per-hand, per-hero)
    calls: 0,
    bets: 0,
    raises: 0,
    folds: 0,
    checks: 0,
    fallbacks: 0,
    // MODEL-1b: what this agent's decisions actually cost. Per-agent rather
    // than per-run, so a mirror pitting two models reports each side's bill.
    cost: newCostMeter(),
    // COST-1: where this agent's decisions went. Per agent for the same reason
    // the cost meter is: a mirror is two characters, and a Nit routes very
    // differently from a Maniac.
    routes: newRouteCounter(),
    model: null,
  };
}

function collectDecisionMetrics(stats, decisions) {
  // Aggregate per-hand: was there a voluntary preflop action? was there a raise?
  let sawPreflop = false;
  let voluntaryPreflop = false;
  let raisedPreflop = false;
  for (const d of decisions) {
    stats.decisions++;
    if (d.route) countRoute(stats.routes, { route: d.route, reason: d.routeReason });
    if (d.usage && d.model) {
      addCost(stats.cost, d.usage, d.model, d.provider);
      if (!stats.model) stats.model = d.model;
    }
    const t = d.action?.type;
    if (t === 'call')  stats.calls++;
    if (t === 'bet')   stats.bets++;
    if (t === 'raise') stats.raises++;
    if (t === 'fold')  stats.folds++;
    if (t === 'check') stats.checks++;
    if (d.fallback)    stats.fallbacks++;
    if (d.street === Streets.PREFLOP) {
      sawPreflop = true;
      if (t === 'call' || t === 'raise') voluntaryPreflop = true;
      if (t === 'raise') raisedPreflop = true;
    }
  }
  if (sawPreflop) {
    stats.handsSawPreflop++;
    if (voluntaryPreflop) stats.preflopVoluntary++;
    if (raisedPreflop)    stats.preflopRaised++;
  }
}

// ── Core: play one hand between two agent bundles on a fixed deck ────────────
// A bundle is { strategy: string, profile: {tightness,aggression,bluffFreq,discipline} }.
// nameBySeat is [nameForSeat0, nameForSeat1] — used as the opponentStats
// playerId so reads follow the archetype across mirrored deck swaps.

async function playHand({ deck, seat0Bundle, seat1Bundle, nameBySeat, sb, bb, buyIn, readsEnabled = true, sessionHands = 0, evidenceFor = null, evidence = null, modelBySeat = [null, null], routeEnabled = true }) {
  const game = new Game({
    tableId: 'arena',
    seats: [
      { playerId: 'seat0', stack: buyIn },
      { playerId: 'seat1', stack: buyIn },
    ],
    smallBlind: sb,
    bigBlind: bb,
    dealerSeat: 0,
  });
  game.startHand(deck);

  const decisionsBySeat = [[], []];
  const actionLog = [];  // { seat, street, actionType } in game order
  const bundles = [seat0Bundle, seat1Bundle];

  // ATTR-1: the attributes each seat plays this hand with, after fatigue.
  // `sessionHands` runs across the whole matchup rather than resetting every
  // hand, so STAMINA is actually live over a 50-pair run — and because both
  // halves of a mirrored pair are handed the same count, the mirror still
  // cancels. Bundles without attributes give null and every hook stands down.
  const effBySeat = bundles.map((b) => (b.attrs ? effectiveAttrs({ attrs: b.attrs }, { sessionHands }) : null));

  // Per-street raise counter — same shape/semantics as table.js.
  const raiseCounts = {};
  const streetKey = () => `${game.handNumber}:${game.street}`;
  const bumpIfAggressive = (a) => {
    if (a?.type === Actions.RAISE || a?.type === Actions.BET) {
      const k = streetKey();
      raiseCounts[k] = (raiseCounts[k] ?? 0) + 1;
    }
  };

  let safety = 400;
  while (
    game.street !== Streets.COMPLETE &&
    game.street !== Streets.SHOWDOWN &&
    safety-- > 0
  ) {
    const seat = game.toAct;
    if (seat === null || seat === undefined) break;
    const me = game.seats[seat];
    const opp = game.seats[(seat + 1) % 2];
    const legal = game.legalActions(seat);
    const callAction  = legal.find((a) => a.type === Actions.CALL)  ?? null;
    const betAction   = legal.find((a) => a.type === Actions.BET)   ?? null;
    const raiseAction = legal.find((a) => a.type === Actions.RAISE) ?? null;
    const toCall = callAction?.amount ?? 0;

    let equity = null;
    try {
      equity = estimateEquity({
        holeCards: me.holeCards,
        community: game.community,
        nOpponents: 1,
        iterations: 500,
      }).equity;
    } catch { /* leave null */ }

    const position = game.dealerSeat === seat ? 'BTN/SB' : 'BB';
    const eff = effBySeat[seat];
    const oppEff = effBySeat[(seat + 1) % 2];
    const policy = compilePolicy(bundles[seat].profile, {
      holeCards: me.holeCards,
      position,
      attrs: eff,
    });

    // Fetch a read on the OTHER seat, if enabled and enough data.
    const opponentReads = [];
    if (readsEnabled) {
      const oppName = nameBySeat[(seat + 1) % 2];
      const read = getOpponentRead(oppName);
      // Same attribute-aware gate table.js uses: READS pulls it down, the
      // subject's DECEPTION pushes it up.
      const subjectDeception = oppEff?.DECEPTION ?? null;
      const gate = readMinHands({ reads: eff?.READS ?? null, deception: subjectDeception });
      if (read && read.handsObserved >= gate) opponentReads.push({ ...read, subjectDeception });
    }

    const gameState = {
      holeCards: me.holeCards,
      community: game.community,
      pot: game.pot,
      street: game.street,
      myStack: me.stack,
      oppStack: opp.stack,
      myContrib: me.contribThisStreet,
      position,
      sb: game.smallBlind,
      bb: game.bigBlind,
      canCheck: legal.some((a) => a.type === Actions.CHECK),
      canBet:   !!betAction,
      canRaise: !!raiseAction,
      toCall,
      minBet:   betAction?.min ?? 0,
      maxBet:   betAction?.max ?? 0,
      minRaise: raiseAction?.min ?? 0,
      maxRaise: raiseAction?.max ?? 0,
      equity,
      potOdds: toCall > 0 ? toCall / (game.pot + toCall) : null,
      spr:     game.pot > 0 ? me.stack / game.pot : null,
      policy,
      raisesThisStreet: raiseCounts[streetKey()] ?? 0,
      opponentReads,
      attrs: eff,                       // ATTR-1: FOCUS/READS read these
      fatigue: eff?.fatigue ?? null,
      seat,                             // seeds the FOCUS noise
      handNumber: game.handNumber,
      opponents: [{ seat: (seat + 1) % 2, stack: opp.stack, folded: opp.folded, contribThisStreet: opp.contribThisStreet }],
    };

    // COST-1: the router, asked the same question table.js asks it — off the
    // same game state, with the same gates. `--route off` forces every
    // decision to the model, which is the pre-COST-1 baseline: run both and
    // the difference in `calls` is the reduction, measured rather than
    // claimed.
    //
    // The arena has no mood, no nemesis and no needle, so the gates that fire
    // here are the structural ones — margin, options, pot, street, all-in.
    // That makes it a FLOOR on the saving rather than an estimate of it: a
    // live table has more reasons to spend, never fewer.
    const routed = routeEnabled
      ? routeFor(gameState, { home: false })
      : { route: Route.MODEL, reason: 'baseline', options: 0, margin: null, tag: 'model/baseline' };

    // MODEL-1c: the model follows the AGENT, not the seat — the mirror swaps
    // seats, so the caller passes modelBySeat swapped for the second half.
    const decision = routed.route === Route.POLICY
      ? chooseFromPolicy(gameState)
      : await getAgentAction(gameState, bundles[seat].strategy, '', { model: modelBySeat[seat] ?? undefined });
    const { action, reasoning } = decision;
    const streetAtDecision = game.street;

    // ATTR-3 grow mode: the same evidence rules table.js runs on the live path.
    if (evidence && evidenceFor !== null && nameBySeat[seat] === evidenceFor) {
      const seen = perceivedMath(gameState);
      addEvidence(evidence, decisionEvidence({
        trueEquity: equity,
        seenEquity: seen.equity,
        deviationDie: !!policy.dice.deviationDie,
        inRange: policy.range ? !!policy.range.inRange : null,
        actionType: action?.type ?? null,
      }));
      if (opponentReads.length > 0) evidence._readSubjects?.add(nameBySeat[(seat + 1) % 2]);
    }
    let fallback = /fallback|no API key|parse failure/i.test(reasoning || '');

    let appliedAction = action;
    try {
      game.act(seat, action);
      bumpIfAggressive(appliedAction);
    } catch {
      fallback = true;
      const alt = legal.find((a) => a.type === Actions.CHECK)
               ?? legal.find((a) => a.type === Actions.CALL)
               ?? { type: Actions.FOLD };
      appliedAction = { type: alt.type, ...(alt.amount ? { amount: alt.amount } : {}) };
      try { game.act(seat, appliedAction); } catch {
        break;
      }
    }

    actionLog.push({ seat, street: streetAtDecision, actionType: appliedAction.type });

    decisionsBySeat[seat].push({
      street: streetAtDecision,
      action: appliedAction,
      reasoning,
      fallback,
      equity,
      potOdds: gameState.potOdds,
      // MODEL-1b: what this one decision cost, carried on the decision so the
      // per-agent roll-up needs no second bookkeeping path.
      usage: decision.usage ?? null,
      model: decision.model ?? null,
      provider: decision.provider ?? null,
      // COST-1: where it went, so the per-agent roll-up needs no second path.
      route: routed.route,
      routeReason: routed.reason,
    });
  }

  const finalStack0 = game.seats[0].stack;
  const finalStack1 = game.seats[1].stack;
  const showdownSeats = Array.isArray(game.result?.showdown)
    ? game.result.showdown.map((s) => s.seat).filter((n) => Number.isInteger(n))
    : [];

  if (evidence && evidenceFor !== null) {
    const heroSeat = nameBySeat.indexOf(evidenceFor);
    if (heroSeat !== -1) {
      const won = (game.result?.winners ?? []).some((w) => w.seat === heroSeat);
      addEvidence(evidence, handEvidence({
        decisions: decisionsBySeat[heroSeat],
        won,
        resultType: game.result?.type === 'showdown' ? 'showdown' : 'fold',
      }));
    }
  }

  return {
    seat0Net: finalStack0 - buyIn,
    seat1Net: finalStack1 - buyIn,
    seat0Decisions: decisionsBySeat[0],
    seat1Decisions: decisionsBySeat[1],
    actionLog,
    showdownSeats,
    handNumber: game.handNumber,
    result: game.result,
  };
}

// ── Matchup driver: N pairs of mirrored deck matches ─────────────────────────

async function runMatchup({ nameA, bundleA, nameB, bundleB, pairs, sb, bb, buyIn, readsEnabled, evidence = null,
                            modelA = null, modelB = null, routeEnabled = true }) {
  const statsA = newStats();
  const statsB = newStats();

  // Clean slate between matchups so reads about C never leak into A vs B.
  resetOpponentStats();

  for (let p = 0; p < pairs; p++) {
    const deck = freshShuffledDeck();

    // Hand 1: A in seat 0, B in seat 1
    // Both halves of the pair are played at the same point in the session, so
    // fatigue is symmetric across the mirror.
    const sessionHands = p * 2;
    const h1 = await playHand({
      deck, seat0Bundle: bundleA, seat1Bundle: bundleB,
      nameBySeat: [nameA, nameB],
      sb, bb, buyIn, readsEnabled, sessionHands,
      evidenceFor: evidence ? nameA : null, evidence,
      modelBySeat: [modelA, modelB],
      routeEnabled,
    });
    // Feed opponent-stats before the mirrored hand so hand 2's reads can
    // already benefit from hand 1's evidence.
    recordHandForOpponentStats({
      playerIdsBySeat: [nameA, nameB],
      displayNamesBySeat: [nameA, nameB],
      actionLog: h1.actionLog,
      showdownSeats: h1.showdownSeats,
    });

    // Hand 2: B in seat 0, A in seat 1 (mirrored)
    const h2 = await playHand({
      deck, seat0Bundle: bundleB, seat1Bundle: bundleA,
      nameBySeat: [nameB, nameA],
      sb, bb, buyIn, readsEnabled, sessionHands,
      evidenceFor: evidence ? nameA : null, evidence,
      modelBySeat: [modelB, modelA],   // swapped with the seats
      routeEnabled,
    });
    recordHandForOpponentStats({
      playerIdsBySeat: [nameB, nameA],
      displayNamesBySeat: [nameB, nameA],
      actionLog: h2.actionLog,
      showdownSeats: h2.showdownSeats,
    });

    // Per-agent totals across both halves
    const aNet = h1.seat0Net + h2.seat1Net;
    const bNet = h1.seat1Net + h2.seat0Net;
    statsA.netChips += aNet;
    statsB.netChips += bNet;
    statsA.pairSumsByMatchup.push(aNet);
    statsB.pairSumsByMatchup.push(bNet);
    statsA.handsSeatedAsHero += 2;
    statsB.handsSeatedAsHero += 2;
    collectDecisionMetrics(statsA, h1.seat0Decisions);
    collectDecisionMetrics(statsA, h2.seat1Decisions);
    collectDecisionMetrics(statsB, h1.seat1Decisions);
    collectDecisionMetrics(statsB, h2.seat0Decisions);

    if ((p + 1) % 10 === 0 || p === pairs - 1) {
      process.stdout.write(`  [${nameA} vs ${nameB}] pair ${p + 1}/${pairs}  A net=${aNet}  B net=${bNet}\n`);
    }
  }

  return { nameA, nameB, statsA, statsB };
}

// Normalize an entry from arena-profiles.json into a { strategy, profile } bundle.
// Accepts either the new object shape or the legacy string form (which
// infers a neutral policy profile so the arena still runs).
function normalizeBundle(name, raw) {
  if (typeof raw === 'string') {
    return { strategy: raw, profile: inferProfileFromStyleRisk('Balanced', 'Medium') };
  }
  if (raw && typeof raw === 'object') {
    const strategy = String(raw.strategy ?? '');
    const profile = raw.profile ?? inferProfileFromStyleRisk(raw.style, raw.risk);
    return { strategy, profile };
  }
  throw new Error(`profile "${name}" is neither a string nor an object`);
}

// ATTR-1: attach a flat six-attribute record to a bundle. Seat A gets the
// requested level; seat B is always neutral, which is what makes a same-
// strategy matchup a clean single-variable measurement.
const NEUTRAL_LEVEL = 50;
function withAttributes(bundle, value) {
  return { ...bundle, attrs: Object.fromEntries(ATTR_KEYS.map((k) => [k, value])) };
}

// ATTR-3 `--attributes grow`: seat A is not a level at all, he is a DAY-ONE
// AGENT — born from the profile, with his nature, his currents at 55-65% of a
// 30-point band, and an empty log. He plays the matchup as one session and the
// growth machinery runs on it at the end, so the run answers a different
// question from the others: not "what do attributes do", but "what does an
// evening at this table make of him".
function bornAgent(name, bundle) {
  const agent = { id: `arena_${name.replace(/\W+/g, '_')}`, name, stats: { handsPlayed: 0 } };
  ensureAttributes(agent);
  const born = birthAttributes({ profile: bundle.profile });
  agent.attrs = born.attrs;
  agent.potential = born.potential;
  agent.potentialBirth = JSON.parse(JSON.stringify(born.potential));
  agent.nature = born.nature;
  agent.attrLog = [];
  for (const k of ATTR_KEYS) {
    logAttrChange(agent, { key: k, from: agent.attrs[k], to: agent.attrs[k], cause: 'birth' });
  }
  return agent;
}

// ── Summarization ────────────────────────────────────────────────────────────

function bbPer100(netChips, hands, bb) {
  if (hands === 0) return 0;
  return (netChips / bb) / (hands / 100);
}

// 95% CI half-width on bb/100 computed from the per-pair chip sums (mirrored
// pair = the independent unit). Uses z ≈ 1.96 and sample stddev.
function ciHalfWidth95(pairSums, pairs, bb) {
  const n = pairSums.length;
  if (n < 2) return 0;
  const mean = pairSums.reduce((s, x) => s + x, 0) / n;
  const variance = pairSums.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  const seMean = Math.sqrt(variance / n);
  // Convert SE of chip-sum-per-pair (which is 2 hands) into SE of bb/100.
  // bb/100 = mean_pair / bb / 2 * 100 = mean_pair * 50 / bb, so SE scales linearly.
  return 1.96 * seMean * 50 / bb;
}

function summarizeAgent(agentStats, bb) {
  const totalHands = agentStats.handsSeatedAsHero;
  const meanBB100 = bbPer100(agentStats.netChips, totalHands, bb);
  const ci95 = ciHalfWidth95(agentStats.pairSumsByMatchup, agentStats.pairSumsByMatchup.length, bb);
  const vpip = agentStats.handsSawPreflop > 0 ? agentStats.preflopVoluntary / agentStats.handsSawPreflop : 0;
  const pfr  = agentStats.handsSawPreflop > 0 ? agentStats.preflopRaised    / agentStats.handsSawPreflop : 0;
  const af   = agentStats.calls > 0 ? (agentStats.bets + agentStats.raises) / agentStats.calls : (agentStats.bets + agentStats.raises);
  const foldRate = agentStats.decisions > 0 ? agentStats.folds / agentStats.decisions : 0;
  const fallbackRate = agentStats.decisions > 0 ? agentStats.fallbacks / agentStats.decisions : 0;
  // MODEL-1b: the cost line. usdPer100Hands is null when nothing was priced
  // (no key, so every decision fell back) or the model has no price entry —
  // an em dash beats a confident $0.00 nobody can act on.
  const per100 = usdPer100Hands(agentStats.cost, totalHands);
  return {
    hands: totalHands,
    netChips: agentStats.netChips,
    bb100: Number(meanBB100.toFixed(2)),
    ci95: Number(ci95.toFixed(2)),
    vpip: Number((vpip * 100).toFixed(1)),
    pfr: Number((pfr * 100).toFixed(1)),
    af: Number(af.toFixed(2)),
    foldRate: Number((foldRate * 100).toFixed(1)),
    fallbackRate: Number((fallbackRate * 100).toFixed(1)),
    decisions: agentStats.decisions,
    model: agentStats.model ?? null,
    inTok: agentStats.cost.inputTokens,
    outTok: agentStats.cost.outputTokens,
    usd: Number(agentStats.cost.usd.toFixed(4)),
    usdPer100: per100 === null ? null : Number(per100.toFixed(4)),
    unpriced: agentStats.cost.unpriced,
    // COST-1: the headline of the whole tree. Calls per 100 hands is the
    // number to compare between a `--route off` run and a default one, and it
    // is decisions-that-reached-a-model rather than dollars because it is
    // model-independent — the same reduction is the same reduction whether it
    // is Haiku or Opus behind it.
    callsPer100: totalHands > 0 ? Number(((agentStats.routes.model / totalHands) * 100).toFixed(1)) : null,
    // BEFORE, on the SAME hands: every decision was a model call, so the
    // baseline is simply the decision rate.
    //
    // This is the honest comparison and a separate `--route off` run is not,
    // because the two runs do not play the same poker: with no API key the
    // model path returns a safe fallback, everybody folds preflop, and the
    // baseline run produces a third of the decisions. Even WITH a key the two
    // runs diverge after the first differing action. One run, two counters off
    // the same decisions, is the only version of this measurement that
    // compares like with like.
    decisionsPer100: totalHands > 0 ? Number(((agentStats.decisions / totalHands) * 100).toFixed(1)) : null,
    policyPct: agentStats.routes.total > 0
      ? Number(((agentStats.routes.policy / agentStats.routes.total) * 100).toFixed(1))
      : null,
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const attrLevel = ATTRIBUTE_LEVELS[args.attributes];
  const growMode = args.attributes === 'grow';
  const grownAgents = [];
  if (!fs.existsSync(args.profiles)) {
    console.error(`profiles file not found: ${args.profiles}`);
    process.exit(1);
  }
  const rawProfiles = JSON.parse(fs.readFileSync(args.profiles, 'utf8'));
  const bundles = {};
  for (const [name, raw] of Object.entries(rawProfiles)) {
    bundles[name] = normalizeBundle(name, raw);
  }
  const names = Object.keys(bundles);
  if (names.length < 2) {
    console.error('need at least 2 profiles');
    process.exit(1);
  }

  let matchups;
  if (args.matchups === '*' || !args.matchups) {
    matchups = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        matchups.push([names[i], names[j]]);
      }
    }
  } else {
    const parts = args.matchups.split(',').map((s) => s.trim());
    if (parts.length !== 2 || !bundles[parts[0]] || !bundles[parts[1]]) {
      console.error(`--matchups must be "A,B" naming two profiles (or "*")`);
      process.exit(1);
    }
    matchups = [parts];
  }

  console.log(`[arena] profiles: ${names.join(', ')}`);
  for (const n of names) {
    const p = bundles[n].profile;
    console.log(`  ${n.padEnd(16)} T=${p.tightness} A=${p.aggression} Bf=${p.bluffFreq} D=${p.discipline}`);
  }
  console.log(`[arena] matchups: ${matchups.length}, pairs each: ${args.pairs} (${args.pairs * 2} hands per matchup)`);
  console.log(`[arena] blinds: ${args.sb}/${args.bb}, buy-in: ${args.buyIn}`);
  console.log(`[arena] opponent reads: ${args.reads ? 'ENABLED' : 'DISABLED (--no-reads)'}`);
  console.log(growMode
    ? `[arena] attributes: GROW — seat A is a DAY-ONE agent (born from his profile, with his nature),` +
      ` seat B at ${NEUTRAL_LEVEL} (ATTRIBUTE_IMPACT=${attributeImpact()})`
    : `[arena] attributes: ${args.attributes.toUpperCase()} — seat A all six at ${attrLevel}, seat B at ${NEUTRAL_LEVEL}` +
      ` (ATTRIBUTE_IMPACT=${attributeImpact()})`);
  if (args.attributes === 'off') {
    console.log('[arena]   "off" is the control: knob 0, so every hook returns its pre-attribute constant.');
  }
  console.log(`[arena] session hand counter runs across the matchup, so STAMINA/fatigue is live over ${args.pairs * 2} hands.`);
  console.log(`[arena] ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'NOT SET (all decisions will fallback)'}\n`);

  // Aggregate stats per SIDE across all matchups it participates in. Keyed by
  // side label, not by profile name: the attribute measurement runs the same
  // profile against itself ("TAG,TAG"), and a name-keyed map would have both
  // seats sharing one stats object and the second summary silently
  // overwriting the first — exactly the number the measurement is about.
  const perAgent = {};
  const aggFor = (label) => (perAgent[label] ??= newStats());
  const matchupSummaries = [];

  const started = Date.now();
  for (const [a, b] of matchups) {
    // Distinct labels when a profile plays itself. These are also the
    // opponentStats playerIds, so the two seats build reads on each other
    // rather than on one merged record.
    const labelA = a === b ? `${a}#A` : a;
    const labelB = a === b ? `${b}#B` : b;
    console.log(`— ${labelA} vs ${labelB} —`);

    // grow: seat A is a newborn playing his first session, not a dial setting.
    const newborn = growMode ? bornAgent(labelA, bundles[a]) : null;
    if (newborn) {
      console.log(`  ${labelA} was born a ${newborn.nature.name} (+${newborn.nature.up} −${newborn.nature.down})`);
      console.log(`  "${newborn.nature.line}"`);
      console.log('  ' + ATTR_KEYS.map((k) => `${k.slice(0, 5)} ${newborn.attrs[k]}`).join('  '));
    }
    const evidence = newborn ? Object.assign(newEvidence(), { _readSubjects: new Set() }) : null;

    const { statsA, statsB } = await runMatchup({
      nameA: labelA,
      bundleA: newborn ? { ...bundles[a], attrs: newborn.attrs } : withAttributes(bundles[a], attrLevel),
      nameB: labelB, bundleB: withAttributes(bundles[b], NEUTRAL_LEVEL),
      pairs: args.pairs,
      sb: args.sb, bb: args.bb, buyIn: args.buyIn,
      readsEnabled: args.reads,
      evidence,
      // MODEL-1c: --model sets both seats, --model-b overrides seat B. Seat A
      // is the variable in every arena dimension, so a mirror with
      // --model X --model-b Y reads as "A on X against B on Y".
      modelA: args.model,
      modelB: args.modelB ?? args.model,
      routeEnabled: args.route,
    });

    if (newborn) {
      evidence.readsFormed = evidence._readSubjects.size;
      delete evidence._readSubjects;
      newborn.stats.handsPlayed = args.pairs * 2;
      const before = Object.fromEntries(ATTR_KEYS.map((k) => [k, newborn.attrs[k]]));
      const growth = applySessionGrowth(newborn, { evidence, handsPlayed: newborn.stats.handsPlayed });
      console.log(`\n  ── ${labelA}'s first session ──`);
      console.log('  evidence: ' + Object.entries(evidence).map(([k, v]) => `${k}=${v}`).join('  '));
      if (growth.ticks.length === 0) console.log('  he did not grow tonight.');
      for (const t of growth.ticks) {
        console.log(`  ${t.key.padEnd(11)} ${t.from} → ${t.to}   ${t.cause}`);
      }
      if (growth.narrowed.length > 0) {
        console.log(`  scouting narrowed (stage ${growth.stage}): ${growth.narrowed.join(', ')}`);
      }
      console.log('  ' + ATTR_KEYS.map((k) => `${k.slice(0, 5)} ${before[k]}→${newborn.attrs[k]}`).join('  '));
      grownAgents.push({
        label: labelA, nature: newborn.nature.name,
        attrs: { ...newborn.attrs }, potential: newborn.potential,
        attrLog: newborn.attrLog, evidence, ticks: growth.ticks, narrowed: growth.narrowed,
      });
    }
    matchupSummaries.push({
      a: labelA, b: labelB,
      [labelA]: summarizeAgent(statsA, args.bb),
      [labelB]: summarizeAgent(statsB, args.bb),
    });
    // Fold matchup stats into the per-side aggregate.
    mergeStats(aggFor(labelA), statsA);
    mergeStats(aggFor(labelB), statsB);
  }
  const elapsedSec = ((Date.now() - started) / 1000).toFixed(1);

  const perAgentSummary = Object.fromEntries(
    Object.entries(perAgent).map(([label, st]) => [label, summarizeAgent(st, args.bb)]),
  );

  console.log('\n═══ SUMMARY ═══');
  const seatALabel = growMode ? 'day-one (born)' : attrLevel;
  console.log(`attributes: ${args.attributes} (seat A ${seatALabel} / seat B ${NEUTRAL_LEVEL}, impact ${attributeImpact()})`);
  console.log('\nPer-agent aggregate (all matchups):');
  console.table(perAgentSummary);
  console.log('\nPer-matchup detail:');
  for (const m of matchupSummaries) {
    console.log(`  ${m.a} vs ${m.b}: ${m.a} bb/100=${m[m.a].bb100}±${m[m.a].ci95}  ${m.b} bb/100=${m[m.b].bb100}±${m[m.b].ci95}`);
    // Seat A carries the attributes; seat B is neutral. In a same-strategy
    // matchup A's own bb/100 IS the attribute effect, so state it as one line.
    const lo = (m[m.a].bb100 - m[m.a].ci95).toFixed(1);
    const hi = (m[m.a].bb100 + m[m.a].ci95).toFixed(1);
    console.log(`    seat A attributes=${seatALabel} vs seat B=${NEUTRAL_LEVEL} -> A bb/100 ${m[m.a].bb100}, 95% CI [${lo}, ${hi}]`);
  }
  // ── MODEL-1b: the cost line ────────────────────────────────────────────────
  // The answer to CORE_GAME_PLAN's "model tiers" question is a number next to
  // the bb/100, not an intuition. Printed per agent because a --model-b run
  // has two different bills in one table.
  // ── COST-1: the route line ─────────────────────────────────────────────────
  // Printed above the cost line because it is what EXPLAINS the cost line. The
  // number to quote is callsPer100: run once with `--route off` and once
  // without, on the same decks, and the difference is the reduction — measured
  // rather than claimed.
  console.log(`\nRouting (${args.route ? 'on' : 'OFF — every decision to the model, the baseline'}):`);
  for (const [name, st] of Object.entries(perAgent)) {
    const row = perAgentSummary[name];
    const cut = row.decisionsPer100 > 0
      ? (100 * (1 - row.callsPer100 / row.decisionsPer100)).toFixed(1)
      : null;
    console.log(
      `  ${String(name).padEnd(18)} ${row.decisionsPer100 ?? '—'} decisions per 100 hands ` +
      `→ ${row.callsPer100 ?? '—'} model calls per 100 hands` +
      (cut === null ? '' : `   (${cut}% fewer)`),
    );
    console.log(`    ${formatRoutes(st.routes)}`);
  }

  console.log('\nCost (estimated, from the shipped price table + MODEL_PRICES):');
  let anyPriced = false;
  for (const [name, row] of Object.entries(perAgentSummary)) {
    const label = row.model ? `${row.model}` : '(no model calls — all fallback)';
    if (row.usdPer100 !== null) anyPriced = true;
    console.log(
      `  ${String(name).padEnd(18)} ${label}\n` +
      `    ${row.decisions} decisions  in:${row.inTok} out:${row.outTok}  ` +
      `total ${formatUsd(row.usd)}  → ${formatUsd(row.usdPer100)} per 100 hands` +
      (row.unpriced > 0 ? `  (${row.unpriced} unpriced call(s))` : ''),
    );
  }
  if (!anyPriced) {
    console.log('  no priced calls — set a key, or add the model to MODEL_PRICES.');
  }

  console.log(`\ntotal time: ${elapsedSec}s`);

  // Persist
  const outDir = path.join('data', 'arena');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `run-${stamp}.json`);
  const record = {
    timestamp: new Date().toISOString(),
    args,
    attributes: {
      setting: args.attributes,
      seatAValue: attrLevel,
      seatBValue: NEUTRAL_LEVEL,
      impact: attributeImpact(),
      grown: grownAgents.length > 0 ? grownAgents : undefined,
    },
    profiles: bundles,
    matchups: matchupSummaries,
    perAgent: perAgentSummary,
    // COST-1: the full route split per agent, saved rather than only printed,
    // so a `--route off` baseline and a routed run can be diffed later by
    // something other than a person reading two terminals.
    routes: Object.fromEntries(Object.entries(perAgent).map(([name, st]) => [name, st.routes])),
    routeEnabled: args.route,
    elapsedSec: Number(elapsedSec),
    apiKeyPresent: !!process.env.ANTHROPIC_API_KEY,
    model: args.model || process.env.AI_MODEL || 'claude-haiku-4-5',
    // MODEL-1c: both sides recorded, so a saved A/B run says what it compared
    // without anyone having to remember the command line.
    models: {
      a: args.model || process.env.AI_MODEL || 'claude-haiku-4-5',
      b: args.modelB || args.model || process.env.AI_MODEL || 'claude-haiku-4-5',
    },
    providers: {
      a: providerIdFor(args.model || process.env.AI_MODEL || 'claude-haiku-4-5'),
      b: providerIdFor(args.modelB || args.model || process.env.AI_MODEL || 'claude-haiku-4-5'),
    },
    prices: {
      a: priceFor(args.model || process.env.AI_MODEL || 'claude-haiku-4-5'),
      b: priceFor(args.modelB || args.model || process.env.AI_MODEL || 'claude-haiku-4-5'),
    },
  };
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), 'utf8');
  console.log(`\n[arena] wrote ${outPath}`);
}

function mergeStats(agg, part) {
  agg.handsSeatedAsHero += part.handsSeatedAsHero;
  agg.netChips          += part.netChips;
  agg.decisions         += part.decisions;
  agg.preflopVoluntary  += part.preflopVoluntary;
  agg.preflopRaised     += part.preflopRaised;
  agg.handsSawPreflop   += part.handsSawPreflop;
  agg.calls             += part.calls;
  agg.bets              += part.bets;
  agg.raises            += part.raises;
  agg.folds             += part.folds;
  agg.checks            += part.checks;
  agg.fallbacks         += part.fallbacks;
  if (part.model && !agg.model) agg.model = part.model;
  if (part.routes) {
    agg.routes.total  += part.routes.total;
    agg.routes.policy += part.routes.policy;
    agg.routes.model  += part.routes.model;
    for (const [reason, n] of Object.entries(part.routes.byReason)) {
      agg.routes.byReason[reason] = (agg.routes.byReason[reason] ?? 0) + n;
    }
  }
  if (part.cost) {
    agg.cost.calls             += part.cost.calls;
    agg.cost.inputTokens       += part.cost.inputTokens;
    agg.cost.outputTokens      += part.cost.outputTokens;
    agg.cost.cachedInputTokens += part.cost.cachedInputTokens;
    agg.cost.usd               += part.cost.usd;
    agg.cost.unpriced          += part.cost.unpriced;
  }
  agg.pairSumsByMatchup.push(...part.pairSumsByMatchup);
}

main().catch((err) => {
  console.error('[arena] fatal:', err);
  process.exit(1);
});
