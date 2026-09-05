// WATCH v4 — dealt, seated, spoken. Playtest 18:32, Watch v3 live.
//
// v3 fixed tension (pacing), stakes (the rope) and register (his voice, ≤12 words).
// What it left was a table with nobody at it: five seat chips carrying names and
// stacks, no bodies, and reads filed behind a tab nobody opened. v4 adds three things
// and removes one.
//
// 1 · A DEAL beat before CALM. Cards arrive one at a time, 90ms apart, one haptic
//     each — the beat that makes a hand feel like it started rather than appeared.
// 2 · OPPONENTS AS CHARACTERS. Every seat is a ghost with a mood posture, House cast
//     included. Tapping one opens that opponent's read as a sheet, which is why
//     the READ TAB IS GONE: a read belongs behind the person it is about, so 6-max
//     needs five reads and no new panel.
// 3 · HIS VOICE AS THE DEFAULT PANEL. A running feed of decision lines with table
//     talk woven in, and between hands one line of session truth.
// 4 · The header collapses to a single 40px row; the cause line moves to the
//     between-hands strip, which is the only place there is room to read it.
//
// STACKING ORDER IS LAW: line, then rope, then hero row. The v3 bug was a line
// pinned to a fixed offset with no relationship to what sat under it.

const W4_HERO = { hole: [['A', 's'], ['K', 'h']], stack: '1,847', pos: 'BTN' };

// Five opponents, seated. Moods are theirs and persist across hands — a House
// regular has a temperament the same way an agent does.
const W4_SEATS = [
  { id: 'granite',  name: 'Granite',   stack: '2,104', pos: 'BB', x: 74,  y: 10,  mood: 'neutral',    accent: M_GOLD,   house: true,  history: 3 },
  { id: 'phil',     name: 'Phil_AI',   stack: '1,960', pos: 'SB', x: 195, y: 2,   mood: 'confident',  accent: M_TEAL,   house: true },
  { id: 'doyle',    name: 'doyle_v3',  stack: '1,290', pos: 'CO', x: 316, y: 10,  mood: 'sulking',    accent: M_PINK,   folded: true },
  { id: 'nash',     name: 'nash_eq',   stack: '3,410', pos: 'UTG', x: 48, y: 116, mood: 'frustrated', accent: M_PURPLE, agent: true },
  { id: 'ivey',     name: 'ivey_bot',  stack: '880',   pos: 'HJ', x: 344, y: 116, mood: 'tilted',     accent: M_RED,    folded: true },
];

// ── a seat: a body first, a number second ──────────────────────────────────
// The chip under the ghost is the v3 SeatChip's content at half the weight — a
// body with a name over it needs less shouting than a name alone did. Card backs
// sit behind the shoulder, never in front of the face.
const SeatGhost = ({ s, acting, selected, dealt, size = 34 }) => (
  <div style={{ position: 'absolute', left: s.x, top: s.y, transform: 'translateX(-50%)', zIndex: acting ? 5 : 3, cursor: 'pointer' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ position: 'relative' }}>
        {acting && (
          <div style={{ position: 'absolute', left: '50%', top: '52%', width: size * 2, height: size * 2, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_TEAL}2E, transparent 68%)`, animation: 'shimmer 1.6s ease-in-out infinite' }}/>
        )}
        {selected && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: size + 14, height: size + 14, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `1px solid ${M_TEAL}`, boxShadow: `0 0 12px ${M_TEAL}66` }}/>
        )}
        {/* their cards, behind the shoulder */}
        {dealt && !s.folded && (
          <div style={{ position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%) rotate(-6deg)', zIndex: -1, display: 'flex', gap: 1 }}>
            <CardBack w={15} h={21} branded/>
            <CardBack w={15} h={21} branded/>
          </div>
        )}
        <div style={{ opacity: s.folded ? 0.34 : 1, filter: s.folded ? 'saturate(0.4)' : 'none' }}>
          <FloorGhost mood={s.mood} accent={s.accent} size={size} speed={s.mood === 'tilted' ? 3.2 : 5.6}/>
        </div>
        {s.history && (
          <span style={{ position: 'absolute', top: -2, left: -6, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7, background: 'rgba(19,19,22,0.95)', border: `1px solid ${M_GOLD}`, color: M_GOLD, fontFamily: MONO, fontSize: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 6px ${M_GOLD}44` }}>{s.history}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 6px', borderRadius: 9, background: 'rgba(14,17,18,0.8)', border: `1px solid ${acting ? `${M_TEAL}66` : M_BORDER}`, opacity: s.folded ? 0.5 : 1, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 9.5, color: M_DIM, fontWeight: 500 }}>{s.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED }}>{s.stack}</span>
      </div>
    </div>
  </div>
);

// ── the 40px header. One row: back, name, mood, LIVE, CHAT. ────────────────
// v3 spent 96px on a header row plus a MoodBand whose cause line was the only part
// that mattered — and that line has a better home in the between-hands strip.
const W4Header = ({ name = 'Balanced v2.1', mood = 'confident', accent = M_TEAL }) => (
  <div style={{ flexShrink: 0, height: 40, display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M15 18l-6-6 6-6"/></svg>
    <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}55`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <MoodGhost mood={mood} accent={accent} size={23} ring={false}/>
    </div>
    <span style={{ fontSize: 13, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
    <MoodChip mood={mood} small/>
    <div style={{ flex: 1, minWidth: 4 }}/>
    <StateTag state="live" compact/>
    <Btn kind="ghost" h={26}>Chat</Btn>
  </div>
);

// ── the between-hands strip: where the cause line lives now ───────────────
const BetweenStrip4 = ({ cause, truth, next = 8 }) => (
  <div style={{ flexShrink: 0, background: M_PANEL_2, borderBottom: `1px solid ${M_BORDER}`, padding: '8px 12px 9px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: M_MUTED, flexShrink: 0 }}/>
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: M_TEAL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cause}</span>
      <Num size={9} color={M_MUTED} weight={500}>NEXT DEAL {next}s</Num>
    </div>
    {truth && <div style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, marginTop: 5, letterSpacing: '0.02em' }}>{truth}</div>}
  </div>
);

// ── the felt. Five states now: DEAL, CALM, HEATING, ALL-IN, SHOWDOWN. ─────
const PACE4 = {
  deal:     { label: 'DEAL',     color: M_TEAL,  note: 'his two cards land 90ms apart, then the table\u2019s backs. One light tap per card.' },
  calm:     { label: 'CALM',     color: M_MUTED, note: 'as v3. Nothing about the felt asks for attention.' },
  heating:  { label: 'HEATING',  color: M_GOLD,  note: 'as v3: felt warms, ticker grows, one rigid tap.' },
  allin:    { label: 'ALL-IN',   color: M_RED,   note: 'as v3: a 3\u20135s hold on his line. Spectator only.' },
  showdown: { label: 'SHOWDOWN', color: M_TEAL,  note: 'as v3, plus every seated ghost reacting in posture.' },
};

// hero cards: `landed` is how many have arrived, `warm` gilds them from pre-flop
// equity. OWNER-ONLY — the gold edge is a private read on his own hand and must
// never render on another spectator's felt.
const HeroCards4 = ({ landed = 2, warm, w = 36, h = 50 }) => (
  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
    {W4_HERO.hole.map((c, i) => (
      <div key={i} style={{
        transform: `rotate(${i ? 3 : -3}deg) translateX(${i >= landed ? 34 : 0}px)`,
        opacity: i >= landed ? 0 : 1,
        transition: 'transform 0.24s cubic-bezier(.2,.8,.2,1), opacity 0.2s',
        filter: warm
          ? `drop-shadow(0 0 7px ${M_GOLD}99) drop-shadow(0 2px 5px rgba(0,0,0,0.6))`
          : 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))',
      }}>
        <PlayingCard rank={c[0]} suit={c[1]} w={w} h={h}/>
      </div>
    ))}
  </div>
);

const HeroRow4 = ({ street, toCall, action, timer, landed = 2, warm, note, tag }) => (
  <div style={{
    position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 4,
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', borderRadius: 12,
    background: 'rgba(23,27,27,0.78)',
    border: `1px solid ${warm ? `${M_GOLD}66` : action ? `${M_TEAL}55` : M_BORDER}`,
    boxShadow: warm ? `inset 0 1px 0 ${M_GOLD}2E` : action ? `inset 0 1px 0 ${M_TEAL}2E` : 'none',
  }}>
    <HeroCards4 landed={landed} warm={warm}/>
    <div style={{ width: 1, height: 20, background: M_BORDER, flexShrink: 0, marginLeft: 3 }}/>
    <div style={{ minWidth: 0 }}>
      <Lbl size={8.5}>Stack</Lbl>
      <div><Num size={12.5} weight={700}>${W4_HERO.stack}</Num></div>
    </div>
    <div style={{ width: 1, height: 20, background: M_BORDER, flexShrink: 0 }}/>
    <div style={{ minWidth: 0 }}>
      <Lbl size={8.5}>{toCall ? 'To call' : 'Street'}</Lbl>
      <div><Num size={12.5} weight={700} color={toCall ? M_GOLD : M_DIM}>{toCall ? `$${toCall}` : street}</Num></div>
    </div>
    <div style={{ flex: 1 }}/>
    {warm && !action && <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em', color: M_GOLD, whiteSpace: 'nowrap' }}>PREMIUM</span>}
    {action && <span style={{ padding: '5px 10px', borderRadius: 5, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap', flexShrink: 0 }}>{action}</span>}
    {timer != null && <SeatTimerRing value={timer}/>}
    {tag && <span style={{ padding: '5px 8px', borderRadius: 5, background: `${M_RED}1F`, border: `1px solid ${M_RED}66`, fontFamily: MONO, fontSize: 9, fontWeight: 700, color: M_RED, whiteSpace: 'nowrap', flexShrink: 0 }}>{tag}</span>}
    {note && !action && !warm && <span style={{ fontSize: 11.5, color: M_MUTED, whiteSpace: 'nowrap' }}>{note}</span>}
  </div>
);

const Felt4 = ({ pace = 'calm', h = 420, pot, board = [], flip = 0, equity, dead,
                 line, acting, selected, dealt = true, landed = 2, warm, hero, potTo, seats = W4_SEATS }) => {
  const p = PACE4[pace];
  const heat = pace === 'heating' || pace === 'allin';
  return (
    <div style={{
      position: 'relative', flexShrink: 0, height: h, overflow: 'hidden',
      background: heat
        ? 'radial-gradient(ellipse at 50% 40%, #3b4a3f 0%, #24302c 58%, #17211f 100%)'
        : 'radial-gradient(ellipse at 50% 42%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)',
      borderBottom: `1px solid ${p.color}${heat ? '66' : '38'}`,
    }}>
      {heat && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 ${pace === 'allin' ? 80 : 60}px ${p.color}${pace === 'allin' ? '4D' : '33'}`, animation: pace === 'allin' ? 'shimmer 1.4s ease-in-out infinite' : 'none' }}/>}
      <div style={{ position: 'absolute', left: '-16%', right: '-16%', top: 56, height: h - 96, borderRadius: '50%', border: `1px solid ${M_TEAL}1F`, pointerEvents: 'none' }}/>

      {/* six bodies at a table, and five of them are not yours */}
      {seats.map(s => (
        <SeatGhost key={s.id} s={s} acting={acting === s.id} selected={selected === s.id} dealt={dealt}/>
      ))}

      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, borderRadius: 18,
          padding: heat ? '5px 17px' : '3px 13px',
          background: heat ? `${p.color}1F` : 'rgba(23,27,27,0.6)',
          border: `1px solid ${heat ? `${p.color}66` : M_BORDER}`,
          transform: potTo ? 'translateY(-26px) scale(0.84)' : 'none',
          opacity: potTo ? 0.5 : 1, transition: 'transform 0.7s cubic-bezier(.4,0,.2,1), opacity 0.7s',
        }}>
          <Lbl size={9} color={heat ? p.color : M_MUTED}>Pot</Lbl>
          <Amt size={heat ? 28 : 22}>${pot}</Amt>
        </div>
      </div>

      <div style={{ position: 'absolute', top: 196, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
        {(board.length ? board : [null, null, null, null, null]).map((c, i) => (
          <div key={i} style={{ animation: i === flip - 1 && pace === 'showdown' ? 'rise 0.4s ease-out both' : 'none' }}>
            {c && i < flip
              ? <PlayingCard rank={c[0]} suit={c[1]} w={44} h={61}/>
              : <CardBack w={44} h={61} branded/>}
          </div>
        ))}
      </div>

      {/* order is law: rope, then his line, then the hero row */}
      <div style={{ position: 'absolute', top: heat ? 268 : 276, left: 44, right: 44, zIndex: 2 }}>
        <TugBar equity={equity} dead={dead} big={heat}/>
      </div>

      {line && (
        <div style={{ position: 'absolute', top: 313, left: 16, right: 16, zIndex: 3, textAlign: 'center' }}>
          <span style={{
            display: 'inline-block', maxWidth: '100%',
            padding: pace === 'allin' ? '7px 13px' : '0',
            borderRadius: 10,
            background: pace === 'allin' ? 'rgba(10,10,10,0.6)' : 'transparent',
            border: pace === 'allin' ? `1px solid ${M_RED}44` : 'none',
            fontFamily: pace === 'allin' ? PLAYFAIR : INTER,
            fontSize: pace === 'allin' ? 15 : 13,
            fontWeight: pace === 'allin' ? 600 : 400,
            fontStyle: pace === 'allin' ? 'normal' : 'italic',
            color: M_TEXT, lineHeight: 1.35,
          }}>{line}</span>
        </div>
      )}

      {hero}
    </div>
  );
};

// ── the read, behind the person it is about ───────────────────────────────
// The READ TAB IS GONE. A read is a fact about one opponent, so it lives behind that
// opponent: tap the ghost, the sheet rises. Five opponents, five reads, no new panel
// and no tab that has to fit six of anything.
const READ_BOOK = {
  granite: { hands: 142, role: 'nemesis', line: 'He never folds, so I stop bluffing him.',
    rows: [
      { k: 'vpip', label: 'PLAYS', v: 19, conf: 3, formed: true },
      { k: 'pfr', label: 'RAISES FIRST', v: 14, conf: 4, formed: true },
      { k: 'aggr', label: 'AGGRESSION', v: 31, conf: 6, formed: true },
      { k: 'fold', label: 'FOLDS TO HEAT', v: 8, conf: 5, formed: true },
      { k: 'sd', label: 'GOES TO SHOWDOWN', v: 41, conf: 9 },
    ] },
  nash: { hands: 22, role: null, line: 'Twenty-two hands. He is tight, and that is all I have.',
    rows: [
      { k: 'vpip', label: 'PLAYS', v: 14, conf: 8, formed: true },
      { k: 'pfr', label: 'RAISES FIRST', v: 11, conf: 11 },
      { k: 'aggr', label: 'AGGRESSION', v: 44, conf: 18 },
      { k: 'fold', label: 'FOLDS TO HEAT', v: null, conf: 0 },
      { k: 'sd', label: 'GOES TO SHOWDOWN', v: null, conf: 0 },
    ] },
};

const ReadSheet4 = ({ id = 'granite' }) => {
  const s = W4_SEATS.find(x => x.id === id);
  const r = READ_BOOK[id];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 8,
      background: M_PANEL, borderTop: `1px solid ${M_TEAL}44`,
      borderTopLeftRadius: 18, borderTopRightRadius: 18,
      boxShadow: '0 -18px 40px rgba(0,0,0,0.55)', padding: '9px 14px 18px',
      animation: 'sheetup 0.4s cubic-bezier(.2,.8,.2,1) forwards',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 11 }}>
        <div style={{ width: 34, height: 4, borderRadius: 2, background: M_FAINT }}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 13 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: '#0A0F17', border: `1px solid ${s.accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
          <MoodGhost mood={s.mood} accent={s.accent} size={38} ring={false}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: PLAYFAIR, fontSize: 17, fontWeight: 600, color: M_TEXT }}>{s.name}</span>
            {r.role === 'nemesis' && (
              <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: M_RED, background: `${M_RED}14`, border: `1px solid ${M_RED}44`, borderRadius: 3, padding: '2px 5px' }}>NEMESIS</span>
            )}
          </div>
          <div style={{ marginTop: 4 }}><Num size={9} color={M_MUTED} weight={500}>{s.house ? 'HOUSE REGULAR' : s.agent ? "ANOTHER OWNER'S AGENT" : 'REGULAR'} &middot; {r.hands} HANDS SEEN</Num></div>
        </div>
        <Num size={11.5} weight={700} color={M_TEAL}>${s.stack}</Num>
      </div>
      <div style={{ padding: '4px 0 2px' }}>
        {r.rows.map(row => <ReadBar key={row.k} {...row}/>)}
      </div>
      <div style={{ marginTop: 11, padding: '10px 12px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33`, fontSize: 12.5, color: M_TEXT, lineHeight: 1.45, fontStyle: 'italic' }}>
        &ldquo;{r.line}&rdquo;
      </div>
      <div style={{ marginTop: 10, textAlign: 'center' }}>
        <Num size={9} color={M_MUTED} weight={500}>TAP ANY OTHER SEAT TO READ THEM INSTEAD</Num>
      </div>
    </div>
  );
};

// ── his voice, as the default panel ───────────────────────────────────────
// Decision lines, table talk, and one line of session truth between hands. The feed
// is why the READ tab could go: what an owner wants under the felt is not five
// statistics, it is the running commentary of the person he hired.
const VOICE = [
  { t: 'him', s: 'Ace-king, button. Raising to 60.', at: '18:31' },
  { t: 'talk', who: 'Granite', s: 'Again?', at: '18:31' },
  { t: 'him', s: 'He calls with anything here. Betting 90 anyway.', at: '18:31' },
  { t: 'him', s: 'He checked twice. He\u2019s got nothing.', at: '18:32', now: true },
];

const VoiceLine = ({ v }) => v.t === 'talk' ? (
  <div style={{ display: 'flex', gap: 8, padding: '6px 14px', alignItems: 'baseline' }}>
    <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, width: 52, flexShrink: 0 }}>{v.who}</span>
    <span style={{ flex: 1, fontSize: 12, color: M_MUTED, fontStyle: 'italic' }}>&ldquo;{v.s}&rdquo;</span>
  </div>
) : (
  <div style={{ display: 'flex', gap: 8, padding: '7px 14px', alignItems: 'baseline', background: v.now ? `${M_TEAL}08` : 'transparent' }}>
    <span style={{ width: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
      {v.now && <LiveDot size={4.5}/>}
      <span style={{ fontFamily: MONO, fontSize: 9, color: v.now ? M_TEAL : M_MUTED }}>{v.at}</span>
    </span>
    <span style={{ flex: 1, fontSize: 13, color: v.now ? M_TEXT : M_DIM, lineHeight: 1.4 }}>{v.s}</span>
  </div>
);

const VoiceFeed = ({ truth, lines = VOICE }) => (
  <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
    {truth && (
      <div style={{ margin: '10px 14px 8px', padding: '9px 11px', borderRadius: 9, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <Num size={9} color={M_MUTED} weight={500}>{truth}</Num>
      </div>
    )}
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[...lines].reverse().map((v, i) => <VoiceLine key={i} v={v}/>)}
    </div>
  </div>
);

const Tabs4 = ({ active = 'voice' }) => (
  <div style={{ flexShrink: 0, display: 'flex', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '0 8px' }}>
    {[{ id: 'voice', label: 'Voice' }, { id: 'chat', label: 'Chat' }].map(t => {
      const on = t.id === active;
      return (
        <div key={t.id} style={{
          flex: 1, textAlign: 'center', padding: '10px 0 8px', cursor: 'pointer',
          fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: on ? M_TEAL : M_MUTED,
          borderBottom: on ? `2px solid ${M_TEAL}` : '2px solid transparent', marginBottom: -1,
        }}>{t.label}</div>
      );
    })}
  </div>
);

Object.assign(window, {
  W4_HERO, W4_SEATS, PACE4, READ_BOOK, VOICE,
  SeatGhost, W4Header, BetweenStrip4, HeroCards4, HeroRow4, Felt4,
  ReadSheet4, VoiceFeed, VoiceLine, Tabs4,
});
