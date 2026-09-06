// client/src/hooks/useTableThread.test.jsx — WATCH-9
//
// The hook that feeds both thread surfaces: the phone's glass sheet and the
// desk's rail. WATCH-8 gave it a fetch — on open, and again on a reconnect —
// and that was the whole of it, which made an open sheet a snapshot: the table
// kept talking and the sheet stayed as it was until it was closed and opened
// again.
//
// WATCH-9 added the push. What is asserted here is the JOIN, because that is
// where the two halves can go wrong: the same line arriving down both doors
// must be one row, a line from another stay must not appear at all, and the
// fetch must still be what a reconnect uses.

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useTableThread } from './useTableThread.js';
import { fetchMock, telegram } from '../test/harness.js';

const AGENT = 'agent_1';
const STAY = 's_stay1';

const stored = (over = {}) => ({
  id: 1, ts: 1_700_000_000_000, kind: 'table', who: 'TABLE', text: 'Granite raised to 240', ...over,
});

const serve = (lines) => fetchMock.route(/\/thread\?/, () => ({ sessionId: STAY, lines, count: lines.length }));

const mount = (props = {}) => renderHook(
  () => useTableThread({ agentId: AGENT, sessionId: STAY, want: true, ...props }),
);

describe('WATCH-9 · the fetch and the push, as one thread', () => {
  beforeEach(() => { telegram.signIn(); });

  it('is the fetched record when nothing has been pushed', async () => {
    serve([stored({ id: 1, text: 'Granite raised to 240' })]);
    const { result } = mount();
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].text).toBe('Granite raised to 240');
  });

  // The whole point: the sheet is already open, nothing is refetched, and the
  // next thing said appears anyway.
  it('shows a pushed line without waiting for another fetch', async () => {
    serve([stored({ id: 1 })]);
    const { result, rerender } = renderHook(
      ({ pushed }) => useTableThread({ agentId: AGENT, sessionId: STAY, want: true, pushed }),
      { initialProps: { pushed: [] } },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));
    const asked = fetchMock.requestsMatching(/\/thread\?/).length;

    rerender({ pushed: [{ id: 2, ts: 1_700_000_001_000, kind: 'him', who: 'HIM', text: 'Not this time.', sessionId: STAY }] });
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current.at(-1).text).toBe('Not this time.');
    expect(result.current.at(-1).kind).toBe('him');
    expect(fetchMock.requestsMatching(/\/thread\?/).length).toBe(asked);
  });

  it('a line that arrived down BOTH doors is one line, not two', async () => {
    serve([stored({ id: 7, text: 'The Grinder took 30 uncontested' })]);
    const { result } = mount({
      pushed: [{ id: 7, ts: 1_700_000_000_000, kind: 'table', who: 'TABLE', text: 'The Grinder took 30 uncontested', sessionId: STAY }],
    });
    await waitFor(() => expect(result.current).toHaveLength(1));
  });

  it('keeps the gold register on a pushed line, the same as on a fetched one', async () => {
    serve([]);
    const { result } = mount({
      pushed: [{ id: 3, ts: 5, kind: 'table', who: 'TABLE', text: 'he misjudged equity by 7 points · FOCUS', cost: true, sessionId: STAY }],
    });
    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].cost).toBe(true);
  });

  it('leaves another man\'s stay out of it — the socket outlives a session', async () => {
    serve([stored({ id: 1 })]);
    const { result } = mount({
      pushed: [
        { id: 2, ts: 2, kind: 'table', who: 'TABLE', text: 'mine', sessionId: STAY },
        { id: 3, ts: 3, kind: 'table', who: 'TABLE', text: 'somebody else\'s', sessionId: 's_other' },
      ],
    });
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(result.current.map((r) => r.text)).not.toContain('somebody else\'s');
  });

  it('orders them by the server\'s clock, whichever door they came through', async () => {
    serve([stored({ id: 4, ts: 30, text: 'third' }), stored({ id: 2, ts: 10, text: 'first' })]);
    const { result } = mount({
      pushed: [{ id: 3, ts: 20, kind: 'table', who: 'TABLE', text: 'second', sessionId: STAY }],
    });
    await waitFor(() => expect(result.current).toHaveLength(3));
    expect(result.current.map((r) => r.text)).toEqual(['first', 'second', 'third']);
  });

  it('is unbothered by a host that pushes nothing, or nonsense', async () => {
    serve([stored({ id: 1 })]);
    const { result } = mount({ pushed: null });
    await waitFor(() => expect(result.current).toHaveLength(1));
  });

  it('a new stay is a new thread', async () => {
    serve([stored({ id: 1, text: 'last night' })]);
    const { result, rerender } = renderHook(
      ({ session }) => useTableThread({ agentId: AGENT, sessionId: session, want: true }),
      { initialProps: { session: STAY } },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));

    serve([]);
    rerender({ session: 's_stay2' });
    await waitFor(() => expect(result.current).toHaveLength(0));
  });
});
