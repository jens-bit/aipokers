// client/src/hooks/useTable.test.jsx — W3-6
//
// The PACE message. `pace` and `potBb` ride every STATE snapshot already; what
// arrives only here is the STAGED RUNOUT during a spectator-only all-in hold,
// where the server turns the board a card at a time. The felt has to follow
// that rather than run its own clock, so every watcher turns the same card at
// the same moment.
//
// The frames below are the sequence scripts/verify-pace.js asserts on: CALM at
// the deal, HEATING when the pot crosses the threshold, ALL-IN when a stack is
// committed and nobody can act, then the runout one card at a time — "each card
// grows the board by exactly one" — and SHOWDOWN at the reveal.

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTable } from './useTable.js';
import { ServerMsg } from '../lib/protocol.js';
import { telegram } from '../test/harness.js';

const WS_URL = 'ws://localhost:8765';

// The shared harness socket speaks the onopen/onmessage style; useTable uses
// addEventListener. Rather than change the harness — every other suite is built
// on it — this file brings a socket that speaks the style useTable expects.
const sockets = [];

class ListenerSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = ListenerSocket.CONNECTING;
    this.sent = [];
    this.listeners = new Map();
    sockets.push(this);
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }

  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }

  _fire(type, event) {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }

  send(data) {
    try { this.sent.push(JSON.parse(data)); } catch { this.sent.push(data); }
  }

  close(code = 1000, reason = '') {
    this.readyState = ListenerSocket.CLOSED;
    this._fire('close', { code, reason });
  }

  // ── test controls ──
  open() {
    this.readyState = ListenerSocket.OPEN;
    this._fire('open', {});
  }

  emit(msg) { this._fire('message', { data: JSON.stringify(msg) }); }
}

const lastSocket = () => sockets[sockets.length - 1] ?? null;

// A three-handed table mid-hand, as STATE delivers it.
const STATE = {
  tableId: 'tbl-pace', handNumber: 7, street: 'turn',
  smallBlind: 10, bigBlind: 20, dealerSeat: 0, pot: 3694,
  community: ['Kc', '9c', '4c', '2c'],
  currentBet: 0, lastRaiseSize: 20, toAct: null,
  seats: [
    { playerId: 'p_hero', stack: 0, holeCards: ['As', 'Kh'], folded: false, allIn: true, displayName: 'The Grinder' },
    { playerId: 'p_house', stack: 0, holeCards: [], folded: false, allIn: true, displayName: 'House' },
  ],
  result: null,
  pace: 'allin',
  potBb: 184.7,
  heroEquity: 0.64,
};

// The runout, exactly as _broadcastPace stages it.
const RUNOUT = [
  { pace: 'allin', potBb: 184.7, board: ['Kc', '9c', '4c', '2c', '5h'], card: '5h' },
];

function connectWatching(result) {
  act(() => { result.current.watch({ tableId: 'tbl-pace', agentStrategy: 'x' }); });
  const ws = lastSocket();
  act(() => { ws.open(); });
  act(() => { ws.emit({ type: ServerMsg.WATCHING, tableId: 'tbl-pace', spectatorSeat: 0 }); });
  act(() => { ws.emit({ type: ServerMsg.STATE, state: STATE, legalActions: [] }); });
  return ws;
}

describe('W3-6 useTable handles PACE', () => {
  beforeEach(() => {
    telegram.signIn();
    sockets.length = 0;
    vi.stubGlobal('WebSocket', ListenerSocket);
  });

  it('W3-6: keeps the newest frame', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);

    act(() => { ws.emit({ type: ServerMsg.PACE, tableId: 'tbl-pace', pace: 'heating', potBb: 62 }); });
    expect(result.current.paceFrame).toMatchObject({ pace: 'heating', potBb: 62, board: null, card: null });

    act(() => { ws.emit({ type: ServerMsg.PACE, tableId: 'tbl-pace', ...RUNOUT[0] }); });
    expect(result.current.paceFrame).toMatchObject({
      pace: 'allin', board: ['Kc', '9c', '4c', '2c', '5h'], card: '5h',
    });
  });

  it('W3-6: merges the frame onto the view model so the felt can read it', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);

    act(() => { ws.emit({ type: ServerMsg.PACE, tableId: 'tbl-pace', ...RUNOUT[0] }); });
    expect(result.current.game.paceFrame).toMatchObject({ card: '5h' });
    expect(result.current.game.pace).toBe('allin');
    // Everything else about the snapshot is untouched.
    expect(result.current.game.community).toEqual(['Kc', '9c', '4c', '2c']);
    expect(result.current.game.heroEquity).toBe(0.64);
  });

  it('W3-6: each card grows the board by exactly one', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);

    const boards = [
      ['Kc', '9c', '4c'],
      ['Kc', '9c', '4c', '2c'],
      ['Kc', '9c', '4c', '2c', '5h'],
    ];
    const seen = [];
    for (const board of boards) {
      act(() => {
        ws.emit({
          type: ServerMsg.PACE, tableId: 'tbl-pace', pace: 'allin', potBb: 184.7,
          board, card: board[board.length - 1],
        });
      });
      seen.push(result.current.paceFrame.board.length);
    }
    expect(seen).toEqual([3, 4, 5]);
  });

  it('W3-6: a new deal clears the staged runout', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);

    act(() => { ws.emit({ type: ServerMsg.PACE, tableId: 'tbl-pace', ...RUNOUT[0] }); });
    expect(result.current.paceFrame).not.toBeNull();

    act(() => { ws.emit({ type: ServerMsg.HAND_START, handNumber: 8 }); });
    expect(result.current.paceFrame).toBeNull();
    expect(result.current.game.paceFrame).toBeNull();
  });

  it('W3-6: a PACE frame before any state does not invent a game', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    act(() => { result.current.watch({ tableId: 'tbl-pace', agentStrategy: 'x' }); });
    const ws = lastSocket();
    act(() => { ws.open(); });

    act(() => { ws.emit({ type: ServerMsg.PACE, tableId: 'tbl-pace', pace: 'calm', potBb: 3 }); });
    expect(result.current.game).toBeNull();
    expect(result.current.paceFrame).toMatchObject({ pace: 'calm' });
  });

  it('W3-6: a client that never sees PACE is where it was before the message existed', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    connectWatching(result);
    expect(result.current.paceFrame).toBeNull();
    // The snapshot already holds the ladder and the finished board.
    expect(result.current.game.pace).toBe('allin');
    expect(result.current.game.community).toHaveLength(4);
  });
});
