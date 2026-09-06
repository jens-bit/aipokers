// Port of MoodGhost from design-refs/mood-atoms.jsx.
// The chat / list / band / hero ghost — viewBox 0 0 80 80, no floor bob animation.
//
// ── HOME-2 job 3 · MOOD MOVES THE FACE, NEVER THE COLOUR ───────────────────
//
// `hood` and `glow` are WHO HE IS: rolled at birth from his id (lib/identity.js)
// and fixed for life. The hood fills the body, the glow lights the eyes and the
// rim and the aura. Everything else in here is what he FEELS, and it is all
// geometry — eye shape, lids, brow, the slump.
//
// The two channels are deliberately separate, and the separation is the whole
// reason identity is drawn at all: you have to be able to tell four agents
// apart while all four of them are tilted, which is exactly the moment an owner
// most needs to. A body whose colour answered mood would make a tilted room
// four copies of one man.
//
// Both are optional. Without them this draws precisely what it always drew —
// the near-black hood, `accent` on the rim — so every surface that has not been
// handed an identity is unchanged.
//
// WATCH-6 brings the atom up to the wave-41/42 vehicle the v5 hero and the
// ceremony are drawn with: `heat` picks the face's intensity tier, `event`
// overlays a transient expression, `hands` gives him body language at table
// scale, and `size` decides how much of either survives. Existing callers pass
// none of them and get the mid tier at full detail, which is the face this atom
// always drew.
//
// DRAFT-2 brings the wave-56 identity parameters across: `hood` is the cloth he
// wears (one of lib/identity.js's six) and `glow` is the colour behind his eyes.
// Both are the ref's and both are OPTIONAL. Together they are what lets the draft
// form him out of ONE atom instead of a second drawing: a near-black hood with a
// near-black glow is a silhouette, the real hood with a dead glow is a body
// without eyes, and the real glow lights them.
//
// THE DEFAULT HOOD IS THIS FILE'S OLD ONE, NOT THE REF'S `HOODS[0]`. Wave 56
// relit the six hoods from near-black (L* 8–14) to L* 26–36, and the ref's atom
// defaults to the new ASH — so taking that default here would relight every
// ghost in the product (floor, seat, band, hero, birth card) as a side effect of
// building the draft screen. That relight is a real change with its own reasons
// and it deserves its own tree and its own look; it is not something DRAFT-2 is
// entitled to do quietly. So a caller who passes no hood gets exactly the ghost
// this atom drew yesterday, and the draft passes its four hoods explicitly.

import { useId } from 'react';
import { ghostFace, ghostBrow } from './GhostFace.jsx';
import { ghostHands } from './GhostHands.jsx';

/** What this atom drew before wave 56, and still draws for every caller that asks for no hood. */
const HOOD_DEFAULT = { top: '#141A22', bot: '#0A0F17' };

const MOODS = {
  confident:  { color: '#00D4AA', glow: 0.34 },
  neutral:    { color: '#888888', glow: 0.10 },
  frustrated: { color: '#CDB380', glow: 0.20 },
  tilted:     { color: '#FF4D4F', glow: 0.36 },
  sulking:    { color: '#6B6B6B', glow: 0.07 },
};

export function MoodGhost({
  mood = 'neutral', accent = '#00D4AA', size = 40, ring = true,
  tone, heat = 45, event, hands, bet, won, brow,
  // HOME-2 job 3 — who he is. `hood` is one of lib/identity.js's six; `glow` is
  // the colour string off one of its six glows.
  hood = null, glow: glowCol = null,
}) {
  const uid = useId().replace(/:/g, '');
  const m = MOODS[mood] || MOODS.neutral;
  // His own colour outranks the mood's. The ref's order exactly: an agent with
  // an identity is that colour whatever he is feeling, and `tone` (the felt's
  // deliberate override for a seat it is dimming) still outranks both.
  const mc = glowCol || tone || m.color;
  const eye = glowCol || tone || (mood === 'neutral' ? accent : m.color);
  const rim = glowCol || accent;
  const cloth = hood ?? { top: '#141A22', bot: '#0A0F17' };
  const slump = mood === 'sulking';
  const cy = slump ? 46 : 42;
  // The glow answers heat too, bounded so the low tier is never invisible.
  const glow = Math.min(0.62, m.glow * (0.7 + (Math.max(0, Math.min(100, heat)) / 100) * 0.9));

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className="mood-ghost"
      data-mood={mood} data-hands={hands || null} data-event={event || null}
      data-hood={hood?.id || null}
      style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`mg${uid}`} cx="50%" cy="54%" r="52%">
          <stop offset="0" stopColor={mc} stopOpacity={glow} />
          <stop offset="1" stopColor={mc} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`mh${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={cloth.top} />
          <stop offset="1" stopColor={cloth.bot} />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="44" rx="44" ry="42" fill={`url(#mg${uid})`} />
      {slump
        ? <path d="M40 20 C27 20 20 32 20 48 L17 80 L63 80 L60 48 C60 32 53 20 40 20 Z"
            fill={`url(#mh${uid})`} stroke={ring ? `${rim}66` : 'transparent'} strokeWidth="1.4" />
        : <path d="M40 12 C26 12 18 24 18 42 L18 80 L62 80 L62 42 C62 24 54 12 40 12 Z"
            fill={`url(#mh${uid})`} stroke={ring ? `${rim}66` : 'transparent'} strokeWidth="1.4" />}
      <ellipse cx="40" cy={cy} rx="13.5" ry="16.5" fill="#04070C" />
      {ghostFace({ mood, heat, size, event, eye, cy })}
      {brow && ghostBrow({ brow, eye, cy })}
      {hands && ghostHands({ pose: hands, size, bet, won })}
    </svg>
  );
}
