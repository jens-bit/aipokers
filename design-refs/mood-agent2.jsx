// ═════════════════════════════════════════════════════════════════
// WAVE 63 · PART C — THE ROSTER, THE FLAT, THE TV, THE CELEBRATION  (C5–C9)
// ═════════════════════════════════════════════════════════════════

// ═══ C5 · THE ROSTER ═════════════════════════════════════════════════════
// The header's "N agents live" pill is the roster button. One row per agent, and
// the row's job is to answer WHERE HE IS — which is the question the old home
// screen made you tap four things to answer.
const AG_ROSTER = [
  { id: 'bal', name: 'Balanced v2.1', nick: 'Bal',   mood: 'confident',  where: 'at the casino', at: '25/50', pocket: '1,200', net: '+$3,694', live: true },
  { id: 'agg', name: 'Aggressive v1.3', nick: 'Agg', mood: 'tilted',     where: 'home',          at: 'pacing', pocket: '640',  net: '−$820',   want: true },
  { id: 'blf', name: 'Bluff Master',  nick: 'Bluff',  mood: 'frustrated', where: "visiting Fidde's", at: '10/20', pocket: '410', net: '+$95', live: true },
  { id: 'val', name: 'Value Bot',     nick: 'Value',  mood: 'sulking',    where: 'at your table', at: 'kitchen', pocket: '80',  net: '—' },
];

const AgentRosterRow = ({ r }) => {
  const id = idFor(r.id);
  const up = r.net.startsWith('+');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderTop: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
      <div style={{ width: 38, height: 38, flexShrink: 0, position: 'relative' }}>
        <MoodGhost mood={r.mood} accent={id.glow.c} size={38} ring={false} hood={id.hood} glow={id.glow.c}/>
        {r.live && <span style={{ position: 'absolute', right: -1, top: 1, width: 6, height: 6, borderRadius: '50%', background: M_TEAL, boxShadow: `0 0 6px ${M_TEAL}`, animation: 'pulse 2s ease-in-out infinite' }}></span>}
        {r.want && <span style={{ position: 'absolute', right: -1, top: 1, width: 6, height: 6, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 6px ${M_GOLD}` }}></span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2.5 }}>
          <span style={{ fontSize: 11, color: M_MUTED, whiteSpace: 'nowrap' }}>{r.where}</span>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_FAINT }}>{r.at}</span>
        </div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2.5 }}>
        <Num size={11.5} weight={700} color={r.net === '—' ? M_MUTED : up ? M_TEAL : M_RED}>{r.net}</Num>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.1em', color: M_FAINT }}>POCKET</span>
          <Num size={10} weight={600} color={M_GOLD}>${r.pocket}</Num>
        </span>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={M_FAINT} strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6"/></svg>
    </div>
  );
};

const AgentRosterSheet = () => (
  <div style={{ width: 390, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderRadius: '16px 16px 0 0', fontFamily: INTER, padding: '10px 0 18px' }}>
    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 10 }}>
      <span style={{ width: 30, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 10px' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', color: M_TEAL }}>THE ROSTER</span>
      <span style={{ fontSize: 11, color: M_MUTED }}>4 agents · 2 live</span>
    </div>
    {AG_ROSTER.map(r => <AgentRosterRow key={r.id} r={r}/>)}
  </div>
);

// the pill in the header that opens it
const AgentRosterPill = ({ n = 2 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 19, padding: '0 8px', borderRadius: 10, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}4D`, cursor: 'pointer', whiteSpace: 'nowrap' }}>
    <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: M_TEAL, animation: 'pulse 2s ease-in-out infinite' }}></span>
    <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: M_TEAL }}>{n} AGENTS LIVE</span>
  </span>
);

const AgentRosterM = () => (
  <PhoneShell>
    <HomeHead sub="1 at the casino · 1 visiting · 2 home" right={<AgentRosterPill/>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, position: 'relative' }}>
      <HomeFlat balance="$54,000">
        <AwayWall frames={[{ a: H_CAST.bal, line: '25/50 · +$3,694 · 41 min', hot: true }, { a: H_CAST.blf, line: "10/20 · +$95 · Fidde's" }]} hooks={1}/>
        <HomeOne a={{ ...H_CAST.agg, mood: 'tilted' }} at={STAND.byTable} size={46} routine="pace" stamina={41} heat={84}/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} size={42} routine="count" stamina={24} heat={12}/>
        <DoorTap/>
      </HomeFlat>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><AgentRosterSheet/></div>
    </div>
  </PhoneShell>
);

// ═══ C6 · ABSENCE ════════════════════════════════════════════════════════
// An agent who is out leaves something behind. Not a caption saying he is out —
// his chair, still at the table, with his name tag on it, dimmed. And his frame
// on the wall is lit, which is where he actually is.
const AbsentChair = ({ at, name }) => (
  <div style={{ position: 'absolute', left: at.x, top: at.y, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 6, opacity: 0.5 }}>
    {/* his name tag, hung on the chair back */}
    <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(8,12,12,0.9)', border: `1px dashed ${M_BORDER_2}`, fontSize: 7.5, color: M_MUTED, whiteSpace: 'nowrap' }}>{name}</span>
    {/* the chair, from above: a back and a seat */}
    <div style={{ width: 30, height: 25, borderRadius: 4, border: `1px solid ${M_BORDER_2}`, background: 'rgba(255,255,255,0.025)', position: 'relative' }}>
      <span style={{ position: 'absolute', left: 3, right: 3, top: 2.5, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)' }}></span>
    </div>
  </div>
);

const AgentAbsenceM = () => (
  <PhoneShell>
    <HomeHead sub="Bal is at the casino · 3 home" right={<AgentRosterPill n={1}/>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat balance="$54,000">
        {/* HIS frame, lit, because that is where he is */}
        <AwayWall frames={[{ a: H_CAST.bal, line: '25/50 · +$3,694 · 41 min', hot: true }]} hooks={2}/>
        {/* HIS chair, still at the table, with his tag on it */}
        <AbsentChair at={TABLE_SEATS[4][2]} name={pillName(H_CAST.bal.name, 'Bal')}/>
        <HomeOne a={{ ...H_CAST.agg, mood: 'tilted' }} at={TABLE_SEATS[4][0]} size={46} routine="game" dealt stamina={41} heat={84}/>
        <HomeOne a={{ ...H_CAST.blf, mood: 'frustrated' }} at={TABLE_SEATS[4][3]} size={44} routine="game" dealt stamina={62} heat={58}
          says="His chair is still warm."/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} size={42} routine="sleep" stamina={24} heat={12}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.blf, text: 'His chair is still warm.' }}/>
  </PhoneShell>
);

// ═══ C7 · THE TV, BY STATE ═══════════════════════════════════════════════
// One TV, two states, and the state is read from the room rather than set by a
// flag: if somebody is out, it carries his table; if nobody is, it is the tape
// room. HomeFlat already derives this from its own children.
const AgentTvAwayM = () => (
  <PhoneShell>
    <HomeHead sub="the TV is carrying Bal's table" right={<AgentRosterPill n={1}/>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat balance="$54,000">
        <AwayWall frames={[{ a: H_CAST.bal, line: '25/50 · +$3,694 · 41 min', hot: true }]} hooks={2}/>
        <AbsentChair at={TABLE_SEATS[4][2]} name={pillName(H_CAST.bal.name, 'Bal')}/>
        <HomeOne a={{ ...H_CAST.agg, mood: 'tilted' }} at={STAND.tvSeat} size={46} routine="tv" stamina={41} heat={84}
          says="He is going to give it all back."/>
        <HomeOne a={{ ...H_CAST.blf, mood: 'frustrated' }} at={STAND.byTable} size={44} routine="shuffle" stamina={62} heat={58}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.agg, text: 'He is going to give it all back.' }}/>
  </PhoneShell>
);

const AgentTvHomeM = () => (
  <PhoneShell>
    <HomeHead sub="everyone home · the tape room is on" right={<F3Pill color={M_MUTED}><span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED }}>NOBODY LIVE</span></F3Pill>}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat balance="$54,000" tape="study">
        <AwayWall frames={[]} hooks={3}/>
        <HomeOne a={{ ...H_CAST.bal, mood: 'confident' }} at={STAND.tape} size={44} routine="tape" stamina={78} heat={22}
          says="Watch this one again."/>
        <HomeOne a={{ ...H_CAST.agg, mood: 'tilted' }} at={STAND.byTable} size={46} routine="pace" stamina={41} heat={84}/>
        <HomeOne a={{ ...H_CAST.blf, mood: 'frustrated' }} at={STAND.lounge} size={44} routine="shuffle" stamina={62} heat={58}/>
        <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} size={42} routine="sleep" stamina={24} heat={12}/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.bal, text: 'Watch this one again.' }}/>
  </PhoneShell>
);

// ═══ C8 · THE CELEBRATION ════════════════════════════════════════════════
// Three bursts, teal and gold, 1.2s, over the felt. Not a full-screen overlay:
// it is above the table, so the table is still the thing you are looking at.
//
// WAVE 63 fix: these were animated with `both` fill-mode ending at opacity 0, so
// on a board — which is a still — nothing painted and a big win differed from an
// ordinary win only by its headline. Same failure the falling name pill had. They
// are now drawn MID-FLIGHT, each burst at its own point in the 1.2s, and the
// motion is described in the caption instead of being asserted by a dead frame.
const AG_BURST = [
  { x: 92, y: 150, c: M_TEAL, d: 0, out: 0.86, op: 0.5 },
  { x: 300, y: 118, c: M_GOLD, d: 0.26, out: 0.6, op: 0.8 },
  { x: 196, y: 196, c: M_TEAL, d: 0.52, out: 0.3, op: 1 },
];

const Fireworks = () => (
  <div style={{ position: 'absolute', inset: 0, zIndex: 9, pointerEvents: 'none' }}>
    {AG_BURST.map((b, i) => (
      <div key={i} style={{ position: 'absolute', left: b.x, top: b.y, width: 0, height: 0 }}>
        {Array.from({ length: 10 }).map((_, j) => (
          <span key={j} style={{
            position: 'absolute', left: 0, top: 0, width: 3, height: 3, borderRadius: '50%', background: b.c,
            boxShadow: `0 0 6px ${b.c}`, opacity: b.op,
            transform: `rotate(${j * 36}deg) translateY(${-4 - 36 * b.out}px) scale(${0.3 + 0.7 * b.out})`,
          }}></span>
        ))}
        {/* the core flash, only on the burst that is still opening */}
        {b.out < 0.4 && <span style={{ position: 'absolute', left: -1.5, top: -1.5, width: 3, height: 3, borderRadius: '50%', background: '#fff', opacity: 0.9, transform: `scale(${1 + 6 * b.out})` }}></span>}
      </div>
    ))}
  </div>
);

// a busted seat: the seat goes dark, and his name pill falls OFF the table.
// A bust is bigger than a win, and this is the whole difference — the win adds
// something to the felt, the bust takes a piece of furniture off it.
//
// Drawn at mid-fall rather than animated, because a still of a finished fall is
// an empty seat and says nothing. The motion is agPillFall: 900ms, 56px, 24°.
const BustedSeat = ({ x, y, name = 'Gran' }) => (
  <div style={{ position: 'absolute', left: x, top: y, zIndex: 10, pointerEvents: 'none' }}>
    <div style={{ position: 'absolute', left: -34, top: -32, width: 68, height: 74, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.5) 58%, transparent 78%)' }}></div>
    <div style={{ position: 'absolute', left: -22, top: 20, padding: '2.5px 7px', borderRadius: 8, background: 'rgba(8,12,12,0.92)', border: `1px solid ${M_RED}59`, whiteSpace: 'nowrap', opacity: 0.7, transform: 'translateY(34px) rotate(18deg)' }}>
      <span style={{ fontSize: 8.5, color: M_RED }}>{name}</span>
    </div>
  </div>
);

// the result line over the felt, and the hands that say it before the words do
const AgCelebLine = ({ big, bust, who = 'Bal', amt = '3,694', bb = 148 }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, top: 96, zIndex: 11, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
    <V5Glass up pad="9px 15px" style={{ borderRadius: 12, textAlign: 'center' }}>
      <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.18em', color: bust ? M_RED : big ? M_GOLD : M_TEAL }}>
        {bust ? 'GRANITE IS OUT' : big ? `WON ${bb} BB` : 'WON'}
      </div>
      <div style={{ marginTop: 4 }}><Amt size={big || bust ? 24 : 19} color={bust ? M_TEAL : M_TEAL}>${amt}</Amt></div>
      <div style={{ marginTop: 3, fontSize: 10.5, color: M_MUTED }}>
        {bust ? 'he called it off with a pair of nines' : big ? 'kings full, against the raise' : 'ace-high. He folded.'}
      </div>
    </V5Glass>
  </div>
);

const AgentCelebScreen = ({ big, bust }) => {
  const gran = (typeof W4_SEATS !== 'undefined' ? W4_SEATS : []).find(s => s.id === 'granite');
  return (
    <V5Shell>
      <V5Felt board={B5F} flip={5} pot={bust ? '5,180' : big ? '14,800' : '3,694'} reveal dim potBand="big"
        seats={(typeof W4_SEATS !== 'undefined' ? W4_SEATS : []).map(s => (bust && s.id === 'granite' ? { ...s, folded: true } : s))}
        hero={<V5Hero street="RIVER" hands="raise" mood="confident" equity={100} won
          hole={[['K', 's'], ['K', 'd']]} stack={bust ? '9,120' : big ? '16,640' : '5,541'} bare/>}>
        {/* the loser's hands drop to his sides: 'rest' is exactly that pose, and the
            seats already draw it — nothing new was invented for the loss. */}
        <AgCelebLine big={big} bust={bust} amt={bust ? '5,180' : big ? '14,800' : '3,694'}/>
        {(big || bust) && <Fireworks/>}
        {bust && gran && <BustedSeat x={gran.x} y={gran.y} name="Gran"/>}
      </V5Felt>
    </V5Shell>
  );
};

const AgentCelebWinM = () => <AgentCelebScreen/>;
const AgentCelebBigM = () => <AgentCelebScreen big/>;
const AgentCelebBustM = () => <AgentCelebScreen bust/>;

// ═══ C9 · DESKTOP ════════════════════════════════════════════════════════
// The agent view is not a new desktop screen: it is the RIGHT COLUMN changing
// what it holds. Him large at the top of the column, the action row, the
// conversation, the composer at the bottom. The room stays visible in the centre,
// which is the whole reason the desktop has three columns.
const DkAgentColumn = ({ a, w = 380 }) => {
  const id = idFor(a.id);
  return (
    <div style={{ width: w, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: 'rgba(14,20,19,0.97)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px 10px', borderBottom: `1px solid ${M_BORDER}` }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: M_TEXT }}>{a.name}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 4, background: `${MOODS[a.mood].color}1A`, border: `1px solid ${MOODS[a.mood].color}4D` }}>
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.1em', color: MOODS[a.mood].color }}>{MOODS[a.mood].label}</span>
        </span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL, cursor: 'pointer' }}>LIVE</span>
        <span style={{ fontSize: 14, color: M_MUTED, cursor: 'pointer', paddingLeft: 4 }}>&times;</span>
      </div>

      {/* him large, at the top of the column */}
      <div style={{ flexShrink: 0, height: 268, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 44% 66%, #1E2826 0%, #151D1C 60%, #101615 100%)' }}>
        <div style={{ position: 'absolute', left: 122, top: 236, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
          <AgentPill a={a} stamina={a.stam} heat={a.heat}/>
          <div style={{ position: 'relative', width: 132, height: 132, animation: 'agentBreathe 4.2s ease-in-out infinite' }}>
            <MoodGhost mood={a.mood} accent={id.glow.c} size={132} ring={false} hood={id.hood} glow={id.glow.c}/>
            <svg width={132} height={132} viewBox="0 0 80 80" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
              {ghostHands({ pose: 'rest', size: 132, grip: SEAT_GRIP })}
            </svg>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 122 - 48, top: 229, width: 96, height: 12, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 72%)' }}></div>
        <div style={{ position: 'absolute', left: 190, top: 96, zIndex: 6 }}>
          <AgentBubble text="It was the sizing. He never bets that big with a hand."/>
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: `1px solid ${M_BORDER}` }}>
        <V5Glass up pad="0 10px" style={{ flex: 1.7, height: 40, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', borderColor: `${M_TEAL}59`, background: `${M_TEAL}1C` }}>
          <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', color: M_TEAL }}>DEPLOY</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: M_DIM }}>25/50 · $1,200</span>
        </V5Glass>
        {[['GIVE CHIPS', 'chips'], ['CARRY', 'carry'], ['PROFILE', 'profile']].map(([lbl, ic]) => (
          <V5Glass key={lbl} pad="0" style={{ flex: 1, height: 40, borderRadius: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer' }}>
            {AG_ICON[ic](M_DIM)}
            <span style={{ fontFamily: OSWALD, fontSize: 7, fontWeight: 600, letterSpacing: '0.08em', color: M_MUTED, whiteSpace: 'nowrap' }}>{lbl}</span>
          </V5Glass>
        ))}
      </div>

      <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={{ marginTop: 'auto' }}></span>
        <AgentLine a={a} mine text="Why did you call there?"/>
        <AgentLine a={a} text="It was the sizing. He never bets that big with a hand."/>
        <AgentLine a={a} mine text="Which hand?"/>
        <AgentLine a={a} text="This one." hand={<AgentHandCard/>}/>
        <AgentLine a={a} mine text="Stay off him for a bit."/>
        <AgentLine a={a} text="Fine. I will wait for the button." at="21:06"/>
      </div>

      <div style={{ flexShrink: 0, padding: '10px 14px 14px', borderTop: `1px solid ${M_BORDER}` }}>
        <V5Glass pad="0 6px 0 13px" style={{ display: 'flex', alignItems: 'center', height: 40, borderRadius: 20 }}>
          <span style={{ flex: 1, fontSize: 12.5, color: M_MUTED }}>Whisper to him</span>
          <button style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </V5Glass>
      </div>
    </div>
  );
};

const DkAgentScreenM = ({ w = 1440, h = 900 }) => (
  <DkShell w={w} h={h}>
    <DkBar wide={w > 1500} sub="Bal is open in the column"/>
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      <DkRoster/>
      <DkFlat w={stageW(w)} h={h - DK_H.pad}>{dkRoom({})}</DkFlat>
      <DkAgentColumn a={AG_CAST.bal}/>
    </div>
  </DkShell>
);

Object.assign(window, {
  AG_ROSTER, AgentRosterRow, AgentRosterSheet, AgentRosterPill, AgentRosterM,
  AbsentChair, AgentAbsenceM, AgentTvAwayM, AgentTvHomeM,
  AG_BURST, Fireworks, BustedSeat, AgCelebLine, AgentCelebScreen,
  AgentCelebWinM, AgentCelebBigM, AgentCelebBustM,
  DkAgentColumn, DkAgentScreenM,
});
