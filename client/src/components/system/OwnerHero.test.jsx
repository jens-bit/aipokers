// SIT-1 — the hero seat with the owner in it.
// Port of `OwnerChair` / `OwnerHand` in design-refs/mood-home2.jsx (52·Y1–Y4).
//
// The one thing this file exists to hold: THERE IS NO GHOST. A ghost is a
// character with a mood, a face, a heat and a pair of hands, and the owner has
// none of those. What he has is a pill, his two cards face up, and the strip.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OwnerHero } from './OwnerHero.jsx';

const HOLE = [['A', 's'], ['K', 'd']];

describe('the owner in the chair', () => {
  it('draws no ghost of its own', () => {
    const { container } = render(<OwnerHero hole={HOLE} street="FLOP" />);
    // MoodGhost's root, and the hand layer that grips a ghost's cards. Neither
    // belongs to a man the product has never drawn.
    expect(container.querySelector('.mood-ghost')).toBeNull();
    expect(container.querySelector('.watch-hero__body')).toBeNull();
    expect(container.querySelector('.watch-hero__hands')).toBeNull();
  });

  it('is his two cards, face up', () => {
    render(<OwnerHero hole={HOLE} street="FLOP" />);
    const cards = screen.getByTestId('owner-hero-cards');
    expect(cards.children).toHaveLength(2);
    // Fish-tank law from his side of the glass: the ranks are on the felt.
    expect(cards.textContent).toContain('A');
    expect(cards.textContent).toContain('K');
  });

  it('shows backs between hands, because a back is the table waiting', () => {
    render(<OwnerHero hole={null} between street="" />);
    const cards = screen.getByTestId('owner-hero-cards');
    expect(cards.textContent).not.toMatch(/[2-9TJQKA]/);
  });

  it('holds a card back until it has landed', () => {
    render(<OwnerHero hole={HOLE} landed={1} street="FLOP" />);
    const [first, second] = screen.getByTestId('owner-hero-cards').children;
    expect(first.dataset.landed).toBe('yes');
    expect(second.dataset.landed).toBe('no');
  });

  it('wears a YOU pill, and glows it on his turn rather than raising a banner', () => {
    const { rerender } = render(<OwnerHero hole={HOLE} street="FLOP" />);
    const pill = () => document.querySelector('.owner-hero__pill');
    expect(pill().textContent.trim()).toBe('YOU');
    expect(pill().dataset.turn).toBe('no');

    rerender(<OwnerHero hole={HOLE} street="FLOP" turn />);
    expect(pill().dataset.turn).toBe('yes');
    expect(pill().className).toMatch(/is-turn/);
  });

  it('keeps the rope and the strip in the ghost’s own column', () => {
    const { container } = render(
      <OwnerHero hole={HOLE} street="FLOP" pos="BTN" toCall={80} equity={0.62} />,
    );
    // Same root class as WatchHero, so the felt's anchoring is one set of
    // numbers rather than two that have to be kept in step.
    expect(container.querySelector('.watch-hero')).toBeTruthy();
    expect(container.querySelector('.watch-hero__tug')).toBeTruthy();
    expect(container.querySelector('.watch-hero__strip')).toBeTruthy();
    expect(screen.getByText('$80')).toBeTruthy();
    expect(screen.getByText('FLOP')).toBeTruthy();
    expect(screen.getByText('BTN')).toBeTruthy();
  });

  it('carries no body bars, because stamina and heat are an agent’s', () => {
    const { container } = render(<OwnerHero hole={HOLE} street="FLOP" />);
    expect(container.querySelector('.felt-bars')).toBeNull();
  });
});
