// client/src/lib/predict.test.jsx — W3-4
//
// The prediction beat's rules. It ships dark: this is the one part of the wave
// that could turn a manager game into a clicker if it reads wrong, so the flag
// is off unless someone turns it on.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GUESSES, getStreak, guessFor, predictEnabled, resetPredict, settle,
} from './predict.js';

describe('W3-4 the prediction beat', () => {
  beforeEach(() => {
    resetPredict();
    try { window.localStorage.clear(); } catch { /* private window */ }
  });

  it('W3-4: is off by default', () => {
    expect(predictEnabled()).toBe(false);
  });

  it('W3-4: turns on only for the exact flag', () => {
    window.localStorage.setItem('ap_predict', '1');
    expect(predictEnabled()).toBe(true);

    window.localStorage.setItem('ap_predict', 'true');
    expect(predictEnabled()).toBe(false);
  });

  it('W3-4: stays off when the store is blocked', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(predictEnabled()).toBe(false);
  });

  it('W3-4: offers three guesses and nothing to spend', () => {
    expect(GUESSES).toEqual(['Fold', 'Call', 'Raise']);
  });

  it('W3-4: maps his action onto the chip that settles it', () => {
    expect(guessFor({ type: 'fold' })).toBe('Fold');
    expect(guessFor({ type: 'call' })).toBe('Call');
    // A check is him calling for nothing, which is what the chip means to
    // someone who is not a poker player.
    expect(guessFor({ type: 'check' })).toBe('Call');
    expect(guessFor({ type: 'bet' })).toBe('Raise');
    expect(guessFor({ type: 'raise' })).toBe('Raise');
    expect(guessFor('fold')).toBe('Fold');
    expect(guessFor(null)).toBeNull();
  });

  it('W3-4: a right guess extends the streak', () => {
    expect(settle('Raise', { type: 'bet' })).toEqual({ right: true, streak: 1 });
    expect(settle('Fold', { type: 'fold' })).toEqual({ right: true, streak: 2 });
    expect(getStreak()).toBe(2);
  });

  it('W3-4: a wrong guess takes it to zero', () => {
    settle('Raise', { type: 'bet' });
    settle('Raise', { type: 'bet' });
    expect(settle('Fold', { type: 'call' })).toEqual({ right: false, streak: 0 });
  });

  it('W3-4: an action the chips cannot express leaves the streak alone', () => {
    settle('Raise', { type: 'bet' });
    expect(settle('Raise', { type: 'muck' })).toEqual({ right: null, streak: 1 });
    expect(getStreak()).toBe(1);
  });

  it('W3-4: the streak is memory only — nothing is written down', () => {
    settle('Raise', { type: 'bet' });
    expect(getStreak()).toBe(1);

    const stored = Object.keys(window.localStorage);
    expect(stored.join(' ')).not.toContain('streak');
    // A reload starts over: a number the owner cannot bank is a number the
    // product cannot dangle.
    resetPredict();
    expect(getStreak()).toBe(0);
  });
});
