// client/src/lib/audio.test.jsx — W3-3
//
// The sound layer is a stub in this wave: the files are not in the bundle, the
// hooks are. What is real and testable today is the mute preference and the
// two events that are silent on purpose.

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SOUNDS, beat, isMuted, play, resetAudio, setMuted, toggleMuted, onMuteChange } from './audio.js';

describe('W3-3 sound', () => {
  beforeEach(() => {
    resetAudio();
    try { window.localStorage.clear(); } catch { /* private window */ }
  });

  it('W3-3: starts unmuted and remembers a mute across reads', () => {
    expect(isMuted()).toBe(false);
    setMuted(true);
    expect(isMuted()).toBe(true);

    // A fresh module read (a reload) picks the preference back up.
    resetAudio();
    expect(isMuted()).toBe(true);
  });

  it('W3-3: toggles', () => {
    expect(toggleMuted()).toBe(true);
    expect(toggleMuted()).toBe(false);
  });

  it('W3-3: notifies subscribers', () => {
    const seen = [];
    const off = onMuteChange((m) => seen.push(m));
    setMuted(true);
    setMuted(false);
    off();
    setMuted(true);
    expect(seen).toEqual([true, false]);
  });

  it('W3-3: resolves a sound per event, and none when muted', () => {
    expect(play('allin')).toMatchObject({ file: 'heavy-hit' });
    setMuted(true);
    expect(play('allin')).toBeNull();
  });

  // "Losing is quiet on purpose. A loss sound is the product telling the owner
  // off, and there is no guilt in this design."
  it('W3-3: losing the pot is silent, muted or not', () => {
    expect(SOUNDS.lostPot).toBeNull();
    expect(play('lostPot')).toBeNull();
  });

  it('W3-3: a read forming is silent — the panel animates instead', () => {
    expect(play('readForms')).toBeNull();
  });

  it('W3-3: an unknown event is silent rather than an error', () => {
    expect(play('jackpot')).toBeNull();
  });

  it('W3-3: a beat is both layers, and the haptic still fires when sound is off', () => {
    const fired = [];
    setMuted(true);
    const result = beat('allin', (e) => { fired.push(e); return true; });
    expect(fired).toEqual(['allin']);
    expect(result).toEqual({ felt: true, heard: null });
  });

  it('W3-3: survives a browser that refuses localStorage', () => {
    const boom = () => { throw new Error('blocked'); };
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(boom);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(boom);
    resetAudio();

    expect(isMuted()).toBe(false);
    expect(() => setMuted(true)).not.toThrow();
    // Still honoured for this session, just not remembered for the next one.
    expect(isMuted()).toBe(true);
  });
});
