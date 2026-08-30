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

import { Table } from './table.js';

const tables = new Map(); // tableId -> Table

let defaultBlinds = { smallBlind: 10, bigBlind: 20 };

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
  for (const table of tables.values()) if (table.autoPlay) n++;
  return n;
}

// AGE-37: the floor's view of one agent's live table, or null when the loop
// is not actually advancing hands there. `includeHole` must only be true for
// a caller proven to own the seat.
export function getLiveGame(tableId, { agentId, includeHole = false } = {}) {
  const table = tables.get(tableId);
  if (!table) return null;
  return table.liveGameView(agentId, { includeHole });
}

export function getOrCreateTable(tableId, opts = {}) {
  const existing = tables.get(tableId);
  if (existing) return existing;
  const table = new Table({
    tableId,
    smallBlind: opts.smallBlind ?? defaultBlinds.smallBlind,
    bigBlind: opts.bigBlind ?? defaultBlinds.bigBlind,
    maxSeats: opts.maxSeats ?? 2,
    onEmpty: (id) => { tables.delete(id); },
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
