// Chips — ported from design-refs/mood-watch5.jsx (CHIP_D, ChipStack, BetSpot,
// 52j "A bet, as objects").
//
// The rule this file exists to protect: a pile's SHAPE is its size. If the
// denominations collapse to one colour, or a band stops changing the count, the
// felt goes back to being a number in a panel.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BET_BANDS, CHIP_BANDS, CHIP_D, BetSpot, ChipStack, PotChip, potBand, stackBand,
} from './Chips.jsx';

describe('the chips', () => {
  // White 1 · red 5 · blue 10 · green 25 · black 100. Real denominations, so a
  // pile reads as money rather than as a stack of discs.
  it('are real denominations', () => {
    expect(Object.keys(CHIP_D)).toEqual(['w', 'r', 'b', 'g', 'k']);
    expect(new Set(Object.values(CHIP_D)).size).toBe(5);
  });

  it('draw a band as a pile that grows with it', () => {
    const n = (band) => {
      const { container, unmount } = render(<ChipStack band={band} />);
      const count = container.querySelectorAll('.chip').length;
      unmount();
      return count;
    };
    expect(n('small')).toBe(CHIP_BANDS.small.length);
    expect(n('mid')).toBe(CHIP_BANDS.mid.length);
    expect(n('big')).toBe(CHIP_BANDS.big.length);
    expect(n('small')).toBeLessThan(n('mid'));
    expect(n('mid')).toBeLessThan(n('big'));
  });

  // "The figure belongs UNDER the chips it describes, not in a panel elsewhere."
  it('captions the one pile big enough to label, and no other', () => {
    const { container } = render(<ChipStack band="mid" w={26} label="STACK" amt="$1,847" />);
    expect(container.querySelector('.chip-stack__label').textContent).toBe('STACK');
    expect(container.querySelector('.chip-stack__amt').textContent).toBe('$1,847');

    const plain = render(<ChipStack band="small" w={13} />).container;
    expect(plain.querySelector('.chip-stack__label')).toBeNull();
    expect(plain.querySelector('.chip-stack__amt')).toBeNull();
  });

  // "One hand picks 1-4 chips off the top — the count IS the bet band."
  it('the chip count on a bet spot is the bet band', () => {
    const n = (band) => {
      const { container, unmount } = render(<BetSpot band={band} />);
      const count = container.querySelectorAll('.chip').length;
      unmount();
      return count;
    };
    expect(n('small')).toBe(BET_BANDS.small.length);
    expect(n('mid')).toBe(BET_BANDS.mid.length);
    expect(n('big')).toBe(BET_BANDS.big.length);
    expect(n('small')).toBeLessThan(n('big'));
  });

  // "The pot pill grows one step per band" — so a table that has been betting
  // big looks different from one that has been limping, before a figure is read.
  it('the pot pill gains a chip that grows one step per band', () => {
    const h = (band) => {
      const { container, unmount } = render(<PotChip band={band} />);
      const el = container.querySelector('.pot-chip');
      const n = el.querySelectorAll('.chip').length;
      const height = el.style.height;
      unmount();
      return { n, height };
    };
    expect(h('small').n).toBe(2);
    expect(h('mid').n).toBe(3);
    expect(h('big').n).toBe(5);
    expect(h('small').height).toBe('8px');
    expect(h('mid').height).toBe('12px');
    expect(h('big').height).toBe('17px');
  });

  // Bands are ratios, so they mean the same thing at $2/$4 as at $200/$400.
  it('reads a band off the money rather than off an absolute', () => {
    expect(stackBand(400, 2000)).toBe('small');
    expect(stackBand(2000, 2000)).toBe('mid');
    expect(stackBand(4000, 2000)).toBe('big');
    expect(stackBand(0, 2000)).toBe('small');

    expect(potBand(60, 20)).toBe('small');   // 3bb
    expect(potBand(300, 20)).toBe('mid');    // 15bb
    expect(potBand(900, 20)).toBe('big');    // 45bb
    expect(potBand(0, 20)).toBe('small');
  });
});
