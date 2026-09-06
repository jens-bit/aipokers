// SIT-1 — you sit down at your own kitchen table.
//
// The seam, end to end: the table sheet offers a chair, and the felt the chair
// opens is the WATCH felt with the owner at the bottom of it. Board 29's
// sit-down frames (52·Y1–Y4), with the queue's one override on the board — the
// camera does not push in on the flat, the Watch v5 felt IS the screen.
//
// What is asserted here is what a reader of the queue would check:
//
//   1. "Sit down" is only offered when there is a game to sit down at, and it
//      hands back the home table's own id
//   2. the felt is the watch felt, with YOU in the hero seat and no ghost of
//      your own — and the agents still in the opponent seats
//   3. the four verbs sit where the whisper row sits, and the whisper row is
//      gone, because you are in the hand and there is nobody to whisper to
//   4. the Chat button opens the glass thread sheet IN PLACE, on the room's
//      thread, rather than leaving the felt
//   5. Back is the way out

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { TableSheet } from './home/TableSheet.jsx';
import { WatchScreen } from './WatchScreen.jsx';

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ agents: [], lines: [] }),
  }));
});

const SLOTS = { cap: 4, used: 2, next: { index: 3, price: 50000, earned: 0, unlocked: false } };

// The kitchen table mid-hand: two of his agents, and him in seat 2.
const HOME_GAME = {
  tableId: 'home-u1',
  handNumber: 7,
  street: 'flop',
  toAct: 2,
  pot: 480,
  currentBet: 0,
  smallBlind: 1,
  bigBlind: 2,
  dealerSeat: 0,
  community: ['Ah', 'Kd', '7c'],
  seats: [
    { seat: 0, displayName: 'Balance', stack: 1200, holeCards: null },
    { seat: 1, displayName: 'Value Bot', stack: 900, holeCards: null },
    { seat: 2, displayName: 'You', stack: 1840, holeCards: ['As', 'Kd'] },
  ],
};

const LEGAL = [{ type: 'fold' }, { type: 'check' }, { type: 'bet', min: 2, max: 1840 }];

function sitScreen(over = {}) {
  return render(
    <WatchScreen
      seated
      game={HOME_GAME}
      mySeat={2}
      legalActions={LEGAL}
      onAct={() => {}}
      threadRows={[{ id: 'r1', kind: 'him', who: 'HIM', text: 'Quiet in here.', t: 1 }]}
      config={{ tableId: 'home-u1', displayName: 'The kitchen table', sitting: true }}
      {...over}
    />,
  );
}

describe('the chair is offered from the table sheet', () => {
  it('is not there at all when nothing is running', () => {
    render(<TableSheet slots={SLOTS} seated={0} />);
    expect(screen.queryByTestId('home-table-sit')).toBeNull();
  });

  it('says what it costs, which is nothing', () => {
    render(<TableSheet slots={SLOTS} seated={2} onSit={() => {}} />);
    expect(screen.getByText('Take a chair')).toBeTruthy();
    expect(screen.getByText('Play them yourself. No money in it.')).toBeTruthy();
  });

  it('sits you down when it is tapped', () => {
    const onSit = vi.fn();
    render(<TableSheet slots={SLOTS} seated={2} onSit={onSit} />);
    fireEvent.click(screen.getByTestId('home-table-sit'));
    expect(onSit).toHaveBeenCalledTimes(1);
  });

  it('does not become a second way to buy a chair', () => {
    render(<TableSheet slots={SLOTS} seated={2} onSit={() => {}} />);
    // The priced chair is still locked and still offers nothing; sitting down
    // is free and next to it, not a path to it.
    expect(screen.getByTestId('home-table-locked').textContent).toMatch(/50,000 to go/);
    expect(screen.queryByTestId('home-table-draft')).toBeNull();
  });
});

describe('the felt you land on', () => {
  it('is the watch felt, not a second table', () => {
    const { container } = sitScreen();
    expect(container.querySelector('.watch-screen')).toBeTruthy();
    expect(container.querySelector('.watch-felt')).toBeTruthy();
  });

  it('puts YOU in the hero seat, with your cards face up and no ghost of your own', () => {
    const { container } = sitScreen();
    const hero = screen.getByTestId('owner-hero');
    expect(within(hero).getByText('YOU')).toBeTruthy();
    const cards = screen.getByTestId('owner-hero-cards');
    expect(cards.textContent).toContain('A');
    expect(cards.textContent).toContain('K');
    // No ghost of his own — but the agents opposite still have theirs.
    expect(hero.querySelector('.mood-ghost')).toBeNull();
    expect(container.querySelectorAll('.watch-felt__seat').length).toBe(2);
  });

  it('shows his stack under the pile it describes', () => {
    const { container } = sitScreen();
    const pile = container.querySelector('.watch-felt__hero-stack');
    expect(pile).toBeTruthy();
    // Separator-agnostic on purpose: this figure still goes through
    // toLocaleString (WatchFelt's `heroStack`), which groups with a narrow
    // no-break space under several ordinary locales. That it disagrees with
    // lib/wallet's own formatter three lines below it on the same felt is a
    // pre-existing inconsistency and not SIT-1's to change — but a test that
    // pinned one separator would pass on one machine and fail on another.
    expect(pile.textContent).toMatch(/STACK\s*\$1.840/);
  });

  it('prints his own action on his own strip, never the table’s last one', () => {
    // The ghost's strip takes whatever decision came last, because on the watch
    // screen that IS his. Here the decisions on the wire belong to the agents,
    // so an unfiltered label put an opponent's fold over the owner's own cards
    // while it was still his turn to act.
    sitScreen({ lastDecision: { seat: 0, action: { type: 'fold' } } });
    const hero = screen.getByTestId('owner-hero');
    expect(within(hero).queryByText(/FOLD/)).toBeNull();
    expect(within(hero).getByText('TO ACT')).toBeTruthy();
  });

  it('leaves the agents in the opponent seats, under their own names', () => {
    sitScreen();
    expect(screen.getByText('Balance')).toBeTruthy();
    expect(screen.getByText('Value Bot')).toBeTruthy();
  });
});

describe('the verbs are where the whisper row was', () => {
  it('replaces the composer rather than joining it', () => {
    sitScreen();
    expect(screen.getByTestId('sit-strip')).toBeTruthy();
    // WATCH-6's composer is the thing whose slot this takes. Both would be an
    // extra row, and an extra row is the felt moving.
    expect(document.querySelector('.watch-composer')).toBeNull();
  });

  it('sends what is pressed', () => {
    const onAct = vi.fn();
    sitScreen({ onAct });
    fireEvent.click(screen.getByText('FOLD'));
    expect(onAct).toHaveBeenCalledWith({ type: 'fold' });
  });

  it('opens the amount panel from BET without moving the felt', () => {
    const { container } = sitScreen();
    const feltBefore = container.querySelector('.watch-felt').className;
    fireEvent.click(screen.getByText('BET'));
    expect(screen.getByTestId('sit-bet-panel')).toBeTruthy();
    expect(container.querySelector('.watch-felt').className).toBe(feltBefore);
  });
});

describe('the way in and out', () => {
  it('opens the room’s thread in the same glass, without leaving the felt', () => {
    sitScreen();
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    const sheet = document.querySelector('.thread-sheet');
    expect(sheet).toBeTruthy();
    expect(within(sheet).getByText('Quiet in here.')).toBeTruthy();
    // The felt is still behind it — a sheet is a layer, not a screen.
    expect(document.querySelector('.watch-felt')).toBeTruthy();
  });

  it('goes back to the room from the top left', () => {
    const onLeave = vi.fn();
    sitScreen({ onLeave });
    fireEvent.click(screen.getByRole('button', { name: 'Leave table' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
