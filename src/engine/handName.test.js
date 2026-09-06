// src/engine/handName.test.js — BUGS-B/5
//
// Every winning hand has a name a person would say out loud.

import test from 'node:test';
import assert from 'node:assert/strict';
import pkg from 'pokersolver';

import { plainHandName, UNCONTESTED } from './handName.js';
import { pickWinners } from './hand.js';
import { Game, Streets, Actions } from './game.js';

const { Hand } = pkg;
const named = (...cards) => plainHandName(Hand.solve(cards));

test('BUGS-B/5: the whole ladder, in plain English', () => {
  assert.equal(named('Ad', 'Kd', 'Qd', 'Jd', 'Td'), 'a royal flush');
  assert.equal(named('9d', '8d', '7d', '6d', '5d'), 'a nine-high straight flush');
  assert.equal(named('9d', '9c', '9h', '9s', '2d'), 'four nines');
  assert.equal(named('9d', '9c', '9h', '5s', '5d'), 'nines full of fives');
  assert.equal(named('Ad', 'Jd', '8d', '5d', '2d'), 'an ace-high flush');
  assert.equal(named('9d', '8c', '7h', '6s', '5d'), 'a nine-high straight');
  assert.equal(named('9d', '9c', '9h', '5s', '2d'), 'three nines');
  assert.equal(named('9d', '9c', '5h', '5s', '2d'), 'two pair, nines and fives');
  assert.equal(named('9d', '9c', 'Kh', '5s', '2d'), 'a pair of nines');
  assert.equal(named('Ad', 'Jc', '8h', '5s', '2d'), 'ace high');
});

test('BUGS-B/5: the article follows the sound, not the spelling rule', () => {
  // 'an ace-high flush', 'an eight-high straight' — the only two vowel starts
  // the vocabulary can produce, and both used to read "a ace".
  assert.equal(named('8d', '7c', '6h', '5s', '4d'), 'an eight-high straight');
  assert.equal(named('Kd', 'Jd', '8d', '5d', '2d'), 'a king-high flush');
});

test('BUGS-B/5: the wheel is a five-high straight, not an ace-high one', () => {
  // pokersolver rewrites the ace to '1' when it plays low. Reading the top
  // card off the sorted hand gets this right for free; parsing the ace out of
  // the hole cards would not.
  assert.equal(named('5d', '4c', '3h', '2s', 'Ad'), 'a five-high straight');
  assert.equal(named('5d', '4d', '3d', '2d', 'Ad'), 'a five-high straight flush');
});

test('BUGS-B/5: tens are tens, not 10s', () => {
  assert.equal(named('Td', 'Tc', 'Th', '5s', '5d'), 'tens full of fives');
  assert.equal(named('Td', 'Tc', 'Kh', '5s', '2d'), 'a pair of tens');
});

test('BUGS-B/5: nothing it cannot read is allowed to throw', () => {
  assert.equal(plainHandName(null), null);
  assert.equal(plainHandName({}), null);
  assert.equal(plainHandName({ name: 'Pair', cards: [] }), 'a pair');
  assert.equal(plainHandName({ name: 'Flush', cards: [] }), 'a flush');
  assert.equal(plainHandName({ name: 'Five of a Kind', cards: [] }), 'five of a kind');
});

test('BUGS-B/5: pickWinners carries the name beside the solver description', () => {
  const winners = pickWinners(
    [
      { seat: 0, holeCards: ['As', 'Ah'] },
      { seat: 1, holeCards: ['Kd', 'Kc'] },
    ],
    ['9d', '5c', '2h', '7s', '3d'],
  );
  assert.equal(winners.length, 1);
  assert.equal(winners[0].seat, 0);
  assert.equal(winners[0].hand, 'a pair of aces');
  // The solver's own wording is still there — nothing that read `descr`
  // before this tree has to change.
  assert.equal(winners[0].descr, "Pair, A's");
});

test('BUGS-B/5: a chopped pot names the hand for BOTH winners', () => {
  const winners = pickWinners(
    [
      { seat: 0, holeCards: ['Ah', '2c'] },
      { seat: 1, holeCards: ['Ad', '2s'] },
    ],
    ['As', 'Kd', 'Qc', 'Jh', '9d'],
  );
  assert.equal(winners.length, 2);
  for (const w of winners) assert.equal(w.hand, 'a pair of aces');
});

test('BUGS-B/5: a pot nobody showed for is called what it is', () => {
  assert.equal(UNCONTESTED, 'uncontested');
});

// ── The contract at the Game level ──────────────────────────────────────────
// The whole point of the tree is that `result.winners[].hand` is ALWAYS there,
// whichever way the hand ended. Real shuffled decks, so the words differ every
// run — what is asserted is that every winner has some.

test('BUGS-B/5: every showdown winner carries a hand name', () => {
  for (let run = 0; run < 40; run++) {
    const game = new Game({
      tableId: `hn-${run}`,
      seats: [{ playerId: 'p0', stack: 1000 }, { playerId: 'p1', stack: 1000 }],
      smallBlind: 10,
      bigBlind: 20,
    });
    game.startHand();
    playToShowdown(game);
    assert.equal(game.result.type, 'showdown', 'nobody folded, so it is a showdown');
    assert.ok(game.result.winners.length > 0);
    for (const w of game.result.winners) {
      assert.equal(typeof w.hand, 'string', JSON.stringify(w));
      assert.ok(w.hand.length > 0 && w.hand === w.hand.toLowerCase(),
        `plain English, lower case: ${w.hand}`);
      assert.ok(w.hand !== UNCONTESTED, 'a hand that went to showdown was contested');
    }
  }
});

test('BUGS-B/5: a pot everybody folded to is "uncontested", not a guess', () => {
  const game = new Game({
    tableId: 'hn-fold',
    seats: [{ playerId: 'p0', stack: 1000 }, { playerId: 'p1', stack: 1000 }],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  game.act(game.toAct, { type: Actions.FOLD });
  assert.equal(game.result.type, 'uncontested');
  assert.equal(game.result.winners.length, 1);
  assert.equal(game.result.winners[0].hand, UNCONTESTED);
});

// Check and call everything, so the hand always reaches a showdown.
function playToShowdown(game) {
  let safety = 200;
  while (game.street !== Streets.COMPLETE && safety-- > 0) {
    const seat = game.toAct;
    if (seat === null || seat === undefined) break;
    const legal = game.legalActions(seat);
    if (legal.some((a) => a.type === Actions.CHECK)) game.act(seat, { type: Actions.CHECK });
    else if (legal.some((a) => a.type === Actions.CALL)) game.act(seat, { type: Actions.CALL });
    else break;
  }
}
