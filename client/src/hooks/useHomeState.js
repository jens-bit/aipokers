// client/src/hooks/useHomeState.js — HOME-1
//
// The living room, live.
//
// HOME-STATE-1 put the whole screen on one owner-scoped message: HOME_STATE
// carries every agent's location and routine plus the home game, and it is
// pushed whenever any of that changes. So the room does not poll — it is told.
//
// Two sources, and the order matters:
//
//   1. THE SOCKET IS THE TRUTH. FLOOR_SUB, then HOME_STATE on every change.
//      WANT rides the same subscription (WANTS-1), so a want appearing is a push
//      and not a discovery on the next tick.
//   2. REST FILLS THE HOLE. GET /api/agents serves presentAgent, which carries
//      the same `location`, `routine`, `want` and `mood`. It runs once on mount
//      and on every socket open — the window between "we asked" and "the server
//      accepted our FLOOR_SUB" is a gap only a second fetch closes — and it is
//      also the whole answer on a deployment with no socket.
//
// Same shape and the same reconnect ladder as useCasinoEvents, which is the
// other consumer of this subscription. It is deliberately NOT folded into that
// hook: the ticker is public and unfiltered, this is one man's household, and a
// screen that wants one should not have to hold the other open.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMsg, ServerMsg } from '../lib/protocol.js';
import { getUserId, getTelegramInitData } from '../lib/telegram.js';

// The socket is the primary path; this is the floor under it, not a poll loop.
const REFRESH_MS = 30_000;

const MAX_BACKOFF_MS = 15_000;
function reconnectDelay(attempt) {
  return Math.min(MAX_BACKOFF_MS, 800 * 2 ** Math.min(attempt, 5));
}

/** Everything the room needs, from one presented roster. */
export function homeViewFrom(agents = [], game = null) {
  const list = Array.isArray(agents) ? agents : [];
  const home = list.filter((a) => (a?.location?.where ?? 'home') === 'home');
  const away = list.filter((a) => a?.location?.where && a.location.where !== 'home');
  return { agents: list, home, away, game: game ?? null };
}

export function useHomeState({
  wsUrl = null,
  userId = undefined,
  initData = undefined,
  enabled = true,
} = {}) {
  const [agents, setAgents] = useState([]);
  const [game, setGame] = useState(null);
  // BUGS-A job 2: has the roster ANSWERED yet?
  //
  // `agents.length === 0` is two different facts wearing one shape — "he has
  // nobody" and "nobody has told us yet" — and the room read it as the first.
  // So switching CASINO -> HOME, or coming back from a retire with agents
  // left, flashed "Nobody lives here yet" over a household that was about to
  // arrive. This is the other fact, and it is only ever set by an ANSWER: a
  // 200 with an array in it, or a HOME_STATE push. A failed fetch is not an
  // answer and must not license an empty state.
  const [loaded, setLoaded] = useState(false);
  // The most recent homecoming, or null. Cleared by the room once it has walked
  // him in — see ARRIVAL_MS in HomeScreen.
  const [arrival, setArrival] = useState(null);
  // idle | connecting | live | reconnecting | offline
  const [status, setStatus] = useState('idle');

  const [fallbackIdentity] = useState(() => ({
    userId: getUserId(),
    initData: getTelegramInitData(),
  }));
  const wireUserId = userId === undefined ? fallbackIdentity.userId : userId;
  const wireInitData = initData === undefined ? fallbackIdentity.initData : initData;

  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const attemptRef = useRef(0);
  const aliveRef = useRef(false);
  const openSocketRef = useRef(null);
  // The last HOME_STATE, by agent id. The socket is the truth (rule 1), and a
  // REST body that was in flight while a push landed is OLDER than the push
  // even though it arrives after it. Without this, answering a want and then
  // refreshing puts the want straight back on the screen, and an agent who has
  // just walked home is dragged back to the casino by a stale fetch. So REST is
  // applied as the BASE — it carries the pocket, the live game and the career
  // stats the compact push does not — and the newest push is re-laid over it.
  const pushRef = useRef(new Map());

  // REST backfill. Never clobbers with an empty list on a failed request — the
  // room going momentarily empty because a fetch 500'd is worse than a stale
  // room, and the socket is about to correct it either way.
  const refresh = useCallback(async () => {
    if (!wireUserId) return;
    try {
      const res = await fetch(`/api/agents?userId=${encodeURIComponent(wireUserId)}`, {
        headers: wireInitData ? { 'X-Telegram-Init-Data': wireInitData } : undefined,
      });
      if (!res.ok) return;
      const body = await res.json();
      if (!aliveRef.current) return;
      if (!Array.isArray(body?.agents)) return;
      setLoaded(true);
      const pushed = pushRef.current;
      // GET /api/agents has no home game in it — only HOME_STATE does — so the
      // REST path deliberately leaves `game` alone rather than nulling it.
      setAgents(body.agents.map((a) => ({ ...a, ...(pushed.get(String(a.id)) ?? {}) })));
    } catch {
      // The socket is the primary path.
    }
  }, [wireUserId, wireInitData]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
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
    try { ws = new WebSocket(wsUrl); }
    catch { scheduleReconnect(); return; }
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      if (!aliveRef.current) return;
      ws.send(JSON.stringify({
        type: ClientMsg.FLOOR_SUB,
        userId: String(wireUserId),
        initData: wireInitData ?? null,
      }));
      attemptRef.current = 0;
      setStatus('live');
      refresh();
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!aliveRef.current) return;

      if (msg?.type === ServerMsg.HOME_STATE) {
        if (Array.isArray(msg.agents)) {
          setLoaded(true);
          pushRef.current = new Map(msg.agents.map((a) => [String(a.id), a]));
          setAgents((prev) => mergeHome(prev, msg.agents));
        }
        setGame(msg.game ?? null);
        return;
      }
      // WANTS-1: a want appearing or being answered elsewhere is a push, so the
      // toast can never be one the owner already dealt with on another device.
      if (msg?.type === ServerMsg.WANT && msg.agentId) {
        const id = String(msg.agentId);
        const was = pushRef.current.get(id);
        if (was) pushRef.current.set(id, { ...was, want: msg.want ?? null });
        setAgents((prev) => prev.map((a) => (
          String(a.id) === id ? { ...a, want: msg.want ?? null } : a
        )));
        return;
      }

      // SERVER-3: his stay ended. This is what the room walks him back in with
      // — the money line rides above him and lands once. It is held here rather
      // than derived from a net that changed, because "he just got home" is an
      // EVENT and a balance is a state; a state cannot tell you it just moved.
      if (msg?.type === ServerMsg.SESSION_END && msg.agentId) {
        setArrival({
          agentId: String(msg.agentId),
          net: Number(msg.net) || 0,
          hands: Number(msg.hands) || 0,
          reason: msg.reason ?? null,
          at: Date.now(),
        });
        // The roster behind it has changed too — he is home now.
        refresh();
      }
    });

    ws.addEventListener('close', () => {
      if (wsRef.current === ws) wsRef.current = null;
      if (!aliveRef.current) return;
      scheduleReconnect();
    });
    ws.addEventListener('error', () => { /* `close` follows and reconnects */ });
  };

  useEffect(() => {
    if (!enabled) { setStatus('idle'); return undefined; }
    aliveRef.current = true;
    attemptRef.current = 0;
    refresh();
    if (wsUrl && wireUserId) openSocketRef.current();
    else setStatus('offline');
    pollRef.current = setInterval(refresh, REFRESH_MS);

    return () => {
      aliveRef.current = false;
      clearTimer();
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      const ws = wsRef.current;
      wsRef.current = null;
      if (!ws) return;
      try {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: ClientMsg.FLOOR_UNSUB }));
        ws.close();
      } catch { /* already gone */ }
    };
  }, [enabled, wsUrl, wireUserId, wireInitData, refresh, clearTimer]);

  /**
   * Clear a want locally, and keep it cleared.
   *
   * The server has already cleared it and will push WANT null; this stops the
   * toast sitting there for the width of a round trip. It writes through the
   * push overlay as well, or the refresh that follows the answer would serve
   * the want straight back — see pushRef.
   */
  const clearWant = useCallback((agentId) => {
    const id = String(agentId);
    const was = pushRef.current.get(id);
    pushRef.current.set(id, { ...(was ?? { id }), want: null });
    setAgents((prev) => prev.map((a) => (String(a.id) === id ? { ...a, want: null } : a)));
  }, []);

  return {
    ...homeViewFrom(agents, game),
    loaded,
    status, refresh, setAgents, clearWant,
    arrival, clearArrival: () => setArrival(null),
  };
}

// HOME_STATE is the compact projection — it does not carry the pocket, the
// career stats or the strategy that GET /api/agents does. So a push MERGES onto
// what REST already gave us rather than replacing it, or the away frames would
// lose their money line every time somebody's routine changed.
export function mergeHome(prev, incoming) {
  const before = new Map((prev ?? []).map((a) => [String(a.id), a]));
  return incoming.map((a) => ({ ...(before.get(String(a.id)) ?? {}), ...a }));
}
