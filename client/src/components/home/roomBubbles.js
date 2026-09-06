// client/src/components/home/roomBubbles.js — FIX-6 job 3
//
// THE ROOM'S SPEECH, QUEUED.
//
// Playtest 6 Sep: the flat printed everything the household had to say the
// instant it had it. A man with a want AND a recap wore two boxes at once; four
// bodies with something to say wore four; and because a bubble is 152px wide in
// a 390px room, half of them were drawn across somebody else's name pill. The
// room stopped being readable exactly when it had the most to tell you.
//
// The felt solved this in WATCH v4 (lib/bubbles.js) with a law the room can
// borrow most of, and one clause it must not:
//
//   ONE PER BODY          borrowed. Two boxes over one head is not a
//                         conversation, it is a stack.
//   AT MOST TWO AT ONCE   borrowed. Any more and the room is a wall of text.
//   NEVER A QUEUE         NOT borrowed, and this is the whole difference. The
//                         felt is a performance that cannot be paused — a hand
//                         moves on whether or not you read the line. The room
//                         is not going anywhere, so a third thing to say WAITS
//                         its turn instead of being thrown away.
//
// The beat it waits is lib/pace.js's BUBBLE_DWELL_MS, which is where every
// dwell in the app lives. A bubble holds its place for one beat before anyone
// queued behind it may take it, and it is only ever taken by somebody actually
// waiting — a line nobody is queued behind stays up rather than blanking for
// nothing.
//
// AND NOTHING IS DRAWN OVER ANYTHING. A bubble takes the side with clearance:
// the room edge first (flat.js's rule, which has always been there), then every
// name pill in the room and every bubble already placed. If neither side is
// clear, he waits too — a sentence you cannot read is not better than a
// sentence that arrives a beat later.
//
// THE BOXES ARE MODELLED, NOT MEASURED, and that is deliberate. Measuring means
// layout, layout means the DOM, and the DOM means this file could not be pure
// and could not be tested without rendering a room. Every constant below is
// read off home1.css and rounded so the model is never SMALLER than the thing
// it stands for: a bubble that overlaps by a pixel the model did not know about
// is the bug this file exists to prevent.

import { useEffect, useMemo, useRef, useState } from 'react';

import { BUBBLE_W, bubbleFits, bubbleSide } from './flat.js';
import { BUBBLE_DWELL_MS } from '../../lib/pace.js';
import { shortName } from '../../lib/names.js';

/** How many bubbles the room may hold at once. bubbles.js's MAX_ON_FELT. */
export const MAX_IN_ROOM = 2;

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

export function overlaps(a, b) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Which way this body's bubble may open, or null when neither way is clear.
 *
 * The room edge is flat.js's rule and is checked first, because a bubble that
 * clips is cut silently (the room has overflow: hidden). Then the blockers:
 * every name pill in the room, and every bubble already placed this pass.
 */
export function sideFor(body, blockers = []) {
  const preferred = bubbleSide(body.x);
  const sides = preferred === 'right' ? ['right', 'left'] : ['left', 'right'];
  for (const side of sides) {
    if (!bubbleFits(body.x, side)) continue;
    const box = bubbleRect(body, side);
    if (blockers.some((b) => overlaps(box, b))) continue;
    return side;
  }
  return null;
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
  const pills = bodies.map(pillRect);
  const placed = [];
  const taken = [];
  for (const speaker of speakers) {
    if (placed.length >= MAX_IN_ROOM) break;
    if (!speaker) continue;
    const side = sideFor(speaker, [...pills, ...taken]);
    if (!side) continue;
    taken.push(bubbleRect(speaker, side));
    placed.push({ ...speaker, side });
  }
  return placed;
}

/**
 * The whole of it: who is on screen, who is holding a place, and when to look
 * again. Pure — the caller owns the clock and the state.
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

  // A bubble gives its place up once it has served its beat — but only to
  // somebody who is actually waiting for it.
  const evicted = [];
  if (waiting.length > 0) {
    const spent = keep.filter((h) => now - h.at >= BUBBLE_DWELL_MS).sort((a, b) => a.at - b.at);
    let free = MAX_IN_ROOM - keep.length;
    for (const h of spent) {
      if (free >= waiting.length) break;
      keep = keep.filter((k) => k.id !== h.id);
      evicted.push(h.id);
      free += 1;
    }
  }

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

  // Somebody is still queued: look again when the oldest bubble has served its
  // beat. Nobody queued means no timer at all — the room is quiet and stays up.
  const stillWaiting = speakers.some((s) => !shown.some((p) => p.id === s.id));
  const oldest = nextHeld.length ? Math.min(...nextHeld.map((h) => h.at)) : null;
  const nextAt = stillWaiting && oldest != null ? oldest + BUBBLE_DWELL_MS : null;

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
