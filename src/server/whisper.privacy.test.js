// BUG-257: owner conversation never becomes another player's table talk.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-whisper-privacy-token';
process.env.NOTIFY_ENABLED = '0';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-whisper-private-'));
process.chdir(scratch);
const store = await import('./store.js');
const profiles = await import('./agentProfiles.js');
const registry = await import('./tableRegistry.js');
const thread = await import('./thread.js');
const { createServer } = await import('./wsServer.js');
const { default: express } = await import('express');
const localFetch = globalThis.fetch;

test.after(() => {
  store._closeForTests();
  process.chdir(originalCwd);
  assert.equal(path.dirname(path.resolve(scratch)), path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true });
});

function credential(uid) {
  const fields = { id: uid, first_name: 'Synthetic', auth_date: String(Math.floor(Date.now() / 1000)) };
  const text = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  return new URLSearchParams({ ...fields, hash: crypto.createHmac('sha256', key).update(text).digest('hex') }).toString();
}

async function waitFor(fn) {
  for (let i = 0; i < 150; i++) {
    const found = fn();
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Expected authenticated socket message did not arrive');
}

test('BUG-257: generated private replies reach only the proved owner over HTTP, history and THREAD_LINE', async t => {
  const app = express(); app.use(express.json()); profiles.installAgentProfileRoutes(app);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const { wss } = createServer({ server });
  const sockets = [];
  t.after(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    for (const socket of sockets) socket.ws.terminate();
    for (const ws of wss.clients) ws.terminate();
    registry.resetRegistry('privacy fixture over');
    profiles.setLiveTableProvider(null);
    thread.setLineListener(null);
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });

  const table = registry.getOrCreateTable('whisper-private', { smallBlind: 10, bigBlind: 20 });
  table._maybeRunAiTurn = async () => {}; // Real engine and transport; no autonomous decision timing.
  for (const [owner, id, name] of [['25701', 'private-hero', 'Granite'], ['25702', 'private-other', 'Mira']]) {
    store.saveWallet(owner, { ownerId: owner, balance: 10000, ledger: [] });
    store.saveProfile(owner, { userId: owner, agents: [{ id, name, status: 'playing', activeTableId: table.tableId,
      style: 'Balanced', risk: 'Medium', strategy: 'Wait for value.', bankroll: 3000,
      pocket: { balance: 3000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
      mood: { state: 'neutral', heat: 30 }, stats: { handsPlayed: 40, handsWon: 18 },
      profile: { tightness: 70, aggression: 45, bluffFreq: 15, discipline: 80 } }] });
    profiles.reloadOwners(owner);
    table.seatAI({ agentId: id, userId: owner, displayName: name, buyIn: 2000 });
  }
  table.autoPlay = true;
  table.maybeStartHand();
  table._clearTimers();
  const heroSeat = table.seatOfAgent('private-hero');
  const otherSeat = table.seatOfAgent('private-other');

  async function connect(userId, agentId, signedAs = userId) {
    const ws = new WebSocket(base.replace('http:', 'ws:'));
    const socket = { ws, messages: [] }; sockets.push(socket);
    ws.on('message', raw => socket.messages.push(JSON.parse(raw)));
    await once(ws, 'open');
    ws.send(JSON.stringify({ type: 'watch', tableId: table.tableId, userId, agentId,
      ...(signedAs ? { initData: credential(signedAs) } : {}) }));
    await waitFor(() => socket.messages.some(m => m.type === 'watching' || m.type === 'error'));
    return socket;
  }
  const own = await connect('25701', 'private-hero');
  const other = await connect('25702', 'private-other');
  const forged = await connect('25701', 'private-hero', '25702');
  const publicWatch = await connect('25701', 'private-hero', null);
  assert.equal(own.messages.find(m => m.type === 'watching')?.spectatorSeat, heroSeat);
  assert.equal(other.messages.find(m => m.type === 'watching')?.spectatorSeat, otherSeat);
  for (const watcher of [forged, publicWatch]) assert.equal(watcher.messages.find(m => m.type === 'watching')?.spectatorSeat, -1);
  for (const socket of sockets) socket.messages.length = 0;

  const privateReply = 'I remember our quiet-bluebird plan.';
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    assert.equal(new URL(String(input)).hostname, 'api.anthropic.com', 'only the model SDK uses the intercepted fetch');
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ id: 'privacy-model-fixture', type: 'message', role: 'assistant', model: 'fixture',
      stop_reason: 'end_turn', content: [{ type: 'text', text: privateReply }], usage: { input_tokens: 1, output_tokens: 1 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  process.env.ANTHROPIC_API_KEY = 'intercepted-never-sent';
  const incoming = 'Remember our quiet-bluebird plan?';
  const response = await localFetch(`${base}/api/agents/chat`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-telegram-init-data': credential('25701') },
    body: JSON.stringify({ userId: '25701', existingAgentId: 'private-hero', content: incoming }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.chat[0].content, privateReply);
  assert.equal(requests.length, 1, 'one intercepted model call; privacy adds no second writer');
  await waitFor(() => own.messages.some(m => m.type === 'thread_line' && m.line?.text === privateReply));
  assert.equal(own.messages.filter(m => m.type === 'thread_line' && m.line?.text === incoming).length, 1);
  assert.equal(own.messages.filter(m => m.type === 'thread_line' && m.line?.text === privateReply).length, 1);
  for (const socket of sockets) assert.equal(socket.messages.some(m => m.type === 'chat' && m.text === privateReply), false,
    'a private reply is never a public CHAT bubble');
  for (const socket of [other, forged, publicWatch]) assert.equal(JSON.stringify(socket.messages).includes('quiet-bluebird'), false,
    'another owner or an unproved watcher receives neither half');
  const ownLines = thread.readThread(table.seatSessionIds[heroSeat], { owner: true });
  assert.equal(ownLines.filter(l => l.text === privateReply && l.from === 'private-hero' && l.to === thread.OWNER).length, 1);
  assert.equal(thread.readThread(table.seatSessionIds[otherSeat], { owner: true }).some(l => l.text.includes('quiet-bluebird')), false);
  assert.equal(thread.readThread(table.seatSessionIds[heroSeat]).some(l => l.text.includes('quiet-bluebird')), false);
  assert.equal(store.loadProfile('25701').agents[0].chatHistory.at(-1).content, privateReply);
  assert.equal(JSON.stringify(table.chatHistory).includes('quiet-bluebird'), false);
  assert.equal(table._lastPublicAiLine[heroSeat]?.includes('quiet-bluebird') ?? false, false);
  assert.equal(JSON.stringify(table.feltView()).includes('quiet-bluebird'), false);

  // The owner-addressed hand-comment caller must obey the same boundary.
  const debrief = 'Private debrief: you folded the aces.';
  table.sendChat(heroSeat, debrief, true, { from: 'private-hero', to: thread.OWNER });
  await waitFor(() => own.messages.some(m => m.type === 'thread_line' && m.line?.text === debrief));
  for (const socket of [other, forged, publicWatch]) assert.equal(JSON.stringify(socket.messages).includes(debrief), false);
  assert.equal(table.chatHistory.some(l => l.text === debrief), false);
  assert.equal(thread.readThread(table.seatSessionIds[otherSeat], { owner: true }).some(l => l.text === debrief), false);

  // Deliberate speech still reaches every watcher and the public table memory.
  const publicLine = 'That river woke everyone up.';
  table.sendChat(heroSeat, publicLine, true);
  await waitFor(() => sockets.every(socket => socket.messages.some(m => m.type === 'chat' && m.text === publicLine)));
  assert.equal(table.chatHistory.at(-1).text, publicLine);
  assert.equal(table._lastPublicAiLine[heroSeat], publicLine);
  assert.ok(thread.readThread(table.seatSessionIds[otherSeat]).some(l => l.text === publicLine));
  // This public line is a transport barrier: each socket has now received
  // everything queued before it, so the negative checks cannot race delivery.
  for (const socket of [other, forged, publicWatch]) {
    assert.equal(JSON.stringify(socket.messages).includes('quiet-bluebird'), false);
    assert.equal(JSON.stringify(socket.messages).includes(debrief), false);
  }
  for (const socket of sockets) assert.equal(socket.messages.some(m => m.type === 'chat' && [privateReply, debrief].includes(m.text)), false);
});
