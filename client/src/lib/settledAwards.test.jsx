import { describe, expect, it } from 'vitest';
import { settledAwards } from './settledAwards.js';

describe('BUG-249: display payouts follow the server gross-award/rake contract', () => {
  it('leaves unraked home-game awards intact and never mutates settlement fields', () => {
    const result = { pot: 150, winners: [{ seat: 0, amount: 150 }], deltas: { 0: 50 } };
    const original = structuredClone(result);
    expect(settledAwards(result)).toEqual({ awards: [{ seat: 0, amount: 150 }], total: 150 });
    expect(result).toEqual(original);
  });
  it('deducts the actual string-keyed seat cut from a gross winner exactly once', () => {
    const result = { pot: 150, winners: [{ seat: 0, amount: 150 }],
      rake: { total: 2, bySeat: { '0': 2 } }, deltas: { 0: 48 } };
    const original = structuredClone(result);
    for (let i = 0; i < 2; i++) {
      expect(settledAwards(result)).toEqual({ awards: [{ seat: 0, amount: 148 }], total: 148 });
    }
    expect(result).toEqual(original);
  });
  it('aggregates side-pot entries before subtracting each uneven seat cut', () => {
    expect(settledAwards({ pot: 2100,
      winners: [{ seat: 0, amount: 600 }, { seat: 0, amount: 400 }, { seat: 1, amount: 1000 }, { seat: 2, amount: 100 }],
      rake: { total: 21, bySeat: { 0: 11, 1: 10 } },
    })).toEqual({ awards: [{ seat: 0, amount: 989 }, { seat: 1, amount: 990 }, { seat: 2, amount: 100 }], total: 2079 });
  });
  it('does not guess incomplete or malformed per-seat awards', () => {
    expect(settledAwards({ pot: 200, winners: [{ seat: 0, amount: 100 }, { seat: 0 }, { seat: 1, amount: 100 }],
      rake: { total: 3, bySeat: { 0: 1, 1: 2 } } })).toEqual({
      awards: [{ seat: 0, amount: null }, { seat: 1, amount: 98 }], total: 197,
    });
    expect(settledAwards({ winners: [{ seat: 0, amount: '100' }] })).toEqual({ awards: [{ seat: 0, amount: null }], total: null });
    expect(settledAwards(null)).toEqual({ awards: [], total: null });
  });
  it('uses total-only legacy rake conservatively without double subtracting', () => {
    for (const amount of [150, 148]) {
      expect(settledAwards({ pot: 150, winners: [{ seat: 0, amount }], rake: { total: 2 } }))
        .toEqual({ awards: [{ seat: 0, amount: 148 }], total: 148 });
    }
    expect(settledAwards({ pot: 200, winners: [{ seat: 0, amount: 100 }, { seat: 1, amount: 100 }], rake: { total: 3 } }))
      .toEqual({ awards: [{ seat: 0, amount: null }, { seat: 1, amount: null }], total: 197 });
    expect(settledAwards({ winners: [{ seat: 0, amount: 148 }], rake: { total: 2 } }))
      .toEqual({ awards: [{ seat: 0, amount: null }], total: null });
  });
});
