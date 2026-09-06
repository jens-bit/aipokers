// src/server/sessionRoutes.test.js — SERVER-3
//
// The two seams SERVER-3 opens outside the table:
//
//   GET  /api/agents/:agentId/thread   — the table thread for one session,
//        which is what a reconnect asks for and what makes the history sheet
//        survive the socket that was watching it.
//   POST /api/agents/:agentId/finish   — the OTHER session-end path. It ends a
//        session without going through finishAgentSession (the two-paths wart
//        that predates this tree), so it has to fire the ceremony itself or
//        half the sessions in the product would end without one.
//
// Plus the floor channel's relay of the same message, because SESSION_END is
// owner-scoped and a subscriber watching somebody else's floor must not hear
// about a stranger's night.
//
// DEV_API_SECRET is set for the whole file so isOwner is a real check rather
// than the always-true local-dev posture — the ownership half of the thread is
// the point of the filter and cannot be asserted without it.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';

const SECRET = 'server3-test-secret';
const ORIGINAL_CWD = process.cwd();
const savedToken = process.env.TELEGRAM_BOT_TOKEN;
const savedSecret = process.env.DEV_API_SECRET;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.DEV_API_SECRET = SECRET;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-s3routes-'));
_closeForTests();
process.chdir(dir);
process.on('exit', () => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  if (savedSecret === undefined) delete process.env.DEV_API_SECRET;
  else process.env.DEV_API_SECRET = savedSecret;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const { saveProfile } = await import('./store.js');
saveProfile('u1', {
  userId: 'u1',
  chat: [],
  agents: [{ id: 'hero', name: 'Hero', status: 'playing', activeTableId: 'tbl-1', sessionHands: 12 }],
});

const { default: express } = await import('express');
const { installAgentProfileRoutes, setLiveTableProvider } = await import('./agentProfiles.js');
const { appendLine, ThreadKind } = await import('./thread.js');
const { bus: sessionBus } = await import('./sessions.js');
const floor = await import('./floorChannel.js');

// The smallest table shape the /finish route asks for: SERVER-3's own accessor
// and nothing else.
const fakeTable = {
  tableId: 'tbl-1',
  sessionDetailFor: (agentId) => (agentId === 'hero'
    ? { sessionId: 'sess-1', tableId: 'tbl-1', seat: 0, hands: 12, net: -430, biggestPot: 1800, duration: 900_000 }
    : null),
  agentIds: ['hero'],
  agentUserIds: ['u1'],
  liveGameView: () => null,
};
setLiveTableProvider({
  getTable: (id) => (id === 'tbl-1' ? fakeTable : null),
  hasTable: (id) => id === 'tbl-1',
  getLiveGame: () => null,
  listTables: () => [fakeTable],
});

const app = express();
app.use(express.json());
installAgentProfileRoutes(app);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
// Unref'd so a listening socket cannot be the thing that keeps the runner
// alive after the last assertion — process.on('exit') is too late to close it.
server.unref();

const asOwner = { 'x-api-secret': SECRET };
const get = (p, headers = {}) => fetch(base + p, { headers }).then(async (r) => ({ status: r.status, body: await r.json() }));

// One session's worth of thread to read back.
for (const l of [
  { kind: ThreadKind.TABLE, who: 'TABLE', text: 'Granite raised to 240' },
  { kind: ThreadKind.HIM, who: 'HIM', text: 'He has shown that sizing twice. It is a bluff.' },
  { kind: ThreadKind.OPPONENT, who: 'Granite', text: 'Again?' },
  { kind: ThreadKind.YOU, who: 'YOU', text: 'Careful with him.' },
]) {
  appendLine({ sessionId: 'sess-1', agentId: 'hero', ownerId: 'u1', tableId: 'tbl-1', ...l });
}
appendLine({
  sessionId: 'sess-2', agentId: 'hero', ownerId: 'u1', tableId: 'tbl-1',
  kind: ThreadKind.TABLE, who: 'TABLE', text: 'a later night',
});

test('SERVER-3: the thread route answers for the session it was asked about', async () => {
  const { status, body } = await get('/api/agents/hero/thread?userId=u1&session=sess-1', asOwner);
  assert.equal(status, 200);
  assert.equal(body.sessionId, 'sess-1');
  assert.equal(body.count, 4);
  assert.deepEqual(body.lines.map((l) => l.kind), ['table', 'him', 'opponent', 'you']);
  assert.deepEqual(body.lines.map((l) => l.who), ['TABLE', 'HIM', 'Granite', 'YOU']);
  for (const l of body.lines) assert.ok(Number.isFinite(l.ts), 'server timestamps, to order it by');
});

test('SERVER-3: a reconnect that names no session gets his most recent one', async () => {
  const { body } = await get('/api/agents/hero/thread?userId=u1', asOwner);
  assert.equal(body.sessionId, 'sess-2', 'the stay he was most recently in');
  assert.deepEqual(body.lines.map((l) => l.text), ['a later night']);
});

test('SERVER-3: a non-owner hears the room and not his read', async () => {
  const { status, body } = await get('/api/agents/hero/thread?userId=u1&session=sess-1');
  assert.equal(status, 200, 'the thread is filtered, not refused — a watcher can hear a table');
  assert.deepEqual(body.lines.map((l) => l.kind), ['table', 'opponent']);
  assert.ok(!JSON.stringify(body).includes('bluff'), 'his reasoning is his owner\'s');
});

test('SERVER-3: an unknown agent is a 404 and an unknown session is empty', async () => {
  assert.equal((await get('/api/agents/ghost/thread?userId=u1', asOwner)).status, 404);
  const { status, body } = await get('/api/agents/hero/thread?userId=u1&session=never', asOwner);
  assert.equal(status, 200);
  assert.deepEqual(body.lines, []);
  assert.equal(body.count, 0);
});

test('SERVER-3: POST /finish fires the ceremony, as calledIn', async () => {
  const seen = [];
  const listen = (r) => seen.push(r);
  sessionBus.on('session_end', listen);
  try {
    const res = await fetch(`${base}/api/agents/hero/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...asOwner },
      body: JSON.stringify({ userId: 'u1' }),
    });
    assert.equal(res.status, 200);
  } finally {
    sessionBus.off('session_end', listen);
  }

  assert.equal(seen.length, 1, 'the owner-initiated finish is a session end like any other');
  const r = seen[0];
  assert.equal(r.agentId, 'hero');
  assert.equal(r.reason, 'calledIn', 'this route exists because the OWNER decided it was over');
  assert.equal(r.sessionId, 'sess-1', 'the stay the live table said he was on');
  assert.equal(r.tableId, 'tbl-1');
  assert.equal(r.hands, 12);
  assert.equal(r.net, -430);
  assert.equal(r.biggestPot, 1800);
  assert.equal(r.duration, 900_000);
});

test('SERVER-3: the floor relays a session end to its owner and to nobody else', () => {
  floor.configure({ liveTables: { listTables: () => [] } });
  const sockets = { mine: [], theirs: [] };
  const mk = (bucket) => ({
    readyState: 1, OPEN: 1,
    send(p) { sockets[bucket].push(JSON.parse(p)); },
  });
  const mine = mk('mine');
  const theirs = mk('theirs');
  try {
    floor.subscribe(mine, { userId: 'u1', owner: true });
    floor.subscribe(theirs, { userId: 'u2', owner: true });
    sockets.mine.length = 0;
    sockets.theirs.length = 0;

    const sent = floor.broadcastSessionEnd({
      sessionId: 'sess-1', agentId: 'hero', userId: 'u1', tableId: 'tbl-1',
      reason: 'bust', hands: 12, net: -430, biggestPot: 1800, duration: 900_000,
    });
    assert.equal(sent, 1, 'one subscriber, not two');

    const [msg] = sockets.mine;
    assert.equal(msg.type, 'session_end');
    assert.equal(msg.reason, 'bust');
    assert.ok(!('userId' in msg), 'the owner id routed the message and then stayed behind');
    assert.equal(sockets.theirs.length, 0, 'a stranger\'s night is not floor news');

    // An ending with no owner on it has no floor to be announced on.
    assert.equal(floor.broadcastSessionEnd({ agentId: 'hero', userId: null, reason: 'stopped' }), 0);
    assert.equal(floor.broadcastSessionEnd(null), 0);
  } finally {
    floor.reset();
  }
});
