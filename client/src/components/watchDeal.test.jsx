// client/src/components/watchDeal.test.jsx — W4-1, W4-5
//
// W4-1, the DEAL beat (design-refs/mood-watch4.jsx + the HAPTIC4 table in
// mood-watch4b.jsx): the hand is dealt, not shown. His two cards land 90ms
// apart, each with its own light tap, never simultaneous. Then the table's
// backs sweep out as one gesture with no haptic at all, because their cards
// are not his event. A premium hand warms — owner-only, and owner-only by
// construction rather than by a flag.
//
// W4-5: the Chat control leaves the screen when the shell can route to his
// thread, and stays in the sheet when it cannot.

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { dealBeat, isWarm, isNewDeal, CARD_GAP_MS, BACKS_DELAY_MS, WARM_EQUITY } from '../lib/deal.js';
import { resetHaptics } from '../lib/haptics.js';
import { midHandGame } from '../test/fixtures/game.js';
import { telegram } from '../test/harness.js';

describe('W4-1: the deal beat, as arithmetic', () => {
  it('lands nothing before the first card', () => {
    expect(dealBeat(0)).toEqual({ landed: 0, backs: false });
  });

  it('lands them one at a time, never simultaneous', () => {
    expect(dealBeat(CARD_GAP_MS).landed).toBe(1);
    expect(dealBeat(CARD_GAP_MS * 2 - 1).landed).toBe(1);
    expect(dealBeat(CARD_GAP_MS * 2).landed).toBe(2);
  });

  it('sweeps the backs out only after both his cards are down', () => {
    expect(dealBeat(CARD_GAP_MS * 2).backs).toBe(false);
    expect(dealBeat(BACKS_DELAY_MS).backs).toBe(true);
  });

  it('treats a nonsense elapsed as the start rather than throwing', () => {
    expect(dealBeat(undefined).landed).toBe(0);
    expect(dealBeat(-500).landed).toBe(0);
  });
});

describe('W4-1: warming is owner-only by construction', () => {
  const hole = ['As', 'Kh'];

  it('warms a premium hand', () => {
    expect(isWarm(hole, WARM_EQUITY)).toBe(true);
    expect(isWarm(hole, 0.87)).toBe(true);
  });

  it('leaves an ordinary hand cold', () => {
    expect(isWarm(hole, 0.41)).toBe(false);
  });

  it('never warms for a viewer who cannot see the cards', () => {
    // heroHole is exactly what the server withholds from a non-owner, so a
    // spectator cannot reach the warm state at all.
    expect(isWarm(null, 0.95)).toBe(false);
    expect(isWarm([], 0.95)).toBe(false);
    expect(isWarm(['As'], 0.95)).toBe(false);
  });

  it('reads a percent as a percent, not as a 9500% hand', () => {
    expect(isWarm(hole, 87)).toBe(true);
    expect(isWarm(hole, 41)).toBe(false);
  });

  it('says no when there is no equity to judge', () => {
    expect(isWarm(hole, null)).toBe(false);
    expect(isWarm(hole, undefined)).toBe(false);
  });
});

describe('W4-1: a hand is dealt once', () => {
  it('a new hand number is a new deal', () => {
    expect(isNewDeal(12, 11)).toBe(true);
  });

  it('the same hand is not re-dealt by a re-render or a late snapshot', () => {
    expect(isNewDeal(12, 12)).toBe(false);
  });

  it('a snapshot with no hand number deals nothing', () => {
    expect(isNewDeal(null, 11)).toBe(false);
  });
});

const props = {
  game: midHandGame,
  mySeat: 0,
  chatMessages: [],
  sendChat: () => {},
  displayNames: {},
  onLeave: () => {},
  config: { isSpectator: true, agentId: 'a1', tableId: 't1' },
};

describe('W4-1: the beat on the felt', () => {
  // Plain fake timers, deliberately: the deal is a sequence of transient states
  // and `shouldAdvanceTime` would let real time walk through them while the
  // assertion is still being set up.
  beforeEach(() => {
    vi.useFakeTimers();
    telegram.signIn();
    resetHaptics();
  });
  afterEach(() => { vi.useRealTimers(); });

  const cards = () => document.querySelectorAll('.watch-felt__hero-card');
  const down = () => [...cards()].filter((el) => el.dataset.landed === 'yes').length;
  const tick = (ms) => act(() => { vi.advanceTimersByTime(ms); });

  it('deals his cards one at a time rather than showing them at once', () => {
    act(() => { render(<WatchScreen {...props} />); });

    expect(cards().length).toBe(2);
    expect(down()).toBe(0);

    tick(CARD_GAP_MS);
    expect(down()).toBe(1);

    tick(CARD_GAP_MS);
    expect(down()).toBe(2);
  });

  // CLEAN-1: W4-1 asked for a tap per hero card 90ms apart and relied on the
  // wave-33 floor — "never two inside 120ms" — to swallow the second. A call
  // written down only to be thrown away is a lie about what the device is
  // doing, so the deal now taps once, on the first card. The floor is not what
  // makes this true any more, and this case proves it: the throttle is cleared
  // between the two cards, so a second call would go straight through.
  it('taps once for the deal, on the first card', () => {
    const calls = [];
    window.Telegram.WebApp.HapticFeedback = {
      impactOccurred: (style) => calls.push(style),
      notificationOccurred: () => {},
      selectionChanged: () => {},
    };
    act(() => { render(<WatchScreen {...props} />); });

    tick(CARD_GAP_MS);
    expect(calls).toEqual(['light']);

    resetHaptics();          // the floor is out of the way
    tick(CARD_GAP_MS);
    expect(calls).toEqual(['light']);
  });
});

// ── CLEAN-1 · the three HAPTIC4 rows that had nowhere to land ──────────────
// They existed in mood-watch4b's table and nowhere in the code. Each is its own
// row now, and the screen fires each from the state that names it.

describe('CLEAN-1: the v4b beats, through the screen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    telegram.signIn();
    resetHaptics();
    window.Telegram.WebApp.HapticFeedback = {
      impactOccurred: (style) => impacts.push(style),
      notificationOccurred: (style) => notifications.push(style),
      selectionChanged: () => {},
    };
  });
  afterEach(() => { vi.useRealTimers(); });

  let impacts = [];
  let notifications = [];
  beforeEach(() => { impacts = []; notifications = []; });

  // The whole deal, out of the way: its timers run out, its tap is forgotten and
  // the 120ms floor is cleared, so what follows is read on its own.
  const settle = () => {
    act(() => { vi.advanceTimersByTime(BACKS_DELAY_MS + 50); });
    impacts.length = 0;
    notifications.length = 0;
    resetHaptics();
  };

  const cold = { ...midHandGame, heroEquity: 0.31 };
  const warmGame = { ...midHandGame, heroEquity: 0.92 };

  it('CLEAN-1: his cards warming is its own tap', () => {
    const { rerender } = render(<WatchScreen {...props} game={cold} />);
    settle();
    // The equity arrives with his decision, after the cards are down.
    act(() => { rerender(<WatchScreen {...props} game={warmGame} />); });
    expect(impacts).toEqual(['light']);
  });

  it('CLEAN-1: once per hand — a premium hand does not warm twice', () => {
    const { rerender } = render(<WatchScreen {...props} game={cold} />);
    settle();
    act(() => { rerender(<WatchScreen {...props} game={warmGame} />); });
    resetHaptics();
    act(() => { rerender(<WatchScreen {...props} game={{ ...warmGame, pot: 200 }} />); });
    expect(impacts).toEqual(['light']);
  });

  it('CLEAN-1: and a hand that stays ordinary never warms', () => {
    const { rerender } = render(<WatchScreen {...props} game={cold} />);
    settle();
    act(() => { rerender(<WatchScreen {...props} game={{ ...cold, pot: 200 }} />); });
    expect(impacts).toEqual([]);
  });

  it('CLEAN-1: a spectator feels nothing, because he cannot see the cards', () => {
    const blind = (g) => ({ ...g, seats: g.seats.map((s, i) => (i === 0 ? { ...s, holeCards: [] } : s)) });
    const { rerender } = render(<WatchScreen {...props} game={blind(cold)} />);
    settle();
    act(() => { rerender(<WatchScreen {...props} game={blind(warmGame)} />); });
    expect(impacts).toEqual([]);
  });

  it('CLEAN-1: a bubble reaching the felt is the lightest tap in the product', () => {
    const said = { text: 'You are not calling that.', isAI: true, seat: 1, t: Date.now() };
    const { rerender } = render(<WatchScreen {...props} />);
    settle();
    act(() => { rerender(<WatchScreen {...props} chatMessages={[said]} />); });

    expect(impacts).toEqual(['light']);
  });

  it('CLEAN-1: the showdown reveal taps after the pot, not over it', () => {
    const settled = {
      ...midHandGame,
      street: 'complete',
      community: ['5c', '4h', '8c', 'Kd', '2s'],
      result: {
        pot: 300,
        winners: [{ seat: 1, descr: 'two pair' }],
        showdown: [{ seat: 1, holeCards: ['Kh', '9s'] }, { seat: 2, holeCards: ['Ac', 'Qd'] }],
      },
    };
    act(() => { render(<WatchScreen {...props} game={settled} />); });

    // The pot first — he lost this one, and losing is quiet.
    expect(impacts).toEqual(['soft']);

    // Then the cards, on HAPTIC4's own 140ms interval, which is the one number
    // in that table set above the 120ms floor.
    act(() => { vi.advanceTimersByTime(140); });
    expect(impacts).toEqual(['soft', 'medium']);
  });
});

describe('W4-5: where Chat goes', () => {
  beforeEach(() => { telegram.signIn(); });

  it('leaves the watch screen when the shell can route to his thread', async () => {
    const onOpenThread = vi.fn();
    render(<WatchScreen {...props} onOpenThread={onOpenThread} />);

    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  // WATCH-6 re-expressed: the fallback is no longer a tab in a sheet under the
  // felt — it is the record as a glass layer OVER the felt, with the hand still
  // running behind it.
  it('falls back to the record over the felt when it cannot', async () => {
    render(<WatchScreen {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));

    await waitFor(() => {
      expect(document.querySelector('.thread-sheet')).not.toBeNull();
    });
    expect(document.querySelector('.thread-sheet').textContent).toContain('The table');
  });

  it('every way in is the same control', async () => {
    const onOpenThread = vi.fn();
    render(<WatchScreen {...props} onOpenThread={onOpenThread} />);

    // His face and the composer's arrow both ask for the same thing the header
    // asks for, so a wired router takes all three.
    await userEvent.click(document.querySelector('.watch-hero__body'));
    await userEvent.click(document.querySelector('.watch-composer__thread'));
    expect(onOpenThread).toHaveBeenCalledTimes(2);
  });
});
