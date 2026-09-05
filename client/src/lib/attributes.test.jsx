// client/src/lib/attributes.test.jsx — FIX-1h / FIX-1i
//
// The character-system data contract. Pure functions, so these are plain unit
// tests: no rendering, no fetch, no clock beyond the `now` each helper takes.
//
// FIX-1h covers two rider defects found after ATTR-3 landed:
//   1. normalizeAttrs never set row.narrowed, so AttrBar's gold caret — which
//      AttrCluster has always passed through — could not fire.
//   2. grewWithin counted every attrLog entry, including ATTR-3's two
//      book-keeping causes ('birth', 'narrowed'), so a newborn who had not
//      played a hand wore a GREW badge.
// FIX-1i carries the same cause filter into recentEntries, which feeds the
// thread's growth lines.

import { describe, expect, it } from 'vitest';

import {
  ATTR_KEYS,
  ATTR_STEP,
  NATURES,
  gainsWithin,
  grewWithin,
  isGrowthTick,
  normalizeAttrs,
  recentEntries,
  seriesFor,
} from './attributes.js';

const NOW = Date.UTC(2026, 8, 5, 12, 0, 0);
const hoursAgo = (h) => NOW - h * 60 * 60 * 1000;

const tick = (key, from, to, h, cause = 'third showdown against the same opponent') =>
  ({ ts: hoursAgo(h), key, from, to, cause });

const fullAttrs = () => Object.fromEntries(ATTR_KEYS.map((k) => [k, 60]));

describe('attributes contract', () => {
  it('keeps the canon order and the nature step', () => {
    expect(ATTR_KEYS).toEqual(['READS', 'FOCUS', 'DISCIPLINE', 'COMPOSURE', 'DECEPTION', 'STAMINA']);
    expect(ATTR_STEP).toBe(8);
    expect(NATURES).toHaveLength(8);
  });

  it('returns six rows for an agent the server knows nothing about', () => {
    const { rows, scouted } = normalizeAttrs(undefined);
    expect(rows.map((r) => r.key)).toEqual(ATTR_KEYS);
    expect(scouted).toBe(false);
    for (const row of rows) {
      expect(row.cur).toBe(50);
      expect(row.lo).toBeGreaterThanOrEqual(row.cur);
      expect(row.hi).toBeLessThanOrEqual(100);
    }
  });
});

// ── FIX-1h · the narrowed caret ─────────────────────────────────────────────

describe('FIX-1h narrowed passthrough', () => {
  it('FIX-1h: marks the rows whose band just narrowed', () => {
    const { rows } = normalizeAttrs({
      attrs: fullAttrs(),
      narrowed: ['FOCUS', 'DECEPTION'],
    });

    const marked = rows.filter((r) => r.narrowed).map((r) => r.key);
    expect(marked).toEqual(['FOCUS', 'DECEPTION']);
  });

  it('FIX-1h: every row is unmarked when nothing narrowed', () => {
    for (const narrowed of [null, undefined, []]) {
      const { rows } = normalizeAttrs({ attrs: fullAttrs(), narrowed });
      expect(rows.every((r) => r.narrowed === false)).toBe(true);
    }
  });

  it('FIX-1h: narrowed is always a boolean, never undefined', () => {
    // AttrBar branches on it; a stray undefined would render the same but is a
    // hole in the contract the next surface would fall into.
    const { rows } = normalizeAttrs({ attrs: fullAttrs(), narrowed: ['FOCUS'] });
    for (const row of rows) expect(typeof row.narrowed).toBe('boolean');
  });

  it('FIX-1h: ignores junk in the narrowed field', () => {
    const { rows } = normalizeAttrs({
      attrs: fullAttrs(),
      narrowed: ['FOCUS', 'NOT_AN_ATTRIBUTE', null],
    });
    expect(rows.filter((r) => r.narrowed).map((r) => r.key)).toEqual(['FOCUS']);

    // A non-array is treated as "nothing narrowed" rather than throwing.
    expect(normalizeAttrs({ attrs: fullAttrs(), narrowed: 'FOCUS' }).rows
      .some((r) => r.narrowed)).toBe(false);
  });
});

// ── FIX-1h · the GREW badge's cause filter ──────────────────────────────────

describe('FIX-1h grew badge cause filter', () => {
  it('FIX-1h: a birth ledger entry is not growth', () => {
    const log = ATTR_KEYS.map((k) => ({ ts: hoursAgo(1), key: k, from: 42, to: 42, cause: 'birth' }));

    expect(grewWithin(log, 24, NOW)).toBe(false);
    expect(gainsWithin(log, 24, NOW)).toEqual([]);
  });

  it('FIX-1h: a narrowed scouting entry is not growth', () => {
    const log = [{ ts: hoursAgo(2), key: 'FOCUS', from: 62, to: 62, cause: 'narrowed' }];

    expect(grewWithin(log, 24, NOW)).toBe(false);
    expect(gainsWithin(log, 24, NOW)).toEqual([]);
  });

  it('FIX-1h: a real tick still lights the badge', () => {
    const log = [tick('READS', 61, 62, 3)];

    expect(grewWithin(log, 24, NOW)).toBe(true);
    expect(gainsWithin(log, 24, NOW)).toEqual([{ key: 'READS', gain: 1 }]);
  });

  it('FIX-1h: ledger entries mixed in with a tick neither hide nor inflate it', () => {
    const log = [
      { ts: hoursAgo(20), key: 'FOCUS', from: 54, to: 54, cause: 'birth' },
      tick('READS', 61, 62, 4),
      { ts: hoursAgo(2), key: 'READS', from: 62, to: 62, cause: 'narrowed' },
      tick('DISCIPLINE', 72, 73, 1),
    ];

    expect(grewWithin(log, 24, NOW)).toBe(true);
    expect(gainsWithin(log, 24, NOW)).toEqual([
      { key: 'READS', gain: 1 },
      { key: 'DISCIPLINE', gain: 1 },
    ]);
  });

  it('FIX-1h: a newborn wears no badge', () => {
    // The exact shape agentProfiles writes at creation: one birth entry per
    // attribute, no hands played. This was showing "+0 GREW" on the roster.
    const born = ATTR_KEYS.map((k) => ({ ts: hoursAgo(0.1), key: k, from: 36, to: 36, cause: 'birth' }));
    expect(grewWithin(born, 24, NOW)).toBe(false);
  });

  it('FIX-1h: growth outside the window does not count', () => {
    expect(grewWithin([tick('READS', 61, 62, 48)], 24, NOW)).toBe(false);
    expect(grewWithin([tick('READS', 61, 62, 48)], 72, NOW)).toBe(true);
  });

  it('FIX-1h: isGrowthTick names the rule the badge follows', () => {
    expect(isGrowthTick(tick('READS', 61, 62, 1))).toBe(true);
    expect(isGrowthTick({ key: 'READS', from: 61, to: 61, cause: 'birth' })).toBe(false);
    expect(isGrowthTick({ key: 'READS', from: 61, to: 61, cause: 'narrowed' })).toBe(false);
    expect(isGrowthTick({ key: 'NOPE', from: 1, to: 2, cause: 'x' })).toBe(false);
    expect(isGrowthTick(null)).toBe(false);
  });

  // The sparkline is deliberately NOT filtered: a 'narrowed' entry carries
  // from === to, so it draws no step, and 'birth' is the series' true origin.
  it('FIX-1h: the sparkline still starts from the birth entry', () => {
    const log = [
      { ts: hoursAgo(72), key: 'FOCUS', from: 54, to: 54, cause: 'birth' },
      tick('FOCUS', 54, 55, 40),
      tick('FOCUS', 55, 56, 2),
    ];
    expect(seriesFor(log, 'FOCUS', 90, NOW)).toEqual([54, 54, 55, 56]);
  });
});

// ── FIX-1i · the thread's growth lines ──────────────────────────────────────
// The same rule, one surface further on. recentEntries feeds GrowthLine, which
// renders "FOCUS 62 → 62" with the cause quoted underneath as his own voice. A
// ledger entry there is him announcing a step he did not take, in a sentence he
// never said.

describe('FIX-1i growth line cause filter', () => {
  it('FIX-1i: recentEntries drops birth and narrowed entries', () => {
    const log = [
      { ts: hoursAgo(6), key: 'FOCUS', from: 54, to: 54, cause: 'birth' },
      { ts: hoursAgo(2), key: 'FOCUS', from: 62, to: 62, cause: 'narrowed' },
    ];
    expect(recentEntries(log, 24, NOW)).toEqual([]);
  });

  it('FIX-1i: recentEntries keeps real ticks, oldest first', () => {
    const log = [
      tick('DISCIPLINE', 72, 73, 1, 'folded top pair to the river jam'),
      { ts: hoursAgo(2), key: 'READS', from: 62, to: 62, cause: 'narrowed' },
      tick('READS', 61, 62, 4, 'third showdown against the same opponent'),
      { ts: hoursAgo(20), key: 'STAMINA', from: 41, to: 41, cause: 'birth' },
    ];

    expect(recentEntries(log, 24, NOW).map((e) => [e.key, e.from, e.to])).toEqual([
      ['READS', 61, 62],
      ['DISCIPLINE', 72, 73],
    ]);
  });

  it('FIX-1i: a session that only narrowed produces no growth lines', () => {
    // Exactly what ATTR-3 writes when a scouting stage is reached and nothing
    // ticked: six narrowed entries, no growth. The thread must stay quiet.
    const log = ATTR_KEYS.map((k) => ({ ts: hoursAgo(1), key: k, from: 60, to: 60, cause: 'narrowed' }));

    expect(recentEntries(log, 24, NOW)).toEqual([]);
    expect(grewWithin(log, 24, NOW)).toBe(false);
    expect(gainsWithin(log, 24, NOW)).toEqual([]);
  });
});
