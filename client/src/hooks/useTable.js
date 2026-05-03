import { useCallback, useEffect, useRef, useState } from 'react';
import { ClientMsg, ServerMsg, Streets } from '../lib/protocol.js';

// Manages two WebSocket connections — one per seat — so a single browser tab
// can drive both sides of a heads-up table for development and practice.
//
// The shared game state is the same across both connections; only the hole
// cards differ. We merge them into a single canonical view.
export function useTable({ wsUrl }) {
  const [game, setGame] = useState(null);
  const [holeCards, setHoleCards] = useState({ 0: [], 1: [] });
  const [legalActions, setLegalActions] = useState({ 0: [], 1: [] });
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({ a: 'idle', b: 'idle' });
  const [config, setConfig] = useState(null); // { tableId, players: [{playerId, displayName, buyIn}], smallBlind, bigBlind }

  const wsRef = useRef({ a: null, b: null });
  const lastStreetRef = useRef(null);
  const lastHandRef = useRef(0);

  const setSeatStatus = (seat, status) =>
    setConnectionStatus((s) => ({ ...s, [seat === 0 ? 'a' : 'b']: status }));

  const seatToKey = (seat) => (seat === 0 ? 'a' : 'b');

  const handleServerMessage = useCallback(
    (seat, msg) => {
      switch (msg.type) {
        case ServerMsg.JOINED:
          setSeatStatus(seat, 'connected');
          break;

        case ServerMsg.STATE: {
          const s = msg.state;
          // Take the canonical shared state from whichever message we got;
          // overwrite on every update — they're consistent across seats.
          setGame(s);
          setHoleCards((prev) => {
            const next = { ...prev };
            // Each connection's STATE includes that seat's own hole cards plus
            // the opponent's only when revealed at showdown.
            if (s.seats[0].holeCards.length > 0) next[0] = s.seats[0].holeCards;
            if (s.seats[1].holeCards.length > 0) next[1] = s.seats[1].holeCards;
            // Reset cleared hands (server clears on startHand).
            if (s.seats[0].holeCards.length === 0 && seat === 0) next[0] = [];
            if (s.seats[1].holeCards.length === 0 && seat === 1) next[1] = [];
            return next;
          });
          setLegalActions((prev) => ({ ...prev, [seat]: msg.legalActions || [] }));

          // Log street transitions once (use seat 0's stream as the source of truth).
          if (seat === 0) {
            if (lastStreetRef.current !== s.street) {
              lastStreetRef.current = s.street;
              if ([Streets.FLOP, Streets.TURN, Streets.RIVER].includes(s.street)) {
                setHistory((h) => appendEntry(h, { kind: 'street', street: s.street, community: [...s.community] }));
              }
            }
          }
          break;
        }

        case ServerMsg.HAND_START:
          if (seat === 0) {
            lastStreetRef.current = Streets.PREFLOP;
            lastHandRef.current = msg.handNumber;
            setHistory((h) => [{ kind: 'handStart', handNumber: msg.handNumber, entries: [] }, ...h]);
          }
          break;

        case ServerMsg.HAND_RESULT:
          if (seat === 0) {
            setHistory((h) => appendEntry(h, { kind: 'result', result: msg.result }));
          }
          break;

        case ServerMsg.TABLE_CLOSED:
          if (seat === 0) {
            setHistory((h) => appendEntry(h, { kind: 'closed', reason: msg.reason }));
          }
          break;

        case ServerMsg.ERROR:
          setError(`[${seatToKey(seat).toUpperCase()}] ${msg.message}`);
          break;

        case ServerMsg.PONG:
          break;

        default:
          // ignore unknown
          break;
      }
    },
    []
  );

  const openSeat = useCallback(
    (seat, cfg) => {
      const player = cfg.players[seat];
      const ws = new WebSocket(wsUrl);
      wsRef.current[seatToKey(seat)] = ws;
      setSeatStatus(seat, 'connecting');

      ws.addEventListener('open', () => {
        ws.send(
          JSON.stringify({
            type: ClientMsg.JOIN,
            tableId: cfg.tableId,
            playerId: player.playerId,
            buyIn: player.buyIn,
            smallBlind: cfg.smallBlind,
            bigBlind: cfg.bigBlind,
          })
        );
      });

      ws.addEventListener('message', (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          setError('received invalid JSON from server');
          return;
        }
        handleServerMessage(seat, msg);
      });

      ws.addEventListener('close', () => {
        setSeatStatus(seat, 'closed');
      });

      ws.addEventListener('error', () => {
        setSeatStatus(seat, 'error');
      });
    },
    [wsUrl, handleServerMessage]
  );

  const connect = useCallback(
    (cfg) => {
      setError(null);
      setHistory([]);
      setGame(null);
      setHoleCards({ 0: [], 1: [] });
      setLegalActions({ 0: [], 1: [] });
      lastStreetRef.current = null;
      setConfig(cfg);
      openSeat(0, cfg);
      // Slight stagger so the second JOIN consistently arrives second; otherwise
      // either seat could end up at index 0, depending on race timing.
      setTimeout(() => openSeat(1, cfg), 60);
    },
    [openSeat]
  );

  const disconnect = useCallback(() => {
    for (const key of ['a', 'b']) {
      const ws = wsRef.current[key];
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: ClientMsg.LEAVE })); } catch {}
        ws.close();
      }
      wsRef.current[key] = null;
    }
    setConnectionStatus({ a: 'idle', b: 'idle' });
  }, []);

  // Cleanup on unmount.
  useEffect(() => () => disconnect(), [disconnect]);

  const act = useCallback(
    (seat, action) => {
      const ws = wsRef.current[seatToKey(seat)];
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        setError(`seat ${seat} is not connected`);
        return;
      }
      ws.send(JSON.stringify({ type: ClientMsg.ACTION, action }));
      setHistory((h) => appendEntry(h, { kind: 'action', seat, action }));
    },
    []
  );

  const deal = useCallback(() => {
    const ws = wsRef.current.a || wsRef.current.b;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('not connected');
      return;
    }
    ws.send(JSON.stringify({ type: ClientMsg.DEAL }));
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  return {
    game,
    holeCards,
    legalActions,
    history,
    error,
    dismissError,
    connectionStatus,
    config,
    connect,
    disconnect,
    act,
    deal,
  };
}

// History is grouped by hand: top entry is the current/most-recent hand and
// each entry has a flat list of street/action/result events under it.
function appendEntry(history, entry) {
  if (history.length === 0) {
    return [{ kind: 'handStart', handNumber: 0, entries: [entry] }];
  }
  const [head, ...rest] = history;
  return [{ ...head, entries: [...head.entries, entry] }, ...rest];
}
