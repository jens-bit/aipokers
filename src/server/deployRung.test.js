// src/server/deployRung.test.js — SERVER-4 job 4
//
// You send a man upstairs. You do not fund him until upstairs happens.
//
// Before this the room an agent walked into was a CONSEQUENCE of his pocket:
// /deploy took the highest rung he could afford and that was that. CASINO-1
// draws three rooms and lets the owner pick one, so the choice has to be
// expressible on the wire — and the answer to "he cannot afford it" has to be
// a refusal rather than a silent downgrade, because a client that asked for the
// back room and got the floor has been lied to, and the owner would have funded
// him if anybody had said so.
//
// The rule is the one canAffordTable already applies to joining a felt in play:
// HIS POCKET MUST COVER THE BUY-IN. 409 cantAfford, with the number he is short
// against, so the client can say what it costs instead of only saying no.

delete process.env.ANTHROPIC_API_KEY;

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { STAKES } from './wallet.js';
import { _closeForTests } from './store.js';

// The ladder, named. `floor` is the entry rung everybody can afford; `backroom`
// is the one that has to be earned.
const FLOOR = STAKES[0];
const UPSTAIRS = STAKES[1];
const BACKROOM = STAKES[2];

// ── Deploy ──────────────────────────────────────────────────────────────────

test('SERVER-4: no rung asked for is the old behaviour, exactly', async () => {
  const base = await server();
  // A pocket that covers upstairs but not the back room: the deploy picks the
  // highest rung it reaches, which is what it has always done.
  const body = await deploy(base, 'own-default', 'a-default');
  assert.equal(body.stakes.rung, UPSTAIRS.rung);
  assert.equal(body.stakes.bigBlind, UPSTAIRS.bigBlind);
  assert.equal(body.room, 'upstairs');
});

test('SERVER-4: a rung he can afford is the rung he is seated at', async () => {
  const base = await server();
  const body = await deploy(base, 'own-pick', 'a-pick', { rung: FLOOR.rung });
  // He could have afforded upstairs. He was sent to the floor, because that is
  // what was asked for — the choice is the owner's, not the pocket's.
  assert.equal(body.stakes.rung, FLOOR.rung);
  assert.equal(body.stakes.smallBlind, FLOOR.smallBlind);
  assert.equal(body.stakes.bigBlind, FLOOR.bigBlind);
  assert.equal(body.room, 'floor');
});

test('SERVER-4: a rung he cannot afford is refused, never quietly downgraded', async () => {
  const base = await server();
  const res = await post(`${base}/api/agents/a-broke/deploy`, { userId: 'own-broke', rung: BACKROOM.rung });
  const body = await res.json();
  assert.equal(res.status, 409, JSON.stringify(body));
  assert.equal(body.error, 'cantAfford');
  // The number he is short against, so the client can say what it costs.
  assert.equal(body.buyIn, BACKROOM.buyIn);
  assert.equal(body.rung, BACKROOM.rung);
  assert.equal(body.label, BACKROOM.label);
  assert.ok(Number.isFinite(body.pocket), 'and what he actually has');
  assert.ok(body.pocket < BACKROOM.buyIn);

  // And he did not end up somewhere cheaper instead.
  const profiles = await import('./agentProfiles.js');
  assert.equal(profiles._agentRecordForTests('a-broke', 'own-broke').activeTableId, null,
    'a refused deploy seats him nowhere');
});

test('SERVER-4: a rung that is not on the ladder is a 400 that names the ladder', async () => {
  const base = await server();
  for (const bad of [7, -1, 'upstairs', 1.5]) {
    const res = await post(`${base}/api/agents/a-bad/deploy`, { userId: 'own-bad', rung: bad });
    const body = await res.json();
    assert.equal(res.status, 400, `rung ${JSON.stringify(bad)}: ${JSON.stringify(body)}`);
    assert.equal(body.error, 'badRung');
    assert.deepEqual(body.rungs.map((r) => r.rung), STAKES.map((s) => s.rung),
      'and it says what the rungs actually are');
  }
});

// ── Queue ───────────────────────────────────────────────────────────────────

test('SERVER-4: the queue takes a rung, and hands back the blinds to WATCH with', async () => {
  const base = await server();
  const body = await queue(base, 'own-q1', 'a-q1', { rung: UPSTAIRS.rung });
  assert.equal(body.matched, false, 'first in, nobody waiting');
  assert.equal(body.room, 'upstairs');
  assert.equal(body.stakes.rung, UPSTAIRS.rung);
  // Without these the socket would stand the table up at the default 10/20 and
  // the rung would have been a suggestion.
  assert.equal(body.smallBlind, UPSTAIRS.smallBlind);
  assert.equal(body.bigBlind, UPSTAIRS.bigBlind);
});

test('SERVER-4: the second man in inherits the slot\'s stakes — one table, one rung', async () => {
  const base = await server();
  const second = await queue(base, 'own-q2', 'a-q2', { rung: FLOOR.rung });
  assert.equal(second.matched, true);
  // He asked for the floor. He is sitting down with somebody who is already at
  // a $25/$50 game, and a table cannot be at two rungs.
  assert.equal(second.stakes.rung, UPSTAIRS.rung, 'the slot\'s stakes, not his request');
  assert.equal(second.room, 'upstairs');
});

test('SERVER-4: a pairing he cannot cover is refused rather than seated', async () => {
  const base = await server();
  // Somebody wealthy opens a back-room slot...
  const first = await queue(base, 'own-q3', 'a-q3', { rung: BACKROOM.rung });
  assert.equal(first.matched, false);
  assert.equal(first.stakes.rung, BACKROOM.rung);

  // ...and a man who cannot cover it is turned away instead of being matched
  // onto a felt he cannot buy into.
  const res = await post(`${base}/api/agents/a-broke/queue`, { userId: 'own-broke' });
  const body = await res.json();
  assert.equal(res.status, 409, JSON.stringify(body));
  assert.equal(body.error, 'cantAfford');
  assert.equal(body.buyIn, BACKROOM.buyIn);
  assert.equal(body.matched, true, 'and it says the refusal was a pairing, not an opening');

  // The slot is still open for somebody who can afford it.
  const ok = await queue(base, 'own-q4', 'a-q4');
  assert.equal(ok.matched, true);
  assert.equal(ok.tableId, first.tableId);
});

// ── harness ─────────────────────────────────────────────────────────────────

const post = (url, body) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

async function deploy(base, userId, agentId, extra = {}) {
  const res = await post(`${base}/api/agents/${agentId}/deploy`, { userId, ...extra });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body;
}

async function queue(base, userId, agentId, extra = {}) {
  const res = await post(`${base}/api/agents/${agentId}/queue`, { userId, ...extra });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  return body;
}

const agent = (id, pocket) => ({
  id, name: id.toUpperCase(), status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'You are a poker player.',
  bankroll: pocket,
  pocket: { balance: pocket, mode: 'allowance', cap: null, realised: 0, ledger: [] },
  mood: { state: 'neutral', heat: 30, losingRun: 0 },
  stats: { handsPlayed: 40, handsWon: 10 },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
});

// ONE scratch database, one owner per case — agentProfiles caches the loaded
// store and has no reset seam, so every profile is written before anything
// touches it. Same shape as home.test.js, same reason.
const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-rung-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;
const savedSecret = process.env.DEV_API_SECRET;
let base = null;
let listening = null;

before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  _closeForTests();
  process.chdir(dir);
  const store = await import('./store.js');
  // Enough for upstairs, not for the back room.
  const rich = UPSTAIRS.buyIn + 1_000;
  for (const [owner, id, pocket] of [
    ['own-default', 'a-default', rich],
    ['own-pick', 'a-pick', rich],
    ['own-broke', 'a-broke', FLOOR.buyIn],
    ['own-bad', 'a-bad', rich],
    ['own-q1', 'a-q1', rich],
    ['own-q2', 'a-q2', rich],
    ['own-q3', 'a-q3', BACKROOM.buyIn + 1_000],
    ['own-q4', 'a-q4', BACKROOM.buyIn + 1_000],
  ]) {
    store.saveWallet(owner, { ownerId: owner, balance: 0, ledger: [] });
    store.saveProfile(owner, { userId: owner, chat: [], agents: [agent(id, pocket)] });
  }
});

after(async () => {
  if (listening) await new Promise((r) => listening.close(r));
  const registry = await import('./tableRegistry.js');
  registry.resetRegistry('test over');
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  if (savedSecret !== undefined) process.env.DEV_API_SECRET = savedSecret;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

async function server() {
  if (base) return base;
  const { default: express } = await import('express');
  const profiles = await import('./agentProfiles.js');
  const registry = await import('./tableRegistry.js');
  // A real registry: the pocket gate and the room choice only exist when the
  // server manages sessions, and deploying with no registry degrades to the
  // pre-WALLET-1 behaviour, which is not what is under test.
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
