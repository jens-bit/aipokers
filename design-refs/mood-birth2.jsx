// THE BIRTH WAVE, DESKTOP — the same flow in DesktopShell, composed from existing parts.
// The only thing desktop adds is room for the forming ghost to be large. It is used for
// exactly that and nothing else: no extra panels, no new components, no new colours.

const DB_PAD = 22;

// ── the right rail panel: where the mobile watermark grows up ──
// FormingGhost large, DraftProfile's stats beneath it, both driven by one phase.
const DraftGrowthPanel = ({ phase, style, risk, tight, aggr, name }) => (
  <Panel>
    <PanelHead title="The draft" sub={`${Math.round(phase * 100)}% DEFINED`}/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* the ghost, at the size desktop can actually afford */}
      <div style={{
        flexShrink: 0, height: 268, position: 'relative',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: `radial-gradient(ellipse at 50% 78%, ${M_TEAL}${phase > 0.5 ? '14' : '08'}, transparent 68%)`,
        borderBottom: `1px solid ${M_BORDER}`, paddingBottom: 16,
      }}>
        <FormingGhost size={168} phase={phase}/>
        <div style={{ position: 'absolute', top: 14, left: DB_PAD, display: 'flex', alignItems: 'center', gap: 7 }}>
          <StateTag state="drafting" compact/>
        </div>
      </div>

      <div style={{ padding: `14px ${DB_PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
          <span style={{ fontFamily: ROZHA, fontSize: 19, color: name ? M_TEXT : M_FAINT }}>
            {name || 'unnamed'}
          </span>
          {!name && <span style={{ fontSize: 11.5, color: M_MUTED }}>named last</span>}
        </div>
        <TraitBar k="Style" v={style}/>
        <TraitBar k="Risk" v={risk}/>
        <TraitBar k="Tightness" v={tight}/>
        <TraitBar k="Aggression" v={aggr}/>
      </div>

      <div style={{ padding: `14px ${DB_PAD}px`, marginTop: 'auto' }}>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
          {aggr == null
            ? 'One trait still open. Nothing is saved until you lock it in.'
            : 'Every trait set. Lock it in and he takes a seat.'}
        </div>
      </div>
    </div>
    <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, padding: `11px ${DB_PAD}px`, display: 'flex', gap: 8 }}>
      <Btn kind="ghost" h={32}>Discard</Btn>
      <div style={{ flex: 1 }}/>
      <Btn kind={aggr == null ? 'outline' : 'primary'} h={32}>{aggr == null ? 'Lock it in' : 'Deal him in'}</Btn>
    </div>
  </Panel>
);

// ── the centre column: the same conversation, at the same density as the thread ──
const DraftCentre = ({ children, phase, cause }) => (
  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
    <DraftBand phase={phase} cause={cause} action="Skip"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: `18px ${DB_PAD}px` }}>
      {children}
    </div>
    <PComposer draft=""/>
  </div>
);

// desktop bubbles, matching D3ThreadScreenM's anatomy exactly
const DBSys = ({ time, children }) => (
  <div style={{ display: 'flex', gap: 12, maxWidth: 620, marginBottom: 16 }}>
    <PHood size={32} accent={M_TEAL} mood="neutral"/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT }}>Recruiter</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{time}</span>
      </div>
      <div style={{ background: M_PANEL_2, border: `1px solid ${M_BORDER_2}`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  </div>
);

const DBOwner = ({ time, children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
    <div style={{ maxWidth: 420 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT }}>You</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{time}</span>
      </div>
      <div style={{ background: `${M_TEAL}1A`, border: `1px solid ${M_TEAL}44`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  </div>
);

// ═══ DB1 · ENTRY from the rail ═══
const DeskDraftEntryScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$340" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <ThreadRosterRail drafting={0.08}/>
      <DraftCentre phase={0.08} cause="nothing decided yet">
        <DBSys time="09:41">
          One open seat. Tell me how it should play — style, risk, how tight, how aggressive.
          <div style={{ marginTop: 6, color: M_DIM, fontSize: 12.5 }}>
            Plain words work. &ldquo;Patient, hates bluffing, folds when it smells wrong.&rdquo;
          </div>
        </DBSys>
      </DraftCentre>
      <DraftGrowthPanel phase={0.08} style={null} risk={null} tight={null} aggr={null}/>
    </div>
  </DesktopShell>
);

// ═══ DB2 · MID-DRAFT — the panel is where definition arrives ═══
const DeskDraftMidScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$340" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <ThreadRosterRail drafting={0.62}/>
      <DraftCentre phase={0.62} cause="patient · low variance · unnamed">
        <DBOwner time="09:42">Patient. I don't want it bluffing into three people.</DBOwner>
        <DBSys time="09:42">Tight preflop, no multiway bluffs. That's a grinder — low variance, slow money.</DBSys>
        <DBOwner time="09:43">Right. But punish weakness heads-up.</DBOwner>
        <DBSys time="09:43">Aggression is the last thing open. Heads-up, or everywhere in position?</DBSys>
        <DBOwner time="09:43">Heads-up. Keep it quiet in multiway.</DBOwner>
        <DBSys time="09:44">Then that's a grinder with teeth. Ready when you name it.</DBSys>
      </DraftCentre>
      <DraftGrowthPanel phase={0.62} style={38} risk={26} tight={74} aggr={null}/>
    </div>
  </DesktopShell>
);

// ═══ DB3 · BIRTH — back to the floor stage; the room logs him and moves on ═══
const DeskBirthScreenM = () => (
  <DesktopShell>
    <style>{`
      @keyframes rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
      @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
    `}</style>
    <DeskTopBar net="+$340" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <ThreadRosterRail born/>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
        <DeskFloor layout="one"
          seats={{ 0: { name: 'Balanced v2.1', accent: M_TEAL, mood: 'confident', pot: '480', speed: 5, hole: [['A','s'],['K','h']] } }}
          bar={[{ x: 300, name: 'Bluff Master', accent: M_GOLD, mood: 'confident', state: 'recap', speed: 6 }]}/>
        {/* he arrives at the bar, and the room does not stop for him */}
        <div style={{ position: 'absolute', left: 470, bottom: 132, transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              maxWidth: 220, background: 'rgba(10,15,23,0.92)', border: `1px solid ${M_TEAL}55`,
              borderRadius: 12, borderBottomLeftRadius: 3, padding: '9px 13px',
              boxShadow: `0 0 18px ${M_TEAL}22`, animation: 'rise 0.5s ease-out both',
            }}>
              <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.45 }}>Deal me in whenever you're ready.</div>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '50%', top: '48%', width: 92, height: 92,
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle, ${M_TEAL}26, transparent 72%)`,
                animation: 'fadein 0.8s ease-out both',
              }}/>
              <FormingGhost size={80} phase={0.72}/>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, padding: '0 9px',
              borderRadius: 5, background: 'rgba(10,10,10,0.7)', border: `1px dashed ${M_TEAL}66`,
              opacity: 0.65, animation: 'fadein 1.9s ease-out both',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', border: `1px dashed ${M_TEAL}` }}/>
              <span style={{ fontSize: 11.5, color: M_TEXT, fontWeight: 500 }}>Grinder v1.0</span>
            </div>
          </div>
        </div>
      </div>
      <Panel>
        <PanelHead title="Standup" sub="WED · MAY 6 · 09:44"/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: `14px ${DB_PAD}px` }}>
          <PStandupCard log="Grinder v1.0 joined the room, 09:44"/>
        </div>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  DraftGrowthPanel, DraftCentre, DBSys, DBOwner,
  DeskDraftEntryScreenM, DeskDraftMidScreenM, DeskBirthScreenM,
});
