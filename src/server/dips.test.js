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
import { ASK_LINES } from '../agent/wants.js';

const HOUR = 60 * 60_000;
const NOW = Date.now();
const USER = 'u-dips';
const BARE = 'u-dips-bare';    // same tests, an empty shelf

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
// SERVER-5 job 5: "frustrated or worse", and below the drink's rung — the
// window the food ask lives in.
const FRAYED = { state: 'frustrated', heat: 58, losingRun: 3 };

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
      // SERVER-5 job 5: nothing on him at all. He earns his hunger inside the
      // test, which is the point — the loop has to be reachable from a clean
      // record or the dip is unreachable in the product too.
      // Frayed by the night, not steaming — the food ask's band, and the band
      // in which a snack is a thing he can actually be given.
      agent('grinder',    { mood: FRAYED }),
      agent('shortnight', { mood: FRAYED }),
    ],
  });

  // The empty-fridge case needs its OWN household: agentProfiles caches one
  // wallet per owner, so the shelf cannot be emptied underneath the one above
  // without reaching into that cache. A second owner says the same thing
  // without a test knowing anything about how the first is held.
  store.saveProfile(BARE, {
    userId: BARE, chat: [], agents: [agent('barefridge', { mood: FRAYED })],
  });
  store.saveWallet(BARE, {
    ownerId: BARE, balance: 10_000, fridge: { beer: 4, snack: 0 }, ledger: [],
  });

  // SERVER-5 job 5: the fridge is part of the seed, because the food ask does
  // not fire against an empty one. Two snacks — one for the ask, one left so a
  // second agent's ask is about HIS night rather than about the shelf.
  store.saveWallet(USER, {
    ownerId: USER, balance: 10_000, fridge: { beer: 0, snack: 2 }, ledger: [],
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

// ── SERVER-5 job 5 · the loop, closed ───────────────────────────────────────
//
// Job 1 shipped the hunger dip with nothing able to reach it: dips.js measures
// hunger from `snackRefusedAt`, noteSnackRefused only stamps a want whose item
// is a snack, and no ask in the WANTS-1 ladder had one. These are the tests
// that the chain now runs end to end — a long night, food in, he asks, you say
// no, a day passes, and it costs him at the seat.

test('SERVER-5: a long night with food in raises the food ask, at session end', () => {
  assert.equal(stored('grinder').want ?? null, null, 'nothing on him before the session');

  profiles.finishAgentSession('grinder', USER, { recap: 'long one', sessionHands: 80 });

  const want = stored('grinder').want;
  assert.equal(want?.kind, 'food');
  assert.equal(want.item, 'snack');
  assert.equal(want.answered, null);
  // One of his three, picked deterministically off his hand count — the same
  // rule every other ask's line follows, so a reopened screen does not rewrite
  // what he said.
  assert.ok(ASK_LINES.food.includes(want.text), `not one of his lines: "${want.text}"`);
});

test('SERVER-5: no to that ask is what makes him hungry, and a day later it costs him', () => {
  // The record by reference: `stored()` hands back a fresh parse of the file,
  // and a stamp written to that is a stamp the server never sees.
  const rec = profiles._agentRecordForTests('grinder', USER);
  // The route's `no` branch is exactly this call — see POST /want. Asserting
  // the raised want satisfies its gate is the link that was missing.
  assert.equal(profiles.noteSnackRefused(rec, rec.want, { now: NOW }), true,
    'the ask the ladder raised must be one the hunger clock recognises');

  // Same evening: a no is not a hunger yet.
  assert.deepEqual(profiles.takeSessionDips('grinder', USER, { now: NOW + HOUR }), []);

  // A day and a half later he sits down hungry.
  const dips = profiles.takeSessionDips('grinder', USER, { now: NOW + 36 * HOUR });
  assert.deepEqual(dips.map((d) => d.why), ['hungry', 'hungry']);
  assert.deepEqual(dips.map((d) => d.attr).sort(), ['DISCIPLINE', 'FOCUS']);
  assert.ok(dips.every((d) => d.delta <= -DIP_MIN && d.delta >= -DIP_MAX));

  assert.deepEqual(rec.attrs, {
    READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50,
  }, 'the stored attribute never changes');
});

test('SERVER-5: a short session ends with nothing to say about dinner', () => {
  profiles.finishAgentSession('shortnight', USER, { recap: 'quick one', sessionHands: 9 });
  assert.equal(stored('shortnight').want ?? null, null);
});

test('SERVER-5: an empty fridge is silence — he is not made hungry by a shelf', () => {
  profiles.finishAgentSession('barefridge', BARE, { recap: 'long one', sessionHands: 90 });
  assert.equal(profiles._agentRecordForTests('barefridge', BARE)?.want ?? null, null,
    'a no you had no way to avoid must not be able to start a hunger clock');
});

test('SERVER-5: sitting at home never raises it, however long he sits', () => {
  // THE NO-NAGGING GUARD. presentAgent recomputes the want on every projection,
  // so if the food ask were derivable from stored state it would arrive because
  // the owner opened the app. It is not: only the session-end path has a
  // sessionHands to hand over.
  const rec = profiles._agentRecordForTests('shortnight', USER);
  rec.restedAt = NOW - 30 * 24 * HOUR;           // a month on the sofa
  rec.want = null;

  profiles.computeWant(rec, { now: NOW, atTable: false });
  assert.notEqual(rec.want?.kind, 'food', 'a want that arrives from idleness is a guilt mechanic');
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
