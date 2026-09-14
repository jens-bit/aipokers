// src/server/admin/writeGuard.test.js — ADMIN-2
//
// The write guard's own three differences from key.js's read guard: its own
// tighter rate window, keyed per client rather than per presented key, and
// 401 rather than 403 on a wrong key. Everything key.js already covers
// (unset means 404, no log line) is that file's own test, not repeated here.

delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { installAdminRoutes } from './index.js';
import { ADMIN_HEADER } from './key.js';
import { ADMIN_WRITE_MAX_PER_MIN } from './writeGuard.js';

const started = [];
after(() => { for (const s of started) s.close(); });

async function open() {
  const app = express();
  app.use(express.json());
  installAdminRoutes(app);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  started.push(server);
  const port = server.address().port;
  return (path, opts = {}) => fetch(`http://127.0.0.1:${port}${path}`, opts);
}

test('ADMIN-2: with no ADMIN_KEY the write route does not exist', async () => {
  const post = await open();
  const res = await post('/api/admin/owners/anyone/reset', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: true }),
  });
  assert.equal(res.status, 404);
});

test('ADMIN-2: a wrong key on a write route is 401, not the read guard\'s 403', async () => {
  process.env.ADMIN_KEY = 'write-guard-key';
  try {
    const post = await open();
    const res = await post('/api/admin/owners/anyone/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [ADMIN_HEADER]: 'not-the-key' },
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(res.status, 401);
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-2: the write window is tighter than and separate from the read window', async () => {
  process.env.ADMIN_KEY = 'write-window-key';
  try {
    const call = await open();
    const h = { 'Content-Type': 'application/json', [ADMIN_HEADER]: 'write-window-key' };

    // Same client (no X-Forwarded-For -> the loopback address every request
    // here shares), so this is one bucket. ADMIN_WRITE_MAX_PER_MIN writes
    // succeed or refuse for a REASON OTHER than the rate limit (a missing
    // owner is 404, not 429); the next one must be 429.
    let sawNonRate = 0;
    for (let i = 0; i < ADMIN_WRITE_MAX_PER_MIN; i++) {
      const res = await call(`/api/admin/owners/nobody-${i}/reset`, { method: 'POST', headers: h, body: JSON.stringify({ confirm: true }) });
      assert.notEqual(res.status, 429, `write ${i} must not be rate limited yet`);
      sawNonRate++;
    }
    assert.equal(sawNonRate, ADMIN_WRITE_MAX_PER_MIN);
    const over = await call('/api/admin/owners/one-more/reset', { method: 'POST', headers: h, body: JSON.stringify({ confirm: true }) });
    assert.equal(over.status, 429, 'one past the write budget is refused');

    // The READ budget (6/min, key.js's own) must be untouched by the writes
    // above — a burst of writes must not spend the page's own budget.
    const read = await call('/api/admin/owners', { headers: h });
    assert.notEqual(read.status, 429, 'the read window has its own, unspent budget');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-2: the write budget is per CLIENT, not shared by everyone presenting the one key', async () => {
  process.env.ADMIN_KEY = 'shared-write-key';
  try {
    const call = await open();
    const h = (ip) => ({ 'Content-Type': 'application/json', [ADMIN_HEADER]: 'shared-write-key', 'x-forwarded-for': ip });

    for (let i = 0; i < ADMIN_WRITE_MAX_PER_MIN; i++) {
      const res = await call('/api/admin/owners/client-a-target/reset', { method: 'POST', headers: h('9.9.9.1'), body: JSON.stringify({ confirm: true }) });
      assert.notEqual(res.status, 429);
    }
    const exhausted = await call('/api/admin/owners/client-a-target/reset', { method: 'POST', headers: h('9.9.9.1'), body: JSON.stringify({ confirm: true }) });
    assert.equal(exhausted.status, 429, 'client A is now over its own budget');

    // A different client, same shared key, is a different bucket.
    const other = await call('/api/admin/owners/client-b-target/reset', { method: 'POST', headers: h('9.9.9.2'), body: JSON.stringify({ confirm: true }) });
    assert.notEqual(other.status, 429, 'client B has not touched client A\'s budget');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});
