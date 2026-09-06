// src/server/router.test.js — COST-1
//
// The scripted hand set: which spots route where, and why.
//
// Every case here is a claim about the bill. If a gate stops firing, one of
// these goes red before the invoice does.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  routeFor, isAllIn, isPriced, Route, Reason, MARGIN_MIN, HEAT_MAX,
  newRouteCounter, countRoute, policyShare, formatRoutes,
} from './router.js';

// A clear preflop fold: 72o, out of range, tiny pot, level head. This is the
// spot the whole tree exists for — it is most of poker by volume.
function clearFold(over = {}) {
  return {
    street: 'preflop',
    holeCards: ['7h', '2d'],
    community: [],
    handNumber: 1,
    seat: 0,
    pot: 60,
    bb: 20,
    myStack: 2000,
    myContrib: 0,
    toCall: 40,
    potOdds: 0.4,
    equity: 0.11,
    canCheck: false,
    canBet: false,
    canRaise: true,
    minRaise: 80, maxRaise: 2000, minBet: 0, maxBet: 0,
    mood: { state: 'neutral', heat: 50 },
    opponentReads: [],
    tableTalk: null,
    anyAllIn: false,
    policy: {
      profile: { tightness: 70, aggression: 45, bluffFreq: 15, discipline: 70 },
      dice: { bluffDie: false, deviationDie: false },
      sizing: { openBB: 3, cbetFraction: 0.55 },
      range: { inRange: false, percentile: 91, targetVpip: 29 },
    },
    ...over,
  };
}

// ── the cheap path ──────────────────────────────────────────────────────────

test('a clear preflop fold never reaches a model', () => {
  const r = routeFor(clearFold());
  assert.equal(r.route, Route.POLICY);
  assert.equal(r.reason, Reason.CLEAR);
  assert.equal(r.tag, 'policy/clear');
  assert.equal(r.options, 1);
  assert.ok(r.margin >= MARGIN_MIN);
});

test('a clear check on a flop he missed, nothing to call, is free too', () => {
  // The margin here is the bare equity (0.19), which is under MARGIN_MIN. It
  // is not a close spot — there is no price to be close to, and the policy
  // rates the check 99 to 1. See isPriced.
  const r = routeFor(clearFold({
    street: 'flop', community: ['2h', '7d', 'Jc'], holeCards: ['Ks', 'Qs'],
    toCall: 0, potOdds: null, canCheck: true, canBet: true, canRaise: false,
    minBet: 20, maxBet: 2000, equity: 0.19, pot: 80,
  }));
  assert.equal(r.route, Route.POLICY);
  assert.equal(r.reason, Reason.CLEAR);
});

test('the closeness gate applies to a call and only to a call', () => {
  const free = clearFold({
    street: 'flop', community: ['2h', '7d', 'Jc'], toCall: 0, potOdds: null,
    canCheck: true, canBet: true, minBet: 20, maxBet: 2000, equity: 0.19, pot: 80,
  });
  assert.equal(isPriced(free), false);
  assert.equal(routeFor(free).route, Route.POLICY);

  // The same hand strength, but now it costs something to see the next card.
  const priced = { ...free, toCall: 40, potOdds: 0.33, canCheck: false, canBet: false };
  assert.equal(isPriced(priced), true);
  assert.equal(routeFor(priced).reason, Reason.CLOSE);
});

// ── every reason to spend ───────────────────────────────────────────────────

test('a close spot goes to the model', () => {
  const r = routeFor(clearFold({ equity: 0.36, toCall: 40, potOdds: 0.4 }));
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.CLOSE);
  assert.ok(r.margin < MARGIN_MIN);
});

test('two actions the policy cannot separate go to the model', () => {
  // The nuts facing a bet: call and raise rate on top of each other.
  const r = routeFor(clearFold({
    street: 'flop', community: ['As', 'Ah', '7c'], holeCards: ['Ad', 'Ac'],
    equity: 0.93, toCall: 60, potOdds: 0.2, pot: 200, canRaise: true,
    minRaise: 120, maxRaise: 2000,
  }));
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.OPTIONS);
  assert.ok(r.options > 1);
});

test('a big pot goes to the model however obvious the hand is', () => {
  // PACE_HEAT_BB defaults to 25; 800 chips at 20bb is 40bb.
  const r = routeFor(clearFold({ pot: 800 }));
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.BIG_POT);
});

test('the river goes to the model', () => {
  const r = routeFor(clearFold({ street: 'river', community: ['2h', '7d', 'Jc', '4s', '9d'] }));
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.RIVER);
});

test('a stack in the middle goes to the model, both ways round', () => {
  assert.equal(routeFor(clearFold({ anyAllIn: true })).reason, Reason.ALLIN);
  // Calling would put HIM all in.
  assert.equal(routeFor(clearFold({ toCall: 500, myStack: 500 })).reason, Reason.ALLIN);
});

test('a tilted agent routes everything to the model — the folds included', () => {
  const tilted = clearFold({ mood: { state: 'tilted', heat: 72 } });
  const r = routeFor(tilted);
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.HEAT);

  // And it is not one spot: the whole hand goes, street by street.
  for (const street of ['preflop', 'flop', 'turn']) {
    assert.equal(routeFor({ ...tilted, street }).route, Route.MODEL, street);
  }
  // Exactly at the threshold it already counts.
  assert.equal(routeFor(clearFold({ mood: { state: 'sharp', heat: HEAT_MAX } })).reason, Reason.HEAT);
  // A point under it does not.
  assert.equal(routeFor(clearFold({ mood: { state: 'neutral', heat: HEAT_MAX - 1 } })).route, Route.POLICY);
});

test('a read on the wire goes to the model — it is there to be acted on', () => {
  const r = routeFor(clearFold({
    opponentReads: [{ playerId: 'p2', displayName: 'Granite', handsObserved: 40, vpip: 0.7 }],
  }));
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.READ);
});

test('a needle queued for him goes to the model — a template cannot answer it', () => {
  const r = routeFor(clearFold({ tableTalk: 'Still folding, then?' }));
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.TALK);
});

test('a nemesis at the table goes to the model', () => {
  const r = routeFor(clearFold(), { nemesis: true });
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.NEMESIS);
});

test('a spot nothing can measure goes to the model, not to a guess', () => {
  const r = routeFor(clearFold({ equity: null }));
  assert.equal(r.route, Route.MODEL);
  assert.equal(r.reason, Reason.BLIND);
  assert.equal(r.margin, null);
});

// ── home ────────────────────────────────────────────────────────────────────

test('the kitchen table never calls a model, whatever the spot is', () => {
  const worst = clearFold({
    street: 'river',
    equity: 0.5, potOdds: 0.5,           // as close as a spot gets
    pot: 4000,                            // as big as a pot gets
    anyAllIn: true,
    mood: { state: 'tilted', heat: 95 },
    opponentReads: [{ playerId: 'p2', displayName: 'Granite', handsObserved: 90 }],
    tableTalk: 'You are not calling this.',
  });
  const r = routeFor(worst, { home: true, nemesis: true });
  assert.equal(r.route, Route.POLICY);
  assert.equal(r.reason, Reason.HOME);
});

// ── all-in detection ────────────────────────────────────────────────────────

test('isAllIn does not fire on a call he can comfortably afford', () => {
  assert.equal(isAllIn({ toCall: 40, myStack: 2000 }), false);
  assert.equal(isAllIn({ toCall: 0, myStack: 0 }), false, 'a busted seat is not a decision');
});

// ── counting ────────────────────────────────────────────────────────────────

test('the counter tallies the split and the reasons behind it', () => {
  const counter = newRouteCounter();
  countRoute(counter, routeFor(clearFold()));
  countRoute(counter, routeFor(clearFold()));
  countRoute(counter, routeFor(clearFold({ street: 'river' })));

  assert.equal(counter.total, 3);
  assert.equal(counter.policy, 2);
  assert.equal(counter.model, 1);
  assert.equal(counter.byReason.clear, 2);
  assert.equal(counter.byReason.river, 1);
  assert.ok(Math.abs(policyShare(counter) - 2 / 3) < 1e-9);
  assert.match(formatRoutes(counter), /3 decisions/);
  assert.match(formatRoutes(counter), /clear 2/);
});

test('an empty counter reports nothing rather than dividing by zero', () => {
  const counter = newRouteCounter();
  assert.equal(policyShare(counter), null);
  assert.equal(formatRoutes(counter), 'no decisions');
});
