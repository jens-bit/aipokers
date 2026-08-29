// 07 TEAM — the glance overview · 07b AGENT PROFILE

const FormDots = ({ form }) => (
  <div style={{ display: 'flex', gap: 3 }}>
    {form.map((r, i) => (
      <span key={i} style={{
        width: 14, height: 14, borderRadius: 3,
        background: r === 'W' ? `${M_TEAL}26` : 'rgba(255,77,79,0.15)',
        border: `1px solid ${r === 'W' ? `${M_TEAL}66` : `${M_RED}66`}`,
        color: r === 'W' ? M_TEAL : M_RED,
        fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{r}</span>
    ))}
  </div>
);

// mood summary — the stable's emotional weather in one row
const MoodSummary = ({ counts }) => (
  <div style={{ margin: '0 14px 13px', padding: '10px 12px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {counts.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{ width: 1, height: 22, background: M_BORDER }}/>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
            <MoodGhost mood={c.mood} accent={c.accent} size={26} ring={false}/>
            <div style={{ minWidth: 0 }}>
              <Num size={14} weight={700} color={MOODS[c.mood].color}>{c.n}</Num>
              <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED, textTransform: 'uppercase', marginTop: 1 }}>{MOODS[c.mood].label}</div>
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  </div>
);

const TeamCard = ({ name, accent, mood, state, form, hands, win, status, tapsTo }) => (
  <div style={{ background: M_PANEL_2, border: `1px solid ${state === 'live' ? `${M_TEAL}33` : M_BORDER}`, borderRadius: 12, padding: '9px 12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <MoodAvatar mood={mood} accent={accent} size={42} pip={15}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap', flexShrink: 0 }}>{name}</span>
          <StateTag state={state} compact/>
        </div>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{status}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <Num size={8.5} color={state === 'live' ? M_TEAL : M_MUTED} weight={600}>{tapsTo}</Num>
        <Icon name="chevron-right" size={16} color={M_MUTED}/>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 7, borderTop: `1px solid ${M_BORDER}` }}>
      <FormDots form={form}/>
      <div style={{ width: 1, height: 14, background: M_BORDER }}/>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <Num size={12} weight={700}>{hands}</Num>
        <span style={{ fontSize: 10.5, color: M_MUTED }}>hands</span>
      </div>
      <div style={{ width: 1, height: 14, background: M_BORDER }}/>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <Num size={12} weight={700} color={parseFloat(win) >= 50 ? M_TEAL : M_RED}>{win}</Num>
        <span style={{ fontSize: 10.5, color: M_MUTED }}>win</span>
      </div>
    </div>
  </div>
);

const HumanAvatarM = ({ size = 40 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: '#141414', border: '1px solid rgba(0,212,170,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }}>
    <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 60 60">
      <circle cx="30" cy="22" r="9" fill="#3a3a3a" stroke="#5a5a5a" strokeWidth="0.6"/>
      <path d="M14 50 C14 38, 22 34, 30 34 C38 34, 46 38, 46 50 Z" fill="#3a3a3a" stroke="#5a5a5a" strokeWidth="0.6"/>
    </svg>
  </div>
);

const SitDownCard = () => (
  <div style={{
    margin: '0 14px',
    background: 'linear-gradient(180deg, rgba(20,20,20,0.9) 0%, rgba(14,14,14,0.9) 100%)',
    border: `1px solid ${M_BORDER}`, borderRadius: 14, padding: '11px 12px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9 }}>
      <HumanAvatarM size={40}/>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 17, fontWeight: 600, color: M_TEXT, letterSpacing: '-0.01em', lineHeight: 1.05, marginBottom: 2 }}>Sit down yourself</div>
        <div style={{ fontSize: 11.5, color: M_DIM }}>Play a hand without an agent</div>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      <button style={{
        flex: 1, height: 37, padding: '0 10px', borderRadius: 10,
        background: 'transparent', border: `1px solid ${M_BORDER_2}`, color: M_TEXT,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        cursor: 'pointer', fontFamily: INTER,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Icon name="agent" size={15} color={M_TEAL} strokeWidth={1.7}/>
          <span style={{ fontSize: 12.5, fontWeight: 500 }}>vs AI</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
      <button style={{
        flex: 1.4, height: 37, padding: '0 10px', borderRadius: 10,
        background: 'transparent', border: `1px solid ${M_BORDER_2}`, color: M_TEXT,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
        cursor: 'pointer', fontFamily: INTER, minWidth: 0,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <Icon name="profile" size={15} color={M_TEAL} strokeWidth={1.7}/>
          <span style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Private <span style={{ color: M_TEAL }}>·</span> <span style={{ color: M_DIM }}>share link</span>
          </span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
      </button>
    </div>
    <div style={{ textAlign: 'center', fontSize: 10.5, color: M_MUTED, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
      Free play
      <span style={{ width: 3, height: 3, borderRadius: '50%', background: M_MUTED }}/>
      TON stakes coming soon
    </div>
  </div>
);

const TeamScreenM = () => (
  <PhoneShell>
    <GlobalHeader/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ padding: '0 14px 7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl size={9.5}>The stable · 4</Lbl>
        <span style={{ fontSize: 11, color: M_MUTED }}>2 confident · 1 tilted · 1 sulking</span>
      </div>
      <MoodSummary counts={[
        { mood: 'confident', accent: M_TEAL, n: 2 },
        { mood: 'tilted', accent: M_PURPLE, n: 1 },
        { mood: 'sulking', accent: M_PINK, n: 1 },
      ]}/>

      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <TeamCard name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" tapsTo="TABLE →"
          form={['W','W','L','W','W']} hands="1,247" win="61.8%"
          status="At #48291 · up $340 this session"/>
        <TeamCard name="Aggressive v1.3" accent={M_PURPLE} mood="tilted" state="live" tapsTo="TABLE →"
          form={['W','L','W','W','L']} hands="892" win="54.2%"
          status="Heads-up vs Phil_AI · steaming"/>
        <TeamCard name="Bluff Master" accent={M_GOLD} mood="confident" state="recap" tapsTo="PROFILE →"
          form={['W','W','W','L','W']} hands="1,043" win="52.4%"
          status="Recap ready · promoted to Tier 2"/>
        <TeamCard name="Value Bot" accent={M_PINK} mood="sulking" state="resting" tapsTo="PROFILE →"
          form={['L','L','W','L','L']} hands="743" win="46.7%"
          status="Sat out at 02:14 · card dead"/>
      </div>

      <div style={{ padding: '12px 14px 7px' }}><Lbl size={9.5}>Or play it yourself</Lbl></div>
      <SitDownCard/>
    </div>
    <TabBar active="team"/>
  </PhoneShell>
);

// ─────────── 07b AGENT PROFILE ───────────

// compact timeline: last 10 sessions — mood arc plus result per session
const MoodTimeline = ({ sessions }) => {
  const w = 330, h = 62, pad = 8;
  const rank = { confident: 0, neutral: 1, frustrated: 2, tilted: 3, sulking: 4 };
  const step = (w - pad * 2) / (sessions.length - 1);
  const pts = sessions.map((s, i) => [pad + i * step, pad + (rank[s.mood] / 4) * (h - pad * 2)]);
  return (
    <div>
      <svg width={w} height={h} style={{ display: 'block' }}>
        {[0, 1, 2, 3, 4].map(r => (
          <line key={r} x1={pad} x2={w - pad} y1={pad + (r / 4) * (h - pad * 2)} y2={pad + (r / 4) * (h - pad * 2)}
            stroke={M_BORDER} strokeWidth="1" strokeDasharray="2,4"/>
        ))}
        <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={M_BORDER_2} strokeWidth="1.4"/>
        {pts.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={MOODS[sessions[i].mood].color}/>
        ))}
      </svg>
      <div style={{ display: 'flex', marginTop: 5 }}>
        {sessions.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <Num size={8.5} weight={600} color={s.result.startsWith('−') ? M_RED : M_TEAL}>{s.result}</Num>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
        <Num size={9} color={M_MUTED} weight={500}>10 SESSIONS AGO</Num>
        <Num size={9} color={M_MUTED} weight={500}>NOW</Num>
      </div>
    </div>
  );
};

const ActivityRow = ({ icon, color, label, meta, amount, last }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: last ? 'none' : `1px solid ${M_BORDER}` }}>
    <div style={{ width: 22, height: 22, borderRadius: 7, background: `${color}1A`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name={icon} size={11} color={color}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ marginTop: 1 }}><Num size={9} color={M_MUTED} weight={500}>{meta}</Num></div>
    </div>
    {amount && <Num size={11.5} weight={700} color={amount.startsWith('−') ? M_RED : M_TEAL}>{amount}</Num>}
  </div>
);

const AgentProfileScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Aggressive v1.3"/>
    <MoodBand accent={M_PURPLE} mood="tilted" state="live" action="Watch"
      cause="steaming — lost two big pots as favourite"/>

    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* career */}
      <div style={{ padding: '11px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl size={9.5}>Career</Lbl>
        <Num size={9.5} color={M_MUTED} weight={500}>TIER 2 · BUILT MAR 14</Num>
      </div>
      <div style={{ margin: '0 14px 12px', borderRadius: 12, overflow: 'hidden', border: `1px solid ${M_BORDER}`, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: M_BORDER }}>
        {[
          { l: 'Hands', v: '892' },
          { l: 'Win rate', v: '54.2%', c: M_TEAL },
          { l: 'BB/100', v: '+6.4', c: M_TEAL },
          { l: 'Sessions', v: '31' },
          { l: 'Biggest pot', v: '$847', c: M_GOLD },
          { l: 'Net', v: '+$1,204', c: M_TEAL },
        ].map((s, i) => (
          <div key={i} style={{ background: M_PANEL, padding: '8px 11px' }}>
            <Lbl size={8.5}>{s.l}</Lbl>
            <div style={{ marginTop: 2 }}><Num size={14} weight={700} color={s.c || M_TEXT}>{s.v}</Num></div>
          </div>
        ))}
      </div>

      {/* mood timeline */}
      <div style={{ padding: '0 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl size={9.5}>Mood · last 10 sessions</Lbl>
        <span style={{ fontSize: 11, color: M_MUTED }}>tilts fast, recovers slow</span>
      </div>
      <div style={{ margin: '0 14px 12px', padding: '10px 12px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <MoodTimeline sessions={[
          { mood: 'neutral', result: '+40' },
          { mood: 'confident', result: '+210' },
          { mood: 'confident', result: '+180' },
          { mood: 'frustrated', result: '−60' },
          { mood: 'tilted', result: '−340' },
          { mood: 'frustrated', result: '+90' },
          { mood: 'neutral', result: '+20' },
          { mood: 'confident', result: '+480' },
          { mood: 'tilted', result: '−220' },
          { mood: 'tilted', result: '+120' },
        ]}/>
      </div>

      {/* activity */}
      <div style={{ padding: '0 14px 4px' }}><Lbl size={9.5}>Recent activity</Lbl></div>
      <div style={{ margin: '0 14px 12px', padding: '2px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <ActivityRow icon="trophy" color={M_TEAL} label="Won a 4-bet pot vs KQs" meta="HAND #846 · 09:38" amount="+$480"/>
        <ActivityRow icon="risk" color={M_RED} label="Flagged its own river jam" meta="HAND #841 · 09:12" amount="−$340"/>
        <ActivityRow icon="edit" color={M_GOLD} label="Strategy change accepted" meta="V1.3 → V1.4 · 09:15"/>
        <ActivityRow icon="sparkle" color={M_GOLD} label="Promoted to Tier 2" meta="1,000 HANDS · MAY 4" last/>
      </div>

      {/* edit strategy entry */}
      <div style={{ margin: '0 14px', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D` }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="edit" size={14} color={M_TEAL}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: M_TEXT }}>Edit strategy</div>
          <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 1 }}>Aggression, bluff frequency, ranges</div>
        </div>
        <Icon name="chevron-right" size={16} color={M_MUTED}/>
      </div>
    </div>
  </PhoneShell>
);

Object.assign(window, { TeamScreenM, AgentProfileScreenM, FormDots, MoodSummary, HumanAvatarM });
