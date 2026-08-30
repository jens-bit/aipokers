// THE SNACK — the first item, designed before it is built.
// Scope law: items touch STATE, never SKILL. One snack, one effect (soothe one mood
// step, sharing the pep-talk cooldown), one button. No store, no prices, no currency
// iconography anywhere. The moment reads as feeding a pet, not buying a powerup.

// ── the biscuit: warm gold, a bite taken, three seeds. Flavor, never a coin. ──
const Biscuit = ({ size = 14, dim }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" style={{ display: 'block', opacity: dim ? 0.45 : 1 }}>
    <circle cx="10" cy="10" r="8" fill={M_GOLD}/>
    <circle cx="16.5" cy="5" r="4.6" fill={M_PANEL_2}/>
    <circle cx="7" cy="8" r="1.2" fill="#8A6B3F"/>
    <circle cx="11" cy="13" r="1.2" fill="#8A6B3F"/>
    <circle cx="6.5" cy="13.5" r="1" fill="#8A6B3F"/>
  </svg>
);

// remaining count as pips — a pantry, not a wallet
const SnackPips = ({ left, dim }) => (
  <span style={{ display: 'inline-flex', gap: 3 }}>
    {[0, 1, 2].map(i => (
      <span key={i} style={{ width: 5, height: 5, borderRadius: '50%',
        background: i < left ? (dim ? M_MUTED : M_GOLD) : 'transparent',
        border: `1px solid ${i < left ? (dim ? M_MUTED : M_GOLD) : M_BORDER_2}` }}/>
    ))}
  </span>
);

// ── THE BUTTON — one chip, three states. Absent entirely when he's fine. ──
const SnackChip = ({ left = 2, state = 'ready', time = '11:40', full }) => {
  const ready = state === 'ready';
  const label = state === 'ready' ? 'Give him a snack'
    : state === 'cooldown' ? 'Snacked recently' : 'Pantry empty';
  const sub = state === 'ready' ? null
    : state === 'cooldown' ? `again in ${time} · shared with pep talk` : 'restocks at 08:00';
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 9,
      height: 40, padding: '0 14px 0 11px', borderRadius: 20,
      background: ready ? 'rgba(205,179,128,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${ready ? `${M_GOLD}55` : M_BORDER}`,
      cursor: ready ? 'pointer' : 'default',
      width: full ? '100%' : 'auto', justifyContent: full ? 'space-between' : 'flex-start',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
        <Biscuit size={16} dim={!ready}/>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500,
            color: ready ? M_TEXT : M_MUTED, lineHeight: 1.15 }}>{label}</span>
          {sub && <span style={{ display: 'block', fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 1 }}>{sub}</span>}
        </span>
      </span>
      <SnackPips left={left} dim={!ready}/>
    </div>
  );
};

// docked above the composer — care sits next to talking, not inside it
const SnackDock = (props) => (
  <div style={{ flexShrink: 0, padding: '9px 14px 0', display: 'flex' }}>
    <SnackChip full {...props}/>
  </div>
);

// ═══ 1 · THE BUTTON — a tilted agent, chip ready, two snacks left ═══
const SnackThreadScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="tilted" state="resting" action="Deploy"
    cause="steaming — lost two big pots as favourite"
    dock={<SnackDock left={2} state="ready"/>}>
    <SysLine>Session ended · 18:04</SysLine>
    <AgentBubble mood="tilted" accent={M_PURPLE} time="18:04" expressive>
      Twice. TWICE he backdoors it. I'm fine. I'm FINE.
    </AgentBubble>
    <AgentBubble mood="tilted" accent={M_PURPLE} time="18:05">
      Don't deploy me yet. I'd punt.
    </AgentBubble>
  </ThreadScreen>
);

// the chip's other lives, at 1:1 — cooldown, empty, and the absence rule
const SnackStatesStripM = () => (
  <div style={{ width: 390, display: 'flex', flexDirection: 'column', gap: 8, background: M_BG,
    padding: '14px', borderRadius: 14, border: `1px solid ${M_BORDER}` }}>
    <SnackChip full left={1} state="cooldown" time="11:40"/>
    <SnackChip full left={0} state="empty"/>
    <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, padding: '2px 4px 0' }}>
      When his mood is confident or neutral the chip is not disabled — it is <b style={{ color: M_DIM }}>absent</b>.
      Care you cannot spend wrongly needs no grey state.
    </div>
  </div>
);

// ═══ 2 · THE MOMENT — one beat later: acknowledged, stepped down, decremented ═══
const SnackMomentScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="resting" action="Deploy"
    cause="stepped down — was tilted a minute ago"
    dock={<SnackDock left={1} state="cooldown" time="14:52"/>}>
    <AgentBubble mood="tilted" accent={M_PURPLE} time="18:05">
      Don't deploy me yet. I'd punt.
    </AgentBubble>
    <EventLine label="You gave him a snack" detail="TILTED ▾ FRUSTRATED · one step" color={M_GOLD} time="18:06"/>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="18:06">
      …chewing. Fine. Still annoyed, but fine. Thanks.
    </AgentBubble>
  </ThreadScreen>
);

// ═══ 3 · THE REFUSAL — he's fine; the house declines, in-world ═══
const SnackRefusalScreenM = () => (
  <ThreadScreen name="Balanced v2.1" accent={M_TEAL} mood="confident" state="resting" action="Deploy"
    cause="rolling — won three big pots in a row">
    <SysLine>Today · 18:10</SysLine>
    <OwnerBubble time="18:10">Here — have a snack.</OwnerBubble>
    <EventLine label="He's fine. Save it." detail="SNACKS KEPT · soothes a mood, and he hasn't got one" color={M_MUTED} time="18:10"/>
    <AgentBubble mood="confident" accent={M_TEAL} time="18:11">
      Appreciated. Feed me when I'm losing.
    </AgentBubble>
  </ThreadScreen>
);

// ═══ 4 · THE ZOOM — the same affordance where a sulking ghost gets zoomed ═══
const SnackZoomScreenM = () => (
  <ZoomView name="Value Bot" accent={M_PINK} mood="sulking" state="resting"
    line="12 hands, nothing playable. I'd rather sit out a while."
    cause="card-dead all night — sat out at 02:14"
    extra={<SnackChip full left={2} state="ready"/>}/>
);

// ═══ 5 · FLAVOR — just snacked, at the bar: a biscuit, two crumbs, six seconds ═══
const SnackFloorScreenM = () => {
  const L = LAYOUTS.quiet;
  return (
    <PhoneShell>
      <style>{`@keyframes crumbfade { 0% { opacity: 0; } 15% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }`}</style>
      <GlobalHeader/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <RoomLayer layout="quiet"/>
        <FloorStandup net="+$340" flagged="4 flagged"/>
        <Occupant x={120} y={L.bar.y - 128} name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="resting" size={52} speed={5}/>
        {/* the prop: CSS-drift only, fades itself out — cost: one svg, two dots */}
        <div style={{ position: 'absolute', left: 152, top: L.bar.y - 92, zIndex: 5,
          animation: 'crumbfade 6s ease-in-out both, drift 3.4s ease-in-out infinite' }}>
          <Biscuit size={13}/>
        </div>
        <div style={{ position: 'absolute', left: 146, top: L.bar.y - 74, width: 3, height: 3, borderRadius: '50%',
          background: M_GOLD, opacity: 0.7, zIndex: 5, animation: 'crumbfade 6s ease-in-out both, drift 2.6s ease-in-out infinite' }}/>
        <div style={{ position: 'absolute', left: 168, top: L.bar.y - 70, width: 2.5, height: 2.5, borderRadius: '50%',
          background: M_GOLD, opacity: 0.5, zIndex: 5, animation: 'crumbfade 6s ease-in-out both, drift 3s ease-in-out infinite' }}/>
        {/* warmth, briefly */}
        <div style={{ position: 'absolute', left: 92, top: L.bar.y - 118, width: 76, height: 76, zIndex: 3,
          background: `radial-gradient(circle, ${M_GOLD}26, transparent 70%)`,
          animation: 'crumbfade 6s ease-in-out both' }}/>
        <Occupant x={276} y={L.corner.cy - 60} name="Value Bot" accent={M_PINK} mood="sulking" state="resting" size={46} speed={7} dim/>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

Object.assign(window, {
  Biscuit, SnackPips, SnackChip, SnackDock,
  SnackThreadScreenM, SnackStatesStripM, SnackMomentScreenM, SnackRefusalScreenM,
  SnackZoomScreenM, SnackFloorScreenM,
});
