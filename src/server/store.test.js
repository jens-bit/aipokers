// src/server/store.test.js — SQLITE-1
//
// Round-trip, migration from a fixture agents.json, an idempotent second boot,
// and the cwd isolation the whole test harness depends on.
//
// Every test chdir's into its own temp directory and calls _closeForTests()
// first, which is the in-process equivalent of what runScript.js does by
// spawning: the store must resolve data/app.db from process.cwd() at the moment
// it opens, or a suite would write into the developer's real data/.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  loadAgentStore, saveProfile,
  appendHandRow, readHandRows,
  loadOpponentStats, saveOpponentStats,
  loadNotificationState, saveNotificationState,
  loadWallet, saveWallet, deleteOwner,
  openStore, _closeForTests, _dbPath,
} from './store.js';

const ORIGINAL_CWD = process.cwd();
const scratchDirs = [];

// Fresh cwd + fresh handle. Returns the directory.
function freshCwd() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-store-'));
  scratchDirs.push(dir);
  _closeForTests();
  process.chdir(dir);
  return dir;
}

function writeDataFile(dir, name, value) {
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', name), JSON.stringify(value, null, 2), 'utf8');
}

test.after(() => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  for (const dir of scratchDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
});

// ── cwd isolation ────────────────────────────────────────────────────────────

test('the database resolves from process.cwd(), not the module location', () => {
  const dir = freshCwd();
  openStore();
  assert.equal(_dbPath(), path.join(dir, 'data', 'app.db'));
  assert.ok(fs.existsSync(path.join(dir, 'data', 'app.db')), 'app.db created under the scratch cwd');
  // The repo's own data/ must be untouched by a suite running elsewhere.
  assert.ok(!_dbPath().startsWith(ORIGINAL_CWD), 'must not resolve into the repo');
});

test('a second cwd gets its own empty database', () => {
  const a = freshCwd();
  saveProfile('u1', { userId: 'u1', agents: [{ id: 'a1', name: 'One' }], chat: [] });
  assert.equal(Object.keys(loadAgentStore()).length, 1);

  const b = freshCwd();
  assert.notEqual(a, b);
  assert.deepEqual(loadAgentStore(), {}, 'a fresh cwd starts clean');
});

test('no data/ JSON in the cwd means no migration and an empty store', () => {
  freshCwd();
  openStore();
  assert.deepEqual(loadAgentStore(), {});
  assert.deepEqual(readHandRows('nobody', 20), []);
});

// ── agents round-trip ────────────────────────────────────────────────────────

test('agent store round-trips through save and load', () => {
  freshCwd();
  const profile = {
    userId: 'owner-1',
    chat: [{ role: 'assistant', content: 'hello' }],
    // SERVER-4: the room thread's unread marker is part of the profile row now,
    // so it is part of what "survives verbatim" means.
    homeThreadUnreadSince: 1_700_000_000_000,
    agents: [
      { id: 'a1', name: 'Ace', status: 'idle', activeTableId: null, mood: { state: 'calm' }, ledger: [{ type: 'grant', amount: 10000 }] },
      { id: 'a2', name: 'Bee', status: 'playing', activeTableId: 't-9', recentHands: [{ won: true, timestamp: 123 }] },
    ],
  };
  saveProfile('owner-1', profile);

  _closeForTests();                       // force a re-open, not a cached object
  const loaded = loadAgentStore();
  assert.deepEqual(loaded['owner-1'], profile, 'the record survives verbatim');
});

// SERVER-4: an owner who has never had anything unread, and one who has been
// caught up. Both are "nothing waiting", and both must read back as null
// rather than as the 0 the column stores — a client testing truthiness on a
// timestamp must never see a second sentinel for the same state.
test('SERVER-4: nothing unread round-trips as null, not as zero', () => {
  freshCwd();
  saveProfile('o', { userId: 'o', chat: [], agents: [] });
  _closeForTests();
  assert.equal(loadAgentStore().o.homeThreadUnreadSince, null);

  saveProfile('o', { userId: 'o', chat: [], agents: [], homeThreadUnreadSince: 555_000_000_000 });
  _closeForTests();
  assert.equal(loadAgentStore().o.homeThreadUnreadSince, 555_000_000_000);

  // Cleared by POST /api/home/thread/seen: back to null, not to the last value.
  saveProfile('o', { userId: 'o', chat: [], agents: [], homeThreadUnreadSince: null });
  _closeForTests();
  assert.equal(loadAgentStore().o.homeThreadUnreadSince, null);
});

test('agent order is stable across a reload', () => {
  freshCwd();
  const ids = ['z', 'm', 'a', 'q'];
  saveProfile('o', { userId: 'o', chat: [], agents: ids.map((id) => ({ id, name: id })) });
  _closeForTests();
  assert.deepEqual(loadAgentStore().o.agents.map((a) => a.id), ids);
});

test('saving an owner deletes agents that were removed from the array', () => {
  freshCwd();
  saveProfile('o', { userId: 'o', chat: [], agents: [{ id: 'keep' }, { id: 'drop' }] });
  saveProfile('o', { userId: 'o', chat: [], agents: [{ id: 'keep' }] });
  _closeForTests();
  assert.deepEqual(loadAgentStore().o.agents.map((a) => a.id), ['keep']);
});

test('re-saving an owner updates in place rather than duplicating', () => {
  freshCwd();
  saveProfile('o', { userId: 'o', chat: [], agents: [{ id: 'a1', name: 'before' }] });
  saveProfile('o', { userId: 'o', chat: [], agents: [{ id: 'a1', name: 'after' }] });
  _closeForTests();
  const agents = loadAgentStore().o.agents;
  assert.equal(agents.length, 1);
  assert.equal(agents[0].name, 'after');
});

// ── hands round-trip ─────────────────────────────────────────────────────────

test('hands read back newest-first and respect the cap', () => {
  freshCwd();
  for (let i = 1; i <= 5; i++) appendHandRow('u', { n: i }, 3);
  const hands = readHandRows('u', 20);
  assert.deepEqual(hands.map((h) => h.n), [5, 4, 3], 'newest first, capped at 3');
});

test('hands are scoped per owner', () => {
  freshCwd();
  appendHandRow('u1', { n: 1 }, 50);
  appendHandRow('u2', { n: 2 }, 50);
  assert.deepEqual(readHandRows('u1', 20).map((h) => h.n), [1]);
  assert.deepEqual(readHandRows('u2', 20).map((h) => h.n), [2]);
});

// ── opponent stats + notification state round-trip ───────────────────────────

test('opponent stats round-trip and drop removed players', () => {
  freshCwd();
  saveOpponentStats({
    p1: { playerId: 'p1', displayName: 'Pat', hands: [{ vpip: true, pfr: false }] },
    p2: { playerId: 'p2', displayName: 'Sam', hands: [] },
  });
  _closeForTests();
  const loaded = loadOpponentStats();
  assert.deepEqual(Object.keys(loaded).sort(), ['p1', 'p2']);
  assert.equal(loaded.p1.displayName, 'Pat');
  assert.deepEqual(loaded.p1.hands, [{ vpip: true, pfr: false }]);

  saveOpponentStats({ p1: loaded.p1 });
  assert.deepEqual(Object.keys(loadOpponentStats()), ['p1']);
});

test('notification state round-trips', () => {
  freshCwd();
  const state = { '55': { dailyCounts: { date: '2026-09-05', count: 2 }, sentLog: [{ type: 'recap' }] } };
  saveNotificationState(state);
  _closeForTests();
  assert.deepEqual(loadNotificationState(), state);
});

// ── migration ────────────────────────────────────────────────────────────────

test('migration imports a fixture agents.json and retires the file', () => {
  const dir = freshCwd();
  writeDataFile(dir, 'agents.json', {
    'owner-a': {
      userId: 'owner-a',
      chat: [{ role: 'assistant', content: 'opening' }],
      agents: [{ id: 'a1', name: 'Ace', status: 'idle' }, { id: 'a2', name: 'Bee', status: 'playing', activeTableId: 't1' }],
    },
    'owner-b': { userId: 'owner-b', chat: [], agents: [{ id: 'b1', name: 'Cee' }] },
  });

  openStore();

  const loaded = loadAgentStore();
  assert.deepEqual(Object.keys(loaded).sort(), ['owner-a', 'owner-b']);
  assert.deepEqual(loaded['owner-a'].agents.map((a) => a.id), ['a1', 'a2'], 'order preserved');
  assert.equal(loaded['owner-a'].chat[0].content, 'opening');
  assert.equal(loaded['owner-b'].agents[0].name, 'Cee');

  assert.ok(!fs.existsSync(path.join(dir, 'data', 'agents.json')), 'source renamed');
  assert.ok(fs.existsSync(path.join(dir, 'data', 'agents.json.migrated')), 'never deleted — kept as .migrated');
});

test('migration imports hands, opponents and notifications too', () => {
  const dir = freshCwd();
  writeDataFile(dir, 'hands-u1.json', [{ n: 3 }, { n: 2 }, { n: 1 }]);   // stored newest-first
  writeDataFile(dir, 'opponents.json', { p1: { playerId: 'p1', displayName: 'Pat', hands: [{ vpip: true }] } });
  writeDataFile(dir, 'notifications.json', { '99': { dailyCounts: { date: '2026-09-01', count: 1 } } });

  openStore();

  assert.deepEqual(readHandRows('u1', 20).map((h) => h.n), [3, 2, 1], 'newest-first order preserved');
  assert.equal(loadOpponentStats().p1.displayName, 'Pat');
  assert.equal(loadNotificationState()['99'].dailyCounts.count, 1);

  for (const name of ['hands-u1.json', 'opponents.json', 'notifications.json']) {
    assert.ok(!fs.existsSync(path.join(dir, 'data', name)), `${name} renamed`);
    assert.ok(fs.existsSync(path.join(dir, 'data', `${name}.migrated`)), `${name}.migrated kept`);
  }
});

test('a second boot imports nothing and changes nothing', () => {
  const dir = freshCwd();
  writeDataFile(dir, 'agents.json', {
    o: { userId: 'o', chat: [], agents: [{ id: 'a1', name: 'Ace' }] },
  });

  openStore();
  const first = loadAgentStore();

  // Second boot: drop the handle and re-open exactly as a restart would.
  _closeForTests();
  openStore();
  assert.deepEqual(loadAgentStore(), first, 'idempotent — no duplicates, no loss');

  // Even if the JSON reappears (an operator restoring a backup by hand), the
  // meta stamp keeps the import from running a second time and clobbering
  // newer state.
  saveProfile('o', { userId: 'o', chat: [], agents: [{ id: 'a1', name: 'renamed since' }] });
  writeDataFile(dir, 'agents.json', { o: { userId: 'o', chat: [], agents: [{ id: 'a1', name: 'Ace' }] } });
  _closeForTests();
  openStore();
  assert.equal(loadAgentStore().o.agents[0].name, 'renamed since', 'live state wins over a re-appeared JSON file');
  assert.ok(fs.existsSync(path.join(dir, 'data', 'agents.json')), 'the re-appeared file is left alone, not retired again');
});

// Regression: booting the real server used to migrate whatever data/ happened
// to be next to the cwd it was spawned in, and scripts/verify-cache-headers.js
// spawned it with cwd=ROOT — so `npm test` renamed the developer's live
// agents.json out from under them. The store must never reach outside its cwd.
test('SQLITE-1: booting the server in a scratch cwd never touches another data/', () => {
  const victim = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-victim-'));
  scratchDirs.push(victim);
  fs.mkdirSync(path.join(victim, 'data'), { recursive: true });
  const live = path.join(victim, 'data', 'agents.json');
  fs.writeFileSync(live, JSON.stringify({ o: { userId: 'o', chat: [], agents: [{ id: 'a1' }] } }), 'utf8');

  freshCwd();          // a different cwd entirely
  openStore();

  assert.ok(fs.existsSync(live), 'the other directory\'s agents.json is still there');
  assert.ok(!fs.existsSync(`${live}.migrated`), 'and was never migrated');
});

test('unreadable agents.json leaves the file in place and starts empty', () => {
  const dir = freshCwd();
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', 'agents.json'), '{ this is not json', 'utf8');

  openStore();

  assert.deepEqual(loadAgentStore(), {}, 'starts empty rather than crashing');
  assert.ok(fs.existsSync(path.join(dir, 'data', 'agents.json')), 'a file we could not read is never retired');
});

// TEST-4: an e2e verify script run BY HAND from the repo root resolves the real
// data/app.db, so the agents it builds outlive the run. Four runs later the
// fifth build comes back agentCap (or slotLocked, once SLOTS-1 put the second
// agent behind winnings) and every check fails on the last run's leftovers
// rather than on its own subject. deleteOwner is what lets a script start from
// nothing without anybody remembering to clear a database by hand.
test('TEST-4: deleteOwner removes one owner entirely', () => {
  freshCwd();
  openStore();

  saveProfile('e2e-victim', { userId: 'e2e-victim', chat: [], agents: [{ id: 'a1', name: 'Ghost' }] });
  saveWallet('e2e-victim', { ownerId: 'e2e-victim', balance: 500, earned: 250_000, ledger: [] });
  appendHandRow('e2e-victim', { id: 'h1', ts: Date.now() }, 100);

  assert.ok(loadAgentStore()['e2e-victim'], 'the fixture owner is there to begin with');

  deleteOwner('e2e-victim');

  assert.equal(loadAgentStore()['e2e-victim'], undefined, 'profile and agents are gone');
  assert.equal(loadWallet('e2e-victim'), null, 'the wallet is gone, so `earned` cannot unlock a later run');
  assert.deepEqual(readHandRows('e2e-victim', 10), [], 'and the hands with it');
});

// The whole reason it takes an exact id and not a prefix: data/ on a laptop is
// a real ledger (verify-chips.js asserts against it), and a delete that reaches
// past the id it was handed is the one bug this helper must not have.
test('TEST-4: deleteOwner touches nobody else', () => {
  freshCwd();
  openStore();

  saveProfile('e2e-multi-seat-user', { userId: 'e2e-multi-seat-user', chat: [], agents: [{ id: 'a1' }] });
  saveProfile('e2e-multi-seat-user-2', { userId: 'e2e-multi-seat-user-2', chat: [], agents: [{ id: 'a2' }] });
  saveProfile('jens', { userId: 'jens', chat: [], agents: [{ id: 'real' }] });
  saveWallet('jens', { ownerId: 'jens', balance: 12_345, earned: 0, ledger: [] });

  deleteOwner('e2e-multi-seat-user');

  const store = loadAgentStore();
  assert.equal(store['e2e-multi-seat-user'], undefined, 'the named owner went');
  assert.ok(store['e2e-multi-seat-user-2'], 'an owner it is a PREFIX of stayed');
  assert.ok(store.jens, 'and a real one was never in range');
  assert.equal(loadWallet('jens').balance, 12_345, 'with his bankroll untouched');
});
