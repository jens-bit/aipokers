// client/src/components/home/roomBubbles.test.jsx — FIX-6 job 3
//
// The room's bubble law, asserted on the pure half. Three claims:
//
//   1. AT MOST TWO IN THE ROOM, one per body, and the rest WAIT — they are not
//      thrown away the way the felt throws them away, because the room is not
//      a performance you can miss.
//   2. NOTHING IS DRAWN OVER ANYTHING. Not another bubble, not a name pill,
//      not the wall. A body with no clear side waits too.
//   3. THE QUEUE ROTATES on lib/pace.js's dwell, and only when somebody is
//      actually queued — a bubble nobody is waiting behind stays up.

import { describe, expect, it } from 'vitest';

import {
  MAX_IN_ROOM, bubbleRect, layout, overlaps, pillRect, resolve, sideFor,
} from './roomBubbles.js';
import { BUBBLE_DWELL_MS } from '../../lib/pace.js';
import { FLOOR_SPOTS, TABLE_SEATS } from './flat.js';

const body = (id, x, y, over = {}) => ({ id, x, y, size: 46, name: 'Balance', ...over });
const says = (b, text, gold = false) => ({ ...b, text, gold });

// Three bodies in one column, far enough apart vertically that every box in the
// stack clears every other one. The clean case: nothing is in anybody's way.
const A = body('a', 100, 120);
const B = body('b', 100, 240);
const C = body('c', 100, 360);

describe('the boxes stack up from the feet', () => {
  it('pill sits over the head, bubble sits over the pill', () => {
    const pill = pillRect(A);
    const bubble = bubbleRect(A, 'right');
    // Feet at y, body 46 tall, 4px gaps: the pill's bottom is above his head.
    expect(pill.bottom).toBe(120 - 46 - 4);
    expect(bubble.bottom).toBe(pill.top - 4);
    expect(bubble.top).toBeLessThan(bubble.bottom);
    // ...and a bubble never sits on its own pill.
    expect(overlaps(bubble, pill)).toBe(false);
  });

  it('opens to the right of him, or to the left of him', () => {
    expect(bubbleRect(A, 'right').left).toBeGreaterThan(A.x);
    expect(bubbleRect(A, 'left').right).toBeLessThan(A.x);
  });
});

describe('picking the side with clearance', () => {
  it('takes the preferred side when nothing is in the way', () => {
    expect(sideFor(A, [])).toBe('right');
  });

  it('flips away from whatever is standing in that side', () => {
    // Mid-room, where both sides fit the wall — so the choice is about the
    // blocker and nothing else.
    const mid = body('mid', 195, 200);
    expect(sideFor(mid, [])).toBe('right');
    expect(sideFor(mid, [bubbleRect(mid, 'right')])).toBe('left');
  });

  it('says no side at all when neither is clear, rather than drawing over him', () => {
    const mid = body('mid', 195, 200);
    expect(sideFor(mid, [bubbleRect(mid, 'right'), bubbleRect(mid, 'left')])).toBeNull();
    // And a body against the wall has only one side to lose.
    expect(sideFor(A, [bubbleRect(A, 'right')])).toBeNull();
  });

  it('a name pill is a blocker like any other', () => {
    // Somebody standing just above and to the right: his PILL is where this
    // bubble wants to open, and the room edge takes the other side away.
    const near = body('n', 250, 96);
    const at = body('m', 250, 150);
    expect(sideFor(at, [])).toBe('left');
    expect(sideFor(at, [pillRect(near)])).not.toBe('left');
  });
});

describe('at most two in the room', () => {
  it('places two and leaves the third for later', () => {
    const placed = layout([says(A, 'one'), says(B, 'two'), says(C, 'three')], [A, B, C]);
    expect(placed).toHaveLength(MAX_IN_ROOM);
    expect(placed.map((p) => p.id)).toEqual(['a', 'b']);
    expect(placed.every((p) => p.side === 'right' || p.side === 'left')).toBe(true);
  });

  it('skips a body with no clearance and gives the place to the next one', () => {
    // `x` stands right on top of `a`: his box has nowhere to go once a's is
    // placed, and the wall takes his other side.
    const X = body('x', 120, 140);
    const placed = layout([says(A, 'one'), says(X, 'blocked'), says(C, 'three')], [A, X, C]);
    expect(placed.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('nothing placed overlaps anything else placed, or any pill in the room', () => {
    // The room's own fixture spots, everybody talking at once.
    const room = [...FLOOR_SPOTS, ...TABLE_SEATS[2]]
      .map((s, i) => body(`s${i}`, s.x, s.y, { name: 'Big Slick' }));
    const placed = layout(room.map((b) => says(b, 'something')), room);
    const pills = room.map(pillRect);

    expect(placed.length).toBeGreaterThan(0);
    const boxes = placed.map((p) => bubbleRect(p, p.side));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false);
      }
      for (const pill of pills) expect(overlaps(boxes[i], pill)).toBe(false);
    }
  });

  it('one body cannot hold two places, whatever it is handed', () => {
    const placed = layout([says(A, 'first'), says(A, 'second')], [A]);
    expect(placed).toHaveLength(1);
    expect(placed[0].text).toBe('first');
  });
});

describe('the queue waits its turn on the pace dwell', () => {
  const three = [says(A, 'one'), says(B, 'two'), says(C, 'three')];
  const bodies = [A, B, C];

  it('the third waits, and nothing about the wait is drawn', () => {
    const out = resolve(three, bodies, { now: 1_000 });
    expect(out.shown.map((s) => s.id)).toEqual(['a', 'b']);
    // And the room knows when to look again.
    expect(out.nextAt).toBe(1_000 + BUBBLE_DWELL_MS);
  });

  it('holds its place for the whole beat, then gives it to whoever is queued', () => {
    const first = resolve(three, bodies, { now: 0 });
    const midway = resolve(three, bodies, { ...first, now: BUBBLE_DWELL_MS - 1 });
    expect(midway.shown.map((s) => s.id)).toEqual(['a', 'b']);

    const after = resolve(three, bodies, { ...midway, now: BUBBLE_DWELL_MS });
    expect(after.shown.map((s) => s.id)).toContain('c');
    expect(after.shown).toHaveLength(MAX_IN_ROOM);
  });

  it('everybody gets a turn — the queue rotates rather than repeating', () => {
    let state = { held: [], seen: {}, now: 0 };
    const turns = new Set();
    for (let t = 0; t <= BUBBLE_DWELL_MS * 4; t += BUBBLE_DWELL_MS) {
      const out = resolve(three, bodies, { ...state, now: t });
      for (const s of out.shown) turns.add(s.id);
      state = { held: out.held, seen: out.seen };
    }
    expect([...turns].sort()).toEqual(['a', 'b', 'c']);
  });

  it('a bubble nobody is queued behind stays up, however long it has been there', () => {
    const two = [says(A, 'one'), says(B, 'two')];
    const first = resolve(two, [A, B], { now: 0 });
    const later = resolve(two, [A, B], { ...first, now: BUBBLE_DWELL_MS * 10 });

    expect(later.shown.map((s) => s.id)).toEqual(['a', 'b']);
    // Nothing is waiting, so there is nothing to wake up for.
    expect(later.nextAt).toBeNull();
    // ...and the beat it has already served is not restarted under it.
    expect(later.held.every((h) => h.at === 0)).toBe(true);
  });

  it('a man who stops talking loses his place at once, without waiting for a beat', () => {
    const first = resolve(three, bodies, { now: 0 });
    const after = resolve([says(B, 'two'), says(C, 'three')], bodies, { ...first, now: 10 });
    expect(after.shown.map((s) => s.id)).toEqual(['b', 'c']);
  });

  it('an empty room says nothing and asks for no timer', () => {
    const out = resolve([], [], { now: 5 });
    expect(out.shown).toEqual([]);
    expect(out.nextAt).toBeNull();
  });
});
