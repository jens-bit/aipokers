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
  sleep:   { lbl: 'asleep',            pose: 'rest',   face: 'asleep', prop: 'zzz', by: 'worn — state beats nature' },
  tape:    { lbl: 'watching tape',      pose: 'hold',   by: 'sent to the tape room' },
  sulk:    { lbl: 'facing the wall',   pose: 'cover',  back: true,     by: 'busted — state beats nature' },
  wait:    { lbl: 'by the door',       pose: 'rest',   by: 'unread recap' },
  fridge:  { lbl: 'at the fridge',     pose: 'rest',   by: 'fetching a beer he asked for' },
  tv:      { lbl: 'watching the ticker', pose: 'rest', by: 'nothing else on' },
  game:    { lbl: 'in a hand',          pose: 'hold',   by: 'seated at the kitchen table' },
};

const NATURE_ROUTINE = { Hothead: 'pace', Rock: 'paper', Shark: 'shuffle', Showman: 'shuffle', Grinder: 'count', Professor: 'paper', Sphinx: 'paper', Gambler: 'shuffle' };
const routineFor = (a, state) => H_ROUTINE[state && H_ROUTINE[state] ? state : NATURE_ROUTINE[a.nature] || 'paper'];

// ── the flat, in plan ─────────────────────────────────────────────────────
// One coordinate space, and every fixture's footprint is declared so occupants can
// be placed against it instead of by eye. Round 1's collisions were all caused by
// furniture and people living in separate systems.
const SHEET_COLLAPSED = 78;   // one line said + the composer's measured 55px box
const F_W = 390, F_H = 612;   // the wrapper's measured height with the sheet collapsed
const FLAT = {
  wall:  { x: 10, y: 8,   w: 370, h: 78 },    // the frames hang here
  table: { cx: 208, cy: 268, rx: 86, ry: 52 }, // the kitchen table
  couch: { x: 8,  y: 330, w: 96,  h: 116 },
  safe:  { x: 16,  y: 94,  w: 60,  h: 50 },   // against the wall, under the frames
  fridge:{ x: 250, y: 94,  w: 54,  h: 86 },   // the kitchen wall, beside the table
  door:  { x: 356, y: 152, w: 34,  h: 112 },  // IN the right wall, not floating in the room
  tape:  { x: 244, y: F_H - 126, w: 132, h: 112 },   // the tape room, bottom band
};
// Anchor an element's edge to a fixture's edge. Returns absolute-position props, so
// the element sizes itself freely and the constrained side stays put whatever the
// content does — the opposite of centring on a guessed x and hoping.
const clearOf = (fixture, side, gap = 12) => (
  side === 'left'                                        // sit LEFT of the fixture
    ? { right: F_W - fixture.x + gap, textAlign: 'right' }
    : { left: fixture.x + fixture.w + gap }              // sit RIGHT of it
);
// how far a routine may walk before it reaches the door, from where it stands
const travelTo = (x, size, max) => Math.max(0, Math.min(max, FLAT.door.x - 12 - (x + size / 2)));

// the floor that is actually free, given the fixtures above. An occupant's feet go
// here; a fixture footprint never does. Checked against tv, couch and table.
const STAND = {
  lounge:  { x: 152, y: 404 },   // couch right edge 104 · table bottom rim 320
  byTable: { x: 306, y: 356 },   // right of the table, clear of the door
  door:    { x: 322, y: 268 },
  couch:   { x: 58,  y: 408 },
  fridge:  { x: 284, y: 200 },   // standing at the open door
  tvSeat:  { x: 58,  y: 404 },
  tape:    { x: 292, y: F_H - 14 },   // the chair, below the screen it faces
  wall:    { x: 118, y: 470 },   // facing the bottom wall, to sulk
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

// ── the door, and the sign over it ───────────────────────────────────────
// A pill is what a body wears. A door to a casino wears a SIGN: a small lit marquee
// bolted to the wall — square corners, all caps, a bulb down each side, a warm spill
// on the boards beneath it. It hangs from the FRAME's right edge, never rightward
// from the door's own left edge at x352, which is what pushed the old tag off screen.
const DoorTap = () => (
  <div style={{ position: 'absolute', right: 0, top: FLAT.door.y - 34, zIndex: 260, cursor: 'pointer' }}>
    {/* the spill: the sign is a light source, so the wall under it is lit */}
    <div style={{ position: 'absolute', right: -4, top: 14, width: 76, height: 42, background: `radial-gradient(ellipse at 70% 0%, ${M_GOLD}26 0%, transparent 72%)`, pointerEvents: 'none' }}></div>
    <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch', background: 'linear-gradient(180deg, #241D12 0%, #17120B 100%)', border: `1px solid ${M_GOLD}6B`, boxShadow: `0 2px 10px rgba(0,0,0,0.6), inset 0 1px 0 ${M_GOLD}33` }}>
      {[0, 1].map(side => (
        <div key={side} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '3px 2px', order: side ? 2 : 0 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{ width: 2, height: 2, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 3px ${M_GOLD}`, animation: `shimmer 2.2s ease-in-out ${(i + side) * 0.35}s infinite` }}></span>
          ))}
        </div>
      ))}
      <div style={{ order: 1, padding: '4px 7px 5px', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.2em', color: M_GOLD, whiteSpace: 'nowrap', textShadow: `0 0 7px ${M_GOLD}88` }}>CASINO</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="3" strokeLinecap="round"><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg>
      </div>
    </div>
  </div>
);

// walk the room's own children for its away wall. Fragments and wrappers are
// transparent, so a room assembled any way at all still answers the question.
const findAway = nodes => {
  for (const n of React.Children.toArray(nodes)) {
    if (!n || typeof n !== 'object') continue;
    if (n.type === AwayWall) return n.props.frames || null;
    if (n.props && n.props.children) { const r = findAway(n.props.children); if (r) return r; }
  }
  return null;
};

const HomeFlat = ({ children, lit = true, tape }) => {
  // true or 'study' = somebody is in the tape room. 'casino', anything else, or
  // nothing at all = the ticker, because nobody is studying.
  const studying = tape === true || tape === 'study';
  // 'live' = one of his agents is in a hand, so the TV carries his felt. Anything
  // else carries the board, because that is what is on when he is not playing.
  // one of HIS agents is at the casino, so the TV carries that agent's felt. Not a
  // flag: the away wall is the fact, and the TV is a second view of it.
  const away = findAway(children);
  const his = away && away.length ? away[0] : null;
  const hisTable = !!his && !studying;
  return (
  <div style={{ position: 'relative', width: F_W, height: '100%', minHeight: F_H, flexShrink: 0, overflow: 'hidden', background: 'radial-gradient(ellipse at 52% 58%, #1C2523 0%, #141B1A 62%, #0F1514 100%)' }}>
    {/* floorboards, running away from the viewer */}
    {Array.from({ length: Math.ceil((F_H - 96) / 42) }).map((_, i) => (
      <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 96 + i * 42, height: 1, background: 'rgba(255,255,255,0.028)' }}/>
    ))}
    {/* the right wall, which the door is cut into */}
    <div style={{ position: 'absolute', right: 0, top: FLAT.wall.y + FLAT.wall.h + 8, bottom: 0, width: 8, background: 'linear-gradient(90deg, rgba(0,0,0,0.25) 0%, #131A19 100%)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}></div>
    {/* the wall the frames hang on */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: FLAT.wall.y + FLAT.wall.h + 8, background: 'linear-gradient(180deg, #101616 0%, #131A19 100%)', borderBottom: '1px solid rgba(255,255,255,0.055)' }}/>
    {/* THE SAFE: the wallet as furniture. Tap for the money sheet. */}
    <div style={{ position: 'absolute', left: FLAT.safe.x, top: FLAT.safe.y, width: FLAT.safe.w, height: FLAT.safe.h, borderRadius: 4, background: 'linear-gradient(160deg, #23211C 0%, #16150F 100%)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 6px 14px rgba(0,0,0,0.5)', cursor: 'pointer', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 4, borderRadius: 2, border: `1px solid ${M_GOLD}2E` }}></div>
      <div style={{ position: 'absolute', right: 7, top: '50%', marginTop: -5, width: 10, height: 10, borderRadius: '50%', border: `1.5px solid ${M_GOLD}88` }}></div>
      <div style={{ position: 'absolute', left: 8, top: '50%', marginTop: -7, fontFamily: MONO, fontSize: 11, fontWeight: 700, color: M_GOLD, letterSpacing: '-0.01em' }}>$54,000</div>
    </div>
    {/* THE FRIDGE: beer and snacks live here, bought from the wallet. Tap for stock. */}
    <div style={{ position: 'absolute', left: FLAT.fridge.x, top: FLAT.fridge.y, width: FLAT.fridge.w, height: FLAT.fridge.h, borderRadius: '3px 3px 4px 4px', background: 'linear-gradient(100deg, #1E2624 0%, #161D1C 62%, #1A2220 100%)', border: '1px solid rgba(255,255,255,0.11)', boxShadow: '0 6px 16px rgba(0,0,0,0.45)', cursor: 'pointer', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 30, height: 1, background: 'rgba(255,255,255,0.09)' }}></div>
      <div style={{ position: 'absolute', right: 6, top: 38, width: 3, height: 26, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></div>
      <div style={{ position: 'absolute', right: 6, top: 9, width: 3, height: 14, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }}></div>
      <div style={{ position: 'absolute', left: 7, bottom: 8, display: 'flex', gap: 2.5, alignItems: 'flex-end' }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 4, height: 11, borderRadius: '1px 1px 2px 2px', background: 'rgba(122,168,138,0.55)' }}></span>)}
        <span style={{ width: 7, height: 6, borderRadius: 1, background: 'rgba(205,179,128,0.4)', marginLeft: 1.5 }}></span>
      </div>
    </div>
    {/* the couch. There is no set in this corner any more: one TV, and it is the
        tape room's, at the bottom of the room. */}
    <div style={{ position: 'absolute', left: FLAT.couch.x, top: FLAT.couch.y, width: FLAT.couch.w, height: FLAT.couch.h, borderRadius: 8, background: 'linear-gradient(180deg, #241D26 0%, #1A151C 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ position: 'absolute', left: 6, top: 8, right: 6, height: 34, borderRadius: 5, background: 'rgba(255,255,255,0.035)' }}/>
      <div style={{ position: 'absolute', left: 6, bottom: 8, right: 6, height: 34, borderRadius: 5, background: 'rgba(255,255,255,0.035)' }}/>
    </div>
    {/* the kitchen table, from above */}
    <div style={{ position: 'absolute', left: FLAT.table.cx - FLAT.table.rx, top: FLAT.table.cy - FLAT.table.ry, width: FLAT.table.rx * 2, height: FLAT.table.ry * 2, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 38%, #33413C 0%, #232E2B 68%, #1B2422 100%)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 22px rgba(0,0,0,0.45)' }}/>
    {/* the door, right wall. Its tag is drawn by the nav layer and is anchored to
        the FRAME's right edge, not to the door's left edge — at 390 the door starts
        at x356, so anything laid out rightward from it leaves the screen. */}
    <div style={{ position: 'absolute', left: FLAT.door.x, top: FLAT.door.y, width: FLAT.door.w, height: FLAT.door.h, background: 'linear-gradient(90deg, #14120F 0%, #241F1A 100%)', borderTop: '2px solid rgba(255,255,255,0.13)', borderBottom: '2px solid rgba(255,255,255,0.13)', borderLeft: '2px solid rgba(255,255,255,0.13)' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 30%, ${M_GOLD}22 100%)` }}/>
      <span style={{ position: 'absolute', left: 6, top: '50%', width: 4, height: 4, borderRadius: '50%', background: M_GOLD, opacity: 0.7 }}/>
    </div>
    {/* THE TAPE ROOM: a chair and a small screen where he reviews his flagged hands */}
    {/* the tape room's edge lands ON a floorboard rather than 6px above one:
        two near-identical lines mid-room read as a mistake, not a threshold */}
    <div style={{ position: 'absolute', left: 0, right: 0, top: 96 + Math.round((FLAT.tape.y - 18 - 96) / 42) * 42, height: 1, background: 'rgba(255,255,255,0.05)' }}></div>
    <div style={{ position: 'absolute', left: FLAT.tape.x + 16, top: FLAT.tape.y, width: 100, height: 58, borderRadius: 3, background: '#070C0C', border: `1px solid ${studying ? `${M_TEAL}44` : 'rgba(255,255,255,0.1)'}`, overflow: 'hidden', cursor: 'pointer' }}>
      {studying ? (
        <>
          <div style={{ position: 'absolute', inset: 4, borderRadius: 2, background: 'radial-gradient(ellipse at 50% 44%, #2f4d48 0%, #16231F 76%)' }}></div>
          <div style={{ position: 'absolute', left: '50%', top: 24, width: 46, height: 15, marginLeft: -23, borderRadius: '50%', background: 'rgba(47,77,72,0.9)', border: '1px solid rgba(255,255,255,0.08)' }}></div>
          <div style={{ position: 'absolute', left: '50%', top: 27, marginLeft: -16, display: 'flex', gap: 1.5 }}>
            {[0, 1, 2, 3, 4].map(i => <span key={i} style={{ width: 5, height: 7, borderRadius: 1, background: '#E8E6E0', animation: `rise 0.6s ease-out ${i * 0.34}s both` }}></span>)}
          </div>
          <div style={{ position: 'absolute', left: 6, top: 5, fontFamily: OSWALD, fontSize: 6.5, fontWeight: 600, letterSpacing: '0.14em', color: M_RED }}>BAD BEAT</div>
          <div style={{ position: 'absolute', right: 5, bottom: 5, fontFamily: MONO, fontSize: 6.5, color: M_MUTED }}>0:14 / 0:38</div>
          <div style={{ position: 'absolute', left: 4, right: 4, bottom: 2, height: 1.5, background: 'rgba(255,255,255,0.1)' }}>
            <div style={{ width: '38%', height: '100%', background: M_TEAL }}></div>
          </div>
        </>
      ) : hisTable ? (
        <>
          {/* HIS felt, in miniature. Five bodies round a rim, a gold pot dot, his own
              seat teal — the same drawing the away frames use, at TV scale. */}
          <div style={{ position: 'absolute', inset: 4, borderRadius: 2, background: 'radial-gradient(ellipse at 50% 42%, #2B3C37 0%, #16201E 76%)' }}></div>
          {[0, 1, 2, 3, 4].map(i => {
            const th = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return (
              <div key={i} style={{ position: 'absolute', left: `${50 + Math.cos(th) * 33}%`, top: `${50 + Math.sin(th) * 34}%`, transform: 'translate(-50%,-50%)' }}>
                <svg width="10" height="10" viewBox="0 0 80 80">
                  <path d="M40 8 C58 8 70 20 70 38 L70 68 C70 76 62 75 58 79 C54 83 46 83 40 79 C34 83 26 83 22 79 C18 75 10 76 10 68 L10 38 C10 20 22 8 40 8Z"
                    fill={i === 0 ? idFor(his.a.id || his.a.name).hood.top : HOODS[(i * 2) % 6].top}
                    stroke={i === 0 ? `${M_TEAL}AA` : 'rgba(0,0,0,0.5)'} strokeWidth={i === 0 ? 5 : 2}/>
                  <ellipse cx="29" cy="40" rx="7" ry="7" fill={i === 0 ? idFor(his.a.id || his.a.name).glow.c : GLOWS[i % 6].c}/>
                  <ellipse cx="51" cy="40" rx="7" ry="7" fill={i === 0 ? idFor(his.a.id || his.a.name).glow.c : GLOWS[i % 6].c}/>
                </svg>
              </div>
            );
          })}
          <div style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)', width: 5, height: 5, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 6px ${M_GOLD}` }}></div>
          <div style={{ position: 'absolute', left: 6, bottom: 4, fontFamily: MONO, fontSize: 6.5, color: M_TEAL, right: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {pillName(his.a.name, his.a.nick)} &middot; {String(his.line).split(' \u00b7 ')[0]}
          </div>
          <div style={{ position: 'absolute', right: 6, top: 6, width: 4, height: 4, borderRadius: '50%', background: M_RED, animation: 'pulse 2.2s ease-in-out infinite' }}></div>
        </>
      ) : (
        <>
          {/* the board: the biggest pot on the floor, and what kind of hand it was.
              A stakes table was the casino stated; this is the casino shown. */}
          <div style={{ position: 'absolute', inset: 4, borderRadius: 2, background: 'linear-gradient(180deg, #171310 0%, #0D0B09 100%)' }}></div>
          <div style={{ position: 'absolute', left: 7, top: 6, fontFamily: OSWALD, fontSize: 6, fontWeight: 600, letterSpacing: '0.14em', color: `${M_GOLD}B3` }}>BIGGEST POT</div>
          <div style={{ position: 'absolute', left: 6, top: 16 }}><Amt size={17} color={M_GOLD}>$14,200</Amt></div>
          <div style={{ position: 'absolute', left: 7, right: 7, top: 36, fontSize: 6.5, color: M_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Ozy · cracked aces</div>
          <div style={{ position: 'absolute', left: 7, right: 7, top: 45, display: 'flex', gap: 4 }}>
            {['50/100', '1,604 in'].map(t => <span key={t} style={{ fontFamily: MONO, fontSize: 6, color: M_MUTED }}>{t}</span>)}
          </div>
          <div style={{ position: 'absolute', right: 6, top: 6, width: 4, height: 4, borderRadius: '50%', background: M_TEAL, animation: 'pulse 2.2s ease-in-out infinite' }}></div>
        </>
      )}
    </div>
    <div style={{ position: 'absolute', left: FLAT.tape.x + 48, top: FLAT.tape.y + 78, width: 34, height: 14, borderRadius: 4, background: 'linear-gradient(180deg, #2E241C 0%, #1F1913 100%)', border: '1px solid rgba(255,255,255,0.07)' }}></div>
    {lit && <div style={{ position: 'absolute', left: FLAT.table.cx - 130, top: FLAT.table.cy - 120, width: 260, height: 240, background: 'radial-gradient(ellipse, rgba(255,236,190,0.055), transparent 66%)', pointerEvents: 'none' }}/>}
    {children}
  </div>
  );
};

// ── the bubble that never clips ───────────────────────────────────────────
// Round 1's bubble was 168px opening one fixed way, so near an edge it either
// clipped or reached into a neighbour. It now picks its side from where it stands.
const H_BUB_W = 152;
const H_EDGE = 8;              // nothing an occupant carries comes closer to a wall
const bubbleSide = x => (x > F_W - (H_BUB_W * 0.62) ? 'left' : x < H_BUB_W * 0.62 ? 'right' : 'right');

// For a child of a zero-width anchor at x: left:(H_EDGE − x) pins its left edge to
// the wall margin, right:(x − F_W + H_EDGE) pins its right edge. Between the two
// thresholds it stays centred on him. No measurement needed — the arithmetic is
// exact for any label length, which is what the pill lacked.
const edgePin = (x, half) => (
  x < half + H_EDGE ? { left: H_EDGE - x }
  : x > F_W - half - H_EDGE ? { right: x - F_W + H_EDGE }
  : { left: '50%', transform: 'translateX(-50%)' }
);

const H_BUB_MAX = Math.round(F_W * 0.6);   // never more than 60% of the room
// right by default; near the right wall it flips so the text opens inward
const H_BOUND = React.createContext(null);   // visible room slice, when it is not the whole room
const H_BUB_GAP = 22;          // body half-width the bubble starts beyond
const H_PILL_HALF = 32;                     // the name pill overhangs the body
const bubAnchor = size => Math.max(size - 2, H_PILL_HALF + size / 2);
const bubRoom = (x, size = 46, bound) => {
  const off = bubAnchor(size) - size / 2 + 1;   // where the bubble's border actually starts
  const lo = bound ? bound.min : 0, hi = bound ? bound.max : F_W;
  const edge = bound ? bound.edge || 4 : H_EDGE;
  return { right: hi - edge - (x + off), left: (x - off) - (lo + edge) };
};
// a preference is honoured only if that side has room; otherwise the wall decides
const sideFor = (x, pref, size, bound) => {
  const r = bubRoom(x, size, bound);
  const want = bound ? 70 : 110;            // zoomed, a narrower bubble is still legible
  if (pref && r[pref] >= want) return pref;
  return r.right >= r.left ? 'right' : 'left';
};

const HomeBubble = ({ text, gold, side = 'right', maxW = H_BUB_MAX }) => {
  const fill = gold ? '#2A2415' : 'rgba(20,28,27,0.94)';
  const edge = gold ? `${M_GOLD}66` : 'rgba(255,255,255,0.14)';
  return (
    <div style={{ position: 'relative', width: 'max-content', maxWidth: Math.min(H_BUB_MAX, maxW), padding: '5px 9px', borderRadius: 11, background: fill, border: `1px solid ${edge}`, animation: 'bubblein 0.3s ease-out both' }}>
      <div style={{ fontSize: 10, color: gold ? M_GOLD : M_DIM, lineHeight: 1.35, textWrap: 'pretty' }}>{text}</div>
      {/* the tail takes the bubble's own fill, never its border colour */}
      <span style={{ position: 'absolute', top: '50%', marginTop: -4, [side === 'right' ? 'left' : 'right']: -4, width: 7, height: 7, background: fill, borderLeft: `1px solid ${edge}`, borderBottom: `1px solid ${edge}`, transform: 'rotate(45deg)' }}></span>
    </div>
  );
};

// ── an occupant ───────────────────────────────────────────────────────────
const RoutineProp = ({ kind, size }) => {
  if (kind === 'paper') return <div style={{ position: 'absolute', left: size * 0.44, top: size * 0.52, width: size * 0.56, height: size * 0.4, borderRadius: 1, background: '#C9C6BC', border: '1px solid #6E6B62', transform: 'rotate(-6deg)' }}>
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

// BOTH BARS ARE ANCHORED AT THE LEFT WALL. Wave 55 pinned stamina on the right,
// which made a spent agent show a stub floating away from the wall — unreadable next
// to heat. Now: stamina full = the whole bar, and as it drains the RIGHT end recedes
// toward the left, green → amber → red as it shortens. Heat empty = nothing, and the
// fill grows left → right, ember → red. A worn, tilted agent therefore reads as a
// short red stub on the left and a long red bar under it: two opposite shapes.
const staminaCol = v => (v > 60 ? '#4BC07A' : v > 35 ? '#C9B840' : v > 18 ? '#D48838' : '#C93F44');
const heatCol = v => (v < 30 ? '#9A7840' : v < 55 ? '#D89433' : v < 80 ? '#DE6E33' : '#D43F32');
const ResourceBars = ({ stamina = 74, heat = 20, w = 54, h = 2.5, gap = 2.5, labels }) => {
  const row = (v, col, lbl, drains) => (
    <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {labels && <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.12em', color: M_MUTED, width: 46 }}>{lbl}</span>}
      <div style={{ position: 'relative', width: w, height: h, borderRadius: h, background: 'rgba(255,255,255,0.09)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: `${Math.max(2, Math.min(100, v))}%`, height: '100%', background: col, borderRadius: h }}></div>
      </div>
      {labels && <Num size={8.5} weight={700} color={col}>{Math.round(v)}</Num>}
    </div>
  );
  return <div style={{ display: 'flex', flexDirection: 'column', gap }}>
    {row(stamina, staminaCol(stamina), 'STAMINA', true)}
    {row(heat, heatCol(heat), 'HEAT', false)}
  </div>;
};

const HomeOne = ({ a, at, routine, state, size = 46, says, unread, want, side, dim, dealt, snack, name = true, walking, stamina = 74, heat = 20 }) => {
  const bound = React.useContext(H_BOUND);
  const r = routineFor(a, routine || state);
  return (
    <div style={{ position: 'absolute', left: at.x, top: at.y, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer', zIndex: Math.round(at.y), animation: r.anim || (walking ? 'walkout 2.6s ease-in-out infinite' : 'none'), '--travel': travelTo(at.x, size, walking ? 60 : 34) + 'px' }}>
      {name && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2.5, padding: '2.5px 7px 4px', borderRadius: 8, background: 'rgba(8,12,12,0.9)', border: `1px solid ${unread ? `${M_GOLD}66` : M_BORDER}`, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 8.5, color: M_TEXT, lineHeight: 1.1 }}>{pillName(a.name, a.nick)}</span>
          <ResourceBars stamina={stamina} heat={heat} w={44} h={2} gap={2}/>
        </div>
      )}
      <div style={{ position: 'relative', width: size, height: size, opacity: dim ? 0.55 : 1 }}>
        {/* his hood and glow come from birth, not from mood */}
        {(says || unread || want) && (() => {
          const sd = sideFor(at.x, side, size, bound);
          // a floor would beat the bound and clip; inside a camera the frame decides
          const mw = bound ? bubRoom(at.x, size, bound)[sd] : Math.max(88, bubRoom(at.x, size)[sd]);
          return (
            <div style={{ position: 'absolute', top: size * 0.5, transform: 'translateY(-50%)', [sd === 'right' ? 'left' : 'right']: bubAnchor(size), display: 'flex', flexDirection: 'column', alignItems: sd === 'right' ? 'flex-start' : 'flex-end', gap: 4, zIndex: 9 }}>
              {unread && <HomeBubble text={unread} gold side={sd} maxW={mw}/>}
              {says && <HomeBubble text={says} side={sd} maxW={mw}/>}
              {want && React.cloneElement(want, { side: sd, maxW: mw })}
            </div>
          );
        })()}
        {/* facing the wall: the silhouette with no face, which is the whole point */}
        {r.back
          ? <svg width={size} height={size} viewBox="0 0 80 80"><path d="M40 6 C57.6 6 70 18.4 70 36 L70 70 C70 78.4 62.4 76.8 57.6 81.6 C53.6 85.6 46.4 85.6 40 81.6 C33.6 85.6 26.4 85.6 22.4 81.6 C17.6 76.8 10 78.4 10 70 L10 36 C10 18.4 22.4 6 40 6 Z" fill={idFor(a.id || a.name).hood.top} stroke={`${idFor(a.id || a.name).glow.c}44`} strokeWidth="1.5"/></svg>
          : (() => { const id = a.hood ? { hood: a.hood, glow: a.glow } : idFor(a.id || a.name);
              return <MoodGhost mood={a.mood} accent={id.glow.c} size={size} event={r.face} ring={false} hood={id.hood} glow={id.glow.c}/>; })()}
        {dealt && !r.back && (
          <div style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translateX(-50%)', display: 'flex', gap: 2, zIndex: 4 }}>
            {[0, 1].map(i => <CardBack key={i} w={size * 0.29} h={size * 0.39}/>)}
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
      <div style={{ fontSize: 8, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pillName(a.name, a.nick)}</div>
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
const HomeGame = ({ players, says, ring }) => {
  const seats = ring || TABLE_SEATS[Math.min(4, Math.max(2, players.length))] || TABLE_SEATS[2];
  return (
    <>
      {/* the community cards and a scatter of chips, mid-table */}
      <div style={{ position: 'absolute', left: FLAT.table.cx, top: FLAT.table.cy - 6, transform: 'translate(-50%,-50%)', display: 'flex', gap: 2.5, zIndex: 2 }}>
        {[['9', 'h'], ['J', 's'], ['4', 'c']].map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={14} h={20}/>)}
      </div>
      <div style={{ position: 'absolute', left: FLAT.table.cx + 34, top: FLAT.table.cy + 10, zIndex: 2 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ position: 'absolute', bottom: i * 2.4, width: 12, height: 5, borderRadius: '50%', background: i % 2 ? '#2E7D53' : '#D8D4CC', border: '1px solid rgba(0,0,0,0.5)', boxSizing: 'border-box' }}/>)}
      </div>
      <div style={{ position: 'absolute', left: FLAT.table.cx - 46, top: FLAT.table.cy + 14, zIndex: 2 }}>
        {[0, 1].map(i => <span key={i} style={{ position: 'absolute', bottom: i * 2.4, width: 12, height: 5, borderRadius: '50%', background: '#B4353A', border: '1px solid rgba(0,0,0,0.5)', boxSizing: 'border-box' }}/>)}
      </div>
      {/* the one label the table needs, and it is the opposite of a money line */}
      <div style={{ position: 'absolute', left: FLAT.table.cx + 30, top: FLAT.table.cy - 28, zIndex: 3, whiteSpace: 'nowrap', padding: '2px 5px', borderRadius: 3, background: 'rgba(8,12,12,0.86)', border: '1px solid rgba(255,255,255,0.07)' }}>
      </div>
      {players.map((p, i) => {
        const said = (Array.isArray(says) ? says : says ? [says] : []).find(s => s.i === i);
        return (
          <HomeOne key={p.a.id} a={p.a} at={seats[i]} size={i === 0 ? 50 : 44} dealt routine="game" stamina={p.stamina} heat={p.heat}
            says={said && said.text} side={said && (said.side || (seats[i].x < FLAT.table.cx ? 'left' : 'right'))}/>
        );
      })}
    </>
  );
};

const YouAvatar = ({ unread, count }) => (
  <div style={{ position: 'relative', width: 30, height: 30, borderRadius: 15, background: 'rgba(255,255,255,0.05)', border: `1px solid ${unread ? `${M_GOLD}77` : M_BORDER_2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={unread ? M_GOLD : M_DIM} strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 21c0-4.1 3.4-7.5 7.5-7.5s7.5 3.4 7.5 7.5"/></svg>
    {count ? <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7, background: M_GOLD, color: '#0A0A0A', fontFamily: MONO, fontSize: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span> : null}
  </div>
);

const HomeHead = ({ sub, right, you, unread, count }) => (
  <div style={{ flexShrink: 0, height: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
    <SpadeLogo/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, lineHeight: 1.1 }}>Home</div>
      <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>{sub}</div>
    </div>
    {right}
    {you && <YouAvatar unread={unread} count={count}/>}
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
    <HomeHead sub="one agent · nobody else home"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={3}/>
        <HomeOne a={H_CAST.bal} at={STAND.couch} routine="tv" size={52} stamina={88} heat={14}
          says="Nobody home. I'll wait."/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.bal, text: 'The house never folds. Fine by me.' }}/>
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
        <HomeGame players={[{ a: H_CAST.bal, stamina: 86, heat: 16 }, { a: H_CAST.val, stamina: 34, heat: 48 }]}
          says={{ i: 1, text: 'You always raise that. Always.' }}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.val, text: 'You always raise that. Always.' }}/>
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
          {[0, 1].map(i => <CardBack key={i} w={14} h={19}/>)}
        </div>
        <div style={{ position: 'absolute', left: FLAT.table.cx, top: FLAT.table.cy + 40, transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>NOBODY AT THE TABLE</span>
        </div>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.agg, text: 'Still here. 41 minutes in.' }}/>
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
        <HomeOne a={{ ...H_CAST.blf, mood: 'confident' }} at={STAND.door} routine="wait" size={48} stamina={40} heat={36}
          unread="Got a minute? That last hour was something."/>
        <HomeOne a={H_CAST.bal} at={STAND.lounge} size={44} stamina={78} heat={14}/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={44} stamina={16} heat={26}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.blf, text: 'Got a minute? That last hour was something.' }}/>
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
        <div style={{ position: 'absolute', ...clearOf(FLAT.door, 'left', 14), top: FLAT.door.y - 34, zIndex: 40 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.2em', color: M_MUTED }}>SESSION OVER</div>
          <Num size={22} weight={700} color={M_TEAL}>+$2,740</Num>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 10, color: M_MUTED }}>pocket</span>
            <Num size={13} weight={700} color={M_TEXT}>$4,180</Num>
          </div>
        </div>
        <HomeOne a={{ ...H_CAST.agg, mood: 'confident' }} at={{ x: 300, y: 330 }} size={52} name={false}/>
        <HomeOne a={H_CAST.bal} at={STAND.lounge} size={44} stamina={74} heat={18}/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={42} stamina={14} heat={24}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeToast a={{ ...H_CAST.agg, mood: 'confident' }} text="is home. +$2,740 · pocket $4,180."/>
    <HomeThread latest={{ a: H_CAST.blf, text: 'Still out. 12 minutes in.' }}/>
  </PhoneShell>
);

Object.assign(window, {
  NAV3, Nav3, H_CAST, H_ROUTINE, NATURE_ROUTINE, routineFor,
  F_W, F_H, SHEET_COLLAPSED, FLAT, STAND, clearOf, travelTo, TABLE_SEATS, HomeFlat, H_BUB_W, H_BUB_MAX, staminaCol, heatCol, YouAvatar, H_BUB_GAP, H_PILL_HALF, bubAnchor, bubRoom, H_BOUND, H_EDGE, edgePin, bubbleSide, sideFor, HomeBubble,
  DoorTap, findAway, RoutineProp, ResourceBars, HomeOne, AwayFrame, AwayWall, HomeGame, HomeHead,
  H_VERBS, HomeVerbsStripM, DoorStrip, HomeExitStripM, HomeReturnStripM,
  HomeAloneM, HomeGameM, HomeAllAwayM, HomeRecapWaitM, HomeReturnM,
});
