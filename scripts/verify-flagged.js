// scripts/verify-flagged.js — FLAG-1
// Drive synthetic hands through the classifier and assert each flag type
// triggers exactly when expected. No server process needed.
// Run: node scripts/verify-flagged.js

import { classifyHand, buildFlaggedEntry, THRESHOLDS } from '../src/server/flaggedHands.js';

let passed = 0;
let failed = 0;

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

// Helper: make a single decision record.
function dec(street, actionType, amount, equity, potOdds = null, community = []) {
  return {
    seat: 0,
    street,
    action: { type: actionType, amount },
    equity,
    potOdds,
    holeCards: ['Ah', 'Kd'],
    community,
    reasoning: `test reasoning for ${actionType}`,
  };
}

// ── Test suite ────────────────────────────────────────────────────────────────

console.log('\nBIG BLUFF');
assert(
  'bet with equity < threshold, opponent folds → bigBluff',
  classifyHand({ won: true, resultType: 'fold', decisions: [dec('river', 'raise', 200, 0.25)], pot: 400, sessionBiggestPot: 999 }),
  'bigBluff'
);
assert(
  'equity at threshold boundary (exactly BLUFF_MAX_EQUITY) → null',
  classifyHand({ won: true, resultType: 'fold', decisions: [dec('river', 'raise', 200, THRESHOLDS.BLUFF_MAX_EQUITY)], pot: 400, sessionBiggestPot: 999 }),
  null
);
assert(
  'bluff equity ok but result is showdown → null',
  classifyHand({ won: true, resultType: 'showdown', decisions: [dec('river', 'raise', 200, 0.25)], pot: 400, sessionBiggestPot: 999 }),
  null
);
assert(
  'fold win but action is call (not a bluff) → null',
  classifyHand({ won: true, resultType: 'fold', decisions: [dec('river', 'call', 100, 0.25)], pot: 400, sessionBiggestPot: 999 }),
  null
);

console.log('\nBAD BEAT');
assert(
  'lost showdown with equity > threshold → badBeat',
  classifyHand({ won: false, resultType: 'showdown', decisions: [dec('flop', 'bet', 80, 0.82)], pot: 400, sessionBiggestPot: 999 }),
  'badBeat'
);
assert(
  'equity at threshold boundary (exactly BAD_BEAT_MIN_EQUITY) → cooler fallthrough',
  classifyHand({ won: false, resultType: 'showdown', decisions: [dec('flop', 'bet', 80, THRESHOLDS.BAD_BEAT_MIN_EQUITY)], pot: 400, sessionBiggestPot: 999 }),
  'cooler'
);
assert(
  'lost by fold (not showdown) → null',
  classifyHand({ won: false, resultType: 'fold', decisions: [dec('flop', 'bet', 80, 0.82)], pot: 400, sessionBiggestPot: 999 }),
  null
);

console.log('\nCOOLER');
assert(
  'lost showdown with equity in cooler band → cooler',
  classifyHand({ won: false, resultType: 'showdown', decisions: [dec('turn', 'bet', 100, 0.62)], pot: 400, sessionBiggestPot: 999 }),
  'cooler'
);
assert(
  'equity below cooler threshold → null',
  classifyHand({ won: false, resultType: 'showdown', decisions: [dec('turn', 'bet', 100, 0.45)], pot: 400, sessionBiggestPot: 999 }),
  null
);

console.log('\nHERO CALL');
assert(
  'called with marginal equity and won at showdown → heroCall',
  classifyHand({ won: true, resultType: 'showdown', decisions: [dec('river', 'call', 100, 0.42)], pot: 400, sessionBiggestPot: 999 }),
  'heroCall'
);
assert(
  'equity below heroCall min → null',
  classifyHand({ won: true, resultType: 'showdown', decisions: [dec('river', 'call', 100, 0.20)], pot: 400, sessionBiggestPot: 999 }),
  null
);
assert(
  'equity above heroCall max (standard call) → null',
  classifyHand({ won: true, resultType: 'showdown', decisions: [dec('river', 'call', 100, 0.55)], pot: 400, sessionBiggestPot: 999 }),
  null
);
assert(
  'hero-equity call but won by fold → null',
  classifyHand({ won: true, resultType: 'fold', decisions: [dec('river', 'call', 100, 0.42)], pot: 400, sessionBiggestPot: 999 }),
  null
);

console.log('\nBIGGEST POT');
assert(
  'pot exceeds session biggest → biggestPot',
  classifyHand({ won: true, resultType: 'fold', decisions: [], pot: 1000, sessionBiggestPot: 500 }),
  'biggestPot'
);
assert(
  'pot equals session biggest (not strictly greater) → no flag',
  classifyHand({ won: true, resultType: 'fold', decisions: [], pot: 500, sessionBiggestPot: 500 }),
  null
);
assert(
  'biggestPot supersedes drama flag — bluff would fire but pot wins',
  classifyHand({ won: true, resultType: 'fold', decisions: [dec('river', 'raise', 300, 0.22)], pot: 1200, sessionBiggestPot: 500 }),
  'biggestPot'
);

console.log('\nNON-NOTABLE HANDS (should return null)');
assert(
  'won showdown, no marginal call, no bluff → null',
  classifyHand({ won: true, resultType: 'showdown', decisions: [dec('flop', 'bet', 80, 0.72)], pot: 400, sessionBiggestPot: 999 }),
  null
);
assert(
  'empty decisions → null',
  classifyHand({ won: false, resultType: 'showdown', decisions: [], pot: 100, sessionBiggestPot: 999 }),
  null
);
assert(
  'preflop fold only → null',
  classifyHand({ won: false, resultType: 'fold', decisions: [dec('preflop', 'fold', 0, 0.30)], pot: 30, sessionBiggestPot: 999 }),
  null
);

console.log('\nBUILDFLAGGEDENTRY shape');
const entry = buildFlaggedEntry({
  flagType: 'badBeat',
  decisions: [dec('flop', 'bet', 80, 0.82, 0.33, ['Kc', '9h', '4d'])],
  handNumber: 42,
  pot: 400,
  holeCards: ['Ah', 'Kd'],
  won: false,
});
assert('entry has flagType', entry.flagType, 'badBeat');
assert('entry has handNumber', entry.handNumber, 42);
assert('entry has pot', entry.pot, 400);
assert('entry has holeCards', Array.isArray(entry.holeCards), true);
assert('entry has streets array', Array.isArray(entry.streets), true);
assert('street has equity as integer', entry.streets[0].equity, 82);
assert('street has formatted action', entry.streets[0].action, 'BET 80');
assert('street has board', Array.isArray(entry.streets[0].board), true);
assert('won is false', entry.won, false);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
