delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-watch-return-identity-token';
process.env.NOTIFY_ENABLED = '0';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const original = process.cwd(), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-return-identity-'));
process.chdir(scratch);
const { watchReturnHarness } = await import('../test/helpers/watchReturnHarness.js');
const registry = await import('./tableRegistry.js');
const profiles = await import('./agentProfiles.js');
const harness = await watchReturnHarness();
test.after(async () => {
  await harness.stop(); process.chdir(original);
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
});
async function finish(expected = {}) {
  const response = await fetch(`${harness.base}/api/agents/${harness.agentId}/finish`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': harness.credential() },
    body: JSON.stringify({ userId: harness.owner, ...expected }) });
  return { status: response.status, body: await response.json() };
}
function identity() {
  const table = registry.tableOfAgent(harness.agentId);
  return { expectedTableId: table.tableId, expectedSessionId: table.sessionIdFor(harness.agentId) };
}
function assertUnmoved(before) {
  const now = harness.state();
  assert.equal(now.activeTableId, before.activeTableId);
  assert.equal(now.pending, false);
  assert.equal(now.folded, false);
  assert.deepEqual(now.pocket, before.pocket);
  assert.equal(now.safe, before.safe);
}

test('BUG-259: a delayed return cannot finish a newer table or another stay on the same table', async () => {
  harness.seed();
  const previous = identity();
  assert.equal((await finish(previous)).status, 200);
  harness.settle();
  const next = harness.seed();
  assert.notEqual(next.tableId, previous.expectedTableId);
  assert.equal((await finish(previous)).status, 409);
  assertUnmoved(next);
  // A table match alone is insufficient: the same seat can host another stay.
  assert.equal((await finish({ expectedTableId: next.tableId, expectedSessionId: previous.expectedSessionId })).status, 409);
  assertUnmoved(next);
});

test('BUG-259: exact return identity is repeatable while pending and never settles twice', async () => {
  const before = harness.seed(), expected = identity();
  assert.ok(expected.expectedSessionId);
  assert.equal((await finish(expected)).status, 200);
  assert.equal((await finish(expected)).status, 200);
  assert.deepEqual(harness.state().pocket, before.pocket);
  const settled = harness.settle();
  assert.equal(settled.activeTableId, null);
  assert.equal(settled.pocket.ledger.filter(entry => entry.type === 'cashout').length, 1);
  assert.equal((await finish(expected)).status, 409, 'the ended stay is no longer a live mutation target');
  assert.deepEqual(harness.state().pocket, settled.pocket);
});

test('BUG-259: return resolves the real live seat when the stored table pointer is stale', async () => {
  const before = harness.seed(), expected = identity();
  const agent = profiles._agentRecordForTests(harness.agentId, harness.owner);
  agent.activeTableId = null;
  const result = await finish(expected);
  assert.equal(result.status, 200);
  assert.equal(result.body.activeTableId, before.tableId);
  assert.equal(result.body.returnPending, true);
  assert.deepEqual(harness.state().pocket, before.pocket, 'live chips cannot be refunded via stale metadata');
  harness.settle();
  assert.equal(harness.state().activeTableId, null);
});

test('BUG-259: a failed live seat release is retryable and never refunds chips still at the table', async () => {
  const before = harness.seed();
  const table = registry.tableOfAgent(harness.agentId), sitOut = table.sitOutSeat;
  table.sitOutSeat = () => { throw new Error('synthetic release failure'); };
  try {
    const result = await finish(); // Legacy callers retain current-session semantics.
    assert.equal(result.status, 503);
    assert.match(result.body.error, /try again/i);
    assertUnmoved(before);
  } finally { table.sitOutSeat = sitOut; }
  assert.equal((await finish()).status, 200);
  const settled = harness.settle();
  assert.equal(settled.pocket.ledger.filter(entry => entry.type === 'cashout').length, 1);
});

test('BUG-259: malformed optional return identity is rejected before changing a seat', async () => {
  const before = harness.seed();
  for (const expected of [{ expectedTableId: 12 }, { expectedSessionId: '' }]) {
    assert.equal((await finish(expected)).status, 400);
    assertUnmoved(before);
  }
});
