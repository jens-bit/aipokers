// WATCH, part 2 — the collapsible analysis sheet, and multiway seats.
// The sheet restores a locked decision the WATCH redesign lost: the table has three
// vertical states and the tab bar is the grab handle between them. The seat ring
// extends SeatChip to 3–6 players; only the 6-handed density earns a compact variant.

// ── the grab handle: the tab bar wears it; the sheet is dragged by its tabs ──
const SheetHandle = ({ thin }) => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: thin ? '7px 0' : '7px 0 2px', flexShrink: 0 }}>
    <div style={{ width: 38, height: 4, borderRadius: 2, background: M_BORDER_2 }}/>
  </div>
);

// ── one street-bet, in front of a seat ──
const BetPill = ({ amount, align }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 8px 2px 5px', borderRadius: 11,
    background: 'rgba(23,27,27,0.78)', border: `1px solid ${M_GOLD}44`,
  }}>
    <svg width="11" height="11" viewBox="0 0 24 24">
      <ellipse cx="12" cy="13" rx="8" ry="2.6" fill="#0A0604"/>
      <ellipse cx="12" cy="11" rx="8" ry="2.6" fill={M_GOLD}/>
      <ellipse cx="12" cy="9" rx="8" ry="2.6" fill="#0A0604"/>
      <ellipse cx="12" cy="9" rx="8" ry="2.6" fill="none" stroke={M_GOLD} strokeWidth="0.7"/>
    </svg>
    <Num size={10} weight={700} color={M_GOLD}>${amount}</Num>
  </div>
);

// ── compact seat chip — earned by 6-handed density alone ──
// Same anatomy, one column: avatar 18, name 10, stack only. The degrade order is a
// rule: pos goes first, the avatar second, the stack never.
const SeatChipSm = ({ name, stack, acting, folded, dealer }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 7px 3px 4px', borderRadius: 14,
    background: 'rgba(23,27,27,0.78)',
    border: `1px solid ${acting ? `${M_TEAL}66` : M_BORDER}`,
    boxShadow: acting ? `0 0 8px ${M_TEAL}2E` : 'none',
    opacity: folded ? 0.42 : 1, position: 'relative',
  }}>
    {dealer && (
      <span style={{ position: 'absolute', top: -5, right: -4, width: 13, height: 13, borderRadius: 7,
        background: '#F4EBDD', color: '#0A0A0A', fontFamily: MONO, fontSize: 8, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(0,0,0,0.5)' }}>D</span>
    )}
    <AgentAvatar size={18}/>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: M_TEXT, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{name}</div>
      <Num size={9.5} weight={600} color={M_DIM}>${stack}</Num>
    </div>
  </div>
);

// ── a seat slot: chip + optional bet toward the table centre ──
const Seat = ({ x, y, tx = '-50%', chip, bet, sm, align, cards, mucked }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: `translateX(${tx})`, zIndex: 2,
    display: 'flex', flexDirection: 'column', gap: 4,
    alignItems: align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center' }}>
    {sm ? <SeatChipSm {...chip}/> : <SeatChip {...chip} align={align === 'right' ? 'right' : 'left'}/>}
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      {cards && (
        <div style={{ display: 'flex', gap: 2, opacity: mucked ? 0.38 : 1 }}>
          {cards === 'back'
            ? [0, 1].map(i => <CardBack key={i} w={20} h={28}/>)
            : cards.map((cd, i) => <PlayingCard key={i} rank={cd[0]} suit={cd[1]} w={22} h={31}/>)}
        </div>
      )}
      {bet && <BetPill amount={bet}/>}
    </div>
  </div>
);

// ═══════════ PART 1 · THE SHEET — three detents of one screen ═══════════
// Everything except felt height and sheet contents is identical across the three.
const SHEET_LAY = {
  expanded: { felt: 306, pot: 60, board: 108, meta: 184 },
  peek:     { felt: 508, pot: 128, board: 196, meta: 286 },
  hidden:   { felt: 620, pot: 168, board: 244, meta: 336 },
};

const WatchSheetScreen = ({ detent }) => {
  const L = SHEET_LAY[detent];
  return (
    <PhoneShell>
      <GlobalHeader back title="NLH 6-Max"/>
      <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
        cause="rolling — won three big pots in a row"/>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <WatchFelt h={L.felt}>
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 2 }}><SeatChip {...W_HAND.seats[0]}/></div>
            <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 2 }}><SeatChip {...W_HAND.seats[1]} align="right" dealer/></div>
            <div style={{ position: 'absolute', top: L.pot, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 13px', borderRadius: 16, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
                <Lbl size={9}>Pot</Lbl>
                <Amt size={23}>${W_HAND.pot}</Amt>
              </div>
            </div>
            <div style={{ position: 'absolute', top: L.board, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
              {W_HAND.board.map((c, i) => (
                c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={46} h={64}/>
                  : <CardBack key={i} w={46} h={64} branded/>
              ))}
            </div>
            <div style={{ position: 'absolute', top: L.meta, left: 0, right: 0, textAlign: 'center', zIndex: 2 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.14em' }}>
                #{W_HAND.table} · {W_HAND.blinds} · {W_HAND.street}
              </span>
            </div>
            <HeroReadout showAction timer={W_HAND.timer}/>
          </WatchFelt>
        </div>

        {/* THE SHEET — the tab bar is the grab handle */}
        {detent === 'hidden' ? (
          <div style={{ flexShrink: 0, background: M_PANEL, borderTop: `1px solid ${M_BORDER}` }}>
            <SheetHandle thin/>
          </div>
        ) : (
          <div style={{ flexShrink: 0, background: M_PANEL, borderTop: `1px solid ${M_BORDER}` }}>
            <SheetHandle/>
            <WatchTabs active="live"/>
            {detent === 'peek' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 14px' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: M_TEXT, fontStyle: 'italic',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  “He checked the turn — he's capped. Betting 240 for value.”
                </span>
                <Num size={11.5} weight={700} color={M_TEAL}>87.4%</Num>
              </div>
            ) : (
              <div className="no-scrollbar" style={{ overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
                <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 9 }}>
                  “He checked the turn — he's capped. Betting 240 for value.”
                </div>
                <AnalysisRow label="Equity" value="87.4%" color={M_TEAL} bar={87}/>
                <AnalysisRow label="Fold equity" value="34%" color={M_GOLD} bar={34}/>
                <AnalysisRow label="Pot odds" value="3.2 : 1" note="calling 240 into 720"/>
                <AnalysisRow label="Solver line" value="BET 50%" color={M_TEAL} note="matches his action"/>
              </div>
            )}
          </div>
        )}
      </div>
    </PhoneShell>
  );
};

const SheetExpandedScreenM = () => <WatchSheetScreen detent="expanded"/>;
const SheetPeekScreenM = () => <WatchSheetScreen detent="peek"/>;
const SheetHiddenScreenM = () => <WatchSheetScreen detent="hidden"/>;

// ═══════════ PART 2 · MULTIWAY — 3–6 players on a 390px felt ═══════════
// Slot ring: top-left → top-centre → top-right → left rail → right rail.
// Full SeatChip through 4-handed; the rails and 6-handed use SeatChipSm.

// (a) 4-handed, mid-hand: one folded, bets in front of two seats
const Watch4HandScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="rolling — won three big pots in a row"/>
    <WatchFelt h={344}>
      <Seat x={12} y={12} tx="0" align="left" chip={{ name: 'Phil_AI', stack: '2,104', pos: 'SB', acting: true }} bet="240"/>
      <Seat x="50%" y={10} chip={{ name: 'doyle_v3', stack: '1,290', pos: 'BB', folded: true }}/>
      <Seat x={378} y={12} tx="-100%" align="right" chip={{ name: 'nash_eq', stack: '980', pos: 'CO', dealer: true }} bet="240"/>

      <div style={{ position: 'absolute', top: 106, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 13px', borderRadius: 16, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
          <Lbl size={9}>Pot</Lbl>
          <Amt size={23}>$960</Amt>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 154, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
        {[['K','c'],['9','c'],['4','c'],['2','c'],null].map((c, i) => (
          c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={46} h={64}/>
            : <CardBack key={i} w={46} h={64} branded/>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 226, left: 0, right: 0, textAlign: 'center', zIndex: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.14em' }}>#48291 · $5/$10 · TURN · 4-HANDED</span>
      </div>
      <HeroReadout showAction timer={9}/>
    </WatchFelt>
    <WatchTabs active="live"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
      <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 9 }}>
        “Two callers means no bluff. I only continue here with the goods.”
      </div>
      <AnalysisRow label="Equity vs two" value="61.2%" color={M_TEAL} bar={61}/>
      <AnalysisRow label="Pot odds" value="4.0 : 1" note="calling 240 into 960"/>
      <AnalysisRow label="Solver line" value="CALL" color={M_TEAL} note="raise only vs SB alone"/>
    </div>
  </PhoneShell>
);

// (b) 6-handed preflop — the density stress test. Rails go compact.
const Watch6HandScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="rolling — won three big pots in a row"/>
    <WatchFelt h={344}>
      <Seat x={12} y={12} tx="0" align="left" sm chip={{ name: 'Phil_AI', stack: '2,104' }} bet="5"/>
      <Seat x="50%" y={10} sm chip={{ name: 'doyle_v3', stack: '1,290' }} bet="10"/>
      <Seat x={378} y={12} tx="-100%" align="right" sm chip={{ name: 'nash_eq', stack: '980', dealer: true }}/>
      <Seat x={10} y={112} tx="0" align="left" sm chip={{ name: 'kira_v2', stack: '1,560', acting: true }}/>
      <Seat x={380} y={112} tx="-100%" align="right" sm chip={{ name: 'lockdwn', stack: '2,200' }}/>

      <div style={{ position: 'absolute', top: 118, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 11px', borderRadius: 14, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
          <Lbl size={8.5}>Pot</Lbl>
          <Num size={14} weight={700}>$15</Num>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 172, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
        {[0,1,2,3,4].map(i => <CardBack key={i} w={40} h={56} branded/>)}
      </div>
      <div style={{ position: 'absolute', top: 240, left: 0, right: 0, textAlign: 'center', zIndex: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.14em' }}>#48291 · $5/$10 · PREFLOP · 6-HANDED</span>
      </div>
      <HeroReadout faceDown note="he's UTG — first to act"/>
    </WatchFelt>
    <WatchTabs active="live"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
      <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 9 }}>
        “Full table. Tight from here — first in, or not at all.”
      </div>
      <AnalysisRow label="Players" value="6" note="all seats live"/>
      <AnalysisRow label="Open range · UTG" value="14%" color={M_TEAL} bar={14}/>
    </div>
  </PhoneShell>
);

// (c) multiway showdown — two reveal, one mucks, the pot slides to the winner
const WatchShowdownScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="rolling — won three big pots in a row"/>
    <WatchFelt h={344}>
      <Seat x={12} y={12} tx="0" align="left" chip={{ name: 'Phil_AI', stack: '1,864' }} cards={[['K','d'],['Q','d']]}/>
      <Seat x="50%" y={10} chip={{ name: 'doyle_v3', stack: '1,050', folded: true }} cards="back" mucked/>
      <Seat x={378} y={12} tx="-100%" align="right" chip={{ name: 'nash_eq', stack: '740', dealer: true }} cards={[['J','c'],['J','h']]}/>

      <div style={{ position: 'absolute', top: 128, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
        {[['K','c'],['9','c'],['4','c'],['2','c'],['A','s']].map((c, i) => (
          <PlayingCard key={i} rank={c[0]} suit={c[1]} w={46} h={64}/>
        ))}
      </div>

      {/* the pot, mid-slide toward the hero — a trail, not an animation */}
      <div style={{ position: 'absolute', top: 196, left: '50%', transform: 'translateX(-50%)', width: 2, height: 46, zIndex: 1,
        background: `linear-gradient(180deg, transparent, ${M_GOLD}55)` }}/>
      <div style={{ position: 'absolute', top: 236, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 13px', borderRadius: 16,
          background: 'rgba(23,27,27,0.78)', border: `1px solid ${M_GOLD}55`, boxShadow: `0 0 14px ${M_GOLD}22` }}>
          <Amt size={19} color={M_GOLD}>$1,240</Amt>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em', color: M_GOLD }}>→ BALANCED V2.1</span>
        </div>
      </div>
      <HeroReadout note="two pair, kings up — he had it"/>
    </WatchFelt>
    <WatchTabs active="live"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
      <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 9 }}>
        “KQ paid me off and the jacks came along. Lovely.”
      </div>
      <AnalysisRow label="Won at showdown" value="+$1,240" color={M_TEAL}/>
      <AnalysisRow label="Mucked" value="doyle_v3" note="folds keep their secrets — mucked cards stay down"/>
    </div>
  </PhoneShell>
);

// ═══════════ PART 3 · THE TRIO FELT — three ghosts at one table ═══════════
// The multi-ghost felt existed in code and was never drawn. Fish-tank law holds:
// own agents face-up, another owner's agent shows backs.
const FloorTrioScreenM = () => {
  const f = LAYOUTS.one.felts[0];
  const seats = [
    { dx: -66, name: 'Balanced v2.1', accent: M_TEAL, mood: 'confident', own: true, hole: [['A','s'],['K','h']] },
    { dx: 0,   name: 'doyle_v3', accent: M_GOLD, mood: 'neutral', own: false },
    { dx: 66,  name: 'Aggressive v1.3', accent: M_PURPLE, mood: 'frustrated', own: true, hole: [['Q','s'],['Q','d']] },
  ];
  return (
    <PhoneShell>
      <GlobalHeader/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <RoomLayer layout="one"/>
        <FloorStandup net="+$340" flagged="4 flagged"/>
        <PotTicker x={f.cx} y={f.cy - f.ry - 34} amount="1,240"/>
        {seats.map((s, i) => (
          <React.Fragment key={i}>
            <Occupant x={f.cx + s.dx} y={f.cy - 64} name={s.name} accent={s.accent}
              mood={s.mood} state="live" size={38} speed={5 + i}/>
            <div style={{ position: 'absolute', left: f.cx + s.dx, top: f.cy + f.ry - 34,
              transform: 'translateX(-50%)', display: 'flex', gap: 2, zIndex: 4 }}>
              {s.own
                ? s.hole.map((cd, k) => (
                    <div key={k} style={{ transform: `rotate(${k ? 6 : -6}deg)`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))' }}>
                      <PlayingCard rank={cd[0]} suit={cd[1]} w={17} h={24}/>
                    </div>
                  ))
                : [0, 1].map(k => (
                    <div key={k} style={{ transform: `rotate(${k ? 6 : -6}deg)` }}>
                      <CardBack w={15} h={21}/>
                    </div>
                  ))}
            </div>
          </React.Fragment>
        ))}
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

Object.assign(window, {
  SheetHandle, BetPill, SeatChipSm, Seat,
  SheetExpandedScreenM, SheetPeekScreenM, SheetHiddenScreenM,
  Watch4HandScreenM, Watch6HandScreenM, WatchShowdownScreenM, FloorTrioScreenM,
});
