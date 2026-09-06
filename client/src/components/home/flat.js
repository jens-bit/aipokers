// client/src/components/home/flat.js — HOME-1
//
// The flat, in plan. Ported from design-refs/mood-home.jsx (board 29, "HOME v2 —
// the flat, seen from above").
//
// ONE COORDINATE SPACE, and every fixture's footprint is declared so occupants
// are placed against it rather than by eye. The ref's own note on why: round 1's
// collisions were all caused by furniture and people living in separate systems.
//
// Everything here is pure — numbers and a placement function, no React, no DOM,
// no clock. That is what lets the walk tests assert "he moved from the couch to
// the table" without rendering a room.
//
// HOME-2 job 4 — EVERY FIXTURE IS THE REF'S NOW. The safe and the fridge used
// to be the one part of this file that was not a port: the brief named them,
// mood-home.jsx did not have them, and their footprints were placed to the
// ref's grid by hand with a note to replace them when the ref landed. It has
// landed (design-refs/mood-home.jsx, `FLAT`), and this is that replacement —
// the safe against the left wall under the frames, the fridge on the kitchen
// wall, the door cut INTO the right wall rather than floating in the room, and
// the television at the bottom of it rather than in the left corner.

export const F_W = 390;
export const F_H = 470;

export const FLAT = {
  wall:   { x: 10,  y: 8,   w: 370, h: 78 },     // the frames hang here
  table:  { cx: 208, cy: 268, rx: 86, ry: 52 },  // the kitchen table
  couch:  { x: 8,   y: 330, w: 96,  h: 116 },
  safe:   { x: 16,  y: 94,  w: 60,  h: 50 },     // against the left wall, under the frames
  fridge: { x: 250, y: 94,  w: 54,  h: 86 },     // the kitchen wall, beside the table
  door:   { x: 356, y: 152, w: 34,  h: 112 },    // IN the right wall, not floating in the room
  // The ref calls this one `tape` — the tape room, where he reviews a flagged
  // hand. It is one television and it is at the BOTTOM of the room; there is no
  // second set in the left corner any more. Written against F_H the way the ref
  // writes it, because it is a band measured up from the floor rather than a
  // point on a grid.
  tv:     { x: 244, y: F_H - 126, w: 132, h: 112 },
};

// The screen and the chair inside the tape room's footprint, at the ref's own
// offsets. The set is not centred in its box: the chair sits below it and a
// little to the left, which is what a room with one armchair in front of one
// television looks like from above.
export const TV_SCREEN = { x: FLAT.tv.x + 16, y: FLAT.tv.y, w: 100, h: 58 };
export const TV_CHAIR  = { x: FLAT.tv.x + 48, y: FLAT.tv.y + 78, w: 34, h: 14 };

// Seats around the table, clockwise from the near side. Two agents sit opposite,
// which is what a heads-up kitchen game looks like from above.
//
// `y` is the occupant's FEET. The table spans cy±ry (216–320), so a near-side
// player stands just past its bottom rim and a far-side player's feet land on
// the top rim — which is what sitting at a table looks like from above.
export const TABLE_SEATS = {
  2: [{ x: 208, y: 356 }, { x: 208, y: 238 }],
  3: [{ x: 208, y: 356 }, { x: 112, y: 262 }, { x: 304, y: 262 }],
  4: [{ x: 208, y: 356 }, { x: 104, y: 276 }, { x: 208, y: 238 }, { x: 312, y: 276 }],
};

export function tableSeats(n) {
  return TABLE_SEATS[Math.min(4, Math.max(2, n | 0))] || TABLE_SEATS[2];
}

// ── Where a routine happens ─────────────────────────────────────────────────
//
// A routine is not just a pose, it is a PLACE: sleeping happens on the couch,
// studying happens in front of the TV, waiting happens by the door. That is the
// whole reason the room reads as a room rather than as a row of avatars, and it
// is why this mapping lives beside the furniture instead of beside the poses.
//
// Anything with no place of its own gets a floor spot from FLOOR_SPOTS, assigned
// by index so the same roster always stands in the same places — a room that
// reshuffles itself on every push is a room nobody can read.

export const COUCH_SPOT = { x: 58, y: 408 };          // on the couch, feet forward
// HOME-2 job 4 · the ref's own STAND.tape: the CHAIR, below the screen it
// faces. The set moved to the bottom of the room, so the man watching it moved
// with it — he sits in front of the television with the replay playing behind
// his head, which is the one thing the tape room is for looking at.
export const TV_SPOT    = { x: 292, y: F_H - 14 };    // the chair, below the screen
export const DOOR_SPOT  = { x: 322, y: 268 };         // just inside the door
export const WALL_SPOT  = { x: 150, y: 150 };         // facing the wall, back turned

// The open floor, in the order it fills. Deliberately away from the table's rim
// and the couch's footprint, and none of them within a bubble's width of an edge
// (see bubbleSide — a bubble flips rather than clips, but a body standing in the
// corner still reads as trapped).
export const FLOOR_SPOTS = [
  { x: 132, y: 404 },
  { x: 200, y: 420 },
  { x: 108, y: 200 },
  { x: 336, y: 330 },
];

// Server routine keys (src/server/home.js Routine) → where he does it.
const ROUTINE_SPOT = {
  sleeps: COUCH_SPOT,
  tape:   TV_SPOT,
  waits:  DOOR_SPOT,
  sulks:  WALL_SPOT,
};

/**
 * Place every agent in the room.
 *
 * Pure and TOTAL: every agent handed in comes back with a position, because a
 * body with no coordinate is a body that renders at 0,0 on top of the wall.
 *
 * @param {Array}  agents  presented agents — { id, location, routine }
 * @param {object} opts.gameAgentIds  ids seated at the home game, in seat order
 * @returns {Map<string, { x, y, spot, seat }>} keyed by agent id.
 *          `spot` names the place, which is what a walk test asserts on — a
 *          coordinate pair that happens to be equal is not the same statement as
 *          "he is still on the couch".
 */
export function homePositions(agents = [], { gameAgentIds = [] } = {}) {
  const out = new Map();
  const seated = gameAgentIds.filter(Boolean).map(String);
  const seats = tableSeats(seated.length);
  seated.forEach((id, i) => {
    const at = seats[i] ?? seats[seats.length - 1];
    out.set(id, { x: at.x, y: at.y, spot: `table:${i}`, seat: i });
  });

  let floor = 0;
  for (const agent of agents) {
    const id = String(agent?.id ?? '');
    if (!id || out.has(id)) continue;
    // An agent who is out is not in the room at all — he is a frame on the wall.
    // He still gets a position, at the door, because that is where he walks from
    // when he comes back and where he walks to when he is sent.
    if (agent?.location?.where && agent.location.where !== 'home') {
      out.set(id, { x: DOOR_SPOT.x, y: DOOR_SPOT.y, spot: 'door:away', seat: null });
      continue;
    }
    const key = agent?.routine?.key ?? null;
    const place = ROUTINE_SPOT[key];
    if (place) {
      out.set(id, { x: place.x, y: place.y, spot: key, seat: null });
      continue;
    }
    const at = FLOOR_SPOTS[floor % FLOOR_SPOTS.length];
    floor += 1;
    out.set(id, { x: at.x, y: at.y, spot: `floor:${floor - 1}`, seat: null });
  }
  return out;
}

// ── The bubble that never clips ─────────────────────────────────────────────
//
// The ref's round-1 bubble was a fixed 168px opening one fixed way, so near an
// edge it either clipped or reached into a neighbour. It picks its side from
// where it stands instead.

export const BUBBLE_W = 152;

// The gap between the body and its bubble, both ways. Matches home1.css.
const BUBBLE_GAP = 9;

/** Would a bubble at this x, opening this way, stay inside the room? */
export function sideFits(x, side) {
  const left = side === 'right' ? x + BUBBLE_GAP : x - BUBBLE_GAP - BUBBLE_W;
  return left >= 0 && left + BUBBLE_W <= F_W;
}

/**
 * Which way the bubble opens.
 *
 * The ref's rule is the PREFERENCE — open right unless he is close enough to
 * the right wall that it would look wrong. But the brief's requirement is
 * stronger than the ref's rule: bubbles flip near an edge and NEVER clip. So
 * the preference is overruled whenever the preferred side does not actually
 * fit and the other one does.
 *
 * The port caught this on its own floor spots: the ref's threshold
 * (x > F_W − BUBBLE_W × 0.62) leaves a band around x≈270 where "right" is
 * preferred and overflows the room by 39px. A body standing there is a body
 * whose bubble is cut in half, and the room has `overflow: hidden` so it is cut
 * silently.
 */
export function bubbleSide(x) {
  const preferred = x > F_W - BUBBLE_W * 0.62 ? 'left' : 'right';
  const other = preferred === 'right' ? 'left' : 'right';
  if (sideFits(x, preferred)) return preferred;
  return sideFits(x, other) ? other : preferred;
}

// Does a bubble at this x, opening the way it would open, stay inside the room?
// The layout test asserts this over every spot in the file rather than over
// three examples, so a fixture moved later cannot quietly push a body somewhere
// its bubble clips.
export function bubbleFits(x, side = bubbleSide(x)) {
  return sideFits(x, side);
}

// Every named place a body can stand, for the tests and for nothing else.
export const ALL_SPOTS = [
  COUCH_SPOT, TV_SPOT, DOOR_SPOT, WALL_SPOT,
  ...FLOOR_SPOTS, ...TABLE_SEATS[4],
];

// ── HOME-2 job 4 · nothing stands inside the furniture ──────────────────────
//
// Every fixture's footprint, so the layout test can assert what used to be
// checked by looking: a body is 46px of ghost with his feet at `y`, and the two
// coordinate systems drifting apart is exactly what put a man's head inside the
// old television. Named rather than derived, because the wall and the table are
// not rectangles in the same sense and this list is only ever read by the test.
export const FOOTPRINTS = {
  safe:   FLAT.safe,
  fridge: FLAT.fridge,
  door:   FLAT.door,
  couch:  FLAT.couch,
  tv:     TV_SCREEN,
};

/** The box a body standing here occupies: his feet at y, `size` of him above. */
export function bodyRect(spot, size = 46) {
  return {
    left: spot.x - size / 2, right: spot.x + size / 2,
    top: spot.y - size, bottom: spot.y,
  };
}
