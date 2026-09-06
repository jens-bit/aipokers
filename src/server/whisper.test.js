// src/server/whisper.test.js — BUGS-B/2
//
// The owner leaning in while a hand is running.
//
// Before this, a whisper went out over HTTP, produced a reply, and the reply
// died in the response body: nothing on the felt ever heard it, and nothing
// was written down. From the watch screen it looked like he had ignored you.
//
// Four rules, and this file is one test per rule:
//
//   1. He ANSWERS, and the answer comes back as a bubble at his seat.
//   2. Both halves are written to his thread, ADDRESSED — you to him, him
//      back to you.
//   3. What you said is his alone. No other seat's sheet gets it.
//   4. Away from a table nothing changes: the CHATS thread is still a thread.

// TEST-2 / the testing law: no automated suite talks to a real model. Without
// a key callClaude answers null and ownerChatTurn falls back to its own line,
// which is all this file needs — what is under test is the plumbing, not the
// words.
delete process.env.ANTHROPIC_API_KEY;

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ThreadKind, OWNER } from './thread.js';
import { ServerMsg } from './protocol.js';

const ORIGINAL_CWD = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-whisper-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
process.chdir(scratch);

// The store has to be written BEFORE anything reads it: agentProfiles caches
// the whole profile map on its first db() call and never reloads it.
const store = await import('./store.js');
store.saveWallet('u1', { ownerId: 'u1', balance: 10_000, ledger: [] });
store.saveProfile('u1', {
  userId: 'u1',
  chat: [],
  agents: [{
    id: 'granite',
    name: 'Granite',
    status: 'playing',
    activeTableId: 'tbl-whisper',
    style: 'Tight',
    risk: 'Low',
    strategy: 'You wait for premiums.',
    bankroll: 3_000,
    pocket: { balance: 3_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 40, handsWon: 18 },
    profile: { tightness: 88, aggression: 45, bluffFreq: 8, discipline: 88 },
  }],
});

const profiles = await import('./agentProfiles.js');
const registry = await import('./tableRegistry.js');
const thread = await import('./thread.js');
const { default: express } = await import('express');

profiles.setLiveTableProvider(registry);

// A real table with him in a seat and a House regular opposite.
const table = registry.getOrCreateTable('tbl-whisper', { smallBlind: 10, bigBlind: 20 });
table.startAgentSession({
  agentId: 'granite',
  userId: 'u1',
  displayName: 'Granite',
  strategy: 'You wait for premiums.',
  agentProfile: { tightness: 88, aggression: 45, bluffFreq: 8, discipline: 88 },
});
const heroSeat = table.seatOfAgent('granite');

// A watcher at his seat, so "it went out on the wire" is something this file
// observes rather than infers.
const wire = [];
const watcher = { readyState: 1, OPEN: 1, send: (raw) => wire.push(JSON.parse(raw)) };
table.spectators.push({ ws: watcher, spectatorSeat: heroSeat });

const app = express();
app.use(express.json());
profiles.installAgentProfileRoutes(app);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;

const whisper = (content) => fetch(`${base}/api/agents/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'u1', content, existingAgentId: 'granite' }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

const hisThread = () => thread.readThread(table.seatSessionIds[heroSeat], { owner: true });

test.after(() => {
  try { table.closeTable('test over'); } catch { /* best effort */ }
  registry.resetRegistry('test over');
  profiles.setLiveTableProvider(null);
  server.close();
  store._closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ── 1. Something comes back ─────────────────────────────────────────────────

test('BUGS-B/2: a whisper during a hand gets an answer, and it lands at his seat', async () => {
  assert.notEqual(heroSeat, null, 'he is in a seat');
  assert.ok(table.seatSessionIds[heroSeat], 'and the seat is a session, so it has a thread');

  wire.length = 0;
  const { status, body } = await whisper('what have you got?');
  assert.equal(status, 200, JSON.stringify(body));

  const reply = body.chat?.[0]?.content;
  assert.equal(typeof reply, 'string');
  assert.ok(reply.trim().length > 0, 'he said something back');

  // The whole point: it came back as a BUBBLE, not only as an HTTP body.
  assert.equal(body.whisper?.tableId, 'tbl-whisper');
  assert.equal(body.whisper?.seat, heroSeat);

  const bubbles = wire.filter((m) => m.type === ServerMsg.CHAT);
  assert.equal(bubbles.length, 1, `one bubble, got ${JSON.stringify(wire.map((m) => m.type))}`);
  assert.equal(bubbles[0].seat, heroSeat);
  assert.equal(bubbles[0].isAI, true);
  assert.equal(bubbles[0].text, reply);
  assert.equal(bubbles[0].displayName, 'Granite');
});

// ── 2. Both halves are written down, and both are addressed ─────────────────

test('BUGS-B/2: the thread keeps both halves, each with a from and a to', () => {
  const lines = hisThread();
  const said = lines.filter((l) => l.kind === ThreadKind.YOU);
  const answered = lines.filter((l) => l.kind === ThreadKind.HIM);

  const mine = said.find((l) => l.text === 'what have you got?');
  assert.ok(mine, `expected the whisper among ${JSON.stringify(said.map((l) => l.text))}`);
  assert.equal(mine.from, OWNER);
  assert.equal(mine.to, 'granite', 'you said it to HIM, not to the room');
  assert.equal(mine.who, 'YOU');

  assert.ok(answered.length >= 1, 'and his answer is there too');
  const his = answered[answered.length - 1];
  assert.equal(his.from, 'granite');
  assert.equal(his.to, OWNER, 'he answered YOU');
  assert.equal(his.who, 'HIM');
});

test('BUGS-B/2: an ordinary table line is still said to nobody in particular', () => {
  // The rule the from/to pair must not break: the room announces, it does not
  // address, and a seat talking out loud is talking to the felt.
  table.sendChat(heroSeat, 'nice hand', true);
  const last = hisThread().filter((l) => l.kind === ThreadKind.HIM).at(-1);
  assert.equal(last.text, 'nice hand');
  assert.equal(last.from, null);
  assert.equal(last.to, null);
});

// ── 3. What you said is his alone ───────────────────────────────────────────

test('BUGS-B/2: no other seat overhears what you whispered', () => {
  const others = [];
  for (let seat = 0; seat < table.maxSeats; seat++) {
    if (seat === heroSeat) continue;
    const sessionId = table.seatSessionIds[seat];
    if (!sessionId) continue;
    others.push(...thread.readThread(sessionId, { owner: true }));
  }
  assert.equal(others.some((l) => l.text === 'what have you got?'), false,
    'a whisper is not table chat');
});

// ── 4. Away from a table, nothing changed ───────────────────────────────────

test('BUGS-B/2: with no seat under him it is an ordinary chat turn again', async () => {
  const record = profiles._agentRecordForTests('granite', 'u1');
  const seatedTable = record.activeTableId;
  record.activeTableId = null;

  wire.length = 0;
  const { status, body } = await whisper('how was the session');
  assert.equal(status, 200, JSON.stringify(body));
  assert.ok(body.chat?.[0]?.content, 'he still answers');
  assert.equal(body.whisper, null, 'but there is no felt for it to land on');
  assert.equal(wire.filter((m) => m.type === ServerMsg.CHAT).length, 0, 'and no bubble');

  record.activeTableId = seatedTable;
});

test('BUGS-B/2: a table that no longer exists is not a felt to whisper into', async () => {
  const record = profiles._agentRecordForTests('granite', 'u1');
  const seatedTable = record.activeTableId;
  record.activeTableId = 'tbl-gone';

  const { status, body } = await whisper('you there?');
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.whisper, null);

  record.activeTableId = seatedTable;
});
