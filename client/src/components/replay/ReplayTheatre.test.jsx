// client/src/components/replay/ReplayTheatre.test.jsx — R-2
//
// The theatre plays Watch v3's own felt, so what is under test here is the
// clock and the scrubber: does the reel advance, does scrubbing move the felt
// to that moment, and does the same ALL-IN hold and showdown reveal land where
// the timeline says they should.

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReplayTheatre } from './ReplayTheatre.jsx';
import { buildTimeline } from './timeline.js';
import { badBeatHand, bigBluffHand } from '../../test/fixtures/flagged.js';
import { telegram } from '../../test/harness.js';

const coolerHand = {
  flagType: 'cooler',
  handNumber: 58,
  pot: 4200,
  holeCards: ['Qs', 'Qd'],
  opponentShowdownCards: [{ seat: 2, displayName: 'Granite', holeCards: ['Kh', 'Kc'] }],
  won: false,
  streets: [
    { street: 'preflop', board: [], action: 'raise 60', equity: 47, reasoning: 'Queens. In.' },
    { street: 'flop', board: ['Qh', '7d', '2c'], action: 'bet 180', equity: 92, reasoning: 'Set. Charging everything.' },
    { street: 'turn', board: ['Qh', '7d', '2c', 'Kd'], action: 'all-in 1960', equity: 31, reasoning: 'All of it. He has one king at most.' },
    { street: 'river', board: ['Qh', '7d', '2c', 'Kd', '3s'], action: 'call 0', equity: 0, reasoning: 'Set over set. Nothing to be done.' },
  ],
  attrCosts: [{ key: 'FOCUS', line: 'he misjudged the turn by 9%', street: 'turn' }],
  flaggedAt: 1788609400000,
};

// FIX-4: six beats — five streets and the end — so the reel has to survive four
// beat changes rather than the one a short hand asks of it.
const sixBeatHand = {
  ...coolerHand,
  streets: [
    { street: 'preflop', board: [], action: 'raise 60', equity: 47, reasoning: 'Queens. In.' },
    { street: 'flop', board: ['Qh', '7d', '2c'], action: 'bet 180', equity: 92, reasoning: 'Set. Charging everything.' },
    { street: 'flop', board: ['Qh', '7d', '2c'], action: 'raise 520', equity: 90, reasoning: 'He came back. So do I.' },
    { street: 'turn', board: ['Qh', '7d', '2c', 'Kd'], action: 'bet 900', equity: 31, reasoning: 'Still the best hand I can name.' },
    { street: 'river', board: ['Qh', '7d', '2c', 'Kd', '3s'], action: 'call 0', equity: 0, reasoning: 'Set over set.' },
  ],
};

const renderTheatre = (hand = coolerHand, props = {}) =>
  render(<ReplayTheatre hand={hand} onBack={() => {}} autoPlay={false} {...props} />);

// A ResizeObserver that answers the way a browser's does: the observed box
// reports the height its content actually took. .replay-theatre__stage has no
// height of its own, so before FIX-4 that was the felt's — and the felt's is
// derived from the number the observer feeds back in.
function installResizeObserver() {
  const live = [];
  class Observer {
    constructor(cb) { this.cb = cb; this.els = []; live.push(this); }
    observe(el) { this.els.push(el); this.flush(); }
    disconnect() { this.els = []; }
    flush() {
      this.els.forEach((el) => {
        const felt = el.querySelector('.watch-felt');
        const own = parseFloat(felt?.style?.height) || 0;
        // The theatre's own box is the viewport's; only the stage answers with
        // its content's height.
        const h = el.classList.contains('replay-theatre') ? 800 : own;
        this.cb([{ contentRect: { height: h } }]);
      });
    }
  }
  globalThis.ResizeObserver = Observer;
  return () => live.forEach((o) => o.flush());
}

const felt = (container) => container.querySelector('.watch-felt');
const scrubber = (container) => container.querySelector('.replay-scrub');

describe('R-2 the theatre', () => {
  beforeEach(() => { telegram.signIn(); });

  it('R-2: plays Watch v3\'s own felt, not a second one', () => {
    const { container } = renderTheatre();
    // The pacing states, the rope and the hero row all come from watch.css.
    expect(felt(container)).toBeTruthy();
    expect(container.querySelector('.tug')).toBeTruthy();
    expect(container.querySelector('.watch-felt__hero')).toBeTruthy();
  });

  it('R-2: opens on the first beat', () => {
    const { container } = renderTheatre();
    expect(felt(container).dataset.pace).toBe('calm');
    expect(screen.getByText(/Queens\. In\./)).toBeInTheDocument();
    expect(within(scrubber(container)).getByText('COOLER')).toBeInTheDocument();
  });

  // CLEAN-1: the adapter lowercased `beat.label`, so the opening beat handed the
  // felt street 'pre' — not a street the felt knows, which made it read the
  // whole preflop as between hands: no equity on the rope, no hand running.
  it('CLEAN-1: the opening beat is a hand in progress, not the gap before one', () => {
    const { container } = renderTheatre();
    // 47% is the equity the server recorded on his preflop raise.
    expect(container.querySelector('.tug__value').textContent).toBe('47%');
    expect(container.querySelector('.tug')).not.toHaveClass('tug--dead');
  });

  it('R-2: a tick per beat, and the flag', () => {
    const { container } = renderTheatre();
    const t = buildTimeline(coolerHand);
    const ticks = container.querySelectorAll('.replay-scrub__tick');
    expect(ticks).toHaveLength(t.beats.length);
    expect([...ticks].map((el) => el.textContent))
      .toEqual(['PRE', 'FLOP', 'ALL-IN', 'RIVER', 'END']);
  });

  it('R-2: the reel advances while playing and stops at the end', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderTheatre(coolerHand, { autoPlay: true });
      const t = buildTimeline(coolerHand);

      act(() => { vi.advanceTimersByTime(t.beats[1].at * 1000 + 200); });
      expect(felt(container).dataset.pace).not.toBe('showdown');
      expect(screen.getByText(/Set\. Charging everything\./)).toBeInTheDocument();

      // Run past the end: it holds there rather than looping.
      act(() => { vi.advanceTimersByTime(t.total * 1000 + 5000); });
      expect(container.querySelector('.replay-scrub__clock').textContent)
        .toBe(`${Math.round(t.total)}s / ${Math.round(t.total)}s`);
      expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('R-2: does not advance while paused', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderTheatre();
      act(() => { vi.advanceTimersByTime(20000); });
      expect(container.querySelector('.replay-scrub__clock').textContent).toMatch(/^0s /);
    } finally {
      vi.useRealTimers();
    }
  });

  it('R-2: scrubbing moves the felt to that moment', () => {
    const { container } = renderTheatre();
    const t = buildTimeline(coolerHand);
    const jam = t.beats.find((b) => b.label === 'ALL-IN');

    const input = screen.getByLabelText('Scrub the replay');
    // A range input is driven by setting its value and firing input, which is
    // what a drag does; userEvent has no gesture for it.
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        .set.call(input, String(jam.at + 0.5));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(felt(container).dataset.pace).toBe('allin');
    expect(screen.getByText(/All of it\./)).toBeInTheDocument();
  });

  it('R-2: the ALL-IN hold and the showdown reveal are the same beats', () => {
    const { container } = renderTheatre();
    const t = buildTimeline(coolerHand);
    const seek = (to) => act(() => {
      const input = screen.getByLabelText('Scrub the replay');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        .set.call(input, String(to));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    seek(t.beats.find((b) => b.label === 'ALL-IN').at + 0.2);
    // The felt's own all-in dress: the breathing glow and the holding tag.
    expect(felt(container).dataset.pace).toBe('allin');
    expect(container.querySelector('.watch-felt__glow')).toBeTruthy();

    seek(t.total);
    expect(felt(container).dataset.pace).toBe('showdown');
  });

  it('R-2: an attribute cost shows at its street and nowhere else', () => {
    const { container } = renderTheatre();
    const t = buildTimeline(coolerHand);
    expect(container.querySelector('.replay-theatre__cost')).toBeNull();

    act(() => {
      const input = screen.getByLabelText('Scrub the replay');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        .set.call(input, String(t.beats.find((b) => b.label === 'ALL-IN').at + 0.2));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const cost = container.querySelector('.replay-theatre__cost');
    expect(cost.textContent).toContain('he misjudged the turn by 9%');
    expect(cost.textContent).toContain('FOCUS');
  });

  it('R-2: the reveal shows both hands and what it cost', () => {
    const { container } = renderTheatre();
    const t = buildTimeline(coolerHand);
    act(() => {
      const input = screen.getByLabelText('Scrub the replay');
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        .set.call(input, String(t.total));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(screen.getByText(/Granite showed Kh Kc/)).toBeInTheDocument();
    // He lost this one, so the figure is red and negative.
    const pnl = container.querySelector('.replay-theatre__pnl');
    // Locale-tolerant: toLocaleString's thousands separator varies by ICU build.
    expect(pnl.textContent.replace(/[\s,  ]/g, '')).toBe('−$4200');
    expect(pnl.className).toContain('is-lost');
  });

  it('R-2: play/pause toggles, and play at the end starts it over', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderTheatre();
      const t = buildTimeline(coolerHand);

      act(() => { screen.getByRole('button', { name: 'Play' }).click(); });
      act(() => { vi.advanceTimersByTime(t.total * 1000 + 2000); });
      expect(container.querySelector('.replay-scrub__clock').textContent).toMatch(new RegExp(`^${Math.round(t.total)}s `));

      // Pressing play at the end is the only way back in.
      act(() => { screen.getByRole('button', { name: 'Play' }).click(); });
      act(() => { vi.advanceTimersByTime(200); });
      expect(container.querySelector('.replay-scrub__clock').textContent).toMatch(/^0s /);
    } finally {
      vi.useRealTimers();
    }
  });

  // FIX-4 (playtest 2026-09-05): opening a replay from the recap card and
  // pressing play got as far as the flop and stopped there.
  //
  // Two faults, one screen. The stage was measured by a ResizeObserver watching
  // the element whose only child IS the felt, and the felt's height is
  // 306/639 of whatever that observer reports — so every notification handed
  // back 48% of the last one and the felt collapsed to nothing. And the reel's
  // interval was keyed on `timeline.total`, read off an object rebuilt on every
  // render because every caller spreads a fresh `hand` into the theatre.
  describe('FIX-4: the reel plays to the end', () => {
    it('FIX-4: a six-beat replay reaches the last beat', () => {
      vi.useFakeTimers();
      const flush = installResizeObserver();
      try {
        const { container } = render(<ReplayTheatre hand={sixBeatHand} onBack={() => {}} />);
        const t = buildTimeline(sixBeatHand);
        expect(t.beats).toHaveLength(6);

        // Second by second, with the observer firing the way a browser's would.
        for (let i = 0; i < Math.ceil(t.total) + 3; i++) {
          act(() => { vi.advanceTimersByTime(1000); flush(); });
        }

        expect(container.querySelector('.replay-scrub__clock').textContent)
          .toBe(`${Math.round(t.total)}s / ${Math.round(t.total)}s`);
        expect(felt(container).dataset.pace).toBe('showdown');
        expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
      } finally {
        delete globalThis.ResizeObserver;
        vi.useRealTimers();
      }
    });

    it('FIX-4: the felt keeps its height instead of measuring itself away', () => {
      vi.useFakeTimers();
      const flush = installResizeObserver();
      try {
        const { container } = render(<ReplayTheatre hand={sixBeatHand} onBack={() => {}} />);
        const first = parseFloat(felt(container).style.height);
        expect(first).toBeGreaterThan(200);

        for (let i = 0; i < 20; i++) act(() => { vi.advanceTimersByTime(100); flush(); });

        expect(parseFloat(felt(container).style.height)).toBe(first);
      } finally {
        delete globalThis.ResizeObserver;
        vi.useRealTimers();
      }
    });

    it('FIX-4: every beat is reached, none is skipped or stuck', () => {
      vi.useFakeTimers();
      const flush = installResizeObserver();
      try {
        const { container } = render(<ReplayTheatre hand={sixBeatHand} onBack={() => {}} />);
        const t = buildTimeline(sixBeatHand);
        const seen = new Set();

        for (let i = 0; i < Math.ceil(t.total * 10) + 20; i++) {
          act(() => { vi.advanceTimersByTime(100); flush(); });
          seen.add(container.querySelector('.replay-scrub__where-text').textContent);
        }

        expect(seen.size).toBeGreaterThanOrEqual(5);
        expect(seen).toContain('The end of it');
      } finally {
        delete globalThis.ResizeObserver;
        vi.useRealTimers();
      }
    });
  });

  it('R-2: a one-street hand still plays', () => {
    const { container } = renderTheatre(bigBluffHand);
    expect([...container.querySelectorAll('.replay-scrub__tick')].map((el) => el.textContent))
      .toEqual(['RIVER', 'END']);
    expect(within(scrubber(container)).getByText('BIG BLUFF')).toBeInTheDocument();
  });

  it('R-2: a hand he lost is flagged as one', () => {
    const { container } = renderTheatre(badBeatHand);
    expect(within(scrubber(container)).getByText('BAD BEAT')).toBeInTheDocument();
  });

  it('R-2: Open hand is offered only when there is somewhere to go', async () => {
    const user = userEvent.setup();
    const onOpenHand = vi.fn();
    const { rerender } = renderTheatre(coolerHand, { onOpenHand });
    await user.click(screen.getByRole('button', { name: 'Open hand' }));
    expect(onOpenHand).toHaveBeenCalled();

    rerender(<ReplayTheatre hand={coolerHand} onBack={() => {}} autoPlay={false} />);
    expect(screen.queryByRole('button', { name: 'Open hand' })).not.toBeInTheDocument();
  });
});
