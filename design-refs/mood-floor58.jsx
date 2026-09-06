// ═════════════════════════════════════════════════════════════════
// WAVE 58 · THE FLOOR, and the SAFE
//
// THE FLOOR is what the casino has been missing: a room you look into. Board 27's
// casino was three doorways and a board — accurate, and completely abstract. This
// is the floor itself from above, six to eight live felts with tiny bodies in the
// seats, a bar with a few standing at it, and the board by the stairs. The only
// text on it is the stakes per felt, because a floor you have to read is a list.
//
// It is never a map of all 1,600: it is the room you are standing in, and the rest
// of the building is upstairs and behind the back-room door.
// ═════════════════════════════════════════════════════════════════

const FLOOR_W = 390, FLOOR_H = 470;

// six felts, hand-placed so no two rims touch and the walkways read as walkways
const MINI_FELTS = [
  { id: 'f1', x: 64,  y: 108, r: 44, stake: '10/20',  n: 5, mine: 0, hot: false },
  { id: 'f2', x: 190, y: 88,  r: 40, stake: '10/20',  n: 4 },
  { id: 'f3', x: 314, y: 112, r: 44, stake: '25/50',  n: 6, hot: true },
  { id: 'f4', x: 70,  y: 236, r: 42, stake: '10/20',  n: 3 },
  { id: 'f5', x: 196, y: 220, r: 46, stake: '25/50',  n: 5, mine: 2 },
  { id: 'f6', x: 320, y: 244, r: 40, stake: '50/100', n: 4 },
];

// a body at floor scale is 14px: a hood, two eyes, nothing else. Any more detail at
// this size is noise, and the face system's own tiers already say so.
const TinyGhost = ({ i = 0, mine, hot }) => {
  const id = HOODS[(i * 5 + 1) % 6], gl = mine ? M_TEAL : GLOWS[(i * 3) % 6];
  return (
    <svg width="14" height="14" viewBox="0 0 80 80" style={{ display: 'block', animation: `bob ${4 + (i % 3)}s ease-in-out ${i * 0.4}s infinite` }}>
      <path d="M40 8 C58 8 70 20 70 38 L70 68 C70 76 62 75 58 79 C54 83 46 83 40 79 C34 83 26 83 22 79 C18 75 10 76 10 68 L10 38 C10 20 22 8 40 8Z"
        fill={id.top} stroke={mine ? `${M_TEAL}99` : 'rgba(0,0,0,0.5)'} strokeWidth={mine ? 4 : 2}/>
      <ellipse cx="29" cy="40" rx="6" ry={hot ? 4 : 7} fill={mine ? M_TEAL : gl.c}/>
      <ellipse cx="51" cy="40" rx="6" ry={hot ? 4 : 7} fill={mine ? M_TEAL : gl.c}/>
    </svg>
  );
};

// one felt, seen from above: an ellipse, bodies around its rim, a pot dot. Its only
// label is the stake, and its only state is hot or not.
const MiniFelt = ({ f, on }) => {
  const seats = Array.from({ length: f.n });
  return (
    <div style={{ position: 'absolute', left: f.x, top: f.y, width: f.r * 2, height: f.r * 1.5, transform: 'translate(-50%,-50%)', cursor: 'pointer' }}>
      {f.hot && <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: `radial-gradient(ellipse, ${M_RED}2E 0%, transparent 68%)`, animation: 'shimmer 2.4s ease-in-out infinite' }}></div>}
      {on && <div style={{ position: 'absolute', inset: -9, borderRadius: '50%', border: `1px solid ${M_TEAL}`, boxShadow: `0 0 14px ${M_TEAL}55` }}></div>}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: f.hot
        ? `radial-gradient(ellipse at 50% 38%, #3A4A42 0%, #22302C 74%)`
        : `radial-gradient(ellipse at 50% 38%, #2E3F3A 0%, #1C2825 76%)`,
        border: `1px solid ${f.hot ? `${M_RED}5C` : 'rgba(255,255,255,0.09)'}`, boxShadow: '0 5px 14px rgba(0,0,0,0.5)' }}></div>
      {/* the pot, one gold dot at the centre — the smallest thing that says money */}
      <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-50%)', width: f.hot ? 7 : 5, height: f.hot ? 7 : 5, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 ${f.hot ? 9 : 5}px ${M_GOLD}` }}></div>
      {seats.map((_, i) => {
        // the dealer's gap, centred on the bottom axis, sized to clear a stake label
        const gap = 1.0;
        const th = (Math.PI / 2 + gap / 2) + (i + 0.5) * (Math.PI * 2 - gap) / f.n;
        return (
          <div key={i} style={{ position: 'absolute', left: `${50 + Math.cos(th) * 52}%`, top: `${50 + Math.sin(th) * 56}%`, transform: 'translate(-50%,-50%)' }}>
            <TinyGhost i={i + f.x} mine={f.mine === i} hot={f.hot}/>
          </div>
        );
      })}
      {/* the one label a felt is allowed */}
      <div style={{ position: 'absolute', left: '50%', bottom: -13, transform: 'translateX(-50%)', fontFamily: MONO, fontSize: 8, color: f.hot ? M_RED : M_MUTED, whiteSpace: 'nowrap' }}>{f.stake}</div>
    </div>
  );
};

// the bar: a counter along the bottom wall with a few standing at it. Nobody at the
// bar is playing, which is the point of drawing it at all.
const FloorBar = () => (
  <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12, height: 54 }}>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, borderRadius: '4px 4px 2px 2px', background: 'linear-gradient(180deg, #2A2118 0%, #1A140E 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: `0 -3px 14px ${M_GOLD}14` }}></div>
    <div style={{ position: 'absolute', left: 18, right: 18, bottom: 24, display: 'flex', gap: 16 }}>
      {[0, 1, 2, 3].map(i => <TinyGhost key={i} i={i * 7 + 3}/>)}
    </div>
    <div style={{ position: 'absolute', right: 8, bottom: 7, fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.16em', color: `${M_GOLD}B3` }}>THE BAR</div>
  </div>
);

// the stairs, and the board bolted beside them
const FloorStairs = () => (
  <div style={{ position: 'absolute', right: 10, top: 10, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 34 }}>
      {[9, 14, 19, 24, 29, 34].map((h, i) => (
        <div key={h} style={{ width: 5, height: h, borderRadius: '2px 2px 0 0', background: `linear-gradient(180deg, rgba(205,179,128,${0.06 + i * 0.02}) 0%, rgba(255,255,255,0.02) 100%)`, borderTop: '1px solid rgba(255,255,255,0.08)' }}></div>
      ))}
    </div>
    <div style={{ width: 58, borderRadius: 3, background: 'linear-gradient(180deg, #171310 0%, #100D0B 100%)', border: `1px solid ${M_GOLD}3D`, padding: '4px 5px' }}>
      <div style={{ fontFamily: OSWALD, fontSize: 6, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>THE BOARD</div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ marginTop: 3, height: 2, borderRadius: 1, background: i ? 'rgba(255,255,255,0.13)' : `${M_GOLD}88`, width: i ? `${72 - i * 18}%` : '100%' }}></div>
      ))}
    </div>
  </div>
);

const TheFloor = ({ on, w = FLOOR_W, h = FLOOR_H }) => {
  const k = w / FLOOR_W;
  return (
    <div style={{ width: w, height: h, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 40%, #17201E 0%, #101715 62%, #0B100F 100%)' }}>
      <div style={{ width: FLOOR_W, height: h / k, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative' }}>
        {/* the carpet, running away from the door */}
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 40 + i * 42, height: 1, background: 'rgba(255,255,255,0.022)' }}></div>
        ))}
        <FloorStairs/>
        {MINI_FELTS.map(f => <MiniFelt key={f.id} f={f} on={on === f.id}/>)}
        <FloorBar/>
      </div>
    </div>
  );
};

// F17 · through the door: the floor, and one of yours in it
const FloorScreenM = () => (
  <PhoneShell>
    <div style={{ flexShrink: 0, minHeight: 52, display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, cursor: 'pointer' }}>← HOME</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, lineHeight: 1.3, whiteSpace: 'nowrap' }}>The floor</div>
        <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>6 tables · Bal at 25/50</div>
      </div>
      <YouAvatar/>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, display: 'flex', flexDirection: 'column' }}>
      <TheFloor on="f5" h={470}/>
      <div style={{ flex: 1, minHeight: 0, padding: '10px 12px 0' }}><LiveNow items={NAV_LIVE.slice(0, 2)}/></div>
    </div>
    <HomeThread latest={{ a: H_CAST.bal, text: 'This table is soft. I am staying.' }}/>
  </PhoneShell>
);

// F17b · pinching in on a felt: the rim lights, and the next frame is the Watch screen
const FloorZoomM = () => (
  <PhoneShell>
    <div style={{ flexShrink: 0, minHeight: 52, display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, cursor: 'pointer' }}>← THE FLOOR</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, lineHeight: 1.3, whiteSpace: 'nowrap' }}>Table 5 · 25/50</div>
        <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>pinch again to watch</div>
      </div>
      <YouAvatar/>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, position: 'relative' }}>
      {/* the same floor, pushed in on one felt. Zoom is a camera move, not a screen
          change: the felt you were looking at grows into the one you watch. */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%) scale(2.3)', transformOrigin: '50% 46%' }}>
        <TheFloor on="f5" h={470}/>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 46% 34% at 50% 46%, transparent 0%, rgba(6,10,9,0.78) 78%)', pointerEvents: 'none' }}></div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL, background: 'rgba(8,12,12,0.9)', border: `1px solid ${M_TEAL}66`, borderRadius: 9, padding: '7px 14px' }}>WATCH THIS TABLE</span>
      </div>
    </div>
  </PhoneShell>
);

// ═══ 8 · THE SAFE ═════════════════════════════════════════════════════════
// The money sheet was a per-agent grid: four pockets, four rules, four figures, and
// the balance somewhere among them. Opening a safe should answer one question — how
// much is in it — and offer the three things you can do about it. Everything else is
// history, and history belongs in a ledger you pull up, one line per event, each
// line saying what the number WAS. No figure floats without its cause.

const SAFE_TONIGHT = [
  { k: 'Brought home', v: '+2,740', c: M_TEAL, note: 'Bluff, 41 minutes at 25/50' },
  { k: 'Spent at the fridge', v: '−180', c: M_MUTED, note: '6 beers, 3 snacks' },
  { k: 'Given out', v: '−2,000', c: M_MUTED, note: "Aggro's pocket, topped up twice" },
];

const SAFE_LEDGER = [
  { t: '23:14', k: 'Bluff came home', v: '+2,740', c: M_TEAL },
  { t: '22:58', k: 'Beer × 2 — Aggro asked', v: '−60', c: M_MUTED },
  { t: '22:31', k: "Topped up Aggro's pocket", v: '−1,000', c: M_MUTED },
  { t: '21:47', k: 'Value came home', v: '+310', c: M_TEAL },
  { t: '21:02', k: 'Snack × 3', v: '−120', c: M_MUTED },
  { t: '20:40', k: "Topped up Aggro's pocket", v: '−1,000', c: M_MUTED },
  { t: '19:55', k: 'Bal came home', v: '+340', c: M_TEAL },
  { t: '19:20', k: 'Bought the 2nd seat', v: '−10,000', c: M_GOLD },
];

const SAFE_VERBS = [
  { k: 'GIVE', note: 'to a pocket', c: M_TEAL },
  { k: 'TAKE', note: 'winnings out', c: M_GOLD },
  { k: 'RULES', note: 'per agent', c: M_DIM },
];

const SafeSheet = ({ ledger }) => (
  <div style={{ width: 390, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderRadius: '16px 16px 0 0', fontFamily: INTER, padding: '10px 0 20px' }}>
    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 11 }}>
      <span style={{ width: 30, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></span>
    </div>

    {/* ONE NUMBER. It is what is in the safe, and it needs no label beyond that. */}
    <div style={{ textAlign: 'center', padding: '0 14px 4px' }}>
      <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.2em', color: M_MUTED }}>IN THE SAFE</div>
      <div style={{ marginTop: 3 }}><Amt size={44} color={M_GOLD}>$54,000</Amt></div>
    </div>

    {/* THREE VERBS. Everything you can do to the number, and nothing you cannot. */}
    <div style={{ display: 'flex', gap: 7, padding: '12px 14px 0' }}>
      {SAFE_VERBS.map(v => (
        <div key={v.k} style={{ flex: 1, textAlign: 'center', borderRadius: 11, border: `1px solid ${v.c}4D`, background: `${v.c}0F`, padding: '9px 0 8px', cursor: 'pointer' }}>
          <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: v.c }}>{v.k}</div>
          <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 2 }}>{v.note}</div>
        </div>
      ))}
    </div>

    {/* TONIGHT, in three lines. Every figure carries the sentence that caused it —
        a floating "+2,000" is a number the owner has to reconstruct. */}
    <div style={{ padding: '15px 14px 0' }}>
      <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED, paddingBottom: 8 }}>TONIGHT</div>
      {SAFE_TONIGHT.map(r => (
        <div key={r.k} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '7px 0', borderTop: `1px solid ${M_BORDER}` }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: M_TEXT }}>{r.k}</div>
            <div style={{ fontSize: 10, color: M_MUTED, marginTop: 1.5 }}>{r.note}</div>
          </div>
          <Num size={13} weight={700} color={r.c}>{r.v}</Num>
        </div>
      ))}
    </div>

    {ledger ? (
      <div style={{ padding: '14px 14px 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 7 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD }}>THE LEDGER</span>
          <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED }}>newest first</span>
        </div>
        {SAFE_LEDGER.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ flexShrink: 0, width: 34, fontFamily: MONO, fontSize: 9.5, color: M_MUTED }}>{r.t}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: M_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.k}</span>
            <Num size={11} weight={700} color={r.c}>{r.v}</Num>
          </div>
        ))}
      </div>
    ) : (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: M_DIM, cursor: 'pointer' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="2.6" strokeLinecap="round"><path d="M6 15l6-6 6 6"/></svg>
          PULL UP FOR THE LEDGER
        </span>
      </div>
    )}
  </div>
);

const SafeSheetM = () => <FromFixture sheet={<SafeSheet/>} room={<HomeFlat><AwayWall hooks={3}/><TableChairs taken={2}/><HomeOne a={H_CAST.bal} at={STAND.lounge} size={44} stamina={78} heat={14}/><DoorTap/></HomeFlat>}/>;
const SafeLedgerM = () => <FromFixture sheet={<SafeSheet ledger/>} room={<HomeFlat><AwayWall hooks={3}/><TableChairs taken={2}/><DoorTap/></HomeFlat>}/>;

Object.assign(window, {
  FLOOR_W, FLOOR_H, MINI_FELTS, TinyGhost, MiniFelt, FloorBar, FloorStairs, TheFloor,
  FloorScreenM, FloorZoomM,
  SAFE_TONIGHT, SAFE_LEDGER, SAFE_VERBS, SafeSheet, SafeSheetM, SafeLedgerM,
});
