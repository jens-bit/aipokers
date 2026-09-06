// client/src/hooks/useCasinoRooms.js — CASINO-1
//
// The client half of ROOMS-1. The casino is a building and a room is a stakes
// tier, so this turns two server surfaces — GET /api/rooms and the WS
// FLOOR_ROOMS frame — into one array the doorways are drawn from.
//
// It is deliberately NOT part of useCasinoEvents, even though both ride a
// FLOOR_SUB. EVENT-2 drew a boundary in its own comments ("FLOOR_STATE and
// FLOOR_GAME ride the same subscription; they belong to the diorama, not the
// ticker") and a rooms payload is the diorama's half. Keeping them apart means
// the ticker's ring logic never has to know what a room is, and this file
// never has to know what a cursor is.
//
// Three things the shape follows from:
//
//   * A ROOM PAYLOAD IS A SNAPSHOT, NOT A LOG. There is no id to dedupe on and
//     nothing to merge: the newest array wins outright. That is why this hook
//     is a third the size of EVENT-2's — no ring, no cursor, no backfill
//     cursor arithmetic, just "whatever the server last said".
//   * A ROOM ALWAYS EXISTS. rooms.js promises the back room reports zeroes
//     rather than disappearing, so the doorways are a stable list and the
//     screen never reflows because the floor went quiet.
//   * THE SNAPSHOT RIDES FLOOR_STATE. A fresh subscriber gets its lobby on the
//     subscribe frame, so the REST call is the pre-socket answer and the first
//     push, not a poll.
//
// What the server does NOT send, and what this file therefore cannot know:
// which room a given tableId is in. `hot` and `biggestPot` name table ids, but
// there is no table -> room map on the wire. roomForBlinds() is the workaround
// — an agent's liveGame carries `blinds` ("10/20"), and that string identifies
// a rung exactly.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMsg, ServerMsg } from '../lib/protocol.js';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';

export const ROOMS_URL = '/api/rooms';

// Same ladder as useTable and useCasinoEvents. Like the ticker, the lobby
// never gives up: nobody is watching a hand here, so there is no user to
// notice it went dead and click something.
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

function reconnectDelay(attempt) {
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
}

// ── Pure helpers ────────────────────────────────────────────────────────────

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * The blinds string a room runs at, in liveGameView's own format. This is the
 * join key between an agent and a doorway, so it has exactly one definition.
 */
export function blindsOf(room) {
  const s = room?.stakes;
  if (!s) return null;
  return `${num(s.smallBlind)}/${num(s.bigBlind)}`;
}

/**
 * Normalise whatever the wire gave us into the shape the doorways read. A
 * payload that is not an array at all is an empty floor, never a throw — the
 * casino is the front door and it does not get to crash on a bad frame.
 */
export function normalizeRooms(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && r.id != null)
    .map((r) => ({
      id: String(r.id),
      name: typeof r.name === 'string' ? r.name : String(r.id),
      rung: num(r.rung),
      stakes: {
        smallBlind: num(r.stakes?.smallBlind),
        bigBlind: num(r.stakes?.bigBlind),
        buyIn: num(r.stakes?.buyIn),
        label: typeof r.stakes?.label === 'string' ? r.stakes.label : '',
      },
      tables: Math.max(0, num(r.tables)),
      seated: Math.max(0, num(r.seated)),
      hot: Array.isArray(r.hot) ? r.hot.map(String) : [],
      biggestPot: r.biggestPot && r.biggestPot.tableId != null
        ? { tableId: String(r.biggestPot.tableId), pot: Math.max(0, num(r.biggestPot.pot)) }
        : null,
    }));
}

/** The room running at these blinds ("10/20"), or null. */
export function roomForBlinds(rooms, blinds) {
  if (!blinds) return null;
  return (rooms ?? []).find((r) => blindsOf(r) === String(blinds)) ?? null;
}

/**
 * The room a tableId is in, as far as the payload can say. Only hot tables and
 * the room's biggest pot are named on the wire, so this answers for those and
 * null for every other table — see the note at the top of the file.
 */
export function roomForTable(rooms, tableId) {
  if (!tableId) return null;
  const id = String(tableId);
  return (rooms ?? []).find(
    (r) => r.hot.includes(id) || r.biggestPot?.tableId === id,
  ) ?? null;
}

/**
 * Your agents, bucketed by the room they are sitting in — { [roomId]: agent[] }.
 * An agent who is not at a live table is in no room, which is the honest
 * answer: he is not in the building, he is on the Home floor.
 */
export function agentsByRoom(rooms, agents) {
  const byRoom = {};
  for (const room of rooms ?? []) byRoom[room.id] = [];
  for (const agent of agents ?? []) {
    const room = roomForBlinds(rooms, agent?.liveGame?.blinds)
      ?? roomForTable(rooms, agent?.activeTableId);
    if (room) byRoom[room.id].push(agent);
  }
  return byRoom;
}

/** Everyone seated in the building, across every room. */
export function totalSeated(rooms) {
  return (rooms ?? []).reduce((sum, r) => sum + r.seated, 0);
}

// ── The hook ────────────────────────────────────────────────────────────────

/**
 * Subscribe to the floor's rooms.
 *
 * @param {string}  wsUrl    the same URL useTable and useCasinoEvents open.
 *                           Omit it and the lobby is still served once over
 *                           REST — a floor frozen at the last snapshot beats a
 *                           floor that throws.
 * @param {string}  userId   FLOOR_SUB requires one; defaults to this client's.
 * @param {string}  initData Telegram credentials. The rooms payload is counts
 *                           and table ids and is not owner-filtered, so these
 *                           buy nothing here — they are forwarded because
 *                           FLOOR_SUB is one frame and the server reads them
 *                           for the FLOOR_GAME half of the same subscription.
 * @param {boolean} enabled  false tears the socket down.
 *
 * @returns {{ rooms, status, refresh }}
 */
export function useCasinoRooms({
  wsUrl = null,
  userId = undefined,
  initData = undefined,
  apiSecret = null,
  enabled = true,
} = {}) {
  const [rooms, setRooms] = useState([]);
  // status: idle | connecting | live | reconnecting | offline
  const [status, setStatus] = useState('idle');

  // Resolved once, for the same reason EVENT-2 resolves it once: getUserId()
  // mints and stores an id the first time it is asked.
  const [fallbackIdentity] = useState(() => ({
    userId: getUserId(),
    initData: getTelegramInitData(),
  }));
  const wireUserId = userId === undefined ? fallbackIdentity.userId : userId;
  const wireInitData = initData === undefined ? fallbackIdentity.initData : initData;

  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const attemptRef = useRef(0);
  const aliveRef = useRef(false);
  const openSocketRef = useRef(null);

  const ingest = useCallback((raw) => {
    const next = normalizeRooms(raw);
    // An empty push on a floor we already have is a frame we could not read,
    // not a casino that emptied: rooms.js never returns fewer rooms than the
    // ladder has rungs.
    setRooms((prev) => (next.length === 0 && prev.length > 0 ? prev : next));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(ROOMS_URL);
      if (!res.ok) return;
      const body = await res.json();
      if (!aliveRef.current) return;
      ingest(body?.rooms ?? []);
    } catch {
      // The socket is the primary path; a failed fetch is a stale lobby, not
      // an error the owner can do anything about.
    }
  }, [ingest]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (!aliveRef.current) return;
    clearTimer();
    const delay = reconnectDelay(attemptRef.current);
    attemptRef.current += 1;
    setStatus('reconnecting');
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      openSocketRef.current?.();
    }, delay);
  }, [clearTimer]);

  openSocketRef.current = () => {
    if (!aliveRef.current || !wsUrl || !wireUserId) return;

    setStatus((s) => (s === 'reconnecting' ? s : 'connecting'));
    let ws;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      if (!aliveRef.current) return;
      ws.send(JSON.stringify({
        type: ClientMsg.FLOOR_SUB,
        userId: String(wireUserId),
        initData: wireInitData ?? null,
        apiSecret: apiSecret ?? null,
      }));
      attemptRef.current = 0;
      setStatus('live');
      // FLOOR_STATE follows immediately and carries the rooms, so no fetch is
      // needed here — unlike the ticker, there is no gap to close.
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); }
      catch { return; }
      if (msg?.type === ServerMsg.FLOOR_ROOMS) ingest(msg.rooms);
      else if (msg?.type === ServerMsg.FLOOR_STATE && msg.rooms) ingest(msg.rooms);
    });

    ws.addEventListener('close', () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (!aliveRef.current) return;
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // `close` follows and reconnects.
    });
  };

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return undefined;
    }

    aliveRef.current = true;
    attemptRef.current = 0;
    refresh();
    if (wsUrl && wireUserId) openSocketRef.current();
    else setStatus('offline');

    return () => {
      aliveRef.current = false;
      clearTimer();
      const ws = wsRef.current;
      wsRef.current = null;
      if (!ws) return;
      try {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: ClientMsg.FLOOR_UNSUB }));
        ws.close();
      } catch { /* already gone */ }
    };
  }, [enabled, wsUrl, wireUserId, wireInitData, apiSecret, refresh, clearTimer]);

  return { rooms, status, refresh };
}
