// client/src/lib/thread.js — WATCH-8, job 1.
//
// "The thread survives." Before this the sheet was assembled from whatever the
// socket happened to be awake for: a reconnect got an empty sheet and a look
// back an hour later got nothing at all.

import { describe, expect, it } from 'vitest';

import {
  ECHO_WINDOW_MS, ThreadKind,
  isReconnect, mergeThread, rowFromLine, rowsFromThread, threadUrl,
} from './thread.js';

const line = (over = {}) => ({
  id: 1, sessionId: 's-1', tableId: 't1', ts: 1_700_000_000_000,
  kind: 'table', who: 'TABLE', text: 'Granite raised to 240', source: 'table', ...over,
});

describe('the request', () => {
  it('names the agent and the stay', () => {
    expect(threadUrl({ agentId: 'a1', sessionId: 'sess-9', userId: 'u1' }))
      .toBe('/api/agents/a1/thread?userId=u1&session=sess-9');
  });

  // "A client that has just reconnected knows which AGENT it was watching and
  // not which stay" — so the session is optional and the server answers with
  // his most recent one. One request, not a negotiation.
  it('leaves the stay off when it does not know one', () => {
    expect(threadUrl({ agentId: 'a1', userId: 'u1' }))
      .toBe('/api/agents/a1/thread?userId=u1');
  });

  it('asks for nothing when there is no agent to ask about', () => {
    expect(threadUrl({ sessionId: 'sess-9', userId: 'u1' })).toBeNull();
  });
});

describe('a stored line', () => {
  // TABLE / HIM / YOU / the opponent's own name — unchanged from what the felt
  // has always drawn.
  it('keeps the four registers', () => {
    expect(rowFromLine(line({ kind: 'table' })).who).toBe('TABLE');
    expect(rowFromLine(line({ kind: 'him', who: 'HIM' })).who).toBe('HIM');
    expect(rowFromLine(line({ kind: 'you', who: 'YOU' })).who).toBe('YOU');
    expect(rowFromLine(line({ kind: 'opponent', who: 'Granite' })).who).toBe('GRANITE');
  });

  // "A player who renames himself TABLE cannot borrow the room's voice." The
  // row is drawn from the server's closed `kind`; the label is only text.
  it('will not let a seat borrow the room\'s voice', () => {
    const r = rowFromLine(line({ kind: 'opponent', who: 'TABLE', text: 'the pot is mine' }));
    expect(r.kind).toBe(ThreadKind.OPPONENT);
    expect(r.who).toBe('TABLE');
  });

  it('falls back to the room for a kind it does not know', () => {
    expect(rowFromLine(line({ kind: 'whatever' })).kind).toBe(ThreadKind.TABLE);
  });

  // The server's clock is the clock: two devices watching the same agent must
  // not have to reconcile two orderings of one conversation.
  it('carries the server\'s timestamp, untouched', () => {
    expect(rowFromLine(line({ ts: 1_699_000_000_123 })).t).toBe(1_699_000_000_123);
  });

  // WATCH-9. The room's voice has one line in it that is not neutral — where a
  // low attribute cost him the hand — and the sheet draws that one in gold. It
  // was a flag the felt put on its own live row and nothing more, so a
  // refetched thread came back with the line in the room's ordinary grey.
  it('WATCH-9: carries the gold register back off the store', () => {
    expect(rowFromLine(line({ kind: 'table', cost: true })).cost).toBe(true);
  });

  it('WATCH-9: and says nothing at all about the lines that are not one', () => {
    const r = rowFromLine(line({ kind: 'table' }));
    expect('cost' in r).toBe(false);
  });

  it('is skipped when it is not a line at all', () => {
    expect(rowFromLine(null)).toBeNull();
    expect(rowFromLine({ id: 2, kind: 'table' })).toBeNull();
    expect(rowsFromThread({ lines: [line(), null, { id: 3 }] })).toHaveLength(1);
    expect(rowsFromThread(null)).toEqual([]);
    expect(rowsFromThread({})).toEqual([]);
  });
});

describe('the merge', () => {
  const stored = [
    rowFromLine(line({ id: 1, ts: 100, kind: 'table', text: 'Granite raised to 240' })),
    rowFromLine(line({ id: 2, ts: 200, kind: 'him', who: 'HIM', text: 'He checked twice.' })),
  ];

  it('puts the record and what is being said now in one order', () => {
    const live = [{ id: 'd7', who: 'HIM', kind: 'him', text: 'He is done.', t: 300 }];
    expect(mergeThread(stored, live).map((r) => r.text)).toEqual([
      'Granite raised to 240', 'He checked twice.', 'He is done.',
    ]);
  });

  it('is one row per id, however many times it is merged', () => {
    const once = mergeThread(stored, []);
    expect(mergeThread(once, once)).toHaveLength(2);
    expect(mergeThread(stored.concat(stored), [])).toHaveLength(2);
  });

  // A reconnect refetches the store while the socket is still delivering, so
  // the same sentence arrives down both paths. The stored copy wins — it is the
  // one carrying the server's clock.
  it('prints a line heard both ways once, and keeps the server\'s copy', () => {
    const live = [{ id: 'd7', who: 'HIM', kind: 'him', text: 'He checked twice.', t: 209 }];
    const rows = mergeThread(stored, live);
    expect(rows).toHaveLength(2);
    expect(rows[1].id).toBe('s2');
    expect(rows[1].t).toBe(200);
  });

  // ...but somebody repeating themselves is two lines, and a merge that ate
  // the second one would be editing the conversation.
  it('keeps a line genuinely said twice', () => {
    const live = [{
      id: 'd7', who: 'HIM', kind: 'him', text: 'He checked twice.',
      t: 200 + ECHO_WINDOW_MS + 1,
    }];
    expect(mergeThread(stored, live)).toHaveLength(3);
  });

  it('survives a live row with no id and a payload with nothing in it', () => {
    expect(mergeThread(stored, [null, { text: 'no id' }])).toHaveLength(2);
    expect(mergeThread([], [])).toEqual([]);
    expect(mergeThread()).toEqual([]);
  });

  // A tie on the clock has to resolve the same way on every render, or the
  // sheet reshuffles itself while it is being read.
  it('orders a tie the same way every time', () => {
    const a = [{ id: 's5', t: 500, text: 'stored', stored: true }];
    const b = [{ id: 'd1', t: 500, text: 'live' }];
    expect(mergeThread(a, b).map((r) => r.text)).toEqual(['stored', 'live']);
    expect(mergeThread(a, b).map((r) => r.text)).toEqual(['stored', 'live']);
  });
});

describe('the reconnect', () => {
  it('is the connection coming back up, and only that', () => {
    expect(isReconnect('reconnecting', 'watching')).toBe(true);
    expect(isReconnect('connecting', 'playing')).toBe(true);
    expect(isReconnect('closed', 'waiting')).toBe(true);

    // Not a reconnect: still down, still up, or going down.
    expect(isReconnect('reconnecting', 'connecting')).toBe(false);
    expect(isReconnect('watching', 'playing')).toBe(false);
    expect(isReconnect('watching', 'reconnecting')).toBe(false);
    expect(isReconnect(undefined, 'watching')).toBe(false);
  });
});
