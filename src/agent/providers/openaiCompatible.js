// src/agent/providers/openaiCompatible.js — MODEL-1
//
// Anything speaking the OpenAI chat-completions shape: Groq, Together,
// DeepInfra, Fireworks, OpenRouter, a self-hosted vLLM. One endpoint, one
// body shape, one env pair — the vendor is a base URL.
//
//   OPENAI_COMPAT_URL   base, e.g. https://api.groq.com/openai/v1
//   OPENAI_COMPAT_KEY   bearer token
//
// No SDK: this is a single POST and adding a dependency to spell it would be
// a dependency per vendor. `transport` is the injected fetch for tests.

import { normaliseUsage } from './index.js';

export const id = 'openai-compatible';

export function baseUrl() {
  return (process.env.OPENAI_COMPAT_URL || '').replace(/\/+$/, '');
}

export function isConfigured() {
  return !!baseUrl() && !!process.env.OPENAI_COMPAT_KEY;
}

export async function complete({ model, system, messages, maxTokens, timeoutMs = 9000, transport = null }) {
  const url = baseUrl();
  if (!url) throw new Error('OPENAI_COMPAT_URL is not set');
  const key = process.env.OPENAI_COMPAT_KEY;
  if (!key && !transport) throw new Error('OPENAI_COMPAT_KEY is not set');

  const doFetch = transport ?? globalThis.fetch;

  // The system prompt is the first message rather than a separate field —
  // that is the shape every vendor in this family accepts, and it keeps the
  // prefix first so their own prefix caching (where it exists) can see it.
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  // AbortController rather than a fetch option: `timeout` is not part of the
  // fetch standard and is silently ignored by most runtimes.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await doFetch(`${url}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key ?? 'test'}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${id} ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? '';

  // prompt_tokens_details.cached_tokens is what the vendors that do prefix
  // caching report; absent everywhere else, which normalises to 0.
  return {
    text,
    usage: normaliseUsage({
      inputTokens: json?.usage?.prompt_tokens,
      outputTokens: json?.usage?.completion_tokens,
      cachedInputTokens: json?.usage?.prompt_tokens_details?.cached_tokens,
    }),
  };
}
