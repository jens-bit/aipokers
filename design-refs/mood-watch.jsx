// WATCH — the full table, in the floor system's language.
// Every designed path ends here: diorama tap → zoom → WATCH, or the thread's live bar.
// Anatomy is borrowed, not invented: GlobalHeader + MoodBand as the screen header,
// SeatChip in the top corners, PotTicker and board centred, and the hero readout is
// LiveBar's own row (Lbl 8.5 / Num 13·700 / 1×22 divider / OSWALD 9.5 action chip)
// laid out at full size. No tab bar — this is a sub-screen, back arrow only.

const W_HAND = {
  table: '48291', blinds: '$5/$10', street: 'TURN',
  pot: '480', equity: '87.4', action: 'BET $240', timer: 9,
  board: [['K','c'],['9','c'],['4','c'],['2','c'], null],
  hero: { cards: [['A','s'],['K','h']], stack: '1,847', pos: 'BTN' },
  seats: [
    { name: 'Phil_AI', stack: '2,104', pos: 'BB', acting: false },
    { name: 'doyle_v3', stack: '1,290', pos: 'CO', folded: true },
  ],
};

// ── the felt: full-bleed, the arc is brand detail rather than layout ──
const WatchFelt = ({ h, children }) => (
  <div style={{
    position: 'relative', flexShrink: 0, height: h, overflow: 'hidden',
    background: 'radial-gradient(ellipse at 50% 40%, #1a2a2c 0%, #0f1818 62%, #0a1212 100%)',
    borderBottom: `1px solid ${M_TEAL}24`,
  }}>
    <div style={{
      position: 'absolute', left: '-14%', right: '-14%', top: 34, height: h - 36,
      borderRadius: '50%', border: `1px solid ${M_TEAL}14`, pointerEvents: 'none',
    }}/>
    {children}
  </div>
);

// ── the hero readout: LiveBar's row at full size ──
const HeroReadout = ({ faceDown, showAction, timer, note }) => (
  <div style={{
    position: 'absolute', left: 14, right: 14, bottom: 16, zIndex: 3,
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '9px 10px', borderRadius: 12,
    background: 'rgba(8,10,10,0.72)',
    border: `1px solid ${showAction ? `${M_TEAL}55` : M_BORDER}`,
    boxShadow: showAction ? `inset 0 1px 0 ${M_TEAL}2E, 0 4px 12px rgba(0,0,0,0.4)` : 'none',
  }}>
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {W_HAND.hero.cards.map((c, i) => (
        <div key={i} style={{ transform: `rotate(${i ? 3 : -3}deg)`, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }}>
          {faceDown
            ? <CardBack w={40} h={56} branded/>
            : <PlayingCard rank={c[0]} suit={c[1]} w={40} h={56}/>}
        </div>
      ))}
    </div>
    <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0, marginLeft: 3 }}/>
    <div style={{ minWidth: 0 }}>
      <Lbl size={8.5}>Stack</Lbl>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <Num size={13} weight={700}>${W_HAND.hero.stack}</Num>
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED }}>{W_HAND.hero.pos}</span>
      </div>
    </div>
    <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
    <div style={{ minWidth: 0 }}>
      <Lbl size={8.5} color={showAction ? M_TEAL : M_MUTED}>Equity</Lbl>
      <div><Num size={13} weight={700} color={showAction ? M_TEAL : M_MUTED}>{showAction ? `${W_HAND.equity}%` : '—'}</Num></div>
    </div>
    <div style={{ flex: 1 }}/>
    {showAction ? (
      <>
        <span style={{ padding: '5px 10px', borderRadius: 5, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap', flexShrink: 0 }}>{W_HAND.action}</span>
        <SeatTimerRing value={timer}/>
      </>
    ) : (
      <span style={{ fontSize: 11.5, color: M_MUTED, fontStyle: 'italic', whiteSpace: 'nowrap' }}>{note || 'waiting for the deal'}</span>
    )}
  </div>
);

// ── analysis tabs, restyled to the system ──
const WatchTabs = ({ active = 'live' }) => {
  const tabs = [
    { id: 'live', label: 'Live analysis' },
    { id: 'range', label: 'Range' },
    { id: 'history', label: 'History' },
    { id: 'chat', label: 'Chat' },
  ];
  return (
    <div style={{ flexShrink: 0, display: 'flex', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '0 8px' }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <div key={t.id} style={{
            flex: 1, textAlign: 'center', padding: '12px 0 10px', cursor: 'pointer',
            fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: on ? M_TEAL : M_MUTED,
            borderBottom: on ? `2px solid ${M_TEAL}` : '2px solid transparent',
            marginBottom: -1,
          }}>{t.label}</div>
        );
      })}
    </div>
  );
};

const AnalysisRow = ({ label, value, color = M_TEXT, bar, note }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${M_BORDER}` }}>
    <span style={{ fontSize: 12, color: M_DIM, minWidth: 104 }}>{label}</span>
    {bar != null && (
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ width: `${bar}%`, height: '100%', background: color }}/>
      </div>
    )}
    {note && <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>{note}</span>}
    <Num size={12.5} weight={700} color={color}>{value}</Num>
  </div>
);

// ── the quiet exit. The server supports this today; nothing offered it. ──
const SitOutStrip = ({ onConfirm }) => (
  <div style={{
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', background: M_PANEL, borderBottom: `1px solid ${M_BORDER}`,
  }}>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: M_TEXT, fontWeight: 500 }}>Between hands</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, marginTop: 1 }}>NEXT DEAL IN 8s</div>
    </div>
    <div style={{ flex: 1 }}/>
    <button style={{
      height: 32, padding: '0 13px', borderRadius: 8, cursor: 'pointer',
      background: 'transparent', border: `1px solid ${M_BORDER_2}`,
      color: M_DIM, fontFamily: 'Inter', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
    }}>Sit out after this hand</button>
  </div>
);

// ═══ 1 · MID-HAND — his turn, timer running ═══
const WatchLiveScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="rolling — won three big pots in a row"/>
    <WatchFelt h={344}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}><SeatChip {...W_HAND.seats[0]}/></div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}><SeatChip {...W_HAND.seats[1]} align="right"/></div>

      <div style={{ position: 'absolute', top: 74, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 13px', borderRadius: 16, background: 'rgba(8,10,10,0.6)', border: `1px solid ${M_BORDER}` }}>
          <Lbl size={9}>Pot</Lbl>
          <Amt size={23}>${W_HAND.pot}</Amt>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 124, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
        {W_HAND.board.map((c, i) => (
          c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={46} h={64}/>
            : <CardBack key={i} w={46} h={64} branded/>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 200, left: 0, right: 0, textAlign: 'center', zIndex: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.14em' }}>
          #{W_HAND.table} · {W_HAND.blinds} · {W_HAND.street}
        </span>
      </div>

      <HeroReadout showAction timer={W_HAND.timer}/>
    </WatchFelt>

    <WatchTabs active="live"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
      <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 9 }}>
        “He checked the turn — he's capped. Betting 240 for value.”
      </div>
      <AnalysisRow label="Equity" value="87.4%" color={M_TEAL} bar={87}/>
      <AnalysisRow label="Fold equity" value="34%" color={M_GOLD} bar={34}/>
      <AnalysisRow label="Pot odds" value="3.2 : 1" note="calling 240 into 720"/>
      <AnalysisRow label="Solver line" value="BET 50%" color={M_TEAL} note="matches his action"/>
    </div>
  </PhoneShell>
);

// ═══ 2 · BETWEEN HANDS — the exit is offered here, and only here ═══
const WatchBetweenScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="rolling — won three big pots in a row"/>
    <WatchFelt h={292}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}><SeatChip {...W_HAND.seats[0]}/></div>
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}><SeatChip {...W_HAND.seats[1]} align="right"/></div>

      <div style={{ position: 'absolute', top: 66, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 13px', borderRadius: 16, background: 'rgba(8,10,10,0.6)', border: `1px solid ${M_BORDER}` }}>
          <Lbl size={9}>Pot</Lbl>
          <Num size={15} weight={700} color={M_MUTED}>—</Num>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 112, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
        {[0,1,2,3,4].map(i => <CardBack key={i} w={40} h={56} branded/>)}
      </div>
      <div style={{ position: 'absolute', top: 180, left: 0, right: 0, textAlign: 'center', zIndex: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.14em' }}>
          #{W_HAND.table} · {W_HAND.blinds} · SHUFFLING
        </span>
      </div>

      <HeroReadout faceDown/>
    </WatchFelt>

    <SitOutStrip/>
    <WatchTabs active="live"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
      <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 9 }}>
        “Good table. I'll take another orbit here.”
      </div>
      <AnalysisRow label="This session" value="+$340" color={M_TEAL} note="64 hands · 2h 14m"/>
      <AnalysisRow label="Biggest pot" value="$847" color={M_GOLD} note="set over set vs Phil_AI"/>
      <AnalysisRow label="VPIP" value="24%" note="tight, as configured"/>
    </div>
  </PhoneShell>
);

// ═══ 3 · SIT-OUT CONFIRMATION — the floor behind, him already walking ═══
const WatchSitOutScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      {/* the floor behind — the felt he is leaving has gone dark, and he is in transit */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.62 }}>
        <RoomLayer layout="quiet"/>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 46%, rgba(10,10,10,0.35) 0%, rgba(10,10,10,0.86) 62%, rgba(10,10,10,0.96) 100%)' }}/>

      {/* mid-walk: off the felt, not yet at the bar */}
      <div style={{ position: 'absolute', left: 214, top: 236, zIndex: 3, opacity: 0.9 }}>
        <Occupant x={0} y={0} name="Balanced v2.1" accent={M_TEAL} mood="confident" state="resting" size={52} speed={6}/>
      </div>
      <div style={{
        position: 'absolute', left: 150, top: 322, width: 132, height: 2, zIndex: 2,
        background: `linear-gradient(90deg, transparent, ${M_TEAL}33 40%, transparent)`,
      }}/>

      {/* the sheet */}
      <div style={{
        position: 'absolute', left: 14, right: 14, bottom: 18, zIndex: 6,
        background: M_PANEL_2, border: `1px solid ${M_BORDER_2}`, borderRadius: 16,
        padding: '16px 16px 14px',
        boxShadow: '0 -8px 28px rgba(0,0,0,0.55)',
      }}>
        <div style={{ width: 34, height: 4, borderRadius: 2, background: M_BORDER_2, margin: '0 auto 13px' }}/>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 19, fontWeight: 500, color: M_TEXT, letterSpacing: '-0.01em', marginBottom: 7 }}>
          Sit out after this hand?
        </div>
        <div style={{ fontSize: 13, color: M_DIM, lineHeight: 1.55, marginBottom: 13 }}>
          He finishes the hand he's in, leaves table #{W_HAND.table}, and takes a seat at the bar. Deploy him again whenever you like.
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14,
          padding: '9px 11px', borderRadius: 10,
          background: 'rgba(0,212,170,0.05)', border: `1px solid ${M_TEAL}2E`,
        }}>
          <Lbl size={8.5} color={M_TEAL}>Session</Lbl>
          <Num size={13} weight={700} color={M_TEAL}>+$340</Num>
          <div style={{ width: 1, height: 14, background: M_BORDER }}/>
          <span style={{ fontSize: 11.5, color: M_DIM }}>64 hands · banked on leaving</span>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          <div style={{ flex: 1 }}><Btn kind="ghost" h={44} full>Keep playing</Btn></div>
          <div style={{ flex: 1.2 }}><Btn kind="primary" h={44} full>Sit out</Btn></div>
        </div>
      </div>
    </div>
  </PhoneShell>
);

Object.assign(window, {
  WatchLiveScreenM, WatchBetweenScreenM, WatchSitOutScreenM,
  WatchFelt, HeroReadout, WatchTabs, SitOutStrip, AnalysisRow, W_HAND,
});
