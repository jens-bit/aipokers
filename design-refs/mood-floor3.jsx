// FLOOR v3 — three directions for the owner's home screen.
// The v2 floor is one room with felts in it, and nothing happens there that isn't a
// hand: no reason to open the app between sessions, and no sense that 1,600 agents
// are playing around yours. Each direction below answers "what is this screen FOR"
// differently. Characters, hands, chips and the never-covered rule come from board 26.

const F3_MINE = [
  { id: 'bal', name: 'Balanced v2.1',   accent: M_TEAL,   mood: 'confident',  stake: '10/20',  pnl: '+340', hands: 42,  seat: 3 },
  { id: 'agg', name: 'Aggressive v1.3', accent: M_PURPLE, mood: 'tilted',     stake: '25/50',  pnl: '−1,120', hands: 210, seat: 1 },
  { id: 'blf', name: 'Bluff Master',    accent: M_GOLD,   mood: 'frustrated', stake: '10/20',  pnl: '+90',  hands: 88,  seat: 5 },
  { id: 'val', name: 'Value Bot',       accent: M_PINK,   mood: 'sulking',    stake: null,     pnl: '−40',  hands: 0,   seat: null },
];

// the casino as EVENTS rather than as a map. 1,600 agents cannot be drawn; what they
// do can be told, and one line of it is worth more than a hundred table tiles.
const F3_TICKER = [
  { k: 'pot',     lbl: 'BIGGEST POT',   line: '$14,200 — Ozymandias cracked aces',  at: '50/100', hot: true },
  { k: 'cooler',  lbl: 'COOLER',        line: 'quads into a straight flush, table 8', at: '25/50' },
  { k: 'heater',  lbl: 'HEATER',        line: 'Nightjar up $9k in 40 minutes',      at: '25/50' },
  { k: 'bust',    lbl: 'BUSTED',        line: 'Fold_Equity out — third time today', at: '10/20' },
  { k: 'nemesis', lbl: 'NEMESIS',       line: 'Granite just sat down at your table', at: '10/20', mine: true },
];

const F3_ROOMS = [
  { id: 'floor', name: 'The floor',    stake: '10/20',  agents: 1180, tables: 197, noise: 3, mine: ['bal', 'blf'] },
  { id: 'up',    name: 'Upstairs',     stake: '25/50',  agents: 380,  tables: 63,  noise: 2, mine: ['agg'] },
  { id: 'back',  name: 'The back room', stake: '50/100', agents: 44,   tables: 7,   noise: 1, mine: [] },
];

// ── shared parts ─────────────────────────────────────────────────────────
const F3_GLASS = { panel: 'rgba(13,23,21,0.72)', raised: 'rgba(18,30,28,0.86)', edge: 'rgba(255,255,255,0.10)', edgeUp: 'rgba(255,255,255,0.16)', blur: 'blur(14px)' };

const F3Head = ({ title, sub, right }) => (
  <div style={{ flexShrink: 0, height: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0E1516' }}>
    <SpadeLogo/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, lineHeight: 1.1 }}>{title}</div>
      {sub && <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>{sub}</div>}
    </div>
    {right}
  </div>
);

// the per-hand result: a toast over the felt, 2s. Never a block, never the ceremony —
// that exists once, when the session ends.
const F3Toast = ({ amt, up, big, style }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: big ? '5px 11px' : '3px 8px', borderRadius: 13,
    background: F3_GLASS.raised, backdropFilter: F3_GLASS.blur, WebkitBackdropFilter: F3_GLASS.blur,
    border: `1px solid ${up ? M_TEAL : M_RED}${big ? 'AA' : '55'}`,
    boxShadow: big ? `0 0 18px ${up ? M_TEAL : M_RED}44` : 'none',
    animation: 'rise 0.25s ease-out both', ...style,
  }}>
    <Num size={big ? 15 : 11} weight={700} color={up ? M_TEAL : M_RED}>{up ? '+' : '−'}${amt}</Num>
    {big && <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED }}>POT</span>}
  </div>
);

// an agent at a felt, small: face, hands, his pair. Used at every scale below.
const F3Body = ({ a, size = 40, pose = 'hold', event, dealt = true }) => (
  <div style={{ position: 'relative', width: size, height: size }}>
    <MoodGhost mood={a.mood} accent={a.accent} size={size} event={event} ring={false}/>
    {dealt && (
      <div style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translateX(-50%)', display: 'flex', gap: 2, zIndex: 4 }}>
        {[0, 1].map(i => <CardBack key={i} w={size * 0.36} h={size * 0.48}/>)}
      </div>
    )}
    <svg width={size} height={size} viewBox="0 0 80 80" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex: 5, pointerEvents: 'none' }}>
      {ghostHands({ pose, size, grip: SEAT_GRIP })}
    </svg>
  </div>
);

const F3Pill = ({ children, color = M_DIM, bg = 'rgba(14,17,18,0.86)', bd = M_BORDER, size = 9 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 17, padding: '0 7px', borderRadius: 9, background: bg, border: `1px solid ${bd}`, fontSize: size, color, whiteSpace: 'nowrap' }}>{children}</span>
);

const F3Stake = ({ s }) => <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: M_GOLD }}>{s}</span>;

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION A — THE BOX SEATS
// Your four felts in full detail, stacked as cards you scroll. The other 1,600
// agents exist only as a ticker: five lines of what the casino is doing, each
// tappable to spectate. A felt goes HOT when a big showdown is building.
// ═══════════════════════════════════════════════════════════════════════════

const ABox = ({ a, hot, toast, solo }) => (
  <div style={{
    position: 'relative', borderRadius: 14, overflow: 'hidden', flexShrink: 0,
    border: `1px solid ${hot ? `${M_GOLD}88` : M_BORDER}`,
    boxShadow: hot ? `0 0 22px ${M_GOLD}33` : 'none',
    background: 'radial-gradient(ellipse at 50% 34%, #2f4d48 0%, #1d2e2c 62%, #131f1e 100%)',
  }}>
    {/* the felt itself: his seat plus the opponents that matter, at card scale */}
    <div style={{ position: 'relative', height: solo ? 214 : 168 }}>
      {hot && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 46%, ${M_GOLD}1F, transparent 68%)`, animation: 'shimmer 2.2s ease-in-out infinite' }}/>}
      {/* opponents, backs only — the fish-tank law */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 12, display: 'flex', justifyContent: 'center', gap: solo ? 30 : 22 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ opacity: i === 1 && hot ? 1 : 0.72 }}>
            <F3Body a={{ mood: i === 1 && hot ? 'confident' : 'neutral', accent: i === 1 && hot ? M_RED : M_NEUTRAL }} size={26}/>
          </div>
        ))}
      </div>
      {/* board and pot */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: solo ? 84 : 62, display: 'flex', justifyContent: 'center', gap: 3 }}>
        {[['A','s'],['K','h'],['7','c'],['7','d']].map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={20} h={28}/>)}
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: solo ? 118 : 96, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 7, zIndex: 8 }}>
        <F3Pill bd={hot ? `${M_GOLD}66` : M_BORDER}><Lbl size={8}>Pot</Lbl><Num size={10.5} weight={700} color={hot ? M_GOLD : M_TEXT}>${hot ? '4,180' : '480'}</Num></F3Pill>
        {toast && <F3Toast amt={toast} up/>}
      </div>
      {/* him, bottom centre, twice an opponent */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, display: 'flex', justifyContent: 'center' }}>
        <F3Body a={a} size={solo ? 56 : 44} pose={hot ? 'clench' : 'hold'} event={hot ? 'locked' : undefined}/>
      </div>
      {hot && (
        <div style={{ position: 'absolute', left: 10, top: 10 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD, border: `1px solid ${M_GOLD}77`, background: `${M_GOLD}1A`, borderRadius: 3, padding: '2px 6px' }}>HOT · ALL-IN</span>
        </div>
      )}
    </div>
    {/* one row under the felt: who, where, how he is doing */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', background: 'rgba(9,14,13,0.72)', borderTop: `1px solid ${F3_GLASS.edge}` }}>
      <span style={{ fontSize: 11.5, color: M_TEXT, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
      <F3Stake s={a.stake}/>
      <MoodPip mood={a.mood}/>
      <Num size={10.5} weight={700} color={a.pnl[0] === '+' ? M_TEAL : M_RED}>{a.pnl}</Num>
    </div>
  </div>
);

const ATicker = ({ items = F3_TICKER }) => (
  <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: '#0C1211' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px 5px' }}>
      <LiveDot/><Lbl size={8.5}>The floor · 1,604 playing</Lbl>
    </div>
    <div style={{ display: 'flex', gap: 8, padding: '0 14px 11px', overflow: 'hidden' }}>
      {items.slice(0, 3).map(t => (
        <div key={t.k} style={{ flexShrink: 0, width: 152, padding: '7px 9px', borderRadius: 10, background: t.mine ? `${M_GOLD}14` : 'rgba(255,255,255,0.04)', border: `1px solid ${t.mine ? `${M_GOLD}55` : M_BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.14em', color: t.mine ? M_GOLD : t.hot ? M_RED : M_MUTED }}>{t.lbl}</span>
            <F3Stake s={t.at}/>
          </div>
          <div style={{ fontSize: 10, color: M_DIM, lineHeight: 1.35 }}>{t.line}</div>
        </div>
      ))}
    </div>
  </div>
);

const A_HomeM = () => (
  <PhoneShell>
    <F3Head title="Your box" sub="4 agents · 3 at felts" right={<F3Pill color={M_TEAL} bd={`${M_TEAL}55`}><Num size={10} weight={700} color={M_TEAL}>+$1,290</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10, padding: '11px 14px', background: M_BG }}>
      <ABox a={F3_MINE[1]} hot/>
      <ABox a={F3_MINE[0]} toast="340"/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 12, border: `1px dashed ${M_BORDER_2}`, background: 'rgba(255,255,255,0.02)' }}>
        <F3Body a={F3_MINE[3]} size={30} pose="rest" dealt={false}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: M_DIM }}>{F3_MINE[3].name}</div>
          <div style={{ fontSize: 9.5, color: M_MUTED }}>at the bar · sulking</div>
        </div>
        <Btn h={26}>Sit him down</Btn>
      </div>
    </div>
    <ATicker/>
    <TabBar active="casino"/>
  </PhoneShell>
);

const A_SoloM = () => (
  <PhoneShell>
    <F3Head title="Your box" sub="1 agent · his first session"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 11, padding: '13px 14px', background: M_BG }}>
      <ABox a={F3_MINE[0]} solo/>
      <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${M_BORDER}` }}>
        <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.5 }}>He is 42 hands into his first session. <b style={{ color: M_TEXT }}>Watch him</b> to see the hand, or leave him — he plays either way.</div>
      </div>
      <Btn full>Watch him</Btn>
    </div>
    <ATicker items={F3_TICKER.slice(0, 3)}/>
    <TabBar active="casino"/>
  </PhoneShell>
);

const A_SpectateM = () => (
  <PhoneShell>
    <F3Head title="Ozymandias" sub="50/100 · not yours · spectating" right={<F3Pill color={M_MUTED}>Leave</F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
      <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${M_GOLD}66`, background: 'radial-gradient(ellipse at 50% 36%, #2f4d48 0%, #1d2e2c 62%, #131f1e 100%)', position: 'relative', height: 300 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 16, display: 'flex', justifyContent: 'center', gap: 26 }}>
          {[M_NEUTRAL, M_RED, M_NEUTRAL].map((c, i) => <F3Body key={i} a={{ mood: i === 1 ? 'confident' : 'neutral', accent: c }} size={34}/>)}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 112, display: 'flex', justifyContent: 'center', gap: 4 }}>
          {[['A','s'],['A','d'],['K','c'],['Q','c'],['J','c']].map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={26} h={36}/>)}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 158, display: 'flex', justifyContent: 'center' }}>
          <F3Pill bd={`${M_GOLD}66`}><Lbl size={8}>Pot</Lbl><Num size={13} weight={700} color={M_GOLD}>$14,200</Num></F3Pill>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', gap: 26 }}>
          {[M_NEUTRAL, M_TEAL].map((c, i) => <F3Body key={i} a={{ mood: 'neutral', accent: c }} size={38}/>)}
        </div>
        <div style={{ position: 'absolute', left: 12, top: 12 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD, border: `1px solid ${M_GOLD}77`, background: `${M_GOLD}1A`, borderRadius: 3, padding: '2px 6px' }}>BIGGEST POT ON THE FLOOR</span>
        </div>
      </div>
      {/* the difference that matters: no hole cards, no voice, no composer */}
      <div style={{ marginTop: 11, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${M_BORDER}` }}>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>Nobody's cards are face up here and there is no whisper box. <b style={{ color: M_DIM }}>Spectating is watching a room, not owning one</b> — the fish-tank law only lifts for your own.</div>
      </div>
    </div>
    <TabBar active="casino"/>
  </PhoneShell>
);

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION B — THE BUILDING
// Stakes are floors of a building you move through. Each room shows its own
// crowd and noise, your agents are shown where they stand, and the ticker is
// the announcement board by the stairs.
// ═══════════════════════════════════════════════════════════════════════════

// crowd density drawn as anonymous heads, capped — 1,180 agents is a texture, not
// a count, and the number sits beside it for anyone who wants the truth.
const BCrowd = ({ n, w = 150 }) => {
  const dots = Math.min(46, Math.round(n / 26));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, width: w, alignContent: 'flex-start' }}>
      {Array.from({ length: dots }).map((_, i) => (
        <span key={i} style={{ width: 5, height: 6, borderRadius: '3px 3px 1px 1px', background: `rgba(237,237,237,${0.1 + (i % 4) * 0.06})` }}/>
      ))}
    </div>
  );
};

const BNoise = ({ level }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 11 }}>
    {[0, 1, 2].map(i => (
      <span key={i} style={{ width: 3, height: 4 + i * 3.5, borderRadius: 1, background: i < level ? M_TEAL : 'rgba(255,255,255,0.14)' }}/>
    ))}
  </div>
);

const BRoomBand = ({ r, mine, tall, toast }) => (
  <div style={{
    position: 'relative', flexShrink: 0, borderRadius: 13, overflow: 'hidden', cursor: 'pointer',
    border: `1px solid ${mine.length ? `${M_TEAL}44` : M_BORDER}`,
    background: r.id === 'back' ? 'linear-gradient(180deg, #1b1518 0%, #141011 100%)' : 'linear-gradient(180deg, #16211F 0%, #101817 100%)',
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 12px', minHeight: tall ? 118 : 96 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT }}>{r.name}</span>
          <F3Stake s={r.stake}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED }}>{r.agents.toLocaleString()} in · {r.tables} tables</span>
          <BNoise level={r.noise}/>
        </div>
        <BCrowd n={r.agents} w={tall ? 168 : 150}/>
      </div>
      {/* your agents, at the scale of characters rather than rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        {mine.length === 0
          ? <span style={{ fontSize: 10, color: M_FAINT, fontStyle: 'italic' }}>none of yours</span>
          : mine.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: M_TEXT }}>{a.name.split(' ')[0]}</div>
                <Num size={9.5} weight={700} color={a.pnl[0] === '+' ? M_TEAL : M_RED}>{a.pnl}</Num>
              </div>
              <F3Body a={a} size={34} pose="hold"/>
            </div>
          ))}
      </div>
    </div>
    {toast && <div style={{ position: 'absolute', right: 11, bottom: 9, zIndex: 8 }}><F3Toast amt={toast} up big/></div>}
  </div>
);

const BBoard = () => (
  <div style={{ flexShrink: 0, margin: '0 14px', padding: '9px 11px', borderRadius: 11, background: 'rgba(205,179,128,0.07)', border: `1px solid ${M_GOLD}33` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', color: M_GOLD }}>BY THE STAIRS</span>
    </div>
    {F3_TICKER.slice(0, 2).map(t => (
      <div key={t.k} style={{ display: 'flex', gap: 7, padding: '3px 0' }}>
        <F3Stake s={t.at}/>
        <span style={{ fontSize: 10.5, color: M_DIM, lineHeight: 1.4, flex: 1 }}>{t.line}</span>
      </div>
    ))}
  </div>
);

const B_HomeM = () => (
  <PhoneShell>
    <F3Head title="The house" sub="1,604 playing · you have 3 in" right={<F3Pill color={M_TEAL} bd={`${M_TEAL}55`}><Num size={10} weight={700} color={M_TEAL}>+$1,290</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10, padding: '11px 14px 12px', background: M_BG }}>
      {F3_ROOMS.map(r => (
        <BRoomBand key={r.id} r={r} mine={F3_MINE.filter(a => r.mine.includes(a.id))} toast={r.id === 'up' ? '2,400' : null}/>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 12, border: `1px dashed ${M_BORDER_2}`, background: 'rgba(255,255,255,0.02)' }}>
        <F3Body a={F3_MINE[3]} size={28} pose="rest" dealt={false}/>
        <div style={{ flex: 1, fontSize: 11, color: M_MUTED }}>Value Bot is in the bar, not in any room</div>
      </div>
    </div>
    <BBoard/>
    <div style={{ height: 10, flexShrink: 0, background: M_BG }}/>
    <TabBar active="casino"/>
  </PhoneShell>
);

const B_SoloM = () => (
  <PhoneShell>
    <F3Head title="The house" sub="your first agent is downstairs"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10, padding: '11px 14px', background: M_BG }}>
      <BRoomBand r={F3_ROOMS[0]} mine={[F3_MINE[0]]} tall/>
      {/* the rooms he cannot afford yet are shut, and say so in one line */}
      {F3_ROOMS.slice(1).map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', borderRadius: 13, border: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.015)', opacity: 0.62 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontFamily: PLAYFAIR, fontSize: 14, fontWeight: 600, color: M_MUTED }}>{r.name}</span>
              <F3Stake s={r.stake}/>
            </div>
            <div style={{ fontSize: 10.5, color: M_DIM, marginTop: 2 }}>his pocket needs ${r.id === 'up' ? '2,500' : '5,000'} to sit here</div>
          </div>
          <BNoise level={r.noise}/>
        </div>
      ))}
    </div>
    <BBoard/>
    <div style={{ height: 10, flexShrink: 0, background: M_BG }}/>
    <TabBar active="casino"/>
  </PhoneShell>
);

const B_RoomM = () => (
  <PhoneShell>
    <F3Head title="Upstairs" sub="25/50 · 380 in · 63 tables" right={<F3Pill color={M_MUTED}>The house</F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
      {/* yours first and at full size; the room behind it as tables, not as agents */}
      <div style={{ borderRadius: 13, overflow: 'hidden', border: `1px solid ${M_PURPLE}66`, background: 'radial-gradient(ellipse at 50% 38%, #2f4d48 0%, #1d2e2c 62%, #131f1e 100%)', position: 'relative', height: 186 }}>
        <div style={{ position: 'absolute', left: 10, top: 10 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_PURPLE, border: `1px solid ${M_PURPLE}77`, background: `${M_PURPLE}1A`, borderRadius: 3, padding: '2px 6px' }}>YOURS · TABLE 12</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 34, display: 'flex', justifyContent: 'center', gap: 24 }}>
          {[0, 1, 2].map(i => <F3Body key={i} a={{ mood: 'neutral', accent: M_NEUTRAL }} size={28}/>)}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 92, display: 'flex', justifyContent: 'center' }}>
          <F3Pill><Lbl size={8}>Pot</Lbl><Num size={10.5} weight={700}>$1,850</Num></F3Pill>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 8, display: 'flex', justifyContent: 'center' }}>
          <F3Body a={F3_MINE[1]} size={48} pose="push"/>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 }}>
        <Lbl size={8.5}>The rest of the room</Lbl>
        <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      </div>
      {/* 62 other tables as a strip of pots — never 62 felts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
        {['$9,400', '$3,200', '$2,850', '$1,940', '$1,700', '$1,220', '$980', '$640'].map((p, i) => (
          <div key={p} style={{ padding: '7px 6px', borderRadius: 9, textAlign: 'center', background: i === 0 ? `${M_GOLD}14` : 'rgba(255,255,255,0.035)', border: `1px solid ${i === 0 ? `${M_GOLD}55` : M_BORDER}` }}>
            <Num size={10} weight={700} color={i === 0 ? M_GOLD : M_DIM}>{p}</Num>
            <div style={{ fontFamily: MONO, fontSize: 7.5, color: M_FAINT, marginTop: 1 }}>T{14 + i * 3}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 10.5, color: M_MUTED, lineHeight: 1.5 }}>Sorted by pot. <b style={{ color: M_DIM }}>Tap one to spectate</b> — 55 more below, and none of them is a felt until you ask for it.</div>
    </div>
    <TabBar active="casino"/>
  </PhoneShell>
);

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION C — THE BAR
// Home is where they are when they are NOT playing. You see who is rested, who
// is worn, who is broke, who was just born — and you send them off from here.
// The felts are a second screen. The ticker is the TV above the bar.
// ═══════════════════════════════════════════════════════════════════════════

const C_STOOLS = [
  { ...F3_MINE[0], state: 'playing', line: '42 hands in, up $340', away: true },
  { ...F3_MINE[3], state: 'rested',  line: 'rested · wants to play' },
  { ...F3_MINE[2], state: 'worn',    line: '88 hands · worn, Focus dipping' },
  { ...F3_MINE[1], state: 'broke',   line: 'pocket empty · $0' },
];

const C_STATE = {
  playing: { lbl: 'AT A FELT', color: M_TEAL },
  rested:  { lbl: 'RESTED',    color: M_TEAL },
  worn:    { lbl: 'WORN',      color: M_GOLD },
  broke:   { lbl: 'BROKE',     color: M_RED },
  newborn: { lbl: 'NEW',       color: M_PINK },
};

const CTv = ({ big }) => (
  <div style={{ flexShrink: 0, margin: '0 14px', borderRadius: 10, overflow: 'hidden', border: `1px solid ${M_BORDER_2}`, background: '#0A0F0E' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderBottom: `1px solid ${M_BORDER}` }}>
      <LiveDot/><span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>ABOVE THE BAR · 1,604 PLAYING</span>
    </div>
    <div style={{ padding: '8px 10px' }}>
      {(big ? F3_TICKER.slice(0, 3) : F3_TICKER.slice(0, 2)).map(t => (
        <div key={t.k} style={{ display: 'flex', gap: 7, padding: '2.5px 0', alignItems: 'baseline' }}>
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.13em', color: t.mine ? M_GOLD : t.hot ? M_RED : M_FAINT, width: 62, flexShrink: 0 }}>{t.lbl}</span>
          <span style={{ fontSize: 10, color: M_DIM, lineHeight: 1.4, flex: 1 }}>{t.line}</span>
        </div>
      ))}
    </div>
  </div>
);

// a stool: him, his state, one line, and the one thing to do about it
const CStool = ({ s, toast }) => {
  const st = C_STATE[s.state];
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 13, background: s.away ? 'rgba(0,212,170,0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${s.away ? `${M_TEAL}3D` : M_BORDER}` }}>
      <div style={{ position: 'relative', opacity: s.state === 'broke' ? 0.66 : 1 }}>
        <F3Body a={s} size={42} pose={s.state === 'worn' ? 'drum' : 'rest'} dealt={false}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: M_TEXT, fontWeight: 500 }}>{s.name}</span>
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.13em', color: st.color, border: `1px solid ${st.color}55`, borderRadius: 3, padding: '1px 4px' }}>{st.lbl}</span>
        </div>
        <div style={{ fontSize: 10.5, color: M_MUTED, marginTop: 2 }}>{s.line}</div>
      </div>
      {s.state === 'playing' ? <F3Pill color={M_TEAL} bd={`${M_TEAL}55`}>Watch</F3Pill>
        : s.state === 'broke' ? <F3Pill color={M_RED} bd={`${M_RED}55`}>Fund</F3Pill>
        : s.state === 'worn' ? <F3Pill color={M_MUTED}>Let him rest</F3Pill>
        : <Btn h={26}>Send him</Btn>}
      {toast && <div style={{ position: 'absolute', right: 10, top: -12, zIndex: 8 }}><F3Toast amt={toast} up big/></div>}
    </div>
  );
};

const C_HomeM = () => (
  <PhoneShell>
    <F3Head title="The bar" sub="1 at a felt · 3 here" right={<F3Pill color={M_TEAL} bd={`${M_TEAL}55`}><Num size={10} weight={700} color={M_TEAL}>+$1,290</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 9, padding: '11px 14px', background: M_BG }}>
      {C_STOOLS.map((s, i) => <CStool key={s.id} s={s} toast={i === 0 ? '2,400' : null}/>)}
      {/* the bar itself, drawn once at the foot so the room has a floor */}
      <div style={{ marginTop: 'auto', height: 10, borderRadius: '6px 6px 0 0', background: 'linear-gradient(180deg, #2A211B 0%, #1A1512 100%)', border: `1px solid ${M_BORDER}`, borderBottom: 'none' }}/>
    </div>
    <CTv/>
    <div style={{ height: 10, flexShrink: 0, background: M_BG }}/>
    <TabBar active="casino"/>
  </PhoneShell>
);

const C_SoloM = () => (
  <PhoneShell>
    <F3Head title="The bar" sub="one stool taken"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '13px 14px', background: M_BG }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, padding: '20px 0 18px' }}>
        <F3Body a={{ ...F3_MINE[0], mood: 'confident' }} size={92} pose="rest" dealt={false}/>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: PLAYFAIR, fontSize: 19, fontWeight: 600, color: M_TEXT }}>Balanced v2.1</div>
          <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 3 }}>born four minutes ago · rested · never played</div>
        </div>
        <div style={{ maxWidth: 250, textAlign: 'center', fontSize: 12, color: M_DIM, lineHeight: 1.55 }}>He is a <b style={{ color: M_TEXT }}>Rock</b>. He will hate folding and he will do it anyway.</div>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <Btn full>Send him to 10/20</Btn>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: M_MUTED }}>Three other stools, empty. You get a second agent at 500 hands.</div>
        <div style={{ height: 10, borderRadius: '6px 6px 0 0', background: 'linear-gradient(180deg, #2A211B 0%, #1A1512 100%)', border: `1px solid ${M_BORDER}`, borderBottom: 'none' }}/>
      </div>
    </div>
    <CTv/>
    <div style={{ height: 10, flexShrink: 0, background: M_BG }}/>
    <TabBar active="casino"/>
  </PhoneShell>
);

const C_SendoffM = () => (
  <PhoneShell>
    <F3Head title="The bar" sub="1 at a felt · 3 here"/>
    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '11px 14px', filter: 'brightness(0.42)' }}>
        {C_STOOLS.slice(0, 3).map(s => <CStool key={s.id} s={s}/>)}
      </div>
      {/* the send-off: a sheet from the bottom, three stakes, his pocket the limit */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 18, borderTopRightRadius: 18, background: F3_GLASS.raised, backdropFilter: F3_GLASS.blur, WebkitBackdropFilter: F3_GLASS.blur, borderTop: `1px solid ${F3_GLASS.edgeUp}`, padding: '13px 14px 16px', animation: 'sheetup 0.24s ease-out both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <F3Body a={F3_MINE[3]} size={40} pose="rest" dealt={false}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT }}>Send Value Bot</div>
            <div style={{ fontSize: 10.5, color: M_MUTED, marginTop: 1 }}>pocket $1,240 · rested</div>
          </div>
        </div>
        {[['10/20', 'the floor', true], ['25/50', 'upstairs · needs $2,500', false], ['50/100', 'the back room · needs $5,000', false]].map(([s, note, ok]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 11px', borderRadius: 11, marginBottom: 7, background: ok ? `${M_TEAL}12` : 'rgba(255,255,255,0.025)', border: `1px solid ${ok ? `${M_TEAL}55` : M_BORDER}`, opacity: ok ? 1 : 0.5 }}>
            <F3Stake s={s}/>
            <span style={{ flex: 1, fontSize: 11, color: ok ? M_DIM : M_MUTED }}>{note}</span>
            {ok && <span style={{ width: 15, height: 15, borderRadius: '50%', border: `4px solid ${M_TEAL}`, boxSizing: 'border-box' }}/>}
          </div>
        ))}
        <div style={{ marginTop: 5 }}><Btn full>Send him out</Btn></div>
        <div style={{ textAlign: 'center', fontSize: 10, color: M_MUTED, marginTop: 8 }}>He walks out of the bar and sits down. You do not have to watch.</div>
      </div>
    </div>
  </PhoneShell>
);

Object.assign(window, {
  F3_MINE, F3_TICKER, F3_ROOMS, F3_GLASS, F3Head, F3Toast, F3Body, F3Pill, F3Stake,
  ABox, ATicker, A_HomeM, A_SoloM, A_SpectateM,
  BCrowd, BNoise, BRoomBand, BBoard, B_HomeM, B_SoloM, B_RoomM,
  C_STOOLS, C_STATE, CTv, CStool, C_HomeM, C_SoloM, C_SendoffM,
});

// ═══════════════════════════════════════════════════════════════════════════
// CASINO — the building. Board 27 is no longer the three-direction exploration;
// direction B won it. Rooms by stakes, seen through their doorways in
// perspective, the crowd as tiny ghosts, and this is the ONE place you deploy.
// ═══════════════════════════════════════════════════════════════════════════

// a crowd member: the ghost silhouette with no face and no hands. At 9-16px a
// MoodGhost is an expensive blob, and forty of them is a frame budget — this is the
// same shape, three drawing ops, and it is all a crowd needs to be.
const CrowdGhost = ({ size = 12, o = 0.5, delay = 0 }) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 20 23" style={{ opacity: o, animation: `bob ${5 + (delay % 4)}s ease-in-out ${delay * 0.3}s infinite` }}>
    <path d="M10 1.5 C14.4 1.5 17.5 4.6 17.5 9 L17.5 17.5 C17.5 19.6 15.6 19.2 14.4 20.4 C13.4 21.4 11.6 21.4 10 20.4 C8.4 21.4 6.6 21.4 5.6 20.4 C4.4 19.2 2.5 19.6 2.5 17.5 L2.5 9 C2.5 4.6 5.6 1.5 10 1.5 Z" fill="#1C2A2C"/>
    <path d="M10 1.5 C14.4 1.5 17.5 4.6 17.5 9 L17.5 12 L2.5 12 L2.5 9 C2.5 4.6 5.6 1.5 10 1.5 Z" fill="#223334"/>
  </svg>
);

// the crowd inside a room: placed on a perspective floor, smaller toward the back,
// count derived from the room's population and capped. 1,180 agents is a texture.
const CrowdField = ({ n, w, h }) => {
  const cap = Math.min(34, Math.max(3, Math.round(n / 34)));
  const rows = 4;
  return (
    <>
      {Array.from({ length: cap }).map((_, i) => {
        const row = i % rows;                       // 0 = far
        const depth = row / (rows - 1);             // 0..1 toward the viewer
        const per = Math.ceil(cap / rows);
        const col = Math.floor(i / rows);
        const inset = 0.30 - depth * 0.26;          // the trapezoid narrows at the back
        const spanL = w * inset, spanW = w * (1 - inset * 2);
        return (
          <div key={i} style={{ position: 'absolute', left: spanL + ((col + 0.5) / per) * spanW, bottom: 8 + (1 - depth) * (h * 0.46), transform: 'translateX(-50%)' }}>
            <CrowdGhost size={9 + depth * 8} o={0.34 + depth * 0.4} delay={i}/>
          </div>
        );
      })}
    </>
  );
};

// a room, seen through its doorway. The doorway is the frame; the room recedes.
const CasinoDoor = ({ r, mine, hot, shut, need, h = 150 }) => (
  <div style={{ position: 'relative', flexShrink: 0, height: h, borderRadius: 12, overflow: 'hidden', cursor: shut ? 'default' : 'pointer', border: `1px solid ${hot ? `${M_GOLD}77` : mine && mine.length ? `${M_TEAL}44` : M_BORDER}`, boxShadow: hot ? `0 0 20px ${M_GOLD}2E` : 'none', background: '#0B100F' }}>
    {/* the room behind the door: a perspective floor and a far wall */}
    <div style={{ position: 'absolute', inset: 0, background: r.id === 'back' ? 'linear-gradient(180deg, #140F11 0%, #1C1418 62%, #241A1E 100%)' : 'linear-gradient(180deg, #0D1413 0%, #16211F 58%, #1E2C29 100%)' }}/>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.52, background: 'linear-gradient(180deg, rgba(47,77,72,0.34) 0%, rgba(47,77,72,0.06) 100%)', clipPath: 'polygon(-8% 100%, 108% 100%, 70% 0, 30% 0)' }}/>
    {/* felts as ellipses on that floor, receding — never a table you can count seats on */}
    {[[0.5, 0.30, 46], [0.24, 0.13, 62], [0.78, 0.13, 62]].map(([lx, by, fw], i) => (
      <div key={i} style={{ position: 'absolute', left: `${lx * 100}%`, bottom: by * h, width: fw, height: fw * 0.34, marginLeft: -fw / 2, borderRadius: '50%', background: hot && i === 0 ? `radial-gradient(ellipse, ${M_GOLD}3D, ${M_GOLD}12)` : 'radial-gradient(ellipse, rgba(47,77,72,0.72), rgba(29,46,44,0.42))', border: `1px solid ${hot && i === 0 ? `${M_GOLD}66` : 'rgba(255,255,255,0.06)'}`, animation: hot && i === 0 ? 'shimmer 2s ease-in-out infinite' : 'none' }}/>
    ))}
    {!shut && <CrowdField n={r.agents} w={358} h={h}/>}
    {/* the stake sign over the door */}
    <div style={{ position: 'absolute', left: 11, top: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: shut ? M_MUTED : M_TEXT }}>{r.name}</span>
      <F3Stake s={r.stake}/>
      {hot && <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD, border: `1px solid ${M_GOLD}77`, background: `${M_GOLD}1A`, borderRadius: 3, padding: '1px 5px' }}>HOT</span>}
    </div>
    <div style={{ position: 'absolute', right: 11, top: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED }}>{r.agents.toLocaleString()} in</span>
      <BNoise level={r.noise}/>
    </div>
    {/* yours, standing in the doorway at character scale so he is findable */}
    {mine && mine.map((a, i) => (
      <div key={a.id} style={{ position: 'absolute', right: 14 + i * 62, bottom: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <F3Body a={a} size={36} pose="hold"/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 16, padding: '0 6px', borderRadius: 8, background: 'rgba(10,14,14,0.9)', border: `1px solid ${M_TEAL}44` }}>
          <span style={{ fontSize: 8.5, color: M_DIM }}>{a.name.split(' ')[0]}</span>
          <Num size={8.5} weight={700} color={a.pnl[0] === '+' ? M_TEAL : M_RED}>{a.pnl}</Num>
        </div>
      </div>
    ))}
    {shut && (
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,9,9,0.66)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: M_DIM }}>his pocket needs <b style={{ color: M_TEXT }}>${need}</b> to sit here</span>
      </div>
    )}
  </div>
);

// the board by the stairs — a physical thing on a wall, not a feed
const CasinoBoard = ({ full }) => (
  <div style={{ flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(180deg, #171310 0%, #100D0B 100%)', border: `1px solid ${M_GOLD}2E` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 11px', borderBottom: `1px solid ${M_GOLD}22` }}>
      <LiveDot color={M_GOLD}/>
      <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', color: M_GOLD }}>BY THE STAIRS</span>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: M_MUTED }}>1,604 playing</span>
    </div>
    <div style={{ padding: '6px 11px 9px' }}>
      {(full ? F3_TICKER : F3_TICKER.slice(0, 2)).map(t => (
        <div key={t.k} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '4px 0', borderTop: t.k === F3_TICKER[0].k ? 'none' : '1px solid rgba(255,255,255,0.045)' }}>
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.13em', color: t.mine ? M_GOLD : t.hot ? M_RED : M_MUTED, width: 64, flexShrink: 0 }}>{t.lbl}</span>
          <span style={{ fontSize: 10.5, color: M_DIM, lineHeight: 1.4, flex: 1 }}>{t.line}</span>
          <F3Stake s={t.at}/>
        </div>
      ))}
    </div>
  </div>
);

// the deploy tray: he came with you from Home, and the rooms he can afford are the
// rooms that are open. No stake picker — the pocket already is the wager.
const DeployTray = ({ a, room = '10/20' }) => (
  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderTop: `1px solid ${M_TEAL}3D`, background: 'rgba(0,212,170,0.06)' }}>
    <F3Body a={a} size={38} pose="rest" dealt={false}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: M_TEXT, fontWeight: 500 }}>{a.name}</div>
      <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>pocket $1,240 · buy-in at {room} is $1,000</div>
    </div>
    <Btn h={32}>Deal him in</Btn>
  </div>
);

const CasinoHead = ({ sub, right }) => (
  <div style={{ flexShrink: 0, height: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
    <SpadeLogo/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, lineHeight: 1.1 }}>The casino</div>
      <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>{sub}</div>
    </div>
    {right}
  </div>
);

// ═══ CASINO SCREENS ════════════════════════════════════════════════════════

// K1 · you arrived from Home with an agent to place
const CasinoDeployM = () => (
  <PhoneShell>
    <CasinoHead sub="placing Value Bot"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 9, padding: '11px 14px', background: M_BG }}>
      <CasinoDoor r={F3_ROOMS[0]} mine={[F3_MINE[0], F3_MINE[2]]} h={152}/>
      <CasinoDoor r={F3_ROOMS[1]} mine={[F3_MINE[1]]} h={134}/>
      <CasinoDoor r={F3_ROOMS[2]} shut need="5,000" h={104}/>
    </div>
    <DeployTray a={F3_MINE[3]}/>
    <Nav3 active="casino"/>
  </PhoneShell>
);

// K2 · the board, read properly
const CasinoBoardM = () => (
  <PhoneShell>
    <CasinoHead sub="1,604 playing · 3 of yours in" right={<F3Pill color={M_TEAL} bd={`${M_TEAL}55`}><Num size={10} weight={700} color={M_TEAL}>+$1,290</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10, padding: '11px 14px', background: M_BG }}>
      <CasinoBoard full/>
      {/* the stairs: the one piece of furniture that says the building has floors */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, padding: '0 2px' }}>
        {[10, 16, 22, 28, 34, 40].map((hh, i) => (
          <div key={hh} style={{ flex: 1, height: hh, borderRadius: '3px 3px 0 0', background: `linear-gradient(180deg, rgba(205,179,128,${0.05 + i * 0.02}) 0%, rgba(255,255,255,0.02) 100%)`, borderTop: '1px solid rgba(255,255,255,0.07)' }}/>
        ))}
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED, marginLeft: 8, marginBottom: 3 }}>UPSTAIRS →</span>
      </div>
      <CasinoDoor r={F3_ROOMS[0]} mine={[F3_MINE[0], F3_MINE[2]]} h={140}/>
      <CasinoDoor r={F3_ROOMS[1]} mine={[F3_MINE[1]]} h={124}/>
    </div>
    <Nav3 active="casino"/>
  </PhoneShell>
);

// K3 · a felt goes hot upstairs
const CasinoHotM = () => (
  <PhoneShell>
    <CasinoHead sub="Aggressive v1.3 is all-in upstairs" right={<F3Pill color={M_GOLD} bd={`${M_GOLD}55`}><Num size={9.5} weight={700} color={M_GOLD}>HOT</Num></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 9, padding: '11px 14px', background: M_BG }}>
      <CasinoDoor r={F3_ROOMS[1]} mine={[F3_MINE[1]]} hot h={176}/>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: `${M_GOLD}12`, border: `1px solid ${M_GOLD}55` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11.5, color: M_GOLD }}>$4,180 in the middle, table 12</div>
          <div style={{ fontSize: 10, color: M_MUTED, marginTop: 2 }}>he is all-in and the runout is held for you</div>
        </div>
        <Btn h={30}>Watch him</Btn>
      </div>
      <CasinoDoor r={F3_ROOMS[0]} mine={[F3_MINE[0], F3_MINE[2]]} h={128}/>
      <CasinoBoard/>
    </div>
    <Nav3 active="casino"/>
  </PhoneShell>
);

Object.assign(window, {
  CrowdGhost, CrowdField, CasinoDoor, CasinoBoard, DeployTray, CasinoHead,
  CasinoDeployM, CasinoBoardM, CasinoHotM,
});
