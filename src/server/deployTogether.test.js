// src/server/deployTogether.test.js — AGENT-5 job F
//
// SPREAD BY DEFAULT, TOGETHER ON REQUEST — at the door an owner actually uses.
//
// Job E removed the rule that two of an owner's agents may not share a casino
// felt. Removing it is not enough on its own, and the way it fails is quiet:
// the matchmaker prefers a FULLER table, so four deploys in a row would pile
// onto the first table and an owner who wanted four games would get one. That
// is the outcome MATCH-1's wall was really protecting, and job F protects it
// with a default instead — which means the default has to be asserted at the
// route, not only in the ranking.
//
// THE OPTION'S HOME. `POST /api/agents/:id/deploy` already takes a body and
// already reads a destination out of it (`rung`). A deploy is per-agent, so
// "and put him with the others" is one more field on a request somebody is
// already sending: no settings screen, no new endpoint, nothing remembered
// between deploys. `together: true`.
//
// WHAT COMES BACK. `together` is what was ASKED for and `withStablemate` is
// what he GOT. They come apart in both directions — ask to gather with nobody
// to gather with, or spread on a floor with no room to spread into — and a
// client that had to infer one from the other would infer it wrong on exactly
// the interesting cases.

delete process.env.ANTHROPIC_API_KEY;

import test, { before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { STAKES } from './wallet.js';
import { _closeForTests } from './store.js';

const FLOOR = STAKES[0];

// ── the default ─────────────────────────────────────────────────────────────

test('AGENT-5 job F: two deploys with no option land at two tables', async () => {
  const base = await server();
  const one = await deploy(base, 'own-spread', 'spread-1');
  const two = await deploy(base, 'own-spread', 'spread-2');

  assert.notEqual(one.tableId, two.tableId, 'they were spread, not piled');
  assert.equal(two.joinedExisting, false, 'the second one opened a felt of his own');
  assert.equal(two.together, false);
  assert.equal(two.withStablemate, false, 'and he is not sitting with his own man');
});

test('AGENT-5 job F: a whole stable spreads rather than filling one felt', async () => {
  // The shape the default exists for. Three in a row, and the matchmaker's own
  // preference for a fuller table is pulling the other way the entire time.
  const base = await server();
  const tables = new Set();
  for (const id of ['stable-1', 'stable-2', 'stable-3']) {
    tables.add((await deploy(base, 'own-stable', id)).tableId);
  }
  assert.equal(tables.size, 3, `expected three felts, got ${[...tables].join(', ')}`);
});

// ── the option ──────────────────────────────────────────────────────────────

test('AGENT-5 job F: `together` puts the second man at the first one\'s table', async () => {
  const base = await server();
  const one = await deploy(base, 'own-gather', 'gather-1');
  const two = await deploy(base, 'own-gather', 'gather-2', { together: true });

  assert.equal(two.tableId, one.tableId, 'one felt, both of his');
  assert.equal(two.joinedExisting, true);
  assert.equal(two.together, true, 'what was asked for');
  assert.equal(two.withStablemate, true, 'and what he got');
});

test('AGENT-5 job F: asking to gather with nobody to gather with is not a refusal', async () => {
  // `together` is a preference, not a requirement. A first deploy that asks for
  // it has nobody to sit with and must still be seated — the alternative is an
  // owner being told no for asking for something harmless.
  const base = await server();
  const alone = await deploy(base, 'own-alone', 'alone-1', { together: true });
  assert.equal(alone.together, true);
  assert.equal(alone.withStablemate, false, 'the two fields come apart, and say so');
  assert.ok(alone.tableId);
});

test('AGENT-5 job F: the flag is per deploy, not a setting that sticks', async () => {
  const base = await server();
  const one = await deploy(base, 'own-mixed', 'mixed-1');
  const two = await deploy(base, 'own-mixed', 'mixed-2', { together: true });
  assert.equal(two.tableId, one.tableId);

  // Third deploy, no flag: back to spreading. Nothing was remembered.
  const three = await deploy(base, 'own-mixed', 'mixed-3');
  assert.notEqual(three.tableId, one.tableId);
  assert.equal(three.together, false);
  assert.equal(three.withStablemate, false);
});

test('AGENT-5 job F: only a real true gathers — a stray body field does not', async () => {
  const base = await server();
  const one = await deploy(base, 'own-strict', 'strict-1');
  const two = await deploy(base, 'own-strict', 'strict-2', { together: 1 });
  assert.equal(two.together, false, '1 is not true');
  assert.notEqual(two.tableId, one.tableId);
});

// ── harness ─────────────────────────────────────────────────────────────────

const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

async function deploy(base, userId, agentId, extra = {}) {
  const res = await post(`${base}/api/agents/${agentId}/deploy`, { userId, rung: FLOOR.rung, ...extra });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body;
}

const agent = (id) => ({
  id, name: id.toUpperCase(), status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'You are a poker player.',
  bankroll: FLOOR.buyIn * 4,
  pocket: { balance: FLOOR.buyIn * 4, mode: 'allowance', cap: null, realised: 0, ledger: [] },
  mood: { state: 'neutral', heat: 30, losingRun: 0 },
  stats: { handsPlayed: 40, handsWon: 10 },
  // LOOSE and aggressive, so every table in this file clears JOIN_MIN_SCORE on
  // its own merits — a table that is not joined must be a preference and never
  // a score in disguise.
  profile: { tightness: 25, aggression: 75, bluffFreq: 40, discipline: 50 },
  // AGENT-5 job A: a full reserve, or the floor refuses the deploy and this
  // file would be asserting on the wrong gate.
  stamina: { left: 100, at: Date.now() },
});

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-together-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;
const savedSecret = process.env.DEV_API_SECRET;
const savedPause = process.env.HAND_PAUSE_MS;
let base = null;
let listening = null;

const OWNERS = {
  'own-spread': ['spread-1', 'spread-2'],
  'own-stable': ['stable-1', 'stable-2', 'stable-3'],
  'own-gather': ['gather-1', 'gather-2'],
  'own-alone': ['alone-1'],
  'own-mixed': ['mixed-1', 'mixed-2', 'mixed-3'],
  'own-strict': ['strict-1', 'strict-2'],
};

before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  // Nothing here wants a hand dealt; the assertions are all about which felt
  // he sat down at.
  process.env.HAND_PAUSE_MS = '60000';
  _closeForTests();
  process.chdir(dir);
  const store = await import('./store.js');
  for (const [owner, ids] of Object.entries(OWNERS)) {
    store.saveWallet(owner, { ownerId: owner, balance: 0, ledger: [] });
    store.saveProfile(owner, { userId: owner, chat: [], agents: ids.map(agent) });
  }
});

beforeEach(async () => {
  // Each assertion starts on its own floor. Earlier cases can otherwise fill
  // the last chair at the preferred table; "together" is a preference and
  // cannot seat a second agent at a full table. Random House ranking made
  // that shared-fixture contamination intermittent.
  const registry = await import('./tableRegistry.js');
  registry.resetRegistry('next independent deploy preference case');
});

after(async () => {
  if (listening) await new Promise((r) => listening.close(r));
  const registry = await import('./tableRegistry.js');
  registry.resetRegistry('test over');
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
  if (savedPause === undefined) delete process.env.HAND_PAUSE_MS;
  else process.env.HAND_PAUSE_MS = savedPause;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

async function server() {
  if (base) return base;
  const { default: express } = await import('express');
  const profiles = await import('./agentProfiles.js');
  const registry = await import('./tableRegistry.js');
  profiles.setLiveTableProvider(registry);
  const app = express();
  app.use(express.json());
  profiles.installAgentProfileRoutes(app);
  listening = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${listening.address().port}`;
  return base;
}
