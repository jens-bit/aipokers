// client/src/lib/deltas.test.jsx — WATCH-7
//
// The seam between "what the server says the hand did to him" and "what the
// screen can work out on its own". The fallback is the behaviour WATCH-6
// shipped; the server's number is what SERVER-3 is adding. Both have to be
// right, and the caller must never be able to tell which one it got.

import { describe, expect, it } from 'vitest';
import { serverDelta, handDelta, money } from './deltas.js';

describe('WATCH-7: result.deltas, in every shape the server might send it', () => {
  it('reads a map keyed by seat', () => {
    expect(serverDelta({ deltas: { 0: -30, 1: 30 } }, 0)).toBe(-30);
    expect(serverDelta({ deltas: { '0': -30, '1': 30 } }, 1)).toBe(30);
  });

  it('reads an array indexed by seat', () => {
    expect(serverDelta({ deltas: [-30, 30, 0] }, 2)).toBe(0);
  });

  it('reads a row per seat, under either obvious field name', () => {
    expect(serverDelta({ deltas: [{ seat: 0, delta: -30 }, { seat: 1, delta: 30 }] }, 1)).toBe(30);
    expect(serverDelta({ deltas: [{ seat: 0, net: -30 }] }, 0)).toBe(-30);
  });

  it('is null for a seat the payload does not mention', () => {
    expect(serverDelta({ deltas: { 0: -30 } }, 1)).toBeNull();
    expect(serverDelta({ deltas: [-30] }, 4)).toBeNull();
    expect(serverDelta({ deltas: [{ seat: 1, delta: 30 }] }, 0)).toBeNull();
  });

  it('is null when the result carries no deltas at all', () => {
    expect(serverDelta({ pot: 400 }, 0)).toBeNull();
    expect(serverDelta(null, 0)).toBeNull();
    expect(serverDelta({ deltas: 'nope' }, 0)).toBeNull();
  });
});

describe('WATCH-7: the server’s number wins, the derivation is the fallback', () => {
  it('prefers result.deltas over the stack difference', () => {
    const d = handDelta({ deltas: { 0: 250 } }, 0, { stackNow: 1200, stackAtDeal: 1000 });
    expect(d).toBe(250);
  });

  it('derives now − at-deal when the server sent nothing', () => {
    expect(handDelta({ pot: 400 }, 0, { stackNow: 1200, stackAtDeal: 1000 })).toBe(200);
    expect(handDelta({ pot: 400 }, 0, { stackNow: 940, stackAtDeal: 1000 })).toBe(-60);
  });

  // Joining mid-hand: there is no baseline, and inventing "+$0" would be the
  // screen telling the owner his agent broke even on a hand it never saw.
  it('is null with neither a server delta nor a baseline', () => {
    expect(handDelta({ pot: 400 }, 0, { stackNow: 1200, stackAtDeal: null })).toBeNull();
    expect(handDelta({ pot: 400 }, 0, {})).toBeNull();
  });

  // A zero from the server is a fact — he was not in the hand — and must not be
  // mistaken for a missing field.
  it('keeps a server-sent zero', () => {
    expect(handDelta({ deltas: { 0: 0 } }, 0, { stackNow: 900, stackAtDeal: 1000 })).toBe(0);
  });
});

describe('WATCH-7: the money the toast prints', () => {
  it('signs it, and uses the felt’s own minus', () => {
    expect(money(30)).toBe('+$30');
    expect(money(-30)).toBe('−$30');
    expect(money(0)).toBe('+$0');
    // toLocaleString, so the separator is the runtime's, not a comma.
    expect(money(1250)).toBe('+$' + (1250).toLocaleString());
  });

  it('is null for a number there is none of', () => {
    expect(money(null)).toBeNull();
    expect(money(undefined)).toBeNull();
  });
});
