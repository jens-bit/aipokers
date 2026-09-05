// src/server/opener.test.js — RAISE-2
//
// The CHATS thread opened with
//   "Hey — I just finished 20 hands. Won 12, lost 8. Want to review any hands
//    or adjust my strategy?"
// long after MOOD-2c was supposed to have replaced it. The sentence was the
// CLIENT's, but the reason it kept appearing was the SERVER's: `opener` was
// written on only one of the two session-end paths, and only inside the branch
// that had a recap string, so it was null for most of the ways a thread
// actually gets opened.
//
// These assert the rule that replaced it: the server always serves an opener,
// it is always in his voice, and it is never a tally.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import {
  installAgentProfileRoutes,
  openerForAgent,
  finishAgentSession,
} from './agentProfiles.js';
import { natureOpener, OPENER_MAX_WORDS } from '../agent/moment.js';

// The sentence this ticket exists to delete, in every shape it took.
const TALLY = /just finished|Won \d+, lost \d+|adjust my strategy/i;

let server;
let base;
const userId = 'opener-e2e-user';

async function post(path, body) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

async function buildAgent(name) {
  await post('/api/agents/chat/reset', { userId });
  await post('/api/agents/chat', { userId, message: `Call him ${name}. Tight and aggressive.` });
  const built = await post('/api/agents/build', { userId });
  return built.createdAgent;
}

before(async () => {
  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => { server?.close(); });

// ── the unit ────────────────────────────────────────────────────────────────

test('RAISE-2: a brand new agent greets in his nature, not with a scoreboard', () => {
  const fresh = { id: 'a', nature: { name: 'Hothead' }, stats: { handsPlayed: 0 } };
  const line = openerForAgent(fresh);
  assert.equal(line, natureOpener('Hothead'));
  assert.doesNotMatch(line, TALLY);
});

test('RAISE-2: an agent born before natures existed still gets a sentence', () => {
  const line = openerForAgent({ id: 'a', stats: { handsPlayed: 0 } });
  assert.ok(typeof line === 'string' && line.trim().length > 0);
  assert.doesNotMatch(line, TALLY);
});

test('RAISE-2: an agent who has played but has no stored recap gets his mood line', () => {
  const played = {
    id: 'a',
    nature: { name: 'Sphinx' },
    stats: { handsPlayed: 20 },
    mood: { state: 'tilted', heat: 88 },
    sessionFlagged: [{ flagType: 'badBeat', holeCards: ['Ah', 'Ad'] }],
  };
  const line = openerForAgent(played);
  assert.doesNotMatch(line, TALLY);
  // Not the greeting either — he has a night to talk about.
  assert.notEqual(line, natureOpener('Sphinx'));
  assert.ok(line.trim().split(/\s+/).length <= OPENER_MAX_WORDS);
});

test('RAISE-2: a stored opener wins, and a blank one does not count as stored', () => {
  const base = { id: 'a', nature: { name: 'Rock' }, stats: { handsPlayed: 20 } };
  assert.equal(openerForAgent({ ...base, sessionRecap: { opener: 'That was ugly.' } }), 'That was ugly.');
  assert.doesNotMatch(openerForAgent({ ...base, sessionRecap: { opener: '   ' } }), TALLY);
});

test('RAISE-2: never null, for any record at all', () => {
  for (const rec of [{}, { stats: null }, { sessionRecap: null }, { sessionLog: [] }]) {
    const line = openerForAgent(rec);
    assert.ok(typeof line === 'string' && line.length > 0, JSON.stringify(rec));
    assert.doesNotMatch(line, TALLY);
  }
});

// ── the two session-end paths ───────────────────────────────────────────────

test('RAISE-2: finishAgentSession writes an opener even with no recap string', async () => {
  const agent = await buildAgent('Nolan');
  // The gap: `opener` used to live inside `if (recap)`. A session that ended
  // without a recap line served none at all.
  finishAgentSession(agent.id, userId, { recap: null, sessionHands: 20, sessionPnl: -140 });

  const record = await raw(agent.id);
  assert.ok(record.sessionRecap?.opener, 'the opener must survive a recap-less finish');
  assert.doesNotMatch(record.sessionRecap.opener, TALLY);
  assert.ok(record.opener, 'and the projection serves it');
});

test('RAISE-2: and so does the owner-initiated POST /finish', async () => {
  const agent = await buildAgent('Odette');
  // The second session-end path. It never touched sessionRecap at all, so an
  // owner who stopped watching and opened the thread read the tally.
  const finished = await post(`/api/agents/${agent.id}/finish`, { userId });

  assert.ok(finished.opener, 'the route must serve an opener');
  assert.doesNotMatch(finished.opener, TALLY);
  assert.ok((await raw(agent.id)).sessionRecap?.opener, 'and persist it');
});

test('RAISE-2: GET /api/agents never serves a null opener', async () => {
  await buildAgent('Perry');
  const list = await fetch(`${base}/api/agents?userId=${userId}`).then((r) => r.json());
  assert.ok(list.agents.length > 0);
  for (const a of list.agents) {
    assert.ok(typeof a.opener === 'string' && a.opener.trim(), `${a.name} served ${a.opener}`);
    assert.doesNotMatch(a.opener, TALLY);
  }
});

// The stored record, read back through the projection that spreads it — the
// same shape every client sees, so what this asserts is what an owner gets.
async function raw(agentId) {
  return fetch(`${base}/api/agents/${agentId}?userId=${userId}`).then((r) => r.json());
}
