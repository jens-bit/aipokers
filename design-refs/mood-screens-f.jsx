// 11 HAND REVIEW — re-derived from screen #5: same header, same band anatomy,
// same card radius/border, same type scale, same composer. Still reached only
// from a flagged chip — a sheet by navigation, screen #5's language by anatomy.

// `attr` — the character system showing through: one extra label under the verdict,
// naming the attribute that shaped the decision. Gold when it cost money, teal when
// it earned it. Never a grade on the hand; the verdict above already did that.
const StreetRow = ({ street, board, action, reason, equity, matched, attr, last }) => (
  <div style={{ padding: `10px ${CANON.pad}px`, borderBottom: last ? 'none' : `1px solid ${M_BORDER}` }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 7 }}>
      <Lbl size={9}>{street}</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER, marginTop: 5 }}/>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <Num size={14} weight={700} color={matched ? M_TEAL : M_RED}>{equity}%</Num>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: matched ? M_TEAL : M_RED }}>
            {matched ? 'WITH THE MATH' : 'AGAINST IT'}
          </span>
        </div>
        {attr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: attr.cost ? M_GOLD : M_TEAL, opacity: .95 }}>{attr.note}</span>
            <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.13em', color: attr.cost ? M_GOLD : M_TEAL, background: `${attr.cost ? M_GOLD : M_TEAL}14`, border: `1px solid ${attr.cost ? M_GOLD : M_TEAL}44`, borderRadius: 3, padding: '2px 5px' }}>{attr.k}</span>
          </div>
        )}
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0, minWidth: 104 }}>
        {board.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={23} h={32}/>)}
      </div>
      <span style={{
        padding: '3px 8px', borderRadius: 4, flexShrink: 0,
        background: matched ? `${M_TEAL}1A` : 'rgba(255,77,79,0.14)',
        border: `1px solid ${matched ? `${M_TEAL}55` : `${M_RED}55`}`,
        color: matched ? M_TEAL : M_RED,
        fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap',
      }}>{action}</span>
    </div>
    <div style={{ fontSize: CANON.sub, color: M_DIM, lineHeight: 1.45, marginTop: 7, fontStyle: 'italic' }}>
      “{reason}”
    </div>
  </div>
);

// verdict band — same anatomy as MoodBand on screen #5
const VerdictBand = () => (
  <div style={{
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
    padding: `9px ${CANON.pad}px 11px`, borderBottom: `1px solid ${M_BORDER}`,
    background: M_PANEL,
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: CANON.radius, flexShrink: 0,
      background: '#0A0F17', border: `1px solid ${M_PURPLE}55`,
      boxShadow: `0 0 14px ${M_RED}33`,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
    }}>
      <MoodGhost mood="frustrated" accent={M_PURPLE} size={40} ring={false}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 18, padding: '0 6px', borderRadius: 3,
          background: 'rgba(255,77,79,0.12)', border: `1px solid ${M_RED}55`,
        }}>
          <Num size={11} weight={700} color={M_RED}>−$340</Num>
        </span>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: M_MUTED, textTransform: 'uppercase' }}>Bluff-jammed river</span>
      </div>
      <div style={{ fontSize: 11.5, color: M_DIM, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        Aggressive v1.3 · HU $10/$20 · 03:14
      </div>
    </div>
    <Btn kind="outline" h={30}>Open chat</Btn>
  </div>
);

const HandReviewScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Hand #841"/>
    <VerdictBand/>

    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* hole cards */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: `10px ${CANON.pad}px`, borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <PlayingCard rank="7" suit="c" w={30} h={41}/>
          <PlayingCard rank="6" suit="c" w={30} h={41}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500 }}>Suited connectors, BB</div>
          <div style={{ marginTop: 2 }}><Num size={CANON.meta} color={M_MUTED} weight={500}>VS PHIL_AI · 4 STREETS</Num></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Lbl size={8.5}>Pot</Lbl>
          <div><Num size={13} weight={700}>$680</Num></div>
        </div>
      </div>

      <StreetRow street="Preflop" board={[['7','c'],['6','c']]}
        action="CALL $20" equity="38" matched
        reason="Suited connectors in position, cheap price against his opening range."/>

      <StreetRow street="Flop" board={[['K','c'],['9','c'],['4','c']]}
        action="CHECK-CALL $40" equity="71" matched
        reason="Flopped the second-nut flush draw. Calling keeps his bluffs in."/>

      <StreetRow street="Turn" board={[['K','c'],['9','c'],['4','c'],['2','c']]}
        action="CHECK" equity="44" matched
        reason="I made the flush but it's the fourth nut. Checking to control the pot."/>

      <StreetRow street="River" board={[['K','c'],['9','c'],['4','c'],['2','c'],['5','h']]}
        action="JAM $340" equity="38" matched={false} last
        reason="He'd checked twice, so I read weakness. He had the ace of clubs the whole way."/>
    </div>

    {/* screen #5's composer, quoting the hand */}
    <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, padding: `9px ${CANON.pad}px 22px` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <MiniCard rank="7" suit="c"/>
          <MiniCard rank="6" suit="c"/>
        </div>
        <Num size={CANON.meta} color={M_MUTED} weight={500}>HAND #841 WILL BE QUOTED</Num>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 6px 0 14px', borderRadius: 22, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <span style={{ flex: 1, fontSize: 13.5, color: M_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Message Aggressive v1.3…</span>
        <button style={{ width: 32, height: 32, borderRadius: '50%', background: M_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: `0 0 10px ${M_TEAL}55` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </div>
  </PhoneShell>
);

Object.assign(window, { HandReviewScreenM, StreetRow, VerdictBand });
