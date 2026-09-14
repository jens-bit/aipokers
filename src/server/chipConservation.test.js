// src/server/chipConservation.test.js — MONEY-1 job 3
//
// THE LAW THIS FILE EXISTS TO ENFORCE:
//
//     SUM(safes) + SUM(pockets) + houseBank  is the same number before and
//     after anything that happens to a chip.
//
// Not "roughly the same", and not "the same for the paths we remembered to
// check". Every test here reads that one total before an event and after it and
// asserts equality, so a future change that invents a chip anywhere fails here
// rather than being noticed in a playtest six weeks later, which is how the
// 30,000-chip stacks in read-me-claude/MONEY_AUDIT.md got there.
//
// Why table stacks are not in the sum: a stack is a CLAIM against the bank. A
// buy-in moves pocket -> bank and a cash-out moves bank -> pocket, so a seated
// agent's chips are already inside `houseBank`. See houseBank.js, and
// auditChips() in scripts/audit-chips.js, which is the same arithmetic the
// command-line audit prints.
//
// Six events, one per the queue: buy-in, bust, win, leave mid-hand, table
// close, server restart.
//
// No model calls, no sockets, no HTTP. Real Tables with the deal scheduler
// stopped, so hands happen exactly when this file says they do.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-conserve-'));

let store, profiles, bank, Table, audit;
const tables = new Map();

const OWNERS = ['con-buyin', 'con-bust', 'con-win', 'con-leave', 'con-close', 'con-restart', 'con-poor', 'con-double'];

const seedAgent = (id, balance = 6_000) => ({
  id, name: id, status: 'idle', activeTableId: null,
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
  ({ Table } = await import('./table.js'));
  audit = await import('../../scripts/audit-chips.js');
});

after(() => {
  store._closeForTests();
  process.chdir(originalCwd);
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

/**
 * Every chip in the world, read back out of SQLite so what is asserted is what
 * is persisted rather than what happens to be in memory.
 */
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

function makeOwner(owner, balance = 6_000, safe = 4_000) {
  store.saveWallet(owner, { ownerId: owner, balance: safe, ledger: [] });
  store.saveProfile(owner, { userId: owner, chat: [], agents: [seedAgent(owner, balance)] });
  profiles.reloadOwners(owner);
}

function createTable(tableId, options = {}) {
  const table = new Table({ tableId, smallBlind: 10, bigBlind: 20, ...options, onEmpty: (id) => tables.delete(id) });
  // No autonomous dealing: every hand in this file is one the test asked for.
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
  });
}

const record = (owner) => profiles._agentRecordForTests(owner, owner);

// ── 1. a buy-in ─────────────────────────────────────────────────────────────

test('MONEY-1: a buy-in moves chips, it does not make them', () => {
  makeOwner('con-buyin');
  provider();
  const bankBefore = bank.balance();

  const result = conserves('buy-in', () => profiles.deployAgent('con-buyin', 'con-buyin', { body: { rung: 0 } }));
  assert.equal(result.status, 200, JSON.stringify(result.body));

  const agent = record('con-buyin');
  assert.equal(agent.pocket.balance, 4_000, 'the entry buy-in left his pocket');
  assert.equal(bank.balance(), bankBefore + 2_000, 'and arrived in the bank');

  const table = tables.get(result.body.tableId);
  assert.equal(table.seatStack(0), 2_000, 'the seat holds exactly what was debited');
});

test('MONEY-1: a pocket that cannot cover the buy-in is refused, never granted', () => {
  // 1,900 is below the entry rung's 2,000 and this pocket does not auto-refill.
  makeOwner('con-poor', 1_900, 0);
  provider();

  const before = total();
  const result = profiles.deployAgent('con-poor', 'con-poor');
  assert.equal(result.status, 402, JSON.stringify(result.body));
  assert.equal(result.body.broke, true);
  assert.ok(String(result.body.error).length > 0, 'and says why');
  assert.equal(total(), before, 'a refusal moves nothing');
  assert.equal(record('con-poor').activeTableId, null, 'and seats nobody');
  assert.equal(tables.size, 0);
});

test('MONEY-1: chargeSeatBuyIn refuses over-drawing with both numbers named', () => {
  makeOwner('con-poor', 500, 0);
  const before = total();
  const r = profiles.chargeSeatBuyIn('con-poor', 'con-poor', { amount: 2_000, tableId: 't-nope' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /500/);
  assert.match(r.reason, /2,000/);
  assert.equal(total(), before);
});

// ── 2. a bust ───────────────────────────────────────────────────────────────

test('MONEY-1: busting conserves — the house keeps what he lost', () => {
  makeOwner('con-bust');
  provider();
  const deploy = profiles.deployAgent('con-bust', 'con-bust', { body: { rung: 0 } });
  const table = tables.get(deploy.body.tableId);
  const bankAfterBuyIn = bank.balance();

  conserves('bust', () => {
    // He loses the lot to the seat opposite. The engine moves the chips; this
    // just puts the table where a lost hand would have left it.
    table.seatStacks[0] = 0;
    table.seatStacks[1] = 4_000;
    table._reconcileSeats();
  });

  const agent = record('con-bust');
  assert.equal(agent.pocket.balance, 4_000, 'the pocket keeps only what never went to the table');
  assert.equal(agent.activeTableId, null, 'and the seat is released');
  assert.equal(bank.balance(), bankAfterBuyIn, 'the bank paid out nothing — it kept his buy-in');
});

// ── 3. a win ────────────────────────────────────────────────────────────────

test('MONEY-1: winning conserves — the house pays what he won', () => {
  makeOwner('con-win');
  provider();
  const deploy = profiles.deployAgent('con-win', 'con-win', { body: { rung: 0 } });
  const table = tables.get(deploy.body.tableId);
  const bankAfterBuyIn = bank.balance();

  conserves('win', () => {
    // He takes the whole felt, then stands up.
    table.seatStacks[0] = 4_000;
    table.seatStacks[1] = 0;
    table._reconcileSeats();
    table.seatLeaving[0] = true;
    table._reconcileSeats();
  });

  const agent = record('con-win');
  assert.equal(agent.pocket.balance, 8_000, '4,000 left in the pocket plus 4,000 brought home');
  assert.equal(bank.balance(), bankAfterBuyIn - 4_000, 'and the bank is exactly that much lighter');
});

test('MONEY-1: the House refilling the felt no longer mints a buy-in', () => {
  makeOwner('con-win');
  provider();
  const deploy = profiles.deployAgent('con-win', 'con-win', { body: { rung: 0 } });
  const table = tables.get(deploy.body.tableId);

  // The playtest's own shape: bust the opponent three times over, each of which
  // used to drop a fresh, unfunded 2,000 onto the felt (MONEY_AUDIT.md §6.1).
  let stack = 4_000;
  conserves('three busted Houses', () => {
    for (let i = 0; i < 3; i++) {
      table.seatStacks[0] = stack;
      table.seatStacks[1] = 0;
      table._reconcileSeats();
      table._seatHouseRegulars(2);
      stack += 2_000;
    }
    table.seatStacks[0] = stack;
    table.seatLeaving[0] = true;
    table._reconcileSeats();
  });

  const agent = record('con-win');
  assert.ok(agent.pocket.balance > 6_000, 'he really did win, and is paid for it');
  // The chips he was paid came out of the bank, which is the whole difference.
});

// ── 4. leaving mid-hand ─────────────────────────────────────────────────────

test('MONEY-1: leaving mid-hand conserves, and settles once the hand ends', () => {
  makeOwner('con-leave');
  provider();
  const deploy = profiles.deployAgent('con-leave', 'con-leave', { body: { rung: 0 } });
  const table = tables.get(deploy.body.tableId);

  // Put a hand in the air so the departure has something to finish.
  table.maybeStartHand();
  assert.equal(table.handInProgress(), true, 'a hand is running');

  const midHand = conserves('sit out mid-hand', () => table.sitOutSeat(0, { afterHand: true }));
  assert.equal(midHand.pending, true, 'he finishes the hand he is in');
  assert.equal(record('con-leave').activeTableId, deploy.body.tableId, 'and is still in the chair');

  conserves('the hand ends and he stands up', () => {
    // The hand finishes. _finishCompletedHand is what turns a bench into a
    // departure (table.js: _benchAfterHand -> seatLeaving), and the reconcile
    // after it is what frees the seat and runs the ceremony.
    table.game.street = 'complete';   // Streets.COMPLETE
    table.game.seats[0].stack = 2_500;
    table.game.seats[1].stack = 1_500;
    table._finishCompletedHand();
  });
  assert.equal(record('con-leave').activeTableId, null, 'now the seat is released');
});

test('MONEY-1: POST /finish does not strand a buy-in (it used to pay twice)', () => {
  makeOwner('con-double');
  provider();
  const deploy = profiles.deployAgent('con-double', 'con-double', { body: { rung: 0 } });
  const table = tables.get(deploy.body.tableId);
  const agentId = 'con-double';

  // Settle the stay the way a table close does.
  conserves('first settlement', () => {
    table.seatStacks[0] = 3_000;
    table.seatLeaving[0] = true;
    table._reconcileSeats();
  });
  const paidOnce = record(agentId).pocket.balance;

  // A second ceremony for the same seat must find nothing owed. Before the
  // open-stay check this credited the pocket all over again.
  conserves('a second settlement for one buy-in', () => {
    profiles.finishAgentSession(agentId, 'con-double', {
      recap: 'again', sessionPnl: 1_000, finalStack: 3_000,
      buyInAmount: 2_000, tableId: deploy.body.tableId,
    });
  });
  assert.equal(record(agentId).pocket.balance, paidOnce, 'and pays nothing the second time');
});

// ── 5. the table closing ────────────────────────────────────────────────────

test('MONEY-1: closing a table conserves, whatever is in front of whom', () => {
  makeOwner('con-close');
  provider();
  const deploy = profiles.deployAgent('con-close', 'con-close', { body: { rung: 0 } });
  const table = tables.get(deploy.body.tableId);

  conserves('table close', () => {
    table.seatStacks[0] = 3_250;
    table.seatStacks[1] = 750;
    table.closeTable('the room closed for the night');
  });

  const agent = record('con-close');
  assert.equal(agent.pocket.balance, 4_000 + 3_250, 'he is paid what he was sitting behind');
  assert.equal(agent.activeTableId, null);
});

// ── 6. a server restart ─────────────────────────────────────────────────────

test('MONEY-1: a restart voids the stay and gives the buy-in back', () => {
  makeOwner('con-restart');
  provider();
  const deploy = profiles.deployAgent('con-restart', 'con-restart', { body: { rung: 0 } });
  const table = tables.get(deploy.body.tableId);
  assert.equal(record('con-restart').pocket.balance, 4_000);

  // He is up when the lights go out. Nobody knows that afterwards, and nothing
  // persists it — which is the point.
  table.seatStacks[0] = 5_000;

  conserves('the process dies and comes back', () => {
    // A restart is: the registry is gone, and boot reconciles the records.
    tables.clear();
    profiles.setLiveTableProvider({
      MAX_CONCURRENT_TABLES: 10,
      countAutonomousTables: () => 0,
      hasTable: () => false,
      getTable: () => null,
      findJoinableTable: () => null,
      getOrCreateTable: createTable,
    });
    // Every stale session in the scratch database is reconciled, not only
    // this one — earlier tests here leave their own. The conservation wrapper
    // covers all of them at once, which is the stronger claim.
    const retired = profiles.reconcileActiveSessions();
    assert.ok(retired >= 1, `at least this stale session is retired (saw ${retired})`);
  });

  const agent = record('con-restart');
  assert.equal(agent.activeTableId, null);
  assert.equal(agent.status, 'idle');
  assert.equal(agent.pocket.balance, 6_000,
    'the stay is VOIDED, not settled: he gets his buy-in back, not the 5,000 nobody can prove');
});

// ── the invariant itself ────────────────────────────────────────────────────

test('MONEY-1: the bank is the only counterparty, and take/pay are exact', () => {
  const start = bank.balance();
  bank.take(1_234, 'test');
  assert.equal(bank.balance(), start + 1_234);
  bank.pay(1_234, 'test');
  assert.equal(bank.balance(), start, 'a round trip leaves no residue');
  bank.take(-5, 'nonsense');
  assert.equal(bank.balance(), start, 'and nonsense moves nothing');
});

test('MONEY-1: the bank survives a reopen of the database', () => {
  bank.reset(4_242_424);
  store._closeForTests();
  bank._forgetForTests();
  assert.equal(bank.balance(), 4_242_424, 'read back off disk, not out of the cache');
  bank.reset(bank.HOUSE_FLOAT ?? 50_000_000);
});
