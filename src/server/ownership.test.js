import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import WebSocket from 'ws';

// Real HTTP routes, synthetic owners and signatures, isolated database. No paid calls.
delete process.env.ANTHROPIC_API_KEY;
const token = '123456:ownership-test-token';
process.env.TELEGRAM_BOT_TOKEN = token;
process.env.NOTIFY_ENABLED = '0';
process.env.RATE_LIMIT_CHAT_MAX = '100000';
const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-ownership-'));
process.chdir(scratch);
const { saveProfile, _closeForTests } = await import('./store.js');
for (const id of ['9001', '9002']) saveProfile(id, {
  userId: id, chat: [{ role: 'user', content: 'PRIVATE DRAFT' }],
  agents: [{ id: `agent-${id}`, name: 'Original', status: 'idle',
    sessionFlagged: [{ holeCards: ['As', 'Ad'], reasoning: 'PRIVATE REASONING',
      streets: [{ street: 'flop', reasoning: 'PRIVATE READ', equity: 92 }], attrCosts: [{ line: 'PRIVATE THOUGHT' }] }],
    memory: { privateNote: 'PRIVATE MEMORY' }, strategy: 'PRIVATE STRATEGY' }],
});
saveProfile('9003', { userId: '9003', agents: [], chat: [{ role: 'user', content: 'Patient, tight poker. Name him Flint.' }] });
const { installAgentProfileRoutes } = await import('./agentProfiles.js');
const { appendHand, installHandHistoryRoutes } = await import('./handHistory.js');
const { appendLine } = await import('./thread.js');
const { setGuestResolver } = await import('./auth.js');
appendLine({ sessionId: 'victim-session', agentId: 'agent-9001', ownerId: '9001',
  kind: 'him', who: 'HIM', text: 'PRIVATE THREAD' });
const app = express();
app.use(express.json());
installAgentProfileRoutes(app);
installHandHistoryRoutes(app);
const server = await new Promise(resolve => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
const { createServer } = await import('./wsServer.js');
const { wss, tables } = createServer({ server });
const observedWatches = [];
tables.set('ownership-table', {
  agentIds: ['agent-9001'],
  addSpectator(_ws, options) { observedWatches.push(options); return options.publicOnly ? -1 : 0; },
  sessionIdAtSeat() { return null; }, sendSnapshot() {}, maybeStartHand() {}, removeConnection() {},
});
after(async () => {
  for (const ws of wss.clients) ws.terminate();
  await new Promise(resolve => wss.close(resolve));
  await new Promise(resolve => server.close(resolve));
  _closeForTests();
  process.chdir(originalCwd);
  if (path.dirname(scratch) !== path.resolve(os.tmpdir())) throw new Error('Unsafe scratch path');
  fs.rmSync(scratch, { recursive: true, force: true });
});
function headers(id) {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), id, first_name: 'Test' };
  const text = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = crypto.createHash('sha256').update(token).digest();
  const hash = crypto.createHmac('sha256', key).update(text).digest('hex');
  return { 'x-telegram-init-data': new URLSearchParams({ ...fields, hash }).toString() };
}
const request = (route, method = 'GET', body, id) => fetch(base + route, {
  method, headers: { 'Content-Type': 'application/json', ...(id ? headers(id) : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

for (const [method, route] of [
  ['PATCH', '/agent-9001'], ['DELETE', '/agent-9001'],
  ...['deploy', 'queue', 'finish', 'seen', 'reload', 'proposal/accept', 'proposal/reject'].map(r => ['POST', `/agent-9001/${r}`]),
  ['POST', '/chat/reset'], ['POST', '/chat'], ['POST', '/build'],
]) test(`BUG-48: ${method} ${route} rejects another signed owner before mutation`, async () => {
  const response = await request(`/api/agents${route}?userId=9001`, method,
    method === 'DELETE' ? undefined : { userId: '9001', name: 'Stolen', content: 'make an agent' }, '9002');
  assert.equal(response.status, 403);
});

test('BUG-48: anonymous deploy is rejected and the true owner can rename', async () => {
  assert.equal((await request('/api/agents/agent-9001/deploy', 'POST', { userId: '9001' })).status, 401);
  const response = await request('/api/agents/agent-9001', 'PATCH', { userId: '9001', name: 'Owned' }, '9001');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).name, 'Owned');
});

test('BUG-48: conflicting body/query identities cannot bypass the owner check', async () => {
  assert.equal((await request('/api/agents/agent-9001?userId=9002', 'PATCH', { userId: '9001', name: 'Stolen' }, '9002')).status, 403);
});

test('BUG-48: guest ownership is exact even when Telegram is enabled', async () => {
  setGuestResolver(req => req.headers.cookie === 'fixture=guest' ? '9002' : null);
  try {
    const response = await fetch(base + '/api/agents/agent-9001', { method: 'PATCH',
      headers: { cookie: 'fixture=guest', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '9001', name: 'Stolen' }) });
    assert.equal(response.status, 403);
  } finally { setGuestResolver(null); }
});

for (const route of ['/api/agents?userId=9001', '/api/agent-profile?userId=9001', '/api/agents/agent-9001?userId=9001']) {
  test(`BUG-49: public projection hides private records on ${route}`, async () => {
    const response = await request(route, 'GET', undefined, '9002');
    assert.equal(response.status, 200);
    const text = await response.text();
    for (const secret of ['PRIVATE', '"As"', '"Ad"']) assert.ok(!text.includes(secret), text);
    assert.ok(text.includes('agent-9001'));
  });
}
test('BUG-49: owner still receives their own flagged cards', async () => {
  const response = await request('/api/agents?userId=9001', 'GET', undefined, '9001');
  assert.ok((await response.text()).includes('"As"'));
});
test('BUG-49: private memory requires ownership', async () => {
  assert.equal((await request('/api/agents/agent-9001/memory?userId=9001', 'GET', undefined, '9002')).status, 403);
});
test('BUG-49: public flagged hands hide private reasoning as well as cards', async () => {
  const response = await request('/api/agents/agent-9001/flagged?userId=9001', 'GET', undefined, '9002');
  assert.equal(response.status, 200);
  const hands = (await response.json()).flaggedHands;
  assert.equal(hands.length, 1);
  assert.deepEqual(hands[0].holeCards, []);
  assert.ok(!JSON.stringify(hands).includes('PRIVATE'));
  assert.equal(hands[0].streets[0].equity, null);
});
test('BUG-49: owning one agent cannot unlock another agent session', async () => {
  const response = await request('/api/agents/agent-9002/thread?userId=9002&session=victim-session', 'GET', undefined, '9002');
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).lines, []);
});

test('BUG-49: hand history is owner-only and never reveals an opponents hidden cards', async () => {
  appendHand('9001', { id: 'private-hand', players: [{ seat: 0, playerId: '9001' }, { seat: 1, playerId: '9002' }],
    holeCards: { 0: ['As', 'Ad'], 1: ['Kh', 'Kd'] },
    decisions: [{ seat: 1, action: { type: 'fold' }, reasoning: 'PRIVATE REASONING' }] });
  assert.equal((await request('/api/history/9001', 'GET', undefined, '9002')).status, 403);
  const response = await request('/api/history/9001', 'GET', undefined, '9001');
  assert.equal(response.status, 200);
  const hands = await response.json();
  assert.deepEqual(hands[0].holeCards, { 0: ['As', 'Ad'] });
  assert.ok(!JSON.stringify(hands).includes('PRIVATE'));
});

async function socketReply(message) {
  const ws = new WebSocket(base.replace('http:', 'ws:'));
  await new Promise(resolve => ws.once('open', resolve));
  const reply = new Promise((resolve, reject) => {
    ws.once('message', data => resolve(JSON.parse(data)));
    ws.once('error', reject);
  });
  ws.send(JSON.stringify(message));
  try { return await reply; } finally { ws.close(); }
}
test('BUG-50: WATCH binds private seats to the proven owner', async () => {
  for (const id of ['9002', '9001']) {
    const reply = await socketReply({ type: 'watch', tableId: 'ownership-table',
      agentId: 'agent-9001', userId: '9001', initData: headers(id)['x-telegram-init-data'] });
    assert.equal(reply.spectatorSeat, id === '9001' ? 0 : -1);
    assert.equal(observedWatches.at(-1).publicOnly, id !== '9001');
  }
  const reply = await socketReply({ type: 'watch', tableId: 'ownership-table' });
  assert.equal(reply.spectatorSeat, -1, 'anonymous WATCH must not inherit the first seat');
});
test('BUG-50: anonymous WATCH cannot create a table or seat a model', async () => {
  const reply = await socketReply({ type: 'watch', tableId: 'uncreated-table' });
  assert.equal(reply.type, 'error');
  assert.equal(tables.has('uncreated-table'), false);
});
test('BUG-50: JOIN cannot borrow a different owners agent', async () => {
  const reply = await socketReply({ type: 'join', tableId: 'uncreated-table', playerId: 'attacker',
    agentId: 'agent-9001', userId: '9001', wantAI: true, initData: headers('9002')['x-telegram-init-data'] });
  assert.equal(reply.type, 'error');
  assert.match(reply.message, /owner|Unauthorized/i);
});

test('BUG-50: public table snapshots and decision pushes contain no private cards or reads', async () => {
  const { Table } = await import('./table.js');
  const fakeSocket = () => ({ readyState: 1, OPEN: 1, messages: [], send(data) { this.messages.push(JSON.parse(data)); } });
  const table = new Table({ tableId: 'public-snapshot', smallBlind: 10, bigBlind: 20 });
  const watcher = fakeSocket();
  try {
    for (const id of ['one', 'two']) table.seatPlayer(fakeSocket(), { playerId: id, buyIn: 1000 });
    table.maybeStartHand({ clientDriven: true });
    const seat = table.addSpectator(watcher, { publicOnly: true });
    assert.equal(seat, -1);
    table.sendSnapshot(watcher, seat);
    table._broadcastState();
    for (const msg of watcher.messages.filter(m => m.type === 'state')) {
      assert.ok(msg.state.seats.every(s => s.holeCards.length === 0));
      assert.equal(msg.state.heroEquity, null);
      assert.equal(msg.state.reads, undefined);
    }
    assert.ok(watcher.messages.some(m => m.type === 'state'));
    table._broadcastDecision({ seat: 0, action: { type: 'fold' }, reasoning: 'PRIVATE', equity: 0.9 });
    const decision = watcher.messages.find(m => m.type === 'decision');
    assert.equal(decision.reasoning, undefined);
    assert.equal(decision.equity, undefined);
    assert.equal(table.pending.filter(Boolean).length, 2, 'watching did not create a third player');
  } finally { table.closeTable('test finished'); }
});

for (const route of ['/api/agents/build', '/api/agents/chat']) {
  test(`BUG-46: ${route} preserves the draft when the model returns invalid output`, async () => {
    const realFetch = globalThis.fetch;
    process.env.ANTHROPIC_API_KEY = 'fixture-key-never-sent';
    globalThis.fetch = (input, options) => {
      const url = typeof input === 'string' ? input : input.url ?? String(input);
      if (url.startsWith(base)) return realFetch(input, options);
      assert.ok(url.startsWith('https://api.anthropic.com/'), `Unexpected network: ${url}`);
      return Promise.resolve(new Response(JSON.stringify({ id: 'fixture', type: 'message', role: 'assistant',
        model: 'fixture', content: [{ type: 'text', text: 'not valid JSON' }],
        usage: { input_tokens: 0, output_tokens: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    try {
      const response = await request(route, 'POST', { userId: '9003', content: 'lets go' }, '9003');
      assert.equal(response.status, 503);
      const profile = await (await request('/api/agent-profile?userId=9003', 'GET', undefined, '9003')).json();
      assert.deepEqual(profile.agents, []);
      assert.ok(profile.chat.some(line => line.content.includes('Patient, tight poker')));
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
}
