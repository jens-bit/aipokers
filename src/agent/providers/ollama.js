// src/agent/providers/ollama.js — MODEL-1
//
// A local Ollama. No key, no bill, no network beyond the machine — which is
// what makes it the right thing to point an arena run at while tuning the
// briefing, and the only provider whose cost line is legitimately zero.
//
//   OLLAMA_URL   default http://127.0.0.1:11434
//
// Model ids may be written `ollama/llama3.3:70b` (the prefix is what routes
// here) or bare with AI_PROVIDER=ollama; the prefix is stripped before the
// request because Ollama does not know about it.

import { normaliseUsage } from './index.js';

export const id = 'ollama';

const DEFAULT_URL = 'http://127.0.0.1:11434';

export function baseUrl() {
  return (process.env.OLLAMA_URL || DEFAULT_URL).replace(/\/+$/, '');
}

// A local daemon needs no credential, so there is nothing to check that would
// not be a network call. Configured means "we know where to look".
export function isConfigured() {
  return !!baseUrl();
}

export function stripPrefix(model) {
  return String(model || '').replace(/^ollama\//, '');
}

export async function complete({ model, system, messages, maxTokens, timeoutMs = 9000, transport = null }) {
  const doFetch = transport ?? globalThis.fetch;

  const body = {
    model: stripPrefix(model),
    stream: false,
    options: { num_predict: maxTokens },
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await doFetch(`${baseUrl()}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  // Ollama reports prompt_eval_count / eval_count. It has no prompt cache to
  // report, so cachedInputTokens is always 0 here.
  return {
    text: json?.message?.content ?? '',
    usage: normaliseUsage({
      inputTokens: json?.prompt_eval_count,
      outputTokens: json?.eval_count,
      cachedInputTokens: 0,
    }),
  };
}
