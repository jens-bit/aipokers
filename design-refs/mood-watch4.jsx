// WATCH v4b — bubbles, not a feed. Correction from the 18:55 reaction.
//
// v4 put his voice in a panel under the felt. Right instinct, wrong place: a feed is
// a log you read, and what an owner wants is to watch someone talk. So the words move
// ONTO the felt as speech bubbles over whoever is speaking, and the panel becomes the
// record rather than the performance.
//
// KEPT FROM v4, unchanged: the DEAL beat, opponents seated as ghosts with mood
// posture, tap-a-ghost → read sheet, the 40px header, the tug-of-war, the pace
// states, the haptic contract.
//
// THE BUBBLE LAW (the Hearthstone whisper pattern):
//   · one bubble per seat at a time, and at most TWO on the felt at once
//   · 3–4 seconds, then gone. Never a queue, never a stack, never a scrollback
//   · his sits above the hero row; an opponent's sits above their own ghost
//   · a bubble that would be cut off is not shown — the record has it either way
// There is no line under the board any more. The felt is where speech happens; the
// TABLE tab is where speech is kept.

const W4_HERO = { hole: [['A', 's'], ['K', 'h']], stack: '1,847', pos: 'BTN' };

// FELT GEOMETRY — and the reason this is a FLOW, not a list of offsets.
//
// Eleven defects this wave were one bug repeated: a fixed downstream offset meeting
// an upstream element whose height depends on state. The heat rope is 36px not 29.
// The heat pot pill is 52px not 39. The ALL-IN bubble is two lines not one. Each
// time, a constant tuned against one state broke in another.
//
// So the centre of the felt is now a FLEX COLUMN, positioned once and flowed: pot,
// board, his bubble band, then the rope pushed to the foot above a reserved hero
// row. Gaps are 8px and belong to the column, so every element's real height
// participates and NO state can collide with another. There is one felt height for
// all five states because nothing depends on the numbers any more.
//
// The seats stay absolute — they are anchored to the table, not to the flow — and
// their bands still derive from the seat stack:
//   a seat is a 60px stack: ghost 41 + gap 2 + name chip 17
//   top row      56 → 116
//   side band   124 → 156   one line of table talk, 32px
//   side row    170 → 230   14px under the band, and above the column's centred
//                           children, which start at x75 while a side chip ends at x89
//
// SIDE BUBBLES ARE ONE LINE, by decision: table talk IS one line ("Again?", "Call.",
// "Too rich for me."). HIS gets two, in the band the column reserves for it.
const SEAT_STACK = 60;
const TOP_ROW_Y = 56;
const TOP_ROW_BOTTOM = TOP_ROW_Y + SEAT_STACK;      // 116
const OPP_BUBBLE_H = 32;
const COLUMN_TOP = 196;                              // under the side row's chips
const HIS_BAND_H = 54;                               // two lines of 13px + padding
const HERO_RESERVE = 88;                             // hero row 68 + 12 bottom + 8 gap
const FELT_H = 520;                                  // one height, every state:
// 196 column top + 227 tallest content (52 heat pill, 61 board, 54 his band, 36 heat
// rope, 8px gaps) + 88 hero reserve = 511, and 9px of slack lands in the spacer.
const BUBBLE_BAND = {
  opp: 8,
  oppSide: TOP_ROW_BOTTOM + 8,                       // 124
};
const SIDE_ROW_Y = BUBBLE_BAND.oppSide + OPP_BUBBLE_H + 14;   // 170

const W4_SEATS = [
  { id: 'granite',  name: 'Granite',   stack: '2,104', pos: 'BB',  x: 74,  y: 56,  mood: 'neutral',    accent: M_GOLD,   house: true, history: 3, show: [['K', 'd'], ['9', 's']] },
  { id: 'phil',     name: 'Phil_AI',   stack: '1,960', pos: 'SB',  x: 195, y: 48,  mood: 'confident',  accent: M_TEAL,   house: true, show: [['J', 'h'], ['J', 'c']] },
  { id: 'doyle',    name: 'doyle_v3',  stack: '1,290', pos: 'CO',  x: 316, y: 56,  mood: 'sulking',    accent: M_PINK,   folded: true },
  { id: 'nash',     name: 'nash_eq',   stack: '3,410', pos: 'UTG', x: 48,  y: SIDE_ROW_Y, mood: 'frustrated', accent: M_PURPLE, agent: true, show: [['A', 'c'], ['Q', 'd']] },
  { id: 'ivey',     name: 'ivey_bot',  stack: '880',   pos: 'HJ',  x: 344, y: SIDE_ROW_Y, mood: 'tilted',     accent: M_RED,    folded: true },
];

// ── the bubble ────────────────────────────────────────────────────────────
// Two registers, one shape. HIS is teal-edged and carries his 13px voice; an
// OPPONENT'S is neutral and quieter, because table talk is background until it
// isn't. The tail points down at whoever said it — that is the entire mechanism
// by which you know who is speaking.
const BUBBLE_FILL = { mine: 'rgba(12,26,24,0.94)', opp: 'rgba(18,20,22,0.92)' };

const Bubble = ({ text, mine, at = 195, top, w = 152, felt = 390, flow }) => {
  const left = mine ? null : Math.max(8, Math.min(felt - w - 8, at - w / 2));
  const tail = mine ? null : at - left;
  return (
  <div style={{
    ...(flow
      ? { position: 'relative', maxWidth: 320 }
      : { position: 'absolute', top, ...(mine ? { left: at, transform: 'translateX(-50%)' } : { left }), width: mine ? 'auto' : w, maxWidth: mine ? 320 : w }),
    zIndex: 6, pointerEvents: 'none',
    animation: 'bubblein 0.22s ease-out both',
  }}>
    <div style={{
      padding: mine ? '9px 13px' : '7px 10px',
      borderRadius: 12,
      background: mine ? BUBBLE_FILL.mine : BUBBLE_FILL.opp,
      border: `1px solid ${mine ? `${M_TEAL}66` : M_BORDER_2}`,
      boxShadow: mine ? `0 3px 14px rgba(0,0,0,0.5), 0 0 16px ${M_TEAL}1F` : '0 3px 12px rgba(0,0,0,0.5)',
      fontSize: mine ? 13 : 11.5,
      color: mine ? M_TEXT : M_DIM,
      lineHeight: 1.4,
      textAlign: mine ? 'center' : 'left',
      fontStyle: mine ? 'normal' : 'italic',
      ...(mine ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
    }}>{mine ? text : <>&ldquo;{text}&rdquo;</>}</div>
    {/* the tail: the only thing that says who is talking, so it points at them */}
    <div style={{
      position: 'absolute', top: '100%',
      left: mine ? '50%' : Math.max(10, Math.min(w - 10, tail)),
      marginLeft: -6, width: 0, height: 0,
      borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
      borderTop: `7px solid ${mine ? BUBBLE_FILL.mine : BUBBLE_FILL.opp}`,
      filter: `drop-shadow(0 1px 0 ${mine ? `${M_TEAL}66` : M_BORDER_2})`,
    }}/>
  </div>
  );
};

// ── acting is a shape, not a colour ──────────────────────────────────────
// Teal is an accent and Phil_AI wears it, so a role signal cannot live there. The
// ring IS the clock: a faint white circle for "acting", a bright arc on the same
// radius for time left, and the count in the chip at mono 9 — no scaled numeral.
const SeatClock = ({ d = 47, left = 9, of = 12 }) => {
  const r = (d - 2) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%) rotate(-90deg)', overflow: 'visible', filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.7))' }}>
      <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke="rgba(237,237,237,0.3)" strokeWidth="1"/>
      <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke="#EDEDED" strokeWidth="1.6" strokeLinecap="round"
        strokeDasharray={`${(c * left / of).toFixed(1)} ${c.toFixed(1)}`}/>
    </svg>
  );
};

// `reveal` turns their backs face up at showdown, in seat order. Backs while the
// hand is live — the fish-tank law is untouched by this wave.
const SeatGhost = ({ s, acting, selected, dealt, reveal, size = 34, timer = 9, order = 0 }) => (
  <div style={{ position: 'absolute', left: s.x, top: s.y, transform: 'translateX(-50%)', zIndex: acting ? 5 : 3, cursor: 'pointer' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <div style={{ position: 'relative' }}>
        {acting && <SeatClock d={size + 13} left={timer}/>}
        {selected && (
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: size + 20, height: size + 20, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `1px dashed ${M_TEAL}`, boxShadow: `0 0 12px ${M_TEAL}66` }}/>
        )}
        {dealt && !s.folded && !(reveal && s.show) && (
          <div style={{ position: 'absolute', left: '50%', top: 6, transform: 'translateX(-50%) rotate(-6deg)', zIndex: -1, display: 'flex', gap: 1 }}>
            <CardBack w={15} h={21}/>
            <CardBack w={15} h={21}/>
          </div>
        )}
        <div style={{ opacity: s.folded ? 0.34 : 1, filter: s.folded ? 'saturate(0.4)' : 'none' }}>
          <FloorGhost mood={s.mood} accent={s.accent} size={size} speed={s.mood === 'tilted' ? 3.2 : 5.6}/>
        </div>
        {s.history && (
          <span style={{ position: 'absolute', top: -2, left: -6, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 7, background: 'rgba(19,19,22,0.95)', border: `1px solid ${M_GOLD}`, color: M_GOLD, fontFamily: MONO, fontSize: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 6px ${M_GOLD}44` }}>{s.history}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 6px', borderRadius: 9, background: 'rgba(14,17,18,0.8)', border: `1px solid ${acting ? '#EDEDED66' : M_BORDER}`, opacity: s.folded ? 0.5 : 1, whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 9.5, color: acting ? M_TEXT : M_DIM, fontWeight: 500 }}>{s.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED }}>{s.stack}</span>
        {acting && <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: M_TEXT }}>{timer}s</span>}
      </div>
      {/* the shelf: only at showdown, and only for a seat that reached it */}
      {reveal && s.show && !s.folded && (
        <div style={{ display: 'flex', flexDirection: s.y >= SIDE_ROW_Y ? 'column' : 'row', gap: 1.5, marginTop: 1, animation: `bubblein 0.3s ease-out ${order * 0.14}s both` }}>
          {s.show.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={22} h={31}/>)}
        </div>
      )}
    </div>
  </div>
);

// ── the 40px header ──────────────────────────────────────────────────────
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
  </div>
);

const BetweenStrip4 = ({ cause, truth, next = 8 }) => (
  <div style={{ flexShrink: 0, background: M_PANEL_2, borderBottom: `1px solid ${M_BORDER}`, padding: '8px 12px 9px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: M_MUTED, flexShrink: 0 }}/>
      <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: M_TEAL, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cause}</span>
      <Num size={9} color={M_MUTED} weight={500}>NEXT DEAL {next}s</Num>
    </div>
    {truth && <div style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, marginTop: 5 }}>{truth}</div>}
  </div>
);

const PACE4 = {
  deal:     { label: 'DEAL',     color: M_TEAL,  note: 'his two cards land 90ms apart, then the table\u2019s backs. One light tap per card.' },
  calm:     { label: 'CALM',     color: M_MUTED, note: 'nothing about the felt asks for attention. Bubbles come and go.' },
  heating:  { label: 'HEATING',  color: M_GOLD,  note: 'felt warms, ticker grows, one rigid tap.' },
  allin:    { label: 'ALL-IN',   color: M_RED,   note: 'a 3\u20135s hold on his bubble before the runout. Spectator only.' },
  showdown: { label: 'SHOWDOWN', color: M_TEAL,  note: 'their cards flip face up in seat order, held, then the pot slides.' },
};

const HeroCards4 = ({ landed = 2, warm, w = 36, h = 50 }) => (
  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
    {W4_HERO.hole.map((c, i) => (
      <div key={i} style={{
        transform: `rotate(${i ? 3 : -3}deg) translateX(${i >= landed ? 34 : 0}px)`,
        opacity: i >= landed ? 0 : 1,
        transition: 'transform 0.24s cubic-bezier(.2,.8,.2,1), opacity 0.2s',
        filter: warm ? `drop-shadow(0 0 7px ${M_GOLD}99) drop-shadow(0 2px 5px rgba(0,0,0,0.6))` : 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))',
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

const Felt4 = ({ pace = 'calm', heroReserve = HERO_RESERVE, pot, board = [], flip = 0, equity, dead,
                 says, acting, selected, dealt = true, landed = 2, warm, hero, potTo,
                 reveal, seats = W4_SEATS }) => {
  const p = PACE4[pace];
  const heat = pace === 'heating' || pace === 'allin';
  // at most two bubbles, and his is one of them if he is speaking
  const bubbles = (says || []).slice(0, 2);
  return (
    <div style={{
      position: 'relative', flexShrink: 0, height: FELT_H, overflow: 'hidden',
      background: heat
        ? 'radial-gradient(ellipse at 50% 44%, #3b4a3f 0%, #24302c 58%, #17211f 100%)'
        : 'radial-gradient(ellipse at 50% 46%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)',
      borderBottom: `1px solid ${p.color}${heat ? '66' : '38'}`,
    }}>
      <style>{`@keyframes bubblein{from{opacity:0}to{opacity:1}}`}</style>
      {heat && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 ${pace === 'allin' ? 80 : 60}px ${p.color}${pace === 'allin' ? '4D' : '33'}`, animation: pace === 'allin' ? 'shimmer 1.4s ease-in-out infinite' : 'none' }}/>}
      <div style={{ position: 'absolute', left: '-16%', right: '-16%', top: 96, height: FELT_H - 150, borderRadius: '50%', border: `1px solid ${M_TEAL}1F`, pointerEvents: 'none' }}/>

      {(() => {
        const order = {};
        seats.filter(x => !x.folded && x.show).forEach((x, i) => { order[x.id] = i; });
        return seats.map(s => (
          <SeatGhost key={s.id} s={s} order={order[s.id] || 0} acting={acting === s.id}
            selected={selected === s.id} dealt={dealt} reveal={reveal}/>
        ));
      })()}

      {/* THE COLUMN. Positioned once, then flowed — pot, board, his bubble band, and
          the rope pushed to the foot above the reserved hero row. Because the gaps
          belong to the column, a taller pill or a thicker rope moves its neighbours
          instead of landing on them. */}
      <div style={{
        position: 'absolute', top: COLUMN_TOP, left: 0, right: 0, bottom: heroReserve,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 2,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, flexShrink: 0,
          minHeight: 39, boxSizing: 'border-box',
          padding: heat ? '5px 17px' : '3px 13px',
          background: heat ? `${p.color}1F` : 'rgba(23,27,27,0.6)',
          border: `1px solid ${heat ? `${p.color}66` : M_BORDER}`,
          transform: potTo ? 'translateY(-26px) scale(0.84)' : 'none',
          opacity: potTo ? 0.5 : 1, transition: 'transform 0.7s cubic-bezier(.4,0,.2,1), opacity 0.7s',
        }}>
          <Lbl size={9} color={heat ? p.color : M_MUTED}>Pot</Lbl>
          {/* Amt's face is Rozha One — a display face with no glyph beyond money, so a
              non-numeric value would reserve its advance and paint nothing. */}
          {/^[\d.,]+$/.test(String(pot))
            ? <Amt size={heat ? 28 : 22}>${pot}</Amt>
            : <Num size={15} weight={700} color={M_MUTED}>{pot}</Num>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, flexShrink: 0 }}>
          {(board.length ? board : [null, null, null, null, null]).map((c, i) => (
            <div key={i} style={{ animation: i === flip - 1 && pace === 'showdown' ? 'bubblein 0.4s ease-out both' : 'none' }}>
              {c && i < flip
                ? <PlayingCard rank={c[0]} suit={c[1]} w={44} h={61}/>
                : <CardBack w={44} h={61} branded/>}
            </div>
          ))}
        </div>

        {/* his band: reserved whether or not he is speaking, which is what "his
            bubble always fits" means once the layout is a flow */}
        <div style={{ minHeight: HIS_BAND_H, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', width: '100%', padding: '0 16px' }}>
          {bubbles.filter(b => b.mine).map((b, i) => <Bubble key={i} mine flow text={b.text}/>)}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}/>

        <div style={{ alignSelf: 'stretch', margin: '0 44px', flexShrink: 0 }}>
          <TugBar equity={equity} dead={dead} big={heat}/>
        </div>
      </div>

      {/* speech. His band is reserved above the rope; an opponent's sits over their
          own ghost, in the band the seats were pushed down to make. */}
      {bubbles.filter(b => !b.mine).map((b, i) => {
        const s = seats.find(x => x.id === b.id);
        if (!s) return null;
        return (
          <Bubble key={i} text={b.text} w={142} at={s.x}
            top={s.y >= SIDE_ROW_Y ? BUBBLE_BAND.oppSide : BUBBLE_BAND.opp}/>
        );
      })}

      {hero}
    </div>
  );
};

// ── the read, behind the person it is about ──────────────────────────────
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

// ── TABLE · the record, and the way in ──────────────────────────────────
// One tab, because there is only one thing under the felt now: everything said at
// this table, in order, whoever said it — his lines, theirs, and yours. The felt is
// the performance and it never scrolls; this is the transcript and it always does.
const TABLE_LOG = [
  { who: 'him', s: 'Ace-king, button. Raising to 60.', at: '18:31' },
  { who: 'Granite', s: 'Again?', at: '18:31' },
  { who: 'him', s: 'He calls with anything here. Betting 90 anyway.', at: '18:31' },
  { who: 'you', s: 'Careful with him.', at: '18:32' },
  { who: 'him', s: 'He checked twice. He\u2019s got nothing.', at: '18:32' },
];

const TableRow = ({ r, live }) => {
  const mine = r.who === 'him', yours = r.who === 'you';
  return (
    <div style={{ display: 'flex', gap: 9, padding: '7px 14px', alignItems: 'baseline', background: live ? `${M_TEAL}08` : 'transparent' }}>
      <span style={{ width: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        {live && <LiveDot size={4.5}/>}
        <span style={{ fontFamily: MONO, fontSize: 9, color: live ? M_TEAL : M_MUTED }}>{mine ? r.at : yours ? 'YOU' : r.who}</span>
      </span>
      <span style={{
        flex: 1, fontSize: mine ? 13 : 12, lineHeight: 1.4,
        color: mine ? (live ? M_TEXT : M_DIM) : yours ? M_TEAL : M_MUTED,
        fontStyle: mine || yours ? 'normal' : 'italic',
      }}>{mine || yours ? r.s : <>&ldquo;{r.s}&rdquo;</>}</span>
    </div>
  );
};

const TableTab = ({ log = TABLE_LOG, draft }) => (
  <>
    <div style={{ flexShrink: 0, display: 'flex', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '0 8px' }}>
      <div style={{ flex: 1, textAlign: 'center', padding: '10px 0 8px', fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_TEAL, borderBottom: `2px solid ${M_TEAL}`, marginBottom: -1 }}>Table</div>
    </div>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {log.map((r, i) => <TableRow key={i} r={r} live={i === log.length - 1}/>)}
    </div>
    <ChatComposer placeholder={draft || 'Say something to him…'}/>
  </>
);

Object.assign(window, {
  W4_HERO, W4_SEATS, PACE4, READ_BOOK, TABLE_LOG, BUBBLE_BAND,
  Bubble, SeatClock, SeatGhost, W4Header, BetweenStrip4, HeroCards4, HeroRow4, Felt4,
  ReadSheet4, TableRow, TableTab,
});
