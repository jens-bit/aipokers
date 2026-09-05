// src/agent/providers/anthropic.js — MODEL-1
//
// Today's decision call, moved behind the provider interface and otherwise
// unchanged: same official SDK, same `system` block carrying
// cache_control: ephemeral, same 9s timeout, same usage fields.
//
// The cache_control block stays even though CACHE-1 measured it as inert on
// Haiku 4.5 (4096-token minimum cacheable prefix; our static prefix is ~235
// tokens). It costs nothing, it is already correct, and the verdict says to
// revisit "if decisions move to a model with a lower floor" — Opus 5 is 512
// and Sonnet 5 is 1024, so a --model flag pointed at either is exactly that
// case. Removing the block would mean re-deriving it later.

import Anthropic from '@anthropic-ai/sdk';
import { normaliseUsage } from './index.js';

export const id = 'anthropic';

export function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

// `transport` is the test seam: anything with .messages.create(). In
// production it is undefined and the real SDK client is built here.
export async function complete({ model, system, messages, maxTokens, timeoutMs = 9000, transport = null }) {
  const client = transport ?? new Anthropic({ timeout: timeoutMs });

  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const text = msg?.content?.[0]?.text ?? '';
  return {
    text,
    usage: normaliseUsage({
      inputTokens: msg?.usage?.input_tokens,
      outputTokens: msg?.usage?.output_tokens,
      cachedInputTokens: msg?.usage?.cache_read_input_tokens,
    }),
  };
}
