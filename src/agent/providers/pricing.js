// src/agent/providers/pricing.js — MODEL-1b
//
// What a decision costs. Small on purpose: USD per MILLION tokens, in and out,
// per model id, so the arena can put a dollar figure next to a bb/100 and the
// "model tiers" question in CORE_GAME_PLAN.md stops being answered by
// intuition.
//
// These are list prices at the time of writing and they move. Two escape
// hatches, both env:
//
//   MODEL_PRICES        JSON, merged over the table below:
//                       {"llama-3.3-70b-versatile":{"in":0.59,"out":0.79}}
//   MODEL_PRICE_DEFAULT JSON, used for any model with no entry at all.
//
// An unpriced model reports null rather than 0 — "we do not know" and "it is
// free" are different answers, and printing $0.00 for an unpriced model is the
// kind of number people quote in a meeting six months later.

// Anthropic first-party rates, USD per 1M tokens.
const ANTHROPIC = {
  'claude-haiku-4-5': { in: 1.00, out: 5.00 },
  'claude-sonnet-5':  { in: 2.00, out: 10.00 },
  'claude-opus-5':    { in: 5.00, out: 25.00 },
  'claude-fable-5-1': { in: 10.00, out: 50.00 },
};

// Local inference has no per-token bill. Electricity is not our line item.
const LOCAL = { in: 0, out: 0 };

const BASE = { ...ANTHROPIC };

function envTable() {
  if (!process.env.MODEL_PRICES) return {};
  try {
    const parsed = JSON.parse(process.env.MODEL_PRICES);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('[pricing] MODEL_PRICES is not valid JSON — ignoring:', err.message);
    return {};
  }
}

function envDefault() {
  if (!process.env.MODEL_PRICE_DEFAULT) return null;
  try {
    const parsed = JSON.parse(process.env.MODEL_PRICE_DEFAULT);
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const valid = (p) => !!p && Number.isFinite(Number(p.in)) && Number.isFinite(Number(p.out));

// USD per 1M tokens for a model, or null when nothing knows.
export function priceFor(model, provider = null) {
  const id = String(model || '');
  const fromEnv = envTable()[id];
  if (valid(fromEnv)) return { in: Number(fromEnv.in), out: Number(fromEnv.out) };
  if (valid(BASE[id])) return BASE[id];
  // A local model is free whatever it is called.
  if (provider === 'ollama' || id.startsWith('ollama/')) return LOCAL;
  return envDefault();
}

// Cost of one call in USD, or null when the model has no price.
//
// Cached input tokens are billed at roughly a tenth of the input rate on
// Anthropic; that is the only discount modelled, and it is applied only to the
// portion the provider actually reported as cached (0 everywhere else today —
// see the CACHE-1 verdict).
export const CACHED_INPUT_MULTIPLIER = 0.1;

export function costOf(usage, model, provider = null) {
  const price = priceFor(model, provider);
  if (!price) return null;
  const inTok = usage?.inputTokens ?? 0;
  const cached = Math.min(usage?.cachedInputTokens ?? 0, inTok);
  const fresh = Math.max(0, inTok - cached);
  const outTok = usage?.outputTokens ?? 0;
  return (
    (fresh * price.in + cached * price.in * CACHED_INPUT_MULTIPLIER + outTok * price.out) / 1_000_000
  );
}

// A running total, so the arena can add decisions one at a time and print a
// dollars-per-100-hands figure at the end. `unpriced` is carried rather than
// swallowed: a summary that silently omits an unpriced model is a summary that
// understates the bill.
export function newCostMeter() {
  return { calls: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, usd: 0, unpriced: 0 };
}

export function addCost(meter, usage, model, provider = null) {
  if (!meter) return meter;
  meter.calls++;
  meter.inputTokens += usage?.inputTokens ?? 0;
  meter.outputTokens += usage?.outputTokens ?? 0;
  meter.cachedInputTokens += usage?.cachedInputTokens ?? 0;
  const usd = costOf(usage, model, provider);
  if (usd === null) meter.unpriced++;
  else meter.usd += usd;
  return meter;
}

// The arena's headline: what 100 hands of this cost.
export function usdPer100Hands(meter, hands) {
  if (!meter || !Number.isFinite(hands) || hands <= 0) return null;
  if (meter.calls === 0) return null;
  return (meter.usd / hands) * 100;
}

export function formatUsd(usd, decimals = 4) {
  if (usd === null || usd === undefined || !Number.isFinite(usd)) return '—';
  return `$${usd.toFixed(decimals)}`;
}

export const _TABLE = BASE;
