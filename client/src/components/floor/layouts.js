// Zone geometry, ported verbatim from design-refs/mood-casino.jsx.
// Coordinates live in a 390x650 space; the room SVG stretches to the
// viewport (preserveAspectRatio="none") and occupants are positioned as
// percentages of the same numbers, so both stay in register at any size.

export const FLOOR_W = 390;
export const FLOOR_H = 650;

export const LAYOUTS = {
  quiet: {
    felts: [
      { cx: 158, cy: 168, rx: 96, ry: 44, lit: false },
      { cx: 312, cy: 84,  rx: 60, ry: 27, lit: false },
    ],
    bar: { x1: 18, x2: 300, y: 392 },
    corner: { cx: 300, cy: 540, rx: 92, ry: 74 },
    dimRoom: true,
  },
  one: {
    felts: [
      { cx: 158, cy: 186, rx: 102, ry: 47, lit: true, seat: 0 },
      { cx: 312, cy: 92,  rx: 60,  ry: 27, lit: false },
    ],
    bar: { x1: 18, x2: 216, y: 402 },
    corner: { cx: 296, cy: 542, rx: 96, ry: 78 },
  },
  two: {
    felts: [
      { cx: 300, cy: 126, rx: 66, ry: 30, lit: true, seat: 1 },
      { cx: 146, cy: 296, rx: 96, ry: 44, lit: true, seat: 0 },
    ],
    bar: { x1: 18, x2: 180, y: 452 },
    corner: { cx: 300, cy: 556, rx: 84, ry: 68 },
  },
  // three playing, one resting — the diamond with one felt dark
  three: {
    felts: [
      { cx: 195, cy: 128, rx: 72, ry: 32, lit: true, seat: 0 },
      { cx: 92,  cy: 296, rx: 72, ry: 32, lit: true, seat: 1 },
      { cx: 298, cy: 296, rx: 72, ry: 32, lit: true, seat: 2 },
      { cx: 195, cy: 464, rx: 72, ry: 32, lit: false },
    ],
    bar: { x1: 18, x2: 372, y: 606, sliver: true },
    corner: null,
  },
  full: {
    felts: [
      { cx: 195, cy: 128, rx: 72, ry: 32, lit: true, seat: 0 },
      { cx: 92,  cy: 296, rx: 72, ry: 32, lit: true, seat: 1 },
      { cx: 298, cy: 296, rx: 72, ry: 32, lit: true, seat: 2 },
      { cx: 195, cy: 464, rx: 72, ry: 32, lit: true, seat: 3 },
    ],
    bar: { x1: 18, x2: 372, y: 606, sliver: true },
    corner: null,
  },
};

// Felt count follows how many agents are actually playing. More than four
// playing still uses the four-felt diamond — the ref's stated cap.
export function layoutFor(playingCount) {
  if (playingCount <= 0) return 'quiet';
  if (playingCount === 1) return 'one';
  if (playingCount === 2) return 'two';
  if (playingCount === 3) return 'three';
  return 'full';
}

// The room keeps its aspect ratio (xMidYMid meet) and is centred in the
// viewport; the leftover band is painted with the floor's own ground
// treatment so it reads as more room, not as a letterbox.
//
// Occupants are HTML, not SVG, so they need the same mapping the browser
// applies to the SVG: scale by k, offset by the centring gap. Scaling the
// ghosts by k too is what keeps ghost-to-felt proportions constant at every
// viewport size.
export function projectRoom(w, h) {
  if (!w || !h) return { k: 1, ox: 0, oy: 0 };
  const k = Math.min(w / FLOOR_W, h / FLOOR_H);
  return { k, ox: (w - FLOOR_W * k) / 2, oy: (h - FLOOR_H * k) / 2 };
}

// Places an element anchored at room coordinate (x, y), scaled into the room.
export function roomStyle(room, x, y) {
  const { k, ox, oy } = room;
  return {
    left: ox + x * k,
    top: oy + y * k,
    transform: `translateX(-50%) scale(${k})`,
    transformOrigin: 'top center',
  };
}
