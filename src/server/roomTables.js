// src/server/roomTables.js — CASINO-2 job 1
//
// WHAT IS ACTUALLY RUNNING IN A ROOM.
//
// ROOMS-1 answers "where should I be looking right now" at the scale of the
// building: three rooms, a count each, the biggest pot in the air. That is the
// right unit for a doorway and the wrong unit for everything you do after you
// walk through one. Once you are inside a room the question is no longer which
// room — it is WHICH FELT, and a count cannot answer that.
//
// So this is the room opened up: one entry per live table in it, each carrying
// enough to draw a miniature of the actual game. The client had been guessing
// at this list (see the header of RoomTablesSheet.jsx, which assembles one out
// of hot ids, your own agents' tables and the ticker, and says out loud how
// many it could not name). It guessed well and it was still a guess — a room
// with eight tables in it showed three, and the other five existed only as a
// sentence apologising for them.
//
// FOUR THINGS THE SHAPE COMES FROM
//
//   1. THE TABLE PROJECTS ITSELF. Every felt here is Table.feltView() — the
//      public, no-cards view of one table, which lives on the Table because
//      the Table owns its seats. Nothing in this file reads `pending`,
//      `aiSeats` or a Game's seat array. Two readings of the same seats are
//      two readings that eventually disagree.
//   2. THE ROOM IS THE BLINDS, exactly as in rooms.js: roomForBigBlind is the
//      one definition, so a table is in the room its big blind puts it in and
//      a bespoke heads-up game somebody stood up over the socket is in none.
//      A home game is not on the floor at all and never reaches this module.
//   3. SNAPSHOTS ONLY. Nothing here calls a model, reads a thread, or touches
//      a wallet. It is the same class of payload as ROOMS-1: public, cheap,
//      and safe to fan out to every subscriber unfiltered — because there is
//      nothing on it a person standing in the doorway could not see.
//   4. THE TABLE→ROOM MAP IS THE OTHER HALF OF THE ANSWER. ROOMS-1 names table
//      ids in `hot` and `biggestPot` and never says which room they are in, so
//      the client reverse-engineers it (useCasinoRooms.roomForTable can only
//      answer for tables the payload happened to name). `tableRoomMap` is that
//      map, stated rather than inferred, and it rides the same payload.
//
// RANKING: how loudly a felt is asking for you. Hot first, then by the money
// in the middle, then the ones with anybody at them, then the empty chairs.
// The same order the doorway list used, now over the whole room.

import { ROOMS, roomForBigBlind } from './rooms.js';
import { hotTableIds, HOT_RECENT_MS } from './events.js';

export { HOT_RECENT_MS };

/** The room a felt is in, by its blinds. Null for a table on no rung. */
function roomIdFor(felt) {
  return roomForBigBlind(felt?.bigBlind)?.id ?? null;
}

/**
 * One table's public felt, with its room stamped on it.
 *
 * A table that cannot project itself (a plain literal in a unit test that
 * predates feltView, or a table mid-teardown) contributes nothing rather than
 * a half-drawn felt: a miniature with no seats and no board is worse than no
 * miniature, because it reads as an empty room rather than as a missing one.
 */
export function feltFor(table, { hot = null } = {}) {
  if (!table || table.closed || table.home) return null;
  let felt = null;
  try {
    felt = table.feltView?.() ?? null;
  } catch (err) {
    console.error('[rooms] felt view failed:', err.message);
    return null;
  }
  if (!felt || felt.tableId == null) return null;
  const tableId = String(felt.tableId);
  return {
    ...felt,
    tableId,
    room: roomIdFor(felt),
    // The `hot` flag Table.feltView reads is the same event window this one
    // is, but an explicit set (the caller's, for a whole snapshot) is read
    // once for every table instead of once per table.
    hot: hot ? hot.has(tableId) : !!felt.hot,
  };
}

// How loudly a felt is asking for you. Lower sorts first.
function rank(felt) {
  if (felt.hot) return 0;
  if (felt.pot > 0) return 1;
  if (felt.seated > 0) return 2;
  return 3;
}

/**
 * Every live floor table, newest information first, each stamped with its room.
 *
 * @param {Iterable} tables  live Tables (anything with feltView/closed/home)
 * @param {object}   opts
 * @param {string}   opts.room         only this room id; null for the floor
 * @param {number}   opts.now          clock, for tests
 * @param {number}   opts.hotWindowMs  how recent a `hot` event still counts
 * @param {string[]} opts.hotIds       override the event ring (tests)
 */
export function roomTablesSnapshot(tables, {
  room = null, now = Date.now(), hotWindowMs = HOT_RECENT_MS, hotIds = null,
} = {}) {
  const hot = new Set((hotIds ?? hotTableIds({ windowMs: hotWindowMs, now })).map(String));
  const felts = [];
  for (const table of tables ?? []) {
    const felt = feltFor(table, { hot });
    if (!felt) continue;
    // A table on no rung is in no room, so it is on nobody's floor — the same
    // exclusion roomsSnapshot makes, for the same reason.
    if (!felt.room) continue;
    if (room && felt.room !== room) continue;
    felts.push(felt);
  }
  // Stable for a given floor, so the push can be change-gated on the payload:
  // a set that reshuffles is a change, and a lobby that reshuffles on its own
  // is a lobby you cannot tap.
  felts.sort((a, b) => rank(a) - rank(b) || b.pot - a.pot || a.tableId.localeCompare(b.tableId));
  return felts;
}

/**
 * { [tableId]: roomId } — the map ROOMS-1 does not send.
 *
 * Built from the same snapshot rather than from a second walk of the tables,
 * so the map and the felts can never name different rooms for one table.
 */
export function tableRoomMap(felts) {
  const map = {};
  for (const felt of felts ?? []) {
    if (felt?.tableId != null && felt.room) map[String(felt.tableId)] = felt.room;
  }
  return map;
}

// ── Wiring ──────────────────────────────────────────────────────────────────
//
// Injected by createServer(), the composition root, exactly like rooms.js and
// floorChannel. Nothing here imports table.js or tableRegistry.js.

let liveTables = null;

export function configure({ liveTables: provider } = {}) {
  liveTables = provider ?? null;
}

function tablesFrom(provider) {
  const source = provider ?? liveTables;
  if (!source) return [];
  // The floor, not the building: a home game is reachable by id and is on
  // nobody's lobby. Same call floorChannel makes, for the same reason.
  if (typeof source.listFloorTables === 'function') return source.listFloorTables();
  if (typeof source.listTables === 'function') return source.listTables();
  return Array.isArray(source) ? source : [];
}

/** The felts running right now, optionally in one room. */
export function currentRoomTables({ liveTables: provider = null, ...opts } = {}) {
  return roomTablesSnapshot(tablesFrom(provider), opts);
}

// ── REST ────────────────────────────────────────────────────────────────────

/**
 * GET /api/rooms/:id/tables — the felts in one room.
 *
 * Public, like GET /api/rooms and GET /api/events: seats, board, pot, whose
 * turn it is. Nobody's hole cards, nobody's reasoning. It sits under /api so
 * index.js's rate limiter covers it, and it triggers no model call, so there
 * is nothing here to spend.
 *
 * An unknown room id is a 404 and not an empty list: an empty list is a real
 * answer ("the back room is quiet tonight") and must not also be the answer to
 * a typo.
 */
export function installRoomTableRoutes(app, { liveTables: provider = null } = {}) {
  app.get('/api/rooms/:id/tables', (req, res) => {
    const room = ROOMS.find((r) => r.id === req.params.id);
    res.setHeader('Cache-Control', 'no-store');
    if (!room) {
      res.status(404).json({ error: 'no such room', rooms: ROOMS.map((r) => r.id) });
      return;
    }
    const tables = currentRoomTables({ liveTables: provider, room: room.id });
    res.json({ room: room.id, stakes: room.stakes, tables, hotWindowMs: HOT_RECENT_MS });
  });
}
