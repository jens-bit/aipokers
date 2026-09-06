// DESKTOP WAVE 2 — the Command Center's furniture, ported into the panel.
// Blocks below are the old desktop-command.jsx visuals at panel width (492px
// of content inside a 520px panel). Ghosts and moods are the mobile atoms.

const P_PAD = 14;

// small hood avatar, as the old tile header used — built from the mobile atom
const PHood = ({ size = 22, accent = M_TEAL, mood = 'confident' }) => (
  <div style={{
    width: size, height: size, borderRadius: 6, flexShrink: 0,
    background: '#0A0F17', border: `1px solid ${accent}44`,
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
  }}>
    <MoodGhost mood={mood} accent={accent} size={size - 1} ring={false}/>
  </div>
);

// ═══ 1 · STANDUP CARD — greeting w/ voice, KPI strip, suggested chips ═══
const PStandupCard = ({ log }) => (
  <div style={{ background: M_PANEL_2, border: `1px solid ${M_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${M_BORDER}` }}>
      <Lbl size={9.5}>Daily standup · May 6</Lbl>
      <Num size={10} color={M_MUTED} weight={500}>09:41 EST</Num>
    </div>

    <div style={{ padding: '13px 14px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.6 }}>
      Good morning, jmorr. <span style={{ fontStyle: 'italic', color: M_DIM }}>Quiet night — three of four ended up.</span> Your roster netted <span style={{ color: M_TEAL, fontWeight: 600 }}>+$340</span> across <span style={{ color: M_TEXT, fontWeight: 600 }}>184 hands</span>. Two agents still live, two resting. <span style={{ color: M_GOLD }}>Four hands flagged</span> for review.
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: M_BORDER, margin: '0 1px 1px', borderTop: `1px solid ${M_BORDER}` }}>
      {[
        { label: 'NET 24H', value: '+$340', color: M_TEAL, sub: '▲ 14.5%' },
        { label: 'HANDS', value: '184', color: M_TEXT, sub: '12 sessions' },
        { label: 'WIN RATE', value: '58.7%', color: M_TEAL, sub: 'BB/100 8.2' },
        { label: 'BIGGEST POT', value: '$847', color: M_GOLD, sub: 'Balanced v2.1' },
      ].map((s, i) => (
        <div key={i} style={{ background: M_PANEL, padding: '10px 11px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, letterSpacing: '0.14em', marginBottom: 4 }}>{s.label}</div>
          <Num size={16} weight={700} color={s.color}>{s.value}</Num>
          <div style={{ fontFamily: MONO, fontSize: 9, color: M_DIM, marginTop: 2 }}>{s.sub}</div>
        </div>
      ))}
    </div>

    {log && (
      <div style={{ padding: '9px 14px', borderTop: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: M_TEAL, boxShadow: `0 0 6px ${M_TEAL}`, flexShrink: 0 }}/>
        <span style={{ fontSize: 12, color: M_DIM }}>{log}</span>
      </div>
    )}

    <div style={{ padding: '11px 13px', borderTop: `1px solid ${M_BORDER}`, background: 'rgba(0,212,170,0.03)', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
      <Lbl size={9.5} color={M_TEAL}>Suggested →</Lbl>
      {['Review flagged hands', 'Tune Aggressive v1.3', 'Deploy Bluff Master', 'Build new agent'].map((a, i) => (
        <button key={i} style={{
          height: 26, padding: '0 10px', borderRadius: 5,
          background: i === 0 ? M_TEAL : 'transparent',
          border: i === 0 ? 'none' : `1px solid ${M_BORDER_2}`,
          color: i === 0 ? '#0A0A0A' : M_DIM,
          fontFamily: INTER, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>{a}</button>
      ))}
    </div>
  </div>
);

// ═══ 2 · GAME TILE — the sticky bar's expanded form ═══
const PGameTile = ({ agent, accent, mood, table, blinds, pot, equity, action, board, hero, oppName, oppStack, thought }) => {
  const cardW = 32, cardH = 44;
  return (
    <div style={{
      background: M_PANEL_2, border: `1px solid ${accent}55`,
      borderRadius: 10, overflow: 'hidden', boxShadow: `0 0 14px ${accent}11`,
      display: 'flex', flexDirection: 'column', cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
        <PHood size={22} accent={accent} mood={mood}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: M_TEXT, whiteSpace: 'nowrap' }}>{agent}</span>
            <LiveDot size={5}/>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 1, letterSpacing: '0.04em' }}>{table} · {blinds}</div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: M_TEAL, letterSpacing: '0.1em', padding: '2px 5px', background: `${M_TEAL}1A`, borderRadius: 3 }}>LIVE</span>
      </div>

      {/* Flex column, space-between: the three groups can never overlap at any
         height. Height is budgeted from their real sum (~211px) plus padding. */}
      <div style={{
        position: 'relative', height: 232,
        background: 'radial-gradient(ellipse at center, #122520 0%, #0a1612 70%, #07100c 100%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'space-between', padding: '8px 0 6px',
      }}>
        <div style={{
          position: 'absolute', inset: '14% 12%', borderRadius: '50%',
          background: 'radial-gradient(ellipse at center, #1a3530 0%, #0e1a17 70%, #0a1612 100%)',
          border: '1.5px solid #0a0604',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.6), 0 0 0 4px #1a0f06, 0 0 0 5px rgba(0,0,0,0.5)',
        }}>
          <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: `1px solid ${accent}22` }}/>
        </div>

        {/* opponent */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 2 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0a0a0c', border: '1.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: INTER, fontWeight: 700, fontSize: 10, color: M_TEXT }}>
            {oppName.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: 1.5 }}>
            <CardBack w={14} h={20}/><CardBack w={14} h={20}/>
          </div>
          <div style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(0,0,0,0.7)', fontFamily: MONO, fontSize: 9, color: M_TEXT, whiteSpace: 'nowrap' }}>{oppName} · ${oppStack}</div>
        </div>

        {/* pot + board */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 12, background: 'rgba(0,0,0,0.6)', border: `1px solid ${M_BORDER}` }}>
            <span style={{ fontFamily: MONO, fontSize: 8, color: M_MUTED, letterSpacing: '0.16em' }}>POT</span>
            <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: M_TEXT }}>${pot}</span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {board.map((c, i) => (
              c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={cardW} h={cardH}/>
                : <CardBack key={i} w={cardW} h={cardH} branded/>
            ))}
          </div>
        </div>

        {/* hero */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 3 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            <PlayingCard rank={hero.cards[0][0]} suit={hero.cards[0][1]} w={cardW + 2} h={cardH + 4}/>
            <PlayingCard rank={hero.cards[1][0]} suit={hero.cards[1][1]} w={cardW + 2} h={cardH + 4}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px 2px 3px', borderRadius: 14, background: 'rgba(0,0,0,0.7)', border: `1px solid ${accent}` }}>
            <PHood size={18} accent={accent} mood={mood}/>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: accent }}>{equity}%</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED }}>${hero.stack}</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderTop: `1px solid ${M_BORDER}`, background: '#0a0a0c' }}>
        <span style={{ padding: '3px 8px', borderRadius: 4, background: accent, color: '#0A0A0A', fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', flexShrink: 0 }}>{action}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: M_DIM, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic' }}>“{thought}”</span>
        <button style={{ height: 22, padding: '0 8px', borderRadius: 4, background: 'transparent', border: `1px solid ${M_BORDER_2}`, color: M_DIM, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', flexShrink: 0 }}>WATCH →</button>
      </div>
    </div>
  );
};

// ═══ 3 · FLAGGED HANDS CARD ═══
const PFlaggedCard = () => (
  <div style={{ background: M_PANEL_2, border: `1px solid ${M_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderBottom: `1px solid ${M_BORDER}` }}>
      <Lbl size={9.5} color={M_GOLD}>Flagged hands · 4 need review</Lbl>
      <span style={{ fontFamily: MONO, fontSize: 10, color: M_TEAL, fontWeight: 600, cursor: 'pointer' }}>VIEW ALL ↗</span>
    </div>
    <div style={{ padding: '8px 9px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {[
        { agent: 'Balanced v2.1', accent: M_TEAL, mood: 'confident', action: 'Folded TT to 3-bet', stake: '$5/$10', loss: '−$80 EV', cards: [['T','s'],['T','d']] },
        { agent: 'Aggressive v1.3', accent: M_PURPLE, mood: 'tilted', action: 'Bluff-jammed river', stake: '$10/$20', loss: '−$340', cards: [['7','c'],['6','c']] },
        { agent: 'Bluff Master', accent: M_GOLD, mood: 'confident', action: 'Called 4-bet w/ AJo', stake: '$5/$10', loss: '−$120', cards: [['A','h'],['J','s']] },
      ].map((h, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: M_SURF, borderRadius: 6, border: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
          <PHood size={20} accent={h.accent} mood={h.mood}/>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <MiniCard rank={h.cards[0][0]} suit={h.cards[0][1]}/>
            <MiniCard rank={h.cards[1][0]} suit={h.cards[1][1]}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: M_TEXT, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.action}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, marginTop: 1 }}>{h.agent} · {h.stake}</div>
          </div>
          <Num size={11} color={M_RED}>{h.loss}</Num>
          <Icon name="chevron-right" size={14} color={M_MUTED}/>
        </div>
      ))}
    </div>
  </div>
);

// ═══ 4 · COMPOSER — the Command Center composer verbatim (radius-10 box,
// sparkle, 2-row textarea, ⌘↵ chip, square send, Telegram/shortcut footer).
// Only the always-on chip row is demoted: it now appears on "/" focus only. ═══
const PComposer = ({ draft = '', slash }) => (
  <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, padding: `12px ${P_PAD}px 14px` }}>
    {slash ? (
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {[
          { cmd: '/deploy', desc: 'send agent to a table', on: true },
          { cmd: '/build', desc: 'create new agent' },
          { cmd: '/replay', desc: 'pull a hand' },
          { cmd: '/analyze', desc: 'review last session' },
          { cmd: '/sit-out', desc: 'pause an agent' },
        ].map((c, i) => (
          <button key={i} style={{
            height: 24, padding: '0 8px', borderRadius: 4,
            background: c.on ? `${M_TEAL}14` : M_PANEL_2,
            border: `1px solid ${c.on ? `${M_TEAL}55` : M_BORDER}`,
            fontFamily: MONO, fontSize: 10, fontWeight: 600, color: M_DIM,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ color: M_TEAL }}>{c.cmd}</span>
            <span style={{ color: M_MUTED, fontFamily: INTER, fontSize: 10, fontWeight: 500 }}>{c.desc}</span>
          </button>
        ))}
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: M_MUTED, padding: '2px 5px', border: `1px solid ${M_BORDER}`, borderRadius: 3 }}>/</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>for commands</span>
      </div>
    )}

    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: M_PANEL_2, border: `1px solid ${slash ? `${M_TEAL}55` : M_BORDER_2}`, borderRadius: 10, padding: '10px 12px' }}>
      <Icon name="sparkle" size={16} color={M_TEAL}/>
      <textarea
        defaultValue={draft}
        rows={2}
        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: M_TEXT, fontSize: 13.5, fontFamily: INTER, resize: 'none', lineHeight: 1.5 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, padding: '2px 5px', border: `1px solid ${M_BORDER}`, borderRadius: 3 }}>⌘↵</span>
        <button style={{ width: 32, height: 32, borderRadius: 6, background: M_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 10px ${M_TEAL}55` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontFamily: MONO, fontSize: 10, color: M_MUTED }}>
      <span>Synced with Telegram</span>
      <LiveDot size={5}/>
      <div style={{ flex: 1 }}/>
      <span>⌘K commands · ⌘↵ send</span>
    </div>
  </div>
);

// ── roster list for the idle panel ──
const PRosterRow = ({ name, accent, mood, state, line, pnl }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: `9px ${P_PAD}px`, borderBottom: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
    <PHood size={34} accent={accent} mood={mood}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
        <span style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap' }}>{name}</span>
        <StateTag state={state} compact/>
      </div>
      <div style={{
        fontSize: 12, lineHeight: 1.35, fontStyle: 'italic',
        color: `color-mix(in oklab, ${MOODS[mood].color} 32%, ${M_DIM})`,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{line}</div>
    </div>
    <Num size={11.5} color={pnl.startsWith('−') ? M_RED : M_TEAL}>{pnl}</Num>
  </div>
);

const PRoster = () => (
  <>
    <div style={{ padding: `13px ${P_PAD}px 6px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Lbl size={9.5}>The stable · 4</Lbl>
      <span style={{ fontSize: 11, color: M_MUTED }}>click a ghost to zoom</span>
    </div>
    <PRosterRow name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" pnl="+$340"
      line="He checked the turn — he's capped. Betting 240 for value."/>
    <PRosterRow name="Aggressive v1.3" accent={M_PURPLE} mood="tilted" state="live" pnl="+$120"
      line="Third river he's hit on me. I'm fine. I'm FINE."/>
    <PRosterRow name="Bluff Master" accent={M_GOLD} mood="confident" state="recap" pnl="+$210"
      line="Won it. +$480 — he actually called with KQ."/>
    <PRosterRow name="Value Bot" accent={M_PINK} mood="sulking" state="resting" pnl="−$45"
      line="12 hands, nothing playable. I'd rather sit out a while."/>
  </>
);

// ── panel scaffold ──
const P2Panel = ({ head, sub, close, children, composer }) => (
  <div style={{ width: D_PANEL, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column' }}>
    <PanelHead title={head} sub={sub} close={close}/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    {composer}
  </div>
);

// ═══ ARTBOARD 1 · floor + idle panel ═══
const D2IdleScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="two" seats={DESK_SEATS} bar={DESK_BAR} lounge={DESK_LOUNGE}/>
      <P2Panel head="Standup" sub="WED · MAY 6" composer={<PComposer draft="Show me the four flagged hands."/>}>
        <div style={{ padding: `14px ${P_PAD}px 0` }}><PStandupCard/></div>
        <PRoster/>
      </P2Panel>
    </div>
  </DesktopShell>
);

// ═══ ARTBOARD 2 · live agent selected — game tile pinned top ═══
const D2LiveScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="two" seats={DESK_SEATS} bar={DESK_BAR} lounge={DESK_LOUNGE} selected="Balanced v2.1"/>
      <div style={{ width: D_PANEL, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column' }}>
        <PanelHead title="Balanced v2.1" sub="AT THE TABLE" close/>
        <MoodBand accent={M_TEAL} mood="confident" state="live" action="Watch"
          cause="rolling — won three big pots in a row"/>
        {/* the sticky bar's expanded form, pinned */}
        <div style={{ flexShrink: 0, padding: `12px ${P_PAD}px`, borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(0,0,0,0.18)' }}>
          <PGameTile agent="Balanced v2.1" accent={M_TEAL} mood="confident"
            table="NLH 6-Max" blinds="$5/$10" pot="480" equity="87.4" action="BET $240"
            board={[['K','c'],['9','c'],['4','c'],['2','c'], null]}
            hero={{ cards: [['A','s'],['K','h']], stack: '1,847' }}
            oppName="Phil_AI" oppStack="2,104"
            thought="He checked the turn — he's capped"/>
        </div>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 11 }}>
          <EventLine label="Won a 4-bet pot" detail="HAND #846 · AKo vs KQs" amount="+$480" time="09:38"/>
          <AgentBubble mood="confident" accent={M_TEAL} time="09:41">
            Table's passive. I'm opening wider than usual.
          </AgentBubble>
          <OwnerBubble time="09:42">Careful, the club draw is live.</OwnerBubble>
        </div>
        <PComposer draft="Don't stack off if he jams — take the free card."/>
      </div>
    </div>
  </DesktopShell>
);

// ═══ ARTBOARD 3 · resting agent — proposal + flagged card, "/" composer ═══
const D2RestingScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="two" seats={DESK_SEATS} bar={DESK_BAR} lounge={DESK_LOUNGE} selected="Value Bot"/>
      <div style={{ width: D_PANEL, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column' }}>
        <PanelHead title="Value Bot" sub="RESTING" close/>
        <MoodBand accent={M_PINK} mood="sulking" state="resting" action="Deploy"
          cause="12 hands, nothing playable"/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 11 }}>
          <SysLine>Last session · 02:14</SysLine>
          <AgentBubble mood="sulking" accent={M_PINK} time="02:14" expressive>
            12 hands, nothing playable. I'd rather sit out a while.
          </AgentBubble>
          <AgentCardMsg mood="sulking" accent={M_PINK} time="02:16">
            <ProposalCard accent={M_PINK}/>
          </AgentCardMsg>
          <div style={{ padding: `0 ${P_PAD}px`, marginBottom: 9 }}>
            <PFlaggedCard/>
          </div>
        </div>
        <PComposer slash draft="/deploy"/>
      </div>
    </div>
  </DesktopShell>
);

// ═══ ARTBOARD 4 · full table — same thread panel ═══
const D2TableScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskTableStage/>
      <div style={{ width: D_PANEL, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column' }}>
        <PanelHead title="Balanced v2.1" sub="AT THE TABLE" close/>
        {/* the stage is the table, so the bar stays in its compact form */}
        {TURN_BAR_D}
        <MoodBand accent={M_TEAL} mood="confident" state="live" action="Watch"
          cause="rolling — won three big pots in a row"/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 11 }}>
          <EventLine label="Won a 4-bet pot" detail="HAND #846 · AKo vs KQs" amount="+$480" time="09:38"/>
          <AgentBubble mood="confident" accent={M_TEAL} time="09:43" expressive>
            He checked the turn — he's capped. Betting 240 for value.
          </AgentBubble>
          <OwnerBubble time="09:43">Don't stack off if he jams.</OwnerBubble>
          <AgentBubble mood="confident" accent={M_TEAL} time="09:44">
            Agreed. Folding to a raise.
          </AgentBubble>
          <div style={{ padding: `0 ${P_PAD}px`, marginBottom: 9 }}>
            <PFlaggedCard/>
          </div>
        </div>
        <PComposer draft="Fold to a raise. Small ball from here."/>
      </div>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  D2IdleScreenM, D2LiveScreenM, D2RestingScreenM, D2TableScreenM,
  PStandupCard, PGameTile, PFlaggedCard, PComposer, PRoster, PRosterRow, PHood,
});
