// THE HANDS — port of design-refs/mood-atoms.jsx `Fist` / `Hand` / `ghostHands`
// (design 44+, the wave that replaced the mitten).
//
// Two small detached hands, no arms, hovering where a wrist would be. They are
// BODY LANGUAGE AT TABLE SCALE — what he is doing with the hand — while the face
// stays the emotional readout. The split matters: a face can only be read at 34px
// and above, but a hand pushing a stack forward reads at 20.
//
// HANDS-1 replaces the placeholder art. What was here was a three-fingered mitten
// in the body's own ink: at 40px it read as a smudge on the ghost rather than as a
// hand, and the finger circles it dropped below seat scale left nothing at all. The
// ref draws ONE shape at every size — a rounded fist in a pale fill with a thick
// dark outline and two knuckle strokes — and lets the stroke, not the geometry,
// carry the size. Pale-on-dark separates from the body at 40 where same-ink did not.
//
// GRIPS are the fanned pair's bottom OUTER corners, measured rather than guessed:
// the hero's 36x50 cards at ±14° put those corners at x12/x68 of the sprite with
// their bottom edge at y93, so a top-anchored fist at y89 grips the corner from
// below and puts nothing on the card face. A seat's cards are proportionally
// larger, so it carries its own grip — one number set per card layout, never one
// guess for the whole system.

const HAND_FILL = '#BDBDBD';
const HAND_LINE = '#16191B';

// Authored extent of the fist: x −9→12.3 (thumb included), y 0→14.6. Origin is
// top centre, which is what lets a pose be written as an offset from a grip.
export const HAND_BOX = 21.3;

// ~27.5% of the sprite, floored at 9 and capped at 30 so a 20px seat still has a
// hand and a 132px desktop hero does not grow paws.
export function handW(size) { return Math.max(9, Math.min(30, size * 0.275)); }
export function handScale(size) { return (handW(size) * (80 / size)) / HAND_BOX; }
// The outline is `non-scaling-stroke`, so this is screen pixels, not user units:
// the ONE thing that changes with size, which is why the drawing itself does not.
export function handStroke(size) { return size >= 72 ? 3 : size >= 48 ? 2.2 : 1.5; }

export const HERO_GRIP = { l: 12, r: 68, y: 89 };
export const SEAT_GRIP = { l: 7, r: 73, y: 84 };

// NINE POSES AND NO MORE. Each is a fixed arrangement of the same fist; nothing is
// procedural, so nothing can drift into a tenth pose by accident.
//
//   rest    hanging at the sides, 2s idle drift  · between hands
//   hold    both fists under the pair's corners  · the default while he is in a hand
//   peek    one holds, one turns up at the near corner · dealt
//   push    the same fist, moved in and forward  · bet or raise
//   toss    the same fist, out past the corner   · fold — the hand follows the throw
//   drum    both fists flat on the felt          · check
//   clench  both drawn in tight and level        · all-in, or heat >= 70
//   cover   both up over the face                · lost a big pot
//   raise   both fists above the head, wide of it · won
export const HAND_POSES = [
  'rest', 'hold', 'peek', 'push', 'toss', 'drum', 'clench', 'cover', 'raise',
];

// The megaprompt's vocabulary calls the winning pose `rake`; the ref draws it as
// `raise` (arms up, wide of the head) and has no raking hand at all. One pose, both
// names, so neither caller has to translate.
const POSE_ALIAS = { rake: 'raise' };

// The whole drawing: a rounded fist, a small thumb bump, two knuckle strokes.
export function Fist({ size = 96 }) {
  const sw = handStroke(size);
  return (
    <g>
      <path
        d="M-4 0 L 4 0 A 5 5 0 0 1 9 5 L 9 5.5 A 3.3 3.3 0 0 1 9 12.1 A 3 3 0 0 1 6 14.6 L -4 14.6 A 5 5 0 0 1 -9 9.6 L -9 5 A 5 5 0 0 1 -4 0 Z"
        fill={HAND_FILL} stroke={HAND_LINE} strokeWidth={sw}
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
      />
      {[-3.2, 2.2].map((kx) => (
        <path key={kx} className="ghost-hands__knuckle" d={`M${kx} 4.2 L ${kx} 7.4`}
          fill="none" stroke={HAND_LINE} strokeWidth={sw * 0.6}
          strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}

export function Hand({ x, y, r = 0, size = 96, flip }) {
  const s = handScale(size);
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${flip ? -s : s} ${s})`}>
      <Fist size={size} />
    </g>
  );
}

// The two backs the toss throws. Never a face: an opponent's cards are the one
// thing the fish tank does not show, and a fold is where that rule is easiest to
// break by accident.
function MiniBack({ x, y, r = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <rect x="-3.4" y="-4.8" width="6.8" height="9.6" rx="1.2" fill="#16202B"
        stroke="rgba(0,212,170,0.28)" strokeWidth="0.5" />
    </g>
  );
}

// Every pose is the SAME fist, mirrored left/right at opposite corners of the
// grip. The offset system this replaced let the second hand drift onto the card
// face, which is how a hand ends up looking like it is holding nothing.
export function ghostHands({ pose = 'rest', size = 96, grip = HERO_GRIP }) {
  const key = POSE_ALIAS[pose] || pose;
  const P = { size };
  const pair = (dl, dr) => (
    <>
      <Hand {...P} x={grip.l + (dl.x || 0)} y={grip.y + (dl.y || 0)} r={dl.r || 0} />
      <Hand {...P} x={grip.r - (dr.x || 0)} y={grip.y + (dr.y || 0)} r={-(dr.r || 0)} flip />
    </>
  );

  if (key === 'hold') return <g data-pose="hold">{pair({ r: -8 }, { r: -8 })}</g>;
  if (key === 'peek') return <g data-pose="peek">{pair({ r: -8 }, { x: 3, y: -1, r: -26 })}</g>;
  if (key === 'push') return <g data-pose="push">{pair({ r: -8 }, { x: 7, y: 3, r: -14 })}</g>;
  if (key === 'drum') return <g data-pose="drum">{pair({ y: 2, r: -4 }, { y: 2, r: -4 })}</g>;
  if (key === 'clench') return <g data-pose="clench">{pair({ x: 4, y: -2 }, { x: 4, y: -2 })}</g>;
  if (key === 'toss') return (
    <g data-pose="toss">
      <MiniBack x={grip.r + 4} y={grip.y - 30} r={-40} s={0.9} />
      <MiniBack x={grip.r + 10} y={grip.y - 36} r={-54} s={0.86} />
      {pair({ r: -8 }, { x: -6, y: -8, r: 24 })}
    </g>
  );
  if (key === 'cover') return (
    <g data-pose="cover">{pair({ x: 18, y: -46, r: -18 }, { x: 18, y: -46, r: -18 })}</g>
  );
  // Arms up, wide of the head and clear of the brow — the ceremony has no cards
  // to hold, so the hands are free to say something.
  if (key === 'raise') return (
    <g data-pose="raise">{pair({ x: -47, y: -104, r: -34 }, { x: -47, y: -104, r: -34 })}</g>
  );
  return (
    <g data-pose="rest" className="ghost-hands--rest">
      <Hand {...P} x={grip.l - 4} y={grip.y - 20} r={-6} />
      <Hand {...P} x={grip.r + 4} y={grip.y - 20} r={6} flip />
    </g>
  );
}

// The hand layer is drawn OVER the card pair, not inside the ghost: he is holding
// his cards, not standing behind them. Inside MoodGhost's own svg it sat under the
// z-index-6 pair, which is the whole reason 52a needed a second svg.
export function GhostHandLayer({ pose = 'hold', size = 96, grip = HERO_GRIP, className }) {
  return (
    <svg className={`ghost-hands${className ? ` ${className}` : ''}`}
      width={size} height={size} viewBox="0 0 80 80" aria-hidden
      style={{ overflow: 'visible', pointerEvents: 'none' }}>
      {ghostHands({ pose, size, grip })}
    </svg>
  );
}
