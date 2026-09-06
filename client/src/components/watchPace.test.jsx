// client/src/components/watchPace.test.jsx — W5-2, W5-3, W5-4, W5-5
//
// Pacing, on the felt. The playtest said three things about WATCH-4: there is
// no time to react, folds don't feel like anything, and the one card that
// explains a loss is gone before it can be read.
//
//   W5-2  a fold throws its cards at the muck, and the seat dims after they
//         land — one event, not two
//   W5-3  the hand is called: a block over the felt naming who won and for how
//         much, inside the showdown's own dwell
//   W5-4  "why the hand went wrong" is pinned through the next deal, then
//         collapses into the TABLE tab — and is not shown at all when the hand
//         had nothing to answer for
//   W5-5  one tap out of the felt and into his thread
//
// WATCH-7 rewrites W5-3 and W5-5: a hand end is a toast, and the ceremony is a
// session moment. See the block comment above those describes.

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WatchScreen, MUCK_MS } from './WatchScreen.jsx';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse, playingAgent } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';
import { SHOWDOWN_HOLD_MS, SETTLE_MS, RESULT_TOAST_MS, STACK_TICK_MS } from '../lib/pace.js';
import { resetHaptics } from '../lib/haptics.js';
import { DEAL_TOTAL_MS } from '../lib/deal.js';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const watchCss = () => readFileSync(resolve(clientRoot, 'src/styles/watch.css'), 'utf8');
const watch6Css = () => readFileSync(resolve(clientRoot, 'src/styles/watch6.css'), 'utf8');

function renderWatch(game, props = {}) {
  return render(
    <WatchScreen
      game={game}
      mySeat={0}
      config={spectatorConfig}
      displayNames={{ 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' }}
      chatMessages={[]}
      sendChat={() => {}}
      onLeave={() => {}}
      onSitOut={() => {}}
      {...props}
    />,
  );
}

const rerenderWatch = (rerender, game, props = {}) => rerender(
  <WatchScreen
    game={game}
    mySeat={0}
    config={spectatorConfig}
    displayNames={{ 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' }}
    chatMessages={[]}
    sendChat={() => {}}
    onLeave={() => {}}
    onSitOut={() => {}}
    {...props}
  />,
);

const foldSeat = (game, seat) => ({
  ...game,
  seats: game.seats.map((s, i) => (i === seat ? { ...s, folded: true } : s)),
});

// A finished hand still on the felt: the terminal STATE, with the result the
// engine put on it.
const settledGame = (over = {}) => ({
  ...midHandGame,
  street: 'complete',
  result: { pot: 400, winners: [{ seat: 0, descr: 'two pair' }], showdown: [] },
  ...over,
});

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', agentsResponse);
  resetHaptics();
});

describe('W5-2: a fold throws something away', () => {
  it('keeps the folded seat’s cards on the felt for the length of the throw', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      const backsFor = (seat) => container
        .querySelectorAll('.watch-felt__seat')[seat]
        .querySelector('.seat-ghost__backs');

      // W4-1's deal beat has to finish before the table has any backs to throw.
      act(() => { vi.advanceTimersByTime(DEAL_TOTAL_MS + 20); });

      // Doyle_v3 is the first opponent seat on the felt.
      expect(backsFor(0)).toBeTruthy();
      act(() => { rerenderWatch(rerender, foldSeat(midHandGame, 1)); });

      // Still there, and now being thrown.
      expect(backsFor(0)).toBeTruthy();
      expect(backsFor(0).className).toContain('is-mucking');
    } finally {
      vi.useRealTimers();
    }
  });

  it('dims the seat only once the cards have landed', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      const ghost = () => container.querySelectorAll('.watch-felt__seat')[0].querySelector('.seat-ghost');

      act(() => { rerenderWatch(rerender, foldSeat(midHandGame, 1)); });
      // Mid-throw: full strength. A seat that greys out while its cards are in
      // the air reads as two events.
      expect(ghost().className).not.toContain('is-folded');

      act(() => { vi.advanceTimersByTime(MUCK_MS + 20); });
      expect(ghost().className).toContain('is-folded');
      expect(container.querySelectorAll('.watch-felt__seat')[0]
        .querySelector('.seat-ghost__backs')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws his own cards too, the other way up the felt', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      act(() => { rerenderWatch(rerender, foldSeat(midHandGame, 0)); });
      const thrown = container.querySelectorAll('.watch-felt__hero-card[data-mucking="yes"]');
      expect(thrown).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not replay the last hand’s mucks when the next one is dealt', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(foldSeat(midHandGame, 1));
      act(() => { vi.advanceTimersByTime(MUCK_MS + 20); });
      act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2 }); });
      expect(container.querySelector('.seat-ghost__backs.is-mucking')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // 350ms, an arc, 15–25° of turn, and a plain fade when the phone asks for
  // one. jsdom computes no animation, so the rules themselves are the assertion.
  it('is 350ms of transform, and a plain fade under prefers-reduced-motion', () => {
    const css = watchCss();
    expect(css).toMatch(/animation:\s*watch-muck 350ms/);
    expect(MUCK_MS).toBe(350);
    const turns = [...css.matchAll(/--muck-turn:\s*(-?\d+)deg/g)].map((m) => Math.abs(Number(m[1])));
    expect(turns.length).toBeGreaterThan(0);
    for (const t of turns) {
      expect(t).toBeGreaterThanOrEqual(15);
      expect(t).toBeLessThanOrEqual(25);
    }
    const reduced = css.slice(css.indexOf('watch-muck-fade') - 400);
    expect(reduced).toMatch(/animation:\s*watch-muck-fade/);
  });
});

// WATCH-7 replaces W5-3 and W5-5 outright, and the rule they encoded is gone
// on purpose rather than by accident.
//
// W5-3 said: at the end of every hand, hold the showdown for a second and then
// take the felt with a WON/LOST block for three more. W5-5 said: that block
// offers "Deal him in" and one tap into his thread. Both were correct
// implementations of a brief the playtest overturned — the block is a SESSION
// moment, and firing it forty times a session made it furniture and put a wall
// between the owner and his own table every hand.
//
// So: a hand end is quiet (the toast below), and the ceremony belongs to
// SESSION_END. The old assertions are not loosened here, they are inverted —
// the felt must now be CLEAR at the end of a hand, which is a stricter thing to
// prove than the block being present.
const wonBig = (over = {}) => settledGame({
  seats: midHandGame.seats.map((s, i) => (i === 0 ? { ...s, stack: 1340 } : s)),
  ...over,
});

describe('WATCH-7: a hand ends quietly', () => {
  it('never puts the WON/LOST block on the felt at the end of a hand', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(settledGame());
      // Right through the old hold, the old ceremony, and out the far side.
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + SETTLE_MS + 500); });
      expect(container.querySelector('.watch-ceremony')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows what the hand did to him, over his strip, and takes it away again', () => {
    vi.useFakeTimers();
    try {
      // Dealt at 940, the hand ends with him on 1,340: +$400.
      const { container, rerender } = renderWatch(midHandGame);
      act(() => { rerenderWatch(rerender, wonBig()); });

      const toast = container.querySelector('.watch-result-toast');
      expect(toast).toBeTruthy();
      expect(toast.textContent).toBe('+$400');
      expect(toast.className).toContain('is-won');
      // It hangs off his strip — not off the felt, so it can never land on
      // the board or on him.
      expect(container.querySelector('.watch-hero__strip .watch-result-toast')).toBeTruthy();

      act(() => { vi.advanceTimersByTime(RESULT_TOAST_MS + 20); });
      expect(container.querySelector('.watch-result-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says it in red when the hand cost him', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      act(() => {
        rerenderWatch(rerender, settledGame({
          result: { pot: 400, winners: [{ seat: 1 }], showdown: [] },
          seats: midHandGame.seats.map((s, i) => (i === 0 ? { ...s, stack: 910 } : s)),
        }));
      });
      const toast = container.querySelector('.watch-result-toast');
      expect(toast.textContent).toBe('−$30');
      expect(toast.className).toContain('is-lost');
    } finally {
      vi.useRealTimers();
    }
  });

  // WATCH-7 item 4: the server's own number wins wherever it is sent.
  it('prefers result.deltas over the stack it derived', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      act(() => {
        rerenderWatch(rerender, wonBig({
          result: { pot: 400, winners: [{ seat: 0 }], showdown: [], deltas: { 0: 175, 1: -175 } },
        }));
      });
      expect(container.querySelector('.watch-result-toast').textContent).toBe('+$175');
    } finally {
      vi.useRealTimers();
    }
  });

  // The stack is the only place a lost hand leaves a mark, so it has to be seen
  // moving. It starts where the hand started and arrives at the new number.
  it('ticks his stack from what he had to what he has', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      const stackText = () => container
        .querySelector('.watch-hero__stack-row .watch-felt__hero-num').textContent;
      expect(stackText()).toBe('$940');

      act(() => { rerenderWatch(rerender, wonBig()); });
      // The snapshot already says 1,340; the felt is still showing where he was.
      expect(stackText()).toBe('$940');

      // Mid-tick it is neither number — it is on its way.
      act(() => { vi.advanceTimersByTime(Math.round(STACK_TICK_MS / 3)); });
      const mid = Number(stackText().replace(/[^0-9]/g, ''));
      expect(mid).toBeGreaterThan(940);
      expect(mid).toBeLessThan(1340);

      act(() => { vi.advanceTimersByTime(STACK_TICK_MS + 100); });
      expect(stackText()).toBe('$' + (1340).toLocaleString());
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls a hand once, however many terminal snapshots arrive', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      act(() => { rerenderWatch(rerender, wonBig()); });
      act(() => { vi.advanceTimersByTime(RESULT_TOAST_MS + 50); });
      expect(container.querySelector('.watch-result-toast')).toBeNull();

      act(() => { rerenderWatch(rerender, wonBig({ pot: 401 })); });
      expect(container.querySelector('.watch-result-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says nothing at all while the hand is still being played', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(midHandGame);
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + SETTLE_MS + 100); });
      expect(container.querySelector('.watch-result-toast')).toBeNull();
      expect(container.querySelector('.watch-ceremony')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // Joining mid-hand leaves no baseline, and a server that has not shipped
  // deltas yet leaves nothing else. "+$0" would be the screen inventing a
  // result for a hand it never saw.
  it('shows no toast when it cannot know what the hand did to him', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(settledGame());
      expect(container.querySelector('.watch-result-toast')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // "Nothing blocks the felt."
  it('cannot be tapped and does not silence him', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      act(() => { rerenderWatch(rerender, wonBig()); });
      const toast = container.querySelector('.watch-result-toast');
      expect(toast.querySelector('button')).toBeNull();
      // jsdom does not compute pointer-events, so the rule is the assertion —
      // the same way W5-2 checks the muck animation.
      expect(watch6Css()).toMatch(
        /\.watch-result-toast\s*\{[^}]*pointer-events:\s*none/,
      );
      // The board is still on the felt behind it — no scrim, no block.
      expect(container.querySelector('.watch-felt__board')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('WATCH-7: the ceremony belongs to the end of the session', () => {
  const ended = (over = {}) => ({ reason: 'sat out by owner', hands: 42, ...over });
  const busted = settledGame({
    seats: midHandGame.seats.map((s, i) => (i === 0 ? { ...s, stack: 0 } : s)),
  });

  it('does not appear until the session is over', () => {
    const { container, rerender } = renderWatch(settledGame());
    expect(container.querySelector('.watch-ceremony')).toBeNull();
    act(() => { rerenderWatch(rerender, settledGame(), { sessionEnd: ended() }); });
    expect(container.querySelector('.watch-ceremony')).toBeTruthy();
  });

  it('names the night, the net against the buy-in, and where he finished', () => {
    const { container } = renderWatch(wonBig(), { sessionEnd: ended() });
    const block = container.querySelector('.watch-ceremony');
    expect(block.getAttribute('data-scope')).toBe('session');
    expect(block.getAttribute('data-outcome')).toBe('won');
    expect(block.textContent).toContain('THE GRINDER · TONIGHT');
    expect(block.querySelector('.watch-ceremony__head').textContent).toBe('WON');
    // spectatorConfig buys in for 1,000.
    expect(block.querySelector('.watch-ceremony__delta-amt').textContent).toBe('+$340');
    expect(block.textContent).toContain('$' + (1340).toLocaleString());
    expect(block.querySelector('.watch-ceremony__took').textContent).toContain('42 HANDS');
  });

  it('offers the floor and the conversation when he still has chips', () => {
    const { container } = renderWatch(settledGame(), { sessionEnd: ended() });
    const labels = [...container.querySelectorAll('.watch-ceremony__acts .watch-btn')]
      .map((b) => b.textContent);
    expect(labels).toEqual(['Back to the floor', 'Talk to The Grinder about tonight']);
  });

  // A busted agent has one thing he needs and it is not conversation.
  it('offers chips first when he busted', () => {
    const { container } = renderWatch(busted, {
      sessionEnd: ended({ reason: 'someone ran out of chips — session over' }),
    });
    const block = container.querySelector('.watch-ceremony');
    expect(block.querySelector('.watch-ceremony__head').textContent).toBe('BUSTED');
    const labels = [...block.querySelectorAll('.watch-ceremony__acts .watch-btn')]
      .map((b) => b.textContent);
    expect(labels).toEqual(['Fund him again', 'Back to the floor']);
    expect(block.querySelector('.watch-ceremony__fund').className).toContain('watch-btn--primary');
  });

  it('takes the two ways out to the handlers the app gave it', () => {
    const seen = [];
    const { container } = renderWatch(busted, {
      sessionEnd: ended(),
      onFund: () => seen.push('fund'),
      onBackToFloor: () => seen.push('floor'),
    });
    act(() => { container.querySelector('.watch-ceremony__fund').click(); });
    act(() => { container.querySelector('.watch-ceremony__floor').click(); });
    expect(seen).toEqual(['fund', 'floor']);
  });

  it('opens his thread with no hand attached — it is about the night', () => {
    const opened = [];
    const { container } = renderWatch(settledGame(), {
      sessionEnd: ended(),
      onOpenThread: (ctx) => opened.push(ctx),
    });
    act(() => { container.querySelector('.watch-ceremony__talk').click(); });
    expect(opened).toEqual([null]);
  });

  // The one line the brief is explicit about: "No 'Deal him in' anywhere."
  it('never offers to deal him in', () => {
    const { container } = renderWatch(settledGame(), { sessionEnd: ended() });
    expect(container.textContent).not.toContain('Deal him in');
  });
});

describe('W5-5: one tap out of the felt', () => {
  // The header button asks to talk, not to talk about a hand. Handing it
  // straight to openChat would have made a click event the context.
  it('the header’s own Chat control opens the thread with no hand attached', async () => {
    const opened = [];
    renderWatch(midHandGame, { onOpenThread: (ctx) => opened.push(ctx) });
    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(opened).toEqual([null]);
  });

  // Without a thread to open the control must still do something. WATCH-6
  // re-expressed: what it opens is the record, as a layer over the felt.
  it('falls back to the record over the felt when there is no thread to open', async () => {
    const { container } = renderWatch(midHandGame);
    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(container.querySelector('.thread-sheet')).not.toBeNull();
  });
});

describe('W5-4: why the hand went wrong, pinned', () => {
  const withCost = {
    ...playingAgent,
    recentHands: [{
      handNumber: 1,
      attrCosts: [{ key: 'DISCIPLINE', line: 'He called a river jam he had already decided to fold.', street: 'river' }],
    }],
  };

  const routeAgent = (agent) => fetchMock.route('/api/agents', { agents: [agent] });

  // WATCH-6 re-expressed: the pin is no longer a panel card in a sheet nobody
  // may have open. It is ONE LINE under his strip, in the hero column, where
  // the owner is already looking — and it still stands down at the next flop
  // and still collapses into the thread as a TABLE entry.
  const pin = (c) => c.querySelector('.watch-hero__cost');

  it('is not shown at all when the hand had nothing to answer for', async () => {
    routeAgent({ ...playingAgent, recentHands: [{ handNumber: 1, attrCosts: [] }] });
    const { container } = renderWatch(settledGame());
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(0));
    expect(pin(container)).toBeNull();
    // And the old copy is gone with it — an explanation that explains nothing
    // teaches the owner to stop reading it.
    expect(container.textContent).not.toContain('Nothing in this hand traced back');
  });

  it('stays up through the next deal, and stands down at that hand’s flop', async () => {
    routeAgent(withCost);
    const { container, rerender } = renderWatch(settledGame());
    await screen.findByText(/He called a river jam/);
    expect(pin(container)).toBeTruthy();
    // It is under his strip, in his column — not floating over the felt.
    expect(container.querySelector('.watch-hero').contains(pin(container))).toBe(true);
    expect(pin(container).querySelector('.watch-hero__cost-key').textContent).toBe('DISCIPLINE');

    // The next hand is dealt. The line is still there — this is exactly the
    // moment it used to disappear.
    act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2, street: 'preflop', community: [] }); });
    expect(pin(container)).toBeTruthy();

    // That hand reaches its flop, and it stands down.
    act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2, street: 'flop' }); });
    await waitFor(() => expect(pin(container)).toBeNull());
  });

  it('collapses into a TABLE row in the thread', async () => {
    routeAgent(withCost);
    const { container, rerender } = renderWatch(settledGame());
    await screen.findByText(/He called a river jam/);
    act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2, street: 'preflop', community: [] }); });
    act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2, street: 'flop' }); });
    await waitFor(() => expect(pin(container)).toBeNull());

    act(() => { screen.getByRole('button', { name: 'Chat' }).click(); });
    const row = await waitFor(() => {
      const found = [...container.querySelectorAll('.thread-row')]
        .find((el) => el.textContent.includes('He called a river jam'));
      expect(found).toBeTruthy();
      return found;
    });
    // TABLE attribution, in the gold the cost already owns.
    expect(row.querySelector('.thread-row__who').textContent).toBe('TABLE');
    expect(row.className).toContain('is-cost');
    expect(row.textContent).toContain('DISCIPLINE');
  });
});
