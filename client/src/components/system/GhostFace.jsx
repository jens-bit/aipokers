// THE FACES — port of design-refs/mood-atoms.jsx `ghostFace` / `ghostBrow`.
//
// One face per state was never enough. MOOD-2 gives every state a heat 0–100, so
// the answer is INTENSITY, not more states: five states × three tiers = fifteen
// faces. The silhouette NEVER changes; only eyes, brows and the glow do.
//
// DETAIL BY SIZE, subtractive, in this order:
//   3 · floor 46+   everything — brows, lids, asymmetry, vents
//   2 · band 38     brows and lids, no asymmetry or vents
//   1 · seat 34     brows collapse to one stroke each; lids drop
//   0 · thread 24   EYES AND GLOW ONLY — the eye shape carries the mood alone

export function faceTier(h) { return h <= 33 ? 'low' : h <= 66 ? 'mid' : 'high'; }
export function faceDetail(size) { return size >= 42 ? 3 : size >= 36 ? 2 : size >= 30 ? 1 : 0; }

// Six transient expressions, 2–6s, drawn OVER the state and never stored.
export const FACE_EVENTS = ['stunned', 'smug', 'locked', 'bored', 'wary', 'pleased'];

// Three momentary brow overrides, drawn on top and gone within a second.
export function ghostBrow({ brow, eye, cy }) {
  if (brow === 'twitch') return (
    <g>
      <path d={`M30.2 ${cy - 7.6} L37 ${cy - 7.6}`} stroke={eye} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d={`M49.8 ${cy - 10.2} L43 ${cy - 8.6}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
  if (brow === 'lift') return (
    <g>
      <path d={`M30.2 ${cy - 10} L37 ${cy - 10}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round" />
      <path d={`M49.8 ${cy - 10} L43 ${cy - 10}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
  if (brow === 'knit') return (
    <g>
      <path d={`M30.6 ${cy - 8.2} L37.4 ${cy - 5.6}`} stroke={eye} strokeWidth="1.6" strokeLinecap="round" />
      <path d={`M49.4 ${cy - 8.2} L42.6 ${cy - 5.6}`} stroke={eye} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
  return null;
}

export function ghostFace({ mood, heat = 45, size = 40, event, eye, cy }) {
  const d = faceDetail(size);
  const t = faceTier(heat);
  const L = 33.5, R = 46.5;   // eye centres

  // An event replaces the eyes wholesale — it is the loudest thing the face does.
  if (event && FACE_EVENTS.indexOf(event) >= 0) {
    const ev = {
      // wide and round, brows high AND inner-raised: the one face where a worried
      // brow is correct, which is why it must not be the confident one
      stunned: (
        <g data-event="stunned">
          <circle cx={L} cy={cy} r="3.4" fill={eye} />
          <circle cx={R} cy={cy} r="3.4" fill={eye} />
          {d > 0 && <><path d={`M29.5 ${cy - 8} L37 ${cy - 10}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round" />
            <path d={`M50.5 ${cy - 8} L43 ${cy - 10}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round" /></>}
        </g>
      ),
      // narrowed to arcs that turn UP at the outer edge — a grin done with eyes
      smug: (
        <g data-event="smug">
          <path d={`M30 ${cy + 1} Q${L} ${cy - 3.4} 37 ${cy + 1}`} stroke={eye} strokeWidth="2.1" fill="none" strokeLinecap="round" />
          <path d={`M43 ${cy + 1} Q${R} ${cy - 3.4} 50 ${cy + 1}`} stroke={eye} strokeWidth="2.1" fill="none" strokeLinecap="round" />
          {d > 1 && <path d={`M43.4 ${cy - 7.4} L50.6 ${cy - 6.2}`} stroke={eye} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />}
        </g>
      ),
      // level, tight, absolutely symmetrical: nothing left to decide
      locked: (
        <g data-event="locked">
          <rect x={L - 3.6} y={cy - 1} width="7.2" height="2" rx="1" fill={eye} />
          <rect x={R - 3.6} y={cy - 1} width="7.2" height="2" rx="1" fill={eye} />
          {d > 0 && <><path d={`M29.8 ${cy - 6} L37.2 ${cy - 6}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round" />
            <path d={`M50.2 ${cy - 6} L42.8 ${cy - 6}`} stroke={eye} strokeWidth="1.3" strokeLinecap="round" /></>}
        </g>
      ),
      // half-lidded and looking down: the only face that breaks eye contact
      bored: (
        <g data-event="bored">
          <ellipse cx={L} cy={cy + 1.4} rx="2.8" ry="1.5" fill={eye} />
          <ellipse cx={R} cy={cy + 1.4} rx="2.8" ry="1.5" fill={eye} />
          {d > 1 && <><rect x={L - 3.4} y={cy - 2.4} width="6.8" height="1.5" rx="0.7" fill={eye} opacity="0.5" />
            <rect x={R - 3.4} y={cy - 2.4} width="6.8" height="1.5" rx="0.7" fill={eye} opacity="0.5" /></>}
        </g>
      ),
      // both eyes shifted the same way: he is watching one person, not the table
      wary: (
        <g data-event="wary">
          <ellipse cx={L + 1.6} cy={cy} rx="2.2" ry="2" fill={eye} />
          <ellipse cx={R + 1.6} cy={cy} rx="2.2" ry="2" fill={eye} />
          {d > 0 && <><path d={`M30 ${cy - 5.6} L37 ${cy - 6.8}`} stroke={eye} strokeWidth="1.2" strokeLinecap="round" />
            <path d={`M50.4 ${cy - 6.8} L43.4 ${cy - 5.6}`} stroke={eye} strokeWidth="1.2" strokeLinecap="round" /></>}
        </g>
      ),
      // closed, curving up: the only genuinely warm face in the set
      pleased: (
        <g data-event="pleased">
          <path d={`M30 ${cy + 1.6} Q${L} ${cy - 3} 37 ${cy + 1.6}`} stroke={eye} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d={`M43 ${cy + 1.6} Q${R} ${cy - 3} 50 ${cy + 1.6}`} stroke={eye} strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      ),
    };
    return ev[event];
  }

  if (mood === 'confident') {
    // The brow drops toward the INNER corner and lifts at the outer. Assurance is
    // the ABSENCE of brow drama, so the calm tier has none at all.
    const narrow = t === 'low' ? 0 : t === 'mid' ? 0.55 : 1;
    return (
      <g data-face="confident" data-tier={t}>
        {narrow < 1 ? (
          <>
            <ellipse cx={L} cy={cy - 1} rx="3" ry={2.6 - narrow * 0.9} fill={eye} />
            <ellipse cx={R} cy={cy - 1} rx="3" ry={2.6 - narrow * 0.9} fill={eye} />
          </>
        ) : (
          <>
            <path d={`M30.2 ${cy - 2.6} Q${L} ${cy + 1.4} 36.8 ${cy - 2.6}`} stroke={eye} strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d={`M43.2 ${cy - 2.6} Q${R} ${cy + 1.4} 49.8 ${cy - 2.6}`} stroke={eye} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </>
        )}
        {d > 0 && narrow > 0 && (
          <>
            <path d={`M30.2 ${cy - 7.6} L37 ${cy - 7.6}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity={0.4 + narrow * 0.3} />
            <path d={`M49.8 ${cy - 7.6 - (narrow === 1 ? 1.8 : 0)} L43 ${cy - 7.6}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity={0.4 + narrow * 0.3} />
          </>
        )}
      </g>
    );
  }

  if (mood === 'neutral') {
    const r = t === 'low' ? 1.5 : t === 'mid' ? 1.8 : 2.3;
    return (
      <g data-face="neutral" data-tier={t}>
        <ellipse cx="34" cy={cy} rx={2.5} ry={r} fill={eye} />
        <ellipse cx="46" cy={cy} rx={2.5} ry={r} fill={eye} />
        {d > 0 && t === 'high' && (
          <>
            <path d={`M30.4 ${cy - 6.6} L37.6 ${cy - 6.6}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
            <path d={`M49.6 ${cy - 6.6} L42.4 ${cy - 6.6}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
          </>
        )}
      </g>
    );
  }

  if (mood === 'frustrated') {
    const a = t === 'low' ? 9 : t === 'mid' ? 14 : 19;
    const w = t === 'high' ? 6.9 : 6.4;
    return (
      <g data-face="frustrated" data-tier={t}>
        <g transform={`rotate(${-a} ${L} ${cy})`}><rect x={L - w / 2} y={cy - 1.1} width={w} height="2.2" rx="1.1" fill={eye} /></g>
        <g transform={`rotate(${a} ${R} ${cy})`}><rect x={R - w / 2} y={cy - 1.1} width={w} height="2.2" rx="1.1" fill={eye} /></g>
        {d > 0 && t !== 'low' && (
          <>
            <path d={`M29.8 ${cy - 6.8} L37.4 ${cy - 4.6}`} stroke={eye} strokeWidth={t === 'high' ? 1.5 : 1.2} strokeLinecap="round" />
            <path d={`M50.2 ${cy - 6.8} L42.6 ${cy - 4.6}`} stroke={eye} strokeWidth={t === 'high' ? 1.5 : 1.2} strokeLinecap="round" />
          </>
        )}
      </g>
    );
  }

  if (mood === 'tilted') {
    // steaming → red-eyed. The eye COLOUR shifts at the top tier, the only place
    // in the whole system where a mood overrides its own token.
    const hot = t === 'high';
    const ec = hot ? '#FF6B6D' : eye;
    const a = t === 'low' ? 16 : t === 'mid' ? 24 : 30;
    return (
      <g data-face="tilted" data-tier={t}>
        <g transform={`rotate(${-a} ${L} ${cy})`}><rect x={L - 3.4} y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={ec} /></g>
        <g transform={`rotate(${a} ${R} ${cy})`}><rect x={R - 3.4} y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={ec} /></g>
        {d > 0 && (
          <>
            <path d={`M29.4 ${cy - 7} L37.6 ${cy - 4}`} stroke={ec} strokeWidth={hot ? 1.7 : 1.4} strokeLinecap="round" />
            <path d={`M50.6 ${cy - 7} L42.4 ${cy - 4}`} stroke={ec} strokeWidth={hot ? 1.7 : 1.4} strokeLinecap="round" />
          </>
        )}
        {d > 2 && hot && (
          <>
            <path d={`M26 ${cy - 12} q2.4 -2.6 0 -5.2`} stroke={ec} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.5" />
            <path d={`M54 ${cy - 12} q-2.4 -2.6 0 -5.2`} stroke={ec} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.5" />
          </>
        )}
      </g>
    );
  }

  // sulking — the lid comes down as heat rises, which reads as shutting you out
  const lid = t === 'low' ? 0 : t === 'mid' ? 1 : 1.9;
  return (
    <g data-face="sulking" data-tier={t}>
      <ellipse cx={L} cy={cy + 2.5} rx="2.2" ry={Math.max(0.7, 1.3 - lid * 0.3)} fill={eye} />
      <ellipse cx={R} cy={cy + 2.5} rx="2.2" ry={Math.max(0.7, 1.3 - lid * 0.3)} fill={eye} />
      {d > 1 && (
        <>
          <path d={`M30.6 ${cy - 0.6 + lid} A3 3 0 0 1 36.4 ${cy - 0.6 + lid}`} stroke={eye} strokeWidth="1" fill="none" opacity={0.55 + lid * 0.2} />
          <path d={`M43.6 ${cy - 0.6 + lid} A3 3 0 0 1 49.4 ${cy - 0.6 + lid}`} stroke={eye} strokeWidth="1" fill="none" opacity={0.55 + lid * 0.2} />
        </>
      )}
    </g>
  );
}
