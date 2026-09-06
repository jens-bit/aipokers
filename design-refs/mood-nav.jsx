// ═════════════════════════════════════════════════════════════════
// WAVE 53 · NAVIGATION, IDENTITY, THE TICKER
// The playtest killed the bottom bar: HOME · CASINO · YOU sat directly under the
// home thread's composer, so the screen ended in two stacked bars and the composer
// — the one thing you actually type into — was the smaller of them.
//
// The decision: THERE IS NO BOTTOM BAR. The three destinations become things in
// the world instead of tabs over it.
//   YOU     · the avatar top-right. It opens the roster sheet; money sits behind it.
//   CASINO  · the door. You tap the door and he walks there. The wall TV is the
//             preview, so you can see the casino from the sofa without leaving.
//   HOME    · is not a destination. It is where you already are.
// The composer is the only thing at the bottom of the screen, ever.
// ═════════════════════════════════════════════════════════════════

// ── the roster sheet, behind the avatar ──────────────────────────────────
// One row per agent: who he is, WHERE he is, what he is carrying, whether he has
// said something. The money is one line at the bottom, not a section.
const NAV_ROSTER = [
  { a: H_CAST.agg, where: 'home',    at: 'at the table',        pocket: '$1,240', unread: 2, stamina: 62, heat: 78 },
  { a: H_CAST.bal, where: 'casino',  at: '10/20 · up $340', pocket: '$2,180', stamina: 74, heat: 22 },
  { a: H_CAST.val, where: 'bar',     at: 'at the bar · resting', pocket: '$860', stamina: 34, heat: 12 },
  { a: H_CAST.blf, where: 'broke',   at: 'pocket empty',        pocket: '$0', stamina: 20, heat: 16 },
];

const WHERE = {
  home:   { c: '#7FA8C9', t: 'HOME' },
  casino: { c: M_TEAL,    t: 'CASINO' },
  bar:    { c: M_GOLD,    t: 'THE BAR' },
  broke:  { c: M_RED,     t: 'BROKE' },
};

const RosterRow = ({ r }) => {
  const id = idFor(r.a.id || r.a.name);
  const w = WHERE[r.where];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <MoodGhost mood={r.a.mood} size={34} ring={false} hood={id.hood} glow={id.glow.c}/>
        {r.unread ? <span style={{ position: 'absolute', top: -1, right: -3, width: 8, height: 8, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 6px ${M_GOLD}` }}></span> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 12, color: M_TEXT, fontWeight: 600 }}>{r.a.name.split(' ')[0]}</span>
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.13em', color: w.c }}>{w.t}</span>
        </div>
        <div style={{ fontSize: 10, color: M_MUTED, marginTop: 1.5 }}>{r.at}</div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <Num size={11} weight={700} color={r.pocket === '$0' ? M_RED : M_TEXT}>{r.pocket}</Num>
        <ResourceBars stamina={r.stamina} heat={r.heat} w={40} h={2} gap={2}/>
      </div>
    </div>
  );
};

const RosterSheet = ({ rows = NAV_ROSTER }) => (
  <div style={{ width: F_W, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderRadius: '16px 16px 0 0', fontFamily: INTER, paddingBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 9px' }}>
      <span style={{ width: 30, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '0 14px 9px' }}>
      <span style={{ fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT }}>Your four</span>
      <span style={{ fontSize: 10, color: M_MUTED }}>where they are right now</span>
    </div>
    {rows.map(r => <RosterRow key={r.a.name} r={r}/>)}
    {/* the money is a line, not a section: the wallet screen lives behind it */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px 0', marginTop: 3, borderTop: `1px solid ${M_BORDER_2}` }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.15em', color: M_MUTED }}>YOUR WALLET</div>
        <div style={{ marginTop: 2 }}><Amt size={20} color={M_GOLD}>$4,280</Amt></div>
      </div>
      <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, border: `1px solid ${M_BORDER_2}`, borderRadius: 10, padding: '7px 12px', cursor: 'pointer' }}>LEDGER</span>
    </div>
  </div>
);

// ── the ticker, ranked ───────────────────────────────────────────────────
// Round 1 read as noise because every line had the same weight: "heater, heater,
// biggest pot". Money ranks it. The biggest pot on the floor is the headline in
// large type, and the two lines under it are smaller. Every line answers who, how
// much, and which room — and every line is a place you can go.
const NAV_LIVE = [
  { amt: '$8,400', who: 'Ozymandias, Granite +2', room: '50/100', hot: true },
  { amt: '$3,100', who: 'Nightjar, doyle_v3',     room: '25/50' },
  { amt: '$940',   who: 'your Balanced v2.1 +3',  room: '10/20', mine: true },
];

const NAV_TONIGHT = [
  { amt: '$14,200', who: 'Ozymandias',  what: 'cracked aces',          room: '50/100', kind: 'BIGGEST POT' },
  { amt: '$9,400',  who: 'Nightjar',    what: '6 in a row',            room: '25/50',  kind: 'HEATER', streak: true },
  { amt: '$6,100',  who: 'Granite',     what: 'quads into a flush',    room: '25/50',  kind: 'COOLER' },
  { amt: '$0',      who: 'Fold_Equity', what: 'out, third time today', room: '10/20',  kind: 'BUST' },
];

// LIVE NOW · pots still building. The amount is "so far", so it is the one number
// that will be wrong in a minute — which is exactly why the row is tappable.
const LiveNow = ({ items = NAV_LIVE }) => (
  <div style={{ background: '#0C1211', border: `1px solid ${M_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px 7px' }}>
      <LiveDot color={M_RED} size={5}/>
      <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_RED }}>LIVE NOW</span>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: M_MUTED }}>pot so far</span>
    </div>
    {items.map(t => (
      <div key={t.who} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '6px 12px 7px', borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
        background: t.hot ? `linear-gradient(90deg, ${M_RED}1C 0%, transparent 72%)` : t.mine ? `linear-gradient(90deg, ${M_TEAL}14 0%, transparent 72%)` : 'transparent',
        boxShadow: t.hot ? `inset 2px 0 0 ${M_RED}` : t.mine ? `inset 2px 0 0 ${M_TEAL}` : 'none' }}>
        <Num size={12} weight={700} color={t.hot ? M_RED : t.mine ? M_TEAL : M_TEXT}>{t.amt}</Num>
        <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: M_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.who}</span>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, flexShrink: 0 }}>{t.room}</span>
        <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.11em', color: t.hot ? M_RED : M_TEAL, flexShrink: 0 }}>{t.hot ? 'HOT · WATCH' : 'WATCH'}</span>
      </div>
    ))}
  </div>
);

// TONIGHT · finished hands, ranked by money. The verb is REPLAY, never WATCH: the
// hand is over, and offering to watch it would be a lie about what the tap does.
const Tonight = ({ items = NAV_TONIGHT, rows = 3 }) => {
  const [head, ...rest] = items;
  return (
    <div style={{ background: '#0C1211', border: `1px solid ${M_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px 0' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>TONIGHT</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: M_MUTED }}>done · tap to replay</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, padding: '3px 12px 9px', cursor: 'pointer' }}>
        <Amt size={28} color={M_GOLD}>{head.amt}</Amt>
        <div style={{ paddingBottom: 3, minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11.5, color: M_TEXT, lineHeight: 1.25 }}>{head.who}</div>
          <div style={{ fontSize: 10, color: M_MUTED, lineHeight: 1.3 }}>{head.what} · {head.room}</div>
        </div>
        <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.12em', color: M_GOLD, paddingBottom: 5 }}>{head.kind}</span>
      </div>
      {rest.slice(0, rows).map(t => (
        <div key={t.who} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
          <Num size={11} weight={700} color={t.streak ? M_GOLD : M_DIM}>{t.amt}</Num>
          <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: M_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.who} · {t.what}</span>
          <span style={{ fontFamily: OSWALD, fontSize: 7, fontWeight: 600, letterSpacing: '0.11em', color: M_MUTED, flexShrink: 0 }}>{t.kind}</span>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, flexShrink: 0 }}>{t.room}</span>
        </div>
      ))}
    </div>
  );
};

// 5 · YOUR TABLE is his ACTUAL game, in miniature: the seats around the ring, whose
// turn it is, the pot, his own pill. A lone ghost with three cards floating beside
// him was a picture OF poker rather than a view of his hand, and it is the one block
// on this screen the owner opens the screen to see.
const MINI_RING = [
  { x: 0.20, y: 0.16 }, { x: 0.50, y: 0.10 }, { x: 0.80, y: 0.16 },
  { x: 0.12, y: 0.50 }, { x: 0.88, y: 0.50 },
];

const YourTable = ({ playing = true, where = 'at the bar · rested, 88 stamina', name = 'Balanced v2.1', turn = 2 }) => (
  <div style={{ flex: 1, minHeight: 0, borderRadius: 10, border: `1px solid ${playing ? `${M_GOLD}3D` : M_BORDER}`, background: playing ? 'radial-gradient(ellipse at 50% 42%, #24312C 0%, #16201E 72%)' : '#0E1413', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
    <div style={{ position: 'absolute', left: 12, top: 11, display: 'flex', alignItems: 'center', gap: 6, zIndex: 4 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.15em', color: playing ? M_GOLD : M_MUTED }}>YOUR TABLE{playing ? ' · 10/20' : ''}</span>
      {playing && <LiveDot size={5}/>}
    </div>
    {playing ? (
      <>
        {/* the ring: five opponents, and the one to act carries the only ring */}
        {MINI_RING.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: 'translate(-50%,0)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <MoodGhost mood={i === turn ? 'confident' : 'neutral'} size={i === turn ? 26 : 22} ring={false}
              hood={HOODS[(i + 2) % 6]} glow={GLOWS[(i + 1) % 6].c}/>
            <div style={{ display: 'flex', gap: 1 }}>{[0, 1].map(k => <CardBack key={k} w={6} h={8}/>)}</div>
            {i === turn && <span style={{ fontFamily: OSWALD, fontSize: 6, fontWeight: 600, letterSpacing: '0.1em', color: M_GOLD }}>TO ACT</span>}
          </div>
        ))}
        {/* the pot, mid-felt */}
        <div style={{ position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 11, background: 'rgba(10,14,14,0.66)', border: `1px solid ${M_BORDER}` }}>
          <Lbl size={7}>Pot</Lbl><Num size={11} weight={700} color={M_GOLD}>$940</Num>
        </div>
        {/* the board */}
        <div style={{ position: 'absolute', left: '50%', top: '61%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 2 }}>
          {[['9', 'h'], ['J', 's'], ['4', 'c']].map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={13} h={18}/>)}
        </div>
        {/* him, at the bottom, with his cards in his hands and his pill above */}
        <div style={{ position: 'absolute', left: '50%', bottom: 10, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 8, color: M_TEXT, background: 'rgba(8,12,12,0.9)', border: `1px solid ${M_TEAL}55`, borderRadius: 7, padding: '1.5px 7px', whiteSpace: 'nowrap' }}>{name.split(' ')[0]}</span>
          <div style={{ position: 'relative' }}>
            {(() => { const id = idFor(H_CAST.bal.id); return <MoodGhost mood="confident" size={46} ring={false} hood={id.hood} glow={id.glow.c} hands="hold"/>; })()}
            <div style={{ position: 'absolute', left: '50%', top: '60%', transform: 'translateX(-50%)', display: 'flex', gap: 1.5, zIndex: 4 }}>
              {[['A', 's'], ['K', 'h']].map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={13} h={18}/>)}
            </div>
          </div>
        </div>
      </>
    ) : (
      // he is not playing, so the block says where he is instead of pretending
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {(() => { const id = idFor(H_CAST.bal.id); return <MoodGhost mood="neutral" size={46} ring={false} hood={id.hood} glow={id.glow.c}/>; })()}
        <div style={{ fontSize: 11.5, color: M_DIM }}>{name.split(' ')[0]} is {where}</div>
        <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL, border: `1px solid ${M_TEAL}66`, borderRadius: 8, padding: '5px 12px' }}>SEND HIM TO PLAY</span>
      </div>
    )}
  </div>
);

// ═════════════════════════════════════════════════════════════════
// SCREENS
// ═════════════════════════════════════════════════════════════════

const navRoom = () => (
  <>
    <AwayWall frames={[{ a: H_CAST.bal, line: '10/20 · +$340 · 22 min' }]} hooks={2}/>
    <TableChairs taken={2}/>
    <HomeGame players={[{ a: { ...H_CAST.agg, mood: 'frustrated' }, stamina: 62, heat: 78 }, { a: H_CAST.blf, stamina: 70, heat: 24 }]}
      says={[{ i: 0, text: 'Deal it.' }]}/>
    <HomeOne a={{ ...H_CAST.val, mood: 'neutral' }} at={STAND.fridge} routine="fridge" size={44} stamina={34} heat={12}/>
    <DoorTap/>
  </>
);

// N1 · HOME with no bottom bar: the composer is the only bar
const NavHomeM = () => (
  <PhoneShell>
    <HomeHead sub="the room · 3 home, 1 away" you unread count={2}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat tape="casino">{navRoom()}</HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.agg, text: 'Deal it. I am not tired.' }}/>
  </PhoneShell>
);

// N2 · the roster sheet, opened from the avatar
const NavRosterM = () => (
  <PhoneShell>
    <HomeHead sub="the room · 3 home, 1 away" you unread count={2}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, position: 'relative' }}>
      <HomeFlat tape="casino">{navRoom()}</HomeFlat>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,9,9,0.6)' }}></div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><RosterSheet/></div>
    </div>
  </PhoneShell>
);

// N3 · the casino, reached through the door — still no bottom bar
const NavCasinoM = () => (
  <PhoneShell>
    <div style={{ flexShrink: 0, minHeight: 52, display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, cursor: 'pointer' }}>← HOME</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, lineHeight: 1.3, whiteSpace: 'nowrap' }}>The casino</div>
        <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>1,604 playing · 1 of yours</div>
      </div>
      <YouAvatar/>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <LiveNow/>
      <Tonight rows={2}/>
      {/* the rooms, as three doors you can walk through */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 6 }}>
        {[['THE FLOOR', '10/20', '412 in'], ['UPSTAIRS', '25/50', '186 in'], ['BACK ROOM', '50/100', '41 in']].map(([nm, st, inn]) => (
          <div key={nm} style={{ flex: 1, borderRadius: 9, border: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.03)', padding: '7px 8px 8px', cursor: 'pointer' }}>
            <div style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.11em', color: M_MUTED }}>{nm}</div>
            <div style={{ marginTop: 2 }}><Num size={11} weight={700} color={M_TEXT}>{st}</Num></div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: M_MUTED, marginTop: 1 }}>{inn}</div>
          </div>
        ))}
      </div>
      <YourTable/>
    </div>
    <HomeThread latest={{ a: H_CAST.bal, text: 'He folds to a third barrel. Watch.' }}/>
  </PhoneShell>
);

// N3b · the same screen when nobody of yours is in a hand. The block that would
// hold his table says where he is instead — a miniature of a game he is not in
// would be the one outright lie on the screen.
const NavCasinoIdleM = () => (
  <PhoneShell>
    <div style={{ flexShrink: 0, minHeight: 52, display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, cursor: 'pointer' }}>← HOME</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: M_TEXT, lineHeight: 1.3, whiteSpace: 'nowrap' }}>The casino</div>
        <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>1,604 playing · none of yours</div>
      </div>
      <YouAvatar/>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <LiveNow items={NAV_LIVE.slice(0, 2)}/>
      <Tonight rows={2}/>
      <YourTable playing={false}/>
    </div>
    <HomeThread latest={{ a: H_CAST.bal, text: 'Say the word and I will go again.' }}/>
  </PhoneShell>
);

// N4 · six hoods by six glows, at the size they are actually seen
const IdentitySheetM = () => (
  <PhoneShell>
    <HomeHead sub="identity · rolled at birth, never changes"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: M_BG, padding: '12px 10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '46px repeat(6, 1fr)', gap: 4, alignItems: 'center' }}>
        <span></span>
        {GLOWS.map(g => <span key={g.id} style={{ fontFamily: OSWALD, fontSize: 6.5, fontWeight: 600, letterSpacing: '0.08em', color: g.c, textAlign: 'center' }}>{g.name}</span>)}
        {HOODS.map(h => (
          <React.Fragment key={h.id}>
            <span style={{ fontFamily: OSWALD, fontSize: 7, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED }}>{h.name}</span>
            {GLOWS.map(g => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'center' }}>
                <MoodGhost mood="neutral" size={40} ring={false} hood={h} glow={g.c}/>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <div style={{ fontSize: 11, color: M_DIM, lineHeight: 1.5 }}>Thirty-six creatures, and mood moves none of them. Expression changes the face — eyes, brow, slump. <b style={{ color: M_TEXT }}>Colour is who he is</b>, and it is rolled at birth with his nature.</div>
      </div>
    </div>
  </PhoneShell>
);

// N5 · four of them in one room, telling themselves apart. The ROSTER claims the
// hoods — a uniform hash still put two of these four in the same one.
const FOUR = rollRoster(['agg', 'blf', 'val', 'bal']);
const wear = (a, mood) => ({ ...a, mood: mood || a.mood, hood: FOUR[a.id].hood, glow: FOUR[a.id].glow });

const FourApartM = () => (
  <PhoneShell>
    <HomeHead sub="four home · four creatures" you/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat tape="casino">
        <AwayWall hooks={3}/>
        <TableChairs taken={2}/>
        <HomeGame players={[{ a: wear(H_CAST.agg, 'frustrated'), stamina: 62, heat: 78 }, { a: wear(H_CAST.blf), stamina: 70, heat: 24 }]}/>
        <HomeOne a={wear(H_CAST.val, 'neutral')} at={STAND.fridge} routine="fridge" size={44} stamina={34} heat={12}/>
        <HomeOne a={wear(H_CAST.bal, 'sulking')} at={STAND.couch} routine="sleep" size={42} stamina={20} heat={14}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.blf, text: 'Your move.' }}/>
  </PhoneShell>
);

// N6 · the two bars wherever they appear
const BarsRefM = () => (
  <PhoneShell>
    <HomeHead sub="stamina drains, heat fills"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: M_BG, padding: 12, display: 'flex', flexDirection: 'column', gap: 11 }}>
      {[['IN THE PILL · 44PX', 44, 2, false], ['IN THE PROFILE · LABELLED', 150, 4, true], ['IN THE WATCH STRIP', 90, 3, true]].map(([lbl, w, h, labels]) => (
        <div key={lbl} style={{ padding: '10px 12px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.15em', color: M_MUTED, paddingBottom: 8 }}>{lbl}</div>
          <div style={{ display: 'flex', gap: 22 }}>
            {[[86, 12], [34, 78]].map(([s, ht]) => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <ResourceBars stamina={s} heat={ht} w={w} h={h} gap={5} labels={labels}/>
                <span style={{ fontSize: 9.5, color: M_FAINT }}>{s > 60 ? 'rested, cold' : 'worn, tilted'}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ padding: '10px 12px', borderRadius: 10, background: `${M_TEAL}0E`, border: `1px solid ${M_TEAL}33`, fontSize: 11, color: M_DIM, lineHeight: 1.5 }}>
        They run in <b style={{ color: M_TEXT }}>opposite directions on purpose</b>. Stamina is a reservoir: full at the right wall, draining left, green through amber to red. Heat is an accumulation: empty at the left wall, filling right, ember through fire. The empty end of both bars is the left end — <b style={{ color: M_TEXT }}>a short bar is never good news</b>.
      </div>
    </div>
  </PhoneShell>
);

// N7 · nobody yet: one chair, one door, one thing to press
const NavEmptyM = () => (
  <PhoneShell>
    <HomeHead sub="nobody home yet" you/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat tape="casino">
        <AwayWall hooks={0}/>
        <TableChairs taken={0}/>
        <DoorTap/>
        <div style={{ position: 'absolute', left: FLAT.table.cx, top: FLAT.table.cy + 74, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 240 }}>
          <span style={{ fontSize: 11.5, color: M_MUTED }}>One chair, nobody in it.</span>
          <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: M_GOLD, background: `${M_GOLD}16`, border: `1px solid ${M_GOLD}77`, borderRadius: 11, padding: '10px 18px', cursor: 'pointer' }}>DRAFT YOUR FIRST AGENT</span>
        </div>
      </HomeFlat>
    </div>
    <HomeThread latest={{ sys: true, text: 'The room is yours. It is empty.' }}/>
  </PhoneShell>
);

// N8 · after a retire: the room, one chair fewer
const NavRetiredM = () => (
  <PhoneShell>
    <HomeHead sub="the room · Value Bot retired" you/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat tape="casino">
        <AwayWall frames={[{ a: H_CAST.bal, line: '10/20 · +$340 · 22 min' }]} hooks={2}/>
        <TableChairs taken={1} of={3}/>
        <HomeGame players={[{ a: { ...H_CAST.agg, mood: 'neutral' }, stamina: 62, heat: 30 }]}/>
        <HomeOne a={{ ...H_CAST.blf, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={42} stamina={20} heat={14}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ sys: true, text: 'Three chairs at the table now.' }}/>
  </PhoneShell>
);

// ═════════════════════════════════════════════════════════════════
// THE FIRST FIVE MINUTES ON THIS NAV
// Six beats, and at no point is there a bar at the bottom offering three places to
// go. There is one thing to press, and it names the next beat.
// ═════════════════════════════════════════════════════════════════

// the draft, in the SYSTEM voice: the ghost has no voice yet, he is not born
const NavDraftM = () => (
  <PhoneShell>
    <HomeHead sub="drafting · the recruiter"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 9, justifyContent: 'flex-end' }}>
        <div style={{ alignSelf: 'flex-start', maxWidth: 268, padding: '8px 11px', borderRadius: 12, borderBottomLeftRadius: 3, background: 'rgba(255,255,255,0.05)', border: `1px solid ${M_BORDER}` }}>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>How should he play when he is not sure?</div>
        </div>
        <YouLine text="Patient. I would rather he folded than guessed."/>
        <div style={{ alignSelf: 'flex-start', maxWidth: 268, padding: '8px 11px', borderRadius: 12, borderBottomLeftRadius: 3, background: 'rgba(255,255,255,0.05)', border: `1px solid ${M_BORDER}` }}>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>Then he will hate folding and do it anyway.</div>
        </div>
        <div style={{ alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', borderRadius: 9, background: `${M_GOLD}12`, border: `1px solid ${M_GOLD}44` }}>
          <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>FORMING</span>
          <span style={{ fontSize: 10.5, color: M_DIM }}>this is starting to sound like a <b style={{ color: M_GOLD }}>Rock</b></span>
        </div>
      </div>
      <div style={{ flexShrink: 0, padding: '10px 13px 14px', borderTop: `1px solid ${M_BORDER}`, background: 'rgba(16,22,21,0.92)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, background: M_GOLD, cursor: 'pointer' }}>
          <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#120C02' }}>DEAL HIM IN</span>
        </div>
      </div>
    </div>
  </PhoneShell>
);

// he is in the room, and there is exactly one thing to do with him
const NavSendM = () => (
  <PhoneShell>
    <HomeHead sub="the room · 1 home" you/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, position: 'relative' }}>
      <HomeFlat tape="casino">
        <AwayWall hooks={0}/>
        <TableChairs taken={1}/>
        <HomeGame players={[{ a: { ...H_CAST.bal, mood: 'neutral' }, stamina: 88, heat: 14 }]}
          says={[{ i: 0, text: 'Nobody to play. Send me out.' }]}/>
        <DoorTap/>
      </HomeFlat>
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 12, background: M_TEAL, cursor: 'pointer', boxShadow: `0 0 20px ${M_TEAL}44` }}>
          <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#04100E' }}>SEND HIM TO PLAY</span>
        </div>
      </div>
    </div>
    <HomeThread latest={{ a: H_CAST.bal, text: 'Nobody to play. Send me out.' }}/>
  </PhoneShell>
);

Object.assign(window, {
  NavDraftM, NavSendM,
  FOUR, wear, NAV_ROSTER, WHERE, RosterRow, RosterSheet, NAV_LIVE, NAV_TONIGHT, LiveNow, Tonight, MINI_RING, YourTable, navRoom,
  NavHomeM, NavRosterM, NavCasinoM, NavCasinoIdleM, IdentitySheetM, FourApartM, BarsRefM, NavEmptyM, NavRetiredM,
});
