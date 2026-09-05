// CHARACTER SYSTEM · WAVE 1 — PROFILE v2, the player card.
// Anatomy: MoodBand (unchanged) → identity + nature → the six-bar cluster → fatigue
// in words → career and mood arc, demoted. Everything below the cluster is history;
// everything in it is the creature.
//
// CLUSTER, NOT RADAR — the decision, recorded. A hexagon needs ~200px of the 362px
// content width to label six axes without collisions, and it cannot show a RANGE:
// the scouted potential band would have to become a second overlapping polygon,
// which is illegible at any phone size. The row cluster shows current + band + tick
// natively at 20px pitch, keeps the canon order so an agent's silhouette is
// recognisable across surfaces, and degrades to the same rows in a 300px rail.
// Read as a shape, not a table: no row rules, no per-row fill, one number column.

const PROFILE_CAST = {
  day1: {
    name: 'Grinder v1.0', accent: M_TEAL, mood: 'neutral', state: 'resting',
    cause: 'built four minutes ago — no hands yet',
    nature: { n: 'Rock', up: 'DISCIPLINE', dn: 'READS' },
    natureLine: 'A Rock decides what he folds before you act, and then he folds it.',
    born: 'BORN TODAY · 0 HANDS',
    fatigue: null,
    attrs: [
      { k: 'READS', cur: 46, lo: 52, hi: 76 },
      { k: 'FOCUS', cur: 54, lo: 60, hi: 90 },
      { k: 'DISCIPLINE', cur: 80, lo: 82, hi: 96 },
      { k: 'COMPOSURE', cur: 48, lo: 55, hi: 74 },
      { k: 'DECEPTION', cur: 52, lo: 58, hi: 88 },
      { k: 'STAMINA', cur: 61, lo: 66, hi: 79 },
    ],
    career: [['Hands', '0'], ['Sessions', '0'], ['Net', '—'], ['BB/100', '—']],
  },
  vet: {
    name: 'Aggressive v1.3', accent: M_PURPLE, mood: 'frustrated', state: 'live',
    cause: 'two rivers called back — 140 hands in',
    nature: { n: 'Shark', up: 'READS', dn: 'COMPOSURE' },
    natureLine: 'Two thousand hands have not changed him: he sees it first, and he takes it badly.',
    born: 'TIER 2 · BUILT MAR 14',
    fatigue: { stage: 'worn', line: 'worn — 140 hands, Focus dipping' },
    attrs: [
      { k: 'READS', cur: 82, lo: 80, hi: 84, ceiling: true },
      { k: 'FOCUS', cur: 62, lo: 70, hi: 75, fatigued: true },
      { k: 'DISCIPLINE', cur: 69, lo: 72, hi: 77, fatigued: true },
      { k: 'COMPOSURE', cur: 44, lo: 46, hi: 52 },
      { k: 'DECEPTION', cur: 74, lo: 74, hi: 78, ceiling: true, narrowed: true },
      { k: 'STAMINA', cur: 63, lo: 64, hi: 70 },
    ],
    career: [['Hands', '2,041'], ['Win rate', '54.2%'], ['Net', '+$1,204'], ['BB/100', '+6.4']],
  },
};

const GROWTH_LOG = {
  FOCUS: [
    { when: 'a', f: 61, t: 62, short: 'priced a turn call at 2.4 to 1, exactly right' },
    { when: 'b', f: 60, t: 61, short: '340 decisions in one sitting' },
    { when: 'c', f: 59, t: 60, short: 'caught his own equity error on the river' },
  ],
};

// ── the cluster ───────────────────────────────────────────────────────────────
const AttrCluster = ({ attrs, w = 334, expand, showBands = true }) => {
  const meta = k => ATTRS.find(a => a.k === k);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: w }}>
      {attrs.map(a => (
        <React.Fragment key={a.k}>
          <AttrBar row w="100%" name={a.k} cur={a.cur} lo={showBands ? a.lo : null} hi={a.hi}
            narrowed={a.narrowed} fatigued={a.fatigued} on={expand === a.k}/>
          {expand === a.k && <AttrFocusPanel attr={meta(a.k)} live={a}/>}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── the tapped bar, expanded ──────────────────────────────────────────────────
// SHOW, DON'T TELL. The three ticks were three sentences; they are now three dots
// on a line that rises toward a gold ceiling zone. One glance answers the two
// questions worth asking — is he still climbing, and how much is left — and the
// only text left is a value, a delta, and a five-word caption. His voice moved out
// entirely: the thread is the text-heavy surface, and the card is not.
const SPARK = {
  READS:      [74, 76, 77, 78, 79, 80, 81, 82, 82],
  FOCUS:      [54, 56, 57, 57, 58, 59, 60, 61, 62],
  DISCIPLINE: [64, 65, 66, 67, 67, 68, 68, 69, 69],
  COMPOSURE:  [41, 41, 42, 42, 43, 43, 43, 44, 44],
  DECEPTION:  [66, 68, 69, 70, 71, 72, 73, 74, 74],
  STAMINA:    [58, 59, 60, 61, 61, 62, 62, 63, 63],
};

const AttrSpark = ({ series, lo, hi, w = 300, h = 58 }) => {
  const min = Math.min(...series, lo) - 3, max = Math.max(...series, hi) + 3;
  const yy = v => h - ((v - min) / (max - min)) * h;
  const xx = i => 4 + (i / (series.length - 1)) * (w - 8);
  const pts = series.map((v, i) => [xx(i), yy(v)]);
  const last = pts[pts.length - 1];
  const ticks = [];
  for (let i = 1; i < series.length; i++) if (series[i] > series[i - 1]) ticks.push(i);
  const recent = ticks.slice(-3);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <rect x="0" y={yy(hi)} width={w} height={Math.max(3, yy(lo) - yy(hi))} fill={`${M_GOLD}1A`}/>
      <line x1="0" y1={yy(hi)} x2={w} y2={yy(hi)} stroke={`${M_GOLD}99`} strokeWidth="1"/>
      <line x1="0" y1={yy(lo)} x2={w} y2={yy(lo)} stroke={`${M_GOLD}55`} strokeWidth="1" strokeDasharray="3 3"/>
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={M_TEAL} strokeWidth="1.8" strokeLinejoin="round"/>
      {recent.map(i => <circle key={i} cx={pts[i][0]} cy={pts[i][1]} r="2.8" fill={M_BG} stroke={M_TEAL} strokeWidth="1.4"/>)}
      <circle cx={last[0]} cy={last[1]} r="3.4" fill="#EDEDED"/>
    </svg>
  );
};

const AttrFocusPanel = ({ attr, live, log }) => {
  const series = SPARK[attr.k] || [live.cur - 4, live.cur - 3, live.cur - 2, live.cur - 1, live.cur];
  const gain = series[series.length - 1] - series[0];
  return (
    <div style={{ borderRadius: 10, background: M_PANEL, border: `1px solid ${M_TEAL}44`, padding: '11px 13px 12px', marginTop: 1 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: M_TEAL, flex: 1 }}>{attr.k}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_TEAL }}>+{gain}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED }}>90D</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, marginTop: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}><AttrSpark series={series} lo={live.lo} hi={live.hi}/></div>
        <div style={{ flexShrink: 0, textAlign: 'right', paddingBottom: 2 }}>
          <div><Num size={19} weight={700} color={live.fatigued ? M_GOLD : M_TEXT}>{live.cur}</Num></div>
          <div style={{ marginTop: 1 }}><Num size={9.5} color={M_GOLD} weight={600}>{live.lo}&ndash;{live.hi}</Num></div>
        </div>
      </div>
      <div style={{ marginTop: 9, paddingTop: 8, borderTop: `1px solid ${M_BORDER}` }}>
        <Num size={9} color={M_MUTED} weight={500}>{attr.meanShort.toUpperCase()} &middot; FROM {attr.trainsShort.toUpperCase()}</Num>
      </div>
    </div>
  );
};

// ── fatigue, in words ─────────────────────────────────────────────────────────
const FatigueLine = ({ stage, line, compact }) => {
  const f = FATIGUE.find(x => x.key === stage) || FATIGUE[0];
  const blocks = (
    <div style={{ display: 'flex', gap: 3, width: 44, flexShrink: 0 }}>
      {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 5, borderRadius: 2.5, background: i < f.blocks ? f.color : M_SURF, boxShadow: i < f.blocks ? `0 0 6px ${f.color}44` : 'none' }}/>)}
    </div>
  );
  if (compact) return (
    <div>
      {blocks}
      <div style={{ fontSize: 11.5, color: f.color === M_GOLD ? M_GOLD : M_DIM, lineHeight: 1.4, marginTop: 7 }}>{line || f.line}</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      {blocks}
      <span style={{ flex: 1, fontSize: 12, color: f.color === M_GOLD ? M_GOLD : M_DIM, lineHeight: 1.4 }}>{line || f.line}</span>
    </div>
  );
};

// Local copy of the mood arc from mood-screens-e (not exported there); narrower and
// shorter, because on this card it is history rather than the argument.
const PMoodArc = ({ sessions, w = 334, h = 46 }) => {
  const pad = 7;
  const rank = { confident: 0, neutral: 1, frustrated: 2, tilted: 3, sulking: 4 };
  const step = (w - pad * 2) / (sessions.length - 1);
  const pts = sessions.map((s, i) => [pad + i * step, pad + (rank[s.mood] / 4) * (h - pad * 2)]);
  return (
    <div>
      <svg width={w} height={h} style={{ display: 'block' }}>
        {[0, 2, 4].map(r => (
          <line key={r} x1={pad} x2={w - pad} y1={pad + (r / 4) * (h - pad * 2)} y2={pad + (r / 4) * (h - pad * 2)} stroke={M_BORDER} strokeWidth="1" strokeDasharray="2,4"/>
        ))}
        <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={M_BORDER_2} strokeWidth="1.4"/>
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.2" fill={MOODS[sessions[i].mood].color}/>)}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <Num size={9} color={M_MUTED} weight={500}>10 SESSIONS AGO</Num>
        <Num size={9} color={M_MUTED} weight={500}>NOW</Num>
      </div>
    </div>
  );
};

const SESSIONS = [
  { mood: 'neutral' }, { mood: 'confident' }, { mood: 'confident' }, { mood: 'frustrated' },
  { mood: 'tilted' }, { mood: 'frustrated' }, { mood: 'neutral' }, { mood: 'confident' },
  { mood: 'tilted' }, { mood: 'frustrated' },
];

// ── identity: the creature, then the label ───────────────────────────────────
const IdentityBlock = ({ a, compact }) => (
  <div style={{ padding: compact ? '10px 14px 8px' : '13px 14px 10px', display: 'flex', gap: 13, alignItems: 'flex-start' }}>
    <div style={{ width: 54, height: 54, borderRadius: 13, flexShrink: 0, background: '#0A0F17', border: `1px solid ${a.accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <MoodGhost mood={a.mood} accent={a.accent} size={52} ring={false}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 19, fontWeight: 600, color: M_TEXT, letterSpacing: '-0.01em' }}>{a.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
        <NatureBadge nature={a.nature.n} up={a.nature.up} dn={a.nature.dn}/>
        <Num size={9} color={M_MUTED} weight={500}>{a.born}</Num>
      </div>
    </div>
  </div>
);

// ── the screen ────────────────────────────────────────────────────────────────
const ProfileV2M = ({ who = 'vet', expand, rel }) => {
  const a = PROFILE_CAST[who];
  return (
    <PhoneShell>
      <GlobalHeader back title={a.name}/>
      <MoodBand accent={a.accent} mood={a.mood} state={a.state}
        action={a.state === 'live' ? 'Watch' : 'Deploy'} cause={a.cause}/>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <IdentityBlock a={a} compact={!!expand || !!rel}/>

        {!expand && !rel && (
          <div style={{ margin: '0 14px 12px', fontSize: 12.5, color: `color-mix(in oklab, ${M_GOLD} 30%, ${M_DIM})`, lineHeight: 1.5, fontStyle: 'italic' }}>
            {a.natureLine}
          </div>
        )}

        {/* the cluster — the heart of the card */}
        <div style={{ padding: '0 14px 5px' }}>
          <Lbl size={9.5}>Attributes</Lbl>
        </div>
        <div style={{ margin: '0 14px 12px', padding: '13px 13px 14px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <AttrCluster attrs={a.attrs} w="100%" expand={expand}/>
          {a.fatigue && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${M_BORDER}` }}>
              <FatigueLine stage={a.fatigue.stage} line={a.fatigue.line}/>
            </div>
          )}
        </div>

        {/* the biography layer — narrative, below the numbers, never mixed into them */}
        {rel && a.rels && (
          <>
            <div style={{ padding: '0 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Lbl size={9.5}>Relationships</Lbl>
              <Num size={9} color={M_MUTED} weight={500}>FROM 2,041 HANDS OF HISTORY</Num>
            </div>
            <div style={{ margin: '0 14px 12px', padding: '2px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
              {a.rels.map((r, i) => <RelRow key={r.who} {...r} last={i === a.rels.length - 1}/>)}
            </div>
          </>
        )}

        {/* demoted: career on one line */}
        <div style={{ margin: '0 14px 12px', padding: '9px 13px 10px', borderRadius: 12, background: 'transparent', border: `1px solid ${M_BORDER}`, display: 'flex' }}>
          {a.career.map(([l, v], i) => (
            <div key={l} style={{ flex: 1, borderLeft: i ? `1px solid ${M_BORDER}` : 'none', paddingLeft: i ? 11 : 0 }}>
              <Lbl size={8.5}>{l}</Lbl>
              <div style={{ marginTop: 2 }}><Num size={12.5} weight={700} color={v.startsWith('+') ? M_TEAL : M_TEXT}>{v}</Num></div>
            </div>
          ))}
        </div>

        {/* demoted: the mood arc */}
        {!rel && <>
        <div style={{ padding: '0 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Lbl size={9.5}>Mood · last 10 sessions</Lbl>
          <span style={{ fontSize: 11, color: M_MUTED }}>{who === 'day1' ? 'nothing to plot yet' : 'tilts fast, recovers slow'}</span>
        </div>
        <div style={{ margin: '0 14px 12px', padding: '10px 12px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          {who === 'day1'
            ? <div style={{ height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px dashed ${M_BORDER_2}`, borderRadius: 8 }}>
                <Num size={9.5} color={M_MUTED} weight={500}>HIS FIRST SESSION WILL BE THE FIRST DOT</Num>
              </div>
            : <PMoodArc sessions={SESSIONS} w={332}/>}
        </div>
        </>}

        <div style={{ margin: '0 14px', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D` }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="edit" size={14} color={M_TEAL}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: M_TEXT }}>Edit strategy</div>
            <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 1 }}>Aggression, bluff frequency, ranges &mdash; the chosen half</div>
          </div>
          <Icon name="chevron-right" size={16} color={M_MUTED}/>
        </div>
      </div>
    </PhoneShell>
  );
};

const ProfileDayOneScreenM = () => <ProfileV2M who="day1"/>;
const ProfileVeteranScreenM = () => <ProfileV2M who="vet"/>;
const ProfileFocusScreenM = () => <ProfileV2M who="vet" expand="FOCUS"/>;

// ── desktop: the same card, in the thread's right rail ───────────────────────
const PlayerCardRail = ({ who = 'vet', expand }) => {
  const a = PROFILE_CAST[who];
  return (
    <RailBody pad={14}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 56, height: 56, borderRadius: 13, flexShrink: 0, background: '#0A0F17', border: `1px solid ${a.accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
          <MoodGhost mood={a.mood} accent={a.accent} size={54} ring={false}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: PLAYFAIR, fontSize: 20, fontWeight: 600, color: M_TEXT }}>{a.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, flexWrap: 'wrap' }}>
            <NatureBadge nature={a.nature.n} up={a.nature.up} dn={a.nature.dn}/>
            <Num size={9} color={M_MUTED} weight={500}>{a.born}</Num>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: `color-mix(in oklab, ${M_GOLD} 30%, ${M_DIM})`, lineHeight: 1.5, fontStyle: 'italic' }}>{a.natureLine}</div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Lbl size={9.5}>Attributes</Lbl>
          <Num size={9} color={M_MUTED} weight={500}>GOLD = SCOUTED CEILING</Num>
        </div>
        <div style={{ padding: '14px 15px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <AttrCluster attrs={a.attrs} w="100%" expand={expand}/>
          {a.fatigue && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${M_BORDER}` }}>
              <FatigueLine stage={a.fatigue.stage} line={a.fatigue.line}/>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '10px 14px 11px', borderRadius: 10, border: `1px solid ${M_BORDER}`, display: 'flex' }}>
        {a.career.map(([l, v], i) => (
          <div key={l} style={{ flex: 1, borderLeft: i ? `1px solid ${M_BORDER}` : 'none', paddingLeft: i ? 13 : 0 }}>
            <Lbl size={8.5}>{l}</Lbl>
            <div style={{ marginTop: 2 }}><Num size={14} weight={700} color={v.startsWith('+') ? M_TEAL : M_TEXT}>{v}</Num></div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Lbl size={9.5}>Mood · last 10 sessions</Lbl>
          <span style={{ fontSize: 11, color: M_MUTED }}>tilts fast, recovers slow</span>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <PMoodArc sessions={SESSIONS} w={462}/>
        </div>
      </div>
    </RailBody>
  );
};

const D3ThreadCardScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$460" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <ThreadRosterRail active="Aggressive v1.3"/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
        <MoodBand accent={M_PURPLE} mood="frustrated" state="live" action="Watch"
          cause="two rivers called back — 140 hands in"/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
            <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.18em' }}>WED · MAY 6</span>
            <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <PHood size={32} accent={M_PURPLE} mood="frustrated"/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT }}>Aggressive v1.3</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>09:12</span>
              </div>
              <div style={{ background: M_PANEL_2, border: `1px solid ${M_PURPLE}3D`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
                I am seeing them fine. I am just tired of being right and losing.
              </div>
            </div>
          </div>
          <div style={{ marginLeft: 44, maxWidth: 480 }}>
            <GrowthTick attr="FOCUS" from={61} to={62} cause="priced a turn call at 2.4 to 1 and got it exactly right."/>
          </div>
        </div>
        <PComposer draft=""/>
      </div>
      <Panel>
        <PanelHead title="Player card" sub="AGGRESSIVE V1.3" close/>
        <PlayerCardRail who="vet"/>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  PROFILE_CAST, GROWTH_LOG, SPARK, AttrSpark, AttrCluster, AttrFocusPanel, FatigueLine, PMoodArc, IdentityBlock,
  ProfileV2M, ProfileDayOneScreenM, ProfileVeteranScreenM, ProfileFocusScreenM,
  PlayerCardRail, D3ThreadCardScreenM,
});
