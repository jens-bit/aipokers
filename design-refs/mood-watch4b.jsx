// WATCH v4b — the screens, the haptic table, the matrix, desktop parity.

const B4F = [['K', 'c'], ['9', 'c'], ['4', 'c'], ['2', 'c'], null];
const B5F = [['K', 'c'], ['9', 'c'], ['4', 'c'], ['2', 'c'], ['5', 'h']];

const W4Shell = ({ children }) => <PhoneShell>{children}</PhoneShell>;

// ═══ 1 · DEAL, mid-arrival ═══════════════════════════════════════════════
const W4DealScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="deal" pot="30" board={[]} flip={0} equity={50} dead dealt={false} landed={1}
      hero={<HeroRow4 street="PREFLOP" landed={1} note="dealing…"/>}/>
    <TableTab log={TABLE_LOG.slice(0, 2)}/>
  </W4Shell>
);

// ═══ 2 · DEAL, a hand worth having ══════════════════════════════════════
const W4DealWarmScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="deal" pot="30" board={[]} flip={0} equity={67} dealt landed={2} warm
      says={[{ mine: true, text: 'Ace-king. Now we are talking.' }]}
      hero={<HeroRow4 street="PREFLOP" landed={2} warm/>}/>
    <TableTab log={[...TABLE_LOG.slice(0, 1), { who: 'him', s: 'Ace-king. Now we are talking.', at: '18:33' }]}/>
  </W4Shell>
);

// ═══ 3 · CALM — his bubble and one opponent's, and that is the maximum ══
const W4CalmScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="calm" pot="480" board={B4F} flip={4} equity={87} acting="granite"
      says={[{ mine: true, text: "He checked twice. He's got nothing." }, { id: 'granite', text: 'Again?' }]}
      hero={<HeroRow4 toCall="240" action="BET $240" timer={9}/>}/>
    <TableTab/>
  </W4Shell>
);

// ═══ 4 · A SEAT TAPPED — the read, behind the person ════════════════════
const W4ReadSheetScreenM = () => (
  <W4Shell>
    <W4Header/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <div style={{ opacity: 0.55 }}>
        <Felt4 pace="calm" pot="480" board={B4F} flip={4} equity={87} selected="granite"
          hero={<HeroRow4 toCall="240" action="BET $240" timer={9}/>}/>
      </div>
      <ReadSheet4 id="granite"/>
    </div>
  </W4Shell>
);

// ═══ 5 · A THIN READ ═══════════════════════════════════════════════════
const W4ThinReadScreenM = () => (
  <W4Shell>
    <W4Header/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <div style={{ opacity: 0.55 }}>
        <Felt4 pace="calm" pot="480" board={B4F} flip={4} equity={87} selected="nash"
          hero={<HeroRow4 toCall="240" action="BET $240" timer={9}/>}/>
      </div>
      <ReadSheet4 id="nash"/>
    </div>
  </W4Shell>
);

// ═══ 6 · HEATING ═══════════════════════════════════════════════════════
const W4HeatingScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="heating" pot="1,240" board={B4F} flip={4} equity={71} acting="granite"
      says={[{ mine: true, text: "Now it's a real pot. Good." }, { id: 'nash', text: 'Too rich for me.' }]}
      hero={<HeroRow4 toCall="620" action="BET $620" timer={7}/>}/>
    <TableTab log={[...TABLE_LOG, { who: 'him', s: "Now it's a real pot. Good.", at: '18:33' }]}/>
  </W4Shell>
);

// ═══ 7 · ALL-IN — his bubble held, and theirs answering ════════════════
const W4AllInScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="allin" pot="3,694" board={B4F} flip={4} equity={64}
      says={[{ mine: true, text: "All of it. He's drawing." }, { id: 'granite', text: 'Call.' }]}
      hero={<HeroRow4 action="ALL-IN" tag="RIVER IN 3"/>}/>
    <TableTab log={[
      { who: 'him', s: 'He checked twice. He\u2019s got nothing.', at: '18:32' },
      { who: 'him', s: 'All of it.', at: '18:33' },
      { who: 'Granite', s: 'Call.', at: '18:33' },
      { who: 'him', s: "All of it. He's drawing.", at: '18:33' },
    ]}/>
  </W4Shell>
);

// ═══ 8 · SHOWDOWN — their cards turn over ══════════════════════════════
const W4_SHOWDOWN_SEATS = W4_SEATS.map(s =>
  s.id === 'granite' ? { ...s, mood: 'tilted' }
  : s.id === 'phil' ? { ...s, mood: 'neutral' }
  : s);

const W4ShowdownScreenM = () => (
  <W4Shell>
    <W4Header/>
    <Felt4 pace="showdown" heroReserve={92} pot="3,694" board={B5F} flip={5} equity={100} potTo reveal
      seats={W4_SHOWDOWN_SEATS}
      says={[{ mine: true, text: 'Told you. Nothing.' }, { id: 'granite', text: 'Nice hand.' }]}
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
    <TableTab log={[
      { who: 'him', s: 'All of it. He\u2019s drawing.', at: '18:33' },
      { who: 'him', s: 'Told you. Nothing.', at: '18:34' },
      { who: 'Granite', s: 'Nice hand.', at: '18:34' },
    ]}/>
  </W4Shell>
);

// ═══ 9 · BETWEEN HANDS ════════════════════════════════════════════════
const W4BetweenScreenM = () => (
  <W4Shell>
    <W4Header/>
    <BetweenStrip4 cause="rolling — three big pots in a row"
      truth="+$3,712 TONIGHT · 43 HANDS · WORST BEAT: THE Q3o ON HAND 19" next={8}/>
    <Felt4 pace="calm" pot="—" board={[]} flip={0} equity={50} dead dealt={false}
      says={[{ mine: true, text: 'Good table. I will take another orbit here.' }]}
      hero={<HeroRow4 street="SHUFFLING" landed={0} note="between hands"/>}/>
    <TableTab log={[
      { who: 'you', s: 'Nice one.', at: '18:34' },
      { who: 'him', s: 'Good table. I will take another orbit here.', at: '18:34' },
    ]}/>
  </W4Shell>
);

// ── the haptic table, extended for the deal and the bubble ──────────────
const HAPTIC4 = [
  { ev: 'Hero card 1 lands', hap: 'impactOccurred(\u2018light\u2019)', snd: 'deal tick', note: 'the beat that starts the hand' },
  { ev: 'Hero card 2 lands', hap: 'impactOccurred(\u2018light\u2019)', snd: 'deal tick', note: '90ms after the first, never simultaneous' },
  { ev: 'Table backs dealt', hap: '\u2014 none', snd: 'one soft sweep', note: 'five seats in 200ms as a single gesture' },
  { ev: 'Premium hand warms', hap: 'impactOccurred(\u2018soft\u2019)', snd: '\u2014 none', note: 'owner-only. Never fires for a spectator.' },
  { ev: 'Bubble appears', hap: 'selectionChanged()', snd: '\u2014 none', note: 'his and theirs alike. The lightest event in the product.' },
  { ev: 'Seat tapped \u00b7 read opens', hap: 'selectionChanged()', snd: '\u2014 none', note: 'the sheet is the feedback' },
  { ev: 'Showdown reveal', hap: 'impactOccurred(\u2018soft\u2019)', snd: 'card turn, per seat', note: 'one per revealing seat, in seat order, 140ms apart' },
  { ev: 'Opponent posture shifts', hap: '\u2014 none', snd: '\u2014 none', note: 'silent, always. Their moods are not events.' },
];

const Haptic4SheetM = () => (
  <Sheet title="The deal, the bubble, the reveal" sub="Appended to the wave-33 table and bound by its rules: haptics fire on his events only, never two inside 120ms, nothing fires for an unwatched hand. Two of these rows are new to v4b.">
    <div style={{ display: 'grid', gridTemplateColumns: '206px 216px 1fr 1fr', gap: '0 14px' }}>
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
        <SyLbl color={M_TEAL}>Why a bubble is only selectionChanged</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          He speaks several times a hand and so do they. <b style={{ color: M_TEXT }}>Anything heavier would become the texture of the product</b> &mdash; a tick per sentence is a phone that never stops moving. The lightest tap the API has, no sound at all, and nothing when the app is backgrounded.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
        <SyLbl color={M_GOLD}>The reveal is the one place cards make a sound</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          One soft tap and one card-turn per seat, <b style={{ color: M_TEXT }}>in seat order, 140ms apart</b> &mdash; the same rhythm logic as the deal, slower because it is the end of something rather than the start.
        </div>
      </div>
    </div>
  </Sheet>
);

// ── the state matrix ────────────────────────────────────────────────────
const W4MatrixM = () => {
  const cols = '116px repeat(5, 1fr)';
  const surfaces = ['Hero cards', 'Seated ghosts', 'Bubbles', 'The rope', 'TABLE tab'];
  const rows = [
    { k: 'DEAL', c: M_TEAL, cells: [
      'slide in one at a time, 90ms apart; gold edge if premium (owner-only)',
      'backs land as one sweep after his cards; postures already running',
      'his only, and only if the hand is worth a word',
      'dead centre until both cards are in, then jumps to pre-flop equity',
      'the hand number and the stakes'] },
    { k: 'CALM', c: M_MUTED, cells: [
      'face up, no edge',
      'acting seat: white ring, bright arc for time left, count in the chip',
      'his above the rope, theirs above their own ghost. Max two, 3–4s, no queue.',
      'live from the deal', 'every line in order, newest at the foot'] },
    { k: 'HEATING', c: M_GOLD, cells: [
      'unchanged', 'unchanged — a hot pot is not their news',
      'his sizing line, as it happens', 'thickens to 12px', 'unchanged'] },
    { k: 'ALL-IN', c: M_RED, cells: [
      'unchanged', 'unchanged',
      'his is HELD for the 3–5s rather than expiring; theirs may answer',
      'held at the committed number', 'both lines land in order'] },
    { k: 'SHOWDOWN', c: M_TEAL, cells: [
      'the result card replaces the hero row',
      'their hole cards FLIP FACE UP in seat order, then postures react',
      'his, then theirs — the only moment two bubbles are expected',
      'jumps to 100 or 0', 'the pot figure and both lines'] },
    { k: 'SEAT TAPPED', c: M_TEAL, cells: [
      'unchanged — the hand keeps playing behind the sheet',
      'dashed teal ring on the tapped ghost; the felt drops to 55%',
      'suppressed while the sheet is up — the record still takes them',
      'unchanged', 'replaced by the read sheet, not dismissed'] },
    { k: 'BETWEEN HANDS', c: M_MUTED, cells: [
      'face down, stack still shown',
      'postures continue — this is where a tilted opponent is most readable',
      'his, unhurried', 'dead centre, no number',
      'the strip above carries net, hands and worst beat'] },
  ];
  return (
    <Sheet title="State matrix · watch v4b" sub="The VOICE column is gone; BUBBLES replaces it, and the TABLE tab column records what the bubbles said. The showdown row is the only one where the fish-tank law changes state — backs while live, face up once the hand is over.">
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
          <SyLbl color={M_TEAL}>The bubble law</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            One bubble per seat, <b style={{ color: M_TEXT }}>at most two on the felt</b>, 3&ndash;4 seconds, then gone. Never a queue and never a stack: if a third thing is said, the oldest bubble goes. <b style={{ color: M_TEXT }}>Nothing is lost by expiring</b> &mdash; the TABLE tab has every line, which is what frees a bubble to be brief.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
          <SyLbl color={M_GOLD}>A flow, not a list of offsets</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            <span style={{ fontFamily: MONO, fontSize: 11 }}>felt 520 &middot; seat stack 60 &middot; top row 56 &middot; side band 124 &middot; side row 170 &middot; column 196 &rarr; flowed &middot; hero reserve 88</span>. The seats are absolute because they are anchored to the table; <b style={{ color: M_TEXT }}>pot, board, his band and the rope are one flex column</b>, so a taller pill or a thicker rope moves its neighbours instead of landing on them. <b style={{ color: M_TEXT }}>One felt height for all five states</b>, and no downstream offset left to drift.
          </div>
        </div>
      </div>
    </Sheet>
  );
};

// ── desktop parity ──────────────────────────────────────────────────────
const D6_SEATS = [
  { id: 'granite', name: 'Granite', stack: '2,104', x: 300, y: 96, mood: 'neutral', accent: M_GOLD, history: 3, show: [['K', 'd'], ['9', 's']] },
  { id: 'phil', name: 'Phil_AI', stack: '1,960', x: 470, y: 78, mood: 'confident', accent: M_TEAL, show: [['J', 'h'], ['J', 'c']] },
  { id: 'doyle', name: 'doyle_v3', stack: '1,290', x: 640, y: 96, mood: 'sulking', accent: M_PINK, folded: true },
  { id: 'nash', name: 'nash_eq', stack: '3,410', x: 176, y: 245, mood: 'frustrated', accent: M_PURPLE, show: [['A', 'c'], ['Q', 'd']] },
  { id: 'ivey', name: 'ivey_bot', stack: '880', x: 764, y: 245, mood: 'tilted', accent: M_RED, folded: true },
];

const DeskSeat = ({ s, acting, selected, reveal, order = 0 }) => (
  <div style={{ position: 'absolute', left: s.x, top: s.y, transform: 'translateX(-50%)', zIndex: 3 }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', opacity: s.folded ? 0.36 : 1 }}>
        {acting && <SeatClock d={80} left={9}/>}
        {selected && <div style={{ position: 'absolute', left: '50%', top: '50%', width: 86, height: 86, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `1px dashed ${M_TEAL}`, boxShadow: `0 0 16px ${M_TEAL}66` }}/>}
        {!s.folded && !(reveal && s.show) && (
          <div style={{ position: 'absolute', left: '50%', top: 32, transform: 'translateX(-50%)', zIndex: 4, display: 'flex', gap: 3 }}>
            <div style={{ transform: 'rotate(-7deg)', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.7))' }}><CardBack w={30} h={42}/></div>
            <div style={{ transform: 'rotate(7deg)', filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.7))' }}><CardBack w={30} h={42}/></div>
          </div>
        )}
        <FloorGhost mood={s.mood} accent={s.accent} size={62} speed={s.mood === 'tilted' ? 3.2 : 5.6}/>
        {s.history && (
          <span style={{ position: 'absolute', top: 0, left: -8, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 9, background: 'rgba(19,19,22,0.95)', border: `1px solid ${M_GOLD}`, color: M_GOLD, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.history}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 9px', borderRadius: 11, background: 'rgba(14,17,18,0.8)', border: `1px solid ${acting ? '#EDEDED66' : M_BORDER}`, opacity: s.folded ? 0.5 : 1 }}>
        <span style={{ fontSize: 11.5, color: acting ? M_TEXT : M_DIM, fontWeight: 500 }}>{s.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{s.stack}</span>
        {acting && <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: M_TEXT }}>9s</span>}
      </div>
      {reveal && s.show && !s.folded && (
        <div style={{ display: 'flex', gap: 2, marginTop: 2, animation: `bubblein 0.3s ease-out ${order * 0.14}s both` }}>
          {s.show.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={30} h={42}/>)}
        </div>
      )}
    </div>
  </div>
);

const DeskFelt4 = ({ says = [], acting, selected, reveal, seats = D6_SEATS, board = B4F, flip = 4, pot = '480', equity = 87, dim, heat, allin }) => (
  <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', opacity: dim || 1,
    background: heat
      ? 'radial-gradient(ellipse at 48% 46%, #3b4a3f 0%, #24302c 58%, #17211f 100%)'
      : 'radial-gradient(ellipse at 48% 46%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)' }}>
    {heat && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 ${allin ? 130 : 100}px ${allin ? M_RED : M_GOLD}${allin ? '4D' : '33'}`, animation: allin ? 'shimmer 1.4s ease-in-out infinite' : 'none' }}/>}
    <style>{`@keyframes bubblein{from{opacity:0}to{opacity:1}}`}</style>
    <div style={{ position: 'absolute', left: '-8%', right: '-8%', top: 140, bottom: 120, borderRadius: '50%', border: `1px solid ${M_TEAL}1A`, pointerEvents: 'none' }}/>
    {(() => {
      const order = {};
      seats.filter(x => !x.folded && x.show).forEach((x, i) => { order[x.id] = i; });
      return seats.map(s => <DeskSeat key={s.id} s={s} order={order[s.id] || 0} acting={acting === s.id} selected={selected === s.id} reveal={reveal}/>);
    })()}

    <div style={{ position: 'absolute', top: 350, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 22, minHeight: 46, boxSizing: 'border-box', padding: heat ? '6px 24px' : '5px 18px', background: heat ? `${allin ? M_RED : M_GOLD}1F` : 'rgba(23,27,27,0.6)', border: `1px solid ${heat ? `${allin ? M_RED : M_GOLD}66` : M_BORDER}` }}>
        <Lbl size={9.5} color={heat ? (allin ? M_RED : M_GOLD) : M_MUTED}>Pot</Lbl>
        {/^[\d.,]+$/.test(String(pot))
          ? <Amt size={heat ? 38 : 30}>${pot}</Amt>
          : <Num size={18} weight={700} color={M_MUTED}>{pot}</Num>}
      </div>
    </div>
    <div style={{ position: 'absolute', top: 416, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 3 }}>
      {board.map((c, i) => c && i < flip ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={58} h={80}/> : <CardBack key={i} w={58} h={80} branded/>)}
    </div>

    {/* his bubble band, reserved above the rope */}
    {says.filter(b => b.mine).map((b, i) => <Bubble key={i} mine text={b.text} at={459} top={528} felt={918}/>)}
    {says.filter(b => !b.mine).map((b, i) => {
      const s = seats.find(x => x.id === b.id);
      if (!s) return null;
      return <Bubble key={i} text={b.text} at={s.x} top={s.y >= 245 ? 191 : s.y - 52} w={150} felt={918}/>;
    })}

    <div style={{ position: 'absolute', top: 620, left: '28%', right: '28%', zIndex: 3 }}><TugBar equity={equity}/></div>

    <div style={{ position: 'absolute', left: 28, right: 28, bottom: 22, zIndex: 4, display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 14, background: 'rgba(23,27,27,0.8)', border: `1px solid ${M_TEAL}55` }}>
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {W4_HERO.hole.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={44} h={61}/>)}
      </div>
      <div style={{ width: 1, height: 26, background: M_BORDER }}/>
      <div><Lbl size={8.5}>Stack</Lbl><div><Num size={14} weight={700}>${W4_HERO.stack}</Num></div></div>
      <div style={{ width: 1, height: 26, background: M_BORDER }}/>
      <div><Lbl size={8.5}>To call</Lbl><div><Num size={14} weight={700} color={M_GOLD}>$240</Num></div></div>
      <div style={{ flex: 1 }}/>
      <span style={{ padding: '7px 14px', borderRadius: 6, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' }}>{allin ? 'ALL-IN' : 'BET $240'}</span>
      {allin
        ? <span style={{ padding: '7px 11px', borderRadius: 6, background: `${M_RED}1F`, border: `1px solid ${M_RED}66`, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: M_RED }}>RIVER IN 3</span>
        : <SeatTimerRing value={9}/>}
    </div>
  </div>
);

const D6W4WatchScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$3,712" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFelt4 acting="granite"
        says={[{ mine: true, text: "He checked twice. He's got nothing." }, { id: 'granite', text: 'Again?' }]}/>
      <Panel>
        <PanelHead title="Balanced v2.1" sub="LIVE · $5/$10 6-MAX"/>
        <div style={{ flexShrink: 0, padding: '10px 14px 11px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL_2 }}>
          <Num size={9} color={M_MUTED} weight={500}>+$3,712 TONIGHT &middot; 43 HANDS &middot; WORST BEAT: THE Q3o ON HAND 19</Num>
        </div>
        <TableTab/>
      </Panel>
    </div>
  </DesktopShell>
);

const D6W4ShowdownScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$7,406" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFelt4 reveal board={B5F} flip={5} pot="3,694" equity={100}
        seats={D6_SEATS.map(s => s.id === 'granite' ? { ...s, mood: 'tilted' } : s)}
        says={[{ mine: true, text: 'Told you. Nothing.' }, { id: 'granite', text: 'Nice hand.' }]}/>
      <Panel>
        <PanelHead title="Balanced v2.1" sub="SHOWDOWN · +$3,694"/>
        <div style={{ flexShrink: 0, padding: '10px 14px 11px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL_2 }}>
          <Num size={9} color={M_MUTED} weight={500}>+$3,694 THIS HAND &middot; HIS BIGGEST POT TONIGHT</Num>
        </div>
        <TableTab log={[
          { who: 'him', s: 'All of it. He\u2019s drawing.', at: '18:33' },
          { who: 'him', s: 'Told you. Nothing.', at: '18:34' },
          { who: 'Granite', s: 'Nice hand.', at: '18:34' },
        ]}/>
      </Panel>
    </div>
  </DesktopShell>
);

const D6W4ReadScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$3,712" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFelt4 selected="granite" dim={0.62}/>
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
            Click any other seat to read them instead. The hand keeps playing behind this panel, and <b style={{ color: M_DIM }}>anything said while it is open still lands in the TABLE record</b> &mdash; bubbles are suppressed, not lost.
          </div>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  B4F, B5F, HAPTIC4, D6_SEATS, W4_SHOWDOWN_SEATS, DeskSeat, DeskFelt4,
  W4DealScreenM, W4DealWarmScreenM, W4CalmScreenM, W4ReadSheetScreenM, W4ThinReadScreenM,
  W4HeatingScreenM, W4AllInScreenM, W4ShowdownScreenM, W4BetweenScreenM,
  Haptic4SheetM, W4MatrixM, D6W4WatchScreenM, D6W4ShowdownScreenM, D6W4ReadScreenM,
});
