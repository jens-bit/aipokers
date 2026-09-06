// ═════════════════════════════════════════════════════════════════
// DESKTOP · wave 56 and 57 parity at 1440×900
//
// Desktop buys one thing: a permanent rail. So nothing here is redrawn — the room
// is the room at HD_SCALE, the felt is the felt at the scale that fills the stage,
// and every sheet that arrives over the room on mobile arrives IN the rail instead.
// Same glass, same rules, no bottom bar.
//
// It also retires two screens: HdSitDownScreenM and HdPulledBackScreenM were the
// room-camera sit-down, which wave 56 replaced with the Watch felt.
// ═════════════════════════════════════════════════════════════════

const DK_STAGE = 1440 - HD_RAIL;      // 1080
const DK_FELT_K = 806 / V5_FELT_H;    // the felt fills the stage's height exactly

// the felt at desktop scale. Its contents keep working in 390 coordinates, which is
// the whole reason the seats, chips and bubbles need no desktop variants.
const DkFelt = ({ children, foot }) => (
  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#0C1110', overflow: 'hidden' }}>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ width: F_W * DK_FELT_K, height: V5_FELT_H * DK_FELT_K, position: 'relative', overflow: 'hidden', borderRadius: 6, border: `1px solid ${M_BORDER}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ width: F_W, height: V5_FELT_H, transform: `scale(${DK_FELT_K})`, transformOrigin: '0 0', display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>
    {foot}
  </div>
);

// the verbs, across the stage rather than the phone's width — one glass, same tokens
const DkActions = ({ bet }) => (
  <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', gap: 10, padding: '14px 0 18px', background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}` }}>
    {[['FOLD', M_MUTED], ['CHECK', M_DIM], ['CALL', M_TEAL], ['BET', M_GOLD]].map(([v, c]) => (
      <div key={v} style={{ width: 132, height: 46, borderRadius: 12, background: v === 'BET' && bet ? `${M_GOLD}22` : V5GLASS.raised, border: `1px solid ${v === 'BET' ? `${M_GOLD}66` : v === 'CALL' ? `${M_TEAL}55` : V5GLASS.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: c }}>{v}</span>
      </div>
    ))}
  </div>
);

const DkBetPanel = () => (
  <div style={{ flexShrink: 0, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${M_GOLD}66`, padding: '12px 0 18px' }}>
    <div style={{ width: 620, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, paddingBottom: 10 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>BET</span>
        <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>pot is 480 · you have 1,840</span>
        <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, cursor: 'pointer' }}>CANCEL</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['A THIRD', '160'], ['HALF', '240'], ['POT', '480'], ['ALL IN', '1,840']].map(([k, v], i) => (
          <div key={k} style={{ flex: 1, textAlign: 'center', borderRadius: 11, border: `1px solid ${i === 3 ? M_GOLD : `${M_GOLD}44`}`, background: i === 3 ? `${M_GOLD}1E` : `${M_GOLD}0D`, padding: '10px 0 9px', cursor: 'pointer' }}>
            <div style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: i === 3 ? M_GOLD : M_DIM }}>{k}</div>
            <div style={{ marginTop: 3 }}><Num size={14} weight={700} color={M_GOLD}>{v}</Num></div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, width: 190, height: 48, borderRadius: 11, border: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.03)', padding: '0 13px' }}>
          <span style={{ flex: 1, fontFamily: MONO, fontSize: 12.5, color: M_MUTED }}>any amount</span>
          <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_GOLD, border: `1px solid ${M_GOLD}66`, borderRadius: 8, padding: '6px 12px' }}>BET</span>
        </div>
      </div>
    </div>
  </div>
);

// ── the two sit-down screens, on the felt ────────────────────────────────
const DkSitDownScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <DkFelt foot={<DkActions/>}>
      <V5Felt seats={SIT_RING} pot="120" board={[]} flip={0} stackBand="mid" stackAmt="1,840"
        oppSays={SIT_READ} hero={<SitHero win={62}/>}><SitCorners/></V5Felt>
    </DkFelt>
    <HdThread lines={[
      { a: { ...H_CAST.blf, name: 'Granite', accent: M_GOLD }, text: 'You never fold a river bet, boss.' },
      { you: true, text: 'Watch me.' },
    ]}/>
  </D7Shell>
);

const DkBetScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <DkFelt foot={<DkBetPanel/>}>
      <V5Felt seats={SIT_RING} pot="480" flip={4} stackBand="mid" stackAmt="1,840" potBand="mid"
        hero={<SitHero win={38} turn secs={16}/>}><SitCorners/></V5Felt>
    </DkFelt>
    <HdThread lines={[{ a: { ...H_CAST.blf, name: 'Granite', accent: M_GOLD }, text: 'Take your time.' }]}/>
  </D7Shell>
);

// ── the draft: the sheet becomes the rail, he forms on the stage ──────────
const DkDraftScreenM = ({ stage = 3, named }) => (
  <D7Shell net="—" flagged="—">
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: '#0C1110', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.3 }}>
        <div style={{ width: F_W * HD_SCALE, height: 806, transform: 'translateX(-50%)', marginLeft: '50%', position: 'relative', overflow: 'hidden' }}>
          <div style={{ width: F_W, height: F_H, transform: `scale(${HD_SCALE})`, transformOrigin: '0 0' }}><HomeFlat lit={false}/></div>
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <FormingGhost stage={stage} size={200}/>
        <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: stage === 4 ? M_GOLD : M_MUTED }}>
          {stage === 4 ? 'GRANITE · A ROCK' : DRAFT_STAGES[stage - 1].cap.toUpperCase()}
        </span>
      </div>
    </div>
    <HdPanel title={`The draft · ${stage} of 4`}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '10px 14px 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {DRAFT_TALK.slice(0, stage).flat().slice(-6).map((r, i) => <DraftRow key={i} r={r}/>)}
      </div>
      <div style={{ flexShrink: 0, padding: '10px 14px 16px' }}>
        {named ? (
          <div style={{ height: 48, borderRadius: 12, background: M_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 4px 18px ${M_GOLD}44` }}>
            <span style={{ fontFamily: OSWALD, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.12em', color: '#120C04' }}>DEAL HIM IN</span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.05)', border: `1px solid ${V5GLASS.edge}`, padding: '0 8px 0 14px' }}>
            <span style={{ flex: 1, fontSize: 12.5, color: M_MUTED }}>answer him…</span>
            <span style={{ width: 30, height: 30, borderRadius: 15, background: `${M_TEAL}26`, border: `1px solid ${M_TEAL}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 20 20"><path d="M2 10L18 3L11 18L9.4 11.6L2 10Z" fill="none" stroke={M_TEAL} strokeWidth="1.5" strokeLinejoin="round"/></svg>
            </span>
          </div>
        )}
      </div>
    </HdPanel>
  </D7Shell>
);

const DkDraftFormingScreenM = () => <DkDraftScreenM stage={3}/>;
const DkDraftNamedScreenM = () => <DkDraftScreenM stage={4} named/>;

// ── the casino: the split board in the rail, the rooms on the stage ───────
const DkRoom = ({ nm, stake, inn, mine, hot }) => (
  <div style={{ flex: 1, minWidth: 0, borderRadius: 12, border: `1px solid ${hot ? `${M_RED}55` : M_BORDER}`, background: hot ? `radial-gradient(ellipse at 50% 34%, ${M_RED}1A 0%, #16201E 68%)` : 'radial-gradient(ellipse at 50% 34%, #24312C 0%, #16201E 74%)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
    <div style={{ position: 'absolute', left: 16, top: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.15em', color: hot ? M_RED : M_MUTED }}>{nm}</span>
      {hot && <LiveDot color={M_RED} size={5}/>}
    </div>
    <div style={{ position: 'absolute', left: 16, top: 34 }}><Amt size={26} color={M_TEXT}>{stake}</Amt></div>
    <div style={{ position: 'absolute', left: 17, top: 68, fontFamily: MONO, fontSize: 10.5, color: M_MUTED }}>{inn}</div>
    {/* the crowd, as tiny bodies — a number of agents is not a room */}
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 42, display: 'flex', justifyContent: 'center', gap: 5, opacity: 0.5 }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <MoodGhost key={i} mood="neutral" size={20 + (i % 3) * 3} ring={false} hood={HOODS[(i * 2) % 6]} glow={GLOWS[i % 6].c}/>
      ))}
    </div>
    {mine && (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, display: 'flex', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: M_TEAL, background: 'rgba(8,12,12,0.9)', border: `1px solid ${M_TEAL}55`, borderRadius: 8, padding: '3px 10px' }}>{mine}</span>
      </div>
    )}
    <div style={{ position: 'absolute', right: 14, bottom: 13, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL }}>GO IN →</div>
  </div>
);

const DkCasinoScreenM = ({ idle }) => (
  <D7Shell net={idle ? '—' : '+$1,290'} flagged={idle ? '—' : '2 flagged'}>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14, padding: 18, background: M_BG, overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 11 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, cursor: 'pointer' }}>← HOME</span>
        <span style={{ fontFamily: PLAYFAIR, fontSize: 21, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap' }}>The casino</span>
        <span style={{ fontSize: 11.5, color: M_MUTED }}>1,604 playing · {idle ? 'none' : '1'} of yours</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
        <DkRoom nm="THE FLOOR" stake="10/20" inn="412 in" mine={idle ? null : 'Balanced v2.1 · +$340'}/>
        <DkRoom nm="UPSTAIRS" stake="25/50" inn="186 in"/>
        <DkRoom nm="BACK ROOM" stake="50/100" inn="41 in" hot/>
      </div>
      <div style={{ flexShrink: 0, height: 250 }}><YourTable playing={!idle}/></div>
    </div>
    <HdPanel title="On the floor">
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <LiveNow/>
        <Tonight/>
      </div>
    </HdPanel>
  </D7Shell>
);

const DkCasinoIdleScreenM = () => <DkCasinoScreenM idle/>;

// ── the roster: mobile's sheet, desktop's rail ────────────────────────────
const DkRosterScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <HdRoom tape="casino" dim>
      <AwayWall frames={[{ a: H_CAST.bal, line: '10/20 · +$340 · 22 min' }]} hooks={2}/>
      <TableChairs taken={2}/>
      <HomeGame players={[{ a: wear(H_CAST.agg, 'frustrated'), stamina: 62, heat: 78 }, { a: wear(H_CAST.blf), stamina: 70, heat: 24 }]}/>
      <HomeOne a={wear(H_CAST.val, 'neutral')} at={STAND.fridge} routine="fridge" size={44} stamina={34} heat={12}/>
      <DoorTap/>
    </HdRoom>
    <HdPanel title="Your agents">
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {NAV_ROSTER.map(r => <RosterRow key={r.a.id} r={r}/>)}
      </div>
      <div style={{ flexShrink: 0, padding: '12px 14px 16px', borderTop: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
        The avatar in the top bar is the only way in, on both platforms. <b style={{ color: M_DIM }}>The money and the ledger sit behind this list</b>, one level down — never as a tab of its own.
      </div>
    </HdPanel>
  </D7Shell>
);

Object.assign(window, {
  DK_STAGE, DK_FELT_K, DkFelt, DkActions, DkBetPanel,
  DkSitDownScreenM, DkBetScreenM,
  DkDraftScreenM, DkDraftFormingScreenM, DkDraftNamedScreenM,
  DkRoom, DkCasinoScreenM, DkCasinoIdleScreenM, DkRosterScreenM,
});
