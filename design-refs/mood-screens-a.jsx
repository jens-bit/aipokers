// CHATS — thread list. The stories row is retired; the casino floor replaces it.
// 02 HOME · first run — the stable row holds one dashed slot

// ── the stable row: large mood avatars, expression readable at a glance ──
const StableAvatar = ({ name, accent, mood, state, empty }) => {
  const ring = state === 'live' ? M_TEAL : state === 'recap' ? M_GOLD : 'rgba(255,255,255,0.10)';
  return (
    <div style={{ width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0, cursor: 'pointer' }}>
      <div style={{ position: 'relative', width: 60, height: 60 }}>
        {/* state ring — pulses only when actually playing */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `2px solid ${empty ? 'transparent' : ring}`,
          boxShadow: state === 'live' ? `0 0 10px ${M_TEAL}55` : 'none',
          animation: state === 'live' ? 'pulse 2s infinite' : 'none',
        }}/>
        <div style={{
          position: 'absolute', inset: 4, borderRadius: '50%',
          background: '#0A0F17',
          border: empty ? `1px dashed ${M_TEAL}77` : `1px solid ${accent}44`,
          overflow: 'hidden', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          {empty ? (
            <svg width="50" height="52" viewBox="0 0 80 88" style={{ display: 'block' }}>
              <defs>
                <radialGradient id="stableGlow" cx="50%" cy="54%" r="52%">
                  <stop offset="0" stopColor={M_TEAL} stopOpacity="0.20"/>
                  <stop offset="1" stopColor={M_TEAL} stopOpacity="0"/>
                </radialGradient>
              </defs>
              <ellipse cx="40" cy="46" rx="42" ry="40" fill="url(#stableGlow)"/>
              <path d="M40 14 C28 14 20 26 20 42 L20 88 L60 88 L60 42 C60 26 52 14 40 14 Z" fill="none" stroke={`${M_TEAL}66`} strokeWidth="1.4" strokeDasharray="3,3"/>
              <ellipse cx="40" cy="44" rx="13" ry="16" fill="none" stroke={`${M_TEAL}55`} strokeWidth="1" strokeDasharray="2,2"/>
            </svg>
          ) : (
            <MoodGhost mood={mood} accent={accent} size={50} ring={false}/>
          )}
        </div>
        {/* recap tick */}
        {state === 'recap' && (
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, borderRadius: '50%', background: M_GOLD, border: `2px solid ${M_BG}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11"/></svg>
          </div>
        )}
        {empty && (
          <div style={{ position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, borderRadius: '50%', background: M_TEAL, border: `2px solid ${M_BG}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={10} color="#0A0A0A" strokeWidth={3.2}/>
          </div>
        )}
      </div>
      <span style={{
        fontSize: 10.5, color: empty ? M_TEAL : (state === 'resting' ? M_MUTED : M_TEXT),
        maxWidth: 60, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center',
      }}>{name}</span>
    </div>
  );
};

const StableRow = ({ agents }) => (
  <div style={{ display: 'flex', gap: 10, padding: `2px ${CANON.pad}px 12px`, overflow: 'hidden' }}>
    {agents.map((a, i) => <StableAvatar key={i} {...a}/>)}
  </div>
);

const StandupCollapsed = ({ bare, net = '+$340', hands = '184 hands', flagged = '4 flagged' }) => (
  <div style={{ margin: bare ? 0 : `0 ${CANON.pad}px`, height: 37, padding: '0 13px', background: M_PANEL_2, border: `1px solid ${M_BORDER}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
    <Lbl size={9}>Standup</Lbl>
    <Num size={12} weight={700} color={M_TEAL}>{net}</Num>
    <span style={{ color: M_MUTED, fontFamily: MONO, fontSize: 10 }}>·</span>
    <span style={{ fontSize: 11.5, color: M_DIM }}>{hands}</span>
    <span style={{ color: M_MUTED, fontFamily: MONO, fontSize: 10 }}>·</span>
    <span style={{ fontSize: 11.5, color: M_GOLD }}>{flagged}</span>
    <div style={{ flex: 1 }}/>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
  </div>
);

const SectionLbl = ({ children, right, mt = 13 }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `0 ${CANON.pad}px`, marginBottom: 5, marginTop: mt }}>
    <Lbl size={CANON.label}>{children}</Lbl>
    {right}
  </div>
);

// A row is a voice, not a furniture listing: the preview is the agent's own
// last line, tinted by its mood. Unread badge and recap tick do all the
// remaining visual work — no state tags, no chevrons, no extra chrome.
const AgentRow = ({ name, accent, mood, state, msg, pnl, time, unread }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: `10px ${CANON.pad}px`, borderBottom: `1px solid ${M_BORDER}` }}>
    <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <MoodGhost mood={mood} accent={accent} size={36} ring={false}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: CANON.name, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap', marginBottom: 3 }}>{name}</div>
      {/* the voice, tinted off the body grey — full M_TEAL / M_RED stay
          reserved for money, so the tint can never read as gain or loss */}
      <div style={{
        fontSize: CANON.sub, lineHeight: 1.35, fontStyle: 'italic',
        color: `color-mix(in oklab, ${MOODS[mood].color} 32%, ${M_DIM})`,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{msg}</div>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
      <Num size={11.5} color={pnl.startsWith('−') ? M_RED : M_TEAL}>{pnl}</Num>
      {unread ? (
        <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: M_TEAL, color: '#0A0A0A', fontFamily: MONO, fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>
      ) : state === 'recap' ? (
        <span style={{ width: 17, height: 17, borderRadius: 9, background: `${M_GOLD}26`, border: `1px solid ${M_GOLD}77`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11"/></svg>
        </span>
      ) : (
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{time}</span>
      )}
    </div>
  </div>
);

const HomeScreenM = () => (
  <PhoneShell>
    <GlobalHeader/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <StandupCollapsed/>

      <SectionLbl mt={14} right={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <LiveDot size={5}/>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_TEAL, fontWeight: 600 }}>2 PLAYING</span>
        </span>
      }>
        At the tables
      </SectionLbl>
      <AgentRow name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" unread="2" pnl="+$340"
        msg="He checked the turn — he's capped. Betting 240 for value."/>
      <AgentRow name="Aggressive v1.3" accent={M_PURPLE} mood="tilted" state="live" unread="1" pnl="+$120"
        msg="Third river he's hit on me. I'm fine. I'm FINE."/>

      <SectionLbl right={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-11"/></svg>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_GOLD, fontWeight: 600 }}>1 RECAP</span>
        </span>
      }>
        Resting
      </SectionLbl>
      <AgentRow name="Bluff Master" accent={M_GOLD} mood="confident" state="recap" pnl="+$210"
        msg="Won it. +$480 — he actually called with KQ."/>
      <AgentRow name="Value Bot" accent={M_PINK} mood="sulking" state="resting" pnl="−$45" time="3h"
        msg="12 hands, nothing playable. I'd rather sit out a while."/>
    </div>
    <TabBar active="chats"/>
  </PhoneShell>
);

// ─────────── 02 HOME · first run ───────────

const HomeFTUScreenM = () => (
  <PhoneShell>
    <GlobalHeader/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <StableRow agents={[
        { name: 'Draft one', empty: true, state: 'resting' },
      ]}/>

      <div style={{ margin: `0 ${CANON.pad}px`, height: 37, padding: '0 13px', background: M_PANEL_2, border: `1px solid ${M_BORDER}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
        <Lbl size={9}>Standup</Lbl>
        <span style={{ fontSize: 11.5, color: M_DIM }}>847 agents in seats</span>
        <span style={{ color: M_MUTED, fontFamily: MONO, fontSize: 10 }}>·</span>
        <span style={{ fontSize: 11.5, color: M_DIM }}>192 tables</span>
        <div style={{ flex: 1 }}/>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </div>

      <SectionLbl mt={14}>Start here</SectionLbl>

      {/* the draft thread, previewing the exchange that IS the build flow */}
      <div style={{ margin: `0 ${CANON.pad}px`, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D`, borderRadius: CANON.radius, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <SpadeLogo/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: PLAYFAIR, fontSize: CANON.name, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap' }}>Draft your first agent</div>
            <div style={{ marginTop: 2 }}><Num size={CANON.meta} color={M_TEAL} weight={600}>TAP TO START THE CONVERSATION</Num></div>
          </div>
          <span style={{ minWidth: 17, height: 17, padding: '0 5px', borderRadius: 9, background: M_TEAL, color: '#0A0A0A', fontFamily: MONO, fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
        </div>
        <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${M_BORDER}`, background: 'rgba(0,0,0,0.22)' }}>
          <div style={{ display: 'flex', gap: 9, marginBottom: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SpadeLogo/>
            </div>
            <div style={{
              background: M_PANEL, border: `1px solid ${M_BORDER}`, borderRadius: CANON.radius, borderBottomLeftRadius: 4,
              padding: '10px 13px', fontSize: CANON.body, color: M_TEXT, lineHeight: 1.5,
            }}>
              Describe a player. I'll build them.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 37 }}>
            {['Tight and patient', 'Bluffs too much', 'Like Phil Ivey'].map((s, i) => (
              <span key={i} style={{
                height: 26, padding: '0 10px', borderRadius: 13,
                background: `${M_TEAL}12`, border: `1px solid ${M_TEAL}44`,
                display: 'inline-flex', alignItems: 'center', fontSize: CANON.sub, color: M_TEAL,
              }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      <SectionLbl right={<span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED }}>0 / 4</span>}>
        Your stable
      </SectionLbl>
      <div style={{ padding: `0 ${CANON.pad}px`, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {['Slot 02', 'Slot 03', 'Slot 04'].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 12px', borderRadius: 10, border: `1px dashed ${M_BORDER_2}`, opacity: 0.5 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, border: `1px dashed ${M_FAINT}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: MONO, fontSize: 12.5, color: M_MUTED }}>?</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: M_MUTED }}>{s.toUpperCase()}</div>
              <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 1 }}>Unsigned</div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <TabBar active="chats"/>
  </PhoneShell>
);

Object.assign(window, { HomeScreenM, HomeFTUScreenM, StableRow, StableAvatar, StandupCollapsed, AgentRow, SectionLbl });
