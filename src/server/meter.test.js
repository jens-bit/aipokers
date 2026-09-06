// src/server/meter.test.js — METER-1
//
// The meter's three promises: a call is filed under an owner and priced the
// way MODEL-1b prices it, an owner can read his own bill and nobody else's,
// and the admin view does not exist until somebody configures a key.
//
// The store is the REAL SQLite store — this file is spawned in a scratch cwd
// by src/test/helpers/runScript.js, so data/app.db is a throwaway and the
// model_calls table is under test too. The clock is injected; nothing here
// waits on wall-clock time.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;
delete process.env.MODEL_PRICES;
delete process.env.MODEL_PRICE_DEFAULT;

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import {
  recordModelCall, recordAnthropicCall, recordDecisionRoute, foldRoutes,
  ownerMeter, adminMeter,
  installMeterRoutes, dayKey, sinceDay, Kind, HOUSE, DEFAULT_DAYS,
} from './meter.js';

// September 2026, and a day is 24h before it.
const DAY = 24 * 60 * 60 * 1000;
const TODAY = Date.UTC(2026, 8, 6, 12, 0, 0);

// Haiku 4.5 is $1.00/1M in, $5.00/1M out (pricing.js), and a cached input
// token is a tenth of a fresh one.
const usage = (i, o, cached = 0) => ({ inputTokens: i, outputTokens: o, cachedInputTokens: cached });

// Every test owns its own owner id so the shared database stays shared without
// the suites having to run in order.
let seq = 0;
const owner = () => `owner-${++seq}`;

// ── Recording ────────────────────────────────────────────────────────────────

test('METER-1: a decision is filed under its owner and priced like MODEL-1b prices it', () => {
  const me = owner();
  assert.equal(recordModelCall({
    ownerId: me, kind: Kind.DECISION, model: 'claude-haiku-4-5', provider: 'anthropic',
    usage: usage(1_000_000, 100_000), at: TODAY,
  }), true);

  const bill = ownerMeter(me, { now: TODAY });
  assert.equal(bill.totals.calls, 1);
  assert.equal(bill.totals.inputTokens, 1_000_000);
  // $1.00 of input + $0.50 of output.
  assert.equal(bill.totals.usd, 1.5);
  assert.equal(bill.totals.unpriced, 0);
  assert.deepEqual(bill.days.map((d) => d.day), [dayKey(TODAY)]);
  assert.equal(bill.days[0].byKind.decision, 1.5, 'and the day says what it was spent on');
  assert.deepEqual(bill.models.map((m) => m.model), ['claude-haiku-4-5']);
});

test('METER-1: a cached input token is charged at a tenth, same as the arena counts it', () => {
  const me = owner();
  recordModelCall({
    ownerId: me, kind: Kind.DECISION, model: 'claude-haiku-4-5', provider: 'anthropic',
    usage: usage(1_000_000, 0, 1_000_000), at: TODAY,
  });
  assert.equal(ownerMeter(me, { now: TODAY }).totals.usd, 0.1);
});

test('METER-1: an unpriced model is counted, not guessed at — it adds calls, not dollars', () => {
  const me = owner();
  recordModelCall({
    ownerId: me, kind: Kind.DECISION, model: 'some-selfhosted-llama', provider: 'openai-compatible',
    usage: usage(500, 500), at: TODAY,
  });
  const bill = ownerMeter(me, { now: TODAY });
  assert.equal(bill.totals.calls, 1);
  assert.equal(bill.totals.usd, 0, 'we do not know and we do not invent');
  assert.equal(bill.totals.unpriced, 1, 'and the total says how much of it it cannot price');
});

test('METER-1: a caller that already priced the call is believed', () => {
  const me = owner();
  recordModelCall({
    ownerId: me, kind: Kind.DECISION, model: 'claude-haiku-4-5', provider: 'anthropic',
    usage: usage(10, 10), costUsd: 0.25, at: TODAY,
  });
  assert.equal(ownerMeter(me, { now: TODAY }).totals.usd, 0.25);
});

test('METER-1: a seat nobody owns is filed under the house, never dropped', () => {
  recordModelCall({
    ownerId: null, kind: Kind.DECISION, model: 'claude-haiku-4-5',
    provider: 'anthropic', usage: usage(1_000_000, 0), at: TODAY,
  });
  const all = adminMeter({ now: TODAY });
  const house = all.owners.find((o) => o.ownerId === HOUSE);
  assert.ok(house, 'the house has a line of its own');
  assert.ok(house.calls >= 1);
  assert.ok(all.totals.calls >= house.calls, 'and it is inside the total');
});

test('METER-1: the Anthropic wire\'s own field names are understood in exactly one place', () => {
  const me = owner();
  recordAnthropicCall({
    ownerId: me, kind: Kind.CHAT, model: 'claude-haiku-4-5',
    msg: { usage: { input_tokens: 2_000_000, output_tokens: 0, cache_read_input_tokens: 0 } },
    at: TODAY,
  });
  assert.equal(ownerMeter(me, { now: TODAY }).totals.usd, 2);
});

test('METER-1: recording never throws into the hand that was making the call', () => {
  assert.equal(recordModelCall({ ownerId: 'x', model: '' }), false, 'a call with no model is not a call');
  assert.doesNotThrow(() => recordModelCall(undefined));
  assert.doesNotThrow(() => recordModelCall({ ownerId: 'x', model: 'claude-haiku-4-5', usage: null }));
});

// ── Slicing ──────────────────────────────────────────────────────────────────

// ── COST-1 · where the decisions went ────────────────────────────────────────

test('COST-1: a decision that cost nothing is still filed — that is the point', () => {
  const me = owner();
  recordDecisionRoute({ ownerId: me, route: 'policy', reason: 'clear', at: TODAY });
  recordDecisionRoute({ ownerId: me, route: 'policy', reason: 'clear', at: TODAY });
  recordDecisionRoute({ ownerId: me, route: 'model', reason: 'river', at: TODAY });

  const bill = ownerMeter(me, { now: TODAY });
  assert.equal(bill.routes.decisions, 3);
  assert.equal(bill.routes.policy, 2);
  assert.equal(bill.routes.model, 1);
  assert.equal(bill.routes.policyShare, 0.667);
  assert.deepEqual(bill.routes.byReason, { clear: 2, river: 1 });
  // And none of it touched the dollars: a route is not a call.
  assert.equal(bill.totals.calls, 0);
  assert.equal(bill.totals.usd, 0);
});

test('COST-1: a routed decision with no owner behind it is the house, not a hole', () => {
  recordDecisionRoute({ ownerId: null, route: 'policy', reason: 'clear', at: TODAY });
  const floor = adminMeter({ now: TODAY });
  assert.ok(floor.routes.decisions > 0);
  const house = ownerMeter(HOUSE, { now: TODAY });
  assert.ok(house.routes.decisions > 0);
});

test('COST-1: a route with nothing to say is rejected rather than filed as blank', () => {
  assert.equal(recordDecisionRoute({ ownerId: owner(), route: '', reason: 'clear' }), false);
  assert.equal(recordDecisionRoute({ ownerId: owner(), route: 'policy', reason: '' }), false);
  assert.equal(recordDecisionRoute({}), false);
});

test('COST-1: an owner who has played nothing has no share rather than a zero', () => {
  const empty = foldRoutes([]);
  assert.equal(empty.decisions, 0);
  assert.equal(empty.policyShare, null, 'nothing divided by nothing is not 0%');
  assert.equal(ownerMeter(owner(), { now: TODAY }).routes.policyShare, null);
});

test('COST-1: a route from yesterday is outside a one-day window, same as a call', () => {
  const me = owner();
  recordDecisionRoute({ ownerId: me, route: 'policy', reason: 'clear', at: TODAY - DAY });
  recordDecisionRoute({ ownerId: me, route: 'model', reason: 'heat', at: TODAY });
  assert.equal(ownerMeter(me, { days: 1, now: TODAY }).routes.decisions, 1);
  assert.equal(ownerMeter(me, { days: 2, now: TODAY }).routes.decisions, 2);
});

test('METER-1: a day is a day, and the window only reaches back as far as it is asked to', () => {
  const me = owner();
  const spend = (at, kind) => recordModelCall({
    ownerId: me, kind, model: 'claude-haiku-4-5', provider: 'anthropic',
    usage: usage(1_000_000, 0), at,
  });
  spend(TODAY, Kind.DECISION);
  spend(TODAY, Kind.TALK);
  spend(TODAY - DAY, Kind.DECISION);
  spend(TODAY - 5 * DAY, Kind.DECISION);

  const week = ownerMeter(me, { days: 7, now: TODAY });
  assert.deepEqual(week.days.map((d) => d.day),
    [dayKey(TODAY - 5 * DAY), dayKey(TODAY - DAY), dayKey(TODAY)],
    'oldest day first, and only the days that had calls');
  assert.equal(week.days[2].calls, 2, 'two calls today');
  assert.deepEqual(Object.keys(week.days[2].byKind).sort(), ['decision', 'talk']);
  assert.equal(week.totals.calls, 4);

  const twoDays = ownerMeter(me, { days: 2, now: TODAY });
  assert.equal(twoDays.totals.calls, 3, 'today and yesterday, inclusive');
  assert.equal(twoDays.since, dayKey(TODAY - DAY));
  assert.equal(sinceDay(1, TODAY), dayKey(TODAY), 'a one-day window is today');
});

test('METER-1: the admin view is per owner AND total, biggest spender first', () => {
  const big = owner();
  const small = owner();
  recordModelCall({ ownerId: big, kind: Kind.DECISION, model: 'claude-opus-5', provider: 'anthropic', usage: usage(1_000_000, 0), at: TODAY });
  recordModelCall({ ownerId: small, kind: Kind.CHAT, model: 'claude-haiku-4-5', provider: 'anthropic', usage: usage(1_000_000, 0), at: TODAY });

  const all = adminMeter({ now: TODAY });
  const bigRow = all.owners.find((o) => o.ownerId === big);
  const smallRow = all.owners.find((o) => o.ownerId === small);
  assert.equal(bigRow.usd, 5, 'Opus is $5.00/1M in');
  assert.equal(smallRow.usd, 1);
  assert.ok(all.owners.indexOf(bigRow) < all.owners.indexOf(smallRow), 'sorted by spend');
  assert.ok(all.models.some((m) => m.model === 'claude-opus-5'),
    'and the model split is there, which is the MODEL-1 tiers question read off production');
  assert.ok(all.totals.usd >= 6);
});

// ── The routes ───────────────────────────────────────────────────────────────

function serve() {
  const app = express();
  app.use(express.json());
  installMeterRoutes(app);
  const server = http.createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

let live = null;
const get = async (path) => {
  if (!live) live = await serve();
  const res = await fetch(`http://127.0.0.1:${live.port}${path}`);
  return { status: res.status, body: await res.json().catch(() => null) };
};

after(() => {
  live?.server.close();
  delete process.env.ADMIN_KEY;
});

test('METER-1: GET /api/meter answers the caller his own bill', async () => {
  const me = owner();
  recordModelCall({ ownerId: me, kind: Kind.DECISION, model: 'claude-haiku-4-5', provider: 'anthropic', usage: usage(1_000_000, 0), at: Date.now() });

  const res = await get(`/api/meter?userId=${me}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.ownerId, me);
  assert.equal(res.body.totals.usd, 1);
  assert.equal(res.body.since, sinceDay(DEFAULT_DAYS));

  // Somebody else's meter is empty rather than forbidden here, because with no
  // bot token configured (local dev) isOwner() is true for everyone — the same
  // rule every other owner-gated route in this server runs under. What matters
  // is that the route reads the id it was given and nothing wider.
  const other = await get('/api/meter?userId=somebody-else');
  assert.equal(other.body.totals.calls, 0);
});

test('METER-1: the admin meter does not exist until a key is configured', async () => {
  delete process.env.ADMIN_KEY;
  const missing = await get('/api/admin/meter');
  assert.equal(missing.status, 404, 'a deployment with no key should not advertise that it has one');

  process.env.ADMIN_KEY = 'correct-horse-battery-staple';
  assert.equal((await get('/api/admin/meter')).status, 403, 'no key');
  assert.equal((await get('/api/admin/meter?key=wrong')).status, 403, 'wrong key, wrong length');
  assert.equal((await get('/api/admin/meter?key=correct-horse-battery-stapl3')).status, 403, 'wrong key, right length');

  const ok = await get('/api/admin/meter?key=correct-horse-battery-staple&days=7');
  assert.equal(ok.status, 200);
  assert.ok(Array.isArray(ok.body.owners) && ok.body.owners.length > 0);
  assert.ok(Array.isArray(ok.body.days));
  assert.ok(ok.body.totals.calls > 0);
  assert.equal(ok.body.since, sinceDay(7));
});
