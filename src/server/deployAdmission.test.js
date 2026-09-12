// FIRST-SEAT-1: the chosen room and a real started session are deploy promises.
// No socket/server/model calls. Real Tables use a stopped deal scheduler.
delete process.env.ANTHROPIC_API_KEY;
process.env.GUEST_ENABLED = '1';
import test, { before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-admission-'));
let store, profiles, guest, Table;
const owners = ['pick-up', 'pick-down', 'same-room', 'automatic', 'factory-fails', 'null-start', 'undefined-start', 'partial-start', 'refill-fails', 'g_start-retry'];
const tables = new Map();
const seedAgent = id => ({ id, name: id, status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'Play carefully.', bankroll: 12000,
  pocket: { agentId: id, balance: 12000, mode: 'allowance', cap: null, realised: 0, ledger: [], recall: false },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  mood: { state: 'neutral', heat: 30 }, stats: { handsPlayed: 40, handsWon: 10 },
  sessionLog: [], ledger: [], drinkPending: true,
});

before(async () => {
  store = await import('./store.js');
  store._closeForTests(); process.chdir(scratch);
  for (const owner of owners) {
    store.saveWallet(owner, { ownerId: owner, balance: 5000, ledger: [] });
    const agent = seedAgent(owner);
    if (owner === 'refill-fails') {
      agent.bankroll = 0;
      agent.pocket = { ...agent.pocket, balance: 0, mode: 'auto', cap: 2000 };
    }
    store.saveProfile(owner, { userId: owner, chat: [], agents: [agent] });
  }
  store.insertGuest({ token: 'admission-retry-token', ownerId: 'g_start-retry' });
  profiles = await import('./agentProfiles.js');
  guest = await import('./guest.js');
  ({ Table } = await import('./table.js'));
});

afterEach(() => {
  // Fixture disposal is not a played session and must not settle its chips.
  for (const table of [...tables.values()]) {
    table.agentIds.fill(null);
    table.closeTable('fixture disposed');
  }
  tables.clear();
  profiles.setLiveTableProvider(null);
});
after(() => {
  store._closeForTests(); process.chdir(originalCwd);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
});

function createTable(tableId, options = {}) {
  const table = new Table({ tableId, smallBlind: 10, bigBlind: 20, ...options, onEmpty: id => tables.delete(id) });
  table._scheduleNextHand = () => {};
  tables.set(tableId, table);
  return table;
}
function provider({ candidate = null, create = createTable } = {}) {
  profiles.setLiveTableProvider({
    MAX_CONCURRENT_TABLES: 10, countAutonomousTables: () => 0,
    hasTable: id => tables.has(id), getTable: id => tables.get(id),
    findJoinableTable: () => candidate ? { table: candidate, score: 60 } : null,
    getOrCreateTable: create,
  });
}
function candidateAt(bigBlind) {
  const table = createTable('existing-table', { smallBlind: bigBlind / 2, bigBlind });
  table.seatAI({ displayName: 'House', stableId: 'doyle_v3', buyIn: bigBlind * 100 });
  return table;
}
function record(owner) { return profiles._agentRecordForTests(owner, owner); }

for (const [owner, rung, bigBlind, otherBlind] of [['pick-up', 2, 100, 20], ['pick-down', 0, 20, 100]]) {
  test(`FIRST-SEAT-1: explicit rung ${rung} cannot join a different room`, () => {
    const candidate = candidateAt(otherBlind);
    provider({ candidate });
    const result = profiles.deployAgent(owner, owner, { body: { rung } });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.joinedExisting, false);
    assert.notEqual(result.body.tableId, candidate.tableId);
    const table = tables.get(result.body.tableId);
    assert.equal(table.bigBlind, bigBlind);
    assert.equal(table.liveSeatCount(), 2, 'hero and House are present');
    assert.equal(record(owner).pocket.balance, 12000 - bigBlind * 100);
    assert.equal(candidate.seatedCount(), 1, 'the other room is untouched');
  });
}

test('FIRST-SEAT-1: a same-rung candidate is still joined without opening another table', () => {
  const candidate = candidateAt(50);
  provider({ candidate });
  const result = profiles.deployAgent('same-room', 'same-room', { body: { rung: 1 } });
  assert.equal(result.status, 200);
  assert.equal(result.body.joinedExisting, true);
  assert.equal(result.body.tableId, candidate.tableId);
  assert.equal(tables.size, 1);
  assert.equal(record('same-room').pocket.balance, 7000);
});

test('FIRST-SEAT-1: no requested rung retains existing affordable matchmaking', () => {
  const candidate = candidateAt(20);
  provider({ candidate });
  const result = profiles.deployAgent('automatic', 'automatic');
  assert.equal(result.status, 200);
  assert.equal(result.body.joinedExisting, true);
  assert.equal(result.body.tableId, candidate.tableId);
  assert.equal(record('automatic').pocket.balance, 10000);
});

for (const failure of ['factory-fails', 'null-start', 'undefined-start', 'partial-start']) {
  test(`FIRST-SEAT-1: ${failure} refuses deploy without inventing a paid session`, () => {
    let failedTable;
    provider({ create: (id, options) => {
      if (failure === 'factory-fails') throw new Error('storage unavailable');
      failedTable = createTable(id, options);
      failedTable.startAgentSession = args => {
        if (failure === 'partial-start') {
          failedTable.seatAI({ ...args, buyIn: 10000 });
          failedTable._nextHandTimer = setTimeout(() => {}, 60000);
          failedTable._nextHandTimer.unref();
          throw new Error('House seat unavailable');
        }
        return failure === 'null-start' ? null : undefined;
      };
      return failedTable;
    } });
    const before = structuredClone(record(failure));
    const result = profiles.deployAgent(failure, failure, { body: { rung: 2 } });
    assert.equal(result.status, 503, JSON.stringify(result.body));
    assert.equal(result.body.sessionStarted, false);
    assert.equal(result.body.tableId, undefined);
    const after = record(failure);
    assert.equal(after.status, 'idle');
    assert.equal(after.activeTableId, null);
    assert.deepEqual(after.pocket, before.pocket);
    assert.deepEqual(after.ledger, before.ledger);
    assert.deepEqual(after.sessionLog, before.sessionLog);
    assert.equal(after.drinkPending, true, 'a failed seating does not consume his drink');
    assert.equal(store.loadWallet(failure).balance, 5000);
    assert.equal(tables.size, 0, 'no failed table survives in the registry');
    if (failedTable) {
      assert.equal(failedTable.closed, true);
      assert.equal(failedTable._nextHandTimer, null);
      assert.equal(failedTable.pending.filter(Boolean).length, 0);
    }
  });
}

test('FIRST-SEAT-1: a refused guest start preserves the daily session for an actual retry', () => {
  const owner = 'g_start-retry';
  provider({ create: () => { throw new Error('failed startup'); } });
  assert.equal(profiles.deployAgent(owner, owner, { body: { rung: 2 } }).status, 503);
  assert.equal(guest.guestSessionRefusal(owner), null);
  provider();
  const success = profiles.deployAgent(owner, owner, { body: { rung: 2 } });
  assert.equal(success.status, 200);
  assert.equal(success.body.sessionStarted, true);
  assert.equal(guest.guestSessionRefusal(owner)?.error, 'guestSessionCap');
  assert.equal(record(owner).pocket.balance, 2000);
});

test('FIRST-SEAT-1: failed startup restores the automatic refill in memory and storage', () => {
  const owner = 'refill-fails';
  const before = structuredClone(record(owner).pocket);
  provider({ create: (id, options) => {
    const table = createTable(id, options);
    table.startAgentSession = args => {
      assert.equal(record(owner).pocket.balance, 2000, 'the normal refill gate ran');
      table.seatAI(args); // consumes and saves the pending drink and refill
      throw new Error('failed second seat');
    };
    return table;
  } });
  assert.equal(profiles.deployAgent(owner, owner, { body: { rung: 0 } }).status, 503);
  assert.deepEqual(record(owner).pocket, before);
  assert.equal(record(owner).bankroll, 0);
  assert.equal(record(owner).drinkPending, true);
  assert.equal(store.loadWallet(owner).balance, 5000);
  const saved = store.loadAgentStore()[owner].agents[0];
  assert.deepEqual(saved.pocket, before);
  assert.equal(saved.drinkPending, true);
  assert.equal(tables.size, 0);
});

test('FIRST-SEAT-1: startup rollback cannot discard an existing hand or human table', () => {
  const played = createTable('played');
  played.seatAI({ displayName: 'Existing House', stableId: 'doyle_v3' });
  played.handsThisSession = 1;
  assert.equal(played.abortSessionStart(), false);
  assert.equal(played.closed, false);
  assert.equal(played.seatedCount(), 1);
  const human = createTable('human');
  human.seatPlayer({ readyState: 0 }, { playerId: 'human', displayName: 'Owner', buyIn: 2000 });
  assert.equal(human.abortSessionStart(), false);
  assert.equal(human.closed, false);
  assert.equal(human.seatedCount(), 1);
});
