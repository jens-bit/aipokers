import test from 'node:test';
import assert from 'node:assert/strict';
import { playHouseSession, projectHouseholds } from './economyBenchmark.js';

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

test('BUG-253: actual House sessions reproduce deck, equity and policy choices and restore RNG', () => {
  const before = Math.random;
  // The upper room deliberately retains the original competitive selection.
  const options = { seed: 314159, rung: 2, hands: 12, iterations: 20 };
  const a = playHouseSession(options), b = playHouseSession(options);
  assert.deepEqual(a, b);
  assert.equal(Math.random, before);
  assert.deepEqual(Object.keys(a.cast), ['doyle_v3'], 'production House is present from the first hand');
  assert.equal(a.net, a.deltas.reduce((sum, delta) => sum + delta, 0));
  assert.ok(a.decisions > a.hands);
  assert.ok(a.allRake >= a.rake);
});

test('BUG-253: projection earns slots from positive session nets without charging slot prices or minting chips', () => {
  const wins = [{ stack: 4000, net: 2000, rake: 40, hands: 100 }];
  const out = projectHouseholds({ 0: wins }, { households: 3, sessions: 5, progress: false });
  assert.equal(out.meanBalance, 20000, 'five real net wins add ten thousand to the original grant');
  assert.equal(out.meanEarned, 10000);
  assert.deepEqual(out.milestones.slot2, { reached: 3, medianSessionAmongReachers: 5 });
  assert.equal(out.alive, 3);
});

test('BUG-253: five losing buy-ins exhaust the actual starter grant and no session is gifted', () => {
  const losses = [{ stack: 0, net: -2000, rake: 0, hands: 30 }];
  const out = projectHouseholds({ 0: losses }, { households: 2, sessions: 20, progress: false });
  assert.equal(out.alive, 0);
  assert.equal(out.meanBalance, 0);
  assert.equal(out.meanHands, 150);
  assert.equal(out.meanEarned, 0);
  assert.equal(out.milestones.slot2.reached, 0);
});
