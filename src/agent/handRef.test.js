// src/agent/handRef.test.js — LIFE-3 job 2
//
// The four ways a question resolves, and the one that deliberately does not.
// The fixture is the transcript: a queen-six he busted on, and two others.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHand, notableHand, namedHoldings, handNickname, candidateQuestion,
  isAboutAHand, holdingKey, handNumbersIn,
} from './handRef.js';

const BUST = {
  handNumber: 812, won: false, potSize: 1450, net: -820, holeCards: ['Qh', '6d'],
  board: ['Qs', '7d', '2s', 'Kc', '3h'],
  why: { street: 'turn', action: { type: 'call', amount: 400 }, allIn: true,
    reasoning: 'he has been firing every street', heat: 78, stamina: 'worn' },
};
const WON = { handNumber: 811, won: true, potSize: 620, net: 260, holeCards: ['Js', 'Td'], board: [] };
const FOLD = { handNumber: 810, won: false, potSize: 120, net: -20, holeCards: ['7h', '2c'], board: [] };
const HANDS = [BUST, WON, FOLD];

test('LIFE-3: a hand number he actually played resolves to that hand', () => {
  const r = resolveHand(HANDS, 'tell me about hand 811');
  assert.equal(r.how, 'number');
  assert.equal(r.hand.handNumber, 811);
});

test('LIFE-3: the cards resolve, in the words a person uses', () => {
  for (const said of ['queen six? the one you just busted on.', 'the queen-six', 'why did you call with Qh 6d']) {
    const r = resolveHand(HANDS, said);
    assert.equal(r.how, 'cards', said);
    assert.equal(r.hand.handNumber, 812, said);
  }
});

test('LIFE-3: a question with NO hand named resolves to the notable one, never to nothing', () => {
  for (const said of ['why did you go all in on that hand?', 'what happened in that last hand?', 'why???']) {
    const r = resolveHand(HANDS, said);
    assert.equal(r.how, 'notable', said);
    assert.equal(r.hand.handNumber, 812, said);
  }
});

test('LIFE-3: two hands that fit are two candidates, not a shrug', () => {
  const twin = { ...WON, handNumber: 809, holeCards: ['Qc', '6s'] };
  const r = resolveHand([BUST, twin, FOLD], 'the queen six');
  assert.equal(r.how, 'ambiguous');
  assert.equal(r.candidates.length, 2);
  assert.equal(candidateQuestion(r.candidates), 'The queen-six, or the queen-six?');
});

test('LIFE-3: a hand he did not play STOPS — it never falls through to another one', () => {
  const byNumber = resolveHand(HANDS, 'what about hand 700?');
  assert.equal(byNumber.how, 'unknown');
  assert.equal(byNumber.hand, null, 'answering about 700 with 812 is the invention, made by us');
  assert.deepEqual(byNumber.asked.numbers, [700]);

  const byCards = resolveHand(HANDS, 'what about the ace-king?');
  assert.equal(byCards.how, 'unknown');
  assert.equal(byCards.hand, null);
  assert.deepEqual(byCards.asked.holdings, ['AK']);
});

test('LIFE-3: a message that is not about a hand resolves to nothing', () => {
  for (const said of ['are you hungry?', 'hey', 'what do you think of me']) {
    assert.equal(resolveHand(HANDS, said).how, 'none', said);
  }
});

test('LIFE-3: a man with no hands resolves to nothing, whatever he is asked', () => {
  assert.equal(resolveHand([], 'why did you shove?').how, 'none');
  assert.equal(resolveHand(null, 'tell me about hand 812').how, 'none');
});

// ── the notable ladder ──────────────────────────────────────────────────────

test('LIFE-3: the all-in wins, then the biggest net, then the pot, then the last', () => {
  assert.equal(notableHand(HANDS).handNumber, 812, 'the stack in the middle');

  const noJam = HANDS.map((h) => ({ ...h, why: undefined, decisions: [] }));
  assert.equal(notableHand(noJam).handNumber, 812, 'the most chips, by his net');

  const flat = noJam.map((h) => ({ ...h, net: null }));
  assert.equal(notableHand(flat).handNumber, 812, 'the biggest pot, for an old record');

  const bare = flat.map((h) => ({ ...h, potSize: null }));
  assert.equal(notableHand(bare).handNumber, 812, 'and otherwise the one he just played');
  assert.equal(notableHand([]), null);
});

test('LIFE-3: the all-in is read off the decisions too, not only the stored why', () => {
  const hands = [
    { handNumber: 900, net: -10, decisions: [{ action: { type: 'call' } }] },
    { handNumber: 899, net: -5, decisions: [{ action: { type: 'call' }, allIn: true }] },
  ];
  assert.equal(notableHand(hands).handNumber, 899);
});

// ── the vocabulary ──────────────────────────────────────────────────────────

test('LIFE-3: what the owner named, in each of the three forms', () => {
  assert.deepEqual([...namedHoldings('queen six')], ['6Q']);
  assert.deepEqual([...namedHoldings('Qh 6d')], ['6Q']);
  assert.deepEqual([...namedHoldings('pocket queens')], ['QQ']);
  assert.deepEqual([...namedHoldings('the sixes')], ['66']);
  assert.deepEqual([...namedHoldings('ace and king')], ['AK']);
});

test('LIFE-3: ordinary sentences are not holdings', () => {
  for (const said of ['why did you do that', 'two hands ago', 'how many hands']) {
    assert.equal(namedHoldings(said).size, 0, said);
  }
});

test('LIFE-3: a card code is read in its own case, or the letters of English are cards', () => {
  // Under a case-insensitive flag "th" is a ten of hearts, so "with Qh 6d"
  // reads as the ten-queen: the "th" of "with" glued to the card after it.
  assert.deepEqual([...namedHoldings('why did you call with Qh 6d')], ['6Q']);
  assert.equal(namedHoldings('the truth is that he had it').size, 0);
});

test('LIFE-3: a nickname is how he would say it, high card first', () => {
  assert.equal(handNickname(BUST), 'queen-six');
  assert.equal(handNickname({ holeCards: ['6d', 'Qh'] }), 'queen-six', 'order of the record does not matter');
  assert.equal(handNickname({ holeCards: ['Qs', 'Qc'] }), 'pocket queens');
  assert.equal(handNickname({ holeCards: ['6s', '6c'] }), 'pocket sixes');
  assert.equal(handNickname({ holeCards: [] }), null, 'never a guess, never "that one"');
  assert.equal(holdingKey({ holeCards: ['Ah'] }), null);
});

test('LIFE-3: the candidate question needs two real names, or it is not asked', () => {
  assert.equal(candidateQuestion([BUST, WON]), 'The queen-six, or the jack-ten?');
  assert.equal(candidateQuestion([BUST]), null);
  assert.equal(candidateQuestion([{ holeCards: [] }, { holeCards: [] }]), null);
});

test('LIFE-3: hand numbers are still read the way LIFE-2 read them', () => {
  assert.deepEqual([...handNumbersIn('hand 812 and #811 and hand number 810')], [812, 811, 810]);
  assert.deepEqual([...handNumbersIn('812 hands, 1450 down')], []);
});

test('LIFE-3: asking about a hand is recognised broadly, on purpose', () => {
  assert.ok(isAboutAHand('why???'));
  assert.ok(isAboutAHand('the one you just busted on'));
  assert.ok(isAboutAHand('what happened'));
  assert.equal(isAboutAHand('are you hungry'), false);
});
