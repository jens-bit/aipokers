#!/usr/bin/env node
// scripts/test-live-providers.js — MODEL-1
//
// ONE real round-trip per configured provider. This spends money and needs
// keys, so it is opt-in and never part of `npm test` or CI:
//
//   npm run test:live:providers
//
// A provider with no credentials is SKIPPED, not failed — the point is to
// prove the wire works for whatever this machine is set up for, not to demand
// that every vendor be configured. Exits non-zero only when a provider that
// IS configured fails to answer.
//
// Each call is a tiny prompt with a 30-token cap: a few hundredths of a cent
// on the paid providers, free on Ollama.

import { complete, isConfigured, PROVIDERS } from '../src/agent/providers/index.js';
import { costOf, formatUsd } from '../src/agent/providers/pricing.js';

// One model per provider, overridable so a Groq user can point the
// openai-compatible probe at whatever their endpoint actually serves.
const PROBES = [
  {
    provider: 'anthropic',
    model: process.env.LIVE_ANTHROPIC_MODEL || 'claude-haiku-4-5',
    needs: 'ANTHROPIC_API_KEY',
  },
  {
    provider: 'openai-compatible',
    model: process.env.LIVE_OPENAI_COMPAT_MODEL || 'llama-3.3-70b-versatile',
    needs: 'OPENAI_COMPAT_URL + OPENAI_COMPAT_KEY',
  },
  {
    provider: 'ollama',
    model: process.env.LIVE_OLLAMA_MODEL || 'ollama/llama3.2',
    needs: 'a running Ollama at OLLAMA_URL',
  },
];

const SYSTEM = 'You are terse. Reply with exactly one word and nothing else.';
const USER = 'Say the word: ready';

let ran = 0;
let failed = 0;
let skipped = 0;

console.log('\n[live] one real call per configured provider — this spends money\n');

for (const probe of PROBES) {
  const { provider, model, needs } = probe;

  // Ollama's isConfigured() only says "we know the URL"; a daemon that is not
  // running fails at connect, and that is reported rather than skipped.
  if (!isConfigured(model, provider)) {
    console.log(`  SKIP  ${provider.padEnd(18)} — not configured (${needs})`);
    skipped++;
    continue;
  }

  const started = Date.now();
  try {
    const out = await complete({
      model,
      provider,
      system: SYSTEM,
      messages: [{ role: 'user', content: USER }],
      maxTokens: 30,
      timeoutMs: 30_000,
    });

    const ms = Date.now() - started;
    const text = (out.text || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!text) throw new Error('empty reply');

    const usd = costOf(out.usage, model, provider);
    console.log(
      `  PASS  ${provider.padEnd(18)} ${model}\n` +
      `        "${text}"  (${ms}ms, in:${out.usage.inputTokens} out:${out.usage.outputTokens} ` +
      `cached:${out.usage.cachedInputTokens}, ${formatUsd(usd, 6)})`,
    );
    ran++;
  } catch (err) {
    console.error(`  FAIL  ${provider.padEnd(18)} ${model} — ${err.message}`);
    failed++;
  }
}

console.log(`\n${ran} ran, ${skipped} skipped, ${failed} failed`);
if (ran === 0 && failed === 0) {
  console.log('Nothing was configured — set ANTHROPIC_API_KEY, OPENAI_COMPAT_URL/KEY, or run Ollama.');
}
console.log(`providers registered: ${Object.keys(PROVIDERS).join(', ')}\n`);
process.exit(failed > 0 ? 1 : 0);
