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
import { runScript } from '../test/helpers/runScript.js';

import {
  HOME_BLINDS, HOME_BUYIN, HOME_SEATS, HOME_PLAY_MS, HOME_COOLDOWN_MS, eligible, homeTableId, configure, sync, reset, state,
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

test('BUG-78: the resume timer survives a household cooldown with no new owner activity',async()=>{
  const script=path.join(dir,'rhythm-probe.mjs');
  fs.writeFileSync(script,`
    process.env.HOME_TICK_MS='10';
    process.env.HOME_COOLDOWN_MS='60';
    delete process.env.ANTHROPIC_API_KEY;
    const assert=(await import('node:assert/strict')).default;
    const home=await import(${JSON.stringify(new URL('./homeGame.js',import.meta.url).href)});
    const registry=await import(${JSON.stringify(new URL('./tableRegistry.js',import.meta.url).href)});
    const store=await import(${JSON.stringify(new URL('./store.js',import.meta.url).href)});
    try {
      home.configure({liveTables:registry,agentsFor:()=>['a','b'].map(id=>({id,name:id,location:{where:'home'},fatigue:'fresh',profile:{}}))});
      const first=home.sync('timer');
      registry.getTable(first.tableId).closeTable('end of game');
      home.sync('timer');
      assert.equal(home.state('timer'),null);
      await new Promise(resolve=>setTimeout(resolve,220));
      assert.equal(home.state('timer')?.state,'running','the server must resume without another click or roster change');
    } finally { home.reset(); registry.resetRegistry('test over'); store._closeForTests(); }
  `,'utf8');
  const result=await runScript(script,{isolateCwd:true,timeoutMs:10000});
  assert.equal(result.code,0,result.output);
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

// ── SERVER-4 · what they are doing at the kitchen table ─────────────────────

test('SERVER-4: a home seat says what he is doing, not only who he is', () => {
  const roster = [home('one', 'The Clock'), home('two', 'River Rat')];
  configure({ liveTables: registry, agentsFor: () => roster });
  const running = sync('flat');
  const table = registry.getTable(running.tableId);

  // Between hands: nobody acting, nobody folded, and the stacks as they stand.
  // The resting answer has to be the honest one, because it is the one a table
  // sheet spends most of its time drawing.
  for (const seat of running.seats) {
    assert.equal(seat.acting, false);
    assert.equal(seat.folded, false);
    assert.equal(seat.stack, HOME_BUYIN, 'the chips in front of him');
  }

  // A hand in the air. Before this the sheet could name four people and
  // nothing else, so a home game read as a cast list rather than as a game.
  table.maybeStartHand();
  assert.ok(table.game && table.game.street !== 'waiting', 'a hand is in the air');
  const dealt = sync('flat');
  const acting = dealt.seats.filter((s) => s.acting);
  assert.equal(acting.length, 1, 'exactly one of them is on the clock');
  assert.equal(acting[0].seat, table.game.toAct);

  // Somebody folds, and the sheet knows he is out of it.
  const folder = table.game.toAct;
  table.game.act(folder, { type: 'fold' });
  const after = sync('flat');
  assert.equal(after.seats.find((s) => s.seat === folder).folded, true);
  assert.equal(after.seats.find((s) => s.seat === folder).acting, false,
    'a man who has folded is not on the clock');
});

test('SERVER-4: nobody is on the clock when there is no hand in the air', () => {
  const roster = [home('one', 'The Clock'), home('two', 'River Rat')];
  configure({ liveTables: registry, agentsFor: () => roster });
  const running = sync('flat');
  const table = registry.getTable(running.tableId);

  table.maybeStartHand();
  assert.equal(sync('flat').seats.some((s) => s.acting), true);

  // `toAct` still points somewhere between hands. Drawing a spotlight on a man
  // who is waiting for a deal is the same class of lie as BUG-16.
  table.game.street = 'waiting';
  assert.equal(sync('flat').seats.some((s) => s.acting), false);
});

test('HOME-3: one left alone leaves the table; a deliberate placement still plays the House', () => {
  let roster = [home('one', 'The Clock'), home('two', 'River Rat')];
  configure({ liveTables: registry, agentsFor: () => roster });
  sync('flat');

  // v14 changes the automatic solo rule: one alone lives in the room. The
  // explicit Carry/table action keeps the existing House game available.
  roster = [home('one', 'The Clock'), out('two', 'River Rat')];
  assert.equal(sync('flat'),null);
  const solo = sync('flat',{manual:true});
  assert.equal(solo.state, 'running');
  assert.deepEqual(solo.seats.map((s) => s.agentId), ['one', null]);
  assert.equal(solo.seats.filter((s) => s.house).length, 1, 'the House on the TV');

  // And when the second comes home, it is their game again — no House.
  roster = [home('one', 'The Clock'), home('two', 'River Rat')];
  const back = sync('flat');
  assert.deepEqual(back.seats.map((s) => s.agentId).sort(), ['one', 'two']);
  assert.equal(back.seats.some((s) => s.house), false);
});

test('HOME-3: five minutes of cards gives the household ten minutes for its routines',()=>{
  configure({liveTables:registry,agentsFor:()=>[home('one','A'),home('two','B')]});
  const running=sync('flat',{now:1000});
  const table=registry.getTable(running.tableId);
  assert.equal(sync('flat',{now:1000+HOME_PLAY_MS-1}).state,'running');
  assert.equal(sync('flat',{now:1000+HOME_PLAY_MS}),null);
  assert.equal(table.closed,true);
  assert.equal(sync('flat',{now:1000+HOME_PLAY_MS+HOME_COOLDOWN_MS-1}),null);
  assert.equal(sync('flat',{now:1000+HOME_PLAY_MS+HOME_COOLDOWN_MS}).state,'running');
});

test('HOME-3: a rhythm break waits for the current hand and a housemate does not restart its clock',()=>{
  let roster=[home('one','A'),home('two','B')];
  configure({liveTables:registry,agentsFor:()=>roster});
  sync('flat',{now:1000});
  roster=[...roster,home('three','C')];
  const running=sync('flat',{now:1000+HOME_PLAY_MS-20});
  const table=registry.getTable(running.tableId);
  table.maybeStartHand();
  assert.equal(table.handInProgress(),true);
  const game=table.game;
  sync('flat',{now:1000+HOME_PLAY_MS});
  assert.equal(table.closed,false,'do not cut off the hand in the middle');
  assert.equal(table.game,game);
  assert.equal(table.maxHands,Math.max(1,table.handsThisSession),'finish this hand before the break');
});

test('HOME-3: Carry can deliberately start a game during a break but cannot force an occupied agent',()=>{
  let roster=[home('one','A'),home('two','B')];
  configure({liveTables:registry,agentsFor:()=>roster});
  sync('flat',{now:1000});
  sync('flat',{now:1000+HOME_PLAY_MS});
  assert.equal(sync('flat',{now:1001+HOME_PLAY_MS,manual:true}).state,'running');
  roster.push(home('three','C'));
  assert.equal(sync('flat',{now:1002+HOME_PLAY_MS}).state,'running','a new housemate does not reinstate the old cooldown');
  roster=[home('one','A',{study:{handNumber:1}}),home('two','B',{fatigue:'worn'})];
  assert.equal(sync('flat',{now:1002+HOME_PLAY_MS,manual:true}),null);
});

// ── VISIT-1 ──────────────────────────────────────────────────────────────────

test('BUG-154: HOME_STATE reports game capacity and every occupied chair independently of roster slots', () => {
  configure({ liveTables: registry, agentsFor: () => [home('one', 'The Clock'), home('two', 'River Rat')], visitorsFor: () => [] });
  const running = sync('flat');
  const table = registry.getTable(running.tableId);
  assert.equal(running.maxSeats, table.maxSeats);
  assert.equal(running.maxSeats, HOME_SEATS);
  table.seatPlayer({ send() {}, readyState: 1 }, { playerId: 'human', displayName: 'YOU', buyIn: 2000 });
  const withHuman = state('flat');
  assert.equal(withHuman.seats.length, 3, 'a human also occupies a chair');
  assert.equal(withHuman.seats.filter(seat => !seat.agentId).length, 1);
});

test('VISIT-1: a visitor is seated under his OWN owner, not the host', () => {
  const roster = [home('one', 'The Clock')];
  const guests = [{ ...home('friend', 'Away Day'), ownerId: 'guest-owner' }];
  configure({ liveTables: registry, agentsFor: () => roster, visitorsFor: () => guests });

  const running = sync('flat');
  assert.deepEqual(running.seats.map((s) => s.agentId).sort(), ['friend', 'one']);
  assert.equal(running.seats.some((s) => s.house), false, 'a real second body — no House needed');

  const table = registry.getTable(running.tableId);
  const guestSeat = table.agentIds.indexOf('friend');
  const hostSeat = table.agentIds.indexOf('one');
  assert.equal(table.agentUserIds[guestSeat], 'guest-owner');
  assert.equal(table.agentUserIds[hostSeat], 'flat');
});

test('VISIT-1: a full house leaves no chair for a guest', () => {
  const roster = Array.from({ length: HOME_SEATS }, (_, i) => home(`r${i}`, `R${i}`));
  const guests = [{ ...home('friend', 'Away Day'), ownerId: 'guest-owner' }];
  configure({ liveTables: registry, agentsFor: () => roster, visitorsFor: () => guests });

  const running = sync('flat');
  assert.equal(running.seats.length, HOME_SEATS);
  assert.equal(running.seats.some((s) => s.agentId === 'friend'), false);
});

test('VISIT-1: a household with no visitorsFor injected behaves exactly as before', () => {
  const roster = [home('one', 'A'), home('two', 'B')];
  configure({ liveTables: registry, agentsFor: () => roster });
  const running = sync('flat');
  assert.deepEqual(running.seats.map((s) => s.agentId).sort(), ['one', 'two']);
});

test('HOME-STATE-1: the table id is stable, so a watcher does not lose it', () => {
  let roster = [home('one', 'A'), home('two', 'B')];
  configure({ liveTables: registry, agentsFor: () => roster });
  const first = sync('flat').tableId;
  roster = [home('one', 'A'), out('two', 'B')];
  const second = sync('flat',{manual:true}).tableId;
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
