// client/src/components/WatchScreen.test.jsx — TEST-1
//
// The fish tank. Watching is passive: the felt reports what the table is
// doing, and the owner — and only the owner — sees their own agent's hole
// cards face up. Between hands the felt holds a calm state rather than
// swapping itself out for a spinner.

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { betweenHandsGame, midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

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

  it('FIX-1f: the readout carries the price when it is the hero\'s turn', () => {
    // Hero is seat 0 and owes 40 - 40 = 0 in the fixture; move the action to
    // them with something still to call.
    const toActGame = {
      ...midHandGame,
      toAct: 0,
      currentBet: 80,
      seats: midHandGame.seats.map((s, i) => (i === 0 ? { ...s, contribThisStreet: 40 } : s)),
    };
    const { container } = renderWatch(toActGame);
    expect(container.querySelector('.watch-felt__action-chip').textContent).toBe('TO CALL $40');
  });

  // FIX-1g. The readout showed an em dash for the whole of the hero's turn —
  // the one moment the owner is watching it. The server knows his equity before
  // he acts, so the last number it sent for this hand stands until a newer one
  // lands, and a dash now means only "nothing dealt yet".
  describe('FIX-1g hero equity', () => {
    const equityText = (container) =>
      container.querySelector('.watch-felt__hero-num.is-live, .watch-felt__hero-num.is-muted').textContent;

    it('FIX-1g: shows the equity the server sent with the last decision', () => {
      const { container } = renderWatch(midHandGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });
      expect(equityText(container)).toBe('67.4%');
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
      expect(equityText(container)).toBe('67.4%');
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

      expect(equityText(container)).toBe('--');
    });

    it('FIX-1g: dashes before the deal, and only there', () => {
      const { container } = renderWatch(betweenHandsGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });
      expect(equityText(container)).toBe('--');
    });

    it('FIX-1g: dashes on a hand that has produced no read yet', () => {
      const { container } = renderWatch(midHandGame);
      expect(equityText(container)).toBe('--');
    });
  });

  it('appends the agent\'s decision to the feed with its equity as a percentage', async () => {
    renderWatch(midHandGame, {
      lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674, reasoning: 'Set. Charging the draws.' },
    });
    // WV2-2: the wire carries equity as a 0..1 fraction, not a percent. The
    // number appears twice — once in the sheet's peek line, once in the band.
    expect(await screen.findAllByText('67.4%')).not.toHaveLength(0);
    expect(screen.getByText(/Charging the draws/)).toBeInTheDocument();
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
