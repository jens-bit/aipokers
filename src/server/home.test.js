// src/server/home.test.js — HOME-STATE-1 (item 1)
//
// Where he is and what he is doing there.
//
// Three layers, because the feature is only true if all three agree:
//   * the pure ladder (home.js) — object literals, no server
//   * presentAgent — the record actually carries location/routine
//   * the wire — FLOOR_SUB gets a HOME_STATE, and it is owner-scoped

// TEST-2 / the testing law: no automated suite talks to a real model.
delete process.env.ANTHROPIC_API_KEY;

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  Where, Routine, ROUTINE_LABELS, ROUTINE_BY_NATURE, DEFAULT_ROUTINE,
  routineFor, natureRoutine, locationFor, stampLocation, timeAtLocation,
  homeStateMessage,
} from './home.js';
import { NATURES } from '../agent/attributes.js';
import { ServerMsg } from './protocol.js';
import { _closeForTests } from './store.js';

// ── The ladder ──────────────────────────────────────────────────────────────

test('HOME-STATE-1: the four natures the brief names get the four habits it names', () => {
  assert.equal(natureRoutine('Hothead'), Routine.PACES);
  assert.equal(natureRoutine('Rock'), Routine.READS);
  assert.equal(natureRoutine('Shark'), Routine.SHUFFLES);
  assert.equal(natureRoutine('Grinder'), Routine.COUNTS);
});

test('HOME-STATE-1: every nature has a habit, and every habit has a label', () => {
  for (const nature of NATURES) {
    const key = natureRoutine(nature.name);
    assert.ok(key, `${nature.name} has no routine`);
    assert.ok(ROUTINE_LABELS[key], `${key} has no label`);
  }
  assert.equal(Object.keys(ROUTINE_BY_NATURE).length, NATURES.length,
    'a nature added to attributes.js must get a habit here on the same commit');
});

test('HOME-STATE-1: a nature that has not formed yet still has something to do', () => {
  assert.equal(natureRoutine(null), DEFAULT_ROUTINE);
  assert.equal(natureRoutine({ }), DEFAULT_ROUTINE);
  // The nature travels as an object on the record and as a string everywhere
  // else; both have to answer.
  assert.equal(natureRoutine({ name: 'Sphinx' }), natureRoutine('Sphinx'));
});

test('HOME-STATE-1: state beats nature, in the documented order', () => {
  const rock = { nature: 'Rock' };
  assert.equal(routineFor(rock).key, Routine.READS, 'nothing else going on');

  assert.equal(routineFor({ ...rock, unseenRecap: true }).key, Routine.WAITS);
  assert.equal(routineFor({ ...rock, fatigue: 'worn' }).key, Routine.SLEEPS);
  assert.equal(routineFor({ ...rock, broke: true }).key, Routine.SULKS);
  assert.equal(routineFor({ ...rock, studying: true }).key, Routine.TAPE);
  assert.equal(routineFor({ ...rock, atHomeTable: true }).key, Routine.PLAYS);

  // The order itself: a deliberate act outranks a standing condition, and a
  // man with cards in his hands outranks everything.
  assert.equal(
    routineFor({ ...rock, studying: true, broke: true, fatigue: 'worn', unseenRecap: true }).key,
    Routine.TAPE,
    'the owner started the study ninety seconds ago; showing him asleep makes the button look broken');
  assert.equal(
    routineFor({ ...rock, broke: true, fatigue: 'worn', unseenRecap: true }).key,
    Routine.SULKS);
  assert.equal(
    routineFor({ ...rock, atHomeTable: true, studying: true, broke: true }).key,
    Routine.PLAYS);
});

test('HOME-STATE-1: a routine is a HOME thing — out is out', () => {
  assert.equal(routineFor({ nature: 'Rock', where: Where.TABLE }), null);
  assert.equal(routineFor({ nature: 'Rock', where: Where.CASINO }), null);
  assert.ok(routineFor({ nature: 'Rock', where: Where.HOME }));
});

test('HOME-STATE-1: the same state always produces the same routine', () => {
  const state = { nature: 'Gambler', unseenRecap: true };
  const first = routineFor(state);
  for (let i = 0; i < 20; i++) assert.deepEqual(routineFor(state), first);
});

// ── Location ────────────────────────────────────────────────────────────────

test('HOME-STATE-1: where he is, from presence and a table id', () => {
  assert.deepEqual(
    locationFor({ presence: 'playing', tableId: 't1', room: 'upstairs' }),
    { where: Where.TABLE, tableId: 't1', room: 'upstairs' });

  // He has a table but it is not dealing him in — walking in, or a table that
  // has just died under him. Not home: drawing him in the living room while
  // his table stands up is the BUG-16 lie in a new place.
  assert.deepEqual(
    locationFor({ presence: 'resting', tableId: 't1', room: 'floor' }),
    { where: Where.CASINO, tableId: 't1', room: 'floor' });

  assert.deepEqual(
    locationFor({ presence: 'resting', tableId: null }),
    { where: Where.HOME, tableId: null, room: null });

  // Broke is a presence, not a place. He is at the bar at home.
  assert.equal(locationFor({ presence: 'broke', tableId: null }).where, Where.HOME);
});

test('HOME-STATE-1: `since` survives while the answer does not change', () => {
  const agent = {};
  const first = stampLocation(agent, { where: Where.HOME, tableId: null, room: null }, { now: 1_000 });
  assert.equal(first.since, 1_000);

  const later = stampLocation(agent, { where: Where.HOME, tableId: null, room: null }, { now: 9_000 });
  assert.equal(later.since, 1_000, 'still home — he did not just get in');
  assert.equal(timeAtLocation(later, { now: 9_000 }), 8_000);

  const out = stampLocation(agent, { where: Where.TABLE, tableId: 't1', room: 'floor' }, { now: 9_000 });
  assert.equal(out.since, 9_000, 'he left, so the clock restarts');

  // A different table is a different place, even though `where` is the same.
  const moved = stampLocation(agent, { where: Where.TABLE, tableId: 't2', room: 'floor' }, { now: 12_000 });
  assert.equal(moved.since, 12_000);
});

test('HOME-STATE-1: a clock that went backwards reads as "just got in", never negative', () => {
  assert.equal(timeAtLocation({ since: 5_000 }, { now: 1_000 }), 0);
  assert.equal(timeAtLocation({ }, { now: 1_000 }), 0);
  assert.equal(timeAtLocation(null), 0);
});

test('HOME-STATE-1: an unrecognised `where` falls home rather than onto the wire', () => {
  const agent = {};
  assert.equal(stampLocation(agent, { where: 'the moon' }).where, Where.HOME);
});

// ── The message ─────────────────────────────────────────────────────────────

test('HOME-STATE-1: the HOME_STATE body carries the card and nothing heavy', () => {
  const msg = homeStateMessage('u1', [{
    id: 'a1', name: 'The Clock', nature: { name: 'Rock' },
    mood: { state: 'neutral', heat: 30 },
    location: { where: Where.HOME, tableId: null, room: null, since: 5 },
    routine: { key: Routine.READS, label: ROUTINE_LABELS[Routine.READS] },
    fatigue: 'fresh', unseenRecap: true, study: null,
    strategy: 'a very long system prompt that has no business on this wire',
    recentHands: [1, 2, 3],
  }], { tableId: 'home-u1', state: 'running', seats: [], handsPlayed: 3 });

  assert.equal(msg.userId, 'u1');
  assert.equal(msg.game.tableId, 'home-u1');
  const [agent] = msg.agents;
  assert.equal(agent.nature, 'Rock', 'the name, not the whole nature record');
  assert.equal(agent.routine.key, Routine.READS);
  assert.equal(agent.unseenRecap, true);
  assert.equal('strategy' in agent, false, 'the strategy prompt never rides this message');
  assert.equal('recentHands' in agent, false);
});

// ── SERVER-4 · the newborn marker ───────────────────────────────────────────

test('SERVER-4: the HOME_STATE card says when he was made', () => {
  const bornAt = 1_700_000_000_000;
  const [agent] = homeStateMessage('u1', [{ id: 'a1', name: 'New', createdAt: bornAt }]).agents;
  // The flat draws a newborn differently for his first minute — standing in
  // the doorway with his bag, not yet part of the furniture.
  assert.equal(agent.bornAt, bornAt);
  // `createdAt` rides beside it, identical, so a client that already derives
  // the newborn window from `createdAt < 60s` keeps working unchanged.
  assert.equal(agent.createdAt, bornAt);
});

test('SERVER-4: an agent whose birthday is unknown is not drawn as a newborn', () => {
  const [agent] = homeStateMessage('u1', [{ id: 'old', name: 'Long Since' }]).agents;
  // null, not 0 and not "now". A record with no birthday must fail the
  // "younger than a minute" test rather than pass it — an agent his owner has
  // watched for a year must never walk back in through the door.
  assert.equal(agent.bornAt, null);
  assert.equal(agent.createdAt, null);
});

// ── presentAgent, and the wire ──────────────────────────────────────────────

// SERVER-4: two fixed birthdays, so nothing here depends on the wall clock.
const BORN_STORED = 1_700_000_000_000;
const BORN_FROM_ID = 1_690_000_000_000;

const mkAgent = (id, name, extra = {}) => ({
  id, name, status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'You are a poker player.',
  bankroll: 3_000,
  pocket: { balance: 3_000, mode: 'auto', cap: 2_000, realised: 0, ledger: [] },
  stats: { handsPlayed: 40, handsWon: 10, totalDecisions: 100 },
  ...extra,
});

// ONE scratch database for the whole file, and a distinct owner per test.
//
// agentProfiles caches the loaded store in a module-level variable and has no
// reset seam, so a second chdir inside one process reads the FIRST directory's
// store — a stale-cache trap that costs an afternoon if you meet it in a test
// you have just written. One directory, different owners, no trap.
const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-home-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;

// Every profile is written BEFORE agentProfiles is first touched. store.js
// writes SQL; agentProfiles caches the loaded store in memory and has no reset
// seam, so a profile saved after its first read is invisible to it.
before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  _closeForTests();
  process.chdir(dir);
  const store = await import('./store.js');
  store.saveProfile('own-present', {
    userId: 'own-present', chat: [],
    agents: [
      mkAgent('out', 'Big Slick', { status: 'playing', activeTableId: 'tbl-1', nature: { name: 'Shark' } }),
      mkAgent('in', 'The Nit', { unseenRecap: true, nature: { name: 'Hothead' } }),
    ],
  });
  store.saveProfile('own-table', {
    userId: 'own-table', chat: [],
    agents: [mkAgent('a', 'Stone Cold', { nature: { name: 'Grinder' } })],
  });
  store.saveProfile('own-wire', {
    userId: 'own-wire', chat: [], agents: [mkAgent('w', 'The Clock', { nature: { name: 'Rock' } })],
  });
  store.saveProfile('own-other', {
    userId: 'own-other', chat: [], agents: [mkAgent('o', 'River Rat')],
  });
  // SERVER-4: three birthdays. One stored, one recoverable from the id scheme
  // (`agent_<Date.now() in base 36>`), one genuinely unknown.
  store.saveProfile('own-born', {
    userId: 'own-born', chat: [],
    agents: [
      mkAgent('agent_stored', 'Stamped', { createdAt: BORN_STORED }),
      mkAgent(`agent_${BORN_FROM_ID.toString(36)}`, 'Inferred'),
      mkAgent('handwritten', 'Ancient'),
    ],
  });
});

after(() => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

async function withStore(fn) {
  await fn();
}

test('HOME-STATE-1: presentAgent serves location and routine', async () => {
  await withStore(async () => {
    const profiles = await import('./agentProfiles.js');

    // One agent out at a $25/$50 table, one at home with an unread recap.
    const table = { tableId: 'tbl-1', bigBlind: 50, home: false, agentIds: ['out'] };
    profiles.setLiveTableProvider({
      getTable: (id) => (id === 'tbl-1' ? table : null),
      hasTable: (id) => id === 'tbl-1',
      getLiveGame: (id) => (id === 'tbl-1' ? { tableId: 'tbl-1', street: 'flop', pot: 300 } : null),
      homeTableOf: () => null,
    });
    const roster = profiles.presentedRoster('own-present', { owner: true });
    const out = roster.find((a) => a.id === 'out');
    const home = roster.find((a) => a.id === 'in');

    assert.equal(out.location.where, Where.TABLE);
    assert.equal(out.location.tableId, 'tbl-1');
    assert.equal(out.location.room, 'upstairs', 'the room comes from the ladder, by big blind');
    assert.equal(out.routine, null, 'a routine is a home thing');
    assert.ok(Number.isFinite(out.location.since));

    assert.equal(home.location.where, Where.HOME);
    assert.equal(home.location.room, null);
    assert.equal(home.routine.key, Routine.WAITS, 'there is a recap he has not read');

    // And the same two facts ride the floor roster card.
    const floorCard = profiles.floorSnapshot('own-present', { owner: true }).find((a) => a.id === 'in');
    assert.equal(floorCard.location.where, Where.HOME);
    assert.equal(floorCard.routine.key, Routine.WAITS);

    profiles.setLiveTableProvider(null);
  });
});

test('HOME-STATE-1: cards in his hands beat his nature', async () => {
  await withStore(async () => {
    const profiles = await import('./agentProfiles.js');
    const homeTable = { tableId: 'home-own-table', home: true, closed: false, bigBlind: 2, agentIds: ['a'] };
    profiles.setLiveTableProvider({
      getTable: () => null,
      hasTable: () => false,
      getLiveGame: () => null,
      homeTableOf: (agentId) => (agentId === 'a' ? homeTable : null),
    });
    const [agent] = profiles.presentedRoster('own-table', { owner: true });
    assert.equal(agent.location.where, Where.HOME, 'the kitchen table is at home');
    assert.equal(agent.routine.key, Routine.PLAYS);
    assert.equal(agent.homeTableId, 'home-own-table');
    profiles.setLiveTableProvider(null);
  });
});

test('HOME-STATE-1: FLOOR_SUB answers with a HOME_STATE, owner-scoped', async () => {
  await withStore(async () => {
    const profiles = await import('./agentProfiles.js');
    const floor = await import('./floorChannel.js');

    profiles.setLiveTableProvider({
      getTable: () => null, hasTable: () => false, getLiveGame: () => null, homeTableOf: () => null,
    });
    floor.configure({
      liveTables: { listTables: () => [], listFloorTables: () => [] },
      homeGames: {
        state: (uid) => (uid === 'own-wire'
          ? { tableId: 'home-own-wire', state: 'running', seats: [], handsPlayed: 0 }
          : null),
      },
    });

    const sent = [];
    const ws = { readyState: 1, OPEN: 1, send: (raw) => sent.push(JSON.parse(raw)) };
    floor.subscribe(ws, { userId: 'own-wire', owner: true });

    const home = sent.find((m) => m.type === ServerMsg.HOME_STATE);
    assert.ok(home, 'a subscriber gets his living room immediately');
    assert.equal(home.userId, 'own-wire');
    assert.equal(home.agents.length, 1);
    assert.equal(home.agents[0].routine.key, Routine.READS);
    assert.equal(home.game.tableId, 'home-own-wire');

    // Somebody else's household never arrives on this socket.
    sent.length = 0;
    floor.notifyHomeChanged('own-other');
    assert.equal(sent.length, 0);

    floor.notifyHomeChanged('own-wire');
    assert.equal(sent.filter((m) => m.type === ServerMsg.HOME_STATE).length, 1);

    floor.reset();
    profiles.setLiveTableProvider(null);
  });
});

test('SERVER-4: presentAgent answers when he was made, or says it does not know', async () => {
  const profiles = await import('./agentProfiles.js');
  profiles.setLiveTableProvider(null);
  // By id, not by position: the roster is ordered by created_at, which is the
  // very field under test here.
  const roster = profiles.presentedRoster('own-born', { owner: true });
  const by = (id) => roster.find((a) => a.id === id);
  const stored = by('agent_stored');
  const inferred = by(`agent_${BORN_FROM_ID.toString(36)}`);
  const ancient = by('handwritten');

  // Written at birth from now on.
  assert.equal(stored.createdAt, BORN_STORED);
  assert.equal(stored.bornAt, BORN_STORED);

  // Backfilled for everybody older, off the id — `agent_<epoch in base 36>` is
  // an exact answer for every agent minted since that scheme, and the only
  // source that does not need the record to have remembered anything.
  assert.equal(inferred.createdAt, BORN_FROM_ID);
  assert.equal(inferred.bornAt, BORN_FROM_ID);

  // An id that predates the scheme, or was hand-written, leaves it null rather
  // than guessing — and null is the safe direction, because it fails the
  // "younger than a minute" test rather than passing it.
  assert.equal(ancient.createdAt, null);
  assert.equal(ancient.bornAt, null);
});
