// src/agent/handWhy.test.js — LIFE-3 job 1
//
// The ladder, the bound, and the two things the file is forbidden to invent.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decisiveDecision, handWhy, actionPhrase, statePhrase, whyFact,
  REASON_MAX, STEAMING_AT, COLD_AT,
} from './handWhy.js';

const d = (street, type, amount, extra = {}) => ({
  street, action: amount === null ? { type } : { type, amount },
  reasoning: 'a reason', attr: {}, ...extra,
});

test('decisiveDecision: the all-in wins over everything else', () => {
  const hand = [
    d('preflop', 'raise', 60),
    d('flop', 'bet', 900),
    d('turn', 'call', 120, { allIn: true }),
  ];
  assert.equal(decisiveDecision(hand).street, 'turn');
});

test('decisiveDecision: the last all-in, when there are two', () => {
  const hand = [
    d('flop', 'bet', 300, { allIn: true }),
    d('turn', 'call', 120, { allIn: true }),
  ];
  assert.equal(decisiveDecision(hand).street, 'turn');
});

test('decisiveDecision: otherwise the biggest commitment, not the last action', () => {
  const hand = [
    d('preflop', 'raise', 60),
    d('turn', 'call', 400),
    d('river', 'check', null),
  ];
  assert.equal(decisiveDecision(hand).street, 'turn');
});

test('decisiveDecision: a tie goes to the later decision', () => {
  const hand = [d('flop', 'call', 400), d('turn', 'call', 400)];
  assert.equal(decisiveDecision(hand).street, 'turn');
});

test('decisiveDecision: with nothing committed, the last aggression', () => {
  const hand = [d('preflop', 'bet', null), d('flop', 'check', null)];
  assert.equal(decisiveDecision(hand).action.type, 'bet');
});

test('decisiveDecision: a preflop fold is the whole story of the hand', () => {
  const hand = [d('preflop', 'fold', null)];
  assert.equal(decisiveDecision(hand).action.type, 'fold');
});

test('decisiveDecision: no decisions is null, not a guess', () => {
  assert.equal(decisiveDecision([]), null);
  assert.equal(decisiveDecision(null), null);
  assert.equal(decisiveDecision(undefined), null);
});

test('handWhy: carries the reason and the state off the DECISIVE decision', () => {
  const why = handWhy([
    d('preflop', 'raise', 60, { reasoning: 'standard open', attr: { heat: 10, fatigue: 'fresh' } }),
    d('turn', 'call', 400, { reasoning: 'he is bluffing this spot', attr: { heat: 78, fatigue: 'worn', moodState: 'tilted' } }),
  ]);
  assert.equal(why.street, 'turn');
  assert.equal(why.action.type, 'call');
  assert.equal(why.action.amount, 400);
  assert.equal(why.reasoning, 'he is bluffing this spot');
  assert.equal(why.heat, 78);
  assert.equal(why.stamina, 'worn');
  assert.equal(why.moodState, 'tilted');
  assert.equal(why.allIn, false);
});

test('handWhy: the reason is bounded — a runaway string cannot grow the record', () => {
  const why = handWhy([d('turn', 'call', 400, { reasoning: 'x'.repeat(4000) })]);
  assert.equal(why.reasoning.length, REASON_MAX);
});

test('handWhy: nothing on file is null rather than an empty shell', () => {
  assert.equal(handWhy([d('turn', 'call', 400, { reasoning: '   ', attr: {} })]), null);
  assert.equal(handWhy([]), null);
});

test('handWhy: state alone is enough to be worth storing', () => {
  const why = handWhy([d('turn', 'call', 400, { reasoning: '', attr: { heat: 78 } })]);
  assert.equal(why.reasoning, null);
  assert.equal(why.heat, 78);
});

test('handWhy: never invents heat or stamina it was not given', () => {
  const why = handWhy([d('turn', 'call', 400, { reasoning: 'priced in', attr: {} })]);
  assert.equal(why.heat, null);
  assert.equal(why.stamina, null);
  assert.equal(statePhrase(why), null);
});

test('actionPhrase: the jam reads as a jam whatever the amount says', () => {
  assert.equal(actionPhrase({ action: { type: 'call', amount: 120 }, allIn: true }), 'put it all in');
  assert.equal(actionPhrase({ action: { type: 'call', amount: 400 } }), 'called 400');
  assert.equal(actionPhrase({ action: { type: 'raise', amount: 60 } }), 'raised to 60');
  assert.equal(actionPhrase({ action: { type: 'fold' } }), 'folded');
  assert.equal(actionPhrase({ action: { type: 'check' } }), 'checked');
  assert.equal(actionPhrase(null), null);
});

test('statePhrase: only the two edges speak; the middle says nothing', () => {
  assert.equal(statePhrase({ heat: STEAMING_AT }), 'I was steaming');
  assert.equal(statePhrase({ heat: COLD_AT }), 'I was clear-headed');
  assert.equal(statePhrase({ heat: 45 }), null);
  assert.equal(statePhrase({ heat: 80, stamina: 'worn' }),
    'I was steaming and I had been sitting there too long');
  assert.equal(statePhrase({ stamina: 'fresh' }), null);
});

test('whyFact: one clause, or nothing at all', () => {
  const why = handWhy([d('turn', 'call', 400, {
    reasoning: 'he is bluffing this spot', attr: { heat: 78, fatigue: 'worn' },
  })]);
  const line = whyFact(why);
  assert.match(line, /^why: you turn called 400 because: "he is bluffing this spot"/);
  assert.match(line, /I was steaming/);
  assert.match(line, /heat 78/);
  assert.match(line, /worn/);
  assert.equal(whyFact(null), '');
});
