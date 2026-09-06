// client/src/components/home/carry.js — HOME-2 job 5
//
// WHERE YOU CAN PUT HIM DOWN.
//
// Picking an agent up and dropping him on a fixture is the room's one direct
// manipulation: everything else on this screen is a tap that opens something,
// and this is the owner moving a creature with his hand. So the hit-testing is
// pure and lives here rather than inside the gesture — the question "what is
// under this point" is arithmetic about the plan, and a test should be able to
// ask it without a browser, a pointer or a room.
//
// FIVE TARGETS, and each of them is a VERB rather than a place:
//
//   couch   rest
//   table   join the home game
//   fridge  a snack
//   tv      watch a hand back
//   door    walk to the casino
//
// The safe is deliberately not one. Dropping a man on the money is the one
// gesture in this room that would read as spending him.
//
// EVERY CATCH IS BIGGER THAN THE THING IT DRAWS. A 34px-wide door is a target
// you miss with a thumb, and a miss here is not a no-op — it is the room
// putting him back down and the owner trying again. `DROP_PAD` is the slack,
// and it is why the boxes below are checked in order of area: the pads make
// neighbours overlap even though the fixtures themselves do not (flat.test).

import { FLAT, TV_SCREEN, F_W, F_H } from './flat.js';

/** How long a press has to hold before he comes off the floor. */
export const LONG_PRESS_MS = 420;

/** How far a finger may slide before the press is a drag and not a press. */
export const PRESS_SLOP = 8;

/** How much larger a fixture's catch is than the fixture. */
export const DROP_PAD = 12;

const padded = (box) => ({
  left: box.x - DROP_PAD,
  right: box.x + box.w + DROP_PAD,
  top: box.y - DROP_PAD,
  bottom: box.y + box.h + DROP_PAD,
});

/**
 * The targets, smallest first.
 *
 * Order is the tie-break and it is by AREA rather than by preference: with the
 * pads on, the door's catch reaches into the wall the fridge is on and the
 * couch's reaches under the table. Giving the smaller thing the point means the
 * one that is harder to hit wins where they overlap, which is the behaviour a
 * thumb expects.
 */
export const DROP_TARGETS = [
  { fixture: 'door', box: FLAT.door, verb: 'walk to the casino' },
  { fixture: 'tv', box: TV_SCREEN, verb: 'watch a hand back' },
  { fixture: 'fridge', box: FLAT.fridge, verb: 'a snack' },
  { fixture: 'couch', box: FLAT.couch, verb: 'rest' },
  { fixture: 'table', ellipse: FLAT.table, verb: 'join the home game' },
];

/** Is this room point inside the table, which is a circle and not a box? */
function inTable(x, y, t = FLAT.table) {
  const rx = t.rx + DROP_PAD;
  const ry = t.ry + DROP_PAD;
  const dx = (x - t.cx) / rx;
  const dy = (y - t.cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/**
 * What is under this point in room coordinates, or null.
 *
 * Null is a real answer and the common one: most of the room is floor, and
 * dropping him on the floor puts him back down where he was rather than doing
 * something almost-right.
 */
export function fixtureAt(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  for (const target of DROP_TARGETS) {
    if (target.ellipse) {
      if (inTable(x, y, target.ellipse)) return target.fixture;
      continue;
    }
    const b = padded(target.box);
    if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return target.fixture;
  }
  return null;
}

/** What dropping him there would mean, for the label a lifted body carries. */
export function verbFor(fixture) {
  return DROP_TARGETS.find((t) => t.fixture === fixture)?.verb ?? null;
}

/**
 * A client point in the room's own coordinates.
 *
 * The room is authored at 390×470 and scaled to whatever box it is given
 * (home1.css: `transform: scale(min(1, 100cqw / 390))`, and DESK-2 scales it up
 * again), so a pointer's clientX means nothing until it is divided by the scale
 * the room is actually drawn at. Measured off the element rather than
 * recomputed from the viewport: one source of the truth, and it survives a
 * rail opening beside the room.
 */
export function toRoom(rect, clientX, clientY) {
  if (!rect || !(rect.width > 0)) return null;
  const scale = rect.width / F_W;
  return {
    x: (clientX - rect.left) / scale,
    y: (clientY - rect.top) / scale,
  };
}

/** Keep a carried body inside the room, so he cannot be dragged off the edge. */
export function clampToRoom(x, y, size = 46) {
  const half = size / 2;
  return {
    x: Math.max(half, Math.min(F_W - half, x)),
    y: Math.max(size, Math.min(F_H, y)),
  };
}

/**
 * Is he in the middle of a hand?
 *
 * Two ways to be, and both of them mean the same thing to a finger: he is at a
 * casino table (`location.where`), or he is in a seat at the kitchen table with
 * a game running on it. The room can see both without asking, which is what
 * lets the refusal happen before a request rather than after one.
 */
export function midHand(agent, { seated = false, gameRunning = false } = {}) {
  const where = agent?.location?.where ?? 'home';
  if (where && where !== 'home') return true;
  return !!(seated && gameRunning);
}
