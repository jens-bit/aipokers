// src/server/rooms.test.js — ROOMS-1
//
// The floor, by stakes tier. Object literals stand in for Tables: this module
// reads five public fields off one (tableId, bigBlind, closed, seatedCount(),
// game.pot) and that is the whole contract, so nothing here boots a server or
// deals a hand.

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import {
  ROOMS, HOT_RECENT_MS, roomsSnapshot, currentRooms, configure, installRoomRoutes,
} from './rooms.js';
import { STAKES } from './wallet.js';
import { EventType, emitCasinoEvent, resetEvents, hotTableIds } from './events.js';
import { ServerMsg } from './protocol.js';

// The floor channel is imported dynamically so the rooms push interval can be
// compressed before that module reads it — otherwise the trailing-edge test
// would have to sit out a real second.
process.env.FLOOR_ROOMS_INTERVAL_MS = '40';
const ROOMS_INTERVAL_MS = 40;
const floor = await import('./floorChannel.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const table = ({ tableId, bigBlind = 20, seated = 2, pot = 0, closed = false }) => ({
  tableId,
  bigBlind,
  closed,
  seatedCount: () => seated,
  game: pot > 0 ? { pot } : null,
});

const byId = (rooms) => Object.fromEntries(rooms.map((r) => [r.id, r]));

beforeEach(() => {
  resetEvents();
  configure({ liveTables: null });
});

// ── The ladder ──────────────────────────────────────────────────────────────

test('ROOMS-1: the rooms are the wallet ladder — one per rung, lowest first', () => {
  assert.deepEqual(ROOMS.map((r) => r.id), ['floor', 'upstairs', 'backroom']);
  assert.deepEqual(ROOMS.map((r) => r.name), ['the floor', 'upstairs', 'the back room']);
  assert.deepEqual(ROOMS.map((r) => r.stakes.label), STAKES.map((s) => s.label),
    'the stakes come from wallet.js, not from a second list kept in sync by hand');
  assert.deepEqual(ROOMS.map((r) => r.stakes.bigBlind), [20, 50, 100]);
  assert.deepEqual(ROOMS.map((r) => r.stakes.buyIn), STAKES.map((s) => s.buyIn),
    'the buy-in a pocket needs to walk in is the rung own buy-in');
});

test('ROOMS-1: an empty room reports zeroes rather than disappearing', () => {
  const rooms = roomsSnapshot([]);
  assert.equal(rooms.length, ROOMS.length, 'the back room being quiet is worth saying');
  for (const room of rooms) {
    assert.equal(room.tables, 0);
    assert.equal(room.seated, 0);
    assert.deepEqual(room.hot, []);
    assert.equal(room.biggestPot, null);
  }
  assert.deepEqual(Object.keys(rooms[0]).sort(),
    ['biggestPot', 'hot', 'id', 'name', 'rung', 'seated', 'stakes', 'tables'],
    'the shape is { id, name, rung, stakes, tables, seated, hot, biggestPot }');
});

// ── Counting ────────────────────────────────────────────────────────────────

test('ROOMS-1: tables and seats land in the room their blinds run at', () => {
  const rooms = byId(roomsSnapshot([
    table({ tableId: 't1', bigBlind: 20, seated: 6 }),
    table({ tableId: 't2', bigBlind: 20, seated: 2 }),
    table({ tableId: 't3', bigBlind: 50, seated: 3 }),
    table({ tableId: 't4', bigBlind: 100, seated: 4 }),
  ]));

  assert.equal(rooms.floor.tables, 2);
  assert.equal(rooms.floor.seated, 8, 'seated is seats filled across the room, not tables');
  assert.equal(rooms.upstairs.tables, 1);
  assert.equal(rooms.upstairs.seated, 3);
  assert.equal(rooms.backroom.tables, 1);
  assert.equal(rooms.backroom.seated, 4);
});

test('ROOMS-1: a closed table has left the floor, and off-ladder blinds were never on it', () => {
  const rooms = byId(roomsSnapshot([
    table({ tableId: 'live', bigBlind: 20, seated: 2 }),
    table({ tableId: 'closed', bigBlind: 20, seated: 2, closed: true }),
    // A bespoke game somebody stood up over the socket. Still a real table,
    // still reachable by id — it just belongs to no stakes tier.
    table({ tableId: 'bespoke', bigBlind: 200, seated: 5 }),
  ]));

  assert.equal(rooms.floor.tables, 1, 'a closed table is not running');
  assert.equal(rooms.floor.seated, 2);
  assert.equal(rooms.upstairs.tables + rooms.backroom.tables, 0,
    'and 200 is nobody rung, so it is in no room at all');
});

// ── The biggest pot in the air ──────────────────────────────────────────────

test('ROOMS-1: biggestPot is the largest live pot in that room, per room', () => {
  const rooms = byId(roomsSnapshot([
    table({ tableId: 't1', bigBlind: 20, pot: 400 }),
    table({ tableId: 't2', bigBlind: 20, pot: 2600 }),
    table({ tableId: 't3', bigBlind: 20, pot: 900 }),
    table({ tableId: 't4', bigBlind: 50, pot: 1200 }),
  ]));

  assert.deepEqual(rooms.floor.biggestPot, { tableId: 't2', pot: 2600 });
  assert.deepEqual(rooms.upstairs.biggestPot, { tableId: 't4', pot: 1200 },
    'a bigger pot downstairs does not travel up — the room is the unit');
  assert.equal(rooms.backroom.biggestPot, null);
});

test('ROOMS-1: no hand in the air means no pot, not a zero-chip pot', () => {
  // The engine zeroes game.pot the moment a hand is awarded, so a table
  // between hands reports nothing rather than the last hand's ghost.
  const rooms = byId(roomsSnapshot([
    table({ tableId: 't1', bigBlind: 20, seated: 3, pot: 0 }),
  ]));
  assert.equal(rooms.floor.tables, 1, 'the table is still on the floor');
  assert.equal(rooms.floor.biggestPot, null, 'there is just nothing in the middle');
});

// ── hot ─────────────────────────────────────────────────────────────────────

test('ROOMS-1: hot is the tables that fired a hot event inside the window', () => {
  const t0 = Date.now();
  emitCasinoEvent({ type: EventType.HOT, tableId: 't1', headline: '40bb on the river', pot: 800 });

  const tables = [table({ tableId: 't1', bigBlind: 20 }), table({ tableId: 't2', bigBlind: 20 })];

  const fresh = byId(roomsSnapshot(tables, { now: t0 + 5_000 }));
  assert.deepEqual(fresh.floor.hot, ['t1'], 'five seconds later there is still time to walk over');

  const stale = byId(roomsSnapshot(tables, { now: t0 + HOT_RECENT_MS + 1_000 }));
  assert.deepEqual(stale.floor.hot, [], 'past the window it is a newspaper, not a ticker');
});

test('ROOMS-1: only `hot` flags a room, and only for a table still on the floor', () => {
  emitCasinoEvent({ type: EventType.BIG_POT, tableId: 't1', headline: 'a big finished pot', pot: 4000 });
  emitCasinoEvent({ type: EventType.HOT, tableId: 'gone', headline: 'at a table since closed', pot: 900 });
  emitCasinoEvent({ type: EventType.HOT, tableId: 't9', headline: 'upstairs', pot: 5000 });

  const rooms = byId(roomsSnapshot([
    table({ tableId: 't1', bigBlind: 20 }),
    table({ tableId: 't9', bigBlind: 50 }),
  ]));

  assert.deepEqual(rooms.floor.hot, [], 'a finished pot is history; hot is the one with a deadline');
  assert.deepEqual(rooms.upstairs.hot, ['t9'], 'and it lands in the room that table runs in');
  assert.ok(!JSON.stringify(rooms).includes('"gone"'),
    'a hot table that has since closed is not on the floor to point at');
});

test('ROOMS-1: hotTableIds dedupes and reads newest first', () => {
  const t0 = Date.now();
  emitCasinoEvent({ type: EventType.HOT, tableId: 't1', headline: 'one' });
  emitCasinoEvent({ type: EventType.HOT, tableId: 't1', headline: 'again' });
  emitCasinoEvent({ type: EventType.HOT, tableId: 't2', headline: 'two' });

  assert.deepEqual(hotTableIds({ now: t0 + 1_000 }), ['t2', 't1'],
    'the question is which tables, not how often');
  assert.deepEqual(hotTableIds({ windowMs: 1, now: t0 + 60_000 }), [],
    'and the window is a real cutoff');
});

test('ROOMS-1: the hot list is sorted, so an unchanged floor produces an unchanged payload', () => {
  emitCasinoEvent({ type: EventType.HOT, tableId: 't2', headline: 'second' });
  emitCasinoEvent({ type: EventType.HOT, tableId: 't1', headline: 'first' });
  const rooms = byId(roomsSnapshot([
    table({ tableId: 't1', bigBlind: 20 }),
    table({ tableId: 't2', bigBlind: 20 }),
  ]));
  assert.deepEqual(rooms.floor.hot, ['t1', 't2'],
    'floorChannel pushes on change, and a set that reshuffles would read as a change');
});

// ── The injected provider ───────────────────────────────────────────────────

test('ROOMS-1: currentRooms reads the configured registry, and survives not having one', () => {
  assert.equal(currentRooms()[0].tables, 0, 'no provider is an empty floor, not a crash');
  configure({ liveTables: { listTables: () => [table({ tableId: 't1', bigBlind: 20, seated: 4 })] } });
  const rooms = byId(currentRooms());
  assert.equal(rooms.floor.tables, 1);
  assert.equal(rooms.floor.seated, 4);
});

// ── GET /api/rooms ──────────────────────────────────────────────────────────

let server;
after(() => server?.close());

test('ROOMS-1: GET /api/rooms serves the floor, uncached', async () => {
  const app = express();
  app.use(express.json());
  installRoomRoutes(app, {
    liveTables: [
      table({ tableId: 't1', bigBlind: 20, seated: 6, pot: 1800 }),
      table({ tableId: 't2', bigBlind: 100, seated: 2 }),
    ],
  });
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  emitCasinoEvent({ type: EventType.HOT, tableId: 't1', headline: 'live one', pot: 1800 });

  const res = await fetch(`${base}/api/rooms`);
  assert.equal(res.headers.get('cache-control'), 'no-store', 'a live floor is never cached');
  const body = await res.json();

  assert.equal(body.hotWindowMs, HOT_RECENT_MS, 'the client is told how long a hot flag lasts');
  const rooms = byId(body.rooms);
  assert.deepEqual(rooms.floor.stakes, { smallBlind: 10, bigBlind: 20, buyIn: 2000, label: '$10/$20' });
  assert.equal(rooms.floor.tables, 1);
  assert.equal(rooms.floor.seated, 6);
  assert.deepEqual(rooms.floor.hot, ['t1']);
  assert.deepEqual(rooms.floor.biggestPot, { tableId: 't1', pot: 1800 });
  assert.equal(rooms.backroom.tables, 1);
  assert.equal(rooms.backroom.biggestPot, null);
});

// ── The floor channel ───────────────────────────────────────────────────────

const mkWs = () => ({ readyState: 1, OPEN: 1, sent: [], send(p) { this.sent.push(JSON.parse(p)); } });
const roomMsgs = (ws) => ws.sent.filter((m) => m.type === ServerMsg.FLOOR_ROOMS);

test('ROOMS-1: FLOOR_STATE carries the floor, so a fresh subscriber has a lobby at once', () => {
  const live = [table({ tableId: 't1', bigBlind: 50, seated: 3 })];
  configure({ liveTables: { listTables: () => live } });
  floor.configure({ liveTables: null });
  const ws = mkWs();
  try {
    floor.subscribe(ws, { userId: 'owner-a', owner: true });
    const state = ws.sent.find((m) => m.type === ServerMsg.FLOOR_STATE);
    assert.ok(state, 'the snapshot still arrives');
    assert.equal(state.rooms.length, ROOMS.length);
    assert.equal(byId(state.rooms).upstairs.seated, 3, 'with the floor already on it');
  } finally {
    floor.reset();
  }
});

test('ROOMS-1: a table state change pushes FLOOR_ROOMS, and an unchanged floor is silent', () => {
  const live = [table({ tableId: 't1', bigBlind: 20, seated: 2 })];
  configure({ liveTables: { listTables: () => live } });
  floor.configure({ liveTables: null });
  const ws = mkWs();
  try {
    floor.subscribe(ws, { userId: 'owner-a', owner: true });
    assert.equal(roomMsgs(ws).length, 0, 'the snapshot already carried it');

    live.push(table({ tableId: 't2', bigBlind: 20, seated: 4 }));
    floor.notifyTable(live[0]);
    assert.equal(roomMsgs(ws).length, 1, 'a seat filling somewhere moves the floor');
    assert.equal(byId(roomMsgs(ws)[0].rooms).floor.seated, 6);

    floor.notifyTable(live[0]);
    floor.notifyTable(live[0]);
    assert.equal(roomMsgs(ws).length, 1, 'a floor that did not change is not news');
  } finally {
    floor.reset();
  }
});

test('ROOMS-1: pushes are throttled, and the last state of a busy floor still lands', async () => {
  const live = [table({ tableId: 't1', bigBlind: 20, seated: 2, pot: 100 })];
  configure({ liveTables: { listTables: () => live } });
  floor.configure({ liveTables: null });
  const ws = mkWs();
  try {
    floor.subscribe(ws, { userId: 'owner-a', owner: true });
    live[0] = table({ tableId: 't1', bigBlind: 20, seated: 2, pot: 200 });
    floor.notifyTable(live[0]);
    assert.equal(roomMsgs(ws).length, 1);

    // A busy table changes the pot on every action. None of these may go out
    // on their own, and the last one must not be lost.
    for (const pot of [300, 400, 500]) {
      live[0] = table({ tableId: 't1', bigBlind: 20, seated: 2, pot });
      floor.notifyTable(live[0]);
    }
    assert.equal(roomMsgs(ws).length, 1, 'held inside the window');

    await sleep(ROOMS_INTERVAL_MS * 4);
    const pushed = roomMsgs(ws);
    assert.equal(pushed.length, 2, 'one trailing push, not four');
    assert.deepEqual(byId(pushed[1].rooms).floor.biggestPot, { tableId: 't1', pot: 500 },
      'and it is the state the floor is actually in now');
  } finally {
    floor.reset();
  }
});

test('ROOMS-1: a hot event repaints the floor without waiting for a hand to move', () => {
  const live = [table({ tableId: 't1', bigBlind: 20, seated: 2 })];
  configure({ liveTables: { listTables: () => live } });
  floor.configure({ liveTables: null });
  const ws = mkWs();
  try {
    floor.subscribe(ws, { userId: 'owner-a', owner: true });
    emitCasinoEvent({ type: EventType.HOT, tableId: 't1', headline: 'river, two live', pot: 900 });

    const pushed = roomMsgs(ws);
    assert.equal(pushed.length, 1, 'the room lights up on the event itself');
    assert.deepEqual(byId(pushed[0].rooms).floor.hot, ['t1']);
  } finally {
    floor.reset();
  }
});

test('ROOMS-1: nobody subscribed means nothing computed and nothing sent', () => {
  configure({ liveTables: { listTables: () => { throw new Error('should not be asked'); } } });
  floor.configure({ liveTables: null });
  assert.equal(floor.broadcastRooms(), 0, 'the floor is only assembled for someone who is looking');
});
