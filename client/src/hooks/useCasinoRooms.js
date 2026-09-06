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
// CASINO-2 ADDED THE OTHER HALF. ROOM_TABLES is one public felt per live
// table — seats, board, pot, whose turn it is — and it rides this same
// subscription, so this hook owns it too. It answers the question a room
// payload structurally cannot: not how many tables are in there, but WHICH,
// and what is happening at each of them. The rooms are still the doorways; the
// felts are what is behind them.
//
// It also closes the gap the paragraph below used to describe. `rooms` on the
// ROOM_TABLES frame is the table -> room map, stated by the server rather than
// reverse-engineered from which table ids a room happened to name, so
// roomForTable() now answers for every live table instead of for the two kinds
// ROOMS-1 mentions. roomForBlinds() stays, because an agent's liveGame carries
// `blinds` and that is still the join for an agent whose table is not yet on a
// felt frame.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMsg, ServerMsg } from '../lib/protocol.js';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';

export const ROOMS_URL = '/api/rooms';

/** The felts in one room, over REST. The socket is the primary path. */
export const roomTablesUrl = (roomId) => `/api/rooms/${encodeURIComponent(roomId)}/tables`;

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
 * The room a tableId is in.
 *
 * CASINO-2 made this a lookup instead of a search. `map` is the server's own
 * table -> room map off the ROOM_TABLES frame and answers for every live table;
 * the `hot` / `biggestPot` scan behind it is what ROOMS-1 alone could say, and
 * is still the answer before the first felt frame arrives or when the socket
 * is down. Both read the same room list, so they cannot disagree — one just
 * knows about more tables than the other.
 */
export function roomForTable(rooms, tableId, map = null) {
  if (!tableId) return null;
  const id = String(tableId);
  const stated = map?.[id];
  if (stated) return (rooms ?? []).find((r) => r.id === stated) ?? null;
  return (rooms ?? []).find(
    (r) => r.hot.includes(id) || r.biggestPot?.tableId === id,
  ) ?? null;
}

/**
 * Normalise the felts off ROOM_TABLES. Same law as normalizeRooms: a frame
 * that cannot be read is an empty floor, never a throw.
 *
 * Nothing is invented here. A felt with no seat list keeps an empty one, and
 * the miniature draws an empty table — which is a true thing about a table
 * between hands and is what the room actually looks like.
 */
export function normalizeFelts(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && t.tableId != null)
    .map((t) => ({
      tableId: String(t.tableId),
      room: t.room == null ? null : String(t.room),
      blinds: typeof t.blinds === 'string' ? t.blinds : '',
      smallBlind: num(t.smallBlind),
      bigBlind: num(t.bigBlind),
      street: typeof t.street === 'string' ? t.street : 'waiting',
      board: Array.isArray(t.board) ? t.board.filter((c) => typeof c === 'string') : [],
      pot: Math.max(0, num(t.pot)),
      toAct: Number.isInteger(t.toAct) ? t.toAct : null,
      handNumber: Math.max(0, num(t.handNumber)),
      hot: !!t.hot,
      seated: Math.max(0, num(t.seated)),
      maxSeats: Math.max(0, num(t.maxSeats, 6)),
      seats: Array.isArray(t.seats) ? t.seats.map((s, i) => ({
        seat: Number.isInteger(s?.seat) ? s.seat : i,
        name: typeof s?.name === 'string' ? s.name : '',
        agentId: s?.agentId == null ? null : String(s.agentId),
        stack: Math.max(0, num(s?.stack)),
        accentColor: typeof s?.accentColor === 'string' ? s.accentColor : null,
        mood: s?.mood ?? null,
        fatigue: s?.fatigue ?? null,
        drinking: !!s?.drinking,
        inHand: !!s?.inHand,
      })) : [],
    }));
}

/** The felts in one room, in the order the server ranked them. */
export function feltsIn(felts, roomId) {
  if (!roomId) return [];
  return (felts ?? []).filter((f) => f.room === String(roomId));
}

/** The felt one of your agents is sitting at, or null. */
export function feltForAgent(felts, agent) {
  const id = agent?.liveGame?.tableId ?? agent?.activeTableId ?? null;
  if (id == null) return null;
  return (felts ?? []).find((f) => f.tableId === String(id)) ?? null;
}

/**
 * Your agents, bucketed by the room they are sitting in — { [roomId]: agent[] }.
 * An agent who is not at a live table is in no room, which is the honest
 * answer: he is not in the building, he is on the Home floor.
 */
export function agentsByRoom(rooms, agents, map = null) {
  const byRoom = {};
  for (const room of rooms ?? []) byRoom[room.id] = [];
  for (const agent of agents ?? []) {
    const room = roomForBlinds(rooms, agent?.liveGame?.blinds)
      ?? roomForTable(rooms, agent?.activeTableId, map);
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
 * @returns {{ rooms, felts, roomOf, status, refresh }}
 *   rooms   the doorways, in ladder order
 *   felts   one public snapshot per live table, ranked by the server
 *   roomOf  { [tableId]: roomId }, the map stated rather than inferred
 */
export function useCasinoRooms({
  wsUrl = null,
  userId = undefined,
  initData = undefined,
  apiSecret = null,
  enabled = true,
} = {}) {
  const [rooms, setRooms] = useState([]);
  // CASINO-2: the felts inside those rooms, and the table -> room map that
  // rides the same frame. A snapshot, exactly like `rooms`: the newest array
  // wins outright and there is nothing to merge.
  const [felts, setFelts] = useState([]);
  const [roomOf, setRoomOf] = useState({});
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

  // CASINO-2. Unlike the rooms this is NOT merged with what we had: an empty
  // felt list is a real floor (nothing is running), where an empty room list
  // is a frame we could not read.
  const ingestFelts = useCallback((raw, map) => {
    setFelts(normalizeFelts(raw));
    setRoomOf(map && typeof map === 'object' ? { ...map } : {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(ROOMS_URL);
      if (!res.ok) return;
      const body = await res.json();
      if (!aliveRef.current) return;
      const next = body?.rooms ?? [];
      ingest(next);

      // CASINO-2: the socket hands the felts over on subscribe, so this is
      // only the answer for a client that has none — one request per room,
      // once, rather than a poll. With a socket the frame is already on its
      // way and three more requests would only race it.
      if (wsUrl) return;
      const ids = normalizeRooms(next).map((r) => r.id);
      const pages = await Promise.all(ids.map(async (id) => {
        try {
          const page = await fetch(roomTablesUrl(id));
          if (!page.ok) return [];
          return (await page.json())?.tables ?? [];
        } catch { return []; }
      }));
      if (!aliveRef.current) return;
      const all = pages.flat();
      ingestFelts(all, Object.fromEntries(
        all.filter((t) => t?.tableId != null && t.room).map((t) => [String(t.tableId), String(t.room)]),
      ));
    } catch {
      // The socket is the primary path; a failed fetch is a stale lobby, not
      // an error the owner can do anything about.
    }
  }, [ingest, ingestFelts, wsUrl]);

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
      else if (msg?.type === ServerMsg.ROOM_TABLES) ingestFelts(msg.tables, msg.rooms);
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

  return { rooms, felts, roomOf, status, refresh };
}
