// BUG-163: public kitchen speech belongs to the existing Home conversation.
// Real persisted rows and authenticated HTTP/WS; never create a model reply.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import WebSocket from 'ws';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = '123456:bug163-synthetic-test-token';
process.env.NOTIFY_ENABLED = '0';
process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_CHAT_MAX = '100000';

const { Table } = await import('./table.js');
const thread = await import('./thread.js');
const store = await import('./store.js');
const { homeSessionId } = await import('./homeNight.js');
const { ThreadKind, ThreadSource, OWNER, ROOM } = thread;
after(() => store._closeForTests());
let sequence = 0;
const socket = () => ({ OPEN: 1, readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); } });

function fixture(t, { home = true, owner = `bug163-${++sequence}`, count = 3 } = {}) {
  const table = new Table({ tableId: `test-kitchen-${sequence}`, home, homeOwnerId: owner, smallBlind: 10, bigBlind: 20, maxSeats: 4 });
  for (let n = 0; n < count; n++) table.seatAI({ displayName: ['Professor', 'Granite', 'Wild Card'][n], agentId: `${owner}-agent-${n}`, userId: owner, buyIn: 2000 });
  t.after(() => table._clearTimers());
  return { table, owner, sessionId: homeSessionId(owner), lines: () => thread.readThread(homeSessionId(owner), { owner: true }) };
}

test('BUG-163: one public kitchen utterance becomes one attributed Home row, not one per seat', t => {
  const { table, owner, sessionId, lines } = fixture(t);
  const pushed = [];
  thread.setLineListener(row => pushed.push(row));
  t.after(() => thread.setLineListener(null));
  table.sendChat(0, '  I will look.  ', true);
  assert.equal(lines().length, 1, 'public table chat currently never reaches the daily Home thread');
  assert.deepEqual(lines().map(({ kind, who, text, source, from, to, tableId }) => ({ kind, who, text, source, from, to, tableId })), [{
    kind: ThreadKind.HIM, who: 'Professor', text: 'I will look.', source: ThreadSource.HOME,
    from: table.agentIds[0], to: ROOM, tableId: null,
  }]);
  const roomPush = pushed.filter(row => row.sessionId === sessionId);
  assert.equal(roomPush.length, 1);
  assert.equal(roomPush[0].ownerId, owner);
  assert.equal(roomPush[0].agentId, table.agentIds[0]);
  assert.deepEqual(thread.wireLine(roomPush[0]), lines()[0], 'fetch and push have one persisted row id');
  for (const [seat, stay] of table.seatSessionIds.slice(0, 3).entries()) {
    const history = thread.readThread(stay, { owner: true });
    assert.equal(history.length, 1, 'existing per-seat table history remains once only');
    assert.equal(history[0].source, ThreadSource.TABLE);
    assert.equal(history[0].kind, seat === 0 ? ThreadKind.HIM : ThreadKind.OPPONENT);
  }
  assert.equal(thread.latestSessionFor(table.agentIds[0]), table.seatSessionIds[0], 'room chatter is not a new casino stay');
});

test('BUG-163: actual named human and House speakers never impersonate the room owner', t => {
  const { table, lines } = fixture(t, { count: 1 });
  const human = table.seatPlayer(socket(), { playerId: 'visiting-human', displayName: 'Mira', buyIn: 2000 });
  const house = table.seatAI({ displayName: 'The Dealer', stableId: 'dealer', buyIn: 2000 });
  table.sendChat(human, 'Your deal.');
  table.sendChat(house, 'Cards are ready.', true);
  assert.deepEqual(lines().map(({ kind, who, from, to }) => ({ kind, who, from, to })), [
    { kind: ThreadKind.OPPONENT, who: 'Mira', from: 'visiting-human', to: ROOM },
    { kind: ThreadKind.OPPONENT, who: 'The Dealer', from: 'house_dealer', to: ROOM },
  ]);
  assert.ok(lines().every(row => row.kind !== ThreadKind.YOU && row.from !== OWNER));
});

test('BUG-163: every Home-source row stays private, including a named human or House line', t => {
  const { owner, sessionId } = fixture(t, { count: 0 });
  for (const kind of Object.values(ThreadKind).filter(kind => kind !== ThreadKind.OVERHEARD)) {
    thread.appendLine({ sessionId, ownerId: owner, agentId: 'known-speaker', kind, who: 'Mira', text: `Private kitchen ${kind}`, source: ThreadSource.HOME, from: 'known-speaker', to: ROOM });
  }
  assert.equal(thread.readThread(sessionId, { owner: true }).length, 4);
  assert.deepEqual(thread.readThread(sessionId), [], 'a guessable Home session is not public table history');
  assert.deepEqual(thread.readThread(sessionId, { owner: true, ownerId: 'unrelated' }), []);
  const publicStay = `public-stay-${sequence}`;
  thread.appendLine({ sessionId: publicStay, ownerId: owner, agentId: 'known-speaker', kind: ThreadKind.OPPONENT, who: 'Mira', text: 'Public casino speech.' });
  assert.equal(thread.readThread(publicStay).length, 1, 'TABLE visibility remains unchanged');
});

test('BUG-163: private reads, owner whispers, addressed replies and table facts are not copied into Home', t => {
  const { table, lines } = fixture(t);
  table._broadcastDecision({ seat: 0, action: { type: 'call' }, reasoning: 'PRIVATE: I have aces.', equity: 0.9, potOdds: 0.1 });
  table.receiveWhisper(table.agentIds[0], 'PRIVATE: keep the aces hidden.');
  table.whisperReply(table.agentIds[0], 'PRIVATE addressed answer.');
  table._threadTable('Professor raised to 240');
  table.sendChat(0, 'Legacy spectator text', false); // owner speaking through an agent seat has no human identity here
  assert.deepEqual(lines(), []);
  const own = thread.readThread(table.seatSessionIds[0], { owner: true });
  assert.ok(own.some(row => row.text === 'PRIVATE: I have aces.'));
  assert.ok(own.some(row => row.from === OWNER));
  table.sendChat(1, 'I will wait.', true);
  assert.deepEqual(lines().map(row => row.text), ['I will wait.']);
});

test('BUG-163: casino speech, unknown Home ownership, closed/empty seats and empty input add no Home row', t => {
  for (const options of [{ home: false }, { owner: null }]) {
    const { table, lines } = fixture(t, options);
    table.sendChat(0, 'Outside the room.', true);
    assert.deepEqual(lines(), []);
  }
  const { table, lines } = fixture(t);
  table.sendChat(3, 'Nobody occupies this seat.', true);
  table.sendChat(0, '   ', true);
  table.closed = true;
  table.sendChat(0, 'A stale delayed callback.', true);
  assert.deepEqual(lines(), []);
});

test('BUG-163: real accepted visitor speech reaches only the host Home via signed fetch and live floor', async t => {
  const profiles = await import('./agentProfiles.js');
  const registry = await import('./tableRegistry.js');
  const home = await import('./homeGame.js');
  const visit = await import('./visit.js');
  const { createServer } = await import('./wsServer.js');
  const HOST = '96301', GUEST = '96302', THIRD = '96303';
  const originalAiTurn = Table.prototype._maybeRunAiTurn;
  Table.prototype._maybeRunAiTurn = async () => {}; // real engine; only this fixture's turn timing is controlled
  const app = express(); app.use(express.json());
  profiles.installAgentProfileRoutes(app); visit.installVisitRoutes(app);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const { wss } = createServer({ server });
  const sockets = [];
  t.after(async () => {
    for (const s of sockets) s.ws.terminate();
    for (const ws of wss.clients) ws.terminate();
    visit.reset(); home.reset(); registry.resetRegistry('BUG-163 complete');
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
    Table.prototype._maybeRunAiTurn = originalAiTurn;
  });
  function credential(uid) {
    const fields = { id: uid, first_name: 'Synthetic', auth_date: String(Math.floor(Date.now() / 1000)) };
    const data = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const key = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
    return new URLSearchParams({ ...fields, hash: crypto.createHmac('sha256', key).update(data).digest('hex') }).toString();
  }
  async function call(route, uid, body) {
    const response = await fetch(base + route, { method: body ? 'POST' : 'GET', headers: { ...(uid ? { 'x-telegram-init-data': credential(uid) } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, body: await response.json() };
  }
  async function waitFor(fn) {
    for (let i = 0; i < 150; i++) { const result = fn(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Expected authenticated socket message did not arrive');
  }
  async function connect(message) {
    const ws = new WebSocket(base.replace('http:', 'ws:'));
    const s = { ws, messages: [] }; sockets.push(s);
    ws.on('message', raw => s.messages.push(JSON.parse(raw)));
    await once(ws, 'open'); ws.send(JSON.stringify(message));
    await waitFor(() => s.messages.some(m => ['floor_state', 'watching', 'error'].includes(m.type)));
    return s;
  }
  const agent = (id, name) => ({ id, name, status: 'idle', activeTableId: null, strategy: 'Synthetic strategy', style: 'Balanced', risk: 'Medium', bankroll: 3000,
    pocket: { balance: 3000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    stats: { handsPlayed: 0, handsWon: 0 }, profile: { tightness: 50, aggression: 50, bluffFreq: 20, discipline: 60 } });
  for (const [uid, id, name] of [[HOST, 'host-professor', 'Professor'], [GUEST, 'guest-granite', 'Granite'], [THIRD, 'third-agent', 'Elsewhere']]) {
    profiles.presentedRoster(uid); const list = profiles.agentsOf(uid); list.length = 0; list.push(agent(id, name)); profiles.saveOwner(uid);
  }
  const invitation = await call('/api/agents/guest-granite/visit-invite', GUEST, { userId: GUEST, stake: 0 });
  assert.equal(invitation.status, 200);
  const knock = await call('/api/agents/guest-granite/visit', HOST, { hostUserId: HOST, stake: 0, invitationToken: invitation.body.invitationToken });
  assert.equal(knock.status, 200);
  assert.equal((await call(`/api/home/visitors/${knock.body.visitId}/answer`, HOST, { hostUserId: HOST, accept: true })).status, 200);
  assert.equal(visit.hasActiveVisit(HOST, GUEST), true, 'real accepted visit, not a forged visiting flag');
  const table = registry.getTable(home.homeTableId(HOST));
  assert.ok(table?.home);
  const hostFloor = await connect({ type: 'floor_sub', userId: HOST, initData: credential(HOST) });
  const guestFloor = await connect({ type: 'floor_sub', userId: GUEST, initData: credential(GUEST) });
  const thirdFloor = await connect({ type: 'floor_sub', userId: THIRD, initData: credential(THIRD) });
  const forgedFloor = await connect({ type: 'floor_sub', userId: HOST, initData: credential(THIRD) });
  const anonymousFloor = await connect({ type: 'floor_sub', userId: HOST });
  const hostWatch = await connect({ type: 'watch', tableId: table.tableId, userId: HOST, initData: credential(HOST), agentId: 'host-professor' });
  const guestWatch = await connect({ type: 'watch', tableId: table.tableId, userId: GUEST, initData: credential(GUEST), agentId: 'guest-granite' });
  assert.ok([hostWatch, guestWatch].every(s => s.messages.some(m => m.type === 'watching')));
  for (const s of sockets) s.messages.length = 0;
  const guestSeat = table.seatOfAgent('guest-granite');
  table.sendChat(guestSeat, 'I brought my own patience.', true);
  await waitFor(() => hostWatch.messages.some(m => m.type === 'chat'));
  const response = await call(`/api/home/thread?userId=${HOST}`, HOST);
  assert.equal(response.status, 200);
  assert.equal(response.body.count, 1, 'the host Home path must contain what the visiting agent said publicly');
  const [line] = response.body.lines;
  assert.deepEqual([line.who, line.from, line.to, line.source], ['Granite', 'guest-granite', ROOM, ThreadSource.HOME]);
  await waitFor(() => hostFloor.messages.some(m => m.type === 'owner_line' && m.line?.id === line.id));
  assert.equal(hostFloor.messages.filter(m => m.type === 'owner_line' && m.line?.id === line.id).length, 1);
  assert.equal(profiles.homeThreadUnread(HOST), line.ts, 'the existing Home unread marker is live');
  for (const s of [guestFloor, thirdFloor, forgedFloor, anonymousFloor]) assert.ok(!s.messages.some(m => m.type === 'owner_line' && m.sessionId === homeSessionId(HOST)), 'only proved host floor gets the host room');
  assert.equal((await call(`/api/home/thread?userId=${GUEST}`, GUEST)).body.count, 0, 'guest speech is not copied into their empty home');
  for (const uid of [GUEST, THIRD]) assert.equal((await call(`/api/home/thread?userId=${HOST}`, uid)).status, 403, `owner ${uid} cannot read the host room`);
  assert.equal((await call(`/api/home/thread?userId=${HOST}`, null)).status, 401, 'anonymous request is refused by auth middleware');
  assert.deepEqual(thread.readThread(homeSessionId(HOST)), []);
  assert.deepEqual(thread.readThread(homeSessionId(HOST), { owner: true, agentId: 'guest-granite', ownerId: GUEST }), []);
  const guessed = await call(`/api/agents/guest-granite/thread?userId=${GUEST}&session=${encodeURIComponent(homeSessionId(HOST))}`, GUEST);
  assert.equal(guessed.status, 200); assert.equal(guessed.body.count, 0);
  for (const s of [hostWatch, guestWatch]) {
    assert.equal(s.messages.filter(m => m.type === 'chat').length, 1);
    assert.equal(s.messages.filter(m => m.type === 'thread_line').length, 1, 'room projection must not push a second felt history line');
  }
  table._broadcastDecision({ seat: guestSeat, action: { type: 'call' }, reasoning: 'SECRET guest aces', equity: 0.9, potOdds: 0.1 });
  table.receiveWhisper('guest-granite', 'SECRET owner whisper');
  table.whisperReply('guest-granite', 'SECRET addressed answer');
  assert.equal((await call(`/api/home/thread?userId=${HOST}`, HOST)).body.count, 1, 'private addressed content never enters the Home projection');
  assert.ok(!JSON.stringify(hostFloor.messages.filter(m => m.sessionId === homeSessionId(HOST))).includes('SECRET'));
});
