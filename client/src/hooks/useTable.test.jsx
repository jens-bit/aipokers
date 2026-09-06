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

// ── WATCH-9 · THREAD_LINE ───────────────────────────────────────────────────
//
// SERVER-3 made the thread survive by storing it, and the sheet read the store
// when it was opened and never again — so a sheet left open went quiet while
// the table carried on talking. This is the push that fixes that, as the socket
// hands it on: stored lines, ids and all, ready to be merged with a fetch.

const LINE = (over = {}) => ({
  type: ServerMsg.THREAD_LINE,
  tableId: 'tbl-pace',
  sessionId: 's_stay1',
  agentId: 'agent_1',
  line: { id: 11, ts: 1_700_000_000_000, kind: 'table', who: 'TABLE', text: 'Granite raised to 240' },
  ...over,
});

describe('WATCH-9 useTable handles THREAD_LINE', () => {
  beforeEach(() => {
    telegram.signIn();
    sockets.length = 0;
    vi.stubGlobal('WebSocket', ListenerSocket);
  });

  it('collects pushed lines as the stored objects they are', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    act(() => { ws.emit(LINE()); });

    expect(result.current.threadLines).toHaveLength(1);
    expect(result.current.threadLines[0]).toMatchObject({
      id: 11, kind: 'table', who: 'TABLE', text: 'Granite raised to 240', sessionId: 's_stay1',
    });
  });

  it('carries the gold register through — a cost line is one on the way in too', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    act(() => {
      ws.emit(LINE({ line: { id: 12, ts: 1, kind: 'table', who: 'TABLE', text: 'he went off the line · DISCIPLINE', cost: true } }));
    });
    expect(result.current.threadLines[0].cost).toBe(true);
  });

  it('does not print the same line twice when the socket redelivers it', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    act(() => { ws.emit(LINE()); });
    act(() => { ws.emit(LINE()); });
    expect(result.current.threadLines).toHaveLength(1);
  });

  it('ignores a push with no line in it rather than storing a hole', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    act(() => { ws.emit(LINE({ line: null })); });
    act(() => { ws.emit(LINE({ line: { kind: 'table', who: 'TABLE', text: 'no id' } })); });
    expect(result.current.threadLines).toHaveLength(0);
  });

  it('a new table is a new thread — the last one\'s lines do not come with it', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    act(() => { ws.emit(LINE()); });
    expect(result.current.threadLines).toHaveLength(1);

    act(() => { result.current.watch({ tableId: 'tbl-other', agentStrategy: 'x' }); });
    expect(result.current.threadLines).toHaveLength(0);
  });
});
