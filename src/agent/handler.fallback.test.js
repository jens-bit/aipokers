import test from 'node:test';
import assert from 'node:assert/strict';
import { getAgentAction, isFallbackDecision } from './handler.js';
import { chooseFromPolicy } from './policyPlay.js';

const opts = { model: 'claude-haiku-4-5', provider: 'anthropic' };
const profile = { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 };
function spot(over = {}) {
  return { street: 'river', handNumber: 7, seat: 0, holeCards: ['Ah', 'Ad'],
    community: ['As', 'Ac', '7h', '4d', '2c'], position: 'BTN', sb: 10, bb: 20,
    pot: 500, myStack: 1000, oppStack: 1000, myContrib: 0, toCall: 100,
    canCheck: false, canBet: false, canRaise: true, minBet: 20, maxBet: 1000,
    minRaise: 200, maxRaise: 1000, equity: 1, potOdds: 1 / 6, spr: 2,
    policy: { profile, dice: { bluffDie: false, deviationDie: false }, range: null,
      sizing: { openBB: 3, cbetFraction: 0.55 } }, ...over };
}
async function withKey(key, run) {
  const before = process.env.ANTHROPIC_API_KEY;
  if (key == null) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = key;
  try { return await run(); }
  finally { if (before === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = before; }
}
function assertPolicy(out, gs, reason) {
  assert.deepEqual(out.action, chooseFromPolicy(gs).action);
  assert.deepEqual(out.fallback, { policy: true, reason });
  assert.equal(out.reasoning, chooseFromPolicy(gs).reasoning);
  assert.doesNotMatch(out.reasoning, /API|fallback|parse failure|provider/i);
}
function assertNoReceipt(out) {
  for (const key of ['usage', 'model', 'provider', 'costUsd']) assert.equal(out[key], undefined, key);
}

test('BUG-261: an unavailable model keeps a winning river in the pot, with explicit free fallback provenance', async () => {
  await withKey(null, async () => {
    const gs = spot();
    const out = await getAgentAction(gs, '', '', { ...opts, transport: { messages: { create() { assert.fail('missing key must never call transport'); } } } });
    assert.notEqual(out.action.type, 'fold');
    assertPolicy(out, gs, 'unconfigured');
    assertNoReceipt(out);
  });
});

test('BUG-261: provider failure uses the same policy without a fabricated model receipt or retry', async () => {
  await withKey('test-only-stub', async () => {
    let calls = 0;
    const gs = spot();
    const transport = { messages: { async create() { calls++; throw new Error('stub timeout'); } } };
    const out = await getAgentAction(gs, '', '', { ...opts, transport });
    assertPolicy(out, gs, 'providerError');
    assertNoReceipt(out);
    assert.equal(calls, 1);
  });
});

for (const text of ['not JSON', '{"action":{"type":"teleport"}}', '{"action":{"type":"raise"}}', '{"action":{"type":"check"}}']) {
  test(`BUG-261: malformed response ${text} falls back to policy and retains only its actual response usage`, async () => {
    await withKey('test-only-stub', async () => {
      const gs = spot({ equity: 0.02, potOdds: 0.4 });
      let calls = 0;
      const transport = { messages: { async create() { calls++; return { content: [{ text }], usage: { input_tokens: 100, output_tokens: 12 } }; } } };
      const out = await getAgentAction(gs, '', '', { ...opts, transport });
      assertPolicy(out, gs, 'invalidResponse');
      assert.equal(out.action.type, 'fold', 'malformed output must not make a losing hand call');
      assert.deepEqual(out.usage, { inputTokens: 100, outputTokens: 12, cachedInputTokens: 0 });
      assert.equal(out.provider, 'anthropic');
      assert.equal(out.model, opts.model);
      assert.ok(out.costUsd > 0);
      assert.equal(calls, 1);
    });
  });
}

test('BUG-261: policy fallback preserves weak folds, free checks, capped calls and bet/raise totals', async () => {
  await withKey(null, async () => {
    for (const [label, gs, action] of [
      ['weak river', spot({ equity: 0.02, potOdds: 0.4 }), { type: 'fold' }],
      ['free check', spot({ toCall: 0, canCheck: true, canRaise: false, equity: 0.1 }), { type: 'check' }],
      ['short all-in call', spot({ myStack: 40, toCall: 40, canRaise: false }), { type: 'call' }],
      ['bet ceiling', spot({ toCall: 0, canCheck: true, canRaise: false, canBet: true, minBet: 20, maxBet: 70 }), { type: 'bet', amount: 70 }],
      ['raise floor', spot({ toCall: 0, canCheck: true, minRaise: 400, maxRaise: 1000 }), { type: 'raise', amount: 400 }],
    ]) {
      const out = await getAgentAction(gs, '', '', opts);
      assert.deepEqual(out.action, action, label);
      assertPolicy(out, gs, 'unconfigured');
      assertNoReceipt(out);
    }
  });
});

test('BUG-261: arena fallback classification follows metadata without requiring technical character speech', () => {
  assert.equal(isFallbackDecision({ reasoning: 'I am staying.', fallback: { policy: true, reason: 'unconfigured' } }), true);
  assert.equal(isFallbackDecision({ reasoning: 'parse failure — defaulting to a safe action' }), true);
  assert.equal(isFallbackDecision({ reasoning: 'I am staying.' }), false);
});

test('BUG-261: a valid model action keeps its legal clamp and receipt without a fallback label', async () => {
  await withKey('test-only-stub', async () => {
    const gs = spot({ maxRaise: 400 });
    const transport = { messages: { async create() { return {
      content: [{ text: '{"action":{"type":"raise","amount":9000},"reasoning":"Make your choice."}' }],
      usage: { input_tokens: 100, output_tokens: 12 },
    }; } } };
    const out = await getAgentAction(gs, '', '', { ...opts, transport });
    assert.deepEqual(out.action, { type: 'raise', amount: 400 });
    assert.equal(out.fallback, undefined);
    assert.equal(isFallbackDecision(out), false);
    assert.equal(out.usage.inputTokens, 100);
  });
});
