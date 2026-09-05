// src/agent/providers/index.js — MODEL-1
//
// One interface, three back ends. The decision call in handler.js used to be a
// direct Anthropic SDK call; it now goes through here, so the same briefing can
// be sent to Claude, to anything speaking the OpenAI chat-completions shape
// (Groq, Together, DeepInfra, Fireworks, vLLM…), or to a local Ollama.
//
// The contract every provider implements:
//
//   complete({ model, system, messages, maxTokens, timeoutMs, transport })
//     → { text, usage: { inputTokens, outputTokens, cachedInputTokens }, model, provider }
//
//   system    — string. The cached prefix, sent however the provider wants it.
//   messages  — [{ role: 'user' | 'assistant', content: string }]
//   maxTokens — integer cap on the reply.
//   timeoutMs — request timeout.
//   transport — TEST SEAM. An injected client/fetch stand-in. Every provider
//               must work without touching the network when it is supplied,
//               which is what lets providers.test.js run in `npm test`.
//
// Nothing here knows about poker. handler.js keeps the prompts; this keeps the
// wire.

import * as anthropic from './anthropic.js';
import * as openaiCompatible from './openaiCompatible.js';
import * as ollama from './ollama.js';

export const PROVIDERS = Object.freeze({
  anthropic,
  'openai-compatible': openaiCompatible,
  ollama,
});

export const DEFAULT_MODEL = process.env.AI_MODEL || 'claude-haiku-4-5';

// Which back end serves a model id.
//
// An explicit provider always wins — AI_PROVIDER, or a `provider` passed per
// call — because a self-hosted endpoint can serve a model under any name it
// likes and no prefix rule can know that.
//
// Otherwise the id decides:
//   claude-*, anthropic/*  → anthropic
//   ollama/*               → ollama
//   everything else        → openai-compatible
//
// The catch-all is deliberate and documented: the OpenAI chat-completions
// shape is what every hosted-Llama vendor speaks, and their model ids
// (`llama-3.3-70b-versatile`, `meta-llama/Llama-3.3-70B-Instruct-Turbo`) have
// no common prefix to key on. Guessing wrong is loud rather than silent —
// openaiCompatible refuses without OPENAI_COMPAT_URL rather than half-working.
export function providerIdFor(model, explicit = null) {
  const chosen = explicit || process.env.AI_PROVIDER || null;
  if (chosen) {
    if (!PROVIDERS[chosen]) {
      throw new Error(`unknown provider "${chosen}" — one of: ${Object.keys(PROVIDERS).join(', ')}`);
    }
    return chosen;
  }
  const id = String(model || '').toLowerCase();
  if (id.startsWith('claude-') || id.startsWith('anthropic/')) return 'anthropic';
  if (id.startsWith('ollama/')) return 'ollama';
  return 'openai-compatible';
}

export function providerFor(model, explicit = null) {
  return PROVIDERS[providerIdFor(model, explicit)];
}

// The one call the rest of the codebase makes.
export async function complete({
  model = DEFAULT_MODEL,
  provider = null,
  system = '',
  messages = [],
  maxTokens = 200,
  timeoutMs = 9000,
  transport = null,
} = {}) {
  const id = providerIdFor(model, provider);
  const impl = PROVIDERS[id];
  const result = await impl.complete({ model, system, messages, maxTokens, timeoutMs, transport });
  return { provider: id, model, ...result };
}

// True when this provider has what it needs to make a real call. handler.js
// asks before spending a turn, so a missing key still produces the documented
// safe fallback rather than an exception.
export function isConfigured(model = DEFAULT_MODEL, provider = null) {
  try {
    return PROVIDERS[providerIdFor(model, provider)].isConfigured();
  } catch {
    return false;
  }
}

// Normalises whatever a provider reports into the three numbers the cost line
// needs. Exported so providers share one shape and the test can assert it.
export function normaliseUsage({ inputTokens, outputTokens, cachedInputTokens } = {}) {
  const n = (v) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  return {
    inputTokens: n(inputTokens),
    outputTokens: n(outputTokens),
    cachedInputTokens: n(cachedInputTokens),
  };
}
