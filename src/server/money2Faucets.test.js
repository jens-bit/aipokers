// src/server/money2Faucets.test.js — MONEY-2 job 1
//
// THE THIRD FAUCET.
//
// MONEY-1 found two crossings between the owner economy and a felt — deploy's
// chargeSeatBuyIn and session end's payout — closed them both against the house
// bank, and wrote the law down in chipConservation.test.js:
//
//     SUM(safes) + SUM(pockets) + houseBank  never changes.
//
// It missed the doors that do not go through deploy. This file covers every
// remaining path that can put chips in front of an agent, or into his pocket,
// while his owner's safe stays where it is, and holds each of them to that law
// plus the product rule MONEY-2 states:
//
//     An agent whose owner has an empty safe must actually run out and leave
//     the table, never be silently funded, and the owner must be able to see
//     why.
//
// No model calls and no sockets. Real Tables with the deal scheduler stopped,
// so hands happen exactly when this file says they do.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-money2-'));
const savedEnv = Object.fromEntries(['TELEGRAM_BOT_TOKEN', 'DEV_API_SECRET'].map(k => [k, process.env[k]]));

let store, profiles, bank, Table, audit, server, base;
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
  bank = await import('./houseBank.js');
  profiles = await import('./agentProfiles.js');
  ({ Table } = await import('./table.js'));
  audit = await import('../../scripts/audit-chips.js');
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
  for (const table of [...tables.values()]) {
    // Fixture disposal is not a session: blank the agent ids so nothing settles.
    table.agentIds.fill(null);
    try { table.closeTable('fixture disposed'); } catch { /* already gone */ }
  }
  tables.clear();
  profiles.setLiveTableProvider(null);
});

// ── the measurement ─────────────────────────────────────────────────────────

/** Every chip in the world, read back out of SQLite. */
function total() {
  const owners = store.listOwners().map((ownerId) => ({
    ownerId,
    wallet: store.loadWallet(ownerId) ?? { balance: 0, ledger: [] },
    agents: store.loadProfile(ownerId)?.agents ?? [],
  }));
  return audit.auditChips(owners, { houseBank: bank.balance() }).totals.chipsInExistence;
}

function conserves(label, fn) {
  const before = total();
  const out = fn();
  const after = total();
  assert.equal(after, before,
    `${label}: ${before.toLocaleString('en-US')} chips became ${after.toLocaleString('en-US')} ` +
    `(${after - before > 0 ? '+' : ''}${after - before})`);
  return out;
}

function makeOwner(owner, balance = 6_000, safe = 4_000, mode = 'allowance', cap = null) {
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

const record = (owner) => profiles._agentRecordForTests(owner, owner);

function fakeWs() {
  return { readyState: 1, OPEN: 1, received: [], send(p) { this.received.push(JSON.parse(p)); } };
}

async function post(url, body) {
  const res = await fetch(`${base}${url}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

// ── 1. queue, then watch — the door the casino screen actually uses ─────────

test('MONEY-2: queue then WATCH takes one buy-in, not none', async () => {
  makeOwner('f-queue');
  provider();

  const queued = await post('/api/agents/f-queue/queue', { userId: 'f-queue', rung: 0 });
  assert.equal(queued.status, 200, JSON.stringify(queued.body));
  const tableId = queued.body.tableId;

  const before = total();
  const pocketBefore = record('f-queue').pocket.balance;
  const bankBefore = bank.balance();

  const table = createTable(tableId);
  const seat = table.addSpectator(fakeWs(), { agentId: 'f-queue', userId: 'f-queue', displayName: 'f-queue' });

  assert.equal(total(), before, 'seating him created no chips');
  assert.equal(record('f-queue').pocket.balance, pocketBefore - 2_000,
    'the buy-in left his pocket when he actually sat down');
  assert.equal(bank.balance(), bankBefore + 2_000, 'and arrived in the bank');
  assert.equal(table.seatStack(seat), 2_000, 'the seat holds exactly what was paid for it');
});

test('MONEY-2: a queued agent who wins is paid, because the cage took his money', async () => {
  makeOwner('f-paid');
  provider();

  const queued = await post('/api/agents/f-paid/queue', { userId: 'f-paid', rung: 0 });
  const table = createTable(queued.body.tableId);
  table.addSpectator(fakeWs(), { agentId: 'f-paid', userId: 'f-paid', displayName: 'f-paid' });
  table.seatAI({ displayName: 'House', buyIn: 2_000 });

  conserves('a queued agent standing up with the felt', () => {
    table.seatStacks[0] = 4_000;
    table.seatStacks[1] = 0;
    table._reconcileSeats();
    table.seatLeaving[0] = true;
    table._reconcileSeats();
  });

  assert.equal(record('f-paid').pocket.balance, 4_000 + 4_000,
    'what never went to the table, plus what he brought home');
});

// ── 2. an empty safe is an empty safe ───────────────────────────────────────

test('MONEY-2: an agent whose owner has nothing left cannot be queued onto a felt', async () => {
  makeOwner('f-broke', 300, 0);
  provider();

  const before = total();
  const queued = await post('/api/agents/f-broke/queue', { userId: 'f-broke', rung: 0 });

  assert.equal(queued.status, 402, JSON.stringify(queued.body));
  assert.equal(queued.body.broke, true);
  // AND THE OWNER CAN SEE WHY. Not a silent failure to appear: a reason, the
  // number he is short of, and the man's own line about it.
  assert.equal(queued.body.required, 2_000, 'it names what a seat costs');
  assert.equal(queued.body.pocket.balance, 300, 'beside what he actually has');
  assert.ok(String(queued.body.moment?.text ?? '').length > 0, 'and he says so himself');
  assert.equal(record('f-broke').activeTableId, null, 'he is not pointed at a table');
  assert.equal(record('f-broke').status, 'idle', 'and he is not reported as playing');
  assert.equal(total(), before, 'a refusal moves nothing');
});

test('MONEY-2: naming no room does not get a broke agent onto a felt either', async () => {
  makeOwner('f-broke-2', 300, 0);
  provider();

  const before = total();
  const queued = await post('/api/agents/f-broke-2/queue', { userId: 'f-broke-2' });

  assert.equal(queued.status, 402, JSON.stringify(queued.body));
  assert.equal(queued.body.broke, true);
  assert.equal(record('f-broke-2').activeTableId, null);
  assert.equal(total(), before);
});

test('MONEY-2: a cut-off agent is not queued, and the copy says he is cut off', async () => {
  makeOwner('f-cut', 6_000, 4_000, 'cut');
  provider();

  const before = total();
  const queued = await post('/api/agents/f-cut/queue', { userId: 'f-cut', rung: 0 });

  assert.equal(queued.status, 402, JSON.stringify(queued.body));
  assert.equal(queued.body.cut, true, 'and it is not reported as an empty pocket');
  assert.equal(record('f-cut').activeTableId, null);
  assert.equal(total(), before);
});

test('MONEY-2: WATCH will not seat him on an empty pocket either', () => {
  makeOwner('f-watch', 300, 0);
  provider();
  const table = createTable('t-watch-broke');
  const before = total();

  assert.throws(
    () => table.addSpectator(fakeWs(), { agentId: 'f-watch', userId: 'f-watch', displayName: 'f-watch' }),
    /300/,
    'the refusal names his pocket',
  );
  assert.equal(table.seatedCount(), 0, 'and it seats nobody on the way out');
  assert.equal(total(), before);
});

// ── 3. the vs-You door ──────────────────────────────────────────────────────

test('MONEY-2: JOIN with wantAI pays for the seat it takes', () => {
  makeOwner('f-join');
  provider();
  const table = createTable('t-join');
  table.seatPlayer(fakeWs(), { playerId: 'human', buyIn: 2_000, displayName: 'You' });

  const before = total();
  const pocketBefore = record('f-join').pocket.balance;

  table.maybeAutoSeatAI({ agentId: 'f-join', userId: 'f-join', agentDisplayName: 'f-join' });

  assert.equal(total(), before, 'the vs-You seat created no chips');
  assert.equal(record('f-join').pocket.balance, pocketBefore - 2_000, 'his pocket paid for it');
});

// ── 4. the owner's own three taps ───────────────────────────────────────────

test('MONEY-2: auto-refill moves chips out of the safe and never mints', () => {
  makeOwner('f-auto', 0, 5_000, 'auto', 2_000);
  provider();

  const before = total();
  const safeBefore = store.loadWallet('f-auto').balance;
  const result = profiles.deployAgent('f-auto', 'f-auto', { body: { rung: 0 } });
  assert.equal(result.status, 200, JSON.stringify(result.body));

  assert.equal(total(), before, 'a refill is a transfer, not a grant');
  assert.equal(store.loadWallet('f-auto').balance, safeBefore - 2_000,
    'the safe is exactly the refill lighter');
});

test('MONEY-2: auto-refill cannot pay out of an empty safe', () => {
  makeOwner('f-dry', 0, 0, 'auto', 2_000);
  provider();

  const before = total();
  const result = profiles.deployAgent('f-dry', 'f-dry', { body: { rung: 0 } });
  assert.equal(result.status, 402, JSON.stringify(result.body));
  assert.equal(result.body.broke, true);
  assert.ok(String(result.body.error).length > 0, 'and says why');
  assert.equal(total(), before);
  assert.equal(tables.size, 0, 'nobody sat down');
});

test('MONEY-2: giving him chips is bounded by the safe', async () => {
  makeOwner('f-give', 0, 1_000);
  const before = total();

  const over = await post('/api/agents/f-give/fund', { userId: 'f-give', verb: 'give', amount: 9_999 });
  assert.equal(over.status, 400, JSON.stringify(over.body));
  assert.equal(total(), before, 'a refused gift moves nothing');

  const ok = await post('/api/agents/f-give/fund', { userId: 'f-give', verb: 'give', amount: 1_000 });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(total(), before, 'and an accepted one is a transfer');
  assert.equal(store.loadWallet('f-give').balance, 0, 'the safe is empty afterwards');
  assert.equal(store.loadProfile('f-give').agents[0].pocket.balance, 1_000, 'and the chips are in his pocket');
});

test('MONEY-2: the legacy reload endpoint is bounded by the safe, and persists it', async () => {
  makeOwner('f-reload', 0, 5_000);
  provider();
  const before = total();

  const reload = await post('/api/agents/f-reload/reload', { userId: 'f-reload' });
  assert.equal(reload.status, 200, JSON.stringify(reload.body));
  assert.equal(total(), before, 'a reload is a transfer');
  assert.equal(store.loadWallet('f-reload').balance, 3_000, 'and the safe on disk says so');

  makeOwner('f-reload-dry', 0, 100);
  const dryBefore = total();
  const dry = await post('/api/agents/f-reload-dry/reload', { userId: 'f-reload-dry' });
  assert.equal(dry.status, 409, JSON.stringify(dry.body));
  assert.equal(total(), dryBefore, 'and an empty safe funds nothing');
});

// ── 5. the kitchen table ────────────────────────────────────────────────────

test('MONEY-2: the home game neither charges a pocket nor pays one', () => {
  makeOwner('f-home');
  const before = total();
  const table = createTable('home-f-home', { home: true, homeOwnerId: 'f-home', smallBlind: 1, bigBlind: 2 });

  table.startAgentSession({ agentId: 'f-home', userId: 'f-home', displayName: 'f-home', buyIn: 200 });
  assert.equal(total(), before, 'sitting down at home costs nothing');

  table.seatStacks[0] = 400;
  table.seatStacks[1] = 0;
  table._reconcileSeats();
  assert.equal(total(), before, 'and winning at home pays nothing');
  assert.equal(record('f-home').pocket.balance, 6_000, 'his pocket never moved');
});
