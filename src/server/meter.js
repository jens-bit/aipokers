// src/server/meter.js — METER-1
//
// What the models cost, and whose it was.
//
// MODEL-1b made every decision carry its price (`costOf`, and the `[agent] →`
// line it prints). That answered "what did THAT call cost" in a log nobody
// reads twice. This answers the two questions somebody actually has to answer
// before the bill arrives:
//
//   · GET /api/meter               — what my agents have cost, per day.
//   · GET /api/admin/meter?key=…   — what everybody has cost, per owner and
//                                    in total, per day.
//
// Three rules the shape of this file comes from:
//
//   1. A COST IS FILED UNDER AN OWNER, ALWAYS. Every model call in this
//      product happens because somebody deployed an agent or opened a chat,
//      and the one thing a per-call log must not lose is which somebody. A
//      call with no owner behind it (a House regular filling a seat) is filed
//      under HOUSE rather than dropped — the total has to add up.
//   2. THE ROLL-UP IS THE RECORD. store.js keeps one row per (day, owner,
//      kind, model) and sums into it as calls happen. Nothing here can grow
//      without bound, and the numbers survive a restart, which the arena's
//      in-memory meter does not.
//   3. UNPRICED IS NOT FREE. pricing.js returns null for a model it has no
//      rate for, and that null is counted separately and reported. A dollar
//      figure that quietly omits a self-hosted Llama is a figure somebody
//      quotes in a meeting six months later.
//
// Recording is best-effort by construction: it is called from inside a hand,
// so it swallows its own errors. A meter that can break a table is worse than
// no meter.

import crypto from 'node:crypto';

import { costOf } from '../agent/providers/pricing.js';
import { normaliseUsage } from '../agent/providers/index.js';
import { addModelCall, readModelCalls } from './store.js';
import { telegramAuthMiddleware, isOwner } from './auth.js';

// ── Vocabulary ───────────────────────────────────────────────────────────────

// What the call was FOR. Every model call in the product is one of these five,
// and the split is the point: a bill that is 95% `decision` is a floor that is
// playing, and one that is 95% `chat` is a floor that is being built.
export const Kind = Object.freeze({
  DECISION: 'decision',   // handler.getAgentAction — the action at the felt
  TALK: 'talk',           // handler.generateAiChatLine — trash talk
  CHAT: 'chat',           // agentProfiles — the recruiter, the agent chat, the build
  MEMORY: 'memory',       // agentProfiles.runMemoryUpdate — the self-knowledge refresh
  HOME: 'home',           // homeNight — two agents talking in the flat
});

// A seat nobody owns still costs money.
export const HOUSE = 'house';

// A month is what a bill is read in.
export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 365;

/** The UTC day a call is filed under. A bill is a UTC day, not a local one. */
export function dayKey(at = Date.now()) {
  return new Date(at).toISOString().slice(0, 10);
}

/** The inclusive 'YYYY-MM-DD' lower bound for a window of `days` ending today. */
export function sinceDay(days = DEFAULT_DAYS, now = Date.now()) {
  const span = Math.max(1, Math.min(Math.floor(Number(days) || DEFAULT_DAYS), MAX_DAYS));
  return dayKey(now - (span - 1) * 24 * 60 * 60 * 1000);
}

// ── Recording ────────────────────────────────────────────────────────────────

/**
 * File one model call.
 *
 * @param {string|null} ownerId  whose agent (or whose chat) spent it; null → HOUSE
 * @param {string} kind          one of Kind
 * @param {string} model         the model id actually called
 * @param {string|null} provider which back end served it (MODEL-1)
 * @param {object} usage         { inputTokens, outputTokens, cachedInputTokens }
 * @param {number|null} costUsd  pass it when the caller already computed it
 *                               (getAgentAction does); omit and it is derived
 * @returns {boolean} whether the row landed
 */
export function recordModelCall({
  ownerId = null, kind = Kind.DECISION, model = '', provider = null,
  usage = null, costUsd = undefined, at = Date.now(),
} = {}) {
  try {
    if (!model) return false;
    const u = normaliseUsage(usage ?? {});
    const usd = costUsd === undefined ? costOf(u, model, provider) : costUsd;
    addModelCall({
      day: dayKey(at),
      ownerId: ownerId == null || ownerId === '' ? HOUSE : String(ownerId),
      kind: String(kind),
      model: String(model),
      calls: 1,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      cachedInputTokens: u.cachedInputTokens,
      // Rule 3: an unpriced call adds nothing to the dollars and one to the
      // count of calls nobody can price.
      usd: Number.isFinite(usd) ? usd : 0,
      unpriced: Number.isFinite(usd) ? 0 : 1,
    });
    return true;
  } catch (err) {
    console.error('[meter] could not record a call:', err.message);
    return false;
  }
}

/**
 * The same thing for a direct Anthropic SDK call, whose usage arrives in the
 * wire's field names. One place knows those names, so a fifth call site does
 * not have to learn them.
 */
export function recordAnthropicCall({ ownerId, kind, model, msg, at = Date.now() } = {}) {
  return recordModelCall({
    ownerId,
    kind,
    model,
    provider: 'anthropic',
    usage: {
      inputTokens: msg?.usage?.input_tokens,
      outputTokens: msg?.usage?.output_tokens,
      cachedInputTokens: msg?.usage?.cache_read_input_tokens,
    },
    at,
  });
}

// ── Reading ──────────────────────────────────────────────────────────────────

function emptyTotals() {
  return { calls: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, usd: 0, unpriced: 0 };
}

function add(into, row) {
  into.calls += row.calls;
  into.inputTokens += row.inputTokens;
  into.outputTokens += row.outputTokens;
  into.cachedInputTokens += row.cachedInputTokens;
  into.usd += row.usd;
  into.unpriced += row.unpriced;
  return into;
}

// Dollars are carried as a float all the way through SQLite; they are rounded
// once, here, on the way out. Six places is a tenth of a cent — below that the
// number is noise, above it a day of Haiku decisions would round to nothing.
const round = (usd) => Math.round(usd * 1e6) / 1e6;

function present(totals, extra = {}) {
  return { ...totals, usd: round(totals.usd), ...extra };
}

function foldByDay(rows) {
  const byDay = new Map();
  for (const row of rows) {
    if (!byDay.has(row.day)) byDay.set(row.day, { day: row.day, byKind: {}, ...emptyTotals() });
    const day = byDay.get(row.day);
    add(day, row);
    day.byKind[row.kind] = round((day.byKind[row.kind] ?? 0) + row.usd);
  }
  return [...byDay.values()].map((d) => present(d));
}

/**
 * One owner's bill: a line per day, a split by kind and by model, and the
 * totals for the window. This is what GET /api/meter answers, and it is the
 * only meter view an ordinary owner can reach.
 */
export function ownerMeter(ownerId, { days = DEFAULT_DAYS, now = Date.now() } = {}) {
  const since = sinceDay(days, now);
  const rows = readModelCalls({ sinceDay: since, ownerId: String(ownerId) });

  const totals = emptyTotals();
  const byModel = new Map();
  for (const row of rows) {
    add(totals, row);
    if (!byModel.has(row.model)) byModel.set(row.model, { model: row.model, ...emptyTotals() });
    add(byModel.get(row.model), row);
  }

  return {
    ownerId: String(ownerId),
    since,
    days: foldByDay(rows),
    models: [...byModel.values()].map((m) => present(m)).sort((a, b) => b.usd - a.usd),
    totals: present(totals),
  };
}

/**
 * The whole floor: per owner, per day, and in total. The owners are sorted by
 * spend because the only reason to open this is to find out who is expensive.
 */
export function adminMeter({ days = DEFAULT_DAYS, now = Date.now() } = {}) {
  const since = sinceDay(days, now);
  const rows = readModelCalls({ sinceDay: since });

  const totals = emptyTotals();
  const byOwner = new Map();
  const byModel = new Map();
  for (const row of rows) {
    add(totals, row);
    if (!byOwner.has(row.ownerId)) byOwner.set(row.ownerId, { ownerId: row.ownerId, byKind: {}, ...emptyTotals() });
    const owner = byOwner.get(row.ownerId);
    add(owner, row);
    owner.byKind[row.kind] = round((owner.byKind[row.kind] ?? 0) + row.usd);
    if (!byModel.has(row.model)) byModel.set(row.model, { model: row.model, ...emptyTotals() });
    add(byModel.get(row.model), row);
  }

  return {
    since,
    days: foldByDay(rows),
    owners: [...byOwner.values()].map((o) => present(o)).sort((a, b) => b.usd - a.usd),
    models: [...byModel.values()].map((m) => present(m)).sort((a, b) => b.usd - a.usd),
    totals: present(totals),
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

function daysParam(req) {
  const raw = Number(req?.query?.days);
  return Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), MAX_DAYS) : DEFAULT_DAYS;
}

// Constant-time, and length-safe: timingSafeEqual throws on a length mismatch,
// which would itself be an oracle if it were allowed to answer faster.
function keyMatches(given, expected) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(String(expected ?? ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function installMeterRoutes(app) {
  // GET /api/meter?userId=…&days=30 — the owner's own bill.
  //
  // Behind auth AND the owner check on top of it: what an owner's agents cost
  // is a fact about how much he plays, and a per-day curve of it is a fact
  // about when. Neither is anybody else's.
  app.get('/api/meter', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your meter' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(ownerMeter(userId, { days: daysParam(req) }));
  });

  // GET /api/admin/meter?key=…&days=30 — everybody's.
  //
  // The key is its own credential and not a Telegram one: this is a run-the-
  // business number, read from a terminal or a cron, and it must not require
  // being logged in as a particular player. With ADMIN_KEY unset the route
  // does not exist — a 404 rather than a 403, because a deployment that never
  // configured it should not advertise that it has one. It sits under /api,
  // so index.js's rate limiter already covers a guessing attempt.
  app.get('/api/admin/meter', (req, res) => {
    const expected = process.env.ADMIN_KEY || '';
    if (!expected) return res.status(404).json({ error: 'Not found' });
    if (!keyMatches(req.query.key, expected)) return res.status(403).json({ error: 'Forbidden' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(adminMeter({ days: daysParam(req) }));
  });
}
