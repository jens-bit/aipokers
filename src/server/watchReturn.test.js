delete process.env.ANTHROPIC_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-watch-return-token';
process.env.NOTIFY_ENABLED = '0';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const original = process.cwd(), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-return-'));
process.chdir(scratch);
const { watchReturnHarness } = await import('../test/helpers/watchReturnHarness.js');
const harness = await watchReturnHarness();
test.after(async () => {
  await harness.stop(); process.chdir(original);
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
});
async function finish(asOwner = harness.owner) {
  const response = await fetch(`${harness.base}/api/agents/${harness.agentId}/finish`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': harness.credential(asOwner) },
    body: JSON.stringify({ userId: harness.owner }) });
  return { status: response.status, body: await response.json() };
}
test('BUG-259: owner return is pending through a real hand and settles once without changing funding policy', async () => {
  const start = harness.seed();
  assert.equal(start.agent.returnPending, false);
  assert.equal(start.publicAgent.returnPending, undefined);
  const refused = await finish('25902');
  assert.equal(refused.status, 403);
  assert.equal(harness.state().pending, false);
  const reply = await finish();
  assert.equal(reply.status, 200);
  assert.equal(reply.body.returnPending, true);
  let state = harness.state();
  assert.equal(state.activeTableId, start.tableId);
  assert.equal(state.folded, false, 'return never folds the current hand');
  assert.deepEqual(state.pocket, start.pocket, 'no premature cash-out or funding change');
  assert.equal(state.safe, start.safe);
  assert.equal(state.publicAgent.returnPending, undefined);
  await finish();
  assert.deepEqual(harness.state().pocket, start.pocket, 'retry while pending does not move chips');
  state = harness.settle();
  assert.equal(state.activeTableId, null);
  assert.equal(state.agent.returnPending, false);
  assert.equal(state.pocket.mode, 'auto'); assert.equal(state.pocket.cap, 6000);
  assert.equal(state.safe, start.safe);
  assert.equal(state.pocket.ledger.filter(entry => entry.type === 'cashout').length, 1);
  const settledPocket = state.pocket;
  await finish();
  assert.deepEqual(harness.state().pocket, settledPocket, 'a late retry cannot settle twice');
});
