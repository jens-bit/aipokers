import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMsg, ServerMsg, Streets } from '../lib/protocol.js';

const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 16000]; // attempts 1..5
const MAX_RECONNECT_ATTEMPTS = RECONNECT_DELAYS_MS.length;

// Per-page-load random ID. Memory-only — no sessionStorage. Embedded WebViews
// like Telegram desktop can share storage between Mini App opens of the same
// URL, so a persistent ID can collide between two clients the user thinks of
// as separate. A fresh ID per page load avoids that. The ID is kept in a ref
// for the page's lifetime so a transient WebSocket reconnect still presents
// the same identity to the server (server treats it as a reconnect, not a
// new player).
function generatePlayerId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'p_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  return 'p_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36).slice(-4);
}

const HUMAN_CLOSE_REASONS = {
  1000: 'normal closure',
  1001: 'going away',
  1006: 'connection lost',
  1011: 'server error',
  1012: 'service restart',
  4000: 'replaced by another connection',
};

function describeClose(event) {
  if (event.reason && event.reason.trim()) return event.reason;
  return HUMAN_CLOSE_REASONS[event.code] || `closed (${event.code})`;
}

// One WebSocket per browser tab. The tab joins as a single player and is
// assigned exactly one seat by the server (via the `joined` message). On
// involuntary disconnects we retry with exponential backoff (1, 2, 4, 8, 16s).
export function useTable({ wsUrl }) {
  const [game, setGame] = useState(null);
  const [legalActions, setLegalActions] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');
  // status: idle | connecting | waiting | playing | reconnecting | closed | error
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [config, setConfig] = useState(null);
  const [mySeat, setMySeat] = useState(null);

  const wsRef = useRef(null);
  const playerIdRef = useRef(null);
  const configRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const userInitiatedCloseRef = useRef(false);
  const lastStreetRef = useRef(null);

  const handleServerMessage = useCallback((msg) => {
    switch (msg.type) {
      case ServerMsg.JOINED:
        setMySeat(msg.seat);
        setStatus('waiting');
        break;

      case ServerMsg.WATCHING:
        setMySeat(msg.spectatorSeat);
        setStatus('watching');
        break;

      case ServerMsg.STATE: {
        const s = msg.state;
        setGame(s);
        setLegalActions(msg.legalActions || []);
        setStatus(s.street === Streets.COMPLETE ? 'waiting' : 'playing');

        if (lastStreetRef.current !== s.street) {
          const prev = lastStreetRef.current;
          lastStreetRef.current = s.street;
          if ([Streets.FLOP, Streets.TURN, Streets.RIVER].includes(s.street) && prev !== s.street) {
            setHistory((h) => appendEntry(h, { kind: 'street', street: s.street, community: [...s.community] }));
          }
        }
        break;
      }

      case ServerMsg.HAND_START:
        lastStreetRef.current = Streets.PREFLOP;
        setHistory((h) => [{ kind: 'handStart', handNumber: msg.handNumber, entries: [] }, ...h]);
        break;

      case ServerMsg.HAND_RESULT:
        setHistory((h) => appendEntry(h, { kind: 'result', result: msg.result }));
        break;

      case ServerMsg.TABLE_CLOSED:
        setHistory((h) => appendEntry(h, { kind: 'closed', reason: msg.reason }));
        setStatus('closed');
        break;

      case ServerMsg.ERROR:
        setError(msg.message);
        break;

      case ServerMsg.PONG:
        break;

      default:
        break;
    }
  }, []);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  // openSocketRef holds the latest implementation so the close-event reconnect
  // schedule can call into it without forming an explicit dependency cycle
  // between openSocket and scheduleReconnect.
  const openSocketRef = useRef(() => {});

  const scheduleReconnect = useCallback(() => {
    const next = reconnectAttemptRef.current + 1;
    if (next > MAX_RECONNECT_ATTEMPTS) {
      setStatus('closed');
      setError(`Could not reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts.`);
      return;
    }
    reconnectAttemptRef.current = next;
    setReconnectAttempt(next);
    setStatus('reconnecting');
    const delay = RECONNECT_DELAYS_MS[next - 1];
    console.log(`[ws] scheduling reconnect ${next}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      openSocketRef.current();
    }, delay);
  }, []);

  openSocketRef.current = () => {
    const cfg = configRef.current;
    if (!cfg) return;
    if (!playerIdRef.current) playerIdRef.current = generatePlayerId();

    setStatus((s) => (s === 'reconnecting' ? s : 'connecting'));
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      console.log('[ws] open', wsUrl);
      if (cfg.isSpectator) {
        ws.send(JSON.stringify({
          type: ClientMsg.WATCH,
          tableId: cfg.tableId,
          agentStrategy: cfg.agentStrategy ?? null,
          displayName: cfg.displayName,
          wantOpponentAI: cfg.wantOpponentAI ?? false,
          smallBlind: cfg.smallBlind ?? 10,
          bigBlind: cfg.bigBlind ?? 20,
          agentId: cfg.agentId ?? null,
          userId: cfg.userId ?? null,
        }));
      } else {
        ws.send(JSON.stringify({
          type: ClientMsg.JOIN,
          tableId: cfg.tableId,
          playerId: playerIdRef.current,
          displayName: cfg.displayName,
          buyIn: cfg.buyIn,
          smallBlind: cfg.smallBlind,
          bigBlind: cfg.bigBlind,
          wantAI: cfg.wantAI ?? false,
          agentStrategy: cfg.agentStrategy ?? null,
          agentDisplayName: cfg.agentDisplayName ?? null,
          agentId: cfg.agentId ?? null,
          userId: cfg.userId ?? null,
        }));
      }
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);
      setError(null);
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); }
      catch { setError('received invalid JSON from server'); return; }
      handleServerMessage(msg);
    });

    ws.addEventListener('close', (event) => {
      console.log('[ws] close', { code: event.code, reason: event.reason, wasClean: event.wasClean, url: wsUrl });

      // User clicked Leave — don't reconnect.
      if (userInitiatedCloseRef.current) {
        userInitiatedCloseRef.current = false;
        return;
      }

      // Server kicked us because another connection took our seat. Reconnecting
      // would just collide again, so stop and surface the reason.
      if (event.code === 4000) {
        setStatus('closed');
        setError(describeClose(event));
        return;
      }

      // Anything else (network blip, server restart, etc.) — retry.
      scheduleReconnect();
    });

    ws.addEventListener('error', () => {
      // Browsers don't expose details here; the close event fires next and
      // carries code + reason. Just log so devtools shows it happened.
      console.warn('[ws] error event');
    });
  };

  // Watch your AI agent play — spectator mode (no player input).
  const watch = useCallback((cfg) => {
    clearReconnectTimer();
    const prev = wsRef.current;
    if (prev) { try { prev.close(); } catch {} wsRef.current = null; }

    setError(null);
    setHistory([]);
    setGame(null);
    setLegalActions([]);
    setMySeat(null);
    lastStreetRef.current = null;
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);

    const spectatorCfg = { ...cfg, isSpectator: true };
    configRef.current = spectatorCfg;
    playerIdRef.current = generatePlayerId();
    setConfig(spectatorCfg);
    setStatus('connecting');
    openSocketRef.current();
  }, []);

  const connect = useCallback((cfg) => {
    clearReconnectTimer();
    const prev = wsRef.current;
    if (prev) {
      try { prev.close(); } catch {}
      wsRef.current = null;
    }

    setError(null);
    setHistory([]);
    setGame(null);
    setLegalActions([]);
    setMySeat(null);
    lastStreetRef.current = null;
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);

    configRef.current = cfg;
    playerIdRef.current = generatePlayerId();
    setConfig(cfg);
    setStatus('connecting');
    openSocketRef.current();
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    userInitiatedCloseRef.current = true;
    const ws = wsRef.current;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: ClientMsg.LEAVE }));
        ws.close();
      } catch {}
    }
    wsRef.current = null;
    configRef.current = null;
    playerIdRef.current = null;
    setStatus('idle');
    setConfig(null);
    setGame(null);
    setMySeat(null);
    setHistory([]);
    setLegalActions([]);
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
  }, []);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('not connected');
      return false;
    }
    ws.send(JSON.stringify(msg));
    return true;
  }, []);

  const act = useCallback((action) => {
    if (send({ type: ClientMsg.ACTION, action })) {
      setHistory((h) => appendEntry(h, { kind: 'action', seat: mySeat, action, t: Date.now() }));
    }
  }, [send, mySeat]);

  const deal = useCallback(() => { send({ type: ClientMsg.DEAL }); }, [send]);
  const rename = useCallback((displayName) => { send({ type: ClientMsg.RENAME, displayName }); }, [send]);
  const dismissError = useCallback(() => setError(null), []);

  // Cleanup on unmount.
  useEffect(() => () => {
    clearReconnectTimer();
    const ws = wsRef.current;
    if (ws) try { ws.close(); } catch {}
  }, []);

  return {
    game,
    mySeat,
    legalActions,
    history,
    error,
    dismissError,
    status,
    reconnectAttempt,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    config,
    connect,
    watch,
    disconnect,
    act,
    deal,
    rename,
  };
}

function appendEntry(history, entry) {
  if (history.length === 0) {
    return [{ kind: 'handStart', handNumber: 0, entries: [entry] }];
  }
  const [head, ...rest] = history;
  // Dedup: actions are logged on send, but the server may reject them. A
  // user spamming an illegal button shouldn't fill the log with phantom
  // entries. Drop a new action entry that matches the previous entry's
  // kind/seat/action/amount within 500ms — the server has had no chance
  // to apply a different action in that window.
  const last = head.entries[head.entries.length - 1];
  if (
    last
    && entry.kind === 'action' && last.kind === 'action'
    && entry.seat === last.seat
    && entry.action?.type === last.action?.type
    && entry.action?.amount === last.action?.amount
    && entry.t && last.t
    && (entry.t - last.t) < 500
  ) {
    return history;
  }
  return [{ ...head, entries: [...head.entries, entry] }, ...rest];
}
