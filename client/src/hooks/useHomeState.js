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
import { homeTablePreview } from '../../../src/shared/homePreview.js';

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
  onOwnerLine = null,
} = {}) {
  const [agents, setAgentState] = useState([]);
  const agentsRef = useRef([]);
  // Socket events may arrive in one React batch. Resolve each update against
  // the last received roster, so push overlays update synchronously rather
  // than mutating refs inside a React state updater during rendering.
  const setAgents = useCallback(update => {
    const next=typeof update==='function' ? update(agentsRef.current) : update;
    agentsRef.current=next;
    setAgentState(next);
  }, []);
  const [game, setGame] = useState(null);
  // REST answers the roster only. A table is unknown until HOME_STATE answers
  // with a game or an explicit null; reconnects retain that last answer.
  const [gameKnown, setGameKnown] = useState(false);
  const [ownerLines, setOwnerLines] = useState([]);
  const ownerLineRef = useRef(onOwnerLine);
  ownerLineRef.current = onOwnerLine;
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
  const clearArrival = useCallback(() => setArrival(null), []);
  // VISIT-1: the one knock at the door waiting on an answer, or null. Rides
  // HOME_STATE exactly like `game` — server-owned, no local clearing needed:
  // it is null again the moment the server has an answer on record.
  const [visitor, setVisitor] = useState(null);
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
  // A retired connection/fetch may finish after a new effect becomes alive.
  // Scope objects invalidate that work without discarding a same-owner room
  // during a reconnect or refreshed Telegram credentials.
  const scopeRef = useRef(null);
  const ownerIdRef = useRef(null);
  const openSocketRef = useRef(null);
  // The last HOME_STATE, by agent id. The socket is the truth (rule 1), and a
  // REST body that was in flight while a push landed is OLDER than the push
  // even though it arrives after it. Without this, answering a want and then
  // refreshing puts the want straight back on the screen, and an agent who has
  // just walked home is dragged back to the casino by a stale fetch. So REST is
  // applied as the BASE — it carries the pocket, the live game and the career
  // stats the compact push does not — and the newest push is re-laid over it.
  const pushRef = useRef(new Map());
  const rosterIdsRef = useRef(null);
  const rosterRevisionRef = useRef(0);
  const removedIdsRef = useRef(new Set());

  // A snapshot can remove a known resident, but an old empty snapshot must
  // not permanently veto the first agent arriving through a later REST call.
  const recordRoster = incoming => {
    const ids=new Set(incoming.filter(a=>!a.guest).map(a=>String(a.id)));
    const known=new Set([...(rosterIdsRef.current ?? []),...agentsRef.current.filter(a=>!a.guest).map(a=>String(a.id))]);
    for(const id of known) if(!ids.has(id)) removedIdsRef.current.add(id);
    for(const id of ids) removedIdsRef.current.delete(id);
    rosterIdsRef.current=ids;
    rosterRevisionRef.current+=1;
  };

  // REST backfill. Never clobbers with an empty list on a failed request — the
  // room going momentarily empty because a fetch 500'd is worse than a stale
  // room, and the socket is about to correct it either way.
  const refresh = useCallback(async () => {
    if (!wireUserId) return;
    const scope=scopeRef.current;
    if (!aliveRef.current || !scope || scope.userId!==String(wireUserId) || scope.initData!==wireInitData) return;
    const rosterRevision=rosterRevisionRef.current;
    try {
      const res = await fetch(`/api/agents?userId=${encodeURIComponent(wireUserId)}`, {
        headers: wireInitData ? { 'X-Telegram-Init-Data': wireInitData } : undefined,
      });
      if (!res.ok) return;
      const body = await res.json();
      if (!aliveRef.current || scopeRef.current!==scope) return;

      if (!Array.isArray(body?.agents)) return;
      setLoaded(true);
      const pushed = pushRef.current;
      const newerRoster=rosterRevisionRef.current!==rosterRevision;
      // GET /api/agents has no home game in it — only HOME_STATE does — so the
      // REST path deliberately leaves `game` alone rather than nulling it.
      setAgents(prev => {
        const residents=body.agents.filter(a=>!removedIdsRef.current.has(String(a.id))
          && (!newerRoster || rosterIdsRef.current?.has(String(a.id))))
          .map(a=>mergeHomeAgent(a,pushed.get(String(a.id)) ?? {}));
        // REST is only this owner's roster. It cannot remove a guest whose
        // presence was confirmed by HOME_STATE, or a resident who arrived in
        // a snapshot after this request started.
        const ids=new Set(residents.map(a=>String(a.id)));
        return residents.concat(prev.filter(a=>!ids.has(String(a.id)) && (a.guest
          ? pushed.get(String(a.id))?.guest
          : newerRoster && rosterIdsRef.current?.has(String(a.id)))));
      });
    } catch {
      // The socket is the primary path.
    }
  }, [wireUserId, wireInitData, setAgents]);

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
    const scope=scopeRef.current;
    if (!scope || scope.userId!==String(wireUserId) || scope.initData!==wireInitData) return;
    setStatus((s) => (s === 'reconnecting' ? s : 'connecting'));
    let ws;
    try { ws = new WebSocket(wsUrl); }
    catch { scheduleReconnect(); return; }
    wsRef.current = ws;
    const isCurrent=()=>aliveRef.current && scopeRef.current===scope && wsRef.current===ws;

    ws.addEventListener('open', () => {
      if (!isCurrent()) return;
      ws.send(JSON.stringify({type:ClientMsg.FLOOR_SUB,userId:String(wireUserId),initData:wireInitData ?? null}));
      attemptRef.current = 0;
      setStatus('live');
      refresh();
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (!isCurrent()) return;

      if ([ServerMsg.HOME_STATE,ServerMsg.FLOOR_STATE,ServerMsg.FLOOR_GAME].includes(msg?.type)
        && msg.userId != null && String(msg.userId)!==String(wireUserId)) return;

      if (msg?.type === ServerMsg.FLOOR_STATE && Array.isArray(msg.agents)) {
        const cards=msg.agents.map(a=>({...a,liveGame:homeTablePreview(a.liveGame)}));
        const floorById=new Map(cards.map(a=>[String(a.id),a]));
        setLoaded(true);
        recordRoster(cards);
        for (const [id,card] of floorById) {
          if (pushRef.current.get(id)?.guest) continue;
          pushRef.current.set(id,mergeHomeAgent(pushRef.current.get(id),card));
        }
        for(const [id,old] of pushRef.current) if(!old.guest&&!floorById.has(id)) pushRef.current.delete(id);
        setAgents(prev=>{
          const retained=prev.filter(a=>a.guest||floorById.has(String(a.id)))
            .map(a=>a.guest?a:mergeHomeAgent(a,floorById.get(String(a.id))));
          const ids=new Set(retained.map(a=>String(a.id)));
          return retained.concat(cards.filter(a=>!ids.has(String(a.id))));
        });
        return;
      }

      if (msg?.type === ServerMsg.FLOOR_GAME) {
        setAgents(prev=>{
          // The server emits one hero's delta per owner/table, even when two
          // owned agents share it. Only the public table fields are shared;
          // each agent retains his own seat, session net and private REST data.
          const source=prev.find(a=>!a.guest&&String(a.id)===String(msg.agentId)&&a.liveGame?.tableId===msg.tableId);
          if(!source) return prev;
          const delta=homeTablePreview({tableId:msg.tableId,street:msg.street,board:msg.board,pot:msg.pot,handNumber:msg.handNumber});
          return prev.map(a=>{
            if(a.guest||a.liveGame?.tableId!==msg.tableId) return a;
            const before=a.liveGame;
            if(Number.isFinite(msg.handNumber)&&Number.isFinite(before.handNumber)&&msg.handNumber<before.handNumber) return a;
            const update=homeTablePreview({...before,...delta});
            const next=mergeHomeAgent(a,{liveGame:update});
            pushRef.current.set(String(a.id),mergeHomeAgent(pushRef.current.get(String(a.id)) ?? {id:a.id},{liveGame:update}));
            return next;
          });
        });
        return;
      }
      if (msg?.type === ServerMsg.OWNER_LINE && String(msg.userId) === String(wireUserId) && msg.line) {
        const line = { ...msg.line, sessionId: msg.line.sessionId ?? msg.sessionId };
        setOwnerLines(prev => [...prev.filter(l => l.id !== line.id), line].slice(-200));
        ownerLineRef.current?.(line);
        return;
      }

      if (msg?.type === ServerMsg.HOME_STATE) {
        if (Array.isArray(msg.agents)) {
          setLoaded(true);
          recordRoster(msg.agents);
          pushRef.current = new Map(msg.agents.map(a => [String(a.id),mergeHomeAgent(pushRef.current.get(String(a.id)),a)]));
          setAgents((prev) => mergeHome(prev, msg.agents));
        }
        if (msg.game === null || (msg.game && typeof msg.game === 'object' && !Array.isArray(msg.game))) {
          setGame(msg.game);
          setGameKnown(true);
        }
        setVisitor(msg.visitor ?? null);
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
      if (!isCurrent()) return;
      wsRef.current = null;
      scheduleReconnect();
    });
    ws.addEventListener('error', () => { /* `close` follows and reconnects */ });
  };

  useEffect(() => {
    const ownerId=String(wireUserId ?? '');
    if (ownerIdRef.current!==ownerId) {
      ownerIdRef.current=ownerId;
      pushRef.current=new Map();
      rosterIdsRef.current=null;
      rosterRevisionRef.current=0;
      removedIdsRef.current=new Set();
      setAgents([]);
      setGame(null);setGameKnown(false);setLoaded(false);
      setVisitor(null);setArrival(null);setOwnerLines([]);
    }
    const scope={userId:ownerId,initData:wireInitData};
    scopeRef.current=scope;
    if (!enabled) { setStatus('idle'); return undefined; }
    aliveRef.current = true;
    attemptRef.current = 0;
    refresh();
    if (wsUrl && wireUserId) openSocketRef.current();
    else setStatus('offline');
    pollRef.current = setInterval(refresh, REFRESH_MS);

    return () => {
      aliveRef.current = false;
      if (scopeRef.current===scope) scopeRef.current=null;
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
    gameKnown,
    status, refresh, setAgents, clearWant,
    arrival, clearArrival,
    visitor,
    ownerLines,
  };
}

// HOME_STATE is the compact projection — it does not carry the pocket, the
// career stats or the strategy that GET /api/agents does. So a push MERGES onto
// what REST already gave us rather than replacing it, or the away frames would
// lose their money line every time somebody's routine changed.
export function mergeHome(prev, incoming) {
  const before = new Map((prev ?? []).map((a) => [String(a.id), a]));
  return incoming.map((a) => mergeHomeAgent(before.get(String(a.id)),a));
}

// A public picture updates the same agent/table, preserving REST-only facts
// such as casino session net. A replacement table inherits none of its cards.
function mergeHomeAgent(before, incoming) {
  const next={...before,...incoming};
  if(Object.prototype.hasOwnProperty.call(incoming,'liveGame')) {
    const view=homeTablePreview(incoming.liveGame);
    next.liveGame=view ? {...(before?.liveGame?.tableId===view.tableId ? before.liveGame : {}),...view} : null;
  }
  return next;
}
