// src/server/homeGame.test.js — HOME-STATE-1 (item 2)
//
// The kitchen table: who sits at it, and what may not happen there.
//
// The second half is the important half. A home game that quietly credited a
// pocket, or grew an attribute, or told the casino about a big pot, would be
// the cheapest grind in the product — so the firewall is asserted directly
// against a real Table with a real agent record behind it, both ways round:
// the same ending on a casino table DOES all of it.

// TEST-2 / the testing law: no automated suite talks to a real model.
delete process.env.ANTHROPIC_API_KEY;

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  HOME_BLINDS, HOME_BUYIN, HOME_SEATS, eligible, homeTableId, configure, sync, reset,
} from './homeGame.js';
import { Where } from './home.js';
import { roomsSnapshot } from './rooms.js';
import { pickTableToJoin } from './matchmaking.js';
import { _closeForTests } from './store.js';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-homegame-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;

let registry;
let profiles;
let events;

const mkAgent = (id, name, extra = {}) => ({
  id, name, status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'You are a poker player.',
  bankroll: 3_000,
  pocket: { balance: 3_000, mode: 'topup', cap: null, realised: 0, ledger: [] },
  stats: { handsPlayed: 40, handsWon: 10, totalDecisions: 100, netWon: 0 },
  profile: { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 },
  ...extra,
});

// Every profile written before agentProfiles is first read — see the note in
// home.test.js about its in-memory store cache.
before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  _closeForTests();
  process.chdir(dir);
  const store = await import('./store.js');
  store.saveProfile('flat', {
    userId: 'flat', chat: [],
    agents: [
      mkAgent('one', 'The Clock', { nature: { name: 'Rock' } }),
      mkAgent('two', 'River Rat', { nature: { name: 'Shark' } }),
    ],
  });
  store.saveProfile('firewall', {
    userId: 'firewall', chat: [], agents: [mkAgent('fw', 'Stone Cold')],
  });
  store.saveProfile('casino', {
    userId: 'casino', chat: [], agents: [mkAgent('cs', 'Big Slick')],
  });

  registry = await import('./tableRegistry.js');
  profiles = await import('./agentProfiles.js');
  events = await import('./events.js');
  profiles.setLiveTableProvider(registry);
});

after(() => {
  reset();
  registry?.resetRegistry('test over');
  profiles?.setLiveTableProvider(null);
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

beforeEach(() => {
  reset();
  registry.resetRegistry('between tests');
});

// A roster in the shape presentedRoster hands back — location and fatigue are
// the only fields eligibility reads.
const home = (id, name, extra = {}) => ({
  id, name, strategy: 'x', profile: { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 },
  location: { where: Where.HOME, tableId: null, room: null, since: 0 },
  fatigue: 'fresh', study: null, ...extra,
});
const out = (id, name) => home(id, name, {
  location: { where: Where.TABLE, tableId: 't1', room: 'floor', since: 0 },
});

// ── Eligibility ─────────────────────────────────────────────────────────────

test('HOME-STATE-1: home and idle — out, studying and worn are none of it', () => {
  const roster = [
    home('a', 'A'),
    out('b', 'B'),
    home('c', 'C', { study: { handNumber: 3, endsAt: Date.now() + 60_000 } }),
    home('d', 'D', { fatigue: 'worn' }),
    home('e', 'E', { location: { where: Where.CASINO, tableId: 't2', room: 'floor', since: 0 } }),
  ];
  assert.deepEqual(eligible(roster).map((a) => a.id), ['a']);
});

test('HOME-STATE-1: broke is not an exclusion — the front room is where he ends up', () => {
  const roster = [home('a', 'A', { presence: 'broke' }), home('b', 'B', { presence: 'broke' })];
  assert.deepEqual(eligible(roster).map((a) => a.id), ['a', 'b']);
});

test('HOME-STATE-1: a household cannot seat more than the table has chairs', () => {
  const roster = Array.from({ length: 9 }, (_, i) => home(`a${i}`, `A${i}`));
  assert.equal(eligible(roster).length, HOME_SEATS);
});

// ── Standing it up, breaking it up ──────────────────────────────────────────

test('HOME-STATE-1: two home means a game; nobody home means none', () => {
  let roster = [home('one', 'The Clock'), home('two', 'River Rat')];
  configure({ liveTables: registry, agentsFor: () => roster });

  const running = sync('flat');
  assert.equal(running.state, 'running');
  assert.equal(running.tableId, homeTableId('flat'));
  assert.deepEqual(running.seats.map((s) => s.agentId).sort(), ['one', 'two']);
  assert.equal(running.seats.some((s) => s.house), false, 'two of his own — no House needed');

  const table = registry.getTable(running.tableId);
  assert.equal(table.home, true);
  assert.equal(table.smallBlind, HOME_BLINDS.smallBlind);
  assert.equal(table.bigBlind, HOME_BLINDS.bigBlind);
  assert.equal(table.pending[0].buyIn, HOME_BUYIN);

  // Idempotent: nothing changed, so nothing is torn down.
  const again = sync('flat');
  assert.equal(registry.getTable(running.tableId), table, 'the same table, not a new one');
  assert.deepEqual(again.seats.map((s) => s.agentId).sort(), ['one', 'two']);

  // Everybody out.
  roster = [out('one', 'The Clock'), out('two', 'River Rat')];
  assert.equal(sync('flat'), null, 'no game to describe');
  assert.equal(registry.hasTable(running.tableId), false, 'and no table left dealing');
});

test('HOME-STATE-1: one alone plays the House on the TV, the same way', () => {
  let roster = [home('one', 'The Clock'), home('two', 'River Rat')];
  configure({ liveTables: registry, agentsFor: () => roster });
  sync('flat');

  // One of them is sent out. The game he was in breaks up and the one left
  // gets the House.
  roster = [home('one', 'The Clock'), out('two', 'River Rat')];
  const solo = sync('flat');
  assert.equal(solo.state, 'running');
  assert.deepEqual(solo.seats.map((s) => s.agentId), ['one', null]);
  assert.equal(solo.seats.filter((s) => s.house).length, 1, 'the House on the TV');

  // And when the second comes home, it is their game again — no House.
  roster = [home('one', 'The Clock'), home('two', 'River Rat')];
  const back = sync('flat');
  assert.deepEqual(back.seats.map((s) => s.agentId).sort(), ['one', 'two']);
  assert.equal(back.seats.some((s) => s.house), false);
});

test('HOME-STATE-1: the table id is stable, so a watcher does not lose it', () => {
  let roster = [home('one', 'A'), home('two', 'B')];
  configure({ liveTables: registry, agentsFor: () => roster });
  const first = sync('flat').tableId;
  roster = [home('one', 'A'), out('two', 'B')];
  const second = sync('flat').tableId;
  assert.equal(second, first);
});

test('HOME-STATE-1: a stray table standing on the home id is evicted, not adopted', () => {
  // WATCH creates a table for any id it is handed, so a client reconnecting a
  // moment after the game broke up leaves an ordinary 10/20 table wearing the
  // kitchen table's name. `home` cannot be flipped after creation, so the only
  // correct answer is to close it.
  const stray = registry.getOrCreateTable(homeTableId('flat'), { smallBlind: 10, bigBlind: 20 });
  assert.equal(stray.home, false);

  configure({ liveTables: registry, agentsFor: () => [home('one', 'A'), home('two', 'B')] });
  const game = sync('flat');
  assert.equal(game.state, 'running');
  assert.equal(registry.getTable(game.tableId).home, true);
  assert.equal(stray.closed, true);
});

// ── The home game is not on the floor ───────────────────────────────────────

test('HOME-STATE-1: the kitchen table is in no room, on no ladder, and in nobody\'s way', () => {
  configure({ liveTables: registry, agentsFor: () => [home('one', 'A'), home('two', 'B')] });
  const game = sync('flat');
  const table = registry.getTable(game.tableId);

  // No room: its blinds are on no rung.
  const rooms = roomsSnapshot(registry.listTables(), { hotIds: [] });
  assert.equal(rooms.reduce((n, r) => n + r.tables, 0), 0);

  // Not on the floor's list at all.
  assert.equal(registry.listFloorTables().includes(table), false);
  assert.equal(registry.listTables().includes(table), true, 'still reachable — that is how WATCH works');

  // Not against the casino's ceiling: a friendly game must never refuse a
  // real deploy.
  assert.equal(table.autoPlay, true);
  assert.equal(registry.countAutonomousTables(), 0);

  // And the matchmaker will not send a deploying agent into somebody's flat.
  assert.equal(
    pickTableToJoin([table], { profile: { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 }, agentId: 'x', userId: 'flat' }),
    null);
});

test('HOME-STATE-1: the home game is watched the way every table is watched', () => {
  configure({ liveTables: registry, agentsFor: () => [home('one', 'The Clock'), home('two', 'River Rat')] });
  const game = sync('flat');
  const table = registry.getTable(game.tableId);

  // The client is handed `game.tableId` in HOME_STATE and sends WATCH with it.
  // addSpectator is the whole of what WATCH does to a table, and on an
  // autonomous table it ATTACHES rather than seating anybody new (AGE-36) —
  // which is what makes watching the kitchen table free of side effects.
  const seen = [];
  const ws = { readyState: 1, OPEN: 1, send: (raw) => seen.push(JSON.parse(raw)) };
  const seat = table.addSpectator(ws, { agentId: 'two', userId: 'flat' });
  assert.equal(seat, table.agentIds.indexOf('two'), 'he watches HIS agent, not the first seat');
  assert.equal(table.seatedCount(), 2, 'watching seated nobody');
  assert.equal(table.spectators.length, 1);

  // And leaving does not recall anybody: an AI-only table belongs to the
  // server, at home exactly as on the floor.
  table.removeConnection(ws);
  assert.equal(table.spectators.length, 0);
  assert.equal(table.closed, false);
  assert.equal(table.seatedCount(), 2);
});

// ── The firewall ────────────────────────────────────────────────────────────

test('HOME-STATE-1: a home game ending moves no money and no number', async () => {
  const before = profiles.presentedRoster('firewall', { owner: true })[0];
  const pocketBefore = before.pocket.balance;
  const handsBefore = before.careerStats.hands;

  events.resetEvents();
  const table = registry.getOrCreateTable('home-firewall', { ...HOME_BLINDS, maxSeats: 2, home: true });
  table.seatAI({ agentId: 'fw', userId: 'firewall', displayName: 'Stone Cold', strategy: 'x', buyIn: HOME_BUYIN });
  table.seatAI({ displayName: 'House', strategy: 'y', buyIn: HOME_BUYIN });

  // Everything a session ending normally does, on the path that normally does
  // it. On a home table it must do none of it.
  table.closeTable('the game broke up', { recap: 'we packed it in' });

  const after = profiles.presentedRoster('firewall', { owner: true })[0];
  assert.equal(after.pocket.balance, pocketBefore, 'no cash-out — nothing was bought in');
  assert.equal(after.careerStats.hands, handsBefore, 'not a hand of his career');
  assert.equal(after.unseenRecap, false, 'there is no recap: it was not a session');
  assert.equal(after.sessionLog.length, 0);
  assert.equal(after.status, 'idle');
  assert.equal(events.eventsSince(0).length, 0, 'the casino heard nothing');

  // The fatigue path is off too — the cost side of the attribute curve is the
  // same curve growth is drawn from.
  assert.doesNotThrow(() => table._updateSeatFatigue());
  assert.equal(profiles.presentedRoster('firewall', { owner: true })[0].fatigue, 'fresh');
});

test('HOME-STATE-1: the same ending on a casino table DOES all of it', () => {
  const before = profiles.presentedRoster('casino', { owner: true })[0];
  assert.equal(before.unseenRecap, false);

  const table = registry.getOrCreateTable('tbl-casino', { smallBlind: 10, bigBlind: 20, maxSeats: 2 });
  assert.equal(table.home, false);
  table.seatAI({ agentId: 'cs', userId: 'casino', displayName: 'Big Slick', strategy: 'x', buyIn: 2_000 });
  table.seatAI({ displayName: 'House', strategy: 'y', buyIn: 2_000 });
  table.closeTable('session ended', { recap: 'called it a night' });

  const after = profiles.presentedRoster('casino', { owner: true })[0];
  assert.equal(after.unseenRecap, true, 'a real session leaves a recap to read');
  assert.equal(after.sessionLog.length, 1);
  // This is the contrast that makes the test above mean something: the two
  // paths are the same code, and only `home` separates them.
  assert.notEqual(after.pocket.balance, before.pocket.balance);
});
