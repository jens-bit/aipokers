// src/server/roomTables.test.js — CASINO-2 job 1
//
// What is running in a room, and what may be said about it out loud.
//
// Two halves. The felts themselves are asserted against REAL Tables, because
// the whole design of job 1 is that a table projects itself — a literal with a
// hand-written feltView() would test this file's opinion of a felt rather than
// the felt. The grouping, ranking, map and route are asserted against literals
// carrying a feltView(), because that is the entire contract this module has
// with a table and stating it as a literal is what makes it a contract.
//
// No model calls: every seat here is a plain player and every action is
// driven explicitly, so the whole file is deterministic.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import {
  feltFor, roomTablesSnapshot, tableRoomMap, currentRoomTables, configure,
  installRoomTableRoutes,
} from './roomTables.js';
import { Table } from './table.js';
import { Streets } from '../engine/game.js';
import { setPersistEnabled } from './opponentStats.js';
import { EventType, emitCasinoEvent, resetEvents } from './events.js';
import { ServerMsg } from './protocol.js';

setPersistEnabled(false);

process.env.FLOOR_TABLES_INTERVAL_MS = '40';
const TABLES_INTERVAL_MS = 40;
const floor = await import('./floorChannel.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fakeWs = () => ({
  readyState: 1,
  OPEN: 1,
  sent: [],
  send(payload) { this.sent.push(JSON.parse(payload)); },
});

const tableMsgs = (ws) => ws.sent.filter((m) => m.type === ServerMsg.ROOM_TABLES);

// A literal standing in for a Table: the four fields this module reads plus
// the projection it asks for. This IS the contract.
const felt = ({ tableId, bigBlind = 20, pot = 0, seated = 2, hot = false, closed = false, home = false, seats = [] }) => ({
  tableId,
  closed,
  home,
  feltView: () => ({
    tableId, blinds: `${bigBlind / 2}/${bigBlind}`, smallBlind: bigBlind / 2, bigBlind,
    street: pot > 0 ? Streets.FLOP : Streets.WAITING,
    board: pot > 0 ? ['Ah', 'Kd', '2c'] : [],
    pot, toAct: pot > 0 ? 1 : null, handNumber: pot > 0 ? 4 : 0,
    hot, seated, maxSeats: 6, seats,
  }),
});

beforeEach(() => {
  resetEvents();
  configure({ liveTables: null });
});

// ── The felt a real table projects ──────────────────────────────────────────

function seatedTable({ tableId = 'ft-1', smallBlind = 10, bigBlind = 20, n = 3 } = {}) {
  const table = new Table({ tableId, smallBlind, bigBlind, maxSeats: 6 });
  for (let i = 0; i < n; i++) {
    table.seatPlayer(fakeWs(), { playerId: `p${i}`, buyIn: 1000, displayName: `P${i}` });
  }
  return table;
}

test('CASINO-2: a table between hands is still a felt — seats, no board, no pot', () => {
  const table = seatedTable();
  const view = table.feltView();
  assert.equal(view.tableId, 'ft-1');
  assert.equal(view.blinds, '10/20');
  assert.equal(view.seated, 3);
  assert.equal(view.pot, 0);
  assert.deepEqual(view.board, []);
  assert.equal(view.seats.length, 3, 'one entry per occupied seat, drawn between hands too');
  assert.deepEqual(view.seats.map((s) => s.seat), [0, 1, 2]);
  assert.deepEqual(view.seats.map((s) => s.name), ['P0', 'P1', 'P2']);
  table.closeTable('test over');
});

test('CASINO-2: a felt carries the board and the money in the middle, and nobody\'s cards', () => {
  const table = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  const view = table.feltView();
  assert.equal(view.street, Streets.PREFLOP);
  assert.ok(view.pot > 0, 'the blinds are in the middle');
  assert.equal(view.handNumber, 1);
  assert.ok(view.seats.every((s) => s.inHand), 'everybody is still in it');

  const json = JSON.stringify(view);
  assert.ok(!/holeCards|heroHole/.test(json), 'no hole cards on the wire, for anybody');
  for (const seat of table.game.seats) {
    for (const card of seat.holeCards ?? []) {
      assert.ok(!json.includes(`"${card}"`), `${card} must not reach the lobby`);
    }
  }
  table.closeTable('test over');
});

test('CASINO-2: a seat that folds is still at the felt, and is no longer in the hand', () => {
  const table = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  const seat = table.game.toAct;
  table.game.act(seat, { type: 'fold' });
  const view = table.feltView();
  assert.equal(view.seats.length, 3, 'he did not leave the table, he folded a hand');
  assert.equal(view.seats.find((s) => s.seat === seat).inHand, false);
  table.closeTable('test over');
});

test('CASINO-2: a closed table projects nothing', () => {
  const table = seatedTable();
  table.closeTable('closing');
  assert.equal(table.feltView(), null);
  assert.equal(feltFor(table), null);
});

test('CASINO-2: a home game is never on the floor', () => {
  const table = seatedTable({ tableId: 'home-jens' });
  table.home = true;
  assert.equal(feltFor(table), null, 'the kitchen table is reachable by id and is on nobody\'s lobby');
  table.closeTable('test over');
});

// ── The room a felt is in ───────────────────────────────────────────────────

test('CASINO-2: the room is the blinds, exactly as in rooms.js', () => {
  const rows = roomTablesSnapshot([
    felt({ tableId: 'a', bigBlind: 20 }),
    felt({ tableId: 'b', bigBlind: 50 }),
    felt({ tableId: 'c', bigBlind: 100 }),
  ], { hotIds: [] });
  assert.deepEqual(rows.map((r) => [r.tableId, r.room]).sort(), [
    ['a', 'floor'], ['b', 'upstairs'], ['c', 'backroom'],
  ]);
});

test('CASINO-2: a table at blinds no rung runs is in no room, so it is on no floor', () => {
  const rows = roomTablesSnapshot([felt({ tableId: 'hu', bigBlind: 7 })], { hotIds: [] });
  assert.deepEqual(rows, [], 'a bespoke game stood up over the socket is not in the building');
});

test('CASINO-2: one room at a time, when one is asked for', () => {
  const rows = roomTablesSnapshot([
    felt({ tableId: 'a', bigBlind: 20 }),
    felt({ tableId: 'b', bigBlind: 50 }),
  ], { room: 'upstairs', hotIds: [] });
  assert.deepEqual(rows.map((r) => r.tableId), ['b']);
});

test('CASINO-2: a closed table and a home game never reach the room', () => {
  const rows = roomTablesSnapshot([
    felt({ tableId: 'gone', closed: true }),
    felt({ tableId: 'kitchen', home: true }),
    felt({ tableId: 'real' }),
  ], { hotIds: [] });
  assert.deepEqual(rows.map((r) => r.tableId), ['real']);
});

// ── Ranking: how loudly a felt is asking for you ────────────────────────────

test('CASINO-2: hot first, then the money, then anybody at all, then empty chairs', () => {
  const rows = roomTablesSnapshot([
    felt({ tableId: 'empty', seated: 0 }),
    felt({ tableId: 'quiet', seated: 4 }),
    felt({ tableId: 'small', pot: 300, seated: 4 }),
    felt({ tableId: 'big', pot: 4180, seated: 5 }),
    felt({ tableId: 'onfire', pot: 900, seated: 3 }),
  ], { hotIds: ['onfire'] });
  assert.deepEqual(rows.map((r) => r.tableId), ['onfire', 'big', 'small', 'quiet', 'empty']);
});

test('CASINO-2: the order is stable for a given floor — the push is gated on the payload', () => {
  const build = () => [
    felt({ tableId: 'b', pot: 500 }),
    felt({ tableId: 'a', pot: 500 }),
  ];
  const once = roomTablesSnapshot(build(), { hotIds: [] }).map((r) => r.tableId);
  const twice = roomTablesSnapshot(build().reverse(), { hotIds: [] }).map((r) => r.tableId);
  assert.deepEqual(once, twice, 'a lobby that reshuffles on its own is a lobby you cannot tap');
});

test('CASINO-2: hot comes from the event ring, and expires with it', () => {
  emitCasinoEvent({ type: EventType.HOT, tableId: 'x', headline: 'river, two live', pot: 900 });
  const now = roomTablesSnapshot([felt({ tableId: 'x' })]);
  assert.equal(now[0].hot, true);
  const later = roomTablesSnapshot([felt({ tableId: 'x' })], { now: Date.now() + 60_000 });
  assert.equal(later[0].hot, false, 'the whole value of the flag is that there is still time to go');
});

// ── The table→room map ──────────────────────────────────────────────────────

test('CASINO-2: the map ROOMS-1 never sent', () => {
  const rows = roomTablesSnapshot([
    felt({ tableId: 'a', bigBlind: 20 }),
    felt({ tableId: 'b', bigBlind: 100 }),
  ], { hotIds: [] });
  assert.deepEqual(tableRoomMap(rows), { a: 'floor', b: 'backroom' });
});

test('CASINO-2: the map and the felts can never name different rooms — it is built from them', () => {
  const rows = roomTablesSnapshot([felt({ tableId: 'a', bigBlind: 50 })], { hotIds: [] });
  const map = tableRoomMap(rows);
  for (const row of rows) assert.equal(map[row.tableId], row.room);
});

// ── The provider ────────────────────────────────────────────────────────────

test('CASINO-2: the floor is asked for, not the whole registry', () => {
  let askedFloor = false;
  configure({
    liveTables: {
      listFloorTables: () => { askedFloor = true; return [felt({ tableId: 'a' })]; },
      listTables: () => { throw new Error('a home game is nobody\'s lobby'); },
    },
  });
  assert.deepEqual(currentRoomTables({ hotIds: [] }).map((r) => r.tableId), ['a']);
  assert.equal(askedFloor, true);
});

// ── The route ───────────────────────────────────────────────────────────────

async function withServer(provider, fn) {
  const app = express();
  installRoomTableRoutes(app, { liveTables: provider });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); }
  finally { await new Promise((r) => server.close(r)); }
}

test('CASINO-2: GET /api/rooms/:id/tables serves that room\'s felts', async () => {
  const provider = { listFloorTables: () => [
    felt({ tableId: 'a', bigBlind: 20, pot: 400 }),
    felt({ tableId: 'up', bigBlind: 50, pot: 9000 }),
  ] };
  await withServer(provider, async (base) => {
    const res = await fetch(`${base}/api/rooms/upstairs/tables`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.json();
    assert.equal(body.room, 'upstairs');
    assert.equal(body.stakes.label, '$25/$50');
    assert.deepEqual(body.tables.map((t) => t.tableId), ['up'], 'the floor\'s tables are not upstairs');
    assert.ok(!JSON.stringify(body).includes('holeCards'));
  });
});

test('CASINO-2: an empty room is a real answer; a room that does not exist is a 404', async () => {
  await withServer({ listFloorTables: () => [] }, async (base) => {
    const quiet = await fetch(`${base}/api/rooms/backroom/tables`);
    assert.equal(quiet.status, 200);
    assert.deepEqual((await quiet.json()).tables, [], 'the back room is quiet tonight');

    const nope = await fetch(`${base}/api/rooms/mezzanine/tables`);
    assert.equal(nope.status, 404, 'a typo must not read as a quiet room');
    assert.deepEqual((await nope.json()).rooms, ['floor', 'upstairs', 'backroom']);
  });
});

// ── The push ────────────────────────────────────────────────────────────────

test('CASINO-2: a fresh subscriber is handed the felts once, without asking', () => {
  configure({ liveTables: { listFloorTables: () => [felt({ tableId: 'a', pot: 400 })] } });
  floor.configure({ liveTables: null });
  const ws = fakeWs();
  try {
    floor.subscribe(ws, { userId: 'owner-a', owner: true });
    const first = tableMsgs(ws);
    assert.equal(first.length, 1);
    assert.deepEqual(first[0].tables.map((t) => t.tableId), ['a']);
    assert.deepEqual(first[0].rooms, { a: 'floor' }, 'the map rides the same frame');
  } finally {
    floor.reset();
  }
});

test('CASINO-2: an unchanged floor is silent', () => {
  const live = [felt({ tableId: 'a', pot: 400 })];
  configure({ liveTables: { listFloorTables: () => live } });
  floor.configure({ liveTables: null });
  const ws = fakeWs();
  try {
    floor.subscribe(ws, { userId: 'owner-a' });
    floor.broadcastRoomTables({ force: true });
    const before = tableMsgs(ws).length;
    assert.equal(floor.broadcastRoomTables(), 0, 'nothing moved, so nothing is said');
    assert.equal(tableMsgs(ws).length, before);
  } finally {
    floor.reset();
  }
});

test('CASINO-2: the last state of a hand always lands, however busy the floor was', async () => {
  let pot = 100;
  configure({ liveTables: { listFloorTables: () => [felt({ tableId: 'a', pot })] } });
  floor.configure({ liveTables: null });
  const ws = fakeWs();
  try {
    floor.subscribe(ws, { userId: 'owner-a' });
    floor.broadcastRoomTables({ force: true });
    const settled = tableMsgs(ws).length;

    // Five changes inside one throttle window: the first is held, the rest
    // collapse into it, and the trailing send carries the last one.
    for (const next of [200, 400, 800, 1600, 4180]) {
      pot = next;
      floor.broadcastRoomTables();
    }
    assert.equal(tableMsgs(ws).length, settled, 'held, not dropped and not spammed');

    await sleep(TABLES_INTERVAL_MS + 30);
    const after = tableMsgs(ws);
    assert.equal(after.length, settled + 1, 'exactly one push for the burst');
    assert.equal(after.at(-1).tables[0].pot, 4180, 'and it is the last state, not the first');
  } finally {
    floor.reset();
  }
});

test('CASINO-2: nobody subscribed means nothing computed and nothing sent', () => {
  configure({ liveTables: { listFloorTables: () => { throw new Error('should not be asked'); } } });
  floor.configure({ liveTables: null });
  assert.equal(floor.broadcastRoomTables(), 0, 'the floor is only assembled for someone who is looking');
});
