// THREAD — ONE screen. The five lifecycle frames below are the SAME component
// rendered with different props. The only permitted differences are the sticky
// bar and the newest messages; everything else is structurally identical.

const AgentBubble = ({ mood, accent, time, children, expressive }) => {
  const m = MOODS[mood];
  return (
    <div style={{ display: 'flex', gap: 9, padding: `0 ${CANON.pad}px`, marginBottom: 9, alignItems: 'flex-end' }}>
      {expressive ? (
        <div style={{ width: 44, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingBottom: 2 }}>
          <MoodGhost mood={mood} accent={accent} size={44}/>
        </div>
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
          <MoodGhost mood={mood} accent={accent} size={27} ring={false}/>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          background: M_PANEL_2, border: `1px solid ${m.color}33`,
          borderLeft: `2px solid ${m.color}`,
          borderRadius: CANON.radius, borderBottomLeftRadius: 4, padding: '10px 13px',
          fontSize: CANON.body, color: M_TEXT, lineHeight: 1.5,
        }}>{children}</div>
        <div style={{ marginTop: 3, paddingLeft: 2 }}><Num size={CANON.meta} color={M_MUTED} weight={500}>{time}</Num></div>
      </div>
    </div>
  );
};

const OwnerBubble = ({ time, children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
    <div style={{ maxWidth: 264 }}>
      <div style={{ background: `${M_TEAL}1A`, border: `1px solid ${M_TEAL}44`, borderRadius: CANON.radius, borderBottomRightRadius: 4, padding: '10px 13px', fontSize: CANON.body, color: M_TEXT, lineHeight: 1.5 }}>{children}</div>
      <div style={{ marginTop: 3, textAlign: 'right' }}><Num size={CANON.meta} color={M_MUTED} weight={500}>{time} · READ</Num></div>
    </div>
  </div>
);

const SysLine = ({ children, color = M_MUTED }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
    <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
    <span style={{ fontFamily: OSWALD, fontSize: CANON.label, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color }}>{children}</span>
    <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
  </div>
);

const EventLine = ({ label, detail, amount, color = M_TEAL, time }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: `0 ${CANON.pad}px 9px`, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.02)', border: `1px solid ${M_BORDER}` }}>
    <div style={{ width: 22, height: 22, borderRadius: 7, background: `${color}1A`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name="trophy" size={11} color={color}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: CANON.sub, color: M_TEXT, fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 1 }}><Num size={CANON.meta} color={M_MUTED} weight={500}>{detail}</Num></div>
    </div>
    <Num size={13} weight={700} color={color}>{amount}</Num>
    <Num size={CANON.meta} color={M_MUTED} weight={500}>{time}</Num>
  </div>
);

const FlaggedChip = ({ cards, label, meta, loss }) => (
  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, background: 'rgba(205,179,128,0.07)', border: `1px solid ${M_GOLD}3D` }}>
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      <MiniCard rank={cards[0][0]} suit={cards[0][1]}/>
      <MiniCard rank={cards[1][0]} suit={cards[1][1]}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: CANON.sub, color: M_TEXT, fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 1 }}><Num size={CANON.meta} color={M_MUTED} weight={500}>{meta}</Num></div>
    </div>
    <Num size={CANON.sub} weight={700} color={M_RED}>{loss}</Num>
  </div>
);

const ProposalCard = ({ accent }) => (
  <div style={{ background: M_PANEL_2, border: `1px solid ${M_GOLD}44`, borderRadius: CANON.radius, borderBottomLeftRadius: 4, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(205,179,128,0.06)' }}>
      <Icon name="edit" size={12} color={M_GOLD}/>
      <Lbl size={CANON.label} color={M_GOLD}>Wants to change itself</Lbl>
      <div style={{ flex: 1 }}/>
      <Lbl size={9}>Your call</Lbl>
    </div>
    <div style={{ padding: '9px 12px 2px', fontSize: 12.5, color: M_TEXT, lineHeight: 1.45 }}>
      I keep getting bullied off flops. I want to tighten up preflop — can I?
    </div>
    <div style={{ padding: '7px 12px 9px' }}>
      {[
        { k: 'Open range', from: '32%', to: '24%' },
        { k: 'Fold to c-bet', from: '61%', to: '44%' },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: i > 0 ? `1px solid ${M_BORDER}` : 'none' }}>
          <span style={{ flex: 1, fontSize: CANON.sub, color: M_DIM }}>{r.k}</span>
          <Num size={11} color={M_MUTED}>{r.from}</Num>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={M_FAINT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <span style={{ minWidth: 44, textAlign: 'right' }}><Num size={CANON.sub} weight={700} color={accent}>{r.to}</Num></span>
        </div>
      ))}
    </div>
    <div style={{ padding: '8px 12px', borderTop: `1px solid ${M_BORDER}`, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Num size={CANON.meta} color={M_MUTED} weight={500}>EST. +2.1 BB/100</Num>
      <div style={{ flex: 1 }}/>
      <Btn kind="ghost" h={28}>Discuss</Btn>
      <Btn kind="primary" h={28}>Accept</Btn>
    </div>
  </div>
);

const AgentCardMsg = ({ mood, accent, time, children }) => (
  <div style={{ display: 'flex', gap: 9, padding: `0 ${CANON.pad}px`, marginBottom: 9, alignItems: 'flex-end' }}>
    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <MoodGhost mood={mood} accent={accent} size={27} ring={false}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      {children}
      <div style={{ marginTop: 3, paddingLeft: 2 }}><Num size={CANON.meta} color={M_MUTED} weight={500}>{time}</Num></div>
    </div>
  </div>
);

// ═══ THE ONE SCREEN ═══
// Header, band, bar slot, feed, composer. Nothing else exists in a thread.
const ThreadScreen = ({ name, accent, mood, cause, state, action, bar, dock, children }) => (
  <PhoneShell>
    <GlobalHeader back title={name}/>
    <MoodBand accent={accent} mood={mood} cause={cause} state={state} action={action}/>
    {bar}
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10 }}>
      {children}
    </div>
    {dock}
    <ChatComposer placeholder={`Message ${name}…`}/>
  </PhoneShell>
);

const TURN_BAR = (
  <LiveBar table="48291" blinds="$5/$10" street="turn" pot="480" equity="62.1" action="TO ACT" timer={9}
    hole={[['Q','s'],['Q','d']]}
    board={[['K','c'],['9','c'],['4','c'],['2','c'],null]}/>
);

// half-docked: the same bar, clipped mid-slide
const DOCKING_BAR = (
  <div style={{ flexShrink: 0, height: 36, overflow: 'hidden', position: 'relative' }}>
    <div style={{ transform: 'translateY(-26px)' }}>
      <LiveBar table="48291" blinds="$5/$10" street="preflop" pot="15" equity="—" action="POSTED SB" timer={18}
        hole={[['Q','s'],['Q','d']]}
        board={[null, null, null]}/>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: `${M_TEAL}66`, boxShadow: `0 0 8px ${M_TEAL}55` }}/>
  </div>
);

// ─── 1 · RESTING — no bar ───
const ThreadRestingScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="resting" action="Deploy"
    cause="that's twice he's rivered me">
    <SysLine>Last session · 09:12</SysLine>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="09:12" expressive>
      28 hands. That's twice he's rivered me. Noted.
      <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>
        Net <span style={{ color: M_TEAL, fontWeight: 600, fontFamily: MONO }}>+$120</span> — should've been <span style={{ fontFamily: MONO }}>+$460</span>.
      </div>
    </AgentBubble>
    <AgentCardMsg mood="frustrated" accent={M_PURPLE} time="09:13">
      <ProposalCard accent={M_PURPLE}/>
    </AgentCardMsg>
  </ThreadScreen>
);

// ─── 2 · DEPLOYING — bar half-docked, newest message just posted ───
const ThreadDeployScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="live" action="Watch"
    cause="taking a seat…" bar={DOCKING_BAR}>
    <OwnerBubble time="09:15">Do it. Then get back out there.</OwnerBubble>
    <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '9px 12px', borderRadius: 9, background: 'rgba(0,212,170,0.06)', border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'center', gap: 9 }}>
      <Icon name="check" size={13} color={M_TEAL} strokeWidth={2.4}/>
      <span style={{ flex: 1, fontSize: 12.5, color: M_TEXT, fontWeight: 500 }}>Change accepted</span>
      <Num size={CANON.meta} color={M_MUTED} weight={500}>V1.3 → V1.4</Num>
    </div>
    <SysLine color={M_TEAL}>Deployed 09:16</SysLine>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="09:16">
      Taking seat at <span style={{ fontFamily: MONO }}>#48291</span> — blinds 5/10.
    </AgentBubble>
  </ThreadScreen>
);

// ─── 3 · LIVE — canon, untouched ───
const ThreadLiveScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="live" action="Watch"
    cause="easing off — you talked him down" bar={TURN_BAR}>
    <EventLine label="Won a 4-bet pot" detail="HAND #846 · AKo vs KQs" amount="+$480" time="09:38"/>
    <AgentBubble mood="tilted" accent={M_PURPLE} time="09:44" expressive>
      Coolered again — aces into kings, he rivers the flush.
      <div style={{ marginTop: 5 }}>I know I'm steaming. Talk me down or let me jam.</div>
    </AgentBubble>
    <OwnerBubble time="09:45">Forget it, you played it right. Small ball for a few orbits.</OwnerBubble>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="09:45">
      …fine. Back to small ball. Thanks.
    </AgentBubble>
    <SysLine color={M_GOLD}>Mood eased · tilted → frustrated</SysLine>
  </ThreadScreen>
);

// ─── 4 · JUST ENDED — bar gone, recap newly posted ───
const ThreadEndedScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="recap" action="Deploy"
    cause="session closed · recap ready">
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="09:45">
      …fine. Back to small ball. Thanks.
    </AgentBubble>
    <SysLine color={M_GOLD}>Session ended · 10:04</SysLine>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="10:04" expressive>
      Done. 41 hands, <span style={{ color: M_TEAL, fontWeight: 600, fontFamily: MONO }}>+$180</span> after the cooler.
      <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>
        Small ball worked. I'd rather not sit with him again tonight, though.
      </div>
      <FlaggedChip cards={[['7','c'],['6','c']]} label="River jam · monotone board" meta="HAND #841 · $10/$20" loss="−$340"/>
    </AgentBubble>
  </ThreadScreen>
);

// ─── 5 · RETURNED LATER ───
const ThreadAwayScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="recap" action="Deploy"
    cause="ended flat after a good start">
    <SysLine color={M_TEAL}>While you were away · 7h</SysLine>
    <AgentBubble mood="confident" accent={M_PURPLE} time="02:14">
      Table went passive around midnight. Opened wider, ran it up to <span style={{ color: M_TEAL, fontWeight: 600, fontFamily: MONO }}>+$620</span>.
    </AgentBubble>
    <SysLine color={M_GOLD}>Mood shifted · confident → frustrated</SysLine>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="05:31" expressive>
      Gave a lot of it back after 4am. Two beats as the favourite, and I pressed when I shouldn't have.
      <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>
        Finished <span style={{ color: M_TEAL, fontWeight: 600, fontFamily: MONO }}>+$210</span> · 3 sessions, 184 hands.
      </div>
      <FlaggedChip cards={[['T','s'],['T','d']]} label="Folded TT to a 3-bet" meta="HAND #829 · $5/$10" loss="−$80 EV"/>
      <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
        <Btn kind="primary" h={30}>Run it back</Btn>
        <Btn kind="ghost" h={30}>Review hands</Btn>
      </div>
    </AgentBubble>
  </ThreadScreen>
);

Object.assign(window, {
  ThreadScreen, ThreadRestingScreenM, ThreadDeployScreenM, ThreadLiveScreenM, ThreadEndedScreenM, ThreadAwayScreenM,
  AgentBubble, OwnerBubble, SysLine, EventLine, FlaggedChip, ProposalCard, AgentCardMsg,
});
