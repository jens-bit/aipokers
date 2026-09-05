// WATCH v4 — the screens, the extended haptic table, the matrix, desktop parity.

const B4F = [['K', 'c'], ['9', 'c'], ['4', 'c'], ['2', 'c'], null];
const B5F = [['K', 'c'], ['9', 'c'], ['4', 'c'], ['2', 'c'], ['5', 'h']];

const W4Shell = ({ children }) => <PhoneShell>{children}</PhoneShell>;

// ═══ 1 · DEAL, mid-arrival ════════════════════════════════════════════════
const W4DealScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="deal" pot="30" board={[]} flip={0} equity={50} dead dealt={false} landed={1}
      hero={<HeroRow4 street="PREFLOP" landed={1} note="dealing…"/>}/>
    <Tabs4 active="voice"/>
    <VoiceFeed truth="DEALING HAND 43 · $5/$10 · 6-MAX" lines={VOICE.slice(0, 2)}/>
  </W4Shell>
);

// ═══ 2 · DEAL, a hand worth having ═══════════════════════════════════════
const W4DealWarmScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="deal" pot="30" board={[]} flip={0} equity={67} dealt landed={2} warm
      line="Ace-king. Now we are talking."
      hero={<HeroRow4 street="PREFLOP" landed={2} warm/>}/>
    <Tabs4 active="voice"/>
    <VoiceFeed truth="HAND 43 · PRE-FLOP EQUITY 67% VS THE TABLE" lines={VOICE.slice(0, 1)}/>
  </W4Shell>
);

// ═══ 3 · CALM, six bodies at a table ═════════════════════════════════════
const W4CalmScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="calm" pot="480" board={B4F} flip={4} equity={87} acting="granite"
      line="He checked twice. He's got nothing."
      hero={<HeroRow4 toCall="240" action="BET $240" timer={9}/>}/>
    <Tabs4 active="voice"/>
    <VoiceFeed/>
  </W4Shell>
);

// ═══ 4 · A SEAT TAPPED — the read, behind the person ═════════════════════
const W4ReadSheetScreenM = () => (
  <W4Shell>
    <W4Header/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <div style={{ opacity: 0.55 }}>
        <Felt4 pace="calm" pot="480" board={B4F} flip={4} equity={87} selected="granite"
          line="He checked twice. He's got nothing."
          hero={<HeroRow4 toCall="240" action="BET $240" timer={9}/>}/>
      </div>
      <ReadSheet4 id="granite"/>
    </div>
  </W4Shell>
);

// ═══ 5 · A THIN READ — twenty-two hands is not a read ════════════════════
const W4ThinReadScreenM = () => (
  <W4Shell>
    <W4Header/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <div style={{ opacity: 0.55 }}>
        <Felt4 pace="calm" pot="480" board={B4F} flip={4} equity={87} selected="nash"
          line="He checked twice. He's got nothing."
          hero={<HeroRow4 toCall="240" action="BET $240" timer={9}/>}/>
      </div>
      <ReadSheet4 id="nash"/>
    </div>
  </W4Shell>
);

// ═══ 6 · HEATING ════════════════════════════════════════════════════════
const W4HeatingScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="heating" pot="1,240" board={B4F} flip={4} equity={71} acting="granite"
      line="Now it's a real pot. Good."
      hero={<HeroRow4 toCall="620" action="BET $620" timer={7}/>}/>
    <Tabs4 active="voice"/>
    <VoiceFeed lines={[...VOICE, { t: 'him', s: 'Six hundred and twenty. He is not folding.', at: '18:33', now: true }]}/>
  </W4Shell>
);

// ═══ 7 · ALL-IN ═════════════════════════════════════════════════════════
const W4AllInScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="allin" h={440} pot="3,694" board={B4F} flip={4} equity={64}
      line="All of it. He's drawing."
      hero={<HeroRow4 action="ALL-IN" tag="RIVER IN 3"/>}/>
    <Tabs4 active="voice"/>
    <VoiceFeed lines={[{ t: 'talk', who: 'Granite', s: 'Call.', at: '18:33' }, { t: 'him', s: 'All of it. He\u2019s drawing.', at: '18:33', now: true }]}/>
  </W4Shell>
);

// ═══ 8 · SHOWDOWN — and the table reacts ════════════════════════════════
const W4_SHOWDOWN_SEATS = W4_SEATS.map(s =>
  s.id === 'granite' ? { ...s, mood: 'tilted' }
  : s.id === 'phil' ? { ...s, mood: 'neutral' }
  : s);

const W4ShowdownScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="showdown" h={440} pot="3,694" board={B5F} flip={5} equity={100} potTo
      seats={W4_SHOWDOWN_SEATS} line="Told you. Nothing."
      hero={
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 4, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 12, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}66` }}>
          <HeroCards4 landed={2}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Lbl size={8.5} color={M_TEAL}>Ace-high flush</Lbl>
            <div style={{ fontSize: 11.5, color: M_DIM, marginTop: 2 }}>Granite showed king-nine</div>
          </div>
          <Num size={17} weight={700} color={M_TEAL}>+$3,694</Num>
        </div>
      }/>
    <Tabs4 active="voice"/>
    <VoiceFeed truth="+$3,694 THIS HAND · HIS BIGGEST POT TONIGHT"
      lines={[{ t: 'him', s: 'Told you. Nothing.', at: '18:34', now: true }, { t: 'talk', who: 'Granite', s: 'Nice hand.', at: '18:34' }]}/>
  </W4Shell>
);

// ═══ 9 · BETWEEN HANDS — where the cause line lives now ═════════════════
const W4BetweenScreenM = () => (
  <W4Shell>
    <W4Header/>
    <BetweenStrip4 cause="rolling — three big pots in a row"
      truth="+$3,712 TONIGHT · 43 HANDS · WORST BEAT: THE Q3o ON HAND 19" next={8}/>
    <Felt4 pace="calm" h={400} pot="—" board={[]} flip={0} equity={50} dead dealt={false}
      hero={<HeroRow4 street="SHUFFLING" landed={0} note="between hands"/>}/>
    <Tabs4 active="voice"/>
    <VoiceFeed lines={[{ t: 'him', s: 'Good table. I will take another orbit here.', at: '18:34', now: true }]}/>
  </W4Shell>
);

// ── the haptic table, extended for the deal ───────────────────────────────
const HAPTIC4 = [
  { ev: 'Hero card 1 lands', hap: 'impactOccurred(\u2018light\u2019)', snd: 'deal tick', note: 'the beat that starts the hand', neu: true },
  { ev: 'Hero card 2 lands', hap: 'impactOccurred(\u2018light\u2019)', snd: 'deal tick', note: '90ms after the first, never simultaneous', neu: true },
  { ev: 'Table backs dealt', hap: '\u2014 none', snd: 'one soft sweep', note: 'five seats in 200ms as a single gesture', neu: true },
  { ev: 'Premium hand warms', hap: 'impactOccurred(\u2018soft\u2019)', snd: '\u2014 none', note: 'owner-only. Never fires for a spectator.', neu: true },
  { ev: 'Seat tapped \u00b7 read opens', hap: 'selectionChanged()', snd: '\u2014 none', note: 'the sheet is the feedback', neu: true },
  { ev: 'Opponent posture shifts', hap: '\u2014 none', snd: '\u2014 none', note: 'silent, always. Their moods are not events.', neu: true },
];

const Haptic4SheetM = () => (
  <Sheet title="Six new rows for the deal" sub="Appended to the wave-33 table, and bound by its rules: haptics fire on HIS events only, never two inside 120ms, and nothing fires for an unwatched hand. The deal is the first beat in the product with a rhythm rather than a single tap.">
    <div style={{ display: 'grid', gridTemplateColumns: '196px 216px 1fr 1fr', gap: '0 14px' }}>
      {['Event', 'Telegram haptic', 'Sound', 'Notes'].map(h => (
        <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>{h}</div>
      ))}
      {HAPTIC4.map(r => (
        <React.Fragment key={r.ev}>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 12.5, color: M_TEXT }}>{r.ev}</div>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontFamily: MONO, fontSize: 10.5, color: r.hap.startsWith('\u2014') ? M_MUTED : M_TEAL }}>{r.hap}</div>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 12, color: r.snd.startsWith('\u2014') ? M_MUTED : M_DIM }}>{r.snd}</div>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED }}>{r.note}</div>
        </React.Fragment>
      ))}
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>The deal is a rhythm, not an event</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Two light taps 90ms apart, then a sweep. That interval is the whole design: <b style={{ color: M_TEXT }}>fast enough to feel like one action, slow enough to feel like two cards</b>. Under 60ms it reads as a stutter; over 140ms it reads as a delay.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
        <SyLbl color={M_RED}>Owner-only, enforced</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          The premium warm and its soft tap are a <b style={{ color: M_TEXT }}>private read on his own hand</b>. If the watch screen is ever shared or spectated, both are suppressed &mdash; the gold edge is not a table effect and must never render on somebody else&rsquo;s felt.
        </div>
      </div>
    </div>
  </Sheet>
);

// ── the state matrix rows ─────────────────────────────────────────────────
const W4MatrixM = () => {
  const cols = '116px repeat(5, 1fr)';
  const surfaces = ['Hero cards', 'Seated ghosts', 'The rope', 'His line', 'Voice feed'];
  const rows = [
    { k: 'DEAL', c: M_TEAL, cells: [
      'slide in one at a time, 90ms apart; gold edge if premium (owner-only)',
      'backs land as one sweep after his cards; postures already running',
      'dead centre until both cards are in, then jumps to pre-flop equity',
      'only if the hand is worth a word — most deals get none',
      'the hand number and the stakes, nothing else yet'] },
    { k: 'CALM', c: M_MUTED, cells: [
      'face up, no edge', 'acting seat gets a teal pool; folded seats 34% and desaturated',
      'live from the deal', '≤12 words, above the rope', 'his decision lines, table talk woven in'] },
    { k: 'HEATING', c: M_GOLD, cells: [
      'unchanged', 'unchanged — a hot pot is not their news',
      'thickens to 12px', 'unchanged', 'his sizing line, as it happens'] },
    { k: 'ALL-IN', c: M_RED, cells: [
      'unchanged', 'unchanged', 'held at the committed number',
      'Playfair 15 in a box, held 3–5s', 'their call, then his line'] },
    { k: 'SHOWDOWN', c: M_TEAL, cells: [
      'the result card replaces the hero row',
      'every seat reacts in POSTURE — the loser tilts, the folded stay folded',
      'jumps to 100 or 0', 'one line, and it is allowed to gloat',
      'the pot figure as session truth'] },
    { k: 'SEAT TAPPED', c: M_TEAL, cells: [
      'unchanged — the hand keeps playing behind the sheet',
      'the tapped ghost gets a teal ring; the felt drops to 55%',
      'unchanged', 'unchanged', 'replaced by the read sheet, not dismissed'] },
    { k: 'BETWEEN HANDS', c: M_MUTED, cells: [
      'face down, stack still shown',
      'postures continue — this is where a tilted opponent is most readable',
      'dead centre, no number', 'one line, unhurried',
      'the session truth line: net, hands, worst beat'] },
  ];
  return (
    <Sheet title="State matrix · watch v4" sub="Five columns because the felt now has five moving parts. The DEAL row is new; SEAT TAPPED is new; the other five are v3's states re-read against bodies instead of chips.">
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>
        <div/>
        {surfaces.map(h => <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingLeft: 11 }}>{h}</div>)}
      </div>
      {rows.map(r => (
        <div key={r.k} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 0', borderBottom: `1px solid ${M_BORDER}` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: r.c, paddingTop: 10 }}>{r.k}</div>
          {r.cells.map((c, i) => (
            <div key={i} style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.45, padding: '9px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{c}</div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>Removed by this wave</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            <b style={{ color: M_TEXT }}>The READ tab.</b> A read is a fact about one opponent, so it lives behind that opponent &mdash; five reads, five seats, and no tab that has to hold six of anything. Also gone: the 96px of header chrome above the felt, and the MoodBand, whose only load-bearing part was the cause line.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
          <SyLbl color={M_GOLD}>Stacking order, as law</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            <span style={{ fontFamily: MONO, fontSize: 11 }}>rope 276 &rarr; line 313 &rarr; hero row bottom 12</span>. The line is never pinned without a relationship to what sits under it &mdash; that was the v3 bug, and on a 420px felt there is exactly 12px of slack between each band.
          </div>
        </div>
      </div>
    </Sheet>
  );
};

// ── desktop parity ───────────────────────────────────────────────────────
const D6W4Shell = ({ children }) => (
  <DesktopShell>
    <DeskTopBar net="+$3,712" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>{children}</div>
  </DesktopShell>
);

const D6_SEATS = [
  { id: 'granite', name: 'Granite', stack: '2,104', pos: 'BB', x: 300, y: 40, mood: 'neutral', accent: M_GOLD, house: true, history: 3 },
  { id: 'phil', name: 'Phil_AI', stack: '1,960', pos: 'SB', x: 470, y: 24, mood: 'confident', accent: M_TEAL, house: true },
  { id: 'doyle', name: 'doyle_v3', stack: '1,290', pos: 'CO', x: 640, y: 40, mood: 'sulking', accent: M_PINK, folded: true },
  { id: 'nash', name: 'nash_eq', stack: '3,410', pos: 'UTG', x: 176, y: 208, mood: 'frustrated', accent: M_PURPLE, agent: true },
  { id: 'ivey', name: 'ivey_bot', stack: '880', pos: 'HJ', x: 764, y: 208, mood: 'tilted', accent: M_RED, folded: true },
];

const D6W4WatchScreenM = () => (
  <D6W4Shell>
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 48% 42%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)' }}>
      <div style={{ position: 'absolute', left: '-8%', right: '-8%', top: 76, bottom: 96, borderRadius: '50%', border: `1px solid ${M_TEAL}1A`, pointerEvents: 'none' }}/>
      {D6_SEATS.map(s => (
        <div key={s.id} style={{ position: 'absolute', left: s.x, top: s.y, transform: 'translateX(-50%)', zIndex: 3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ position: 'relative', opacity: s.folded ? 0.36 : 1 }}>
              {s.id === 'granite' && (
                <div style={{ position: 'absolute', left: '50%', top: '52%', width: 130, height: 130, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_TEAL}26, transparent 68%)`, animation: 'shimmer 1.6s ease-in-out infinite' }}/>
              )}
              <FloorGhost mood={s.mood} accent={s.accent} size={62} speed={s.mood === 'tilted' ? 3.2 : 5.6}/>
              {s.history && (
                <span style={{ position: 'absolute', top: 0, left: -8, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, background: 'rgba(19,19,22,0.95)', border: `1px solid ${M_GOLD}`, color: M_GOLD, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.history}</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 9px', borderRadius: 11, background: 'rgba(14,17,18,0.8)', border: `1px solid ${s.id === 'granite' ? `${M_TEAL}66` : M_BORDER}`, opacity: s.folded ? 0.5 : 1 }}>
              <span style={{ fontSize: 11.5, color: M_DIM, fontWeight: 500 }}>{s.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{s.stack}</span>
            </div>
          </div>
        </div>
      ))}

      <div style={{ position: 'absolute', top: 300, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 18px', borderRadius: 20, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
          <Lbl size={9.5}>Pot</Lbl>
          <Amt size={30}>$480</Amt>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 366, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 3 }}>
        {B4F.map((c, i) => c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={58} h={80}/> : <CardBack key={i} w={58} h={80} branded/>)}
      </div>
      <div style={{ position: 'absolute', top: 470, left: '28%', right: '28%', zIndex: 3 }}><TugBar equity={87}/></div>
      <div style={{ position: 'absolute', top: 528, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
        <span style={{ fontFamily: PLAYFAIR, fontSize: 19, fontWeight: 600, color: M_TEXT }}>&ldquo;He checked twice. He&rsquo;s got nothing.&rdquo;</span>
      </div>
      <div style={{ position: 'absolute', left: 28, right: 28, bottom: 22, zIndex: 4, display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 14, background: 'rgba(23,27,27,0.8)', border: `1px solid ${M_TEAL}55` }}>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {W4_HERO.hole.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={44} h={61}/>)}
        </div>
        <div style={{ width: 1, height: 26, background: M_BORDER }}/>
        <div><Lbl size={8.5}>Stack</Lbl><div><Num size={14} weight={700}>${W4_HERO.stack}</Num></div></div>
        <div style={{ width: 1, height: 26, background: M_BORDER }}/>
        <div><Lbl size={8.5}>To call</Lbl><div><Num size={14} weight={700} color={M_GOLD}>$240</Num></div></div>
        <div style={{ flex: 1 }}/>
        <span style={{ padding: '7px 14px', borderRadius: 6, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' }}>BET $240</span>
        <SeatTimerRing value={9}/>
      </div>
    </div>
    <Panel>
      <PanelHead title="Balanced v2.1" sub="LIVE · $5/$10 6-MAX"/>
      <div style={{ flexShrink: 0, padding: '10px 14px 11px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL_2 }}>
        <Num size={9} color={M_MUTED} weight={500}>+$3,712 TONIGHT &middot; 43 HANDS &middot; WORST BEAT: THE Q3o ON HAND 19</Num>
      </div>
      <Tabs4 active="voice"/>
      <VoiceFeed/>
    </Panel>
  </D6W4Shell>
);

const D6W4ReadScreenM = () => (
  <D6W4Shell>
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 48% 42%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)', opacity: 0.62 }}>
      <div style={{ position: 'absolute', left: '-8%', right: '-8%', top: 76, bottom: 96, borderRadius: '50%', border: `1px solid ${M_TEAL}1A`, pointerEvents: 'none' }}/>
      {D6_SEATS.map(s => (
        <div key={s.id} style={{ position: 'absolute', left: s.x, top: s.y, transform: 'translateX(-50%)', zIndex: 3 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ position: 'relative', opacity: s.folded ? 0.36 : 1 }}>
              {s.id === 'granite' && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 82, height: 82, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `1px solid ${M_TEAL}`, boxShadow: `0 0 16px ${M_TEAL}66` }}/>}
              <FloorGhost mood={s.mood} accent={s.accent} size={62} speed={5.6}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 9px', borderRadius: 11, background: 'rgba(14,17,18,0.8)', border: `1px solid ${M_BORDER}` }}>
              <span style={{ fontSize: 11.5, color: M_DIM, fontWeight: 500 }}>{s.name}</span>
            </div>
          </div>
        </div>
      ))}
      <div style={{ position: 'absolute', top: 366, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 3 }}>
        {B4F.map((c, i) => c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={58} h={80}/> : <CardBack key={i} w={58} h={80} branded/>)}
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
            <div style={{ marginTop: 4 }}><Num size={9} color={M_MUTED} weight={500}>−$1,240 LIFETIME &middot; 142 HANDS</Num></div>
          </div>
        </div>
        <div style={{ padding: '12px 15px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          {READ_BOOK.granite.rows.map(r => <ReadBar key={r.k} {...r}/>)}
        </div>
        <div style={{ padding: '12px 15px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33`, fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic' }}>
          &ldquo;{READ_BOOK.granite.line}&rdquo;
        </div>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
          Click any other seat to read them instead. The hand keeps playing behind this panel &mdash; nothing about opening a read pauses the table.
        </div>
      </RailBody>
    </Panel>
  </D6W4Shell>
);

Object.assign(window, {
  B4F, B5F, HAPTIC4, D6_SEATS, W4_SHOWDOWN_SEATS,
  W4DealScreenM, W4DealWarmScreenM, W4CalmScreenM, W4ReadSheetScreenM, W4ThinReadScreenM,
  W4HeatingScreenM, W4AllInScreenM, W4ShowdownScreenM, W4BetweenScreenM,
  Haptic4SheetM, W4MatrixM, D6W4WatchScreenM, D6W4ReadScreenM,
});
