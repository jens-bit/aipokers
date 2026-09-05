// THE CHARACTER SYSTEM — S0–S2. Builds on mood-atoms tokens and the Sheet/SyLbl/Row
// chrome from mood-system.jsx. No new palette, no new component family, no icons.

const ATTR_STEP = 8;   // one nature step, on the 0–100 scale

const ATTRS = [
  { k: 'READS', meanShort: 'Opponent reading',
    mean: 'How fast and how precisely he figures opponents out.',
    moves: 'Reads arrive earlier in a hand and land closer to the truth.',
    trainsShort: 'showdowns seen',
    trains: 'Showdowns seen — every card turned over is evidence.',
    voice: '“He has shown that sizing twice now. It is a bluff.”',
    cur: 61, lo: 66, hi: 84 },
  { k: 'FOCUS', meanShort: 'Math precision',
    mean: 'Math precision.',
    moves: 'How exactly he perceives equity and pot odds. Low Focus misjudges a spot now and then.',
    trainsShort: 'sheer decision volume',
    trains: 'Sheer decision volume. Degrades with fatigue.',
    voice: '“Pot odds are 2.4 to 1. I need 29 percent. I have 31.”',
    cur: 54, lo: 60, hi: 90 },
  { k: 'DISCIPLINE', meanShort: 'Rule-following',
    mean: 'Sticking to his own rules.',
    moves: 'How often he deviates from the strategy you gave him.',
    trainsShort: 'big folds made correctly',
    trains: 'Big folds made correctly.',
    voice: '“The line says fold here. So I fold here.”',
    cur: 72, lo: 74, hi: 88 },
  { k: 'COMPOSURE', meanShort: 'Tilt resistance',
    mean: 'Tilt resistance, and recovery once tilted.',
    moves: 'How hard a bad beat lands, and how many hands he needs to come back.',
    trainsShort: 'surviving beats without tilting',
    trains: 'Surviving beats without tilting.',
    voice: '“That one stung. Next hand.”',
    cur: 43, lo: 52, hi: 71 },
  { k: 'DECEPTION', meanShort: 'Unreadability',
    mean: 'How unreadable he is.',
    moves: 'How slowly opponents work HIM out, and how consistent his sizing tells stay.',
    trainsShort: 'bluffs that get through',
    trains: 'Bluffs that get through uncalled.',
    voice: '“Same bet as last time. Different hand. Good luck.”',
    cur: 58, lo: 61, hi: 93 },
  { k: 'STAMINA', meanShort: 'Late-session sharpness',
    mean: 'How deep into a session he stays sharp.',
    moves: 'When fatigue begins eroding Focus and Discipline — the hand number, not the outcome.',
    trainsShort: 'long sessions at the table',
    trains: 'Long sessions. Restored by time at the bar.',
    voice: '“Two hundred hands in. Still counting straight.”',
    cur: 66, lo: 70, hi: 79 },
];

const NATURES = [
  { n: 'Grinder',   up: 'STAMINA',    dn: 'DECEPTION',  sig: 'I do not need to be clever. I need to still be here at hand four hundred.', birth: 'This one settles in like he is paying rent. He is a Grinder.' },
  { n: 'Hothead',   up: 'DECEPTION',  dn: 'COMPOSURE',  sig: 'You will never know what I have. Some hands, neither will I.',              birth: 'There is something combustible in this one. He is a Hothead.' },
  { n: 'Professor', up: 'FOCUS',      dn: 'STAMINA',    sig: 'Give me the numbers and an hour. Not two hours.',                          birth: 'This one arrived already reading. He is a Professor.' },
  { n: 'Rock',      up: 'DISCIPLINE', dn: 'READS',      sig: 'I do not need to know what you have. I know what I fold.',                 birth: 'There is something stubborn in this one. He is a Rock.' },
  { n: 'Gambler',   up: 'DECEPTION',  dn: 'DISCIPLINE', sig: 'The line says fold. The line is a suggestion.',                            birth: 'This one came out grinning. He is a Gambler.' },
  { n: 'Shark',     up: 'READS',      dn: 'COMPOSURE',  sig: 'I had you on that from the flop. Do not do it again.',                     birth: 'This one is watching you already. He is a Shark.' },
  { n: 'Sphinx',    up: 'COMPOSURE',  dn: 'FOCUS',      sig: 'It happened. It is over. Deal.',                                           birth: 'Nothing moves in this one\u2019s face. He is a Sphinx.' },
  { n: 'Showman',   up: 'DECEPTION',  dn: 'READS',      sig: 'Did you enjoy that one? There is more.',                                   birth: 'This one plays to the room. He is a Showman.' },
];

// ── ATOMS ─────────────────────────────────────────────────────────────────────
// The bar carries three facts at once: where he IS (teal fill), where he could
// END (gold scouted band), and how sure the scouting is (band width). The
// ceiling is never a number — it is a width.
// Two layouts, one atom. STACKED (name above) for reference sheets and wide cards;
// ROW (name · track · value on one line, 20px pitch) for the player card cluster,
// where six bars have to read as one silhouette rather than six widgets.
const AttrTrack = ({ cur, lo, hi, dim, narrowed, below }) => {
  const pct = v => Math.max(0, Math.min(100, v));
  return (
    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: M_SURF }}>
      {lo != null && <div style={{ position: 'absolute', top: -4, height: 14, left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, background: `${M_GOLD}2E`, borderLeft: `1px solid ${M_GOLD}99`, borderRight: `1px solid ${M_GOLD}99` }}/>}
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${pct(cur)}%`, borderRadius: 3, background: dim ? `${M_TEAL}55` : M_TEAL, boxShadow: dim ? 'none' : `0 0 8px ${M_TEAL}55` }}/>
      <div style={{ position: 'absolute', top: -3, left: `calc(${pct(cur)}% - 1px)`, width: 2, height: 12, borderRadius: 1, background: dim ? `${M_TEAL}88` : '#EDEDED' }}/>
      {narrowed && (below
        ? <div style={{ position: 'absolute', top: 9, left: `calc(${pct(hi)}% - 4px)`, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: `5px solid ${M_GOLD}`, animation: 'pulse 1.8s ease-in-out infinite' }}/>
        : <div style={{ position: 'absolute', top: -13, left: `calc(${pct(hi)}% - 4px)`, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: `5px solid ${M_GOLD}`, animation: 'pulse 1.8s ease-in-out infinite' }}/>)}
    </div>
  );
};

const AttrBar = ({ name, cur, lo, hi, w = 250, dim, narrowed, fatigued, row, nameW = 78, on }) => {
  if (row) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: w, cursor: 'pointer' }}>
      <span style={{ width: nameW, flexShrink: 0, fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', color: on ? M_TEAL : dim ? M_MUTED : M_DIM }}>{name}</span>
      <div style={{ flex: 1, minWidth: 0 }}><AttrTrack cur={cur} lo={lo} hi={hi} dim={dim} narrowed={narrowed} below/></div>
      <span style={{ width: 22, flexShrink: 0, textAlign: 'right', fontFamily: MONO, fontSize: 12, fontWeight: 600, color: fatigued ? M_GOLD : on ? M_TEAL : M_TEXT }}>{cur}</span>
    </div>
  );
  return (
    <div style={{ width: w }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 6 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.15em', color: dim ? M_MUTED : M_DIM, flex: 1 }}>{name}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: fatigued ? M_GOLD : M_TEXT }}>{cur}</span>
        {lo != null && <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_GOLD, opacity: .85 }}>{lo}&ndash;{hi}</span>}
      </div>
      <AttrTrack cur={cur} lo={lo} hi={hi} dim={dim} narrowed={narrowed}/>
    </div>
  );
};

// Typographic only — the existing label style, a rule, and the zero-sum pair.
const ATTR_SHORT = { READS: 'READS', FOCUS: 'FOCUS', DISCIPLINE: 'DISC', COMPOSURE: 'COMP', DECEPTION: 'DECEP', STAMINA: 'STAM' };
const NatureBadge = ({ nature, up, dn, size = 'm' }) => {
  const big = size === 'l';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: big ? 10 : 8, height: big ? 30 : 24, padding: big ? '0 12px' : '0 9px', borderRadius: 4, background: `${M_GOLD}0A`, border: `1px solid ${M_GOLD}3D`, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: OSWALD, fontSize: big ? 13 : 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: M_GOLD }}>{nature}</span>
      <span style={{ width: 1, height: big ? 15 : 12, background: `${M_GOLD}44` }}/>
      <span style={{ fontFamily: MONO, fontSize: big ? 10 : 9, color: M_TEAL }}>+{ATTR_SHORT[up] || up}</span>
      <span style={{ fontFamily: MONO, fontSize: big ? 10 : 9, color: M_MUTED }}>&minus;{ATTR_SHORT[dn] || dn}</span>
    </span>
  );
};

// Fatigue explains itself in words; the blocks are the redundant channel.
const FATIGUE = [
  { key: 'fresh',   word: 'fresh',      blocks: 3, color: M_TEAL, line: 'sharp — 12 hands in' },
  { key: 'settled', word: 'settled in', blocks: 2, color: M_TEAL, line: 'settled in — 68 hands' },
  { key: 'worn',    word: 'worn',       blocks: 1, color: M_GOLD, line: 'worn — 140 hands, Focus dipping' },
];

const FatigueMeter = ({ stage = 'fresh', w = 210 }) => {
  const f = FATIGUE.find(x => x.key === stage) || FATIGUE[0];
  return (
    <div style={{ width: w }}>
      <div style={{ display: 'flex', gap: 3, marginBottom: 7 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 2.5, background: i < f.blocks ? f.color : M_SURF, boxShadow: i < f.blocks ? `0 0 6px ${f.color}44` : 'none' }}/>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: f.color === M_GOLD ? M_GOLD : M_DIM, lineHeight: 1.4 }}>{f.line}</div>
    </div>
  );
};

// A growth tick is an EVENT with a cause, never a silent number change.
const GrowthTick = ({ attr, from, to, cause, w }) => (
  <div style={{ width: w, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 8, background: `${M_TEAL}0A`, border: `1px solid ${M_TEAL}33` }}>
    <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: M_TEAL, whiteSpace: 'nowrap' }}>{attr} {from} <span style={{ color: M_MUTED }}>&rarr;</span> {to}</span>
    <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED, lineHeight: 1.45 }}>{cause}</span>
  </div>
);

// ── S0 · PHILOSOPHY ──────────────────────────────────────────────────────────
const CharHalf = ({ tag, title, colour, lead, items, source, changes }) => (
  <div style={{ flex: 1, padding: '16px 18px 18px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${colour}3D` }}>
    <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: colour }}>{tag}</div>
    <div style={{ fontFamily: PLAYFAIR, fontSize: 23, fontWeight: 600, color: M_TEXT, margin: '5px 0 8px', letterSpacing: '-0.01em' }}>{title}</div>
    <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.6 }}>{lead}</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '13px 0 14px' }}>
      {items.map(i => (
        <span key={i} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: colour, background: `${colour}12`, border: `1px solid ${colour}33`, borderRadius: 3, padding: '4px 8px' }}>{i}</span>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '62px 1fr', rowGap: 6, columnGap: 10, fontSize: 11.5, lineHeight: 1.45 }}>
      <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED }}>SOURCE</span><span style={{ color: M_DIM }}>{source}</span>
      <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED }}>CHANGES</span><span style={{ color: M_DIM }}>{changes}</span>
    </div>
  </div>
);

const CharLaw = ({ n, children }) => (
  <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: `1px solid ${M_BORDER}` }}>
    <span style={{ fontFamily: MONO, fontSize: 10, color: M_GOLD, width: 16, flexShrink: 0, paddingTop: 2 }}>{n}</span>
    <span style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.55 }}>{children}</span>
  </div>
);

const CharPhilosophyM = () => (
  <Sheet title="Two halves, governed differently" sub="The split that makes Pok&eacute;mon and Football Manager work, and the one this product already half-shipped. You set the tactics. He grows the attributes. How you deploy him shapes who he becomes.">
    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
      <CharHalf tag="Half one · chosen" title="Strategy" colour={M_TEAL}
        lead={<>Already built, already validated: <b style={{ color: M_TEXT }}>strategy is the dominant factor in results</b>. It decides the war.</>}
        items={['Tightness', 'Aggression', 'Bluff frequency', 'Table selection']}
        source="the draft conversation" changes="only when he proposes and you accept"/>
      <CharHalf tag="Half two · grown" title="Attributes" colour={M_GOLD}
        lead={<>This system. Not what he tries to do — <b style={{ color: M_TEXT }}>how well he executes the strategy you gave him</b>. It decides execution variance.</>}
        items={['Reads', 'Focus', 'Discipline', 'Composure', 'Deception', 'Stamina']}
        source="a fixed birth budget, shaped by his nature" changes="slowly and permanently, by playing"/>
    </div>
    <div style={{ display: 'flex', gap: 20 }}>
      <div style={{ flex: 1 }}>
        <SyLbl color={M_GOLD}>Laws · non-negotiable</SyLbl>
        <CharLaw n="1">Attributes affect execution <b style={{ color: M_TEXT }}>within a bounded band</b>. Best-versus-worst attributes is a modest edge, felt over a week of sessions &mdash; never a rolled win. Strategy decides the war; attributes decide the execution.</CharLaw>
        <CharLaw n="2">There is <b style={{ color: M_TEXT }}>no purchase path for attributes, ever</b>. No store, no currency iconography, no timer you can skip. They are earned at the table or not at all.</CharLaw>
        <CharLaw n="3"><b style={{ color: M_TEXT }}>Fixed birth budget.</b> No build is strictly better than another, only different. A nature gives and takes in equal measure.</CharLaw>
        <CharLaw n="4">Nothing here <b style={{ color: M_TEXT }}>gates whether he can play</b>. Stamina degrades execution late in a session; it never locks the table, never asks for patience, never charges rent.</CharLaw>
        <CharLaw n="5">Every attribute must <b style={{ color: M_TEXT }}>name the thing it moves in his play</b>. A stat that changes nothing is an adjective, and adjectives are banned from this board.</CharLaw>
      </div>
      <div style={{ width: 340, flexShrink: 0 }}>
        <SyLbl>What the split buys</SyLbl>
        <div style={{ padding: '13px 15px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
          Two owners can give their agents the <b style={{ color: M_TEXT }}>identical strategy</b> and get two different players: one who reads the table a beat earlier, one who is still counting straight at hand four hundred. The strategy is the plan on the whiteboard. The attributes are the player you actually sent.
        </div>
        <div style={{ marginTop: 12, padding: '13px 15px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33`, fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
          <SyLbl color={M_RED}>Not in this system</SyLbl>
          <div style={{ marginTop: -3 }}>Aggression and tightness are <b style={{ color: M_TEXT }}>style</b> &mdash; chosen, not grown. Mood and fatigue are <b style={{ color: M_TEXT }}>state</b> &mdash; today, not forever. Relationships (nemesis, rival, favourite victim) are a separate <b style={{ color: M_TEXT }}>biography</b> layer, noted here and designed later.</div>
        </div>
      </div>
    </div>
  </Sheet>
);

// ── S1 · THE SIX ────────────────────────────────────────────────────────────
const AttrCell = ({ children, colour = M_DIM, size = 11.5, mono }) => (
  <div style={{ fontFamily: mono ? MONO : INTER, fontSize: size, color: colour, lineHeight: 1.5, paddingRight: 10 }}>{children}</div>
);

const AttributesSheetM = () => {
  const cols = `96px repeat(6, 1fr)`;
  const rows = [
    ['Means', a => <AttrCell colour={M_TEXT}>{a.mean}</AttrCell>],
    ['Moves in his play', a => <AttrCell>{a.moves}</AttrCell>],
    ['Trained by', a => <AttrCell colour={M_TEAL}>{a.trains}</AttrCell>],
    ['He says', a => <AttrCell colour={M_MUTED} size={11.5}><span style={{ fontStyle: 'italic' }}>{a.voice}</span></AttrCell>],
  ];
  return (
    <Sheet title="The six attributes" sub="0–100 each. Every one names a mechanic it moves — no adjectives. Aggression and tightness are deliberately absent: those are style, chosen in the draft, not grown at the table.">
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'end', paddingBottom: 14, borderBottom: `1px solid ${M_BORDER}` }}>
        <SyLbl>Current<br/>&amp; scouted</SyLbl>
        {ATTRS.map(a => <AttrBar key={a.k} name={a.k} cur={a.cur} lo={a.lo} hi={a.hi} w="100%"/>)}
      </div>
      {rows.map(([label, render]) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '13px 0', borderBottom: `1px solid ${M_BORDER}`, alignItems: 'start' }}>
          <SyLbl>{label}</SyLbl>
          {ATTRS.map(a => <div key={a.k}>{render(a)}</div>)}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 14, marginTop: 18 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>The pairings that matter</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            <b style={{ color: M_TEXT }}>Stamina gates Focus and Discipline</b> late in a session &mdash; it is the only attribute that acts on other attributes. <b style={{ color: M_TEXT }}>Composure gates everything</b> while he is tilted. Reads and Deception are the two sides of the same table: how fast he solves them, how slowly they solve him.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
          <SyLbl color={M_GOLD}>How they are read on a screen</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            Never as a radar chart, never as a grade. Six bars in fixed order &mdash; <span style={{ fontFamily: MONO, fontSize: 11 }}>READS · FOCUS · DISCIPLINE · COMPOSURE · DECEPTION · STAMINA</span> &mdash; so the shape of an agent becomes recognisable at a glance across every surface. Order is law.
          </div>
        </div>
      </div>
    </Sheet>
  );
};

// ── S2 · NATURES ────────────────────────────────────────────────────────────
const NaturesSheetM = () => (
  <Sheet title="Eight natures" sub={`One assigned at birth, read out of the draft conversation. Zero-sum: +1 step to one attribute, −1 to another, where a step is ±${ATTR_STEP} points and the same shift on the potential band. Announced at birth in his own voice — never hidden, never re-rolled, never changed again.`}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 26px' }}>
      {NATURES.map((t, i) => (
        <div key={t.n} style={{ display: 'flex', gap: 14, padding: '14px 0', borderTop: i > 1 ? `1px solid ${M_BORDER}` : 'none' }}>
          <div style={{ width: 176, flexShrink: 0 }}>
            <NatureBadge nature={t.n} up={t.up} dn={t.dn}/>
            <div style={{ display: 'flex', gap: 10, marginTop: 9 }}>
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_TEAL }}>+{ATTR_STEP} {t.up}</span>
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED }}>&minus;{ATTR_STEP} {t.dn}</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: M_DIM, fontStyle: 'italic', lineHeight: 1.5 }}>&ldquo;{t.sig}&rdquo;</div>
            <div style={{ fontSize: 11.5, color: M_GOLD, marginTop: 7, lineHeight: 1.5, opacity: .9 }}>{t.birth}</div>
          </div>
        </div>
      ))}
    </div>

    <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${M_BORDER}`, display: 'flex', gap: 22 }}>
      <div style={{ width: 330, flexShrink: 0 }}>
        <SyLbl>Birth announcement · the moment</SyLbl>
        <div style={{ padding: '16px 16px 18px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_GOLD}33` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MoodGhost mood="neutral" accent={M_TEAL} size={46}/>
            <div>
              <div style={{ fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT }}>Grinder v1.0</div>
              <div style={{ marginTop: 6 }}><NatureBadge nature="Rock" up="DISCIPLINE" dn="READS"/></div>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: M_DIM, lineHeight: 1.6, fontStyle: 'italic' }}>
            &ldquo;There is something stubborn in this one. He is a Rock.&rdquo;
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <AttrBar name="DISCIPLINE" cur={50} lo={82} hi={96} w="100%"/>
            <AttrBar name="READS" cur={30} lo={52} hi={76} w="100%" dim/>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, marginTop: 11, lineHeight: 1.5 }}>the two moved attributes animate to their shifted values on reveal; the other four are already at rest</div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <SyLbl color={M_TEAL}>Badge law</SyLbl>
        <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.65 }}>
          The badge is <b style={{ color: M_TEXT }}>typographic and nothing else</b> &mdash; the existing Oswald label treatment in gold, a hairline rule, and the zero-sum pair in mono. No crest, no emblem, no invented icon: an agent&rsquo;s picture is his ghost, and a second graphic identity would compete with it. Two sizes only: <span style={{ fontFamily: MONO, fontSize: 11 }}>m</span> for the profile card and lists, <span style={{ fontFamily: MONO, fontSize: 11 }}>l</span> for the birth moment.
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <NatureBadge nature="Sphinx" up="COMPOSURE" dn="FOCUS" size="l"/>
          <NatureBadge nature="Shark" up="READS" dn="COMPOSURE"/>
        </div>
        <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
          <SyLbl color={M_GOLD}>Why zero-sum, and why visible</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            A hidden nature would make the draft conversation feel like a slot machine, and a nature that only gives would make one draft answer strictly correct. Visible and zero-sum, it does the opposite job: it is the first thing the owner learns about a character he has not watched play yet, and it is <b style={{ color: M_TEXT }}>a reason to deploy him differently</b> rather than a reason to re-roll. Eight natures, four attributes buffed twice over, no pair repeated.
          </div>
        </div>
      </div>
    </div>
  </Sheet>
);

Object.assign(window, { ATTRS, NATURES, ATTR_STEP, ATTR_SHORT, FATIGUE, AttrBar, AttrTrack, NatureBadge, FatigueMeter, GrowthTick, CharPhilosophyM, AttributesSheetM, NaturesSheetM });
