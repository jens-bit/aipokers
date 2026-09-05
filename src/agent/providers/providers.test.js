// src/agent/providers/providers.test.js — MODEL-1
//
// The provider interface, with a stub transport. No network, no key, no cost:
// every provider takes an injected client/fetch, and this file is the reason
// that seam exists. A real round-trip per provider is `npm run test:live`
// (scripts/test-live-providers.js), which is opt-in and never part of CI.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROVIDERS, providerIdFor, providerFor, complete, isConfigured, normaliseUsage,
} from './index.js';
import * as anthropic from './anthropic.js';
import * as openaiCompatible from './openaiCompatible.js';
import * as ollama from './ollama.js';
import {
  priceFor, costOf, newCostMeter, addCost, usdPer100Hands, formatUsd, CACHED_INPUT_MULTIPLIER,
} from './pricing.js';

// ── env helper ───────────────────────────────────────────────────────────────
// These tests set provider env vars; restore whatever the machine had so one
// test cannot leak into the next (or into the developer's shell expectations).
function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === null) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// ── routing ──────────────────────────────────────────────────────────────────

test('model id prefix picks the provider', () => {
  withEnv({ AI_PROVIDER: null }, () => {
    assert.equal(providerIdFor('claude-haiku-4-5'), 'anthropic');
    assert.equal(providerIdFor('claude-opus-5'), 'anthropic');
    assert.equal(providerIdFor('anthropic/claude-sonnet-5'), 'anthropic');
    assert.equal(providerIdFor('ollama/llama3.3:70b'), 'ollama');
    // Every hosted-Llama vendor speaks the OpenAI shape and their ids share no
    // prefix, so that is the documented catch-all.
    assert.equal(providerIdFor('llama-3.3-70b-versatile'), 'openai-compatible');
    assert.equal(providerIdFor('meta-llama/Llama-3.3-70B-Instruct-Turbo'), 'openai-compatible');
    assert.equal(providerIdFor('deepseek-ai/DeepSeek-V3'), 'openai-compatible');
  });
});

test('an explicit provider beats the prefix', () => {
  withEnv({ AI_PROVIDER: null }, () => {
    // A self-hosted endpoint may serve a model under any name it likes.
    assert.equal(providerIdFor('claude-haiku-4-5', 'openai-compatible'), 'openai-compatible');
    assert.equal(providerIdFor('llama3.3:70b', 'ollama'), 'ollama');
  });
});

test('AI_PROVIDER overrides the prefix for every call', () => {
  withEnv({ AI_PROVIDER: 'ollama' }, () => {
    assert.equal(providerIdFor('claude-haiku-4-5'), 'ollama');
  });
});

test('an unknown provider is refused loudly', () => {
  withEnv({ AI_PROVIDER: null }, () => {
    assert.throws(() => providerIdFor('x', 'wishful'), /unknown provider/);
  });
});

test('every provider implements the same interface', () => {
  for (const [name, impl] of Object.entries(PROVIDERS)) {
    assert.equal(typeof impl.complete, 'function', `${name}.complete`);
    assert.equal(typeof impl.isConfigured, 'function', `${name}.isConfigured`);
    assert.equal(impl.id, name === 'openai-compatible' ? 'openai-compatible' : name);
  }
  assert.equal(providerFor('claude-haiku-4-5'), anthropic);
});

// ── anthropic, stubbed ───────────────────────────────────────────────────────

test('anthropic: sends the cached system block and reports usage', async () => {
  const seen = {};
  const transport = {
    messages: {
      create: async (req) => {
        Object.assign(seen, req);
        return {
          content: [{ type: 'text', text: '{"action":{"type":"fold"},"reasoning":"nope"}' }],
          usage: { input_tokens: 900, output_tokens: 40, cache_read_input_tokens: 200 },
        };
      },
    },
  };

  const out = await anthropic.complete({
    model: 'claude-haiku-4-5',
    system: 'SYSTEM PREFIX',
    messages: [{ role: 'user', content: 'your turn' }],
    maxTokens: 200,
    transport,
  });

  assert.equal(seen.model, 'claude-haiku-4-5');
  assert.equal(seen.max_tokens, 200);
  assert.deepEqual(seen.system, [
    { type: 'text', text: 'SYSTEM PREFIX', cache_control: { type: 'ephemeral' } },
  ]);
  assert.deepEqual(seen.messages, [{ role: 'user', content: 'your turn' }]);
  assert.match(out.text, /"fold"/);
  assert.deepEqual(out.usage, { inputTokens: 900, outputTokens: 40, cachedInputTokens: 200 });
});

// ── openai-compatible, stubbed ───────────────────────────────────────────────

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok, status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test('openai-compatible: posts chat/completions with system as the first message', async () => {
  await withEnv({ OPENAI_COMPAT_URL: 'https://api.example.com/openai/v1', OPENAI_COMPAT_KEY: 'k' }, async () => {
    let url; let init;
    const transport = async (u, i) => {
      url = u; init = i;
      return jsonResponse({
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 700, completion_tokens: 25 },
      });
    };

    const out = await openaiCompatible.complete({
      model: 'llama-3.3-70b-versatile',
      system: 'SYS',
      messages: [{ role: 'user', content: 'go' }],
      maxTokens: 200,
      transport,
    });

    assert.equal(url, 'https://api.example.com/openai/v1/chat/completions');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers.Authorization, 'Bearer k');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'llama-3.3-70b-versatile');
    assert.equal(body.max_tokens, 200);
    assert.deepEqual(body.messages, [
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'go' },
    ]);
    assert.equal(out.text, 'hello');
    assert.deepEqual(out.usage, { inputTokens: 700, outputTokens: 25, cachedInputTokens: 0 });
  });
});

test('openai-compatible: a trailing slash on the base URL does not double up', async () => {
  await withEnv({ OPENAI_COMPAT_URL: 'https://api.example.com/v1/', OPENAI_COMPAT_KEY: 'k' }, async () => {
    let url;
    await openaiCompatible.complete({
      model: 'm', system: '', messages: [], maxTokens: 10,
      transport: async (u) => { url = u; return jsonResponse({ choices: [{ message: { content: '' } }] }); },
    });
    assert.equal(url, 'https://api.example.com/v1/chat/completions');
  });
});

test('openai-compatible: reads a cached-token count when the vendor reports one', async () => {
  await withEnv({ OPENAI_COMPAT_URL: 'https://x/v1', OPENAI_COMPAT_KEY: 'k' }, async () => {
    const out = await openaiCompatible.complete({
      model: 'm', system: '', messages: [], maxTokens: 10,
      transport: async () => jsonResponse({
        choices: [{ message: { content: 'x' } }],
        usage: { prompt_tokens: 500, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 400 } },
      }),
    });
    assert.equal(out.usage.cachedInputTokens, 400);
  });
});

test('openai-compatible: an HTTP error carries the status and body', async () => {
  await withEnv({ OPENAI_COMPAT_URL: 'https://x/v1', OPENAI_COMPAT_KEY: 'k' }, async () => {
    await assert.rejects(
      openaiCompatible.complete({
        model: 'm', system: '', messages: [], maxTokens: 10,
        transport: async () => ({ ok: false, status: 429, text: async () => 'rate limited' }),
      }),
      /openai-compatible 429: rate limited/,
    );
  });
});

test('openai-compatible: refuses without a base URL rather than half-working', async () => {
  await withEnv({ OPENAI_COMPAT_URL: null, OPENAI_COMPAT_KEY: null }, async () => {
    assert.equal(openaiCompatible.isConfigured(), false);
    await assert.rejects(
      openaiCompatible.complete({ model: 'm', system: '', messages: [], maxTokens: 10, transport: async () => jsonResponse({}) }),
      /OPENAI_COMPAT_URL is not set/,
    );
  });
});

// ── ollama, stubbed ──────────────────────────────────────────────────────────

test('ollama: posts api/chat, strips the routing prefix, maps eval counts', async () => {
  await withEnv({ OLLAMA_URL: 'http://localhost:11434' }, async () => {
    let url; let init;
    const out = await ollama.complete({
      model: 'ollama/llama3.3:70b',
      system: 'SYS',
      messages: [{ role: 'user', content: 'go' }],
      maxTokens: 200,
      transport: async (u, i) => {
        url = u; init = i;
        return jsonResponse({ message: { content: 'local reply' }, prompt_eval_count: 640, eval_count: 30 });
      },
    });

    assert.equal(url, 'http://localhost:11434/api/chat');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'llama3.3:70b', 'the ollama/ prefix routes, it is not part of the id');
    assert.equal(body.stream, false);
    assert.equal(body.options.num_predict, 200);
    assert.equal(out.text, 'local reply');
    assert.deepEqual(out.usage, { inputTokens: 640, outputTokens: 30, cachedInputTokens: 0 });
  });
});

test('ollama: defaults to the local daemon', () => {
  withEnv({ OLLAMA_URL: null }, () => {
    assert.equal(ollama.baseUrl(), 'http://127.0.0.1:11434');
    assert.equal(ollama.isConfigured(), true, 'a local daemon needs no credential');
  });
});

// ── the shared entry point ───────────────────────────────────────────────────

test('complete() routes and labels the result with the provider it used', async () => {
  await withEnv({ AI_PROVIDER: null }, async () => {
    const out = await complete({
      model: 'claude-haiku-4-5',
      system: 's',
      messages: [{ role: 'user', content: 'u' }],
      maxTokens: 10,
      transport: {
        messages: { create: async () => ({ content: [{ text: 'ok' }], usage: { input_tokens: 1, output_tokens: 2 } }) },
      },
    });
    assert.equal(out.provider, 'anthropic');
    assert.equal(out.model, 'claude-haiku-4-5');
    assert.equal(out.text, 'ok');
  });
});

test('isConfigured reflects the env, per provider', () => {
  withEnv({ AI_PROVIDER: null, ANTHROPIC_API_KEY: null, OPENAI_COMPAT_URL: null, OPENAI_COMPAT_KEY: null }, () => {
    assert.equal(isConfigured('claude-haiku-4-5'), false);
    assert.equal(isConfigured('llama-3.3-70b-versatile'), false);
  });
  withEnv({ AI_PROVIDER: null, ANTHROPIC_API_KEY: 'sk-test' }, () => {
    assert.equal(isConfigured('claude-haiku-4-5'), true);
  });
  withEnv({ AI_PROVIDER: null, OPENAI_COMPAT_URL: 'https://x/v1', OPENAI_COMPAT_KEY: 'k' }, () => {
    assert.equal(isConfigured('llama-3.3-70b-versatile'), true);
  });
});

test('normaliseUsage never returns a negative or a NaN', () => {
  assert.deepEqual(normaliseUsage({}), { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 });
  assert.deepEqual(normaliseUsage({ inputTokens: -5, outputTokens: 1.6, cachedInputTokens: null }),
    { inputTokens: 0, outputTokens: 2, cachedInputTokens: 0 });
});

// ── pricing ──────────────────────────────────────────────────────────────────

test('the shipped table prices the Anthropic models', () => {
  withEnv({ MODEL_PRICES: null, MODEL_PRICE_DEFAULT: null }, () => {
    assert.deepEqual(priceFor('claude-haiku-4-5'), { in: 1.00, out: 5.00 });
    assert.deepEqual(priceFor('claude-sonnet-5'), { in: 2.00, out: 10.00 });
    assert.deepEqual(priceFor('claude-opus-5'), { in: 5.00, out: 25.00 });
  });
});

test('an unpriced model reports null, not zero', () => {
  withEnv({ MODEL_PRICES: null, MODEL_PRICE_DEFAULT: null }, () => {
    assert.equal(priceFor('llama-3.3-70b-versatile'), null, '"unknown" and "free" are different answers');
    assert.equal(costOf({ inputTokens: 1000, outputTokens: 100 }, 'llama-3.3-70b-versatile'), null);
  });
});

test('a local model is free whatever it is called', () => {
  withEnv({ MODEL_PRICES: null, MODEL_PRICE_DEFAULT: null }, () => {
    assert.deepEqual(priceFor('ollama/llama3.3:70b'), { in: 0, out: 0 });
    assert.equal(costOf({ inputTokens: 10_000, outputTokens: 500 }, 'llama3.3:70b', 'ollama'), 0);
  });
});

test('MODEL_PRICES fills in a vendor and overrides the table', () => {
  withEnv({ MODEL_PRICES: '{"llama-3.3-70b-versatile":{"in":0.59,"out":0.79},"claude-haiku-4-5":{"in":9,"out":9}}' }, () => {
    assert.deepEqual(priceFor('llama-3.3-70b-versatile'), { in: 0.59, out: 0.79 });
    assert.deepEqual(priceFor('claude-haiku-4-5'), { in: 9, out: 9 }, 'env wins so a price change needs no deploy');
  });
});

test('malformed MODEL_PRICES is ignored rather than fatal', () => {
  withEnv({ MODEL_PRICES: 'not json', MODEL_PRICE_DEFAULT: null }, () => {
    assert.deepEqual(priceFor('claude-haiku-4-5'), { in: 1.00, out: 5.00 });
  });
});

test('cost is per million tokens, with cached input discounted', () => {
  withEnv({ MODEL_PRICES: null }, () => {
    // 1M fresh input + 1M output on Haiku = $1 + $5.
    assert.equal(costOf({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, 'claude-haiku-4-5'), 6);
    // Half the input cached: 500k at $1/M + 500k at $0.10/M.
    const cached = costOf(
      { inputTokens: 1_000_000, cachedInputTokens: 500_000, outputTokens: 0 },
      'claude-haiku-4-5',
    );
    assert.equal(cached, 0.5 + 0.5 * CACHED_INPUT_MULTIPLIER);
  });
});

test('a cached count larger than the input cannot make a call cheaper than free', () => {
  withEnv({ MODEL_PRICES: null }, () => {
    const usd = costOf({ inputTokens: 100, cachedInputTokens: 100_000, outputTokens: 0 }, 'claude-haiku-4-5');
    assert.ok(usd >= 0 && usd < 0.001, `got ${usd}`);
  });
});

test('the meter totals calls and reports dollars per 100 hands', () => {
  withEnv({ MODEL_PRICES: null }, () => {
    const meter = newCostMeter();
    // 40 decisions over 20 hands, 1000 in / 50 out each, on Haiku.
    for (let i = 0; i < 40; i++) {
      addCost(meter, { inputTokens: 1_000, outputTokens: 50 }, 'claude-haiku-4-5');
    }
    assert.equal(meter.calls, 40);
    assert.equal(meter.inputTokens, 40_000);
    assert.equal(meter.unpriced, 0);
    const perCall = (1_000 * 1 + 50 * 5) / 1_000_000;
    assert.ok(Math.abs(meter.usd - perCall * 40) < 1e-12);
    const per100 = usdPer100Hands(meter, 20);
    assert.ok(Math.abs(per100 - (meter.usd / 20) * 100) < 1e-12);
  });
});

test('the meter counts unpriced calls instead of quietly under-reporting', () => {
  withEnv({ MODEL_PRICES: null, MODEL_PRICE_DEFAULT: null }, () => {
    const meter = newCostMeter();
    addCost(meter, { inputTokens: 1_000, outputTokens: 50 }, 'some-new-model');
    assert.equal(meter.calls, 1);
    assert.equal(meter.unpriced, 1);
    assert.equal(meter.usd, 0);
  });
});

test('no calls means no figure, not $0.00', () => {
  assert.equal(usdPer100Hands(newCostMeter(), 100), null);
  assert.equal(usdPer100Hands(newCostMeter(), 0), null);
  assert.equal(formatUsd(null), '—');
  assert.equal(formatUsd(0.01234), '$0.0123');
});
