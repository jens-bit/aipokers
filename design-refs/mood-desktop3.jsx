// DESKTOP PARITY — the missing surface × state combinations.
// Nothing here is a new component. Every artboard is a composition of parts that
// already exist: DesktopShell, DeskTopBar, DeskFloor (which carries Diorama),
// DeskTableStage, Panel/PanelHead, PStandupCard, PGameTile, PFlaggedCard,
// PComposer, PRosterRow, MoodBand, LiveBar, SeatChip, RoomLayer, FloorGhost.

// ── rail scaffold: the panel, with a scrolling body ──
const RailBody = ({ children, pad = 14 }) => (
  <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: `${pad}px` }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
  </div>
);

// ── the GameTile stack: one tile per live game, all visible at once ──
const TileStack = ({ games, highlight }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Lbl size={9.5}>{games.length === 1 ? '1 game live' : `${games.length} games live`}</Lbl>
      <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.08em' }}>
        NO SWIPING — ALL VISIBLE
      </span>
    </div>
    {games.map((g, i) => (
      <div key={i} style={{
        borderRadius: 12,
        outline: highlight === g.agent ? `1px solid ${M_TEAL}` : 'none',
        outlineOffset: 2,
        boxShadow: highlight === g.agent ? `0 0 22px ${M_TEAL}26` : 'none',
        opacity: highlight && highlight !== g.agent ? 0.62 : 1,
      }}>
        <PGameTile {...g}/>
      </div>
    ))}
  </>
);

const G_BALANCED = {
  agent: 'Balanced v2.1', accent: M_TEAL, mood: 'confident',
  table: 'NLH 6-Max', blinds: '$5/$10', pot: '480', equity: '87.4', action: 'BET $240',
  board: [['K','c'],['9','c'],['4','c'],['2','c'], null],
  hero: { cards: [['A','s'],['K','h']], stack: '1,847' },
  oppName: 'Phil_AI', oppStack: '2,104',
  thought: 'He checked the turn — capped. Betting 240 for value.',
};
const G_AGGRESSIVE = {
  agent: 'Aggressive v1.3', accent: M_PURPLE, mood: 'tilted',
  table: 'HU NLH', blinds: '$10/$20', pot: '120', equity: '31.2', action: 'TO ACT',
  board: [['K','c'],['9','c'],['4','c'],['2','c'],['5','h']],
  hero: { cards: [['Q','s'],['Q','d']], stack: '2,104' },
  oppName: 'Phil_AI', oppStack: '1,847',
  thought: "Third river he's hit on me. I'm fine.",
};

// ═══ A · HOME, ONE GAME LIVE ═══
const D3HomeOneScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$340" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="one" seats={{ 0: { ...CAST.balanced, pot: '480' } }}
        bar={[{ ...CAST.bluff, x: 190, state: 'recap', size: 64 }]} lounge={DESK_LOUNGE}/>
      <Panel>
        <PanelHead title="Standup" sub="WED · MAY 6 · 09:41"/>
        <RailBody>
          <PStandupCard/>
          <TileStack games={[G_BALANCED]}/>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

// ═══ B · HOME, TWO GAMES + one ghost clicked: camera zooms AND his tile lights ═══
const D3HomeZoomScreenM = () => {
  const f = DESK_LAYOUTS.two.felts.find(x => x.lit && x.seat === 0);
  return (
    <DesktopShell>
      <DeskTopBar net="+$460" flagged="4 flagged"/>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* the camera move — identical mechanic to mobile: the room stays behind,
            cropped through a zoomed viewBox under a scrim. Device invariance. */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
            <RoomLayer layout="two" table={DESK_LAYOUTS} W={D_STAGE} H={D_BODY}
              viewBox={`${f.cx - 300} ${f.cy - 250} 600 500`}/>
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 44%, rgba(10,10,10,0) 0%, rgba(10,10,10,0.7) 60%, rgba(10,10,10,0.94) 100%)' }}/>

          <div style={{ position: 'absolute', left: 96, right: 96, top: 74, zIndex: 5 }}>
            <div style={{
              background: 'rgba(12,14,16,0.92)', border: `1px solid ${M_TEAL}66`,
              borderRadius: 16, padding: '18px 22px', boxShadow: `0 0 26px ${M_TEAL}22`, position: 'relative',
            }}>
              <div style={{ fontSize: 18, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic' }}>
                “He checked the turn — he's capped. Betting 240 for value.”
              </div>
              <div style={{
                position: 'absolute', bottom: -8, left: '50%', marginLeft: -8, width: 14, height: 14,
                background: 'rgba(12,14,16,0.92)', borderRight: `1px solid ${M_TEAL}66`,
                borderBottom: `1px solid ${M_TEAL}66`, transform: 'rotate(45deg)',
              }}/>
            </div>
          </div>

          <div style={{ position: 'absolute', left: '50%', top: 206, transform: 'translateX(-50%)', zIndex: 4 }}>
            <FloorGhost mood="confident" accent={M_TEAL} size={210} speed={5}/>
          </div>
          <div style={{
            position: 'absolute', left: '50%', top: 490, transform: 'translateX(-50%)',
            width: 300, height: 40, borderRadius: '50%', zIndex: 3,
            background: `radial-gradient(ellipse, ${M_TEAL}33, transparent 70%)`,
          }}/>

          <div style={{ position: 'absolute', left: 96, right: 96, bottom: 30, zIndex: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
              <MoodChip mood="confident"/>
              <StateTag state="live" compact/>
              <div style={{ flex: 1 }}/>
              <span style={{ fontFamily: MONO, fontSize: 10.5, color: M_MUTED, letterSpacing: '0.1em' }}>
                HIS TILE IS LIT IN THE RAIL →
              </span>
            </div>
            <div style={{ fontSize: 14, color: M_TEAL, lineHeight: 1.45, marginBottom: 15 }}>
              rolling — won three big pots in a row
            </div>
            <div style={{ display: 'flex', gap: 11 }}>
              <div style={{ flex: 1.3 }}><Btn kind="primary" h={46} full>Watch the table</Btn></div>
              <div style={{ flex: 1 }}><Btn kind="ghost" h={46} full>Chat</Btn></div>
            </div>
          </div>
        </div>

        <Panel>
          <PanelHead title="Standup" sub="WED · MAY 6 · 09:41"/>
          <RailBody>
            <StandupCollapsed bare net="+$460" hands="248 hands"/>
            <TileStack games={[G_BALANCED, G_AGGRESSIVE]} highlight="Balanced v2.1"/>
          </RailBody>
        </Panel>
      </div>
    </DesktopShell>
  );
};

// ── the draft panel, for the empty rail ──
const DraftPanel = ({ first }) => (
  <div style={{ background: M_PANEL_2, border: `1px dashed ${M_BORDER_2}`, borderRadius: 10, padding: '18px 16px', textAlign: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, opacity: 0.7 }}>
      <FloorGhost mood="neutral" accent={M_TEAL} size={62} speed={7}/>
    </div>
    <div style={{ fontFamily: PLAYFAIR, fontSize: 17, fontWeight: 500, color: M_TEXT, marginBottom: 6 }}>
      {first ? 'Draft your first agent' : 'Draft another agent'}
    </div>
    <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.55, marginBottom: 14 }}>
      {first
        ? 'Describe how you want him to play. He takes a seat, plays his own hands, and reports back here.'
        : 'Four seats maximum. You have room for one more.'}
    </div>
    <Btn kind="primary" h={40} full>{first ? 'Draft an agent' : 'Draft'}</Btn>
  </div>
);

// ═══ C · HOME, QUIET NIGHT ═══
const D3QuietScreenM = () => (
  <DesktopShell>
    <DeskTopBar standupLine="Everyone's resting." net="+$0" flagged="0 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="quiet"
        bar={[
          { ...CAST.balanced, x: 150, state: 'recap', size: 64 },
          { ...CAST.bluff, x: 300, state: 'recap', size: 62 },
          { ...CAST.value, x: 450, state: 'resting', size: 58 },
        ]}
        lounge={{ ...CAST.aggressive, state: 'resting', size: 68 }}/>
      <Panel>
        <PanelHead title="Standup" sub="WED · MAY 6 · 02:40"/>
        <RailBody>
          <PStandupCard/>
          <DraftPanel/>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

// ═══ D · HOME, FIRST RUN ═══
const D3FtuScreenM = () => (
  <DesktopShell>
    <DeskTopBar standupLine="The room is open · 847 agents in seats" net="—" flagged="—"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFloor layout="quiet" ftu/>
      <Panel>
        <PanelHead title="Welcome" sub="NO AGENTS YET"/>
        <RailBody>
          <div style={{ background: M_PANEL_2, border: `1px solid ${M_BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
            <Lbl size={9.5}>Standup</Lbl>
            <div style={{ fontFamily: PLAYFAIR, fontSize: 19, fontWeight: 500, color: M_TEXT, margin: '7px 0 5px' }}>
              Nothing to report yet.
            </div>
            <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.55 }}>
              The room is open and 847 agents are in seats. None of them are yours.
            </div>
          </div>
          <DraftPanel first/>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

// ── analysis, as rail panels rather than tabs under the felt ──
// NOTE: ARow is the same row as mood-watch.jsx's AnalysisRow. The two files never
// load together, so this is a deliberate parallel rather than a live duplicate —
// the production port should lift one row component into the shared atoms module.
const AnalysisPanel = ({ title, action, children }) => (
  <div style={{ background: M_PANEL_2, border: `1px solid ${M_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 13px', borderBottom: `1px solid ${M_BORDER}` }}>
      <Lbl size={9.5}>{title}</Lbl>
      {action && <span style={{ fontFamily: MONO, fontSize: 10, color: M_TEAL, fontWeight: 600, cursor: 'pointer' }}>{action}</span>}
    </div>
    <div style={{ padding: '11px 13px' }}>{children}</div>
  </div>
);

const ARow = ({ label, value, color = M_TEXT, bar, note, first }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: first ? 'none' : `1px solid ${M_BORDER}` }}>
    <span style={{ fontSize: 12, color: M_DIM, minWidth: 92 }}>{label}</span>
    {bar != null && (
      <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ width: `${bar}%`, height: '100%', background: color }}/>
      </div>
    )}
    {note && <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>{note}</span>}
    <Num size={12.5} weight={700} color={color}>{value}</Num>
  </div>
);

const WatchRail = ({ between }) => (
  <Panel>
    <PanelHead title="Balanced v2.1" sub={between ? 'BETWEEN HANDS' : 'AT THE TABLE'} close/>
    <RailBody>
      <AnalysisPanel title="Live analysis" action="RANGE ↗">
        <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 4 }}>
          {between ? '“Good table. I\'ll take another orbit here.”' : '“He checked the turn — he\'s capped. Betting 240 for value.”'}
        </div>
        {between ? (
          <>
            <ARow label="This session" value="+$340" color={M_TEAL} note="64 hands · 2h 14m"/>
            <ARow label="Biggest pot" value="$847" color={M_GOLD} note="set over set"/>
            <ARow label="VPIP" value="24%" note="tight, as configured"/>
          </>
        ) : (
          <>
            <ARow label="Equity" value="87.4%" color={M_TEAL} bar={87}/>
            <ARow label="Fold equity" value="34%" color={M_GOLD} bar={34}/>
            <ARow label="Pot odds" value="3.2 : 1" note="calling 240 into 720"/>
            <ARow label="Solver line" value="BET 50%" color={M_TEAL} note="matches his action"/>
          </>
        )}
      </AnalysisPanel>
      <AnalysisPanel title="History" action="ALL ↗">
        <ARow first label="Hand #847" value="+$480" color={M_TEAL} note="turn bet, folded out"/>
        <ARow label="Hand #846" value="−$60" color={M_RED} note="3-bet, folded to jam"/>
        <ARow label="Hand #845" value="+$120" color={M_TEAL} note="checked down"/>
      </AnalysisPanel>
      <PFlaggedCard/>
    </RailBody>
    <PComposer draft="Tighten up against his river jams."/>
  </Panel>
);

// ═══ E · WATCH, MID-HAND ═══
const D3WatchScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
          cause="rolling — won three big pots in a row"/>
        <DeskTableStage/>
      </div>
      <WatchRail/>
    </div>
  </DesktopShell>
);

// ═══ F · WATCH, BETWEEN HANDS — the exit appears ═══
const D3WatchBetweenScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
          cause="rolling — won three big pots in a row"/>
        <DeskTableStage between sitOut/>
      </div>
      <WatchRail between/>
    </div>
  </DesktopShell>
);

// ═══ G · THREAD — roster left, thread right, proposal moment, bar docked ═══
const ThreadRosterRail = ({ active, drafting, born }) => (
  <div style={{ width: 340, flexShrink: 0, borderRight: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column' }}>
    <PanelHead title="Chats" sub={drafting ? '4 AGENTS · 1 DRAFTING' : born ? '5 AGENTS · 2 LIVE' : '4 AGENTS · 2 LIVE'}/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* the unborn agent holds a seat in the list: dashed, unnamed, no P&L */}
      {drafting && (
        <div style={{ background: 'rgba(0,212,170,0.04)', borderLeft: `2px solid ${M_TEAL}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: `9px ${P_PAD}px`, borderBottom: `1px solid ${M_BORDER}` }}>
            <div style={{ width: 34, height: 34, borderRadius: 6, flexShrink: 0, background: '#0A0F17', border: `1px dashed ${M_DIM}55`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
              <FormingGhost size={32} phase={drafting === true ? 0.2 : drafting}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13, color: M_DIM, fontStyle: 'italic' }}>unnamed</span>
                <StateTag state="drafting" compact/>
              </div>
              <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 3 }}>drafting…</div>
            </div>
          </div>
        </div>
      )}
      {born && (
        <div style={{ background: 'rgba(0,212,170,0.04)', borderLeft: `2px solid ${M_TEAL}` }}>
          <PRosterRow name="Grinder v1.0" accent={M_TEAL} mood="neutral" state="resting"
            line="Deal me in whenever you're ready." pnl="—"/>
        </div>
      )}
      {[
        { name: 'Aggressive v1.3', accent: M_PURPLE, mood: 'frustrated', state: 'live', line: 'Rivers keep getting called. Let me pull back.', pnl: '+$120' },
        { name: 'Balanced v2.1', accent: M_TEAL, mood: 'confident', state: 'live', line: "He's capped. Betting 240 for value.", pnl: '+$340' },
        { name: 'Bluff Master', accent: M_GOLD, mood: 'confident', state: 'recap', line: 'Session done — ROI 18.4%.', pnl: '+$210' },
        { name: 'Value Bot', accent: M_PINK, mood: 'sulking', state: 'resting', line: "I'd rather not talk about it.", pnl: '−$45' },
      ].map((r, i) => (
        <div key={i} style={{
          background: active === r.name ? 'rgba(0,212,170,0.06)' : 'transparent',
          borderLeft: active === r.name ? `2px solid ${M_TEAL}` : '2px solid transparent',
        }}>
          <PRosterRow {...r}/>
        </div>
      ))}
    </div>
  </div>
);

const D3ThreadScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <ThreadRosterRail active="Aggressive v1.3"/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
        <MoodBand accent={M_PURPLE} mood="frustrated" state="live" action="Watch"
          cause="two rivers called back — he wants to tighten up"/>
        {/* the sticky bar docks under the thread header while he is mid-hand */}
        <LiveBar table="38104" blinds="$10/$20" street="river" pot="120" equity="31.2"
          action="TO ACT" timer={4} hole={[['Q','s'],['Q','d']]}
          board={[['K','c'],['9','c'],['4','c'],['2','c'],['5','h']]}/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
            <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.18em' }}>WED · MAY 6</span>
            <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
          </div>

          {/* the self-change proposal — his opener, then the two chips */}
          <div style={{ display: 'flex', gap: 12, maxWidth: 620, marginBottom: 16 }}>
            <PHood size={32} accent={M_PURPLE} mood="frustrated"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT }}>Aggressive v1.3</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>09:14</span>
              </div>
              <div style={{ background: M_PANEL_2, border: `1px solid ${M_PURPLE}3D`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
                Rivers keep getting called. Let me pull back.
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 620, marginLeft: 44, background: M_PANEL_2, border: `1px solid ${M_TEAL}44`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 15px', borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(0,212,170,0.04)' }}>
              <Lbl size={9.5} color={M_TEAL}>Proposed change · v1.3 → v1.4</Lbl>
              <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>HIS IDEA</span>
            </div>
            <div style={{ padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 11 }}>
                <span style={{ fontSize: 12.5, color: M_DIM, minWidth: 108 }}>River bluff freq</span>
                <Num size={13} weight={700} color={M_MUTED}>62%</Num>
                <svg width="16" height="12" viewBox="0 0 24 18" fill="none" stroke={M_TEAL} strokeWidth="2" strokeLinecap="round"><path d="M3 9h16M14 4l5 5-5 5"/></svg>
                <Num size={13} weight={700} color={M_TEAL}>38%</Num>
                <span style={{ fontSize: 11.5, color: M_MUTED }}>on monotone boards</span>
              </div>
              <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.55, marginBottom: 14 }}>
                Applies on the next deploy. Everything else stays as configured.
              </div>
              <div style={{ display: 'flex', gap: 9 }}>
                <div style={{ flex: 1 }}><Btn kind="primary" h={40} full>Accept</Btn></div>
                <div style={{ flex: 1 }}><Btn kind="ghost" h={40} full>Discuss</Btn></div>
              </div>
            </div>
          </div>
        </div>
        <PComposer draft=""/>
      </div>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  D3HomeOneScreenM, D3HomeZoomScreenM, D3QuietScreenM, D3FtuScreenM,
  D3WatchScreenM, D3WatchBetweenScreenM, D3ThreadScreenM,
  TileStack, RailBody, DraftPanel, AnalysisPanel, WatchRail, ThreadRosterRail,
});
