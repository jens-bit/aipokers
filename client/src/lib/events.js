// client/src/lib/events.js — EVENT-2
//
// The client half of the casino event bus (EVENT-1). No UI: this file turns
// two server surfaces — GET /api/events and the WS EVENT frame on the floor
// channel — into one ring of the last 50 headlines that a ticker can render.
//
// The shape follows from what the server promises:
//
//   * EVERY EVENT HAS A MONOTONIC id. That single fact does all the hard work.
//     It is the dedupe key when the REST backfill and the socket deliver the
//     same event twice, it is the sort key when they deliver them out of
//     order, and it is the `since` cursor that makes a reconnect cheap. We
//     never compare on ts, headline or content.
//   * THE SERVER'S RING IS 200, OURS IS 50. A ticker shows what is happening
//     now; anything older has scrolled past and is dead weight in a React
//     state object. `lastId` is tracked in a ref rather than read off the
//     ring, so trimming the ring never rewinds the cursor and never makes a
//     reconnect re-deliver 150 events we already dropped on purpose.
//   * A SOCKET THAT DROPS LOSES EVENTS SILENTLY. There is no gap detection on
//     the wire, so every connect — first or fiftieth — is followed by a
//     `since=<lastId>` fetch. Overlap is free (dedupe), a gap is not.
//
// hotTables is the one derived value with a clock in it: a `hot` event says a
// big pot is live on the river RIGHT NOW, which stops being true about twenty
// seconds later whether or not anything else arrives. So the hook keeps a tick
// that fires at the exact moment the oldest live `hot` expires — no polling
// interval, and no table left glowing because the floor went quiet.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientMsg, ServerMsg } from './protocol.js';
import { getTelegramInitData, getUserId } from './telegram.js';

// Mirrors EventType in src/server/events.js.
export const CasinoEventType = Object.freeze({
  BIG_POT: 'bigPot',
  COOLER: 'cooler',
  HEATER: 'heater',
  BUST: 'bust',
  NEMESIS_SEATED: 'nemesisSeated',
  HOT: 'hot',
});

// How many headlines we keep. The server's ring is 200; a ticker that has
// scrolled 50 past the reader is not going to scroll back.
export const EVENT_RING_SIZE = 50;

// How long a `hot` event keeps its table marked hot. The server fires `hot`
// when a big pot reaches the river with two or more players live — the hand
// resolves in seconds, so the mark is a "go and look" prompt with a short
// fuse, not a badge.
export const HOT_WINDOW_MS = 20_000;

// Same ladder as useTable. Unlike a table socket the ticker never gives up:
// there is no user watching a hand to notice it went dead and click something,
// so after the ladder runs out we keep retrying at the last delay.
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

function reconnectDelay(attempt) {
  return RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Merge `incoming` into `existing`, deduped by id, oldest first, capped at
 * `limit`. Both sides may overlap and may arrive in any order — the REST
 * backfill after a reconnect routinely repeats what the socket already
 * delivered.
 */
export function mergeEvents(existing = [], incoming = [], limit = EVENT_RING_SIZE) {
  const byId = new Map();
  for (const e of existing) if (e && e.id != null) byId.set(Number(e.id), e);

  let changed = false;
  for (const e of incoming) {
    if (!e || e.id == null) continue;
    const id = Number(e.id);
    if (!Number.isFinite(id) || byId.has(id)) continue;
    byId.set(id, e);
    changed = true;
  }
  // Nothing new: hand back the same array so React skips the re-render.
  if (!changed && byId.size === existing.length) return existing;

  const merged = [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
  return merged.length > limit ? merged.slice(merged.length - limit) : merged;
}

/** The highest id in `events`, or 0. */
export function highestId(events = []) {
  let max = 0;
  for (const e of events) {
    const id = Number(e?.id);
    if (Number.isFinite(id) && id > max) max = id;
  }
  return max;
}

/**
 * The set of tableIds with a `hot` event inside the window ending at `now`.
 * A Set, not a list, because the only question a caller asks is "is this
 * table hot".
 */
export function hotTablesFrom(events = [], now = Date.now(), windowMs = HOT_WINDOW_MS) {
  const hot = new Set();
  for (const e of events) {
    if (e?.type !== CasinoEventType.HOT || !e.tableId) continue;
    if (now - Number(e.ts) <= windowMs) hot.add(String(e.tableId));
  }
  return hot;
}

/**
 * When the oldest still-live `hot` event expires, as a ms delay from `now`,
 * or null if no table is hot. This is what the tick schedules against, so a
 * quiet floor costs zero timers.
 */
export function nextHotExpiryDelay(events = [], now = Date.now(), windowMs = HOT_WINDOW_MS) {
  let soonest = null;
  for (const e of events) {
    if (e?.type !== CasinoEventType.HOT || !e.tableId) continue;
    const expiresAt = Number(e.ts) + windowMs;
    if (!Number.isFinite(expiresAt) || expiresAt <= now) continue;
    if (soonest === null || expiresAt < soonest) soonest = expiresAt;
  }
  return soonest === null ? null : Math.max(0, soonest - now);
}

export function eventsUrl(since = 0) {
  return `/api/events?since=${encodeURIComponent(Number(since) || 0)}`;
}

// ── The hook ────────────────────────────────────────────────────────────────

/**
 * Subscribe to the casino floor.
 *
 * @param {string}  wsUrl    the same URL useTable opens. Omit it and the hook
 *                           still backfills once over REST — a ticker frozen
 *                           at the last 50 beats a ticker that throws.
 * @param {string}  userId   FLOOR_SUB requires one; defaults to this client's.
 * @param {string}  initData Telegram credentials. The ticker carries headlines
 *                           only and is not filtered by ownership, so these
 *                           buy nothing here — they are forwarded because the
 *                           same subscription also drives FLOOR_GAME, whose
 *                           heroHole they do gate.
 * @param {boolean} enabled  false tears the socket down (screens that are not
 *                           showing a ticker should not hold one open).
 *
 * @returns {{ events, latest, byType, hotTables, status, lastId }}
 */
export function useCasinoEvents({
  wsUrl = null,
  userId = undefined,
  initData = undefined,
  apiSecret = null,
  enabled = true,
} = {}) {
  const [events, setEvents] = useState([]);
  // status: idle | connecting | live | reconnecting | offline
  const [status, setStatus] = useState('idle');
  // Resolved once. getUserId() mints and stores an id the first time it is
  // asked, so it must not be called on every render; a caller that passes an
  // explicit null is asking for no socket at all, which is why the test is
  // against undefined rather than falsiness.
  const [fallbackIdentity] = useState(() => ({
    userId: getUserId(),
    initData: getTelegramInitData(),
  }));
  const wireUserId = userId === undefined ? fallbackIdentity.userId : userId;
  const wireInitData = initData === undefined ? fallbackIdentity.initData : initData;
  // Bumped when a `hot` event expires. Its value means nothing; it exists so
  // hotTables recomputes on a clock rather than only on new events.
  const [tick, setTick] = useState(0);

  const lastIdRef = useRef(0);
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const attemptRef = useRef(0);
  const aliveRef = useRef(false);
  const openSocketRef = useRef(null);

  const ingest = useCallback((incoming) => {
    if (!incoming || incoming.length === 0) return;
    // The cursor advances off everything we were handed, not off what survived
    // the ring's 50-item cap.
    const top = highestId(incoming);
    if (top > lastIdRef.current) lastIdRef.current = top;
    setEvents((prev) => mergeEvents(prev, incoming));
  }, []);

  // Backfill everything newer than the cursor. Called on mount and on every
  // socket open, including the first: the window between "we asked REST" and
  // "the server accepted our FLOOR_SUB" is a hole only a second fetch closes,
  // and a duplicate fetch of a no-store in-memory ring costs nothing.
  const reconcile = useCallback(async () => {
    try {
      const res = await fetch(eventsUrl(lastIdRef.current));
      if (!res.ok) return;
      const body = await res.json();
      if (!aliveRef.current) return;
      ingest(body?.events ?? []);
      const lastId = Number(body?.lastId);
      if (Number.isFinite(lastId) && lastId > lastIdRef.current) lastIdRef.current = lastId;
    } catch {
      // The socket is the primary path; a failed backfill is a gap in the
      // ticker, not an error the user can do anything about.
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
      // Subscribed — now fill in whatever happened while we were not.
      reconcile();
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); }
      catch { return; }
      // FLOOR_STATE and FLOOR_GAME ride the same subscription; they belong to
      // the diorama, not the ticker.
      if (msg?.type === ServerMsg.EVENT && msg.event) ingest([msg.event]);
    });

    ws.addEventListener('close', () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (!aliveRef.current) return;
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // Details are not exposed to the page; `close` follows and reconnects.
    });
  };

  // Connect / tear down. Re-runs when the identity on the wire changes, since
  // FLOOR_SUB carries it.
  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return undefined;
    }

    aliveRef.current = true;
    attemptRef.current = 0;
    reconcile();
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
  }, [enabled, wsUrl, wireUserId, wireInitData, apiSecret, reconcile, clearTimer]);

  // The clock behind hotTables: one timeout, armed for the exact moment the
  // oldest live `hot` stops being hot, and nothing at all when none is.
  useEffect(() => {
    const delay = nextHotExpiryDelay(events, Date.now());
    if (delay === null) return undefined;
    const t = setTimeout(() => setTick((n) => n + 1), delay + 1);
    return () => clearTimeout(t);
  }, [events, tick]);

  // Date.now() rather than a stored timestamp: `tick` is only the signal to
  // look at the clock again, never the clock itself. A backfill can hand us a
  // `hot` event that was already stale when it arrived, and that one must not
  // light a table up.
  const hotTables = useMemo(
    () => hotTablesFrom(events, Date.now()),
    [events, tick],
  );

  const byType = useCallback(
    (type) => events.filter((e) => e?.type === type),
    [events],
  );

  const latest = events.length > 0 ? events[events.length - 1] : null;

  return { events, latest, byType, hotTables, status, lastId: lastIdRef.current };
}

