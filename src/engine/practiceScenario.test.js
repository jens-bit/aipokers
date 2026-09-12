import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createDeck } from './deck.js';
import { evaluate } from './hand.js';
import { plainHandName } from './handName.js';
import { buildPracticeLesson, createPracticeDeck } from './practiceScenario.js';

test('FIRST-SESSION: the practice deal uses one complete unique deck, including burns', () => {
  const deck = createPracticeDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck).size, 52);
  assert.deepEqual([...deck].sort(), createDeck().sort());
  assert.deepEqual(deck.slice(0, 12), [
    'Qh', 'Kh', 'Qd', 'Kd', '2c', 'Ks', '7c', '2h', '3c', '7h', '4c', '9c',
  ]);
});

test('FIRST-SESSION: practice has eight explicit steps and never exposes future board or opponent cards', () => {
  const lesson = buildPracticeLesson();
  assert.equal(lesson.schema, 'railbird.practice-lesson');
  assert.equal(lesson.version, 1);
  assert.equal(lesson.practiceOnly, true);
  assert.equal(lesson.heroSeat, 0);
  assert.deepEqual(lesson.frames.map(frame => frame.id), [
    'deal', 'preflop-call', 'flop', 'flop-bet', 'turn', 'river', 'river-bet', 'showdown',
  ]);
  assert.deepEqual(lesson.frames.map(frame => frame.game.community.length), [0, 0, 3, 3, 4, 5, 5, 5]);
  for (const [index, frame] of lesson.frames.entries()) {
    assert.ok(frame.title && frame.narration && frame.target);
    assert.deepEqual(frame.game.seats[0].holeCards, ['Kh', 'Kd']);
    assert.deepEqual(frame.game.seats[1].holeCards, index === 7 ? ['Qh', 'Qd'] : []);
    if (index < 7) assert.equal(frame.game.result, null);
    for (const seat of frame.game.seats) {
      assert.equal(seat.agentId, undefined);
      assert.equal(seat.careerStats, undefined);
      assert.equal(seat.identity, undefined);
    }
  }
});

test('FIRST-SESSION: legal engine actions conserve chips at every beat', () => {
  const { frames } = buildPracticeLesson();
  assert.deepEqual(frames.map(frame => frame.game.pot), [3, 4, 4, 8, 12, 12, 20, 0]);
  assert.deepEqual(frames.map(frame => frame.game.street), [
    'preflop', 'preflop', 'flop', 'flop', 'turn', 'river', 'river', 'complete',
  ]);
  for (const { game } of frames) {
    assert.equal(game.seats.reduce((total, seat) => total + seat.stack, game.pot), 400);
    assert.ok(game.seats.every(seat => Number.isInteger(seat.stack) && seat.stack >= 0));
  }
  assert.equal(frames[0].lastAction, null);
  assert.deepEqual(frames[1].lastAction, { seat: 0, action: { type: 'call' } });
  assert.deepEqual(frames[3].lastAction, { seat: 0, action: { type: 'bet', amount: 4 } });
  assert.deepEqual(frames[6].lastAction, { seat: 0, action: { type: 'bet', amount: 8 } });
  assert.deepEqual(frames[7].lastAction, { seat: 1, action: { type: 'call' } });
});

test('FIRST-SESSION: made-hand labels come from only the currently visible cards', () => {
  const { frames } = buildPracticeLesson();
  assert.deepEqual(frames.map(frame => frame.madeHand), [
    null, null, 'three kings', 'three kings', 'kings full of sevens',
    'kings full of sevens', 'kings full of sevens', 'kings full of sevens',
  ]);
  for (const frame of frames.filter(item => item.madeHand)) {
    assert.equal(frame.madeHand, plainHandName(evaluate(frame.game.seats[0].holeCards, frame.game.community)));
  }
});

test('FIRST-SESSION: the engine awards 28 practice chips while the net win is only 14', () => {
  const lesson = buildPracticeLesson();
  const game = lesson.frames.at(-1).game;
  assert.equal(game.result.type, 'showdown');
  assert.equal(game.result.pot, 28);
  assert.equal(game.result.winners.length, 1);
  assert.equal(game.result.winners[0].seat, 0);
  assert.equal(game.result.winners[0].amount, 28);
  assert.equal(game.result.winners[0].hand, 'kings full of sevens');
  assert.deepEqual(game.seats.map(seat => seat.stack), [214, 186]);
  assert.deepEqual(lesson.result, {
    winnerSeat: 0, hand: 'kings full of sevens', pot: 28, payout: 28, net: 14, balances: [214, 186],
  });
});

test('FIRST-SESSION: every lesson and snapshot owns its data', () => {
  const lesson = buildPracticeLesson();
  lesson.frames[0].game.seats[0].holeCards[0] = 'As';
  lesson.frames.at(-1).game.result.winners[0].amount = 999;
  assert.deepEqual(lesson.frames[1].game.seats[0].holeCards, ['Kh', 'Kd']);
  const again = buildPracticeLesson();
  assert.deepEqual(again.frames[0].game.seats[0].holeCards, ['Kh', 'Kd']);
  assert.equal(again.frames.at(-1).game.result.winners[0].amount, 28);
});

test('FIRST-SESSION: the browser lesson is exactly the engine-generated public lesson', () => {
  const stored = JSON.parse(readFileSync(new URL('../../client/src/lib/practiceLesson.json', import.meta.url), 'utf8'));
  assert.deepEqual(stored, buildPracticeLesson());
});
