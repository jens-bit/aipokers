// src/server/walletCache.test.js — MONEY-2 job 2
//
// THE SECOND CANDIDATE CAUSE, and the answer to it.
//
// ADMIN-2 found that agentProfiles.js caches owner wallets in a module-level
// Map (`wallets`, beside the agent store) and that a write made THROUGH
// store.js — around that cache — looks silently reverted until reloadOwners()
// drops the entry. If that cache also sat in the read path the safe uses, then
// Jens's "the safe did not move at all" could have been a stale read of a
// balance that had in fact been debited, and the fix would belong at the cache
// rather than anywhere near the money.
//
// So this file settles it by measurement rather than by reading the code:
//
//   1. the cache IS the read path (GET /api/wallet returns walletFor()'s
//      object) — and it is also the WRITE path for every ordinary money
//      movement, which is what makes an ordinary debit visible immediately;
//   2. the admin panel, which really does write around the cache, is visible
//      on the very next read, and its write is not undone by the next ordinary
//      save;
//   3. the hazard is real and the invalidation is what holds it off — a raw
//      store.saveWallet with no reloadOwners IS read stale, and is then
//      overwritten by the next ordinary save.
//
// (3) is deliberately written as a demonstration of the trap rather than as a
// complaint about a live path: nothing in the product writes a wallet that way.
// It is here so that anything which starts to will fail this file instead of a
// playtest.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-wcache-'));
const savedEnv = Object.fromEntries(['TELEGRAM_BOT_TOKEN', 'DEV_API_SECRET'].map(k => [k, process.env[k]]));

let store, profiles, ops, Table, server, base;
const tables = new Map();

const seedAgent = (id, balance, mode = 'allowance', cap = null) => ({
  id, name: id, status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'Play carefully.', bankroll: balance,
  pocket: { agentId: id, balance, mode, cap, realised: 0, ledger: [], recall: false },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  mood: { state: 'neutral', heat: 30 }, stats: { handsPlayed: 0, handsWon: 0 },
  sessionLog: [], ledger: [],
});

before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(scratch);
  profiles = await import('./agentProfiles.js');
  ops = await import('./admin/ops.js');
  ({ Table } = await import('./table.js'));
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  profiles.installAgentProfileRoutes(app);
  server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  store._closeForTests();
  process.chdir(originalCwd);
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
});

beforeEach(() => {
  // A table left standing from the previous case is a timer and a seat this
  // one never asked for. Fixture disposal is not a session: blank the agent
  // ids so nothing settles on the way out.
  for (const table of [...tables.values()]) {
    table.agentIds.fill(null);
    try { table.closeTable('fixture disposed'); } catch { /* already gone */ }
  }
  tables.clear();
  profiles.setLiveTableProvider(null);
});

function makeOwner(owner, balance = 0, safe = 5_000, mode = 'allowance', cap = null) {
  store.saveWallet(owner, { ownerId: owner, balance: safe, ledger: [] });
  store.saveProfile(owner, { userId: owner, chat: [], agents: [seedAgent(owner, balance, mode, cap)] });
  profiles.reloadOwners(owner);
}

function createTable(tableId, options = {}) {
  const table = new Table({ tableId, smallBlind: 10, bigBlind: 20, ...options, onEmpty: (id) => tables.delete(id) });
  table._scheduleNextHand = () => {};
  table.startSessionLoop = () => {};
  tables.set(tableId, table);
  return table;
}

function provider() {
  profiles.setLiveTableProvider({
    MAX_CONCURRENT_TABLES: 10,
    countAutonomousTables: () => 0,
    hasTable: (id) => tables.has(id),
    getTable: (id) => tables.get(id) ?? null,
    findJoinableTable: () => null,
    getOrCreateTable: createTable,
    getDefaultBlinds: () => ({ smallBlind: 10, bigBlind: 20 }),
  });
}

/** What the owner's safe view actually shows him. */
async function safeView(owner) {
  const res = await fetch(`${base}/api/wallet?userId=${encodeURIComponent(owner)}`);
  assert.equal(res.status, 200);
  return res.json();
}

async function post(url, body) {
  const res = await fetch(`${base}${url}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ── 1. the cache is the read path — and the write path ──────────────────────

test('MONEY-2: the safe view reads the cached wallet, and an ordinary move is on it at once', async () => {
  makeOwner('wc-ordinary', 0, 5_000);

  assert.equal((await safeView('wc-ordinary')).balance, 5_000);

  // "Give him chips" — the ordinary owner-facing write. It mutates the very
  // object walletFor() hands the read path, so there is no window in which the
  // two can disagree.
  const gift = await post('/api/agents/wc-ordinary/fund', {
    userId: 'wc-ordinary', verb: 'give', amount: 1_500,
  });
  assert.equal(gift.status, 200, JSON.stringify(gift.body));

  const view = await safeView('wc-ordinary');
  assert.equal(view.balance, 3_500, 'the safe moved on the very next read');
  assert.equal(store.loadWallet('wc-ordinary').balance, 3_500, 'and SQLite agrees');
  assert.equal(view.ledger[0].type, 'fund', 'with the line that explains it');
});

test('MONEY-2: an auto-refill on the way to a seat shows on the safe immediately', async () => {
  makeOwner('wc-refill', 0, 5_000, 'auto', 2_000);
  provider();

  assert.equal((await safeView('wc-refill')).balance, 5_000);

  const deploy = profiles.deployAgent('wc-refill', 'wc-refill', { body: { rung: 0 } });
  assert.equal(deploy.status, 200, JSON.stringify(deploy.body));

  const view = await safeView('wc-refill');
  assert.equal(view.balance, 3_000, 'the refill left the safe and the read says so');
  assert.equal(store.loadWallet('wc-refill').balance, 3_000, 'and SQLite agrees');
  // MONEY-1's ledger view merges the pocket's table lines into the safe's, so
  // the buy-in that followed the refill is on the same list. Asserted as a set
  // and not as an order: both entries are stamped with Date.now() and the two
  // land in the same millisecond often enough to make an order assertion a
  // coin toss (measured: 1 flip in 3 runs). The merge is what is under test.
  assert.deepEqual(new Set(view.ledger.slice(0, 2).map((e) => e.type)), new Set(['buyin', 'refill']),
    'the top of the list is the top-up and the buy-in it paid for');
});

test('MONEY-2: a refill survives a request that is refused after it', async () => {
  // He can afford the floor after a refill and still cannot afford the back
  // room, so the gate moves money and the route then refuses him anyway. The
  // transfer has to be on disk, not only in the cache.
  makeOwner('wc-durable', 0, 5_000, 'auto', 2_000);
  provider();

  const refused = await post('/api/agents/wc-durable/queue', { userId: 'wc-durable', rung: 2 });
  assert.equal(refused.status, 409, JSON.stringify(refused.body));
  assert.equal(refused.body.error, 'cantAfford');

  assert.equal(store.loadWallet('wc-durable').balance, 3_000, 'the safe paid the refill, on disk');
  assert.equal(store.loadProfile('wc-durable').agents[0].pocket.balance, 2_000, 'and the pocket holds it, on disk');
  assert.equal((await safeView('wc-durable')).balance, 3_000, 'the read agrees with the record');
});

// ── 2. the one writer that really does go round the cache ───────────────────

test('MONEY-2: an admin adjustment is on the owner\'s next safe read', async () => {
  makeOwner('wc-admin', 0, 5_000);
  assert.equal((await safeView('wc-admin')).balance, 5_000);

  const out = ops.adjustOwnerChips('wc-admin', { amount: -2_000, reason: 'MONEY-2 test' });
  assert.equal(out.ok, true);
  assert.equal(out.after, 3_000);

  assert.equal((await safeView('wc-admin')).balance, 3_000, 'the read is not stale');
});

test('MONEY-2: the next ordinary save does not undo an admin adjustment', async () => {
  makeOwner('wc-revert', 0, 5_000);
  ops.adjustOwnerChips('wc-revert', { amount: -4_000, reason: 'MONEY-2 test' });

  // Any ordinary write for this owner persists the wallet alongside the
  // profile. Before ADMIN-2's invalidation that save carried the cached 5,000
  // straight back over the 1,000 the panel had just written.
  const gift = await post('/api/agents/wc-revert/fund', {
    userId: 'wc-revert', verb: 'give', amount: 500,
  });
  assert.equal(gift.status, 200, JSON.stringify(gift.body));

  assert.equal(store.loadWallet('wc-revert').balance, 500, 'the adjustment stood, and the gift came out of it');
  assert.equal((await safeView('wc-revert')).balance, 500);
});

// ── 3. the trap itself, so that anything walking into it fails here ─────────

test('MONEY-2: a wallet written round the cache without invalidating IS read stale', async () => {
  makeOwner('wc-trap', 0, 5_000);
  assert.equal((await safeView('wc-trap')).balance, 5_000, 'the cache is warm');

  // The mistake ADMIN-2 documented, made on purpose: straight to store.js, no
  // reloadOwners. This is not a path the product takes.
  store.saveWallet('wc-trap', { ownerId: 'wc-trap', balance: 99, ledger: [] });

  assert.equal(store.loadWallet('wc-trap').balance, 99, 'SQLite has the new number');
  assert.equal((await safeView('wc-trap')).balance, 5_000,
    'and the owner is still being shown the old one — this is the failure mode');

  profiles.reloadOwners('wc-trap');
  assert.equal((await safeView('wc-trap')).balance, 99, 'invalidation is the whole of the fix');
});
