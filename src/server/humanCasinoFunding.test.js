import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-human-funding-regression';
process.env.NOTIFY_ENABLED = '0';
const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-human-funding-'));
process.chdir(scratch);
const { watchReturnHarness } = await import('../test/helpers/watchReturnHarness.js');
const registry = await import('./tableRegistry.js');
after(() => {
  process.chdir(originalCwd);
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
});

test('BUG-270: a signed human cannot inject an unfunded buy-in into an owned casino session', async () => {
  const harness = await watchReturnHarness();
  let ws;
  try {
    const before = harness.seed();
    const table = registry.getTable(before.tableId);
    const seats = structuredClone(table.pending);
    const stacks = [...table.seatStacks];
    ws = new WebSocket(harness.base.replace('http:', 'ws:'));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const answer = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('JOIN produced no admission reply')), 3000);
      ws.on('message', raw => {
        const message = JSON.parse(raw);
        if (message.type === 'joined' || message.type === 'error') { clearTimeout(timeout); resolve(message); }
      });
    });
    ws.send(JSON.stringify({ type: 'join', tableId: before.tableId,
      playerId: 'unfunded-human', displayName: 'Human', userId: harness.owner,
      initData: harness.credential(), buyIn: 2_000_000, wantAI: false }));
    const response = await answer;
    assert.equal(response.type, 'error', JSON.stringify(response));
    assert.match(response.message ?? response.error ?? '', /home|kitchen|practice|fund/i);
    assert.deepEqual(table.pending, seats, 'a refusal reserves no human seat');
    assert.deepEqual(table.seatStacks, stacks, 'a refusal adds no chips to a funded table');
    const after = harness.state();
    assert.equal(after.safe, before.safe);
    assert.deepEqual(after.pocket, before.pocket);
    assert.equal(after.activeTableId, before.activeTableId);
  } finally {
    ws?.terminate();
    await harness.stop();
  }
});

test('BUG-270: a legacy nonhome JOIN cannot create a table or seat a funded agent through wantAI', async () => {
  const harness = await watchReturnHarness();
  let ws;
  try {
    const before = harness.seed();
    const tableCount = registry.tableCount();
    ws = new WebSocket(harness.base.replace('http:', 'ws:'));
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    const answer = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('JOIN produced no admission reply')), 3000);
      ws.on('message', raw => {
        const message = JSON.parse(raw);
        if (message.type === 'joined' || message.type === 'error') { clearTimeout(timeout); resolve(message); }
      });
    });
    ws.send(JSON.stringify({ type: 'join', tableId: 'unfunded-new-casino', playerId: 'unfunded-human',
      userId: harness.owner, initData: harness.credential(), buyIn: 2_000_000,
      wantAI: true, agentId: before.agentId, smallBlind: 10, bigBlind: 20 }));
    const response = await answer;
    assert.equal(response.type, 'error', JSON.stringify(response));
    assert.match(response.message, /Home table/);
    assert.equal(registry.getTable('unfunded-new-casino'), null);
    assert.equal(registry.tableCount(), tableCount);
    const after = harness.state();
    assert.equal(after.safe, before.safe);
    assert.deepEqual(after.pocket, before.pocket);
    assert.equal(after.activeTableId, before.activeTableId);
  } finally { ws?.terminate(); await harness.stop(); }
});
