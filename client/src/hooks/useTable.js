import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMsg, ServerMsg, Streets } from '../lib/protocol.js';

const PLAYER_ID_KEY = 'aipoker.playerId';

// Per-tab stable identifier. sessionStorage survives a refresh but a new tab
// gets a fresh ID, so two tabs naturally take two different seats.
function getOrCreatePlayerId() {
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = 'p_' + Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

// One WebSocket per browser tab. The tab joins a table as a single player and
// is assigned exactly one seat by the server (via the `joined` message).
export function useTable({ wsUrl }) {
  const [game, setGame] = useState(null);
  const [legalActions, setLegalActions] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | waiting | playing | closed | error
  const [config, setConfig] = useState(null);   // { tableId, displayName, buyIn, smallBlind, bigBlind }
  const [mySeat, setMySeat] = useState(null);

  const wsRef = useRef(null);
  const lastStreetRef = useRef(null);

  const handleServerMessage = useCallback((msg) => {
    switch (msg.type) {
      case ServerMsg.JOINED:
        setMySeat(msg.seat);
        setStatus('waiting');
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

  const connect = useCallback(
    (cfg) => {
      // Tear down any prior connection cleanly before opening a new one.
      const prev = wsRef.current;
      if (prev && prev.readyState === WebSocket.OPEN) {
        try { prev.close(); } catch {}
      }
      wsRef.current = null;

      setError(null);
      setHistory([]);
      setGame(null);
      setLegalActions([]);
      setMySeat(null);
      lastStreetRef.current = null;
      setConfig(cfg);
      setStatus('connecting');

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        ws.send(
          JSON.stringify({
            type: ClientMsg.JOIN,
            tableId: cfg.tableId,
            playerId: getOrCreatePlayerId(),
            displayName: cfg.displayName,
            buyIn: cfg.buyIn,
            smallBlind: cfg.smallBlind,
            bigBlind: cfg.bigBlind,
          })
        );
      });

      ws.addEventListener('message', (event) => {
        let msg;
        try { msg = JSON.parse(event.data); }
        catch { setError('received invalid JSON from server'); return; }
        handleServerMessage(msg);
      });

      ws.addEventListener('close', () => {
        setStatus((s) => (s === 'closed' ? s : 'closed'));
      });

      ws.addEventListener('error', () => {
        setStatus('error');
        setError('WebSocket connection error');
      });
    },
    [wsUrl, handleServerMessage]
  );

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: ClientMsg.LEAVE }));
        ws.close();
      } catch {}
    }
    wsRef.current = null;
    setStatus('idle');
    setConfig(null);
    setGame(null);
    setMySeat(null);
    setHistory([]);
    setLegalActions([]);
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
      setHistory((h) => appendEntry(h, { kind: 'action', seat: mySeat, action }));
    }
  }, [send, mySeat]);

  const deal = useCallback(() => {
    send({ type: ClientMsg.DEAL });
  }, [send]);

  const rename = useCallback((displayName) => {
    send({ type: ClientMsg.RENAME, displayName });
  }, [send]);

  const dismissError = useCallback(() => setError(null), []);

  // Cleanup on unmount only — disconnect is stable so this won't loop.
  useEffect(() => () => {
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
    config,
    connect,
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
  return [{ ...head, entries: [...head.entries, entry] }, ...rest];
}
