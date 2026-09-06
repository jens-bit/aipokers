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
// ROOMS-1 added a third thing on the wire: FLOOR_ROOMS, the floor grouped by
// stakes tier. It is not owner-filtered (it is counts and table ids), it rides
// the first FLOOR_STATE so a fresh subscriber has a lobby immediately, and it
// is pushed on change after that.
//
// SERVER-4 added a fifth and a sixth: THREAD_LINE, one line written into a
// thread of this owner's, and TYPING, the beat before one of his agents
// produces a reply. Both are owner-scoped AND owner-PROVED — see
// broadcastThreadLine.
//
// HOME-STATE-1 added a fourth: HOME_STATE, the owner's living room — where
// each of his agents is, what he is doing there, and the home game if one is
// running. Owner-filtered like FLOOR_STATE and pushed on the same triggers,
// plus one of its own (the home game's composition changing). The home table
// itself is invisible to everything else on this channel: it is at no stakes,
// in no room, and a FLOOR_GAME about it would put a kitchen table on the
// casino floor.
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
import { floorSnapshot, homeSnapshot } from './agentProfiles.js';
import { bus as eventBus, EventType, HOT_RECENT_MS } from './events.js';
import { currentRooms } from './rooms.js';
import { bus as sessionBus, sessionEndMessage } from './sessions.js';

// One push per table per second, per subscriber.
const PUSH_INTERVAL_MS = Number(process.env.FLOOR_PUSH_INTERVAL_MS ?? 1000);

// ROOMS-1: one FLOOR_ROOMS push per second for the whole floor. The rooms
// payload is identical for every subscriber (it is counts, not anybody's
// cards), so unlike FLOOR_GAME the throttle is global rather than per-sub.
const ROOMS_PUSH_INTERVAL_MS = Number(process.env.FLOOR_ROOMS_INTERVAL_MS ?? 1000);

// ws -> { userId, owner, tables: Map<tableId, { lastPushAt, lastSignature, timer, pendingTable }> }
const subs = new Map();

let liveTables = null;
// HOME-STATE-1: how the channel learns what the owner's home game is doing.
// Injected like liveTables so nothing here imports homeGame.js.
let homeGames = null;

// ROOMS-1 push state: the last payload sent (so an unchanged floor is silent),
// when it went, the trailing-edge timer, and the one-shot that fires when the
// oldest `hot` flag ages out with nothing else happening to trigger a push.
let roomsSignature = null;
let roomsLastPushAt = 0;
let roomsTimer = null;
let hotExpiryTimer = null;

export function configure({ liveTables: provider, homeGames: homes } = {}) {
  liveTables = provider ?? null;
  homeGames = homes ?? null;
  // EVENT-1: exactly one listener on the casino bus, no matter how many times
  // a process composes a server (tests build several). off-then-on is
  // idempotent because `relayEvent` is a stable module-level function.
  eventBus.off('event', relayEvent);
  eventBus.on('event', relayEvent);
  // SERVER-3: and exactly one on the sessions bus, for the same reason.
  sessionBus.off('session_end', relaySessionEnd);
  sessionBus.on('session_end', relaySessionEnd);
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
  sendHomeState(ws, entry);
  // Prime the diorama with whatever is already in flight, so a client that
  // subscribes mid-hand does not wait for the next state change.
  for (const table of floorTables()) {
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
  // ROOMS-1: the floor rides the snapshot so a client that has just subscribed
  // can render the lobby immediately, then keeps it current from FLOOR_ROOMS.
  send(ws, { type: ServerMsg.FLOOR_STATE, userId: entry.userId, agents, rooms: roomsPayload() });
}

// HOME-STATE-1: the casino's tables. A home game is reachable by id — that is
// how WATCH works on it — and is on nobody's floor, so it is filtered out of
// everything that describes one. The registry answers this directly when it
// can; the fallback keeps a bare unit context (a plain array of literals)
// working, which is what several of these tests are.
function floorTables() {
  if (liveTables?.listFloorTables) return liveTables.listFloorTables();
  return (liveTables?.listTables?.() ?? []).filter((t) => !t?.home);
}

// ── HOME-STATE-1: the owner's living room ───────────────────────────────────

function sendHomeState(ws, entry) {
  let payload;
  try {
    payload = homeSnapshot(entry.userId, {
      owner: entry.owner,
      game: homeGames?.state?.(entry.userId) ?? null,
    });
  } catch (err) {
    console.error('[floor] home snapshot failed:', err.message);
    return;
  }
  send(ws, { type: ServerMsg.HOME_STATE, ...payload });
}

/**
 * The owner's home changed — somebody came in, somebody went out, a routine
 * moved, the home game was stood up or broken up. Same owner filter as
 * notifyAgentsChanged, and called from the same two places: an agent's
 * standing changing, and homeGame's own reconcile.
 */
export function notifyHomeChanged(userId) {
  if (!userId) return;
  const target = String(userId);
  for (const [ws, entry] of subs) {
    if (entry.userId !== target) continue;
    sendHomeState(ws, entry);
  }
}

// ── ROOMS-1: the floor, by stakes tier ──────────────────────────────────────

function roomsPayload() {
  try {
    return currentRooms();
  } catch (err) {
    console.error('[floor] rooms snapshot failed:', err.message);
    return [];
  }
}

/**
 * Push FLOOR_ROOMS to every subscriber, if it changed. Throttled to one per
 * second with a trailing send, so a busy floor cannot turn every action at
 * every table into a broadcast, and the last state still lands.
 */
export function broadcastRooms({ force = false } = {}) {
  if (subs.size === 0) return 0;
  const rooms = roomsPayload();
  const signature = JSON.stringify(rooms);
  if (!force && signature === roomsSignature) return 0;

  const now = Date.now();
  const wait = roomsLastPushAt + ROOMS_PUSH_INTERVAL_MS - now;
  if (!force && wait > 0) {
    if (!roomsTimer) {
      roomsTimer = setTimeout(() => {
        roomsTimer = null;
        broadcastRooms();
      }, wait);
      roomsTimer.unref?.();
    }
    return 0;
  }

  roomsSignature = signature;
  roomsLastPushAt = now;
  const payload = { type: ServerMsg.FLOOR_ROOMS, rooms };
  let sent = 0;
  for (const ws of subs.keys()) {
    if (send(ws, payload)) sent++;
  }
  return sent;
}

// A `hot` flag expires on a clock rather than on an event, so without this the
// floor could keep pointing at a table that went quiet — the last push said
// hot, and nothing after it changes the payload until something else happens.
function scheduleHotExpiry() {
  if (hotExpiryTimer) clearTimeout(hotExpiryTimer);
  hotExpiryTimer = setTimeout(() => {
    hotExpiryTimer = null;
    broadcastRooms();
  }, HOT_RECENT_MS + 250);
  hotExpiryTimer.unref?.();
}

// EVENT-1: the floor ticker. Unlike FLOOR_STATE and FLOOR_GAME this is NOT
// filtered by owner — an event about somebody else's agent at a table you have
// never seen is the entire reason the ticker exists. It is safe to fan out
// unfiltered because an event carries headlines only; anything private stays
// behind the table's own ownership checks.
export function broadcastEvent(event) {
  if (!event || subs.size === 0) return 0;
  const payload = { type: ServerMsg.EVENT, event };
  let sent = 0;
  for (const ws of subs.keys()) {
    if (send(ws, payload)) sent++;
  }
  return sent;
}

function relayEvent(event) {
  try {
    broadcastEvent(event);
    // ROOMS-1: `hot` is the only event type the rooms payload reads, so it is
    // the only one worth recomputing the floor for. The rest arrive with a
    // table state change anyway, which goes through notifyTable.
    if (event?.type === EventType.HOT) {
      broadcastRooms();
      scheduleHotExpiry();
    }
  } catch (err) {
    console.error('[floor] event relay failed:', err.message);
  }
}

// ── SERVER-3 · session endings on the floor ─────────────────────────────────
//
// Unlike the ticker this IS owner-filtered: a session ending is a fact about
// one man's night, and the numbers on it (his net, his biggest pot) are the
// same numbers FLOOR_GAME would only send to a proven owner. So it goes to the
// subscribers watching that owner's floor and to nobody else.
//
// The table broadcasts the same record to its own sockets. Those are different
// connections in the client -- the felt opens one socket, the floor another --
// so nothing is delivered twice; a client that chose to do both on one socket
// can key on `sessionId`, which is unique per stay.
export function broadcastSessionEnd(record) {
  if (!record || subs.size === 0) return 0;
  const wire = sessionEndMessage(record);
  if (!wire) return 0;
  const owner = record.userId == null ? null : String(record.userId);
  const payload = { type: ServerMsg.SESSION_END, ...wire };
  let sent = 0;
  for (const [ws, entry] of subs) {
    if (owner && entry.userId !== owner) continue;
    if (!owner) continue;   // an ownerless ending has no floor to announce it on
    if (send(ws, payload)) sent++;
  }
  return sent;
}

function relaySessionEnd(record) {
  try {
    broadcastSessionEnd(record);
  } catch (err) {
    console.error('[floor] session end relay failed:', err.message);
  }
}

// ── SERVER-4 · a line was written ───────────────────────────────────────────
//
// Owner-scoped like SESSION_END and, unlike it, owner-PROVED: a thread carries
// `him` lines, which are the reasoning AGE-33 withholds from everybody but the
// owner's own spectator. FLOOR_SUB's userId is a claim; `owner` is the claim
// checked against Telegram initData, and it is the flag heroHole already rides
// on. Anything less would put a man's reasoning on the wire for anybody who
// could guess his user id.
//
// A subscriber who never proved ownership loses the push and nothing else: the
// public half of a thread is still readable over REST, exactly as before.
export function broadcastThreadLine(userId, line) {
  if (!userId || !line || subs.size === 0) return 0;
  const owner = String(userId);
  const payload = {
    type: ServerMsg.THREAD_LINE,
    userId: owner,
    sessionId: line.sessionId ?? null,
    line,
  };
  let sent = 0;
  for (const [ws, entry] of subs) {
    if (entry.userId !== owner || !entry.owner) continue;
    if (send(ws, payload)) sent++;
  }
  return sent;
}

// SERVER-4: he is answering you. Sent immediately before the model call, and
// gated identically to the THREAD_LINE it precedes — announcing that a line is
// coming to somebody who will not be shown the line is worse than silence.
export function broadcastTyping(userId, agentId, sessionId = null) {
  if (!userId || !agentId || subs.size === 0) return 0;
  const owner = String(userId);
  const payload = {
    type: ServerMsg.TYPING,
    userId: owner,
    agentId: String(agentId),
    sessionId: sessionId ?? null,
  };
  let sent = 0;
  for (const [ws, entry] of subs) {
    if (entry.userId !== owner || !entry.owner) continue;
    if (send(ws, payload)) sent++;
  }
  return sent;
}

// WANTS-1: one agent's want changed. Owner-filtered, like SESSION_END and
// unlike the ticker: what a man is asking his backer for is between the two of
// them, and it names rooms, money and a state of mind.
//
// A push per change, not per read — refreshWantsFor is the only caller and it
// compares signatures first, so a floor where nothing is being asked for is
// silent on this channel.
export function broadcastWant(userId, agentId, want) {
  if (!userId || !agentId || subs.size === 0) return 0;
  const owner = String(userId);
  const payload = { type: ServerMsg.WANT, userId: owner, agentId: String(agentId), want: want ?? null };
  let sent = 0;
  for (const [ws, entry] of subs) {
    if (entry.userId !== owner) continue;
    if (send(ws, payload)) sent++;
  }
  return sent;
}

// An agent standing changed for this owner (deployed, retired, recap
// written) — refresh every subscriber watching that owner's floor.
export function notifyAgentsChanged(userId) {
  if (!userId) return;
  const target = String(userId);
  for (const [ws, entry] of subs) {
    if (entry.userId !== target) continue;
    sendFloorState(ws, entry);
    // HOME-STATE-1: a standing that changed is a location that may have
    // changed, and the two ride the same trigger so they can never disagree.
    sendHomeState(ws, entry);
  }
}

// A table's visible state changed. Called for every table state change, so it
// must stay cheap when nobody is subscribed.
export function notifyTable(table) {
  if (subs.size === 0 || !table) return;
  // HOME-STATE-1: a home game is not on the floor. Its state reaches the
  // client through HOME_STATE and, if the owner is watching it, through the
  // ordinary table socket — never as a FLOOR_GAME, which would draw a kitchen
  // table into the casino diorama, and never as a rooms recompute, which
  // would be a no-op anyway since it sits at no rung.
  if (table.home) return;
  for (const [ws, entry] of subs) {
    if (!tableBelongsTo(table, entry.userId)) continue;
    pushGame(ws, entry, table);
  }
  // ROOMS-1: seats filling, a table closing and the pot in the air all move
  // the floor, and all of them come through here. Change-gated and throttled,
  // so a table nobody's room cares about costs one JSON.stringify.
  broadcastRooms();
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
  eventBus.off('event', relayEvent);
  sessionBus.off('session_end', relaySessionEnd);
  if (roomsTimer) clearTimeout(roomsTimer);
  if (hotExpiryTimer) clearTimeout(hotExpiryTimer);
  roomsTimer = null;
  hotExpiryTimer = null;
  roomsSignature = null;
  roomsLastPushAt = 0;
  liveTables = null;
  homeGames = null;
}
