// src/server/draftInstruction.test.js — AGENT-4 job E
//
// THE DRAFT IGNORED WHAT WAS WRITTEN IN IT.
//
// ── Where the instruction was lost ──────────────────────────────────────────
//
// Not inside the prompt, and not overwritten afterwards. It was DROPPED BEFORE
// THE MODEL CALL, by the readiness gate.
//
// `draftProfile(brief)` decides whether there is enough of a character to build
// on. It asks `slidersFromBrief` first and then `natureHintFor`, whose whole
// vocabulary is seven `DRAFT_SIGNALS` regexes — and not one of them contained a
// word for shoving. "all I want him to play is all in, all the time" therefore
// scored ZERO signals, `ready` came back false, and POST /api/agents/chat
// answered with DRAFT_FALLBACK_LINE and returned without ever calling the model.
// A forced build was refused at the same gate.
//
// Measured on main before the fix, the all-in brief and "banana telephone
// mountain" produced the SAME recruiter line and the SAME zero agents: the most
// explicit instruction a person can give about a poker player was indistinguish-
// able from nonsense. And where a build did get through with no key,
// `slidersFromBrief` missed it too and `inferFallback` returned The Grinder —
// "a calculated, adaptive player" — which is the default personality Jens saw.
//
// ── The fix ─────────────────────────────────────────────────────────────────
//
// The vocabulary. All-in words on the `aggression` AND `loose` axes of
// DRAFT_SIGNALS, which is the honest reading rather than a trick to clear the
// two-signal bar — jamming every pot is a statement about how hard he plays and
// about how many hands he plays. Plus an `allin` entry in VAGUE_BRIEFS so the
// keyless path writes a real character instead of the default one.
//
// ── What this file asserts ──────────────────────────────────────────────────
//
// Three instructions of different shapes, on the STORED TRAITS rather than on
// the reply — a recruiter that says the right thing back and saves a balanced
// agent is the bug.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';
// The chat limiter keys on IP and every request here comes from 127.0.0.1, so
// ten a minute is the whole file. Raised through the product's own dial rather
// than reached around — the limiter itself stays exactly as it ships.
process.env.RATE_LIMIT_CHAT_MAX = '1000';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-draftinstr-'));
const savedEnv = Object.fromEntries(
  ['TELEGRAM_BOT_TOKEN', 'DEV_API_SECRET', 'RATE_LIMIT_CHAT_MAX'].map((k) => [k, process.env[k]]),
);
const localFetch = globalThis.fetch;

let store, profiles, server, base;

// inferFallback's three canned strategies. BUG-46: none of these may ever be
// committed on a deployment with a key, and none of them is an answer to an
// instruction the owner actually typed.
const CANNED = [
  'You are a relentless aggressor who bets and raises at every opportunity.',
  'You are a disciplined, patient player who only commits chips with premium holdings.',
  'You are a calculated, adaptive player who blends solid fundamentals with well-timed aggression.',
];

before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(scratch);
  profiles = await import('./agentProfiles.js');
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  profiles.installAgentProfileRoutes(app);
  server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  globalThis.fetch = localFetch;
  delete process.env.ANTHROPIC_API_KEY;
  store._closeForTests();
  process.chdir(originalCwd);
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
});

let seq = 0;
let userId;

beforeEach(() => {
  userId = `draft-${seq++}`;
  store.saveWallet(userId, { ownerId: userId, balance: 50_000, ledger: [] });
  store.saveProfile(userId, { userId, chat: [], agents: [] });
  profiles.reloadOwners(userId);
});

const post = async (url, body) => {
  const res = await localFetch(`${base}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

/** Open a draft, type one instruction into it, then press create. */
async function draft(instruction) {
  const opened = await post('/api/agents/draft', { userId });
  const draftId = opened.body.draftId ?? null;
  const said = await post('/api/agents/chat', { userId, draftId, content: instruction });
  const built = await post('/api/agents/build', { userId, draftId, attemptId: `at-${userId}` });
  return { draftId, said, built, agents: store.loadProfile(userId)?.agents ?? [] };
}

const reply = (said) => String(said.body?.chat?.at(-1)?.content ?? '');

// ── 1 · an extreme style instruction ────────────────────────────────────────

test('BUG-223: "all in, all the time" builds a man who plays all in', async () => {
  const out = await draft('all I want him to play is all in, all the time');

  assert.equal(out.agents.length, 1, `no agent was built — recruiter said: "${reply(out.said)}"`);
  const agent = out.agents[0];

  // The dials, which are what the table actually plays off.
  assert.ok(agent.profile.aggression >= 90,
    `an all-in player is not aggression ${agent.profile.aggression}`);
  assert.ok(agent.profile.tightness <= 20,
    `a man who shoves every hand plays every hand — tightness ${agent.profile.tightness}`);
  assert.equal(agent.style, 'Aggressive');
  assert.equal(agent.risk, 'High');

  // And the words, which are what reaches the model at the felt.
  assert.match(agent.strategy, /all in/i, 'the strategy says what he was told to do');
  for (const canned of CANNED) {
    assert.doesNotMatch(agent.strategy, new RegExp(canned.slice(0, 40)),
      'a canned fallback was committed instead of the instruction');
  }
});

// ── 2 · a tight-passive instruction ─────────────────────────────────────────

test('BUG-223: "tight and passive" builds the opposite man', async () => {
  const out = await draft('tight and passive, he should fold almost everything and never raise');

  assert.equal(out.agents.length, 1, `no agent was built — recruiter said: "${reply(out.said)}"`);
  const agent = out.agents[0];

  assert.ok(agent.profile.tightness >= 70, `tightness ${agent.profile.tightness} is not tight`);
  assert.ok(agent.profile.aggression <= 60, `aggression ${agent.profile.aggression} is not passive`);
  assert.ok(agent.profile.bluffFreq <= 30, `a passive man does not bluff at ${agent.profile.bluffFreq}`);
  assert.equal(agent.style, 'Tight');
  assert.match(agent.strategy, /patient|selective|premium|fold/i);
});

test('BUG-223: the two instructions do not produce the same agent', async () => {
  // The whole complaint, stated as one assertion: two opposite briefs must not
  // collapse onto one default character.
  const wild = (await draft('all I want him to play is all in, all the time')).agents[0];
  userId = `draft-${seq++}`;
  store.saveWallet(userId, { ownerId: userId, balance: 50_000, ledger: [] });
  store.saveProfile(userId, { userId, chat: [], agents: [] });
  profiles.reloadOwners(userId);
  const rock = (await draft('tight and passive, he should fold almost everything and never raise')).agents[0];

  assert.ok(wild && rock, 'both were built');
  assert.ok(wild.profile.aggression - rock.profile.aggression >= 30,
    `aggression ${wild.profile.aggression} vs ${rock.profile.aggression}`);
  assert.ok(rock.profile.tightness - wild.profile.tightness >= 30,
    `tightness ${rock.profile.tightness} vs ${wild.profile.tightness}`);
  assert.notEqual(wild.strategy, rock.strategy);
});

test('BUG-223: widening the vocabulary never INVERTS an instruction', async () => {
  // A first cut of the fix put "every hand" on the `loose` axis. It reads
  // correctly in "he plays every hand" and backwards in "he should fold every
  // hand", which is the tightest instruction there is — and the second one
  // came out as tightness 25, discipline 30, a maniac. The token was removed
  // rather than special-cased: a signal that means opposite things in two
  // ordinary sentences is not a signal.
  const { natureHintFor } = await import('../agent/attributes.js');
  const folding = natureHintFor('he should fold every hand unless it is aces');
  assert.ok(
    !folding || folding.profile.tightness >= 55,
    `a man told to fold everything came out at tightness ${folding?.profile?.tightness}`,
  );

  // And the all-in brief still reads, which is what the widening was for.
  const shoving = natureHintFor('all I want him to play is all in, all the time');
  assert.ok(shoving, 'the all-in brief still scores');
  assert.ok(shoving.profile.tightness <= 30);
});

// ── 3 · nonsense, which must fail LOUDLY ────────────────────────────────────

test('BUG-223: nonsense builds nobody, and says so rather than defaulting', async () => {
  const out = await draft('banana telephone mountain');

  assert.equal(out.agents.length, 0, 'a brief with no character in it must not invent one');
  // Loud, not silent: the recruiter asks again rather than handing back a man.
  assert.ok(reply(out.said).trim().length > 0, 'the owner is told something');
  assert.equal(out.built.body.agentId ?? null, null, 'and no agent id comes back');

  // The draft survives, so the owner can simply say what he meant.
  const profile = store.loadProfile(userId);
  assert.ok(profile.draft?.active, 'the draft is still open');
  assert.equal((profile.draft.receipts ?? []).length, 0, 'and nothing was committed');
});

test('BUG-223: nonsense never commits one of inferFallback\'s canned characters', async () => {
  for (const junk of ['banana telephone mountain', 'asdfgh', '???', 'hello']) {
    userId = `junk-${seq++}`;
    store.saveWallet(userId, { ownerId: userId, balance: 50_000, ledger: [] });
    store.saveProfile(userId, { userId, chat: [], agents: [] });
    profiles.reloadOwners(userId);
    const out = await draft(junk);
    assert.equal(out.agents.length, 0, `"${junk}" built an agent out of nothing`);
  }
});

// ── BUG-46 · an errored build is a 503 with the draft intact ────────────────

test('BUG-223: BUG-46 still holds — a model error is 503 and commits no fallback', async () => {
  const opened = await post('/api/agents/draft', { userId });
  const draftId = opened.body.draftId ?? null;
  await post('/api/agents/chat', { userId, draftId, content: 'all I want him to play is all in, all the time' });

  // The model is stubbed, never called for real — CLAUDE.md's rule that no
  // automated suite talks to a live model. Only api.anthropic.com is
  // intercepted; the test's own requests go through untouched.
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input?.url ?? input));
    if (url.hostname !== 'api.anthropic.com') return localFetch(input, init);
    return new Response(JSON.stringify({
      id: 'fixture', type: 'message', role: 'assistant',
      content: [{ type: 'text', text: 'not json at all' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  process.env.ANTHROPIC_API_KEY = 'fixture-key-never-sent';
  try {
    const built = await post('/api/agents/build', { userId, draftId, attemptId: `bug46-${userId}` });
    assert.equal(built.status, 503, JSON.stringify(built.body));
    const profile = store.loadProfile(userId);
    assert.equal(profile.agents.length, 0, 'no fallback was committed');
    assert.equal((profile.draft?.receipts ?? []).length, 0);
    assert.ok(profile.draft?.active, 'and the draft is intact');
    assert.equal(profile.draft.active.id, draftId, 'the same draft, ready to retry');
  } finally {
    globalThis.fetch = localFetch;
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test('BUG-223: with a model behind it, the brief is what reaches the prompt', async () => {
  // The instruction was being dropped BEFORE the call, so the proof that it is
  // no longer dropped is that the call happens at all and carries his words.
  const opened = await post('/api/agents/draft', { userId });
  const draftId = opened.body.draftId ?? null;
  await post('/api/agents/chat', { userId, draftId, content: 'all I want him to play is all in, all the time' });

  const seen = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input?.url ?? input));
    if (url.hostname !== 'api.anthropic.com') return localFetch(input, init);
    seen.push(JSON.parse(String(init?.body ?? '{}')));
    return new Response(JSON.stringify({
      id: 'fixture', type: 'message', role: 'assistant',
      content: [{ type: 'text', text: JSON.stringify({
        name: 'Shove', style: 'Aggressive', risk: 'High',
        strategy: 'You move all in every hand, with any two cards.',
        tightness: 8, aggression: 99, bluffFreq: 75, discipline: 30,
      }) }],
      usage: { input_tokens: 0, output_tokens: 0 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  process.env.ANTHROPIC_API_KEY = 'fixture-key-never-sent';
  try {
    const built = await post('/api/agents/build', { userId, draftId, attemptId: `prompt-${userId}` });
    assert.equal(built.status, 200, JSON.stringify(built.body));
    assert.ok(seen.length >= 1, 'the model was actually called');
    const sent = JSON.stringify(seen[0].messages ?? []);
    assert.match(sent, /all in/i, 'and his own words were in it');

    const agent = (store.loadProfile(userId)?.agents ?? [])[0];
    assert.ok(agent, 'the agent was committed');
    assert.equal(agent.profile.aggression, 99, 'the model wrote the character and it was kept');
    assert.match(agent.strategy, /all in/i);
  } finally {
    globalThis.fetch = localFetch;
    delete process.env.ANTHROPIC_API_KEY;
  }
});
