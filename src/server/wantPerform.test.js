// src/server/wantPerform.test.js — AGENT-4 job B
//
// YES PERFORMS THE VERB. All five of them.
//
// ── What was wrong ──────────────────────────────────────────────────────────
//
// LIFE-2 gave every ask an owner-facing VERB (wantVoice.ACTION_BY_KIND) and
// UI-3 made it tappable, so the sentence and the button were both real. Behind
// the button, POST /want's yes performed two of the five and let the other
// three fall through to `want.answered = 'yes'` with nothing done:
//
//   feed / rest      performed
//   chips            `needs: 'fund'` and nothing moved
//   deploy           `needs: 'deploy'` and nobody sat down
//   listen           `needs: 'thread'` and he had said nothing
//
// `needs` is a ROUTING instruction — which screen the client should open — and
// it was standing in for the act. And `rest`, which did change something,
// changed nothing an owner could SEE: `restBench` gates deploy and was drawn
// nowhere, so the man said "Fine. Give me a minute." and went on pacing.
//
// ── The two rules this file pins ────────────────────────────────────────────
//
//   1. EVERY YES CHANGES STATE. Asserted on the state, never on the response
//      body — a route that returns `{ answered: 'yes' }` and moves nothing is
//      the bug, so a test that reads the body would pass on it.
//   2. A VERB THAT CANNOT BE PERFORMED IS NOT AGREED TO. He says the specific
//      obstacle and the want SURVIVES, unanswered, because he still wants it.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { WANT_ACTIONS, ACTION_BY_KIND, wantAction } from '../agent/wantVoice.js';
import { ASK_KINDS, ASKS } from '../agent/wants.js';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-wantdo-'));
const savedEnv = Object.fromEntries(['TELEGRAM_BOT_TOKEN', 'DEV_API_SECRET'].map((k) => [k, process.env[k]]));

let store, profiles, registry, bank, audit, server, base;

const seedAgent = (id, { pocket = 20_000 } = {}) => ({
  id, name: id.toUpperCase(), status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'Play carefully.', bankroll: pocket,
  pocket: { agentId: id, balance: pocket, mode: 'allowance', cap: null, realised: 0, ledger: [], recall: false },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  nature: { name: 'Hothead' },
  mood: { state: 'neutral', heat: 30 }, stats: { handsPlayed: 0, handsWon: 0 },
  sessionLog: [], ledger: [],
});

before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(scratch);
  bank = await import('./houseBank.js');
  profiles = await import('./agentProfiles.js');
  registry = await import('./tableRegistry.js');
  audit = await import('../../scripts/audit-chips.js');
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
  registry.resetRegistry('suite over');
  store._closeForTests();
  process.chdir(originalCwd);
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
});

let seq = 0;
let owner;
let agentId;
let agent;

beforeEach(() => {
  registry.resetRegistry('between tests');
  seq += 1;
  owner = `do-${seq}`;
  // A FRESH AGENT ID PER TEST. The thread store is keyed by agent id and
  // outlives the owner record, so reusing one id would let a session written by
  // an earlier case answer `latestSessionFor` in a later one.
  agentId = `a${seq}`;
  store.saveWallet(owner, { ownerId: owner, balance: 50_000, ledger: [], fridge: { beer: 4, snack: 4 } });
  store.saveProfile(owner, { userId: owner, chat: [], agents: [seedAgent(agentId)] });
  profiles.reloadOwners(owner);
  profiles.setLiveTableProvider(registry);
  agent = profiles._agentRecordForTests(agentId, owner);
});

/**
 * Put a specific want in front of him, the way the screen would have — carrying
 * the SAME `needs` and `item` the real ask table gives that kind, so the route
 * is answering a want the product could actually have produced.
 */
function pending(kind, extra = {}) {
  const spec = ASKS[kind];
  agent.want = {
    kind, at: Date.now(), text: 'x', answered: null, answeredAt: null,
    item: spec?.item ?? null,
    needs: spec?.needs ?? null,
    dangerous: !!spec?.dangerous,
    ...extra,
  };
  return agent.want;
}

async function answer(kind, { setup = null } = {}) {
  pending(kind);
  setup?.();
  const before = agent.want;
  const res = await fetch(`${base}/api/agents/${agentId}/want?userId=${owner}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: owner, answer: 'yes' }),
  });
  return { status: res.status, body: await res.json(), wantBefore: before };
}

/**
 * Re-seed the owner THROUGH THE STORE, then reload.
 *
 * The chip audit reads the store, so a fixture that only mutates the in-memory
 * record leaves the two disagreeing until the route's own save lands — and the
 * difference then shows up as chips appearing or vanishing, which is exactly
 * what these tests are watching for. Everything a case needs must be durable
 * before the measurement is taken.
 */
function reseed({ pocket = 20_000, safe = 50_000, fridge = { beer: 4, snack: 4 }, mode = 'allowance' } = {}) {
  const seeded = seedAgent(agentId, { pocket });
  seeded.pocket.mode = mode;
  store.saveWallet(owner, { ownerId: owner, balance: safe, ledger: [], fridge });
  store.saveProfile(owner, { userId: owner, chat: [], agents: [seeded] });
  profiles.reloadOwners(owner);
  agent = profiles._agentRecordForTests(agentId, owner);
  return agent;
}

function totalChips() {
  const owners = store.listOwners().map((ownerId) => ({
    ownerId,
    wallet: store.loadWallet(ownerId) ?? { balance: 0, ledger: [] },
    agents: store.loadProfile(ownerId)?.agents ?? [],
  }));
  return audit.auditChips(owners, { houseBank: bank.balance() }).totals.chipsInExistence;
}

const routineOf = () => profiles.presentAgent(agent, { owner: true, userId: owner }).routine?.key ?? null;

// ── the map is complete ─────────────────────────────────────────────────────

test('BUG-220: every ask kind still maps to one of the five verbs', () => {
  for (const kind of ASK_KINDS) {
    const verb = wantAction(kind);
    assert.ok(WANT_ACTIONS.includes(verb), `${kind} -> ${verb} is not one of the five`);
  }
  // And the five are covered by the performer — the audit that stops a sixth
  // verb shipping with nothing behind it.
  assert.deepEqual([...new Set(Object.values(ACTION_BY_KIND))].sort(), [...WANT_ACTIONS].sort());
});

// ── rest ────────────────────────────────────────────────────────────────────

test('BUG-220: yes to rest puts him to sleep and starts the reserve refilling', async () => {
  // Tired enough that the bench will hold him (isRestBenched wants fatigue off
  // 'fresh'), but NOT so spent that the ladder already draws him asleep — the
  // whole point is that the owner's yes is what puts him under.
  agent.stamina = { left: 50, at: Date.now() - 3_600_000, stage: 'settled' };
  agent.fatigue = 'settled';
  agent.restedAt = Date.now();
  assert.notEqual(routineOf(), 'sleeps', 'he is not asleep to begin with');

  const out = await answer('rest');
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(out.body.answered, 'yes');

  // The state, not the body.
  assert.ok(agent.restBench, 'he is on the bench');
  assert.equal(profiles.isRestBenched(agent), true);
  assert.equal(routineOf(), 'sleeps', 'and the room draws him asleep');
  // The reserve clock was banked at the moment he went to bed, so recovery is
  // measured from then rather than from whenever he last played a hand.
  assert.ok(agent.stamina.at >= out.wantBefore.at, 'the reserve clock is stamped');
  assert.ok(agent.stamina.left > 50, 'and the hour he had already been up counts');
});

test('BUG-220: a man on the rest bench is refused a deploy, which is what resting means', async () => {
  agent.stamina = { left: 10, at: Date.now(), stage: 'worn' };
  agent.fatigue = 'worn';
  agent.restedAt = Date.now();
  await answer('rest');
  const deployed = profiles.deployAgent(owner, agentId, { body: {} });
  assert.equal(deployed.status, 409, JSON.stringify(deployed.body));
  assert.equal(deployed.body.error, 'agentResting');
});

// ── feed ────────────────────────────────────────────────────────────────────

test('BUG-220: yes to feed takes an item off the shelf', async () => {
  agent.stamina = { left: 20, at: Date.now(), stage: 'worn' };
  const before = store.loadWallet(owner).fridge.snack;
  const out = await answer('food');
  assert.equal(out.body.answered, 'yes');
  assert.equal(store.loadWallet(owner).fridge.snack, before - 1, 'one snack gone');
  assert.ok(agent.stamina.left > 20, 'and it went into him');
});

test('BUG-220: an empty fridge is said, not agreed to', async () => {
  agent.stamina = { left: 20, at: Date.now(), stage: 'worn' };
  reseed({ fridge: { beer: 0, snack: 0 } });
  agent.stamina = { left: 20, at: Date.now(), stage: 'worn' };
  const out = await answer('food');
  assert.equal(out.body.answered, null, 'he did not agree to a thing that did not happen');
  assert.equal(out.body.needs, 'stock');
  assert.ok(out.body.want, 'and he still wants it');
  assert.match(String(agent.lastMoment.text), /out of snacks/i, 'he says which shelf is empty');
});

// ── chips ───────────────────────────────────────────────────────────────────

test('BUG-220: yes to chips moves chips out of the safe and into his pocket', async () => {
  reseed({ pocket: 0 });
  // Snapshotted AFTER the fixture is durable, so the only thing this measures
  // is what the route does.
  const safeBefore = store.loadWallet(owner).balance;
  const chipsBefore = totalChips();

  const out = await answer('fund');
  assert.equal(out.body.answered, 'yes', JSON.stringify(out.body));

  const pocket = profiles._agentRecordForTests(agentId, owner).pocket.balance;
  assert.ok(pocket > 0, 'his pocket has something in it now');
  assert.equal(store.loadWallet(owner).balance, safeBefore - pocket, 'and the safe has exactly that much less');
  assert.equal(totalChips(), chipsBefore, 'the stake MOVED — it was not minted');
  assert.ok(agent.ledger.some((e) => e.type === 'fund'), 'with a line in his ledger');
});

test('BUG-220: an empty safe is said, not agreed to', async () => {
  reseed({ pocket: 0, safe: 0, fridge: { beer: 0, snack: 0 } });
  const chipsBefore = totalChips();   // after the fixture, before the route

  const out = await answer('fund');
  assert.equal(out.body.answered, null);
  assert.equal(out.body.needs, 'fund');
  assert.ok(out.body.want, 'the want survives');
  assert.match(String(agent.lastMoment.text), /nothing in the safe/i, 'he says what is wrong');
  assert.equal(totalChips(), chipsBefore, 'and a refusal moves nothing');
});

// ── deploy ──────────────────────────────────────────────────────────────────

test('BUG-220: yes to deploy actually seats him', async () => {
  const out = await answer('deploy');
  assert.equal(out.body.answered, 'yes', JSON.stringify(out.body));

  // The state, not the body: he is in a chair the registry can find him in.
  const seated = registry.tableOfAgent(agentId);
  assert.ok(seated, 'he is at a table');
  assert.equal(profiles._agentRecordForTests(agentId, owner).activeTableId, seated.tableId);
  assert.equal(profiles._agentRecordForTests(agentId, owner).status, 'playing');
  // And `needs` still rides along, so the client opens the room to watch him.
  assert.equal(out.body.needs, 'deploy');
});

test('BUG-220: a pocket that cannot cover a seat is said, not agreed to', async () => {
  reseed({ pocket: 0, safe: 0, fridge: { beer: 0, snack: 0 }, mode: 'cut' });
  const chipsBefore = totalChips();   // after the fixture, before the route

  const out = await answer('deploy');
  assert.equal(out.body.answered, null, JSON.stringify(out.body));
  assert.ok(out.body.want, 'the want survives');
  assert.equal(registry.tableOfAgent(agentId), null, 'and nobody sat down');
  assert.ok(String(agent.lastMoment.text).length > 0, 'he says why');
  assert.equal(totalChips(), chipsBefore);
});

// ── listen ──────────────────────────────────────────────────────────────────

test('BUG-220: yes to listen puts a line in the thread he can be read back', async () => {
  const thread = await import('./thread.js');
  // He has finished a session, so there is a thread to speak into.
  thread.appendLine({
    sessionId: `sess-${agentId}`, agentId, ownerId: owner,
    kind: thread.ThreadKind.TABLE, who: 'Room', text: 'Session done.',
  });
  agent.unseenRecap = true;

  const out = await answer('brag');
  assert.equal(out.body.answered, 'yes', JSON.stringify(out.body));
  assert.equal(profiles._agentRecordForTests(agentId, owner).unseenRecap, false, 'the nudge is answered');

  const lines = thread.readThread(`sess-${agentId}`, { owner: true, agentId, ownerId: owner });
  const his = lines.filter((l) => l.kind === thread.ThreadKind.HIM);
  assert.equal(his.length, 1, 'he said exactly one thing');
  assert.ok(his[0].text.trim().length > 0, 'and it was not empty');
});

test('BUG-220: with nothing to tell, he says so rather than agreeing', async () => {
  const out = await answer('brag');
  assert.equal(out.body.answered, null, JSON.stringify(out.body));
  assert.equal(out.body.needs, 'thread');
  assert.ok(out.body.want, 'the want survives');
  assert.match(String(agent.lastMoment.text), /Nothing worth telling/i);
});

// ── the rules, across every verb ────────────────────────────────────────────

test('BUG-220: later and no are unchanged — neither performs anything', async () => {
  reseed({ pocket: 0 });
  const safeBefore = store.loadWallet(owner).balance;
  for (const answerWord of ['later', 'no']) {
    pending('fund');
    const res = await fetch(`${base}/api/agents/${agentId}/want?userId=${owner}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: owner, answer: answerWord }),
    });
    const body = await res.json();
    assert.equal(body.answered, answerWord);
  }
  assert.equal(store.loadWallet(owner).balance, safeBefore, 'saying no costs nothing but the ledger line');
  assert.equal(profiles._agentRecordForTests(agentId, owner).pocket.balance, 0);
});

test('BUG-220: a refused verb never marks the want answered', async () => {
  // The rule, stated once across all three refusable verbs.
  reseed({ pocket: 0, safe: 0, fridge: { beer: 0, snack: 0 }, mode: 'cut' });
  agent.stamina = { left: 20, at: Date.now(), stage: 'worn' };

  for (const kind of ['food', 'fund', 'deploy', 'brag']) {
    const out = await answer(kind);
    assert.equal(out.body.answered, null, `${kind} agreed to something it did not do`);
    const stored = profiles._agentRecordForTests(agentId, owner).want;
    assert.notEqual(stored?.answered, 'yes', `${kind} marked the want yes`);
  }
});
