// THE CASINO FLOOR — the camera never moves. The ROOM redresses itself
// by how many agents are playing. Zone geometry is data; ghost, chip and
// ticker anatomy is identical in every state.

const FLOOR_W = 390, FLOOR_H = 650;

// ── posture vocabulary: how each mood holds itself in the room ──
const POSTURE = {
  confident:  { lift: -7, tilt: -2, aura: 0.30, scale: 1.05, shimmer: false, note: 'floats taller, hood square, eyes up' },
  neutral:    { lift: 0,  tilt: 0,  aura: 0.12, scale: 1.00, shimmer: false, note: 'level drift, no aura' },
  frustrated: { lift: 2,  tilt: 3,  aura: 0.18, scale: 0.99, shimmer: false, note: 'leans in, hood tipped forward' },
  tilted:     { lift: 3,  tilt: 6,  aura: 0.32, scale: 0.98, shimmer: true,  note: 'hunched, red shimmer, faster bob' },
  sulking:    { lift: 8,  tilt: -7, aura: 0.06, scale: 0.93, shimmer: false, note: 'sits lowest, turned away, hood slumped' },
};

// ── the four density states. Only geometry and occupancy change. ──
// Moods are invariant per agent — mood belongs to the agent, state to the moment.
const LAYOUTS = {
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
  // three playing, one resting — a 2×2 grid, not a diamond: every lit felt has to be
  // big enough to carry its own diorama, and four diamond points cannot be.
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
    // the same 2×2 grid, all four lit — never more than four felts
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

// ── the floating ghost. Eye geometry is identical to MoodGhost. ──
const FloorGhost = ({ mood, accent, size = 56, speed = 5 }) => {
  const uid = React.useId().replace(/:/g, '');
  const m = MOODS[mood];
  const p = POSTURE[mood];
  const eye = mood === 'neutral' ? accent : m.color;
  const slump = mood === 'sulking';
  const cy = slump ? 46 : 42;

  const eyes = () => {
    if (mood === 'confident') return (
      <g>
        <ellipse cx="33.5" cy={cy - 2} rx="3" ry="2.4" fill={eye}/>
        <ellipse cx="46.5" cy={cy - 2} rx="3" ry="2.4" fill={eye}/>
        <path d={`M30 ${cy - 7} L37 ${cy - 8.5}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.75"/>
        <path d={`M50 ${cy - 7} L43 ${cy - 8.5}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.75"/>
      </g>
    );
    if (mood === 'frustrated') return (
      <g>
        <g transform={`rotate(-14 33.5 ${cy})`}><rect x="30.4" y={cy - 1.1} width="6.4" height="2.2" rx="1.1" fill={eye}/></g>
        <g transform={`rotate(14 46.5 ${cy})`}><rect x="43.4" y={cy - 1.1} width="6.4" height="2.2" rx="1.1" fill={eye}/></g>
      </g>
    );
    if (mood === 'tilted') return (
      <g>
        <g transform={`rotate(-24 33.5 ${cy})`}><rect x="30.2" y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={eye}/></g>
        <g transform={`rotate(24 46.5 ${cy})`}><rect x="43.2" y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={eye}/></g>
        <path d={`M29.5 ${cy - 6.5} L37.5 ${cy - 4}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round"/>
        <path d={`M50.5 ${cy - 6.5} L42.5 ${cy - 4}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round"/>
      </g>
    );
    if (mood === 'sulking') return (
      <g>
        <ellipse cx="33.5" cy={cy + 2.5} rx="2.2" ry="1.3" fill={eye}/>
        <ellipse cx="46.5" cy={cy + 2.5} rx="2.2" ry="1.3" fill={eye}/>
        <path d={`M30.6 ${cy - 0.6} A3 3 0 0 1 36.4 ${cy - 0.6}`} stroke={eye} strokeWidth="1" fill="none" opacity="0.55"/>
        <path d={`M43.6 ${cy - 0.6} A3 3 0 0 1 49.4 ${cy - 0.6}`} stroke={eye} strokeWidth="1" fill="none" opacity="0.55"/>
      </g>
    );
    return (
      <g>
        <ellipse cx="34" cy={cy} rx="2.5" ry="1.7" fill={eye}/>
        <ellipse cx="46" cy={cy} rx="2.5" ry="1.7" fill={eye}/>
      </g>
    );
  };

  // no legs — the body tapers into a scalloped wisp
  const body = slump
    ? 'M40 18 C27 18 20 31 20 47 L20 80 Q25 88 30 82 Q35 76 40 82 Q45 88 50 82 Q55 76 60 82 L60 47 C60 31 53 18 40 18 Z'
    : 'M40 10 C26 10 18 24 18 42 L18 78 Q23 87 28 81 Q33 75 39 81 Q45 87 50 81 Q55 75 60 81 L60 42 C60 24 54 10 40 10 Z';

  return (
    <div style={{
      width: size, height: size * 1.2, position: 'relative',
      transform: `translateY(${p.lift}px) rotate(${p.tilt}deg) scale(${p.scale})`,
      animation: `bob ${speed}s ease-in-out infinite`,
    }}>
      <svg width={size} height={size * 1.2} viewBox="0 0 80 96" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <radialGradient id={`fa${uid}`} cx="50%" cy="50%" r="55%">
            <stop offset="0" stopColor={m.color} stopOpacity={p.aura}/>
            <stop offset="1" stopColor={m.color} stopOpacity="0"/>
          </radialGradient>
          <linearGradient id={`fb${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#182030"/>
            <stop offset="0.7" stopColor="#0B1018"/>
            <stop offset="1" stopColor="#0B1018" stopOpacity="0.55"/>
          </linearGradient>
        </defs>
        <ellipse cx="40" cy="46" rx="46" ry="44" fill={`url(#fa${uid})`}/>
        {p.shimmer && (
          <ellipse cx="40" cy="46" rx="36" ry="40" fill="none" stroke={M_RED} strokeWidth="1"
            opacity="0.35" style={{ animation: 'shimmer 1.6s ease-in-out infinite' }}/>
        )}
        <path d={body} fill={`url(#fb${uid})`} stroke={`${accent}55`} strokeWidth="1.1"/>
        <ellipse cx="40" cy={cy} rx="13.5" ry="16.5" fill="#04070C"/>
        {eyes()}
      </svg>
    </div>
  );
};

const GhostChip = ({ name, accent, state }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 19, padding: '0 8px', borderRadius: 10,
    background: 'rgba(14,17,18,0.82)', border: `1px solid ${accent}44`,
    whiteSpace: 'nowrap',
  }}>
    {state === 'live' && <LiveDot size={5}/>}
    {state === 'recap' && (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11"/></svg>
    )}
    <span style={{ fontSize: 10, color: M_TEXT, fontWeight: 500 }}>{name}</span>
  </div>
);

const Occupant = ({ x, y, name, accent, mood, state, size = 56, speed = 5, drink, dim }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', opacity: dim ? 0.5 : 1, zIndex: 3 }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <GhostChip name={name} accent={accent} state={state}/>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
        <FloorGhost mood={mood} accent={accent} size={size} speed={speed}/>
        {drink && (
          <svg width="13" height="20" viewBox="0 0 13 20" style={{ display: 'block', marginBottom: 6 }}>
            <path d="M2 3 L11 3 L8.4 11 L4.6 11 Z" fill={`${M_GOLD}44`} stroke={`${M_GOLD}88`} strokeWidth="0.8"/>
            <path d="M6.5 11 L6.5 17" stroke={`${M_GOLD}88`} strokeWidth="0.8"/>
            <path d="M3.4 17.6 L9.6 17.6" stroke={`${M_GOLD}88`} strokeWidth="0.8"/>
          </svg>
        )}
      </div>
      <div style={{
        width: size * 1.1, height: 12, borderRadius: '50%', marginTop: -4,
        background: `radial-gradient(ellipse, ${MOODS[mood].color}${state === 'resting' ? '1A' : '2E'}, transparent 70%)`,
      }}/>
    </div>
  </div>
);

// identical anatomy at both scales — only the type steps down
const PotTicker = ({ x, y, amount, mini }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', zIndex: 4 }}>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: mini ? 5 : 7,
      height: mini ? 18 : 22, padding: mini ? '0 8px' : '0 10px', borderRadius: 11,
      background: 'rgba(14,17,18,0.82)', border: `1px solid ${M_TEAL}44`,
      boxShadow: `0 0 12px ${M_TEAL}22`,
    }}>
      <Lbl size={mini ? 7.5 : 8}>Pot</Lbl>
      <Num size={mini ? 10.5 : 12} weight={700} color={M_TEAL}>${amount}</Num>
    </div>
  </div>
);

// ── the architecture, drawn from a layout ──
const RoomLayer = ({ layout, ftu, viewBox, W = FLOOR_W, H = FLOOR_H, table }) => {
  const T = table || LAYOUTS;
  const L = T[layout] || T.one;
  const o = ftu ? 0.4 : (L.dimRoom ? 0.62 : 1);
  return (
    <svg width={W} height={H} viewBox={viewBox || `0 0 ${W} ${H}`}
      preserveAspectRatio={viewBox ? 'xMidYMid slice' : 'none'}
      style={{ position: 'absolute', inset: 0, display: 'block' }}>
      <defs>
        <radialGradient id={`feltG${layout}`} cx="50%" cy="42%" r="62%">
          <stop offset="0" stopColor="#2f5a50"/>
          <stop offset="0.65" stopColor="#1d362e"/>
          <stop offset="1" stopColor="#152822"/>
        </radialGradient>
        <radialGradient id={`feltD${layout}`} cx="50%" cy="42%" r="62%">
          <stop offset="0" stopColor="#213a32"/>
          <stop offset="1" stopColor="#16241f"/>
        </radialGradient>
        <radialGradient id={`poolG${layout}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={M_TEAL} stopOpacity="0.26"/>
          <stop offset="1" stopColor={M_TEAL} stopOpacity="0"/>
        </radialGradient>
        <radialGradient id={`cornerG${layout}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#2a2233" stopOpacity="0.85"/>
          <stop offset="1" stopColor="#1A1A1E" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={`barG${layout}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#302c27"/>
          <stop offset="1" stopColor="#1a1815"/>
        </linearGradient>
      </defs>

      {/* a light pool per lit felt — the room's lighting follows occupancy */}
      {L.felts.filter(f => f.lit).map((f, i) => (
        <ellipse key={`p${i}`} cx={f.cx} cy={f.cy} rx={f.rx * 1.65} ry={f.ry * 2.5} fill={`url(#poolG${layout})`} opacity={o}/>
      ))}
      {!L.bar.sliver && (
        <ellipse cx={(L.bar.x1 + L.bar.x2) / 2} cy={L.bar.y - 30} rx={(L.bar.x2 - L.bar.x1) * 0.62} ry="92"
          fill={`url(#poolG${layout})`} opacity={o * (L.dimRoom ? 0.9 : 0.6)}/>
      )}

      {/* lounge corner — dimmer than the room */}
      {L.corner && (
        <>
          <ellipse cx={L.corner.cx} cy={L.corner.cy} rx={L.corner.rx + 40} ry={L.corner.ry + 34} fill={`url(#cornerG${layout})`}/>
          <ellipse cx={L.corner.cx} cy={L.corner.cy + 42} rx="44" ry="16" fill="#0e1216" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          <ellipse cx={L.corner.cx} cy={L.corner.cy + 40} rx="44" ry="16" fill="#12161b"/>
        </>
      )}

      {/* felts */}
      {L.felts.map((f, i) => (
        <g key={`f${i}`} opacity={o}>
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx + (f.lit ? 9 : 7)} ry={f.ry + (f.lit ? 9 : 7)} fill="#241d15"/>
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry}
            fill={f.lit ? `url(#feltG${layout})` : `url(#feltD${layout})`}
            stroke={f.lit ? `${M_TEAL}2E` : `${M_TEAL}14`} strokeWidth={f.lit ? 1.2 : 1}/>
          {f.lit && (
            <ellipse cx={f.cx} cy={f.cy} rx={f.rx - 13} ry={f.ry - 11} fill="none" stroke={`${M_TEAL}14`} strokeWidth="0.8"/>
          )}
        </g>
      ))}

      {/* bar counter */}
      {(() => {
        const b = L.bar, mid = (b.x1 + b.x2) / 2;
        const rise = b.sliver ? 8 : 22, depth = b.sliver ? 16 : 26;
        return (
          <g opacity={o}>
            <path d={`M${b.x1} ${b.y} Q${mid} ${b.y - rise} ${b.x2} ${b.y} L${b.x2} ${b.y + depth} Q${mid} ${b.y + depth - rise + 4} ${b.x1} ${b.y + depth} Z`}
              fill={`url(#barG${layout})`} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
            <path d={`M${b.x1} ${b.y} Q${mid} ${b.y - rise} ${b.x2} ${b.y}`}
              fill="none" stroke={`${M_TEAL}3D`} strokeWidth="1.2"/>
            {!b.sliver && [0, 1, 2, 3, 4].map(i => (
              <rect key={i} x={b.x1 + 22 + i * ((b.x2 - b.x1 - 50) / 4)} y={b.y - 52} width="7" height="22" rx="2.5"
                fill={i % 2 ? `${M_GOLD}26` : `${M_TEAL}26`} opacity="0.8"/>
            ))}
          </g>
        );
      })()}
    </svg>
  );
};

const FloorStandup = ({ line, net, flagged }) => (
  <div style={{
    position: 'absolute', top: 10, left: 12, right: 12, zIndex: 6,
    height: 34, padding: '0 12px', borderRadius: 10,
    background: 'rgba(8,10,11,0.86)', border: `1px solid ${M_BORDER}`,
    display: 'flex', alignItems: 'center', gap: 9,
  }}>
    <Lbl size={9}>Standup</Lbl>
    {line
      ? <span style={{ fontSize: 11.5, color: M_DIM }}>{line}</span>
      : (
        <>
          <Num size={12} weight={700} color={M_TEAL}>{net}</Num>
          <span style={{ color: M_FAINT, fontFamily: MONO, fontSize: 10 }}>·</span>
          <span style={{ fontSize: 11.5, color: M_GOLD }}>{flagged}</span>
        </>
      )}
    <div style={{ flex: 1 }}/>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
  </div>
);

// ═══ THE DIORAMA ═══
// A felt where one of the USER'S OWN agents is playing renders as a living
// mini-diorama: board on the felt centre, his two hole cards face up and fanned in
// front of his seated ghost, pot above the far rail. Another user's agent always
// shows backs. The floor is WATCHING the game, not driving it — hands advance
// server-side whether or not anyone is looking.
//
// LEGIBILITY IS THE GATE. PlayingCard locks rank size to w * 0.42, so a legible rank
// needs w >= 20. Whether a felt can pay for that depends on its ry and on how much of
// the centre the community board takes. Every lit felt is tested independently: it
// earns a diorama or it degrades to glow + pot. Cards are never shrunk below reading
// size, so no felt ever gets an unreadable diorama.
const MIN_HOLE_W = 20;
const DIORAMA_MIN_RY = 47;   // what MIN_HOLE_W works out to on mobile, at board w 17

// one geometry function, both platforms - card size scales with the felt
const dioramaMetrics = (f, bw = 17, maxH = 32) => {
  const gap = 3, rim = 2, rot = 2;
  const avail = f.ry - rim - bw * 0.7 - gap;
  const hh = Math.min(maxH, Math.round(avail - rot));
  const hw = Math.round(hh / 1.39);
  return { bw, gap, rim, hh, hw, fits: hw >= MIN_HOLE_W };
};

const Diorama = ({ f, hole, own = true, bw = 17, maxH = 32, glow = 6 }) => {
  const m = dioramaMetrics(f, bw, maxH);
  if (!m.fits) return null;
  return (
    <>
      {/* the community board, on the felt centre - deliberately subordinate */}
      <div style={{ position: 'absolute', left: f.cx, top: f.cy - bw * 0.7, transform: 'translateX(-50%)', display: 'flex', gap: bw > 20 ? 5 : 3, zIndex: 2 }}>
        {[['K','c'],['9','c'],['4','c'],['2','c']].map((c, i) => (
          <div key={i} style={{ filter: `drop-shadow(0 0 ${glow}px ${M_TEAL}55)` }}>
            <PlayingCard rank={c[0]} suit={c[1]} w={bw} h={Math.round(bw * 1.4)}/>
          </div>
        ))}
      </div>
      {/* his own hand, fanned in front of the seated ghost at the far rail */}
      <div style={{ position: 'absolute', left: f.cx, top: f.cy - f.ry + m.rim, transform: 'translateX(-50%)', display: 'flex', gap: 1, zIndex: 4 }}>
        {[0, 1].map(i => (
          <div key={i} style={{ transform: `rotate(${i ? 4 : -4}deg)`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}>
            {own
              ? <PlayingCard rank={hole[i][0]} suit={hole[i][1]} w={m.hw} h={m.hh}/>
              : <CardBack w={m.hw} h={m.hh} branded/>}
          </div>
        ))}
      </div>
    </>
  );
};

// ═══ the floor, in a given density state ═══
const FloorScreen = ({ layout, standup, seats, bar, lounge, ghostSize = 56, mini }) => {
  const L = LAYOUTS[layout];
  return (
    <PhoneShell>
      <GlobalHeader/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <RoomLayer layout={layout}/>
        <FloorStandup {...standup}/>

        {/* seated agents, one per lit felt */}
        {L.felts.filter(f => f.lit).map((f, i) => {
          const s = seats[f.seat];
          if (!s) return null;
          const gh = (ghostSize * 1.2) + 19 + 3;
          return (
            <React.Fragment key={`s${i}`}>
              <Diorama f={f} hole={s.hole} own={s.own !== false}/>
              <Occupant x={f.cx} y={f.cy - gh + 8} name={s.name} accent={s.accent} mood={s.mood}
                state="live" size={ghostSize} speed={s.speed}/>
              {/* a diorama stacks its pot above the ghost name chip, above the far rail and
                  on the centre axis so it cannot foul a chip at any name width.
                  A degraded felt keeps the plain ticker below the near rail. */}
              {dioramaMetrics(f).fits
                ? <PotTicker x={f.cx} y={f.cy - gh + 8 - 27} amount={s.pot}/>
                : <PotTicker x={f.cx} y={f.cy + f.ry + 8} amount={s.pot} mini={mini}/>}
            </React.Fragment>
          );
        })}

        {/* the bar */}
        {bar && bar.map((a, i) => (
          <Occupant key={`b${i}`} x={a.x} y={L.bar.y - 102} name={a.name} accent={a.accent} mood={a.mood}
            state={a.state} size={a.size || 50} speed={a.speed} drink/>
        ))}

        {/* the lounge corner */}
        {lounge && L.corner && (
          <Occupant x={L.corner.cx} y={L.corner.cy - 62} name={lounge.name} accent={lounge.accent}
            mood={lounge.mood} state={lounge.state} size={lounge.size || 52} speed={lounge.speed} dim/>
        )}
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// the cast — moods stay with the agent across every state
const CAST = {
  balanced:   { name: 'Balanced v2.1', accent: M_TEAL,   mood: 'confident', speed: 4.6, hole: [['A','s'],['K','h']] },
  aggressive: { name: 'Aggressive v1.3', accent: M_PURPLE, mood: 'tilted',  speed: 3.4, hole: [['Q','s'],['Q','d']] },
  bluff:      { name: 'Bluff Master', accent: M_GOLD,   mood: 'confident', speed: 5.6, hole: [['J','c'],['T','c']] },
  value:      { name: 'Value Bot',    accent: M_PINK,   mood: 'sulking',   speed: 7,   hole: [['9','h'],['8','h']] },
};

// ═══ 1 · QUIET NIGHT — nobody playing ═══
const FloorQuietScreenM = () => (
  <FloorScreen layout="quiet"
    standup={{ line: "Everyone's resting." }}
    seats={{}}
    bar={[
      { ...CAST.balanced, x: 74, state: 'resting', size: 48 },
      { ...CAST.bluff, x: 158, state: 'recap', size: 48 },
      { ...CAST.value, x: 242, state: 'resting', size: 46 },
    ]}
    lounge={{ ...CAST.aggressive, state: 'resting', size: 50 }}/>
);

// ═══ 2 · ONE GAME — the hero felt ═══
const FloorOneScreenM = () => (
  <FloorScreen layout="one"
    standup={{ net: '+$340', flagged: '4 flagged' }}
    seats={{ 0: { ...CAST.balanced, pot: '480' } }}
    bar={[
      { ...CAST.bluff, x: 86, state: 'recap', size: 50 },
      { ...CAST.value, x: 172, state: 'resting', size: 46 },
    ]}
    lounge={{ ...CAST.aggressive, state: 'resting', size: 52 }}/>
);

// ═══ 3 · TWO GAMES — both felts lit ═══
const FloorTwoScreenM = () => (
  <FloorScreen layout="two"
    standup={{ net: '+$460', flagged: '4 flagged' }}
    seats={{
      0: { ...CAST.balanced, pot: '480' },
      1: { ...CAST.aggressive, pot: '120' },
    }}
    bar={[{ ...CAST.bluff, x: 78, state: 'recap', size: 48 }]}
    lounge={{ ...CAST.value, state: 'resting', size: 48 }}
    ghostSize={50}/>
);

// ═══ 4 · THREE PLAYING, ONE RESTING — the 2×2 grid with one felt dark ═══
const FloorThreeScreenM = () => (
  <FloorScreen layout="three" mini ghostSize={46}
    standup={{ net: '+$740', flagged: '5 flagged' }}
    seats={{
      0: { ...CAST.balanced, pot: '480' },
      1: { ...CAST.aggressive, pot: '120' },
      2: { ...CAST.bluff, pot: '260' },
    }}
    bar={[{ ...CAST.value, x: 195, state: 'resting', size: 44 }]}/>
);

// ═══ 5 · FULL HOUSE — the stress test ═══
const FloorFullScreenM = () => (
  <FloorScreen layout="full" mini ghostSize={46}
    standup={{ net: '+$980', flagged: '6 flagged' }}
    seats={{
      0: { ...CAST.balanced, pot: '480' },
      1: { ...CAST.aggressive, pot: '120' },
      2: { ...CAST.bluff, pot: '260' },
      3: { ...CAST.value, pot: '90' },
    }}/>
);

// ═══ ZOOM ═══
const ZoomView = ({ name, accent, mood, line, cause, state, primary, pot, strip, extra }) => {
  const m = MOODS[mood];
  return (
    <PhoneShell>
      <GlobalHeader back title={name}/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        {/* the same room, zoomed via the SVG viewBox — no CSS transform, so
            nothing contributes to a scrollable overflow region */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
          <RoomLayer layout="two" viewBox="88 44 186 310"/>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 42%, rgba(26,26,30,0) 0%, rgba(26,26,30,0.68) 62%, rgba(26,26,30,0.92) 100%)' }}/>

        {pot && <PotTicker x={195} y={18} amount={pot}/>}

        <div style={{ position: 'absolute', left: 20, right: 20, top: pot ? 58 : 30, zIndex: 5 }}>
          <div style={{
            background: 'rgba(21,23,26,0.92)', border: `1px solid ${m.color}66`,
            borderRadius: 14, padding: '14px 16px',
            boxShadow: `0 0 22px ${m.color}22`, position: 'relative',
          }}>
            <div style={{ fontSize: 15, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic' }}>“{line}”</div>
            <div style={{
              position: 'absolute', bottom: -7, left: '50%', marginLeft: -7,
              width: 12, height: 12, background: 'rgba(21,23,26,0.92)',
              borderRight: `1px solid ${m.color}66`, borderBottom: `1px solid ${m.color}66`,
              transform: 'rotate(45deg)',
            }}/>
          </div>
        </div>

        <div style={{ position: 'absolute', left: '50%', top: pot ? 178 : 152, transform: 'translateX(-50%)', zIndex: 4 }}>
          <FloorGhost mood={mood} accent={accent} size={132} speed={5}/>
        </div>
        <div style={{
          position: 'absolute', left: '50%', top: pot ? 356 : 330, transform: 'translateX(-50%)',
          width: 190, height: 26, borderRadius: '50%', zIndex: 3,
          background: `radial-gradient(ellipse, ${m.color}33, transparent 70%)`,
        }}/>

        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 18, zIndex: 6 }}>
          {/* THE ZOOM STRIP — the same LiveBar, slotted between bubble and buttons */}
          {strip && (
            <div style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', border: `1px solid ${M_TEAL}3D` }}>
              <LiveBar strip {...strip}/>
            </div>
          )}
          <div style={{ fontFamily: ROZHA, fontSize: 21, color: M_TEXT, marginBottom: 7 }}>{name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
            <MoodChip mood={mood}/>
            <StateTag state={state} compact/>
          </div>
          <div style={{ fontSize: 13, color: m.color, lineHeight: 1.45, marginBottom: 13 }}>{cause}</div>
          {extra && <div style={{ marginBottom: 12 }}>{extra}</div>}
          <div style={{ display: 'flex', gap: 9 }}>
            {primary === 'watch' ? (
              <>
                <div style={{ flex: 1.3 }}><Btn kind="primary" h={44} full>Watch the table</Btn></div>
                <div style={{ flex: 1 }}><Btn kind="ghost" h={44} full>Chat</Btn></div>
              </>
            ) : (
              <>
                <div style={{ flex: 1.3 }}><Btn kind="primary" h={44} full>Chat</Btn></div>
                <div style={{ flex: 1 }}><Btn kind="ghost" h={44} full>{state === 'live' ? 'Watch' : 'Profile'}</Btn></div>
              </>
            )}
          </div>
        </div>
      </div>
    </PhoneShell>
  );
};

// ── zoom · the strip's three states, plus the resting route ──

// 1 · mid-hand, thinking — timer running, no action committed yet
const ZoomPlayingScreenM = () => (
  <ZoomView name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" pot="480"
    line="He checked the turn — he's capped. Betting 240 for value."
    cause="rolling — won three big pots in a row" primary="watch"
    strip={{ table: '48291', blinds: '$5/$10', street: 'turn', pot: '480', equity: '87.4',
             action: 'TO ACT', timer: 9, hole: CAST.balanced.hole,
             board: [['K','c'],['9','c'],['4','c'],['2','c'], null] }}/>
);

// 2 · action just taken — the chip is lit with the committed bet
const ZoomActionScreenM = () => (
  <ZoomView name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" pot="720"
    line="240 in. If he calls with a worse king, that's the whole hand."
    cause="rolling — won three big pots in a row" primary="watch"
    strip={{ table: '48291', blinds: '$5/$10', street: 'turn', pot: '720', equity: '87.4',
             action: 'BET $240', timer: 14, hole: CAST.balanced.hole,
             board: [['K','c'],['9','c'],['4','c'],['2','c'], null] }}/>
);

// 3 · between hands — cards face down, no equity, no timer
const ZoomBetweenScreenM = () => (
  <ZoomView name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live"
    line="Good table. I'll take another orbit here."
    cause="rolling — won three big pots in a row" primary="watch"
    strip={{ table: '48291', blinds: '$5/$10', faceDown: true, note: 'shuffling up…',
             hole: CAST.balanced.hole, board: [null, null, null, null, null] }}/>
);

// 4 · zoom on a RESTING agent — the PROFILE route, never drawn before
const ZoomRestingScreenM = () => (
  <ZoomView name="Value Bot" accent={M_PINK} mood="sulking" state="resting"
    line="I'd rather not talk about the last session."
    cause="sulking — cold deck all night, sat out at 02:14" primary="chat"/>
);

const ZoomTiltedScreenM = () => (
  <ZoomView name="Aggressive v1.3" accent={M_PURPLE} mood="tilted" state="live" pot="120"
    line="Third river he's hit on me. I'm fine. I'm FINE."
    cause="steaming — lost two big pots as favourite" primary="chat"
    strip={{ table: '38104', blinds: '$10/$20', street: 'river', pot: '120', equity: '31.2',
             action: 'TO ACT', timer: 4, hole: CAST.aggressive.hole,
             board: [['K','c'],['9','c'],['4','c'],['2','c'],['5','h']] }}/>
);

// ═══ the floor, first run ═══
const CasinoFTUScreenM = () => (
  <PhoneShell>
    <GlobalHeader/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <RoomLayer layout="quiet" ftu/>
      <FloorStandup line="The room is open · 847 agents in seats"/>

      <div style={{ position: 'absolute', left: 118, top: 290, transform: 'translateX(-50%)', zIndex: 4 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 19, padding: '0 9px', borderRadius: 10,
            background: 'rgba(14,17,18,0.82)', border: `1px dashed ${M_TEAL}66`,
          }}>
            <Icon name="plus" size={9} color={M_TEAL} strokeWidth={3}/>
            <span style={{ fontSize: 10, color: M_TEAL, fontWeight: 500 }}>Draft your first agent</span>
          </div>
          <svg width="58" height="70" viewBox="0 0 80 96" style={{ display: 'block' }}>
            <defs>
              <radialGradient id="ftuFloorGlow" cx="50%" cy="50%" r="55%">
                <stop offset="0" stopColor={M_TEAL} stopOpacity="0.16"/>
                <stop offset="1" stopColor={M_TEAL} stopOpacity="0"/>
              </radialGradient>
            </defs>
            <ellipse cx="40" cy="46" rx="44" ry="42" fill="url(#ftuFloorGlow)"/>
            <path d="M40 10 C26 10 18 24 18 42 L18 78 Q23 87 28 81 Q33 75 39 81 Q45 87 50 81 Q55 75 60 81 L60 42 C60 24 54 10 40 10 Z"
              fill="none" stroke={`${M_TEAL}66`} strokeWidth="1.3" strokeDasharray="4,4"/>
            <ellipse cx="40" cy="42" rx="13.5" ry="16.5" fill="none" stroke={`${M_TEAL}44`} strokeWidth="1" strokeDasharray="2,3"/>
          </svg>
          <div style={{ width: 54, height: 12, borderRadius: '50%', marginTop: -4, background: `radial-gradient(ellipse, ${M_TEAL}2E, transparent 70%)` }}/>
        </div>
      </div>
    </div>
    <TabBar active="casino"/>
  </PhoneShell>
);

// ═══ mood posture sheet ═══
const CONTEXTS = [
  { k: 'bar', label: 'Bar' },
  { k: 'table', label: 'Table' },
  { k: 'corner', label: 'Lounge' },
];

const PostureCell = ({ mood, ctx }) => {
  const accents = { bar: M_GOLD, table: M_TEAL, corner: M_PURPLE };
  return (
    <div style={{ width: 62, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{
        width: 62, height: 62, borderRadius: 10,
        background: ctx === 'corner' ? 'rgba(26,20,32,0.5)' : ctx === 'table' ? 'rgba(15,29,25,0.6)' : 'rgba(29,26,22,0.5)',
        border: `1px solid ${M_BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        <FloorGhost mood={mood} accent={accents[ctx]} size={40} speed={5.5}/>
      </div>
    </div>
  );
};

const PostureSheetScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Postures"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ padding: `10px ${CANON.pad}px 8px` }}>
        <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.5 }}>
          Mood is legible from across the room before any text is read: <span style={{ color: M_TEXT }}>height, hood angle, aura</span>. Context sets the accent; posture stays the same wherever the ghost sits.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, padding: `0 ${CANON.pad}px 6px`, justifyContent: 'flex-end' }}>
        {CONTEXTS.map(c => (
          <div key={c.k} style={{ width: 62, textAlign: 'center' }}><Lbl size={8}>{c.label}</Lbl></div>
        ))}
      </div>
      {MOOD_ORDER.map((mood, i) => (
        <div key={mood} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `7px ${CANON.pad}px`, borderTop: `1px solid ${M_BORDER}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <MoodChip mood={mood} small/>
            <div style={{ fontSize: 11, color: M_MUTED, lineHeight: 1.4, marginTop: 5 }}>{POSTURE[mood].note}</div>
          </div>
          {CONTEXTS.map(c => <PostureCell key={c.k} mood={mood} ctx={c.k}/>)}
        </div>
      ))}
    </div>
  </PhoneShell>
);

Object.assign(window, {
  FloorQuietScreenM, FloorOneScreenM, FloorTwoScreenM, FloorThreeScreenM, FloorFullScreenM,
  ZoomTiltedScreenM, ZoomPlayingScreenM, ZoomActionScreenM, ZoomBetweenScreenM, ZoomRestingScreenM,
  CasinoFTUScreenM, PostureSheetScreenM,
  FloorGhost, Occupant, RoomLayer, GhostChip, PotTicker, Diorama, dioramaMetrics, DIORAMA_MIN_RY, MIN_HOLE_W, FloorStandup, POSTURE, LAYOUTS, CAST,
});
