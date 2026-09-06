// WAVE 56 — the owner in a chair, and the draft.
//
// Two beats that wave 55 got wrong in the same way: both were drawn as the ROOM
// doing something, when both are moments the room has to get out of the way for.
//
//   SIT DOWN is not a camera move. Taking a chair puts you on the Watch v5 felt —
//     the same felt, the same seats, the same chips — with the hero seat replaced
//     by YOU: your two cards face up, your stack, your name pill. No ghost of your
//     own at the bottom, because you are not a creature; you are the player. No
//     walls, no fridge, no fixtures. Back returns to the room.
//   THE DRAFT is not a grey chat on a blank screen. It is the glass ThreadSheet
//     risen over the empty room, and the ghost FORMS on the table above it as the
//     answers land: silhouette, hood, eyes, colour. You watch him arrive while you
//     talk about him.

// ── the owner's seat: cards face up, no body ─────────────────────────────────
// A ghost at the bottom would be a second player. The pill is the only thing that
// says who is sitting here, so it is the thing that glows when it is your turn.
const SitHero = ({ hole = [['A', 's'], ['K', 'h']], win = 62, turn, stack = '1,840', secs }) => (
  <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 11px', borderRadius: 9, background: 'rgba(8,12,12,0.9)', border: `1px solid ${turn ? M_GOLD : M_BORDER}`, boxShadow: turn ? `0 0 16px ${M_GOLD}44` : 'none' }}>
      <span style={{ fontSize: 11, color: turn ? M_GOLD : M_TEXT, fontWeight: 500 }}>You</span>
      <span style={{ width: 1, height: 11, background: M_BORDER }}/>
      <Num size={10.5} weight={700} color={M_DIM}>${stack}</Num>
      {secs != null && <SeatTimerRing value={secs}/>}
    </div>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, padding: '9px 15px 8px', borderRadius: 15, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, border: `1px solid ${V5GLASS.edge}` }}>
      <div style={{ display: 'flex', gap: 7 }}>
        {hole.map((c, i) => (
          <div key={i} style={{ transform: `rotate(${i ? 8 : -8}deg)`, filter: 'drop-shadow(0 3px 9px rgba(0,0,0,0.7))' }}>
            <PlayingCard rank={c[0]} suit={c[1]} w={58} h={81}/>
          </div>
        ))}
      </div>
      <div style={{ paddingBottom: 6 }}>
        <Lbl size={8.5}>You win</Lbl>
        <div><Num size={22} weight={700} color={win >= 50 ? M_TEAL : M_MUTED}>{win}%</Num></div>
      </div>
    </div>
    <div style={{ width: '100%', padding: '0 26px' }}><TugBar equity={win}/></div>
  </div>
);

// back and chat, on the felt's own corners. A header row would be a fourth band in
// a screen whose whole point is that the felt is the screen.
const SitCorners = () => (
  <>
    <div style={{ position: 'absolute', left: 10, top: 10, zIndex: 8, width: 34, height: 34, borderRadius: 17, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, border: `1px solid ${V5GLASS.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
    </div>
    <div style={{ position: 'absolute', right: 10, top: 10, zIndex: 8, width: 34, height: 34, borderRadius: 17, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, border: `1px solid ${V5GLASS.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <svg width="16" height="16" viewBox="0 0 20 20"><path d="M2 10L18 3L11 18L9.4 11.6L2 10Z" fill="none" stroke={M_TEXT} strokeWidth="1.4" strokeLinejoin="round"/></svg>
      <span style={{ position: 'absolute', right: -1, top: -1, width: 8, height: 8, borderRadius: 4, background: M_TEAL, border: '1.5px solid #101A18' }}/>
    </div>
  </>
);

// the four verbs, where the whisper row sits in Watch
const SIT_VERBS = [['FOLD', M_MUTED], ['CHECK', M_DIM], ['CALL', M_TEAL], ['BET', M_GOLD]];
const SitActions = ({ betOpen }) => (
  <div style={{ flexShrink: 0, padding: '9px 12px 22px', background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, display: 'flex', gap: 7 }}>
    {SIT_VERBS.map(([v, c]) => (
      <div key={v} style={{ flex: 1, height: 44, borderRadius: 11, background: v === 'BET' && betOpen ? `${M_GOLD}22` : V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, border: `1px solid ${v === 'BET' ? `${M_GOLD}66` : v === 'CALL' ? `${M_TEAL}55` : V5GLASS.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.11em', color: c }}>{v}</span>
      </div>
    ))}
  </div>
);

// BET is the one verb that needs a number, so it is the one that opens a panel.
const SIT_AMTS = [['A THIRD', '160'], ['HALF', '240'], ['POT', '480'], ['ALL IN', '1,840']];
const SitBetPanel = () => (
  <div style={{ flexShrink: 0, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${M_GOLD}66`, padding: '11px 12px 22px', animation: 'bubblein 0.28s ease-out both' }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 9 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>BET</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: M_MUTED }}>pot is 480 · you have 1,840</span>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, cursor: 'pointer' }}>CANCEL</span>
    </div>
    <div style={{ display: 'flex', gap: 6 }}>
      {SIT_AMTS.map(([k, v], i) => (
        <div key={k} style={{ flex: 1, textAlign: 'center', borderRadius: 10, border: `1px solid ${i === 3 ? M_GOLD : `${M_GOLD}44`}`, background: i === 3 ? `${M_GOLD}1E` : `${M_GOLD}0D`, padding: '8px 0 7px', cursor: 'pointer' }}>
          <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: i === 3 ? M_GOLD : M_DIM }}>{k}</div>
          <div style={{ marginTop: 2 }}><Num size={12.5} weight={700} color={M_GOLD}>{v}</Num></div>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, height: 38, borderRadius: 10, border: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.03)', padding: '0 12px' }}>
      <span style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: M_MUTED }}>any amount</span>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: M_GOLD, border: `1px solid ${M_GOLD}66`, borderRadius: 8, padding: '6px 12px' }}>BET</span>
    </div>
  </div>
);

// Your agents in the ring plus one house regular, and he reads YOU. Two things the
// first pass got wrong: mood keys must come from MOODS ('bored' is a face EVENT, and
// passing it blanked the frame), and a renamed seat must take a new id — keeping
// W4_SEATS' ids while relabelling the seats anchored the read to the wrong body.
const SIT_CAST = [
  { id: 'bal', name: 'Balanced v2.1', accent: M_TEAL, mood: 'confident'  },
  { id: 'gra', name: 'Granite',       accent: M_GOLD, mood: 'neutral'    },
  { id: 'val', name: 'Value Bot',     accent: M_TEAL, mood: 'frustrated' },
  { id: 'agg', name: 'Aggressive',    accent: M_PINK, mood: 'tilted'     },
];
// index 1 is the top row's centre seat — the only slot with clear space above it and
// far from both corner circles, so the speaker's bubble is unambiguously his.
const SIT_RING = W4_SEATS.slice(0, 4).map((seat, i) => ({ ...seat, ...SIT_CAST[i], folded: false, history: undefined }));
const SIT_READ = { id: 'gra', text: 'You never fold a river bet, boss.' };

const SitShell = ({ children, foot }) => (
  <PhoneShell>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    {foot}
  </PhoneShell>
);

// F13 · you took a chair: the felt IS the screen
const SitDownM = () => (
  <SitShell foot={<SitActions/>}>
    <V5Felt seats={SIT_RING} pot="120" board={[]} flip={0} stackBand="mid" stackAmt="1,840"
      oppSays={SIT_READ}
      hero={<SitHero win={62} hole={[['A', 's'], ['K', 'h']]}/>}>
      <SitCorners/>
    </V5Felt>
  </SitShell>
);

// F14 · BET opened. The felt does not move; the panel takes the verbs' place.
const SitBetM = () => (
  <SitShell foot={<SitBetPanel/>}>
    <V5Felt seats={SIT_RING} pot="480" flip={4} stackBand="mid" stackAmt="1,840" potBand="mid"
      hero={<SitHero win={38} turn secs={16} hole={[['A', 's'], ['K', 'h']]}/>}>
      <SitCorners/>
    </V5Felt>
  </SitShell>
);

// ═══ THE DRAFT ═════════════════════════════════════════════════════════════
// He forms while you answer. Four stages, and the atom does all four: a hood of
// near-black with a near-black glow is a silhouette; the real hood with a dead glow
// is a body without eyes; the real glow lights them; the accent halo lands with the
// name. Nothing here is a second drawing of the ghost.
// Four stages made his colour arrive on the same beat as his name, so the two biggest
// moments shared one and neither got room. Five separates them: the COLLAR is the beat
// that says he has stopped being a shape, and colour plus the name pill are held back
// for the button. Still one atom — the collar is the only added geometry.
const DRAFT_STAGES = [
  { n: 1, hood: { top: '#0C0F12', bot: '#05070A' }, glow: '#0B0E11', halo: 0,   cap: 'a silhouette' },
  { n: 2, hood: { top: '#2A2E33', bot: '#171A1E' }, glow: '#191C20', halo: 0,   cap: 'the hood' },
  { n: 3, hood: { top: '#2A2E33', bot: '#171A1E' }, glow: '#7E6420', halo: 0.3, cap: 'the eyes' },
  { n: 4, hood: { top: '#2A2E33', bot: '#171A1E' }, glow: '#9C7C28', halo: 0.5, cap: 'the collar', collar: true },
  { n: 5, hood: HOODS[1], glow: GLOWS[1].c, halo: 1, cap: 'his colour', collar: true, named: true },
];

const FormingGhost = ({ stage = 1, size = 104 }) => {
  const st = DRAFT_STAGES[stage - 1];
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* the name pill is held back for the button: it arrives WITH his colour and
          not one beat earlier, so the two do not have to share a moment */}
      {st.named && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '2.5px 9px 4px', borderRadius: 8, background: 'rgba(8,12,12,0.9)', border: `1px solid ${M_GOLD}66`, animation: 'rise 0.4s ease-out both' }}>
          <span style={{ fontSize: size > 140 ? 11 : 9, color: M_TEXT, lineHeight: 1.1 }}>Gran</span>
          <ResourceBars stamina={96} heat={6} w={size > 140 ? 60 : 40} h={2} gap={2}/>
        </div>
      )}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'absolute', left: '50%', top: '48%', width: size * 2, height: size * 2, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${GLOWS[1].c}${st.halo ? (st.halo > 0.6 ? '26' : st.halo > 0.4 ? '18' : '10') : '00'}, transparent 66%)`, pointerEvents: 'none' }}/>
        <div style={{ animation: 'bubblein 0.5s ease-out both', opacity: stage === 1 ? 0.8 : 1 }}>
          <MoodGhost mood="neutral" accent={GLOWS[1].c} size={size} ring={false} hood={st.hood} glow={st.glow}/>
        </div>
        {/* THE COLLAR: a band across the hood's lower edge, in the hood's own ink two
            steps lighter, going gold when his colour lands. */}
        {st.collar && (
          <svg width={size} height={size} viewBox="0 0 80 80" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', animation: 'rise 0.4s ease-out both' }}>
            <path d="M14 56 C22 62 30 64 40 64 C50 64 58 62 66 56 L66 62 C58 68 50 70 40 70 C30 70 22 68 14 62 Z"
              fill={st.named ? `${GLOWS[1].c}3D` : 'rgba(255,255,255,0.13)'} stroke={st.named ? GLOWS[1].c : 'rgba(255,255,255,0.24)'} strokeWidth="1.2"/>
          </svg>
        )}
      </div>
    </div>
  );
};

const DRAFT_TALK = [
  [{ w: 'sys', t: 'How do you want him to play? Tight, loose, somewhere between?' },
   { w: 'you', t: 'Patient. I hate donking off chips.' }],
  [{ w: 'sys', t: 'Patient it is. And when he does have it — does he squeeze, or wait to be paid?' },
   { w: 'you', t: 'Wait to be paid.' }],
  [{ w: 'sys', t: 'Then he folds a lot and it will cost him pots he could have taken. You are describing a Rock.' },
   { w: 'you', t: 'Good.' }],
  [{ w: 'sys', t: 'One more. When someone runs him over for an hour — does he wait it out, or hit back?' },
   { w: 'you', t: 'Wait it out.' }],
  [{ w: 'sys', t: 'He is ready. What do you call him?' },
   { w: 'you', t: 'Granite. He can call himself Gran.' }],
];

const DraftRow = ({ r }) => {
  const you = r.w === 'you';
  return (
    <div style={{ display: 'flex', justifyContent: you ? 'flex-end' : 'flex-start', padding: '4px 0' }}>
      <div style={{ maxWidth: 268, padding: '9px 12px', borderRadius: 13, background: you ? `${M_TEAL}1C` : V5GLASS.raised, border: `1px solid ${you ? `${M_TEAL}4D` : V5GLASS.edge}`, fontSize: 12.5, color: you ? M_TEXT : M_DIM, lineHeight: 1.45 }}>{r.t}</div>
    </div>
  );
};

// The sheet is board 26's glass, risen over the room. It never covers the top band:
// that is where he is forming, and watching him form is the whole point.
const DraftSheetM = ({ stage = 1, named }) => {
  const rows = DRAFT_TALK.slice(0, stage).flat();
  const s = DRAFT_STAGES[stage - 1];
  return (
    <PhoneShell>
      <HomeHead sub={stage < 5 ? 'drafting · nobody in the room yet' : 'drafting · he has a name'}/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        {/* the room, dimmed to almost nothing: he is not in it yet */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}><HomeFlat lit={false}/></div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,10,10,0.55) 0%, rgba(6,10,10,0.8) 100%)' }}/>
        {/* him, forming over the table */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 34, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, zIndex: 3 }}>
          <FormingGhost stage={stage}/>
          <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', color: stage === 5 ? M_GOLD : M_MUTED }}>
            {stage === 5 ? 'GRANITE · A ROCK' : s.cap.toUpperCase()}
          </span>
        </div>
        {/* the glass sheet, over the lower band only */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 206, zIndex: 6, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderTopLeftRadius: 18, borderTopRightRadius: 18, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 6px' }}>
            <span style={{ width: 30, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }}/>
            <span style={{ flex: 1 }}/>
            <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>THE DRAFT · {stage} OF 5</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '2px 14px 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            {rows.slice(-4).map((r, i) => <DraftRow key={i} r={r}/>)}
          </div>
          <div style={{ flexShrink: 0, padding: '9px 12px 20px' }}>
            {named ? (
              <div style={{ height: 48, borderRadius: 12, background: M_GOLD, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 4px 18px ${M_GOLD}44` }}>
                <span style={{ fontFamily: OSWALD, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.12em', color: '#120C04' }}>DEAL HIM IN</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.05)', border: `1px solid ${V5GLASS.edge}`, padding: '0 8px 0 14px' }}>
                <span style={{ flex: 1, fontSize: 12.5, color: M_MUTED }}>{stage === 5 ? 'his name…' : 'answer him…'}</span>
                <span style={{ width: 30, height: 30, borderRadius: 15, background: `${M_TEAL}26`, border: `1px solid ${M_TEAL}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 20 20"><path d="M2 10L18 3L11 18L9.4 11.6L2 10Z" fill="none" stroke={M_TEAL} strokeWidth="1.5" strokeLinejoin="round"/></svg>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </PhoneShell>
  );
};

const Draft1M = () => <DraftSheetM stage={1}/>;
const Draft3M = () => <DraftSheetM stage={3}/>;
const Draft4M = () => <DraftSheetM stage={4}/>;
const Draft5M = () => <DraftSheetM stage={5} named/>;

// the four stages side by side, so the forming is legible as a sequence
const FormingStripM = () => (
  <div style={{ width: 390, background: 'linear-gradient(180deg, #141C1B 0%, #0E1514 100%)', fontFamily: INTER, borderRadius: 4, padding: '14px 0 16px' }}>
    <div style={{ padding: '0 14px 12px' }}>
      <span style={{ fontFamily: PLAYFAIR, fontSize: 13, fontWeight: 600, color: M_TEXT }}>He forms as you answer</span>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>One atom, four parameter sets. Nothing is redrawn.</div>
    </div>
    <div style={{ display: 'flex' }}>
      {DRAFT_STAGES.map(s => (
        <div key={s.n} style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
          <FormingGhost stage={s.n} size={62}/>
          <span style={{ fontFamily: MONO, fontSize: 8, color: M_MUTED }}>Q{s.n}</span>
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.12em', color: s.n === 4 ? M_GOLD : M_DIM, textAlign: 'center' }}>{s.cap.toUpperCase()}</span>
        </div>
      ))}
    </div>
  </div>
);

Object.assign(window, {
  SitHero, SitCorners, SitActions, SitBetPanel, SIT_CAST, SIT_RING, SIT_READ, SitShell, SitDownM, SitBetM,
  DRAFT_STAGES, FormingGhost, DRAFT_TALK, DraftRow, DraftSheetM,
  Draft1M, Draft3M, Draft4M, Draft5M, FormingStripM,
});
