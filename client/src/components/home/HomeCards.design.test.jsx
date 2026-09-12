import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeBoard } from './HomeGame.jsx';
import { HomeOne } from './atoms.jsx';

const agent = {
  id: 'home-card-owner', name: 'The Clock',
  location: { where: 'home' }, routine: { key: 'plays' },
  mood: { state: 'neutral', heat: 20 }, fatigue: 'fresh',
  holeCards: ['As', 'Kd'],
};

function expectCardSize(cards, count, width, height) {
  expect(cards).toHaveLength(count);
  for (const card of cards) {
    expect(parseFloat(card.style.width)).toBeCloseTo(width);
    expect(parseFloat(card.style.height)).toBeCloseTo(height);
  }
}

describe('HOME-1: cards fit the authored Home room', () => {
  // mood-home.jsx:393 puts two small backs in his hands. Even an owner
  // projection with private cards must remain backs in the room camera.
  it.each([[40, 11.6, 15.6], [50, 14.5, 19.5]])(
    'a %s px seated body holds two proportionate private card backs',
    (size, width, height) => {
      const { container } = render(<HomeOne agent={agent} at={{ x: 195, y: 300 }} size={size} dealt />);
      const hand = container.querySelector('.home-one__cards');
      expectCardSize([...hand.children], 2, width, height);
      expect(hand).toHaveAttribute('aria-hidden', 'true');
      expect(hand.textContent).toBe('');
      expect(hand.querySelectorAll('svg')).toHaveLength(2);
      for(const mark of hand.querySelectorAll('svg'))expect(mark).toHaveAttribute('aria-hidden','true');
      for(const mark of hand.querySelectorAll('path'))expect(mark).toHaveAttribute('fill','var(--card-back-accent)');
    },
  );

  // mood-home.jsx:456 is the phone's actual community-card scale.
  it('the phone shows only the supplied public board at 14 by 20', () => {
    render(<HomeBoard board={['9h', 'Js', '4c']} />);
    const board = screen.getByTestId('home-board');
    expectCardSize([...board.children], 3, 14, 20);
    expect(board.textContent).toBe('9J4');
  });

  // mood-home.jsx:627 leaves two 14 by 19 backs on an empty table.
  it('the phone keeps the unexposed table cards at 14 by 19', () => {
    render(<HomeBoard />);
    const board = screen.getByTestId('home-board');
    expectCardSize([...board.children], 2, 14, 19);
    expect(board.textContent).toBe('');
  });

  it.each([{ board: [] }, { board: ['9h', 'Js', '4c'] }])('desktop keeps its existing card scale for $board', ({ board }) => {
    render(<HomeBoard board={board} desktop />);
    expectCardSize([...screen.getByTestId('home-board').children], board.length || 2, 20, 28);
  });
});
