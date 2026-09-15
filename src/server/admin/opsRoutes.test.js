// src/server/admin/opsRoutes.test.js — ADMIN-2
//
// The wire: every write endpoint refuses correctly (404 unset, 401 wrong
// key, 400 missing confirm on a destructive action), a real write succeeds
// and leaves an audit-log line behind with the before/after values, and no
// route accepts more than one owner or one agent — every path names exactly
// one of each, and nothing here is a batch.

delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;

import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { installAdminRoutes } from './index.js';
import { ADMIN_HEADER } from './key.js';
import { saveProfile, saveWallet, _closeForTests } from '../store.js';
import { reloadOwners, setLiveTableProvider } from '../agentProfiles.js';

// audit.js and the wallet/agent stores below all resolve from process.cwd()
// — a scratch one, so this suite's writes never touch a real data/ folder.
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-opsroutes-'));
const originalCwd = process.cwd();
before(() => process.chdir(scratch));
after(() => { process.chdir(originalCwd); setLiveTableProvider(null); _closeForTests(); });

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
  return (p, opts = {}) => fetch(`http://127.0.0.1:${port}${p}`, opts);
}

let seq = 0;
function fixture() {
  const owner = `route-${++seq}`;
  const agentId = `${owner}-agent`;
  saveProfile(owner, {
    userId: owner, chat: [], agents: [{
      id: agentId, name: 'Granite', status: 'idle', activeTableId: null,
      fatigue: 'fresh', mood: { state: 'neutral', heat: 20 },
      pocket: { balance: 2000, mode: 'auto', cap: 2000, ledger: [] }, bankroll: 2000,
    }],
  });
  saveWallet(owner, { balance: 3000, earned: 0, ledger: [] });
  reloadOwners(owner);
  return { owner, agentId };
}

const jsonHeaders = (key) => ({ 'Content-Type': 'application/json', [ADMIN_HEADER]: key });

// Every write route this job adds, with a body that is well-formed for that
// route (so the guard test below is only ever refused by the GUARD, never
// by a 400 that would look like the same thing).
function writeRoutes({ owner, agentId }) {
  return [
    ['POST', `/api/admin/owners/${owner}/adjust`, { amount: 10, reason: 'x', confirm: true }],
    ['POST', `/api/admin/owners/${owner}/reset`, { confirm: true }],
    ['POST', `/api/admin/owners/${owner}/agents/${agentId}/rename`, { name: 'X' }],
    ['POST', `/api/admin/owners/${owner}/agents/${agentId}/retire`, { confirm: true }],
    ['POST', `/api/admin/owners/${owner}/agents/${agentId}/unretire`, {}],
    ['POST', `/api/admin/owners/${owner}/agents/${agentId}/unseat`, { confirm: true }],
    ['POST', `/api/admin/owners/${owner}/agents/${agentId}/force-state`, { fatigue: 'settled' }],
  ];
}

// ── The guard, on every route ────────────────────────────────────────────────

test('ADMIN-2: every write endpoint 404s when ADMIN_KEY is unset', async () => {
  const call = await open();
  for (const [method, url, body] of writeRoutes(fixture())) {
    const res = await call(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(res.status, 404, `${method} ${url}`);
  }
});

test('ADMIN-2: every write endpoint 401s with a wrong key', async () => {
  process.env.ADMIN_KEY = 'the-real-key';
  try {
    const call = await open();
    for (const [method, url, body] of writeRoutes(fixture())) {
      const res = await call(url, { method, headers: jsonHeaders('the-wrong-key'), body: JSON.stringify(body) });
      assert.equal(res.status, 401, `${method} ${url}`);
    }
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

// ── Confirm is mandatory on the destructive actions ─────────────────────────

test('ADMIN-2: reset, retire, unseat and a negative adjustment all refuse without confirm', async () => {
  process.env.ADMIN_KEY = 'confirm-key';
  try {
    const call = await open();
    const h = jsonHeaders('confirm-key');
    const { owner, agentId } = fixture();

    const cases = [
      ['POST', `/api/admin/owners/${owner}/reset`, {}],
      ['POST', `/api/admin/owners/${owner}/adjust`, { amount: -50, reason: 'x' }],
      ['POST', `/api/admin/owners/${owner}/agents/${agentId}/retire`, {}],
      ['POST', `/api/admin/owners/${owner}/agents/${agentId}/unseat`, {}],
    ];
    for (const [method, url, body] of cases) {
      const res = await call(url, { method, headers: h, body: JSON.stringify(body) });
      assert.equal(res.status, 400, `${method} ${url} without confirm`);
    }

    // A POSITIVE adjustment needs no confirm.
    const credit = await call(`/api/admin/owners/${owner}/adjust`, { method: 'POST', headers: h, body: JSON.stringify({ amount: 50, reason: 'x' }) });
    assert.equal(credit.status, 200);
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

// ── A real write, end to end, with its audit line ───────────────────────────

test('ADMIN-2: a successful adjust returns before/after and appends an audit entry the panel can read', async () => {
  process.env.ADMIN_KEY = 'audit-key';
  try {
    const call = await open();
    const h = jsonHeaders('audit-key');
    const { owner } = fixture();

    const res = await call(`/api/admin/owners/${owner}/adjust`, {
      method: 'POST', headers: h, body: JSON.stringify({ amount: 500, reason: 'a real reason', confirm: true }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.before, 3000);
    assert.equal(body.after, 3500);

    const audit = await (await call('/api/admin/audit', { headers: h })).json();
    const entry = audit.rows.find((r) => r.target === owner && r.action === 'owner.adjust');
    assert.ok(entry, 'the write left an audit line');
    assert.equal(entry.reason, 'a real reason');
    assert.equal(entry.before, 3000);
    assert.equal(entry.after, 3500);
    assert.equal(JSON.stringify(entry).includes('audit-key'), false, 'the raw key never appears in the log');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-2: a refused write (bad amount) leaves no audit line', async () => {
  process.env.ADMIN_KEY = 'no-audit-key';
  try {
    const call = await open();
    const h = jsonHeaders('no-audit-key');
    const { owner } = fixture();

    const before = (await (await call('/api/admin/audit', { headers: h })).json()).total;
    const res = await call(`/api/admin/owners/${owner}/adjust`, {
      method: 'POST', headers: h, body: JSON.stringify({ amount: 0, reason: 'x', confirm: true }),
    });
    assert.equal(res.status, 400);
    const after = (await (await call('/api/admin/audit', { headers: h })).json()).total;
    assert.equal(after, before, 'nothing changed, so nothing was audited');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-2: the owner ledger route is a read — the read guard\'s 403, not the write guard\'s 401', async () => {
  process.env.ADMIN_KEY = 'ledger-key';
  try {
    const call = await open();
    const { owner } = fixture();
    const res = await call(`/api/admin/owners/${owner}/ledger`, { headers: { [ADMIN_HEADER]: 'wrong' } });
    assert.equal(res.status, 403);
  } finally {
    delete process.env.ADMIN_KEY;
  }
});
