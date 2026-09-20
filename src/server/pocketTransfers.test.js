// BUG-280: transfers operate on the uncommitted pocket, never a live buy-in.
// Native signed routes, SQLite, paid Table/Game and ledger; no model calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-pocket-transfer-token';
process.env.NOTIFY_ENABLED = '0';
const original = process.cwd(), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-pocket-transfer-'));
process.chdir(scratch);
const { watchReturnHarness } = await import('../test/helpers/watchReturnHarness.js');
const registry = await import('./tableRegistry.js');
const profiles = await import('./agentProfiles.js');
const store = await import('./store.js');
const harness = await watchReturnHarness();
test.after(async () => {
  await harness.stop(); process.chdir(original);
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
});

async function transfer(route, body, asOwner = harness.owner) {
  const response = await fetch(`${harness.base}/api/agents/${harness.agentId}/${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(asOwner ? { 'x-telegram-init-data': harness.credential(asOwner) } : {}) },
    body: JSON.stringify({ userId: harness.owner, ...body }),
  });
  return { status: response.status, body: await response.json() };
}

test('BUG-280: any whole-chip funding and pocket take preserve the live hand, paid receipt and total money', async () => {
  const start = harness.seed();
  const table = registry.tableOfAgent(harness.agentId);
  const game = structuredClone(table.game.getState());
  const total = start.safe + start.pocket.balance;
  const paid = structuredClone(start.pocket.openBuyIns);
  const policy = { mode: start.pocket.mode, cap: start.pocket.cap, recall: start.pocket.recall };
  const assertIntact = () => {
    const now = harness.state();
    assert.deepEqual(table.game.getState(), game, 'no action, chip or card at the felt changed');
    assert.deepEqual(now.pocket.openBuyIns, paid, 'buy-in remains owed to this session');
    assert.equal(now.activeTableId, start.tableId);
    assert.equal(now.pending, false, 'a pocket transfer must not request a departure');
    assert.equal(now.safe + now.pocket.balance, total, 'safe plus pocket is conserved');
    assert.deepEqual({ mode: now.pocket.mode, cap: now.pocket.cap, recall: now.pocket.recall }, policy);
    return now;
  };

  for (const amount of [1, 137, 2341]) {
    // Omitting mode/cap preserves backing policy: the API does not impose a
    // rung-size minimum or a preset limit on a plain transfer.
    const given = await transfer('fund', { amount, cap: policy.cap });
    assert.equal(given.status, 200, JSON.stringify(given.body));
    assert.equal(given.body.moved, amount);
    assertIntact();
    const taken = await transfer('collect', { all: true, amount });
    assert.equal(taken.status, 200, JSON.stringify(taken.body));
    assert.equal(taken.body.moved, amount);
    assertIntact();
  }
  const all = await transfer('collect', { all: true });
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.equal(all.body.moved, start.pocket.balance);
  const empty = assertIntact();
  assert.equal(empty.pocket.balance, 0);
  assert.equal(empty.safe, total);
  assert.equal((await transfer('collect', { all: true })).status, 400, 'no route to take the paid buy-in');
  assertIntact();
  const ledger = store.loadWallet(harness.owner).ledger;
  assert.equal(ledger.filter(e => e.type === 'fund').reduce((n, e) => n + e.amount, 0), -2479);
  assert.equal(ledger.filter(e => e.type === 'collect').reduce((n, e) => n + e.amount, 0), 2479 + start.pocket.balance);
  const persisted = store.loadProfile(harness.owner).agents.find(a => a.id === harness.agentId).pocket;
  assert.deepEqual(persisted, empty.pocket, 'ledger and receipt survive a persistence read');
});

test('BUG-280: missing/wrong owner cannot give or take pocket money', async () => {
  const start = harness.seed();
  for (const owner of [null, '25902']) for (const route of ['fund', 'collect']) {
    const reply = await transfer(route, { amount: 137, all: true }, owner);
    assert.equal(reply.status, owner ? 403 : 401);
  }
  const after = harness.state();
  assert.equal(after.safe, start.safe);
  assert.deepEqual(after.pocket, start.pocket);
  assert.equal(after.pending, false);
});

test('BUG-280: a paid 50/100 seat starts at 100bb regardless of the larger pocket', () => {
  harness.seed();
  registry.resetRegistry('seed high-stakes proof');
  const record = profiles._agentRecordForTests(harness.agentId, harness.owner);
  record.activeTableId = null;
  record.status = 'idle';
  record.pocket.balance = 30000;
  record.pocket.openBuyIns = [];
  record.pocket.ledger = [];
  record.pocket.mode = 'allowance';
  const deployed = profiles.deployAgent(harness.owner, harness.agentId, { body: { rung: 2 } });
  assert.equal(deployed.status, 200, JSON.stringify(deployed.body));
  const table = registry.tableOfAgent(harness.agentId);
  table._maybeRunAiTurn = async () => {};
  table._clearTimers();
  const seat = table.seatOfAgent(harness.agentId);
  assert.equal(table.bigBlind, 100);
  assert.equal(table._seatBuyIn(seat), 10000);
  assert.equal(table.seatStack(seat), 10000);
  assert.equal(record.pocket.balance, 20000, 'larger pocket does not enlarge the buy-in');
  assert.equal(record.pocket.openBuyIns.at(-1).amount, 10000);
});
