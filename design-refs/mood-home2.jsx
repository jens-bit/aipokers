// HOME v3 — wants, motion, the home thread, the tape room.
// Loads after mood-home.jsx and uses its fixtures (FLAT, STAND, clearOf, travelTo,
// edgePin) rather than any new coordinate system. Round 2's lesson, applied: an
// element's edge is anchored to a fixture's edge, never centred on a guessed x.

// ── WANTS ─────────────────────────────────────────────────────────────────
// One active want per agent, phrased from his state, spoken as his bubble. Three
// chips answer it. Never a bar, never a meter: a want is a sentence you can say no
// to, and saying no costs nothing — that is the whole difference from a need.
const H_WANTS = {
  dare:   { text: 'Let me back in there. Right now.', heat: 82, tone: 'dare',  from: 'tilted · heat 82 · lost 3 big pots to Granite' },
  stakes: { text: 'I can handle 25/50. Ask my pocket.', heat: 44, tone: 'ask', from: 'confident · up 4 sessions' },
  rest:   { text: 'I am done for tonight.',            heat: 12, tone: 'flat', from: 'worn · 214 hands' },
  tape:   { text: 'Put the Granite hand on. I want to see it again.', heat: 38, tone: 'ask', from: 'frustrated · one flagged hand' },
};

const WANT_CHIPS = [
  { k: 'yes',   lbl: 'Go on then', color: M_TEAL },
  { k: 'later', lbl: 'Later',      color: M_MUTED },
  { k: 'no',    lbl: 'No',         color: M_RED },
];

// the dare reads as a dare through HEAT, not through a red border: the bubble's rim
// warms with his heat and the words get bigger. At 82 it is a challenge; the same
// component at 12 is a mumble.
const WantBubble = ({ w, side = 'right', maxW = H_BUB_MAX }) => {
  // one rim tint at most, and no glow: same box as any other bubble in the room
  const rim = w.heat >= 70 ? `${M_RED}55` : w.tone === 'flat' ? M_BORDER : `${M_GOLD}55`;
  const fill = 'rgba(20,28,27,0.94)';
  return (
    <div style={{ position: 'relative', width: 'max-content', maxWidth: Math.min(H_BUB_MAX, maxW), padding: '7px 10px 8px', borderRadius: 12, background: fill, border: `1px solid ${rim}`, animation: 'bubblein 0.3s ease-out both' }}>
      <span style={{ position: 'absolute', top: '50%', marginTop: -4, [side === 'right' ? 'left' : 'right']: -4, width: 7, height: 7, background: fill, borderLeft: `1px solid ${rim}`, borderBottom: `1px solid ${rim}`, transform: 'rotate(45deg)' }}></span>
        <div style={{ fontSize: 11, color: M_TEXT, lineHeight: 1.35 }}>{w.text}</div>
    </div>
  );
};

// one queue, two kinds of entry
const TOASTS = {
  want:   { kind: 'want',   ttl: '4s + waits for an answer' },
  status: { kind: 'status', ttl: '4s' },
};

const HomeToast = ({ a, text, want, queued = 0 }) => (
  <div style={{ flexShrink: 0, height: 0, overflow: 'visible', position: 'relative', zIndex: 40 }}>
  <div style={{ position: 'absolute', left: 10, right: 10, bottom: 7, borderRadius: 12, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, border: `1px solid ${want ? `${M_GOLD}55` : 'rgba(255,255,255,0.13)'}`, padding: '8px 10px 9px', animation: 'rise 0.3s ease-out both' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}><MoodAvatar mood={a.mood} accent={a.accent} size={20}/></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: M_TEXT, lineHeight: 1.35 }}>
          <b style={{ color: a.accent, fontWeight: 600 }}>{a.name.split(' ')[0]}</b> {text}
        </div>
        {want && (
          <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
            {WANT_CHIPS.map(c => (
              <span key={c.k} style={{ flexShrink: 0, whiteSpace: 'nowrap', fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: c.color, border: `1px solid ${c.color}66`, background: `${c.color}14`, borderRadius: 10, padding: '4px 10px', cursor: 'pointer' }}>{c.lbl}</span>
            ))}
          </div>
        )}
      </div>
      {queued > 0 && <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 8, color: M_MUTED, marginTop: 3 }}>+{queued}</span>}
    </div>
  </div>
  </div>
);

// ── MOTION ────────────────────────────────────────────────────────────────
// Four walks. A position change is a walk; a cut is a bug. Each strip states its
// start and end against the fixtures, so the path is derivable rather than drawn.
const WALKS = {
  out: {
    title: 'Sent out', dur: '2.2s', accent: M_PINK,
    from: 'the table', to: 'through the door',
    steps: [
      { p: 0.10, s: 1, note: 'he stands; the door unlatches' },
      { p: 0.52, s: 1, note: 'crosses the floor — the home game is already reseating' },
      { p: 0.88, s: 0.72, o: 0.4, door: 'open', note: 'out. The door closes behind him and his frame lights on the wall' },
    ],
  },
  home: {
    title: 'Coming home', dur: '1.9s', accent: M_PURPLE,
    from: 'the door', to: 'a seat at the table',
    steps: [
      { p: 0.90, s: 0.72, o: 0.5, door: 'open', money: true, note: 'the door opens; the session line is above him already' },
      { p: 0.5, s: 1, money: true, note: 'he walks in with it' },
      { p: 0.14, s: 1, note: 'and sits down where the game is' },
    ],
  },
  game: {
    title: 'The game starts', dur: '1.6s', accent: M_TEAL,
    from: 'the couch', to: 'the far seat',
    steps: [
      { p: 0.06, s: 0.86, note: 'a second agent comes home, so he gets up off the couch' },
      { p: 0.34, s: 0.94, note: 'round the table' },
      { p: 0.5, s: 1, seated: true, note: 'sits, and the deal happens on its own' },
    ],
  },
  sulk: {
    title: 'Off to sulk', dur: '2.4s', accent: M_RED,
    from: 'the table', to: 'the wall',
    steps: [
      { p: 0.5, s: 1, note: 'he loses the last of his pocket' },
      { p: 0.3, s: 0.94, note: 'gets up and walks away from the table — slowly, this one' },
      { p: 0.18, s: 0.94, back: true, note: 'and stands facing the wall. No timer on it; he comes back when he comes back' },
    ],
  },
};

const WalkStrip = ({ kind }) => {
  const w = WALKS[kind];
  return (
    <div style={{ width: 390, background: '#101817', fontFamily: INTER, borderRadius: 4, padding: '14px 0 16px' }}>
      <div style={{ padding: '0 14px 11px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: PLAYFAIR, fontSize: 13, fontWeight: 600, color: M_TEXT }}>{w.title}</span>
          <Num size={9} weight={600} color={w.accent}>{w.dur}</Num>
        </div>
        <div style={{ fontSize: 11, color: M_MUTED, marginTop: 4 }}>{w.from} → {w.to}</div>
      </div>
      {w.steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ position: 'relative', width: 150, height: 66, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(180deg, #17201E 0%, #0F1514 100%)', border: `1px solid ${M_BORDER}` }}>
            {/* the fixtures this walk is measured against, at 150/390 scale */}
            <div style={{ position: 'absolute', left: 4, top: 34, width: 30, height: 26, borderRadius: 3, background: '#241D26', border: '1px solid rgba(255,255,255,0.05)' }}></div>
            <div style={{ position: 'absolute', left: 47, top: 22, width: 62, height: 24, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 38%, #33413C, #1B2422)', border: '1px solid rgba(255,255,255,0.06)' }}></div>
            <div style={{ position: 'absolute', right: 0, top: 14, width: 13, height: 34, borderRadius: '2px 0 0 2px', background: s.door === 'open' ? `linear-gradient(90deg, #2A2622, ${M_GOLD}44)` : 'linear-gradient(90deg, #1B1917, #2A2622)', borderLeft: `1px solid ${M_GOLD}${s.door === 'open' ? '99' : '33'}` }}></div>
            {s.money && <div style={{ position: 'absolute', left: 6, top: 4, fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: M_TEAL }}>+$2,740</div>}
            <div style={{ position: 'absolute', left: s.p * 150, bottom: s.seated ? 26 : 6, transform: 'translateX(-50%)', opacity: s.o != null ? s.o : 1 }}>
              {s.back
                ? <svg width={26 * s.s} height={26 * s.s} viewBox="0 0 80 80"><path d="M40 6 C57.6 6 70 18.4 70 36 L70 70 C70 78.4 62.4 76.8 57.6 81.6 C53.6 85.6 46.4 85.6 40 81.6 C33.6 85.6 26.4 85.6 22.4 81.6 C17.6 76.8 10 78.4 10 70 L10 36 C10 18.4 22.4 6 40 6 Z" fill="#161F1E" stroke={`${w.accent}44`} strokeWidth="2"/></svg>
                : <MoodGhost mood={kind === 'sulk' ? 'sulking' : 'confident'} accent={w.accent} size={26 * s.s} ring={false}/>}
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 11, color: M_DIM, lineHeight: 1.4 }}>{s.note}</div>
        </div>
      ))}
    </div>
  );
};

// ── THE HOME THREAD ───────────────────────────────────────────────────────
// The grey block under the room becomes a glass sheet, same material and height
// rule as the watch thread, sitting where the keyboard will be. A message here is
// heard by EVERYONE at home — which is why every answer is attributed.
const H_SHEET = { collapsed: SHEET_COLLAPSED, open: 356 };

// one collapsed line per day, and every line inside it says who said it to whom
const HomeNightly = ({ day, open }) => (
  <div style={{ borderRadius: 9, background: 'rgba(255,255,255,0.03)', border: `1px solid ${M_BORDER}`, padding: open ? '8px 10px 9px' : '7px 10px', cursor: 'pointer' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>WHILE YOU WERE OUT</span>
      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: M_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {day.who} talked <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED }}>· {day.lines.length} lines</span>
      </span>
      <span style={{ flexShrink: 0, fontSize: 8, color: M_MUTED, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
    </div>
    {open && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
        {day.lines.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <span style={{ flexShrink: 0, fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
              <span style={{ color: l.fromAccent }}>{l.from}</span>
              <span style={{ color: M_FAINT }}> → </span>
              <span style={{ color: l.toAccent }}>{l.to}</span>
            </span>
            <span style={{ flex: 1, fontSize: 11, color: M_DIM, lineHeight: 1.4 }}>{l.text}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const HomeThreadLine = ({ a, text, sys }) => sys ? (
  <div style={{ alignSelf: 'center', padding: '4px 9px', borderRadius: 8, background: `${M_GOLD}12`, border: `1px solid ${M_GOLD}33` }}>
    <span style={{ fontFamily: MONO, fontSize: 9, color: M_GOLD }}>{text}</span>
  </div>
) : (
  <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
    <div style={{ flexShrink: 0, marginTop: 1 }}><MoodAvatar mood={a.mood} accent={a.accent} size={20}/></div>
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 9, color: a.accent, fontWeight: 600 }}>{a.name.split(' ')[0]}</span>
      </div>
      <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.45, marginTop: 1 }}>{text}</div>
    </div>
  </div>
);

const YouLine = ({ text }) => (
  <div style={{ alignSelf: 'flex-end', maxWidth: 264, padding: '7px 10px', borderRadius: 12, borderBottomRightRadius: 3, background: `${M_TEAL}1A`, border: `1px solid ${M_TEAL}44` }}>
    <div style={{ fontSize: 11.5, color: M_TEXT, lineHeight: 1.4 }}>{text}</div>
  </div>
);

const HomeThread = ({ open, latest, lines, nightly, nightlyOpen }) => (
  <div style={{ flexShrink: 0, height: open ? H_SHEET.open : H_SHEET.collapsed, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, display: 'flex', flexDirection: 'column' }}>
    {open ? (
      <>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px 7px', borderBottom: `1px solid ${M_BORDER}` }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_TEAL }}>THE ROOM</span>
          <span style={{ fontSize: 9.5, color: M_MUTED }}>everyone at home hears this</span>
          <span style={{ marginLeft: 'auto', width: 26, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }}></span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '10px 13px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {nightly && <HomeNightly day={nightly} open={nightlyOpen}/>}
          {lines.map((l, i) => l.you ? <YouLine key={i} text={l.text}/> : <HomeThreadLine key={i} a={l.a} text={l.text} sys={l.sys}/>)}
        </div>
      </>
    ) : (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0 13px' }}>
        {latest.sys
          ? <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: M_FAINT, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{latest.text}</span>
          : <>
              <MoodAvatar mood={latest.a.mood} accent={latest.a.accent} size={20}/>
              <div style={{ flex: 1, minWidth: 0, fontSize: 11, color: M_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <b style={{ color: latest.a.accent, fontWeight: 600 }}>{latest.a.name.split(' ')[0]}</b> {latest.text}
              </div>
            </>}
      </div>
    )}
    <div style={{ flexShrink: 0, padding: '8px 12px 11px', borderTop: open ? `1px solid ${M_BORDER}` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 36, borderRadius: 18, padding: '0 5px 0 13px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${M_BORDER}` }}>
        <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>Say something to the room…</span>
        <span style={{ width: 26, height: 26, borderRadius: '50%', background: M_TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06100E" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg>
        </span>
      </div>
    </div>
  </div>
);

const HOME_READ_BOOK = {
  opp: 'Granite', accent: M_GOLD, hands: 142,
  lines: [
    { t: 'never folds a river raise',        when: 'tonight',   fresh: true },
    { t: 'calls one street too many',        when: '3 days ago' },
    { t: 'plays every hand from the blinds', when: 'last week' },
  ],
};

const ReadBookSheet = ({ b = HOME_READ_BOOK }) => (
  <div style={{ width: 390, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderRadius: '16px 16px 0 0', fontFamily: INTER, padding: '10px 0 14px' }}>
    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 9 }}>
      <span style={{ width: 30, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 14px 3px' }}>
      <span style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT }}>{b.opp}</span>
      <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: b.accent }}>{b.lines.length} READS</span>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 9, color: M_MUTED }}>{b.hands} hands</span>
    </div>
    <div style={{ padding: '6px 14px 0' }}>
      {b.lines.map(l => (
        <div key={l.t} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '7px 0', borderTop: `1px solid ${M_BORDER}` }}>
          <span style={{ color: l.fresh ? M_TEAL : M_FAINT, fontSize: 10, lineHeight: 1.4 }}>·</span>
          <span style={{ flex: 1, fontSize: 12, color: l.fresh ? M_TEXT : M_DIM, lineHeight: 1.4 }}>{l.t}</span>
          <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 8.5, color: M_MUTED }}>{l.when}</span>
        </div>
      ))}
    </div>
    <div style={{ padding: '9px 14px 0' }}>
      <span style={{ fontSize: 10.5, color: M_MUTED, lineHeight: 1.5 }}>His own notes, in his own words. They change how he plays Granite and what he says about him — <b style={{ color: M_DIM }}>they are not an attribute and they move nothing on his bars</b>.</span>
    </div>
  </div>
);

const HOME_POCKETS = [
  { a: 'blf', have: 4180, won: 2740, rule: 'auto-refill · cap $5,000', state: 'out' },
  { a: 'agg', have: 1240, won: 0,    rule: 'allowance · $2,000',       state: 'home' },
  { a: 'val', have: 0,    won: 0,    rule: 'cut off',                   state: 'broke' },
];

const HomeMoneySheet = ({ cast = H_CAST }) => (
  <div style={{ width: 390, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderRadius: '16px 16px 0 0', fontFamily: INTER, padding: '10px 0 14px' }}>
    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 9 }}>
      <span style={{ width: 30, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 14px 10px' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>THE SAFE</span>
      <Num size={19} weight={700} color={M_GOLD}>$54,000</Num>
      <span style={{ marginLeft: 'auto', fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: M_TEAL, border: `1px solid ${M_TEAL}55`, background: `${M_TEAL}12`, borderRadius: 10, padding: '4px 10px', cursor: 'pointer' }}>ADD CHIPS</span>
    </div>
    {HOME_POCKETS.map(p => {
      const a = cast[p.a], broke = p.state === 'broke';
      return (
        <div key={p.a} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px', borderTop: `1px solid ${M_BORDER}` }}>
          <MoodAvatar mood={broke ? 'sulking' : a.mood} accent={a.accent} size={26}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 11.5, color: M_TEXT }}>{a.name.split(' ')[0]}</span>
              <Num size={11} weight={700} color={broke ? M_MUTED : M_TEXT}>{broke ? '$0' : `$${p.have.toLocaleString()}`}</Num>
            </div>
            <div style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.12em', color: broke ? M_RED : M_MUTED, marginTop: 2 }}>{p.rule.toUpperCase()}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['GIVE', true], ...(p.won ? [[`+$${p.won.toLocaleString()}`, false]] : []), ['ALL', false], ['RULE', false]].map(([k, hot]) => (
              <span key={k} style={{ fontFamily: k[0] === '+' ? MONO : OSWALD, fontSize: k[0] === '+' ? 8.5 : 8, fontWeight: 600, letterSpacing: k[0] === '+' ? 0 : '0.08em', color: hot ? M_GOLD : k[0] === '+' ? M_TEAL : M_MUTED, border: `1px solid ${hot ? `${M_GOLD}55` : k[0] === '+' ? `${M_TEAL}44` : M_BORDER}`, borderRadius: 9, padding: '3.5px 6px', cursor: 'pointer' }}>{k}</span>
            ))}
          </div>
        </div>
      );
    })}
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px 4px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>THE LEDGER</span>
      <span style={{ marginLeft: 'auto', fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', color: M_TEAL, cursor: 'pointer' }}>ALL OF IT →</span>
    </div>
    {[['tonight', 'Bluff Master brought home', '+$2,740', true], ['tonight', 'beer × 4, snack × 2', '−$60', false], ['yesterday', 'Value cut off', '−', false]].map(([w, t, v, up]) => (
      <div key={t} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4.5px 14px' }}>
        <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED, width: 54, flexShrink: 0 }}>{w}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: M_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
        <Num size={10} weight={700} color={up ? M_TEAL : M_MUTED}>{v}</Num>
      </div>
    ))}
  </div>
);

// ── 2 · THE FRIDGE ────────────────────────────────────────────────────────
// Items are furniture: they live in a fixture, are bought from the wallet, and an
// agent fetches them himself. Nothing here touches an attribute.
const HOME_STOCK = [
  { k: 'BEER',  n: 4, cools: 'cools heat',        cost: '$12 each' },
  { k: 'SNACK', n: 2, cools: 'soothes a bad mood', cost: '$8 each' },
];

const FridgeSheet = ({ empty }) => (
  <div style={{ width: 390, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderRadius: '16px 16px 0 0', fontFamily: INTER, padding: '10px 0 14px' }}>
    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 9 }}>
      <span style={{ width: 30, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 14px 8px' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>THE FRIDGE</span>
      <span style={{ fontSize: 10.5, color: M_FAINT }}>bought from the safe</span>
    </div>
    {HOME_STOCK.map(s => {
      const n = empty && s.k === 'BEER' ? 0 : s.n;
      return (
        <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: `1px solid ${M_BORDER}` }}>
          <div style={{ width: 26, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: 22, flexShrink: 0 }}>
            {s.k === 'BEER'
              ? <span style={{ width: 8, height: 20, borderRadius: '2px 2px 3px 3px', background: n ? 'rgba(122,168,138,0.7)' : 'rgba(255,255,255,0.1)', borderTop: `3px solid ${n ? '#7AA88A' : 'rgba(255,255,255,0.14)'}` }}></span>
              : <span style={{ width: 18, height: 13, borderRadius: 2, background: n ? `${M_GOLD}77` : 'rgba(255,255,255,0.1)' }}></span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: n ? M_TEXT : M_MUTED }}>{s.k}</span>
              <Num size={11} weight={700} color={n ? M_TEAL : M_RED}>{n ? `× ${n}` : 'out'}</Num>
            </div>
            <div style={{ fontSize: 10.5, color: M_MUTED, marginTop: 2 }}>{s.cools} · <span style={{ fontFamily: MONO, fontSize: 9.5 }}>{s.cost}</span></div>
          </div>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: M_GOLD, border: `1px solid ${M_GOLD}55`, borderRadius: 10, padding: '4px 10px', cursor: 'pointer' }}>BUY 6</span>
        </div>
      );
    })}
    <div style={{ padding: '10px 14px 0', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6 }}>
      <span style={{ fontSize: 10.5, color: M_MUTED, lineHeight: 1.5 }}>A beer cools <b style={{ color: M_DIM }}>heat</b>; a snack soothes a <b style={{ color: M_DIM }}>bad mood</b>. Neither moves a skill, and an empty fridge is not a punishment — he will simply say so.</span>
    </div>
  </div>
);

// ── 5 · THE SPLIT, IN ONE FRAME ──────────────────────────────────────────
// Two resources on top, because they change hour to hour; four skills below,
// because they change over a month. Same sheet, two different clocks.
const HOME_SKILLS = [
  { k: 'READS',      v: 61, band: [68, 84] },
  { k: 'FOCUS',      v: 54, band: [60, 90] },
  { k: 'DISCIPLINE', v: 50, band: [82, 96] },
  { k: 'DECEPTION',  v: 72, band: [76, 88] },
];

const HomeProfileHeadM = ({ a = H_CAST.blf }) => (
  <div style={{ width: 390, background: '#101817', fontFamily: INTER, borderRadius: 4, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 14px 12px' }}>
      <MoodAvatar mood={a.mood} accent={a.accent} size={44}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT }}>{a.name}</span>
          <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD, border: `1px solid ${M_GOLD}55`, borderRadius: 3, padding: '1.5px 5px' }}>SHOWMAN</span>
        </div>
        <div style={{ marginTop: 7 }}><ResourceBars stamina={44} heat={58} w={124} h={3.5} labels/></div>
      </div>
    </div>
    <div style={{ padding: '0 14px 4px' }}>
      <div style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED, paddingBottom: 4 }}>HOME_SKILLS</div>
      {HOME_SKILLS.map(s => (
        <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: `1px solid ${M_BORDER}` }}>
          <span style={{ width: 66, flexShrink: 0, fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM }}>{s.k}</span>
          <div style={{ position: 'relative', flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.07)' }}>
            <div style={{ position: 'absolute', left: `${s.band[0]}%`, width: `${s.band[1] - s.band[0]}%`, top: 0, bottom: 0, background: 'rgba(205,179,128,0.62)', borderLeft: `1px solid ${M_GOLD}`, borderRight: `1px solid ${M_GOLD}`, borderRadius: 2 }}></div>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${s.v}%`, background: M_TEAL, borderRadius: 3 }}></div>
          </div>
          <Num size={9.5} weight={700} color={M_TEXT}>{s.v}</Num>
        </div>
      ))}
    </div>
    <div style={{ padding: '9px 14px 13px' }}>
      <span style={{ fontSize: 10.5, color: M_MUTED, lineHeight: 1.5 }}>The two bars move within a session and are drawn on his body in the room. The four below move over a month and are drawn only here. <b style={{ color: M_DIM }}>The gold band is the scouted ceiling, never a number on the bar.</b></span>
    </div>
  </div>
);

const NIGHT_DAY = {
  who: 'Balance and Granite',
  lines: [
    { from: 'BALANCE', to: 'GRANITE', fromAccent: M_TEAL,   toAccent: M_GOLD, text: 'You raise every button. Every single one.' },
    { from: 'GRANITE', to: 'BALANCE', fromAccent: M_GOLD,   toAccent: M_TEAL, text: 'And you fold every time. So.' },
    { from: 'BALANCE', to: 'GRANITE', fromAccent: M_TEAL,   toAccent: M_GOLD, text: 'Fair.' },
  ],
};

// ── 4 · FOUR CHAIRS ───────────────────────────────────────────────────────
// The home has four seats at the kitchen table. A locked one shows its price in
// chips he has WON — there is no purchase path, so the only currency is his record.
const HOME_CHAIR_PRICES = [null, '10,000 won', '50,000 won', '250,000 won'];   // shown ONLY in the table sheet

// the chairs ARE the room's four seats: TABLE_SEATS[4], the same coordinates
// HomeGame sits bodies on, with y as the feet. Inventing a ring put chairs where
// nobody ever sits — on the couch, on the door, in the middle of the floor.
const TableChairs = ({ taken = 1, of = 4 }) => {
  return TABLE_SEATS[4].slice(0, of).map((s, i) => i < taken ? null : (
    <div key={i} style={{ position: 'absolute', left: s.x, top: s.y, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 6 }}>
      <div style={{ width: 28, height: 23, borderRadius: 4, border: '1px dashed rgba(255,255,255,0.15)' }}></div>
    </div>
  ));
};

const SheetSection = ({ label, title, sub, cta, ctaColor, children, first }) => (
  <div style={{ padding: first ? '0 14px' : '13px 14px 0', marginTop: first ? 0 : 13, borderTop: first ? 'none' : `1px solid ${M_BORDER}` }}>
    <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED, paddingBottom: 7 }}>{label}</div>
    {children}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: children ? 9 : 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 14, fontWeight: 600, color: M_TEXT }}>{title}</div>
        <div style={{ fontSize: 10.5, color: M_MUTED, lineHeight: 1.4, marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ flexShrink: 0, fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: ctaColor, border: `1px solid ${ctaColor}66`, background: `${ctaColor}14`, borderRadius: 11, padding: '7px 13px', cursor: 'pointer' }}>{cta}</span>
    </div>
  </div>
);

const TableSheet = ({ taken = 2 }) => (
  <div style={{ width: 390, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderRadius: '16px 16px 0 0', fontFamily: INTER, padding: '10px 0 16px' }}>
    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
      <span style={{ width: 30, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></span>
    </div>

    <SheetSection first label="HOME GAME · LIVE" title="Watch the hand" sub={`${taken} at the table · ${4 - taken} chairs free`} cta="WATCH" ctaColor={M_TEAL}>
      <div style={{ height: 92, borderRadius: 10, background: 'radial-gradient(ellipse at 50% 42%, #2C3B36 0%, #1E2A27 66%, #17201E 100%)', border: `1px solid ${M_BORDER}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', top: 28, transform: 'translateX(-50%)', display: 'flex', gap: 3 }}>
          {[['9', '\u2665', M_RED], ['J', '\u2660', '#0F1514'], ['4', '\u2663', '#0F1514']].map(([r, s, c]) => (
            <span key={r + s} style={{ width: 17, height: 24, borderRadius: 2, background: '#E8E6E0', color: c, fontFamily: MONO, fontSize: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{r}<span style={{ fontSize: 8 }}>{s}</span></span>
          ))}
        </div>
        {[[112, 64], [246, 64]].slice(0, taken).map(([x, y], i) => (
          <div key={i} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)' }}>
            <MoodAvatar mood={i ? 'confident' : 'frustrated'} accent={i ? M_TEAL : M_PURPLE} size={22}/>
          </div>
        ))}
      </div>
    </SheetSection>

    <SheetSection label="SIT DOWN" title="Take a chair" sub="Play them yourself. No money in it." cta="SIT DOWN" ctaColor={M_GOLD}/>

    <SheetSection label="CREATE AN AGENT" title={`${taken + 1}${['st', 'nd', 'rd', 'th'][taken]} seat`}
      sub={<span><span style={{ fontFamily: MONO, fontSize: 10.5, color: M_GOLD }}>{HOME_CHAIR_PRICES[taken]}</span> · chips he has won, never bought</span>}
      cta="DRAFT HIM" ctaColor={M_TEAL}/>
  </div>
);

// ═══ SCREENS ═══════════════════════════════════════════════════════════════

// W1 · a want being asked — the dare at heat 82
const HomeWantM = () => (
  <PhoneShell>
    <HomeHead sub="Aggressive v1.3 wants something" right={<F3Pill color={M_RED} bd={`${M_RED}55`}><Num size={9.5} weight={700} color={M_RED}>HEAT 82</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall frames={[{ a: H_CAST.blf, line: '10/20 · −$90 · 12 min' }]} hooks={2}/>
        <HomeOne a={{ ...H_CAST.agg, mood: 'tilted' }} at={{ x: 196, y: 300 }} size={54} routine="pace" stamina={62} heat={82}
          want={<WantBubble w={H_WANTS.dare}/>}/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={42} stamina={18} heat={30}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeToast a={{ ...H_CAST.agg, mood: 'tilted' }} text="wants back in. 25/50." want queued={1}/>
    <HomeThread latest={{ a: H_CAST.val, text: 'Wake me when someone comes home.' }}/>
  </PhoneShell>
);

// W2 · sleeping, with the seventh face
const HomeSleepM = () => (
  <PhoneShell>
    <HomeHead sub="2 asleep · nobody playing"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat lit={false}>
        <AwayWall hooks={3}/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={48} stamina={12} heat={22}/>
        <HomeOne a={{ ...H_CAST.bal, mood: 'sulking' }} at={STAND.lounge} routine="sleep" size={44} stamina={26} heat={16}/>
        <div style={{ position: 'absolute', ...clearOf(FLAT.door, 'left', 14), top: 196, zIndex: 30 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED }}>214 HANDS TODAY</span>
        </div>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.val, text: 'Wake me when someone comes home.' }}/>
  </PhoneShell>
);

// W3 · the thread open, two agents answering the same message
const HomeThreadOpenM = () => (
  <PhoneShell>
    <HomeHead sub="the room · 3 home"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <div style={{ filter: 'brightness(0.62)' }}>
        <HomeFlat>
          <AwayWall frames={[{ a: H_CAST.blf, line: '10/20 · −$90' }]} hooks={2}/>
          <HomeGame players={[{ a: H_CAST.bal }, { a: H_CAST.val }]}/>
        </HomeFlat>
      </div>
    </div>
    <HomeThread open
      nightly={NIGHT_DAY} nightlyOpen
      lines={[
        { sys: true, text: 'AGGRESSIVE V1.3 WANTED BACK IN · YOU SAID LATER' },
        { you: true, text: 'Who wants 25/50 tonight?' },
        { a: { ...H_CAST.agg, mood: 'tilted' }, text: 'Me. Obviously me.' },
        { a: H_CAST.bal, text: 'His pocket is $1,240. That is one buy-in. I would not.' },
        { sys: true, text: 'BLUFF MASTER CAME HOME · +$2,740' },
      ]}/>
  </PhoneShell>
);

// W4 · the tape room in use
const HomeTapeM = () => (
  <PhoneShell>
    <HomeHead sub="Bluff Master is watching tape" right={<F3Pill color={M_TEAL} bd={`${M_TEAL}55`}><Num size={9.5} weight={700} color={M_TEAL}>+3 GRANITE</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat tape>
        <AwayWall frames={[{ a: H_CAST.agg, line: '25/50 · +$340 · 41 min' }]} hooks={2}/>
        <HomeOne a={H_CAST.bal} at={STAND.lounge} size={44} stamina={70} heat={18}/>
        <HomeOne a={{ ...H_CAST.blf, mood: 'frustrated' }} at={STAND.tape} routine="tape" size={46} stamina={44} heat={58}
          says="Watching the Granite hand again."/>
        <div style={{ position: 'absolute', left: 292, top: FLAT.tape.y + 74, transform: 'translateX(-50%)', fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL, zIndex: 40, whiteSpace: 'nowrap' }}>+3 GRANITE</div>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.blf, text: 'I folded the river. I should not have folded the river.' }}/>
  </PhoneShell>
);

const BODY_SCALES = [
  { lbl: 'On the body, in the room', w: 54, labels: false, note: '2.5px bars under the name pill. No numbers: the colour is the reading.' },
  { lbl: 'Profile header', w: 132, labels: true, note: 'The one place the words and the numbers are printed.' },
  { lbl: 'Watch hero strip', w: 34, labels: false, note: 'Smallest instance. Heat is what a spectator watches here.' },
];

const BodyBarsRefM = () => (
  <div style={{ width: 390, background: '#101817', fontFamily: INTER, borderRadius: 4, padding: '14px 0 16px' }}>
    <div style={{ padding: '0 14px 12px' }}>
      <span style={{ fontFamily: PLAYFAIR, fontSize: 13, fontWeight: 600, color: M_TEXT }}>Two resources, three scales</span>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        Stamina and heat are the only attributes drawn outside the profile, because they are the only two that change hour to hour.
      </div>
    </div>
    {BODY_SCALES.map(s => (
      <div key={s.lbl} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ width: 140, flexShrink: 0 }}><ResourceBars stamina={62} heat={74} w={s.w} labels={s.labels} h={s.labels ? 3.5 : 2.5}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: M_TEAL }}>{s.lbl}</div>
          <div style={{ fontSize: 11, color: M_DIM, lineHeight: 1.4, marginTop: 3 }}>{s.note}</div>
        </div>
      </div>
    ))}
    <div style={{ display: 'flex', gap: 16, padding: '12px 14px 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4 }}>
      {[['STAMINA', ['fresh 88', 'settled 54', 'worn 18']], ['HEAT', ['cool 14', 'warm 48', 'hot 82']]].map(([k, vs]) => (
        <div key={k} style={{ flex: 1 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED, marginBottom: 6 }}>{k}</div>
          {vs.map((v, i) => (
            <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <div style={{ width: 44, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                <div style={{ width: k === 'STAMINA' ? ['88%', '54%', '18%'][i] : ['14%', '48%', '82%'][i], height: '100%', background: k === 'STAMINA' ? ['#3FA96B', '#8A9A55', '#6A6A66'][i] : [M_TEAL, M_GOLD, M_RED][i] }}></div>
              </div>
              <span style={{ fontSize: 9.5, color: M_MUTED }}>{v}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

// a sheet opening from a fixture: the room stays visible and dimmed behind it, so
// you can see WHERE the money or the beer is
const FromFixture = ({ sheet, room }) => (
  <PhoneShell>
    <HomeHead sub="the room · 3 home"/>
    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <div style={{ filter: 'brightness(0.5)' }}>{room}</div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>{sheet}</div>
    </div>
  </PhoneShell>
);

const SafeOpenM = () => (
  <FromFixture sheet={<HomeMoneySheet/>} room={
    <HomeFlat>
      <AwayWall frames={[{ a: H_CAST.blf, line: '10/20 · −$90' }]} hooks={2}/>
      <HomeGame players={[{ a: H_CAST.bal }, { a: H_CAST.val }]}/>
    </HomeFlat>}/>
);

const FridgeOpenM = () => (
  <FromFixture sheet={<FridgeSheet/>} room={
    <HomeFlat>
      <AwayWall hooks={3}/>
      <HomeOne a={H_CAST.bal} at={STAND.byTable} size={46} stamina={70} heat={52}/>
    </HomeFlat>}/>
);

// he fetches it himself: asked, walked, opened
const FRIDGE_WALK = [
  { at: STAND.byTable, routine: 'pace',   note: 'You say yes. He gets up — nobody fetches for him.', says: 'Right.' },
  { at: STAND.fridge,  routine: 'fridge', note: 'At the fridge. The door light is the only warm thing in the room.', open: true },
  { at: { x: 250, y: 300 }, routine: 'game', note: 'Back to his seat with the bottle. Heat starts coming down.', bottle: true },
];

const FridgeWalkStripM = () => (
  <div style={{ display: 'flex', gap: 10, width: 1220 }}>
    {FRIDGE_WALK.map((s, i) => (
      <div key={i} style={{ width: 390, flexShrink: 0 }}>
        <div style={{ position: 'relative', height: 300, overflow: 'hidden', borderRadius: 4, border: `1px solid ${M_BORDER}` }}>
          <div style={{ position: 'absolute', left: 0, top: -84 }}>
            <HomeFlat>
              <HomeOne a={{ ...H_CAST.agg, mood: 'tilted' }} at={s.at} routine={s.routine} size={46} stamina={58} heat={s.bottle ? 62 : 80} says={s.says} dealt={s.bottle}/>
              {s.bottle && <div style={{ position: 'absolute', left: 274, top: 288, width: 6, height: 15, borderRadius: '2px 2px 3px 3px', background: 'rgba(122,168,138,0.8)', borderTop: '2px solid #7AA88A', zIndex: 40 }}></div>}
              {s.open && <div style={{ position: 'absolute', left: FLAT.fridge.x + 4, top: FLAT.fridge.y + 4, width: FLAT.fridge.w - 8, height: FLAT.fridge.h - 8, borderRadius: 3, background: `${M_GOLD}1F`, border: `1px solid ${M_GOLD}55`, zIndex: 5 }}></div>}
            </HomeFlat>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: M_MUTED, lineHeight: 1.45, padding: '7px 2px 0' }}>{s.note}</div>
      </div>
    ))}
  </div>
);

// the bottle beside the stack, at the table
const BeerSeatM = () => (
  <PhoneShell>
    <HomeHead sub="the home game · heat coming down"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={3}/>
        <HomeGame players={[{ a: { ...H_CAST.agg, mood: 'frustrated' }, stamina: 58, heat: 62 }, { a: H_CAST.bal, stamina: 80, heat: 18 }]}
          says={{ i: 0, text: 'Fine. One beer and I am fine.' }}/>
        <div style={{ position: 'absolute', left: 244, top: 234, zIndex: 40, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ width: 7, height: 17, borderRadius: '2px 2px 3px 3px', background: 'rgba(122,168,138,0.85)', borderTop: '2.5px solid #7AA88A' }}></span>
          <span style={{ width: 14, height: 7, borderRadius: 2, background: 'rgba(232,230,224,0.5)' }}></span>
        </div>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeToast a={{ ...H_CAST.agg, mood: 'frustrated' }} text="took a beer. Heat 80 → 62."/>
    <HomeThread latest={{ a: H_CAST.bal, text: 'Better. Your raise still stinks.' }}/>
  </PhoneShell>
);

const FridgeEmptyM = () => (
  <PhoneShell>
    <HomeHead sub="the room · fridge empty"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={3}/>
        <HomeOne a={{ ...H_CAST.agg, mood: 'tilted' }} at={{ x: 208, y: 300 }} size={50} routine="pace" stamina={54} heat={74}
          want={<WantBubble w={{ text: "We're out of beer.", heat: 74, tone: 'flat' }}/>}/>
        <HomeOne a={H_CAST.bal} at={STAND.couch} routine="sleep" size={42} stamina={22} heat={16}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeToast a={{ ...H_CAST.agg, mood: 'tilted' }} text="wants a beer. The fridge is empty." want/>
    <HomeThread latest={{ a: H_CAST.agg, text: "We're out of beer." }}/>
  </PhoneShell>
);

const NightlyCollapsedM = () => (
  <PhoneShell>
    <HomeHead sub="the room · yesterday"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <div style={{ filter: 'brightness(0.62)' }}>
        <HomeFlat>
          <AwayWall frames={[{ a: H_CAST.blf, line: '10/20 · −$90' }]} hooks={2}/>
          <HomeGame players={[{ a: H_CAST.bal }, { a: H_CAST.val }]}/>
        </HomeFlat>
      </div>
    </div>
    <HomeThread open nightly={NIGHT_DAY}
      lines={[
        { you: true, text: 'Anything I missed?' },
        { a: H_CAST.bal, text: 'Nothing you would enjoy.' },
      ]}/>
  </PhoneShell>
);

const ChairsM = ({ taken = 1 }) => (
  <PhoneShell>
    <HomeHead sub={`the room · ${taken} of 4 seats`}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={4 - taken}/>
        <TableChairs taken={taken}/>
        {/* the occupants sit on the SAME four-ring the chairs use, so seat 1 taken
            means seat 1 has a body in it */}
        {taken === 1
          ? <HomeOne a={H_CAST.bal} at={TABLE_SEATS[4][0]} size={48} stamina={78} heat={16} says="Quiet in here."/>
          : <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
              players={[{ a: H_CAST.bal, stamina: 78, heat: 16 }, { a: H_CAST.val, stamina: 52, heat: 30 }]}
              says={{ i: 1, text: 'Two of us is a game. Barely.' }}/>}
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={taken === 1
      ? { a: H_CAST.bal, text: 'Quiet in here.' }
      : { a: H_CAST.val, text: 'Two of us is a game. Barely.' }}/>
  </PhoneShell>
);

const TableSheetM = () => (
  <FromFixture sheet={<TableSheet taken={2}/>} room={
    <HomeFlat>
      <AwayWall hooks={2}/>
      <TableChairs taken={2}/>
      <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
        players={[{ a: { ...H_CAST.agg, mood: 'frustrated' }, stamina: 60, heat: 58 }, { a: H_CAST.bal, stamina: 80, heat: 18 }]}/>
    </HomeFlat>}/>
);

// born, then walked in: the same three-beat strip the casino return uses
const BIRTH_WALK = [
  { at: { x: 352, y: 262 }, note: 'Born. He comes in through the door, like anyone arriving.', says: "I'm here." },
  { at: { x: 300, y: 300 }, note: 'Across the room. The others do not stop their hand for him.' },
  { at: TABLE_SEATS[4][2], routine: 'game', dealt: true, note: 'He takes the empty chair. The seat you paid for now has someone in it.' },
];

const BirthWalkInStripM = () => (
  <div style={{ display: 'flex', gap: 10, width: 1220 }}>
    {BIRTH_WALK.map((s, i) => (
      <div key={i} style={{ width: 390, flexShrink: 0 }}>
        <div style={{ position: 'relative', height: 300, overflow: 'hidden', borderRadius: 4, border: `1px solid ${M_BORDER}` }}>
          <div style={{ position: 'absolute', left: 0, top: -84 }}>
            <HomeFlat>
              <TableChairs taken={i === 2 ? 3 : 2}/>
              <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
                players={[{ a: H_CAST.bal, stamina: 80, heat: 18 }, { a: H_CAST.val, stamina: 54, heat: 26 }]}/>
              <HomeOne a={{ ...H_CAST.blf, mood: 'confident' }} at={s.at} routine={s.routine} size={46}
                stamina={92} heat={12} says={s.says} dealt={s.dealt} walking={i === 1}/>
            </HomeFlat>
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: M_MUTED, lineHeight: 1.45, padding: '7px 2px 0' }}>{s.note}</div>
      </div>
    ))}
  </div>
);

// the plan, drawn once: labels are allowed HERE, because a plan is a document
const ROOM_PLAN = [
  { k: 'safe',   t: 'THE SAFE',    n: 'against the left wall, under the frames · the money' },
  { k: 'wall',   t: 'THE FRAMES',  n: 'the top wall · agents away at the casino, live' },
  { k: 'fridge', t: 'THE FRIDGE',  n: 'the kitchen wall by the table · beer and snacks' },
  { k: 'door',   t: 'THE DOOR',    n: 'cut into the right wall · in, out, and born' },
  { k: 'table',  t: 'THE TABLE',   n: 'centre · the home game, four chairs, no money' },
  { k: 'couch',  t: 'THE COUCH',   n: 'left · where worn and busted end up' },
  { k: 'tape',   t: 'THE TV',      n: 'bottom · tape review, or the casino ticker' },
];

// beside each fixture, never on it: 12px clear of the outline on a chosen side
const PLAN_PIP = {
  safe:   { x: FLAT.safe.x + FLAT.safe.w + 12,   y: FLAT.safe.y + FLAT.safe.h / 2 },
  wall:   { x: FLAT.wall.x + FLAT.wall.w - 10,   y: FLAT.wall.y + FLAT.wall.h + 12 },
  fridge: { x: FLAT.fridge.x - 12,               y: FLAT.fridge.y + FLAT.fridge.h / 2 },
  door:   { x: FLAT.door.x - 12,                 y: FLAT.door.y + FLAT.door.h / 2 },
  table:  { x: FLAT.table.cx,                    y: FLAT.table.cy - FLAT.table.ry - 14 },
  couch:  { x: FLAT.couch.x + FLAT.couch.w + 12, y: FLAT.couch.y + FLAT.couch.h / 2 },
  tape:   { x: FLAT.tape.x + FLAT.tape.w / 2,    y: FLAT.tape.y - 12 },
};

// The rule proved: adjacent seats, both talking, bubbles opening away from each
// other. Nothing above either head but his own name pill.
const TwoTalkersM = () => (
  <PhoneShell>
    <HomeHead sub="both of them have an opinion"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={2}/>
        <TableChairs taken={2}/>
        <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
          players={[{ a: { ...H_CAST.agg, mood: 'frustrated' }, stamina: 62, heat: 58 }, { a: H_CAST.bal, stamina: 82, heat: 16 }]}
          says={[{ i: 0, text: 'That is the third time you did that.', side: 'left' },
                 { i: 1, text: 'And it worked all three times.', side: 'right' }]}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.bal, text: 'And it worked all three times.' }}/>
  </PhoneShell>
);

// The owner in a chair: the same felt, four verbs in the glass language, no money —
// and the agent across from him reads HIM the way he reads anyone.
const OwnerSeatM = () => (
  <PhoneShell>
    <HomeHead sub="you are in the game · for nothing"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={2}/>
        <TableChairs taken={3}/>
        <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
          players={[{ a: { ...H_CAST.bal, mood: 'confident' }, stamina: 80, heat: 18 }, { a: H_CAST.val, stamina: 56, heat: 24 }]}
          says={[{ i: 0, text: 'You never fold a river bet, boss.', side: 'left' }]}/>
        {/* the owner's own seat: a chair with cards in it and no ghost */}
        <div style={{ position: 'absolute', left: TABLE_SEATS[4][2].x, top: TABLE_SEATS[4][2].y, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 300 }}>
          <div style={{ display: 'flex', gap: 3 }}>
            {[['A', '\u2660', '#0F1514'], ['K', '\u2666', M_RED]].map(([r, s, c]) => (
              <span key={r} style={{ width: 19, height: 27, borderRadius: 2.5, background: '#E8E6E0', color: c, fontFamily: MONO, fontSize: 10, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{r}<span style={{ fontSize: 9 }}>{s}</span></span>
            ))}
          </div>
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.14em', color: M_TEAL }}>YOU</span>
        </div>
        <DoorTap/>
      </HomeFlat>
    </div>
    {/* the verbs, in the glass language, over the collapsed thread */}
    <div style={{ flexShrink: 0, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, padding: '11px 13px 13px' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[['FOLD', M_MUTED], ['CHECK', M_DIM], ['CALL', M_TEAL], ['BET', M_GOLD]].map(([v, c]) => (
          <span key={v} style={{ flex: 1, textAlign: 'center', fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: c, background: c === M_MUTED ? 'rgba(255,255,255,0.04)' : `${c}12`, border: `1px solid ${c === M_MUTED ? 'rgba(255,255,255,0.12)' : `${c}55`}`, borderRadius: 9, padding: '9px 0' }}>{v}</span>
        ))}
      </div>
    </div>
  </PhoneShell>
);

// ── SITTING DOWN · the camera, not a screen ──────────────────────────────
// Playing them yourself happens in the room. The camera pushes in on the kitchen
// table once, and from then on it is manual: tap outside the felt to pull back,
// tap the table to push in. It never pushes in on its own again.
const CAM = { w: F_W, h: 452, k: 1.6 };   // felt fills the width; tighter than this
                                          // turns the room into a keyhole and no
                                          // bubble fits beside a head

const TableCam = ({ children, zoom = true, tape, lit = true }) => {
  // the camera takes whatever room the layout has left, so no fixed height can
  // leave a band under the hand; the visible slice follows the measured height
  const ref = React.useRef(null);
  const [vh, setVh] = React.useState(CAM.h);
  React.useLayoutEffect(() => {
    const r = ref.current && ref.current.getBoundingClientRect().height;
    if (r) setVh(r);
  }, []);
  const k = zoom ? CAM.k : 1;
  const tx = zoom ? -(FLAT.table.cx * k - CAM.w / 2) : 0;
  const ty = zoom ? -((FLAT.table.cy - 6) * k - vh / 2) : 0;
  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minHeight: 0, width: CAM.w, overflow: 'hidden', background: '#0C1110' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: F_W, height: F_H, transform: `translate(${tx}px,${ty}px) scale(${k})`, transformOrigin: '0 0', transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)' }}>
        <H_BOUND.Provider value={zoom ? { min: FLAT.table.cx - CAM.w / (2 * k), max: FLAT.table.cx + CAM.w / (2 * k), edge: H_EDGE / k } : null}>
          <HomeFlat tape={tape} lit={lit}>{children}</HomeFlat>
        </H_BOUND.Provider>
      </div>
    </div>
  );
};

// your own two cards, large, and what they are worth right now
const OwnerHand = ({ cards = [['A', '\u2660', '#0F1514'], ['K', '\u2666', M_RED]], win = 62 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px 0' }}>
    <div style={{ display: 'flex', gap: 5 }}>
      {cards.map(([r, s, c]) => (
        <span key={r + s} style={{ width: 46, height: 64, borderRadius: 5, background: '#E8E6E0', color: c, fontFamily: MONO, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 3px 10px rgba(0,0,0,0.45)' }}>
          <span style={{ fontSize: 20 }}>{r}</span><span style={{ fontSize: 17 }}>{s}</span>
        </span>
      ))}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED }}>YOU WIN</div>
      <div style={{ marginTop: 1 }}><Num size={26} weight={700} color={M_TEAL}>{win}%</Num></div>
    </div>
    {/* You are the player, so there is nobody to whisper to: the composer's slot
        becomes the way into the thread instead of a way to speak into the felt. */}
    <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 19, border: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 20 20"><path d="M2 10L18 3L11 18L9.4 11.6L2 10Z" fill="none" stroke={M_DIM} strokeWidth="1.4" strokeLinejoin="round"/></svg>
    </span>
  </div>
);

// the action row: the same four verbs whether you act from the felt or the room
const ActionRow = ({ raised, sub }) => (
  <div style={{ flexShrink: 0, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${raised ? `${M_GOLD}55` : 'rgba(255,255,255,0.14)'}`, padding: '10px 13px 13px', animation: raised ? 'bubblein 0.3s ease-out both' : 'none' }}>
    {sub && <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingBottom: 8 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>YOUR TURN</span>
      <span style={{ fontSize: 10.5, color: M_MUTED }}>{sub}</span>
    </div>}
    <div style={{ display: 'flex', gap: 6 }}>
      {[['FOLD', M_MUTED], ['CHECK', M_DIM], ['CALL', M_TEAL], ['BET', M_GOLD]].map(([v, c]) => (
        <span key={v} style={{ flex: 1, textAlign: 'center', fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', color: c, background: c === M_MUTED ? 'rgba(255,255,255,0.04)' : `${c}12`, border: `1px solid ${c === M_MUTED ? 'rgba(255,255,255,0.12)' : `${c}55`}`, borderRadius: 9, padding: '10px 0' }}>{v}</span>
      ))}
    </div>
  </div>
);

const BET_AMTS = [
  { k: 'A THIRD', v: '160' }, { k: 'HALF', v: '240' }, { k: 'POT', v: '480' }, { k: 'ALL IN', v: '1,840', all: true },
];

// BET is the one verb that needs a number, so it is the one verb that opens a panel.
// The amounts are named in poker's own words with the figure under each, because
// "half" is the decision and "$240" is only its size.
const BetPanel = () => (
  <div style={{ flexShrink: 0, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${M_GOLD}55`, padding: '11px 13px 14px', animation: 'bubblein 0.28s ease-out both' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 9 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>BET</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: M_MUTED }}>pot is 480 · you have 1,840</span>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED, cursor: 'pointer' }}>CANCEL</span>
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      {BET_AMTS.map(b => (
        <div key={b.k} style={{ flex: 1, textAlign: 'center', borderRadius: 9, border: `1px solid ${b.all ? M_GOLD : `${M_GOLD}44`}`, background: b.all ? `${M_GOLD}1E` : `${M_GOLD}0D`, padding: '8px 0 7px', cursor: 'pointer' }}>
          <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: b.all ? M_GOLD : M_DIM }}>{b.k}</div>
          <div style={{ marginTop: 2 }}><Num size={12.5} weight={700} color={M_GOLD}>{b.v}</Num></div>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, height: 36, borderRadius: 9, border: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.03)', padding: '0 12px' }}>
      <span style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: M_MUTED }}>any amount</span>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: M_GOLD, border: `1px solid ${M_GOLD}66`, borderRadius: 8, padding: '5px 11px' }}>BET</span>
    </div>
  </div>
);

// your chair: cards, a name pill that glows on your turn, a draining timer ring
const OwnerChair = ({ at, turn, secs = 12, of = 20 }) => {
  const c = 2 * Math.PI * 21;
  return (
    <div style={{ position: 'absolute', left: at.x, top: at.y, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 300 }}>
      <div style={{ padding: '2.5px 8px 3.5px', borderRadius: 8, background: turn ? `${M_GOLD}1E` : 'rgba(8,12,12,0.9)', border: `1px solid ${turn ? M_GOLD : M_BORDER}`, boxShadow: turn ? `0 0 12px ${M_GOLD}55` : 'none' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: turn ? M_GOLD : M_DIM }}>YOU</span>
      </div>
      <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {[['A', '\u2660', '#0F1514'], ['K', '\u2666', M_RED]].map(([r, s, cc]) => (
            <span key={r} style={{ width: 17, height: 24, borderRadius: 2.5, background: '#E8E6E0', color: cc, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{r}<span style={{ fontSize: 8.5 }}>{s}</span></span>
          ))}
        </div>
        {turn && <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: 'absolute', left: 0, top: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="22" cy="22" r="21" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
          <circle cx="22" cy="22" r="21" fill="none" stroke={M_GOLD} strokeWidth="1.5" strokeDasharray={c} strokeDashoffset={c * (1 - secs / of)} strokeLinecap="round"/>
        </svg>}
      </div>
      <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em', color: M_DIM, cursor: 'pointer' }}>SIT OUT</span>
    </div>
  );
};

const OWNER_RING = [TABLE_SEATS[4][0], TABLE_SEATS[4][1]];

const ownerTable = ({ turn, secs }) => (
  <>
    <TableChairs taken={3}/>
    {turn && <div style={{ position: 'absolute', left: FLAT.table.cx, top: FLAT.table.cy, transform: 'translate(-50%,-50%)', width: FLAT.table.rx * 2 + 26, height: FLAT.table.ry * 2 + 26, borderRadius: '50%', border: `1px solid ${M_GOLD}44`, boxShadow: `0 0 26px ${M_GOLD}22 inset`, pointerEvents: 'none', zIndex: 30 }}></div>}
    <HomeGame ring={OWNER_RING}
      players={[{ a: { ...H_CAST.bal, mood: 'confident' }, stamina: 80, heat: 18 }, { a: H_CAST.val, stamina: 56, heat: 24 }]}
      says={[{ i: 0, text: 'You never fold a river bet, boss.' }]}/>
    <OwnerChair at={TABLE_SEATS[4][2]} turn={turn} secs={secs}/>
  </>
);

// Y1 · you sat down: the one automatic push-in of the game
const OwnerSitDownM = () => (
  <PhoneShell>
    <HomeHead sub="you are in the game · no money"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, display: 'flex', flexDirection: 'column' }}>
      <TableCam>{ownerTable({ turn: false })}</TableCam>
      <div style={{ flexShrink: 0 }}><OwnerHand win={62}/></div>
    </div>
    <ActionRow/>
  </PhoneShell>
);

// Y2 · pulled back to the room, and you can still act from here
const OwnerPulledBackM = () => (
  <PhoneShell>
    <HomeHead sub="the room · you are still in the hand"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={2}/>
        {ownerTable({ turn: true, secs: 12 })}
        <HomeOne a={{ ...H_CAST.blf, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={42} stamina={20} heat={16}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <ActionRow raised sub="12s · timeout checks for you"/>
  </PhoneShell>
);

// Y3 · you tapped the table: pushed in again, on your terms this time
const OwnerPushedInM = () => (
  <PhoneShell>
    <HomeHead sub="river · you tapped the table"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, display: 'flex', flexDirection: 'column' }}>
      <TableCam>{ownerTable({ turn: true, secs: 16 })}</TableCam>
      <div style={{ flexShrink: 0 }}><OwnerHand win={38}/></div>
    </div>
    <ActionRow raised sub="16s · he has bet 80"/>
  </PhoneShell>
);

// Y4 · BET opens a panel from the bottom; the felt above it does not move
const OwnerBetM = () => (
  <PhoneShell>
    <HomeHead sub="river · you are betting"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, display: 'flex', flexDirection: 'column' }}>
      <TableCam>{ownerTable({ turn: true, secs: 16 })}</TableCam>
      <div style={{ flexShrink: 0 }}><OwnerHand win={38}/></div>
    </div>
    <BetPanel/>
  </PhoneShell>
);

const RoomPlanM = () => (
  <div style={{ width: 390, fontFamily: INTER }}>
    <div style={{ position: 'relative', height: 612, overflow: 'hidden', borderRadius: 4, border: `1px solid ${M_BORDER}` }}>
      <HomeFlat>
        <AwayWall hooks={4}/>
        <TableChairs taken={0}/>
        {ROOM_PLAN.map((p, i) => {
          const f = PLAN_PIP[p.k];
          return (
            <div key={p.k} style={{ position: 'absolute', left: f.x, top: f.y, transform: 'translate(-50%,-50%)', zIndex: 60, width: 15, height: 15, borderRadius: '50%', background: 'rgba(6,10,10,0.9)', border: `1px solid ${M_TEAL}99`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: M_TEAL }}>{i + 1}</span>
            </div>
          );
        })}
        <DoorTap/>
      </HomeFlat>
    </div>
    <div style={{ padding: '10px 2px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
      {ROOM_PLAN.map(p => (
        <div key={p.k} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 8, fontWeight: 700, color: M_TEAL, width: 11 }}>{ROOM_PLAN.indexOf(p) + 1}</span>
          <span style={{ width: 74, flexShrink: 0, fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: M_DIM }}>{p.t}</span>
          <span style={{ flex: 1, fontSize: 10.5, color: M_MUTED, lineHeight: 1.4 }}>{p.n}</span>
        </div>
      ))}
    </div>
  </div>
);

const WalkOutStripM = () => <WalkStrip kind="out"/>;
const WalkHomeStripM = () => <WalkStrip kind="home"/>;
const WalkGameStripM = () => <WalkStrip kind="game"/>;
const WalkSulkStripM = () => <WalkStrip kind="sulk"/>;

Object.assign(window, {
  BetPanel, OwnerBetM,
  H_WANTS, WANT_CHIPS, WantBubble, TOASTS, HomeToast, WALKS, WalkStrip, H_SHEET,
  NIGHT_DAY, HomeNightly, HOME_CHAIR_PRICES, TableChairs, HomeThreadLine, YouLine, HomeThread,
  SheetSection, HOME_POCKETS, HomeMoneySheet, HOME_STOCK, FridgeSheet, HOME_SKILLS, HomeProfileHeadM, HOME_READ_BOOK, ReadBookSheet, BODY_SCALES, BodyBarsRefM, HomeWantM, HomeSleepM, HomeThreadOpenM, HomeTapeM,
  TableSheetM, BIRTH_WALK, BirthWalkInStripM, ROOM_PLAN, RoomPlanM, FromFixture, SafeOpenM, FridgeOpenM, FRIDGE_WALK, FridgeWalkStripM, BeerSeatM, FridgeEmptyM, NightlyCollapsedM, ChairsM,
  WalkOutStripM, WalkHomeStripM, WalkGameStripM, WalkSulkStripM,
});
