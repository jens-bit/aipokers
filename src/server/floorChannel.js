// src/server/floorChannel.js — AGE-38
// The casino floor's live wire.
//
// A connection sends FLOOR_SUB with its userId and gets, immediately, one
// FLOOR_STATE describing every agent that owner has (presence, mood, last
// moment) plus a FLOOR_GAME for each table of theirs that is currently live.
// After that the server pushes FLOOR_GAME whenever a table's visible state
// changes, and a fresh FLOOR_STATE whenever an agent's standing changes
// (deployed, retired, recap written).
//
// Two rules the rest of the system also obeys:
//   * Pushes are throttled to at most one per second per table per
//     subscriber, with a trailing send so the last state of a hand is never
//     dropped.
//   * heroHole travels only to a subscriber that proved ownership in
//     FLOOR_SUB. Same law as AGE-33 / AGE-37.
//
// This module is wired by createServer(); it reaches the table registry
// through an injected provider so nothing here imports table.js.

import { ServerMsg } from './protocol.js';
import { floorSnapshot } from './agentProfiles.js';

// One push per table per second, per subscriber.
const PUSH_INTERVAL_MS = Number(process.env.FLOOR_PUSH_INTERVAL_MS ?? 1000);

// ws -> { userId, owner, tables: Map<tableId, { lastPushAt, lastSignature, timer, pendingTable }> }
const subs = new Map();

let liveTables = null;

export function configure({ liveTables: provider } = {}) {
  liveTables = provider ?? null;
}

export function subscriberCount() {
  return subs.size;
}

function send(ws, msg) {
  if (!ws || ws.readyState !== ws.OPEN) return false;
  ws.send(JSON.stringify(msg));
  return true;
}

// ── Subscribe / unsubscribe ─────────────────────────────────────────────────

export function subscribe(ws, { userId, owner = false } = {}) {
  if (!userId) throw new Error('userId required');
  unsubscribe(ws);
  const entry = { userId: String(userId), owner: !!owner, tables: new Map() };
  subs.set(ws, entry);
  sendFloorState(ws, entry);
  // Prime the diorama with whatever is already in flight, so a client that
  // subscribes mid-hand does not wait for the next state change.
  for (const table of liveTables?.listTables?.() ?? []) {
    if (tableBelongsTo(table, entry.userId)) pushGame(ws, entry, table, { force: true });
  }
  return entry;
}

export function unsubscribe(ws) {
  const entry = subs.get(ws);
  if (!entry) return false;
  for (const state of entry.tables.values()) {
    if (state.timer) clearTimeout(state.timer);
  }
  subs.delete(ws);
  return true;
}

// ── Outbound ────────────────────────────────────────────────────────────────

function sendFloorState(ws, entry) {
  let agents = [];
  try {
    agents = floorSnapshot(entry.userId, { owner: entry.owner });
  } catch (err) {
    console.error('[floor] snapshot failed:', err.message);
    return;
  }
  send(ws, { type: ServerMsg.FLOOR_STATE, userId: entry.userId, agents });
}

// An agent standing changed for this owner (deployed, retired, recap
// written) — refresh every subscriber watching that owner's floor.
export function notifyAgentsChanged(userId) {
  if (!userId) return;
  const target = String(userId);
  for (const [ws, entry] of subs) {
    if (entry.userId !== target) continue;
    sendFloorState(ws, entry);
  }
}

// A table's visible state changed. Called for every table state change, so it
// must stay cheap when nobody is subscribed.
export function notifyTable(table) {
  if (subs.size === 0 || !table) return;
  for (const [ws, entry] of subs) {
    if (!tableBelongsTo(table, entry.userId)) continue;
    pushGame(ws, entry, table);
  }
}

function tableBelongsTo(table, userId) {
  return (table.agentUserIds ?? []).some((id) => id != null && String(id) === userId);
}

// The agentId this owner has seated at the table (their POV on it).
function heroAgentIdFor(table, userId) {
  for (let seat = 0; seat < (table.agentIds?.length ?? 0); seat++) {
    if (table.agentIds[seat] && String(table.agentUserIds[seat]) === userId) {
      return table.agentIds[seat];
    }
  }
  return null;
}

function buildGameMessage(table, entry) {
  const agentId = heroAgentIdFor(table, entry.userId);
  if (!agentId) return null;
  const view = table.liveGameView(agentId, { includeHole: entry.owner });
  if (!view) return null;
  return {
    type: ServerMsg.FLOOR_GAME,
    tableId: view.tableId,
    agentId,
    street: view.street,
    board: view.board,
    heroHole: view.heroHole,
    pot: view.pot,
    toAct: view.toAct,
    actionDeadline: view.actionDeadline,
    handNumber: view.handNumber,
  };
}

// Throttled, change-gated push. Identical payloads are dropped; a payload
// arriving inside the throttle window is held and sent on the trailing edge
// so the last state of a hand always lands.
function pushGame(ws, entry, table, { force = false } = {}) {
  const msg = buildGameMessage(table, entry);
  if (!msg) return;
  const tableId = table.tableId;
  let state = entry.tables.get(tableId);
  if (!state) {
    state = { lastPushAt: 0, lastSignature: null, timer: null, pendingTable: null };
    entry.tables.set(tableId, state);
  }

  const signature = JSON.stringify(msg);
  if (!force && signature === state.lastSignature) return;

  const now = Date.now();
  const wait = state.lastPushAt + PUSH_INTERVAL_MS - now;
  if (!force && wait > 0) {
    state.pendingTable = table;
    if (!state.timer) {
      state.timer = setTimeout(() => {
        state.timer = null;
        const pending = state.pendingTable;
        state.pendingTable = null;
        if (!pending || !subs.has(ws)) return;
        pushGame(ws, entry, pending, { force: false });
      }, wait);
      state.timer.unref?.();
    }
    return;
  }

  if (!send(ws, msg)) return;
  state.lastPushAt = Date.now();
  state.lastSignature = signature;
}

// Test helper — drop every subscription and its pending timers.
export function reset() {
  for (const ws of [...subs.keys()]) unsubscribe(ws);
  liveTables = null;
}
