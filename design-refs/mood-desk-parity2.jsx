// DESKTOP PARITY — the missing screens, and the consolidated matrix.

const D7Shell = ({ net = '+$3,712', flagged = '4 flagged', children }) => (
  <DesktopShell>
    <DeskTopBar net={net} flagged={flagged}/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>{children}</div>
  </DesktopShell>
);

// the session-truth strip the desktop rail keeps permanently, where mobile has to
// wait for a between-hands moment to show it
const TruthStrip = ({ children }) => (
  <div style={{ flexShrink: 0, padding: '10px 14px 11px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL_2 }}>
    <Num size={9} color={M_MUTED} weight={500}>{children}</Num>
  </div>
);

// ═══ WATCH v4b · the four missing pace states ═════════════════════════════
const D7W4DealScreenM = () => (
  <D7Shell>
    <DeskFelt4 board={[]} flip={0} pot="30" equity={50}
      seats={D6_SEATS.map(s => ({ ...s, show: null }))}/>
    <Panel>
      <PanelHead title="Balanced v2.1" sub="DEALING HAND 43 · $5/$10 6-MAX"/>
      <TruthStrip>HIS CARDS LAND FIRST, 90ms APART &middot; THEN THE TABLE&rsquo;S BACKS AS ONE SWEEP</TruthStrip>
      <TableTab log={TABLE_LOG.slice(0, 2)}/>
    </Panel>
  </D7Shell>
);

const D7W4HeatingScreenM = () => (
  <D7Shell>
    <DeskFelt4 acting="granite" pot="1,240" equity={71} heat
      says={[{ mine: true, text: "Now it's a real pot. Good." }, { id: 'nash', text: 'Too rich for me.' }]}/>
    <Panel>
      <PanelHead title="Balanced v2.1" sub="HEATING · POT PAST THE THRESHOLD"/>
      <TruthStrip>+$3,712 TONIGHT &middot; 43 HANDS &middot; BIGGEST POT SO FAR: $1,240</TruthStrip>
      <TableTab log={[...TABLE_LOG, { who: 'nash_eq', s: 'Too rich for me.', at: '18:33' }, { who: 'him', s: "Now it's a real pot. Good.", at: '18:33' }]}/>
    </Panel>
  </D7Shell>
);

const D7W4AllInScreenM = () => (
  <D7Shell>
    <DeskFelt4 acting="granite" pot="3,694" equity={64} heat allin
      says={[{ mine: true, text: "All of it. He's drawing." }, { id: 'granite', text: 'Call.' }]}/>
    <Panel>
      <PanelHead title="Balanced v2.1" sub="ALL-IN · RIVER IN 3"/>
      <TruthStrip>$3,694 IN THE MIDDLE &middot; HIS WHOLE STACK &middot; HELD FOR THE SPECTATOR</TruthStrip>
      <TableTab log={[
        { who: 'him', s: 'All of it.', at: '18:33' },
        { who: 'Granite', s: 'Call.', at: '18:33' },
        { who: 'him', s: "All of it. He's drawing.", at: '18:33' },
      ]}/>
    </Panel>
  </D7Shell>
);

const D7W4BetweenScreenM = () => (
  <D7Shell>
    <DeskFelt4 board={[]} flip={0} pot="—" equity={50}
      seats={D6_SEATS.map(s => ({ ...s, show: null }))}
      says={[{ mine: true, text: 'Good table. I will take another orbit here.' }]}/>
    <Panel>
      <PanelHead title="Balanced v2.1" sub="BETWEEN HANDS · NEXT DEAL 8s"/>
      <TruthStrip>+$3,712 TONIGHT &middot; 43 HANDS &middot; WORST BEAT: THE Q3o ON HAND 19</TruthStrip>
      <TableTab log={[
        { who: 'you', s: 'Nice one.', at: '18:34' },
        { who: 'him', s: 'Good table. I will take another orbit here.', at: '18:34' },
      ]}/>
    </Panel>
  </D7Shell>
);

// ═══ WALLET · collect, broke, cut off ════════════════════════════════════
const D7CollectScreenM = () => (
  <D7Shell net="+$486" flagged="1 flagged">
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
      <MoodBand accent={M_TEAL} mood="confident" state="recap" action="Deploy" cause="brought home $340"/>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
          <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.18em' }}>SESSION CLOSED &middot; 02:14</span>
          <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
        </div>
        <div style={{ display: 'flex', gap: 12, maxWidth: 560, marginBottom: 16 }}>
          <PHood size={32} accent={M_TEAL} mood="confident"/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT }}>Balanced v2.1</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>02:14</span>
            </div>
            <div style={{ background: M_PANEL_2, border: `1px solid ${M_TEAL}3D`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
              Six hundred and forty in my pocket. Three hundred of it is yours.
            </div>
          </div>
        </div>
        <div style={{ marginLeft: 44, maxWidth: 420 }}><CollectCard/></div>
      </div>
      <PComposer draft=""/>
    </div>
    <Panel>
      <PanelHead title="Your wallet" sub="AFTER THIS COLLECT"/>
      <RailBody>
        <div style={{ padding: '16px 18px 17px', borderRadius: 14, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D` }}>
          <Lbl size={9.5}>Balance</Lbl>
          <div style={{ marginTop: 6 }}><Amt size={38}>$2,680.50</Amt></div>
          <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Num size={9} color={M_MUTED} weight={500}>WAS $2,340.50</Num>
            <svg width="20" height="12" viewBox="0 0 26 14" fill="none" stroke={M_TEAL} strokeWidth="1.8" strokeLinecap="round"><path d="M1 7h20M16 2l5 5-5 5"/></svg>
            <Num size={11} weight={700} color={M_TEAL}>+$340</Num>
          </div>
        </div>
        <div style={{ padding: '2px 15px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <PocketRow p={{ ...POCKETS[0], pocket: '300', pnl: '+$340', action: 'Collect' }} last/>
        </div>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
          A transfer, not a jackpot: one soft note, one success haptic, and his pocket falls back to the float you set. <b style={{ color: M_DIM }}>Leave it in instead</b> and he plays bigger tomorrow.
        </div>
      </RailBody>
    </Panel>
  </D7Shell>
);

const D7WalletBrokeScreenM = () => (
  <D7Shell net="+$486" flagged="1 flagged">
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
      <MoodBand accent={M_PINK} mood="sulking" state="resting" action="Fund" cause="pocket empty — at the bar"/>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 22px', background: M_PANEL_2, borderBottom: `1px solid ${M_BORDER}` }}>
        <div><Lbl size={8.5}>Pocket</Lbl><div><Num size={14} weight={700} color={M_MUTED}>$0</Num></div></div>
        <div style={{ width: 1, height: 24, background: M_BORDER }}/>
        <span style={{ flex: 1, fontSize: 12, color: M_MUTED }}>Cut off Tuesday &middot; nothing pending &middot; he keeps everything he has learned</span>
        <Btn kind="primary" h={32}>Fund</Btn>
      </div>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px' }}>
        <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['I’m out. Your call.', '21:40'], ['I’ll be at the bar. My read book keeps either way.', '21:41']].map(([s, t]) => (
            <div key={t} style={{ display: 'flex', gap: 12 }}>
              <PHood size={32} accent={M_PINK} mood="sulking"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT }}>Value Bot</span>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{t}</span>
                </div>
                <div style={{ background: M_PANEL_2, border: `1px solid ${M_PINK}3D`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <PComposer draft=""/>
    </div>
    <Panel>
      <PanelHead title="Fund Value Bot" sub="POCKET $0 · CUT OFF"/>
      <RailBody>
        <div style={{ padding: '12px 14px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div><Lbl size={8.5}>Pocket</Lbl><div><Num size={19} weight={700} color={M_MUTED}>$0</Num></div></div>
            <div style={{ width: 1, height: 26, background: M_BORDER }}/>
            <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>nothing staked</span>
          </div>
          <div style={{ marginTop: 10 }}><PocketBar have={0} cap={500} broke/></div>
        </div>
        <div>
          <FundOption mode="topup" amount="$300"/>
          <FundOption mode="allowance" amount="$500"/>
          <FundOption mode="auto" amount="cap $1,000"/>
          <FundOption mode="cut" on sub="He finishes the hand he is in and takes a seat at the bar. His attributes, his read book and his grudges all keep."/>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33`, fontSize: 11.5, color: M_DIM, lineHeight: 1.55 }}>
          <b style={{ color: M_TEXT }}>Cut off is a legitimate state</b>, and it is drawn like one: the same four options, the fourth one selected, no warning colour and nothing lost. He does not plead and the copy does not scold.
        </div>
      </RailBody>
    </Panel>
  </D7Shell>
);

// ═══ FLOOR v2 · the resting room, breathing ══════════════════════════════
const D7FloorRestingScreenM = () => (
  <D7Shell net="+$486" flagged="1 flagged">
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', display: 'flex' }}>
      <DeskFloor layout="quiet"/>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 40% 60%, rgba(8,9,11,0) 0%, rgba(8,9,11,0.16) 60%, rgba(8,9,11,0.4) 100%)' }}/>
      {/* the dashed rim: a felt nobody has sat at yet */}
      <div style={{ position: 'absolute', left: 300, top: 210, width: 440, height: 190, borderRadius: '50%', border: `1px dashed ${M_TEAL}44`, pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', left: 40, bottom: 30, display: 'flex', gap: 30, zIndex: 5 }}>
        {[
          { ...CAST.bluff, heat: 22, pip: 'grew' },
          { ...CAST.balanced, heat: 14, pip: null },
          { ...CAST.aggressive, heat: 58, pip: 'worn' },
          { ...CAST.value, heat: 8, pip: 'broke' },
        ].map(g => (
          <div key={g.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <DeskHeatGhost mood={g.mood} accent={g.accent} heat={g.heat} size={58}/>
            {g.pip ? <RestPip kind={g.pip}/> : <div style={{ height: 14 }}/>}
          </div>
        ))}
      </div>
    </div>
    <Panel>
      <PanelHead title="The room" sub="4 RESTING · 0 LIVE"/>
      <RailBody>
        <div style={{ padding: '13px 15px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <Lbl size={9.5}>Tonight, so far</Lbl>
          <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, marginTop: 7 }}>
            Four resting. <b>Bluff Master grew tonight</b> and Aggressive v1.3 came off worn.
          </div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <Lbl size={9.5}>Who has news</Lbl>
          <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[['Bluff Master', 'grew'], ['Aggressive v1.3', 'worn'], ['Value Bot', 'broke']].map(([n, k]) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ flex: 1, fontSize: 12.5, color: M_TEXT }}>{n}</span>
                <RestPip kind={k}/>
              </div>
            ))}
          </div>
        </div>
        <Btn kind="primary" h={44} full>Deploy someone</Btn>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
          Never &ldquo;everyone&rsquo;s resting&rdquo;. The room stays at full brightness because nothing is competing with it, the dashed rim marks the felt waiting for a body, and <b style={{ color: M_DIM }}>heat keeps every posture moving</b> even with no hand in play.
        </div>
      </RailBody>
    </Panel>
  </D7Shell>
);

// ═══ FTU · the missing steps ═════════════════════════════════════════════
const D7FtuDraftScreenM = () => (
  <D7Shell net="—" flagged="—">
    <ThreadRosterRail collapsed/>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
      <DraftBand phase={0} cause="nothing decided yet" action="Skip"/>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px', position: 'relative' }}>
        <div style={{ position: 'absolute', right: 40, top: 40, opacity: 0.12, pointerEvents: 'none' }}>
          <FormingGhost size={260} phase={0}/>
        </div>
        <div style={{ maxWidth: 560, position: 'relative' }}>
          <div style={{ background: M_PANEL_2, border: `1px solid ${M_BORDER_2}`, borderRadius: 12, padding: '14px 17px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
            One open seat. Tell me how it should play &mdash; style, risk, how tight, how aggressive.
            <div style={{ marginTop: 8, color: M_DIM, fontSize: 12.5 }}>
              Plain words work. &ldquo;Patient, hates bluffing, folds when it smells wrong.&rdquo;
            </div>
            <div style={{ marginTop: 9 }}><Num size={9} color={M_MUTED} weight={500}>RECRUITER &middot; 17:44</Num></div>
          </div>
          <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
            {['Tight and patient', 'Aggressive bluffer', 'Solver-strict'].map(c => (
              <span key={c} style={{ padding: '9px 14px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_TEAL}44`, fontSize: 12.5, color: M_TEAL, cursor: 'pointer' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>
      <PComposer draft=""/>
    </div>
    <Panel>
      <PanelHead title="Taking shape" sub="0% DEFINED"/>
      <RailBody>
        <DraftProfile phase={0}/>
        <div style={{ padding: '12px 14px', borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: `${M_TEAL}55` }}>
          <Num size={9} color={M_TEAL} weight={500}>NO BRIEF</Num>
          <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.45, marginTop: 7, fontStyle: 'italic' }}>
            &ldquo;One open seat. Tell me how it should play.&rdquo;
          </div>
          <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 7 }}>
            Any one of the three chips is a complete brief. His temperament is read from the conversation and is not something you set.
          </div>
        </div>
      </RailBody>
    </Panel>
  </D7Shell>
);

const D7FtuRecapScreenM = () => (
  <D7Shell net="+$18" flagged="0 flagged">
    <ThreadRosterRail collapsed/>
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
      <MoodBand accent={M_TEAL} mood="neutral" state="recap" action="Deploy" cause="first session — +$18 over 40 hands"/>
      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px' }}>
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <PHood size={32} accent={M_TEAL} mood="neutral"/>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT }}>Rock v1.0</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>18:21</span>
              </div>
              <div style={{ background: M_PANEL_2, border: `1px solid ${M_TEAL}3D`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
                Forty hands. I folded thirty-one of them and I am up eighteen dollars.
                <div style={{ marginTop: 6, color: M_DIM, fontSize: 12.5 }}>
                  Net <span style={{ color: M_TEAL, fontWeight: 600, fontFamily: MONO }}>+$18</span> &middot; 40 hands &middot; 36m
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginLeft: 44, padding: '11px 13px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33`, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 12.5, color: M_DIM }}>He misjudged equity by 6% on the turn</span>
              <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD, background: `${M_GOLD}1F`, border: `1px solid ${M_GOLD}88`, borderRadius: 3, padding: '3px 6px', cursor: 'pointer' }}>FOCUS</span>
            </div>
            <div style={{ marginTop: 7 }}><Num size={9} color={M_MUTED} weight={500}>HAND #29 &middot; CLICK THE LABEL</Num></div>
          </div>
          <div style={{ marginLeft: 44, padding: '12px 14px', borderRadius: 10, border: `1px dashed ${M_BORDER_2}` }}>
            <Num size={9} color={M_MUTED} weight={500}>NOTHING WORTH FLAGGING</Num>
            <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.45, marginTop: 7, fontStyle: 'italic' }}>
              &ldquo;No big bluffs, no bad beats. It was a quiet first shift.&rdquo;
            </div>
            <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 7 }}>
              When a hand is worth watching it arrives here as a replay you can scrub.
            </div>
          </div>
        </div>
      </div>
      <PComposer draft=""/>
    </div>
    <Panel>
      <PanelHead title="Rock v1.0" sub="ONE SESSION OF HISTORY"/>
      <RailBody>
        <div style={{ padding: '10px 14px 11px', borderRadius: 10, border: `1px solid ${M_BORDER}`, display: 'flex' }}>
          {[['Hands', '40'], ['Net', '+$18'], ['Pocket', '$318']].map(([l, v], i) => (
            <div key={l} style={{ flex: 1, borderLeft: i ? `1px solid ${M_BORDER}` : 'none', paddingLeft: i ? 13 : 0 }}>
              <Lbl size={8.5}>{l}</Lbl>
              <div style={{ marginTop: 2 }}><Num size={14} weight={700} color={v.startsWith('+') ? M_TEAL : M_TEXT}>{v}</Num></div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 10, border: `1px dashed ${M_BORDER_2}` }}>
          <Num size={9} color={M_MUTED} weight={500}>NO HISTORY</Num>
          <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 7 }}>
            No mood arc, no win rate. A second session gives him a line to plot and a week gives him a number worth believing. <b style={{ color: M_DIM }}>One session is not a trend</b>, and the rail says so rather than drawing one.
          </div>
        </div>
      </RailBody>
    </Panel>
  </D7Shell>
);

// ═══ HEAT + BIOGRAPHY on the desktop read rail ═══════════════════════════
const D7HeatScreenM = () => (
  <D7Shell>
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 48% 46%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 40, textAlign: 'center' }}>
        <Lbl size={9.5}>Heat 0&ndash;100 &middot; the same mood at four temperatures</Lbl>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 110, display: 'flex', justifyContent: 'space-evenly' }}>
        {HEAT_STEPS.map(s => (
          <div key={s.h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <DeskHeatGhost mood="frustrated" accent={M_PURPLE} heat={s.h} size={72}/>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: M_TEXT }}>{s.word}</div>
              <div style={{ marginTop: 4 }}><Num size={9} color={M_MUTED} weight={500}>HEAT {s.h} &middot; {s.note.toUpperCase()}</Num></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 330, padding: '16px 20px', borderRadius: 12, background: 'rgba(10,14,14,0.72)', border: `1px solid ${M_BORDER}` }}>
        <div style={{ fontSize: 13, color: M_DIM, lineHeight: 1.65 }}>
          <b style={{ color: M_TEXT }}>Heat is intensity, not a mood and not a colour.</b> It scales the bob and the aura of whatever mood he is already in, so a confident agent at heat 12 is calm and the same agent at heat 88 is coiled. Nothing about it needs a number on the floor: the room reads temperature from how hard the bodies are moving, and the roster carries it as <b style={{ color: M_TEXT }}>a 2px hairline in the mood&rsquo;s own colour</b> under each row &mdash; the only place the value is ever exposed.
        </div>
      </div>
      <div style={{ position: 'absolute', left: 60, right: 60, top: 470 }}>
        <Lbl size={9.5}>The seat pip, at 1440</Lbl>
        <div style={{ display: 'flex', gap: 40, marginTop: 16, alignItems: 'flex-start' }}>
          <DeskSeat s={{ ...D6_SEATS[0], x: 60, y: 0 }} order={0}/>
          <div style={{ marginLeft: 120, flex: 1, fontSize: 12.5, color: M_MUTED, lineHeight: 1.6, paddingTop: 8 }}>
            The biography layer&rsquo;s gold count sits at 17px on a 62px body &mdash; the same corner it takes at 34px on mobile, opposite the dealer button. <b style={{ color: M_DIM }}>It is the only number allowed on a seat</b>, and it means &ldquo;you two have a history, and it is this many notable hands long&rdquo;.
          </div>
        </div>
      </div>
    </div>
    <Panel>
      <PanelHead title="Granite" sub="HOUSE REGULAR · 142 HANDS" close/>
      <RailBody>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, flexShrink: 0, background: '#0A0F17', border: `1px solid ${M_GOLD}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
            <MoodGhost mood="neutral" accent={M_GOLD} size={50} ring={false}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: PLAYFAIR, fontSize: 19, fontWeight: 600, color: M_TEXT }}>Granite</span>
              <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: M_RED, background: `${M_RED}14`, border: `1px solid ${M_RED}44`, borderRadius: 3, padding: '2px 5px' }}>NEMESIS</span>
            </div>
            <div style={{ marginTop: 4 }}><Num size={9} color={M_MUTED} weight={500}>&minus;$1,240 LIFETIME &middot; 142 HANDS</Num></div>
          </div>
        </div>
        <div style={{ padding: '12px 15px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          {READ_BOOK.granite.rows.map(r => <ReadBar key={r.k} {...r}/>)}
        </div>
        <div style={{ padding: '12px 15px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33`, fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic' }}>
          &ldquo;{READ_BOOK.granite.line}&rdquo;
        </div>
        <div>
          <Lbl size={9.5} color={M_RED}>Grudge ledger</Lbl>
          <div style={{ marginTop: 8, padding: '2px 13px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
            {LEDGER.map((h, i) => (
              <div key={h.n} style={{ display: 'flex', gap: 11, padding: '9px 0', borderBottom: i === LEDGER.length - 1 ? 'none' : `1px solid ${M_BORDER}` }}>
                <Num size={10.5} weight={600} color={M_TEAL}>{h.n}</Num>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: M_DIM, lineHeight: 1.4 }}>{h.line}</span>
                <Num size={11} weight={700} color={M_RED}>{h.amt}</Num>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
          Desktop is the one platform that can show the read AND the ledger at once, which is why the biography layer lives here in full and on mobile only as three rows on the profile.
        </div>
      </RailBody>
    </Panel>
  </D7Shell>
);

// ── 3 · THE CONSOLIDATED DESKTOP MATRIX ──────────────────────────────────
const DeskMatrixM = () => {
  const cols = '124px repeat(5, 1fr)';
  const surfaces = ['Stage', 'Rail (520)', 'Roster (68 / 340)', 'Top bar', 'Composer'];
  const rows = [
    { k: 'DEAL', c: M_TEAL, cells: ['his cards land first, 90ms apart; table backs as one sweep', 'TABLE record, hand number and stakes', 'live dot on his row', 'net unchanged', 'idle'] },
    { k: 'CALM', c: M_MUTED, cells: ['six bodies, rope live, bubbles over speakers', 'TABLE record + truth strip', 'heat hairline per row', 'net + flagged', 'idle'] },
    { k: 'HEATING', c: M_GOLD, cells: ['felt warms, ticker 30px gold, one rigid tap', 'biggest-pot line in the strip', 'pot value goes gold', 'net updates live', 'idle'] },
    { k: 'ALL-IN', c: M_RED, cells: ['red breath, his bubble held 3–5s, RIVER IN 3 in the hero row', 'both lines in order', 'row pulses once', 'unchanged', 'idle'] },
    { k: 'SHOWDOWN', c: M_TEAL, cells: ['cards flip per revealing seat 140ms apart, then postures react', 'the pot figure as truth', 'P&L updates', 'net updates', 'idle'] },
    { k: 'SEAT TAPPED', c: M_TEAL, cells: ['dashed teal ring, felt to 62%, hand plays on', 'the read AND the grudge ledger — desktop only', 'unchanged', 'unchanged', 'idle'] },
    { k: 'BETWEEN HANDS', c: M_MUTED, cells: ['no board, pot a mono dash, postures continue', 'truth strip: net, hands, worst beat', 'unchanged', 'unchanged', 'available'] },
    { k: 'ROOM LIVE', c: M_TEAL, cells: ['live felt full brightness, everything else 42% under a scrim', 'the room, and who has news', 'live rows first', 'net + flagged', '—'] },
    { k: 'ROOM RESTING', c: M_MUTED, cells: ['room at full brightness, dashed rim on the empty felt, heat keeps postures moving', 'what happened tonight, in a sentence', 'pips on rows with news', 'net + flagged', '—'] },
    { k: 'ARRIVING', c: M_TEAL, cells: ['one body crossing the room, trail behind, name chip on', 'the card he was born with, fold closed', 'his row appears', 'unchanged', '—'] },
    { k: 'NO BRIEF', c: M_TEAL, cells: ['— the draft owns the column', 'DraftProfile at phase 0 + the NotYet box', 'collapsed to 68px', 'em-dashes', 'open, three chips'] },
    { k: 'BRIEF USABLE', c: M_TEAL, cells: ['—', 'DraftProfile + what the button does', 'collapsed', 'em-dashes', 'replaced by Deal him in, bottom right'] },
    { k: 'FUNDED / ALLOWANCE / AUTO', c: M_TEAL, cells: ['stakes match the pocket', 'FundOption set, one selected', 'pocket figure per row', 'net', '—'] },
    { k: 'COLLECT', c: M_TEAL, cells: ['— the thread owns the column', 'wallet before → after, and the pocket falling to its float', 'P&L clears', 'net updates', 'available'] },
    { k: 'BROKE / CUT OFF', c: M_MUTED, cells: ['not seated; at the bar with a POCKET $0 chip', 'the four options, the fourth selected, nothing lost', 'pocket $0, no P&L', 'net unchanged', 'available'] },
    { k: 'NO FLAGGED HANDS', c: M_MUTED, cells: ['—', 'dashed row where the replay card would sit', 'unchanged', '0 flagged', 'available'] },
    { k: 'NO HISTORY', c: M_MUTED, cells: ['—', 'career line, then a dashed box admitting one session is not a trend', 'one row', 'net', 'available'] },
    { k: 'HEAT 0–100', c: M_PURPLE, cells: ['bob speed and aura scale with heat; no number on the floor', '—', '2px hairline in the mood’s own colour', '—', '—'] },
  ];
  return (
    <Sheet title="One desktop matrix" sub="Eighteen states × five surfaces. The em-dashes are the design: a state that does not touch a surface must not be invented for it. Read a column to build a surface; read a row to check a state is consistent across the frame.">
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>
        <div/>
        {surfaces.map(h => <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingLeft: 11 }}>{h}</div>)}
      </div>
      {rows.map(r => (
        <div key={r.k} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '8px 0', borderBottom: `1px solid ${M_BORDER}` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', color: r.c, paddingTop: 10, lineHeight: 1.3 }}>{r.k}</div>
          {r.cells.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: c === '—' ? M_FAINT : M_DIM, lineHeight: 1.45, padding: '9px 10px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{c}</div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>1280 &times; 800</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            Same rule as the wave-33 fix: <span style={{ fontFamily: MONO, fontSize: 11 }}>rail 68 &middot; panel 460 &middot; stage takes 752</span>. Every screen here is a two- or three-column composition inside those bounds, so nothing reflows — <b style={{ color: M_TEXT }}>the roster strip is the last thing to go</b>, because it is the only always-on answer to what the agents are doing.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
          <SyLbl color={M_GOLD}>What desktop has that mobile cannot</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            Three things, and only three: a <b style={{ color: M_TEXT }}>permanent truth strip</b> (mobile waits for a between-hands moment), <b style={{ color: M_TEXT }}>the read and the grudge ledger at once</b> (mobile gets a sheet, so it gets one or the other), and <b style={{ color: M_TEXT }}>three bubbles instead of two</b>. Everything else is the same components in a wider frame.
          </div>
        </div>
      </div>
    </Sheet>
  );
};

Object.assign(window, {
  D7Shell, TruthStrip, DeskMatrixM,
  D7W4DealScreenM, D7W4HeatingScreenM, D7W4AllInScreenM, D7W4BetweenScreenM,
  D7CollectScreenM, D7WalletBrokeScreenM, D7FloorRestingScreenM,
  D7FtuDraftScreenM, D7FtuRecapScreenM, D7HeatScreenM,
});
