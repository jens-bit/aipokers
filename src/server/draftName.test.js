// src/server/draftName.test.js — DRAFT-2
//
// THE NAME ON THE WIRE, THE TURN IT IS GIVEN.
//
// BUGS-B/4 made the draft ask "what's my name?" exactly once, and naming.js
// coins whatever comes back. But the answer had nowhere to go until the build:
// the chat reply carried `profile`, `natureHint` and `ready`, and no name — so
// DRAFT-2's pill over the room could only wait for `agentId`, which is to say
// the owner typed his name and watched a nameless silhouette until the whole
// birth had already happened.
//
// `draftName` is that answer, coined server-side by the same coinName call
// buildFromDraft makes, so the name on the pill is the name he walks in with
// rather than a guess that changes underneath it.
//
// A real server on the real store in a scratch cwd, auth off — the same
// harness as slots.test.js.

// TEST-2 / the testing law: no automated suite talks to a real model. Without
// a key the recruiter's reply is draftGuard's own, which is the point: every
// line below is the server's, not a model's.
delete process.env.ANTHROPIC_API_KEY;

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { asksForName } from './draftGuard.js';
import { _closeForTests } from './store.js';

const postJson = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

async function withServer(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-draftname-'));
  const savedToken = process.env.TELEGRAM_BOT_TOKEN;
  const savedSecret = process.env.DEV_API_SECRET;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  _closeForTests();
  process.chdir(dir);

  const { default: express } = await import('express');
  const { installAgentProfileRoutes } = await import('./agentProfiles.js');
  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

const say = (base, userId, content) =>
  postJson(`${base}/api/agents/chat`, { userId, content }).then((r) => r.json());

test('DRAFT-2: the draft carries his name from the turn the owner gives it', async (t) => {
  await withServer(async (base) => {
    let asked = null;

    await t.test('nobody is named before anybody is asked', async () => {
      const body = await say(base, 'u1', 'Tight and patient');
      assert.equal(body.draftName, null,
        'the brief is full of words and none of them are what he is called');
      assert.equal(body.ready, true, 'that brief is enough to build him');
      asked = body.chat[body.chat.length - 1].content;
      assert.equal(asksForName(asked), true, 'so the recruiter asks the one question');
    });

    await t.test('the answer to that question is his name', async () => {
      const body = await say(base, 'u1', 'Granite');
      assert.equal(body.draftName, 'Granite');
    });

    await t.test('and it is coined, not echoed', async () => {
      await postJson(`${base}/api/agents/chat/reset`, { userId: 'u2' });
      await say(base, 'u2', 'Tight and patient');
      const body = await say(base, 'u2', 'call him the grinder');
      assert.equal(body.draftName, 'The Grinder',
        'coinName strips the lead-in and cases it — the same call the build makes');
    });

    await t.test('a name too wide for a seat plate is cut at a word', async () => {
      await postJson(`${base}/api/agents/chat/reset`, { userId: 'u3' });
      await say(base, 'u3', 'Tight and patient');
      const body = await say(base, 'u3', 'The Relentless Machine');
      assert.equal(body.draftName, 'The Relentless');
      assert.ok(body.draftName.length <= 14);
    });

    await t.test('a brief with no name in it names nobody', async () => {
      await postJson(`${base}/api/agents/chat/reset`, { userId: 'u4' });
      await say(base, 'u4', 'Tight and patient');
      const body = await say(base, 'u4', 'whatever you like');
      assert.equal(body.draftName, null,
        'scaffolding is the words around a name, not a name — the pill stays a silhouette');
    });

    await t.test('the go signal is not a name', async () => {
      await postJson(`${base}/api/agents/chat/reset`, { userId: 'u5' });
      await say(base, 'u5', 'Tight and patient');
      const res = await postJson(`${base}/api/agents/chat`, { userId: 'u5', content: "let's go" });
      const body = await res.json();
      assert.notEqual(body.draftName, 'Lets Go');
      assert.ok(body.agentId, 'it built him instead');
    });
  });
});
