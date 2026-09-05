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
import { compilePolicy, inferProfileFromStyleRisk } from '../src/agent/policy.js';
import { ATTR_KEYS, effectiveAttrs, readMinHands, attributeImpact } from '../src/agent/attributes.js';
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
const ATTRIBUTE_LEVELS = { off: 50, low: 25, mid: 50, high: 80 };

function parseArgs(argv) {
  const out = { pairs: 100, profiles: 'scripts/arena-profiles.json', matchups: '*', sb: 10, bb: 20, buyIn: 2000, reads: true, attributes: 'mid' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pairs')     out.pairs    = parseInt(argv[++i], 10);
    else if (a === '--profiles') out.profiles = argv[++i];
    else if (a === '--matchups') out.matchups = argv[++i];
    else if (a === '--sb')   out.sb       = parseInt(argv[++i], 10);
    else if (a === '--bb')   out.bb       = parseInt(argv[++i], 10);
    else if (a === '--buy-in') out.buyIn  = parseInt(argv[++i], 10);
    else if (a === '--no-reads') out.reads = false;
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
      console.log('usage: node scripts/arena.js --pairs N --profiles path.json [--matchups "A,B"|"*"] [--no-reads] [--attributes off|low|mid|high]');
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
  };
}

function collectDecisionMetrics(stats, decisions) {
  // Aggregate per-hand: was there a voluntary preflop action? was there a raise?
  let sawPreflop = false;
  let voluntaryPreflop = false;
  let raisedPreflop = false;
  for (const d of decisions) {
    stats.decisions++;
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

async function playHand({ deck, seat0Bundle, seat1Bundle, nameBySeat, sb, bb, buyIn, readsEnabled = true, sessionHands = 0 }) {
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

    const { action, reasoning } = await getAgentAction(gameState, bundles[seat].strategy, '');
    const streetAtDecision = game.street;
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
    });
  }

  const finalStack0 = game.seats[0].stack;
  const finalStack1 = game.seats[1].stack;
  const showdownSeats = Array.isArray(game.result?.showdown)
    ? game.result.showdown.map((s) => s.seat).filter((n) => Number.isInteger(n))
    : [];

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

async function runMatchup({ nameA, bundleA, nameB, bundleB, pairs, sb, bb, buyIn, readsEnabled }) {
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
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const attrLevel = ATTRIBUTE_LEVELS[args.attributes];
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
  console.log(`[arena] attributes: ${args.attributes.toUpperCase()} — seat A all six at ${attrLevel}, seat B at ${NEUTRAL_LEVEL}` +
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
    const { statsA, statsB } = await runMatchup({
      nameA: labelA, bundleA: withAttributes(bundles[a], attrLevel),
      nameB: labelB, bundleB: withAttributes(bundles[b], NEUTRAL_LEVEL),
      pairs: args.pairs,
      sb: args.sb, bb: args.bb, buyIn: args.buyIn,
      readsEnabled: args.reads,
    });
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
  console.log(`attributes: ${args.attributes} (seat A ${attrLevel} / seat B ${NEUTRAL_LEVEL}, impact ${attributeImpact()})`);
  console.log('\nPer-agent aggregate (all matchups):');
  console.table(perAgentSummary);
  console.log('\nPer-matchup detail:');
  for (const m of matchupSummaries) {
    console.log(`  ${m.a} vs ${m.b}: ${m.a} bb/100=${m[m.a].bb100}±${m[m.a].ci95}  ${m.b} bb/100=${m[m.b].bb100}±${m[m.b].ci95}`);
    // Seat A carries the attributes; seat B is neutral. In a same-strategy
    // matchup A's own bb/100 IS the attribute effect, so state it as one line.
    const lo = (m[m.a].bb100 - m[m.a].ci95).toFixed(1);
    const hi = (m[m.a].bb100 + m[m.a].ci95).toFixed(1);
    console.log(`    seat A attributes=${attrLevel} vs seat B=${NEUTRAL_LEVEL} -> A bb/100 ${m[m.a].bb100}, 95% CI [${lo}, ${hi}]`);
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
    },
    profiles: bundles,
    matchups: matchupSummaries,
    perAgent: perAgentSummary,
    elapsedSec: Number(elapsedSec),
    apiKeyPresent: !!process.env.ANTHROPIC_API_KEY,
    model: process.env.AI_MODEL || 'claude-haiku-4-5',
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
  agg.pairSumsByMatchup.push(...part.pairSumsByMatchup);
}

main().catch((err) => {
  console.error('[arena] fatal:', err);
  process.exit(1);
});
