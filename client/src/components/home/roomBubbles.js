// client/src/components/home/roomBubbles.js — FIX-6 job 3, revised BUGS-C job 2
//
// THE ROOM'S SPEECH, QUEUED.
//
// Playtest 6 Sep: the flat printed everything the household had to say the
// instant it had it. A man with a want AND a recap wore two boxes at once; four
// bodies with something to say wore four; and because a bubble is 152px wide in
// a 390px room, half of them were drawn across somebody else's name pill. The
// room stopped being readable exactly when it had the most to tell you.
//
// Playtest 7 Sep, on FIX-6's own fix: still too large, and still overlapping —
// now the CASINO sign and the wall TV rather than each other. BUGS-C job 2
// tightens the law FIX-6 wrote:
//
//   ONE PER BODY           unchanged. Two boxes over one head is not a
//                          conversation, it is a stack.
//   ONE IN THE ROOM        was "at most two" — one is what the brief asks for,
//                          and it is what keeps a bubble from ever competing
//                          with the sign or the TV for the same clear patch of
//                          wall two speakers at once needed instead.
//   NEVER A QUEUE          unchanged, and still the whole difference from the
//                          felt (lib/bubbles.js): the room is not a performance
//                          that moves on without you, so a third line WAITS
//                          rather than being thrown away.
//   A LIFE, NOT JUST A BEAT  a bubble now holds a MINIMUM of BUBBLE_PREEMPT_MS
//                          before a new line may bump it early, and clears on
//                          its own at BUBBLE_LIFE_MS even with nobody queued
//                          behind it — FIX-6's bubble never went away on its
//                          own, which was fine at two-in-the-room and reads as
//                          a stuck sign at one.
//
// AND NOTHING IS DRAWN OVER ANYTHING. A bubble takes the side with clearance:
// the room edge first (flat.js's rule, which has always been there), then
// every name pill, then the fixtures nothing may render over — the CASINO
// sign, the wall TV, the safe, and the top header (the app's own, sticky above
// the room — flat.js's `HEADER`, a modelled band rather than a drawn fixture).
// If neither side is clear, he waits too — a sentence you cannot read is not
// better than a sentence that arrives a beat later.
//
// THE BOXES ARE MODELLED, NOT MEASURED, and that is deliberate. Measuring means
// layout, layout means the DOM, and the DOM means this file could not be pure
// and could not be tested without rendering a room. Every constant below is
// read off home1.css and rounded so the model is never SMALLER than the thing
// it stands for: a bubble that overlaps by a pixel the model did not know about
// is the bug this file exists to prevent.

import { useEffect, useMemo, useRef, useState } from 'react';

import { BUBBLE_W, FLAT, HEADER, SIGN, TV_SCREEN, TV_SPOT, bubbleFits, bubbleSide } from './flat.js';
import { overlaps, place, sideFor as placeSide } from '../../lib/bubblePlace.js';
import { shortName } from '../../lib/names.js';

/** How many bubbles the room may hold at once, BUGS-C job 2: one. */
export const MAX_IN_ROOM = 1;

// BUGS-C job 2's own numbers, not lib/pace.js's — the room's life cycle is not
// a "dwell" any more (that word meant "how long before the QUEUE moves"; this
// is "how long this bubble is allowed to exist at all"), so it gets its own
// constants rather than reusing BUBBLE_DWELL_MS, which no caller of this file
// needs any more.
export const BUBBLE_PREEMPT_MS = 2500;
export const BUBBLE_LIFE_MS = 3000;

/** `{x,y,w,h}` (flat.js's fixture shape) as an `{left,right,top,bottom}` rect. */
const fixtureRect = (f) => ({ left: f.x, right: f.x + f.w, top: f.y, bottom: f.y + f.h });

// BUGS-C job 2/4: the sign, the TV, the safe and the top header — none of
// them move, so their boxes are fixed rather than derived per body the way a
// name pill is.
//
// THE TV IS A CARVE-OUT, the way flat.js's own furniture test exempts the
// couch: the tape spot sits right in front of the screen it faces, so the one
// body whose routine puts him there (his study tally, "+3 GRANITE") can never
// clear it — no more than a man on the couch can stand clear of the couch. No
// other named spot in the room reaches anywhere near the TV, so the exclusion
// only ever relaxes for the speaker it would otherwise silence.
// BUG-55: the felt is also a control. A recap must not replace the removed
// request bubble with another sentence over the community cards.
const ALWAYS_BLOCKED = [SIGN, FLAT.safe, HEADER, {
  x: FLAT.table.cx - FLAT.table.rx, y: FLAT.table.cy - FLAT.table.ry,
  w: FLAT.table.rx * 2, h: FLAT.table.ry * 2,
}].map(fixtureRect);
const withTv = [...ALWAYS_BLOCKED, fixtureRect(TV_SCREEN)];
const atTv = (b) => b?.x === TV_SPOT.x && b?.y === TV_SPOT.y;
const fixtureBlockersFor = (speakers) => (speakers.some(atTv) ? ALWAYS_BLOCKED : withTv);

// ── The boxes, from home1.css ───────────────────────────────────────────────
//
// .home-one is a column, bottom-anchored at the body's feet (translate -100%),
// stacking [bubble slot] [name pill] [body] with a 4px gap. So every rect below
// is measured UP from `y`, and the pill's position does not depend on whether
// there is a bubble above it.

export const STACK_GAP = 4;      // .home-one { gap: 4px }
export const BUBBLE_H = 38;      // .home-bubble-slot { height: 38px }
export const BUBBLE_GAP = 9;     // .home-bubble--right { left: 9px }
export const PILL_H = 24;        // 3 + name + 2 + bars + 4, plus its border
export const PILL_PAD = 16;      // 7px each side, plus its border
// HOME-2 job 2: the pill's two bars are 44px each — the ref's own pill scale —
// and the pill can never be narrower than what they need.
export const PILL_MIN_W = PILL_PAD + 44;
// 8.5px at weight 600 with a little tracking. Rounded UP: see the header.
const CHAR_W = 6.2;

/**
 * How wide the name pill over this body is, near enough and never under.
 *
 * HOME-2 job 2 capped the name at six characters, which at 6.2px is 37px — so
 * in practice the BARS decide this width and the name never does. That is the
 * point rather than a coincidence: the room's bubble rule measures clearance
 * against these boxes, and a pill that grew with the length of a name made the
 * geometry of the room depend on what the owner had typed.
 */
export function pillWidth(name, nickname = null) {
  return Math.max(PILL_MIN_W, PILL_PAD + shortName(name, nickname).length * CHAR_W);
}

/** The name pill's box in flat coordinates. `body` is { x, y, size, name }. */
export function pillRect(body) {
  const w = pillWidth(body?.name, body?.nickname);
  const bottom = body.y - (body.size ?? 46) - STACK_GAP;
  return { left: body.x - w / 2, right: body.x + w / 2, top: bottom - PILL_H, bottom };
}

/** The bubble's box over this body, opening the given way. */
export function bubbleRect(body, side) {
  const bottom = pillRect(body).top - STACK_GAP;
  const left = side === 'right' ? body.x + BUBBLE_GAP : body.x - BUBBLE_GAP - BUBBLE_W;
  return { left, right: left + BUBBLE_W, top: bottom - BUBBLE_H, bottom };
}

// WATCH-10 job 2 moved the algorithm to lib/bubblePlace.js so the FELT could
// have it too — five seats at 390 wide is the same problem this file was
// written for. What stays here is the geometry, which is measured off home1.css
// and is true of nothing else.
export { overlaps };

/** The two sides, most wanted first. flat.js decides which is preferred. */
const roomSides = (body) => (bubbleSide(body.x) === 'right' ? ['right', 'left'] : ['left', 'right']);

/** The box, or null when the room edge would cut it — flat.js's rule. */
const roomRect = (body, side) => (bubbleFits(body.x, side) ? bubbleRect(body, side) : null);

/**
 * Which way this body's bubble may open, or null when neither way is clear.
 *
 * The room edge is flat.js's rule and is checked first, because a bubble that
 * clips is cut silently (the room has overflow: hidden). Then the blockers:
 * every name pill in the room, and every bubble already placed this pass.
 */
export function sideFor(body, blockers = []) {
  return placeSide(body, { sides: roomSides, rect: roomRect, blockers })?.side ?? null;
}

/**
 * Place as many of `speakers` as the room can hold, in the order given.
 *
 * A speaker with no clear side is SKIPPED rather than dropped from the queue —
 * the caller keeps him waiting, and he gets a side when whoever is in his way
 * has finished. This is what makes "no bubble may overlap another" a placement
 * rule rather than a cap on how much the household is allowed to say.
 *
 * @param speakers  [{ id, x, y, size, name, text, gold }] — priority first
 * @param bodies    everyone in the room, for their pills
 */
export function layout(speakers = [], bodies = []) {
  return place(speakers, {
    max: MAX_IN_ROOM,
    sides: roomSides,
    rect: roomRect,
    blockers: [...bodies.map(pillRect), ...fixtureBlockersFor(speakers)],
  });
}

/**
 * The whole of it: who is on screen, who is holding a place, and when to look
 * again. Pure — the caller owns the clock and the state.
 *
 * BUGS-C job 2's life cycle: the one bubble shown holds for at least
 * BUBBLE_PREEMPT_MS before a new line may bump it, and clears on its own at
 * BUBBLE_LIFE_MS — whichever comes first, and the second one fires even with
 * nobody queued behind it. FIX-6's bubble never expired on its own; that read
 * as "a beat before the QUEUE moves on", which made sense with two bubbles up
 * and reads as a jammed sign with one.
 *
 * @param speakers  priority-ordered, ONE per agent already
 * @param bodies    everyone in the room
 * @param held      [{ id, at }] — what is up now and since when
 * @param seen      { [id]: when it last had a turn } — for taking turns fairly
 * @param now       ms
 */
export function resolve(speakers = [], bodies = [], { held = [], seen = {}, now = 0 } = {}) {
  const by = new Map(speakers.map((s) => [s.id, s]));
  let keep = held.filter((h) => by.has(h.id));

  // Longest since his last turn goes first, so the queue rotates instead of
  // letting whoever ranks highest hold the room all evening. Sort is stable, so
  // two who have never spoken stay in the priority order they arrived in.
  const waiting = speakers
    .filter((s) => !keep.some((h) => h.id === s.id))
    .map((s) => s.id)
    .sort((a, b) => (seen[a] ?? -1) - (seen[b] ?? -1));

  // Give up the held place either because its life is fully spent (nobody
  // need be waiting for that) or because it has served its minimum beat AND
  // somebody is actually waiting for it.
  const evicted = [];
  for (const h of keep) {
    const age = now - h.at;
    const expired = age >= BUBBLE_LIFE_MS;
    const preempted = age >= BUBBLE_PREEMPT_MS && waiting.length > 0;
    if (expired || preempted) evicted.push(h.id);
  }
  if (evicted.length > 0) keep = keep.filter((h) => !evicted.includes(h.id));

  // Whoever just gave a place up goes to the very back of the queue.
  const order = [
    ...keep.map((h) => h.id),
    ...waiting.filter((id) => !evicted.includes(id)),
    ...evicted,
  ];

  const shown = layout(order.map((id) => by.get(id)).filter(Boolean), bodies);

  const nextHeld = shown.map((s) => keep.find((h) => h.id === s.id) ?? { id: s.id, at: now });
  const nextSeen = { ...seen };
  for (const s of shown) {
    nextSeen[s.id] = keep.some((h) => h.id === s.id) ? (seen[s.id] ?? now) : now;
  }

  // Look again at whichever comes first for the bubble now up: the moment a
  // waiting line is allowed to preempt it, or the moment its life is spent.
  // Nothing shown and nobody waiting means no timer at all.
  const stillWaiting = speakers.some((s) => !shown.some((p) => p.id === s.id));
  const heldAt = nextHeld.length ? Math.min(...nextHeld.map((h) => h.at)) : null;
  const nextAt = heldAt == null ? null : heldAt + (stillWaiting ? BUBBLE_PREEMPT_MS : BUBBLE_LIFE_MS);

  return { shown, held: nextHeld, seen: nextSeen, nextAt };
}

/**
 * React's half: keep the queue, set the one timer it needs.
 *
 * Returns a Map id → { text, gold, side } holding at most MAX_IN_ROOM entries.
 * Everything else the caller handed in is waiting, and nothing about that is
 * drawn — a queue you can see is a queue that has become the subject.
 */
export function useRoomBubbles(speakers = [], bodies = []) {
  const [tick, setTick] = useState(0);
  const state = useRef({ held: [], seen: {} });

  // The identity of what is being said and where everyone stands, so a
  // re-render that changed neither does not restart anybody's beat.
  const said = speakers.map((s) => `${s.id}:${s.gold ? 'g' : 's'}:${s.text}`).join('|');
  const where = bodies.map((b) => `${b.id}@${Math.round(b.x)},${Math.round(b.y)}`).join('|');

  const { shown, nextAt } = useMemo(() => {
    const out = resolve(speakers, bodies, { ...state.current, now: Date.now() });
    state.current = { held: out.held, seen: out.seen };
    return out;
  // `tick` is the timer's only job: re-run this with a later clock.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said, where, tick]);

  useEffect(() => {
    if (nextAt == null) return undefined;
    const wait = Math.max(0, nextAt - Date.now());
    const t = setTimeout(() => setTick((n) => n + 1), wait);
    return () => clearTimeout(t);
  }, [nextAt]);

  return useMemo(
    () => new Map(shown.map((s) => [s.id, { text: s.text, gold: s.gold, side: s.side }])),
    [shown],
  );
}
