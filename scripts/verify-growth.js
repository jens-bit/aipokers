// scripts/verify-growth.js — ATTR-3
//
// A whole career, offline, in about a second: a day-one agent plays 600 hands
// across a dozen sessions and we watch what he becomes. Prints his growth log
// and the history of his scouted bands as tables you can read.
//
// Everything here is the real thing except the table orchestration:
//   · the real NLHE engine deals and settles every hand
//   · the real handler produces every decision (fallback, no model call)
//   · the real evidence rules from attributes.js count what he earned
//   · the real applySessionGrowth draws his ticks and narrows his bands
//
// NO MODEL CALLS, EVER. The key is removed from the environment before the
// agent module is touched and the run asserts it stayed gone, so this script
// can never bill: it is discovered by src/test/verifyScripts.test.js and runs
// on every `npm test` and every CI push.
//
// Usage:
//   node scripts/verify-growth.js
//   node scripts/verify-growth.js --hands 2100     # far enough to reach stage 3

// ── No key. Not now, not by accident. ───────────────────────────────────────
const HAD_KEY = !!process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_API_KEY;

import { Game, Streets, Actions } from '../src/engine/game.js';
import { freshShuffledDeck } from '../src/engine/deck.js';
import { estimateEquity } from '../src/engine/equity.js';
import { getAgentAction, perceivedMath } from '../src/agent/handler.js';
import { compilePolicy } from '../src/agent/policy.js';
import {
  ATTR_KEYS,
  SCOUT_STAGES,
  birthAttributes,
  ensureAttributes,
  effectiveAttrs,
  applySessionGrowth,
  attrCostsForHand,
  newEvidence,
  addEvidence,
  decisionEvidence,
  handEvidence,
  logAttrChange,
} from '../src/agent/attributes.js';
import { THRESHOLDS } from '../src/server/flaggedHands.js';

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
}

function parseArgs(argv) {
  const out = { hands: 600, sessionHands: 50, seed: 7 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--hands') out.hands = parseInt(argv[++i], 10);
    else if (argv[i] === '--session') out.sessionHands = parseInt(argv[++i], 10);
    else if (argv[i] === '--seed') out.seed = parseInt(argv[++i], 10);
  }
  return out;
}
const args = parseArgs(process.argv);

// Deterministic everywhere it matters: the same run twice is the same career.
let rngState = args.seed >>> 0;
function rand() {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}

const PROFILE = { tightness: 70, aggression: 70, bluffFreq: 30, discipline: 80 };
const SB = 10, BB = 20, BUY_IN = 2000;

console.log('═══ ATTR-3 · a career, offline ═══\n');
console.log(`  hands: ${args.hands}   session length: ${args.sessionHands}   seed: ${args.seed}`);
console.log(`  ANTHROPIC_API_KEY: ${HAD_KEY ? 'was set — REMOVED for this run' : 'not set'}`);

// ── Day one ─────────────────────────────────────────────────────────────────
const agent = {
  id: 'agent_verify_growth',
  name: 'The Understudy',
  profile: PROFILE,
  stats: { handsPlayed: 0 },
};
ensureAttributes(agent);
const born = birthAttributes({ profile: PROFILE, rand });
agent.attrs = born.attrs;
agent.potential = born.potential;
agent.potentialBirth = JSON.parse(JSON.stringify(born.potential));
agent.nature = born.nature;
agent.attrLog = [];
for (const k of ATTR_KEYS) {
  logAttrChange(agent, { key: k, from: agent.attrs[k], to: agent.attrs[k], cause: 'birth', ts: Date.now() });
}

console.log(`\n  born a ${agent.nature.name}  (+${agent.nature.up} −${agent.nature.down})`);
console.log(`  "${agent.nature.line}"`);
console.log(`  built for : ${agent.nature.builtFor}`);
console.log(`  struggles : ${agent.nature.struggle}`);

const dayOne = Object.fromEntries(ATTR_KEYS.map((k) => [k, agent.attrs[k]]));
const bandHistory = [{ at: 0, label: 'born', bands: snapshotBands() }];

function snapshotBands() {
  return Object.fromEntries(ATTR_KEYS.map((k) => [k, { ...agent.potential[k] }]));
}

// ── One hand, through the real engine ───────────────────────────────────────
// Both seats are the same agent record played by the same fallback handler;
// only seat 0's evidence is collected, because only seat 0 is the character we
// are following.
async function playHand({ sessionHands, evidence, costSink }) {
  const game = new Game({
    tableId: 'growth',
    seats: [{ playerId: 'hero', stack: BUY_IN }, { playerId: 'villain', stack: BUY_IN }],
    smallBlind: SB, bigBlind: BB, dealerSeat: 0,
  });
  game.startHand(freshShuffledDeck());

  const heroDecisions = [];
  let safety = 200;
  while (game.street !== Streets.COMPLETE && game.street !== Streets.SHOWDOWN && safety-- > 0) {
    const seat = game.toAct;
    if (seat === null || seat === undefined) break;
    const me = game.seats[seat];
    const legal = game.legalActions(seat);
    const callAction = legal.find((a) => a.type === Actions.CALL) ?? null;
    const betAction = legal.find((a) => a.type === Actions.BET) ?? null;
    const raiseAction = legal.find((a) => a.type === Actions.RAISE) ?? null;
    const toCall = callAction?.amount ?? 0;

    let equity = null;
    try {
      equity = estimateEquity({ holeCards: me.holeCards, community: game.community, nOpponents: 1, iterations: 200 }).equity;
    } catch { /* leave null */ }

    // Seat 0 plays with his real, fatigued attributes; the villain is neutral.
    const eff = seat === 0 ? effectiveAttrs(agent, { sessionHands }) : null;
    const position = game.dealerSeat === seat ? 'BTN/SB' : 'BB';
    const policy = compilePolicy(PROFILE, { holeCards: me.holeCards, position, attrs: eff, rand });

    const gs = {
      holeCards: me.holeCards, community: game.community, pot: game.pot, street: game.street,
      myStack: me.stack, oppStack: game.seats[(seat + 1) % 2].stack, myContrib: me.contribThisStreet,
      position, sb: SB, bb: BB,
      canCheck: legal.some((a) => a.type === Actions.CHECK),
      canBet: !!betAction, canRaise: !!raiseAction, toCall,
      minBet: betAction?.min ?? 0, maxBet: betAction?.max ?? 0,
      minRaise: raiseAction?.min ?? 0, maxRaise: raiseAction?.max ?? 0,
      equity,
      potOdds: toCall > 0 ? toCall / (game.pot + toCall) : null,
      spr: game.pot > 0 ? me.stack / game.pot : null,
      policy, raisesThisStreet: 0, opponentReads: [],
      attrs: eff, fatigue: eff?.fatigue ?? null,
      seat, handNumber: game.handNumber,
    };

    const { action } = await getAgentAction(gs, '', '');
    const streetAtDecision = game.street;

    if (seat === 0) {
      const seen = perceivedMath(gs);
      const attr = {
        seenEquity: seen.equity, seenPotOdds: seen.potOdds,
        deviationDie: !!policy.dice.deviationDie,
        inRange: policy.range ? !!policy.range.inRange : null,
        moodState: 'neutral', readSubjects: [], fatigue: gs.fatigue,
      };
      addEvidence(evidence, decisionEvidence({
        trueEquity: equity, seenEquity: seen.equity,
        deviationDie: attr.deviationDie, inRange: attr.inRange, actionType: action?.type ?? null,
      }));
      heroDecisions.push({
        street: streetAtDecision, action, equity, potOdds: gs.potOdds, attr,
        community: [...game.community],
      });
    }

    try {
      game.act(seat, action);
    } catch {
      const alt = legal.find((a) => a.type === Actions.CHECK) ?? legal.find((a) => a.type === Actions.CALL) ?? { type: Actions.FOLD };
      try { game.act(seat, { type: alt.type, ...(alt.amount ? { amount: alt.amount } : {}) }); } catch { break; }
    }
  }

  const won = (game.result?.winners ?? []).some((w) => w.seat === 0);
  const resultType = game.result?.type === 'showdown' ? 'showdown' : 'fold';
  addEvidence(evidence, handEvidence({
    decisions: heroDecisions, won, resultType, bluffMaxEquity: THRESHOLDS.BLUFF_MAX_EQUITY,
  }));

  const costs = attrCostsForHand({ decisions: heroDecisions, won });
  for (const c of costs) costSink.push({ ...c, hand: agent.stats.handsPlayed + 1 });
  return { won };
}

// ── The career ──────────────────────────────────────────────────────────────
const costSink = [];
const sessions = [];
let sessionsRun = 0;

for (let played = 0; played < args.hands; played += args.sessionHands) {
  const length = Math.min(args.sessionHands, args.hands - played);
  const evidence = newEvidence();
  let seenWorn = false;

  for (let h = 0; h < length; h++) {
    // Fatigue is measured against THIS seat's session, exactly as table.js does.
    const stage = effectiveAttrs(agent, { sessionHands: h }).fatigue;
    if (stage === 'worn') seenWorn = true;
    await playHand({ sessionHands: h, evidence, costSink });
    agent.stats.handsPlayed++;
  }

  // READS and COMPOSURE come from the table's own machinery (opponent stats and
  // the mood loop), neither of which exists offline. They are fed here at the
  // rate a real session produces them so the log is not silent on two of six.
  evidence.readsFormed = Math.round(length / 25);
  evidence.tiltSurvived = Math.round(length / 30);

  const before = Object.fromEntries(ATTR_KEYS.map((k) => [k, agent.attrs[k]]));
  const growth = applySessionGrowth(agent, {
    evidence, handsPlayed: agent.stats.handsPlayed, rand,
    now: Date.now() + sessionsRun * 86400000,
  });
  sessionsRun++;

  sessions.push({
    n: sessionsRun,
    hands: length,
    lifetime: agent.stats.handsPlayed,
    worn: seenWorn,
    evidence: { ...evidence },
    ticks: growth.ticks,
    narrowed: growth.narrowed,
    before,
  });
  if (growth.narrowed.length > 0) {
    bandHistory.push({ at: agent.stats.handsPlayed, label: `stage ${growth.stage}`, bands: snapshotBands() });
  }
}

// ── The tables ──────────────────────────────────────────────────────────────
const pad = (v, n) => String(v).padStart(n);
const padE = (v, n) => String(v).padEnd(n);

console.log(`\n── Sessions ─────────────────────────────────────────────────────────`);
const GREW_W = 52;
console.log('  ' + padE('#', 4) + pad('hands', 6) + pad('career', 8) + '  ' + padE('fatigue', 9) + padE('grew', GREW_W) + 'narrowed');
for (const s of sessions) {
  let grew = s.ticks.map((t) => `${t.key.slice(0, 5)} ${t.from}→${t.to}`).join('  ') || '—';
  if (grew.length > GREW_W - 2) grew = `${grew.slice(0, GREW_W - 3)}…`;
  console.log('  ' + padE(s.n, 4) + pad(s.hands, 6) + pad(s.lifetime, 8) + '  ' +
    padE(s.worn ? 'worn' : 'settled', 9) + padE(grew, GREW_W) + (s.narrowed.length ? `${s.narrowed.length} keys` : '—'));
}

console.log(`\n── The growth log (agent.attrLog, what the client draws) ────────────`);
console.log('  ' + padE('key', 12) + padE('from→to', 10) + 'cause');
for (const e of agent.attrLog) {
  if (e.cause === 'birth') continue;
  console.log('  ' + padE(e.key, 12) + padE(`${e.from}→${e.to}`, 10) + e.cause);
}
const ticks = agent.attrLog.filter((e) => e.cause !== 'birth' && e.cause !== 'narrowed');
const narrowings = agent.attrLog.filter((e) => e.cause === 'narrowed');
console.log(`  (${ticks.length} growth ticks, ${narrowings.length} narrowing entries, ${agent.attrLog.length} log entries in all)`);

console.log(`\n── Where he ended up ────────────────────────────────────────────────`);
console.log('  ' + padE('attribute', 12) + pad('day one', 8) + pad('now', 6) + pad('gain', 6) + '   band day one     band now');
for (const k of ATTR_KEYS) {
  const b0 = bandHistory[0].bands[k];
  const b1 = agent.potential[k];
  console.log('  ' + padE(k, 12) + pad(dayOne[k], 8) + pad(agent.attrs[k], 6) +
    pad(`+${agent.attrs[k] - dayOne[k]}`, 6) + '   ' +
    padE(`${b0.lo}–${b0.hi} (${b0.hi - b0.lo})`, 16) + `${b1.lo}–${b1.hi} (${b1.hi - b1.lo})`);
}

console.log(`\n── Band history (narrowing is a visible jump, never a widening) ─────`);
console.log('  ' + padE('at hand', 9) + padE('stage', 9) + ATTR_KEYS.map((k) => padE(k.slice(0, 5), 10)).join(''));
for (const snap of bandHistory) {
  console.log('  ' + padE(snap.at, 9) + padE(snap.label, 9) +
    ATTR_KEYS.map((k) => padE(`${snap.bands[k].lo}–${snap.bands[k].hi}`, 10)).join(''));
}

if (costSink.length > 0) {
  console.log(`\n── What his attributes cost him (${costSink.length} lines across ${args.hands} hands) ─────`);
  const byKey = new Map();
  for (const c of costSink) byKey.set(c.key, (byKey.get(c.key) ?? 0) + 1);
  for (const [k, n] of byKey) console.log('  ' + padE(k, 12) + pad(n, 5) + ' hands');
  console.log(`  e.g. hand ${costSink[0].hand}: "${costSink[0].line}" · ${costSink[0].key}`);
}

// ── Assertions ──────────────────────────────────────────────────────────────
console.log('\n── checks ───────────────────────────────────────────────────────────');
check('no model call was possible — the key was removed and stayed removed',
  !process.env.ANTHROPIC_API_KEY);
check(`played ${args.hands} hands`, agent.stats.handsPlayed === args.hands);
check('he grew — at least one tick', ticks.length > 0);
check('every tick is exactly one point', ticks.every((e) => e.to - e.from === 1));
check('every tick has a cause in his world',
  ticks.every((e) => typeof e.cause === 'string' && e.cause.length > 12 && e.cause !== 'narrowed'));
check('nothing regressed', ATTR_KEYS.every((k) => agent.attrs[k] >= dayOne[k]));
check('nothing passed its ceiling', ATTR_KEYS.every((k) => agent.attrs[k] <= agent.potential[k].hi));
check('bands only ever closed', (() => {
  for (let i = 1; i < bandHistory.length; i++) {
    for (const k of ATTR_KEYS) {
      const a = bandHistory[i - 1].bands[k], b = bandHistory[i].bands[k];
      if (b.lo < a.lo || b.hi > a.hi) return false;
    }
  }
  return true;
})());
check('bands stayed inside the ones he was born with', ATTR_KEYS.every((k) => {
  const b0 = bandHistory[0].bands[k], b1 = agent.potential[k];
  return b1.lo >= b0.lo && b1.hi <= b0.hi;
}));
const expectedStage = SCOUT_STAGES.filter((s) => args.hands >= s.hands).length;
check(`reached scouting stage ${expectedStage} at ${args.hands} hands`, (agent.scoutStage ?? 0) === expectedStage);
if (expectedStage > 0) {
  const width = SCOUT_STAGES[expectedStage - 1].width;
  check(`bands closed to the stage width (${width})`,
    ATTR_KEYS.every((k) => agent.potential[k].hi - agent.potential[k].lo <= width));
  check('narrowing was logged', narrowings.length > 0);
  check('a narrowing never moved a value', narrowings.every((e) => e.from === e.to));
}
check('the nature never changed', agent.nature.name === born.nature.name);
check('the attrLog stayed inside its ring buffer', agent.attrLog.length <= 200);

console.log('');
if (failures === 0) {
  console.log('[verify-growth] ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.error(`[verify-growth] ${failures} check(s) failed`);
  process.exit(1);
}
