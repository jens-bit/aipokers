// 05 FULL TABLE — full-bleed rectangular felt, three compression states.
// FULL: table owns the screen. HALF: chat open. STRIP: keyboard up.
// Same hand throughout (#48291, monotone club board, AKo, 87.4%).

const HAND = {
  table: '48291', blinds: '$5/$10', street: 'TURN',
  pot: 480, equity: '87.4', action: 'BET $240', toCall: 240,
  board: [['K','c'],['9','c'],['4','c'],['2','c'], null],
  hero: { cards: [['A','s'],['K','h']], stack: '1,847', pos: 'BTN' },
  seats: [
    { name: 'Phil_AI', stack: '2,104', pos: 'BB', acting: true },
    { name: 'doyle_v3', stack: '1,290', pos: 'CO', folded: true },
  ],
};

// TimerRing — verbatim geometry from play.jsx
const SeatTimerRing = ({ value = 12 }) => {
  const r = 18, c = 2 * Math.PI * r;
  const off = c * (1 - value / 30);
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
        <circle cx="22" cy="22" r={r} fill="none" stroke={M_TEAL} strokeWidth="2"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 22 22)"/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#EDEDED' }}>{value}</div>
    </div>
  );
};

// AgentAvatar container from header.jsx. Mood = eyes + glow only; the dot stays teal (presence).
const SeatAvatar = ({ mood, size = 34 }) => {
  const m = MOODS[mood];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #1a2a2e 0%, #0e1518 100%)',
      border: '1px solid rgba(0, 212, 170, 0.25)',
      boxShadow: mood === 'neutral' ? 'none' : `0 0 10px ${m.color}80`,
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <MoodGhost mood={mood} accent={M_TEAL} size={size * 0.72} ring={false}/>
      <div style={{
        position: 'absolute', bottom: 1, right: 1,
        width: 12, height: 12, borderRadius: '50%',
        background: '#00D4AA', border: '2px solid #0A0A0A',
        boxShadow: '0 0 6px rgba(0,212,170,0.6)',
      }}/>
    </div>
  );
};

// compact seat chip — top corners, never an oval seat ring
const SeatChip = ({ name, stack, pos, acting, folded, align = 'left', dealer }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '4px 9px 4px 5px', borderRadius: 18,
    background: 'rgba(23,27,27,0.72)',
    border: `1px solid ${acting ? `${M_TEAL}66` : M_BORDER}`,
    boxShadow: acting ? `0 0 10px ${M_TEAL}2E` : 'none',
    opacity: folded ? 0.42 : 1,
    flexDirection: align === 'right' ? 'row-reverse' : 'row',
    position: 'relative',
  }}>
    {dealer && (
      <span style={{ position: 'absolute', top: -5, [align === 'right' ? 'left' : 'right']: -4,
        width: 14, height: 14, borderRadius: 7, background: '#F4EBDD', color: '#0A0A0A',
        fontFamily: MONO, fontSize: 8.5, fontWeight: 700, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.5)' }}>D</span>
    )}
    <AgentAvatar size={24}/>
    <div style={{ minWidth: 0, textAlign: align === 'right' ? 'right' : 'left' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: M_TEXT, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <Num size={10} weight={600}>${stack}</Num>
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED }}>{pos}</span>
      </div>
    </div>
  </div>
);

// the felt: a full-bleed rectangle. The arc is brand detail, not layout.
const Felt = ({ children, mode }) => (
  <div style={{
    position: 'relative', flexShrink: 0,
    height: mode === 'strip' ? 96 : mode === 'half' ? 336 : '100%',
    flex: mode === 'full' ? 1 : 'none',
    minHeight: 0, overflow: 'hidden',
    background: 'radial-gradient(ellipse at 50% 42%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)',
    borderBottom: mode === 'full' ? 'none' : `1px solid ${M_TEAL}38`,
  }}>
    {/* inner arc — decorative only */}
    {mode !== 'strip' && (
      <div style={{
        position: 'absolute', left: '-14%', right: '-14%',
        top: mode === 'half' ? 26 : 74, height: mode === 'half' ? 300 : 470,
        borderRadius: '50%', border: `1px solid ${M_TEAL}1F`,
        pointerEvents: 'none',
      }}/>
    )}
    {children}
  </div>
);

const PotPill = ({ size = 'lg' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: size === 'sm' ? '2px 10px' : '3px 13px', borderRadius: 16, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
    <Lbl size={size === 'sm' ? 8.5 : 9}>Pot</Lbl>
    {size === 'sm'
      ? <Num size={13} weight={700}>${HAND.pot}</Num>
      : <Amt size={size === 'lg' ? 25 : 21}>${HAND.pot}</Amt>}
  </div>
);

const Board = ({ w, h, gap = 5 }) => (
  <div style={{ display: 'flex', gap }}>
    {HAND.board.map((c, i) => (
      c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={w} h={h}/>
        : <CardBack key={i} w={w} h={h} branded/>
    ))}
  </div>
);

const EquityBlock = ({ compact }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: compact ? '5px 10px' : '8px 12px', borderRadius: 9, background: 'rgba(23,27,27,0.62)', border: `1px solid ${M_TEAL}2E` }}>
    <Lbl size={8.5} color={M_TEAL}>Equity</Lbl>
    <Num size={compact ? 13 : 15} weight={700} color={M_TEAL}>{HAND.equity}%</Num>
    <div style={{ width: 1, height: 14, background: M_BORDER }}/>
    <span style={{ padding: '3px 8px', borderRadius: 4, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{HAND.action}</span>
  </div>
);

// Law 1 — the global header is identical here too; the felt goes immersive beneath it.
const TableTopBar = () => <GlobalHeader back title="NLH 6-Max"/>;

const TableSubBar = () => (
  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 9px' }}>
    <StateTag state="live" compact/>
    <Num size={9.5} color={M_MUTED} weight={500}>#{HAND.table} · {HAND.blinds} · {HAND.street}</Num>
    <div style={{ flex: 1 }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: '#0A0F17', border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
        <MoodGhost mood="confident" accent={M_TEAL} size={21} ring={false}/>
      </div>
      <span style={{ fontSize: 11.5, color: M_TEXT, fontWeight: 500 }}>Balanced v2.1</span>
    </div>
  </div>
);

// ─── STATE 1 · FULL ───
const TableFullScreenM = () => (
  <PhoneShell>
    <TableTopBar/>
    <TableSubBar/>
    <Felt mode="full">
      {/* seat chips, top corners */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}>
        <SeatChip {...HAND.seats[0]}/>
      </div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}>
        <SeatChip {...HAND.seats[1]} align="right"/>
      </div>

      {/* board + pot, centred */}
      <div style={{ position: 'absolute', top: '34%', left: 0, right: 0, transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13, zIndex: 1 }}>
        <PotPill/>
        <Board w={42} h={58}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="chip" size={14} color={M_TEAL}/>
          <Num size={12} weight={600} color={M_TEAL}>${HAND.toCall}</Num>
          <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: M_MUTED }}>TO CALL</span>
        </div>
      </div>

      {/* hero, bottom */}
      <div style={{ position: 'absolute', bottom: 74, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, zIndex: 2 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <PlayingCard rank={HAND.hero.cards[0][0]} suit={HAND.hero.cards[0][1]} w={46} h={63}/>
          <PlayingCard rank={HAND.hero.cards[1][0]} suit={HAND.hero.cards[1][1]} w={46} h={63}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SeatAvatar mood="confident" size={34}/>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: M_TEXT, lineHeight: 1.15 }}>Balanced v2.1</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <Num size={11} weight={600}>${HAND.hero.stack}</Num>
              <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED }}>{HAND.hero.pos}</span>
            </div>
          </div>
          <SeatTimerRing value={9}/>
        </div>
        <EquityBlock/>
      </div>

      {/* slim chat handle */}
      <div style={{ position: 'absolute', bottom: 14, left: 14, right: 14, zIndex: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 12px', borderRadius: 20, background: 'rgba(23,27,27,0.9)', border: `1px solid ${M_BORDER_2}` }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, flexShrink: 0, background: '#0A0F17', border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
            <MoodGhost mood="confident" accent={M_TEAL} size={23} ring={false}/>
          </div>
          <span style={{ flex: 1, fontSize: 12, color: M_DIM, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“He checked the turn — he's capped.”</span>
          <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: M_TEAL, color: '#0A0A0A', fontFamily: MONO, fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M18 15l-6-6-6 6"/></svg>
        </div>
      </div>
    </Felt>
  </PhoneShell>
);

// ─── STATE 2 · HALF ───
const TableHalfScreenM = () => (
  <PhoneShell>
    <TableTopBar/>
    <TableSubBar/>
    <Felt mode="half">
      <div style={{ position: 'absolute', top: 10, left: 12, zIndex: 2 }}><SeatChip {...HAND.seats[0]}/></div>
      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 2 }}><SeatChip {...HAND.seats[1]} align="right"/></div>

      <div style={{ position: 'absolute', top: 62, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 1 }}>
        <PotPill size="md"/>
        <Board w={34} h={47} gap={4}/>
      </div>

      <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, display: 'flex', alignItems: 'flex-end', gap: 10, zIndex: 2 }}>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <PlayingCard rank={HAND.hero.cards[0][0]} suit={HAND.hero.cards[0][1]} w={34} h={47}/>
          <PlayingCard rank={HAND.hero.cards[1][0]} suit={HAND.hero.cards[1][1]} w={34} h={47}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <EquityBlock compact/>
        </div>
        <SeatTimerRing value={9}/>
      </div>
    </Felt>

    {/* chat below */}
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 12, background: M_BG }}>
      <AgentBubble mood="confident" accent={M_TEAL} time="09:41">
        Table's passive. I'm opening wider than usual.
      </AgentBubble>
      <OwnerBubble time="09:42">Careful, the club draw is live.</OwnerBubble>
      <AgentBubble mood="confident" accent={M_TEAL} time="09:43">
        He checked the turn — he's capped. Betting 240 for value.
      </AgentBubble>
    </div>
    <ChatComposer placeholder="Message Balanced v2.1…"/>
  </PhoneShell>
);

// ─── STATE 3 · STRIP (keyboard up) ───
const TableStripScreenM = () => (
  <PhoneShell>
    <TableTopBar/>
    {/* pinned slim band — identity row + data row, both inside the same 96px */}
    <Felt mode="strip">
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '0 13px' }}>
        {/* identity row — same content as TableSubBar on 05a / 05b */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StateTag state="live" compact/>
          <Num size={9} color={M_MUTED} weight={500}>#{HAND.table} · {HAND.blinds} · {HAND.street}</Num>
          <div style={{ flex: 1 }}/>
          <div style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: '#0A0F17', border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
            <MoodGhost mood="confident" accent={M_TEAL} size={17} ring={false}/>
          </div>
          <span style={{ fontSize: 10.5, color: M_TEXT, fontWeight: 500, whiteSpace: 'nowrap' }}>Balanced v2.1</span>
        </div>
        {/* data row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Board w={20} h={28} gap={2}/>
          <div style={{ width: 1, height: 24, background: M_BORDER, flexShrink: 0 }}/>
          <div>
            <Lbl size={8}>Pot</Lbl>
            <div><Num size={12.5} weight={700}>${HAND.pot}</Num></div>
          </div>
          <div style={{ width: 1, height: 24, background: M_BORDER, flexShrink: 0 }}/>
          <div>
            <Lbl size={8} color={M_TEAL}>Equity</Lbl>
            <div><Num size={12.5} weight={700} color={M_TEAL}>{HAND.equity}%</Num></div>
          </div>
          <div style={{ flex: 1 }}/>
          <span style={{ padding: '3px 8px', borderRadius: 4, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', flexShrink: 0 }}>{HAND.action}</span>
          <Num size={9.5} color={M_DIM} weight={600}>9s</Num>
        </div>
      </div>
    </Felt>

    {/* chat fills the middle */}
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 11, background: M_BG }}>
      <OwnerBubble time="09:42">Careful, the club draw is live.</OwnerBubble>
      <AgentBubble mood="confident" accent={M_TEAL} time="09:43">
        He checked the turn — he's capped. Betting 240 for value.
      </AgentBubble>
      <OwnerBubble time="09:43">Fine. Don't stack off if he jams.</OwnerBubble>
    </div>

    {/* input above the keyboard */}
    <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '9px 14px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 40, padding: '0 6px 0 13px', borderRadius: 20, background: M_PANEL_2, border: `1px solid ${M_TEAL}55` }}>
        <span style={{ flex: 1, fontSize: 13, color: M_TEXT }}>Take the free card if he leads</span>
        <button style={{ width: 30, height: 30, borderRadius: '50%', background: M_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 10px ${M_TEAL}55` }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
    <div style={{ flexShrink: 0 }}><IOSKeyboard dark={true}/></div>
  </PhoneShell>
);

Object.assign(window, { TableFullScreenM, TableHalfScreenM, TableStripScreenM, SeatChip, SeatAvatar, SeatTimerRing, HAND });
