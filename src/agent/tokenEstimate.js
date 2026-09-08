// src/agent/tokenEstimate.js — COST-2
//
// How many tokens a string is, without asking a model.
//
// The real number lives on the wire — a completed call's `usage.inputTokens`
// is exact — but COST-2's job 1 is measuring the PROMPT before anything is
// sent, offline, with no key in the environment, so nothing here may call the
// API's (free) count_tokens endpoint either: this has to work with the network
// gone.
//
// The estimate is the one everybody already uses for English prose: four
// characters per token. It is not exact — a JSON-heavy briefing full of short
// numbers and punctuation tokenizes a little worse than prose — but it is
// stable, free, and good enough to tell whether a prompt is 300 tokens or
// 3,000, which is the only question job 1 and job 2 need answered.

const CHARS_PER_TOKEN = 4;

/** Rough token count for a string. 0 for anything that isn't one. */
export function estimateTokens(text) {
  if (typeof text !== 'string' || text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** The middle value of a numeric array. 0 for an empty one. */
export function median(values) {
  const nums = (values ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid];
}

/** The value at a given percentile (0..100), nearest-rank. 0 for an empty array. */
export function percentile(values, p) {
  const nums = (values ?? []).filter(Number.isFinite).sort((a, b) => a - b);
  if (nums.length === 0) return 0;
  const idx = Math.min(nums.length - 1, Math.ceil((p / 100) * nums.length) - 1);
  return nums[Math.max(0, idx)];
}
