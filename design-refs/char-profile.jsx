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
    natureLine: 'A Rock does not read you. He decides what he folds before you act, and then he folds it — every time, whatever you show him.',
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
    natureLine: 'Two thousand hands have not changed what he is: he sees it first and he takes it badly.',
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
    { f: 61, t: 62, when: 'TODAY · 09:12', c: 'priced a turn call at 2.4 to 1 and got it exactly right.' },
    { f: 60, t: 61, when: 'MAY 4', c: '340 decisions in one sitting — volume is what moves this one.' },
    { f: 59, t: 60, when: 'APR 28', c: 'caught his own equity error on the river and folded instead.' },
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
          {expand === a.k && <AttrFocusPanel attr={meta(a.k)} live={a} log={GROWTH_LOG[a.k] || []}/>}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── the tapped bar, expanded ──────────────────────────────────────────────────
const AttrFocusPanel = ({ attr, live, log }) => (
  <div style={{ borderRadius: 10, background: M_PANEL, border: `1px solid ${M_TEAL}44`, padding: '12px 13px', marginTop: 1 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: M_TEAL }}>{attr.k}</span>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: M_TEXT }}>{live.cur}</span>
      <span style={{ flex: 1 }}/>
      <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_GOLD }}>CEILING {live.lo}&ndash;{live.hi}</span>
    </div>
    <div style={{ fontSize: 12.5, color: M_TEXT, lineHeight: 1.5 }}>{attr.mean} {attr.moves}</div>
    <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${M_BORDER}` }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: M_MUTED, width: 54, flexShrink: 0, paddingTop: 1 }}>TRAINED<br/>BY</span>
      <span style={{ fontSize: 12, color: M_TEAL, lineHeight: 1.45 }}>{attr.trains}</span>
    </div>
    <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${M_BORDER}` }}>
      <Lbl size={9}>Last three ticks</Lbl>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 7 }}>
        {log.map(g => (
          <div key={g.when} style={{ display: 'flex', gap: 9 }}>
            <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: M_TEAL, width: 46, flexShrink: 0 }}>{g.f}<span style={{ color: M_MUTED }}>&rarr;</span>{g.t}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: M_DIM, lineHeight: 1.4 }}>
              {g.c}
              <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, display: 'block', marginTop: 2 }}>{g.when}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
    <div style={{ marginTop: 11, paddingTop: 9, borderTop: `1px solid ${M_BORDER}`, fontSize: 12.5, color: M_DIM, fontStyle: 'italic', lineHeight: 1.45 }}>{attr.voice}</div>
  </div>
);

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
      <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, flexShrink: 0 }}>RESTS AT THE BAR</span>
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
const ProfileV2M = ({ who = 'vet', expand }) => {
  const a = PROFILE_CAST[who];
  return (
    <PhoneShell>
      <GlobalHeader back title={a.name}/>
      <MoodBand accent={a.accent} mood={a.mood} state={a.state}
        action={a.state === 'live' ? 'Watch' : 'Deploy'} cause={a.cause}/>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <IdentityBlock a={a} compact={!!expand}/>

        {!expand && (
          <div style={{ margin: '0 14px 12px', fontSize: 12.5, color: `color-mix(in oklab, ${M_GOLD} 30%, ${M_DIM})`, lineHeight: 1.5, fontStyle: 'italic' }}>
            {a.natureLine}
          </div>
        )}

        {/* the cluster — the heart of the card */}
        <div style={{ padding: '0 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Lbl size={9.5}>Attributes</Lbl>
          <Num size={9} color={M_MUTED} weight={500}>{who === 'day1' ? 'CEILING NOT YET SCOUTED' : expand ? 'TAP AGAIN TO CLOSE' : 'GOLD = SCOUTED CEILING'}</Num>
        </div>
        <div style={{ margin: '0 14px 12px', padding: '13px 13px 14px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <AttrCluster attrs={a.attrs} w="100%" expand={expand}/>
          {a.fatigue && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${M_BORDER}` }}>
              <FatigueLine stage={a.fatigue.stage} line={a.fatigue.line}/>
            </div>
          )}
          {!a.fatigue && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${M_BORDER}` }}>
              <FatigueLine stage="fresh" line="fresh — no hands played yet"/>
            </div>
          )}
        </div>

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
  PROFILE_CAST, GROWTH_LOG, AttrCluster, AttrFocusPanel, FatigueLine, PMoodArc, IdentityBlock,
  ProfileV2M, ProfileDayOneScreenM, ProfileVeteranScreenM, ProfileFocusScreenM,
  PlayerCardRail, D3ThreadCardScreenM,
});
