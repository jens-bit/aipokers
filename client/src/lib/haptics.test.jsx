// client/src/lib/haptics.test.jsx — W3-3
//
// The haptics contract from design-refs/mood-ww-ref.jsx, asserted as rules
// rather than as a lookup table: his events only, never two inside 120ms,
// nothing while backgrounded, and silence outside Telegram.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HAPTICS, MIN_GAP_MS, fire, resetHaptics } from './haptics.js';
import { telegram } from '../test/harness.js';

function installHaptics() {
  const calls = [];
  telegram.install();
  window.Telegram.WebApp.HapticFeedback = {
    impactOccurred: (style) => calls.push(['impact', style]),
    notificationOccurred: (style) => calls.push(['notification', style]),
    selectionChanged: () => calls.push(['selection', null]),
  };
  return calls;
}

describe('W3-3 haptics', () => {
  beforeEach(() => {
    resetHaptics();
    // The harness reuses one WebApp object across tests and does not know about
    // HapticFeedback, so a spy installed by an earlier case would survive.
    telegram.install();
    delete window.Telegram.WebApp.HapticFeedback;
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('W3-3: maps every event in the table to its Telegram call', () => {
    const calls = installHaptics();
    let t = 0;
    // Each fire is walked past the 120ms floor so the throttle is not what is
    // under test here.
    for (const event of Object.keys(HAPTICS)) {
      t += MIN_GAP_MS;
      expect(fire(event, t), `${event} did not fire`).toBe(true);
    }
    expect(calls).toEqual([
      ['impact', 'light'],          // card dealt
      ['impact', 'medium'],         // his action posts
      ['impact', 'rigid'],          // heating entered
      ['notification', 'warning'],  // all-in entered
      ['impact', 'soft'],           // runout card
      ['notification', 'success'],  // won the pot
      ['impact', 'soft'],           // lost the pot
      ['selection', null],          // read forms
      ['impact', 'light'],          // prediction correct
      ['notification', 'success'],  // collect confirmed
    ]);
  });

  it('W3-3: never fires two inside 120ms', () => {
    const calls = installHaptics();
    expect(fire('hisAction', 1000)).toBe(true);
    expect(fire('hisAction', 1000 + MIN_GAP_MS - 1)).toBe(false);
    expect(calls).toHaveLength(1);

    expect(fire('hisAction', 1000 + MIN_GAP_MS)).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('W3-3: is a no-op outside Telegram', () => {
    telegram.uninstall();
    expect(fire('allin', 1000)).toBe(false);
  });

  it('W3-3: is a no-op when Telegram offers no HapticFeedback', () => {
    // An older Telegram client, or a desktop one: the WebApp is there, the
    // haptic API is not.
    expect(window.Telegram.WebApp.HapticFeedback).toBeUndefined();
    expect(fire('allin', 1000)).toBe(false);
  });

  it('W3-3: stays silent while the app is backgrounded', () => {
    const calls = installHaptics();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    expect(fire('allin', 1000)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('W3-3: an unknown event does nothing rather than throwing', () => {
    const calls = installHaptics();
    expect(fire('opponentAction', 1000)).toBe(false);
    expect(fire(undefined, 2000)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('W3-3: survives a Telegram client that throws', () => {
    telegram.install();
    window.Telegram.WebApp.HapticFeedback = {
      impactOccurred: () => { throw new Error('unsupported'); },
    };
    expect(() => fire('hisAction', 1000)).not.toThrow();
    expect(fire('hisAction', 1000)).toBe(false);
  });

  // The banned list is enforced by absence: there is no opponent event to fire.
  it('W3-3: the table has no entry for an opponent action', () => {
    const names = Object.keys(HAPTICS).join(' ').toLowerCase();
    expect(names).not.toContain('opponent');
    expect(names).not.toContain('villain');
  });
});
