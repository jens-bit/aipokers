// ═════════════════════════════════════════════════════════════════
// WAVE 59 · CARRY, THE GUEST, THE SHARE CARD
//
// Three things that all say the same thing in different places: the room is a room
// with objects in it, so you should be able to pick one up; the product should be
// playable before you have an account; and a night worth telling someone about needs
// something to send.
// ═════════════════════════════════════════════════════════════════

// ── 1 · CARRY HIM ────────────────────────────────────────────────────────
// A long press lifts him. Everything about the lift says "held": he grows, his shadow
// separates from the floor, and he says something about it — because being picked up
// is a thing that happens TO him, and he has opinions.
const CARRY_TARGETS = [
  { k: 'couch',  x: 58,  y: 408, w: 92,  h: 116, lbl: 'REST' },
  { k: 'table',  x: 208, y: 300, w: 132, h: 96,  lbl: 'DEAL HIM IN' },
  { k: 'fridge', x: 284, y: 200, w: 60,  h: 88,  lbl: 'A BEER' },
  { k: 'tv',     x: 296, y: 540, w: 108, h: 62,  lbl: 'WATCH TAPE' },
  { k: 'door',   x: 358, y: 300, w: 40,  h: 116, lbl: 'SEND HIM OUT' },
];

// what he says while he is off the ground, by state. A worn agent dangles, a hot one
// squirms, and one in a hand simply will not come.
const CARRY_VOICE = {
  rested: { says: 'Where are we going?', tilt: -4,  bob: '2.6s', pose: 'rest' },
  worn:   { says: 'Fine. Carry me.',     tilt: -14, bob: '4.2s', pose: 'rest' },
  hot:    { says: 'Put me down.',        tilt: 6,   bob: '0.9s', pose: 'clench' },
  hand:   { says: 'I am in a hand.',     tilt: 0,   bob: null,   pose: 'hold' },
};

const CarryTarget = ({ t, on }) => (
  <div style={{ position: 'absolute', left: t.x - t.w / 2, top: t.y - t.h, width: t.w, height: t.h, borderRadius: 8, zIndex: 12, pointerEvents: 'none',
    border: `1px dashed ${on ? M_TEAL : 'rgba(255,255,255,0.14)'}`,
    background: on ? `${M_TEAL}1F` : 'transparent',
    boxShadow: on ? `0 0 22px ${M_TEAL}33, inset 0 0 18px ${M_TEAL}14` : 'none' }}>
    {on && (
      <div style={{ position: 'absolute', left: '50%', top: -9, transform: 'translateX(-50%)', padding: '2.5px 8px', borderRadius: 7, background: M_TEAL, whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.12em', color: '#06100E' }}>{t.lbl}</span>
      </div>
    )}
  </div>
);

// him, off the ground. The shadow is the whole trick: a body with its shadow under it
// is standing, a body with its shadow BELOW and blurred is being held.
const CarriedBody = ({ x, y, id = 'agg', name = 'Aggressive v1.3', state = 'rested', size = 62, refusing, quiet }) => {
  const v = CARRY_VOICE[state], i = idFor(id);
  // the room decides which side he can be heard on, and how wide
  const sd = sideFor(x, null, size);
  const mw = Math.max(84, bubRoom(x, size)[sd]);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)', zIndex: 40, pointerEvents: 'none' }}>
      {/* the shadow he left on the floor, 26px below his feet and soft */}
      <div style={{ position: 'absolute', left: '50%', top: 26, width: size * 0.9, height: size * 0.24, marginLeft: -(size * 0.45), borderRadius: '50%', background: 'rgba(0,0,0,0.42)', filter: 'blur(4px)' }}></div>
      {!quiet && (
        <div style={{ position: 'absolute', top: size * 0.5, transform: 'translateY(-50%)', [sd === 'right' ? 'left' : 'right']: bubAnchor(size) }}>
          <HomeBubble text={v.says} gold={refusing} side={sd} maxW={mw}/>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, transform: `rotate(${v.tilt}deg)`, animation: v.bob ? `bob ${v.bob} ease-in-out infinite` : 'none', filter: 'drop-shadow(0 10px 16px rgba(0,0,0,0.55))' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '2.5px 8px 4px', borderRadius: 8, background: 'rgba(8,12,12,0.9)', border: `1px solid ${M_TEAL}66` }}>
          <span style={{ fontSize: 8.5, color: M_TEXT, lineHeight: 1.1 }}>{pillName(name)}</span>
          <ResourceBars stamina={state === 'worn' ? 16 : 62} heat={state === 'hot' ? 84 : 22} w={44} h={2} gap={2}/>
        </div>
        <MoodGhost mood={state === 'hot' ? 'tilted' : state === 'worn' ? 'sulking' : 'confident'} size={size} ring={false}
          hood={i.hood} glow={i.glow.c} hands={v.pose}/>
      </div>
    </div>
  );
};

const carryRoom = () => (
  <>
    <AwayWall frames={[{ a: H_CAST.bal, line: '25/50 · +$340 · 41 min' }]} hooks={2}/>
    <TableChairs taken={2}/>
    <HomeOne a={H_CAST.blf} at={STAND.lounge} size={44} stamina={70} heat={24}/>
    <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={42} stamina={18} heat={12}/>
    <DoorTap/>
  </>
);

const CarryShell = ({ children, sub }) => (
  <PhoneShell>
    <HomeHead sub={sub} you/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat tape="live">{children}</HomeFlat>
    </div>
    <HomeThread latest={{ a: H_CAST.agg, text: 'Where are we going?' }}/>
  </PhoneShell>
);

// C1 · the lift. Nothing is lit yet: he has come off the floor and that is all.
const CarryLiftM = () => (
  <CarryShell sub="holding Aggro · long press">
    {carryRoom()}
    <CarriedBody x={196} y={370} state="rested"/>
  </CarryShell>
);

// C2 · dragging. One target at a time, because two lit targets is a question the
// room cannot answer — the nearest one wins and the others go quiet.
const CarryDragM = () => (
  <CarryShell sub="over the couch">
    {carryRoom()}
    {CARRY_TARGETS.map(t => <CarryTarget key={t.k} t={t} on={t.k === 'couch'}/>)}
    <CarriedBody x={86} y={330} state="worn"/>
  </CarryShell>
);

// C2b · carried to the DOOR: x358 of 390, the case that would have put a
// right-hand bubble 87px outside the frame. The side flips because the clearance
// says so, not because this frame special-cased it.
const CarryDoorM = () => (
  <CarryShell sub="over the door · send him out">
    {carryRoom()}
    {CARRY_TARGETS.map(t => <CarryTarget key={t.k} t={t} on={t.k === 'door'}/>)}
    <CarriedBody x={352} y={300} state="hot"/>
  </CarryShell>
);

// C3 · the drop. He lands, the target goes out, and the room takes over: the routine
// the place implies starts on its own.
const CarryDropM = () => (
  <CarryShell sub="asleep on the couch">
    <AwayWall frames={[{ a: H_CAST.bal, line: '25/50 · +$340 · 41 min' }]} hooks={2}/>
    <TableChairs taken={2}/>
    <HomeOne a={H_CAST.blf} at={STAND.lounge} size={44} stamina={70} heat={24}/>
    <HomeOne a={{ ...H_CAST.agg, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={46} stamina={16} heat={20}/>
    <DoorTap/>
  </CarryShell>
);

// C4 · he refuses. Mid-hand he does not come off the floor at all: the lift is
// rejected rather than undone, so there is no drop to watch.
const CarryRefuseM = () => (
  <CarryShell sub="he is in a hand">
    <AwayWall frames={[{ a: H_CAST.bal, line: '25/50 · +$340 · 41 min' }]} hooks={2}/>
    <TableChairs taken={3}/>
    <HomeGame players={[{ a: { ...H_CAST.agg, mood: 'confident' }, stamina: 62, heat: 34 }, { a: H_CAST.blf, stamina: 70, heat: 24 }]}
      says={[{ i: 0, text: 'I am in a hand.' }]}/>
    <HomeOne a={{ ...H_CAST.val, mood: 'sulking' }} at={STAND.couch} routine="sleep" size={42} stamina={18} heat={12}/>
    <DoorTap/>
    {/* the refusal, drawn on the body that stayed put: a rim and no lift */}
    <div style={{ position: 'absolute', left: 208, top: 356, transform: 'translate(-50%,-50%)', width: 74, height: 74, borderRadius: '50%', border: `1px dashed ${M_RED}88`, zIndex: 20, pointerEvents: 'none' }}></div>
  </CarryShell>
);

// the three states side by side, so "dangles / squirms / refuses" is legible as a set
const CarryStatesM = () => (
  <div style={{ width: 390, background: 'linear-gradient(180deg, #141C1B 0%, #0E1514 100%)', fontFamily: INTER, borderRadius: 4, padding: '14px 0 16px' }}>
    <div style={{ padding: '0 14px 12px' }}>
      <span style={{ fontFamily: PLAYFAIR, fontSize: 13, fontWeight: 600, color: M_TEXT }}>What being carried does to him</span>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>Tilt, float speed and hand pose — three parameters, no new drawing.</div>
    </div>
    <div style={{ display: 'flex' }}>
      {['rested', 'worn', 'hot', 'hand'].map(k => (
        <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', height: 142 }}>
          <div style={{ position: 'absolute', left: '50%', top: 74 }}>
            <CarriedBody x={0} y={0} state={k} size={46} refusing={k === 'hand'} quiet/>
          </div>
          <div style={{ position: 'absolute', left: 4, right: 4, bottom: 0, textAlign: 'center' }}>
            <div style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.12em', color: k === 'hand' ? M_RED : M_DIM }}>
              {k === 'hand' ? 'REFUSES' : k === 'worn' ? 'DANGLES' : k === 'hot' ? 'SQUIRMS' : 'RESTED'}
            </div>
            <div style={{ fontSize: 8.5, color: M_MUTED, lineHeight: 1.35, marginTop: 3, textWrap: 'pretty' }}>&ldquo;{CARRY_VOICE[k].says}&rdquo;</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

Object.assign(window, {
  CARRY_TARGETS, CARRY_VOICE, CarryTarget, CarriedBody, carryRoom, CarryShell,
  CarryLiftM, CarryDragM, CarryDoorM, CarryDropM, CarryRefuseM, CarryStatesM,
});
