// src/server/dips.test.js — SERVER-5 job 1
//
// The pure half is asserted in src/agent/dips.test.js. This is the half that
// touches the world: the record the dip is read off, the seat it is applied
// at, the wire it rides, and the line he opens the thread with while it lasts.
//
// The rule under every test here is the one the brief states and FRIDGE-1
// already lives by: THE STORED ATTRIBUTE NEVER CHANGES. A session can cost him
// points at the felt and must leave `agent.attrs` exactly as it found it.
//
// One scratch cwd and one seeding pass for the whole file, before the first
// import of agentProfiles.js: that module reads the store once per process and
// caches it (`db()`), so a fixture written after it has loaded is a fixture it
// will never see. Same reason fridge.test.js seeds inside its own import order.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DIP_LINES, DIP_MAX, DIP_MIN } from '../agent/dips.js';

const HOUR = 60 * 60_000;
const NOW = Date.now();
const USER = 'u-dips';

const ORIGINAL_CWD = process.cwd();
let dir;
let store;
let profiles;
let Table;

// One agent per situation, all in one household, so the whole file needs a
// single seeding pass.
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

const TILTED = { state: 'tilted', heat: 100, losingRun: 5 };

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-dips-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);

  store.saveProfile(USER, {
    userId: USER,
    chat: [],
    agents: [
      agent('fine'),
      // Worn, and off the felt for minutes — recovery is two hours a stage, so
      // he is still worn when he sits back down.
      agent('worn',    { fatigue: 'worn', restedAt: NOW - 5 * 60_000 }),
      agent('rested',  { fatigue: 'worn', restedAt: NOW - 5 * HOUR }),
      agent('hot',     { mood: TILTED }),
      agent('nagged',  { snackRefusedAt: NOW - HOUR }),
      agent('starved', { snackRefusedAt: NOW - 36 * HOUR }),
      agent('fed',     { snackRefusedAt: NOW - 36 * HOUR, lastSnackAt: NOW - HOUR }),
      // No stamps at all, and a year old. Hunger needs an answer you gave.
      agent('newborn', { bornAt: NOW - 365 * 24 * HOUR }),
      agent('opener',  {
        fatigue: 'worn',
        restedAt: NOW - 5 * 60_000,
        sessionRecap: { text: 'long session', opener: 'That was a night.', at: NOW },
      }),
      agent('seated',  { mood: TILTED }),
      agent('kitchen', { mood: TILTED }),
    ],
  });

  profiles = await import('./agentProfiles.js');
  ({ Table } = await import('./table.js'));
});

after(() => {
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const stored = (id) => store.loadAgentStore()[USER].agents.find((a) => a.id === id);

// ── What he arrives carrying ────────────────────────────────────────────────

test('SERVER-5: a man who is fine starts his session with nothing on him', () => {
  assert.deepEqual(profiles.takeSessionDips('fine', USER), []);
  assert.deepEqual(profiles.sessionDipsOf('fine', USER), []);
});

test('SERVER-5: worn at sit-down dips DISCIPLINE and FOCUS, and only for tonight', () => {
  const dips = profiles.takeSessionDips('worn', USER);
  assert.deepEqual(dips.map((d) => d.why), ['worn', 'worn']);
  assert.deepEqual(dips.map((d) => d.attr).sort(), ['DISCIPLINE', 'FOCUS']);
  // STAMINA 50 is the middle of the band, so the dip is inside it.
  assert.ok(dips.every((d) => d.delta <= -DIP_MIN && d.delta >= -DIP_MAX));

  assert.deepEqual(stored('worn').attrs, {
    READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50,
  }, 'the stored attribute never changes');
});

test('SERVER-5: hours at the bar and he is not worn any more', () => {
  assert.deepEqual(profiles.takeSessionDips('rested', USER), [],
    'the dip reads what he CARRIED IN, and rest is what fixes worn');
});

test('SERVER-5: he walks in steaming and it costs him', () => {
  const dips = profiles.takeSessionDips('hot', USER);
  assert.deepEqual(dips.map((d) => d.why), ['tilted', 'tilted']);
  assert.ok(dips.every((d) => d.delta === -DIP_MAX));
});

// ── Hunger: a refusal, then a day ───────────────────────────────────────────

test('SERVER-5: a no is not a hunger until a day has gone by', () => {
  assert.deepEqual(profiles.takeSessionDips('nagged', USER), []);
  assert.deepEqual(profiles.takeSessionDips('starved', USER).map((d) => d.why), ['hungry', 'hungry']);
});

test('SERVER-5: feeding him answers the refusal', () => {
  assert.deepEqual(profiles.takeSessionDips('fed', USER), []);
});

test('SERVER-5: an agent nobody has ever fed is not starving', () => {
  assert.deepEqual(profiles.takeSessionDips('newborn', USER), []);
});

test('SERVER-5: only food starts the hunger clock', () => {
  const rec = {};
  assert.equal(profiles.noteSnackRefused(rec, { kind: 'beer', item: 'beer' }), false);
  assert.equal(rec.snackRefusedAt, undefined, 'no to a drink is not a hunger');
  assert.equal(profiles.noteSnackRefused(rec, { kind: 'beer', item: 'snack' }), true);
  assert.ok(Number.isFinite(rec.snackRefusedAt));
});

// ── The line he opens with ──────────────────────────────────────────────────

test('SERVER-5: a dipped session opens the thread with tonight, not last night', () => {
  profiles.takeSessionDips('opener', USER);
  assert.equal(profiles.openerForAgent(stored('opener')), DIP_LINES.worn);

  // And it goes out with the session it described.
  profiles.finishAgentSession('opener', USER, { recap: 'done', sessionHands: 12 });
  const after = stored('opener');
  assert.equal(after.sessionDips, null);
  assert.notEqual(profiles.openerForAgent(after), DIP_LINES.worn);
});

// ── The seat ────────────────────────────────────────────────────────────────

test('SERVER-5: the points come off at the seat and ride the wire', () => {
  const table = new Table({ tableId: 'dips-seat', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  const seat = table.seatAI({
    displayName: 'SEATED', strategy: '', agentId: 'seated', userId: USER,
    agentProfile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
    buyIn: 2_000,
  });

  assert.equal(table.seatDips[seat].length, 2);
  const attrs = table._seatAttrs(seat);
  assert.equal(attrs.DISCIPLINE, 50 - DIP_MAX);
  assert.equal(attrs.FOCUS, 50 - DIP_MAX);
  assert.equal(attrs.READS, 50, 'and nothing else moves');
  assert.equal(attrs.COMPOSURE, 50);

  // The felt carries the reasons, not the attributes they came off.
  assert.deepEqual(table.seatDips[seat].map((d) => d.why), ['tilted', 'tilted']);

  assert.equal(stored('seated').attrs.DISCIPLINE, 50, 'the stored attribute never changes');
  assert.equal(stored('seated').attrs.FOCUS, 50);

  table.closeTable('test over', { recap: 'test over' });
});

test('SERVER-5: a House seat and the kitchen table carry no dips', () => {
  const casino = new Table({ tableId: 'dips-house', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  const houseSeat = casino.seatAI({ displayName: 'HOUSE', strategy: '', agentId: null, buyIn: 2_000 });
  assert.equal(casino.seatDips[houseSeat], null, 'nobody is behind a House seat to have a bad day');
  assert.deepEqual(casino._seatAttrs(houseSeat), null);
  casino.closeTable('test over', { recap: 'test over' });

  // A home game is not a session — the same rule that keeps a beer from being
  // spent at the kitchen table.
  const home = new Table({ tableId: 'dips-kitchen', smallBlind: 1, bigBlind: 2, maxSeats: 4, home: true });
  const seat = home.seatAI({
    displayName: 'KITCHEN', strategy: '', agentId: 'kitchen', userId: USER, buyIn: 200,
  });
  assert.equal(home.seatDips[seat], null);
  assert.equal(home._seatAttrs(seat).DISCIPLINE, 50, 'and he plays at full strength in his own front room');
  home.closeTable('test over', { recap: 'test over' });
});
