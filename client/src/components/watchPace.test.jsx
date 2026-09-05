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
//   W5-5  the ceremony offers one tap into his thread, with the hand in hand

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
import { SHOWDOWN_HOLD_MS, CEREMONY_MS } from '../lib/pace.js';
import { resetHaptics } from '../lib/haptics.js';
import { DEAL_TOTAL_MS } from '../lib/deal.js';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const watchCss = () => readFileSync(resolve(clientRoot, 'src/styles/watch.css'), 'utf8');

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

describe('W5-3: the hand is called', () => {
  it('holds the showdown first, then names the winner and the pot', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(settledGame());
      expect(container.querySelector('.watch-ceremony')).toBeNull();

      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + 20); });
      const block = container.querySelector('.watch-ceremony');
      expect(block).toBeTruthy();
      expect(block.getAttribute('data-outcome')).toBe('won');
      expect(block.textContent).toContain('THE GRINDER WON');
      expect(block.textContent).toContain('$400');
    } finally {
      vi.useRealTimers();
    }
  });

  it('says who took it when it was not him', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(settledGame({
        result: { pot: 400, winners: [{ seat: 1, descr: 'a flush' }], showdown: [] },
      }));
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + 20); });
      const block = container.querySelector('.watch-ceremony');
      expect(block.getAttribute('data-outcome')).toBe('lost');
      expect(block.textContent).toContain('THE GRINDER LOST');
      expect(block.textContent).toContain('Doyle_v3 takes $400');
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves after three seconds, which is where the next deal starts', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(settledGame());
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + 20); });
      expect(container.querySelector('.watch-ceremony')).toBeTruthy();
      act(() => { vi.advanceTimersByTime(CEREMONY_MS); });
      expect(container.querySelector('.watch-ceremony')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('calls a hand once, however many terminal snapshots arrive', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(settledGame());
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + CEREMONY_MS + 50); });
      expect(container.querySelector('.watch-ceremony')).toBeNull();
      act(() => { rerenderWatch(rerender, settledGame({ pot: 401 })); });
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + 20); });
      expect(container.querySelector('.watch-ceremony')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says nothing at all while the hand is still being played', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(midHandGame);
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + CEREMONY_MS + 100); });
      expect(container.querySelector('.watch-ceremony')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('W5-5: one tap out of the ceremony', () => {
  it('opens his thread with the hand it is about', async () => {
    vi.useFakeTimers();
    const opened = [];
    try {
      const { container } = renderWatch(settledGame(), {
        onOpenThread: (ctx) => opened.push(ctx),
      });
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + 20); });
      const talk = container.querySelector('.watch-ceremony__talk');
      expect(talk.textContent).toBe('Talk to The Grinder about this hand');
      act(() => { talk.click(); });
      expect(opened).toEqual([{ handId: midHandGame.handNumber }]);
    } finally {
      vi.useRealTimers();
    }
  });

  // The header button asks to talk, not to talk about a hand. Handing it
  // straight to openChat would have made a click event the context.
  it('the header’s own Chat control opens the thread with no hand attached', async () => {
    const opened = [];
    renderWatch(midHandGame, { onOpenThread: (ctx) => opened.push(ctx) });
    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(opened).toEqual([null]);
  });

  // Without a thread to open the control must still do something, and what it
  // did before W4-5 is open the TABLE tab. A selected tab in a closed sheet is
  // nothing, so the sheet opens with it.
  it('falls back to the TABLE tab when there is no thread to open', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(settledGame());
      act(() => { vi.advanceTimersByTime(SHOWDOWN_HOLD_MS + 20); });
      act(() => { container.querySelector('.watch-ceremony__talk').click(); });
      expect(container.querySelector('.watch-sheet').getAttribute('data-detent')).toBe('expanded');
      expect(container.querySelector('.watch-tabs__tab.is-active').textContent).toBe('Table');
    } finally {
      vi.useRealTimers();
    }
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

  it('is not shown at all when the hand had nothing to answer for', async () => {
    routeAgent({ ...playingAgent, recentHands: [{ handNumber: 1, attrCosts: [] }] });
    const { container } = renderWatch(settledGame());
    await waitFor(() => expect(fetchMock.calls.length).toBeGreaterThan(0));
    // And the old copy is gone with it — an explanation that explains nothing
    // teaches the owner to stop reading the panel.
    expect(container.textContent).not.toContain('Nothing in this hand traced back');
    expect(container.textContent).not.toContain('Why the');
  });

  it('stays up through the next deal, and stands down at that hand’s flop', async () => {
    routeAgent(withCost);
    const { container, rerender } = renderWatch(settledGame());
    await screen.findByText(/Why the river went wrong/);

    // The next hand is dealt. The card is still there — this is exactly the
    // moment it used to disappear.
    act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2, street: 'preflop', community: [] }); });
    expect(container.textContent).toContain('Why the river went wrong');

    // That hand reaches its flop, and the card stands down.
    act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2, street: 'flop' }); });
    await waitFor(() => expect(container.textContent).not.toContain('Why the river went wrong'));
  });

  it('collapses into the hand’s own row in the TABLE record', async () => {
    routeAgent(withCost);
    const { container, rerender } = renderWatch(settledGame());
    await screen.findByText(/Why the river went wrong/);
    act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2, street: 'preflop', community: [] }); });
    act(() => { rerenderWatch(rerender, { ...midHandGame, handNumber: 2, street: 'flop' }); });

    const row = await waitFor(() => {
      const found = container.querySelector('.table-row--attr');
      expect(found).toBeTruthy();
      return found;
    });
    expect(row.textContent).toContain('HAND #1');
    expect(row.textContent).toContain('DISCIPLINE');
    expect(row.textContent).toContain('He called a river jam');
  });
});
