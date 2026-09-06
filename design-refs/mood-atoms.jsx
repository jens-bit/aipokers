// Shared atoms for the mobile mood concepts — tokens, ghost avatar, phone shell.

// AMBIENCE (Aug 2026): the house lights came up ~2 steps. Night, not void — panels
// separate from the ground, borders read, mood glows pop HARDER against the lift.
// Text colours untouched; ink-on-teal button text stays #0A0A0A (it is ink, not ground).
const M_BG = '#1A1A1E';
const M_PANEL = '#232329';
const M_PANEL_2 = '#28282F';
const M_SURF = '#2F2F37';
const M_BORDER = 'rgba(255,255,255,0.12)';
const M_BORDER_2 = 'rgba(255,255,255,0.18)';
// CONTRAST LAW: every text token is measured against the worst composited base it
// actually sits on (the teal-tinted pill, L=0.0330), not against the flat ground.
// The ambience pass lifted the room, so the greys lifted with it — holding them fixed
// would have preserved the hex and destroyed the relationship.
const M_TEXT = '#EDEDED';   // primary   · 12.4:1 panel
const M_DIM = '#C3C3C6';    // secondary ·  8.2:1 panel
const M_MUTED = '#9E9EA2';  // tertiary  ·  5.5:1 panel · 4.7:1 on tinted pills
const M_FAINT = '#55555C';  // NOT TEXT  · dashes, rings, empty pips only
const M_TEAL = '#00D4AA';
const M_GOLD = '#CDB380';
const M_RED = '#FF6B6D';    // 5.3:1 panel
const M_PURPLE = '#9B7BFF';
const M_PINK = '#FF7A8E';

const PLAYFAIR = '"Playfair Display", Georgia, serif';
// Display-only face: pot amounts, agent names at zoom, the birth title. One weight,
// no italic. NEVER body, labels, or table numerals — that is the S1 law.
const ROZHA = '"Rozha One", Georgia, serif';
const OSWALD = '"Oswald", "Inter", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INTER = '"Inter", -apple-system, system-ui, sans-serif';

// Identity = accent (border/rim). Mood = eyes + glow. Never mixed.
// FIVE colours, five moods — the neutral/sulking pair must never collapse onto one
// token. Pre-lift they were #888888 vs #6B6B6B (neutral brighter, more present);
// post-lift that relationship is #BDBDC1 vs #9E9EA2, both clearing AA.
const M_NEUTRAL = '#BDBDC1';  // mood only — never a text token
const MOODS = {
  confident:  { label: 'CONFIDENT',  color: M_TEAL,     glow: 0.34, pip: '▲', cause: 'won three big pots in a row' },
  neutral:    { label: 'NEUTRAL',    color: M_NEUTRAL,  glow: 0.10, pip: '–', cause: 'even session, nothing notable' },
  frustrated: { label: 'FRUSTRATED', color: M_GOLD,   glow: 0.20, pip: '!', cause: 'folded the best hand twice' },
  tilted:     { label: 'TILTED',     color: M_RED,    glow: 0.36, pip: '⚡', cause: 'lost two big pots as favorite' },
  sulking:    { label: 'SULKING',    color: M_MUTED, glow: 0.07, pip: '▾', cause: 'got shown a bluff, wants to sit out' },
};

// ── THE HANDS ──────────────────────────────────────────────────────────────
// Two small detached hands, no arms, hovering where a wrist would be. They are
// BODY LANGUAGE AT TABLE SCALE — what he is doing with the hand — while the face
// stays the emotional readout. The split matters: a face can only be read at 34px
// and above, but a hand pushing a stack forward reads at 20.
//
// Same ink as the body, one step lighter so they separate against it. Three-fingered
// mitten, ~22% of body width (the body spans 44 of the 80 viewBox, so ~9.6 units).
// Fingers are separate circles unioned into a palm — the same construction the club
// glyph uses, because overlapping fills have no seams.
const HAND_FILL = '#BDBDBD';
const HAND_LINE = '#16191B';
// authored extent: x −9→12.3 (thumb included), y 0→14.6. Origin = top centre.
const HAND_BOX = 21.3;
const handW = size => Math.max(9, Math.min(30, size * 0.275));
const handScale = size => (handW(size) * (80 / size)) / HAND_BOX;
const handStroke = size => (size >= 72 ? 3 : size >= 48 ? 2.2 : 1.5);

// the whole drawing: a rounded fist, a small thumb bump, two knuckle strokes
const Fist = ({ size = 96 }) => {
  const sw = handStroke(size);
  return (
    <g>
      <path d="M-4 0 L 4 0 A 5 5 0 0 1 9 5 L 9 5.5 A 3.3 3.3 0 0 1 9 12.1 A 3 3 0 0 1 6 14.6 L -4 14.6 A 5 5 0 0 1 -9 9.6 L -9 5 A 5 5 0 0 1 -4 0 Z"
        fill={HAND_FILL} stroke={HAND_LINE} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
      {[-3.2, 2.2].map(kx => (
        <path key={kx} d={`M${kx} 4.2 L ${kx} 7.4`} fill="none" stroke={HAND_LINE}
          strokeWidth={sw * 0.6} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
      ))}
    </g>
  );
};

const Hand = ({ x, y, r = 0, size = 96, flip }) => {
  const s = handScale(size);
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${flip ? -s : s} ${s})`}>
      <Fist size={size}/>
    </g>
  );
};

const MiniBack = ({ x, y, r = 0, s = 1 }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    <rect x="-3.4" y="-4.8" width="6.8" height="9.6" rx="1.2" fill="#16202B" stroke="rgba(0,212,170,0.28)" strokeWidth="0.5"/>
  </g>
);

// GRIPS are the fanned pair's bottom OUTER corners, measured not guessed: the hero's
// 36×50 cards at ±14° put those corners at x12/x68 of the sprite with their bottom
// edge at y93, so a top-anchored fist at y91 overlaps the card edge by 2px and puts
// nothing on the face. A seat's cards are proportionally larger, so it carries its
// own grip — one number set per card layout, not one for the whole system.
const HERO_GRIP = { l: 12, r: 68, y: 89 };
const SEAT_GRIP = { l: 7, r: 73, y: 84 };

const HAND_POSES = {
  rest:   { label: 'Rest',   note: 'hanging at the sides, 2s idle drift', when: 'between hands, at the bar, on the floor' },
  hold:   { label: 'Hold',   note: 'both fists under the pair\u2019s bottom corners', when: 'the default while he is in a hand' },
  peek:   { label: 'Peek',   note: 'one holds, one turns up at the near corner', when: 'dealt, and once when heat rises' },
  push:   { label: 'Push',   note: 'the same fist, moved in and forward', when: 'bet or raise' },
  toss:   { label: 'Toss',   note: 'the same fist, out past the corner after the throw', when: 'fold' },
  drum:   { label: 'Drum',   note: 'both fists flat on the felt, tapping twice', when: 'check' },
  clench: { label: 'Clench', note: 'both drawn in tight and level', when: 'all-in, or heat \u2265 70' },
  cover:  { label: 'Cover',  note: 'both up over the face', when: 'lost a big pot' },
  raise:  { label: 'Raise',  note: 'both fists above the head, wide of it', when: 'won \u2014 the whole hand-end celebration' },
};

const OPP_POSES = ['rest', 'hold', 'toss', 'push'];

// every pose: the SAME fist, mirrored left/right at opposite corners. The offset
// system it replaces let the second hand drift onto the card face.
const ghostHands = ({ pose = 'rest', size = 96, bet, won, grip = HERO_GRIP }) => {
  const P = { size };
  const pair = (dl, dr) => (
    <g>
      <Hand {...P} x={grip.l + (dl.x || 0)} y={grip.y + (dl.y || 0)} r={dl.r || 0}/>
      <Hand {...P} x={grip.r - (dr.x || 0)} y={grip.y + (dr.y || 0)} r={-(dr.r || 0)} flip/>
    </g>
  );
  if (pose === 'hold')   return pair({ r: -8 }, { r: -8 });
  if (pose === 'peek')   return pair({ r: -8 }, { x: 3, y: -1, r: -26 });
  if (pose === 'push')   return pair({ r: -8 }, { x: 7, y: 3, r: -14 });
  if (pose === 'drum')   return pair({ y: 2, r: -4 }, { y: 2, r: -4 });
  if (pose === 'clench') return pair({ x: 4, y: -2 }, { x: 4, y: -2 });
  if (pose === 'toss') return (
    <g>
      <MiniBack x={grip.r + 4} y={grip.y - 30} r={-40} s={0.9}/>
      <MiniBack x={grip.r + 10} y={grip.y - 36} r={-54} s={0.86}/>
      {pair({ r: -8 }, { x: -6, y: -8, r: 24 })}
    </g>
  );
  if (pose === 'cover') return pair({ x: 18, y: -46, r: -18 }, { x: 18, y: -46, r: -18 });
  // arms up, wide of the head and clear of the brow — the ceremony has no cards to
  // hold, so the hands are free to say something
  if (pose === 'raise') return pair({ x: -47, y: -104, r: -34 }, { x: -47, y: -104, r: -34 });
  return (
    <g style={{ animation: 'drift 2s ease-in-out infinite' }}>
      <Hand {...P} x={grip.l - 4} y={grip.y - 20} r={-6}/>
      <Hand {...P} x={grip.r + 4} y={grip.y - 20} r={6} flip/>
    </g>
  );
};

// ── BROW TRIGGERS ─────────────────────────────────────────────────────────
// The wave-41 faces own the resting brow; these three are momentary overrides,
// drawn on top and gone within a second. Each has exactly one trigger.
const BROW_TRIGGERS = {
  twitch: { label: 'Twitch', trigger: 'a raise lands against him', hold: '400ms', note: 'one brow only — asymmetry is what makes it read as involuntary' },
  lift:   { label: 'Lift',   trigger: 'peek, and the hand is strong',  hold: '700ms', note: 'both, and it is the only friendly brow the resting set never draws' },
  knit:   { label: 'Knit',   trigger: 'heat reaches 55',               hold: 'until heat drops', note: 'the one that persists, because the cause persists' },
};

const ghostBrow = ({ brow, eye, cy }) => {
  if (brow === 'twitch') return (
    <g>
      <path d={`M30.2 ${cy - 7.6} L37 ${cy - 7.6}`} stroke={eye} strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
      <path d={`M49.8 ${cy - 10.2} L43 ${cy - 8.6}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round"/>
    </g>
  );
  if (brow === 'lift') return (
    <g>
      <path d={`M30.2 ${cy - 10} L37 ${cy - 10}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round"/>
      <path d={`M49.8 ${cy - 10} L43 ${cy - 10}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round"/>
    </g>
  );
  if (brow === 'knit') return (
    <g>
      <path d={`M30.6 ${cy - 8.2} L37.4 ${cy - 5.6}`} stroke={eye} strokeWidth="1.6" strokeLinecap="round"/>
      <path d={`M49.4 ${cy - 8.2} L42.6 ${cy - 5.6}`} stroke={eye} strokeWidth="1.6" strokeLinecap="round"/>
    </g>
  );
  return null;
};

// ── The expression vehicle ──
// ── THE FACES ──────────────────────────────────────────────────────────────
// One face per state was never enough and the confident one was actively wrong:
// its brows rose at the INNER corner, which is the universal worried brow — so the
// agent who had just won three pots looked like he was about to be sick. MOOD-2
// gives every state a heat 0–100, so the answer is INTENSITY, not more states.
//
// Five states × three tiers = fifteen faces. The silhouette NEVER changes; only
// eyes, brows and the glow do. Heat picks the tier, so the art needs no new inputs.
const FACE_TIERS = [
  { k: 'low',  max: 33,  label: 'held' },
  { k: 'mid',  max: 66,  label: 'plain' },
  { k: 'high', max: 100, label: 'full' },
];
const faceTier = h => (h <= 33 ? 'low' : h <= 66 ? 'mid' : 'high');

// DETAIL BY SIZE, and the rule is subtractive: what drops, drops in this order.
//   3 · floor 46+   everything — brows, lids, asymmetry, vents
//   2 · band 38     brows and lids, no asymmetry or vents
//   1 · seat 34     brows collapse to one stroke each; lids drop
//   0 · thread 24   EYES AND GLOW ONLY — the eye shape has to carry the mood alone
const faceDetail = size => (size >= 42 ? 3 : size >= 36 ? 2 : size >= 30 ? 1 : 0);

// six transient expressions, 2–6s, drawn OVER the state and never stored
const FACE_EVENTS = {
  stunned:  { label: 'Stunned',    when: 'a bad beat just landed', hold: '3s' },
  smug:     { label: 'Smug flash', when: 'a bluff got through',    hold: '2s' },
  locked:   { label: 'Locked in',  when: 'all-in',                 hold: '3–5s' },
  bored:    { label: 'Bored',      when: 'card dead',              hold: '6s' },
  wary:     { label: 'Wary',       when: 'a nemesis sits down',    hold: '4s' },
  pleased:  { label: 'Pleased',    when: 'given the snack',        hold: '3s' },
  asleep:   { label: 'Asleep',     when: 'worn, resting at home',  hold: 'until woken' },
};

// eyes(state, tier) + brows(state, tier). Both take the eye colour and the eye-line
// y so the sulking slump keeps working, and both are pure geometry — no state.
const ghostFace = ({ mood, heat = 45, size = 40, event, eye, cy }) => {
  const d = faceDetail(size);
  const t = faceTier(heat);
  const L = 33.5, R = 46.5;   // eye centres, unchanged from the original atom

  // an event replaces the eyes wholesale — it is the loudest thing the face does
  if (event && FACE_EVENTS[event]) {
    const ev = {
      // wide and round, brows high AND inner-raised: the one face where a worried
      // brow is correct, which is why it must not be the confident one
      stunned: (
        <g>
          <circle cx={L} cy={cy} r="3.4" fill={eye}/>
          <circle cx={R} cy={cy} r="3.4" fill={eye}/>
          {d > 0 && <><path d={`M29.5 ${cy - 8} L37 ${cy - 10}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round"/>
          <path d={`M50.5 ${cy - 8} L43 ${cy - 10}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round"/></>}
        </g>
      ),
      // narrowed to arcs that turn UP at the outer edge — a grin done with eyes
      smug: (
        <g>
          <path d={`M30 ${cy + 1} Q${L} ${cy - 3.4} 37 ${cy + 1}`} stroke={eye} strokeWidth="2.1" fill="none" strokeLinecap="round"/>
          <path d={`M43 ${cy + 1} Q${R} ${cy - 3.4} 50 ${cy + 1}`} stroke={eye} strokeWidth="2.1" fill="none" strokeLinecap="round"/>
          {d > 1 && <path d={`M43.4 ${cy - 7.4} L50.6 ${cy - 6.2}`} stroke={eye} strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>}
        </g>
      ),
      // level, tight, absolutely symmetrical: nothing left to decide
      locked: (
        <g>
          <rect x={L - 3.6} y={cy - 1} width="7.2" height="2" rx="1" fill={eye}/>
          <rect x={R - 3.6} y={cy - 1} width="7.2" height="2" rx="1" fill={eye}/>
          {d > 0 && <><path d={`M29.8 ${cy - 6} L37.2 ${cy - 6}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round"/>
          <path d={`M50.2 ${cy - 6} L42.8 ${cy - 6}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round"/></>}
        </g>
      ),
      // half-lidded and looking down: the only face that breaks eye contact
      bored: (
        <g>
          <ellipse cx={L} cy={cy + 1.4} rx="2.8" ry="1.5" fill={eye}/>
          <ellipse cx={R} cy={cy + 1.4} rx="2.8" ry="1.5" fill={eye}/>
          {d > 1 && <><rect x={L - 3.4} y={cy - 2.4} width="6.8" height="1.5" rx="0.7" fill={eye} opacity="0.5"/>
          <rect x={R - 3.4} y={cy - 2.4} width="6.8" height="1.5" rx="0.7" fill={eye} opacity="0.5"/></>}
        </g>
      ),
      // both eyes shifted the same way: he is watching one person, not the table
      wary: (
        <g>
          <ellipse cx={L + 1.6} cy={cy} rx="2.2" ry="2" fill={eye}/>
          <ellipse cx={R + 1.6} cy={cy} rx="2.2" ry="2" fill={eye}/>
          {d > 0 && <><path d={`M30 ${cy - 5.6} L37 ${cy - 6.8}`} stroke={eye} strokeWidth="1.2" strokeLinecap="round"/>
          <path d={`M50.4 ${cy - 6.8} L43.4 ${cy - 5.6}`} stroke={eye} strokeWidth="1.2" strokeLinecap="round"/></>}
        </g>
      ),
      // closed lids curving DOWN, with a lash tick. Pleased curves up; these two are
      // the only closed-eye faces in the set and must not read as each other.
      asleep: (
        <g>
          <path d={`M30 ${cy - 1.4} Q${L} ${cy + 3.4} 37 ${cy - 1.4}`} stroke={eye} strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d={`M43 ${cy - 1.4} Q${R} ${cy + 3.4} 50 ${cy - 1.4}`} stroke={eye} strokeWidth="2" fill="none" strokeLinecap="round"/>
          {d > 0 && <><path d={`M29.4 ${cy + 1.2} L27.8 ${cy + 3}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round"/>
          <path d={`M50.6 ${cy + 1.2} L52.2 ${cy + 3}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round"/></>}
        </g>
      ),
      // closed, curving up: the only genuinely warm face in the set
      pleased: (
        <g>
          <path d={`M30 ${cy + 1.6} Q${L} ${cy - 3} 37 ${cy + 1.6}`} stroke={eye} strokeWidth="2" fill="none" strokeLinecap="round"/>
          <path d={`M43 ${cy + 1.6} Q${R} ${cy - 3} 50 ${cy + 1.6}`} stroke={eye} strokeWidth="2" fill="none" strokeLinecap="round"/>
        </g>
      ),
    };
    return ev[event];
  }

  if (mood === 'confident') {
    // THE FIX: the brow drops toward the INNER corner and lifts at the outer, which
    // is the assured brow. The old atom had it the other way round.
    const narrow = t === 'low' ? 0 : t === 'mid' ? 0.55 : 1;
    return (
      <g>
        {narrow < 1 ? (
          <>
            <ellipse cx={L} cy={cy - 1} rx="3" ry={2.6 - narrow * 0.9} fill={eye}/>
            <ellipse cx={R} cy={cy - 1} rx="3" ry={2.6 - narrow * 0.9} fill={eye}/>
          </>
        ) : (
          <>
            <path d={`M30.2 ${cy - 2.6} Q${L} ${cy + 1.4} 36.8 ${cy - 2.6}`} stroke={eye} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
            <path d={`M43.2 ${cy - 2.6} Q${R} ${cy + 1.4} 49.8 ${cy - 2.6}`} stroke={eye} strokeWidth="2.2" fill="none" strokeLinecap="round"/>
          </>
        )}
        {/* CONFIDENT BROWS ARE LEVEL. The first version raised them at the inner
            corner — the worried brow. The fix over-rotated and dropped them at the
            inner corner instead, which is the ANGRY brow: a shallow V over wide
            eyes reads as scowling, not assured. Assurance is the ABSENCE of brow
            drama, so the calm tier has none at all, the middle tier a faint level
            line, and only the top tier adds a single asymmetric outer lift — which
            is the whole of what makes a face smug rather than cross. */}
        {d > 0 && narrow > 0 && (
          <>
            <path d={`M30.2 ${cy - 7.6} L37 ${cy - 7.6}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity={0.4 + narrow * 0.3}/>
            <path d={`M49.8 ${cy - 7.6 - (narrow === 1 ? 1.8 : 0)} L43 ${cy - 7.6}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity={0.4 + narrow * 0.3}/>
          </>
        )}
      </g>
    );
  }

  if (mood === 'neutral') {
    const r = t === 'low' ? 1.5 : t === 'mid' ? 1.8 : 2.3;
    return (
      <g>
        <ellipse cx="34" cy={cy} rx={2.5} ry={r} fill={eye}/>
        <ellipse cx="46" cy={cy} rx={2.5} ry={r} fill={eye}/>
        {d > 0 && t === 'high' && (
          <>
            <path d={`M30.4 ${cy - 6.6} L37.6 ${cy - 6.6}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
            <path d={`M49.6 ${cy - 6.6} L42.4 ${cy - 6.6}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
          </>
        )}
      </g>
    );
  }

  if (mood === 'frustrated') {
    const a = t === 'low' ? 9 : t === 'mid' ? 14 : 19;
    const w = t === 'high' ? 6.9 : 6.4;
    return (
      <g>
        <g transform={`rotate(${-a} ${L} ${cy})`}><rect x={L - w / 2} y={cy - 1.1} width={w} height="2.2" rx="1.1" fill={eye}/></g>
        <g transform={`rotate(${a} ${R} ${cy})`}><rect x={R - w / 2} y={cy - 1.1} width={w} height="2.2" rx="1.1" fill={eye}/></g>
        {d > 0 && t !== 'low' && (
          <>
            <path d={`M29.8 ${cy - 6.8} L37.4 ${cy - 4.6}`} stroke={eye} strokeWidth={t === 'high' ? 1.5 : 1.2} strokeLinecap="round"/>
            <path d={`M50.2 ${cy - 6.8} L42.6 ${cy - 4.6}`} stroke={eye} strokeWidth={t === 'high' ? 1.5 : 1.2} strokeLinecap="round"/>
          </>
        )}
      </g>
    );
  }

  if (mood === 'tilted') {
    // steaming → red-eyed. The eye COLOUR shifts at the top tier, the only place in
    // the whole system where a mood overrides its own token — because that is what
    // "red-eyed" means and nothing else reads as it.
    const hot = t === 'high';
    const ec = hot ? '#FF6B6D' : eye;
    const a = t === 'low' ? 16 : t === 'mid' ? 24 : 30;
    return (
      <g>
        <g transform={`rotate(${-a} ${L} ${cy})`}><rect x={L - 3.4} y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={ec}/></g>
        <g transform={`rotate(${a} ${R} ${cy})`}><rect x={R - 3.4} y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={ec}/></g>
        {d > 0 && (
          <>
            <path d={`M29.4 ${cy - 7} L37.6 ${cy - 4}`} stroke={ec} strokeWidth={hot ? 1.7 : 1.4} strokeLinecap="round"/>
            <path d={`M50.6 ${cy - 7} L42.4 ${cy - 4}`} stroke={ec} strokeWidth={hot ? 1.7 : 1.4} strokeLinecap="round"/>
          </>
        )}
        {d > 2 && hot && (
          <>
            <path d={`M26 ${cy - 12} q2.4 -2.6 0 -5.2`} stroke={ec} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.5"/>
            <path d={`M54 ${cy - 12} q-2.4 -2.6 0 -5.2`} stroke={ec} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.5"/>
          </>
        )}
      </g>
    );
  }

  // sulking — the lid comes down as heat rises, which reads as shutting you out
  const lid = t === 'low' ? 0 : t === 'mid' ? 1 : 1.9;
  return (
    <g>
      <ellipse cx={L} cy={cy + 2.5} rx="2.2" ry={Math.max(0.7, 1.3 - lid * 0.3)} fill={eye}/>
      <ellipse cx={R} cy={cy + 2.5} rx="2.2" ry={Math.max(0.7, 1.3 - lid * 0.3)} fill={eye}/>
      {d > 1 && (
        <>
          <path d={`M30.6 ${cy - 0.6 + lid} A3 3 0 0 1 36.4 ${cy - 0.6 + lid}`} stroke={eye} strokeWidth="1" fill="none" opacity={0.55 + lid * 0.2}/>
          <path d={`M43.6 ${cy - 0.6 + lid} A3 3 0 0 1 49.4 ${cy - 0.6 + lid}`} stroke={eye} strokeWidth="1" fill="none" opacity={0.55 + lid * 0.2}/>
        </>
      )}
    </g>
  );
};

// ── The expression vehicle ──
// `heat` picks the intensity tier, `event` overlays a transient expression, and
// `size` decides how much of the face survives. Existing callers pass none of the
// three and get the mid tier at full detail, which is the face this atom always
// drew — minus the inner-raised confident brow.
const MoodGhost = ({ mood = 'neutral', accent = M_TEAL, size = 40, ring = true, tone, heat = 45, event, hands, bet, won, brow }) => {
  const uid = React.useId().replace(/:/g, '');
  const m = MOODS[mood];
  const mc = tone || m.color;
  const eye = tone ? tone : (mood === 'neutral' ? accent : m.color);
  const slump = mood === 'sulking';
  const cy = slump ? 46 : 42;
  // the glow answers heat too, bounded so the low tier is never invisible
  const glow = Math.min(0.62, m.glow * (0.7 + (Math.max(0, Math.min(100, heat)) / 100) * 0.9));

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`g${uid}`} cx="50%" cy="54%" r="52%">
          <stop offset="0" stopColor={mc} stopOpacity={glow}/>
          <stop offset="1" stopColor={mc} stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={`h${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#141A22"/>
          <stop offset="1" stopColor="#0A0F17"/>
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="44" rx="44" ry="42" fill={`url(#g${uid})`}/>
      {slump
        ? <path d="M40 20 C27 20 20 32 20 48 L17 80 L63 80 L60 48 C60 32 53 20 40 20 Z" fill={`url(#h${uid})`} stroke={ring ? `${accent}66` : 'transparent'} strokeWidth="1.4"/>
        : <path d="M40 12 C26 12 18 24 18 42 L18 80 L62 80 L62 42 C62 24 54 12 40 12 Z" fill={`url(#h${uid})`} stroke={ring ? `${accent}66` : 'transparent'} strokeWidth="1.4"/>}
      <ellipse cx="40" cy={cy} rx="13.5" ry="16.5" fill="#04070C"/>
      {ghostFace({ mood, heat, size, event, eye, cy })}
      {brow && ghostBrow({ brow, eye, cy })}
      {hands && ghostHands({ pose: hands, size, bet, won })}
    </svg>
  );
};

// Tiny state pip that sits on a list-row avatar
const MoodPip = ({ mood, size = 15 }) => {
  const m = MOODS[mood];
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: '#0A0A0A', border: `1.5px solid ${m.color}`,
      boxShadow: `0 0 6px ${m.color}66`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, fontSize: size * 0.52, fontWeight: 700, color: m.color,
      lineHeight: 1, flexShrink: 0,
    }}>{m.pip}</span>
  );
};

// Avatar + pip, used in every list row
const MoodAvatar = ({ mood, accent, size = 44, pip = 15 }) => (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
    <div style={{
      width: size, height: size, borderRadius: 12, overflow: 'hidden',
      background: '#0A0F17', border: `1px solid ${accent}44`,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <MoodGhost mood={mood} accent={accent} size={size * 0.94} ring={false}/>
    </div>
    <div style={{ position: 'absolute', bottom: -3, right: -3 }}><MoodPip mood={mood} size={pip}/></div>
  </div>
);

const MoodChip = ({ mood, small }) => {
  const m = MOODS[mood];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: small ? 18 : 22, padding: small ? '0 6px' : '0 8px', borderRadius: 4,
      background: `${m.color}1A`, border: `1px solid ${m.color}44`,
      fontFamily: OSWALD, fontSize: small ? 9 : 10, fontWeight: 600,
      letterSpacing: '0.12em', color: m.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: m.color, boxShadow: `0 0 5px ${m.color}` }}/>
      {m.label}
    </span>
  );
};

// ── generic bits ──
const Lbl = ({ children, color = M_MUTED, size = 10 }) => (
  <span style={{ fontFamily: OSWALD, fontSize: size, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color }}>{children}</span>
);

const Num = ({ children, color = M_TEXT, size = 13, weight = 600 }) => (
  <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{children}</span>
);

const Amt = ({ children, color = M_TEXT, size = 24 }) => (
  <span style={{ fontFamily: ROZHA, fontSize: size, fontWeight: 400, color, letterSpacing: '0.005em' }}>{children}</span>
);

const LiveDot = ({ color = M_TEAL, size = 6 }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: 'pulse 2s infinite', flexShrink: 0, display: 'inline-block' }}/>
);

const Btn = ({ children, kind = 'primary', h = 34, full, onClick }) => {
  const base = { height: h, padding: '0 14px', borderRadius: 8, fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: full ? '100%' : 'auto', textTransform: 'uppercase' };
  const kinds = {
    primary: { background: M_TEAL, border: 'none', color: '#0A0A0A', boxShadow: `0 0 14px ${M_TEAL}44` },
    ghost: { background: 'transparent', border: `1px solid ${M_BORDER_2}`, color: M_DIM },
    outline: { background: 'transparent', border: `1px solid ${M_TEAL}`, color: M_TEAL },
  };
  return <button onClick={onClick} style={{ ...base, ...kinds[kind] }}>{children}</button>;
};

// ── phone shell — the real IOSDevice from ios-frame.jsx, sized to Telegram width ──
const PhoneShell = ({ children }) => (
  <IOSDevice width={390} height={844} dark={true}>
    <div style={{
      width: '100%', height: '100%', paddingTop: 54,
      background: M_BG, fontFamily: INTER, color: M_TEXT,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  </IOSDevice>
);

// Quieter than the content it sits under — slim bar, small icons, teal tint only.
const TabBar = ({ active = 'chats' }) => {
  const tabs = [
    { id: 'casino', label: 'Casino', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="12" rx="9" ry="5.5"/><ellipse cx="12" cy="12" rx="5" ry="2.6"/></svg> },
    { id: 'chats', label: 'Chats', badge: 3, icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { id: 'you', label: 'You', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg> },
  ];
  return (
    <div style={{ flexShrink: 0, height: 62, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', alignItems: 'flex-start', paddingTop: 8 }}>
      {tabs.map(t => {
        const on = t.id === active;
        const c = on ? M_TEAL : M_MUTED;
        return (
          <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
              {t.icon(c)}
              {t.badge && (
                <span style={{ position: 'absolute', top: -3, right: -7, minWidth: 13, height: 13, padding: '0 3.5px', borderRadius: 7, background: on ? M_TEAL : 'rgba(255,255,255,0.10)', color: on ? '#0A0A0A' : M_DIM, fontFamily: MONO, fontSize: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span>
              )}
            </div>
            <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: c }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── LAW 1 · the global header. Right side is identical on every screen. ──
const SpadeLogo = () => (
  <svg width="17" height="21" viewBox="0 0 22 26" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M11 1.6 C11 1.6 2.2 9.4 2.2 15.6 C2.2 19 4.5 21.4 7.5 21.4 C8.9 21.4 10 20.9 10.7 20.1 C10.8 22.5 10 24.5 8 25.7 L14 25.7 C12 24.5 11.2 22.5 11.3 20.1 C12 20.9 13.1 21.4 14.5 21.4 C17.5 21.4 19.8 19 19.8 15.6 C19.8 9.4 11 1.6 11 1.6 Z" fill="none" stroke={M_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={M_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
  </svg>
);

const GlobalHeader = ({ title, back }) => (
  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '2px 14px 10px' }}>
    {back && (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: -2 }}><path d="M15 18l-6-6 6-6"/></svg>
    )}
    <SpadeLogo/>
    <span style={{
      fontFamily: OSWALD, fontWeight: 600, color: M_TEXT,
      fontSize: title ? 12.5 : 12,
      letterSpacing: title ? '0.14em' : '0.18em',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      textTransform: 'uppercase',
    }}>{title || 'Agentic Poker'}</span>
    <div style={{ flex: 1, minWidth: 6 }}/>
    {/* right side — never varies */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 29, padding: '0 10px', borderRadius: 15, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, flexShrink: 0 }}>
      <Icon name="chip" size={12} color={M_TEAL}/>
      <Num size={11.5}>2,340.50</Num>
    </div>
    <div style={{ width: 29, height: 29, borderRadius: 15, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.7" strokeLinecap="round"><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
      <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%', background: M_TEAL, boxShadow: `0 0 5px ${M_TEAL}` }}/>
    </div>
  </div>
);

// ── LAW 2 · agent states, one visual system everywhere ──
// Three states describe an agent that exists. 'drafting' describes one that does not yet:
// it borrows M_DIM (no new colour) and is marked by a dashed ring, never a filled dot.
const STATES = {
  live:     { label: 'LIVE',     color: M_TEAL },
  resting:  { label: 'RESTING',  color: M_MUTED },
  recap:    { label: 'RECAP',    color: M_GOLD },
  drafting: { label: 'DRAFTING', color: M_DIM, dashed: true },
};

const StateTag = ({ state, compact }) => {
  const s = STATES[state];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      height: compact ? 16 : 18, padding: compact ? '0 5px' : '0 6px', borderRadius: 3,
      background: (state === 'resting' || s.dashed) ? 'rgba(255,255,255,0.04)' : `${s.color}1A`,
      border: s.dashed ? `1px dashed ${s.color}66` : `1px solid ${state === 'resting' ? M_BORDER_2 : `${s.color}55`}`,
    }}>
      {state === 'live' && <LiveDot size={4.5}/>}
      {state === 'recap' && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M5 12l5 5 9-11"/></svg>
      )}
      {state === 'resting' && <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: M_MUTED }}/>}
      {s.dashed && <span style={{ width: 5.5, height: 5.5, borderRadius: '50%', border: `1px dashed ${s.color}`, animation: 'drift 3.2s ease-in-out infinite' }}/>}
      <span style={{ fontFamily: OSWALD, fontSize: compact ? 8.5 : 9, fontWeight: 600, letterSpacing: '0.12em', color: s.color }}>{s.label}</span>
    </span>
  );
};

// thread context band — sits under the global header, carries mood + state + action
const MoodBand = ({ accent, mood, cause, state, action }) => {
  const m = MOODS[mood];
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
      padding: '9px 14px 11px', borderBottom: `1px solid ${M_BORDER}`,
      background: M_PANEL,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: '#0A0F17', border: `1px solid ${accent}55`,
        boxShadow: `0 0 14px ${m.color}33`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood={mood} accent={accent} size={40} ring={false}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MoodChip mood={mood} small/>
          <StateTag state={state} compact/>
        </div>
        <div style={{ fontSize: 11.5, color: m.color, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cause}</div>
      </div>
      {action && <Btn kind={state === 'live' ? 'ghost' : 'outline'} h={30}>{action}</Btn>}
    </div>
  );
};

// THE CORE MECHANIC — one bar, two homes: docked under a thread header, and slotted
// into a zoom under the speech bubble. Same component, same size, so live state reads
// identically in both. The floor needs no bar — the felt itself is the zero-tap view.
const LiveBar = ({ table, blinds, pot, equity, action, timer = 12, board, street,
                  hole, faceDown, note, strip }) => (
  <div style={{
    flexShrink: 0, background: M_PANEL_2,
    // as a zoom strip the wrapper owns the border, so don't draw a second one
    ...(strip ? {} : { borderBottom: `1px solid ${M_TEAL}3D` }),
    boxShadow: `inset 0 1px 0 ${M_TEAL}2E, 0 6px 14px rgba(0,0,0,0.35)`,
    cursor: 'pointer',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 0' }}>
      {faceDown
        ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: M_MUTED, flexShrink: 0 }}/>
        : <LiveDot size={5}/>}
      <Lbl size={9} color={faceDown ? M_MUTED : M_TEAL}>{faceDown ? 'Between hands' : 'Live'}</Lbl>
      <Num size={9.5} color={M_MUTED} weight={500}>#{table} · {blinds}{faceDown ? '' : ` · ${street}`}</Num>
      <div style={{ flex: 1 }}/>
      {!faceDown && <Num size={10} color={timer <= 5 ? M_RED : M_DIM} weight={600}>{timer}s</Num>}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6"/></svg>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 14px 9px' }}>
      {/* the agent's own hand — the first place faces are ever shown */}
      {hole && (
        <>
          <div style={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
            {hole.map((c, i) => (
              <div key={i} style={{ transform: `rotate(${i ? 4 : -4}deg)` }}>
                {faceDown
                  ? <CardBack w={21} h={29} branded/>
                  : <PlayingCard rank={c[0]} suit={c[1]} w={21} h={29}/>}
              </div>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
        </>
      )}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {board.map((c, i) => (
          c && !faceDown ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={19} h={26}/>
            : <CardBack key={i} w={19} h={26} branded/>
        ))}
      </div>
      {note ? (
        <>
          <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
          <div style={{ fontSize: 12, color: M_MUTED, fontStyle: 'italic', minWidth: 0 }}>{note}</div>
          <div style={{ flex: 1 }}/>
        </>
      ) : (
        <>
          <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
          <div style={{ minWidth: 0 }}>
            <Lbl size={8.5}>Pot</Lbl>
            <div><Num size={13} weight={700}>${pot}</Num></div>
          </div>
          <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
          <div style={{ minWidth: 0 }}>
            <Lbl size={8.5}>Equity</Lbl>
            <div><Num size={13} weight={700} color={M_TEAL}>{equity}%</Num></div>
          </div>
          <div style={{ flex: 1 }}/>
          <span style={{ padding: '4px 9px', borderRadius: 5, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap', flexShrink: 0 }}>{action}</span>
        </>
      )}
    </div>
  </div>
);

// ── CANON · screen #5's tokens. Every screen derives from these. ──
const CANON = {
  pad: 14,          // content side padding
  radius: 12,       // card radius
  border: M_BORDER, // card border
  name: 15,         // agent name, Playfair
  body: 13.5,       // message body
  sub: 12,          // secondary line
  meta: 9.5,        // mono meta
  label: 9.5,       // section label
};

// screen chrome bits reused across chat screens
const ChatComposer = ({ placeholder = 'Message your agent…', chips, suggest, suggestLead }) => (
  <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '10px 14px 22px' }}>
    {suggest && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9, overflow: 'hidden' }}>
        {suggestLead && (
          <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, paddingRight: 2 }}>{suggestLead}</span>
        )}
        {suggest.map((c, i) => (
          <span key={i} style={{ flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 13, background: M_PANEL_2, border: `1px solid ${i === 0 ? `${M_TEAL}55` : M_BORDER}`, display: 'inline-flex', alignItems: 'center', fontSize: 11.5, color: i === 0 ? M_TEAL : M_DIM, whiteSpace: 'nowrap' }}>{c}</span>
        ))}
      </div>
    )}
    {chips && (
      <div style={{ display: 'flex', gap: 6, marginBottom: 9, overflow: 'hidden' }}>
        {chips.map((c, i) => (
          <span key={i} style={{ flexShrink: 0, height: 24, padding: '0 9px', borderRadius: 5, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 10, fontWeight: 600, color: M_TEAL }}>
            {c.cmd}<span style={{ fontFamily: INTER, fontSize: 10, fontWeight: 400, color: M_MUTED }}>{c.desc}</span>
          </span>
        ))}
      </div>
    )}
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 6px 0 14px', borderRadius: 22, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
      <span style={{ flex: 1, fontSize: 13.5, color: M_MUTED }}>{placeholder}</span>
      <button style={{ width: 32, height: 32, borderRadius: '50%', background: M_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 10px ${M_TEAL}55` }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </div>
  </div>
);

const DayDivider = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', marginBottom: 14 }}>
    <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
    <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, letterSpacing: '0.14em' }}>{children}</span>
    <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
  </div>
);

const BackHeader = ({ children, right }) => (
  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px 12px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M15 18l-6-6 6-6"/></svg>
    {children}
    {right}
  </div>
);

Object.assign(window, {
  FACE_TIERS, faceTier, faceDetail, FACE_EVENTS, ghostFace,
  HAND_FILL, HAND_LINE, HAND_BOX, handW, handScale, handStroke, Fist, Hand,
  MiniBack, HERO_GRIP, SEAT_GRIP, HAND_POSES, OPP_POSES, ghostHands,
  BROW_TRIGGERS, ghostBrow,
  M_BG, M_PANEL, M_PANEL_2, M_SURF, M_BORDER, M_BORDER_2, M_TEXT, M_DIM, M_MUTED, M_FAINT,
  M_TEAL, M_GOLD, M_RED, M_PURPLE, M_PINK, M_NEUTRAL, PLAYFAIR, ROZHA, OSWALD, MONO, INTER,
  MOODS, MoodGhost, MoodPip, MoodAvatar, MoodChip,
  Lbl, Num, Amt, LiveDot, Btn, PhoneShell, TabBar, ChatComposer, DayDivider, BackHeader,
  GlobalHeader, SpadeLogo, STATES, StateTag, MoodBand, LiveBar, CANON,
});
