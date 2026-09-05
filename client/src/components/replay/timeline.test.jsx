// client/src/components/replay/timeline.test.jsx — R-1
//
// The timeline is the only part of the replay that reasons about a stored hand,
// so it is the part that has to be right about what the server keeps and what
// it does not. Two fixtures are the real ones the flagged sheet is tested on;
// the third is a COOLER in the same documented shape, because the shared
// fixtures module has no cooler in it.

import { describe, expect, it } from 'vitest';

import { FLAGS, actionAmount, beatAt, beatIndexAt, buildTimeline, isAllIn, snapshotFor, streetForBeat } from './timeline.js';
import { badBeatHand, bigBluffHand } from '../../test/fixtures/flagged.js';

// Same shape as buildFlaggedEntry's output; set over set, four streets, a jam
// on the turn and both hands turned over.
const coolerHand = {
  flagType: 'cooler',
  handNumber: 58,
  pot: 4200,
  holeCards: ['Qs', 'Qd'],
  opponentShowdownCards: [{ seat: 2, holeCards: ['Kh', 'Kc'] }],
  won: false,
  streets: [
    { street: 'preflop', board: [], action: 'raise 60', equity: 47, potOdds: 25, reasoning: 'Queens. In.' },
    { street: 'flop', board: ['Qh', '7d', '2c'], action: 'bet 180', equity: 92, potOdds: null, reasoning: 'Set. Charging everything.' },
    { street: 'turn', board: ['Qh', '7d', '2c', 'Kd'], action: 'all-in 1960', equity: 31, potOdds: 38, reasoning: 'All of it. He has one king at most.' },
    { street: 'river', board: ['Qh', '7d', '2c', 'Kd', '3s'], action: 'call 0', equity: 0, potOdds: null, reasoning: 'Set over set. Nothing to be done.' },
  ],
  attrCosts: [{ key: 'FOCUS', line: 'he misjudged the turn by 9%', street: 'turn' }],
  flaggedAt: 1788609400000,
};

describe('R-1 action parsing', () => {
  it('R-1: reads the amount out of an action string', () => {
    expect(actionAmount('raise 120')).toBe(120);
    expect(actionAmount('call 900')).toBe(900);
    expect(actionAmount('all-in 1,960')).toBe(1960);
    expect(actionAmount('check')).toBe(0);
    expect(actionAmount(null)).toBe(0);
  });

  it('R-1: recognises a stack going in', () => {
    expect(isAllIn('all-in 1960')).toBe(true);
    expect(isAllIn('ALL IN')).toBe(true);
    expect(isAllIn('jam 400')).toBe(true);
    expect(isAllIn('raise 400')).toBe(false);
  });
});

describe('R-1 buildTimeline', () => {
  it('R-1: one beat per stored street, plus the reveal', () => {
    const t = buildTimeline(badBeatHand);
    expect(t.beats.map((b) => b.label)).toEqual(['PRE', 'FLOP', 'RIVER', 'END']);
    expect(t.flag).toBe(FLAGS.badBeat);
    expect(t.handNumber).toBe(37);
  });

  it('R-1: the clock runs forward and the total is the last beat plus its hold', () => {
    for (const hand of [badBeatHand, bigBluffHand, coolerHand]) {
      const t = buildTimeline(hand);
      let last = -1;
      for (const beat of t.beats) {
        expect(beat.at, `${hand.flagType} ${beat.label}`).toBeGreaterThan(last);
        expect(beat.seconds).toBeGreaterThan(0);
        last = beat.at;
      }
      const end = t.beats[t.beats.length - 1];
      expect(t.total).toBeCloseTo(end.at + end.seconds, 5);
    }
  });

  it('R-1: lands inside the ref\'s 20–40 second theatre', () => {
    // The ref's own timeline is 28.5s. A one-street hand is necessarily shorter
    // than a four-street one, so the floor is what a single beat plus a reveal
    // costs rather than 20.
    expect(buildTimeline(coolerHand).total).toBeGreaterThanOrEqual(20);
    expect(buildTimeline(coolerHand).total).toBeLessThanOrEqual(40);
    expect(buildTimeline(badBeatHand).total).toBeLessThanOrEqual(40);
  });

  it('R-1: every line is his own reasoning, never composed', () => {
    const t = buildTimeline(badBeatHand);
    expect(t.beats.map((b) => b.line)).toEqual([
      'Aces. Building the pot while I am this far ahead.',
      'Dry board, still the best hand. Charging the draws.',
      'He got there. I called anyway and I should not have.',
      null, // the reveal says nothing he did not say
    ]);
  });

  it('R-1: every equity is the one the server computed', () => {
    const t = buildTimeline(badBeatHand);
    expect(t.beats.map((b) => b.equity)).toEqual([81, 88, 6, 0]);
  });

  it('R-1: the board only ever grows, and flip follows it', () => {
    const t = buildTimeline(coolerHand);
    const flips = t.beats.map((b) => b.flip);
    expect(flips).toEqual([0, 3, 4, 5, 5]);
    for (let i = 1; i < flips.length; i++) expect(flips[i]).toBeGreaterThanOrEqual(flips[i - 1]);
  });

  it('R-1: a jam is an ALL-IN beat with the hold on it', () => {
    const t = buildTimeline(coolerHand);
    const jam = t.beats.find((b) => b.label === 'ALL-IN');
    expect(jam).toBeTruthy();
    expect(jam.pace).toBe('allin');
    expect(jam.seconds).toBe(5);
  });

  it('R-1: the ladder only ever climbs, and ends at the showdown', () => {
    const rank = { calm: 0, heating: 1, allin: 2, showdown: 3 };
    for (const hand of [badBeatHand, bigBluffHand, coolerHand]) {
      const t = buildTimeline(hand);
      expect(t.beats[t.beats.length - 1].pace).toBe('showdown');
      // Within the streets the pot only grows, so the felt only warms.
      const streets = t.beats.slice(0, -1).map((b) => rank[b.pace]);
      for (let i = 1; i < streets.length; i++) {
        expect(streets[i], `${hand.flagType} beat ${i}`).toBeGreaterThanOrEqual(streets[i - 1]);
      }
    }
  });

  it('R-1: the pot grows and ends on the figure the server recorded', () => {
    const t = buildTimeline(coolerHand);
    const pots = t.beats.map((b) => b.pot);
    for (let i = 1; i < pots.length; i++) expect(pots[i]).toBeGreaterThanOrEqual(pots[i - 1]);
    expect(pots[pots.length - 1]).toBe(4200);
  });

  it('R-1: a one-street hand still plays', () => {
    const t = buildTimeline(bigBluffHand);
    expect(t.beats.map((b) => b.label)).toEqual(['RIVER', 'END']);
    expect(t.beats[0].flip).toBe(5);
    // He won it without a showdown, so the reveal is his 100.
    expect(t.beats[1].equity).toBe(100);
  });

  it('R-1: attrCosts land at their street', () => {
    const t = buildTimeline(coolerHand);
    const jam = t.beats.find((b) => b.label === 'ALL-IN');
    expect(jam.attrCosts).toEqual([{ key: 'FOCUS', line: 'he misjudged the turn by 9%', street: 'turn' }]);
    // And nowhere else.
    expect(t.beats.filter((b) => b.attrCosts.length > 0)).toHaveLength(1);
  });

  it('R-1: a cost with no street rides the last beat', () => {
    const t = buildTimeline({ ...coolerHand, attrCosts: [{ key: 'COMPOSURE', line: 'he tilted' }] });
    expect(t.beats[t.beats.length - 1].attrCosts).toEqual([{ key: 'COMPOSURE', line: 'he tilted' }]);
  });

  it('R-1: a hand with no streets is a reveal and nothing else', () => {
    const t = buildTimeline({ flagType: 'cooler', pot: 100, won: true, streets: [] });
    expect(t.beats).toHaveLength(1);
    expect(t.beats[0].label).toBe('END');
    expect(t.total).toBeGreaterThan(0);
  });

  it('R-1: an absent hand does not throw', () => {
    const t = buildTimeline(undefined);
    expect(t.beats).toHaveLength(1);
    expect(t.flag).toBe(FLAGS.biggestPot);
  });
});

describe('R-1 scrubbing', () => {
  const t = buildTimeline(coolerHand);

  it('R-1: finds the beat playing at a moment', () => {
    expect(beatAt(t, 0).label).toBe('PRE');
    expect(beatAt(t, t.beats[1].at + 0.1).label).toBe('FLOP');
    expect(beatAt(t, t.total).label).toBe('END');
  });

  it('R-1: clamps outside the reel rather than falling off it', () => {
    expect(beatAt(t, -5).label).toBe('PRE');
    expect(beatAt(t, t.total + 99).label).toBe('END');
    expect(beatIndexAt(t, -1)).toBe(0);
    expect(beatIndexAt(t, 1e6)).toBe(t.beats.length - 1);
  });

  it('R-1: every second of the reel has a beat', () => {
    for (let s = 0; s <= t.total; s += 0.5) expect(beatAt(t, s)).not.toBeNull();
  });
});

// ── CLEAN-1 · the beat → snapshot adapter ─────────────────────────────────
// It used to live in ReplayTheatre and lowercase `beat.label`, which gave the
// felt 'pre' for the preflop beat — not a street at all, so the whole opening
// of every replay read as a hand that was not running. The adapter now lives
// next to the beats it reads, and the street comes off `beat.key`, which is
// the street the server actually recorded.

describe('CLEAN-1 the beat street', () => {
  const timeline = buildTimeline(coolerHand);
  const streetOf = (label) => streetForBeat(timeline.beats.find((b) => b.label === label));

  it('CLEAN-1: PRE is preflop, not "pre"', () => {
    expect(streetOf('PRE')).toBe('preflop');
  });

  it('CLEAN-1: every other street is itself', () => {
    expect(streetOf('FLOP')).toBe('flop');
    expect(streetOf('RIVER')).toBe('river');
  });

  it('CLEAN-1: ALL-IN names a moment, so the street is the one it happened on', () => {
    // The jam is on the turn in this hand, and the label says nothing about it.
    expect(streetOf('ALL-IN')).toBe('turn');
  });

  it('CLEAN-1: END is the finished hand', () => {
    expect(streetOf('END')).toBe('complete');
  });
});

describe('CLEAN-1 snapshotFor', () => {
  const hand = coolerHand;
  const timeline = buildTimeline(hand);
  const beat = (label) => timeline.beats.find((b) => b.label === label);
  const snap = (label) => snapshotFor(timeline, beat(label), hand);

  it('CLEAN-1: hands the felt a running hand at the first beat', () => {
    const s = snap('PRE');
    expect(s.street).toBe('preflop');
    expect(s.pot).toBe(beat('PRE').pot);
    expect(s.community).toEqual([]);
  });

  it('CLEAN-1: his cards are his throughout', () => {
    expect(snap('FLOP').seats[0].holeCards).toEqual(['Qs', 'Qd']);
  });

  it('CLEAN-1: nobody else shows until the end', () => {
    // The turn beat in this hand is the jam, so it is labelled ALL-IN.
    expect(snap('ALL-IN').seats[1].holeCards).toEqual([]);
    expect(snap('END').seats[1].holeCards).toEqual(['Kh', 'Kc']);
  });

  it('CLEAN-1: equity is a fraction, the way the server sends it', () => {
    expect(snap('FLOP').heroEquity).toBeCloseTo(0.92, 5);
  });
});
