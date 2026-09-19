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
export const F_H = 612;

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
  // BUG-243: enough screen for a real board and action, still in the tape corner.
  // BUG-248: begin below the standing speech envelope (ends at y440.5),
  // and end before the TV student's largest body footprint begins (y548).
  tv:     { x: 180, y: F_H - 170, w: 196, h: 160 },
};

// The screen and the chair inside the tape room's footprint, at the ref's own
// offsets. The set is not centred in its box: the chair sits below it and a
// little to the left, which is what a room with one armchair in front of one
// television looks like from above.
export const TV_SCREEN = { x: FLAT.tv.x, y: FLAT.tv.y, w: 196, h: 106 };

// BUGS-C job 4's one-sign rule remains. Current DoorTap writes down the jamb;
// its exclusion area is the door itself, inside the room at every scale.
export const SIGN_W = FLAT.door.w;
export const SIGN_H = FLAT.door.h;
export const SIGN = { x: FLAT.door.x, y: FLAT.door.y, w: SIGN_W, h: SIGN_H };

// BUGS-C job 2 · the app's own header, sticky above the room in real layout —
// not a fixture the flat draws, so there is nothing in FLAT for it. Modelled
// as a shallow band across the very top rather than measured (the room has no
// idea how tall the real header is, and does not need to: it only needs to
// keep a bubble from reaching the one strip nothing in the room may use).
// Kept short on purpose — FLAT.wall runs to y86 and a body facing it
// (WALL_SPOT, y150) already has a bubble reaching y34; a header as tall as the
// wall would leave him with no side left to open on.
export const HEADER = { x: 0, y: 0, w: F_W, h: 24 };

export const TV_CHAIR  = { x: 292, y: F_H - 48, w: 34, h: 14 };

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

export function tableSeats(n, geometry = null) {
  const seats = geometry?.seats ?? TABLE_SEATS;
  return seats[Math.min(4, Math.max(2, n | 0))] || seats[2];
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
export function homePositions(agents = [], { gameAgentIds = [], geometry = null } = {}) {
  const door = geometry?.doorSpot ?? DOOR_SPOT;
  const routines = geometry?.routines ?? ROUTINE_SPOT;
  const floorSpots = geometry?.floorSpots ?? FLOOR_SPOTS;
  const out = new Map();
  const seated = gameAgentIds.filter(Boolean).map(String);
  const seats = tableSeats(seated.length, geometry);
  seated.forEach((id, i) => {
    // Location wins over stale membership, but the other physical chairs do not move.
    const where = agents.find(agent => String(agent?.id) === id)?.location?.where;
    if (where && where !== 'home') return;
    const at = seats[i] ?? seats[seats.length - 1];
    out.set(id, { x: at.x, y: at.y, spot: `table:${i}`, seat: i });
  });

  // BUG-137: destinations are shared furniture, not unlimited identical seats.
  // Reserve the real game chairs first, then find a clear resting footprint.
  const size = geometry?.bodySize ?? 46;
  const width = geometry?.width ?? F_W, height = geometry?.height ?? F_H;
  const footprint = p => ({ left: p.x - size / 2 - 11, right: p.x + size / 2 + 11, top: p.y - size - 26, bottom: p.y + 3 });
  const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const clear = p => ![...out.values()].some(at => at.spot !== 'door:away' && intersects(footprint(p), footprint(at)));
  const candidates = [...floorSpots];
  const flat = geometry?.flat ?? FLAT;
  const furniture = [flat.safe, flat.fridge, flat.door, flat.couch, geometry?.tvScreen ?? TV_SCREEN]
    .map(f => ({ left: f.x, right: f.x + f.w, top: f.y, bottom: f.y + f.h }));
  const table = flat.table;
  furniture.push({ left: table.cx - table.rx, right: table.cx + table.rx, top: table.cy - table.ry, bottom: table.cy + table.ry });
  // Extra guests use clear floor space instead of wrapping back onto a resident.
  for (let y = 190; y <= height - 12; y += size + 36) for (let x = 42; x <= width - 42; x += size + 28) {
    const p = { x, y };
    if (!furniture.some(f => intersects(footprint(p), f))) candidates.push(p);
  }
  for (const agent of agents) {
    const id = String(agent?.id ?? '');
    if (!id || out.has(id)) continue;
    // An agent who is out is not in the room at all — he is a frame on the wall.
    // He still gets a position, at the door, because that is where he walks from
    // when he comes back and where he walks to when he is sent.
    if (agent?.location?.where && agent.location.where !== 'home') {
      out.set(id, { x: door.x, y: door.y, spot: 'door:away', seat: null });
      continue;
    }
    const key = agent?.routine?.key ?? null;
    const place = routines[key];
    if (place && clear(place)) {
      out.set(id, { x: place.x, y: place.y, spot: key, seat: null });
      continue;
    }
    const index = candidates.findIndex(p => clear(p) && !furniture.some(f => intersects(bodyRect(p, size), f)));
    // The supported household plus visitors fits the room. Keep this total for
    // malformed oversized snapshots too, without returning a missing coordinate.
    const at = candidates[index] ?? { x: width / 2, y: height - 12 };
    out.set(id, { x: at.x, y: at.y, spot: `floor:${index}`, seat: null });
  }
  return out;
}

// ── The bubble that never clips ─────────────────────────────────────────────
//
// The ref's round-1 bubble was a fixed 168px opening one fixed way, so near an
// edge it either clipped or reached into a neighbour. It picks its side from
// where it stands instead.
//
// BUGS-C job 2 capped it at 150 (down from 152) — the playtest called the room
// bubbles "far too large", and 150 is the brief's own number.
export const BUBBLE_W = 150;

// The gap between the body and its bubble, both ways. Matches home1.css.
const BUBBLE_GAP = 9;

/** Would a bubble at this x, opening this way, stay inside the room? */
export function sideFits(x, side, width = F_W) {
  const left = side === 'right' ? x + BUBBLE_GAP : x - BUBBLE_GAP - BUBBLE_W;
  return left >= 0 && left + BUBBLE_W <= width;
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
export function bubbleSide(x, width = F_W) {
  const preferred = x > width - BUBBLE_W * 0.62 ? 'left' : 'right';
  const other = preferred === 'right' ? 'left' : 'right';
  if (sideFits(x, preferred, width)) return preferred;
  return sideFits(x, other, width) ? other : preferred;
}

// Does a bubble at this x, opening the way it would open, stay inside the room?
// The layout test asserts this over every spot in the file rather than over
// three examples, so a fixture moved later cannot quietly push a body somewhere
// its bubble clips.
export function bubbleFits(x, side = bubbleSide(x), width = F_W) {
  return sideFits(x, side, width);
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
  // BUGS-C job 4: the sign is a no-walk zone too — nobody's target point may
  // land under a lit marquee.
  sign:   SIGN,
};

/** The box a body standing here occupies: his feet at y, `size` of him above. */
export function bodyRect(spot, size = 46) {
  return {
    left: spot.x - size / 2, right: spot.x + size / 2,
    top: spot.y - size, bottom: spot.y,
  };
}

// C9 / mood-desk59.jsx: desktop is a wider floor, not a stretched phone.
// Rendering, routine destinations, bubble exclusions and pointer conversion
// all consume this same definition. Phone exports above remain compatible.
export const PHONE_ROOM = {
  width: F_W, height: F_H, flat: FLAT, tvScreen: TV_SCREEN, tvChair: TV_CHAIR,
  sign: SIGN, header: HEADER, seats: TABLE_SEATS, doorSpot: DOOR_SPOT,
  tvSpot: TV_SPOT, routines: ROUTINE_SPOT, floorSpots: FLOOR_SPOTS,
  wallHeight: 94, boardsTop: 96, bodySize: 46, seatedSize: 50,
};

const DESK_FLAT = {
  wall: { x: 24, y: 16, w: 512, h: 62 },
  table: { cx: 280, cy: 400, rx: 128, ry: 84 },
  safe: { x: 24, y: 96, w: 78, h: 62 },
  fridge: { x: 452, y: 130, w: 72, h: 112 },
  couch: { x: 22, y: 470, w: 112, h: 148 },
  door: { x: 518, y: 288, w: 42, h: 132 },
  tv: { x: 172, y: 536, w: 216, h: 164 },
};
const DESK_DOOR = { x: 480, y: 390 };
const DESK_TV = { x: 280, y: 700 };
export const DESK_ROOM = {
  width: 560, height: 700, flat: DESK_FLAT,
  tvScreen: { x: 172, y: 536, w: 216, h: 106 },
  tvChair: { x: 263, y: 686, w: 34, h: 14 },
  sign: DESK_FLAT.door, header: { x: 0, y: 0, w: 560, h: 24 },
  seats: {
    2: [{ x: 280, y: 526 }, { x: 280, y: 342 }],
    3: [{ x: 280, y: 526 }, { x: 142, y: 408 }, { x: 418, y: 408 }],
    4: [{ x: 280, y: 526 }, { x: 140, y: 414 }, { x: 280, y: 342 }, { x: 420, y: 414 }],
  },
  doorSpot: DESK_DOOR, tvSpot: DESK_TV,
  routines: { sleeps: { x: 78, y: 606 }, tape: DESK_TV, waits: DESK_DOOR, sulks: { x: 200, y: 200 } },
  floorSpots: [{ x: 190, y: 566 }, { x: 396, y: 550 }, { x: 470, y: 276 }, { x: 134, y: 262 }],
  wallHeight: 112, boardsTop: 118, bodySize: 56, seatedSize: 62,
};
