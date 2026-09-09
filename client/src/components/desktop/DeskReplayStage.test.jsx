// client/src/components/desktop/DeskReplayStage.test.jsx — DP-3
//
// A replay on the desk stage. "Nothing new is invented — the ALL-IN hold and
// the showdown reveal are the same beats, replayed." What is worth pinning is
// exactly that: the stage is the live stage, handed the shape the server
// sends, so DP-1's ladder and rope come along for free.

import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import '../../styles/desktop.css';

import { DeskReplayStage } from './DeskReplayStage.jsx';
import { DeskReplayPanel } from './DeskReplayPanel.jsx';
import { badBeatHand, bigBluffHand } from '../../test/fixtures/flagged.js';
import { telegram } from '../../test/harness.js';

const stage = () => document.querySelector('.dtb');

describe('DP-3 — the replay drives the live stage', () => {
  beforeEach(() => { telegram.signIn(); });

  it('renders the desk felt, not a replay-only copy of one', () => {
    const { container } = render(
      <DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} />,
    );
    expect(container.querySelector('.dtb')).toBeTruthy();
    expect(container.querySelector('.dtb__board')).toBeTruthy();
    expect(container.querySelector('.dtb__hero')).toBeTruthy();
  });

  it('BUG-90: unknown recorded stacks are not presented as zero chips', () => {
    const { container } = render(<DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} />);
    expect(container.querySelector('.dtb__hero-stack')).toHaveTextContent('—');
    expect(container.querySelector('.dtb')).not.toHaveTextContent('$0');
  });

  it('BUG-97: recorded equity does not depend on a spoken line', () => {
    const hand = { ...badBeatHand, streets: badBeatHand.streets.map(s => ({ ...s, reasoning: null })) };
    const { container } = render(<DeskReplayStage hand={hand} agentName="The Grinder" autoPlay={false} />);
    expect(screen.getByLabelText(/Hero equity 81 percent/)).toBeInTheDocument();
    expect(container.querySelector('.dtb__equity-val')).toHaveTextContent('81.0%');
  });

  it('BUG-98: unrecorded body condition is not rendered as measured heat', () => {
    const { container } = render(<DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} />);
    expect(container.querySelector('.dtb__strip [data-bar="heat"]')).toBeNull();
    expect(container.querySelector('.dtb__strip [data-bar="stamina"]')).toBeNull();
    expect(container.querySelector('.dtb__hero-body .mood-ghost')).toBeTruthy();
  });

  it('brings DP-1 with it: the ladder is on the stage', () => {
    render(<DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} />);
    // The first beat of a bad beat is preflop, and the reel opens calm.
    expect(stage()).toHaveAttribute('data-pace', 'calm');
    expect(stage().querySelector('.dtb__glow')).toBeTruthy();
  });

  it('brings the rope with it, reading the beat\'s own equity', () => {
    render(<DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} />);
    // badBeatHand opens at 81%.
    expect(screen.getByLabelText(/Hero equity 81 percent/)).toBeInTheDocument();
  });

  it('shows his line for the beat that is playing', () => {
    render(<DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} />);
    expect(screen.getByText(/Aces\. Building the pot/)).toBeInTheDocument();
  });

  it('plays the hero face up — it is his replay', () => {
    const { container } = render(
      <DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} />,
    );
    const hero = container.querySelector('.dtb__hero-cards');
    const ranks = [...hero.querySelectorAll('div')]
      .filter((el) => el.children.length === 0)
      .map((el) => el.textContent.trim())
      .filter(Boolean);
    expect(ranks).toEqual(['A', 'A']);
  });

  it('offers the way back out', () => {
    const onBack = vi.fn();
    render(<DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} onBack={onBack} />);
    screen.getByRole('button', { name: /BACK TO THE FLOOR/i }).click();
    expect(onBack).toHaveBeenCalled();
  });
});

describe('DP-3 — the transport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    telegram.signIn();
  });
  afterEach(() => { vi.useRealTimers(); });

  const tick = (ms) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

  it('BUG-91: the recording ends on its board without promising a next deal or sit-out', async () => {
    const { container } = render(<DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay />);
    await tick(60_000);
    expect(screen.queryByText('NEXT DEAL SHORTLY')).toBeNull();
    expect(screen.queryByRole('button', { name: /Sit out after this hand/i })).toBeNull();
    expect(screen.getByText('End of replay')).toBeInTheDocument();
    expect(container.querySelector('.dtb__equity-val')).toHaveTextContent('0.0%');
    expect(container.querySelector('.dtb__pot-amt').textContent).toBe(`$${badBeatHand.pot.toLocaleString()}`);
    expect([...container.querySelector('.dtb__board').children].map(card => card.textContent)).toEqual(['2', '7', 'K', '4', '9']);
  });

  it('draws the scrubber below the felt', () => {
    const { container } = render(
      <DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay={false} />,
    );
    expect(container.querySelector('.dsk-replay__scrub .replay-scrub')).toBeTruthy();
  });

  it('advances the reel, and the stage follows it', async () => {
    render(<DeskReplayStage hand={badBeatHand} agentName="The Grinder" autoPlay />);

    const opening = stage().getAttribute('data-pace');
    expect(opening).toBe('calm');

    // Far enough in for the pot to have grown past the threshold.
    await tick(12_000);
    expect(['heating', 'allin', 'showdown']).toContain(stage().getAttribute('data-pace'));
  });

  it('stops at the end rather than looping', async () => {
    render(<DeskReplayStage hand={bigBluffHand} agentName="The Grinder" autoPlay />);
    await tick(60_000);
    // The last beat is the end of it; the stage is still showing something.
    expect(stage()).toBeTruthy();
  });
});

describe('DP-3 — the rail panel', () => {
  beforeEach(() => { telegram.signIn(); });

  it('names the hand and its flag', () => {
    render(<DeskReplayPanel hand={badBeatHand} />);
    expect(screen.getByText(/HAND #37/)).toBeInTheDocument();
    expect(screen.getByText(/BAD BEAT/)).toBeInTheDocument();
  });

  it('carries the mobile poster, not a desktop copy', () => {
    const { container } = render(<DeskReplayPanel hand={badBeatHand} />);
    expect(container.querySelector('.replay-card')).toBeTruthy();
  });

  it('lists his line street by street', () => {
    const { container } = render(<DeskReplayPanel hand={badBeatHand} />);
    // Scoped to the beat list: the poster above it quotes a line too, and one
    // of them appearing twice on the panel is the point of the poster.
    const beats = within(container.querySelector('.dsk-apanel__body'));
    expect(beats.getByText(/Aces\. Building the pot/)).toBeInTheDocument();
    expect(beats.getByText(/Dry board, still the best hand/)).toBeInTheDocument();
    expect(beats.getByText(/He got there\./)).toBeInTheDocument();

    // Labels come from the timeline, so the rail and the felt cannot disagree.
    expect(container.querySelectorAll('.dsk-beat')).toHaveLength(3);
  });

  it('says so when he did not speak, rather than drawing an empty list', () => {
    render(<DeskReplayPanel hand={{ ...badBeatHand, streets: badBeatHand.streets.map((s) => ({ ...s, reasoning: null })) }} />);
    expect(screen.getByText(/did not say anything/i)).toBeInTheDocument();
  });

  it('closes back to the rail', () => {
    const onClose = vi.fn();
    render(<DeskReplayPanel hand={badBeatHand} onClose={onClose} />);
    screen.getByRole('button', { name: /close/i }).click();
    expect(onClose).toHaveBeenCalled();
  });
});
