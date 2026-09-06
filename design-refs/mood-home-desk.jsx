// ═══════════════════════════════════════════════════════════════════════════
// HOME, ON DESKTOP · wave 52 parity
// The room is the same room: one coordinate space, the same fixtures on the same
// walls, the same bodies with the name pill above the head and nothing under the
// feet. Desktop does not redraw it — it shows it BIGGER and puts the thread in a
// permanent rail instead of a collapsing sheet, which is the only real difference
// a 1440 screen buys. Sheets that arrive from a fixture arrive in the rail.
// ═══════════════════════════════════════════════════════════════════════════

const HD_SCALE = 1.34;                        // 390 → 523 wide, 612 → 820 tall
const HD_RAIL = 360;

// the room, scaled once. Everything inside keeps working in room coordinates.
const HdRoom = ({ children, tape, lit = true, dim }) => (
  <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: '#0C1110', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: F_W * HD_SCALE, height: 806, position: 'relative', overflow: 'hidden', borderRadius: 6, border: `1px solid ${M_BORDER}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', filter: dim ? 'brightness(0.5)' : 'none' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: F_W, height: 612, transform: `scale(${HD_SCALE})`, transformOrigin: '0 0' }}>
        <HomeFlat tape={tape} lit={lit}>{children}</HomeFlat>
      </div>
    </div>
  </div>
);

// the thread, permanent: no collapsed state on desktop, because there is room
const HdThread = ({ nightly, nightlyOpen, lines = [], toast }) => (
  <div style={{ width: HD_RAIL, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: 'rgba(14,20,19,0.96)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px 10px', borderBottom: `1px solid ${M_BORDER}` }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: M_TEAL }}>THE ROOM</span>
      <span style={{ fontSize: 10, color: M_MUTED }}>everyone at home hears this</span>
    </div>
    {toast && <div style={{ flexShrink: 0, padding: '10px 10px 0' }}><HomeToast {...toast}/></div>}
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {nightly && <HomeNightly day={nightly} open={nightlyOpen}/>}
      {lines.map((l, i) => l.you ? <YouLine key={i} text={l.text}/> : <HomeThreadLine key={i} a={l.a} text={l.text} sys={l.sys}/>)}
    </div>
    <div style={{ flexShrink: 0, padding: '10px 14px 14px', borderTop: `1px solid ${M_BORDER}` }}>
      <div style={{ height: 34, borderRadius: 17, border: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'center', padding: '0 13px' }}>
        <span style={{ fontSize: 11.5, color: M_FAINT }}>Say something to the room…</span>
      </div>
    </div>
  </div>
);

// a sheet from a fixture becomes a rail panel: same content, no glass over the room
const HdPanel = ({ title, children }) => (
  <div style={{ width: HD_RAIL, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: 'rgba(14,20,19,0.96)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px 10px', borderBottom: `1px solid ${M_BORDER}` }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD }}>{title}</span>
      <span style={{ marginLeft: 'auto', fontSize: 13, color: M_MUTED, cursor: 'pointer' }}>×</span>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ width: 390, transform: `scale(${HD_RAIL / 390})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
  </div>
);

// ── the room, two at the table and two away ──────────────────────────────
const HdHomeScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <HdRoom>
      <AwayWall frames={[
        { a: H_CAST.agg, line: '25/50 · +$340 · 41 min' },
        { a: H_CAST.blf, line: '10/20 · −$90 · 12 min' },
      ]} hooks={1}/>
      <TableChairs taken={2}/>
      <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
        players={[{ a: H_CAST.bal, stamina: 86, heat: 16 }, { a: H_CAST.val, stamina: 34, heat: 48 }]}
        says={{ i: 1, text: 'You always raise that. Always.' }}/>
    </HdRoom>
    <HdThread nightly={NIGHT_DAY}
      lines={[
        { you: true, text: 'Who wants 25/50 tonight?' },
        { a: { ...H_CAST.agg, mood: 'tilted' }, text: 'Me. Obviously me.' },
        { a: H_CAST.bal, text: 'His pocket is $1,240. That is one buy-in. I would not.' },
      ]}/>
  </D7Shell>
);

// ── the safe, in the rail ─────────────────────────────────────────────────
const HdSafeScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <HdRoom dim>
      <AwayWall frames={[{ a: H_CAST.blf, line: '10/20 · −$90' }]} hooks={2}/>
      <TableChairs taken={2}/>
      <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
        players={[{ a: H_CAST.bal, stamina: 86, heat: 16 }, { a: H_CAST.val, stamina: 34, heat: 48 }]}/>
    </HdRoom>
    <HdPanel title="THE SAFE"><HomeMoneySheet/></HdPanel>
  </D7Shell>
);

// ── the table sheet: where a new agent comes from ────────────────────────
const HdTableScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <HdRoom dim>
      <AwayWall hooks={2}/>
      <TableChairs taken={2}/>
      <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
        players={[{ a: { ...H_CAST.agg, mood: 'frustrated' }, stamina: 60, heat: 58 }, { a: H_CAST.bal, stamina: 80, heat: 18 }]}/>
    </HdRoom>
    <HdPanel title="THE TABLE"><TableSheet taken={2}/></HdPanel>
  </D7Shell>
);

// ── the fridge errand and the tape room, at desktop scale ────────────────
const HdFridgeScreenM = () => (
  <D7Shell net="+$486" flagged="1 flagged">
    <HdRoom>
      <AwayWall hooks={3}/>
      <TableChairs taken={2}/>
      <HomeGame ring={[TABLE_SEATS[4][0], TABLE_SEATS[4][1]]}
        players={[{ a: { ...H_CAST.agg, mood: 'frustrated' }, stamina: 58, heat: 62 }, { a: H_CAST.bal, stamina: 80, heat: 18 }]}
        says={{ i: 0, text: 'Fine. One beer and I am fine.' }}/>
      <div style={{ position: 'absolute', left: 244, top: 234, zIndex: 40, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ width: 7, height: 17, borderRadius: '2px 2px 3px 3px', background: 'rgba(122,168,138,0.85)', borderTop: '2.5px solid #7AA88A' }}></span>
        <span style={{ width: 14, height: 7, borderRadius: 2, background: 'rgba(232,230,224,0.5)' }}></span>
      </div>
    </HdRoom>
    <HdThread toast={{ a: { ...H_CAST.agg, mood: 'frustrated' }, text: 'took a beer. Heat 80 → 62.' }}
      lines={[
        { a: { ...H_CAST.agg, mood: 'tilted' }, text: 'Get me a beer.' },
        { you: true, text: 'Go on then.' },
        { a: H_CAST.bal, text: 'Better. Your raise still stinks.' },
      ]}/>
  </D7Shell>
);

// the stage under the camera: the room slice fills the stage, the rail stays put
const HdCam = ({ children, zoom = true }) => {
  const k = zoom ? CAM.k * HD_SCALE : HD_SCALE;
  const W = F_W * HD_SCALE, H = 806;
  const tx = zoom ? -(FLAT.table.cx * k - W / 2) : 0;
  const ty = zoom ? -((FLAT.table.cy - 6) * k - H / 2) : 0;
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: '#0C1110', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', borderRadius: 6, border: `1px solid ${M_BORDER}`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: F_W, height: F_H, transform: `translate(${tx}px,${ty}px) scale(${k})`, transformOrigin: '0 0', transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1)' }}>
          <H_BOUND.Provider value={zoom ? { min: FLAT.table.cx - W / (2 * k), max: FLAT.table.cx + W / (2 * k), edge: H_EDGE / k } : null}>
            <HomeFlat>{children}</HomeFlat>
          </H_BOUND.Provider>
        </div>
        {/* your hand and your verbs sit on the stage, not in the rail */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'linear-gradient(180deg, transparent 0%, rgba(8,12,12,0.9) 46%)', padding: '34px 18px 16px', display: 'flex', alignItems: 'flex-end', gap: 18 }}>
          <div style={{ transform: 'scale(1.1)', transformOrigin: 'left bottom' }}><OwnerHand win={zoom ? 62 : 38}/></div>
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            {[['FOLD', M_MUTED], ['CHECK', M_DIM], ['CALL', M_TEAL], ['BET', M_GOLD]].map(([v, c]) => (
              <span key={v} style={{ flex: 1, textAlign: 'center', fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: c, background: c === M_MUTED ? 'rgba(255,255,255,0.05)' : `${c}14`, border: `1px solid ${c === M_MUTED ? 'rgba(255,255,255,0.14)' : `${c}66`}`, borderRadius: 10, padding: '12px 0' }}>{v}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// P19 · you sat down: the one push-in, desktop
const HdSitDownScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <HdCam>{ownerTable({ turn: false })}</HdCam>
    <HdThread lines={[
      { you: true, text: 'Deal me in.' },
      { a: { ...H_CAST.bal, mood: 'confident' }, text: 'You never fold a river bet, boss.' },
      { a: H_CAST.val, text: 'He is not wrong.' },
    ]}/>
  </D7Shell>
);

// P20 · pulled back to the room, still in the hand
const HdPulledBackScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <HdRoom>
      <AwayWall hooks={2}/>
      {ownerTable({ turn: true, secs: 12 })}
      <HomeOne a={{ ...H_CAST.blf, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={42} stamina={20} heat={16}/>
    </HdRoom>
    <HdPanel title="YOUR TURN · 12S">
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, paddingBottom: 11 }}>You pulled back to the room and you can still act. Timeout checks if it can, folds if it cannot — either way you are dealt in next hand.</div>
        <ActionRow raised sub="12s · timeout checks for you"/>
      </div>
    </HdPanel>
  </D7Shell>
);

// P21 · the table sheet in the rail, three labelled sections
const HdTableSheetScreenM = () => (
  <D7Shell net="+$1,290" flagged="2 flagged">
    <HdRoom dim>
      <AwayWall hooks={2}/>
      <TableChairs taken={2}/>
      <HomeGame ring={OWNER_RING}
        players={[{ a: { ...H_CAST.agg, mood: 'frustrated' }, stamina: 60, heat: 58 }, { a: H_CAST.bal, stamina: 80, heat: 18 }]}/>
    </HdRoom>
    <HdPanel title="THE TABLE"><TableSheet taken={2}/></HdPanel>
  </D7Shell>
);

Object.assign(window, {
  HdCam, HdSitDownScreenM, HdPulledBackScreenM, HdTableSheetScreenM,
  HD_SCALE, HD_RAIL, HdRoom, HdThread, HdPanel,
  HdHomeScreenM, HdSafeScreenM, HdTableScreenM, HdFridgeScreenM,
});
