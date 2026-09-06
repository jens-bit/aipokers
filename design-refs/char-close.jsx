// CHARACTER SYSTEM · CLOSING WAVE — integration and stress tests.
// S6 the attribute state matrix, S7 the plain-language one-sheet, the seam with
// items, and two stress cases that try to break the card.

// ── two more casts, added to the existing PROFILE_CAST so ProfileV2M renders them
// with no second screen component ────────────────────────────────────────────
PROFILE_CAST.showman = {
  name: 'The Closer', accent: M_GOLD, mood: 'confident', state: 'recap',
  cause: 'closed +$620 — three bluffs through',
  nature: { n: 'Showman', up: 'DECEPTION', dn: 'READS' },
  natureLine: 'Nobody at the table knows what he has. He does not always know what they have either, and he does not seem to mind.',
  born: 'TIER 2 · 4,200 HANDS',
  fatigue: { stage: 'settled', line: 'settled in — 74 hands' },
  attrs: [
    { k: 'READS', cur: 41, lo: 42, hi: 48 },
    { k: 'FOCUS', cur: 38, lo: 44, hi: 52 },
    { k: 'DISCIPLINE', cur: 55, lo: 57, hi: 64 },
    { k: 'COMPOSURE', cur: 62, lo: 63, hi: 70 },
    { k: 'DECEPTION', cur: 93, lo: 92, hi: 96, ceiling: true, narrowed: true },
    { k: 'STAMINA', cur: 58, lo: 59, hi: 66 },
  ],
  career: [['Hands', '4,200'], ['Win rate', '51.1%'], ['Net', '+$2,890'], ['BB/100', '+3.2']],
};

PROFILE_CAST.gr5k = {
  ...PROFILE_CAST.day1,
  state: 'recap', mood: 'confident',
  cause: 'closed +$180 — 5,000 hands to his name',
  natureLine: 'Five thousand hands and he is still a Rock. He just folds better now, and he can tell you why.',
  born: 'TIER 2 · 5,000 HANDS',
  fatigue: { stage: 'settled', line: 'settled in — 96 hands' },
  attrs: [
    { k: 'READS', cur: 63, lo: 63, hi: 66 },
    { k: 'FOCUS', cur: 78, lo: 78, hi: 82 },
    { k: 'DISCIPLINE', cur: 93, lo: 93, hi: 96, ceiling: true },
    { k: 'COMPOSURE', cur: 66, lo: 67, hi: 70 },
    { k: 'DECEPTION', cur: 72, lo: 74, hi: 79 },
    { k: 'STAMINA', cur: 74, lo: 75, hi: 78, narrowed: true },
  ],
  career: [['Hands', '5,000'], ['Win rate', '56.8%'], ['Net', '+$4,120'], ['BB/100', '+7.1']],
};

const ProfileShowmanScreenM = () => <ProfileV2M who="showman"/>;

// ── S6 · the state matrix, extended ──────────────────────────────────────────
const MCell = ({ children, live, note }) => (
  <div style={{ padding: '10px 11px', borderRadius: 8, background: live ? M_PANEL_2 : 'transparent', border: `1px solid ${live ? M_BORDER : 'transparent'}` }}>
    {live && <div style={{ marginBottom: note ? 9 : 0 }}>{live}</div>}
    {children && <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.5 }}>{children}</div>}
    {note && <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 6, lineHeight: 1.45 }}>{note}</div>}
  </div>
);

const SURF_COLS = ['Player card', 'Birth', 'Thread', 'Hand review', 'Floor / zoom', 'Notifications'];

const AttrStateMatrixM = () => {
  const cols = `196px repeat(6, 1fr)`;
  const rows = [
    {
      k: 'Attribute values',
      live: <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <AttrBar row w="100%" name="READS" cur={82} lo={80} hi={84} nameW={58}/>
        <AttrBar row w="100%" name="FOCUS" cur={62} lo={70} hi={75} nameW={58} fatigued/>
      </div>,
      cells: [
        ['Six bars, canon order, tap to expand.', 'the heart of the card'],
        ['Six bars, exact from second one.', 'nothing withheld at birth'],
        ['Never as numbers — only as his voice.', 'the thread is not a dashboard'],
        ['Named per decision, one label.', 'FOCUS · DISCIPLINE · READS'],
        ['Absent. Bodies, not bars.', 'the room shows state, not stats'],
        ['Only inside a growth ping.', 'never a standalone number'],
      ],
    },
    {
      k: 'Potential band',
      live: <AttrBar w="100%" name="FOCUS" cur={54} lo={60} hi={90} narrowed/>,
      cells: [
        ['Gold band behind the fill; caret for a session after it narrows.', 'width IS the confidence'],
        ['At its widest — 20 to 30 points.', 'the ceiling is a rumour'],
        ['Only when he mentions a ceiling himself.', 'rare, and in words'],
        ['Absent — a hand is about today.', ''],
        ['Absent.', ''],
        ['Absent. A narrowing band is not news.', ''],
      ],
    },
    {
      k: 'Nature badge',
      live: <NatureBadge nature="Rock" up="DISCIPLINE" dn="READS"/>,
      cells: [
        ['Beside the name, always. Two sizes only.', 'm on the card, l at birth'],
        ['The moment. Lands after the name chip.', 'announced in his voice'],
        ['Header only, never in bubbles.', 'he does not cite his own badge'],
        ['Absent.', ''],
        ['Absent — the ghost is the identity.', 'no crest on a body'],
        ['Named in the birth ping only.', 'once per agent, ever'],
      ],
    },
    {
      k: 'Growth tick',
      live: <GrowthTick attr="READS" from={61} to={62} cause="third showdown against the same opponent."/>,
      cells: [
        ['The bar moves one point; caret if the band narrowed too.', 'no toast, no confetti'],
        ['Impossible — nothing has been played.', ''],
        ['A quiet line in his voice with the hand behind it.', 'the cause is the payload'],
        ['Absent. Review explains one hand, not a month.', ''],
        ['Absent. Growth is not a presence state.', ''],
        ['Priority 6, rides the recap, once a day.', 'lowest rung on the ladder'],
      ],
    },
    {
      k: 'Fatigue',
      live: <FatigueLine compact stage="worn" line="worn — 140 hands, Focus dipping"/>,
      cells: [
        ['Meter in words under the cluster; affected bars retreat, numbers gold.', 'bands never move'],
        ['Fresh, and says so.', ''],
        ['He mentions it once, unprompted.', 'not every hand'],
        ['Named where it caused the miss.', '“worn · 140 hands”'],
        ['Posture only: lids, slower float, a sink.', 'never the aura or the rim'],
        ['Silent. Fatigue never pings.', 'it fixes itself at the bar'],
      ],
    },
  ];

  return (
    <Sheet title="State matrix · attributes × surfaces" sub="The companion to the mood matrix, in the same shape. Read down a column to build a surface; read across a row to check a fact cannot contradict itself. Empty cells are the design — an absence here is a decision, not a gap.">
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, paddingBottom: 10, borderBottom: `1px solid ${M_BORDER}` }}>
        <div/>
        {SURF_COLS.map(h => (
          <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingLeft: 11 }}>{h}</div>
        ))}
      </div>
      {rows.map(r => (
        <div key={r.k} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '14px 0', borderBottom: `1px solid ${M_BORDER}`, alignItems: 'start' }}>
          <div>
            <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_TEAL, marginBottom: 10 }}>{r.k}</div>
            <div style={{ padding: '10px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{r.live}</div>
          </div>
          {r.cells.map((c, i) => <MCell key={i} note={c[1]}>{c[0]}</MCell>)}
        </div>
      ))}

      {/* fatigue, its three states, across the surfaces that carry it */}
      <div style={{ marginTop: 20 }}>
        <SyLbl color={M_GOLD}>Fatigue states · the within-session row set</SyLbl>
        <div style={{ display: 'grid', gridTemplateColumns: '196px repeat(4, 1fr)', gap: 10 }}>
          <div/>
          {['Player card', 'Thread', 'Floor', 'Zoom'].map(h => (
            <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingLeft: 11 }}>{h}</div>
          ))}
          {[
            { s: 'fresh', line: 'fresh — 12 hands in', cells: ['three blocks, no effect named', 'silent', 'canon posture', 'no row at all'] },
            { s: 'settled', line: 'settled in — 68 hands', cells: ['two blocks, still no effect', 'silent', 'canon posture', 'no row at all'] },
            { s: 'worn', line: 'worn — 140 hands, Focus dipping', cells: ['one block gold; Focus & Discipline retreat', 'one unprompted line', 'lids, 1.7× slower float, 4px sink', 'gold row under the strip, names the cost'] },
          ].map(r => (
            <React.Fragment key={r.s}>
              <div style={{ paddingTop: 10 }}>
                <div style={{ padding: '10px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
                  <FatigueLine compact stage={r.s} line={r.line}/>
                </div>
              </div>
              {r.cells.map((c, i) => <MCell key={i}>{c}</MCell>)}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>Invariants</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            Bars appear on exactly <b style={{ color: M_TEXT }}>two</b> surfaces — the card and the birth sheet. The floor never shows a number. An exact potential appears nowhere but inside a tapped bar. Mood owns the eyes and the aura; fatigue owns posture and the meter; <b style={{ color: M_TEXT }}>they never share a channel</b>, so a confident agent can be worn and a tilted one can be fresh.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
          <SyLbl color={M_RED}>The seam with items</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            <b style={{ color: M_TEXT }}>Items touch state, never skill.</b> The snack moves mood one step and cannot touch an attribute, a band or the fatigue meter — the bar is the only thing that restores fatigue, and nothing restores or raises an attribute except playing. This is the law that keeps the no-purchase-path law true: if any item ever moved a bar, the store would follow within a quarter.
          </div>
        </div>
      </div>
    </Sheet>
  );
};

// ── the seam, drawn ──────────────────────────────────────────────────────────
// A tilted, worn agent — the one state where both systems are live at once. The
// snack is an ACTION (docked at the composer, has a button, has a count). Fatigue
// is a STATE (in the feed, no button, no count, names its own cost). Different
// furniture, different place, different grammar.
const ThreadFatigueRow = () => (
  <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '9px 12px', borderRadius: 9, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 3, width: 38, flexShrink: 0 }}>
        {[0, 1, 2].map(i => <div key={i} style={{ flex: 1, height: 5, borderRadius: 2.5, background: i < 1 ? M_GOLD : M_SURF, boxShadow: i < 1 ? `0 0 6px ${M_GOLD}44` : 'none' }}/>)}
      </div>
      <span style={{ flex: 1, fontSize: 12, color: M_GOLD, lineHeight: 1.4 }}>Worn &mdash; 168 hands, Focus dipping</span>
      <Num size={9} color={M_MUTED} weight={500}>RESTS AT THE BAR</Num>
    </div>
  </div>
);

const SeamThreadScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="tilted" state="resting" action="Deploy"
    cause="steaming — lost two big pots as favourite"
    dock={<SnackDock left={2} state="ready"/>}>
    <SysLine>Session ended · 18:04</SysLine>
    <AgentBubble mood="tilted" accent={M_PURPLE} time="18:04" expressive>
      Twice. TWICE he backdoors it. I'm fine. I'm FINE.
    </AgentBubble>
    <ThreadFatigueRow/>
    <AgentBubble mood="tilted" accent={M_PURPLE} time="18:05">
      Don't deploy me yet. I'd punt — and I've been at this since four.
    </AgentBubble>
  </ThreadScreen>
);

// the two things, side by side, with the distinction named
const SeamCompareM = () => (
  <div style={{ width: 390, background: M_BG, fontFamily: INTER, padding: 14, borderRadius: 14, border: `1px solid ${M_BORDER}` }}>
    {[
      {
        tag: 'MOOD · your move', color: M_GOLD, w: 'SNACK',
        body: <SnackChip full left={2} state="ready"/>,
        facts: ['an ACTION — has a button and a count', 'docked at the composer, beside talking', 'moves mood one step, nothing else', 'absent when he is fine'],
      },
      {
        tag: 'ATTRIBUTE · time\u2019s move', color: M_GOLD, w: 'FATIGUE',
        body: <ThreadFatigueRow/>,
        facts: ['a STATE — no button, nothing to spend', 'sits in the feed with the other events', 'degrades Focus and Discipline, names the cost', 'clears at the bar, on its own'],
      },
    ].map(r => (
      <div key={r.w} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.16em', color: M_TEXT }}>{r.w}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED }}>{r.tag}</span>
        </div>
        <div style={{ marginLeft: -CANON.pad, marginRight: -CANON.pad }}>{r.body}</div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {r.facts.map(f => (
            <div key={f} style={{ display: 'flex', gap: 8, fontSize: 11.5, color: M_MUTED, lineHeight: 1.45 }}>
              <span style={{ color: M_MUTED }}>&mdash;</span><span style={{ flex: 1 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
    <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.5, paddingTop: 12, borderTop: `1px solid ${M_BORDER}` }}>
      Both are gold, because both are care rather than money. <b style={{ color: M_TEXT }}>Nothing else about them matches</b> — and no item in the product will ever be able to move the row underneath.
    </div>
  </div>
);

// ── stress test: the same agent, twice ───────────────────────────────────────
const GrowthPairM = () => (
  <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
    <ProfileV2M who="day1"/>
    <ProfileV2M who="gr5k"/>
  </div>
);

// ── stress test: the Showman at hand review ──────────────────────────────────
const ShowmanVerdictBand = () => (
  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, padding: `9px ${CANON.pad}px 11px`, borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL }}>
    <div style={{ width: 42, height: 42, borderRadius: CANON.radius, flexShrink: 0, background: '#0A0F17', border: `1px solid ${M_GOLD}55`, boxShadow: `0 0 14px ${M_TEAL}33`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <MoodGhost mood="confident" accent={M_GOLD} size={40} ring={false}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 18, padding: '0 6px', borderRadius: 3, background: `${M_TEAL}1F`, border: `1px solid ${M_TEAL}55` }}>
          <Num size={11} weight={700} color={M_TEAL}>+$620</Num>
        </span>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', color: M_MUTED, textTransform: 'uppercase' }}>Won it with the worst hand</span>
      </div>
      <div style={{ fontSize: 11.5, color: M_DIM, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        The Closer · NLH 6-max $5/$10 · 23:41
      </div>
    </div>
    <Btn kind="outline" h={30}>Open chat</Btn>
  </div>
);

const ShowmanReviewScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Hand #4188"/>
    <ShowmanVerdictBand/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: `10px ${CANON.pad}px`, borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <PlayingCard rank="9" suit="d" w={30} h={41}/>
          <PlayingCard rank="4" suit="s" w={30} h={41}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500 }}>Nine-four offsuit, CO</div>
          <div style={{ marginTop: 2 }}><Num size={CANON.meta} color={M_MUTED} weight={500}>VS NASH_EQ · 3 STREETS · DECEPTION 93</Num></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Lbl size={8.5}>Pot</Lbl>
          <div><Num size={13} weight={700}>$620</Num></div>
        </div>
      </div>

      <StreetRow street="Preflop" board={[['9','d'],['4','s']]}
        action="OPEN $30" equity="31" matched={false}
        attr={{ note: 'opened trash from the CO', k: 'DISCIPLINE', cost: true }}
        reason="Table folds too much. I don't need cards for this."/>

      <StreetRow street="Flop" board={[['A','h'],['K','d'],['7','c']]}
        action="BET $45" equity="18" matched={false}
        attr={{ note: 'same sizing as his value bets', k: 'DECEPTION' }}
        reason="I bet this board the same way whether I have the ace or a nine. Today it's a nine."/>

      <StreetRow street="Turn" board={[['A','h'],['K','d'],['7','c'],['3','h']]}
        action="BET $140" equity="12" matched={false}
        attr={{ note: 'sold it', k: 'DECEPTION' }}
        reason="He's got a king and he's going to fold it. Watch."/>

      <StreetRow street="River" board={[['A','h'],['K','d'],['7','c'],['3','h'],['Q','s']]}
        action="JAM $405" equity="9" matched={false} last
        attr={{ note: 'called the fold within 4%', k: 'DECEPTION' }}
        reason="Told you. He needed to be right once and he wasn't."/>
    </div>
    <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, padding: `10px ${CANON.pad}px 22px` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="risk" size={13} color={M_GOLD}/>
        <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED, lineHeight: 1.45 }}>
          Four rows against the math, and a <b style={{ color: M_TEAL }}>+$620</b> pot. <b style={{ color: M_DIM }}>The verdict column is not a score.</b>
        </span>
      </div>
    </div>
  </PhoneShell>
);

// ── S7 · how it plays, in five sentences ─────────────────────────────────────
const HOW = [
  { n: '1', k: 'You build him', s: 'You tell him how to play — how tight, how aggressive, when to bluff — in a conversation, and he is born with a temperament of his own.' },
  { n: '2', k: 'He plays', s: 'He sits down at real tables without you and plays his own hands, and you can watch, or read what he did later in his own words.' },
  { n: '3', k: 'He grows', s: 'The more he plays the better he gets at executing your plan — a point at a time, permanently, and always because of a hand you can go and look at.' },
  { n: '4', k: 'He gets worn', s: 'Late in a long session he tires, misprices the odd spot, and tells you so — he never stops playing, he just plays worse.' },
  { n: '5', k: 'You bring him back', s: 'An hour at the bar and he is sharp again. Nothing about him is ever for sale.' },
];

const HowItPlaysM = () => (
  <Sheet title="How it plays" w={880} sub="Five sentences for someone who has never seen the product, written to survive being read out loud. No jargon, no attribute names, no numbers — the landing page can cut them down but must not add a sixth idea.">
    {HOW.map((h, i) => (
      <div key={h.n} style={{ display: 'flex', gap: 18, padding: '16px 0', borderTop: i ? `1px solid ${M_BORDER}` : 'none' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: M_TEAL, width: 16, flexShrink: 0, paddingTop: 7 }}>{h.n}</span>
        <div style={{ width: 168, flexShrink: 0 }}>
          <div style={{ fontFamily: PLAYFAIR, fontSize: 20, fontWeight: 600, color: M_TEXT, letterSpacing: '-0.01em' }}>{h.k}</div>
        </div>
        <div style={{ flex: 1, fontSize: 15, color: M_DIM, lineHeight: 1.6 }}>{h.s}</div>
      </div>
    ))}
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>What the five sentences are load-bearing for</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Sentence 1 sells the draft conversation. 2 sells absence &mdash; he plays whether you are there or not. 3 is the reason to come back tomorrow. 4 is the reason he feels alive. 5 is the promise that this is <b style={{ color: M_TEXT }}>not a game with a store in it</b>.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
        <SyLbl color={M_RED}>Not on the landing page</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          The six attribute names, the eight natures, potential bands, tick arithmetic, fatigue thresholds. All of it is <b style={{ color: M_TEXT }}>discovered by playing</b>, and a stranger who has to learn six nouns before the first sentence lands has already left.
        </div>
      </div>
    </div>
  </Sheet>
);

Object.assign(window, {
  AttrStateMatrixM, HowItPlaysM, MCell, ThreadFatigueRow, SeamCompareM, GrowthPairM,
  SeamThreadScreenM, ProfileShowmanScreenM, ShowmanReviewScreenM, ShowmanVerdictBand,
});
