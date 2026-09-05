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

  // HAPTIC4 asks for a light tap per hero card, 90ms apart. haptics.js enforces
  // the wave-33 floor — "never two inside 120ms" — and HAPTIC4 says it is bound
  // by those rules, so the second tap inside a 90ms gap is swallowed BY DESIGN.
  // The cards still land 90ms apart; only the device is quieter than the row
  // reads. haptics.js is outside this slice's file scope, so the two numbers are
  // reconciled here by letting the stated law win over the stated cadence.
  it('taps for the deal, and the 120ms floor swallows the second', () => {
    const calls = [];
    window.Telegram.WebApp.HapticFeedback = {
      impactOccurred: (style) => calls.push(style),
      notificationOccurred: () => {},
      selectionChanged: () => {},
    };
    act(() => { render(<WatchScreen {...props} />); });

    tick(CARD_GAP_MS);
    expect(calls).toEqual(['light']);

    tick(CARD_GAP_MS);
    // 90ms < MIN_GAP_MS, so nothing more reaches the device.
    expect(calls).toEqual(['light']);
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

  it('falls back to the in-sheet tab when it cannot', async () => {
    render(<WatchScreen {...props} />);
    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));

    // No router, so talking stays here: the sheet's own tab takes over. W4-4
    // named it TABLE — the record — and it carries the composer.
    await waitFor(() => {
      expect(document.querySelector('.watch-tabs__tab.is-active')).toHaveTextContent(/table/i);
    });
  });

  it('the sheet tab and the header button are the same control', async () => {
    const onOpenThread = vi.fn();
    render(<WatchScreen {...props} onOpenThread={onOpenThread} />);

    // W4-2 removed READ, so CHAT is the panel's only tab and index 0.
    const tab = document.querySelector('[data-watch-tab="0"]');
    await userEvent.click(tab);
    expect(onOpenThread).toHaveBeenCalled();
  });
});
