// src/server/salience.test.js — COST-1
//
// Which hand he keeps thinking about, and what it does to him.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  intensityOf, recencyOf, salienceOf, rankHands, bluffCaught, nemesisIn,
  mostRewatched, tapeHeatDrift, tapePhrase, watchCount,
  DECAY_DAYS, RECENCY_FLOOR, TAPE_HEAT_LOST, TAPE_HEAT_WON,
} from './salience.js';

const NOW = Date.UTC(2026, 8, 6, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function hand(over = {}) {
  return {
    flagType: 'biggestPot',
    handNumber: 12,
    pot: 800,
    won: true,
    holeCards: ['Ah', 'Kd'],
    opponents: [{ seat: 1, playerId: 'p_granite', displayName: 'Granite' }],
    streets: [{ street: 'flop', action: 'BET 200', equity: 71 }],
    flaggedAt: NOW,
    ...over,
  };
}

// ── intensity ───────────────────────────────────────────────────────────────

test('the size of the pot against his stack carries most of it', () => {
  const small = intensityOf(hand({ pot: 200 }), { stack: 2000 });
  const big = intensityOf(hand({ pot: 3000 }), { stack: 2000 });
  assert.ok(big > small);
  assert.ok(big <= 1 && small >= 0);
});

test('a pot at twice the stack is the ceiling, and past it does not keep climbing', () => {
  const at = intensityOf(hand({ pot: 4000 }), { stack: 2000 });
  const past = intensityOf(hand({ pot: 40000 }), { stack: 2000 });
  assert.equal(at, past);
});

test('a cooler and a bad beat are worth more than their size', () => {
  const plain = intensityOf(hand({ pot: 400 }), { stack: 2000 });
  const cooler = intensityOf(hand({ pot: 400, flagType: 'cooler' }), { stack: 2000 });
  const beat = intensityOf(hand({ pot: 400, flagType: 'badBeat' }), { stack: 2000 });
  assert.ok(cooler > plain);
  assert.ok(beat > cooler, 'being in front and losing is worse than both having one');
});

test('a bluff that got called and shown counts, and is derived not flagged', () => {
  const caught = hand({ won: false, streets: [{ street: 'turn', action: 'RAISE 600', equity: 22 }] });
  assert.equal(bluffCaught(caught), true);
  assert.ok(intensityOf(caught, { stack: 2000 }) > intensityOf(hand({ won: false }), { stack: 2000 }));
});

test('a bluff he won with is not a bluff that got caught', () => {
  assert.equal(bluffCaught(hand({ won: true, streets: [{ action: 'BET 600', equity: 22 }] })), false);
});

test('a value bet in a hand he lost is not a caught bluff either', () => {
  assert.equal(bluffCaught(hand({ won: false, streets: [{ action: 'BET 600', equity: 81 }] })), false);
});

test('the man across the table counts when it is HIM', () => {
  const ids = new Set(['p_granite']);
  assert.equal(nemesisIn(hand(), ids), true);
  assert.equal(nemesisIn(hand(), new Set(['p_someone_else'])), false);
  assert.equal(nemesisIn(hand(), null), false);
  assert.ok(intensityOf(hand(), { stack: 2000, nemesisIds: ids })
          > intensityOf(hand(), { stack: 2000 }));
});

test('a win is not scored below a loss for being a win', () => {
  const won = hand({ pot: 3000, won: true, flagType: 'biggestPot' });
  const lost = hand({ pot: 3000, won: false, flagType: 'biggestPot', streets: [{ action: 'CALL 400', equity: 60 }] });
  assert.equal(intensityOf(won, { stack: 2000 }), intensityOf(lost, { stack: 2000 }));
});

test('a hand with no stack recorded lands in the middle, not at either end', () => {
  const i = intensityOf(hand({ pot: 800 }), { stack: null });
  assert.ok(i > 0 && i < 1);
});

// ── recency ─────────────────────────────────────────────────────────────────

test('this morning is full, a week ago is the floor', () => {
  assert.equal(recencyOf(hand({ flaggedAt: NOW }), { now: NOW }), 1);
  assert.equal(recencyOf(hand({ flaggedAt: NOW - DECAY_DAYS * DAY }), { now: NOW }), RECENCY_FLOOR);
  assert.equal(recencyOf(hand({ flaggedAt: NOW - 30 * DAY }), { now: NOW }), RECENCY_FLOOR);
});

test('it fades across the window rather than falling off a cliff', () => {
  const half = recencyOf(hand({ flaggedAt: NOW - (DECAY_DAYS / 2) * DAY }), { now: NOW });
  assert.ok(Math.abs(half - 0.5) < 1e-9);
});

test('a hand with no timestamp is treated as old, not as brand new', () => {
  assert.equal(recencyOf(hand({ flaggedAt: null }), { now: NOW }), RECENCY_FLOOR);
});

// ── ranking ─────────────────────────────────────────────────────────────────

test('a big hand from today outranks a bigger one from last week', () => {
  const today = hand({ handNumber: 40, pot: 1200, flaggedAt: NOW });
  const old = hand({ handNumber: 4, pot: 3000, flaggedAt: NOW - 6 * DAY });
  const [first] = rankHands([old, today], { now: NOW, stack: 2000 });
  assert.equal(first.handNumber, 40);
});

test('the ranking carries its own arithmetic so nothing has to recompute it', () => {
  const [row] = rankHands([hand()], { now: NOW, stack: 2000 });
  assert.ok(Math.abs(row.salience - row.intensity * row.recency) < 1e-3);
  assert.equal(row.watched, 0);
});

test('a tie is broken by the later hand', () => {
  const a = hand({ handNumber: 3 });
  const b = hand({ handNumber: 9 });
  assert.equal(rankHands([a, b], { now: NOW, stack: 2000 })[0].handNumber, 9);
});

test('the rewatch count rides the ranking', () => {
  const watches = { 12: { count: 3, lastAt: NOW, won: true } };
  const [row] = rankHands([hand()], { now: NOW, stack: 2000, watches });
  assert.equal(row.watched, 3);
  assert.equal(watchCount(watches, 12), 3);
  assert.equal(watchCount(watches, 99), 0);
  assert.equal(watchCount(null, 12), 0);
});

test('an empty tape ranks to an empty list', () => {
  assert.deepEqual(rankHands([], { now: NOW }), []);
  assert.deepEqual(rankHands(null, { now: NOW }), []);
});

// ── the rewatch ledger ──────────────────────────────────────────────────────

test('the most rewatched hand of the week is the one he keeps going back to', () => {
  const watches = {
    3: { count: 1, lastAt: NOW - DAY, won: true },
    7: { count: 4, lastAt: NOW - 2 * DAY, won: false, flagType: 'badBeat', subject: 'Granite' },
    9: { count: 2, lastAt: NOW, won: true },
  };
  assert.equal(mostRewatched(watches, { now: NOW }).handNumber, 7);
});

test('a hand he watched a fortnight ago is not what he is thinking about now', () => {
  const watches = {
    3: { count: 9, lastAt: NOW - 14 * DAY, won: false },
    9: { count: 1, lastAt: NOW, won: true },
  };
  assert.equal(mostRewatched(watches, { now: NOW }).handNumber, 9);
});

test('a tie goes to the more recent visit', () => {
  const watches = {
    3: { count: 2, lastAt: NOW - 3 * DAY, won: true },
    9: { count: 2, lastAt: NOW - 1 * DAY, won: true },
  };
  assert.equal(mostRewatched(watches, { now: NOW }).handNumber, 9);
});

test('nothing watched is null, not an empty object', () => {
  assert.equal(mostRewatched({}, { now: NOW }), null);
  assert.equal(mostRewatched(null, { now: NOW }), null);
  assert.equal(mostRewatched({ 3: { count: 0, lastAt: NOW } }, { now: NOW }), null);
});

// ── what it does to him ─────────────────────────────────────────────────────

test('a beat he keeps rewatching warms him; a win he keeps rewatching settles him', () => {
  assert.equal(tapeHeatDrift({ count: 3, won: false }), TAPE_HEAT_LOST);
  assert.equal(tapeHeatDrift({ count: 3, won: true }), TAPE_HEAT_WON);
  assert.ok(TAPE_HEAT_LOST > Math.abs(TAPE_HEAT_WON), 'brooding beats consoling');
});

test('a hand nobody has rewatched moves nothing', () => {
  assert.equal(tapeHeatDrift(null), 0);
  assert.equal(tapeHeatDrift({ count: 0, won: false }), 0);
});

test('the opener names the hand and the man where it can', () => {
  assert.equal(tapePhrase({ flagType: 'badBeat', subject: 'Granite' }), 'that beat against Granite');
  assert.equal(tapePhrase({ flagType: 'biggestPot' }), 'that pot');
  assert.equal(tapePhrase({ flagType: 'somethingNew' }), 'that hand');
  assert.equal(tapePhrase(null), null);
});
