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

// BUG-33: every frame this file emits carries the LITERAL string the server
// puts on the wire, never WIRE.<KEY>.
//
// Both sides of this suite used the constant. ServerMsg had no PACE key at
// all, so `WIRE.PACE` was `undefined`, the emit sent `{ type: undefined }`
// and useTable's `case WIRE.PACE:` — also undefined — matched it. Six
// green tests against a message the real server has never once been able to
// deliver. A suite that emits the client's own constant tests the client
// against itself; these are the strings src/server/protocol.js sends.
const WIRE = Object.freeze({
  WATCHING:   'watching',
  STATE:      'state',
  HAND_START: 'hand_start',
  PACE:       'pace',
  READ:       'read',
});

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

// One READ push, in the shape src/server/table.js _maybeBroadcastReads sends:
// one entry per opponent, rows already built, labelled and ordered.
const READS = [{
  playerId: 'p_house',
  displayName: 'House',
  seat: 1,
  handsObserved: 41,
  gate: 30,
  formed: true,
  shape: 'station',
  line: 'He calls too much and folds to nothing.',
  rows: [
    { k: 'vpip', label: 'VPIP', value: 62, confidence: 0.8, formed: true },
    { k: 'pfr', label: 'PFR', value: 11, confidence: 0.8, formed: true },
  ],
}];

// The runout, exactly as _broadcastPace stages it.
const RUNOUT = [
  { pace: 'allin', potBb: 184.7, board: ['Kc', '9c', '4c', '2c', '5h'], card: '5h' },
];

function connectWatching(result) {
  act(() => { result.current.watch({ tableId: 'tbl-pace', agentStrategy: 'x' }); });
  const ws = lastSocket();
  act(() => { ws.open(); });
  act(() => { ws.emit({ type: WIRE.WATCHING, tableId: 'tbl-pace', spectatorSeat: 0 }); });
  act(() => { ws.emit({ type: WIRE.STATE, state: STATE, legalActions: [] }); });
  return ws;
}

describe('W3-6 useTable handles PACE', () => {
  beforeEach(() => {
    telegram.signIn();
    sockets.length = 0;
    vi.stubGlobal('WebSocket', ListenerSocket);
  });

  it('WATCH-MULTI-1: retired sockets cannot change a new table or start a reconnect', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
      const old = connectWatching(result);
      act(() => result.current.watch({ tableId: 'table-b', agentId: 'agent-b' }));
      const current = lastSocket();
      const b = { ...STATE, tableId: 'table-b', community: ['2h', '3h', '4h'], seats: [{ playerId: 'agent-b', holeCards: ['Qs', 'Qh'] }] };
      act(() => {
        current.open();
        current.emit({ type: 'watching', tableId: 'table-b', spectatorSeat: 1 });
        current.emit({ type: 'state', state: b });
        old.emit({ type: 'state', state: STATE });
        old.emit({ type: 'decision', seat: 0, reasoning: 'old table' });
        old.emit({ type: 'pace', pace: 'showdown', board: ['As'] });
        old.emit({ type: 'chat', text: 'old chat', seat: 0 });
        old.emit({ type: 'watching', spectatorSeat: 0 });
        old._fire('close', { code: 1006 });
        old.open();
      });
      expect(result.current.game.tableId).toBe('table-b');
      expect(result.current.game.community).toEqual(b.community);
      expect(result.current.game.seats[0].holeCards).toEqual(['Qs', 'Qh']);
      expect(result.current.mySeat).toBe(1);
      expect(result.current.lastDecision).toBeNull();
      expect(result.current.paceFrame).toBeNull();
      expect(result.current.chatMessages).toEqual([]);
      expect(old.sent).toHaveLength(1);
      act(() => vi.advanceTimersByTime(20000));
      expect(sockets).toHaveLength(2);
      expect(result.current.status).toBe('playing');
    } finally { vi.useRealTimers(); }
  });

  it('WATCH-MULTI-1: a current socket rejects explicit frames for another table', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    act(() => {
      ws.emit({ type: 'state', state: { ...STATE, tableId: 'wrong-table', community: ['As'] } });
      ws.emit({ type: 'pace', tableId: 'wrong-table', pace: 'showdown', board: ['As'] });
    });
    expect(result.current.game.tableId).toBe('tbl-pace');
    expect(result.current.game.community).toEqual(STATE.community);
    expect(result.current.paceFrame).toBeNull();
  });

  it('WATCH-MULTI-1: leaving then watching again retains network reconnection', () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
      connectWatching(result);
      act(() => result.current.disconnect());
      const ws = connectWatching(result);
      act(() => ws._fire('close', { code: 1006 }));
      expect(result.current.status).toBe('reconnecting');
      act(() => vi.advanceTimersByTime(1100));
      expect(sockets).toHaveLength(3);
    } finally { vi.useRealTimers(); }
  });

  it('BUG-141: a queued human sees the public hand, then follows their compacted seat into the next deal', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    act(() => { result.current.connect({ tableId: 'tbl-pace', displayName: 'YOU', buyIn: 2000 }); });
    const ws = lastSocket();
    act(() => { ws.open(); ws.emit({ type: 'joined', seat: 3, waitingForNextHand: true }); });
    const publicHand = { ...STATE, waitingForNextHand: true, seats: STATE.seats.map(seat => ({ ...seat, holeCards: [] })) };
    act(() => { ws.emit({ type: 'state', state: publicHand, yourSeat: 3, waitingForNextHand: true, legalActions: [{ type: 'fold' }] }); });
    expect(result.current.status).toBe('waiting');
    expect(result.current.mySeat).toBe(3);
    expect(result.current.game.waitingForNextHand).toBe(true);
    expect(result.current.game.seats.every(seat => seat.holeCards.length === 0)).toBe(true);
    expect(result.current.legalActions).toEqual([]);

    const nextHand = { ...STATE, handNumber: 8, street: 'preflop', community: [], waitingForNextHand: false, toAct: 1,
      seats: [{ playerId: 'p_house', displayName: 'House', stack: 1980, holeCards: [] }, { playerId: 'p_you', displayName: 'YOU', stack: 1990, holeCards: ['Ac', 'Ah'] }] };
    const legalActions = [{ type: 'call', amount: 10 }, { type: 'fold' }];
    act(() => { ws.emit({ type: 'hand_start', handNumber: 8 }); ws.emit({ type: 'state', state: nextHand, yourSeat: 1, waitingForNextHand: false, legalActions }); });
    expect(result.current.status).toBe('playing');
    expect(result.current.mySeat).toBe(1);
    expect(result.current.game.waitingForNextHand).toBe(false);
    expect(result.current.game.seats[result.current.mySeat].holeCards).toEqual(['Ac', 'Ah']);
    expect(result.current.legalActions).toEqual(legalActions);
  });

  it.each(['envelope', 'snapshot', 'joined'])('BUG-141: queued status from the %s reaches the game view and clears on a new connection', (source) => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    act(() => { result.current.connect({ tableId: 'tbl-pace', displayName: 'YOU', buyIn: 2000 }); });
    const ws = lastSocket();
    act(() => { ws.open(); ws.emit({ type: 'joined', seat: 3, ...(source === 'joined' ? { waitingForNextHand: true } : {}) }); });
    act(() => { ws.emit({ type: 'state', state: { ...STATE, ...(source === 'snapshot' ? { waitingForNextHand: true } : {}) }, yourSeat: 3, ...(source === 'envelope' ? { waitingForNextHand: true } : {}), legalActions: [] }); });
    expect(result.current.status).toBe('waiting');
    expect(result.current.game.waitingForNextHand).toBe(true);
    act(() => { result.current.disconnect(); result.current.connect({ tableId: 'another', displayName: 'YOU', buyIn: 2000 }); });
    const next = lastSocket();
    act(() => { next.open(); next.emit({ type: 'joined', seat: 0 }); next.emit({ type: 'state', state: { ...STATE, tableId: 'another' }, legalActions: [] }); });
    expect(result.current.status).toBe('playing');
    expect(result.current.mySeat).toBe(0);
    expect(result.current.game.waitingForNextHand).toBe(false);
  });

  it('BUG-50: WATCH carries the owner identity and Telegram credential', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    const sent = ws.sent[0];
    expect(sent.userId).toBe('4242');
    expect(sent.initData).toBe(window.Telegram.WebApp.initData);
    expect(sent.initData).not.toBe('');
  });

  it('W3-6: keeps the newest frame', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);

    act(() => { ws.emit({ type: WIRE.PACE, tableId: 'tbl-pace', pace: 'heating', potBb: 62 }); });
    expect(result.current.paceFrame).toMatchObject({ pace: 'heating', potBb: 62, board: null, card: null });

    act(() => { ws.emit({ type: WIRE.PACE, tableId: 'tbl-pace', ...RUNOUT[0] }); });
    expect(result.current.paceFrame).toMatchObject({
      pace: 'allin', board: ['Kc', '9c', '4c', '2c', '5h'], card: '5h',
    });
  });

  it('W3-6: merges the frame onto the view model so the felt can read it', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);

    act(() => { ws.emit({ type: WIRE.PACE, tableId: 'tbl-pace', ...RUNOUT[0] }); });
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
          type: WIRE.PACE, tableId: 'tbl-pace', pace: 'allin', potBb: 184.7,
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

    act(() => { ws.emit({ type: WIRE.PACE, tableId: 'tbl-pace', ...RUNOUT[0] }); });
    expect(result.current.paceFrame).not.toBeNull();

    act(() => { ws.emit({ type: WIRE.HAND_START, handNumber: 8 }); });
    expect(result.current.paceFrame).toBeNull();
    expect(result.current.game.paceFrame).toBeNull();
  });

  it('BUG-144: an authoritative snapshot recovers a missed runout PACE in both exposed views', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    act(() => { ws.emit({ type: 'pace', tableId: STATE.tableId, pace: 'allin', potBb: 184.7, board: ['Kc', '9c', '4c'], card: '4c' }); });
    const finalFrame = { pace: 'showdown', potBb: 184.7, board: ['Kc', '9c', '4c', '2c', '5h'], card: '5h' };
    act(() => { ws.emit({ type: 'state', state: { ...STATE, street: 'complete', community: finalFrame.board, paceFrame: finalFrame }, legalActions: [] }); });
    expect(result.current.paceFrame).toEqual(finalFrame);
    expect(result.current.game.paceFrame).toEqual(finalFrame);
    act(() => { ws.emit({ type: 'state', state: { ...STATE, paceFrame: null }, legalActions: [] }); });
    expect(result.current.paceFrame).toBeNull();
    expect(result.current.game.paceFrame).toBeNull();
  });

  it('BUG-144: a new-hand snapshot clears the previous board even when HAND_START was missed', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    act(() => { ws.emit({ type: 'pace', tableId: STATE.tableId, ...RUNOUT[0] }); });
    act(() => { ws.emit({ type: 'state', state: { ...STATE, handNumber: 8, street: 'preflop', community: [] }, legalActions: [] }); });
    expect(result.current.paceFrame).toBeNull();
    expect(result.current.game.paceFrame).toBeNull();
    expect(result.current.game.community).toEqual([]);
  });

  it('BUG-144: a legacy snapshot in the same hand keeps its held board in both views', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    const heldFrame = { pace: 'allin', potBb: 184.7, board: ['Kc', '9c', '4c'], card: '4c' };
    act(() => { ws.emit({ type: 'pace', tableId: STATE.tableId, ...heldFrame }); });
    act(() => { ws.emit({ type: 'state', state: { ...STATE, street: 'complete', community: RUNOUT[0].board }, legalActions: [] }); });
    expect(result.current.paceFrame).toEqual(heldFrame);
    expect(result.current.game.paceFrame).toEqual(heldFrame);
    // A real selection opens a new socket. Unsolicited cross-table frames
    // on the old socket are rejected by WATCH-MULTI-1.
    act(() => result.current.watch({ tableId: 'another-table' }));
    act(() => { lastSocket().open(); lastSocket().emit({ type: 'state', state: { ...STATE, tableId: 'another-table' }, legalActions: [] }); });
    expect(result.current.paceFrame).toBeNull();
    expect(result.current.game.paceFrame).toBeNull();
  });

  it('W3-6: a PACE frame before any state does not invent a game', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    act(() => { result.current.watch({ tableId: 'tbl-pace', agentStrategy: 'x' }); });
    const ws = lastSocket();
    act(() => { ws.open(); });

    act(() => { ws.emit({ type: WIRE.PACE, tableId: 'tbl-pace', pace: 'calm', potBb: 3 }); });
    expect(result.current.game).toBeNull();
    expect(result.current.paceFrame).toMatchObject({ pace: 'calm' });
  });

  // ── BUG-33 · the constant and the wire ────────────────────────────────────

  it('BUG-33: every key this suite emits exists, and equals the wire string', () => {
    // The guard that would have caught the whole bug. ServerMsg.PACE was
    // undefined, so `case ServerMsg.PACE:` was a case on undefined and the
    // server's staged runout had nowhere to land.
    for (const [key, wire] of Object.entries(WIRE)) {
      expect(ServerMsg[key], `ServerMsg.${key} is missing`).toBe(wire);
    }
  });

  // ── BUG-33 · READ ─────────────────────────────────────────────────────────
  //
  // The second frame that had no key. The same array rides every STATE
  // snapshot, so the felt was never blank — it was always one snapshot late,
  // and the read panel never animated on the beat the read actually formed.

  it('BUG-33: a READ push reaches the felt', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);
    expect(result.current.reads).toBeNull();

    act(() => { ws.emit({ type: WIRE.READ, tableId: 'tbl-pace', seat: 0, reads: READS }); });

    expect(result.current.reads).toEqual(READS);
    // WatchScreen's pickOpponent() reads game.reads, so a push that only
    // landed in the hook's return value would leave the panel stale.
    expect(result.current.game.reads).toEqual(READS);
    // And nothing else about the snapshot moved.
    expect(result.current.game.community).toEqual(['Kc', '9c', '4c', '2c']);
  });

  it('BUG-33: a read is knowledge, not a frame — a new deal keeps it', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);

    act(() => { ws.emit({ type: WIRE.READ, tableId: 'tbl-pace', seat: 0, reads: READS }); });
    act(() => { ws.emit({ type: WIRE.HAND_START, handNumber: 8 }); });

    expect(result.current.paceFrame).toBeNull('the staged runout belonged to the last hand');
    expect(result.current.reads).toEqual(READS);
  });

  it('BUG-33: a READ before any state does not invent a game', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    act(() => { result.current.watch({ tableId: 'tbl-pace', agentStrategy: 'x' }); });
    const ws = lastSocket();
    act(() => { ws.open(); });

    act(() => { ws.emit({ type: WIRE.READ, tableId: 'tbl-pace', seat: 0, reads: READS }); });
    expect(result.current.game).toBeNull();
    expect(result.current.reads).toEqual(READS);
  });

  it('BUG-33: a READ carrying nothing usable is ignored rather than blanking the panel', () => {
    const { result } = renderHook(() => useTable({ wsUrl: WS_URL }));
    const ws = connectWatching(result);

    act(() => { ws.emit({ type: WIRE.READ, tableId: 'tbl-pace', seat: 0, reads: READS }); });
    act(() => { ws.emit({ type: WIRE.READ, tableId: 'tbl-pace', seat: 0 }); });
    act(() => { ws.emit({ type: WIRE.READ, tableId: 'tbl-pace', seat: 0, reads: null }); });

    expect(result.current.reads).toEqual(READS, 'what he knew is not unlearned by a malformed frame');
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
