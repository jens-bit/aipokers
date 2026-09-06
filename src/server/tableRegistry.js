// src/server/tableRegistry.js
// Single owner of the live Table instances.
//
// Before AGE-35 the Map lived inside createServer()'s closure, which meant a
// table could only come into existence when a WebSocket client asked for one.
// The REST layer now needs to stand tables up too (POST /deploy starts an
// autonomous session with no client attached), so the Map moved here.
//
// This module deliberately imports nothing but Table — agentProfiles reaches
// it through an injected provider (see setLiveTableProvider) so the import
// graph stays acyclic.

import { Table, MAX_SEATS } from './table.js';
import { pickTableToJoin } from './matchmaking.js';

const tables = new Map(); // tableId -> Table

let defaultBlinds = { smallBlind: 10, bigBlind: 20 };

// AGE-38: invoked with the Table whenever its visible state changes. Set by
// createServer() to feed the floor channel; null in bare unit contexts.
let stateHook = null;

export function setStateHook(fn) {
  stateHook = typeof fn === 'function' ? fn : null;
}

// Global cap on autonomous (server-driven) tables. Each one burns LLM tokens
// on every decision with nobody necessarily watching, so the ceiling is the
// cost bound for the whole floor.
export const MAX_CONCURRENT_TABLES = Number(process.env.MAX_CONCURRENT_TABLES ?? 10);

export function setDefaultBlinds(blinds) {
  if (Number.isFinite(blinds?.smallBlind) && Number.isFinite(blinds?.bigBlind)) {
    defaultBlinds = { smallBlind: blinds.smallBlind, bigBlind: blinds.bigBlind };
  }
}

export function getDefaultBlinds() {
  return { ...defaultBlinds };
}

export function getTable(tableId) {
  return tables.get(tableId) ?? null;
}

export function hasTable(tableId) {
  return tables.has(tableId);
}

export function listTables() {
  return [...tables.values()];
}

// The live Map itself — createServer returns it for callers (index.js
// /api/stats) that iterate tables directly.
export function allTables() {
  return tables;
}

export function tableCount() {
  return tables.size;
}

// Number of tables currently running the autonomous session loop. This is the
// figure MAX_CONCURRENT_TABLES is checked against — client-driven vs-human
// tables cost nothing while idle and are not counted.
export function countAutonomousTables() {
  let n = 0;
  // HOME-STATE-1: a home game is autonomous but it is not on the floor, so it
  // is not counted against the floor's ceiling. If it were, two agents playing
  // cards in their own living room could take the last table on the casino's
  // budget and refuse a real deploy — the home is meant to be where they go
  // when the casino is not an option, not a competitor for it. Its own cost is
  // bounded separately: a slower deal pause, a hand cap, and it only runs while
  // two of them are actually home.
  for (const table of tables.values()) if (table.autoPlay && !table.home) n++;
  return n;
}

// Every table that is not a home game — the casino floor. This is what the
// floor channel and the lobby iterate: a home table is reachable by id (that
// is how WATCH works on it) and invisible to everything that describes the
// floor.
export function listFloorTables() {
  return [...tables.values()].filter((t) => !t.home);
}

// BUGS-B/6: who is actually ON THE FLOOR right now.
//
// The header pill says "N agents live", and the only honest source for that
// number is the seats themselves — not how many sockets are open (a watcher is
// not a player, and one owner with two devices is not two agents), and not how
// many agents exist (a roster is not a floor).
//
// Deduped by agent id, because an agent holds exactly one seat and a seat that
// is being reconciled must never count twice. A home game is somebody's living
// room, so it is not the casino and is not counted — the same line
// listFloorTables and countAutonomousTables already draw.
export function seatedAgentIds() {
  const ids = new Set();
  for (const table of tables.values()) {
    if (table.home || table.closed) continue;
    for (let seat = 0; seat < table.maxSeats; seat++) {
      // The seat, not the array slot: agentIds is cleared when a seat stands
      // up, but `pending` is the field every other count in this codebase
      // asks, so it is the one asked here too.
      if (!table.pending?.[seat]) continue;
      const agentId = table.agentIds?.[seat];
      if (agentId) ids.add(String(agentId));
    }
  }
  return ids;
}

// The figure itself. Always a number — never null, never undefined — because a
// client that receives no number has nothing to print but a dash.
export function seatedAgentCount() {
  return seatedAgentIds().size;
}

// Casino tables with a hand actually in progress. Home games excluded for the
// same reason.
export function activeFloorTableCount() {
  let n = 0;
  for (const table of tables.values()) {
    if (table.home || table.closed) continue;
    if (table.game !== null) n++;
  }
  return n;
}

// HOME-STATE-1: the home game this agent is sitting in right now, or null.
// Asked by presentAgent, which needs it to answer "what is he doing" — a man
// with cards in his hands is not pacing. Walks the table map rather than
// reading a flag off the agent record on purpose: the home game is not a
// session, nothing writes activeTableId for it, and the live table is the only
// witness (BUG-16's law, applied to the living room).
export function homeTableOf(agentId) {
  if (!agentId) return null;
  for (const table of tables.values()) {
    if (!table.home || table.closed) continue;
    if (table.agentIds.includes(agentId)) return table;
  }
  return null;
}

// AGE-37: the floor's view of one agent's live table, or null when the loop
// is not actually advancing hands there. `includeHole` must only be true for
// a caller proven to own the seat.
export function getLiveGame(tableId, { agentId, includeHole = false } = {}) {
  const table = tables.get(tableId);
  if (!table) return null;
  return table.liveGameView(agentId, { includeHole });
}

// MST-2: the best open AI-only table for a deploying agent, or null when it
// should get a fresh table of its own. Returns { table, score, seated }.
// MATCH-1: userId now DISQUALIFIES any table already holding one of that
// owner's agents, and `room` (a rooms.js room id) keeps the replacement on the
// same floor rather than wherever the action happens to be.
export function findJoinableTable({ profile = null, agentId = null, userId = null, room = null } = {}) {
  return pickTableToJoin(tables.values(), { profile, agentId, userId, room });
}

export function getOrCreateTable(tableId, opts = {}) {
  const existing = tables.get(tableId);
  if (existing) return existing;
  const table = new Table({
    tableId,
    smallBlind: opts.smallBlind ?? defaultBlinds.smallBlind,
    bigBlind: opts.bigBlind ?? defaultBlinds.bigBlind,
    maxSeats: opts.maxSeats ?? MAX_SEATS,
    // HOME-STATE-1: set once, at creation, and never afterwards. Whether a
    // table is a home game decides what may not happen at it, and that is not
    // a thing a later caller should be able to flip.
    home: opts.home === true,
    onEmpty: (id) => { tables.delete(id); },
    onStateChange: (t) => stateHook?.(t),
  });
  tables.set(tableId, table);
  return table;
}

// Test/shutdown helper: close every table and empty the Map. Used by the E2E
// harness so a script can exit without leaving hand timers pending.
export function resetRegistry(reason = 'server shutting down') {
  for (const table of [...tables.values()]) {
    try { table.closeTable(reason, { recap: 'the room closed for the night' }); }
    catch { /* best effort */ }
  }
  tables.clear();
}
