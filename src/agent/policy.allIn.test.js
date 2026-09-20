import test from 'node:test';
import assert from 'node:assert/strict';
import { compilePolicy } from './policy.js';
import { chooseFromPolicy } from './policyPlay.js';
import { getAgentAction } from './handler.js';
import { routeFor } from '../server/router.js';

const strategy = 'Make him go all in each hand.';
const profile = { tightness: 10, aggression: 98, bluffFreq: 70, discipline: 35 };
function spot(over = {}) {
  return { street: 'preflop', handNumber: 1, seat: 0, holeCards: ['7h', '2d'], community: [],
    position: 'BTN/SB', sb: 10, bb: 20, pot: 30, myStack: 1990, myContrib: 10, oppStack: 1980,
    toCall: 10, canCheck: false, canBet: false, canRaise: true, minRaise: 40, maxRaise: 2000,
    minBet: 0, maxBet: 0, equity: 0.1, potOdds: 0.25, spr: 66,
    policy: compilePolicy(profile, { strategy, holeCards: ['7h', '2d'], position: 'BTN/SB', rand: () => 0.99 }),
    ...over };
}

test('BUG-283: explicit every-hand all-in beats weak cards, ordinary sizing and deviation dice', () => {
  assert.deepEqual(chooseFromPolicy(spot()).action, { type: 'raise', amount: 2000 });
  assert.deepEqual(chooseFromPolicy(spot({ street: 'flop', toCall: 0, canCheck: true,
    canRaise: false, canBet: true, minBet: 20, maxBet: 1990 })).action, { type: 'bet', amount: 1990 });
});

test('BUG-283: fixed strategy uses only offered actions, with short calls and closed raise rights', () => {
  for (const [over, action] of [
    [{ myStack: 75, myContrib: 25, minRaise: 100, maxRaise: 100 }, { type: 'raise', amount: 100 }],
    [{ myStack: 15, toCall: 15, canRaise: false, maxRaise: 0 }, { type: 'call' }],
    [{ toCall: 50, canRaise: false, maxRaise: 0 }, { type: 'call' }],
    [{ toCall: 0, canCheck: true, canRaise: false, maxRaise: 0 }, { type: 'check' }],
  ]) assert.deepEqual(chooseFromPolicy(spot(over)).action, action);
});

test('BUG-283: a chosen fixed action needs no paid model for watched, unwatched, Home or guest play', () => {
  for (const opts of [{}, { unwatched: true }, { home: true }, { guest: true }]) {
    assert.equal(routeFor(spot({ street: 'river', anyAllIn: true, mood: { heat: 99 } }), opts).route, 'policy');
  }
  const before = process.env.DECISION_ROUTER;
  try {
    process.env.DECISION_ROUTER = 'off';
    assert.equal(routeFor(spot()).route, 'policy');
  } finally {
    if (before === undefined) delete process.env.DECISION_ROUTER; else process.env.DECISION_ROUTER = before;
  }
});

test('BUG-283: direct handler honors the saved instruction with and without provider configuration', async () => {
  const before = process.env.ANTHROPIC_API_KEY;
  try {
    for (const key of [null, 'test-only-never-called']) {
      if (key) process.env.ANTHROPIC_API_KEY = key; else delete process.env.ANTHROPIC_API_KEY;
      let calls = 0;
      const out = await getAgentAction(spot({ policy: compilePolicy(profile) }), strategy, '', {
        model: 'claude-haiku-4-5', provider: 'anthropic', transport: { messages: { async create() {
          calls++;
          return { content: [{ text: '{"action":{"type":"call"},"reasoning":"I will call."}' }],
            usage: { input_tokens: 1, output_tokens: 1 } };
        } } },
      });
      assert.deepEqual(out.action, { type: 'raise', amount: 2000 });
      assert.equal(calls, 0, 'a fixed owner rule does not need a model to acknowledge it');
      assert.equal(out.usage, undefined);
      assert.equal(out.fallback, undefined);
    }
  } finally {
    if (before === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = before;
  }
});

test('BUG-283: extreme sliders and the name All In alone retain ordinary poker decisions', () => {
  const gs = spot({ name: 'All In', policy: compilePolicy(profile, { strategy: 'Play loose and aggressive.',
    holeCards: ['7h', '2d'], position: 'BTN/SB', rand: () => 0.99 }) });
  assert.notDeepEqual(chooseFromPolicy(gs).action, { type: 'raise', amount: 2000 });
});

test('BUG-283: direct replacement strategy revokes a stale directive and memory never enables one', async () => {
  const before = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    const out = await getAgentAction(spot(), 'Do not go all in every hand. Play balanced poker.',
      'Earlier the owner said: always shove.', { model: 'claude-haiku-4-5', provider: 'anthropic' });
    assert.notDeepEqual(out.action, { type: 'raise', amount: 2000 });
    assert.deepEqual(out.fallback, { policy: true, reason: 'unconfigured' });
  } finally {
    if (before === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = before;
  }
});
