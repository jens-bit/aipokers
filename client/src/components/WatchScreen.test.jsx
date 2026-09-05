// client/src/components/WatchScreen.test.jsx — TEST-1
//
// The fish tank. Watching is passive: the felt reports what the table is
// doing, and the owner — and only the owner — sees their own agent's hole
// cards face up. Between hands the felt holds a calm state rather than
// swapping itself out for a spinner.

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { betweenHandsGame, midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';
import { FLIP_MS } from '../lib/pace.js';

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

// A card face renders its rank as text inside .watch-felt; a card back does
// not. This is how the felt tells "shown" from "face down" on screen.
function faceUpRanks(scope) {
  return [...scope.querySelectorAll('div')]
    .map((el) => (el.children.length === 0 ? el.textContent.trim() : ''))
    .filter((t) => /^(10|[2-9]|[AKQJ])$/.test(t));
}

// Hero on the clock with $40 still to call.
const toActGame = () => ({
  ...midHandGame,
  toAct: 0,
  currentBet: 80,
  seats: midHandGame.seats.map((s, i) => (i === 0 ? { ...s, contribThisStreet: 40 } : s)),
});

// W3-1 pace fixtures. feature/pace puts `pace` and `heroEquity` on the snapshot;
// everything else about the table is the shipped mid-hand fixture.
const paced = (pace, extra = {}) => ({ ...midHandGame, pace, ...extra });

describe('WatchScreen mid-hand', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('names the table it is watching', async () => {
    renderWatch(midHandGame);
    expect(await screen.findByText('The Grinder')).toBeInTheDocument();
  });

  it('renders the board', () => {
    const { container } = renderWatch(midHandGame);
    const board = container.querySelector('.watch-felt__board');
    expect(board).toBeTruthy();
    // Five slots always: three flop cards face up, two backs still to come.
    expect(board.children).toHaveLength(5);
    expect(faceUpRanks(board)).toEqual(['5', '4', '8']);
  });

  it('renders the pot', () => {
    const { container } = renderWatch(midHandGame);
    const pot = container.querySelector('.watch-felt__pot');
    expect(within(pot).getByText('POT')).toBeInTheDocument();
    expect(within(pot).getByText('$100')).toBeInTheDocument();
  });

  it('renders every opponent seat with its stack', () => {
    const { container } = renderWatch(midHandGame);
    const seats = container.querySelectorAll('.watch-felt__seat');
    // Hero is the felt's own hero row; the other two seats ring the table.
    expect(seats).toHaveLength(2);
    expect(screen.getByText('Doyle_v3')).toBeInTheDocument();
    expect(screen.getByText('Granite')).toBeInTheDocument();
    // Both opponents are still on 980 after posting their blinds.
    expect(screen.getAllByText('$980')).toHaveLength(2);
  });

  // The fish-tank law: the owner watches their own agent play, so the hero's
  // two cards are face up. getPublicState already withholds every other seat's.
  it('shows the hero hole cards face up', () => {
    const { container } = renderWatch(midHandGame);
    const hero = container.querySelector('.watch-felt__hero');
    expect(faceUpRanks(hero)).toEqual(['6', '6']);
  });

  it('keeps the opponents\' hole cards face down', () => {
    const { container } = renderWatch(midHandGame);
    for (const seat of container.querySelectorAll('.watch-felt__seat')) {
      expect(faceUpRanks(seat)).toEqual([]);
    }
  });

  // FIX-1f replaces the old "shows the street and the blinds on the meta line"
  // case. That test encoded a rule the 2026-09-05 playtest reversed: the felt
  // carried "#tbl · $10/$20 · FLOP · 3-HANDED · TO CALL $40" while a hand was
  // live, five facts of which four are already on screen. The line is gone
  // during a hand; the board reports the street, the seat ring reports how many
  // are in, and the price is in the readout. It survives between hands, which
  // is the reference's calm state (design-refs/mood-watch.jsx).
  it('FIX-1f: shows no meta line on the felt while a hand is live', () => {
    const { container } = renderWatch(midHandGame);
    expect(container.querySelector('.watch-felt__street')).toBeNull();
  });

  it('FIX-1f: keeps the calm meta line between hands', () => {
    const { container } = renderWatch(betweenHandsGame);
    const meta = container.querySelector('.watch-felt__street');
    expect(meta).toBeTruthy();
    expect(meta.textContent).toContain('$10/$20');
    expect(meta.textContent).toContain('SHUFFLING');
    expect(meta.textContent).not.toContain('HANDED');
  });

  // W3-1 moves the price once more, out of the action chip and into its own
  // column of the hero row — HeroRow3's "To call" slot, which is where the ref
  // puts it. FIX-1f's rule holds: when there is a price to pay, it is on screen.
  it('W3-1: the hero row names the price when it is the hero\'s turn', () => {
    const { container } = renderWatch(toActGame());
    const labels = [...container.querySelectorAll('.watch-felt__hero-lbl')].map((el) => el.textContent);
    expect(labels).toContain('To call');
    expect(container.querySelector('.watch-felt__hero-num.is-gold').textContent).toBe('$40');
    // The chip names the action; the arithmetic has its own column now.
    expect(container.querySelector('.watch-felt__action-chip').textContent).toBe('TO ACT');
  });

  it('W3-1: the same column shows the street when nothing is owed', () => {
    const { container } = renderWatch(midHandGame);
    const labels = [...container.querySelectorAll('.watch-felt__hero-lbl')].map((el) => el.textContent);
    expect(labels).toContain('Street');
    expect(container.querySelector('.watch-felt__hero-num.is-dim').textContent).toBe('FLOP');
  });

  // FIX-1g. The readout showed an em dash for the whole of the hero's turn —
  // the one moment the owner is watching it. The server knows his equity before
  // he acts, so the last number it sent for this hand stands until a newer one
  // lands, and a dash now means only "nothing dealt yet".
  describe('FIX-1g hero equity', () => {
    // W3-1: equity is no longer a column in the hero row — finding 2 moved it
    // onto the rope under the board, where a non-poker player can read it.
    // FIX-1g's rule is unchanged and follows it there.
    const equityText = (container) => container.querySelector('.tug__value').textContent;

    it('FIX-1g: shows the equity the server sent with the last decision', () => {
      const { container } = renderWatch(midHandGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });
      expect(equityText(container)).toBe('67%');
    });

    it('FIX-1g: holds that number while the hero is asked to act again', () => {
      const { container, rerender } = renderWatch(midHandGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });

      // The turn lands and the hero is on the clock with no decision on the
      // wire yet — lastDecision is null. Same hand, so the read still stands.
      // This is exactly where the dash used to appear.
      rerender(
        <WatchScreen
          game={{ ...midHandGame, street: 'turn', toAct: 0, community: ['5c', '4h', '8c', 'Kd'] }}
          mySeat={0}
          config={spectatorConfig}
          displayNames={{ 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' }}
          chatMessages={[]}
          lastDecision={null}
          sendChat={() => {}}
          onLeave={() => {}}
          onSitOut={() => {}}
        />,
      );

      expect(container.querySelector('.watch-felt__action-chip')).toBeTruthy();
      expect(equityText(container)).toBe('67%');
    });

    it('FIX-1g: forgets the read when the next hand is dealt', () => {
      const { container, rerender } = renderWatch(midHandGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });

      rerender(
        <WatchScreen
          game={{ ...midHandGame, handNumber: 2, toAct: 0 }}
          mySeat={0}
          config={spectatorConfig}
          displayNames={{ 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' }}
          chatMessages={[]}
          lastDecision={null}
          sendChat={() => {}}
          onLeave={() => {}}
          onSitOut={() => {}}
        />,
      );

      expect(equityText(container)).toBe('—');
    });

    it('FIX-1g: dashes before the deal, and only there', () => {
      const { container } = renderWatch(betweenHandsGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });
      expect(equityText(container)).toBe('—');
    });

    it('FIX-1g: dashes on a hand that has produced no read yet', () => {
      const { container } = renderWatch(midHandGame);
      expect(equityText(container)).toBe('—');
    });
  });

  // Replaces "appends the agent's decision to the feed with its equity as a
  // percentage". W3-2 removes the LIVE ANALYSIS tab, which was the decision
  // feed's only home and the only place that printed 67.4% — the solver stack
  // finding 3 kills. What a decision still owes the screen is unchanged and
  // asserted here: his sentence, and his equity on the rope.
  it('W3-2: a decision reaches the felt as his line and his equity', async () => {
    const { container } = renderWatch(midHandGame, {
      lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674, reasoning: 'Set. Charging the draws.' },
    });
    expect(await screen.findByText(/Charging the draws/)).toBeInTheDocument();
    // WV2-2: the wire carries equity as a 0..1 fraction, not a percent.
    expect(container.querySelector('.tug__value').textContent).toBe('67%');
  });
});

// ── W3-1 · the pacing ladder and the rope ───────────────────────────────────
// Playtest 2026-09-05: "a simulation, not a game." The felt had one state — a
// $60 pot and a $3,694 pot were drawn identically — and the money on the line
// was a 12.5px number in a corner. Four server-driven states and a rope.

describe('W3-1 pacing states', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  const felt = (container) => container.querySelector('.watch-felt');

  it('W3-1: a snapshot with no pace field reads as calm', () => {
    const { container } = renderWatch(midHandGame);
    expect(felt(container).dataset.pace).toBe('calm');
    // CALM is the felt that shipped: no glow overlay at all.
    expect(container.querySelector('.watch-felt__glow')).toBeNull();
  });

  it('W3-1: an unrecognised pace still reads as calm', () => {
    const { container } = renderWatch(paced('on-fire'));
    expect(felt(container).dataset.pace).toBe('calm');
  });

  for (const state of ['heating', 'allin', 'showdown']) {
    it(`W3-1: the felt carries the ${state} state and its glow`, () => {
      const { container } = renderWatch(paced(state));
      expect(felt(container).dataset.pace).toBe(state);
      expect(container.querySelector('.watch-felt__glow')).toBeTruthy();
    });
  }

  it('W3-1: only ALL-IN puts the holding tag on the hero row', () => {
    const { container } = renderWatch(paced('allin'));
    expect(container.querySelector('.watch-felt__hero-tag')).toBeTruthy();

    const calm = renderWatch(paced('calm'));
    expect(calm.container.querySelector('.watch-felt__hero-tag')).toBeNull();
  });

  it('W3-1: the runout is dealt one card at a time on a showdown', () => {
    vi.useFakeTimers();
    try {
      const river = { ...paced('showdown'), community: ['5c', '4h', '8c', 'Kd', '2s'] };
      const { container } = renderWatch(river);
      const board = () => container.querySelector('.watch-felt__board');

      // The reveal starts closed — nothing has flipped yet.
      expect(faceUpRanks(board())).toEqual([]);

      act(() => { vi.advanceTimersByTime(FLIP_MS); });
      expect(faceUpRanks(board())).toEqual(['5']);

      act(() => { vi.advanceTimersByTime(FLIP_MS * 2); });
      expect(faceUpRanks(board())).toEqual(['5', '4', '8']);

      act(() => { vi.advanceTimersByTime(FLIP_MS * 2); });
      expect(faceUpRanks(board())).toEqual(['5', '4', '8', 'K', '2']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('W3-1: every dealt card is face up when the pace is not a showdown', () => {
    const { container } = renderWatch({ ...midHandGame, community: ['5c', '4h', '8c', 'Kd'] });
    expect(faceUpRanks(container.querySelector('.watch-felt__board'))).toEqual(['5', '4', '8', 'K']);
  });
});

describe('W3-1 the rope', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('W3-1: draws hero equity from the snapshot, on every frame', () => {
    const { container } = renderWatch(paced('calm', { heroEquity: 0.71 }));
    expect(container.querySelector('.tug__value').textContent).toBe('71%');
  });

  it('W3-1: the snapshot beats the last decision', () => {
    const { container } = renderWatch(paced('calm', { heroEquity: 0.71 }), {
      lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.30 },
    });
    expect(container.querySelector('.tug__value').textContent).toBe('71%');
  });

  it('W3-1: the seam sits where his equity is', () => {
    const { container } = renderWatch(paced('calm', { heroEquity: 0.71 }));
    expect(container.querySelector('.tug__fill').style.width).toBe('71%');
  });

  it('W3-1: before the deal the rope sits dead centre rather than empty', () => {
    const { container } = renderWatch(betweenHandsGame);
    const tug = container.querySelector('.tug');
    expect(tug.className).toContain('tug--dead');
    expect(container.querySelector('.tug__fill').style.width).toBe('50%');
    expect(container.querySelector('.tug__value').textContent).toBe('—');
  });

  it('W3-1: names the one live opponent and nobody else', () => {
    const heads = {
      ...midHandGame,
      seats: midHandGame.seats.map((s, i) => (i === 2 ? { ...s, folded: true } : s)),
      heroEquity: 0.64,
    };
    const { container } = renderWatch(heads);
    expect(container.querySelector('.tug__villain').textContent).toBe('DOYLE_V3');

    // Three-handed and both still in: the owner is watching his agent, not
    // refereeing, so the far end stays unlabelled.
    const multi = renderWatch(paced('calm', { heroEquity: 0.64 }));
    expect(multi.container.querySelector('.tug__villain')).toBeNull();
  });

  it('W3-1: the rope goes fat while the pot is heated', () => {
    const { container } = renderWatch(paced('heating', { heroEquity: 0.71 }));
    expect(container.querySelector('.tug').className).toContain('tug--big');

    const calm = renderWatch(paced('calm', { heroEquity: 0.71 }));
    expect(calm.container.querySelector('.tug').className).not.toContain('tug--big');
  });
});

// ── W3-2 · two tabs, and READ ───────────────────────────────────────────────

describe('W3-2 the panel', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  const tabLabels = (container) =>
    [...container.querySelectorAll('.watch-tabs__tab')].map((el) => el.textContent);

  it('W3-2: offers exactly READ and CHAT', () => {
    const { container } = renderWatch(midHandGame);
    expect(tabLabels(container)).toEqual(['Read', 'Chat']);
  });

  it('W3-2: RANGE and HISTORY are gone, not hidden', () => {
    const { container } = renderWatch(midHandGame);
    const labels = tabLabels(container).join(' ').toLowerCase();
    expect(labels).not.toContain('range');
    expect(labels).not.toContain('history');
    expect(labels).not.toContain('analysis');
    expect(screen.queryByText('Range analysis coming soon.')).not.toBeInTheDocument();
    expect(screen.queryByText('No hands played yet.')).not.toBeInTheDocument();
  });

  it('W3-2: READ is what the panel opens on', () => {
    const { container } = renderWatch(midHandGame);
    expect(container.querySelector('.read-panel')).toBeTruthy();
    expect(container.querySelector('.watch-tabs__tab.is-active').textContent).toBe('Read');
  });

  it('W3-2: nothing anywhere says it is waiting for the first action', () => {
    renderWatch(midHandGame);
    expect(screen.queryByText(/waiting for (the )?first action/i)).not.toBeInTheDocument();
  });

  it('W3-2: the Chat action still reaches the chat tab', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch(midHandGame);
    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(container.querySelector('.dr-chat-tab')).toBeTruthy();
    expect(container.querySelector('.read-panel')).toBeNull();
  });
});

describe('W3-2 ReadPanel', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  const withReads = (reads) => ({ ...midHandGame, reads });

  const rowFor = (container, label) =>
    [...container.querySelectorAll('.read-bar')]
      .find((el) => el.querySelector('.read-bar__label').textContent === label);

  it('W3-2: draws the five rows in canon order even with no reads at all', () => {
    const { container } = renderWatch(midHandGame);
    expect([...container.querySelectorAll('.read-bar__label')].map((el) => el.textContent))
      .toEqual(['PLAYS', 'RAISES FIRST', 'AGGRESSION', 'FOLDS TO HEAT', 'GOES TO SHOWDOWN']);
  });

  it('W3-2: with no evidence he says so himself, and no bar claims a number', () => {
    const { container } = renderWatch(midHandGame);
    expect(screen.getByText('NO EVIDENCE YET')).toBeInTheDocument();
    expect(screen.getByText(/Give me a few hands/)).toBeInTheDocument();
    // An unanswered question is not an answer of nothing: "··", never 0.
    expect([...container.querySelectorAll('.read-bar__value')].map((el) => el.textContent))
      .toEqual(['··', '··', '··', '··', '··']);
    expect(container.querySelector('.read-bar__fill')).toBeNull();
  });

  it('W3-2: fills the bars from the server model', () => {
    const { container } = renderWatch(withReads({
      name: 'Granite',
      hands: 142,
      line: 'He never folds, so I stop bluffing him.',
      stats: { vpip: { v: 19, conf: 3 }, pfr: { v: 14, conf: 4 }, aggr: { v: 31, conf: 6 } },
    }));

    // "Granite" is also a seat chip on the felt, so scope to the panel.
    expect(container.querySelector('.read-panel__who').textContent).toBe('Granite');
    expect(screen.getByText('142 HANDS SEEN')).toBeInTheDocument();
    expect(screen.getByText(/He never folds/)).toBeInTheDocument();

    const plays = rowFor(container, 'PLAYS');
    expect(plays.querySelector('.read-bar__value').textContent).toBe('19');
    expect(plays.querySelector('.read-bar__fill').style.width).toBe('19%');
    // The bracket is the confidence: 19 ± 3.
    expect(plays.querySelector('.read-bar__band').style.left).toBe('16%');
    expect(plays.querySelector('.read-bar__band').style.width).toBe('6%');

    // A stat the server has not sent stays unanswered rather than reading zero.
    expect(rowFor(container, 'GOES TO SHOWDOWN').querySelector('.read-bar__value').textContent).toBe('··');
  });

  it('W3-2: a plain number is accepted as well as a value/confidence pair', () => {
    const { container } = renderWatch(withReads({ hands: 90, stats: { vpip: 24 } }));
    const plays = rowFor(container, 'PLAYS');
    expect(plays.querySelector('.read-bar__value').textContent).toBe('24');
    expect(plays.querySelector('.read-bar__band')).toBeNull();
  });

  it('W3-2: a read is not formed until there is evidence behind it', () => {
    const thin = renderWatch(withReads({ hands: 4, stats: { vpip: 19 } }));
    expect(rowFor(thin.container, 'PLAYS').className).not.toContain('read-bar--formed');

    const thick = renderWatch(withReads({ hands: 142, stats: { vpip: 19 } }));
    expect(rowFor(thick.container, 'PLAYS').className).toContain('read-bar--formed');
  });

  it('W3-2: a read that just formed announces itself once', () => {
    const { container } = renderWatch(withReads({
      hands: 143, forming: true, line: "He'll call a big one with nothing. Noted.",
      stats: { vpip: 19 },
    }));
    expect(container.querySelector('.read-panel__line').className).toContain('is-forming');

    const settled = renderWatch(withReads({ hands: 143, line: 'Still the same.', stats: { vpip: 19 } }));
    expect(settled.container.querySelector('.read-panel__line').className).not.toContain('is-forming');
  });
});

describe('WatchScreen between hands', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('renders the calm state, not a placeholder', () => {
    const { container } = renderWatch(betweenHandsGame);

    // The felt is still there — same anatomy, nothing swapped out for a
    // spinner or an empty div.
    expect(container.querySelector('.watch-felt')).toBeTruthy();
    expect(container.querySelector('.watch-felt__board')).toHaveClass('is-between');
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('shows an em dash for the pot instead of $0', () => {
    const { container } = renderWatch(betweenHandsGame);
    const pot = container.querySelector('.watch-felt__pot');
    expect(within(pot).getByText('—')).toBeInTheDocument();
  });

  it('says the table is shuffling', () => {
    const { container } = renderWatch(betweenHandsGame);
    expect(container.querySelector('.watch-felt__street').textContent).toContain('SHUFFLING');
  });

  it('draws five card backs and no board cards', () => {
    const { container } = renderWatch(betweenHandsGame);
    const board = container.querySelector('.watch-felt__board');
    expect(board.children).toHaveLength(5);
    expect(faceUpRanks(board)).toEqual([]);
  });

  it('keeps the hero cards face down between hands', () => {
    const { container } = renderWatch(betweenHandsGame);
    expect(faceUpRanks(container.querySelector('.watch-felt__hero'))).toEqual([]);
  });
});

describe('WatchScreen controls', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('leaving calls onLeave — watching is not the same as recalling the agent', async () => {
    const onLeave = vi.fn();
    const onSitOut = vi.fn();
    renderWatch(midHandGame, { onLeave, onSitOut });

    screen.getByRole('button', { name: 'Leave table' }).click();

    expect(onLeave).toHaveBeenCalled();
    expect(onSitOut).not.toHaveBeenCalled();
  });
});
