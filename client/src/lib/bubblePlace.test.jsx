// client/src/lib/bubblePlace.test.jsx — WATCH-10 job 2
//
// The placement rule, as arithmetic. It is pure and it takes its geometry from
// the caller, so everything below is boxes and nothing is a screen: the room
// (components/home/roomBubbles.test.jsx) and the felt (lib/feltBubbles.test.jsx)
// each check that their own boxes are the right boxes.
//
// The three clauses this file exists for:
//
//   · a bubble takes the FIRST side that is clear, in the order given
//   · clear means clear of the edge, of the blockers, AND of every bubble
//     already placed this pass
//   · a speaker with no clear side is SKIPPED, and skipping him does not stop
//     the next one from being placed

import { describe, expect, it } from 'vitest';

import { overlaps, place, sideFor } from './bubblePlace.js';

const box = (left, top, w = 100, h = 30) => ({ left, right: left + w, top, bottom: top + h });

// A toy geometry: every speaker sits at `x` in a 400-wide strip, opens 100px to
// one side or the other, and is cut off by the strip's edge.
const rect = (s, side) => {
  const b = side === 'right' ? box(s.x, s.y) : box(s.x - 100, s.y);
  if (b.left < 0 || b.right > 400) return null;
  return b;
};
const sides = () => ['right', 'left'];

describe('WATCH-10 job 2: overlaps', () => {
  it('is true only when the two boxes share area', () => {
    expect(overlaps(box(0, 0), box(50, 0))).toBe(true);
    expect(overlaps(box(0, 0), box(100, 0))).toBe(false);   // touching is not overlapping
    expect(overlaps(box(0, 0), box(50, 30))).toBe(false);   // clear below
    expect(overlaps(box(0, 0), box(50, 29))).toBe(true);
  });

  it('is false rather than a crash when a box is missing', () => {
    expect(overlaps(null, box(0, 0))).toBe(false);
    expect(overlaps(box(0, 0), undefined)).toBe(false);
  });
});

describe('WATCH-10 job 2: sideFor', () => {
  it('takes the first side in the order it is given', () => {
    expect(sideFor({ x: 50, y: 0 }, { sides, rect }).side).toBe('right');
    expect(sideFor({ x: 50, y: 0 }, { sides: () => ['left', 'right'], rect }).side)
      .toBe('right');   // left would run off the strip, so it is not offered
  });

  it('falls to the other side when the first is blocked', () => {
    const got = sideFor({ x: 200, y: 0 }, { sides, rect, blockers: [box(250, 0)] });
    expect(got.side).toBe('left');
  });

  it('is null when neither side is clear — that is the whole point', () => {
    const blocked = [box(150, 0), box(250, 0)];
    expect(sideFor({ x: 200, y: 0 }, { sides, rect, blockers: blocked })).toBeNull();
  });

  it('is null when both sides would be cut off by the edge', () => {
    // A 100px box either side of x=380 runs past 400 one way and is fine the
    // other, so this uses a strip too narrow for either: x=50 in a 120 strip.
    const tight = (s, side) => {
      const b = side === 'right' ? box(s.x, s.y, 100) : box(s.x - 100, s.y, 100);
      return (b.left < 0 || b.right > 120) ? null : b;
    };
    expect(sideFor({ x: 50, y: 0 }, { sides, rect: tight })).toBeNull();
  });
});

describe('WATCH-10 job 2: place', () => {
  it('holds at most `max`, in the order given', () => {
    const out = place(
      [{ id: 'a', x: 10, y: 0 }, { id: 'b', x: 150, y: 0 }, { id: 'c', x: 290, y: 0 }],
      { max: 2, sides, rect },
    );
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('gives every placed speaker the side it took', () => {
    const out = place([{ id: 'a', x: 10, y: 0 }, { id: 'b', x: 390, y: 0 }], { max: 2, sides, rect });
    expect(out.map((s) => s.side)).toEqual(['right', 'left']);
  });

  it('never places one over another — a bubble is a blocker for the next', () => {
    // b sits 40px from a, so a's right-hand box covers b's; b's other side is
    // covered too, and he is skipped rather than drawn on top.
    const out = place([{ id: 'a', x: 100, y: 0 }, { id: 'b', x: 140, y: 0 }], { max: 2, sides, rect });
    expect(out.map((s) => s.id)).toEqual(['a']);
  });

  it('skips rather than stops: a blocked speaker does not shut the door', () => {
    const out = place(
      [{ id: 'a', x: 100, y: 0 }, { id: 'b', x: 140, y: 0 }, { id: 'c', x: 100, y: 200 }],
      { max: 2, sides, rect },
    );
    expect(out.map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('refuses to draw over a blocker it was handed', () => {
    const out = place([{ id: 'a', x: 200, y: 0 }], {
      max: 2, sides, rect, blockers: [box(150, 0), box(250, 0)],
    });
    expect(out).toEqual([]);
  });

  it('is empty for an empty stream, and skips a hole in one', () => {
    expect(place([], { max: 2, sides, rect })).toEqual([]);
    expect(place([null, { id: 'a', x: 10, y: 0 }], { max: 2, sides, rect }).map((s) => s.id))
      .toEqual(['a']);
  });
});
