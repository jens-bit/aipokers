// client/src/lib/names.test.jsx — BUGS-A job 1

import { describe, expect, it } from 'vitest';
import { NAME_MAX, pillName, shortName } from './names.js';

describe('BUGS-A job 1 · a pill writes the whole name', () => {
  it('a two-word name is not cut down to its first word', () => {
    expect(pillName('The Clock')).toBe('The Clock');
    expect(pillName('Wild Bill')).toBe('Wild Bill');
  });

  it('a name exactly at the limit is written whole', () => {
    const at = 'a'.repeat(NAME_MAX);
    expect(pillName(at)).toBe(at);
  });

  it('past the limit it is cut and says so', () => {
    expect(pillName('Bluff Master Supreme')).toBe('Bluff Master S…');
    expect(pillName('Bluff Master Supreme').length).toBe(NAME_MAX + 1);
  });

  it('never leaves a space hanging in front of the ellipsis', () => {
    // Cut at 14 this lands on the space before "Reilly".
    expect(pillName('Bluffmaster A Reilly')).toBe('Bluffmaster A…');
  });

  it('a missing name is an empty string, never "undefined"', () => {
    expect(pillName(undefined)).toBe('');
    expect(pillName(null)).toBe('');
    expect(pillName('   ')).toBe('');
  });

  it('the limit can be tightened for a narrower surface', () => {
    expect(pillName('The Clock', 5)).toBe('The C…');
  });
});

// ── HOME-2 job 2 · six characters over his head ─────────────────────────────

describe('shortName — the pill in the room', () => {
  it('writes a name that already fits, whole', () => {
    expect(shortName('Rocky')).toBe('Rocky');
    expect(shortName('Granit')).toBe('Granit');
  });

  it('cuts to six, and never with an ellipsis', () => {
    expect(shortName('The Clock')).toBe('The Cl');
    expect(shortName('Bluff Master')).toBe('Bluff');
    expect(shortName('Aggressive v1.3')).toBe('Aggres');
  });

  // BUGS-A job 1's rule survives the cut: a first word is a DIFFERENT name, so
  // two agents an owner named apart must not collapse into one word.
  it('is a cut and not a first word — two names stay two names', () => {
    expect(shortName('The Clock')).not.toBe(shortName('The Grinder'));
    expect(shortName('The Clock')).not.toBe('The');
  });

  // The server does not send one yet. It is read the moment it does.
  it('prefers the nickname the server gives, when the name is too long', () => {
    expect(shortName('The Clock', 'Tick')).toBe('Tick');
    // ...and only then. A name that fits is his name.
    expect(shortName('Rocky', 'Rock')).toBe('Rocky');
  });

  it('cuts an over-long nickname rather than falling back to the name', () => {
    expect(shortName('Aggressive v1.3', 'Aggressor')).toBe('Aggres');
    expect(shortName('Aggressive v1.3', 'Hothead')).toBe('Hothea');
  });

  it('has nothing to say about nothing', () => {
    expect(shortName('')).toBe('');
    expect(shortName(null)).toBe('');
    expect(shortName(undefined, undefined)).toBe('');
  });

  // The pill's rule is the pill's alone: the plate and the roster still write
  // him whole, because they have the room and a cut name there would be a
  // different agent to look at.
  it('does not touch the rule the plate and the roster use', () => {
    expect(pillName('The Clock')).toBe('The Clock');
    expect(pillName('Bluff Master')).toBe('Bluff Master');
  });
});
