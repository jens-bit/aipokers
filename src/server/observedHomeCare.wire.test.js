import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { WebSocket } from 'ws';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY; delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-home-care-regression';
process.env.NOTIFY_ENABLED = '0';
const originalCwd = process.cwd(), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-home-care-wire-'));
process.chdir(scratch);
const { homeCareHarness } = await import('../test/helpers/homeCareHarness.js');
after(() => { process.chdir(originalCwd); assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir())); fs.rmSync(scratch, { recursive: true, force: true }); });

async function connect(h, id) {
  const ws = new WebSocket(h.base.replace('http:', 'ws:')); const messages = [];
  ws.on('message', raw => messages.push(JSON.parse(raw)));
  await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  ws.send(JSON.stringify({ type: 'floor_sub', userId: h.owner, initData: h.credential(id) }));
  await until(() => messages.some(m => m.type === 'home_state'));
  // A ping/pong boundary makes preceding observation frames authoritative.
  return { ws, messages, async observe(visible) {
    const count = messages.filter(m => m.type === 'pong').length;
    ws.send(JSON.stringify({ type: 'home_observe', visible, userId: 'ignored-other-owner' }));
    ws.send(JSON.stringify({ type: 'ping' }));
    await until(() => messages.filter(m => m.type === 'pong').length > count);
  } };
}
async function until(check) {
  const end = Date.now() + 3000;
  while (!check()) { assert.ok(Date.now() < end, 'expected native wire reply'); await new Promise(r => setTimeout(r, 10)); }
}
test('BUG-279: signed Home observation owns consumption; two tabs, forged owner and disconnect cannot spend twice', async () => {
  const h = await homeCareHarness();
  try {
    h.seed();
    const forged = await connect(h, 'someone-else'); await forged.observe(true);
    assert.equal(h.state().snacks, 3);
    const first = await connect(h, h.owner), second = await connect(h, h.owner);
    await Promise.all([first.observe(true), second.observe(true)]);
    assert.equal(h.state().snacks, 2);
    assert.ok(first.messages.some(m => m.type === 'home_state' && m.agents.some(a => a.homeItem?.item === 'snack')));
    assert.ok(forged.messages.filter(m => m.type === 'home_state').every(m => m.agents.every(a => !a.homeItem)), 'private item history stays owner scoped');
    await first.observe(false); await second.observe(false);
    first.ws.terminate(); second.ws.terminate();
    h.record().homeItem.at -= 6001;
    await forged.observe(true);
    assert.equal(h.state().snacks, 2, 'a connected unproved observer does not inherit a closed owner lease');
  } finally { await h.stop(); }
});
test('BUG-279: an empty fridge request leads to real stock, two visible meals and cleared deployment refusal', async () => {
  const h = await homeCareHarness();
  try {
    h.seed(0); const owner = await connect(h, h.owner); await owner.observe(true);
    assert.equal(h.state().want.needs, 'stock');
    const res = await fetch(`${h.base}/api/fridge/stock`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-init-data': h.credential() },
      body: JSON.stringify({ userId: h.owner, item: 'snack', qty: 2 }) });
    assert.equal(res.status, 200, await res.text());
    const bought = h.state(); assert.equal(bought.snacks, 2); assert.ok(bought.safe < 10000);
    assert.equal(bought.left < 21, true, 'buying stock does not silently consume it');
    await owner.observe(true); assert.equal(h.state().snacks, 1);
    h.record().homeItem.at -= 6001;
    await owner.observe(true);
    const after = h.state(); assert.equal(after.snacks, 0); assert.equal(after.safe, bought.safe);
    assert.equal(after.refusal, null); assert.equal(after.tableId, null, 'the meal is not interrupted by automatic seating');
  } finally { await h.stop(); }
});
