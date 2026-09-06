// client/src/lib/bubblePlace.js — WATCH-10 job 2
//
// NOTHING IS DRAWN OVER ANYTHING, in one place.
//
// FIX-6 job 3 wrote this rule for the flat (components/home/roomBubbles.js):
// a bubble takes the side with clearance — the edge first, then every name pill
// in the room and every bubble already placed — and a body with no clear side
// is SKIPPED rather than drawn on top of somebody. It fixed the room and left
// the felt exactly as it was, so five seats speaking at 390 wide still put
// table talk across a neighbour's name pill.
//
// The rule was never about the flat. It is about a small screen with several
// people on it and boxes that are wider than the space between them, which is
// the felt's problem word for word. So the ALGORITHM lives here and the two
// surfaces bring their own geometry:
//
//   the room   components/home/roomBubbles.js  — flat coordinates, home1.css
//   the felt   client/src/lib/feltBubbles.js   — slot coordinates, watch.css
//
// What is shared is the part that has a rule behind it. What is not shared is
// the part that is measured off a stylesheet, because those are two different
// stylesheets and a shared "bubble box" would be right about neither.
//
// THE BOXES ARE MODELLED, NOT MEASURED, on both surfaces, and for the reason
// FIX-6 gives: measuring means layout, layout means the DOM, and the DOM means
// this could not be pure and could not be tested without rendering a screen.
// Every model rounds so it is never SMALLER than the thing it stands for — an
// overlap the model did not know about is the bug this file exists to prevent.

/** Do these two boxes share any area at all? `{ left, right, top, bottom }`. */
export function overlaps(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Which way this speaker's bubble may open, or null when neither way is clear.
 *
 * The order of `sides` is the preference — the surface decides it, because
 * "away from the nearest edge" means something different in a room than it does
 * on a felt. `rect` returns null for a side that would be cut off, which is
 * checked FIRST: a clipped bubble is cut silently, and a sentence you cannot
 * read is not better than a sentence that never arrives.
 */
export function sideFor(speaker, { sides, rect, blockers = [] }) {
  for (const side of sides(speaker)) {
    const box = rect(speaker, side);
    if (!box) continue;
    if (blockers.some((b) => overlaps(box, b))) continue;
    return { side, box };
  }
  return null;
}

/**
 * Place as many of `speakers` as the surface can hold, in the order given.
 *
 * A speaker with no clear side is SKIPPED, not dropped: what the caller does
 * with him afterwards is the difference between the two surfaces. The room
 * queues him (it is not going anywhere); the felt lets him go (a hand is a
 * performance that cannot be paused, and the thread has every word either way).
 *
 * @param speakers  priority first, ONE per body already
 * @param max       how many may be on screen at once
 * @param sides     (speaker) => side names, most wanted first
 * @param rect      (speaker, side) => box, or null when that side is cut off
 * @param blockers  boxes that were already there — name pills, and anything
 *                  else the surface refuses to draw over
 * @returns the placed speakers, each with the `side` it took
 */
export function place(speakers = [], { max = 2, sides, rect, blockers = [] } = {}) {
  const taken = [];
  const placed = [];
  for (const speaker of speakers) {
    if (placed.length >= max) break;
    if (!speaker) continue;
    const got = sideFor(speaker, { sides, rect, blockers: [...blockers, ...taken] });
    if (!got) continue;
    taken.push(got.box);
    placed.push({ ...speaker, side: got.side });
  }
  return placed;
}
