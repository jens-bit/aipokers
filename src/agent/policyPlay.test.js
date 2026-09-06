// src/agent/policyPlay.test.js — COST-1
//
// The compiled policy playing on its own. What matters here is not the exact
// score of any action — those are a heuristic and are allowed to move — but
// the ORDER and the GAP, because router.js reads the gap as confidence.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  rateActions, countOptions, chooseFromPolicy, marginOf, facingOdds,
  instantLine, OPTION_BAND, TALK_ONE_IN,
} from './policyPlay.js';

// A game state in the shape table._buildAiGameState produces, with only the
// fields this module reads.
function gs(over = {}) {
  return {
    street: 'preflop',
    holeCards: ['7h', '2d'],
    community: [],
    handNumber: 1,
    seat: 0,
    pot: 30,
    bb: 20,
    myStack: 2000,
    myContrib: 0,
    toCall: 0,
    canCheck: true,
    canBet: false,
    canRaise: false,
    minBet: 0, maxBet: 0, minRaise: 0, maxRaise: 0,
    equity: 0.5,
    potOdds: null,
    policy: {
      profile: { tightness: 55, aggression: 55, bluffFreq: 25, discipline: 60 },
      dice: { bluffDie: false, deviationDie: false },
      sizing: { openBB: 3, cbetFraction: 0.55 },
      range: null,
    },
    ...over,
  };
}

const scoreOf = (rated, type) => rated.find((r) => r.type === type)?.score ?? null;

// ── margin ──────────────────────────────────────────────────────────────────

test('pot odds are zero when there is nothing to call, not unknown', () => {
  assert.equal(facingOdds(gs({ toCall: 0, potOdds: null })), 0);
  assert.equal(facingOdds(gs({ toCall: 40, potOdds: 0.25 })), 0.25);
});

test('margin is the distance between the hand and the price', () => {
  assert.equal(marginOf(gs({ equity: 0.62, toCall: 40, potOdds: 0.25 })), 0.37);
  // Free to continue: the margin is simply what the hand is worth.
  assert.equal(marginOf(gs({ equity: 0.31, toCall: 0 })), 0.31);
});

test('a hand with no equity estimate has no margin — nothing may judge it', () => {
  assert.equal(marginOf(gs({ equity: null })), null);
  assert.equal(marginOf(gs({ equity: undefined })), null);
});

// ── rating ──────────────────────────────────────────────────────────────────

test('trash facing a bet: fold wins alone and by a mile', () => {
  const rated = rateActions(gs({
    equity: 0.14, toCall: 60, potOdds: 0.33, canCheck: false, canRaise: true,
    minRaise: 120, maxRaise: 2000,
  }));
  assert.equal(rated[0].type, 'fold');
  assert.equal(countOptions(rated), 1, 'the policy has an opinion here');
  assert.ok(rated[0].score - rated[1].score > OPTION_BAND);
});

test('a monster facing a bet is NOT a one-option spot — call and raise are close', () => {
  const rated = rateActions(gs({
    street: 'flop', community: ['As', 'Ah', '7c'], holeCards: ['Ad', 'Ac'],
    equity: 0.92, toCall: 100, potOdds: 0.25, canCheck: false, canRaise: true,
    minRaise: 200, maxRaise: 2000, pot: 300,
  }));
  assert.ok(countOptions(rated) > 1,
    'the nuts is exactly the spot worth spending a model call on');
});

test('a weak hand with no bet checks, and the bluff die is what changes that', () => {
  const dry = gs({
    street: 'flop', community: ['2h', '7d', 'Jc'], equity: 0.22,
    canBet: true, minBet: 20, maxBet: 2000, pot: 120,
  });
  const passive = rateActions(dry);
  assert.equal(passive[0].type, 'check');

  const rolled = rateActions({ ...dry, policy: { ...dry.policy, dice: { bluffDie: true } } });
  assert.equal(rolled[0].type, 'bet', 'the die said bluff and the die is a fact by now');
  assert.ok(scoreOf(rolled, 'bet') > scoreOf(passive, 'bet'));
});

test('the preflop range verdict pushes a hand out of the pot', () => {
  const base = { equity: 0.38, toCall: 40, potOdds: 0.25, canCheck: false };
  const inRange = rateActions(gs({
    ...base,
    policy: { ...gs().policy, range: { inRange: true, percentile: 8, targetVpip: 20 } },
  }));
  const outOfRange = rateActions(gs({
    ...base,
    policy: { ...gs().policy, range: { inRange: false, percentile: 74, targetVpip: 20 } },
  }));
  assert.ok(scoreOf(outOfRange, 'fold') > scoreOf(inRange, 'fold'));
  assert.ok(scoreOf(outOfRange, 'call') < scoreOf(inRange, 'call'));
});

test('a raise is never rated above the willingness to pay', () => {
  // Bluff die on, facing a big bet with a hand that cannot call.
  const rated = rateActions(gs({
    street: 'turn', equity: 0.12, toCall: 400, potOdds: 0.45,
    canCheck: false, canRaise: true, minRaise: 800, maxRaise: 2000, pot: 500,
    policy: { ...gs().policy, dice: { bluffDie: true } },
  }));
  assert.ok(scoreOf(rated, 'raise') <= scoreOf(rated, 'call'),
    'you cannot raise a hand you should not even call');
  assert.equal(rated[0].type, 'fold');
});

test('folding is not offered when checking is free', () => {
  const rated = rateActions(gs({ toCall: 0, canCheck: true }));
  assert.ok(!rated.some((r) => r.type === 'fold'));
});

// ── amounts ─────────────────────────────────────────────────────────────────

test('the bet size is the sizing directive, clamped into the table offer', () => {
  const preflop = chooseFromPolicy(gs({
    equity: 0.72, canBet: true, minBet: 40, maxBet: 2000, bb: 20,
    policy: { ...gs().policy, sizing: { openBB: 3, cbetFraction: 0.55 } },
  }));
  assert.equal(preflop.action.type, 'bet');
  assert.equal(preflop.action.amount, 60, '3bb open');

  const flop = chooseFromPolicy(gs({
    street: 'flop', community: ['2h', '7d', 'Jc'], equity: 0.82,
    canBet: true, minBet: 20, maxBet: 2000, pot: 200,
  }));
  assert.equal(flop.action.amount, 110, '55% of a 200 pot');
});

test('an amount below the table floor is lifted to it, never sent under', () => {
  const chosen = chooseFromPolicy(gs({
    street: 'flop', equity: 0.85, canBet: true, pot: 20,
    minBet: 300, maxBet: 2000,   // RAISE-1 floor well above the pot fraction
  }));
  assert.equal(chosen.action.amount, 300);
});

test('a raise is a TOTAL for the street — contribution plus call plus the raise', () => {
  const rated = rateActions(gs({
    street: 'flop', equity: 0.95, toCall: 100, potOdds: 0.2, myContrib: 50, pot: 400,
    canCheck: false, canRaise: true, minRaise: 200, maxRaise: 5000,
  }));
  const raise = rated.find((r) => r.type === 'raise');
  assert.equal(raise.amount, 50 + 100 + 220);
});

// ── options ─────────────────────────────────────────────────────────────────

test('countOptions counts the band around the best, best included', () => {
  assert.equal(countOptions([{ score: 90 }, { score: 84 }, { score: 20 }]), 2);
  assert.equal(countOptions([{ score: 90 }, { score: 79 }]), 1);
  assert.equal(countOptions([]), 0);
});

// ── talk ────────────────────────────────────────────────────────────────────

test('the instant line is rare, and the same spot always says the same thing', () => {
  let spoke = 0;
  const seen = new Map();
  for (let hand = 0; hand < 400; hand++) {
    const state = gs({ handNumber: hand });
    const line = instantLine(state, { type: 'fold' });
    if (line) {
      spoke++;
      seen.set(hand, line);
      assert.equal(instantLine(state, { type: 'fold' }), line, 'deterministic');
    }
  }
  assert.ok(spoke > 0, 'he does say something sometimes');
  // One in TALK_ONE_IN, give or take the hash. Anything near every fold is the
  // bug this gate exists to prevent.
  assert.ok(spoke < 400 / (TALK_ONE_IN / 2), `spoke on ${spoke}/400 folds — too often`);
});

test('an action with no template pool says nothing rather than inventing one', () => {
  assert.equal(instantLine(gs(), { type: 'muck' }), null);
  assert.equal(instantLine(gs(), null), null);
});

// ── the whole decision ──────────────────────────────────────────────────────

test('chooseFromPolicy returns a playable action and a line in his voice', () => {
  const chosen = chooseFromPolicy(gs({
    equity: 0.12, toCall: 40, potOdds: 0.3, canCheck: false,
  }));
  assert.equal(chosen.action.type, 'fold');
  assert.equal(typeof chosen.reasoning, 'string');
  assert.ok(chosen.reasoning.length > 0);
  // PACE-1c's law: never a solver talking.
  assert.ok(!/equity|pot odds|\bbb\b/i.test(chosen.reasoning), chosen.reasoning);
});

test('an unratable state still produces a safe action rather than throwing', () => {
  assert.equal(chooseFromPolicy({ canCheck: true }).action.type, 'check');
  assert.equal(chooseFromPolicy({ canCheck: false, toCall: 0 }).action.type, 'check');
});
