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
      { cx: 158, cy: 190, rx: 106, ry: 52, lit: true, seat: 0 },
      { cx: 312, cy: 92,  rx: 60,  ry: 27, lit: false },
    ],
    bar: { x1: 18, x2: 216, y: 402 },
    corner: { cx: 296, cy: 542, rx: 96, ry: 78 },
  },
  two: {
    felts: [
      { cx: 240, cy: 160, rx: 92,  ry: 47, lit: true, seat: 1 },
      { cx: 130, cy: 370, rx: 100, ry: 52, lit: true, seat: 0 },
    ],
    bar: { x1: 18, x2: 180, y: 470 },
    corner: { cx: 300, cy: 556, rx: 84, ry: 68 },
  },
  // three playing, one resting — 2×2 grid (not a diamond: the diamond's ry=32
  // points are too small to carry a legible diorama; the grid keeps ry=52)
  three: {
    felts: [
      { cx: 100, cy: 150, rx: 88, ry: 52, lit: true, seat: 0 },
      { cx: 290, cy: 150, rx: 88, ry: 52, lit: true, seat: 1 },
      { cx: 100, cy: 400, rx: 88, ry: 52, lit: true, seat: 2 },
      { cx: 290, cy: 400, rx: 88, ry: 52, lit: false },
    ],
    bar: { x1: 18, x2: 372, y: 592, sliver: true },
    corner: null,
  },
  full: {
    // same 2×2 grid, all four lit — never more than four felts
    felts: [
      { cx: 100, cy: 150, rx: 88, ry: 52, lit: true, seat: 0 },
      { cx: 290, cy: 150, rx: 88, ry: 52, lit: true, seat: 1 },
      { cx: 100, cy: 400, rx: 88, ry: 52, lit: true, seat: 2 },
      { cx: 290, cy: 400, rx: 88, ry: 52, lit: true, seat: 3 },
    ],
    bar: { x1: 18, x2: 372, y: 592, sliver: true },
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

// The camera push-in. The ref zooms by narrowing the SVG viewBox rather than
// applying a CSS transform, explicitly so nothing contributes to a scrollable
// overflow region. Crop is the ref's 186x310 window, centred on the subject
// and clamped inside the room.
const ZOOM_W = 186;
const ZOOM_H = 310;
export function zoomViewBox(x, y) {
  const cx = Math.min(Math.max(x, ZOOM_W / 2), FLOOR_W - ZOOM_W / 2);
  const cy = Math.min(Math.max(y, ZOOM_H / 2), FLOOR_H - ZOOM_H / 2);
  return `${cx - ZOOM_W / 2} ${cy - ZOOM_H / 2} ${ZOOM_W} ${ZOOM_H}`;
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
