// src/server/homeThread.test.js — THREAD-2
//
// Home thread hygiene. Three rules, and one test file because they are one
// tree: every home line is attributed (`from` and `to`), the nightly exchange
// is ONE entry rather than a run of loose lines, and what the owner says to
// the house reaches everybody in it.
//
// The nightly exchange's own storage is asserted where the rest of homeNight
// is (homeNight.test.js). What is here is the thread layer underneath it and
// the fan-out on top.

// TEST-2 / the testing law: no automated suite talks to a real model. The
// fan-out below spends one model call per agent at home, so this file supplies
// its own turn function rather than letting one out of the building.
delete process.env.ANTHROPIC_API_KEY;

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendLine, appendOverheard, readThread, ThreadKind, ThreadSource, OWNER, ROOM,
} from './thread.js';
import { homeSessionId, dayKey } from './homeNight.js';
import { _closeForTests } from './store.js';

// ── The attribution ─────────────────────────────────────────────────────────

test('THREAD-2: a home line carries who it is from and who it is to', () => {
  withStore(() => {
    appendLine({
      sessionId: 'h-1', agentId: 'balance', ownerId: 'u1',
      kind: ThreadKind.HIM, who: 'BALANCE', text: 'You are in my seat.',
      source: ThreadSource.HOME, from: 'balance', to: 'granite',
    });
    const [line] = readThread('h-1', { owner: true });
    assert.equal(line.from, 'balance');
    assert.equal(line.to, 'granite');
    assert.equal(line.source, 'home');
    // This is the pair the client draws "BALANCE → GRANITE" from, and it is
    // the only thing it needs to.
    assert.equal(line.who, 'BALANCE');
  });
});

test('THREAD-2: the owner is a participant like anybody else', () => {
  withStore(() => {
    appendLine({
      sessionId: 'h-2', agentId: 'balance', ownerId: 'u1',
      kind: ThreadKind.YOU, who: 'YOU', text: 'Anyone home?',
      source: ThreadSource.HOME, from: OWNER, to: ROOM,
    });
    appendLine({
      sessionId: 'h-2', agentId: 'balance', ownerId: 'u1',
      kind: ThreadKind.HIM, who: 'BALANCE', text: 'Just me.',
      source: ThreadSource.HOME, from: 'balance', to: OWNER,
    });
    const lines = readThread('h-2', { owner: true });
    assert.deepEqual(lines.map((l) => [l.from, l.to]), [['owner', 'all'], ['balance', 'owner']]);
  });
});

test('THREAD-2: a table line is still said by the room to nobody, and says so', () => {
  withStore(() => {
    appendLine({
      sessionId: 't-1', agentId: 'balance', ownerId: 'u1', tableId: 'tbl-1',
      kind: ThreadKind.TABLE, who: 'TABLE', text: 'Granite raised to 240',
    });
    const [line] = readThread('t-1', { owner: true });
    assert.equal(line.from, null);
    assert.equal(line.to, null, 'the room announces; it does not address anybody');
  });
});

// ── The overheard entry ─────────────────────────────────────────────────────

test('THREAD-2: an exchange is ONE entry with its lines inside it', () => {
  withStore(() => {
    const sessionId = homeSessionId('u1', dayKey());
    appendOverheard({
      sessionId,
      ownerId: 'u1',
      lines: [
        { from: 'balance', to: 'granite', who: 'BALANCE', text: 'Long day.' },
        { from: 'granite', to: 'balance', who: 'GRANITE', text: 'They are all long.' },
      ],
    });
    const entries = readThread(sessionId, { owner: true });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].kind, ThreadKind.OVERHEARD);
    assert.equal(entries[0].source, 'home');
    assert.equal(entries[0].lines.length, 2);
    assert.deepEqual(entries[0].lines.map((l) => l.from), ['balance', 'granite']);
    assert.deepEqual(entries[0].lines.map((l) => l.to), ['granite', 'balance']);
  });
});

test('THREAD-2: one exchange per owner per day — a second one replaces it', () => {
  withStore(() => {
    const sessionId = homeSessionId('u1', dayKey());
    appendOverheard({
      sessionId, ownerId: 'u1',
      lines: [{ from: 'a', to: 'b', who: 'A', text: 'First.' }],
    });
    appendOverheard({
      sessionId, ownerId: 'u1',
      lines: [{ from: 'a', to: 'b', who: 'A', text: 'Second.' }],
    });
    const entries = readThread(sessionId, { owner: true });
    assert.equal(entries.length, 1, 'never two copies of one conversation');
    assert.equal(entries[0].text, 'Second.');
  });
});

test('THREAD-2: the day is part of the session id, so tomorrow is its own exchange', () => {
  withStore(() => {
    const today = homeSessionId('u1', '2026-09-06');
    const tomorrow = homeSessionId('u1', '2026-09-07');
    assert.notEqual(today, tomorrow);
    appendOverheard({ sessionId: today, ownerId: 'u1', lines: [{ from: 'a', to: 'b', who: 'A', text: 'Tonight.' }] });
    appendOverheard({ sessionId: tomorrow, ownerId: 'u1', lines: [{ from: 'a', to: 'b', who: 'A', text: 'Tomorrow.' }] });
    assert.equal(readThread(today, { owner: true }).length, 1);
    assert.equal(readThread(tomorrow, { owner: true }).length, 1);
  });
});

test('THREAD-2: what is said in his flat is his — a stranger gets none of it', () => {
  withStore(() => {
    const sessionId = homeSessionId('u1', dayKey());
    appendOverheard({
      sessionId, ownerId: 'u1',
      lines: [{ from: 'a', to: 'b', who: 'A', text: 'Between us.' }],
    });
    appendLine({
      sessionId, agentId: 'a', ownerId: 'u1', kind: ThreadKind.YOU, who: 'YOU',
      text: 'Evening.', source: ThreadSource.HOME, from: OWNER, to: ROOM,
    });
    assert.equal(readThread(sessionId, { owner: false }).length, 0);
    assert.equal(readThread(sessionId, { owner: true }).length, 2);
  });
});

test('THREAD-2: an entry with nothing sayable in it is not written', () => {
  withStore(() => {
    assert.equal(appendOverheard({ sessionId: 'h-empty', ownerId: 'u1', lines: [] }), null);
    assert.equal(appendOverheard({ sessionId: 'h-empty', ownerId: 'u1', lines: [{ from: 'a', text: '  ' }] }), null);
    assert.equal(appendOverheard({ sessionId: null, ownerId: 'u1', lines: [{ from: 'a', text: 'hi' }] }), null);
    assert.equal(readThread('h-empty', { owner: true }).length, 0);
  });
});

// ── Saying something to the house ───────────────────────────────────────────

test('THREAD-2: POST /api/home/say fans out, and every reply is attributed', async (t) => {
  await withServer(async ({ base, profiles }) => {
    const store = await import('./store.js');
    store.saveWallet('u1', { ownerId: 'u1', balance: 5_000, ledger: [] });
    store.saveProfile('u1', {
      userId: 'u1', chat: [],
      agents: [
        homeAgent('balance', 'BALANCE'),
        homeAgent('granite', 'GRANITE'),
        // Out at the casino: he is not in the room, so he does not hear it.
        homeAgent('marlow', 'MARLOW', { status: 'playing', activeTableId: 'tbl-1' }),
      ],
    });

    // No key, so callClaude answers with its own fallback line rather than
    // reaching a model (TEST-2). That makes every reply here deterministic —
    // what is under test is the FAN-OUT and the attribution, not the words.

    await t.test('everybody at home answers, in his own voice', async () => {
      const res = await postJson(`${base}/api/home/say`, { userId: 'u1', text: 'Anyone in?' });
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.home, 2, 'the one at a table is out');
      assert.equal(body.replies.length, 2);
      assert.deepEqual(body.replies.map((r) => r.agentId).sort(), ['balance', 'granite']);
      for (const reply of body.replies) assert.ok(reply.text, 'each of them said something');
      assert.equal(typeof profiles.ownerChatTurn, 'function',
        'and they answer through the same turn the one-to-one chat uses');
    });

    await t.test('the thread reads back as a conversation, not a wall of quotes', async () => {
      const body = await getJson(`${base}/api/home/thread?userId=u1`);
      assert.equal(body.sessionId, homeSessionId('u1'));
      // One line from the owner, addressed to the room, and one reply each.
      const owner = body.lines.filter((l) => l.from === OWNER);
      assert.equal(owner.length, 1, 'said once, not once per listener');
      assert.equal(owner[0].to, ROOM);
      assert.equal(owner[0].text, 'Anyone in?');

      const replies = body.lines.filter((l) => l.from !== OWNER);
      assert.equal(replies.length, 2);
      for (const reply of replies) {
        assert.equal(reply.to, OWNER, 'he answered YOU');
        assert.ok(['balance', 'granite'].includes(reply.from));
        assert.equal(reply.source, 'home');
        assert.equal(reply.kind, ThreadKind.HIM);
      }
      assert.equal(body.lines.some((l) => l.from === 'marlow'), false,
        'a man at the casino cannot answer something said in the flat');
    });

    await t.test('an empty flat still keeps what you said', async () => {
      // Everybody out.
      for (const id of ['balance', 'granite']) {
        const rec = profiles._agentRecordForTests(id, 'u1');
        rec.status = 'playing';
        rec.activeTableId = 'tbl-1';
      }
      const res = await postJson(`${base}/api/home/say`, { userId: 'u1', text: 'Hello?' });
      const body = await res.json();
      assert.equal(res.status, 200, JSON.stringify(body));
      assert.equal(body.home, 0);
      assert.deepEqual(body.replies, [], 'nobody to answer is not an error');

      const thread = await getJson(`${base}/api/home/thread?userId=u1`);
      assert.ok(thread.lines.some((l) => l.text === 'Hello?'), 'and it is still in the thread');
    });

    await t.test('an empty message is refused before anything is spent', async () => {
      const res = await postJson(`${base}/api/home/say`, { userId: 'u1', text: '   ' });
      assert.equal(res.status, 400);
    });
  });
});

// ── harness ─────────────────────────────────────────────────────────────────

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const getJson = (url) => fetch(url).then((r) => r.json());

// An agent at home: nothing wrong with him, no table, nothing to do.
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

// A scratch cwd for the SQLite store, for the pure thread tests.
function withStore(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-homethread-'));
  _closeForTests();
  process.chdir(dir);
  try {
    fn();
  } finally {
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// The same server harness the other route suites use: auth off (no bot token
// is the documented local-dev posture), real store, scratch cwd.
async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-homesay-'));
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
    await new Promise((r) => server.close(r));
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

// ── The one thing the home thread must not do ───────────────────────────────

test('THREAD-2: an evening at home is not a STAY, so it never becomes his latest session', async () => {
  const { latestSessionFor } = await import('./thread.js');
  withStore(() => {
    // A real session at a felt, then a night in.
    appendLine({
      sessionId: 'sess-1', agentId: 'balance', ownerId: 'u1', tableId: 'tbl-1',
      kind: ThreadKind.TABLE, who: 'TABLE', text: 'Granite raised to 240',
    });
    appendLine({
      sessionId: homeSessionId('u1', dayKey()), agentId: 'balance', ownerId: 'u1',
      kind: ThreadKind.HIM, who: 'BALANCE', text: 'Evening.',
      source: ThreadSource.HOME, from: 'balance', to: OWNER,
    });
    // The watch screen's fallback wants the stay it was watching, and a night
    // in the flat is not one. The home thread has its own route.
    assert.equal(latestSessionFor('balance'), 'sess-1');
  });
});
