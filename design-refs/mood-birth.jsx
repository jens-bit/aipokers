// THE BIRTH WAVE — the create flow in the system's language.
// The conversation is the creation. Nothing here is a new pattern: the header, band,
// bubbles, composer, diff card, floor and ghost atoms are all reused. What is new is
// one thing only — a ghost that does not exist yet, and gains definition as you talk.

// ── THE FORMING GHOST ──
// MoodGhost's exact silhouette path and eye geometry, drawn at a definition level.
// phase 0 = dashed outline, no fill, no eyes.  phase 1 = a finished neutral ghost.
const FormingGhost = ({ size = 40, phase = 0.5, accent = M_TEAL, drift = true }) => {
  const uid = React.useId().replace(/:/g, '');
  const fill = 0.10 + phase * 0.30;          // soft fill arrives with definition
  const stroke = 0.30 + phase * 0.55;
  const dash = phase >= 0.98 ? 'none' : `${1.5 + phase * 4} ${4 - phase * 2.6}`;
  const eyes = Math.max(0, (phase - 0.42) / 0.58);
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 80 96" style={{ display: 'block', animation: drift ? 'drift 4.6s ease-in-out infinite' : 'none' }}>
      <defs>
        <linearGradient id={`fg${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity={fill}/>
          <stop offset="1" stopColor={accent} stopOpacity={fill * 0.15}/>
        </linearGradient>
      </defs>
      {phase > 0.5 && (
        <ellipse cx="40" cy="52" rx={30 * phase} ry={34 * phase}
          fill={accent} opacity={(phase - 0.5) * 0.10}/>
      )}
      <path d="M40 8 C24 8 15 22 15 42 L15 74 Q15 82 22 82 Q28 82 30 76 Q32 82 40 82 Q48 82 50 76 Q52 82 58 82 Q65 82 65 74 L65 42 C65 22 56 8 40 8 Z"
        fill={`url(#fg${uid})`} stroke={accent} strokeOpacity={stroke}
        strokeWidth={1.1} strokeDasharray={dash} strokeLinejoin="round"/>
      {eyes > 0 && (
        <g opacity={eyes}>
          <ellipse cx="31" cy="44" rx="3.4" ry={2.2 + eyes * 0.6} fill={accent}
            style={{ filter: `drop-shadow(0 0 ${3 + eyes * 4}px ${accent})` }}/>
          <ellipse cx="49" cy="44" rx="3.4" ry={2.2 + eyes * 0.6} fill={accent}
            style={{ filter: `drop-shadow(0 0 ${3 + eyes * 4}px ${accent})` }}/>
        </g>
      )}
    </svg>
  );
};

// ── DRAFT BAND ──
// MoodBand's anatomy exactly — 42px avatar well, chip row, cause line, action button —
// but the well holds a forming ghost and the chip slot says what is missing, not a mood.
const DraftBand = ({ phase = 0, cause, action, ready }) => (
  <div style={{
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
    padding: '9px 14px 11px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL,
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
      background: '#0A0F17',
      border: phase >= 0.98 ? `1px solid ${M_TEAL}55` : `1px dashed ${M_DIM}55`,
      boxShadow: phase > 0.4 ? `0 0 14px ${M_TEAL}${phase > 0.8 ? '33' : '1A'}` : 'none',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
    }}>
      <FormingGhost size={40} phase={phase}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, height: 16, padding: '0 6px',
          borderRadius: 3, background: 'rgba(255,255,255,0.04)', border: `1px dashed ${M_DIM}55`,
        }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em', color: M_DIM }}>
            {ready ? 'READY' : 'NO MOOD YET'}
          </span>
        </span>
        <StateTag state="drafting" compact/>
      </div>
      <div style={{ fontSize: 11.5, color: M_DIM, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cause}</div>
    </div>
    {action && <Btn kind={ready ? 'primary' : 'outline'} h={30}>{action}</Btn>}
  </div>
);

// ── THE EMERGING PROFILE ──
// The same Lbl / Num / bar vocabulary as the analysis panels. Unset traits are dashes,
// never zeros — an unanswered question is not an answer of nothing.
const TraitBar = ({ k, v, accent = M_TEAL }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
    <span style={{ width: 62, fontSize: 10.5, color: M_MUTED }}>{k}</span>
    <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      {v != null && <div style={{ height: '100%', width: `${v}%`, background: accent, boxShadow: `0 0 6px ${accent}77` }}/>}
    </div>
    <span style={{ minWidth: 26, textAlign: 'right' }}>
      {v == null ? <span style={{ fontFamily: MONO, fontSize: 10.5, color: M_FAINT }}>—</span>
                 : <Num size={10.5} color={M_TEXT}>{v}</Num>}
    </span>
  </div>
);

// The mobile form of the profile: one row, four stats, no chrome. Desktop's panel gets
// the tall version — this is the same data at chat density.
const DraftStrip = ({ style, risk, tight, aggr }) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    background: M_PANEL_2, border: `1px dashed ${M_DIM}44`, borderRadius: 8,
    padding: '7px 11px', gap: 0,
  }}>
    {[['STYLE', style], ['RISK', risk], ['TIGHT', tight], ['AGGR', aggr]].map(([k, v], i) => (
      <React.Fragment key={k}>
        {i > 0 && <div style={{ width: 1, height: 16, background: M_BORDER, margin: '0 10px' }}/>}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 500, letterSpacing: '0.14em', color: M_MUTED }}>{k}</span>
          {v == null
            ? <span style={{ fontFamily: MONO, fontSize: 12, color: M_FAINT }}>—</span>
            : <Num size={12} weight={700} color={M_TEXT}>{v}</Num>}
        </div>
      </React.Fragment>
    ))}
  </div>
);

const DraftProfile = ({ phase, style, risk, tight, aggr, name }) => (
  <div style={{
    background: M_PANEL_2, border: `1px dashed ${M_DIM}44`, borderRadius: CANON.radius,
    overflow: 'hidden', position: 'relative',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px',
      borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.02)',
    }}>
      <Lbl size={CANON.label}>Taking shape</Lbl>
      <div style={{ flex: 1 }}/>
      <Num size={9} color={M_MUTED} weight={500}>{Math.round(phase * 100)}% DEFINED</Num>
    </div>
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '8px 12px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
          <span style={{ fontFamily: ROZHA, fontSize: 15, color: name ? M_TEXT : M_FAINT }}>
            {name || 'unnamed'}
          </span>
        </div>
        <TraitBar k="Style" v={style}/>
        <TraitBar k="Risk" v={risk}/>
        <TraitBar k="Tightness" v={tight}/>
        <TraitBar k="Aggression" v={aggr}/>
      </div>
      {/* the draft itself, on the right, gaining definition as the strategy does */}
      <div style={{
        width: 96, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: `radial-gradient(ellipse at 50% 80%, ${M_TEAL}${phase > 0.5 ? '14' : '08'}, transparent 70%)`,
        paddingBottom: 6,
      }}>
        <FormingGhost size={62} phase={phase}/>
      </div>
    </div>
  </div>
);

// ── OWNER-INITIATED DIFF ──
// ProposalCard's anatomy, verbatim, with only its origin and verbs changed. One pattern:
// the agent proposing a change and the owner requesting one produce the same card.
const DiffCard = ({ accent, origin, quote, from, to, rows, est, primary = 'Save', secondary = 'Keep talking' }) => (
  <div style={{ background: M_PANEL_2, border: `1px solid ${M_GOLD}44`, borderRadius: CANON.radius, borderBottomLeftRadius: 4, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(205,179,128,0.06)' }}>
      <Icon name="edit" size={12} color={M_GOLD}/>
      <Lbl size={CANON.label} color={M_GOLD}>{origin}</Lbl>
      <div style={{ flex: 1 }}/>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <Num size={9} color={M_MUTED} weight={500}>{from}</Num>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={M_FAINT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <Num size={9} color={M_GOLD} weight={700}>{to}</Num>
      </span>
    </div>
    {quote && (
      <div style={{ padding: '9px 12px 2px', fontSize: 12.5, color: M_TEXT, lineHeight: 1.45 }}>{quote}</div>
    )}
    <div style={{ padding: '7px 12px 9px' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', borderTop: i > 0 ? `1px solid ${M_BORDER}` : 'none' }}>
          <span style={{ flex: 1, fontSize: CANON.sub, color: M_DIM }}>{r.k}</span>
          <Num size={11} color={M_MUTED}>{r.from}</Num>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={M_FAINT} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <span style={{ minWidth: 44, textAlign: 'right' }}><Num size={CANON.sub} weight={700} color={accent}>{r.to}</Num></span>
        </div>
      ))}
    </div>
    <div style={{ padding: '8px 12px', borderTop: `1px solid ${M_BORDER}`, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
      <Num size={CANON.meta} color={M_MUTED} weight={500}>{est}</Num>
      <div style={{ flex: 1 }}/>
      <Btn kind="ghost" h={28}>{secondary}</Btn>
      <Btn kind="primary" h={28}>{primary}</Btn>
    </div>
  </div>
);

// ── the draft screen shell — ThreadScreen's structure with a draft band ──
const DraftScreen = ({ title, band, children, placeholder, chips, suggest, suggestLead }) => (
  <PhoneShell>
    <GlobalHeader back title={title}/>
    {band}
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10, position: 'relative' }}>
      {children}
    </div>
    <ChatComposer placeholder={placeholder} chips={chips} suggest={suggest} suggestLead={suggestLead}/>
  </PhoneShell>
);

// ═══ 1 · ENTRY — the conversation opens; no ghost exists yet ═══
const BirthEntryScreenM = () => (
  <DraftScreen title="New agent"
    band={<DraftBand phase={0} cause="nothing decided yet" action="Skip"/>}
    placeholder="Describe how it should play…"
    suggest={['Tight and patient', 'Aggressive bluffer', 'Solver-strict']}>
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* the empty seat, drawn — not a placeholder card, and not decorated */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
        <FormingGhost size={132} phase={0}/>
      </div>
      <div style={{ flexShrink: 0 }}>
        <SysLine>Drafting · 09:41</SysLine>
        <AgentBubble mood="neutral" accent={M_TEAL} time="09:41">
          <>
            One open seat. Tell me how it should play — style, risk, how tight, how aggressive.
            <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>
              Plain words work. &ldquo;Patient, hates bluffing, folds when it smells wrong.&rdquo;
            </div>
          </>
        </AgentBubble>
      </div>
    </div>
  </DraftScreen>
);

// ═══ 2 · MID-DRAFT — two exchanges in; the draft is 62% defined ═══
const BirthDraftScreenM = () => (
  <DraftScreen title="New agent"
    band={<DraftBand phase={0.62} cause="patient · low variance · unnamed" action="Skip"/>}
    placeholder="Anything else?"
    suggestLead="62% DEFINED"
    suggest={['Heads-up only', 'Everywhere in position']}>
    {/* the draft as a watermark behind the conversation — it is in the room now */}
    <div style={{ position: 'absolute', right: -14, top: 26, opacity: 0.13, pointerEvents: 'none', zIndex: 0 }}>
      <FormingGhost size={168} phase={0.62}/>
    </div>
    <div style={{ position: 'relative', zIndex: 1 }}>
      <OwnerBubble time="09:42">Patient. I don't want it bluffing into three people.</OwnerBubble>
      <AgentBubble mood="neutral" accent={M_TEAL} time="09:42">
      <>
          Tight preflop, no multiway bluffs. That's a grinder — low variance, slow money.
        </>
    </AgentBubble>
      <OwnerBubble time="09:43">Right. But punish weakness heads-up.</OwnerBubble>
      <div style={{ padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
        <DraftStrip style={38} risk={26} tight={74} aggr={null}/>
      </div>
      <AgentBubble mood="neutral" accent={M_TEAL} time="09:43">
      <>
          Aggression is the last thing open. Heads-up, or everywhere in position?
        </>
    </AgentBubble>
      <OwnerBubble time="09:43">Heads-up. Keep it quiet in multiway.</OwnerBubble>
    </div>
  </DraftScreen>
);

// ═══ 3 · THE BIRTH — back on the floor; he materializes at the bar ═══
// The floor is the confirmation. There is no "agent created" card anywhere.
const MaterializingOccupant = ({ x, y, name, phase = 0.72 }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* his first words — arrives before the name chip does */}
      <div style={{
        maxWidth: 168, marginBottom: 2,
        background: 'rgba(17,23,32,0.92)', border: `1px solid ${M_TEAL}55`,
        borderRadius: 10, borderBottomLeftRadius: 3, padding: '7px 10px',
        boxShadow: `0 0 18px ${M_TEAL}22`,
        animation: 'rise 0.5s ease-out both',
      }}>
        <div style={{ fontSize: 12, color: M_TEXT, lineHeight: 1.4 }}>Deal me in whenever you're ready.</div>
      </div>
      <div style={{ position: 'relative' }}>
        {/* the light finding him */}
        <div style={{
          position: 'absolute', left: '50%', top: '48%', width: 64, height: 64,
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          background: `radial-gradient(circle, ${M_TEAL}26, transparent 72%)`,
          animation: 'fadein 0.8s ease-out both',
        }}/>
        <FormingGhost size={54} phase={phase}/>
      </div>
      {/* the name chip lands last, and is still arriving */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 17, padding: '0 7px', borderRadius: 4,
        background: 'rgba(19,19,22,0.7)', border: `1px dashed ${M_TEAL}66`,
        opacity: 0.6, animation: 'fadein 1.9s ease-out both',
      }}>
        <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', border: `1px dashed ${M_TEAL}` }}/>
        <span style={{ fontSize: 10, color: M_TEXT, fontWeight: 500 }}>{name}</span>
      </div>
    </div>
  </div>
);

const BirthFloorScreenM = () => {
  const L = LAYOUTS.one;
  const f = L.felts[0];
  const gh = (56 * 1.2) + 19 + 3;
  return (
    <PhoneShell>
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
        @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <GlobalHeader/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <RoomLayer layout="one"/>
        <FloorStandup net="+$340" flagged="4 flagged"/>
        <Diorama f={f} hole={[['A','s'],['K','h']]}/>
        <Occupant x={f.cx} y={f.cy - gh + 8} name="Balanced v2.1"
          accent={M_TEAL} mood="confident" state="live" size={56} speed={5}/>
        <PotTicker x={f.cx} y={f.cy - gh + 8 - 27} amount="480"/>
        <MaterializingOccupant x={92} y={L.bar.y - 132} name="Grinder v1.0" phase={0.72}/>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// ═══ 4 · REBUILD — the same anatomy, opened from an existing agent's thread ═══
const BirthEditScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Aggressive v1.3"/>
    <MoodBand accent={M_PURPLE} mood="frustrated" state="resting" action="Deploy"
      cause="that's twice he's rivered me"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10 }}>
      <SysLine>Rebuilding · 09:44</SysLine>
      <OwnerBubble time="09:44">Tell me what to change.</OwnerBubble>
      <AgentBubble mood="frustrated" accent={M_PURPLE} time="09:44" expressive>
        Rivers keep getting called. Let me pull back.
      </AgentBubble>
      <AgentCardMsg mood="frustrated" accent={M_PURPLE} time="09:45">
        <DiffCard accent={M_PURPLE} origin="You asked for a rebuild"
          from="v1.3" to="v1.4"
          quote="Tighter preflop, and I stop firing rivers into calling ranges."
          rows={[
            { k: 'Open range', from: '32%', to: '24%' },
            { k: 'River bluff', from: '28%', to: '11%' },
            { k: 'Tilt resistance', from: '41', to: '58' },
          ]}
          est="EST. +2.1 BB/100" primary="Save v1.4" secondary="Keep talking"/>
      </AgentCardMsg>
    </div>
    <ChatComposer placeholder="Message Aggressive v1.3…"
      suggest={['Also loosen the button', 'Cap the stakes']}/>
  </PhoneShell>
);

Object.assign(window, {
  FormingGhost, DraftBand, DraftProfile, DraftStrip, TraitBar, DiffCard, DraftScreen,
  MaterializingOccupant,
  BirthEntryScreenM, BirthDraftScreenM, BirthFloorScreenM, BirthEditScreenM,
});
