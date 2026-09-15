// src/server/oneSeatDoors.test.js — AGENT-4 job A
//
// ONE AGENT, ONE TABLE — the doors MONEY-1 did not reach.
//
// ── What reproduced on main, and what did not ───────────────────────────────
//
// Jens saw one agent playing two tables at once. MONEY-1 job 5 had already
// made the felt the authority (tableRegistry.tableOfAgent) and put the rule on
// three doors, so the first question was whether anything was left. Two things
// were:
//
//   JOIN (wantAI)   `Table.maybeAutoSeatAI` — the vs-You door — had no seat
//                   check of any kind. MONEY-2 gave it a BUY-IN and not a
//                   GATE, so an agent already grinding a casino table could be
//                   seated a second time opposite his own owner AND charged a
//                   second buy-in. Two seats, two debits, one man. This is the
//                   bug Jens saw.
//   POST /queue     no seat check either. Not a second seat — addSpectator
//                   refuses the WATCH that follows — but it overwrites
//                   `activeTableId` with a table he is not at and never
//                   reaches, so the record stops describing the felt.
//
// What did NOT reproduce: deploy, joinAgentSession, startAgentSession and
// addSpectator all refuse correctly, and `deployAgent` is synchronous with no
// await in its critical section, so racing it cannot interleave. oneSeat.test.js
// already pins all of that and it is still green — this file is only the gap.
//
// ── Where the fix went, and why not on the doors ────────────────────────────
//
// On `seatAI`, which is the only function in the codebase that puts an agent
// in a chair. Three doors each asking the rule a few lines before one write is
// three chances to add a fourth door that forgets — which is exactly what
// happened. The check now sits at the write, so the two cannot be split, and
// the doors keep their own checks purely so they can refuse before taking
// money.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-onedoor-'));
const savedEnv = Object.fromEntries(['TELEGRAM_BOT_TOKEN', 'DEV_API_SECRET'].map((k) => [k, process.env[k]]));

let store, profiles, registry, bank, audit, server, base;
const tables = new Map();

const seedAgent = (id, balance = 20_000) => ({
  id, name: id.toUpperCase(), status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'Play carefully.', bankroll: balance,
  pocket: { agentId: id, balance, mode: 'allowance', cap: null, realised: 0, ledger: [], recall: false },
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
  registry = await import('./tableRegistry.js');
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
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
});

beforeEach(() => {
  registry.resetRegistry('between tests');
  for (const table of [...tables.values()]) {
    table.agentIds.fill(null);
    try { table.closeTable('fixture disposed'); } catch { /* already gone */ }
  }
  tables.clear();
});

function makeOwner(owner, ids) {
  store.saveWallet(owner, { ownerId: owner, balance: 0, ledger: [] });
  store.saveProfile(owner, { userId: owner, chat: [], agents: ids.map((id) => seedAgent(id)) });
  profiles.reloadOwners(owner);
  profiles.setLiveTableProvider(registry);
}

function liveTable(tableId, options = {}) {
  const table = registry.getOrCreateTable(tableId, { smallBlind: 10, bigBlind: 20, ...options });
  table._scheduleNextHand = () => {};
  table.startSessionLoop = () => {};
  tables.set(tableId, table);
  return table;
}

const record = (agentId, owner) => profiles._agentRecordForTests(agentId, owner);
const fakeWs = () => ({ readyState: 1, OPEN: 1, send() {} });

/** Every seat this agent holds anywhere in the registry. */
const seatsHeldBy = (agentId) =>
  registry.listTables().filter((t) => !t.closed && t.agentIds.includes(agentId)).map((t) => t.tableId);

function totalChips() {
  const owners = store.listOwners().map((ownerId) => ({
    ownerId,
    wallet: store.loadWallet(ownerId) ?? { balance: 0, ledger: [] },
    agents: store.loadProfile(ownerId)?.agents ?? [],
  }));
  return audit.auditChips(owners, { houseBank: bank.balance() }).totals.chipsInExistence;
}

async function queue(owner, agentId, extra = {}) {
  const response = await fetch(`${base}/api/agents/${agentId}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: owner, ...extra }),
  });
  return { status: response.status, body: await response.json() };
}

// ── the JOIN door — the one that reproduced ─────────────────────────────────

test('AGENT-4 job A: JOIN cannot seat an agent who is already at a casino table', () => {
  makeOwner('join-door', ['j1']);
  const deploy = profiles.deployAgent('join-door', 'j1', { body: { rung: 0 } });
  assert.equal(deploy.status, 200, JSON.stringify(deploy.body));
  for (const t of registry.listTables()) tables.set(t.tableId, t);

  const pocketAfterDeploy = record('j1', 'join-door').pocket.balance;
  const chipsBefore = totalChips();

  // The vs-You table: a human sits down and asks for his own agent opposite.
  const vsYou = liveTable('t-vs-you');
  vsYou.seatPlayer(fakeWs(), { playerId: 'human', buyIn: 2_000, displayName: 'Jens' });

  assert.throws(
    () => vsYou.maybeAutoSeatAI({
      agentId: 'j1', userId: 'join-door', agentDisplayName: 'J1', agentStrategy: 'x',
    }),
    (err) => {
      assert.match(err.message, new RegExp(deploy.body.tableId), `names the felt he is at — got "${err.message}"`);
      return true;
    },
  );

  assert.deepEqual(seatsHeldBy('j1'), [deploy.body.tableId], 'one seat, and it is the one he had');
  assert.equal(record('j1', 'join-door').pocket.balance, pocketAfterDeploy,
    'and the refusal did not charge him a second buy-in');
  assert.equal(totalChips(), chipsBefore, 'a refusal moves nothing');
});

test('AGENT-4 job A: the vs-You door still seats an agent who is free', () => {
  makeOwner('free-door', ['f1']);
  const vsYou = liveTable('t-free');
  vsYou.seatPlayer(fakeWs(), { playerId: 'human', buyIn: 2_000, displayName: 'Jens' });
  const seat = vsYou.maybeAutoSeatAI({
    agentId: 'f1', userId: 'free-door', agentDisplayName: 'F1', agentStrategy: 'x',
  });
  assert.ok(Number.isInteger(seat) && seat >= 0, 'the rule refuses a second seat, not a first one');
  assert.deepEqual(seatsHeldBy('f1'), ['t-free']);
});

// ── the queue door ──────────────────────────────────────────────────────────

test('AGENT-4 job A: POST /queue refuses an agent who is already seated', async () => {
  makeOwner('queue-door', ['q1']);
  const deploy = profiles.deployAgent('queue-door', 'q1', { body: { rung: 0 } });
  assert.equal(deploy.status, 200, JSON.stringify(deploy.body));
  for (const t of registry.listTables()) tables.set(t.tableId, t);
  const chipsBefore = totalChips();

  const queued = await queue('queue-door', 'q1');
  assert.equal(queued.status, 409, JSON.stringify(queued.body));
  assert.equal(queued.body.error, 'alreadySeated');
  assert.equal(queued.body.tableId, deploy.body.tableId, 'and it says which felt');
  assert.match(String(queued.body.message), /Q1/, 'in a sentence, with his name');

  // The record still describes the felt. Before the fix this route overwrote
  // it with a reservation for a table he would never reach.
  assert.equal(record('q1', 'queue-door').activeTableId, deploy.body.tableId);
  assert.equal(registry.tableOfAgent('q1')?.tableId, deploy.body.tableId);
  assert.equal(totalChips(), chipsBefore, 'a refusal moves nothing');
});

test('AGENT-4 job A: POST /queue still works for an agent who is free', async () => {
  makeOwner('queue-free', ['qf1']);
  const queued = await queue('queue-free', 'qf1');
  assert.equal(queued.status, 200, JSON.stringify(queued.body));
  assert.ok(queued.body.tableId, 'he gets a reservation');
  assert.equal(record('qf1', 'queue-free').activeTableId, queued.body.tableId);
});

// ── both doors racing ───────────────────────────────────────────────────────

test('AGENT-4 job A: deploy and queue racing take one seat between them', async () => {
  makeOwner('race-owner', ['r1']);
  const chipsBefore = totalChips();

  // Fired without awaiting between them. deployAgent is synchronous, so this
  // is the worst interleaving the runtime can actually produce — the queue
  // route's own body runs to completion on the next tick either way.
  const deployed = profiles.deployAgent('race-owner', 'r1', { body: { rung: 0 } });
  const queued = await queue('race-owner', 'r1');
  for (const t of registry.listTables()) tables.set(t.tableId, t);

  assert.equal(deployed.status, 200, JSON.stringify(deployed.body));
  assert.equal(queued.status, 409, 'the second door through is refused');
  assert.deepEqual(seatsHeldBy('r1'), [deployed.body.tableId], 'exactly one seat');
  assert.equal(record('r1', 'race-owner').activeTableId, deployed.body.tableId);
  assert.equal(record('r1', 'race-owner').pocket.balance, 18_000, 'one buy-in, not two');
  assert.equal(totalChips(), chipsBefore, 'and the floor still conserves chips');
});

test('AGENT-4 job A: three doors at once — deploy, JOIN and queue — leave one seat', async () => {
  makeOwner('all-doors', ['a1']);
  const chipsBefore = totalChips();

  const deployed = profiles.deployAgent('all-doors', 'a1', { body: { rung: 0 } });
  assert.equal(deployed.status, 200, JSON.stringify(deployed.body));
  for (const t of registry.listTables()) tables.set(t.tableId, t);

  const vsYou = liveTable('t-all-doors');
  vsYou.seatPlayer(fakeWs(), { playerId: 'human', buyIn: 2_000, displayName: 'Jens' });
  assert.throws(() => vsYou.maybeAutoSeatAI({
    agentId: 'a1', userId: 'all-doors', agentDisplayName: 'A1', agentStrategy: 'x',
  }));

  const watchTable = liveTable('t-all-doors-watch');
  assert.throws(() => watchTable.addSpectator(fakeWs(), {
    agentId: 'a1', userId: 'all-doors', displayName: 'A1',
  }));

  const queued = await queue('all-doors', 'a1');
  assert.equal(queued.status, 409);

  assert.deepEqual(seatsHeldBy('a1'), [deployed.body.tableId]);
  assert.equal(record('a1', 'all-doors').pocket.balance, 18_000, 'one buy-in in total');
  assert.equal(totalChips(), chipsBefore);
});

// ── the invariant itself ────────────────────────────────────────────────────

test('AGENT-4 job A: seatAI is the chokepoint, so a new door inherits the rule', () => {
  makeOwner('choke-owner', ['c1']);
  const first = liveTable('t-choke-1');
  first.seatAI({ agentId: 'c1', userId: 'choke-owner', displayName: 'C1', buyIn: 2_000 });

  // A hypothetical fourth door that calls seatAI directly and asks nothing.
  const second = liveTable('t-choke-2');
  assert.throws(
    () => second.seatAI({ agentId: 'c1', userId: 'choke-owner', displayName: 'C1', buyIn: 2_000 }),
    /t-choke-1/,
    'the check lives at the write, not at the doors',
  );
  assert.equal(second.seatedCount(), 0);
});

test('AGENT-4 job A: the kitchen table is still not a casino seat', () => {
  makeOwner('home-owner', ['h1']);
  const home = liveTable('home-home-owner', { home: true, homeOwnerId: 'home-owner' });
  home.seatAI({ agentId: 'h1', userId: 'home-owner', displayName: 'H1', buyIn: 2_000 });

  // MONEY-1's line: playing cards in his own living room is not sitting at a
  // table, so going to work is allowed. seatAI must not have narrowed that.
  const floor = liveTable('t-home-to-work');
  const seat = floor.seatAI({ agentId: 'h1', userId: 'home-owner', displayName: 'H1', buyIn: 2_000 });
  assert.ok(Number.isInteger(seat) && seat >= 0, 'he may leave the kitchen table for work');
});
