// client/src/lib/handResult.test.jsx — BUGS-A job 12
//
// "Granite took $30 with a pair of nines."
//
// The rule under test is that nothing here INVENTS a hand: it names what is on
// the table, falls back to what the server said, and says "uncontested" when
// there is genuinely nothing to name.

import { describe, expect, it } from 'vitest';

import { handResult, seatName, winningHand, withArticle } from './handResult.js';

const seats = [
  { displayName: 'The Grinder' },
  { displayName: 'Granite' },
  {},
];

const money = (n) => `$${Number(n).toLocaleString()}`;

describe('BUGS-A job 12 · naming the hand that won', () => {
  it('names it off the cards the felt is already showing', () => {
    const line = handResult({
      type: 'showdown',
      pot: 30,
      winners: [{ seat: 1, amount: 30 }],
      showdown: [{ seat: 1, holeCards: ['9h', '9d'] }],
    }, { seats, community: ['9s', 'Kc', '4d', '2h', '7c'], money });

    expect(line.line).toBe('Granite took $30 with three nines');
    expect(line.tail).toBe('with three nines');
  });

  it("the brief's own example, exactly", () => {
    const line = handResult({
      type: 'showdown',
      pot: 30,
      winners: [{ seat: 1, amount: 30 }],
      showdown: [{ seat: 1, holeCards: ['9h', 'Ad'] }],
    }, { seats, community: ['9s', 'Kc', '4d', '2h', '7c'], money });

    expect(line.line).toBe('Granite took $30 with a pair of nines');
    expect(line.who).toBe('Granite');
    expect(line.amount).toBe('$30');
    expect(line.tail).toBe('with a pair of nines');
  });

  // SHARE-1's namer writes for a share card, where a middot does the work of
  // the article. A sentence needs one, and only the sentence adds it.
  it('gives a hand name its article, and only where English wants one', () => {
    expect(withArticle('pair of nines')).toBe('a pair of nines');
    expect(withArticle('ace-high flush')).toBe('an ace-high flush');
    expect(withArticle('royal flush')).toBe('a royal flush');
    expect(withArticle('nine-high straight')).toBe('a nine-high straight');
    expect(withArticle('eight-high straight flush')).toBe('an eight-high straight flush');
    // Already a quantity, or a description rather than a thing you hold.
    expect(withArticle('four nines')).toBe('four nines');
    expect(withArticle('three nines')).toBe('three nines');
    expect(withArticle('two pair, aces and kings')).toBe('two pair, aces and kings');
    expect(withArticle('aces full of kings')).toBe('aces full of kings');
    expect(withArticle('ace-high')).toBe('ace-high');
    expect(withArticle('')).toBe('');
  });

  it('falls back to the server description when there are no cards to read', () => {
    const line = handResult({
      type: 'showdown',
      pot: 240,
      winners: [{ seat: 1, amount: 240, descr: "Two Pair, A's & K's" }],
      showdown: [],
    }, { seats, community: [], money });

    expect(line.line).toBe("Granite took $240 with two pair, a's & k's");
  });

  it("reads the brief's field name too, when the wire grows one", () => {
    expect(winningHand({ seat: 1, hand: 'a straight to the nine' })).toBe('a straight to the nine');
  });

  it('an uncontested pot says so rather than naming a hand nobody saw', () => {
    const line = handResult({
      type: 'uncontested',
      pot: 60,
      winners: [{ seat: 0, amount: 60 }],
    }, { seats, community: ['9s', 'Kc', '4d'], money });

    expect(line.line).toBe('The Grinder took $60 uncontested');
  });

  it('with nothing to name at all it still says who took what', () => {
    const line = handResult({
      type: 'showdown',
      pot: 60,
      winners: [{ seat: 0, amount: 60 }],
    }, { seats, community: [], money });

    expect(line.line).toBe('The Grinder took $60');
    expect(line.tail).toBe('');
  });

  it('a split is a split, and names no single hand', () => {
    const line = handResult({
      type: 'showdown',
      pot: 100,
      winners: [{ seat: 0, amount: 50 }, { seat: 1, amount: 50 }],
      showdown: [{ seat: 0, holeCards: ['9h', '9d'] }, { seat: 1, holeCards: ['9c', '9s'] }],
    }, { seats, community: ['As', 'Kc', '4d', '2h', '7c'], money });

    expect(line.line).toBe('The Grinder and Granite split $100');
  });

  it('falls back to the sum of the payouts when the pot is not on the result', () => {
    const line = handResult({
      type: 'uncontested',
      winners: [{ seat: 1, amount: 45 }],
    }, { seats, community: [], money });
    expect(line.amount).toBe('$45');
  });

  it('a seat with no name is a seat number, never an empty space', () => {
    expect(seatName(2, seats)).toBe('Seat 3');
    expect(seatName(9, seats)).toBe('Seat 10');
    expect(seatName(0, [])).toBe('Seat 1');
  });

  it('a result with no winners is not a line', () => {
    expect(handResult(null, { seats, money })).toBeNull();
    expect(handResult({ winners: [] }, { seats, money })).toBeNull();
  });
});
