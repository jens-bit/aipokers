// client/src/components/home/MiniFelt.test.jsx — BUGS-A job 8
//
// The miniature felt. Everything on it is off the wire, and the two things it
// must never do are invent a table and lose the one it has.

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { MiniFelt, cardColor, ringSeats } from './MiniFelt.jsx';
import { money } from '../../lib/wallet.js';

const live = (over = {}) => ({
  tableId: 't1', street: 'flop', pot: 480, board: ['Ah', 'Kd', '2c'],
  heroSeat: 0,
  seats: [{ seat: 0, displayName: 'Big Slick' }, { seat: 1, displayName: 'Granite' }, { seat: 2, displayName: 'Doyle' }],
  ...over,
});

describe('BUGS-A job 8 · the miniature felt', () => {
  it('draws the board as far as it has run, and no further', () => {
    const { container } = render(<MiniFelt liveGame={live()} money={money} />);
    expect(container.querySelectorAll('.home-frame__card')).toHaveLength(3);
  });

  it('a card that lands is a NEW node, so only it animates in', () => {
    const { container, rerender } = render(<MiniFelt liveGame={live()} money={money} />);
    const flop = [...container.querySelectorAll('.home-frame__card')];
    rerender(<MiniFelt liveGame={live({ board: ['Ah', 'Kd', '2c', '9s'], street: 'turn' })} money={money} />);
    const turn = [...container.querySelectorAll('.home-frame__card')];
    expect(turn).toHaveLength(4);
    // The three that were already down are the same nodes — the whole board
    // does not flash every time one card arrives.
    expect(turn.slice(0, 3)).toEqual(flop);
  });

  it('a red suit is red and a black suit is not', () => {
    expect(cardColor('Ah')).toBe('#C6494C');
    expect(cardColor('Kd')).toBe('#C6494C');
    expect(cardColor('2c')).toBe('#E8E6E0');
    expect(cardColor('9S')).toBe('#E8E6E0');
    expect(cardColor(null)).toBe('#E8E6E0');
  });

  it('draws one body per seat at the table except his own', () => {
    expect(ringSeats(live())).toEqual([1, 2]);
  });

  it('with no seat list on the wire it draws the four it always drew', () => {
    expect(ringSeats(live({ seats: undefined }))).toEqual([0, 1, 2, 3]);
    expect(ringSeats(null)).toEqual([0, 1, 2, 3]);
  });

  it('states the pot in the product money format, and says nothing at zero', () => {
    const { container, rerender } = render(<MiniFelt liveGame={live({ pot: 4180 })} money={money} />);
    expect(container.querySelector('.home-frame__pot').textContent).toBe('$4,180');
    rerender(<MiniFelt liveGame={live({ pot: 0 })} money={money} />);
    expect(container.querySelector('.home-frame__pot')).toBeNull();
  });

  it('a frame with no live game is an honest dark room, never a fake felt', () => {
    const { container } = render(<MiniFelt liveGame={null} money={money} />);
    expect(container.querySelectorAll('.home-frame__card')).toHaveLength(0);
    expect(container.querySelector('.home-frame__pot')).toBeNull();
    // The felt and his seat are still drawn: he IS at a table, it just has not
    // dealt him in yet.
    expect(container.querySelector('.home-frame__felt')).not.toBeNull();
    expect(container.querySelector('.home-frame__seat')).not.toBeNull();
  });

  it('carries the street, so the CSS can tell a runout from a shuffle', () => {
    const { container } = render(<MiniFelt liveGame={live({ street: 'river' })} money={money} />);
    expect(container.querySelector('.home-frame__picture').dataset.street).toBe('river');
  });
});
