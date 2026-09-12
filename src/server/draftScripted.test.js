// src/server/draftScripted.test.js — BUG-198
//
// The guest draft, through the door the product actually uses.
//
// draftScript.test.js holds the script honest as data. This file holds the
// ROUTE honest, because the bug was never in a regex — it was that the chat
// route asked `draftProfile(brief)` whether a one-word answer counted, got no,
// and appended the same sentence again. Both of those are only visible from
// outside, in the transcript a guest is reading.
//
// The two claims, and they are the two Jens filed:
//
//   1. The recruiter NEVER asks the same question twice in a row.
//   2. A guest is done in four answers.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { STAGES, MISS_LINE } from './draftScript.js';

const ORIGINAL_CWD = process.cwd();
let dir; let store; let guest; let profiles; let server; let base;
let GUEST_ID; let GUEST_TOKEN;

const post = (p, body, cookie = null) => fetch(`${base}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const cookie = () => `${guest.GUEST_COOKIE}=${GUEST_TOKEN}`;
const say = (content) => post('/api/agents/chat', { userId: GUEST_ID, content }, cookie());
const recruiterLines = (chat) => (chat ?? []).filter((t) => t.role === 'assistant').map((t) => String(t.content).trim());

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-draftscript-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  process.env.GUEST_ENABLED = '1';
  // This file walks several whole drafts, which is far more chat turns than
  // the route's 10-a-minute limiter allows. Raised here rather than worked
  // around, because a 429 in the middle of a transcript test would fail with
  // a message about draft stages and nothing about rate limiting.
  process.env.RATE_LIMIT_CHAT_MAX = '100000';
  process.env.RATE_LIMIT_MAX = '100000';

  guest = await import('./guest.js');
  profiles = await import('./agentProfiles.js');

  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  guest.installGuestRoutes(app);
  profiles.installAgentProfileRoutes(app);
  server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;

  const made = await post('/api/guest', {});
  GUEST_ID = made.body.ownerId;
  GUEST_TOKEN = made.body.token;
  store.saveWallet(GUEST_ID, { ownerId: GUEST_ID, balance: 20_000, fridge: {}, ledger: [] });
});

after(() => {
  server?.close();
  process.chdir(ORIGINAL_CWD);
  store?._closeForTests();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const reset = () => post('/api/agents/chat/reset', { userId: GUEST_ID }, cookie());

test('BUG-198: "loose" is an answer, and the recruiter says so', async () => {
  await reset();
  const r = await say('loose');

  assert.equal(r.status, 200);
  const lines = recruiterLines(r.body.chat);
  const last = lines.at(-1);
  assert.match(last, /^Loose\. Got it\./, `the recruiter must restate it; said "${last}"`);
  assert.ok(!/loose or selective/i.test(last), 'the old fallback line must be gone');
  assert.equal(r.body.draftStage, 'bluffing', 'and it must have moved on');
});

test('BUG-198: the recruiter never asks the same question twice in a row', async () => {
  await reset();

  // Four misses in a row. Before the repair this appended the identical
  // sentence four times; the answer to "I do not understand" is never the same
  // question again, and definitely not four times.
  let chat = null;
  for (const nonsense of ['banana', 'banana', '???', 'do it for me']) {
    const r = await say(nonsense);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    chat = r.body.chat;
    const lines = recruiterLines(chat);
    assert.equal(lines.at(-1), MISS_LINE, 'a miss says the short thing, not the question');
    assert.ok(r.body.draftChips.length > 0, 'and the chips are there to tap');
  }

  // The opening question was asked once, when the draft opened, and never
  // again. Four misses used to produce four more copies of it.
  const lines = recruiterLines(chat);
  const opening = lines[0];
  assert.equal(lines.filter((l) => l === opening).length, 1,
    `the opening question appears ${lines.filter((l) => l === opening).length} times: ${JSON.stringify(lines)}`);
  // And the recruiter never says the same thing twice running, miss line
  // included — having nothing new to say means saying nothing.
  for (let i = 1; i < lines.length; i++) {
    assert.notEqual(lines[i], lines[i - 1], `repeated: "${lines[i]}"`);
  }
});

test('BUG-198: no two consecutive recruiter lines are ever identical, whatever is typed', async () => {
  await reset();
  // A walk that mixes hits, misses and repeats — the shape of somebody actually
  // struggling with the thing. The invariant holds over the WHOLE transcript.
  const walk = ['???', 'loose', 'loose', 'banana', 'often', 'often', 'nonsense', 'push', 'zzz'];
  let chat = null;
  for (const line of walk) chat = (await say(line)).body.chat;

  const lines = recruiterLines(chat);
  for (let i = 1; i < lines.length; i++) {
    assert.notEqual(lines[i], lines[i - 1],
      `lines ${i - 1} and ${i} are the same: "${lines[i]}"`);
  }
});

test('BUG-198: four answers and a guest has a poker player', async () => {
  await reset();

  const first = await say('Loose');
  assert.equal(first.body.draftStage, 'bluffing');
  const second = await say('Often');
  assert.equal(second.body.draftStage, 'unsure');
  const third = await say('Push');

  // Three answers in, the draft is ready and the fourth question is his name —
  // with one already in the field, so the fourth answer is a tap and not an
  // essay question.
  assert.equal(third.body.ready, true, 'three answers finish the character');
  assert.equal(third.body.draftStage, 'name');
  assert.ok(third.body.suggestedName, 'the name field arrives pre-filled');
  assert.ok(third.body.suggestedName.length <= 14);

  const named = await say(third.body.suggestedName);
  assert.equal(named.body.draftName, third.body.suggestedName);
  assert.equal(named.body.draftStep, 'ready');

  const born = await say('lets go');
  assert.equal(born.status, 200, JSON.stringify(born.body));
  assert.ok(born.body.agentId, 'and he exists');
  assert.equal(born.body.agentName, third.body.suggestedName);
  // The character he was actually given, not a default one.
  assert.ok(born.body.profile.bluffFreq > 40, 'he bluffs often, because that was answered');
  assert.ok(born.body.profile.tightness < 45, 'and he is loose, because that was too');
});

test('BUG-198: one sentence answering two questions skips the one it filled', async () => {
  await reset();
  const r = await say('loose and bluffs often');

  const last = recruiterLines(r.body.chat).at(-1);
  assert.match(last, /^Loose, bluffs often\. Got it\./, `said "${last}"`);
  assert.equal(r.body.draftStage, 'unsure', 'the bluffing question is not asked again');
  // The one that WAS skipped must not appear anywhere in the transcript.
  const bluffQuestion = STAGES.find((s) => s.key === 'bluffing').ask;
  assert.ok(!recruiterLines(r.body.chat).includes(bluffQuestion),
    'a question that was already answered must never be asked');
});

test('BUG-198: every stage offers the chips that answer it', async () => {
  await reset();
  const seen = [];
  let r = await post('/api/agents/draft', { userId: GUEST_ID }, cookie());
  for (const answer of ['Tight', 'Rarely', 'Fold']) {
    seen.push({ stage: r.body.draftStage, chips: r.body.draftChips });
    r = await say(answer);
  }

  assert.deepEqual(seen.map((s) => s.stage), ['style', 'bluffing', 'unsure']);
  assert.deepEqual(seen[0].chips, ['Tight', 'Balanced', 'Loose']);
  assert.deepEqual(seen[1].chips, ['Rarely', 'Sometimes', 'Often']);
  assert.deepEqual(seen[2].chips, ['Fold', 'Call it down', 'Push']);
  // And the name stage trades chips for a field with a name in it.
  assert.equal(r.body.draftStage, 'name');
  assert.deepEqual(r.body.draftChips, []);
  assert.ok(r.body.suggestedName);
});

test('BUG-198: an emptied name field takes the suggestion rather than asking again', async () => {
  await reset();
  for (const a of ['Tight', 'Rarely', 'Fold']) await say(a);
  const r = await say('the');   // scaffolding, not a name — coinName returns null

  assert.ok(r.body.draftName, 'he is named anyway');
  assert.equal(r.body.draftStep, 'ready');
  const last = recruiterLines(r.body.chat).at(-1);
  assert.ok(!/\?$/.test(last), `the last word must not be another question: "${last}"`);
});

test('FIRST-HOME-1: a fresh guest birth publishes its durable household exactly once', async () => {
  const made = await post('/api/guest', {});
  const userId = made.body.ownerId;
  const auth = `${guest.GUEST_COOKIE}=${made.body.token}`;
  const answer = content => post('/api/agents/chat', { userId, content }, auth);
  assert.equal(store.loadProfile(userId)?.agents?.length ?? 0, 0);
  for (const content of ['Tight', 'Rarely', 'Fold', 'Robin']) {
    const response = await answer(content);
    assert.equal(response.status, 200, JSON.stringify(response.body));
  }
  const changes = [];
  profiles.setAgentChangeListener(ownerId => {
    changes.push({ownerId, agents:store.loadProfile(ownerId)?.agents?.map(a=>a.id) ?? []});
  });
  try {
    const born = await answer('lets go');
    assert.equal(born.status, 200, JSON.stringify(born.body));
    assert.ok(born.body.agentId);
    assert.deepEqual(changes, [{ownerId:userId, agents:[born.body.agentId]}]);
    const replay = await answer('lets go');
    assert.equal(replay.body.agentId, born.body.agentId, 'a retried finish replays the existing birth');
    assert.equal(changes.length, 1, 'a replay does not publish a second birth');
  } finally {
    profiles.setAgentChangeListener(null);
  }
});
