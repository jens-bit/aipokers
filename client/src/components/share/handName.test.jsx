// SHARE-1 — the second half of the result line.

import { describe, expect, it } from 'vitest';

import { handName, parseCard } from './handName.js';

describe('parseCard', () => {
  it('reads rank and suit, case-insensitively', () => {
    expect(parseCard('Ah')).toEqual({ v: 14, suit: 'h' });
    expect(parseCard('tS')).toEqual({ v: 10, suit: 's' });
    expect(parseCard('2c')).toEqual({ v: 2, suit: 'c' });
  });

  it('refuses anything it cannot read', () => {
    expect(parseCard('')).toBeNull();
    expect(parseCard('X')).toBeNull();
    expect(parseCard('1h')).toBeNull();
    expect(parseCard('Az')).toBeNull();
    expect(parseCard(null)).toBeNull();
  });
});

describe('handName', () => {
  it('names the flush by its high card — the line the ref prints', () => {
    expect(handName(['Ah', '3h', 'Kh', '7h', '2h', '9c', 'Jd'])).toBe('ace-high flush');
  });

  it('calls the wheel flush by its own high card, not the ace', () => {
    expect(handName(['Ah', '2h', '3h', '4h', '5h'])).toBe('five-high straight flush');
  });

  it('names a straight flush and reserves "royal" for the ace', () => {
    expect(handName(['9s', 'Ts', 'Js', 'Qs', 'Ks', '2d', '2c'])).toBe('king-high straight flush');
    expect(handName(['Ts', 'Js', 'Qs', 'Ks', 'As'])).toBe('royal flush');
  });

  it('names quads, boats and sets', () => {
    expect(handName(['7c', '7d', '7h', '7s', 'Kd'])).toBe('four sevens');
    expect(handName(['Kc', 'Kd', 'Kh', '9s', '9d'])).toBe('kings full of nines');
    // Two sets: the lower one plays as the pair.
    expect(handName(['Kc', 'Kd', 'Kh', '9s', '9d', '9c'])).toBe('kings full of nines');
    expect(handName(['Qc', 'Qd', 'Qh', '9s', '4d'])).toBe('three queens');
  });

  it('names straights, including the wheel', () => {
    expect(handName(['5c', '6d', '7h', '8s', '9d'])).toBe('nine-high straight');
    expect(handName(['Ac', '2d', '3h', '4s', '5d'])).toBe('five-high straight');
    // Seven cards, two straights available — the best one wins.
    expect(handName(['5c', '6d', '7h', '8s', '9d', 'Td', 'Kc'])).toBe('ten-high straight');
  });

  it('names pairs and high cards', () => {
    expect(handName(['Ah', 'Ad', '2s', '7h', 'Kd', '4c', '9s'])).toBe('pair of aces');
    expect(handName(['Kc', 'Kd', '9s', '9h', '4d'])).toBe('two pair, kings and nines');
    expect(handName(['Ah', 'Kd', '9s', '7h', '4c'])).toBe('ace-high');
  });

  it('has nothing to say about fewer than five readable cards', () => {
    expect(handName(['Ah', 'Ad'])).toBeNull();
    expect(handName(['Ah', 'Ad', '2s', '7h'])).toBeNull();
    expect(handName([null, null, '2s', '7h', 'Kd'])).toBeNull();
    expect(handName(undefined)).toBeNull();
  });
});
