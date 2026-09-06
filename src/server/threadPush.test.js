// src/server/threadPush.test.js — SERVER-4 jobs 1 and 2
//
// A line that is written is a line that is SENT.
//
// Two trees, one file, because from the client's side they are one promise:
// nothing in a thread should ever have to be discovered by asking again. Job 1
// is the push itself (every write emits, the overheard entry included, each of
// its inner lines with its own clock); job 2 is what that push makes possible,
// which is POST /api/home/say answering immediately and letting the room reply
// in its own time.
//
// The owner gating is asserted here too, and it is the part worth being fussy
// about: a thread carries `him` lines, which are the reasoning AGE-33 withholds
// from everybody but the owner's own spectator. A userId in FLOOR_SUB is a
// claim; `owner` is that claim checked.

// TEST-2 / the testing law: no automated suite talks to a real model. The
// fan-out below spends one turn per agent at home.
delete process.env.ANTHROPIC_API_KEY;

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendLine, appendOverheard, setThreadListener, readThread,
  ThreadKind, ThreadSource, OWNER, ROOM, OVERHEARD_LINE_STEP_MS,
} from './thread.js';
import { homeSessionId, dayKey } from './homeNight.js';
import { _closeForTests } from './store.js';

// ── Job 1 · every write is announced ────────────────────────────────────────

test('SERVER-4: a written thread line is pushed, with the ownership it was written under', () => {
  withStore(() => {
    const seen = [];
    setThreadListener((ownerId, line) => seen.push({ ownerId, line }));

    appendLine({
      sessionId: 'sess-1', agentId: 'balance', ownerId: 'u1', tableId: 'tbl-1',
      kind: ThreadKind.TABLE, who: 'TABLE', text: 'Granite raised to 240',
    });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].ownerId, 'u1', 'the push is addressed to the owner of the line');
    assert.equal(seen[0].line.text, 'Granite raised to 240');
    assert.equal(seen[0].line.sessionId, 'sess-1');
    assert.equal(seen[0].line.tableId, 'tbl-1');
    assert.equal(seen[0].line.kind, ThreadKind.TABLE);
    assert.ok(Number.isFinite(seen[0].line.ts), 'stamped by the server, like the row');
    assert.ok(seen[0].line.id, 'and it carries the row id, so a client can dedupe against a fetch');
  });
});

test('SERVER-4: the pushed line is the same shape the thread route returns', () => {
  withStore(() => {
    let pushed = null;
    setThreadListener((_ownerId, line) => { pushed = line; });
    appendLine({
      sessionId: 'sess-2', agentId: 'balance', ownerId: 'u1',
      kind: ThreadKind.HIM, who: 'BALANCE', text: 'He is bluffing.',
      source: ThreadSource.HOME, from: 'balance', to: OWNER,
    });
    const [fetched] = readThread('sess-2', { owner: true });
    // A client appends pushed lines onto a fetched thread. If the two shapes
    // disagree it has to reconcile two vocabularies for one sentence.
    assert.deepEqual(pushed, fetched);
    // And neither carries the ids a reader is not given.
    assert.equal(pushed.ownerId, undefined);
    assert.equal(pushed.agentId, undefined);
  });
});

test('SERVER-4: a line that was not written is not pushed', () => {
  withStore(() => {
    const seen = [];
    setThreadListener((_o, line) => seen.push(line));
    appendLine({ sessionId: 'sess-3', agentId: 'a', ownerId: 'u1', kind: ThreadKind.HIM, who: 'A', text: '   ' });
    appendLine({ sessionId: null, agentId: 'a', ownerId: 'u1', kind: ThreadKind.HIM, who: 'A', text: 'hi' });
    appendLine({ sessionId: 'sess-3', agentId: 'a', ownerId: 'u1', kind: 'shouting', who: 'A', text: 'hi' });
    assert.deepEqual(seen, [], 'the refusals above write nothing, so they announce nothing');
  });
});

test('SERVER-4: a listener that throws costs the push and never the line', () => {
  withStore(() => {
    setThreadListener(() => { throw new Error('the socket went away'); });
    const id = appendLine({
      sessionId: 'sess-4', agentId: 'a', ownerId: 'u1',
      kind: ThreadKind.TABLE, who: 'TABLE', text: 'Still dealt.',
    });
    assert.ok(id, 'the row was written');
    assert.equal(readThread('sess-4', { owner: true }).length, 1, 'and it reads back');
  });
});

// ── Job 1 · the nightly exchange ────────────────────────────────────────────

test('SERVER-4: the overheard exchange is pushed as the one entry it is', () => {
  withStore(() => {
    let pushed = null;
    setThreadListener((_o, line) => { pushed = line; });
    const sessionId = homeSessionId('u1', dayKey());
    appendOverheard({
      sessionId, ownerId: 'u1',
      lines: [
        { from: 'balance', to: 'granite', who: 'BALANCE', text: 'Long evening.' },
        { from: 'granite', to: 'balance', who: 'GRANITE', text: 'They all are.' },
      ],
    });
    assert.ok(pushed);
    assert.equal(pushed.kind, ThreadKind.OVERHEARD);
    assert.equal(pushed.source, ThreadSource.HOME);
    assert.equal(pushed.lines.length, 2, 'one entry, two lines inside it');
  });
});

test('SERVER-4: each overheard line carries its own ts, in the order it was said', () => {
  withStore(() => {
    const sessionId = homeSessionId('u2', dayKey());
    const at = 1_700_000_000_000;
    appendOverheard({
      sessionId, ownerId: 'u2', ts: at,
      lines: [
        { from: 'a', to: 'b', who: 'A', text: 'First.' },
        { from: 'b', to: 'a', who: 'B', text: 'Second.' },
        { from: 'a', to: 'b', who: 'A', text: 'Third.' },
      ],
    });
    const [entry] = readThread(sessionId, { owner: true });
    const stamps = entry.lines.map((l) => l.ts);
    assert.deepEqual(stamps, [
      at,
      at + OVERHEARD_LINE_STEP_MS,
      at + 2 * OVERHEARD_LINE_STEP_MS,
    ]);
    // The point of the step: three lines are three keys, and sorting by ts
    // gives back the order they were said in.
    assert.equal(new Set(stamps).size, 3, 'no two lines share a clock');
    assert.deepEqual([...stamps].sort((x, y) => x - y), stamps);
    // The entry itself is stamped when the exchange happened, not after it.
    assert.equal(entry.ts, at);
  });
});

// ── Job 2 · say is live ─────────────────────────────────────────────────────

test('SERVER-4: POST /api/home/say answers before anybody has spoken', async (t) => {
  await withServer(async ({ base, profiles }) => {
    // Every profile this test will ask about is written BEFORE anything
    // touches agentProfiles, which loads the whole store into memory on its
    // first call and does not reload. A save after that first touch lands in
    // the database and is invisible to the routes — which is a hazard for the
    // test, not for the server, where nothing writes profiles behind its back.
    const store = await import('./store.js');
    store.saveWallet('u1', { ownerId: 'u1', balance: 5_000, ledger: [] });
    store.saveProfile('u1', {
      userId: 'u1', chat: [],
      agents: [homeAgent('balance', 'BALANCE'), homeAgent('granite', 'GRANITE')],
    });
    store.saveWallet('u9', { ownerId: 'u9', balance: 5_000, ledger: [] });
    store.saveProfile('u9', {
      userId: 'u9', chat: [],
      agents: [homeAgent('marlow', 'MARLOW', { status: 'playing', activeTableId: 'tbl-1' })],
    });

    const typed = [];
    const pushed = [];
    profiles.setTypingListener((userId, agentId) => typed.push({ userId, agentId }));
    setThreadListener((_o, line) => pushed.push(line));

    await t.test('the response lands with your line stored and nothing said back', async () => {
      const res = await postJson(`${base}/api/home/say`, { userId: 'u1', text: 'Evening.' });
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.deepEqual(body.pending.map((p) => p.agentId).sort(), ['balance', 'granite']);
      assert.equal(body.replies.length, 0);
      // Your own line is the one thing that IS true by the time you are
      // answered, and it went out on the wire as a THREAD_LINE.
      const yours = pushed.filter((l) => l.kind === ThreadKind.YOU);
      assert.equal(yours.length, 1);
      assert.equal(yours[0].text, 'Evening.');
      assert.equal(yours[0].from, OWNER);
      assert.equal(yours[0].to, ROOM, 'said to the room, once, not once per listener');
    });

    await t.test('a TYPING goes out for each of them, and a THREAD_LINE after it', async () => {
      await until(
        () => (pushed.filter((l) => l.kind === ThreadKind.HIM).length === 2 ? true : null),
        'both replies to be pushed',
      );
      assert.deepEqual(typed.map((x) => x.agentId).sort(), ['balance', 'granite'],
        'both of them were announced as answering');
      for (const entry of typed) assert.equal(entry.userId, 'u1');

      // The order on the wire is the order in the room: your line first, then
      // theirs. A client that draws the indicator on TYPING and clears it on
      // the next THREAD_LINE from that agent never has one without the other.
      const kinds = pushed.map((l) => l.kind);
      assert.equal(kinds[0], ThreadKind.YOU);
      assert.equal(kinds.filter((k) => k === ThreadKind.HIM).length, 2);
    });

    await t.test('and all of it is in the thread, for a client that was not listening', async () => {
      const body = await getJson(`${base}/api/home/thread?userId=u1`);
      assert.equal(body.lines.length, 3, 'yours plus one each');
      assert.deepEqual(
        body.lines.filter((l) => l.kind === ThreadKind.HIM).map((l) => l.from).sort(),
        ['balance', 'granite'],
      );
    });

    // The other owner's whole household is out. Saying something to an empty
    // flat is not an error and not a wait: the line is stored and nobody is
    // named as answering it.
    await t.test('an empty flat is answered immediately and expects nobody', async () => {
      const res = await postJson(`${base}/api/home/say`, { userId: 'u9', text: 'Hello?' });
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.home, 0);
      assert.deepEqual(body.pending, []);
      const thread = await getJson(`${base}/api/home/thread?userId=u9`);
      assert.ok(thread.lines.some((l) => l.text === 'Hello?'), 'and it is still in the thread');
    });
  });
});

// ── harness ─────────────────────────────────────────────────────────────────

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const getJson = (url) => fetch(url).then((r) => r.json());

// Polls rather than sleeping a fixed time: with no API key every turn answers
// from its own fallback, so this settles on the first or second pass and only
// the failure path is slow.
async function until(fn, what, { timeoutMs = 5_000, everyMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const got = await fn();
    if (got) return got;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
}

// The minimum a WebSocket has to be for floorChannel to push to it.
function fakeSocket() {
  const ws = { OPEN: 1, readyState: 1, sent: [] };
  ws.send = (raw) => ws.sent.push(JSON.parse(raw));
  return ws;
}

function homeAgent(id, name, over = {}) {
  return {
    id, name, status: 'idle', activeTableId: null,
    style: 'Balanced', risk: 'Medium', strategy: 'You are a poker player.',
    bankroll: 3_000,
    pocket: { balance: 3_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 120, handsWon: 50 },
    profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
    ...over,
  };
}

function withStore(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-threadpush-'));
  _closeForTests();
  process.chdir(dir);
  try {
    fn();
  } finally {
    setThreadListener(null);
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-saylive-'));
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  const savedSecret = process.env.DEV_API_SECRET;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  _closeForTests();
  process.chdir(dir);

  const { default: express } = await import('express');
  const profiles = await import('./agentProfiles.js');
  const app = express();
  app.use(express.json());
  profiles.installAgentProfileRoutes(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    await fn({ base: `http://127.0.0.1:${server.address().port}`, profiles });
  } finally {
    profiles.setTypingListener(null);
    setThreadListener(null);
    await new Promise((r) => server.close(r));
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
