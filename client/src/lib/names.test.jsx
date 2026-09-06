// client/src/lib/names.test.jsx — BUGS-A job 1

import { describe, expect, it } from 'vitest';
import { NAME_MAX, pillName } from './names.js';

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
