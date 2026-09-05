// WATCH v3 — the fix for "a simulation, not a game."
// Three findings, three answers: nothing had tension (→ pacing states, server-driven),
// the money was a corner number (→ the tug-of-war bar under the board), the decision
// line read like a solver (→ thread voice, ≤12 words). The felt, the LiveBar row and
// every law survive; two tabs replace four; the table-id line is gone.

const W3 = {
  hero: { cards: [['A', 's'], ['K', 'h']], stack: '1,847', pos: 'BTN' },
  opp: { name: 'Granite', stack: '2,104', pos: 'BB' },
  folded: { name: 'doyle_v3', stack: '1,290', pos: 'CO', folded: true },
};

// ── the one thing a non-poker player reads ───────────────────────────────────
// Not a percentage in a corner: a rope, with him on one end. Hero's number sits on
// hero's end, the villain end stays unlabelled — the owner is watching his agent,
// not refereeing. Animates on every street; the seam is the only moving part.
const TugBar = ({ equity, w, dead, big }) => {
  const e = Math.max(2, Math.min(98, equity));
  const h = big ? 12 : 9;
  return (
    <div style={{ width: w || '100%' }}>
      <div style={{ position: 'relative', height: h, borderRadius: h / 2, overflow: 'hidden', background: dead ? M_SURF : 'rgba(255,107,109,0.22)', border: `1px solid ${dead ? M_BORDER : 'rgba(255,107,109,0.35)'}` }}>
        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${e}%`, background: dead ? `${M_MUTED}55` : `linear-gradient(90deg, ${M_TEAL}CC, ${M_TEAL})`, boxShadow: dead ? 'none' : `0 0 12px ${M_TEAL}66`, transition: 'width 0.6s cubic-bezier(.4,0,.2,1)' }}/>
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `calc(${e}% - 1px)`, width: 2, background: '#EDEDED', boxShadow: '0 0 6px rgba(0,0,0,0.6)' }}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 4 }}>
        <Num size={big ? 15 : 12.5} weight={700} color={dead ? M_MUTED : M_TEAL}>{dead ? '—' : `${equity}%`}</Num>
        <div style={{ flex: 1 }}/>
        <Num size={9} color={M_MUTED} weight={500}>{W3.opp.name.toUpperCase()}</Num>
      </div>
    </div>
  );
};

// ── the hero row: LiveBar's own anatomy, now carrying street and to-call ─────
const HeroRow3 = ({ street, toCall, action, timer, faceDown, note, tag }) => (
  <div style={{
    position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 4,
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 9px', borderRadius: 12,
    background: 'rgba(23,27,27,0.78)',
    border: `1px solid ${action ? `${M_TEAL}55` : M_BORDER}`,
    boxShadow: action ? `inset 0 1px 0 ${M_TEAL}2E, 0 4px 12px rgba(0,0,0,0.4)` : 'none',
  }}>
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {W3.hero.cards.map((c, i) => (
        <div key={i} style={{ transform: `rotate(${i ? 3 : -3}deg)`, filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.6))' }}>
          {faceDown ? <CardBack w={36} h={50} branded/> : <PlayingCard rank={c[0]} suit={c[1]} w={36} h={50}/>}
        </div>
      ))}
    </div>
    <div style={{ width: 1, height: 20, background: M_BORDER, flexShrink: 0, marginLeft: 3 }}/>
    <div style={{ minWidth: 0 }}>
      <Lbl size={8.5}>Stack</Lbl>
      <div><Num size={12.5} weight={700}>${W3.hero.stack}</Num></div>
    </div>
    <div style={{ width: 1, height: 20, background: M_BORDER, flexShrink: 0 }}/>
    <div style={{ minWidth: 0 }}>
      <Lbl size={8.5}>{toCall ? 'To call' : 'Street'}</Lbl>
      <div><Num size={12.5} weight={700} color={toCall ? M_GOLD : M_DIM}>{toCall ? `$${toCall}` : street}</Num></div>
    </div>
    <div style={{ flex: 1 }}/>
    {action ? (
      <>
        <span style={{ padding: '5px 10px', borderRadius: 5, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap', flexShrink: 0 }}>{action}</span>
        {timer != null && <SeatTimerRing value={timer}/>}
        {tag && <span style={{ padding: '5px 8px', borderRadius: 5, background: `${M_RED}1F`, border: `1px solid ${M_RED}66`, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: M_RED, whiteSpace: 'nowrap', flexShrink: 0 }}>{tag}</span>}
      </>
    ) : (
      <span style={{ fontSize: 11.5, color: M_MUTED, whiteSpace: 'nowrap' }}>{note}</span>
    )}
  </div>
);

// ── the four pacing states, one component ───────────────────────────────────
// CALM → HEATING → ALL-IN → SHOWDOWN is a server-driven ladder, not a UI mode: the
// client is told which one it is in. The ALL-IN hold exists ONLY while a spectator is
// watching; unwatched, the hand resolves at machine speed and becomes a replay.
const PACE = {
  calm:     { label: 'CALM',     color: M_MUTED, glow: 0,   note: 'default. Nothing about the felt asks for attention.' },
  heating:  { label: 'HEATING',  color: M_GOLD,  glow: 0.5, note: 'pot crossed the threshold. Felt warms, ticker grows, one haptic tap.' },
  allin:    { label: 'ALL-IN',   color: M_RED,   glow: 1,   note: 'a 3–5s hold on his line before the runout. Spectator only.' },
  showdown: { label: 'SHOWDOWN', color: M_TEAL,  glow: 0.7, note: 'cards flip one at a time, the reveal is held, then the pot slides.' },
};

const PaceFelt = ({ pace = 'calm', h = 352, pot, board, flip = 5, equity, dead, line, children, potTo, bottomBand = 0 }) => {
  const p = PACE[pace];
  const heat = pace === 'heating' || pace === 'allin';
  return (
    <div style={{
      position: 'relative', flexShrink: 0, height: h, overflow: 'hidden',
      background: heat
        ? `radial-gradient(ellipse at 50% 38%, #3b4a3f 0%, #24302c 58%, #17211f 100%)`
        : 'radial-gradient(ellipse at 50% 40%, #2f4d48 0%, #1d2e2c 62%, #162423 100%)',
      borderBottom: `1px solid ${p.color}${heat ? '66' : '38'}`,
    }}>
      {p.glow > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', boxShadow: `inset 0 0 ${70 * p.glow}px ${p.color}${pace === 'allin' ? '4D' : '33'}`, animation: pace === 'allin' ? 'shimmer 1.4s ease-in-out infinite' : 'none' }}/>
      )}
      <div style={{ position: 'absolute', left: '-14%', right: '-14%', top: 30, height: h - 32, borderRadius: '50%', border: `1px solid ${M_TEAL}1F`, pointerEvents: 'none' }}/>

      <div style={{ position: 'absolute', top: 10, left: 12, zIndex: 3 }}><SeatChip {...W3.opp} history="3"/></div>
      <div style={{ position: 'absolute', top: 10, right: 12, zIndex: 3 }}><SeatChip {...W3.folded} align="right"/></div>

      {/* pot — the ticker grows with the state, and slides on a showdown */}
      <div style={{ position: 'absolute', top: 62, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, borderRadius: 18,
          padding: heat ? '5px 17px' : '3px 13px',
          background: heat ? `${p.color}1F` : 'rgba(23,27,27,0.6)',
          border: `1px solid ${heat ? `${p.color}66` : M_BORDER}`,
          transform: potTo ? 'translateY(-30px) scale(0.82)' : 'none',
          opacity: potTo ? 0.5 : 1,
          transition: 'transform 0.7s cubic-bezier(.4,0,.2,1), opacity 0.7s',
        }}>
          <Lbl size={9} color={heat ? p.color : M_MUTED}>Pot</Lbl>
          <Amt size={heat ? 30 : 23}>${pot}</Amt>
        </div>
      </div>

      {/* board — `flip` is how many cards have landed, for the showdown reveal */}
      <div style={{ position: 'absolute', top: heat ? 116 : 112, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 3 }}>
        {board.map((c, i) => (
          <div key={i} style={{ animation: i === flip - 1 && pace === 'showdown' ? 'rise 0.4s ease-out both' : 'none' }}>
            {c && i < flip
              ? <PlayingCard rank={c[0]} suit={c[1]} w={44} h={61}/>
              : <CardBack w={44} h={61} branded/>}
          </div>
        ))}
      </div>

      {/* the rope, directly under the board — the money on the line, made physical */}
      <div style={{ position: 'absolute', top: heat ? 190 : 186, left: 44, right: 44, zIndex: 3 }}>
        <TugBar equity={equity} dead={dead} big={heat}/>
      </div>

      {/* his line — one line, ≤12 words, thread voice */}
      {line && (
        <div style={{ position: 'absolute', ...(bottomBand ? { bottom: bottomBand + 12 } : { top: 236 }), left: 16, right: 16, zIndex: 3, textAlign: 'center' }}>
          <span style={{
            display: 'inline-block', maxWidth: '100%', padding: pace === 'allin' ? '9px 14px' : '0',
            borderRadius: 10,
            background: pace === 'allin' ? 'rgba(10,10,10,0.6)' : 'transparent',
            border: pace === 'allin' ? `1px solid ${M_RED}44` : 'none',
            fontFamily: pace === 'allin' ? PLAYFAIR : INTER,
            fontSize: pace === 'allin' ? 17 : 13,
            fontWeight: pace === 'allin' ? 600 : 400,
            fontStyle: pace === 'allin' ? 'normal' : 'italic',
            color: M_TEXT, lineHeight: 1.4,
          }}>{line}</span>
        </div>
      )}
      {children}
    </div>
  );
};

// ── READ · his picture of the opponent ──────────────────────────────────────
// The opponent model exists server-side; nothing surfaced it. Bars fill as evidence
// arrives and a teal confidence bracket narrows with hands — the READS attribute
// decides how fast that happens, which is the first place an attribute is felt
// rather than read. Never "waiting for the first action": before evidence he says so.
const ReadBar = ({ k, label, v, conf, formed }) => {
  const lo = Math.max(0, v - conf), hi = Math.min(100, v + conf);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
      <span style={{ width: 96, flexShrink: 0, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.11em', color: formed ? M_TEAL : M_MUTED }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', height: 6, borderRadius: 3, background: M_SURF }}>
        {v != null && (
          <>
            <div style={{ position: 'absolute', top: -3, height: 12, left: `${lo}%`, width: `${hi - lo}%`, background: `${M_TEAL}14`, borderLeft: `1px solid ${M_TEAL}55`, borderRight: `1px solid ${M_TEAL}55` }}/>
            <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${v}%`, borderRadius: 3, background: formed ? '#D6D6DA' : `${M_DIM}99`, transition: 'width 0.5s ease-out' }}/>
          </>
        )}
      </div>
      <span style={{ width: 26, flexShrink: 0, textAlign: 'right', fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: v == null ? M_FAINT : formed ? M_TEXT : M_DIM }}>{v == null ? '··' : `${v}`}</span>
    </div>
  );
};

const READ_FULL = [
  { k: 'vpip', label: 'PLAYS', v: 19, conf: 3, formed: true },
  { k: 'pfr', label: 'RAISES FIRST', v: 14, conf: 4, formed: true },
  { k: 'aggr', label: 'AGGRESSION', v: 31, conf: 6, formed: true },
  { k: 'fold', label: 'FOLDS TO HEAT', v: 8, conf: 5, formed: true },
  { k: 'sd', label: 'GOES TO SHOWDOWN', v: 41, conf: 9 },
];

const READ_EMPTY = READ_FULL.map(r => ({ ...r, v: null, conf: 0, formed: false }));

const ReadPanel = ({ rows = READ_FULL, hands = 142, line, forming }) => (
  <div style={{ padding: '10px 14px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 2 }}>
      <Lbl size={9.5}>{W3.opp.name}</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      <Num size={9} color={M_MUTED} weight={500}>{hands ? `${hands} HANDS SEEN` : 'NO EVIDENCE YET'}</Num>
    </div>
    {rows.map(r => <ReadBar key={r.k} {...r}/>)}
    {line && (
      <div style={{
        marginTop: 9, padding: '9px 11px', borderRadius: 9,
        background: forming ? `${M_TEAL}0D` : 'transparent',
        border: forming ? `1px solid ${M_TEAL}33` : `1px solid ${M_BORDER}`,
        fontSize: 12.5, color: forming ? M_TEXT : M_DIM, lineHeight: 1.45, fontStyle: 'italic',
        animation: forming ? 'rise 0.5s ease-out both' : 'none',
      }}>&ldquo;{line}&rdquo;</div>
    )}
  </div>
);

// ── two tabs. Four were three too many. ─────────────────────────────────────
const Tabs3 = ({ active = 'read' }) => (
  <div style={{ flexShrink: 0, display: 'flex', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '0 8px' }}>
    {[{ id: 'read', label: 'Read' }, { id: 'chat', label: 'Chat' }].map(t => {
      const on = t.id === active;
      return (
        <div key={t.id} style={{
          flex: 1, textAlign: 'center', padding: '11px 0 9px', cursor: 'pointer',
          fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: on ? M_TEAL : M_MUTED,
          borderBottom: on ? `2px solid ${M_TEAL}` : '2px solid transparent', marginBottom: -1,
        }}>{t.label}</div>
      );
    })}
  </div>
);

// ── the prediction beat · optional, drawn for the decision ──────────────────
// A bet ON him, never a control: the verb is his ("he's going to…"), the chips lock
// the moment he acts, and there is nothing to spend. No coins, no streak reward —
// the streak is the whole prize.
const PredictBeat = ({ picked, locked, right, streak = 4 }) => (
  <div style={{ padding: '10px 14px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
      <Lbl size={9.5} color={locked ? M_GOLD : M_TEAL}>{locked ? (right ? 'You called it' : 'Not this time') : "He's going to…"}</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      <Num size={9} color={M_GOLD} weight={600}>{right ? streak + 1 : 0} IN A ROW</Num>
    </div>
    <div style={{ display: 'flex', gap: 7 }}>
      {['Fold', 'Call', 'Raise'].map(c => {
        const on = picked === c;
        const won = locked && right && on;
        const lost = locked && !right && on;
        return (
          <div key={c} style={{
            flex: 1, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: won ? `${M_TEAL}1F` : lost ? `${M_RED}14` : on ? `${M_TEAL}14` : M_PANEL_2,
            border: `1px solid ${won ? M_TEAL : lost ? `${M_RED}66` : on ? `${M_TEAL}66` : M_BORDER}`,
            opacity: locked && !on ? 0.4 : 1, cursor: locked ? 'default' : 'pointer',
            fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: won ? M_TEAL : lost ? M_RED : on ? M_TEAL : M_DIM,
          }}>{c}</div>
        );
      })}
    </div>
  </div>
);

// ═══ ARTBOARDS ═══════════════════════════════════════════════════════════════
const B4 = [['K', 'c'], ['9', 'c'], ['4', 'c'], ['2', 'c'], null];
const B5 = [['K', 'c'], ['9', 'c'], ['4', 'c'], ['2', 'c'], ['5', 'h']];

const W3Shell = ({ children }) => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    {children}
  </PhoneShell>
);

const Watch3CalmScreenM = () => (
  <W3Shell>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="rolling — three big pots in a row"/>
    <PaceFelt pace="calm" h={330} pot="480" board={B4} flip={4} equity={87} bottomBand={80}
      line="He checked twice. He's got nothing.">
      <HeroRow3 street="TURN" note="his turn next"/>
    </PaceFelt>
    <Tabs3 active="read"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <ReadPanel line="He never folds, so I stop bluffing him."/>
    </div>
  </W3Shell>
);

const Watch3HeatingScreenM = () => (
  <W3Shell>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="pot past $1,000 — he's in it"/>
    <PaceFelt pace="heating" h={330} pot="1,240" board={B4} flip={4} equity={71} bottomBand={80}
      line="Now it's a real pot. Good.">
      <HeroRow3 toCall="620" action="BET $620" timer={7}/>
    </PaceFelt>
    <Tabs3 active="read"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <PredictBeat picked="Raise"/>
    </div>
  </W3Shell>
);

const Watch3AllInScreenM = () => (
  <W3Shell>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="all-in for $1,847 — holding"/>
    <PaceFelt pace="allin" h={372} pot="3,694" board={B4} flip={4} equity={64} bottomBand={80}
      line="All of it. He's drawing.">
      <HeroRow3 action="ALL-IN" tag="RIVER IN 3"/>
    </PaceFelt>
    <Tabs3 active="read"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <PredictBeat picked="Raise" locked right/>
    </div>
  </W3Shell>
);

const Watch3ShowdownScreenM = () => (
  <W3Shell>
    <MoodBand accent={M_TEAL} mood="confident" state="live" action="Chat"
      cause="won $3,694 — the flush held"/>
    <PaceFelt pace="showdown" h={352} pot="3,694" board={B5} flip={5} equity={100} potTo bottomBand={84}
      line="Told you. Nothing.">
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 4, display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 12, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}66` }}>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {W3.hero.cards.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={34} h={47}/>)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Lbl size={8.5} color={M_TEAL}>Ace-high flush</Lbl>
          <div style={{ fontSize: 11.5, color: M_DIM, marginTop: 2 }}>{W3.opp.name} showed king-nine</div>
        </div>
        <Num size={17} weight={700} color={M_TEAL}>+$3,694</Num>
      </div>
    </PaceFelt>
    <Tabs3 active="read"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <ReadPanel forming line="He'll call a big one with nothing. Noted." hands={143}
        rows={READ_FULL.map(r => r.k === 'sd' ? { ...r, v: 44, conf: 6, formed: true } : r)}/>
    </div>
  </W3Shell>
);

const Watch3NoReadScreenM = () => (
  <W3Shell>
    <MoodBand accent={M_TEAL} mood="neutral" state="live" action="Chat"
      cause="new table — nobody read yet"/>
    <PaceFelt pace="calm" h={330} pot="30" board={[null, null, null, null, null]} flip={0} equity={50} dead bottomBand={80}
      line="Ace-ten. Fine. Let's see who's home.">
      <HeroRow3 street="PREFLOP" faceDown={false} note="he's in"/>
    </PaceFelt>
    <Tabs3 active="read"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <ReadPanel rows={READ_EMPTY} hands={0} line="Give me a few hands."/>
    </div>
  </W3Shell>
);

// ── desktop parity: the same felt as the stage, READ in the rail ────────────
const D3Watch3ScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$1,240" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 48% 40%, #3b4a3f 0%, #202c28 58%, #131c1a 100%)' }}>
        <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 90px ${M_GOLD}2E`, pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', left: '-8%', right: '-8%', top: 40, bottom: 40, borderRadius: '50%', border: `1px solid ${M_TEAL}1A`, pointerEvents: 'none' }}/>

        <div style={{ position: 'absolute', top: 22, left: 28, zIndex: 3 }}><SeatChip {...W3.opp} history="3"/></div>
        <div style={{ position: 'absolute', top: 22, right: 28, zIndex: 3 }}><SeatChip {...W3.folded} align="right"/></div>

        <div style={{ position: 'absolute', top: 92, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 20px', borderRadius: 20, background: `${M_GOLD}1F`, border: `1px solid ${M_GOLD}66` }}>
            <Lbl size={9.5} color={M_GOLD}>Pot</Lbl>
            <Amt size={34}>$1,240</Amt>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 168, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 3 }}>
          {B4.map((c, i) => c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={62} h={86}/> : <CardBack key={i} w={62} h={86} branded/>)}
        </div>
        <div style={{ position: 'absolute', top: 282, left: '26%', right: '26%', zIndex: 3 }}>
          <TugBar equity={71} big/>
        </div>
        <div style={{ position: 'absolute', top: 344, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
          <span style={{ fontFamily: PLAYFAIR, fontSize: 20, fontWeight: 600, color: M_TEXT }}>&ldquo;Now it&rsquo;s a real pot. Good.&rdquo;</span>
        </div>

        <div style={{ position: 'absolute', left: 28, right: 28, bottom: 22, zIndex: 4, display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 14, background: 'rgba(23,27,27,0.8)', border: `1px solid ${M_TEAL}55` }}>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {W3.hero.cards.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={44} h={61}/>)}
          </div>
          <div style={{ width: 1, height: 26, background: M_BORDER }}/>
          <div><Lbl size={8.5}>Stack</Lbl><div><Num size={14} weight={700}>$1,847</Num></div></div>
          <div style={{ width: 1, height: 26, background: M_BORDER }}/>
          <div><Lbl size={8.5}>To call</Lbl><div><Num size={14} weight={700} color={M_GOLD}>$620</Num></div></div>
          <div style={{ flex: 1 }}/>
          <span style={{ padding: '7px 14px', borderRadius: 6, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em' }}>BET $620</span>
          <SeatTimerRing value={7}/>
        </div>
      </div>
      <Panel>
        <PanelHead title="Read" sub={`${W3.opp.name.toUpperCase()} · 142 HANDS`}/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ReadPanel line="He never folds, so I stop bluffing him."/>
          <div style={{ marginTop: 6, borderTop: `1px solid ${M_BORDER}`, paddingTop: 4 }}>
            <PredictBeat picked="Raise"/>
          </div>
        </div>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  W3, PACE, TugBar, HeroRow3, PaceFelt, ReadBar, ReadPanel, READ_FULL, READ_EMPTY,
  Tabs3, PredictBeat, B4, B5,
  Watch3CalmScreenM, Watch3HeatingScreenM, Watch3AllInScreenM, Watch3ShowdownScreenM,
  Watch3NoReadScreenM, D3Watch3ScreenM,
});
