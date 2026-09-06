// src/server/place.test.js — SERVER-5 job 3
//
// The five fixtures, the one refusal vocabulary, and the rule that matters
// most: A PLACEMENT NEVER TAKES HIM OUT OF A HAND. He has money in the middle;
// the couch can wait forty seconds.
//
// The other thing pinned here is rule 3 — placement goes through the existing
// door rather than around it. Every branch below asserts against the behaviour
// the OLD route already had (the fridge's two refusals, the tape room's, the
// pocket gate's), because a fixture that softened one of them would quietly be
// a second implementation of it.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { FIXTURES, isFixture, PLACE_LINES, REFUSAL_LINES } from './place.js';

const ORIGINAL_CWD = process.cwd();
let dir;
let store;
let server;
let base;
let registry;
let placeMod;

const USER = 'u-place';

function agent(id, over = {}) {
  return {
    id,
    name: id.toUpperCase(),
    status: 'idle',
    activeTableId: null,
    strategy: 'You are a poker player.',
    style: 'Balanced',
    risk: 'Medium',
    bankroll: 3_000,
    pocket: { balance: 3_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 200, handsWon: 80 },
    profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
    attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    ...over,
  };
}

const TILTED = { state: 'tilted', heat: 85, losingRun: 4 };

const place = (agentId, fixture) => fetch(`${base}/api/agents/${agentId}/place`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: USER, fixture }),
}).then(async (r) => ({ status: r.status, body: await r.json() }));

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-place-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;

  store.saveWallet(USER, { ownerId: USER, balance: 5_000, fridge: { beer: 0, snack: 2 }, ledger: [] });
  store.saveProfile(USER, {
    userId: USER,
    chat: [],
    agents: [
      agent('couchman'),
      agent('hungryman', { mood: TILTED }),
      agent('levelman'),
      agent('tvman', {
        sessionFlagged: [{
          handNumber: 41,
          flagType: 'biggestPot',
          holeCards: ['As', 'Kd'],
          opponents: [{ seat: 2, playerId: 'house_station', displayName: 'THE STATION' }],
        }],
      }),
      agent('emptytv'),
      agent('doorman'),
      agent('wornman',   { fatigue: 'worn', restedAt: Date.now() - 5 * 60_000 }),
      agent('restedman', { fatigue: 'worn', restedAt: Date.now() - 9 * 60 * 60_000 }),
      agent('seatedman'),
      agent('brokeman', { pocket: { balance: 0, mode: 'cut', cap: null, realised: 0, ledger: [] } }),
    ],
  });

  const { default: express } = await import('express');
  const { installAgentProfileRoutes, setLiveTableProvider } = await import('./agentProfiles.js');
  registry = await import('./tableRegistry.js');
  placeMod = await import('./place.js');
  setLiveTableProvider(registry);

  const app = express();
  app.use(express.json());
  installAgentProfileRoutes(app);
  placeMod.installPlaceRoutes(app);
  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try { registry?.resetRegistry('test over'); } catch { /* best effort */ }
  if (server) await new Promise((r) => server.close(r));
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const read = (id) => store.loadAgentStore()[USER].agents.find((a) => a.id === id);

// ── The vocabulary ──────────────────────────────────────────────────────────

test('SERVER-5: five fixtures, and the list is closed', () => {
  assert.deepEqual([...FIXTURES], ['couch', 'table', 'fridge', 'tv', 'door']);
  assert.equal(isFixture('couch'), true);
  assert.equal(isFixture('window'), false);
  for (const f of FIXTURES) assert.ok(PLACE_LINES[f], `${f} has a line`);
});

test('SERVER-5: an unknown fixture is a 400, and it says what the five are', async () => {
  const { status, body } = await place('couchman', 'window');
  assert.equal(status, 400);
  assert.match(body.error, /fixture must be one of couch, table, fridge, tv, door/);
  assert.equal(body.fixture, null);
  assert.equal(body.placed, false);
});

test('SERVER-5: an agent who is not his gets a 404', async () => {
  const { status } = await place('nobody', 'couch');
  assert.equal(status, 404);
});

// ── The reply is the room ───────────────────────────────────────────────────

test('SERVER-5: every reply carries the resulting HOME_STATE', async () => {
  const { status, body } = await place('couchman', 'couch');
  assert.equal(status, 200);
  assert.equal(body.placed, true);
  assert.equal(body.line, PLACE_LINES.couch);
  assert.equal(body.home.userId, USER);
  assert.ok(Array.isArray(body.home.agents));
  const him = body.home.agents.find((a) => a.id === 'couchman');
  assert.equal(him.location.where, 'home');
});

// ── couch ───────────────────────────────────────────────────────────────────

test('SERVER-5: the couch is the same bench a yes to "sit one out" runs', async () => {
  const { status, body } = await place('couchman', 'couch');
  assert.equal(status, 200);
  assert.equal(body.benched, true);
  assert.equal(body.restingUntil, 'fresh');
  const him = read('couchman');
  assert.ok(him.restBench, 'and it is persisted, so it survives a restart');
  assert.equal(him.restBench.until, 'fresh');
});

// ── fridge ──────────────────────────────────────────────────────────────────

test('SERVER-5: the fridge hands him a snack and cools him down', async () => {
  const before = read('hungryman').mood.heat;
  const { status, body } = await place('hungryman', 'fridge');
  assert.equal(status, 200);
  assert.equal(body.given, 'snack');
  assert.equal(body.spent, 0, 'the spend was the stocking, not the eating');
  assert.ok(read('hungryman').mood.heat < before);
  assert.equal(store.loadWallet(USER).fridge.snack, 1, 'and one came off the shelf');
});

test('SERVER-5: "He\'s fine. Save it." survives the fixture', async () => {
  const { status, body } = await place('levelman', 'fridge');
  assert.equal(status, 400);
  assert.match(body.error, /He's fine/);
  assert.equal(store.loadWallet(USER).fridge.snack, 1, 'and nothing came off the shelf');
});

test('SERVER-5: an empty shelf is the fridge\'s own 409, not a new one', async () => {
  // Eat the last one, then ask again.
  await place('hungryman', 'fridge');
  assert.equal(store.loadWallet(USER).fridge.snack, 0);
  const { status, body } = await place('hungryman', 'fridge');
  assert.equal(status, 409);
  assert.equal(body.outOfStock, true);
  assert.equal(body.needs, 'stock', 'yes to a want he cannot be given opens the fridge');
  assert.match(body.error, /we're out of snacks/);
});

// ── tv ──────────────────────────────────────────────────────────────────────

test('SERVER-5: the TV puts on the newest thing he flagged', async () => {
  const { status, body } = await place('tvman', 'tv');
  assert.equal(status, 200);
  assert.equal(body.study.handNumber, 41);
  assert.equal(body.subject.displayName, 'THE STATION');
  assert.equal(body.line, PLACE_LINES.tv);
  assert.ok(read('tvman').study, 'and he is in the tape room');
});

test('SERVER-5: he is not put in front of two tapes at once', async () => {
  const { status, body } = await place('tvman', 'tv');
  assert.equal(status, 409);
  assert.match(body.error, /already watching one/);
});

test('SERVER-5: nothing flagged is a sentence, not a crash', async () => {
  const { status, body } = await place('emptytv', 'tv');
  assert.equal(status, 409);
  assert.equal(body.empty, true);
  assert.match(body.error, /nothing on the tape/);
});

// ── table ───────────────────────────────────────────────────────────────────

test('SERVER-5: a man in front of a tape is not carried to the kitchen table', async () => {
  const { status, body } = await place('tvman', 'table');
  assert.equal(status, 409);
  assert.equal(body.reason, 'studying');
  assert.equal(body.error, REFUSAL_LINES.studying);
  assert.ok(read('tvman').study, 'and the ninety seconds he already paid for are still running');
});

test('SERVER-5: a worn man is not dealt in at home either — that is what the bar is for', async () => {
  const { status, body } = await place('wornman', 'table');
  assert.equal(status, 409);
  assert.equal(body.reason, 'worn');
  assert.equal(body.error, REFUSAL_LINES.worn);
  assert.equal(body.fatigue, 'worn');
});

test('SERVER-5: and an hour at the bar has him back at the kitchen table', async () => {
  const { status, body } = await place('restedman', 'table');
  assert.equal(status, 200, JSON.stringify(body));
  // No home game is standing up in this suite (homeGame is only configured by
  // createServer), so what is asserted is the REFUSAL not firing — the stage
  // is read live, not off last night's stored value.
  assert.equal(body.placed, true);
  assert.equal(body.line, PLACE_LINES.table);
});

// ── door ────────────────────────────────────────────────────────────────────

test('SERVER-5: the door is deploy, pocket gate and all', async () => {
  const { status, body } = await place('doorman', 'door');
  assert.equal(status, 200);
  assert.ok(body.tableId, 'he is at a table');
  assert.equal(body.line, PLACE_LINES.door);
  assert.equal(read('doorman').activeTableId, body.tableId);
  assert.equal(read('doorman').status, 'playing');
});

test('SERVER-5: a cut-off man is refused at the door by the pocket rule, not by the fixture', async () => {
  const { status, body } = await place('brokeman', 'door');
  assert.equal(status, 402);
  assert.equal(body.cut, true);
  assert.match(body.error, /cut off/);
  assert.equal(read('brokeman').activeTableId, null);
});

// ── Rule 2: never out of a hand ─────────────────────────────────────────────

test('SERVER-5: the flat is refused to a man who is out, and a hand is refused to every fixture', async () => {
  const table = registry.getOrCreateTable('place-inhand', { smallBlind: 10, bigBlind: 20 });
  table.seatAI({ displayName: 'SEATEDMAN', strategy: '', agentId: 'seatedman', userId: USER, buyIn: 2_000 });
  table.seatAI({ displayName: 'HOUSE', strategy: '', agentId: null, buyIn: 2_000 });
  const him = read('seatedman');
  him.activeTableId = 'place-inhand';
  him.status = 'playing';
  store.saveProfile(USER, { userId: USER, chat: [], agents: store.loadAgentStore()[USER].agents });
  // The record the routes read is the cached one, so move the live object too.
  const { agentsOf } = await import('./agentProfiles.js');
  const live = agentsOf(USER).find((a) => a.id === 'seatedman');
  live.activeTableId = 'place-inhand';
  live.status = 'playing';

  // No hand running yet: the four inside fixtures refuse because he is OUT.
  assert.equal(table.handInProgress(), false);
  for (const fixture of ['couch', 'table', 'fridge', 'tv']) {
    const { status, body } = await place('seatedman', fixture);
    assert.equal(status, 409, fixture);
    assert.equal(body.reason, 'notHome', fixture);
    assert.equal(body.error, REFUSAL_LINES.notHome);
  }

  // Now put a hand in the air. Stubbed rather than dealt: a real deal starts
  // the autonomous session loop, which is a poker test and not this one — and
  // the predicate itself is asserted against the engine's own streets below.
  table.handInProgress = () => true;
  for (const fixture of FIXTURES) {
    const { status, body } = await place('seatedman', fixture);
    assert.equal(status, 409, fixture);
    assert.equal(body.reason, 'inHand', fixture);
    assert.equal(body.error, REFUSAL_LINES.inHand);
    assert.equal(body.tableId, 'place-inhand');
    assert.equal(body.placed, false);
  }
  assert.equal(live.activeTableId, 'place-inhand', 'and he is still where he was');

  table.closeTable('test over', { recap: 'test over' });
});

test("SERVER-5: handInProgress is the engine's streets, spelled once", async () => {
  const { Table } = await import('./table.js');
  const { Streets } = await import('../engine/game.js');
  const t = new Table({ tableId: 'place-streets', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  assert.equal(t.handInProgress(), false, 'no game at all');
  t.game = { street: Streets.WAITING };
  assert.equal(t.handInProgress(), false, 'waiting for players is not a hand');
  t.game = { street: Streets.COMPLETE };
  assert.equal(t.handInProgress(), false, 'a finished hand is not a hand');
  t.game = { street: Streets.FLOP };
  assert.equal(t.handInProgress(), true);
  t.game = null;
  t.closeTable('test over', { recap: 'test over' });
});
