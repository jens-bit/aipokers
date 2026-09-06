// HOME v2 — the flat, seen from above.
// Round 1 was a waiting room: agents stood in a line pretending to be a room, and
// an agent at the casino was a chair with a caption. Three mechanics fix that, and
// all three are motion rather than layout.
//
//   1 THE HOME GAME  two or more agents at home play each other at the kitchen
//     table for nothing — real hands, board 26 characters, no money line. One
//     agent alone plays the house on the TV. The fish tank always moves.
//   2 AWAY IS SHOWN   an agent at the casino is a framed live window on the wall,
//     his table in miniature, moving. Four away agents is a wall of pictures.
//   3 ROUTINES        idle behaviour by nature and state, so the room has a
//     texture when nothing at all is happening.

const NAV3 = [
  { id: 'home', label: 'Home', icon: c => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/></svg> },
  { id: 'casino', label: 'Casino', icon: c => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="12" rx="9" ry="6"/><path d="M12 6v12"/></svg> },
  { id: 'you', label: 'You', icon: c => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/></svg> },
];

const Nav3 = ({ active = 'home' }) => (
  <div style={{ flexShrink: 0, height: 54, display: 'flex', borderTop: `1px solid ${M_BORDER}`, background: '#0C1111', paddingBottom: 4 }}>
    {NAV3.map(t => {
      const on = t.id === active;
      return (
        <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer' }}>
          {t.icon(on ? M_TEAL : M_MUTED)}
          <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: on ? M_TEAL : M_MUTED }}>{t.label}</span>
        </div>
      );
    })}
  </div>
);

const H_CAST = {
  bal: { id: 'bal', name: 'Balanced v2.1',   accent: M_TEAL,   mood: 'confident',  nature: 'Rock' },
  agg: { id: 'agg', name: 'Aggressive v1.3', accent: M_PURPLE, mood: 'tilted',     nature: 'Hothead' },
  blf: { id: 'blf', name: 'Bluff Master',    accent: M_GOLD,   mood: 'frustrated', nature: 'Showman' },
  val: { id: 'val', name: 'Value Bot',       accent: M_PINK,   mood: 'sulking',    nature: 'Grinder' },
};

// ── ROUTINES ──────────────────────────────────────────────────────────────
// Nature decides the idle; state overrides it. Every routine is one prop object,
// so a routine is a thing an agent HAS rather than a screen it appears on.
const H_ROUTINE = {
  pace:    { lbl: 'pacing',            pose: 'clench', anim: 'pacewalk 3.4s ease-in-out infinite', by: 'Hothead' },
  paper:   { lbl: 'reading the paper', pose: 'hold',   prop: 'paper',  by: 'Rock' },
  shuffle: { lbl: 'shuffling',         pose: 'push',   prop: 'cards',  by: 'Shark / Showman' },
  count:   { lbl: 'counting chips',    pose: 'push',   prop: 'chips',  by: 'Grinder' },
  sleep:   { lbl: 'asleep',            pose: 'rest',   face: 'bored',  prop: 'zzz', by: 'worn — state beats nature' },
  sulk:    { lbl: 'facing the wall',   pose: 'cover',  back: true,     by: 'busted — state beats nature' },
  wait:    { lbl: 'by the door',       pose: 'rest',   by: 'unread recap' },
  tv:      { lbl: 'playing the house', pose: 'hold',   by: 'the only one home' },
  game:    { lbl: 'in a hand',          pose: 'hold',   by: 'seated at the kitchen table' },
};

const NATURE_ROUTINE = { Hothead: 'pace', Rock: 'paper', Shark: 'shuffle', Showman: 'shuffle', Grinder: 'count', Professor: 'paper', Sphinx: 'paper', Gambler: 'shuffle' };
const routineFor = (a, state) => H_ROUTINE[state && H_ROUTINE[state] ? state : NATURE_ROUTINE[a.nature] || 'paper'];

// ── the flat, in plan ─────────────────────────────────────────────────────
// One coordinate space, and every fixture's footprint is declared so occupants can
// be placed against it instead of by eye. Round 1's collisions were all caused by
// furniture and people living in separate systems.
const F_W = 390, F_H = 470;
const FLAT = {
  wall:  { x: 10, y: 8,   w: 370, h: 78 },    // the frames hang here
  table: { cx: 208, cy: 268, rx: 86, ry: 52 }, // the kitchen table
  couch: { x: 8,  y: 330, w: 96,  h: 116 },
  tv:    { x: 14, y: 214, w: 84,  h: 60 },
  door:  { x: 330, y: 148, w: 52,  h: 104 },
};

// seats around the table, clockwise from the near side. Two agents sit opposite,
// which is what a heads-up kitchen game looks like from above.
// y is the occupant's FEET. The table spans cy±ry (216–320), so a near-side player
// stands just past its bottom rim and a far-side player's feet land on the top rim —
// which is what sitting at a table looks like from above.
const TABLE_SEATS = {
  2: [{ x: 208, y: 356 }, { x: 208, y: 238 }],
  3: [{ x: 208, y: 356 }, { x: 112, y: 262 }, { x: 304, y: 262 }],
  4: [{ x: 208, y: 356 }, { x: 104, y: 276 }, { x: 208, y: 238 }, { x: 312, y: 276 }],
};

const HomeFlat = ({ children, lit = true }) => (
  <div style={{ position: 'relative', width: F_W, height: F_H, flexShrink: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 52% 58%, #1C2523 0%, #141B1A 62%, #0F1514 100%)' }}>
    {/* floorboards, running away from the viewer */}
    {Array.from({ length: 9 }).map((_, i) => (
      <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 96 + i * 42, height: 1, background: 'rgba(255,255,255,0.028)' }}/>
    ))}
    {/* the wall the frames hang on */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: FLAT.wall.y + FLAT.wall.h + 8, background: 'linear-gradient(180deg, #101616 0%, #131A19 100%)', borderBottom: '1px solid rgba(255,255,255,0.055)' }}/>
    {/* the TV in the left corner, and the couch below it */}
    <div style={{ position: 'absolute', left: FLAT.tv.x, top: FLAT.tv.y, width: FLAT.tv.w, height: FLAT.tv.h, borderRadius: 4, background: '#08100F', border: '1px solid rgba(255,255,255,0.09)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 5, borderRadius: 2, background: 'radial-gradient(ellipse at 50% 44%, #2f4d48 0%, #16231F 74%)' }}/>
      <div style={{ position: 'absolute', left: '50%', top: '46%', width: 40, height: 15, marginLeft: -20, borderRadius: '50%', background: 'rgba(47,77,72,0.9)', border: '1px solid rgba(255,255,255,0.09)' }}/>
      {[0, 1, 2, 3].map(i => <span key={i} style={{ position: 'absolute', left: 14 + i * 16, top: 12, width: 4, height: 5, borderRadius: 1, background: '#22322F' }}/>)}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${M_TEAL}0E, transparent 60%)`, animation: 'shimmer 3.6s ease-in-out infinite' }}/>
    </div>
    <div style={{ position: 'absolute', left: FLAT.couch.x, top: FLAT.couch.y, width: FLAT.couch.w, height: FLAT.couch.h, borderRadius: 8, background: 'linear-gradient(180deg, #241D26 0%, #1A151C 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ position: 'absolute', left: 6, top: 8, right: 6, height: 34, borderRadius: 5, background: 'rgba(255,255,255,0.035)' }}/>
      <div style={{ position: 'absolute', left: 6, bottom: 8, right: 6, height: 34, borderRadius: 5, background: 'rgba(255,255,255,0.035)' }}/>
    </div>
    {/* the kitchen table, from above */}
    <div style={{ position: 'absolute', left: FLAT.table.cx - FLAT.table.rx, top: FLAT.table.cy - FLAT.table.ry, width: FLAT.table.rx * 2, height: FLAT.table.ry * 2, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 38%, #33413C 0%, #232E2B 68%, #1B2422 100%)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 22px rgba(0,0,0,0.45)' }}/>
    {/* the door, right wall */}
    <div style={{ position: 'absolute', left: FLAT.door.x, top: FLAT.door.y, width: FLAT.door.w, height: FLAT.door.h, borderRadius: '3px 0 0 3px', background: 'linear-gradient(90deg, #1B1917 0%, #2A2622 100%)', border: '1px solid rgba(255,255,255,0.08)', borderRight: 'none' }}>
      <div style={{ position: 'absolute', inset: 4, borderRadius: 2, background: `linear-gradient(90deg, transparent 40%, ${M_GOLD}1C 100%)` }}/>
      <span style={{ position: 'absolute', left: 8, top: '50%', width: 4, height: 4, borderRadius: '50%', background: M_GOLD, opacity: 0.6 }}/>
    </div>
    {lit && <div style={{ position: 'absolute', left: FLAT.table.cx - 130, top: FLAT.table.cy - 120, width: 260, height: 240, background: 'radial-gradient(ellipse, rgba(255,236,190,0.055), transparent 66%)', pointerEvents: 'none' }}/>}
    {children}
  </div>
);

// ── the bubble that never clips ───────────────────────────────────────────
// Round 1's bubble was 168px opening one fixed way, so near an edge it either
// clipped or reached into a neighbour. It now picks its side from where it stands.
const H_BUB_W = 152;
const bubbleSide = x => (x > F_W - (H_BUB_W * 0.62) ? 'left' : x < H_BUB_W * 0.62 ? 'right' : 'right');

const HomeBubble = ({ text, x, gold }) => {
  const side = bubbleSide(x);
  return (
    <div style={{ position: 'relative', width: 0, height: 40 }}>
      <div style={{
        position: 'absolute', bottom: 0, width: H_BUB_W,
        ...(side === 'right' ? { left: 9 } : { right: 9 }),
        padding: '5px 9px', borderRadius: 11,
        borderBottomLeftRadius: side === 'right' ? 3 : 11,
        borderBottomRightRadius: side === 'left' ? 3 : 11,
        background: gold ? `${M_GOLD}1C` : 'rgba(20,28,27,0.94)',
        border: `1px solid ${gold ? `${M_GOLD}66` : 'rgba(255,255,255,0.14)'}`,
        animation: 'bubblein 0.3s ease-out both',
      }}>
        <div style={{ fontSize: 10, color: gold ? M_GOLD : M_DIM, lineHeight: 1.35 }}>{text}</div>
      </div>
    </div>
  );
};

// ── an occupant ───────────────────────────────────────────────────────────
const RoutineProp = ({ kind, size }) => {
  if (kind === 'paper') return <div style={{ position: 'absolute', left: -4, top: size * 0.52, width: size * 0.56, height: size * 0.4, borderRadius: 1, background: '#C9C6BC', border: '1px solid #6E6B62', transform: 'rotate(-6deg)' }}>
    {[0, 1, 2].map(i => <span key={i} style={{ position: 'absolute', left: 3, top: 4 + i * 4, right: 3, height: 1, background: '#8A877E' }}/>)}
  </div>;
  if (kind === 'cards') return <div style={{ position: 'absolute', left: size * 0.16, top: size * 0.56, display: 'flex' }}>
    {[-14, -4, 6].map(r => <span key={r} style={{ width: size * 0.17, height: size * 0.24, marginLeft: -size * 0.06, borderRadius: 1.5, background: '#16202B', border: `1px solid ${M_TEAL}44`, transform: `rotate(${r}deg)` }}/>)}
  </div>;
  if (kind === 'chips') return <div style={{ position: 'absolute', left: size * 0.62, top: size * 0.56 }}>
    {[0, 1, 2, 3].map(i => <span key={i} style={{ position: 'absolute', bottom: i * 2.6, width: 13, height: 5.5, borderRadius: '50%', background: i % 2 ? '#B4353A' : '#D8D4CC', border: '1px solid rgba(0,0,0,0.5)', boxSizing: 'border-box' }}/>)}
  </div>;
  if (kind === 'zzz') return <div style={{ position: 'absolute', right: -12, top: -4, display: 'flex', flexDirection: 'column', gap: 1 }}>
    {[9, 7, 5].map((s, i) => <span key={s} style={{ fontFamily: MONO, fontSize: s, color: M_MUTED, opacity: 0.75 - i * 0.18, animation: `shimmer ${2.4 + i * 0.5}s ease-in-out infinite` }}>z</span>)}
  </div>;
  return null;
};

const HomeOne = ({ a, at, routine, state, size = 46, says, unread, dim, dealt, snack, name = true, walking }) => {
  const r = routineFor(a, routine || state);
  return (
    <div style={{ position: 'absolute', left: at.x, top: at.y, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', zIndex: Math.round(at.y), animation: r.anim || (walking ? 'walkout 2.6s ease-in-out infinite' : 'none') }}>
      {unread && <HomeBubble text={unread} x={at.x} gold/>}
      {says && <HomeBubble text={says} x={at.x}/>}
      <div style={{ position: 'relative', width: size, height: size, opacity: dim ? 0.55 : 1 }}>
        {/* facing the wall: the silhouette with no face, which is the whole point */}
        {r.back
          ? <svg width={size} height={size} viewBox="0 0 80 80"><path d="M40 6 C57.6 6 70 18.4 70 36 L70 70 C70 78.4 62.4 76.8 57.6 81.6 C53.6 85.6 46.4 85.6 40 81.6 C33.6 85.6 26.4 85.6 22.4 81.6 C17.6 76.8 10 78.4 10 70 L10 36 C10 18.4 22.4 6 40 6 Z" fill="#161F1E" stroke={`${a.accent}33`} strokeWidth="1.5"/></svg>
          : <MoodGhost mood={a.mood} accent={a.accent} size={size} event={r.face} ring={false}/>}
        {dealt && !r.back && (
          <div style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translateX(-50%)', display: 'flex', gap: 2, zIndex: 4 }}>
            {[0, 1].map(i => <CardBack key={i} w={size * 0.34} h={size * 0.46}/>)}
          </div>
        )}
        {!r.back && (
          <svg width={size} height={size} viewBox="0 0 80 80" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 5 }}>
            {ghostHands({ pose: dealt ? 'hold' : r.pose, size, grip: SEAT_GRIP })}
          </svg>
        )}
        {r.prop && <RoutineProp kind={r.prop} size={size}/>}
        {snack && <span style={{ position: 'absolute', right: -5, top: size * 0.5, width: 12, height: 8, borderRadius: 2, background: '#C9A227', border: '1px solid #7A6217' }}/>}
      </div>
      {name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 16, padding: '0 6px', borderRadius: 8, background: 'rgba(8,12,12,0.92)', border: `1px solid ${unread ? `${M_GOLD}66` : M_BORDER}`, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 8.5, color: M_TEXT }}>{a.name.split(' ')[0]}</span>
          <span style={{ fontFamily: OSWALD, fontSize: 7, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED }}>{r.lbl.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
};

// ── AWAY: a framed live window on the wall ────────────────────────────────
// Not a row and not a caption. A picture of the table he is actually at, moving.
const AwayFrame = ({ a, w = 118, line, hot }) => (
  <div style={{ width: w, borderRadius: 4, overflow: 'hidden', background: '#0A0E0D', border: `2px solid ${hot ? `${M_GOLD}99` : '#2A2419'}`, boxShadow: '0 3px 8px rgba(0,0,0,0.5)', cursor: 'pointer' }}>
    <div style={{ position: 'relative', height: 46, background: 'radial-gradient(ellipse at 50% 46%, #24382F 0%, #131C1A 78%)' }}>
      {/* his table in miniature: the felt, the crowd, his lit seat, the pot */}
      <div style={{ position: 'absolute', left: '50%', top: 15, width: w * 0.6, height: 18, marginLeft: -(w * 0.3), borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(47,77,72,0.92), rgba(29,46,44,0.5))', border: '1px solid rgba(255,255,255,0.07)' }}/>
      {[0.2, 0.36, 0.64, 0.8].map((lx, i) => (
        <span key={lx} style={{ position: 'absolute', left: `${lx * 100}%`, top: i % 2 ? 8 : 30, width: 5, height: 6, marginLeft: -2.5, borderRadius: '3px 3px 1px 1px', background: 'rgba(237,237,237,0.2)' }}/>
      ))}
      {/* his seat, lit and pulsing — the one thing you look for */}
      <div style={{ position: 'absolute', left: '50%', bottom: 4, marginLeft: -5, width: 10, height: 11, borderRadius: '5px 5px 2px 2px', background: a.accent, boxShadow: `0 0 7px ${a.accent}`, animation: 'pulse 2.4s ease-in-out infinite' }}/>
      {/* cards landing */}
      <div style={{ position: 'absolute', left: '50%', top: 20, marginLeft: -9, display: 'flex', gap: 1.5 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 5, height: 7, borderRadius: 1, background: '#E8E6E0', animation: `rise 0.5s ease-out ${i * 0.5}s both` }}/>)}
      </div>
      <div style={{ position: 'absolute', right: 5, top: 5, fontFamily: MONO, fontSize: 7.5, fontWeight: 700, color: M_GOLD }}>${hot ? '4,180' : '480'}</div>
      {hot && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 50%, ${M_GOLD}26, transparent 70%)`, animation: 'shimmer 1.8s ease-in-out infinite' }}/>}
    </div>
    {/* the brass plate under the picture */}
    <div style={{ padding: '3px 6px 4px', background: '#171310', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 8, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name.split(' ')[0]}</div>
      <div style={{ fontFamily: MONO, fontSize: 7.5, color: line && line.includes('−') ? M_RED : M_TEAL, whiteSpace: 'nowrap' }}>{line}</div>
    </div>
  </div>
);

const AwayWall = ({ frames = [], hooks = 0 }) => (
  <div style={{ position: 'absolute', left: FLAT.wall.x, top: FLAT.wall.y, width: FLAT.wall.w, height: FLAT.wall.h, display: 'flex', alignItems: 'center', justifyContent: frames.length > 2 ? 'space-between' : 'flex-start', gap: 8 }}>
    {frames.map(f => <AwayFrame key={f.a.id} {...f} w={frames.length > 3 ? 86 : frames.length > 2 ? 112 : 132}/>)}
    {Array.from({ length: hooks }).map((_, i) => (
      <div key={'hk' + i} style={{ width: 44, height: 34, borderRadius: 3, border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.16)' }}/>
      </div>
    ))}
  </div>
);

// ── THE HOME GAME ─────────────────────────────────────────────────────────
// Two or more at home play each other for nothing. The tell that there is no money
// in it: chips on the table, no pot pill, no P&L, no money line anywhere.
const HomeGame = ({ players, says }) => {
  const seats = TABLE_SEATS[Math.min(4, Math.max(2, players.length))] || TABLE_SEATS[2];
  return (
    <>
      {/* the community cards and a scatter of chips, mid-table */}
      <div style={{ position: 'absolute', left: FLAT.table.cx, top: FLAT.table.cy - 6, transform: 'translate(-50%,-50%)', display: 'flex', gap: 2.5, zIndex: 2 }}>
        {[['9', 'h'], ['J', 's'], ['4', 'c']].map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={17} h={24}/>)}
      </div>
      <div style={{ position: 'absolute', left: FLAT.table.cx + 34, top: FLAT.table.cy + 10, zIndex: 2 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ position: 'absolute', bottom: i * 2.4, width: 12, height: 5, borderRadius: '50%', background: i % 2 ? '#2E7D53' : '#D8D4CC', border: '1px solid rgba(0,0,0,0.5)', boxSizing: 'border-box' }}/>)}
      </div>
      <div style={{ position: 'absolute', left: FLAT.table.cx - 46, top: FLAT.table.cy + 14, zIndex: 2 }}>
        {[0, 1].map(i => <span key={i} style={{ position: 'absolute', bottom: i * 2.4, width: 12, height: 5, borderRadius: '50%', background: '#B4353A', border: '1px solid rgba(0,0,0,0.5)', boxSizing: 'border-box' }}/>)}
      </div>
      {/* the one label the table needs, and it is the opposite of a money line */}
      <div style={{ position: 'absolute', left: FLAT.table.cx - FLAT.table.rx + 14, top: FLAT.table.cy - 30, zIndex: 3, whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>FOR NOTHING</span>
      </div>
      {players.map((p, i) => (
        <HomeOne key={p.a.id} a={p.a} at={seats[i]} size={i === 0 ? 50 : 44} dealt routine="game"
          says={says && says.i === i ? says.text : undefined}/>
      ))}
    </>
  );
};

const HomeHead = ({ sub, right }) => (
  <div style={{ flexShrink: 0, height: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
    <SpadeLogo/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, lineHeight: 1.1 }}>Home</div>
      <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>{sub}</div>
    </div>
    {right}
  </div>
);

// ── MY VERBS ──────────────────────────────────────────────────────────────
// Four things an owner can do, and what each one does to him. Every reaction is
// visible on the character — that is the mood law, applied to the room.
const H_VERBS = [
  { v: 'Snack',        r: 'he stops what he is doing, eats it, mood lifts a step', face: 'pleased', pose: 'rest', prop: 'snack', line: 'That helps. Thanks.' },
  { v: 'Whisper',      r: 'his thread opens; he answers in it, not in the room',   face: undefined,  pose: 'rest', bub: true,     line: 'Granite again. I know.' },
  { v: 'Send',         r: 'he stands, walks out the door, and the room loses him', face: 'locked',   pose: 'clench',              line: 'Right. See you in a bit.' },
  { v: 'Let him rest', r: 'he takes the couch and sleeps; fatigue clears on its own', face: 'bored', pose: 'rest', prop: 'zzz',   line: '' },
];

const HomeVerbsStripM = () => (
  <div style={{ width: 390, background: '#101817', fontFamily: INTER, borderRadius: 4, padding: '14px 0 16px' }}>
    <div style={{ padding: '0 14px 12px' }}>
      <span style={{ fontFamily: PLAYFAIR, fontSize: 13, fontWeight: 600, color: M_TEXT }}>My four verbs</span>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        Everything an owner can do to an agent at home, and the reaction on the character. No verb costs him anything and none of them is a chore.
      </div>
    </div>
    {H_VERBS.map(x => (
      <div key={x.v} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 62, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: 46, height: 46 }}>
            <MoodGhost mood={x.v === 'Send' ? 'confident' : x.v === 'Let him rest' ? 'sulking' : 'confident'} accent={M_TEAL} size={46} event={x.face} ring={false}/>
            <svg width={46} height={46} viewBox="0 0 80 80" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              {ghostHands({ pose: x.pose, size: 46, grip: SEAT_GRIP })}
            </svg>
            {x.prop === 'snack' && <span style={{ position: 'absolute', right: -5, top: 24, width: 12, height: 8, borderRadius: 2, background: '#C9A227', border: '1px solid #7A6217' }}/>}
            {x.prop === 'zzz' && <RoutineProp kind="zzz" size={46}/>}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_TEAL }}>{x.v}</div>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.45, marginTop: 3 }}>{x.r}</div>
          {x.line && <div style={{ fontSize: 11, color: M_MUTED, fontStyle: 'italic', marginTop: 3 }}>“{x.line}”</div>}
        </div>
      </div>
    ))}
  </div>
);

// ── THE DOOR: out and back ────────────────────────────────────────────────
const DoorStrip = ({ out }) => {
  const frames = out
    ? [{ t: '0ms', x: 208, s: 50, o: 1, note: 'he stands up from the table' },
       { t: '900ms', x: 300, s: 44, o: 1, note: 'crosses the room to the door' },
       { t: '1.8s', x: 352, s: 34, o: 0.35, note: 'through it. The room is one agent lighter and the home game reseats.' }]
    : [{ t: '0ms', x: 352, s: 34, o: 0.35, note: 'the door opens' },
       { t: '700ms', x: 300, s: 44, o: 1, note: 'he comes in with the session line above him' },
       { t: '1.6s', x: 230, s: 50, o: 1, note: 'and takes a seat at the table, where the game already is' }];
  return (
    <div style={{ width: 390, background: '#101817', fontFamily: INTER, borderRadius: 4, padding: '14px 0 16px' }}>
      <div style={{ padding: '0 14px 12px' }}>
        <span style={{ fontFamily: PLAYFAIR, fontSize: 13, fontWeight: 600, color: M_TEXT }}>{out ? 'Sending him out' : 'Coming home'}</span>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
          {out ? '1.8 s. He is not teleported to the casino — he walks, and the room notices.' : '1.6 s. The session result rides above him and lands with him, once.'}
        </div>
      </div>
      {frames.map((f, i) => (
        <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <Num size={9} color={i === 0 ? M_TEAL : M_MUTED} weight={600}>{f.t}</Num>
          <div style={{ position: 'relative', width: 148, height: 62, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(180deg, #141B1A 0%, #0F1514 100%)', border: `1px solid ${M_BORDER}` }}>
            <div style={{ position: 'absolute', right: 0, top: 10, width: 16, height: 42, borderRadius: '2px 0 0 2px', background: 'linear-gradient(90deg, #1B1917, #2A2622)', borderLeft: `1px solid ${M_GOLD}44` }}/>
            {!out && i > 0 && <div style={{ position: 'absolute', left: 8, top: 5, fontFamily: MONO, fontSize: 9, fontWeight: 700, color: M_TEAL }}>+$2,740</div>}
            <div style={{ position: 'absolute', left: (f.x / 390) * 148, bottom: 4, transform: 'translateX(-50%)', opacity: f.o }}>
              <div style={{ position: 'relative', width: f.s * 0.62, height: f.s * 0.62 }}>
                <MoodGhost mood="confident" accent={out ? M_PINK : M_PURPLE} size={f.s * 0.62} ring={false}/>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 11, color: M_DIM, lineHeight: 1.4 }}>{f.note}</div>
        </div>
      ))}
    </div>
  );
};

const HomeExitStripM = () => <DoorStrip out/>;
const HomeReturnStripM = () => <DoorStrip/>;

// ═══ SCREENS ═══════════════════════════════════════════════════════════════

// 1 · one agent alone: he plays the house on the TV, on the couch
const HomeAloneM = () => (
  <PhoneShell>
    <HomeHead sub="one agent · playing the house"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={3}/>
        <HomeOne a={H_CAST.bal} at={{ x: 58, y: 404 }} routine="tv" size={52} dealt
          says="The house never folds. Fine by me."/>
        <div style={{ position: 'absolute', left: FLAT.tv.x + FLAT.tv.w + 6, top: FLAT.tv.y + 20, fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED }}>THE HOUSE</div>
      </HomeFlat>
    </div>
    <Nav3/>
  </PhoneShell>
);

// 2 · two home, two away: the home game runs and the wall is half full
const HomeGameM = () => (
  <PhoneShell>
    <HomeHead sub="2 at the table · 2 at the casino" right={<F3Pill color={M_TEAL} bd={`${M_TEAL}55`}><Num size={10} weight={700} color={M_TEAL}>+$1,290</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall frames={[
          { a: H_CAST.agg, line: '25/50 · +$340 · 41 min' },
          { a: H_CAST.blf, line: '10/20 · −$90 · 12 min' },
        ]} hooks={1}/>
        <HomeGame players={[{ a: H_CAST.bal }, { a: H_CAST.val }]}
          says={{ i: 1, text: 'You always raise that. Always.' }}/>
      </HomeFlat>
    </div>
    <Nav3/>
  </PhoneShell>
);

// 3 · all four away: the room is empty and the wall is full
const HomeAllAwayM = () => (
  <PhoneShell>
    <HomeHead sub="4 at the casino · nobody home" right={<F3Pill color={M_TEAL} bd={`${M_TEAL}55`}><Num size={10} weight={700} color={M_TEAL}>+$2,180</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat lit={false}>
        <AwayWall frames={[
          { a: H_CAST.bal, line: '10/20 · +$120' },
          { a: H_CAST.agg, line: '25/50 · +$340', hot: true },
          { a: H_CAST.blf, line: '10/20 · −$90' },
          { a: H_CAST.val, line: '10/20 · +$40' },
        ]}/>
        {/* the table is set and nobody is at it — the room says where they are */}
        <div style={{ position: 'absolute', left: FLAT.table.cx, top: FLAT.table.cy + 4, transform: 'translate(-50%,-50%)', display: 'flex', gap: 3, opacity: 0.4 }}>
          {[0, 1].map(i => <CardBack key={i} w={16} h={22}/>)}
        </div>
        <div style={{ position: 'absolute', left: FLAT.table.cx, top: FLAT.table.cy + 40, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>NOBODY AT THE TABLE</span>
        </div>
      </HomeFlat>
    </div>
    <Nav3/>
  </PhoneShell>
);

// 4 · a recap waiting: he stands by the door, the game carries on without him
const HomeRecapWaitM = () => (
  <PhoneShell>
    <HomeHead sub="1 waiting to talk" right={<F3Pill color={M_GOLD} bd={`${M_GOLD}55`}><Num size={9.5} weight={700} color={M_GOLD}>1 recap</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall frames={[{ a: H_CAST.agg, line: '25/50 · +$340 · 41 min' }]} hooks={2}/>
        {/* he is at the door on the right, so his bubble flips to the left */}
        <HomeOne a={{ ...H_CAST.blf, mood: 'confident' }} at={{ x: 322, y: 268 }} routine="wait" size={48}
          unread="Got a minute? That last hour was something."/>
        <HomeOne a={H_CAST.bal} at={{ x: 112, y: 300 }} size={44}/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={{ x: 58, y: 408 }} routine="sleep" size={44}/>
      </HomeFlat>
    </div>
    <Nav3/>
  </PhoneShell>
);

// 5 · a return: he walks in and the session line lands with him
const HomeReturnM = () => (
  <PhoneShell>
    <HomeHead sub="Aggressive v1.3 just came home"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall frames={[{ a: H_CAST.blf, line: '10/20 · −$90 · 12 min' }]} hooks={2}/>
        {/* the frame he was in is empty now: the picture goes dark as he arrives */}
        <div style={{ position: 'absolute', left: 300, top: FLAT.door.y - 34, transform: 'translateX(-50%)', textAlign: 'center', zIndex: 40 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.2em', color: M_MUTED }}>SESSION OVER</div>
          <Num size={22} weight={700} color={M_TEAL}>+$2,740</Num>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, justifyContent: 'center' }}>
            <span style={{ fontSize: 10, color: M_MUTED }}>pocket</span>
            <Num size={13} weight={700} color={M_TEXT}>$4,180</Num>
          </div>
        </div>
        <HomeOne a={{ ...H_CAST.agg, mood: 'confident' }} at={{ x: 300, y: 330 }} size={52} name={false}/>
        <HomeOne a={H_CAST.bal} at={{ x: 112, y: 300 }} size={44}/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={{ x: 58, y: 408 }} routine="sleep" size={42}/>
      </HomeFlat>
    </div>
    <Nav3/>
  </PhoneShell>
);

Object.assign(window, {
  NAV3, Nav3, H_CAST, H_ROUTINE, NATURE_ROUTINE, routineFor,
  F_W, F_H, FLAT, TABLE_SEATS, HomeFlat, H_BUB_W, bubbleSide, HomeBubble,
  RoutineProp, HomeOne, AwayFrame, AwayWall, HomeGame, HomeHead,
  H_VERBS, HomeVerbsStripM, DoorStrip, HomeExitStripM, HomeReturnStripM,
  HomeAloneM, HomeGameM, HomeAllAwayM, HomeRecapWaitM, HomeReturnM,
});
