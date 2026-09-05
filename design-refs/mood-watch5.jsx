// WATCH v5 — the hero at the bottom, the felt filling the screen, chat as a whisper.
//
// v4b put him in a hero row: a strip of chrome at the foot of the felt with his cards
// in it, which made the one character you own the least present thing on his own
// table. v5 seats him. He faces the viewer at the bottom edge at twice an opponent's
// size, his cards face up in front of him, his bubble above his head, and the rope
// and strip directly under him — so the whole vertical axis of the screen is HIM.
//
// AND THE FELT IS THE SCREEN. Nothing below it but the composer. The TABLE tab and
// its transcript are gone: chat is a WHISPER (a pale bubble that rises and fades),
// and history is a GLASS SHEET over the lower felt with the game still playing
// behind it. The felt never resizes for a sheet — that was the tell that the sheet
// was a different screen rather than a layer.

const V5GLASS = {
  panel: 'rgba(13,23,21,0.72)',
  raised: 'rgba(18,30,28,0.84)',
  edge: 'rgba(255,255,255,0.11)',
  edgeUp: 'rgba(255,255,255,0.17)',
  blur: 'blur(18px) saturate(1.2)',
};

const V5Glass = ({ children, up, pad = '11px 13px', style }) => (
  <div style={{
    background: up ? V5GLASS.raised : V5GLASS.panel,
    backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur,
    border: `1px solid ${up ? V5GLASS.edgeUp : V5GLASS.edge}`,
    borderRadius: 13, padding: pad, ...style,
  }}>{children}</div>
);

const V5Lbl = ({ children, color = M_DIM, size = 13 }) => (
  <span style={{ fontFamily: PLAYFAIR, fontSize: size, fontWeight: 600, color, letterSpacing: '-0.005em' }}>{children}</span>
);

const V5_FELT_H = 648;   // measured: 844 − 44 status − 40 header − 112 composer+hint
const V5_POT_TOP = 196;  // v4b's proven offsets — the side chips end at 230 and the
const V5_BOARD_TOP = 243; // board spans x75–315, so it clears them horizontally

// ── the hero, seated at the bottom ───────────────────────────────────────
// A flowed column anchored to the felt's bottom edge: bubble, him, rope, strip.
// Every gap belongs to the column, so a two-line bubble or a thicker rope moves its
// neighbours instead of landing on them — the lesson v4b paid eleven defects for.
const V5Hero = ({ says, mood = 'confident', accent = M_TEAL, heat = 45, hands = 'hold',
                  hole = [['A', 's'], ['K', 'h']], equity = 87, stack = '1,847',
                  street = 'TURN', toCall, action, timer, cost, event, bet, won, over }) => (
  <div style={{
    position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: over ? 10 : 5,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  }}>
    {/* his bubble, above his head — band reserved whether or not he speaks */}
    <div style={{ minHeight: 0, display: 'flex', justifyContent: 'center', width: '100%', opacity: over ? 0.4 : 1 }}>
      {says && (
        <div style={{ position: 'relative', maxWidth: 300, animation: 'bubblein 0.22s ease-out both' }}>
          <div style={{
            padding: '9px 13px', borderRadius: 12,
            background: 'rgba(12,26,24,0.94)', border: `1px solid ${M_TEAL}66`,
            boxShadow: `0 3px 14px rgba(0,0,0,0.5), 0 0 16px ${M_TEAL}1F`,
            fontSize: 13, color: M_TEXT, lineHeight: 1.4, textAlign: 'center',
          }}>{says}</div>
          <div style={{ position: 'absolute', top: '100%', left: '50%', marginLeft: -6, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '7px solid rgba(12,26,24,0.94)', filter: `drop-shadow(0 1px 0 ${M_TEAL}66)` }}/>
        </div>
      )}
    </div>

    {/* him. Twice an opponent, facing the viewer, cards face up in front. */}
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div style={{ position: 'absolute', left: '50%', top: '46%', width: 190, height: 190, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${MOODS[mood].color}${heat > 66 ? '2E' : '1A'}, transparent 68%)`, pointerEvents: 'none' }}/>
      <MoodGhost mood={mood} accent={accent} size={96} heat={heat} event={event} ring={false}/>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 2, zIndex: 6 }}>
        {hole.map((c, i) => (
          <div key={i} style={{ transform: `rotate(${i ? 6 : -6}deg)`, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}>
            <PlayingCard rank={c[0]} suit={c[1]} w={40} h={55}/>
          </div>
        ))}
      </div>
      {/* the hand layer, OVER the cards — he is holding them, not standing behind
          them. Inside the ghost's own svg it sat under the z-index-6 card pair. */}
      <svg width={96} height={96} viewBox="0 0 80 80" style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', overflow: 'visible', pointerEvents: 'none', zIndex: 7 }}>
        {ghostHands({ pose: hands, size: 96, bet, won })}
      </svg>
    </div>

    <div style={{ height: 26 }}/>

    {/* the rope, directly under him */}
    <div style={{ width: '100%', padding: '0 32px' }}><TugBar equity={equity}/></div>

    {/* the strip: stack, street or to-call, his action */}
    <V5Glass pad="8px 11px" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9 }}>
      <div>
        <Lbl size={8.5}>Stack</Lbl>
        <div><Num size={12.5} weight={700}>${stack}</Num></div>
      </div>
      <div style={{ width: 1, height: 20, background: V5GLASS.edge }}/>
      <div>
        <Lbl size={8.5}>{toCall ? 'To call' : 'Street'}</Lbl>
        <div><Num size={12.5} weight={700} color={toCall ? M_GOLD : M_DIM}>{toCall ? `$${toCall}` : street}</Num></div>
      </div>
      <div style={{ flex: 1 }}/>
      {action && <span style={{ padding: '5px 10px', borderRadius: 5, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{action}</span>}
      {timer != null && <SeatTimerRing value={timer}/>}
    </V5Glass>

    {/* the cost line, PINNED under his strip until the next flop */}
    {cost && (
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', borderRadius: 10, background: `${M_GOLD}14`, border: `1px solid ${M_GOLD}55` }}>
        <span style={{ flex: 1, fontSize: 11.5, color: M_GOLD, lineHeight: 1.35 }}>He misjudged equity by 7% on the river</span>
        <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.13em', color: M_GOLD, border: `1px solid ${M_GOLD}88`, borderRadius: 3, padding: '2px 5px' }}>FOCUS</span>
      </div>
    )}
  </div>
);

// ── the felt, full-screen ────────────────────────────────────────────────
const V5Felt = ({ children, hero, pot = '480', board = B4F, flip = 4, heat, seats = W4_SEATS,
                 acting, selected, reveal, oppSays }) => (
  <div style={{
    position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden',
    background: 'radial-gradient(ellipse at 50% 40%, #2f4d48 0%, #1d2e2c 58%, #131f1e 100%)',
  }}>
    <style>{`@keyframes bubblein{from{opacity:0}to{opacity:1}}@keyframes whisper{0%{opacity:0;transform:translateY(10px)}18%{opacity:1;transform:none}78%{opacity:1}100%{opacity:0}}`}</style>
    <div style={{ position: 'absolute', left: '-18%', right: '-18%', top: 82, height: 330, borderRadius: '50%', border: `1px solid ${M_TEAL}1A`, pointerEvents: 'none' }}/>

    {/* the six seats, unchanged from v4b */}
    {(() => {
      const order = {};
      seats.filter(x => !x.folded && x.show).forEach((x, i) => { order[x.id] = i; });
      return seats.map(s => (
        <SeatGhost key={s.id} s={s} order={order[s.id] || 0} acting={acting === s.id}
          selected={selected === s.id} dealt reveal={reveal}/>
      ));
    })()}
    {oppSays && (() => {
      const s = seats.find(x => x.id === oppSays.id);
      return s ? <Bubble text={oppSays.text} at={s.x} w={142} top={s.y >= 170 ? 124 : 8}/> : null;
    })()}

    {/* pot and board, in the middle where they always were */}
    <div style={{ position: 'absolute', top: V5_POT_TOP, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 39, boxSizing: 'border-box', padding: '3px 13px', borderRadius: 18, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
        <Lbl size={9}>Pot</Lbl>
        {/^[\d.,]+$/.test(String(pot))
          ? <Amt size={22}>${pot}</Amt>
          : <Num size={15} weight={700} color={M_MUTED}>{pot}</Num>}
      </div>
    </div>
    <div style={{ position: 'absolute', top: V5_BOARD_TOP, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
      {board.map((c, i) => c && i < flip
        ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={44} h={61}/>
        : <CardBack key={i} w={44} h={61} branded/>)}
    </div>

    {hero}
    {children}
  </div>
);

// ── the composer: a whisper, not a chat ──────────────────────────────────
const V5Composer = ({ draft }) => (
  <div style={{ flexShrink: 0, padding: '9px 12px 22px', background: '#101A18', borderTop: `1px solid ${V5GLASS.edge}` }}>
    <V5Glass pad="0 6px 0 14px" style={{ display: 'flex', alignItems: 'center', height: 44, borderRadius: 22 }}>
      <span style={{ flex: 1, fontSize: 13, color: draft ? M_TEXT : M_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {draft || 'Whisper to him…'}
      </span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0, marginRight: 8 }}><path d="M12 19V5M5 12l7-7 7 7"/></svg>
      <button style={{ width: 32, height: 32, borderRadius: '50%', background: M_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </V5Glass>
    <div style={{ marginTop: 7, textAlign: 'center' }}>
      <Num size={8.5} color={M_FAINT} weight={500}>SWIPE UP FOR THE THREAD</Num>
    </div>
  </div>
);

// a sent whisper: pale, small, rising from the bottom edge, gone in 4s
const V5Whisper = ({ text }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 8, zIndex: 7, display: 'flex', justifyContent: 'center', pointerEvents: 'none', animation: 'whisper 4s ease-out both' }}>
    <div style={{
      maxWidth: 250, padding: '7px 12px', borderRadius: 11,
      background: 'rgba(237,237,237,0.10)', border: '1px solid rgba(237,237,237,0.22)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      fontSize: 12, color: 'rgba(237,237,237,0.86)', lineHeight: 1.35, textAlign: 'center',
    }}>{text}</div>
  </div>
);

// ── the history sheet: glass over the lower 70%, game playing behind ────
const V5_THREAD = [
  { who: 'TABLE', s: 'Granite raised to 240', at: '18:31' },
  { who: 'HIM', s: 'He has shown that sizing twice. It is a bluff.', at: '18:31' },
  { who: 'GRANITE', s: 'Again?', at: '18:31' },
  { who: 'YOU', s: 'Careful with him.', at: '18:32' },
  { who: 'HIM', s: 'He checked twice. He’s got nothing.', at: '18:32' },
  { who: 'TABLE', s: 'He misjudged equity by 7% · FOCUS', at: '18:33', cost: true },
];

const V5Row = ({ r }) => {
  const him = r.who === 'HIM', you = r.who === 'YOU', table = r.who === 'TABLE';
  const c = him ? M_TEAL : you ? M_GOLD : table ? (r.cost ? M_GOLD : M_MUTED) : M_MUTED;
  return (
    <div style={{ display: 'flex', gap: 9, padding: '8px 0', alignItems: 'baseline', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
      <span style={{ width: 56, flexShrink: 0, fontFamily: MONO, fontSize: 9, fontWeight: him || you ? 700 : 400, color: c }}>{r.who}</span>
      <span style={{ flex: 1, fontSize: him ? 13 : 12, lineHeight: 1.42, color: him ? M_TEXT : you ? M_GOLD : r.cost ? M_GOLD : M_MUTED, fontStyle: him || you || table ? 'normal' : 'italic' }}>
        {him || you || table ? r.s : <>&ldquo;{r.s}&rdquo;</>}
      </span>
      <Num size={8.5} color={M_FAINT} weight={500}>{r.at}</Num>
    </div>
  );
};

const V5ThreadSheet = ({ rows = V5_THREAD }) => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', zIndex: 8,
    background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur,
    borderTop: `1px solid ${V5GLASS.edgeUp}`, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: '9px 14px 128px', display: 'flex', flexDirection: 'column',
    animation: 'bubblein 0.28s ease-out both',
  }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
      <div style={{ width: 34, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}/>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <V5Lbl color={M_TEXT}>The table</V5Lbl>
      <div style={{ flex: 1 }}/>
      <Num size={9} color={M_MUTED} weight={500}>THE HAND IS STILL PLAYING</Num>
    </div>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {rows.map((r, i) => <V5Row key={i} r={r}/>)}
    </div>
  </div>
);

const V5ReadSheet = ({ id = 'granite' }) => {
  const s = W4_SEATS.find(x => x.id === id);
  const r = READ_BOOK[id];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', zIndex: 8,
      background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur,
      borderTop: `1px solid ${V5GLASS.edgeUp}`, borderTopLeftRadius: 18, borderTopRightRadius: 18,
      padding: '9px 14px 128px', animation: 'bubblein 0.28s ease-out both',
    }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 11 }}>
        <div style={{ width: 34, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'rgba(10,15,23,0.7)', border: `1px solid ${s.accent}55`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
          <MoodGhost mood={s.mood} accent={s.accent} size={38} ring={false}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <V5Lbl color={M_TEXT} size={17}>{s.name}</V5Lbl>
            {r.role === 'nemesis' && <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: M_RED, background: `${M_RED}1F`, border: `1px solid ${M_RED}66`, borderRadius: 3, padding: '2px 5px' }}>NEMESIS</span>}
          </div>
          <div style={{ marginTop: 4 }}><Num size={9} color={M_MUTED} weight={500}>{r.hands} HANDS SEEN</Num></div>
        </div>
        <Num size={11.5} weight={700} color={M_TEAL}>${s.stack}</Num>
      </div>
      {r.rows.map(row => <ReadBar key={row.k} {...row}/>)}
      <div style={{ marginTop: 11, padding: '10px 12px', borderRadius: 10, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}44`, fontSize: 12.5, color: M_TEXT, lineHeight: 1.45, fontStyle: 'italic' }}>
        &ldquo;{r.line}&rdquo;
      </div>
    </div>
  );
};

// ── the ceremony, around the hero at the bottom ─────────────────────────
const V5Ceremony = ({ won, name = 'Balanced v2.1', pot = '3,694', winner = 'Granite',
                     mood = 'confident', heat = 54, delta, stack }) => {
  const hot = heat > 66;
  const key = won ? M_TEAL : hot ? M_RED : MOODS[mood].color;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9, background: `radial-gradient(ellipse 90% 46% at 50% 84%, ${key}${hot ? '24' : '1A'} 0%, rgba(8,12,11,0.72) 46%, rgba(8,12,11,0.9) 100%)` }}>
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: M_MUTED }}>{name}</div>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 34, fontWeight: 600, color: key, letterSpacing: '-0.015em', lineHeight: 1 }}>{won ? 'WON' : 'LOST'}</div>
        {/* THE DELTA AND WHERE HE STANDS. "Granite took $1,250" tells the owner
            what happened to the pot; it does not tell him what happened to his guy. */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
          <Num size={22} weight={700} color={won ? M_TEAL : M_RED}>{delta || (won ? `+$${pot}` : `−$1,250`)}</Num>
          <span style={{ fontSize: 12, color: M_MUTED }}>·</span>
          <span style={{ fontSize: 12.5, color: M_DIM }}>stack</span>
          <Num size={17} weight={700} color={M_TEXT}>${stack || (won ? '5,541' : '1,847')}</Num>
        </div>
        {!won && <div style={{ marginTop: -2 }}><Num size={9} color={M_MUTED} weight={500}>{winner.toUpperCase()} TOOK THE POT</Num></div>}
        <div style={{ position: 'relative', marginTop: 2 }}>
          <div style={{ position: 'absolute', left: '50%', top: '46%', width: 210, height: 210, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${key}${hot ? '3D' : '26'}, transparent 68%)` }}/>
          <MoodGhost mood={mood} accent={key} size={76} heat={heat}
            event={won ? 'smug' : 'stunned'} hands={won ? 'cover' : 'cover'} won={won} ring={false}/>
        </div>
        {/* the next hand starts in 3s anyway — the button only makes it now, which
            is why it is primary and the conversation is the secondary */}
        <div style={{ width: '100%', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Btn kind="primary" h={46} full>Deal him in</Btn>
          <Btn kind="ghost" h={42} full>Talk to {name.split(' ')[0]} about this hand</Btn>
          <div style={{ textAlign: 'center' }}><Num size={8.5} color={M_FAINT} weight={500}>NEXT HAND IN 3s</Num></div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {
  V5GLASS, V5Glass, V5Lbl, V5_FELT_H, V5Hero, V5Felt, V5Composer, V5Whisper,
  V5_THREAD, V5Row, V5ThreadSheet, V5ReadSheet, V5Ceremony,
});

// ── the opponent muck ───────────────────────────────────────────────────
// A seat folding is not the hero folding: 250ms rather than 350, a flatter arc, and
// it ends at THE MUCK — one fixed spot beside the pot, so a table of six folds
// resolves to one pile instead of six directions.
const OPP_MUCK = [
  { t: '0ms', x: 0, y: 0, r: 0, s: 1, o: 1, note: 'at his seat, face down, in front of him' },
  { t: '130ms', x: 34, y: 26, r: -12, s: 0.88, o: 0.95, note: 'slid toward the muck — a flatter arc than the hero toss' },
  { t: '250ms', x: 68, y: 46, r: -22, s: 0.74, o: 0.5, note: 'landed on the pile beside the pot' },
];

const OppMuckStripM = () => (
  <div style={{ width: 390, background: 'linear-gradient(180deg, #1d2e2c 0%, #162423 100%)', fontFamily: INTER, padding: '14px 0 16px', borderRadius: 4 }}>
    <div style={{ padding: '0 14px 12px' }}>
      <V5Lbl color={M_TEXT}>An opponent mucks</V5Lbl>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        250ms, three frames. The muck is one spot beside the pot, so six folds make one pile.
      </div>
    </div>
    {OPP_MUCK.map((f, i) => (
      <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Num size={9} color={i === 0 ? M_TEAL : M_MUTED} weight={600}>{f.t}</Num>
        <div style={{ position: 'relative', width: 150, height: 74, flexShrink: 0 }}>
          <div style={{ position: 'absolute', left: 92, top: 44, display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 30, height: 15, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', border: '1px dashed rgba(255,255,255,0.14)' }}/>
            <Num size={7.5} color={M_FAINT} weight={600}>MUCK</Num>
          </div>
          <div style={{ position: 'absolute', left: 6, top: 2, opacity: 0.5 }}><FloorGhost mood="sulking" accent={M_PINK} size={26} speed={7}/></div>
          <div style={{ position: 'absolute', left: 10, top: 16, display: 'flex', gap: 1.5, transform: `translate(${f.x}px, ${f.y}px) rotate(${f.r}deg) scale(${f.s})`, transformOrigin: 'center', opacity: f.o }}>
            <CardBack w={15} h={21}/><CardBack w={15} h={21}/>
          </div>
        </div>
        <div style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>{f.note}</div>
      </div>
    ))}
    <div style={{ padding: '12px 14px 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
      Never face up, at any frame. <b style={{ color: M_DIM }}>A folded opponent's cards are the one thing the fish tank never shows</b> — not in motion, not at rest, not at showdown.
    </div>
  </div>
);

// ═══ SCREENS ═════════════════════════════════════════════════════════════
const V5Shell = ({ children, draft }) => (
  <PhoneShell>
    <W4Header/>
    {children}
    <V5Composer draft={draft}/>
  </PhoneShell>
);

const V5CalmScreenM = () => (
  <V5Shell>
    <V5Felt acting="granite" oppSays={{ id: 'granite', text: 'Again?' }}
      hero={<V5Hero says="He checked twice. He's got nothing." toCall="240" action="BET $240" timer={9} hands="push" bet="mid"/>}/>
  </V5Shell>
);

const V5HoldScreenM = () => (
  <V5Shell>
    <V5Felt board={[]} flip={0} pot="30"
      seats={W4_SEATS.map(s => ({ ...s, show: null }))}
      hero={<V5Hero street="PREFLOP" equity={54} hands="hold" says="Ace-king. Now we are talking."/>}/>
  </V5Shell>
);

const V5WhisperScreenM = () => (
  <V5Shell draft="">
    <V5Felt acting="granite"
      hero={<V5Hero street="TURN" hands="drum" equity={87}/>}>
      <V5Whisper text="Careful with him."/>
    </V5Felt>
  </V5Shell>
);

const V5ThreadScreenM = () => (
  <V5Shell>
    <V5Felt acting="granite" hero={<V5Hero street="TURN" hands="hold" equity={87} over/>}>
      <V5ThreadSheet/>
    </V5Felt>
  </V5Shell>
);

const V5ReadScreenM = () => (
  <V5Shell>
    <V5Felt selected="granite" hero={<V5Hero street="TURN" hands="hold" equity={87} over/>}>
      <V5ReadSheet id="granite"/>
    </V5Felt>
  </V5Shell>
);

const V5CostScreenM = () => (
  <V5Shell>
    <V5Felt board={B5F} flip={5} pot="3,694" reveal
      hero={<V5Hero street="RIVER" equity={0} mood="frustrated" accent={M_PURPLE} heat={62}
        hands="clench" cost says="He had the ace of clubs the whole way."/>}/>
  </V5Shell>
);

const V5CeremonyWonScreenM = () => (
  <V5Shell>
    <V5Felt board={B5F} flip={5} pot="3,694" reveal
      hero={<V5Hero street="RIVER" equity={100} hands="hold"/>}>
      <V5Ceremony won pot="3,694" heat={54}/>
    </V5Felt>
  </V5Shell>
);

const V5CeremonyLostScreenM = () => (
  <V5Shell>
    <V5Felt board={B5F} flip={5} pot="3,694" reveal
      hero={<V5Hero street="RIVER" equity={0} mood="tilted" accent={M_PURPLE} heat={88} hands="hold"/>}>
      <V5Ceremony pot="3,694" winner="Granite" mood="tilted" heat={88}/>
    </V5Felt>
  </V5Shell>
);

// ── desktop: the same seating, the sheet as a rail ───────────────────────
const D9V5ScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$3,712" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 48% 40%, #2f4d48 0%, #1d2e2c 58%, #131f1e 100%)' }}>
        <style>{`@keyframes bubblein{from{opacity:0}to{opacity:1}}`}</style>
        <div style={{ position: 'absolute', left: '-8%', right: '-8%', top: 120, bottom: 300, borderRadius: '50%', border: `1px solid ${M_TEAL}1A` }}/>
        {D6_SEATS.map(s => <DeskSeat key={s.id} s={s} acting={s.id === 'granite'}/>)}
        <div style={{ position: 'absolute', top: 330, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 18px', borderRadius: 20, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
            <Lbl size={9.5}>Pot</Lbl><Amt size={30}>$480</Amt>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 396, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 3 }}>
          {B4F.map((c, i) => c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={58} h={80}/> : <CardBack key={i} w={58} h={80} branded/>)}
        </div>
        {/* him, at the bottom, twice a seat and facing the room */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 5 }}>
          <div style={{ position: 'relative', maxWidth: 420 }}>
            <div style={{ padding: '11px 16px', borderRadius: 13, background: 'rgba(12,26,24,0.94)', border: `1px solid ${M_TEAL}66`, fontSize: 15, color: M_TEXT, textAlign: 'center' }}>
              He checked twice. He&rsquo;s got nothing.
            </div>
            <div style={{ position: 'absolute', top: '100%', left: '50%', marginLeft: -6, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '7px solid rgba(12,26,24,0.94)' }}/>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '50%', top: '46%', width: 300, height: 300, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_TEAL}1F, transparent 68%)` }}/>
            <MoodGhost mood="confident" accent={M_TEAL} size={132} heat={45} hands="push" bet="mid" ring={false}/>
            <div style={{ position: 'absolute', left: '50%', bottom: -8, transform: 'translateX(-50%)', display: 'flex', gap: 3, zIndex: 6 }}>
              <div style={{ transform: 'rotate(-6deg)' }}><PlayingCard rank="A" suit="s" w={52} h={72}/></div>
              <div style={{ transform: 'rotate(6deg)' }}><PlayingCard rank="K" suit="h" w={52} h={72}/></div>
            </div>
          </div>
          <div style={{ width: 300, marginTop: 40 }}><TugBar equity={87}/></div>
          <V5Glass pad="9px 13px" style={{ display: 'flex', alignItems: 'center', gap: 11, width: 420 }}>
            <div><Lbl size={8.5}>Stack</Lbl><div><Num size={14} weight={700}>$1,847</Num></div></div>
            <div style={{ width: 1, height: 22, background: V5GLASS.edge }}/>
            <div><Lbl size={8.5}>To call</Lbl><div><Num size={14} weight={700} color={M_GOLD}>$240</Num></div></div>
            <div style={{ flex: 1 }}/>
            <span style={{ padding: '6px 13px', borderRadius: 6, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em' }}>BET $240</span>
            <SeatTimerRing value={9}/>
          </V5Glass>
        </div>
      </div>
      <div style={{ width: 520, flexShrink: 0, borderLeft: `1px solid ${V5GLASS.edge}`, background: 'linear-gradient(180deg, #16221F 0%, #101A18 100%)', display: 'flex', flexDirection: 'column', padding: '14px 14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <V5Lbl color={M_TEXT} size={16}>The table</V5Lbl>
          <div style={{ flex: 1 }}/>
          <Num size={9} color={M_MUTED} weight={500}>ALWAYS OPEN AT 1440</Num>
        </div>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {V5_THREAD.map((r, i) => <V5Row key={i} r={r}/>)}
        </div>
        <V5Glass pad="0 6px 0 14px" style={{ display: 'flex', alignItems: 'center', height: 44, borderRadius: 22, marginTop: 10 }}>
          <span style={{ flex: 1, fontSize: 13, color: M_MUTED }}>Whisper to him…</span>
          <button style={{ width: 32, height: 32, borderRadius: '50%', background: M_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </V5Glass>
      </div>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  OPP_MUCK, OppMuckStripM, V5Shell, V5CalmScreenM, V5HoldScreenM, V5WhisperScreenM, V5ThreadScreenM,
  V5ReadScreenM, V5CostScreenM, V5CeremonyWonScreenM, V5CeremonyLostScreenM, D9V5ScreenM,
});
