// src/server/admin/cost.test.js — ADMIN-1 job 5
//
// What the dashboard costs to look at.
//
// A monitoring surface that is expensive is a monitoring surface nobody opens
// during the incident it was built for, so the three prices are pinned here
// rather than left to be true by accident:
//
//   1. IT NEVER CALLS A MODEL. Not once, not for a summary, not for a
//      "what does this mean". Asserted twice — structurally, that nothing
//      under src/server/admin/ so much as names a model entry point, and
//      behaviourally, that loading the whole page moves neither the meter nor
//      the model tick.
//   2. SIX A MINUTE PER KEY, PER ENDPOINT. Ten times what the page needs (it
//      refreshes once a minute) and a hard ceiling on how fast a wrong key can
//      be guessed. Each endpoint has its own window, so one page load costs one
//      request from each of three budgets rather than three from one.
//   3. NOTHING IS LOGGED. Not the key, not a rejected key, not an owner id, not
//      a request line. Asserted as "the admin path writes NO log line at all",
//      which is the only version of this rule that cannot rot — a check for
//      one particular secret passes the day somebody logs a different one.
//
// stats.test.js covers the key check itself. This file is about the price.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { installAdminRoutes } from './index.js';
import { ADMIN_HEADER, ADMIN_MAX_PER_MIN } from './key.js';
import { adminStats } from './stats.js';
import { saveProfile, adminDb } from '../store.js';
import { adminMeter } from '../meter.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NOW = Date.UTC(2026, 8, 9, 12, 30, 0);
const ENDPOINTS = ['/api/admin/stats', '/api/admin/owners', '/api/admin/agents/recent'];

const started = [];
after(() => { for (const s of started) s.close(); });

async function open() {
  const app = express();
  app.use(express.json());
  installAdminRoutes(app, { now: () => NOW });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  started.push(server);
  const port = server.address().port;
  return (p, headers = {}) => fetch(`http://127.0.0.1:${port}${p}`, { headers });
}

// Every non-test module the dashboard is made of.
function adminSources() {
  return fs.readdirSync(HERE)
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
    .map((f) => ({ file: f, src: fs.readFileSync(path.join(HERE, f), 'utf8') }));
}

// ── 1. It never calls a model ────────────────────────────────────────────────

test('ADMIN-1: nothing under src/server/admin/ names a model entry point', () => {
  // The four doors to a paid call in this codebase. A dashboard that grows one
  // of these later should have to delete this test on purpose.
  const doors = [
    /\bgetAgentAction\b/,
    /\bcallClaude\b/,
    /\bmessages\.create\b/,
    /\bcomplete\s*\(\s*\{/,
  ];
  for (const { file, src } of adminSources()) {
    // The header comments explain the rule; the code must not break it. Strip
    // line comments so the prose above a function cannot fail its own file.
    const code = src.replace(/^\s*\/\/.*$/gm, '');
    for (const door of doors) {
      assert.equal(door.test(code), false, `${file} reaches for a model (${door})`);
    }
  }
});

test('ADMIN-1: the dashboard imports nothing out of src/agent', () => {
  for (const { file, src } of adminSources()) {
    const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const spec of imports) {
      assert.equal(/agent\//.test(spec), false,
        `${file} imports ${spec} — the model layer must only ever be reached through meter.js, and only for prices`);
    }
  }
});

test('ADMIN-1: loading the whole page moves neither the meter nor the model tick', async () => {
  process.env.ADMIN_KEY = 'cost-key';
  try {
    const get = await open();
    const h = { [ADMIN_HEADER]: 'cost-key' };

    const before = {
      calls: adminMeter({ days: 7, now: NOW }).totals.calls,
      usd: adminMeter({ days: 7, now: NOW }).totals.usd,
      ticks: adminDb().prepare("SELECT COALESCE(SUM(count), 0) AS n FROM event_ticks WHERE name = 'model.call'").get().n,
    };

    // A page load is these three, and the page itself.
    for (const url of ENDPOINTS) assert.equal((await get(url, h)).status, 200);
    assert.equal((await get('/admin')).status, 200);

    const after_ = {
      calls: adminMeter({ days: 7, now: NOW }).totals.calls,
      usd: adminMeter({ days: 7, now: NOW }).totals.usd,
      ticks: adminDb().prepare("SELECT COALESCE(SUM(count), 0) AS n FROM event_ticks WHERE name = 'model.call'").get().n,
    };

    assert.deepEqual(after_, before, 'opening the dashboard cost nothing');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: reading the stats writes nothing at all', () => {
  const db = adminDb();
  const counts = () => ({
    activity: db.prepare('SELECT COUNT(*) AS n FROM owner_activity').get().n,
    ticks: db.prepare('SELECT COUNT(*) AS n FROM event_ticks').get().n,
    calls: db.prepare('SELECT COUNT(*) AS n FROM model_calls').get().n,
    agents: db.prepare('SELECT COUNT(*) AS n FROM agents').get().n,
  });

  saveProfile('cost-owner', { userId: 'cost-owner', chat: [], agents: [{ id: 'cost-a', name: 'A', createdAt: NOW }] });
  const before = counts();
  adminStats({ now: NOW });
  adminStats({ now: NOW });
  assert.deepEqual(counts(), before, 'the dashboard reads, and that is all it does');
});

// ── 2. Six a minute per key, per endpoint ────────────────────────────────────

test('ADMIN-1: each endpoint carries its own 6-a-minute window', async () => {
  process.env.ADMIN_KEY = 'window-key';
  try {
    const get = await open();
    const h = { [ADMIN_HEADER]: 'window-key' };

    for (const url of ENDPOINTS) {
      for (let i = 0; i < ADMIN_MAX_PER_MIN; i++) {
        assert.equal((await get(url, h)).status, 200, `${url} refused request ${i + 1} of six`);
      }
      assert.equal((await get(url, h)).status, 429, `${url} allowed a seventh in the same minute`);
    }
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: a page load costs one request from each budget, not three from one', async () => {
  process.env.ADMIN_KEY = 'page-budget';
  try {
    const get = await open();
    const h = { [ADMIN_HEADER]: 'page-budget' };

    // The page refreshes every 60s; six loads inside one window is a minute of
    // auto-refresh plus five impatient hand-refreshes, and all of it must pass.
    for (let load = 0; load < ADMIN_MAX_PER_MIN; load++) {
      for (const url of ENDPOINTS) {
        assert.equal((await get(url, h)).status, 200, `load ${load + 1} was refused at ${url}`);
      }
    }
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: the page itself is not rate limited — only the data behind it', async () => {
  process.env.ADMIN_KEY = 'page-only';
  try {
    const get = await open();
    for (let i = 0; i < ADMIN_MAX_PER_MIN + 6; i++) {
      assert.equal((await get('/admin')).status, 200,
        'a static login form has no key to count and nothing to spend');
    }
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

// ── 3. Nothing is logged ─────────────────────────────────────────────────────

function captureLogs(fn) {
  const lines = [];
  const real = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  const sink = (...a) => lines.push(a.map(String).join(' '));
  console.log = sink; console.error = sink; console.warn = sink; console.info = sink;
  return Promise.resolve()
    .then(fn)
    .finally(() => { Object.assign(console, real); })
    .then(() => lines);
}

test('ADMIN-1: the admin path writes no log line at all', async () => {
  process.env.ADMIN_KEY = 'quiet-key';
  try {
    const get = await open();
    const lines = await captureLogs(async () => {
      for (const url of ENDPOINTS) await get(url, { [ADMIN_HEADER]: 'quiet-key' });
      await get('/admin');
      // The rejected paths too: a wrong key, a missing key, and a 429.
      await get('/api/admin/stats');
      await get('/api/admin/stats', { [ADMIN_HEADER]: 'a-guessed-key' });
      for (let i = 0; i < ADMIN_MAX_PER_MIN + 2; i++) await get('/api/admin/owners', { [ADMIN_HEADER]: 'quiet-key' });
    });

    assert.deepEqual(lines, [],
      `the admin path must be silent — a check for one particular secret passes the day somebody logs a different one. Got:\n${lines.join('\n')}`);
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: presence records an owner without ever naming him in a log', async () => {
  const owner = 'presence-should-not-be-logged-9911';
  const lines = await captureLogs(async () => {
    const get = await open();
    // No admin key needed: presence rides every request, and this is the one
    // write the dashboard adds to the product.
    await get(`/api/admin/stats?userId=${owner}`);
  });

  assert.equal(lines.join('\n').includes(owner), false, 'an owner id must not reach the logs');
});

test('ADMIN-1: the key is not echoed back in any response body either', async () => {
  process.env.ADMIN_KEY = 'echo-key';
  try {
    const get = await open();
    for (const key of ['echo-key', 'wrong-key']) {
      for (const url of [...ENDPOINTS, '/admin']) {
        const body = await (await get(url, { [ADMIN_HEADER]: key })).text();
        assert.equal(body.includes(key), false, `${url} echoed the presented key back`);
      }
    }
  } finally {
    delete process.env.ADMIN_KEY;
  }
});
