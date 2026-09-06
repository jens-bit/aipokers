// client/src/components/system/CharacterAtoms.test.jsx — CHAT-2 item 2
//
// GrowthLine, collapsed. A session that trained six attributes drew six teal
// cards down the thread, each with the cause quoted underneath it — the feed
// stopped being a conversation and became a noticeboard. One line each now,
// and the quote is behind a tap.
//
// The rule this file holds: the DELTA is always readable without a tap, and
// the QUOTE never is.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { GrowthLine } from './CharacterAtoms.jsx';

const TICK = {
  attr: 'FOCUS', from: 51, to: 52, time: '19:00',
  line: 'Three orbits without a hand worth playing.',
};

const row = () => document.querySelector('.growth-line__row');

describe('CHAT-2 — GrowthLine is one line', () => {
  // The gap between the delta and the clock is a flex gap, so textContent has
  // no space at that boundary — hence the \s* rather than a literal one.
  it('reads "FOCUS 51 → 52 · 19:00" with nothing tapped', () => {
    render(<GrowthLine {...TICK} />);
    expect(document.querySelector('.growth-line').textContent.replace(/\s+/g, ' ').trim())
      .toMatch(/^FOCUS 51 → 52\s*· 19:00$/);
  });

  it('keeps the quote out of the feed until it is asked for', async () => {
    const user = userEvent.setup();
    render(<GrowthLine {...TICK} />);
    expect(screen.queryByText(/Three orbits/)).toBeNull();

    await user.click(row());
    expect(screen.getByText(/Three orbits/)).toBeInTheDocument();
  });

  it('puts it away again on a second tap', async () => {
    const user = userEvent.setup();
    render(<GrowthLine {...TICK} />);
    await user.click(row());
    await user.click(row());
    expect(screen.queryByText(/Three orbits/)).toBeNull();
  });

  it('says it is expandable, so the tap is not a secret', async () => {
    const user = userEvent.setup();
    render(<GrowthLine {...TICK} />);
    expect(row()).toHaveAttribute('aria-expanded', 'false');
    await user.click(row());
    expect(row()).toHaveAttribute('aria-expanded', 'true');
  });

  it('is not a tap target at all when there is no cause to show', () => {
    render(<GrowthLine attr="FOCUS" from={51} to={52} time="19:00" />);
    expect(row()).toBeDisabled();
    expect(row()).not.toHaveAttribute('aria-expanded');
  });

  it('drops the clock rather than printing an empty one', () => {
    render(<GrowthLine attr="FOCUS" from={51} to={52} line="Because." />);
    expect(document.querySelector('.growth-line__time')).toBeNull();
    expect(document.querySelector('.growth-line').textContent.replace(/\s+/g, ' ').trim())
      .toBe('FOCUS 51 → 52');
  });

  // "no box": the card the ref drew is gone, so the row cannot declare one.
  it('draws no box around itself', () => {
    render(<GrowthLine {...TICK} />);
    expect(row().style.border).toBe('');
    expect(row().style.background).toBe('');
  });

  it('treats a blank cause as no cause', () => {
    render(<GrowthLine attr="FOCUS" from={51} to={52} line="   " />);
    expect(row()).toBeDisabled();
  });
});
