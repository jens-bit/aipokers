// client/src/components/watchThread.test.jsx — WATCH-8, job 1.
//
// THE THREAD SURVIVES. Before this the history sheet was assembled from
// whatever the socket happened to be awake for, so a reconnect got an empty
// sheet and a look back an hour later got nothing at all.
//
// Three rules, asserted through the screen rather than through the module —
// the module's own arithmetic is lib/thread.test.jsx:
//
//   1. The sheet asks the server for the record when it OPENS and again when
//      the connection COMES BACK.
//   2. It prints the SERVER's timestamps, not this device's.
//   3. Stored lines and live ones merge by id — one row each — and the four
//      registers (TABLE / HIM / YOU / an opponent under his own name) are
//      exactly what they were.

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

const AGENT = 'agent-1';
const SESSION = 'sess-7';

// 18:31 and 18:32 on a fixed day, so the printed clock is not "whenever the
// suite happened to run".
const T1 = new Date(2026, 8, 6, 18, 31, 0).getTime();
const T2 = new Date(2026, 8, 6, 18, 32, 0).getTime();

const storedThread = {
  sessionId: SESSION,
  count: 4,
  lines: [
    { id: 1, ts: T1, kind: 'table', who: 'TABLE', text: 'Granite raised to 240', source: 'table' },
    { id: 2, ts: T1 + 1000, kind: 'him', who: 'HIM', text: 'He has shown that sizing twice.', source: 'table' },
    { id: 3, ts: T2, kind: 'opponent', who: 'Granite', text: 'Again?', source: 'table' },
    { id: 4, ts: T2 + 1000, kind: 'you', who: 'YOU', text: 'Careful with him.', source: 'table' },
  ],
};

const withSession = (over = {}) => ({ ...midHandGame, sessionId: SESSION, ...over });

const base = {
  mySeat: 0,
  config: { ...spectatorConfig, agentId: AGENT },
  displayNames: { 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' },
  chatMessages: [],
  sendChat: () => {},
  onLeave: () => {},
  onSitOut: () => {},
};

const draw = (props = {}) => render(<WatchScreen game={withSession()} {...base} {...props} />);
const redraw = (rerender, props = {}) =>
  rerender(<WatchScreen game={withSession()} {...base} {...props} />);

const threadCalls = () => fetchMock.requestsMatching('/thread');

// Two things open it — his face and the composer's swipe handle. The face is
// the one the felt's own screenshots show a thumb landing on.
async function openSheet() {
  const user = userEvent.setup();
  await user.click(document.querySelector('.watch-hero__body'));
}

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents?', agentsResponse);
  fetchMock.route('/thread', () => storedThread);
});

describe('WATCH-8: the thread survives', () => {
  it('asks the server for this stay\'s record when the sheet is opened', async () => {
    draw();
    expect(threadCalls()).toHaveLength(0);

    await openSheet();
    await waitFor(() => expect(threadCalls().length).toBeGreaterThan(0));
    expect(threadCalls()[0].url).toContain(`/api/agents/${AGENT}/thread`);
    expect(threadCalls()[0].url).toContain(`session=${SESSION}`);
  });

  it('prints the record it was given, in the order the server kept it', async () => {
    draw();
    await openSheet();

    await screen.findByText('Granite raised to 240');
    const texts = [...document.querySelectorAll('.thread-row__text')].map((el) => el.textContent);
    expect(texts).toEqual([
      'Granite raised to 240',
      'He has shown that sizing twice.',
      '“Again?”',
      'Careful with him.',
    ]);
  });

  // TABLE / HIM / YOU / the opponent under his own name — unchanged.
  it('keeps the four registers', async () => {
    draw();
    await openSheet();
    await screen.findByText('Granite raised to 240');

    const rows = [...document.querySelectorAll('.thread-row')];
    expect(rows.map((r) => r.querySelector('.thread-row__who').textContent))
      .toEqual(['TABLE', 'HIM', 'GRANITE', 'YOU']);
    expect(rows.map((r) => r.className.replace('thread-row thread-row--', '')))
      .toEqual(['table', 'him', 'them', 'you']);
  });

  // "Two devices watching the same agent must not have to reconcile two
  // orderings of one conversation."
  it('prints the server\'s clock, not this device\'s', async () => {
    draw();
    await openSheet();
    await screen.findByText('Granite raised to 240');

    const at = [...document.querySelectorAll('.thread-row__at')].map((el) => el.textContent);
    expect(at).toEqual(['18:31', '18:31', '18:32', '18:32']);
  });

  // The record and what is being said now, as one list — and the line the
  // socket delivered that the store also has is printed once.
  it('merges the record with what is being said now, by id', async () => {
    // The store's copy of a line the socket is ALSO delivering right now — the
    // shape a reconnect makes, where a refetch overlaps what is still arriving.
    const echoed = 'He has shown that sizing twice.';
    fetchMock.route('/thread', () => ({
      sessionId: SESSION,
      lines: [
        { id: 1, ts: Date.now() - 4000, kind: 'table', who: 'TABLE', text: 'Granite raised to 240' },
        { id: 2, ts: Date.now() - 2000, kind: 'him', who: 'HIM', text: echoed },
      ],
    }));

    const { rerender } = draw();
    act(() => {
      redraw(rerender, {
        lastDecision: { seat: 0, action: { type: 'raise', amount: 240 }, reasoning: echoed },
      });
    });
    await openSheet();
    await screen.findByText('Granite raised to 240');

    const rowText = () => [...document.querySelectorAll('.thread-row__text')].map((el) => el.textContent);
    // Two stored lines and no third: the reasoning the socket just delivered is
    // the one the store already has, and the STORED copy is the one kept.
    expect(rowText()).toHaveLength(2);
    expect(rowText().filter((t) => t.includes('shown that sizing twice'))).toHaveLength(1);

    // ...and something genuinely new is added on the end.
    act(() => {
      redraw(rerender, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, reasoning: 'He is done.' },
      });
    });
    await waitFor(() => expect(rowText()).toHaveLength(3));
    expect(rowText()[2]).toBe('He is done.');
  });

  // The record the table wrote while the owner was gone is exactly the part he
  // cannot have heard, so coming back is the other moment it has to be asked
  // for. The sheet does not have to be open — it has to be right when it opens.
  it('asks again when the connection comes back', async () => {
    const { rerender } = draw({ connection: 'watching' });
    expect(threadCalls()).toHaveLength(0);

    act(() => { redraw(rerender, { connection: 'reconnecting' }); });
    expect(threadCalls()).toHaveLength(0);

    act(() => { redraw(rerender, { connection: 'watching' }); });
    await waitFor(() => expect(threadCalls()).toHaveLength(1));
  });

  it('does not ask on every render, only on the way back up', async () => {
    const { rerender } = draw({ connection: 'watching' });
    act(() => { redraw(rerender, { connection: 'playing' }); });
    act(() => { redraw(rerender, { connection: 'watching' }); });
    expect(threadCalls()).toHaveLength(0);
  });

  // "It is his stay that ended, and his stay the ceremony summarises." A new
  // session is a new thread; carrying the last one's lines into it would be
  // the sheet inventing a conversation.
  it('drops the record when a new stay begins', async () => {
    const { rerender } = draw();
    await openSheet();
    await screen.findByText('Granite raised to 240');

    act(() => {
      rerender(<WatchScreen game={withSession({ sessionId: 'sess-8' })} {...base} />);
    });
    await waitFor(() => {
      expect(screen.queryByText('Granite raised to 240')).toBeNull();
    });
  });

  // A thread that can break the felt is worse than no thread.
  it('shows the felt, and the live lines, when the record cannot be fetched', async () => {
    fetchMock.route('/thread', () => ({ status: 500, body: {} }));
    const { container, rerender } = draw();
    act(() => {
      redraw(rerender, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, reasoning: 'He is done.' },
      });
    });
    await openSheet();
    expect(container.querySelector('.watch-felt')).toBeTruthy();
    await waitFor(() => {
      const rows = [...container.querySelectorAll('.thread-row__text')].map((el) => el.textContent);
      expect(rows).toEqual(['He is done.']);
    });
  });

  it('asks for nothing at all when there is no agent behind the seat', async () => {
    render(<WatchScreen game={withSession()} {...base}
      config={{ ...spectatorConfig, agentId: null }} />);
    await openSheet();
    expect(threadCalls()).toHaveLength(0);
  });
});

// ── BUGS-A job 11 ───────────────────────────────────────────────────────────
//
// What you whispered and what he said back, in order, with YOU on your line.
// The whisper on the felt and the row in the record are ONE event with two
// drawings of it, and the felt must never draw one the record does not get.

describe('BUGS-A job 11 · a whisper is in the record', () => {
  const whisper = async (text) => {
    const user = userEvent.setup();
    const input = document.querySelector('.watch-composer__input');
    await user.type(input, text);
    await user.click(document.querySelector('.watch-composer__send'));
  };

  it('shows what you whispered and his reply, in order, with YOU on yours', async () => {
    fetchMock.route('/thread', () => ({ sessionId: SESSION, count: 0, lines: [] }));
    fetchMock.route('/api/agents/chat', () => ({
      chat: [{ role: 'assistant', content: 'Understood. Tightening up.' }],
    }), { method: 'POST' });
    draw();

    await whisper('Careful with him.');
    await openSheet();

    await screen.findByText('Understood. Tightening up.');
    const rows = [...document.querySelectorAll('.thread-row')];
    expect(rows.map((r) => r.querySelector('.thread-row__who').textContent)).toEqual(['YOU', 'HIM']);
    expect(rows.map((r) => r.querySelector('.thread-row__text').textContent))
      .toEqual(['Careful with him.', 'Understood. Tightening up.']);
  });

  // It used to rise up the felt, be gone in four seconds, and never reach the
  // thread — the owner had said something to nobody.
  it('draws no whisper at a table with no agent of yours at it', async () => {
    render(<WatchScreen game={withSession()} {...base}
      config={{ ...spectatorConfig, agentId: null }} />);

    expect(document.querySelector('.watch-composer__input').disabled).toBe(true);
    await whisper('Careful with him.');
    expect(document.querySelector('.watch-whisper')).toBeNull();
  });

  it('takes no second line while he is still answering the first', async () => {
    fetchMock.route('/thread', () => ({ sessionId: SESSION, count: 0, lines: [] }));
    let answer;
    fetchMock.route('/api/agents/chat', () => new Promise((r) => { answer = r; }), { method: 'POST' });
    draw();

    await whisper('One.');
    await waitFor(() => expect(document.querySelector('.watch-composer__input').disabled).toBe(true));
    await whisper('Two.');
    // One whisper on the felt, because one line went to the server.
    expect(document.querySelectorAll('.watch-whisper')).toHaveLength(1);
    answer({ chat: [] });
  });
});
