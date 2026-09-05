// src/server/rooms.js — ROOMS-1
//
// The casino has floors, and a floor is a stakes tier.
//
//   $10/$20   the floor      — where everybody starts
//   $25/$50   upstairs       — where the pocket has to have earned it
//   $50/$100  the back room  — where it means something
//
// This is the lobby's spine. A flat list of tables answers "what is running";
// it does not answer the question a person actually walks in with, which is
// "where should I be looking right now". Rooms answer that, because a room is
// a small enough unit to describe in one line — how many tables, how many
// seats filled, which of them are on fire, and the biggest pot in the air.
//
// Three things the shape comes from:
//
//   1. THE LADDER IS wallet.js's LADDER. The rooms are derived from STAKES,
//      not listed again here, because the rung an agent's pocket can buy into
//      IS the room he can walk into. One ladder, two readings of it — if a
//      rung is ever added or retuned, the floor gains or retunes a room on the
//      same commit, with nothing to keep in sync by hand.
//   2. A ROOM ALWAYS EXISTS. An empty back room reports zeroes; it does not
//      disappear from the response. A lobby whose rooms come and go cannot be
//      rendered as a stable list, and "the back room is quiet tonight" is
//      itself worth saying.
//   3. NOTHING HERE KNOWS ABOUT A TABLE. Same law as floorChannel: tables
//      arrive as an injected iterable, and this module reads five public
//      fields off each one (tableId, bigBlind, closed, seatedCount(), game.pot).
//      That is what lets the whole thing be tested with object literals.
//
// `hot` is the one field with a clock on it. It is the tableIds that fired a
// `hot` event (a big pot reaching the river with two or more players still
// live) inside the last HOT_RECENT_MS — a deliberately short window, because
// the entire value of the flag is that there is still time to go and watch.

import { STAKES } from './wallet.js';
import { hotTableIds, HOT_RECENT_MS } from './events.js';

export { HOT_RECENT_MS };

// The house names, by rung. A deployment that adds a fourth rung to the ladder
// gets a room for it named after its stakes until somebody names it properly.
const ROOM_IDS = ['floor', 'upstairs', 'backroom'];
const ROOM_NAMES = ['the floor', 'upstairs', 'the back room'];

export const ROOMS = Object.freeze(STAKES.map((s, i) => Object.freeze({
  id: ROOM_IDS[i] ?? `rung-${s.rung}`,
  name: ROOM_NAMES[i] ?? s.label,
  rung: s.rung,
  stakes: Object.freeze({
    smallBlind: s.smallBlind,
    bigBlind: s.bigBlind,
    buyIn: s.buyIn,
    label: s.label,
  }),
})));

// ── The snapshot ────────────────────────────────────────────────────────────

/**
 * One line per room, in ladder order, lowest stakes first.
 *
 * @param {Iterable} tables  live Tables (or anything with the five fields)
 * @param {object}   opts
 * @param {number}   opts.now          clock, for tests
 * @param {number}   opts.hotWindowMs  how recent a `hot` event still counts
 * @param {string[]} opts.hotIds       override the event ring (tests)
 * @returns {Array<{ id, name, rung, stakes, tables, seated, hot, biggestPot }>}
 */
export function roomsSnapshot(tables, { now = Date.now(), hotWindowMs = HOT_RECENT_MS, hotIds = null } = {}) {
  const hot = new Set(hotIds ?? hotTableIds({ windowMs: hotWindowMs, now }));

  const rooms = ROOMS.map((room) => ({
    ...room,
    tables: 0,
    seated: 0,
    hot: [],
    biggestPot: null,
  }));
  const byBigBlind = new Map(rooms.map((room) => [room.stakes.bigBlind, room]));

  for (const table of tables ?? []) {
    if (!table || table.closed) continue;
    // A table at blinds no rung runs (a bespoke heads-up game somebody stood
    // up over the socket) is not on the floor. It is still a real table and
    // still reachable by id — it just is not in a room, because a room is a
    // stakes tier and it belongs to none of them.
    const room = byBigBlind.get(Number(table.bigBlind));
    if (!room) continue;

    room.tables++;
    room.seated += seatedIn(table);
    const tableId = table.tableId == null ? null : String(table.tableId);
    if (tableId && hot.has(tableId)) room.hot.push(tableId);

    // `game.pot` is the pot in the air: the engine zeroes it the moment a hand
    // is awarded, so this is live money only and never the last hand's ghost.
    const pot = livePot(table);
    if (tableId && pot > 0 && (room.biggestPot === null || pot > room.biggestPot.pot)) {
      room.biggestPot = { tableId, pot };
    }
  }

  // Sorted so the payload is byte-stable for a given floor: floorChannel
  // pushes only on change, and a set that reshuffles is a change.
  for (const room of rooms) room.hot.sort();
  return rooms;
}

function seatedIn(table) {
  const n = Number(table.seatedCount?.() ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function livePot(table) {
  const pot = Number(table.game?.pot);
  return Number.isFinite(pot) && pot > 0 ? Math.round(pot) : 0;
}

// ── Wiring ──────────────────────────────────────────────────────────────────
//
// Injected by createServer(), the composition root, exactly like floorChannel.
// The REST route and the floor push both read the floor through it.

let liveTables = null;

export function configure({ liveTables: provider } = {}) {
  liveTables = provider ?? null;
}

function tablesFrom(provider) {
  const source = provider ?? liveTables;
  if (!source) return [];
  if (typeof source.listTables === 'function') return source.listTables();
  return Array.isArray(source) ? source : [];
}

/** The snapshot of whatever is running right now. */
export function currentRooms({ liveTables: provider = null, ...opts } = {}) {
  return roomsSnapshot(tablesFrom(provider), opts);
}

// ── REST ────────────────────────────────────────────────────────────────────

/**
 * GET /api/rooms — the floor, by stakes tier.
 *
 * Public, like the ticker: counts and headlines, nothing owner-scoped. It sits
 * under /api so index.js's rate limiter covers it, and it triggers no model
 * call, so there is nothing here to spend.
 */
export function installRoomRoutes(app, { liveTables: provider = null } = {}) {
  app.get('/api/rooms', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ rooms: currentRooms({ liveTables: provider }), hotWindowMs: HOT_RECENT_MS });
  });
}
