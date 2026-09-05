// CHARACTER SYSTEM · WAVE 3 — the system showing through daily play.
// No new screens. Thread, floor, zoom and hand review, each carrying one more fact.

// ── the growth line: thread furniture, his voice ──────────────────────────────
// EventLine's anatomy (22px well, existing sparkle icon, mono meta) with the tick
// in the well line and his sentence underneath. Quiet on purpose: a point of Reads
// is not a trophy, and the thread already knows how to log an event.
const GrowthLine = ({ attr, from, to, line, time }) => (
  <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '9px 12px', borderRadius: 9, background: 'rgba(0,212,170,0.05)', border: `1px solid ${M_TEAL}33` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <div style={{ width: 22, height: 22, borderRadius: 7, background: `${M_TEAL}1A`, border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name="sparkle" size={11} color={M_TEAL}/>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: M_TEAL, flex: 1 }}>
        {attr} {from} <span style={{ color: M_MUTED }}>&rarr;</span> {to}
      </span>
      <Num size={9} color={M_MUTED} weight={500}>{time}</Num>
    </div>
    <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.45, marginTop: 7, paddingLeft: 31, fontStyle: 'italic' }}>&ldquo;{line}&rdquo;</div>
  </div>
);

// ── the training line: one row inside the recap bubble ───────────────────────
const TrainingLine = ({ items }) => (
  <div style={{ marginTop: 9, paddingTop: 8, borderTop: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
    <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: M_MUTED }}>TONIGHT TRAINED</span>
    {items.map(i => (
      <span key={i.k} style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: M_TEAL }}>{i.k} +{i.n}</span>
    ))}
  </div>
);

const ThreadGrowthScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="confident" state="recap" action="Deploy"
    cause="closed +$210 — and learned something">
    <SysLine>Session closed · 02:14</SysLine>
    <AgentBubble mood="confident" accent={M_PURPLE} time="02:14" expressive>
      210 hands against the same four. I know two of them now.
      <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>
        Net <span style={{ color: M_TEAL, fontWeight: 600, fontFamily: MONO }}>+$210</span> &middot; 210 hands &middot; 3h 40m
      </div>
      <TrainingLine items={[{ k: 'READS', n: 1 }, { k: 'DISCIPLINE', n: 1 }]}/>
    </AgentBubble>
    <GrowthLine attr="READS" from={61} to={62} time="02:14"
      line="I'm starting to see through Granite. He sizes up when he's got it and he doesn't know he does it."/>
    <GrowthLine attr="DISCIPLINE" from={72} to={73} time="02:14"
      line="Folded top pair on the river once tonight. It was the right fold. It still hurt."/>
    <OwnerBubble time="08:02">Good. Same table tomorrow.</OwnerBubble>
  </ThreadScreen>
);

// ── fatigue on the floor: posture drift, nothing else ────────────────────────
// FATIGUE IS NOT A MOOD, so it cannot use the mood channel: no aura change, no rim
// change, no eye shape from the mood set. What it gets is HEAVY LIDS, a slower
// float and a small sink — the three things a body does when it is tired.
const WornGhost = ({ mood, accent, size = 56, speed = 5 }) => {
  const cy = mood === 'sulking' ? 46 : 42;
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.2, transform: 'translateY(4px) scale(0.985)' }}>
      <FloorGhost mood={mood} accent={accent} size={size} speed={speed * 1.7}/>
      {/* the lids ride the same bob, so they cannot drift off the eyes */}
      <div style={{ position: 'absolute', inset: 0, animation: `bob ${speed * 1.7}s ease-in-out infinite`, pointerEvents: 'none' }}>
        <svg width={size} height={size * 1.2} viewBox="0 0 80 96" style={{ display: 'block', overflow: 'visible' }}>
          <rect x="26" y={cy - 7.6} width="28" height="6.4" fill="#04070C"/>
          <path d={`M27 ${cy - 1.4} L53 ${cy - 1.4}`} stroke={`${accent}55`} strokeWidth="0.9" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
};

const WornOccupant = ({ x, y, name, accent, mood, state, size = 56, speed = 5 }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', zIndex: 3 }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <GhostChip name={name} accent={accent} state={state}/>
      <WornGhost mood={mood} accent={accent} size={size} speed={speed}/>
      <div style={{ width: size * 1.1, height: 12, borderRadius: '50%', marginTop: -4, background: `radial-gradient(ellipse, ${MOODS[mood].color}2E, transparent 70%)` }}/>
    </div>
  </div>
);

// The shipped two-game floor, with one difference: Aggressive v1.3 is 140 hands in.
// Same seats, same cast, same moods — worn is a posture swap and nothing more.
const FloorFatigueScreenM = () => (
  <FloorScreen layout="two"
    standup={{ net: '+$460', flagged: '4 flagged' }}
    seats={{
      0: { ...CAST.balanced, pot: '480' },
      1: { ...CAST.aggressive, pot: '120', worn: true, speed: 3.4 },
    }}
    bar={[{ ...CAST.bluff, x: 78, state: 'recap', size: 48 }]}
    lounge={{ ...CAST.value, state: 'resting', size: 48 }}
    ghostSize={50}/>
);

// ── the zoom, worn ───────────────────────────────────────────────────────────
// The strip stays the GAME. Fatigue is a fact about him, so it rides the zoom's
// existing `extra` slot, docked directly under the strip — read as the strip's
// second line, authored as state about the agent.
const ZoomFatigueRow = () => (
  <div style={{ marginTop: -4, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}3D` }}>
    <div style={{ display: 'flex', gap: 3, width: 40, flexShrink: 0 }}>
      {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 5, borderRadius: 2.5, background: i < 1 ? M_GOLD : M_SURF, boxShadow: i < 1 ? `0 0 6px ${M_GOLD}44` : 'none' }}/>)}
    </div>
    <span style={{ flex: 1, fontSize: 12.5, color: M_GOLD, lineHeight: 1.4 }}>140 hands in &mdash; he&rsquo;s worn</span>
    <Num size={9} color={M_MUTED} weight={500}>FOCUS &minus;6</Num>
  </div>
);

const ZoomWornScreenM = () => (
  <ZoomView name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="live" pot="120"
    line="I've been here a while. Give me the easy spots and I'll take them."
    cause="two rivers called back — 140 hands in" primary="watch"
    extra={<ZoomFatigueRow/>}
    strip={{ table: '38104', blinds: '$10/$20', street: 'turn', pot: '120', equity: '44.0',
             action: 'TO ACT', timer: 11, hole: [['Q','s'],['Q','d']],
             board: [['K','c'],['9','c'],['4','c'],['2','c'], null] }}/>
);

// ── hand review, annotated ───────────────────────────────────────────────────
const HandReviewAttrScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Hand #841"/>
    <VerdictBand/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: `10px ${CANON.pad}px`, borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <PlayingCard rank="7" suit="c" w={30} h={41}/>
          <PlayingCard rank="6" suit="c" w={30} h={41}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500 }}>Suited connectors, BB</div>
          <div style={{ marginTop: 2 }}><Num size={CANON.meta} color={M_MUTED} weight={500}>VS PHIL_AI · 4 STREETS · HAND 147 OF THE SESSION</Num></div>
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
        attr={{ note: 'held the line', k: 'DISCIPLINE' }}
        reason="Flopped the second-nut flush draw. Calling keeps his bluffs in."/>

      <StreetRow street="Turn" board={[['K','c'],['9','c'],['4','c'],['2','c']]}
        action="CHECK" equity="44" matched
        reason="I made the flush but it's the fourth nut. Checking to control the pot."/>

      <StreetRow street="River" board={[['K','c'],['9','c'],['4','c'],['2','c'],['5','h']]}
        action="JAM $340" equity="38" matched={false} last
        attr={{ note: 'misread equity by 7%', k: 'FOCUS', cost: true }}
        reason="He'd checked twice, so I read weakness. He had the ace of clubs the whole way."/>
    </div>

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

// The explainer, at 1:1 — it belongs to the hand review's footer (reached by the same
// scroll that reaches the river row) and is shown here at full size, following the
// canvas's precedent for detail that will not fit inside a phone frame.
const RiverAttrPanel = () => (
  <div style={{ width: 390, background: M_BG, fontFamily: INTER, padding: `12px ${CANON.pad}px 14px` }}>
    <div style={{ padding: '11px 13px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <Lbl size={9} color={M_GOLD}>Why the river went wrong</Lbl>
        <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
        <Num size={9} color={M_MUTED} weight={500}>WORN · 140 HANDS</Num>
      </div>
      <AttrBar row name="FOCUS" cur={62} lo={70} hi={75} w="100%" fatigued/>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 10 }}>
        He priced the river at 45% and it was 38%. That is what a Focus of 62 does about once an hour &mdash; and at hand 147 he was six points below his own number. <b style={{ color: M_DIM }}>The strategy was not wrong here. The execution was.</b>
      </div>
    </div>
  </div>
);

// ── desktop: the roster badge ────────────────────────────────────────────────
// The subtlest surface in the system, and the one with the least room: a roster row
// already carries name, mood, state, P&L and his last line. Growth gets a single
// mono chip in the P&L column's shadow — no icon, no colour beyond the teal it
// shares with every other gain.
const GrewBadge = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 15, padding: '0 5px', borderRadius: 3, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}3D`, whiteSpace: 'nowrap' }}>
    <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em', color: M_TEAL }}>+2</span>
    <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL, opacity: .8 }}>GREW</span>
  </span>
);

const RosterGrowthRow = ({ name, accent, mood, state, line, pnl, grew }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 16px', borderBottom: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
    <PHood size={34} accent={accent} mood={mood}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <StateTag state={state} compact/>
        {grew && <GrewBadge/>}
      </div>
      <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</div>
    </div>
    <Num size={12} weight={700} color={pnl.startsWith('−') ? M_RED : pnl === '—' ? M_MUTED : M_TEAL}>{pnl}</Num>
  </div>
);

const RosterGrowthPanel = () => (
  <div style={{ width: 340, flexShrink: 0, borderRight: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column' }}>
    <PanelHead title="Chats" sub="4 AGENTS · 2 LIVE"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <RosterGrowthRow name="Aggressive v1.3" accent={M_PURPLE} mood="confident" state="recap"
        line="I'm starting to see through Granite." pnl="+$210" grew/>
      <RosterGrowthRow name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live"
        line="He's capped. Betting 240 for value." pnl="+$340"/>
      <RosterGrowthRow name="Bluff Master" accent={M_GOLD} mood="confident" state="recap"
        line="Won it. +$480 — he called with KQ." pnl="+$480"/>
      <RosterGrowthRow name="Value Bot" accent={M_PINK} mood="sulking" state="resting"
        line="12 hands, nothing playable." pnl="−$45"/>
    </div>
  </div>
);

const D3RosterGrowthScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$985" flagged="2 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <RosterGrowthPanel/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
        <MoodBand accent={M_PURPLE} mood="confident" state="recap" action="Deploy"
          cause="closed +$210 — and learned something"/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
            <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.18em' }}>THU · MAY 7 · 02:14</span>
            <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
          </div>
          <div style={{ display: 'flex', gap: 12, maxWidth: 620, marginBottom: 16 }}>
            <PHood size={32} accent={M_PURPLE} mood="confident"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT }}>Aggressive v1.3</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>02:14</span>
              </div>
              <div style={{ background: M_PANEL_2, border: `1px solid ${M_PURPLE}3D`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
                210 hands against the same four. I know two of them now.
                <div style={{ marginTop: 6, color: M_DIM, fontSize: 12.5 }}>
                  Net <span style={{ color: M_TEAL, fontWeight: 600, fontFamily: MONO }}>+$210</span> &middot; 210 hands &middot; 3h 40m
                </div>
                <TrainingLine items={[{ k: 'READS', n: 1 }, { k: 'DISCIPLINE', n: 1 }]}/>
              </div>
            </div>
          </div>
          <div style={{ marginLeft: 44, maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <GrowthTick attr="READS" from={61} to={62} cause="he sizes up when he has it, and he does not know he does it."/>
            <GrowthTick attr="DISCIPLINE" from={72} to={73} cause="folded top pair on the river, correctly, once tonight."/>
          </div>
        </div>
        <PComposer draft=""/>
      </div>
      <Panel>
        <PanelHead title="Player card" sub="AGGRESSIVE V1.3" close/>
        <PlayerCardRail who="vet"/>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  GrowthLine, TrainingLine, WornGhost, WornOccupant, ZoomFatigueRow, GrewBadge, RiverAttrPanel,
  RosterGrowthRow, RosterGrowthPanel,
  ThreadGrowthScreenM, FloorFatigueScreenM, ZoomWornScreenM, HandReviewAttrScreenM,
  D3RosterGrowthScreenM,
});
