// THE FIRST FIVE MINUTES. Nine screens, one path, no dead ends.
//
// The rule that governs every empty state on this board: AN EMPTY STATE IS A ROOM
// THAT BREATHES, NOT A PLACEHOLDER SENTENCE. There is no "No agents yet", no "No
// hands to show", no illustrated void with a caption. Nothing here is missing —
// something has simply not happened yet, and the screen says which thing, in the
// voice of whoever would know: the room, the recruiter, or him.
//
// Composed entirely from locked components (waves 33 and 34) plus this file's own
// empty-state pieces. Nothing in char-*, mood-watch3, mood-wallet, mood-flow2,
// mood-birth3 or mood-casino2 is touched.

const FTU_PATH = [
  { n: '1', k: 'Telegram', act: 'Open the casino', empty: 'nothing yet — he has not been asked for anything' },
  { n: '2', k: 'The empty floor', act: 'Draft your first agent', empty: 'no agents' },
  { n: '3', k: 'The draft', act: '— (talk first)', empty: 'no brief' },
  { n: '4', k: 'Brief usable', act: 'Deal him in', empty: '—' },
  { n: '5', k: 'The card', act: 'Deal him in', empty: 'no history to put on it' },
  { n: '6', k: 'He walks in', act: 'Watch him', empty: '—' },
  { n: '7', k: 'His first hand', act: 'Chat', empty: 'no reads yet' },
  { n: '8', k: 'His first recap', act: 'Deploy again', empty: 'no flagged hands' },
  { n: '9', k: 'You', act: 'Fund him properly', empty: 'nothing staked, no history' },
];

// ── the empty-state grammar, as one component ──────────────────────────────
// Three parts, always in this order: WHAT HAS NOT HAPPENED (in mono, small, as a
// fact), WHO SAYS SO (a voice, or the room), and WHAT WOULD FILL IT. Never an icon,
// never a centred illustration, never the word "empty".
const NotYet = ({ fact, voice, fills, color = M_MUTED }) => (
  <div style={{ padding: '12px 13px', borderRadius: 11, border: `1px dashed ${color}55`, background: 'transparent' }}>
    <Num size={9} color={color} weight={500}>{fact}</Num>
    {voice && <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.45, marginTop: 7, fontStyle: 'italic' }}>&ldquo;{voice}&rdquo;</div>}
    {fills && <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 7 }}>{fills}</div>}
  </div>
);

// ═══ 1 · TELEGRAM — the product's actual front door ════════════════════════
const FtuTelegramScreenM = () => (
  <PhoneShell>
    <TgHeader/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 12, background: M_BG }}>
      <TgDay>Today</TgDay>
      <TgMsg time="17:43" button="Open the casino">
        <b>There is a room, and there is an open seat in it.</b>
        <div style={{ marginTop: 7 }}>
          You will not be playing. You hire someone, tell him how to play, and he sits down
          without you.
        </div>
      </TgMsg>
      <TgMsg time="17:43" sub="847 agents in seats right now">
        Takes about a minute to hire one.
      </TgMsg>
    </div>
    <TgBar/>
  </PhoneShell>
);

// ═══ 2 · THE EMPTY FLOOR — no agents, and the room is open anyway ══════════
// The room is LIT. Bottles behind the bar, felts dressed, the light pools on. What
// is missing is one body, and the room shows that as an empty stool with a dashed
// rim — the same dashed language the drafting state uses, so the stool reads as
// reserved rather than broken.
const FtuEmptyFloorScreenM = () => {
  const L = LAYOUTS.quiet;
  return (
    <PhoneShell>
      <GlobalHeader title="Casino"/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.9 }}><RoomLayer layout="quiet" ftu/></div>
        <FloorStandup line="The room is open · 847 agents in seats"/>

        {/* the reserved stool: dashed, empty, and the only dashed thing in the room */}
        <div style={{ position: 'absolute', left: 92, top: L.bar.y - 84, transform: 'translateX(-50%)', zIndex: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', border: `1px dashed ${M_TEAL}66`, animation: 'drift 3.4s ease-in-out infinite' }}/>
            <Num size={8.5} color={M_TEAL} weight={500}>ONE OPEN SEAT</Num>
          </div>
        </div>
        {/* the room's own light says the rest — one ellipse of teal on an empty stool */}
        <div style={{ position: 'absolute', left: 92, top: L.bar.y - 100, transform: 'translateX(-50%)', width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle, ${M_TEAL}14, transparent 70%)`, pointerEvents: 'none' }}/>

        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 66, zIndex: 5 }}>
          <NotYet fact="NO AGENTS" color={M_TEAL}
            voice="Every felt in here is somebody's employee. You do not have one yet."
            fills="Hire one and he takes the stool."/>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 5, padding: '0 14px' }}>
          <Btn kind="primary" h={46} full>Draft your first agent</Btn>
        </div>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// ═══ 3 · THE DRAFT, EMPTY — the seat drawn, not a form ════════════════════
const FtuDraftEmptyScreenM = () => (
  <DraftScreen title="New agent"
    band={<DraftBand phase={0} cause="nothing decided yet" action="Skip"/>}
    placeholder="Describe how it should play…"
    suggest={['Tight and patient', 'Aggressive bluffer', 'Solver-strict']}>
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.18 }}>
        <FormingGhost size={140} phase={0}/>
      </div>
      <div style={{ flexShrink: 0 }}>
        <SysLine>Drafting · 17:44</SysLine>
        <RecruiterBubble time="17:44">
          One open seat. Tell me how it should play &mdash; style, risk, how tight, how aggressive.
          <div style={{ marginTop: 6, color: M_DIM, fontSize: 12.5 }}>
            Plain words work. &ldquo;Patient, hates bluffing, folds when it smells wrong.&rdquo;
          </div>
        </RecruiterBubble>
      </div>
    </div>
  </DraftScreen>
);

// ═══ 4 · BRIEF USABLE — the composer gives up its place ═══════════════════
const FtuDraftReadyScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="New agent"/>
    <DraftBand phase={0.84} cause="tight and patient · low variance" action="Skip" ready/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10, position: 'relative' }}>
      <div style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.08, pointerEvents: 'none', zIndex: 0 }}>
        <FormingGhost size={180} phase={0.84}/>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <OwnerBubble time="17:45">Tight and patient</OwnerBubble>
        <RecruiterBubble time="17:45">
          Understood. Few hands, big folds, and he will bore you on a slow night.
        </RecruiterBubble>
        <div style={{ padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
          <DraftStrip style={38} risk={24} tight={81} aggr={41}/>
        </div>
        <RecruiterBubble time="17:45">
          His temperament came out stubborn &mdash; that part is not something you set.
        </RecruiterBubble>
        <div style={{ padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
          <NatureFormed nature="Rock" up="DISCIPLINE" dn="READS"/>
        </div>
      </div>
    </div>
    <NextAction label="Deal him in" sub="STRATEGY SET · NATURE FORMED"/>
  </PhoneShell>
);

// ═══ 5 · THE CARD — his, with no history on it yet ════════════════════════
// BirthCard3 (locked) reads its own module-level cast, so it can only ever show the
// Hothead. The card is the most important screen on this path, so the FTU builds its
// own from FTU_AGENT out of the same exported parts — SheetFold, NatureBadge, the
// header well — and the anatomy stays identical: he is the headline, the sheet is a
// drawer, and the fold is closed because this is a first agent.
const FTU_AGENT = {
  name: 'Rock v1.0', accent: M_TEAL,
  nature: { n: 'Rock', up: 'DISCIPLINE', dn: 'READS' },
  first: "Patient, you said. Good. I'll hate folding and I'll do it anyway.",
  builtFor: 'Folding without regret, a thousand times a night, exactly when his own rules say to.',
  hole: [['A', 's'], ['10', 'd']],
  stack: '300',
};

const FtuBirthCard = () => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 7,
    background: M_PANEL, borderTop: `1px solid ${M_TEAL}44`,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    boxShadow: `0 -18px 44px rgba(0,0,0,0.6), 0 0 40px ${M_TEAL}14`,
    padding: '0 14px 16px', animation: 'sheetup 0.5s cubic-bezier(.2,.8,.2,1) both',
  }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: -34, marginBottom: 4 }}>
      <div style={{
        width: 68, height: 68, borderRadius: 20, background: '#0A0F17',
        border: `1px solid ${M_TEAL}66`, boxShadow: `0 0 26px ${M_TEAL}3D`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood="neutral" accent={M_TEAL} size={64} ring={false}/>
      </div>
    </div>
    <div style={{ textAlign: 'center', marginBottom: 12 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 25, fontWeight: 600, color: M_TEXT, letterSpacing: '-0.01em' }}>{FTU_AGENT.name}</div>
      <div style={{ marginTop: 9 }}><NatureBadge nature={FTU_AGENT.nature.n} up={FTU_AGENT.nature.up} dn={FTU_AGENT.nature.dn} size="l"/></div>
    </div>
    <div style={{ padding: '13px 15px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_TEAL}33`, marginBottom: 11 }}>
      <div style={{ fontSize: 14, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic' }}>&ldquo;{FTU_AGENT.first}&rdquo;</div>
    </div>
    <div style={{ display: 'flex', gap: 10, marginBottom: 12, padding: '0 2px' }}>
      <span style={{ width: 62, flexShrink: 0, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: M_TEAL, paddingTop: 2 }}>BUILT FOR</span>
      <span style={{ flex: 1, fontSize: 12.5, color: M_DIM, lineHeight: 1.45 }}>{FTU_AGENT.builtFor}</span>
    </div>
    <div style={{ marginBottom: 12 }}><SheetFold/></div>
    <Btn kind="primary" h={48} full>Deal him in</Btn>
    <div style={{ marginTop: 9, textAlign: 'center' }}>
      <Num size={9} color={M_MUTED} weight={500}>YOU CAN READ THE NUMBERS LATER · HE EXPLAINS THEM AS THEY MATTER</Num>
    </div>
  </div>
);

const FtuBirthCardScreenM = () => (
  <PhoneShell>
    {/* the rise is opacity-only here: `sheetup … both` pins its 0% frame whenever
        animations are suspended (throttled iframes, print, reduced-motion), and a
        translated 0% frame would push the sheet 44px past the fold and clip its
        footnote. Fading in costs nothing when it never runs. */}
    <style>{`@keyframes sheetup{from{opacity:0}to{opacity:1}}`}</style>
    <GlobalHeader title="Casino"/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <BirthRoom/>
      <FtuBirthCard/>
    </div>
    <TabBar active="casino"/>
  </PhoneShell>
);

// ═══ 6 · HE WALKS IN — into a room that was empty a minute ago ════════════
// Not the wave-34 walk-in: there is no live felt to dim against, so the room stays
// bright and HE is the only body in it. The stool he was reserved is now behind him.
const FtuWalkInScreenM = () => {
  const L = LAYOUTS.one;
  const f = L.felts[0];
  return (
    <PhoneShell>
      <GlobalHeader title="Casino"/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.92 }}><RoomLayer layout="one"/></div>
        <FloorStandup line="Rock v1.0 is taking a seat"/>
        <div style={{ position: 'absolute', left: f.cx - f.rx, top: f.cy - f.ry, width: f.rx * 2, height: f.ry * 2, borderRadius: '50%', border: `1px dashed ${M_TEAL}55`, pointerEvents: 'none' }}/>
        <WalkIn from={{ x: 40 }} to={{ x: 236, y: 292 }} name="Rock v1.0" accent={M_TEAL} size={52}/>
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 66, zIndex: 5 }}>
          <NotYet fact="HIS FIRST HAND HAS NOT BEEN DEALT" color={M_TEAL}
            voice="Deal. I want to see what this table does."
            fills="One hand and he starts building a read on everyone at it."/>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 5, padding: '0 14px' }}>
          <Btn kind="primary" h={46} full>Watch him</Btn>
        </div>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// ═══ 7 · HIS FIRST HAND — no reads, and he says so ═══════════════════════
// HeroRow3 (locked) reads a hardcoded hero — A♠K♥ off a $1,847 stack — which would
// contradict both his line and his $318 pocket. Local row, same anatomy, his cards.
const FtuHeroRow = () => (
  <div style={{
    position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 4,
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', borderRadius: 12,
    background: 'rgba(23,27,27,0.78)', border: `1px solid ${M_BORDER}`,
  }}>
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {FTU_AGENT.hole.map((c, i) => (
        <div key={i} style={{ transform: `rotate(${i ? 3 : -3}deg)`, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }}>
          <PlayingCard rank={c[0]} suit={c[1]} w={36} h={50}/>
        </div>
      ))}
    </div>
    <div style={{ width: 1, height: 20, background: M_BORDER, flexShrink: 0, marginLeft: 3 }}/>
    <div style={{ minWidth: 0 }}>
      <Lbl size={8.5}>Stack</Lbl>
      <div><Num size={12.5} weight={700}>${FTU_AGENT.stack}</Num></div>
    </div>
    <div style={{ width: 1, height: 20, background: M_BORDER, flexShrink: 0 }}/>
    <div style={{ minWidth: 0 }}>
      <Lbl size={8.5}>Street</Lbl>
      <div><Num size={12.5} weight={700} color={M_DIM}>PREFLOP</Num></div>
    </div>
    <div style={{ flex: 1 }}/>
    <span style={{ fontSize: 11.5, color: M_MUTED, whiteSpace: 'nowrap' }}>he&rsquo;s in</span>
  </div>
);

// PaceFelt (locked) hardcodes its opponent chip with `history="3"` — a three-hand
// grudge, asserted on the one screen whose entire point is that nothing has happened.
// The biography layer cannot exist on hand one, so the FTU draws its own calm felt:
// same anatomy, same geometry, plain seat chips. This is what the desktop twin does.
const FtuFirstFelt = ({ h = 330 }) => (
  <div style={{
    position: 'relative', flexShrink: 0, height: h, overflow: 'hidden',
    background: 'radial-gradient(ellipse at 50% 40%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)',
    borderBottom: `1px solid ${M_TEAL}38`,
  }}>
    <div style={{ position: 'absolute', left: '-14%', right: '-14%', top: 30, height: h - 32, borderRadius: '50%', border: `1px solid ${M_TEAL}1F`, pointerEvents: 'none' }}/>

    <div style={{ position: 'absolute', top: 10, left: 12, zIndex: 3 }}>
      <SeatChip name="Granite" stack="2,000" pos="BB"/>
    </div>
    <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}>
      <SeatChip name="doyle_v3" stack="1,860" pos="CO" align="right"/>
    </div>

    <div style={{ position: 'absolute', top: 62, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 13px', borderRadius: 18, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
        <Lbl size={9}>Pot</Lbl>
        <Amt size={23}>$30</Amt>
      </div>
    </div>

    <div style={{ position: 'absolute', top: 112, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 3 }}>
      {[0, 1, 2, 3, 4].map(i => <CardBack key={i} w={44} h={61} branded/>)}
    </div>

    {/* the rope, dead centre and never blank — a first hand really is 50/50 */}
    <div style={{ position: 'absolute', top: 186, left: 44, right: 44, zIndex: 3 }}>
      <TugBar equity={52}/>
    </div>

    <div style={{ position: 'absolute', bottom: 92, left: 16, right: 16, zIndex: 3, textAlign: 'center' }}>
      <span style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.4, fontStyle: 'italic' }}>Ace-ten. Fine. Let&rsquo;s see who&rsquo;s home.</span>
    </div>

    <FtuHeroRow/>
  </div>
);

const FtuFirstHandScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <MoodBand accent={M_TEAL} mood="neutral" state="live" action="Chat"
      cause="first hand — 40 seconds old"/>
    <FtuFirstFelt/>
    <Tabs3 active="read"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <ReadPanel rows={READ_EMPTY} hands={0} line="Give me a few hands."/>
    </div>
  </PhoneShell>
);

// ═══ 8 · HIS FIRST RECAP — nothing flagged, and that is the news ══════════
const FtuFirstRecapScreenM = () => (
  <ThreadScreen name="Rock v1.0" accent={M_TEAL} mood="neutral" state="recap" action="Deploy"
    cause="first session — +$18 over 40 hands">
    <SysLine>Session closed · 18:21</SysLine>
    <AgentBubble mood="neutral" accent={M_TEAL} time="18:21" expressive>
      Forty hands. I folded thirty-one of them and I am up eighteen dollars.
      <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>
        Net <span style={{ color: M_TEAL, fontWeight: 600, fontFamily: MONO }}>+$18</span> &middot; 40 hands &middot; 36m
      </div>
    </AgentBubble>
    {/* the cost line — the first and only time FOCUS explains itself */}
    <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '10px 12px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ flex: 1, fontSize: 12.5, color: M_DIM, lineHeight: 1.4 }}>He misjudged equity by 6% on the turn</span>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD, background: `${M_GOLD}1F`, border: `1px solid ${M_GOLD}88`, borderRadius: 3, padding: '3px 6px', cursor: 'pointer' }}>FOCUS</span>
      </div>
      <div style={{ marginTop: 7 }}><Num size={9} color={M_MUTED} weight={500}>HAND #29 &middot; TAP THE LABEL</Num></div>
    </div>
    <div style={{ margin: `0 ${CANON.pad}px 9px` }}>
      <NotYet fact="NOTHING WORTH FLAGGING" color={M_MUTED}
        voice="No big bluffs, no bad beats. It was a quiet first shift."
        fills="When a hand is worth watching, it arrives here as a replay you can scrub."/>
    </div>
    <AgentBubble mood="neutral" accent={M_TEAL} time="18:22">
      Same table tomorrow and I will know two of them.
    </AgentBubble>
  </ThreadScreen>
);

// ═══ 9 · YOU — the seeded wallet, one pocket, no history ══════════════════
const FTU_POCKET = {
  name: 'Rock v1.0', accent: M_TEAL, mood: 'neutral', state: 'recap',
  pocket: '318', stakes: '$1/$2', mode: 'topup', pnl: '+$18', action: 'Collect',
};

const FtuYouScreenM = () => (
  <PhoneShell>
    <GlobalHeader title="You"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ margin: '2px 14px 12px', padding: '14px 15px 15px', borderRadius: 14, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D` }}>
        <Lbl size={9.5}>Your wallet</Lbl>
        <div style={{ marginTop: 5 }}><Amt size={38}>$200.00</Amt></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${M_BORDER}` }}>
          <div style={{ flex: 1 }}>
            <Lbl size={8.5}>In pockets</Lbl>
            <div style={{ marginTop: 2 }}><Num size={13} weight={700} color={M_GOLD}>$318</Num></div>
          </div>
          <div style={{ width: 1, height: 26, background: M_BORDER }}/>
          <div style={{ flex: 1 }}>
            <Lbl size={8.5}>Tonight</Lbl>
            <div style={{ marginTop: 2 }}><Num size={13} weight={700} color={M_TEAL}>+$18</Num></div>
          </div>
          <div style={{ width: 1, height: 26, background: M_BORDER }}/>
          <div style={{ flex: 1 }}>
            <Lbl size={8.5}>Playing</Lbl>
            <div style={{ marginTop: 2 }}><Num size={13} weight={700}>0 of 1</Num></div>
          </div>
        </div>
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${M_BORDER}` }}>
          <Num size={9} color={M_MUTED} weight={500}>$500 SEEDED ON SIGN-UP &middot; $300 WENT INTO HIS POCKET</Num>
        </div>
      </div>

      <div style={{ padding: '0 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl size={9.5}>Pockets</Lbl>
        <span style={{ fontSize: 11, color: M_MUTED }}>pocket size sets his stakes</span>
      </div>
      <div style={{ margin: '0 14px 12px', padding: '2px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <PocketRow p={FTU_POCKET} last/>
      </div>

      <div style={{ margin: '0 14px 12px' }}>
        <NotYet fact="ONE SESSION OF HISTORY"
          voice={null}
          fills="A second session gives him a mood line to plot, and a week gives him a win rate worth believing. Until then the only honest number on this screen is the balance."/>
      </div>

      <div style={{ margin: '0 14px', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${M_GOLD}14`, border: `1px solid ${M_GOLD}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Biscuit size={15}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: M_TEXT }}>Snacks &middot; 2 free</div>
          <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 1 }}>For when he takes a beat badly. He has not yet.</div>
        </div>
        <Icon name="chevron-right" size={16} color={M_MUTED}/>
      </div>
    </div>
    <TabBar active="you"/>
  </PhoneShell>
);

// ── the path, as one strip ─────────────────────────────────────────────────
const FtuPathStrip = ({ w = 1180 }) => (
  <div style={{ width: w, background: M_PANEL, border: `1px solid ${M_BORDER}`, borderRadius: 14, padding: '18px 20px 20px', fontFamily: INTER }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <Lbl size={9.5} color={M_TEAL}>Nine screens, about five minutes</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      <Num size={9} color={M_MUTED} weight={500}>SIX OF THE NINE ARE EMPTY OF SOMETHING &mdash; NONE OF THEM SAYS SO IN A PLACEHOLDER</Num>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 8 }}>
      {FTU_PATH.map(s => (
        <div key={s.n} style={{ padding: '11px 11px 12px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${s.empty === '—' ? M_BORDER : `${M_TEAL}33`}` }}>
          <Num size={9} color={M_MUTED} weight={600}>{s.n}</Num>
          <div style={{ fontFamily: PLAYFAIR, fontSize: 14, fontWeight: 600, color: M_TEXT, marginTop: 5, lineHeight: 1.25 }}>{s.k}</div>
          <div style={{ marginTop: 8, fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.act.startsWith('—') ? M_MUTED : M_TEAL, lineHeight: 1.4 }}>{s.act}</div>
          <div style={{ marginTop: 9, paddingTop: 8, borderTop: `1px solid ${M_BORDER}`, fontFamily: MONO, fontSize: 8.5, color: s.empty === '—' ? M_FAINT : M_GOLD, lineHeight: 1.5 }}>{s.empty}</div>
        </div>
      ))}
    </div>
  </div>
);

// ── the empty-state law, and the new matrix rows ───────────────────────────
const FtuMatrixM = () => {
  const cols = '132px repeat(3, 1fr)';
  const rows = [
    { k: 'NO AGENTS', c: M_TEAL, cells: [
      'room lit, one dashed stool under a teal pool, "one open seat"',
      '“Every felt in here is somebody’s employee. You do not have one yet.”',
      'the room · it is the only party present'] },
    { k: 'NO BRIEF', c: M_TEAL, cells: [
      'the empty seat at 18%, phase 0, centred above the first message',
      '“One open seat. Tell me how it should play.”',
      'the recruiter · nobody exists to speak yet'] },
    { k: 'NO HANDS YET', c: M_TEAL, cells: [
      'the felt dealt but preflop; the rope sits dead centre, never blank',
      '“Deal. I want to see what this table does.”',
      'him · he is the one waiting'] },
    { k: 'NO READS YET', c: M_GOLD, cells: [
      'five bars empty with ·· for values; the confidence bracket absent',
      '“Give me a few hands.”',
      'him · and how fast this fills is what READS does'] },
    { k: 'NO FLAGGED HANDS', c: M_MUTED, cells: [
      'a dashed row in the recap where the replay card would sit',
      '“No big bluffs, no bad beats. It was a quiet first shift.”',
      'him · a quiet shift is a result, not a gap'] },
    { k: 'NOTHING STAKED', c: M_GOLD, cells: [
      'balance present, pockets $0, drain bar empty, Fund as the row action',
      '— no voice: the wallet is the owner’s, and it does not talk',
      'nobody · the only silent empty state on the board'] },
    { k: 'NO HISTORY', c: M_MUTED, cells: [
      'no arc, no win rate; the space says what a second session would add',
      '— stated plainly, as a limit of the data',
      'the product · admitting one number is not a trend'] },
  ];
  return (
    <Sheet title="Empty states, as state-matrix rows" sub="Seven rows, and the columns are not surfaces this time — they are the three parts of the grammar. Every empty state on this board names what has not happened, says who would know, and describes what would fill it. The word “empty” appears nowhere in the product.">
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>
        <div/>
        {['What is drawn', 'What is said', 'Who says it'].map(h => (
          <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingLeft: 11 }}>{h}</div>
        ))}
      </div>
      {rows.map(r => (
        <div key={r.k} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 0', borderBottom: `1px solid ${M_BORDER}` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: r.c, paddingTop: 10 }}>{r.k}</div>
          {r.cells.map((c, i) => (
            <div key={i} style={{ fontSize: 11.5, color: c.startsWith('—') ? M_MUTED : M_DIM, lineHeight: 1.45, padding: '9px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, fontStyle: i === 1 && !c.startsWith('—') ? 'italic' : 'normal' }}>{c}</div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>The grammar</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            One component, <span style={{ fontFamily: MONO, fontSize: 11 }}>NotYet</span>, and a dashed border in the colour of whatever is missing. <b style={{ color: M_TEXT }}>No icon, no centred illustration, no button inside the box</b> — the primary action already lives at the foot of the screen and does not need repeating two inches above itself.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
          <SyLbl color={M_RED}>Banned on this board</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            &ldquo;No agents yet.&rdquo; &ldquo;Nothing to see here.&rdquo; A spinner standing in for a state. A tour, a tooltip sequence, a progress checklist, a confetti moment. <b style={{ color: M_TEXT }}>And any screen with two primary actions</b>, which is the same bug as having none.
          </div>
        </div>
      </div>
    </Sheet>
  );
};

// ── desktop parity ────────────────────────────────────────────────────────
const D5FtuLoginScreenM = () => (
  <DesktopShell>
    <div style={{ flex: 1, display: 'flex', minHeight: 0, background: M_BG, position: 'relative', overflow: 'hidden' }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <DeskFloor layout="quiet" ftu/>
      </div>
      <div style={{ width: 520, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 44px' }}>
        <SpadeLogo/>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 38, fontWeight: 600, color: M_TEXT, lineHeight: 1.15, letterSpacing: '-0.015em', marginTop: 20 }}>
          There is a room,<br/>and an open seat<br/>in it.
        </div>
        <div style={{ fontSize: 14, color: M_DIM, lineHeight: 1.6, marginTop: 18 }}>
          You will not be playing. You hire someone, tell him how to play, and he sits down without you &mdash; tonight, and every night after, whether you are watching or not.
        </div>
        <div style={{ marginTop: 26, width: 260 }}>
          <Btn kind="primary" h={48} full>Continue with Telegram</Btn>
        </div>
        <div style={{ marginTop: 14 }}>
          <Num size={9} color={M_MUTED} weight={500}>847 AGENTS IN SEATS RIGHT NOW &middot; $500 SEEDED ON SIGN-UP</Num>
        </div>
      </div>
    </div>
  </DesktopShell>
);

const D5FtuEmptyScreenM = () => (
  <DesktopShell>
    <DeskTopBar standupLine="The room is open · 847 agents in seats" net="—" flagged="—"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <DeskFloor layout="quiet" ftu/>
        <div style={{ position: 'absolute', left: 250, bottom: 210, zIndex: 4, transform: 'translateX(-50%)' }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 240, height: 240, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_TEAL}14, transparent 70%)` }}/>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, position: 'relative' }}>
            <div style={{ width: 86, height: 86, borderRadius: '50%', border: `1px dashed ${M_TEAL}66`, animation: 'drift 3.4s ease-in-out infinite' }}/>
            <Num size={9.5} color={M_TEAL} weight={500}>ONE OPEN SEAT</Num>
          </div>
        </div>
      </div>
      <Panel>
        <PanelHead title="The room" sub="NO AGENTS YET"/>
        <RailBody>
          <NotYet fact="NO AGENTS" color={M_TEAL}
            voice="Every felt in here is somebody's employee. You do not have one yet."
            fills="Hire one and he takes the stool."/>
          <Btn kind="primary" h={44} full>Draft your first agent</Btn>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, fontSize: 12, color: M_DIM, lineHeight: 1.55 }}>
            <Lbl size={9.5}>What happens next</Lbl>
            <div style={{ marginTop: 7 }}>
              A minute of conversation, then he is born with a temperament of his own and takes a seat. <b style={{ color: M_TEXT }}>$500 is already in your wallet</b>; $300 of it goes into his pocket, which is what decides the stakes he plays.
            </div>
          </div>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

const D5FtuFirstHandScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$0" flagged="0 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 48% 40%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)' }}>
        <div style={{ position: 'absolute', left: '-8%', right: '-8%', top: 40, bottom: 40, borderRadius: '50%', border: `1px solid ${M_TEAL}1A`, pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', top: 22, left: 28, zIndex: 3 }}><SeatChip name="Granite" stack="2,000" pos="BB"/></div>
        <div style={{ position: 'absolute', top: 22, right: 28, zIndex: 3 }}><SeatChip name="doyle_v3" stack="1,860" pos="CO" align="right"/></div>
        <div style={{ position: 'absolute', top: 96, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 18px', borderRadius: 20, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
            <Lbl size={9.5}>Pot</Lbl>
            <Amt size={30}>$30</Amt>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 172, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 3 }}>
          {[0, 1, 2, 3, 4].map(i => <CardBack key={i} w={62} h={86} branded/>)}
        </div>
        <div style={{ position: 'absolute', top: 288, left: '28%', right: '28%', zIndex: 3 }}><TugBar equity={52} big/></div>
        <div style={{ position: 'absolute', top: 348, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
          <span style={{ fontFamily: PLAYFAIR, fontSize: 20, fontWeight: 600, color: M_TEXT }}>&ldquo;Ace-ten. Fine. Let&rsquo;s see who&rsquo;s home.&rdquo;</span>
        </div>
        <div style={{ position: 'absolute', left: 28, right: 28, bottom: 22, zIndex: 4, display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 14, background: 'rgba(23,27,27,0.8)', border: `1px solid ${M_BORDER}` }}>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <PlayingCard rank="A" suit="s" w={44} h={61}/>
            <PlayingCard rank="10" suit="d" w={44} h={61}/>
          </div>
          <div style={{ width: 1, height: 26, background: M_BORDER }}/>
          <div><Lbl size={8.5}>Stack</Lbl><div><Num size={14} weight={700}>$300</Num></div></div>
          <div style={{ width: 1, height: 26, background: M_BORDER }}/>
          <div><Lbl size={8.5}>Street</Lbl><div><Num size={14} weight={700} color={M_DIM}>PREFLOP</Num></div></div>
          <div style={{ flex: 1 }}/>
          <span style={{ fontSize: 12, color: M_MUTED }}>his first hand · 40 seconds old</span>
        </div>
      </div>
      <Panel>
        <PanelHead title="Read" sub="GRANITE · 0 HANDS"/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ReadPanel rows={READ_EMPTY} hands={0} line="Give me a few hands."/>
          <div style={{ padding: '12px 14px' }}>
            <NotYet fact="NO READS YET" color={M_GOLD}
              fills="Each showdown he sees fills these bars and narrows the bracket around them. How fast that happens is what his READS attribute does — and it is the first thing on his sheet you will feel rather than read."/>
          </div>
        </div>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  FTU_PATH, FTU_AGENT, FTU_POCKET, NotYet, FtuPathStrip, FtuMatrixM, FtuBirthCard, FtuHeroRow, FtuFirstFelt,
  FtuTelegramScreenM, FtuEmptyFloorScreenM, FtuDraftEmptyScreenM, FtuDraftReadyScreenM,
  FtuBirthCardScreenM, FtuWalkInScreenM, FtuFirstHandScreenM, FtuFirstRecapScreenM,
  FtuYouScreenM, D5FtuLoginScreenM, D5FtuEmptyScreenM, D5FtuFirstHandScreenM,
});
