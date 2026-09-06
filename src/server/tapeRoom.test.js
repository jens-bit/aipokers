// src/server/tapeRoom.test.js — HOME-STATE-1 (item 3)
//
// Ninety seconds with the tape, and the one line it produces.
//
// The rule with teeth is the third one: studying moves NO attribute. If it
// did, the optimal way to play this game would be to never deploy anybody.
//
// The read book itself — the shape, the caps, the line's determinism and its
// voice — is asserted next to the module that owns it, src/agent/reads.test.js.

// TEST-2 / the testing law: no automated suite talks to a real model. The tape
// room makes none by construction, and this asserts it stays that way.
delete process.env.ANTHROPIC_API_KEY;

// Ninety seconds is the product; sixty milliseconds is the test. Set before
// the module is imported, because that is when it reads it.
process.env.HOME_STUDY_MS = '60';
const STUDY_MS = 60;

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildFlaggedEntry } from './flaggedHands.js';
import { studyLine } from '../agent/reads.js';
import { Routine } from './home.js';
import { _closeForTests } from './store.js';

const tape = await import('./tapeRoom.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const getJson = (url) => fetch(url).then(async (r) => ({ status: r.status, body: await r.json() }));

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-tape-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;
const savedSecret = process.env.DEV_API_SECRET;

let base;
let server;
let profiles;

// A flagged hand as table.js builds one: a bad beat he took from Granite, with
// Granite's cards face up at the end.
const flagged = (handNumber, flagType, opponents, showdown = []) => buildFlaggedEntry({
  flagType,
  handNumber,
  pot: 900,
  holeCards: ['Ah', 'Kd'],
  won: false,
  decisions: [{ street: 'flop', action: { type: 'bet', amount: 120 }, equity: 0.82, community: ['Ac', '7d', '2s'] }],
  opponentShowdownCards: showdown,
  opponents,
});

const mkAgent = (id, name, extra = {}) => ({
  id, name, status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'You are a poker player.',
  bankroll: 3_000,
  pocket: { balance: 3_000, mode: 'topup', cap: null, realised: 0, ledger: [] },
  stats: { handsPlayed: 40, handsWon: 10, totalDecisions: 100 },
  ...extra,
});

before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  _closeForTests();
  process.chdir(dir);

  const store = await import('./store.js');
  store.saveProfile('tape', {
    userId: 'tape', chat: [],
    agents: [
      mkAgent('student', 'The Clock', {
        nature: { name: 'Rock' },
        sessionFlagged: [
          flagged(41, 'badBeat', [{ seat: 1, playerId: 'p_granite', displayName: 'Granite' }], [{ seat: 1, holeCards: ['7h', '7s'] }]),
          flagged(42, 'bigBluff', [
            { seat: 1, playerId: 'p_granite', displayName: 'Granite' },
            { seat: 2, playerId: 'p_doyle', displayName: 'Doyle' },
          ], [{ seat: 2, holeCards: ['Qc', 'Qd'] }]),
          // A hand from before opponents were stored with them.
          { flagType: 'cooler', handNumber: 43, pot: 400, holeCards: [], won: false, streets: [], opponentShowdownCards: [] },
        ],
      }),
      mkAgent('seated', 'Big Slick', { status: 'playing', activeTableId: 'tbl-1' }),
    ],
  });

  profiles = await import('./agentProfiles.js');
  profiles.setLiveTableProvider({
    getTable: (id) => (id === 'tbl-1' ? { tableId: 'tbl-1', bigBlind: 20, home: false } : null),
    hasTable: (id) => id === 'tbl-1',
    getLiveGame: (id) => (id === 'tbl-1' ? { tableId: 'tbl-1', street: 'flop', pot: 100 } : null),
    homeTableOf: () => null,
  });

  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  tape.installTapeRoomRoutes(app);
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  tape.reset();
  await new Promise((r) => server.close(r));
  profiles?.setLiveTableProvider(null);
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ── The subject ─────────────────────────────────────────────────────────────

test('HOME-STATE-1: the line is filed under the man who showed him a hand', () => {
  const twoHanded = flagged(42, 'bigBluff', [
    { seat: 1, playerId: 'p_granite', displayName: 'Granite' },
    { seat: 2, playerId: 'p_doyle', displayName: 'Doyle' },
  ], [{ seat: 2, holeCards: ['Qc', 'Qd'] }]);
  assert.equal(tape.subjectOf(twoHanded).playerId, 'p_doyle', 'the showdown is the only place he learns anything');

  const noShowdown = flagged(44, 'bigBluff', [{ seat: 1, playerId: 'p_granite', displayName: 'Granite' }]);
  assert.equal(tape.subjectOf(noShowdown).playerId, 'p_granite');

  assert.equal(tape.subjectOf({ flagType: 'cooler', handNumber: 43 }), null);
});

// ── The routes ──────────────────────────────────────────────────────────────

test('HOME-STATE-1: he goes in, ninety seconds pass, one line comes out', async () => {
  const before = profiles.getAgentAttributes('student', 'tape');
  const attrsBefore = JSON.stringify(before.attrs);
  const potentialBefore = JSON.stringify(before.potential);

  const res = await postJson(`${base}/api/agents/student/study`, { userId: 'tape', handId: 41 });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.subject.displayName, 'Granite');
  assert.equal(body.studyMs, STUDY_MS);
  assert.ok(body.study.endsAt > body.study.startedAt);
  assert.equal('text' in body, false, 'he has not watched it yet');
  assert.equal('line' in body.study, false);

  // While he is in there he is unavailable, and the HOME screen says so.
  const during = profiles.presentedRoster('tape', { owner: true }).find((a) => a.id === 'student');
  assert.equal(during.routine.key, Routine.TAPE);
  assert.ok(during.study);

  // A second request is refused rather than stacking another ninety seconds.
  const second = await postJson(`${base}/api/agents/student/study`, { userId: 'tape', handId: 42 });
  assert.equal(second.status, 409);

  await sleep(STUDY_MS + 120);

  const done = profiles.presentedRoster('tape', { owner: true }).find((a) => a.id === 'student');
  assert.equal(done.study, null, 'out of the tape room');
  assert.equal(done.routine.key, Routine.READS, 'back to his nature');

  const { status, body: seen } = await getJson(`${base}/api/agents/student/study?userId=tape`);
  assert.equal(status, 200);
  assert.equal(seen.study, null);
  assert.equal(seen.count, 1, 'one opponent in the book');
  assert.equal(seen.book[0].displayName, 'Granite');
  assert.equal(seen.book[0].lines.length, 1);
  assert.equal(seen.book[0].lines[0].handNumber, 41);
  assert.equal(seen.book[0].lines[0].text, studyLine({ flagType: 'badBeat', handNumber: 41 }));

  // THE RULE WITH TEETH.
  const after = profiles.getAgentAttributes('student', 'tape');
  assert.equal(JSON.stringify(after.attrs), attrsBefore, 'ninety seconds with a tape moved an attribute');
  assert.equal(JSON.stringify(after.potential), potentialBefore, 'and it must not narrow a band either');
});

test('HOME-STATE-1: what the tape room refuses', async () => {
  // A man in a seat is not in the front room.
  const seated = await postJson(`${base}/api/agents/seated/study`, { userId: 'tape', handId: 1 });
  assert.equal(seated.status, 409);
  assert.equal((await seated.json()).where, 'table');

  const nobody = await postJson(`${base}/api/agents/ghost/study`, { userId: 'tape', handId: 41 });
  assert.equal(nobody.status, 404);

  const noHand = await postJson(`${base}/api/agents/student/study`, { userId: 'tape' });
  assert.equal(noHand.status, 400);

  const unknownHand = await postJson(`${base}/api/agents/student/study`, { userId: 'tape', handId: 999 });
  assert.equal(unknownHand.status, 404);

  // A hand recorded before opponents were stored with it. Filing a real
  // opinion under a guessed seat index is worse than refusing.
  const anonymous = await postJson(`${base}/api/agents/student/study`, { userId: 'tape', handId: 43 });
  assert.equal(anonymous.status, 409);
  assert.match((await anonymous.json()).error, /nobody to form a read on/);
});

test('HOME-STATE-1: a second study files a second line under the same man', async () => {
  const res = await postJson(`${base}/api/agents/student/study`, { userId: 'tape', handId: 42 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).subject.displayName, 'Doyle', 'he showed queens at the end of that one');

  await sleep(STUDY_MS + 120);
  const { body } = await getJson(`${base}/api/agents/student/study?userId=tape`);
  assert.equal(body.count, 2);
  assert.deepEqual(body.book.map((s) => s.displayName).sort(), ['Doyle', 'Granite']);
});
