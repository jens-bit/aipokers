// client/src/lib/events.test.jsx — EVENT-2
//
// The ticker's contract with the server, tested at the seam the server
// actually presents: a REST backfill, a socket that pushes EVENT frames, and a
// socket that drops. What is asserted is the behaviour a ticker depends on —
// no duplicates, no gaps after a reconnect, and a `hot` mark that expires on a
// clock rather than on the next event.

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMock, socketMock } from '../test/harness.js';
import {
  CasinoEventType,
  EVENT_RING_SIZE,
  HOT_WINDOW_MS,
  eventsUrl,
  highestId,
  hotTablesFrom,
  mergeEvents,
  nextHotExpiryDelay,
  useCasinoEvents,
} from './events.js';

const WS_URL = 'ws://localhost:8765';
const USER = '4242';

function evt(id, over = {}) {
  return {
    id,
    ts: Date.now(),
    type: CasinoEventType.BIG_POT,
    tableId: 't1',
    agentIds: ['a1'],
    headline: `event ${id}`,
    pot: 3000,
    ...over,
  };
}

// GET /api/events?since=<id> served out of a list, exactly as the server does.
function serveEvents(all) {
  fetchMock.route('/api/events', ({ url }) => {
    const since = Number(new URL(url, 'http://x').searchParams.get('since') ?? 0);
    return {
      events: all.filter((e) => e.id > since),
      lastId: all.length ? all[all.length - 1].id : 0,
    };
  });
}

function mount(opts = {}) {
  return renderHook(() => useCasinoEvents({ wsUrl: WS_URL, userId: USER, initData: 'init', ...opts }));
}

// Bring the newest socket up and let the FLOOR_SUB + backfill settle.
async function connect() {
  const ws = socketMock.last();
  await act(async () => { ws.open(); });
  return ws;
}

describe('mergeEvents', () => {
  it('dedupes by id and keeps them oldest first', () => {
    const merged = mergeEvents([evt(1), evt(3)], [evt(3), evt(2), evt(4)]);
    expect(merged.map((e) => e.id)).toEqual([1, 2, 3, 4]);
  });

  it('keeps the first copy of a duplicate id rather than replacing it', () => {
    const merged = mergeEvents([evt(1, { headline: 'original' })], [evt(1, { headline: 'repeat' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].headline).toBe('original');
  });

  it('caps the ring at the newest EVENT_RING_SIZE', () => {
    const many = Array.from({ length: EVENT_RING_SIZE + 20 }, (_, i) => evt(i + 1));
    const merged = mergeEvents([], many);
    expect(merged).toHaveLength(EVENT_RING_SIZE);
    expect(merged[0].id).toBe(21);
    expect(merged[merged.length - 1].id).toBe(EVENT_RING_SIZE + 20);
  });

  it('returns the same array when nothing is new, so React can skip a render', () => {
    const existing = [evt(1), evt(2)];
    expect(mergeEvents(existing, [evt(2)])).toBe(existing);
    expect(mergeEvents(existing, [])).toBe(existing);
  });

  it('ignores entries with no id', () => {
    expect(mergeEvents([], [null, {}, { id: null }, evt(7)]).map((e) => e.id)).toEqual([7]);
  });
});

describe('highestId', () => {
  it('is the max id, not the last one', () => {
    expect(highestId([evt(4), evt(9), evt(2)])).toBe(9);
    expect(highestId([])).toBe(0);
  });
});

describe('hotTablesFrom', () => {
  it('collects tables with a hot event inside the window', () => {
    const now = 100_000;
    const events = [
      evt(1, { type: CasinoEventType.HOT, tableId: 'fresh', ts: now - 5_000 }),
      evt(2, { type: CasinoEventType.HOT, tableId: 'stale', ts: now - HOT_WINDOW_MS - 1 }),
      evt(3, { type: CasinoEventType.BIG_POT, tableId: 'big', ts: now }),
    ];
    expect([...hotTablesFrom(events, now)]).toEqual(['fresh']);
  });

  it('ignores a hot event with no table to send anyone to', () => {
    const events = [evt(1, { type: CasinoEventType.HOT, tableId: null })];
    expect(hotTablesFrom(events, Date.now()).size).toBe(0);
  });
});

describe('nextHotExpiryDelay', () => {
  it('is the soonest expiry still ahead of us', () => {
    const now = 50_000;
    const events = [
      evt(1, { type: CasinoEventType.HOT, tableId: 'a', ts: now - 15_000 }), // 5s left
      evt(2, { type: CasinoEventType.HOT, tableId: 'b', ts: now - 2_000 }),  // 18s left
    ];
    expect(nextHotExpiryDelay(events, now)).toBe(5_000);
  });

  it('is null when nothing is hot, so no timer is armed', () => {
    expect(nextHotExpiryDelay([evt(1)], Date.now())).toBeNull();
    expect(nextHotExpiryDelay([], Date.now())).toBeNull();
  });
});

describe('useCasinoEvents', () => {
  it('backfills from GET /api/events on mount', async () => {
    serveEvents([evt(1), evt(2)]);
    const { result } = mount();

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events.map((e) => e.id)).toEqual([1, 2]);
    expect(fetchMock.requestsMatching('/api/events')[0].url).toBe(eventsUrl(0));
  });

  it('subscribes to the floor channel when the socket opens', async () => {
    serveEvents([]);
    mount();
    const ws = await connect();

    expect(ws.url).toBe(WS_URL);
    expect(ws.sent[0]).toEqual({
      type: 'floor_sub',
      userId: USER,
      initData: 'init',
      apiSecret: null,
    });
  });

  it('appends events pushed over the socket', async () => {
    serveEvents([]);
    const { result } = mount();
    const ws = await connect();

    await act(async () => { ws.emit({ type: 'event', event: evt(1, { headline: 'a pot' }) }); });
    await act(async () => { ws.emit({ type: 'event', event: evt(2, { headline: 'a cooler' }) }); });

    expect(result.current.events.map((e) => e.headline)).toEqual(['a pot', 'a cooler']);
    expect(result.current.latest.id).toBe(2);
  });

  it('ignores floor messages that are not ticker events', async () => {
    serveEvents([]);
    const { result } = mount();
    const ws = await connect();

    await act(async () => {
      ws.emit({ type: 'floor_state', userId: USER, agents: [] });
      ws.emit({ type: 'floor_game', tableId: 't1', pot: 500 });
      ws.emit({ type: 'event' }); // no payload
      ws.dispatch('message', { data: 'not json' });
    });

    expect(result.current.events).toEqual([]);
  });

  it('does not duplicate an event delivered by both the socket and the backfill', async () => {
    const all = [evt(1)];
    serveEvents(all);
    const { result } = mount();
    const ws = await connect();

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    await act(async () => { ws.emit({ type: 'event', event: all[0] }); });

    expect(result.current.events.map((e) => e.id)).toEqual([1]);
  });

  it('reconciles with since=<lastId> after a reconnect, and misses nothing', async () => {
    vi.useFakeTimers();
    try {
      const all = [evt(1), evt(2)];
      serveEvents(all);
      const { result } = renderHook(() => useCasinoEvents({ wsUrl: WS_URL, userId: USER }));

      const first = socketMock.last();
      await act(async () => { first.open(); });
      await act(async () => { await Promise.resolve(); });
      expect(result.current.events.map((e) => e.id)).toEqual([1, 2]);

      // The floor keeps moving while the socket is down.
      all.push(evt(3), evt(4));
      await act(async () => { first.close(1006); });
      expect(result.current.status).toBe('reconnecting');

      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
      const second = socketMock.last();
      expect(second).not.toBe(first);
      await act(async () => { second.open(); await Promise.resolve(); });

      const backfill = fetchMock.requestsMatching('/api/events').at(-1);
      expect(backfill.url).toBe(eventsUrl(2));
      expect(result.current.events.map((e) => e.id)).toEqual([1, 2, 3, 4]);
      expect(result.current.status).toBe('live');
    } finally {
      vi.useRealTimers();
    }
  });

  it('backs off between reconnect attempts instead of hammering the server', async () => {
    vi.useFakeTimers();
    try {
      serveEvents([]);
      renderHook(() => useCasinoEvents({ wsUrl: WS_URL, userId: USER }));
      await act(async () => { socketMock.last().close(1006); });

      // First retry at 1s, second at 2s.
      await act(async () => { await vi.advanceTimersByTimeAsync(999); });
      expect(socketMock.instances).toHaveLength(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(socketMock.instances).toHaveLength(2);

      await act(async () => { socketMock.last().close(1006); });
      await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
      expect(socketMock.instances).toHaveLength(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(socketMock.instances).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('byType filters the ring without touching it', async () => {
    serveEvents([
      evt(1, { type: CasinoEventType.BIG_POT }),
      evt(2, { type: CasinoEventType.COOLER }),
      evt(3, { type: CasinoEventType.BIG_POT }),
    ]);
    const { result } = mount();

    await waitFor(() => expect(result.current.events).toHaveLength(3));
    expect(result.current.byType(CasinoEventType.BIG_POT).map((e) => e.id)).toEqual([1, 3]);
    expect(result.current.byType(CasinoEventType.HEATER)).toEqual([]);
    expect(result.current.events).toHaveLength(3);
  });

  it('marks a table hot and lets the mark expire on its own clock', async () => {
    vi.useFakeTimers();
    try {
      serveEvents([]);
      const { result } = renderHook(() => useCasinoEvents({ wsUrl: WS_URL, userId: USER }));
      const ws = socketMock.last();
      await act(async () => { ws.open(); await Promise.resolve(); });

      await act(async () => {
        ws.emit({ type: 'event', event: evt(1, { type: CasinoEventType.HOT, tableId: 'hot-1', ts: Date.now() }) });
      });
      expect([...result.current.hotTables]).toEqual(['hot-1']);

      await act(async () => { await vi.advanceTimersByTimeAsync(HOT_WINDOW_MS - 1000); });
      expect([...result.current.hotTables]).toEqual(['hot-1']);

      await act(async () => { await vi.advanceTimersByTimeAsync(1002); });
      expect([...result.current.hotTables]).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not light up a table for a hot event that was already stale on arrival', async () => {
    serveEvents([evt(1, { type: CasinoEventType.HOT, tableId: 'old', ts: Date.now() - HOT_WINDOW_MS - 5_000 })]);
    const { result } = mount();

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(result.current.hotTables.size).toBe(0);
  });

  it('unsubscribes and closes the socket on unmount', async () => {
    serveEvents([]);
    const { unmount } = mount();
    const ws = await connect();

    unmount();
    expect(ws.sent.at(-1)).toEqual({ type: 'floor_unsub' });
    expect(ws.readyState).toBe(3);
  });

  it('does not reconnect after unmount', async () => {
    vi.useFakeTimers();
    try {
      serveEvents([]);
      const { unmount } = renderHook(() => useCasinoEvents({ wsUrl: WS_URL, userId: USER }));
      await act(async () => { socketMock.last().open(); await Promise.resolve(); });

      unmount();
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(socketMock.instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still backfills when there is no socket to open', async () => {
    serveEvents([evt(1), evt(2)]);
    const { result } = renderHook(() => useCasinoEvents({ wsUrl: null, userId: USER }));

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(socketMock.instances).toHaveLength(0);
    expect(result.current.status).toBe('offline');
  });

  it('opens nothing when disabled', async () => {
    serveEvents([evt(1)]);
    const { result } = mount({ enabled: false });

    expect(socketMock.instances).toHaveLength(0);
    expect(fetchMock.requestsMatching('/api/events')).toHaveLength(0);
    expect(result.current.status).toBe('idle');
  });

  it('survives a floor that is unreachable', async () => {
    // No route registered for /api/events — the harness answers 404.
    const { result } = mount();
    await act(async () => { await Promise.resolve(); });
    expect(result.current.events).toEqual([]);
    expect(result.current.latest).toBeNull();
  });
});

describe('protocol alignment', () => {
  it('names the same event types the server emits', () => {
    // Mirrors EventType in src/server/events.js. A rename on either side
    // silently empties byType() and hotTables, so pin the wire strings.
    expect(CasinoEventType).toEqual({
      BIG_POT: 'bigPot',
      COOLER: 'cooler',
      HEATER: 'heater',
      BUST: 'bust',
      NEMESIS_SEATED: 'nemesisSeated',
      HOT: 'hot',
    });
  });

  it('builds the poll URL the server documents', () => {
    expect(eventsUrl(0)).toBe('/api/events?since=0');
    expect(eventsUrl(42)).toBe('/api/events?since=42');
  });
});

beforeEach(() => {
  socketMock.reset();
});

afterEach(() => {
  vi.useRealTimers();
});
