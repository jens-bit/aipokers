// client/src/components/home/roomBubbles.test.jsx — FIX-6 job 3, revised BUGS-C job 2
//
// The room's bubble law, asserted on the pure half. Four claims now:
//
//   1. ONE IN THE ROOM (was "at most two" — BUGS-C job 2 tightened it), and
//      the rest WAIT — they are not thrown away the way the felt throws them
//      away, because the room is not a performance you can miss.
//   2. NOTHING IS DRAWN OVER ANYTHING. Not another bubble, not a name pill,
//      not a fixture — the CASINO sign, the wall TV, the safe, the top
//      header. A body with no clear side waits too.
//   3. THE QUEUE ROTATES, and only when somebody is actually queued.
//   4. A BUBBLE HAS A LIFE (BUGS-C job 2): it holds a minimum beat before a
//      new line may bump it early, and clears on its own once its life is
//      spent — even with nobody waiting behind it. This SUPERSEDES FIX-6's
//      "a bubble nobody is queued behind stays up, however long it has been
//      there": that was right at two-in-the-room, where a second speaker
//      could always be shown beside the first; it reads as a stuck sign once
//      there is only ever one.

import { describe, expect, it } from 'vitest';

import {
  BUBBLE_LIFE_MS, BUBBLE_PREEMPT_MS, MAX_IN_ROOM,
  bubbleRect, layout, overlaps, pillRect, resolve, sideFor,
} from './roomBubbles.js';
import {
  DOOR_SPOT, FLOOR_SPOTS, SIGN, TABLE_SEATS, WALL_SPOT, FLAT,
} from './flat.js';

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

// P/Q/R rather than the shared A/B/C above: A sits at y120, close enough to
// the top that BUGS-C job 2's header exclusion takes his only clear side —
// exactly the kind of case "picking the side with clearance" above exists to
// prove, so it stays there. These three are a clean case with room to spare.
const P = body('p', 100, 180);
// Queue/lifetime fixtures stay off the newly protected felt. These tests
// exercise turn-taking with free space; BUG-55 above exercises blocked seats.
const Q = body('q', 100, 440);
const R = body('r', 100, 560);

describe('BUGS-C job 2: one bubble in the room, ever', () => {
  it('BUG-55: speech from any kitchen chair stays off the felt', () => {
    const felt = { left: FLAT.table.cx - FLAT.table.rx, right: FLAT.table.cx + FLAT.table.rx,
      top: FLAT.table.cy - FLAT.table.ry, bottom: FLAT.table.cy + FLAT.table.ry };
    for (const spot of TABLE_SEATS[4]) {
      const speaker = body('a', spot.x, spot.y, { size: 50 });
      for (const placed of layout([says(speaker, 'An unread recap')], [speaker])) {
        expect(overlaps(bubbleRect(placed, placed.side), felt)).toBe(false);
      }
    }
  });
  it('BUGS-C-2: shows one and leaves the rest for later', () => {
    const placed = layout([says(P, 'one'), says(Q, 'two'), says(R, 'three')], [P, Q, R]);
    expect(MAX_IN_ROOM).toBe(1);
    expect(placed).toHaveLength(MAX_IN_ROOM);
    expect(placed.map((p) => p.id)).toEqual(['p']);
    expect(placed.every((p) => p.side === 'right' || p.side === 'left')).toBe(true);
  });

  it('skips a body with no clearance and gives the place to the next one', () => {
    // Boxed in by fixtures on both sides — the far table seat sits close
    // enough to the safe on its left and the sign on its right that neither
    // side is ever clear, with no other body needed to block him.
    const X = body('x', 208, 238);
    const placed = layout([says(X, 'blocked'), says(R, 'three')], [X, R]);
    expect(placed.map((p) => p.id)).toEqual(['r']);
  });

  it('the one placed never overlaps a name pill in the room', () => {
    // The room's own fixture spots, everybody talking at once.
    const room = [...FLOOR_SPOTS, ...TABLE_SEATS[2]]
      .map((s, i) => body(`s${i}`, s.x, s.y, { name: 'Big Slick' }));
    const placed = layout(room.map((b) => says(b, 'something')), room);
    const pills = room.map(pillRect);

    expect(placed.length).toBeGreaterThan(0);
    const boxes = placed.map((p) => bubbleRect(p, p.side));
    for (const box of boxes) {
      for (const pill of pills) expect(overlaps(box, pill)).toBe(false);
    }
  });

  it('one body cannot hold two places, whatever it is handed', () => {
    const placed = layout([says(P, 'first'), says(P, 'second')], [P]);
    expect(placed).toHaveLength(1);
    expect(placed[0].text).toBe('first');
  });

  // The brief's own test: three at once collapses to one, and whichever one
  // it is, it never lands on the CASINO sign.
  it('BUGS-C-2: three simultaneous lines still show as one bubble', () => {
    const placed = layout([says(P, 'one'), says(Q, 'two'), says(R, 'three')], [P, Q, R]);
    expect(placed).toHaveLength(1);
  });

  it('BUGS-C-4: a bubble rect never intersects the CASINO sign rect', () => {
    const signRect = { left: SIGN.x, right: SIGN.x + SIGN.w, top: SIGN.y, bottom: SIGN.y + SIGN.h };
    const spots = [...FLOOR_SPOTS, ...TABLE_SEATS[3], DOOR_SPOT, WALL_SPOT];
    for (const spot of spots) {
      const b = body(`spot-${spot.x}-${spot.y}`, spot.x, spot.y);
      const placed = layout([says(b, 'hello, room')], [b]);
      for (const p of placed) {
        expect(overlaps(bubbleRect(p, p.side), signRect), `${spot.x},${spot.y}`).toBe(false);
      }
    }
  });
});

describe('BUGS-C job 2: a bubble has a life, not just a beat', () => {
  const two = [says(P, 'one'), says(Q, 'two')];

  it('a new line waits out the minimum beat before it may take over', () => {
    const first = resolve(two, [P, Q], { now: 0 });
    expect(first.shown.map((s) => s.id)).toEqual(['p']);

    const midway = resolve(two, [P, Q], { ...first, now: BUBBLE_PREEMPT_MS - 1 });
    expect(midway.shown.map((s) => s.id)).toEqual(['p']);
    expect(midway.nextAt).toBe(BUBBLE_PREEMPT_MS);

    const after = resolve(two, [P, Q], { ...midway, now: BUBBLE_PREEMPT_MS });
    expect(after.shown.map((s) => s.id)).toEqual(['q']);
  });

  // FIX-6's rule was "a bubble nobody is queued behind stays up, however long
  // it has been there" — right with two slots (a second speaker could always
  // take the other one), wrong with one: it would pin the room's only bubble
  // up forever. BUGS-C job 2 retires that clause; this is its replacement.
  it('BUGS-C-2: with nobody waiting, the held clock still turns over once the life is spent', () => {
    const one = [says(P, 'one')];
    const first = resolve(one, [P], { now: 0 });
    expect(first.held[0].at).toBe(0);

    const before = resolve(one, [P], { ...first, now: BUBBLE_LIFE_MS - 1 });
    expect(before.shown.map((s) => s.id)).toEqual(['p']);
    expect(before.held[0].at).toBe(0); // life not yet spent — the clock has not moved

    const after = resolve(one, [P], { ...before, now: BUBBLE_LIFE_MS });
    expect(after.shown.map((s) => s.id)).toEqual(['p']); // still the only one with anything to say
    expect(after.held[0].at).toBe(BUBBLE_LIFE_MS); // ...but its life actually ran out and restarted
  });

  it('everybody gets a turn — the queue rotates rather than repeating', () => {
    const three = [says(P, 'one'), says(Q, 'two'), says(R, 'three')];
    const bodies = [P, Q, R];
    let state = { held: [], seen: {}, now: 0 };
    const turns = new Set();
    for (let t = 0; t <= BUBBLE_PREEMPT_MS * 4; t += BUBBLE_PREEMPT_MS) {
      const out = resolve(three, bodies, { ...state, now: t });
      for (const s of out.shown) turns.add(s.id);
      state = { held: out.held, seen: out.seen };
    }
    expect([...turns].sort()).toEqual(['p', 'q', 'r']);
  });

  it('a man who stops talking loses his place at once, without waiting for a beat', () => {
    const three = [says(P, 'one'), says(Q, 'two'), says(R, 'three')];
    const first = resolve(three, [P, Q, R], { now: 0 });
    expect(first.shown.map((s) => s.id)).toEqual(['p']);
    const after = resolve([says(Q, 'two'), says(R, 'three')], [P, Q, R], { ...first, now: 10 });
    expect(after.shown.map((s) => s.id)).toEqual(['q']);
  });

  it('an empty room says nothing and asks for no timer', () => {
    const out = resolve([], [], { now: 5 });
    expect(out.shown).toEqual([]);
    expect(out.nextAt).toBeNull();
  });
});
