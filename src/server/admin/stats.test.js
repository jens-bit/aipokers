// src/server/admin/stats.test.js — ADMIN-1 jobs 2 and 5
//
// What the dashboard promises, asserted:
//   · every number on the page carries the definition that produced it;
//   · the numbers are the numbers (a seeded database, counted by hand);
//   · the whole payload comes back in under 200ms on a prod-sized database —
//     500 owners, 2,000 agents, 50,000 hands — because it auto-refreshes every
//     sixty seconds;
//   · the key travels in a header, never in a URL; an unset key is a 404;
//   · six a minute per key, and nothing in the logs.
//
// Spawned in a scratch cwd by runScript.js, so data/app.db is a throwaway.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;
delete process.env.GIT_SHA;
delete process.env.NOTIFY_ENABLED;
delete process.env.GUEST_ENABLED;
delete process.env.MODEL_PRICES;

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { adminStats, FALLBACK_STRATEGIES } from './stats.js';
import { installAdminRoutes } from './index.js';
import { ADMIN_HEADER, ADMIN_MAX_PER_MIN, keyMatches } from './key.js';
import { touch, _resetPresence } from './presence.js';
import {
  adminDb, bumpTick, saveProfile, saveWallet, insertGuest, markGuestClaimed, recordNotificationSent,
} from '../store.js';
import { recordModelCall, recordModelError, errorBucket, Kind } from '../meter.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Mid-hour and mid-day on purpose: a bucket boundary is where an off-by-one
// hides, so nothing here sits on one.
const NOW = Date.UTC(2026, 8, 9, 12, 30, 0);

let seq = 0;
const uid = (p) => `${p}-${++seq}`;

// ── Rule 1: nothing is a bare number ─────────────────────────────────────────

// Walks the payload and collects every leaf that should be a { value,
// definition } pair. If a future tile is added as a bare number this fails,
// which is the whole point — the rule is not enforceable by review alone.
function leaves(node, path = [], out = []) {
  for (const [key, val] of Object.entries(node)) {
    if (key === 'at' || key === 'problems') continue;
    if (val && typeof val === 'object' && 'value' in val && 'definition' in val) {
      out.push({ path: [...path, key].join('.'), ...val });
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      leaves(val, [...path, key], out);
    } else {
      out.push({ path: [...path, key].join('.'), bare: true });
    }
  }
  return out;
}

test('ADMIN-1: every number on the page carries the definition that produced it', () => {
  const found = leaves(adminStats({ now: NOW }));
  const bare = found.filter((f) => f.bare);
  assert.deepEqual(bare, [], `these came back as bare numbers: ${bare.map((b) => b.path).join(', ')}`);
  assert.ok(found.length >= 40, `expected the whole board, got ${found.length} numbers`);
  for (const f of found) {
    assert.equal(typeof f.definition, 'string', `${f.path} has no definition`);
    assert.ok(f.definition.length > 20, `${f.path}'s definition says nothing useful: "${f.definition}"`);
  }
});

test('ADMIN-1: the sections the queue asked for are all there', () => {
  const s = adminStats({ now: NOW });
  for (const section of ['owners', 'agents', 'play', 'money', 'model', 'notifications', 'system', 'retention', 'series']) {
    assert.ok(s[section], `missing section: ${section}`);
  }
  assert.ok(Array.isArray(s.problems));
});

// ── Rule 2: the numbers are the numbers ──────────────────────────────────────

test('ADMIN-1: owners, agents and money are counted off a seeded database', () => {
  const a = uid('own');
  const b = uid('own');

  saveProfile(a, { userId: a, chat: [], agents: [
    { id: `${a}-1`, name: 'One', createdAt: NOW - 2 * HOUR, pocket: { balance: 400 } },
    { id: `${a}-2`, name: 'Two', createdAt: NOW - 3 * DAY, pocket: { balance: 900 }, archived: true },
  ] });
  saveProfile(b, { userId: b, chat: [], agents: [
    { id: `${b}-1`, name: 'Solo', createdAt: NOW - 20 * DAY, pocket: { balance: 100 } },
  ] });
  saveWallet(a, { balance: 5_000, earned: 60_000, ledger: [] });   // 3 slots
  saveWallet(b, { balance: 1_000, earned: 0, ledger: [] });        // 1 slot

  const s = adminStats({ now: NOW });

  assert.ok(s.owners.total.value >= 2);
  assert.ok(s.agents.total.value >= 3);
  assert.ok(s.agents.born24h.value >= 1, 'the two-hour-old agent is a birth today');
  assert.ok(s.agents.born7d.value >= 2, 'and the three-day-old one is a birth this week');
  assert.ok(s.agents.retired.value >= 1, 'the archived one is retired');
  assert.equal(s.agents.perOwnerMax.value >= 2, true);

  assert.ok(s.money.walletChips.value >= 6_000);
  assert.ok(s.money.pocketChips.value >= 1_400);
  assert.ok(s.money.biggestPocket.value >= 900);
  assert.ok(s.money.seatsUnlocked.value >= 4, '3 slots for 60k earned plus 1 free = 4');
});

test('ADMIN-1: a fallback birth is counted, and it is a problem', () => {
  const me = uid('fb');
  saveProfile(me, { userId: me, chat: [], agents: [
    { id: `${me}-1`, name: 'The Grinder', createdAt: NOW, strategy: FALLBACK_STRATEGIES[2] },
  ] });

  const s = adminStats({ now: NOW });
  assert.ok(s.agents.fallbackBirths.value >= 1);
  assert.ok(s.problems.some((p) => /fallback birth/.test(p.text)),
    'BUG-46 shows up in the problems strip, not only in a tile');
});

test('ADMIN-1: guests are counted separately from owners', () => {
  const token = uid('tok');
  const guestOwner = `g_${uid('gst')}`;
  insertGuest({ token, ownerId: guestOwner, now: NOW });

  const claimedToken = uid('tok');
  const claimedOwner = `g_${uid('gst')}`;
  insertGuest({ token: claimedToken, ownerId: claimedOwner, now: NOW });
  markGuestClaimed(claimedToken, uid('tg'), NOW);

  _resetPresence();
  touch(guestOwner, { now: NOW });          // an unclaimed guest, active

  const s = adminStats({ now: NOW });
  assert.ok(s.owners.guestsTotal.value >= 2);
  assert.ok(s.owners.guestsClaimed.value >= 1);
  assert.ok(s.owners.guestsActive24h.value >= 2, 'insertGuest stamps last_seen_at');

  // The point of the split: an UNCLAIMED guest with a presence row must not
  // appear in the owner count.
  const activeOwners = adminDb()
    .prepare('SELECT COUNT(DISTINCT owner_id) AS n FROM owner_activity WHERE last_seen >= ?')
    .get(NOW - DAY).n;
  assert.ok(s.owners.active24h.value < activeOwners || activeOwners === 0,
    'the unclaimed guest is in owner_activity but not in owners.active24h');
});

test('ADMIN-1: play, money and model read the hourly tally, in the windows they claim', () => {
  bumpTick('hand', { count: 3, at: NOW });                 // this hour
  bumpTick('hand', { count: 5, at: NOW - 5 * HOUR });      // today
  bumpTick('hand', { count: 7, at: NOW - 3 * DAY });       // this week
  bumpTick('visit.knock', { count: 4, at: NOW - HOUR });
  bumpTick('visit.accept', { count: 1, at: NOW - HOUR });
  bumpTick('chips.won', { value: 12_500, at: NOW - 2 * HOUR });
  bumpTick('notify.budgetDrop', { count: 2, at: NOW - 2 * HOUR });

  const s = adminStats({ now: NOW });
  assert.equal(s.play.hands1h.value, 3, 'the current UTC hour, and only it');
  assert.equal(s.play.hands24h.value, 8, 'the current hour and the 23 before it');
  assert.equal(s.play.hands7d.value, 15);
  assert.equal(s.play.visitKnocks24h.value, 4);
  assert.equal(s.play.visitAccepted24h.value, 1);
  assert.equal(s.money.chipsWon24h.value, 12_500);
  assert.equal(s.notifications.refusedByBudget24h.value, 2);
});

test('ADMIN-1: a model call is on the bill and in the hour, and a 401 is key health', () => {
  recordModelCall({
    ownerId: uid('m'), kind: Kind.DECISION, model: 'claude-haiku-4-5', provider: 'anthropic',
    usage: { inputTokens: 1_000_000, outputTokens: 100_000 }, at: NOW,
  });

  const s = adminStats({ now: NOW });
  assert.ok(s.model.calls1h.value >= 1, 'meter.recordModelCall writes the hourly tick too');
  assert.ok(s.model.usd1h.value >= 1.5, 'and it carries the price pricing.js put on it');
  assert.ok(s.model.lastCallAt.value >= 1, 'key health has a timestamp to read');

  assert.equal(errorBucket({ status: 401 }), '401');
  assert.equal(errorBucket({ status: 403 }), '401', 'a 403 is the same news as a 401 — the key is wrong');
  assert.equal(errorBucket({ status: 429 }), '429');
  assert.equal(errorBucket({ status: 503 }), '5xx');
  assert.equal(errorBucket(new Error('socket hang up')), 'other');

  recordModelError({ status: 401 }, { at: NOW });
  const after401 = adminStats({ now: NOW });
  assert.equal(after401.model.errors401_24h.value, 1);
  assert.ok(after401.problems.some((p) => /Key unhealthy/.test(p.text)));
});

test('ADMIN-1: notifications are counted by type, from the ledger', () => {
  const me = uid('n');
  recordNotificationSent(me, 'session_ended', NOW - HOUR);
  recordNotificationSent(me, 'session_ended', NOW - 2 * HOUR);
  recordNotificationSent(me, 'busted', NOW - 3 * HOUR);

  const s = adminStats({ now: NOW });
  assert.ok(s.notifications.sent24h.value.session_ended >= 2);
  assert.ok(s.notifications.sent24h.value.busted >= 1);
  assert.ok(s.notifications.sentTotal24h.value >= 3);
});

test('ADMIN-1: the switches are booleans and never the values behind them', () => {
  process.env.NOTIFY_ENABLED = 'super-secret-looking-value';
  try {
    const s = adminStats({ now: NOW });
    assert.equal(s.notifications.NOTIFY_ENABLED.value, false, 'only 1 and true count as on');
    const blob = JSON.stringify(s);
    assert.equal(blob.includes('super-secret-looking-value'), false,
      'the value of an env switch must never reach the wire');
  } finally {
    delete process.env.NOTIFY_ENABLED;
  }
});

test('ADMIN-1: system knows where it is running', () => {
  const s = adminStats({ now: NOW });
  assert.equal(s.system.node.value, process.version);
  assert.ok(s.system.uptimeS.value >= 0);
  assert.ok(s.system.dbBytes.value > 0, 'the database it just read has a size');
  assert.equal(typeof s.system.bootAt.value, 'number');
});

test('ADMIN-1: the sparklines are seven zero-filled UTC days, oldest first', () => {
  const s = adminStats({ now: NOW });
  for (const [name, line] of Object.entries(s.series.value)) {
    assert.equal(line.length, 7, `${name} is not seven days`);
    assert.equal(line[6].day, '2026-09-09', `${name} does not end today`);
    assert.equal(line[0].day, '2026-09-03', `${name} does not start seven days back`);
    for (const p of line) assert.equal(typeof p.value, 'number', `${name} has a hole in it`);
  }
});

test('ADMIN-1: the cohort table is one row per day an owner drafted his first agent', () => {
  const me = uid('coh');
  const born = NOW - 6 * DAY;
  saveProfile(me, { userId: me, chat: [], agents: [{ id: `${me}-1`, name: 'C', createdAt: born }] });
  _resetPresence();
  touch(me, { now: born + DAY });          // day 2
  _resetPresence();
  touch(me, { now: born + 6 * DAY });      // day 7

  const s = adminStats({ now: NOW });
  const row = s.retention.value.find((r) => r.day === new Date(born).toISOString().slice(0, 10));
  assert.ok(row, 'his cohort day is in the table');
  assert.ok(row.owners >= 1);
  assert.ok(row.day2 >= 1, 'he came back the next day');
  assert.ok(row.day7 >= 1, 'and six days later');
  assert.ok(row.day2Share > 0 && row.day2Share <= 1);
  assert.ok(s.retention.value.length <= 14);
});

// ── Rule 2 of stats.js: it comes back in under 200ms on a prod-sized DB ──────

test('ADMIN-1: 500 owners, 2,000 agents and 50,000 hands still answer in under 200ms', () => {
  const db = adminDb();
  const OWNERS = 500;
  const AGENTS_PER = 4;
  const HANDS = 50_000;

  // Written through the raw handle rather than saveProfile: this is a fixture,
  // not a test of the accessors, and 52,000 individual transactions would make
  // the test itself the slow thing.
  const putProfile = db.prepare("INSERT OR REPLACE INTO profiles (owner_id, chat, updated_at) VALUES (?, '[]', 0)");
  const putAgent = db.prepare(`INSERT OR REPLACE INTO agents
    (owner_id, id, name, status, active_table_id, created_at, updated_at, pocket_balance, data)
    VALUES (?, ?, ?, 'idle', NULL, ?, 0, ?, ?)`);
  const putWallet = db.prepare("INSERT OR REPLACE INTO wallets (owner_id, balance, earned, fridge, ledger, updated_at) VALUES (?, ?, ?, '{}', '[]', 0)");
  const putHand = db.prepare('INSERT INTO hands (owner_id, created_at, data) VALUES (?, ?, ?)');
  const putActivity = db.prepare(`INSERT OR REPLACE INTO owner_activity (owner_id, day, first_seen, last_seen, opens)
    VALUES (?, ?, ?, ?, 3)`);
  const putTick = db.prepare(`INSERT INTO event_ticks (hour, name, count, value, updated_at) VALUES (?, ?, ?, ?, 0)
    ON CONFLICT(hour, name) DO UPDATE SET count = count + excluded.count, value = value + excluded.value`);

  db.transaction(() => {
    for (let o = 0; o < OWNERS; o++) {
      const id = `perf-${o}`;
      putProfile.run(id);
      putWallet.run(id, 1_000 + o, o * 500);
      for (let a = 0; a < AGENTS_PER; a++) {
        const agentId = `${id}-a${a}`;
        const createdAt = NOW - ((o % 14) * DAY) - a * HOUR;
        putAgent.run(id, agentId, `A${a}`, createdAt, 200 + a,
          JSON.stringify({ id: agentId, name: `A${a}`, createdAt, pocket: { balance: 200 + a }, archived: a === 3 }));
      }
      // Fourteen days of presence for every owner: the cohort join and the
      // three active counts all run over this.
      for (let d = 0; d < 14; d++) {
        const at = NOW - d * DAY;
        putActivity.run(id, new Date(at).toISOString().slice(0, 10), at, at);
      }
    }
    for (let h = 0; h < HANDS; h++) {
      putHand.run(`perf-${h % OWNERS}`, NOW - (h % (7 * 24)) * HOUR, '{"pot":120}');
    }
    // A full week of every tick the page reads — the widest event_ticks scan.
    for (let h = 0; h < 168; h++) {
      const at = NOW - h * HOUR;
      for (const name of ['hand', 'model.call', 'visit.knock', 'visit.accept', 'chips.won', 'notify.budgetDrop']) {
        putTick.run(new Date(at).toISOString().slice(0, 13), name, 40, 1.25);
      }
    }
  })();

  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM hands').get().n >= HANDS, 'the fixture is the size it claims');
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM agents').get().n >= OWNERS * AGENTS_PER);

  // Once to warm the statement cache and the page cache, the way the second
  // auto-refresh of a running server hits it — then the measurement.
  adminStats({ now: NOW });
  const started = process.hrtime.bigint();
  const s = adminStats({ now: NOW });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;

  assert.ok(s.owners.total.value >= OWNERS, 'and it actually read the fixture');
  assert.ok(ms < 200, `the whole payload took ${ms.toFixed(1)}ms — the page refreshes every 60s and must not cost the floor a hitch`);
});

// ── The key ──────────────────────────────────────────────────────────────────

function boot() {
  const app = express();
  app.use(express.json());
  installAdminRoutes(app, { now: () => NOW });
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

const started = [];
after(() => { for (const s of started) s.close(); });

async function open() {
  const { server, port } = await boot();
  started.push(server);
  return (path, headers = {}) => fetch(`http://127.0.0.1:${port}${path}`, { headers });
}

test('ADMIN-1: with no ADMIN_KEY the dashboard does not exist', async () => {
  delete process.env.ADMIN_KEY;
  const get = await open();
  const res = await get('/api/admin/stats');
  assert.equal(res.status, 404, 'a 404, not a 403 — a deployment with no dashboard does not advertise one');
});

test('ADMIN-1: the key is a header, and a key in the URL is not a key', async () => {
  process.env.ADMIN_KEY = 'the-right-key';
  try {
    const get = await open();

    assert.equal((await get('/api/admin/stats')).status, 403, 'no key');
    assert.equal((await get('/api/admin/stats?key=the-right-key')).status, 403,
      'a query parameter is not read — a URL lands in every access log there is');
    assert.equal((await get('/api/admin/stats', { [ADMIN_HEADER]: 'wrong' })).status, 403);

    const ok = await get('/api/admin/stats', { [ADMIN_HEADER]: 'the-right-key' });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'no-store', 'a dashboard must never be cached');
    const body = await ok.json();
    assert.ok(body.owners.total.definition, 'and it is the payload with the definitions on it');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: six a minute per key, then 429', async () => {
  process.env.ADMIN_KEY = 'rl-key';
  try {
    const get = await open();
    const h = { [ADMIN_HEADER]: 'rl-key' };
    for (let i = 0; i < ADMIN_MAX_PER_MIN; i++) {
      assert.equal((await get('/api/admin/stats', h)).status, 200, `request ${i + 1} should pass`);
    }
    assert.equal((await get('/api/admin/stats', h)).status, 429, 'the seventh in a minute is refused');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: a wrong key gets its own bucket and cannot exhaust the right one', async () => {
  process.env.ADMIN_KEY = 'real-key';
  try {
    const get = await open();
    for (let i = 0; i < ADMIN_MAX_PER_MIN + 4; i++) await get('/api/admin/stats', { [ADMIN_HEADER]: 'guess' });
    assert.equal((await get('/api/admin/stats', { [ADMIN_HEADER]: 'real-key' })).status, 200,
      'the limiter is keyed on what was presented, so guessing does not lock the owner out');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: the key comparison is length-safe and constant-time', () => {
  assert.equal(keyMatches('abc', 'abc'), true);
  assert.equal(keyMatches('abc', 'abcd'), false, 'a length mismatch answers false rather than throwing');
  assert.equal(keyMatches(undefined, 'abc'), false);
  assert.equal(keyMatches('abc', ''), false);
});

// ── Job 5: nothing about a request reaches the logs ──────────────────────────

test('ADMIN-1: no admin key and no owner id is written to the logs', async () => {
  process.env.ADMIN_KEY = 'log-secret-key';
  const lines = [];
  const real = { log: console.log, error: console.error, warn: console.warn };
  console.log = (...a) => lines.push(a.join(' '));
  console.error = (...a) => lines.push(a.join(' '));
  console.warn = (...a) => lines.push(a.join(' '));
  try {
    const get = await open();
    await get('/api/admin/stats', { [ADMIN_HEADER]: 'log-secret-key' });
    await get('/api/admin/stats', { [ADMIN_HEADER]: 'a-wrong-key' });

    const blob = lines.join('\n');
    assert.equal(blob.includes('log-secret-key'), false, 'the key must never be logged');
    assert.equal(blob.includes('a-wrong-key'), false, 'nor a rejected one');
    assert.equal(blob.includes('perf-1'), false, 'nor any owner id from the response');
  } finally {
    Object.assign(console, real);
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: nothing in the stats path calls a model', () => {
  // The proof is structural — stats.js imports nothing from src/agent except
  // pricing, by way of meter.js — so this asserts on the one thing a test can:
  // reading the page twice makes no model call and moves no meter.
  const before = adminStats({ now: NOW }).model.calls7d.value;
  adminStats({ now: NOW });
  assert.equal(adminStats({ now: NOW }).model.calls7d.value, before);
});
