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

const renderTheatre = (hand = coolerHand, props = {}) =>
  render(<ReplayTheatre hand={hand} onBack={() => {}} autoPlay={false} {...props} />);

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
