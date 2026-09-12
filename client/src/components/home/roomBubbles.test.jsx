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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import {
  BUBBLE_LIFE_MS, BUBBLE_PREEMPT_MS, MAX_IN_ROOM,
  bubbleRect, layout, overlaps, pillRect, resolve, sideFor, useRoomBubbles,
} from './roomBubbles.js';
import {
  DOOR_SPOT, FLOOR_SPOTS, SIGN, TABLE_SEATS, WALL_SPOT, FLAT, DESK_ROOM, PHONE_ROOM, bodyRect,
} from './flat.js';

const body = (id, x, y, over = {}) => ({ id, x, y, size: 46, name: 'Balance', ...over });
const says = (b, text, gold = false) => ({ ...b, text, gold });
afterEach(()=>vi.useRealTimers());

// Three bodies in one column, far enough apart vertically that every box in the
// stack clears every other one. The clean case: nothing is in anybody's way.
const A = body('a', 100, 120);
const B = body('b', 100, 240);
const C = body('c', 100, 360);

describe('the boxes are anchored to the same body', () => {
  it('BUG-185: the pill stays above the head while ordinary speech centers beside it', () => {
    const pill = pillRect(A);
    const bubble = bubbleRect(A, 'right');
    // Feet at y, body 46 tall, 4px gaps: the pill's bottom is above his head.
    expect(pill.bottom).toBe(120 - 46 - 4);
    // Current board29 HomeOne replaces the old over-pill bubble stack.
    expect((bubble.top + bubble.bottom) / 2).toBe(A.y - A.size / 2);
    expect(bubble.top).toBeLessThan(bubble.bottom);
    // ...and a bubble never sits on its own pill.
    expect(overlaps(bubble, pill)).toBe(false);
  });

  it.each([46, 50, 56, 62])('BUG-185: a %spx body reserves the actual box, side tail and entrance movement', size => {
    const speaker = body('wide', 220, 440, { size });
    const offset = Math.max(32, size / 2 - 2);
    for (const side of ['left', 'right']) {
      const box = bubbleRect(speaker, side);
      expect((box.top + box.bottom) / 2).toBe(speaker.y - size / 2);
      expect(box.bottom - box.top).toBeGreaterThanOrEqual(39 + 8);
      expect(box.right - box.left).toBeGreaterThanOrEqual(150 + 5);
      if (side === 'right') {
        expect(box.left).toBeLessThanOrEqual(speaker.x + offset - 5);
        expect(box.right).toBeGreaterThanOrEqual(speaker.x + offset + 150);
      } else {
        expect(box.left).toBeLessThanOrEqual(speaker.x - offset - 150);
        expect(box.right).toBeGreaterThanOrEqual(speaker.x - offset + 5);
      }
    }
  });

  it('BUG-185: room blockers contain the measured resident and guest name-pill heights', () => {
    const resident = pillRect(A), guest = pillRect({ ...A, guest: true });
    expect(resident.bottom - resident.top).toBeGreaterThanOrEqual(27);
    expect(guest.bottom - guest.top).toBeGreaterThanOrEqual(37);
    expect(guest.bottom).toBe(resident.bottom);
  });

  it.each([PHONE_ROOM, DESK_ROOM])('BUG-185: the side tail stays inside the eight-pixel room edge at width$width', geometry => {
    for (const x of [8, 32, 100, geometry.width / 2, geometry.width - 32, geometry.width - 8]) {
      const speaker = body('edge', x, 440, { size: geometry.seatedSize });
      const side = sideFor(speaker, [], geometry);
      if (side) {
        const box = bubbleRect(speaker, side);
        expect(box.left).toBeGreaterThanOrEqual(8);
        expect(box.right).toBeLessThanOrEqual(geometry.width - 8);
      }
    }
  });

  it('BUG-185: another body cannot disappear behind speech even when its pill is above the line', () => {
    const speaker = body('speaker', 100, 440), neighbour = body('neighbour', 215, 440, { guest: true });
    const alone = layout([says(speaker, 'A public line')], [speaker]);
    expect(alone).toHaveLength(1);
    const together = layout([says(speaker, 'A public line')], [speaker, neighbour]);
    for (const placed of together) expect(overlaps(bubbleRect(placed, placed.side), bodyRect(neighbour, neighbour.size))).toBe(false);
    expect(together).toHaveLength(0);
  });

  it('BUG-185: a side bubble cannot cover the fridge beside the wall routine', () => {
    const speaker = body('wall', WALL_SPOT.x, WALL_SPOT.y);
    const fridge = { left: FLAT.fridge.x, right: FLAT.fridge.x + FLAT.fridge.w,
      top: FLAT.fridge.y, bottom: FLAT.fridge.y + FLAT.fridge.h };
    for (const placed of layout([says(speaker, 'A public recap')], [speaker])) {
      expect(overlaps(bubbleRect(placed, placed.side), fridge)).toBe(false);
    }
  });

  it('BUG-185: a new guest label recomputes clearance even when neither occupant moves', () => {
    const speaker = body('speaker', 100, 440), neighbour = body('neighbour', 215, 520);
    const speakers = [says(speaker, 'A line beside me')];
    const { result, rerender } = renderHook(({ guest }) => useRoomBubbles(speakers, [speaker, { ...neighbour, guest }]), { initialProps:{guest:false} });
    expect(result.current.size).toBe(1);
    rerender({guest:true});
    expect(result.current.size).toBe(0);
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
    // With speech beside the head, a neighbour farther down has his PILL
    // in that line's path. The right wall still takes the other side away.
    const near = body('n', 170, 190);
    const at = body('m', 250, 150);
    expect(sideFor(at, [])).toBe('left');
    expect(sideFor(at, [pillRect(near)])).not.toBe('left');
  });
});

// P/Q/R rather than the shared A/B/C above: A sits at y120, close enough to
// the top that BUGS-C job 2's header exclusion takes his only clear side —
// exactly the kind of case "picking the side with clearance" above exists to
// prove, so it stays there. These three are a clean case with room to spare.
// Beside-head speech must also clear the fridge; keep this free-space fixture
// between the safe and fridge without changing what the lifecycle asserts.
const P = body('p', 50, 180);
// Queue/lifetime fixtures stay off the newly protected felt. These tests
// exercise turn-taking with free space; BUG-55 above exercises blocked seats.
const Q = body('q', 100, 440);
// The old above-pill box at560 cleared the TV. Beside-head speech belongs
// below its screen here, so this turn-taking fixture moves to600 instead.
const R = body('r', 100, 600);

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
  it('BUG-138: an expired recap stays quiet across polling and can admit a new event', () => {
    const one = [{ ...says(P, 'Table closed while I was away'), eventId: 123 }];
    const first = resolve(one, [P], { now: 0 });
    const expired = resolve(one, [P], { ...first, now: BUBBLE_LIFE_MS });
    expect(expired.shown).toEqual([]);
    expect(expired.nextAt).toBeNull();
    const poll = resolve(one.map(s => ({ ...s })), [P], { ...expired, now: BUBBLE_LIFE_MS * 2 });
    expect(poll.shown).toEqual([]);
    const fresh = resolve([{ ...one[0], eventId: 456 }], [P], { ...poll, now: BUBBLE_LIFE_MS * 3 });
    expect(fresh.shown.map(s => s.id)).toEqual(['p']);
  });
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
  it('BUG-138: with nobody waiting, a spent bubble clears instead of restarting its clock', () => {
    const one = [says(P, 'one')];
    const first = resolve(one, [P], { now: 0 });
    expect(first.held[0].at).toBe(0);

    const before = resolve(one, [P], { ...first, now: BUBBLE_LIFE_MS - 1 });
    expect(before.shown.map((s) => s.id)).toEqual(['p']);
    expect(before.held[0].at).toBe(0); // life not yet spent — the clock has not moved

    const after = resolve(one, [P], { ...before, now: BUBBLE_LIFE_MS });
    expect(after.shown).toEqual([]);
    expect(after.held).toEqual([]);
    expect(after.nextAt).toBeNull();
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

it('HOME-2: a queued TV student does not let another speaker cover the screen',()=>{
  const neighbour=body('near-tv',100,510);
  const student=body('student',PHONE_ROOM.tvSpot.x,PHONE_ROOM.tvSpot.y);
  const tv={left:PHONE_ROOM.tvScreen.x,right:PHONE_ROOM.tvScreen.x+PHONE_ROOM.tvScreen.w,
    top:PHONE_ROOM.tvScreen.y,bottom:PHONE_ROOM.tvScreen.y+PHONE_ROOM.tvScreen.h};
  expect(overlaps(bubbleRect(neighbour,'right'),tv)).toBe(true);
  const placed=layout([says(neighbour,'A recap'),says(student,'Studying')],[neighbour,student]);
  expect(placed.map(s=>s.id)).toEqual(['student']);
});

it('HOME-2: only the student at the TV retains his own fixture exception',()=>{
  const geometry={...PHONE_ROOM,tvSpot:{x:292,y:560}};
  const student=body('student',geometry.tvSpot.x,geometry.tvSpot.y);
  expect(layout([says(student,'One more look')],[student],geometry)).toHaveLength(1);
});

describe('HOME-2: recap display memory belongs to the household',()=>{
  const recap=eventId=>Object.freeze({...says(Q,'Table closed while I was away',true),eventId});
  const useRecap=({owner,event=1,bodies=[Q]})=>useRoomBubbles([recap(event)],bodies,PHONE_ROOM,owner);

  it('HOME-2: returning Home does not replay a consumed recap or mark it read',()=>{
    vi.useFakeTimers();
    const first=renderHook(useRecap,{initialProps:{owner:'return-owner'}});
    expect(first.result.current.get(Q.id)?.text).toBe('Table closed while I was away');
    act(()=>vi.advanceTimersByTime(BUBBLE_LIFE_MS));
    expect(first.result.current.size).toBe(0);
    first.unmount();
    const returned=renderHook(useRecap,{initialProps:{owner:'return-owner'}});
    expect(returned.result.current.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(recap(1)).toEqual({...says(Q,'Table closed while I was away',true),eventId:1});
  });

  it('HOME-2: a new recap speaks while old events and other owner scopes stay separate',()=>{
    const hook=renderHook(useRecap,{initialProps:{owner:'alice'}});
    expect(hook.result.current.size).toBe(1);
    hook.rerender({owner:'alice',event:2});
    expect(hook.result.current.size).toBe(1);
    hook.rerender({owner:'alice',event:1});
    expect(hook.result.current.size).toBe(0);
    hook.rerender({owner:'bob',event:1});
    expect(hook.result.current.size).toBe(1);
    hook.rerender({owner:'alice',event:2});
    expect(hook.result.current.size).toBe(0);
  });

  it('HOME-2: a recap with no clear place remains available after returning Home',()=>{
    const blocker=body('blocking',215,440);
    const blocked=renderHook(useRecap,{initialProps:{owner:'blocked-owner',bodies:[Q,blocker]}});
    expect(blocked.result.current.size).toBe(0);
    blocked.unmount();
    const returned=renderHook(useRecap,{initialProps:{owner:'blocked-owner'}});
    expect(returned.result.current.size).toBe(1);
  });

  it('HOME-2: an unscoped room never shares another unscoped room display memory',()=>{
    const first=renderHook(useRecap,{initialProps:{owner:null}});
    expect(first.result.current.size).toBe(1);
    first.unmount();
    const second=renderHook(useRecap,{initialProps:{owner:null}});
    expect(second.result.current.size).toBe(1);
  });

  it('HOME-2: recap memory evicts old events instead of growing beyond 128 per household',()=>{
    const hook=renderHook(useRecap,{initialProps:{owner:'bounded-events',event:0}});
    for(let event=1;event<=128;event++) hook.rerender({owner:'bounded-events',event});
    hook.rerender({owner:'bounded-events',event:1});
    expect(hook.result.current.size).toBe(0);
    hook.rerender({owner:'bounded-events',event:0});
    expect(hook.result.current.size).toBe(1);
  });

  it('HOME-2: recap memory retains at most eight household scopes',()=>{
    for(let owner=0;owner<9;owner++) {
      const hook=renderHook(useRecap,{initialProps:{owner:`bounded-owner-${owner}`}});
      expect(hook.result.current.size).toBe(1);hook.unmount();
    }
    const recent=renderHook(useRecap,{initialProps:{owner:'bounded-owner-8'}});
    expect(recent.result.current.size).toBe(0);recent.unmount();
    const evicted=renderHook(useRecap,{initialProps:{owner:'bounded-owner-0'}});
    expect(evicted.result.current.size).toBe(1);
  });
});
