// src/server/cooler.test.js — SEAT-1b
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCooler, COOLER_MIN_HAND_RANK } from './cooler.js';

// Set over set on a board nobody can get away from: the canonical cooler.
const BOARD = ['9h', '9d', 'Kc', '2s', '7h'];
const WINNER_HOLE = ['Kh', 'Ks']; // kings full of nines
const LOSER_HOLE  = ['Ah', '9c']; // nines full of aces — trip nines, second best

function hand({ pot = 4000, bigBlind = 20, allIn = true, winnerHole = WINNER_HOLE, loserHole = LOSER_HOLE, board = BOARD } = {}) {
  return {
    bigBlind,
    community: board,
    seats: [{ allIn }, { allIn }],
    result: {
      type: 'showdown',
      pot,
      winners: [{ seat: 0, amount: pot }],
      showdown: [
        { seat: 0, holeCards: winnerHole },
        { seat: 1, holeCards: loserHole },
      ],
    },
  };
}

test('SEAT-1b: an all-in showdown where a strong hand loses to a stronger one is a cooler', () => {
  const c = classifyCooler(hand());
  assert.equal(c.cooler, true, c.reason);
  assert.deepEqual(c.winners, [0]);
  assert.deepEqual(c.losers, [1]);
});

test('SEAT-1b: it names both sides, so dealt and taken can both be counted', () => {
  const c = classifyCooler(hand());
  // The fix this module exists for: the winner is identified, not just the loser.
  assert.ok(c.winners.length > 0 && c.losers.length > 0);
  assert.equal(c.winners.includes(c.losers[0]), false);
});

test('SEAT-1b: a small pot with nobody all-in is not a cooler', () => {
  const c = classifyCooler(hand({ pot: 100, allIn: false }));
  assert.equal(c.cooler, false);
});

test('SEAT-1b: a big pot with nobody all-in still is', () => {
  // 25bb is the PACE_HEAT_BB default; 40bb clears it.
  const c = classifyCooler(hand({ pot: 800, bigBlind: 20, allIn: false }));
  assert.equal(c.cooler, true, c.reason);
});

test('SEAT-1b: one pair losing to a monster is not a cooler — that is just poker', () => {
  const c = classifyCooler(hand({ loserHole: ['Ad', 'Qd'] })); // ace high, no pair
  assert.equal(c.cooler, false);
  assert.match(c.reason, /best losing hand/);
});

test('SEAT-1b: a fold-out pot is never a cooler', () => {
  const h = hand();
  h.result = { type: 'uncontested', pot: 4000, winners: [{ seat: 0 }] };
  assert.equal(classifyCooler(h).cooler, false);
});

test('SEAT-1b: a chop is nobody\'s cooler', () => {
  const h = hand();
  h.result.winners = [{ seat: 0 }, { seat: 1 }];
  assert.equal(classifyCooler(h).cooler, false);
});

test('SEAT-1b: the floor is two pair', () => {
  assert.equal(COOLER_MIN_HAND_RANK, 3);
});

test('SEAT-1b: garbage in returns a clean no, never a throw', () => {
  assert.equal(classifyCooler().cooler, false);
  assert.equal(classifyCooler({ result: null }).cooler, false);
  assert.equal(classifyCooler({ result: { type: 'showdown', showdown: [{ seat: 0, holeCards: ['x'] }] } }).cooler, false);
});
