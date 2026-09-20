import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
process.env.TELEGRAM_BOT_TOKEN = '123456:bar-fixture';
process.env.NOTIFY_ENABLED = '0';
const cwd = process.cwd(), scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-bar-'));
process.chdir(scratch);
const store = await import('./store.js');
const profiles = await import('./agentProfiles.js');
const { Table } = await import('./table.js');
const { Game } = await import('../engine/game.js');
let table;
profiles.setLiveTableProvider({
  tableOfAgent: id => table?.agentIds.includes(id) ? table : null,
  getTable: id => table?.tableId === id ? table : null,
  hasTable: id => table?.tableId === id,
  isAgentActive: id => table?.agentIds.includes(id),
});
const app = express(); app.use(express.json()); profiles.installAgentProfileRoutes(app);
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
function signed(id = '9101') {
  const fields = { id, first_name: 'Bar', auth_date: String(Math.floor(Date.now() / 1000)) };
  const line = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const key = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  return { 'x-telegram-init-data': new URLSearchParams({ ...fields, hash: crypto.createHmac('sha256', key).update(line).digest('hex') }).toString() };
}
function seed({ stock = 1, balance = 1000, heat = 75 } = {}) {
  table?._clearTimers();
  store.saveWallet('9101', { balance, fridge: {beer: stock, snack: 0}, ledger: [] });
  store.saveProfile('9101', { userId: '9101', chat: [], agents: [{
    id: 'bar-bird', name: 'Moss', status: 'playing', activeTableId: 'bar-table',
    mood: {state: heat > 50 ? 'tilted' : 'neutral', heat}, stamina: {left: 35, at: Date.now(), stage:'worn'},
    pocket: {balance: 550, mode:'allowance', cap: 2000, realised:0, ledger:[]},
    attrs: { READS:50, FOCUS:50, DISCIPLINE:50, DECEPTION:50, COMPOSURE:50, STAMINA:50 },
  }] });
  profiles.reloadOwners('9101');
  table = new Table({tableId:'bar-table', smallBlind:50, bigBlind:100});
  table.pending[0] = {playerId:'agent_bar-bird', displayName:'Moss', buyIn:10000};
  table.pending[1] = {playerId:'house_ted', displayName:'Ted', buyIn:10000};
  table.agentIds[0] = 'bar-bird'; table.agentUserIds[0] = '9101';
  table.game = new Game({tableId:table.tableId,seats:[{playerId:'agent_bar-bird',stack:10000},{playerId:'house_ted',stack:10000}],smallBlind:50,bigBlind:100});
  table.game.startHand();
  return profiles.agentsOf('9101')[0];
}
const order = (body = {}, headers = signed()) => fetch(`${base}/api/agents/bar-bird/bar-order`, {
  method:'POST', headers:{'Content-Type':'application/json',...headers},
  body:JSON.stringify({userId:'9101',item:'beer',buyIfEmpty:false,orderId:'bar-order-1',...body}),
});
after(async () => {
  table?._clearTimers(); profiles.setLiveTableProvider(null);
  await new Promise(resolve => server.close(resolve)); store._closeForTests(); process.chdir(cwd);
  if (path.dirname(scratch) !== path.resolve(os.tmpdir())) throw new Error('Unsafe scratch path');
  fs.rmSync(scratch,{recursive:true,force:true});
});

test('BUG-281: serving existing stock costs no chips and preserves the exact live hand and pocket', async () => {
  const agent = seed(), pocket = structuredClone(agent.pocket), hand = structuredClone(table.game.getPublicState(0));
  const response = await order(); assert.equal(response.status,200);
  const data = await response.json();
  assert.equal(data.given,'beer'); assert.equal(data.spent,0); assert.equal(data.fridge.beer,0);
  assert.equal(store.loadWallet('9101').balance,1000);
  assert.deepEqual(store.loadProfile('9101').agents[0].pocket,pocket);
  assert.deepEqual(table.game.getPublicState(0),hand);
  assert.equal(table.closed,false); assert.equal(table.seatOfAgent('bar-bird'),0);
  assert.equal(data.agent.barOrders,undefined);
  const publicResponse=await fetch(`${base}/api/agents/bar-bird?userId=9101`,{headers:signed('9102')});
  assert.equal(publicResponse.status,200);
  const publicAgent=await publicResponse.json();
  assert.equal(publicAgent.id,'bar-bird');
  assert.equal(publicAgent.barOrders,undefined);
  assert.equal(JSON.stringify(publicAgent).includes('bar-order-1'),false);
});

test('BUG-281: buy and serve is one durable safe debit, with no surplus stock or second charge on retry', async () => {
  seed({stock:0});
  const response = await order({buyIfEmpty:true}); assert.equal(response.status,200);
  const data = await response.json(); assert.equal(data.spent,200); assert.equal(data.fridge.beer,0);
  assert.equal(store.loadWallet('9101').balance,800);
  profiles.reloadOwners('9101');
  const retry = await order({buyIfEmpty:true}); assert.equal(retry.status,200);
  assert.equal((await retry.json()).replayed,true);
  assert.equal(store.loadWallet('9101').balance,800);
  assert.equal(store.loadWallet('9101').ledger.filter(e=>e.type==='item').length,1);
  assert.equal((await order({item:'snack',buyIfEmpty:true})).status,409);
});

test('BUG-281: rejected help, missing stock, insufficient safe and foreign ownership never charge or consume', async () => {
  for (const scenario of [{heat:20,stock:0,status:400},{stock:0,status:409},{stock:0,balance:100,status:400}]) {
    seed(scenario);
    const wallet = store.loadWallet('9101');
    const response = await order({buyIfEmpty: scenario.heat === 20 || scenario.balance === 100});
    assert.equal(response.status,scenario.status); assert.deepEqual(store.loadWallet('9101'),wallet);
  }
  seed(); const wallet = store.loadWallet('9101');
  assert.equal((await order({},signed('9102'))).status,403);
  assert.equal((await order({},{})).status,401);
  assert.deepEqual(store.loadWallet('9101'),wallet);
});

test('BUG-281: a failed database commit rolls back the safe, stock, effect and receipt, then safely retries', async () => {
  const agent = seed({stock:0}), before = structuredClone(agent), wallet = store.loadWallet('9101');
  store.adminDb().exec("CREATE TRIGGER bar_write_failure BEFORE INSERT ON agents WHEN NEW.owner_id='9101' BEGIN SELECT RAISE(ABORT, 'bar fixture failure'); END");
  try {
    const response = await order({buyIfEmpty:true}); assert.equal(response.status,503);
    assert.deepEqual(agent,before); assert.deepEqual(store.loadWallet('9101'),wallet);
    assert.deepEqual(store.loadProfile('9101').agents[0].barOrders,undefined);
  } finally { store.adminDb().exec('DROP TRIGGER bar_write_failure'); }
  assert.equal((await order({buyIfEmpty:true})).status,200);
  assert.equal(store.loadWallet('9101').balance,800);
});

test('BUG-281: Home agents and malformed orders cannot be served as casino visitors', async () => {
  seed(); table.home = true;
  assert.equal((await order()).status,409);
  table.home = false;
  for (const body of [{item:'wine'},{orderId:''},{buyIfEmpty:'yes'}]) assert.equal((await order(body)).status,400);
  assert.equal(store.loadWallet('9101').fridge.beer,1);
});

test('BUG-281: a stale casino record cannot buy for an agent who no longer occupies its seat', async () => {
  seed({stock:0});table.agentIds[0]=null;
  const wallet=store.loadWallet('9101');
  assert.equal((await order({buyIfEmpty:true})).status,409);
  assert.deepEqual(store.loadWallet('9101'),wallet);
});

test('BUG-281: food restores only its fixed amount during a live hand, never hours of seated time as rest', async () => {
  const agent=seed({stock:0,heat:20});
  agent.stamina={left:35,at:Date.now()-4*3_600_000,stage:'worn'};
  profiles.saveOwner('9101');
  const hand=structuredClone(table.game.getPublicState(0));
  const response=await order({item:'snack',buyIfEmpty:true});
  assert.equal(response.status,200);
  assert.equal(store.loadProfile('9101').agents[0].stamina.left,60);
  assert.deepEqual(table.game.getPublicState(0),hand);
  assert.equal(store.loadWallet('9101').balance,900);
});
