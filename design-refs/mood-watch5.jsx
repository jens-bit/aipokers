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
                  street = 'TURN', toCall, action, timer, cost, event, bet, won, over, bare, gone }) => (
  <div style={{
    position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 5,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    visibility: gone ? 'hidden' : 'visible',
  }}>
    {/* his bubble, above his head — band reserved whether or not he speaks */}
    <div style={{ minHeight: 0, display: 'flex', justifyContent: 'center', width: '100%' }}>
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
      <div style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 6, visibility: bare ? 'hidden' : 'visible' }}>
        {hole.map((c, i) => (
          <div key={i} style={{ transform: `rotate(${i ? 14 : -14}deg)`, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.7))' }}>
            <PlayingCard rank={c[0]} suit={c[1]} w={36} h={50}/>
          </div>
        ))}
      </div>
      {/* the hand layer, OVER the cards — he is holding them, not standing behind
          them. Inside the ghost's own svg it sat under the z-index-6 card pair. */}
      <svg width={96} height={96} viewBox="0 0 80 80" style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', overflow: 'visible', pointerEvents: 'none', zIndex: 7 }}>
        {ghostHands({ pose: hands, size: 96, bet, won, grip: HERO_GRIP })}
      </svg>
    </div>

    <div style={{ height: 26 }}/>

    {/* the rope, directly under him */}
    {!bare && <div style={{ width: '100%', padding: '0 32px' }}><TugBar equity={equity}/></div>}

    {/* the strip: stack, street or to-call, his action */}
    {!bare && <V5Glass pad="8px 11px" style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: 9 }}>
      {/* STACK moved to the pile — the chips ARE the stack, so stating it here too
          made the number the truth and the chips a decoration. */}
      {toCall && (
        <>
          <div>
            <Lbl size={8.5}>To call</Lbl>
            <div><Num size={12.5} weight={700} color={M_GOLD}>${toCall}</Num></div>
          </div>
          <div style={{ width: 1, height: 20, background: V5GLASS.edge }}/>
        </>
      )}
      <div>
        <Lbl size={8.5}>Street</Lbl>
        <div><Num size={12.5} weight={700} color={M_DIM}>{street}</Num></div>
      </div>
      <div style={{ flex: 1 }}/>
      {action && <span style={{ padding: '5px 10px', borderRadius: 5, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>{action}</span>}
      {timer != null && <SeatTimerRing value={timer}/>}
      {/* collapsed state: a 6px amber dot at the strip's right edge. Tapping it
          re-shows the toast. It sits INSIDE the strip, so it costs no height. */}
      {cost === 'dot' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 7px ${M_GOLD}`, flexShrink: 0 }}/>}
      {/* the toast rides OVER the strip for 4s — same glass, amber left border.
          Absolute, so the felt geometry is identical with and without it. */}
      {cost === 'toast' && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 9, padding: '0 11px',
          background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur,
          border: `1px solid ${V5GLASS.edgeUp}`, borderLeft: `3px solid ${M_GOLD}`, borderRadius: 13,
          animation: 'bubblein 0.2s ease-out both',
        }}>
          <span style={{ flex: 1, fontSize: 11.5, color: M_GOLD, lineHeight: 1.3 }}>He misjudged equity by 7% on the river</span>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.13em', color: M_GOLD, border: `1px solid ${M_GOLD}88`, borderRadius: 3, padding: '2px 5px', flexShrink: 0 }}>FOCUS</span>
        </div>
      )}
    </V5Glass>}


  </div>
);

// ── the felt, full-screen ────────────────────────────────────────────────
const V5Felt = ({ children, hero, pot = '480', board = B4F, flip = 4, heat, seats = W4_SEATS,
                 acting, selected, reveal, oppSays, stackBand = 'mid', stackAmt = '1,847', betOut, potBand = 'mid', dim, oppBet }) => (
  <div style={{
    position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden',
    background: 'radial-gradient(ellipse at 50% 40%, #2f4d48 0%, #1d2e2c 58%, #131f1e 100%)',
  }}>
    <style>{`@keyframes bubblein{from{opacity:0}to{opacity:1}}@keyframes whisper{0%{opacity:0;transform:translateY(10px)}18%{opacity:1;transform:none}78%{opacity:1}100%{opacity:0}}`}</style>
    <div style={{ position: 'absolute', left: '-18%', right: '-18%', top: 82, height: 330, borderRadius: '50%', border: `1px solid ${M_TEAL}1A`, pointerEvents: 'none', opacity: dim ? 0.15 : 1 }}/>

    {/* the six seats, unchanged from v4b */}
    {(() => {
      const order = {};
      seats.filter(x => !x.folded && x.show).forEach((x, i) => { order[x.id] = i; });
      return seats.map(s => (
        <div key={s.id} style={{ opacity: dim ? 0.25 : 1 }}>
          <SeatGhost s={s} order={order[s.id] || 0} acting={acting === s.id}
            selected={selected === s.id} dealt reveal={reveal}/>
        </div>
      ));
    })()}
    {oppSays && (() => {
      const s = seats.find(x => x.id === oppSays.id);
      return s ? <Bubble text={oppSays.text} at={s.x} w={142} top={s.y >= 170 ? 124 : 8}/> : null;
    })()}

    {/* pot and board, in the middle where they always were */}
    <div style={{ position: 'absolute', top: V5_POT_TOP, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2, opacity: dim ? 0.25 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 39, boxSizing: 'border-box', padding: '3px 13px', borderRadius: 18, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
        <Lbl size={9}>Pot</Lbl>
        <div style={{ position: 'relative', width: 15, height: potBand === 'big' ? 17 : potBand === 'small' ? 8 : 12, flexShrink: 0 }}>
          {(CHIP_BANDS[potBand] || CHIP_BANDS.mid).slice(0, potBand === 'big' ? 5 : potBand === 'small' ? 2 : 3)
            .map((d, i) => <Chip key={i} d={d} w={15} i={i} step={2.6}/>)}
        </div>
        {/^[\d.,]+$/.test(String(pot))
          ? <Amt size={22}>${pot}</Amt>
          : <Num size={15} weight={700} color={M_MUTED}>{pot}</Num>}
      </div>
    </div>
    <div style={{ position: 'absolute', top: V5_BOARD_TOP, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2, opacity: dim ? 0.25 : 1 }}>
      {board.map((c, i) => c && i < flip
        ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={44} h={61}/>
        : <CardBack key={i} w={44} h={61} branded/>)}
    </div>

    {/* every seat banks its own chips beside its name chip — the hero's is just the
        one big enough to label. Without them only he appeared to have money. */}
    {/* the pile and the bet spot are the SEAT's geometry (SEAT_SLOTS), not a
        felt-level guess at an offset — that guess is what put $2,104 on Granite's
        name and nash_eq's chips on its own pill. */}
    {seats.map((s, i) => {
      const g = seatSlot(s);
      return (
        <React.Fragment key={'bk' + s.id}>
          <div style={{ position: 'absolute', left: s.x + g.pile.x, top: s.y + g.pile.y, zIndex: 3, opacity: dim ? 0.25 : s.folded ? 0.4 : 1 }}>
            <ChipStack band={i % 3 === 0 ? 'big' : i % 3 === 1 ? 'mid' : 'small'} w={13}/>
          </div>
          {oppBet && oppBet.includes(s.id) && (
            <div style={{ position: 'absolute', left: s.x + g.bet.x, top: s.y + g.bet.y, zIndex: 3 }}>
              <BetSpot band="mid" w={12}/>
            </div>
          )}
        </React.Fragment>
      );
    })}
    {/* his chips live ON THE FELT, to his left — and the bet spot in front of him */}
    <div style={{ position: 'absolute', left: 16, bottom: 150, zIndex: 4, opacity: dim ? 0.25 : 1 }}>
      <ChipStack band={stackBand} w={26} label="STACK" amt={stackAmt}/>
    </div>
    {betOut && (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 258, display: 'flex', justifyContent: 'center', zIndex: 4 }}>
        <BetSpot band={betOut} w={22} amt="240"/>
      </div>
    )}
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
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 296, zIndex: 8,
    background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur,
    borderBottom: `1px solid ${V5GLASS.edgeUp}`, borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
    padding: '10px 14px 12px', display: 'flex', flexDirection: 'column',
    animation: 'bubblein 0.28s ease-out both',
  }}>
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
      position: 'absolute', left: 0, right: 0, top: 0, bottom: 296, zIndex: 8,
      background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur,
      borderBottom: `1px solid ${V5GLASS.edgeUp}`, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, overflow: 'hidden',
      padding: '10px 14px 12px', animation: 'bubblein 0.28s ease-out both',
    }}>
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
    <div style={{ position: 'absolute', inset: 0, zIndex: 9, background: `radial-gradient(ellipse 90% 46% at 50% 84%, ${key}${hot ? '2E' : '1F'} 0%, rgba(8,12,11,0.86) 44%, rgba(8,12,11,0.95) 100%)` }}>
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: M_MUTED }}>{name}</div>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 40, fontWeight: 600, color: key, letterSpacing: '-0.015em', lineHeight: 1 }}>{won ? 'WON' : 'LOST'}</div>
        {/* THE DELTA AND WHERE HE STANDS. "Granite took $1,250" tells the owner
            what happened to the pot; it does not tell him what happened to his guy. */}
        {/* delta on its own line, stack on the next — neither with a caption across it */}
        <Num size={26} weight={700} color={won ? M_TEAL : M_RED}>{delta || (won ? `+$${pot}` : '−$1,250')}</Num>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 12.5, color: M_MUTED }}>stack</span>
          <Num size={18} weight={700} color={M_TEXT}>${stack || (won ? '5,541' : '1,847')}</Num>
        </div>
        {/* him at his seat, same 96 as every other v5 screen */}
        <div style={{ position: 'relative', marginTop: 2 }}>
          <div style={{ position: 'absolute', left: '50%', top: '46%', width: 240, height: 240, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${key}${hot ? '3D' : '26'}, transparent 68%)` }}/>
          <MoodGhost mood={mood} accent={key} size={96} heat={heat} event={won ? 'smug' : 'stunned'} ring={false}/>
          <svg width={96} height={96} viewBox="0 0 80 80" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {ghostHands({ pose: won ? 'raise' : 'cover', size: 96, won })}
          </svg>
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

// white 1 · red 5 · blue 10 · green 25 · black 100
const CHIP_D = { w: '#D8D4CC', r: '#B4353A', b: '#2F5C93', g: '#2E7D53', k: '#1A1A1E' };
const CHIP_BANDS = { small: ['w','w','r'], mid: ['w','r','r','b','b','g'], big: ['r','b','b','g','g','g','k','k','k','k'] };
const BET_BANDS = { small: ['w'], mid: ['r','r'], big: ['g','g','b','r'] };

// a stack standing on the felt — his own, to his left
const Chip = ({ d = 'r', w = 26, i = 0, step = 3.4 }) => (
  <div style={{
    position: 'absolute', left: 0, bottom: i * step, width: w, height: w * 0.42,
    borderRadius: '50%', background: CHIP_D[d], boxSizing: 'border-box',
    border: '1.5px solid rgba(0,0,0,0.55)',
    boxShadow: `inset 0 ${w * 0.06}px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(0,0,0,0.5)`,
  }}/>
);

const ChipStack = ({ band = 'mid', chips, w = 26, label, amt }) => {
  const set = chips || CHIP_BANDS[band] || CHIP_BANDS.mid;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', height: set.length * 3.4 + w * 0.42, width: w }}>
        {set.map((d, i) => <Chip key={i} d={d} w={w} i={i}/>)}
      </div>
      {label && <Num size={7.5} color={M_MUTED} weight={600}>{label}</Num>}
      {/* the figure belongs UNDER the chips it describes, not in a panel elsewhere */}
      {amt && <Num size={amt.length > 5 ? 10 : 11} weight={700} color={M_TEXT}>${amt}</Num>}
    </div>
  );
};

// where a bet lands: in front of his cards, on the felt, not in a panel
const BetSpot = ({ band = 'mid', chips, w = 22, amt }) => {
  const set = chips || BET_BANDS[band] || BET_BANDS.mid;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ position: 'relative', height: set.length * 3.2 + w * 0.44, width: w }}>
        {set.map((d, i) => <Chip key={i} d={d} w={w} i={i} step={3.2}/>)}
      </div>
      {amt && <Num size={10.5} weight={700} color={M_GOLD}>${amt}</Num>}
    </div>
  );
};

// 4 frames: pick off the stack, carry, place, and the spot slides to the pot
const HERO_BET = [
  { t: '0ms', pick: 0, carry: 0, spot: 0, note: 'his stack stands to his left; nothing is out' },
  { t: '150ms', pick: 2, carry: 0.15, spot: 0, note: 'one hand picks two chips off the top — the bet band IS the count' },
  { t: '340ms', pick: 0, carry: 0.9, spot: 0, note: 'carried forward, in front of his cards' },
  { t: '520ms', pick: 0, carry: 0, spot: 2, note: 'placed on the bet spot. At street end the spot slides into the pot.' },
];

const HeroBetStripM = () => (
  <div style={{ width: 390, background: 'linear-gradient(180deg, #1d2e2c 0%, #162423 100%)', fontFamily: INTER, padding: '14px 0 16px', borderRadius: 4 }}>
    <div style={{ padding: '0 14px 12px' }}>
      <V5Lbl color={M_TEXT}>A bet, as objects</V5Lbl>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        520ms. Chips are things on a felt, not a number in a panel — so a bet is a hand moving them.
      </div>
    </div>
    {HERO_BET.map((f, i) => (
      <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Num size={9} color={i === 0 ? M_TEAL : M_MUTED} weight={600}>{f.t}</Num>
        <div style={{ position: 'relative', width: 132, height: 62, flexShrink: 0, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ position: 'absolute', left: 0, bottom: 4 }}><ChipStack n={6 - f.pick} w={20}/></div>
          {f.carry > 0 && (
            <div style={{ position: 'absolute', left: 26 + f.carry * 48, bottom: 8 + f.carry * 10 }}>
              <BetSpot n={2} w={17}/>
            </div>
          )}
          {f.spot > 0 && <div style={{ position: 'absolute', left: 78, bottom: 6 }}><BetSpot n={f.spot} w={17} amt="240"/></div>}
          <div style={{ position: 'absolute', right: 0, bottom: 30, width: 26, height: 12, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: '1px dashed rgba(255,255,255,0.14)' }}/>
        </div>
        <div style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>{f.note}</div>
      </div>
    ))}
    <div style={{ padding: '12px 14px 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
      <b style={{ color: M_DIM }}>The pot pill grows one step per band</b> — so a table that has been betting big looks different from one that has been limping, before you read a single figure. Opponents get the stack, the spot and the slide at seat scale, without the hand.
    </div>
  </div>
);

// an opponent's bet — same objects, no hand, three frames
const OPP_BET = [
  { t: '0ms', off: 0, note: 'his bank stands beside his name chip' },
  { t: '120ms', off: 0.5, note: 'chips leave the bank — no hand at seat scale, the stack simply parts' },
  { t: '240ms', off: 1, note: 'set down on his bet spot, in front of his pair' },
];

const OppBetStripM = () => (
  <div style={{ width: 390, background: 'linear-gradient(180deg, #1d2e2c 0%, #162423 100%)', fontFamily: INTER, padding: '14px 0 16px', borderRadius: 4 }}>
    <div style={{ padding: '0 14px 12px' }}>
      <V5Lbl color={M_TEXT}>An opponent bets</V5Lbl>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        240ms, three frames. Same chips and the same spot — but no hand, because at 40px a hand carrying two chips is mush.
      </div>
    </div>
    {OPP_BET.map((f, i) => (
      <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Num size={9} color={i === 0 ? M_TEAL : M_MUTED} weight={600}>{f.t}</Num>
        <div style={{ position: 'relative', width: 118, height: 56, flexShrink: 0 }}>
          <div style={{ position: 'absolute', left: 4, top: 6 }}><FloorGhost mood="confident" accent={M_TEAL} size={26} speed={6}/></div>
          <div style={{ position: 'absolute', left: 34, bottom: 8, opacity: 1 - f.off * 0.45 }}><ChipStack band="mid" w={12}/></div>
          {f.off > 0 && <div style={{ position: 'absolute', left: 34 + f.off * 40, bottom: 8 + f.off * 4 }}><BetSpot band="mid" w={12}/></div>}
        </div>
        <div style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>{f.note}</div>
      </div>
    ))}
  </div>
);

// street end: every spot sweeps in, and the pot's chip grows one band
const SWEEP = [
  { t: '0ms', p: 0, band: 'mid', note: 'four bet spots out, one per seat that acted' },
  { t: '180ms', p: 0.55, band: 'mid', note: 'all of them travel together — one sweep, not four animations' },
  { t: '320ms', p: 1, band: 'big', note: 'absorbed. The pot pill\u2019s chip gains a band.' },
];

const SweepStripM = () => (
  <div style={{ width: 390, background: 'linear-gradient(180deg, #1d2e2c 0%, #162423 100%)', fontFamily: INTER, padding: '14px 0 16px', borderRadius: 4 }}>
    <div style={{ padding: '0 14px 12px' }}>
      <V5Lbl color={M_TEXT}>Street end: the sweep</V5Lbl>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        320ms. Every spot moves at once, so the table resolves in one gesture.
      </div>
    </div>
    {SWEEP.map((f, i) => (
      <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <Num size={9} color={i === 0 ? M_TEAL : M_MUTED} weight={600}>{f.t}</Num>
        <div style={{ position: 'relative', width: 128, height: 56, flexShrink: 0 }}>
          <div style={{ position: 'absolute', left: 48, top: 16, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 7px', borderRadius: 12, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
            <div style={{ position: 'relative', width: 11, height: f.band === 'big' ? 13 : 9 }}>
              {(CHIP_BANDS[f.band]).slice(0, f.band === 'big' ? 4 : 3).map((d, k) => <Chip key={k} d={d} w={11} i={k} step={2.2}/>)}
            </div>
            <Num size={8.5} weight={700} color={M_TEXT}>POT</Num>
          </div>
          {[[6, 4], [12, 40], [96, 4], [104, 40]].map(([lx, ly], k) => (
            <div key={k} style={{ position: 'absolute', left: lx + (48 - lx) * f.p, bottom: ly + (18 - ly) * f.p, opacity: f.p === 1 ? 0 : 1 }}>
              <BetSpot band="small" w={11}/>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>{f.note}</div>
      </div>
    ))}
  </div>
);

// ── the seat anatomy sheet, at 3x with the pixel grid ────────────────────
const ANAT_ROWS = [
  ['Row 1', `${SEAT_BODY} px`, 'body. Face and brow always clear: cards from 60% down, fists under their bottom corners.'],
  ['Gap', `${SEAT_GAP} px`, 'the only vertical space in the seat.'],
  ['Row 2', `${SEAT_PILL} px`, 'one pill — name regular, stack mono, one line. Ring and dealer button attach to its left edge.'],
  ['Total', `${SEAT_H} px`, `if it will not fit, the pill drops to 16 — never the body.`],
];

const SeatAnatomyM = () => {
  const Z = 3, spec = { id: 'granite', name: 'Granite', stack: '2,104', x: 0, y: 0, mood: 'neutral', accent: M_GOLD, history: 3, dealer: true };
  const g = seatSlot({ x: 74, y: 56 });
  return (
    <div style={{ width: 390, background: '#101817', fontFamily: INTER, borderRadius: 4, padding: '14px 0 16px' }}>
      <div style={{ padding: '0 14px 12px' }}>
        <V5Lbl color={M_TEXT}>Seat anatomy</V5Lbl>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
          Two rows and two satellites, at 3×. Every element used to be positioned against the body, so at six seat coordinates they landed on each other.
        </div>
      </div>
      {/* the grid: 8px minor, 40px major, at 3x */}
      <div style={{ position: 'relative', height: SEAT_H * Z + 96, background: '#1d2e2c', overflow: 'hidden', borderTop: `1px solid ${M_BORDER}`, borderBottom: `1px solid ${M_BORDER}` }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: `${8 * Z}px ${8 * Z}px` }}/>
        <div style={{ position: 'absolute', left: 118, top: 24, width: 0, height: 0, transform: `scale(${Z})`, transformOrigin: 'top left' }}>
          <SeatGhost s={spec} dealt acting timer={9}/>
        </div>
        {/* the two row bands, called out on the left */}
        {[[0, SEAT_BODY, 'ROW 1'], [SEAT_BODY, SEAT_GAP, 'GAP'], [SEAT_BODY + SEAT_GAP, SEAT_PILL, 'ROW 2']].map(([t, h, l]) => (
          <div key={l} style={{ position: 'absolute', left: 0, top: 24 + t * Z, width: 108, height: h * Z, borderTop: `1px dashed ${M_TEAL}55`, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
            <Num size={8.5} color={M_TEAL} weight={600}>{l} · {h}px</Num>
          </div>
        ))}
        <div style={{ position: 'absolute', left: 0, top: 24 + SEAT_H * Z, width: 108, borderTop: `1px dashed ${M_TEAL}55` }}/>
      </div>
      {ANAT_ROWS.map(([k, v, note]) => (
        <div key={k} style={{ display: 'flex', gap: 9, padding: '9px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 42, flexShrink: 0 }}><Num size={9} color={M_TEAL} weight={600}>{k}</Num></div>
          <div style={{ width: 42, flexShrink: 0 }}><Num size={9.5} color={M_TEXT} weight={700}>{v}</Num></div>
          <div style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>{note}</div>
        </div>
      ))}
      <div style={{ padding: '11px 14px 0', borderTop: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED, lineHeight: 1.55 }}>
        <b style={{ color: M_DIM }}>The satellites.</b> The chip pile sits beside the seat on the felt side, never under the name, and the bet spot is the midpoint of pile and pot — so money always reads as travelling. Top-corner seats bank <b style={{ color: M_DIM }}>below the pill</b> (x{g.pile.x > 0 ? '+' : ''}{g.pile.x}, y+{g.pile.y}); side seats bank <b style={{ color: M_DIM }}>beside the body, inside</b> (x±35, y+6).
        <div style={{ marginTop: 8 }}><b style={{ color: M_DIM }}>Folded.</b> The body dims to 34% and the cards are gone entirely — no cards, no hands on cards. <b style={{ color: M_DIM }}>The pill stays at full opacity:</b> whatever else goes quiet, you can always read who is sitting there.</div>
      </div>
    </div>
  );
};

const RING_NOTES = {
  2: ['Heads-up', 'One opponent, dead centre. The empty corners are the point — a two-hander should feel like a duel, not a table with gaps in it.'],
  3: ['3-handed', 'Two seats, wide. No side row: at three players nobody sits level with the hero.'],
  4: ['4-handed', 'The full top row. The centre seat rides 8px higher, which reads as depth rather than a misalignment.'],
  5: ['5-handed', 'Two top, two side, symmetrical. The top pair pulls in to 92/298 so their piles clear the side seats\u2019 pills.'],
  6: ['6-max', 'The proven ring. Three top, two side, five piles, no collisions.'],
};

const TableSizesM = () => (
  <div style={{ width: 390, background: '#101817', fontFamily: INTER, borderRadius: 4, padding: '14px 0 16px' }}>
    <div style={{ padding: '0 14px 12px' }}>
      <V5Lbl color={M_TEXT}>Table sizes</V5Lbl>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        The anatomy was proven at 6-max only. One ring per handed count, every seat on the same 64px stack.
      </div>
    </div>
    {[2, 3, 4, 5, 6].map(n => (
      <div key={n} style={{ borderTop: `1px solid ${M_BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '10px 14px 6px' }}>
          <Num size={10} color={M_TEAL} weight={700}>{n}</Num>
          <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_TEXT }}>{RING_NOTES[n][0]}</span>
          <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED }}>{n - 1} opp</span>
        </div>
        {/* the felt at 0.55 — enough to judge collisions, small enough to compare */}
        <div style={{ position: 'relative', height: 176, margin: '0 14px 4px', borderRadius: 8, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 46%, #2f4d48 0%, #1d2e2c 62%, #131f1e 100%)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 390, height: 320, transform: 'scale(0.55)', transformOrigin: 'top left' }}>
            {seatsFor(n).map((s, i) => (
              <React.Fragment key={s.id}>
                <SeatGhost s={s} dealt acting={i === 0}/>
                <div style={{ position: 'absolute', left: s.x + seatSlot(s).pile.x, top: s.y + seatSlot(s).pile.y }}>
                  <ChipStack band={i % 3 === 0 ? 'big' : i % 3 === 1 ? 'mid' : 'small'} w={13}/>
                </div>
              </React.Fragment>
            ))}
            <div style={{ position: 'absolute', left: 0, right: 0, top: 244, display: 'flex', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 11px', borderRadius: 14, background: 'rgba(23,27,27,0.72)', border: `1px solid ${M_BORDER}` }}>
                <Lbl size={8}>Pot</Lbl><Num size={11} weight={700}>$480</Num>
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '2px 14px 11px', fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>{RING_NOTES[n][1]}</div>
      </div>
    ))}
  </div>
);

// ── the opponent muck ───────────────────────────────────────────────────
// A seat folding is not the hero folding: 250ms rather than 350, a flatter arc, and
// it ends at THE MUCK — one fixed spot beside the pot, so a table of six folds
// resolves to one pile instead of six directions.
// the HAND follows the throw and comes back — a fold is a gesture, not a fade, so
// nothing loses opacity at any frame and the hand always returns to rest.
const OPP_MUCK = [
  { t: '0ms', x: 0, y: 0, r: 0, s: 1, o: 1, hand: 'hold', note: 'at his seat, face down, his hand on the pair' },
  { t: '130ms', x: 34, y: 26, r: -12, s: 0.88, o: 1, hand: 'toss', note: 'thrown — the hand follows the throw out, flatter arc than the hero' },
  { t: '250ms', x: 68, y: 46, r: -22, s: 0.74, o: 1, hand: 'rest', note: 'landed on the pile; the hand is already back at rest' },
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
          <div style={{ position: 'absolute', left: 6, top: 2 }}>
            <FloorGhost mood="sulking" accent={M_PINK} size={30} speed={7}/>
            <svg width={30} height={30} viewBox="0 0 80 80" style={{ position: 'absolute', left: 0, top: 5, overflow: 'visible' }}>
              {ghostHands({ pose: f.hand, size: 40 })}
            </svg>
          </div>
          <div style={{ position: 'absolute', left: 10, top: 16, display: 'flex', gap: 1.5, transform: `translate(${f.x}px, ${f.y}px) rotate(${f.r}deg) scale(${f.s})`, transformOrigin: 'center', opacity: f.o }}>
            <CardBack w={15} h={21}/><CardBack w={15} h={21}/>
          </div>
        </div>
        <div style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>{f.note}</div>
      </div>
    ))}
    <div style={{ padding: '12px 14px 0', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
Never face up, and <b style={{ color: M_DIM }}>nothing fades</b> — a fold that dissolves reads as a bug, so the pair keeps full opacity all the way to the pile and the hand returns to rest on its own.
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
    <V5Felt acting="granite" oppSays={{ id: 'granite', text: 'Again?' }} stackBand="mid" betOut="mid" oppBet={['granite', 'phil']}
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
    <V5Felt acting="granite" stackBand="mid" betOut="mid" potBand="big"
      hero={<V5Hero toCall="240" action="BET $240" timer={9} hands="push" bet="mid"
        mood="frustrated" accent={M_PURPLE} heat={62} cost="toast"
        says="He had the ace of clubs the whole way."/>}/>
  </V5Shell>
);

const V5CeremonyWonScreenM = () => (
  <V5Shell>
    <V5Felt board={B5F} flip={5} pot="3,694" reveal dim
      hero={<V5Hero street="RIVER" equity={100} hands="hold" gone/>}>
      <V5Ceremony won pot="3,694" heat={54}/>
    </V5Felt>
  </V5Shell>
);

const V5CeremonyLostScreenM = () => (
  <V5Shell>
    <V5Felt board={B5F} flip={5} pot="3,694" reveal dim
      hero={<V5Hero street="RIVER" equity={0} mood="tilted" accent={M_PURPLE} heat={88} hands="hold" gone/>}>
      <V5Ceremony pot="3,694" winner="Granite" mood="tilted" heat={88}/>
    </V5Felt>
  </V5Shell>
);

const V5CostDotScreenM = () => (
  <V5Shell>
    <V5Felt acting="granite" stackBand="mid" betOut="mid" potBand="big"
      hero={<V5Hero toCall="240" action="BET $240" timer={9} hands="push" bet="mid"
        mood="frustrated" accent={M_PURPLE} heat={62} cost="dot"/>}/>
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
  RING_NOTES, TableSizesM, ANAT_ROWS, SeatAnatomyM, OPP_BET, OppBetStripM, SWEEP, SweepStripM, CHIP_D, Chip, V5CostDotScreenM, CHIP_BANDS, BET_BANDS, ChipStack, BetSpot, HERO_BET, HeroBetStripM,
  OPP_MUCK, OppMuckStripM, V5Shell, V5CalmScreenM, V5HoldScreenM, V5WhisperScreenM, V5ThreadScreenM,
  V5ReadScreenM, V5CostScreenM, V5CeremonyWonScreenM, V5CeremonyLostScreenM, D9V5ScreenM,
});
