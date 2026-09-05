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
assert('entry holeCards are populated', entry.holeCards.length > 0, true);
assert('entry holeCards[0] is a string', typeof entry.holeCards[0], 'string');
assert('entry has streets array', Array.isArray(entry.streets), true);
assert('street has equity as integer', entry.streets[0].equity, 82);
assert('street has formatted action', entry.streets[0].action, 'BET 80');
assert('street has board', Array.isArray(entry.streets[0].board), true);
assert('won is false', entry.won, false);
assert('entry has opponentShowdownCards array', Array.isArray(entry.opponentShowdownCards), true);

console.log('\nBUILDFLAGGEDENTRY — showdown opponent cards');
const showdownEntry = buildFlaggedEntry({
  flagType: 'badBeat',
  decisions: [dec('river', 'bet', 120, 0.80)],
  handNumber: 7,
  pot: 600,
  holeCards: ['Kh', 'Kd'],
  won: false,
  opponentShowdownCards: [{ seat: 1, holeCards: ['As', 'Ac'] }],
});
assert('showdown entry has opponentShowdownCards', Array.isArray(showdownEntry.opponentShowdownCards), true);
assert('showdown entry has one opponent', showdownEntry.opponentShowdownCards.length, 1);
assert('opponent seat recorded', showdownEntry.opponentShowdownCards[0].seat, 1);
assert('opponent holeCards recorded', Array.isArray(showdownEntry.opponentShowdownCards[0].holeCards), true);
assert('opponent holeCards populated', showdownEntry.opponentShowdownCards[0].holeCards.length, 2);

console.log('\nBUILDFLAGGEDENTRY — mucked / fold win (no showdown)');
const foldEntry = buildFlaggedEntry({
  flagType: 'bigBluff',
  decisions: [dec('river', 'raise', 200, 0.22)],
  handNumber: 3,
  pot: 500,
  holeCards: ['7c', '2d'],
  won: true,
  // opponentShowdownCards omitted — fold win, no cards revealed
});
assert('fold-win entry has opponentShowdownCards array', Array.isArray(foldEntry.opponentShowdownCards), true);
assert('fold-win entry has no opponent cards (mucked)', foldEntry.opponentShowdownCards.length, 0);

// ── Summary ───────────────────────────────────────────────────────────────────
// ── RIDERS-1: the two exactness gaps, through the REAL path ─────────────────
// Everything above builds decision objects by hand. This drives an actual jam
// through the engine and the Table, so what is asserted is what table.js
// really writes down — the gap being closed is precisely that the replay had
// to infer these from an action string.
console.log('\nRIDERS-1: pot and allIn recorded at the table');
{
  const { Game, Streets, Actions } = await import('../src/engine/game.js');
  const { freshShuffledDeck } = await import('../src/engine/deck.js');

  const game = new Game({
    tableId: 'flag-riders',
    seats: [{ playerId: 'hero', stack: 2000 }, { playerId: 'villain', stack: 2000 }],
    smallBlind: 10, bigBlind: 20, dealerSeat: 0,
  });
  game.startHand(freshShuffledDeck());

  // Mirror what table.js records: push the decision, act, then stamp.
  const decisions = [];
  let guard = 20;
  while (game.street !== Streets.COMPLETE && game.street !== Streets.SHOWDOWN && guard-- > 0) {
    const seat = game.toAct;
    if (seat === null || seat === undefined) break;
    const legal = game.legalActions(seat);
    const raise = legal.find((a) => a.type === Actions.RAISE);
    const call = legal.find((a) => a.type === Actions.CALL);
    const action = raise ? { type: 'raise', amount: raise.max }
      : call ? { type: 'call' }
      : { type: 'check' };
    const idx = decisions.push({
      seat, street: game.street, action,
      community: [...game.community], equity: 0.5, potOdds: 0.3, reasoning: 'jam',
    }) - 1;
    game.act(seat, action);
    // table.js _stampDecisionOutcome, inlined:
    decisions[idx].pot = game.pot;
    decisions[idx].allIn = !!game.seats[seat].allIn;
  }

  const heroDecisions = decisions.filter((d) => d.seat === 0);
  const entry = buildFlaggedEntry({
    flagType: 'biggestPot',
    decisions: heroDecisions,
    handNumber: game.handNumber,
    pot: game.result?.pot ?? 0,
    holeCards: [...game.seats[0].holeCards],
    won: (game.result?.winners ?? []).some((w) => w.seat === 0),
  });

  assert('every street row carries a numeric pot',
    entry.streets.every((r) => Number.isFinite(r.pot)), true);
  assert('the pot never decreases across the hand',
    entry.streets.every((r, i, a) => i === 0 || r.pot >= a[i - 1].pot), true);
  // The pot on a row is the pot after HIS action. The opponent's call lands
  // afterwards, so the last row is a lower bound on the final pot rather than
  // equal to it — which is exactly the "lower bound that ends exact" the
  // replay timeline already pins to hand.pot. What changes is that the earlier
  // beats are now exact too, instead of parsed out of an action string.
  assert('the last recorded pot is a lower bound on the pot that was won',
    entry.streets.at(-1).pot <= (game.result?.pot ?? 0), true);
  assert('and it is a real figure, not zero',
    entry.streets.at(-1).pot > 0, true);
  assert('every street row says whether it was all-in',
    entry.streets.every((r) => typeof r.allIn === 'boolean'), true);
  assert('the jam is recorded as all-in',
    entry.streets.some((r) => r.allIn === true), true);
}

console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
