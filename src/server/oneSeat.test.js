// src/server/oneSeat.test.js — MONEY-1 job 5
//
// ONE AGENT, ONE TABLE.
//
// ── What the bug actually was ───────────────────────────────────────────────
//
// Not a missing lock, and not a client that lets you tap twice. `deployAgent`
// is synchronous with no await anywhere in its critical section, so two HTTP
// requests cannot interleave inside it — tapping twice was always answered by
// the "already at a live table" fast path.
//
// It was a STALE SEAT RECORD, and the reason it could go stale is that the
// wrong thing was being asked. The guard read:
//
//     agent.activeTableId && liveTables.hasTable(agent.activeTableId)
//
// which asks whether a TABLE exists — never whether HE IS IN IT. So the guard
// held only for as long as the agent record agreed with the felt, and two
// paths made them disagree:
//
//   POST /finish   cleared activeTableId and set him idle while leaving him
//                  SEATED at a running table. The next deploy saw no table to
//                  hand back and opened a second one. (Fixed in job 3, which is
//                  where the money side of the same bug was.)
//   every other    joinAgentSession, startAgentSession and addSpectator each
//     door         enforced "not two of ONE OWNER's agents at ONE table"
//                  (seatsAgentOfOwner) and nothing at all about this agent
//                  being at some OTHER table.
//
// So: the FELT is the authority and the record is a cache of it.
// tableRegistry.tableOfAgent() is that authority, and every door asks it.
//
// The refusal names where he is. "another of your agents is already at this
// table" was the only message any of this produced, and it is about a different
// rule entirely — an owner who has been told that about the agent who is
// standing at the table has been told something that is not true.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-oneseat-'));

let store, profiles, registry, Table, bank, audit;
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
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(scratch);
  bank = await import('./houseBank.js');
  profiles = await import('./agentProfiles.js');
  registry = await import('./tableRegistry.js');
  ({ Table } = await import('./table.js'));
  audit = await import('../../scripts/audit-chips.js');
});

after(() => {
  store._closeForTests();
  process.chdir(originalCwd);
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
}

/** The real registry, so the authority under test is the one the product uses. */
function useRealRegistry() {
  profiles.setLiveTableProvider(registry);
}

/** A table the registry knows about, with nothing dealing on its own. */
function liveTable(tableId, options = {}) {
  const table = registry.getOrCreateTable(tableId, { smallBlind: 10, bigBlind: 20, ...options });
  table._scheduleNextHand = () => {};
  table.startSessionLoop = () => {};
  tables.set(tableId, table);
  return table;
}

const record = (agentId, owner) => profiles._agentRecordForTests(agentId, owner);

function totalChips() {
  const owners = store.listOwners().map((ownerId) => ({
    ownerId,
    wallet: store.loadWallet(ownerId) ?? { balance: 0, ledger: [] },
    agents: store.loadProfile(ownerId)?.agents ?? [],
  }));
  return audit.auditChips(owners, { houseBank: bank.balance() }).totals.chipsInExistence;
}

// ── the authority ───────────────────────────────────────────────────────────

test('MONEY-1: the registry can say which table an agent is at', () => {
  makeOwner('auth-owner', ['a1']);
  const table = liveTable('t-auth');
  assert.equal(registry.tableOfAgent('a1'), null, 'nowhere, to begin with');

  table.seatAI({ agentId: 'a1', userId: 'auth-owner', displayName: 'A1', buyIn: 2_000 });
  assert.equal(registry.tableOfAgent('a1')?.tableId, 't-auth');

  // And it reads the FELT, not the record — which is the whole point of it.
  record('a1', 'auth-owner').activeTableId = null;
  assert.equal(registry.tableOfAgent('a1')?.tableId, 't-auth',
    'a record that has lost him does not make the seat go away');
});

// ── the doors ───────────────────────────────────────────────────────────────

test('MONEY-1: joinAgentSession refuses an agent who is already sitting somewhere', () => {
  makeOwner('join-owner', ['j1']);
  const first = liveTable('t-join-1');
  first.seatAI({ agentId: 'j1', userId: 'join-owner', displayName: 'J1', buyIn: 2_000 });

  const second = liveTable('t-join-2');
  const seat = second.joinAgentSession({ agentId: 'j1', userId: 'join-owner', displayName: 'J1', buyIn: 2_000 });
  assert.equal(seat, null, 'the door is shut');
  assert.equal(second.seatedCount(), 0, 'and it seated nobody on the way out');
});

test('MONEY-1: startAgentSession refuses him too', () => {
  makeOwner('start-owner', ['s1']);
  const first = liveTable('t-start-1');
  first.seatAI({ agentId: 's1', userId: 'start-owner', displayName: 'S1', buyIn: 2_000 });

  const second = liveTable('t-start-2');
  const seat = second.startAgentSession({ agentId: 's1', userId: 'start-owner', displayName: 'S1', buyIn: 2_000 });
  assert.equal(seat, null);
  assert.equal(second.seatedCount(), 0, 'not even the House sat down');
});

test('MONEY-1: the WATCH door names the table he is already at', () => {
  makeOwner('watch-owner', ['w1']);
  const first = liveTable('t-watch-1');
  first.seatAI({ agentId: 'w1', userId: 'watch-owner', displayName: 'W1', buyIn: 2_000 });

  const second = liveTable('t-watch-2');
  const ws = { readyState: 1, OPEN: 1, send() {} };
  assert.throws(
    () => second.addSpectator(ws, { agentId: 'w1', userId: 'watch-owner', displayName: 'W1' }),
    (err) => {
      // The old message for this was "another of your agents is already at this
      // table", which is a different rule and is not true of him.
      assert.match(err.message, /t-watch-1/, `names where he is — got "${err.message}"`);
      assert.doesNotMatch(err.message, /another of your agents/);
      return true;
    },
  );
  assert.equal(second.seatedCount(), 0);
});

test('MONEY-1: the rule is about HIM, not his stablemates', () => {
  makeOwner('mate-owner', ['m1', 'm2']);
  const table = liveTable('t-mates');
  table.seatAI({ agentId: 'm1', userId: 'mate-owner', displayName: 'M1', buyIn: 2_000 });

  // MATCH-1's rule still stands and still has its own message: not two of one
  // owner's agents at ONE table.
  const other = liveTable('t-mates-2');
  assert.equal(
    other.joinAgentSession({ agentId: 'm2', userId: 'mate-owner', displayName: 'M2', buyIn: 2_000 }),
    0,
    'a stablemate at a DIFFERENT table is fine',
  );
});

// ── deploy ──────────────────────────────────────────────────────────────────

test('MONEY-1: deploy hands back the table he is at, even when the record has lost it', () => {
  makeOwner('stale-owner', ['st1']);
  useRealRegistry();
  const deploy = profiles.deployAgent('stale-owner', 'st1', { body: { rung: 0 } });
  assert.equal(deploy.status, 200, JSON.stringify(deploy.body));
  const tableId = deploy.body.tableId;
  tables.set(tableId, registry.getTable(tableId));

  // Exactly what POST /finish used to do: clear the record, leave the seat.
  const agent = record('st1', 'stale-owner');
  agent.activeTableId = null;
  agent.status = 'idle';

  const before = totalChips();
  const again = profiles.deployAgent('stale-owner', 'st1', { body: { rung: 0 } });
  assert.equal(again.status, 200, JSON.stringify(again.body));
  assert.equal(again.body.tableId, tableId, 'the same felt he is already sitting at');
  assert.equal(again.body.alreadyPlaying, true);
  assert.equal(totalChips(), before, 'and it did not charge him a second buy-in');
  assert.equal(registry.listTables().filter((t) => !t.closed).length, 1, 'no second table was opened');
  assert.equal(record('st1', 'stale-owner').activeTableId, tableId, 'the record is repaired from the felt');
});

test('MONEY-1: asking for a different room while seated is refused, naming where he is', () => {
  makeOwner('room-owner', ['r1']);
  useRealRegistry();
  const first = profiles.deployAgent('room-owner', 'r1', { body: { rung: 0 } });
  assert.equal(first.status, 200);
  tables.set(first.body.tableId, registry.getTable(first.body.tableId));

  const before = totalChips();
  const elsewhere = profiles.deployAgent('room-owner', 'r1', { body: { rung: 2 } });
  assert.equal(elsewhere.status, 409, JSON.stringify(elsewhere.body));
  assert.equal(elsewhere.body.error, 'alreadySeated');
  assert.equal(elsewhere.body.tableId, first.body.tableId, 'and says which felt');
  assert.match(String(elsewhere.body.message), /R1/, 'in a sentence, with his name');
  assert.equal(totalChips(), before, 'a refusal moves nothing');
  assert.equal(registry.listTables().filter((t) => !t.closed).length, 1);
});

test('MONEY-1: tapping deploy twice in one tick takes one seat and one buy-in', () => {
  makeOwner('tap-owner', ['tp1']);
  useRealRegistry();
  const before = totalChips();

  // Same tick, no await between them — the shape a double tap produces, and
  // the shape two racing clients produce, because deployAgent is synchronous.
  const results = [
    profiles.deployAgent('tap-owner', 'tp1', { body: { rung: 0 } }),
    profiles.deployAgent('tap-owner', 'tp1', { body: { rung: 0 } }),
    profiles.deployAgent('tap-owner', 'tp1', { body: { rung: 0 } }),
  ];
  for (const r of results) {
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.tableId, results[0].body.tableId, 'all three name one table');
  }
  for (const t of registry.listTables()) tables.set(t.tableId, t);

  assert.equal(registry.listTables().filter((t) => !t.closed).length, 1, 'one table');
  assert.equal(totalChips(), before, 'and one buy-in — the second and third moved nothing');
  assert.equal(record('tp1', 'tap-owner').pocket.balance, 18_000, '20,000 less the one 2,000 buy-in');
});

test('MONEY-1: two different agents of one owner may each hold a seat', () => {
  makeOwner('two-owner', ['x1', 'x2']);
  useRealRegistry();
  const a = profiles.deployAgent('two-owner', 'x1', { body: { rung: 0 } });
  const b = profiles.deployAgent('two-owner', 'x2', { body: { rung: 0 } });
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.notEqual(a.body.tableId, b.body.tableId, 'MATCH-1: never on the same felt');
  for (const t of registry.listTables()) tables.set(t.tableId, t);
  assert.equal(registry.tableOfAgent('x1').tableId, a.body.tableId);
  assert.equal(registry.tableOfAgent('x2').tableId, b.body.tableId);
});
