// src/server/money2Rake.test.js — MONEY-2 job 3
//
// The rake, against the law MONEY-1 wrote down:
//
//     SUM(safes) + SUM(pockets) + houseBank  never changes.
//
// A rake is the first thing in this product that deliberately moves chips OUT
// of owner hands and into the house's, so it is exactly the kind of change that
// could quietly break that sum in either direction — by minting (taking it off
// the stack AND crediting the bank, which is the same chips counted twice) or
// by destroying (taking it off the stack and never letting the bank keep it).
//
// It also has to be VISIBLE, which is half the job: a line in the safe ledger
// with a real amount, and a pocket ledger that still sums to the pocket balance
// so `scripts/audit-chips.js` reconciles.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-money2rake-'));
const savedEnv = Object.fromEntries(
  ['TELEGRAM_BOT_TOKEN', 'DEV_API_SECRET', 'RAKE_PERCENT', 'RAKE_CAP_BB'].map(k => [k, process.env[k]]));

let store, profiles, bank, wallet, Table, audit;
const tables = new Map();

const seedAgent = (id, balance) => ({
  id, name: id, status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'Play carefully.', bankroll: balance,
  pocket: { agentId: id, balance, mode: 'allowance', cap: null, realised: 0, ledger: [], recall: false },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  mood: { state: 'neutral', heat: 30 }, stats: { handsPlayed: 0, handsWon: 0 },
  sessionLog: [], ledger: [],
});

before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  process.env.RAKE_PERCENT = '5';
  process.env.RAKE_CAP_BB = '10';
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(scratch);
  bank = await import('./houseBank.js');
  profiles = await import('./agentProfiles.js');
  wallet = await import('./wallet.js');
  ({ Table } = await import('./table.js'));
  audit = await import('../../scripts/audit-chips.js');
});

after(() => {
  store._closeForTests();
  process.chdir(originalCwd);
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
});

beforeEach(() => {
  for (const table of [...tables.values()]) {
    table.agentIds.fill(null);
    try { table.closeTable('fixture disposed'); } catch { /* already gone */ }
  }
  tables.clear();
  profiles.setLiveTableProvider(null);
  process.env.RAKE_PERCENT = '5';
  process.env.RAKE_CAP_BB = '10';
});

function total() {
  const owners = store.listOwners().map((ownerId) => ({
    ownerId,
    wallet: store.loadWallet(ownerId) ?? { balance: 0, ledger: [] },
    agents: store.loadProfile(ownerId)?.agents ?? [],
  }));
  return audit.auditChips(owners, { houseBank: bank.balance() }).totals.chipsInExistence;
}

function makeOwner(owner, balance = 6_000, safe = 4_000) {
  store.saveWallet(owner, { ownerId: owner, balance: safe, ledger: [] });
  store.saveProfile(owner, { userId: owner, chat: [], agents: [seedAgent(owner, balance)] });
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

/** Deploy him, then rake `amount` off his seat as though he had won pots. */
function seatAndRake(owner, rake) {
  const deploy = profiles.deployAgent(owner, owner, { body: { rung: 0 } });
  assert.equal(deploy.status, 200, JSON.stringify(deploy.body));
  const table = tables.get(deploy.body.tableId);
  return { table, deploy };
}

// ── conservation ────────────────────────────────────────────────────────────

test('MONEY-2: a raked session conserves — the house keeps the cut, nobody mints it', () => {
  makeOwner('rk-conserve');
  provider();
  const before = total();

  const { table } = seatAndRake('rk-conserve');
  const bankAfterBuyIn = bank.balance();
  assert.equal(total(), before, 'the buy-in alone conserves');

  // He wins the felt, and the house takes 200 off the pots on the way.
  table.seatStacks[0] = 3_800;
  table.seatStacks[1] = 0;
  table.seatRake[0] = 200;
  table._reconcileSeats();
  table.seatLeaving[0] = true;
  table._reconcileSeats();

  assert.equal(total(), before, 'the whole raked session conserves');
  const agent = record('rk-conserve');
  assert.equal(agent.pocket.balance, 4_000 + 3_800,
    'he takes home what was in front of him — the cut had already left it');
  assert.equal(bank.balance(), bankAfterBuyIn - 3_800,
    'and the cage is lighter by exactly what it paid, keeping the 200 it raked');
});

test('MONEY-2: the rake is the difference between what the felt held and what the cage paid', () => {
  makeOwner('rk-cage');
  provider();
  const { table } = seatAndRake('rk-cage');
  const bankAfterBuyIn = bank.balance();

  // Two runs at the same felt, one raked and one not, from the same buy-in.
  table.seatStacks[0] = 3_000;
  table.seatRake[0] = 0;
  table.seatLeaving[0] = true;
  table._reconcileSeats();
  const unrakedCost = bankAfterBuyIn - bank.balance();

  makeOwner('rk-cage-2');
  const second = seatAndRake('rk-cage-2');
  const bankBefore2 = bank.balance();
  second.table.seatStacks[0] = 3_000;
  second.table.seatRake[0] = 250;
  second.table.seatLeaving[0] = true;
  second.table._reconcileSeats();
  const rakedCost = bankBefore2 - bank.balance();

  assert.equal(unrakedCost, 3_000);
  assert.equal(rakedCost, 3_000, 'the cage pays the same out of pocket either way…');
  // …because the 250 never reached the stack in the first place. What the rake
  // buys the house is that the stack was 250 smaller than it would have been,
  // which is measured on the felt (rake.test.js), not here.
  assert.equal(record('rk-cage-2').pocket.balance, 4_000 + 3_000);
});

// ── visibility ──────────────────────────────────────────────────────────────

test('MONEY-2: the safe shows the cut as its own line, with its own amount', () => {
  makeOwner('rk-safe');
  provider();
  const { table } = seatAndRake('rk-safe');

  table.seatStacks[0] = 3_800;
  table.seatRake[0] = 200;
  table.seatLeaving[0] = true;
  table._reconcileSeats();

  const agent = record('rk-safe');
  const view = wallet.walletProjection(store.loadWallet('rk-safe'), [agent]);
  const rake = view.ledger.find((e) => e.type === 'rake');
  const cashout = view.ledger.find((e) => e.type === 'cashout');

  assert.ok(rake, 'the safe has a line for it');
  assert.equal(rake.amount, -200, 'naming the amount, as chips that left');
  assert.equal(rake.agentId, 'rk-safe', 'and whose pots it came off');
  assert.equal(cashout.amount, 4_000, 'the cash-out beside it is the GROSS he won…');
  assert.equal(agent.pocket.balance, 4_000 + 3_800, '…and what he actually kept is the difference');
});

test('MONEY-2: the pocket ledger still sums to the pocket, so the audit reconciles', () => {
  makeOwner('rk-audit');
  provider();

  // `diff` is (safe + pockets) − ledger, and this fixture's opening balances
  // were seeded straight into storage with empty ledgers — so the absolute
  // number is the seed and says nothing. What the rake must not do is MOVE it:
  // every chip it shifts has to be on a ledger line of its own.
  const row = (id) => audit.auditOwner(id, store.loadWallet(id), store.loadProfile(id).agents);
  const diffBefore = row('rk-audit').diff;

  const { table } = seatAndRake('rk-audit');
  table.seatStacks[0] = 3_800;
  table.seatRake[0] = 200;
  table.seatLeaving[0] = true;
  table._reconcileSeats();

  assert.equal(row('rk-audit').diff, diffBefore, 'the books still explain the money to the same chip');

  const agent = store.loadProfile('rk-audit').agents[0];
  const types = agent.pocket.ledger.map((e) => e.type);
  assert.deepEqual(types, ['buyin', 'cashout', 'rake'], 'three movements, three lines');
  assert.equal(agent.pocket.realised, 3_800 - 2_000, 'and the rake is P&L, not a transfer');
});

test('MONEY-2: takeRake never takes more than the pocket holds', () => {
  const pocket = wallet.emptyPocket({ balance: 50 });
  const out = wallet.takeRake(pocket, 500, 't-1');
  assert.equal(out.moved, 50);
  assert.equal(pocket.balance, 0);
  assert.equal(wallet.takeRake(pocket, 10, 't-1').ok, false, 'and an empty pocket owes nothing');
});

// ── the home game, end to end ───────────────────────────────────────────────

test('MONEY-2: a whole home session pays no rake and moves no money at all', () => {
  process.env.RAKE_PERCENT = '50';
  process.env.RAKE_CAP_BB = '1000';
  makeOwner('rk-home');
  const before = total();

  const table = createTable('home-rk-home', { home: true, homeOwnerId: 'rk-home', smallBlind: 1, bigBlind: 2 });
  table.startAgentSession({ agentId: 'rk-home', userId: 'rk-home', displayName: 'rk-home', buyIn: 200 });

  table.seatStacks[0] = 400;
  table.seatStacks[1] = 0;
  table._reconcileSeats();
  table.seatLeaving[0] = true;
  table._reconcileSeats();

  assert.equal(total(), before, 'the kitchen table is outside the economy in both directions');
  assert.equal(record('rk-home').pocket.balance, 6_000, 'his pocket never moved');
  assert.equal(table.seatRakePaid(0), 0, 'and the house took nothing');
});
