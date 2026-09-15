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

  // JOB C / BUG-206 — the label under his cards said only the street name
  // ('FLOP'), never what his own two cards actually make, at the same size
  // and weight WatchHero already gives a spectated agent's reading.
  it('BUG-206: names the hand once it is known, not just the street', () => {
    render(<OwnerHero hole={HOLE} street="FLOP" currentHand="ace-high" />);
    const num = document.querySelector('.watch-hero__hand-name');
    expect(num).toBeTruthy();
    expect(num.textContent).toBe('ace-high');
    expect(screen.getByText(/FLOP · Hand now/)).toBeInTheDocument();
  });

  it('BUG-206: falls back to the street label when there is no reading yet', () => {
    render(<OwnerHero hole={HOLE} street="FLOP" currentHand={null} />);
    expect(document.querySelector('.watch-hero__hand-name')).toBeNull();
    expect(screen.getByText('Street')).toBeInTheDocument();
    expect(screen.getByText('FLOP')).toBeInTheDocument();
  });
});


describe('DkOwnerM desktop owner seat',()=>{
  it('keeps real stack and equity alongside the larger owner cards',()=>{
    const {container}=render(<OwnerHero variant="desktop" hole={HOLE} stack={1847} equity={64} turn />);
    expect(container.querySelector('.owner-hero__pill')).toHaveTextContent('YOU $1,847');
    expect(container.querySelector('.owner-hero__chance')).toHaveTextContent('YOU WIN64%');
    const card=screen.getByTestId('owner-hero-cards').firstElementChild.firstElementChild;
    expect(card.style.width).toBe('58px');expect(card.style.height).toBe('81px');
    expect(container.querySelector('.watch-hero__strip')).toBeNull();
    expect(container.querySelector('.mood-ghost')).toBeNull();
  });
  it('does not invent a stack or a winning chance before the server supplies them',()=>{
    const {container}=render(<OwnerHero variant="desktop" hole={null} between />);
    expect(container.querySelector('.owner-hero__pill')).toHaveTextContent('YOU —');
    expect(container.querySelector('.owner-hero__chance')).toHaveTextContent('YOU WIN—');
  });

  // JOB C / BUG-206 — the desk owner seat had no reading of his own hand at
  // all, on or off; this is that reading, in the desk's own label/value pair.
  it('BUG-206: reads his own hand on the desk seat too', () => {
    const { container } = render(
      <OwnerHero variant="desktop" hole={HOLE} street="FLOP" currentHand="pair of kings" />,
    );
    const street = container.querySelector('.owner-hero__desk-street');
    expect(street).toBeTruthy();
    expect(street).toHaveTextContent('pair of kings');
    expect(street.textContent).toMatch(/FLOP · Hand now/);
  });

  it('BUG-206: the desk seat falls back to the street label with no reading', () => {
    const { container } = render(<OwnerHero variant="desktop" hole={HOLE} street="FLOP" />);
    const street = container.querySelector('.owner-hero__desk-street');
    expect(street).toHaveTextContent('Street');
    expect(street).toHaveTextContent('FLOP');
  });
});
