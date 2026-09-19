import test from 'node:test';
import assert from 'node:assert/strict';
import { perceivedMath } from './perceivedMath.js';
import { perceivedMath as briefingMath } from './handler.js';
import { chooseFromPolicy, rateActions, marginOf, facingOdds } from './policyPlay.js';
import { routeFor } from '../server/router.js';
import { sampleGameStates } from './fixtures/sampleGameStates.js';

function spot() {
  return { street: 'river', handNumber: 4, seat: 0, holeCards: ['Ah', 'Td'],
    community: ['Ac', '7s', '3d', '6c', '2h'], pot: 100, bb: 20, myContrib: 0,
    toCall: 45, canCheck: false, canRaise: false, equity: 0.30, potOdds: 0.31,
    attrs: { FOCUS: 0 }, policy: { profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
      dice: { bluffDie: false, deviationDie: false }, range: null } };
}

test('BUG-263: free policy uses the same FOCUS-distorted price that its hand record says it saw', () => {
  const gs = spot();
  assert.equal(briefingMath, perceivedMath, 'existing handler callers keep the identical shared function');
  assert.equal(perceivedMath(gs).potOdds, 0.25);
  assert.deepEqual(chooseFromPolicy(gs).action, { type: 'call' }, 'perceived .30 equity exceeds perceived .25 price');
  assert.deepEqual(chooseFromPolicy({ ...gs, attrs: { FOCUS: 50 } }).action, { type: 'fold' }, 'neutral sees the true .31 price');
});

test('BUG-263: router confidence uses perceived math and leaves true equity telemetry intact', () => {
  const gs = spot(), before = structuredClone(gs), seen = perceivedMath(gs);
  const margin = Math.abs(seen.equity - seen.potOdds);
  assert.equal(facingOdds(gs), seen.potOdds);
  assert.equal(marginOf(gs), margin);
  assert.equal(routeFor(gs, { home: true }).margin, Number(margin.toFixed(4)));
  assert.deepEqual(gs, before);
});

test('BUG-263: repeated routing, rating and fallback do not compound or reroll a hand perception', () => {
  const gs = spot(), original = structuredClone(gs), seen = perceivedMath(gs);
  const action = chooseFromPolicy(gs).action;
  for (let i = 0; i < 20; i++) {
    rateActions(gs); marginOf(gs); routeFor(gs);
    assert.deepEqual(perceivedMath(gs), seen);
    assert.deepEqual(chooseFromPolicy(gs).action, action);
  }
  assert.deepEqual(gs, original);
});

test('BUG-263: neutral FOCUS and disabled attribute impact preserve every existing sampled policy rating exactly', () => {
  const saved = process.env.ATTRIBUTE_IMPACT;
  try {
    for (const gs of sampleGameStates(64, 263)) {
      process.env.ATTRIBUTE_IMPACT = '1';
      const raw = rateActions(gs), rawMargin = marginOf(gs);
      assert.deepEqual(rateActions({ ...gs, attrs: { FOCUS: 50 } }), raw);
      assert.equal(marginOf({ ...gs, attrs: { FOCUS: 50 } }), rawMargin);
      process.env.ATTRIBUTE_IMPACT = '0';
      assert.deepEqual(rateActions({ ...gs, attrs: { FOCUS: 0 } }), raw);
      assert.equal(marginOf({ ...gs, attrs: { FOCUS: 0 } }), rawMargin);
    }
  } finally { if (saved === undefined) delete process.env.ATTRIBUTE_IMPACT; else process.env.ATTRIBUTE_IMPACT = saved; }
});
