// src/server/homeUnread.test.js — SERVER-4 job 3
//
// The room has something to tell you.
//
// `unseenRecap` says "he has something to tell you", one agent at a time. This
// is the same idea one level up, for the flat itself — and it has to be its own
// marker rather than a fold over the agents', because the two loudest things in
// the room thread belong to nobody in particular: the nightly overheard
// exchange is between two of them, and a line they wrote while you were out is
// not a recap of anything.
//
// It is a TIMESTAMP and not a boolean, which is the whole point. A dot says
// there is something; a `since` lets the client say what was missed and when it
// started.

delete process.env.ANTHROPIC_API_KEY;

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { homeStateMessage, Where, Routine, ROUTINE_LABELS } from './home.js';
import { _closeForTests } from './store.js';

// ── The body on the wire ────────────────────────────────────────────────────

test('SERVER-4: HOME_STATE carries the room thread\'s unread marker', () => {
  const waiting = homeStateMessage('u1', [], null, { thread: { unreadSince: 1_700_000_000_000 } });
  assert.equal(waiting.thread.unreadSince, 1_700_000_000_000);

  // Nothing waiting is null, in every shape the caller can be missing it in.
  for (const arg of [undefined, null, {}, { thread: null }, { thread: {} }]) {
    const quiet = homeStateMessage('u1', [], null, arg ?? undefined);
    assert.equal(quiet.thread.unreadSince, null,
      `a caller that says nothing about the thread means nothing is waiting (${JSON.stringify(arg)})`);
  }
});

test('SERVER-4: the marker rides the same message the room does', () => {
  const msg = homeStateMessage('u1', [{
    id: 'a1', name: 'The Clock', nature: { name: 'Rock' },
    location: { where: Where.HOME, tableId: null, room: null, since: 5 },
    routine: { key: Routine.READS, label: ROUTINE_LABELS[Routine.READS] },
  }], null, { thread: { unreadSince: 42 } });
  // One message, one paint: the roster and the badge cannot disagree because
  // they arrive together.
  assert.equal(msg.agents.length, 1);
  assert.equal(msg.thread.unreadSince, 42);
});

// ── The marker itself ───────────────────────────────────────────────────────

test('SERVER-4: the FIRST unread line sets the marker, and later ones do not move it', async () => {
  const profiles = await import('./agentProfiles.js');
  assert.equal(profiles.homeThreadUnread('own-mark'), null, 'a quiet flat has nothing waiting');

  assert.equal(profiles.noteHomeThreadLine('own-mark', 1_000), true, 'the first line marks it');
  assert.equal(profiles.homeThreadUnread('own-mark'), 1_000);

  // Three lines arriving in a minute are ONE thing he has not read. A marker
  // that kept jumping forward would say "since a moment ago" about a
  // conversation that started twenty minutes back.
  assert.equal(profiles.noteHomeThreadLine('own-mark', 2_000), false);
  assert.equal(profiles.noteHomeThreadLine('own-mark', 3_000), false);
  assert.equal(profiles.homeThreadUnread('own-mark'), 1_000, 'still the oldest unread line');
});

test('SERVER-4: seen clears it, and clearing an empty room is not an error', async () => {
  const profiles = await import('./agentProfiles.js');
  profiles.noteHomeThreadLine('own-seen', 500);
  assert.equal(profiles.markHomeThreadSeen('own-seen'), true);
  assert.equal(profiles.homeThreadUnread('own-seen'), null);
  // Idempotent: pressing it twice cleared nothing the second time, and said so.
  assert.equal(profiles.markHomeThreadSeen('own-seen'), false);
  assert.equal(profiles.homeThreadUnread('own-seen'), null);
  // And it can be marked again afterwards — being caught up is not permanent.
  assert.equal(profiles.noteHomeThreadLine('own-seen', 900), true);
  assert.equal(profiles.homeThreadUnread('own-seen'), 900);
});

test('SERVER-4: one owner\'s unread room is nobody else\'s', async () => {
  const profiles = await import('./agentProfiles.js');
  profiles.noteHomeThreadLine('own-a', 111);
  assert.equal(profiles.homeThreadUnread('own-a'), 111);
  assert.equal(profiles.homeThreadUnread('own-b'), null);
});

// ── The routes ──────────────────────────────────────────────────────────────

test('SERVER-4: the thread route reports the marker but does not clear it', async () => {
  const base = await server();
  const profiles = await import('./agentProfiles.js');
  profiles.noteHomeThreadLine('own-routes', 777);

  const body = await getJson(`${base}/api/home/thread?userId=own-routes`);
  assert.equal(body.unreadSince, 777);

  // Fetching is not looking. The client pulls this to render a badge, on a
  // screen the room may not even be open on, so the clear is its own act.
  const again = await getJson(`${base}/api/home/thread?userId=own-routes`);
  assert.equal(again.unreadSince, 777, 'reading it twice still leaves it waiting');
});

test('SERVER-4: POST /api/home/thread/seen is what clears it', async () => {
  const base = await server();
  const profiles = await import('./agentProfiles.js');
  profiles.noteHomeThreadLine('own-clear', 888);

  const res = await postJson(`${base}/api/home/thread/seen`, { userId: 'own-clear' });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.equal(body.cleared, true);
  assert.equal(body.unreadSince, null);
  assert.equal(profiles.homeThreadUnread('own-clear'), null);

  // A second press is a 200 that cleared nothing, not a 400.
  const twice = await postJson(`${base}/api/home/thread/seen`, { userId: 'own-clear' });
  assert.equal(twice.status, 200);
  assert.equal((await twice.json()).cleared, false);

  const thread = await getJson(`${base}/api/home/thread?userId=own-clear`);
  assert.equal(thread.unreadSince, null);
});

test('SERVER-4: clearing the room tells the living room', async () => {
  const base = await server();
  const profiles = await import('./agentProfiles.js');
  const told = [];
  profiles.setHomeChangeListener((userId) => told.push(userId));

  profiles.noteHomeThreadLine('own-push', 1);
  await postJson(`${base}/api/home/thread/seen`, { userId: 'own-push' });
  assert.deepEqual(told, ['own-push'], 'the badge lives on HOME_STATE, so the screen is told');

  // Nothing changed, nothing announced: a second press is not news.
  await postJson(`${base}/api/home/thread/seen`, { userId: 'own-push' });
  assert.deepEqual(told, ['own-push']);
  profiles.setHomeChangeListener(null);
});

test('SERVER-4: the room is his — a stranger cannot read it or clear it', async () => {
  const base = await server();
  const saved = process.env.TELEGRAM_BOT_TOKEN;
  // A bot token is the switch that turns isOwner() from "always true" into a
  // real check, and nothing here carries a credential. Both routes sit behind
  // telegramAuthMiddleware, so the refusal lands at 401 before isOwner's 403
  // is reached — the new route is gated exactly as the one beside it, which is
  // what is being asserted.
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  try {
    assert.equal((await fetch(`${base}/api/home/thread?userId=own-clear`)).status, 401);
    assert.equal((await postJson(`${base}/api/home/thread/seen`, { userId: 'own-clear' })).status, 401);
  } finally {
    if (saved === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = saved;
  }
  // And it is still waiting for the owner who actually has it.
  const profiles = await import('./agentProfiles.js');
  profiles.noteHomeThreadLine('own-stranger', 5);
  assert.equal(profiles.homeThreadUnread('own-stranger'), 5);
});

// ── harness ─────────────────────────────────────────────────────────────────

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });
const getJson = (url) => fetch(url).then((r) => r.json());

// ONE scratch database for the whole file and a distinct owner per test — the
// same shape home.test.js uses, and for the same reason: agentProfiles caches
// the loaded store in a module-level variable and has no reset seam, so a
// second chdir inside one process reads the FIRST directory's store.
const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-unread-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;
const savedSecret = process.env.DEV_API_SECRET;
let app = null;
let listening = null;

before(() => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  _closeForTests();
  process.chdir(dir);
});

after(async () => {
  if (listening) await new Promise((r) => listening.close(r));
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// One server for the whole file, stood up on first use.
async function server() {
  if (app) return app;
  const { default: express } = await import('express');
  const profiles = await import('./agentProfiles.js');
  const instance = express();
  instance.use(express.json());
  profiles.installAgentProfileRoutes(instance);
  listening = await new Promise((resolve) => {
    const s = instance.listen(0, '127.0.0.1', () => resolve(s));
  });
  app = `http://127.0.0.1:${listening.address().port}`;
  return app;
}
