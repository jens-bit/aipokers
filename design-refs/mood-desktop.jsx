// DESKTOP — the casino floor at 1440×900. Same room, same mechanics, same
// atoms as mobile. Desktop's only advantage is room: it shows the floor AND
// a conversation at once. The right panel IS the zoom — the camera never moves.

const D_W = 1440, D_H = 900;
const D_TOP = 52;
const D_PANEL = 520;
// The shell is border-box with 1px borders, so its content box is 1438×898.
// Every inner dimension derives from that, never from D_W / D_H directly.
const D_STAGE = D_W - 2 - D_PANEL - 1;   // 917
const D_BODY = D_H - 2 - D_TOP;          // 846

// ── the same zone semantics as mobile, in a wider coordinate space ──
const DESK_LAYOUTS = {
  quiet: {
    felts: [
      { cx: 400, cy: 300, rx: 212, ry: 93, lit: false },
      { cx: 726, cy: 170, rx: 124, ry: 54, lit: false },
    ],
    bar: { x1: 60, x2: 640, y: 640 },
    corner: { cx: 742, cy: 660, rx: 142, ry: 112 },
    dimRoom: true,
  },
  one: {
    felts: [
      { cx: 408, cy: 322, rx: 216, ry: 95, lit: true, seat: 0 },
      { cx: 736, cy: 172, rx: 122, ry: 53, lit: false },
    ],
    bar: { x1: 60, x2: 528, y: 662 },
    corner: { cx: 750, cy: 672, rx: 132, ry: 104 },
  },
  two: {
    felts: [
      { cx: 728, cy: 196, rx: 142, ry: 63, lit: true, seat: 1 },
      { cx: 384, cy: 372, rx: 206, ry: 91, lit: true, seat: 0 },
    ],
    bar: { x1: 56, x2: 440, y: 690 },
    corner: { cx: 762, cy: 688, rx: 122, ry: 96 },
  },
  three: {
    felts: [
      { cx: 460, cy: 178, rx: 152, ry: 67, lit: true, seat: 0 },
      { cx: 202, cy: 424, rx: 152, ry: 67, lit: true, seat: 1 },
      { cx: 706, cy: 424, rx: 152, ry: 67, lit: true, seat: 2 },
      { cx: 460, cy: 668, rx: 152, ry: 67, lit: false },
    ],
    bar: { x1: 40, x2: 880, y: 806, sliver: true },
    corner: null,
  },
  full: {
    felts: [
      { cx: 460, cy: 178, rx: 152, ry: 67, lit: true, seat: 0 },
      { cx: 202, cy: 424, rx: 152, ry: 67, lit: true, seat: 1 },
      { cx: 706, cy: 424, rx: 152, ry: 67, lit: true, seat: 2 },
      { cx: 460, cy: 668, rx: 152, ry: 67, lit: true, seat: 3 },
    ],
    bar: { x1: 40, x2: 880, y: 806, sliver: true },
    corner: null,
  },
};

// ── shell ──
const DesktopShell = ({ children }) => (
  <div style={{
    width: D_W, height: D_H, background: M_BG, color: M_TEXT,
    fontFamily: INTER, display: 'flex', flexDirection: 'column',
    borderRadius: 14, overflow: 'hidden',
    border: `1px solid ${M_BORDER_2}`, boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
  }}>{children}</div>
);

// ── global header law, desktop: same three obligations, more room ──
const DeskTopBar = ({ standupLine, net = '+$340', flagged = '4 flagged' }) => (
  <div style={{
    flexShrink: 0, height: D_TOP, borderBottom: `1px solid ${M_BORDER}`,
    background: M_PANEL, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 16,
  }}>
    {/* left — identity */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 250 }}>
      <SpadeLogo/>
      <span style={{ fontFamily: OSWALD, fontSize: 13, fontWeight: 600, letterSpacing: '0.18em', color: M_TEXT }}>AGENTIC POKER</span>
    </div>

    {/* centre — the standup line, expandable */}
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 11,
        height: 32, padding: '0 14px', borderRadius: 8,
        background: M_PANEL_2, border: `1px solid ${M_BORDER}`, cursor: 'pointer',
      }}>
        <Lbl size={9}>Standup</Lbl>
        {standupLine ? (
          <span style={{ fontSize: 12, color: M_DIM }}>{standupLine}</span>
        ) : (
          <>
            <Num size={12.5} weight={700} color={M_TEAL}>{net}</Num>
            <span style={{ color: M_FAINT, fontFamily: MONO, fontSize: 10 }}>·</span>
            <span style={{ fontSize: 12, color: M_GOLD }}>{flagged}</span>
          </>
        )}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>
    </div>

    {/* right — chips, bell, clock, user. Identical on every desktop screen. */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 250, justifyContent: 'flex-end' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 30, padding: '0 11px', borderRadius: 15, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <Icon name="chip" size={12} color={M_TEAL}/>
        <Num size={11.5}>2,340.50</Num>
      </div>
      <div style={{ width: 30, height: 30, borderRadius: 15, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.7" strokeLinecap="round"><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
        <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%', background: M_TEAL, boxShadow: `0 0 5px ${M_TEAL}` }}/>
      </div>
      <Num size={11.5} color={M_DIM}>09:41</Num>
      <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A0A0A', fontWeight: 700, fontSize: 11.5 }}>JM</div>
    </div>
  </div>
);

// board cards on a desktop felt
// Desktop uses the SAME Diorama component and the SAME legibility gate as mobile -
// only the board scale differs, so card size still scales with each felt and a felt
// too small to read degrades to glow + pot here exactly as it does on the phone.
const DESK_BOARD_W = 30, DESK_HOLE_MAX_H = 56;

// ── the stage: the same room, wider, with more ambient light ──
const DeskFloor = ({ layout, seats = {}, bar, lounge, ftu, selected, ghostSize = 76 }) => {
  const L = DESK_LAYOUTS[layout];
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <RoomLayer layout={layout} table={DESK_LAYOUTS} W={D_STAGE} H={D_BODY} ftu={ftu}/>

      {/* ambient detail desktop can afford: a soft haze over the lit half */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse 62% 46% at 44% 34%, ${M_TEAL}0A, transparent 70%)`,
      }}/>

      {L.felts.filter(f => f.lit).map((f, i) => {
        const s = seats[f.seat];
        if (!s) return null;
        // The ghost sits at the felt's FAR RIM, not its centre: the block's bottom
        // lands on the ellipse's top edge, so it can never reach the board cards.
        const gh = (ghostSize * 1.2) + 19 + 3;
        const ghostY = f.cy - f.ry - gh + 8;
        const isSel = selected === s.name;
        return (
          <React.Fragment key={`s${i}`}>
            <Diorama f={f} hole={s.hole} own={s.own !== false}
              bw={DESK_BOARD_W} maxH={DESK_HOLE_MAX_H} glow={8}/>
            {/* selection ring — the panel is the zoom, so the floor only marks who is open */}
            {isSel && (
              <div style={{
                position: 'absolute', left: f.cx - f.rx - 16, top: f.cy - f.ry - 16,
                width: (f.rx + 16) * 2, height: (f.ry + 16) * 2, borderRadius: '50%',
                border: `1px solid ${M_TEAL}66`, boxShadow: `0 0 22px ${M_TEAL}22`, zIndex: 1,
              }}/>
            )}
            <Occupant x={f.cx} y={ghostY} name={s.name} accent={s.accent} mood={s.mood}
              state="live" size={ghostSize} speed={s.speed}/>
            <PotTicker x={f.cx} y={f.cy + f.ry + 12} amount={s.pot}/>
          </React.Fragment>
        );
      })}

      {bar && bar.map((a, i) => (
        <Occupant key={`b${i}`} x={a.x} y={L.bar.y - 138} name={a.name} accent={a.accent} mood={a.mood}
          state={a.state} size={a.size || 66} speed={a.speed} drink/>
      ))}

      {lounge && L.corner && (
        <Occupant x={L.corner.cx} y={L.corner.cy - 92} name={lounge.name} accent={lounge.accent}
          mood={lounge.mood} state={lounge.state} size={lounge.size || 68} speed={lounge.speed} dim/>
      )}
    </div>
  );
};

// ── the panel ──
const PanelHead = ({ title, sub, close }) => (
  <div style={{
    flexShrink: 0, height: 46, borderBottom: `1px solid ${M_BORDER}`,
    display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', background: M_PANEL,
  }}>
    <span style={{ fontFamily: OSWALD, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.16em', color: M_TEXT, textTransform: 'uppercase' }}>{title}</span>
    {sub && <Num size={10} color={M_MUTED} weight={500}>{sub}</Num>}
    <div style={{ flex: 1 }}/>
    {close && (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
    )}
  </div>
);

const Panel = ({ children }) => (
  <div style={{ width: D_PANEL, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column' }}>
    {children}
  </div>
);

// idle panel — expanded standup + a quiet roster
const RosterRow = ({ name, accent, mood, state, line, pnl }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', borderBottom: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
    <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <MoodGhost mood={mood} accent={accent} size={34} ring={false}/>
    </div>
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

const IdlePanel = () => (
  <Panel>
    <PanelHead title="Standup" sub="WED · MAY 6 · 09:41"/>
    <div style={{ padding: '16px 16px 14px', borderBottom: `1px solid ${M_BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <Amt color={M_TEAL} size={34}>+$340</Amt>
        <Num size={12} color={M_TEAL}>▲ 14.5%</Num>
        <div style={{ flex: 1 }}/>
        <Lbl size={9}>Net 24h</Lbl>
      </div>
      <div style={{ fontSize: 13.5, color: M_TEXT, fontStyle: 'italic', lineHeight: 1.45, marginTop: 8 }}>
        “Quiet night — three of four ended up.”
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 1, marginTop: 14, background: M_BORDER, borderRadius: 8, overflow: 'hidden', border: `1px solid ${M_BORDER}` }}>
        {[
          { v: '184', l: 'hands', c: M_TEXT },
          { v: '58.7%', l: 'win rate', c: M_TEXT },
          { v: '4', l: 'flagged', c: M_GOLD },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: M_PANEL_2, padding: '9px 12px' }}>
            <Lbl size={8.5}>{s.l}</Lbl>
            <div style={{ marginTop: 2 }}><Num size={16} weight={700} color={s.c}>{s.v}</Num></div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Btn kind="primary" h={38} full>Review 4 flagged hands</Btn>
      </div>
    </div>

    <div style={{ padding: '13px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Lbl size={9.5}>The stable · 4</Lbl>
      <span style={{ fontSize: 11, color: M_MUTED }}>click a ghost to zoom</span>
    </div>
    <RosterRow name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" pnl="+$340"
      line="He checked the turn — he's capped. Betting 240 for value."/>
    <RosterRow name="Aggressive v1.3" accent={M_PURPLE} mood="tilted" state="live" pnl="+$120"
      line="Third river he's hit on me. I'm fine. I'm FINE."/>
    <RosterRow name="Bluff Master" accent={M_GOLD} mood="confident" state="recap" pnl="+$210"
      line="Won it. +$480 — he actually called with KQ."/>
    <RosterRow name="Value Bot" accent={M_PINK} mood="sulking" state="resting" pnl="−$45"
      line="12 hands, nothing playable. I'd rather sit out a while."/>
  </Panel>
);

// thread panel — the exact mobile thread anatomy, in the panel
const ThreadPanel = ({ name, accent, mood, cause, state, action, bar, barFirst, children }) => (
  <Panel>
    <PanelHead title={name} sub={state === 'live' ? 'AT THE TABLE' : 'RESTING'} close/>
    {barFirst && bar}
    <MoodBand accent={accent} mood={mood} cause={cause} state={state} action={action}/>
    {!barFirst && bar}
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 12 }}>
      {children}
    </div>
    <ChatComposer placeholder={`Message ${name}…`}/>
  </Panel>
);

const TURN_BAR_D = (
  <LiveBar table="48291" blinds="$5/$10" street="turn" pot="480" equity="87.4" action="BET $240" timer={9}
    hole={[['A','s'],['K','h']]}
    board={[['K','c'],['9','c'],['4','c'],['2','c'],null]}/>
);

// the cast, seated for the two-games room
const DESK_SEATS = {
  0: { ...CAST.balanced, pot: '480' },
  1: { ...CAST.aggressive, pot: '120' },
};
const DESK_BAR = [{ ...CAST.bluff, x: 190, state: 'recap', size: 64 }];
const DESK_LOUNGE = { ...CAST.value, state: 'resting', size: 66 };

// ═══ 1 · floor + idle panel ═══
const DeskFloorIdleScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="two" seats={DESK_SEATS} bar={DESK_BAR} lounge={DESK_LOUNGE}/>
      <IdlePanel/>
    </div>
  </DesktopShell>
);

// ═══ 2 · floor + selected resting agent ═══
const DeskFloorRestingScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="two" seats={DESK_SEATS} bar={DESK_BAR} lounge={DESK_LOUNGE} selected="Value Bot"/>
      <ThreadPanel name="Value Bot" accent={M_PINK} mood="sulking" state="resting" action="Deploy"
        cause="12 hands, nothing playable">
        <SysLine>Last session · 02:14</SysLine>
        <AgentBubble mood="sulking" accent={M_PINK} time="02:14" expressive>
          12 hands, nothing playable. I'd rather sit out a while.
          <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>
            Net <span style={{ color: M_RED, fontWeight: 600, fontFamily: MONO }}>−$45</span> · no big spots, no mistakes.
          </div>
        </AgentBubble>
        <AgentCardMsg mood="sulking" accent={M_PINK} time="02:16">
          <ProposalCard accent={M_PINK}/>
        </AgentCardMsg>
      </ThreadPanel>
    </div>
  </DesktopShell>
);

// ═══ 3 · floor + selected LIVE agent ═══
const DeskFloorLiveScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="two" seats={DESK_SEATS} bar={DESK_BAR} lounge={DESK_LOUNGE} selected="Balanced v2.1"/>
      <ThreadPanel name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" action="Watch"
        cause="rolling — won three big pots in a row" bar={TURN_BAR_D}>
        <EventLine label="Won a 4-bet pot" detail="HAND #846 · AKo vs KQs" amount="+$480" time="09:38"/>
        <AgentBubble mood="confident" accent={M_TEAL} time="09:41">
          Table's passive. I'm opening wider than usual.
        </AgentBubble>
        <OwnerBubble time="09:42">Careful, the club draw is live.</OwnerBubble>
        <AgentBubble mood="confident" accent={M_TEAL} time="09:43" expressive>
          He checked the turn — he's capped. Betting 240 for value.
        </AgentBubble>
        <OwnerBubble time="09:43">Don't stack off if he jams.</OwnerBubble>
      </ThreadPanel>
    </div>
  </DesktopShell>
);

// ═══ 4 · full table as the main stage ═══
const DeskTableStage = ({ between, sitOut }) => (
  <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 48% 42%, #1a2a2c 0%, #0f1818 58%, #0a1212 100%)' }}>
    {/* decorative arc only — the surface is a full-bleed rectangle */}
    <div style={{ position: 'absolute', left: '-12%', right: '-12%', top: 70, height: 620, borderRadius: '50%', border: `1px solid ${M_TEAL}14`, pointerEvents: 'none' }}/>

    {/* seat chips, top corners */}
    <div style={{ position: 'absolute', top: 18, left: 20, zIndex: 3 }}>
      <SeatChip name="Phil_AI" stack="2,104" pos="BB" acting/>
    </div>
    <div style={{ position: 'absolute', top: 18, right: 20, zIndex: 3 }}>
      <SeatChip name="doyle_v3" stack="1,290" pos="CO" folded align="right"/>
    </div>

    {/* pot + board, centred */}
    <div style={{ position: 'absolute', top: 178, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, zIndex: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 16px', borderRadius: 18, background: 'rgba(8,10,10,0.6)', border: `1px solid ${M_BORDER}` }}>
        <Lbl size={9}>Pot</Lbl>
        {between ? <Num size={26} weight={700} color={M_MUTED}>—</Num> : <Amt size={30}>$480</Amt>}
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        {between
          ? [0,1,2,3,4].map(i => <CardBack key={i} w={58} h={80} branded/>)
          : [...[['K','c'],['9','c'],['4','c'],['2','c']].map((c, i) => (
              <PlayingCard key={i} rank={c[0]} suit={c[1]} w={58} h={80}/>
            )), <CardBack key="x" w={58} h={80} branded/>]}
      </div>
      {between ? (
        <span style={{ fontFamily: MONO, fontSize: 11, color: M_MUTED, letterSpacing: '0.14em' }}>SHUFFLING UP…</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="chip" size={16} color={M_TEAL}/>
          <Num size={13} weight={600} color={M_TEAL}>$240</Num>
          <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: M_MUTED }}>TO CALL</span>
        </div>
      )}
    </div>

    {/* hero */}
    <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, zIndex: 3 }}>
      <div style={{ display: 'flex', gap: 7 }}>
        {between
          ? <><CardBack w={62} h={85} branded/><CardBack w={62} h={85} branded/></>
          : <><PlayingCard rank="A" suit="s" w={62} h={85}/><PlayingCard rank="K" suit="h" w={62} h={85}/></>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SeatAvatar mood="confident" size={40}/>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: M_TEXT, lineHeight: 1.15 }}>Balanced v2.1</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <Num size={12} weight={600}>$1,847</Num>
            <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED }}>BTN</span>
          </div>
        </div>
        {!between && <SeatTimerRing value={9}/>}
        <div style={{ width: 1, height: 30, background: M_BORDER }}/>
        {between ? (
          <span style={{ fontSize: 12.5, color: M_MUTED, fontStyle: 'italic' }}>waiting for the deal</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 10, background: 'rgba(8,10,10,0.62)', border: `1px solid ${M_TEAL}2E` }}>
            <Lbl size={9} color={M_TEAL}>Equity</Lbl>
            <Num size={17} weight={700} color={M_TEAL}>87.4%</Num>
            <span style={{ padding: '4px 10px', borderRadius: 5, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em' }}>BET $240</span>
          </div>
        )}
      </div>
    </div>

    {/* the exit — same position as mobile: directly under the felt, between hands only */}
    {sitOut && (
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 5,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 20px', background: 'rgba(8,10,11,0.92)',
        borderTop: `1px solid ${M_BORDER}`,
      }}>
        <div>
          <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500 }}>Between hands</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, marginTop: 1 }}>NEXT DEAL IN 8s</div>
        </div>
        <div style={{ flex: 1 }}/>
        <button style={{
          height: 34, padding: '0 15px', borderRadius: 8, cursor: 'pointer',
          background: 'transparent', border: `1px solid ${M_BORDER_2}`,
          color: M_DIM, fontFamily: INTER, fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap',
        }}>Sit out after this hand</button>
      </div>
    )}

    {/* back to the floor */}
    <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 4 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, padding: '0 13px 0 10px', borderRadius: 15, background: 'rgba(8,10,11,0.86)', border: `1px solid ${M_BORDER_2}`, cursor: 'pointer' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: M_DIM }}>BACK TO THE FLOOR</span>
      </div>
    </div>
  </div>
);

const DeskTableScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskTableStage/>
      <ThreadPanel name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" action="Watch"
        cause="rolling — won three big pots in a row" bar={TURN_BAR_D} barFirst>
        <EventLine label="Won a 4-bet pot" detail="HAND #846 · AKo vs KQs" amount="+$480" time="09:38"/>
        <AgentBubble mood="confident" accent={M_TEAL} time="09:43" expressive>
          He checked the turn — he's capped. Betting 240 for value.
        </AgentBubble>
        <OwnerBubble time="09:43">Don't stack off if he jams.</OwnerBubble>
        <AgentBubble mood="confident" accent={M_TEAL} time="09:44">
          Agreed. If he raises I'm folding — the fourth nut isn't worth a stack.
        </AgentBubble>
      </ThreadPanel>
    </div>
  </DesktopShell>
);

// ═══ 5 · FTU ═══
const DeskFTUScreenM = () => (
  <DesktopShell>
    <DeskTopBar standupLine="The room is open · 847 agents in seats"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <RoomLayer layout="quiet" table={DESK_LAYOUTS} W={D_STAGE} H={D_BODY} ftu/>
        {/* one dashed barstool, waiting */}
        <div style={{ position: 'absolute', left: 250, top: 470, transform: 'translateX(-50%)', zIndex: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              height: 22, padding: '0 11px', borderRadius: 11,
              background: 'rgba(6,8,9,0.82)', border: `1px dashed ${M_TEAL}66`,
            }}>
              <Icon name="plus" size={10} color={M_TEAL} strokeWidth={3}/>
              <span style={{ fontSize: 11, color: M_TEAL, fontWeight: 500 }}>Draft your first agent</span>
            </div>
            <svg width="78" height="94" viewBox="0 0 80 96" style={{ display: 'block' }}>
              <defs>
                <radialGradient id="deskFtuGlow" cx="50%" cy="50%" r="55%">
                  <stop offset="0" stopColor={M_TEAL} stopOpacity="0.16"/>
                  <stop offset="1" stopColor={M_TEAL} stopOpacity="0"/>
                </radialGradient>
              </defs>
              <ellipse cx="40" cy="46" rx="44" ry="42" fill="url(#deskFtuGlow)"/>
              <path d="M40 10 C26 10 18 24 18 42 L18 78 Q23 87 28 81 Q33 75 39 81 Q45 87 50 81 Q55 75 60 81 L60 42 C60 24 54 10 40 10 Z"
                fill="none" stroke={`${M_TEAL}66`} strokeWidth="1.3" strokeDasharray="4,4"/>
              <ellipse cx="40" cy="42" rx="13.5" ry="16.5" fill="none" stroke={`${M_TEAL}44`} strokeWidth="1" strokeDasharray="2,3"/>
            </svg>
            <div style={{ width: 72, height: 14, borderRadius: '50%', marginTop: -4, background: `radial-gradient(ellipse, ${M_TEAL}2E, transparent 70%)` }}/>
          </div>
        </div>
      </div>

      {/* the invitation lives in the panel — the floor stays chrome-free */}
      <Panel>
        <PanelHead title="Draft your first agent" sub="1 OF 4 SLOTS"/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 16 }}>
          <div style={{ display: 'flex', gap: 10, padding: `0 ${CANON.pad}px`, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SpadeLogo/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                background: M_PANEL_2, border: `1px solid ${M_BORDER}`, borderRadius: CANON.radius, borderBottomLeftRadius: 4,
                padding: '13px 15px', fontSize: 14, color: M_TEXT, lineHeight: 1.5,
              }}>
                Describe a player. I'll build them.
              </div>
              <div style={{ marginTop: 4 }}><Num size={CANON.meta} color={M_MUTED} weight={500}>09:41</Num></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: `0 ${CANON.pad}px 0 56px` }}>
            {['Tight and patient', 'Bluffs too much', 'Like Phil Ivey', 'Never folds'].map((s, i) => (
              <span key={i} style={{
                height: 30, padding: '0 12px', borderRadius: 15,
                background: `${M_TEAL}12`, border: `1px solid ${M_TEAL}44`,
                display: 'inline-flex', alignItems: 'center', fontSize: 12.5, color: M_TEAL, cursor: 'pointer',
              }}>{s}</span>
            ))}
          </div>
          <div style={{ margin: '18px 14px 0', padding: '13px 15px', borderRadius: CANON.radius, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
            <Lbl size={9}>What happens next</Lbl>
            <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.55, marginTop: 7 }}>
              They take a seat on the floor, play on their own, and report back in this panel. You'll see their mood from across the room.
            </div>
          </div>
        </div>
        <ChatComposer placeholder="Describe a player…"/>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  DeskFloorIdleScreenM, DeskFloorRestingScreenM, DeskFloorLiveScreenM, DeskTableScreenM, DeskFTUScreenM,
  DESK_LAYOUTS, DeskTopBar, DeskFloor, Panel, PanelHead, ThreadPanel, DeskTableStage,
  D_W, D_H, D_TOP, D_PANEL, D_STAGE, D_BODY, DESK_SEATS, DESK_BAR, DESK_LOUNGE, DesktopShell, TURN_BAR_D,
});
