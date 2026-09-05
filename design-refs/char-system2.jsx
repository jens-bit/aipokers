// THE CHARACTER SYSTEM — S3–S5.

// ── S3 · CURRENT vs POTENTIAL ────────────────────────────────────────────────
const SCOUT_STAGES = [
  { when: 'Day one',        hands: '0 hands',   cur: 36, lo: 60, hi: 90, note: 'born. The ceiling is a rumour: a 30-point band.' },
  { when: 'First week',     hands: '120 hands', cur: 47, lo: 62, hi: 86, note: 'the band has moved in from both ends. He is beating the low end already.' },
  { when: 'A month in',     hands: '500 hands', cur: 66, lo: 70, hi: 78, note: 'an 8-point band. You now know roughly who he will be.', narrowed: true },
  { when: 'Late',           hands: '2,000 hands', cur: 74, lo: 75, hi: 77, note: 'the band is nearly a number, and he is nearly at it.' },
];

const Anno = ({ children }) => (
  <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, lineHeight: 1.55 }}>{children}</div>
);

const PotentialSheetM = () => (
  <Sheet title="Current, and a ceiling that is scouted" sub="Every attribute carries a current value, visible from day one, and a born potential ceiling that is never a number on the bar. It is displayed as a range that narrows as he plays. Football Manager’s potential ability, not Pokémon’s hidden IV: the sheet is never withheld, the ceiling is discovered.">
    <div style={{ display: 'flex', gap: 26, marginBottom: 24 }}>
      <div style={{ width: 430, flexShrink: 0 }}>
        <SyLbl>Bar anatomy</SyLbl>
        <div style={{ padding: '30px 22px 22px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <AttrBar name="FOCUS" cur={36} lo={60} hi={90} w="100%" narrowed/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px', marginTop: 24 }}>
            <div><Anno><span style={{ color: M_TEAL }}>&#9644; teal fill + white cap</span><br/>current value, 0&ndash;100. The cap is the only hard edge on the bar.</Anno></div>
            <div><Anno><span style={{ color: M_GOLD }}>&#9636; gold band, hairline ends</span><br/>the scouted ceiling. Width IS the confidence &mdash; no number for potential on the bar itself.</Anno></div>
            <div><Anno><span style={{ color: M_TEXT }}>36</span> &nbsp;mono 12, right of the name<br/>the current number, always exact.</Anno></div>
            <div><Anno><span style={{ color: M_GOLD }}>60&ndash;90</span> &nbsp;mono 9.5, gold<br/>the band in words, for the row that has no room for a bar.</Anno></div>
            <div><Anno><span style={{ color: M_GOLD }}>&#9662; caret at the high end</span><br/>appears for one session after the band narrows, then retires. This is the only animation on the bar.</Anno></div>
            <div><Anno>track <span style={{ color: M_DIM }}>M_SURF</span>, h6 r3 &middot; band h14 &middot; cap 2&times;12<br/>row pitch 9 &middot; six bars = 132px tall.</Anno></div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <SyLbl>The same attribute, scouted over a month</SyLbl>
        {SCOUT_STAGES.map(s => (
          <div key={s.when} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderTop: `1px solid ${M_BORDER}` }}>
            <div style={{ width: 92, flexShrink: 0 }}>
              <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_DIM }}>{s.when}</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, marginTop: 3 }}>{s.hands}</div>
            </div>
            <AttrBar name="FOCUS" cur={s.cur} lo={s.lo} hi={s.hi} w={230} narrowed={s.narrowed}/>
            <div style={{ flex: 1, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>{s.note}</div>
          </div>
        ))}
        <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
          <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
            <SyLbl color={M_TEAL}>Do</SyLbl>
            <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>Narrow the band from <b style={{ color: M_TEXT }}>hands played</b>, not from wins. Narrow it in visible jumps and mark each one. Let the current cap sit outside the band while the band is still wide &mdash; being ahead of the scouting report is a real and readable event.</div>
          </div>
          <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
            <SyLbl color={M_RED}>Don&rsquo;t</SyLbl>
            <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>Never print an exact potential on a bar. Inside a tapped bar it may be printed once, in gold — tapping is the user asking for precision. Never hide the current sheet behind a scouting gate. Never let the band widen again. Never show a percentage-to-ceiling &mdash; that is a progress bar, and this is a person.</div>
          </div>
        </div>
      </div>
    </div>
  </Sheet>
);

// ── S4 · GROWTH & FATIGUE ────────────────────────────────────────────────────
const GROWTH_EVENTS = [
  { a: 'READS', f: 61, t: 62, c: 'third showdown against the same opponent this session — he had seen that sizing before.' },
  { a: 'DISCIPLINE', f: 72, t: 73, c: 'folded top pair to the river jam. Correctly: he was shown the flush.' },
  { a: 'COMPOSURE', f: 43, t: 44, c: 'took two beats in nine hands and did not tilt.' },
  { a: 'DECEPTION', f: 58, t: 59, c: 'a 62-into-90 bluff got through uncalled on the turn.' },
];

const GrowthCurve = ({ w = 300, h = 96 }) => {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const x = i / 40;
    pts.push([10 + x * (w - 20), h - 14 - (1 - Math.exp(-2.6 * x)) * (h - 34)]);
  }
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <line x1="10" y1={h - 30} x2={w - 10} y2={h - 30} stroke={M_GOLD} strokeWidth="1" strokeDasharray="3 3" opacity=".55"/>
      <text x={w - 10} y={h - 36} textAnchor="end" fill={M_GOLD} fontFamily='"JetBrains Mono", monospace' fontSize="9">potential</text>
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={M_TEAL} strokeWidth="1.6"/>
      {[6, 13, 22, 34].map(i => <circle key={i} cx={pts[i][0]} cy={pts[i][1]} r="2.6" fill={M_TEAL}/>)}
      <text x="10" y={h - 2} fill={M_MUTED} fontFamily='"JetBrains Mono", monospace' fontSize="9">hands played &rarr;</text>
    </svg>
  );
};

const GrowthFatigueSheetM = () => (
  <Sheet title="Growth is permanent. Fatigue is today." sub="Two curves, deliberately opposite: one moves in single points over weeks and never comes back down, the other moves in a session and resets at the bar. Both are events with causes, and both get a row in the state matrix.">
    <div style={{ display: 'flex', gap: 26 }}>
      <div style={{ flex: 1 }}>
        <SyLbl color={M_TEAL}>Growth · slow, permanent, diminishing</SyLbl>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ padding: '10px 12px 4px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}><GrowthCurve/></div>
          <div style={{ flex: 1, fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
            Ticks come in <b style={{ color: M_TEXT }}>ones</b>, and they slow as he approaches his ceiling: the first ten points of Focus are a week, the last five are a season. Nothing ever regresses &mdash; a bad month is mood and fatigue, never lost attributes.
            <div style={{ marginTop: 9, fontFamily: MONO, fontSize: 9.5, color: M_MUTED, lineHeight: 1.55 }}>each dot is a tick, announced<br/>no tick without a named cause</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {GROWTH_EVENTS.map(g => <GrowthTick key={g.a} attr={g.a} from={g.f} to={g.t} cause={g.c}/>)}
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33`, fontSize: 11.5, color: M_DIM, lineHeight: 1.6 }}>
          <SyLbl color={M_TEAL}>The cause is the product</SyLbl>
          <div style={{ marginTop: -3 }}>A tick with no cause is a number going up in a game. A tick <i>with</i> a cause is the agent telling you what he learned at your table this afternoon &mdash; which is the only reason this system exists. <b style={{ color: M_TEXT }}>Causes are drawn from real hands</b> and quote them.</div>
        </div>
      </div>

      <div style={{ width: 430, flexShrink: 0 }}>
        <SyLbl color={M_GOLD}>Fatigue · within-session, in words</SyLbl>
        <div style={{ padding: '16px 18px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <div style={{ display: 'flex', gap: 18 }}>
            {FATIGUE.map(f => (
              <div key={f.key} style={{ flex: 1 }}>
                <FatigueMeter stage={f.key} w="100%"/>
                <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 7, lineHeight: 1.5 }}>
                  {f.key === 'fresh' ? 'no effect' : f.key === 'settled' ? 'no effect' : 'Focus \u22126 · Discipline \u22124'}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${M_BORDER}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <AttrBar name="FOCUS · WORN" cur={48} lo={60} hi={90} w={190} fatigued/>
              <div style={{ fontSize: 11.5, color: M_GOLD, lineHeight: 1.5 }}>the fill retreats and the number goes gold. The <b>band never moves</b> &mdash; fatigue is not a lower ceiling.</div>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${M_BORDER}`, fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
            Thresholds scale with Stamina, so the meter means different hand counts for different agents:
            <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr 1fr 1fr', gap: '7px 10px', marginTop: 11, fontFamily: MONO, fontSize: 9.5 }}>
              <span style={{ color: M_MUTED }}>STAMINA</span><span style={{ color: M_TEAL }}>FRESH</span><span style={{ color: M_TEAL }}>SETTLED</span><span style={{ color: M_GOLD }}>WORN</span>
              <span style={{ color: M_DIM }}>30 · low</span><span style={{ color: M_DIM }}>&lt; 25</span><span style={{ color: M_DIM }}>25&ndash;70</span><span style={{ color: M_DIM }}>70+</span>
              <span style={{ color: M_DIM }}>66 · typical</span><span style={{ color: M_DIM }}>&lt; 40</span><span style={{ color: M_DIM }}>40&ndash;140</span><span style={{ color: M_DIM }}>140+</span>
              <span style={{ color: M_DIM }}>92 · Grinder</span><span style={{ color: M_DIM }}>&lt; 70</span><span style={{ color: M_DIM }}>70&ndash;260</span><span style={{ color: M_DIM }}>260+</span>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${M_BORDER}`, display: 'flex', gap: 12, alignItems: 'center' }}>
            <MoodGhost mood="sulking" accent={M_PINK} size={44}/>
            <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
              <b style={{ color: M_TEXT }}>The bar becomes mechanical.</b> Time spent at the bar is what restores fatigue &mdash; the existing lounge is now doing a job. It is still never a gate: a worn agent plays on, worse, and says so.
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33`, fontSize: 11.5, color: M_DIM, lineHeight: 1.6 }}>
          <SyLbl color={M_RED}>Fatigue is not mood</SyLbl>
          <div style={{ marginTop: -3 }}>Mood comes from <b style={{ color: M_TEXT }}>outcomes</b> (beats, streaks, being shown a bluff) and shows in the eyes and the aura. Fatigue comes from <b style={{ color: M_TEXT }}>volume</b> and shows in posture and the meter. A confident agent can be worn; a tilted agent can be fresh. They never share a channel.</div>
        </div>
      </div>
    </div>

    <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${M_BORDER}` }}>
      <SyLbl>Two new state-matrix rows</SyLbl>
      <div style={{ display: 'grid', gridTemplateColumns: '104px repeat(4, 1fr)', gap: 14 }}>
        {['', 'Player card', 'Thread', 'Notification', 'Floor / rail'].map(h => (
          <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED }}>{h}</div>
        ))}
        <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: M_TEAL, paddingTop: 4 }}>GREW</div>
        {[
          'the bar animates by one point; caret if the band also narrowed',
          'a growth line in his voice, inline with the session recap',
          'batched into the session recap push — never its own alert',
          'no change. Growth is not a presence state.',
        ].map((t, i) => (
          <div key={i} style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.5, padding: '9px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{t}</div>
        ))}
        <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD, paddingTop: 4 }}>WORN</div>
        {[
          'meter reads “worn — 140 hands”; affected bars retreat, numbers gold',
          'he mentions it unprompted, once, not every hand',
          'silent. Fatigue never pushes.',
          'slumped posture at the felt; a gold dot on the roster row',
        ].map((t, i) => (
          <div key={i} style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.5, padding: '9px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{t}</div>
        ))}
      </div>
    </div>
  </Sheet>
);

// ── S5 · WHERE IT SURFACES ───────────────────────────────────────────────────
const SURFACES = [
  { n: '1', where: 'The player card', on: 'Profile', prompt: 'prompt 2',
    what: 'Six bars in canon order, the nature badge beside the name, the fatigue meter while he is in a session. The card is a bio, not a dashboard: the bars are the smallest thing on it.',
    law: 'no radar chart · no grade · no comparison to other agents' },
  { n: '2', where: 'The nature reveal', on: 'Birth', prompt: 'prompt 3',
    what: 'One line in his voice at the end of the draft, the badge, and the two moved bars animating to their shifted values. Everything else on the sheet is already at rest.',
    law: 'announced, never discovered · never re-rollable' },
  { n: '3', where: 'Growth moments', on: 'Thread + notifications', prompt: 'prompt 4',
    what: 'A tick is a line in the thread with the hand that caused it, quotable into the review. Notifications batch ticks into the session recap.',
    law: 'never a standalone push · never without a cause' },
  { n: '4', where: 'Attribute annotations', on: 'Hand review', prompt: 'prompt 5',
    what: 'Where a decision was shaped by an attribute, the row says so: “he misjudged equity by 7% · Focus”. This is the honest place a low attribute is allowed to cost money on screen.',
    law: 'annotate the cause, never grade the hand' },
  { n: '5', where: 'Fatigue postures', on: 'Floor', prompt: 'prompt 5',
    what: 'Worn ghosts sit lower at the felt with a slower bob; fresh ones ride high. Read at 40px with no text, across a full room.',
    law: 'posture only · fatigue never changes the rim colour or the eyes' },
];

const SurfaceMapSheetM = () => (
  <Sheet title="Where it surfaces" sub="The map the next four prompts follow. Nothing on this list introduces a screen that does not already exist — every one is an addition to a surface that shipped.">
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      {SURFACES.map(s => (
        <div key={s.n} style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: M_TEAL, paddingTop: 2 }}>{s.n}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT }}>{s.where}</span>
              <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_TEAL, background: `${M_TEAL}12`, border: `1px solid ${M_TEAL}33`, borderRadius: 3, padding: '3px 7px' }}>{s.on}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED }}>{s.prompt}</span>
            </div>
            <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.55, marginTop: 8 }}>{s.what}</div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_GOLD, marginTop: 8, lineHeight: 1.5, opacity: .9 }}>{s.law}</div>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 14, padding: '14px 16px', borderRadius: 10, background: 'transparent', border: `1px dashed ${M_BORDER_2}` }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: M_MUTED, paddingTop: 2 }}>&mdash;</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_DIM }}>Relationships</span>
            <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, border: `1px dashed ${M_BORDER_2}`, borderRadius: 3, padding: '3px 7px' }}>not designed</span>
          </div>
          <div style={{ fontSize: 12, color: M_MUTED, lineHeight: 1.55, marginTop: 8 }}>
            Nemesis, rival, favourite victim. A separate <b style={{ color: M_DIM }}>biography</b> layer with its own board &mdash; it is history between two agents, not an attribute of one. Noted here so it is not smuggled into the player card.
          </div>
        </div>
      </div>
    </div>

    <div style={{ marginTop: 20, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>What every one of these must survive</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          The owner who never opens the profile. Attributes have to be legible from the <b style={{ color: M_TEXT }}>thread alone</b> &mdash; his voice already carries them: the Rock talks about folding, the worn agent says he is worn, the Shark tells you he had you from the flop. The bars are the receipt, not the channel.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
        <SyLbl color={M_GOLD}>Open, for the next board</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Whether a second agent can be drafted <i>from</i> a first (inheritance), and whether attributes are visible on <b style={{ color: M_TEXT }}>other people&rsquo;s</b> agents when you spectate &mdash; scouting an opponent is the obvious extension of the band, and it is also the fastest way to turn this into a leaderboard. Not decided here.
        </div>
      </div>
    </div>
  </Sheet>
);

Object.assign(window, { PotentialSheetM, GrowthFatigueSheetM, SurfaceMapSheetM, GrowthCurve, SCOUT_STAGES, SURFACES });
