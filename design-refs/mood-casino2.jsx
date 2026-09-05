// THE FLOOR, RETHOUGHT. Finding 4, four problems in one screen:
// a newborn rendered twice (big ghost by the rail AND in the seated lineup); the bar
// read as a queue of name tags; "Everyone's resting" was a dead room; and a live felt
// was no louder than a dark one.
//
// FOUR RULES, added to the fish-tank law rather than replacing it:
// 1 · ONE GHOST PER AGENT, ALWAYS. An agent has exactly one body on the floor. If he
//     is arriving, the arriving body IS his body — there is no second copy anywhere.
// 2 · NAMES ARE EARNED, NOT WORN. A ghost carries a name chip only when he is seated
//     at a felt or currently selected. At the bar, posture is the identity.
// 3 · A LIVE FELT IS THE LOUDEST OBJECT. Everything not in a live hand drops to 42%
//     and the live felt gets a bright rim on top of the scrim. One place to look.
// 4 · A RESTING ROOM STILL BREATHES. Never "Everyone's resting." The standup says
//     what actually happened, and a ghost with news carries one pip: GREW, POCKET $0,
//     WORN. No news, no pip.

const PIP = {
  grew:  { label: '+2 GREW',   color: M_TEAL },
  broke: { label: 'POCKET $0', color: M_MUTED },
  worn:  { label: 'WORN',      color: M_GOLD },
};

const RestPip = ({ kind }) => {
  const p = PIP[kind];
  return (
    <span style={{
      fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
      color: p.color, background: 'rgba(14,16,18,0.92)',
      border: `1px solid ${p.color}${kind === 'broke' ? '55' : 'AA'}`,
      borderRadius: 3, padding: '2px 4.5px', whiteSpace: 'nowrap',
    }}>{p.label}</span>
  );
};

// ── a body at the bar. No tag, unless he is the one you tapped. ─────────────
const BarGhost = ({ x, y, mood, accent, size = 46, speed = 6, drink, pip, name, selected }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', zIndex: 3 }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      {selected && name && (
        <div style={{ marginBottom: 1 }}><GhostChip name={name} accent={accent} state="resting"/></div>
      )}
      <FloorGhost mood={mood} accent={accent} size={size} speed={speed} drink={drink}/>
      <div style={{ width: size * 1.05, height: 10, borderRadius: '50%', marginTop: -3, background: `radial-gradient(ellipse, ${MOODS[mood].color}26, transparent 70%)` }}/>
      {pip && <div style={{ marginTop: 1 }}><RestPip kind={pip}/></div>}
    </div>
  </div>
);

// ── he walks in. One body, a trail behind it, a destination ahead. ─────────
const WalkIn = ({ from, to, name, accent, mood = 'neutral', size = 50 }) => (
  <>
    <div style={{
      position: 'absolute', left: Math.min(from.x, to.x), top: to.y + size * 0.92,
      width: Math.abs(to.x - from.x), height: 2, zIndex: 2,
      background: `linear-gradient(90deg, transparent, ${accent}33 55%, ${accent}66)`,
    }}/>
    <div style={{ position: 'absolute', left: to.x, top: to.y, transform: 'translateX(-50%)', zIndex: 4 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <GhostChip name={name} accent={accent} state="resting"/>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: size * 2.1, height: size * 2.1, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${accent}1F, transparent 70%)` }}/>
          <FloorGhost mood={mood} accent={accent} size={size} speed={4.2}/>
        </div>
      </div>
    </div>
  </>
);

// ── the room, with one thing loud in it ────────────────────────────────────
const Floor2 = ({ layout, live, dim = 0.42, children }) => {
  const L = LAYOUTS[layout];
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: live ? dim : 0.92 }}>
        <RoomLayer layout={layout}/>
      </div>
      {live && <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,9,11,0.34)' }}/>}
      {live && (() => {
        const f = L.felts.find(x => x.lit && x.seat === live.seat) || L.felts[0];
        return (
          <>
            <div style={{ position: 'absolute', left: f.cx - f.rx * 1.7, top: f.cy - f.ry * 2.6, width: f.rx * 3.4, height: f.ry * 5.2, borderRadius: '50%', background: `radial-gradient(ellipse, ${M_TEAL}2E, transparent 68%)`, pointerEvents: 'none' }}/>
            <div style={{ position: 'absolute', left: f.cx - f.rx, top: f.cy - f.ry, width: f.rx * 2, height: f.ry * 2, borderRadius: '50%', border: `1px solid ${M_TEAL}88`, boxShadow: `0 0 22px ${M_TEAL}3D, inset 0 0 26px ${M_TEAL}1F`, pointerEvents: 'none' }}/>
          </>
        );
      })()}
      {children}
    </>
  );
};

// ═══ 1 · THE RESTING ROOM — nobody playing, and it still says something ════
const Floor2RestingScreenM = () => {
  const L = LAYOUTS.quiet;
  return (
    <PhoneShell>
      <GlobalHeader title="Casino"/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <Floor2 layout="quiet">
          <FloorStandup line="Four resting · Bluff Master grew tonight"/>
          {/* the bar: three bodies, three postures, no tags — and one pip that matters */}
          <BarGhost x={62}  y={L.bar.y - 92} mood="confident" accent={M_GOLD} drink pip="grew" size={46} speed={5.4}/>
          <BarGhost x={146} y={L.bar.y - 88} mood="neutral"   accent={M_TEAL} drink size={44} speed={6.2}/>
          <BarGhost x={228} y={L.bar.y - 90} mood="frustrated" accent={M_PURPLE} pip="worn" size={45} speed={7}/>
          {/* the corner: the one who cannot play, sitting apart from the bar */}
          <BarGhost x={L.corner.cx} y={L.corner.cy - 58} mood="sulking" accent={M_PINK} drink pip="broke" size={44} speed={7.4}/>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 5, padding: '0 14px' }}>
            <Btn kind="primary" h={46} full>Deploy someone</Btn>
          </div>
        </Floor2>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// ═══ 2 · ONE LIVE FELT — the loudest object on the screen ══════════════════
const Floor2LiveScreenM = () => {
  const L = LAYOUTS.one;
  const f = L.felts[0];
  const gh = (50 * 1.2) + 19 + 3;
  return (
    <PhoneShell>
      <GlobalHeader title="Casino"/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <Floor2 layout="one" live={{ seat: 0 }}>
          <FloorStandup net="+$340" flagged="1 flagged"/>
          <Diorama f={f} hole={CAST.balanced.hole}/>
          <Occupant x={f.cx} y={f.cy - gh + 8} name={CAST.balanced.name} accent={M_TEAL}
            mood="confident" state="live" size={50} speed={4.6}/>
          <PotTicker x={f.cx} y={f.cy - gh + 8 - 27} amount="480"/>
          {/* everyone else is under the scrim, at 42%, and carries no name */}
          <BarGhost x={72}  y={L.bar.y - 88} mood="confident" accent={M_GOLD} drink pip="grew" size={42} speed={5.6}/>
          <BarGhost x={154} y={L.bar.y - 86} mood="frustrated" accent={M_PURPLE} pip="worn" size={41} speed={7}/>
          <BarGhost x={L.corner.cx} y={L.corner.cy - 54} mood="sulking" accent={M_PINK} drink pip="broke" size={40} speed={7.4}/>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 5, padding: '0 14px' }}>
            <Btn kind="primary" h={46} full>Watch him</Btn>
          </div>
        </Floor2>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// ═══ 3 · HE WALKS IN — one body, crossing the room ═════════════════════════
const Floor2WalkInScreenM = () => {
  const L = LAYOUTS.one;
  const f = L.felts[0];
  const gh = (50 * 1.2) + 19 + 3;
  return (
    <PhoneShell>
      <GlobalHeader title="Casino"/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <Floor2 layout="one" live={{ seat: 0 }} dim={0.5}>
          <FloorStandup line="Hothead v1.0 is taking a seat"/>
          <Diorama f={f} hole={CAST.balanced.hole}/>
          <Occupant x={f.cx} y={f.cy - gh + 8} name={CAST.balanced.name} accent={M_TEAL}
            mood="confident" state="live" size={50} speed={4.6}/>
          <PotTicker x={f.cx} y={f.cy - gh + 8 - 27} amount="480"/>
          {/* the newborn: exactly one body, mid-room, walking toward the empty felt */}
          <WalkIn from={{ x: 30 }} to={{ x: 250, y: 300 }} name="Hothead v1.0" accent={M_TEAL} size={50}/>
          <BarGhost x={72} y={L.bar.y - 88} mood="confident" accent={M_GOLD} drink size={42} speed={5.6}/>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 5, padding: '0 14px' }}>
            <Btn kind="primary" h={46} full>Watch him</Btn>
          </div>
        </Floor2>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// ── desktop parity ─────────────────────────────────────────────────────────
const D4Floor2ScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$340" flagged="1 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <DeskFloor layout="one" seats={{ 0: { ...CAST.balanced, pot: '480' } }}/>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 34%, rgba(8,9,11,0) 0%, rgba(8,9,11,0.14) 52%, rgba(8,9,11,0.4) 100%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', left: 640, bottom: 150, zIndex: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <GhostChip name="Hothead v1.0" accent={M_TEAL} state="resting"/>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 180, height: 180, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_TEAL}1F, transparent 70%)` }}/>
              <FloorGhost mood="neutral" accent={M_TEAL} size={82} speed={4.2}/>
            </div>
          </div>
          <div style={{ position: 'absolute', right: '100%', top: 96, width: 260, height: 2, background: `linear-gradient(90deg, transparent, ${M_TEAL}55)` }}/>
        </div>
        <div style={{ position: 'absolute', left: 28, bottom: 26, display: 'flex', gap: 22, zIndex: 5 }}>
          {[{ m: 'confident', a: M_GOLD, p: 'grew' }, { m: 'frustrated', a: M_PURPLE, p: 'worn' }, { m: 'sulking', a: M_PINK, p: 'broke' }].map((g, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: 0.72 }}>
              <FloorGhost mood={g.m} accent={g.a} size={52} speed={6 + i} drink={i !== 1}/>
              <RestPip kind={g.p}/>
            </div>
          ))}
        </div>
      </div>
      <Panel>
        <PanelHead title="The room" sub="1 LIVE · 3 RESTING · 1 ARRIVING"/>
        <RailBody>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_TEAL}44` }}>
            <Lbl size={9.5} color={M_TEAL}>Hothead v1.0 is taking a seat</Lbl>
            <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.5, marginTop: 7 }}>
              Born four seconds ago. He crosses the room to the open felt &mdash; <b style={{ color: M_TEXT }}>one body, one trail</b>, and no copy of him in the seated lineup.
            </div>
          </div>
          <Btn kind="primary" h={42} full>Watch him</Btn>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, fontSize: 12, color: M_DIM, lineHeight: 1.55 }}>
            <Lbl size={9.5}>Who has news</Lbl>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {[['Bluff Master', 'grew'], ['Aggressive v1.3', 'worn'], ['Value Bot', 'broke']].map(([n, k]) => (
                <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: M_TEXT }}>{n}</span>
                  <RestPip kind={k}/>
                </div>
              ))}
            </div>
          </div>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

// ── the new state-matrix rows ──────────────────────────────────────────────
const Flow34MatrixM = () => {
  const cols = '124px repeat(5, 1fr)';
  const surfaces = ['Draft', 'Birth card', 'Floor', 'Watch', 'Thread'];
  const rows = [
    { k: 'BRIEF USABLE', c: M_TEAL, cells: [
      'composer gives up its place to “Deal him in”; strip full, nature formed',
      '—', '—', '—', '—'] },
    { k: 'ARRIVING', c: M_TEAL, cells: [
      'closed — he exists now',
      'sheet up, ghost in the header well, fold closed',
      'one body crossing the room, trail behind, name chip on',
      '—',
      'his first line, once'] },
    { k: 'SHEET FOLD', c: M_GOLD, cells: [
      '—',
      'closed by default, always, on a first agent',
      '—', '—',
      'a label becomes tappable the first time it costs something'] },
    { k: 'ROOM LIVE', c: M_TEAL, cells: [
      '—', '—',
      'live felt at full brightness, rim lit; everything else 42% under a scrim',
      'the felt, full screen',
      'LiveBar docked'] },
    { k: 'ROOM RESTING', c: M_MUTED, cells: [
      '—', '—',
      'no scrim, room at 92%; standup names what happened; pips on those with news',
      '—',
      'silent'] },
    { k: 'HAS NEWS', c: M_GOLD, cells: [
      '—', '—',
      'one pip at his feet: GREW / WORN / POCKET $0. No news, no pip.',
      '—',
      'the growth or pocket line'] },
  ];
  return (
    <Sheet title="New state-matrix rows" sub="Wave 34 adds six rows and no columns — every one is about emphasis and sequence rather than a new fact. The em-dash cells are the design: a state that does not exist on a surface must not be invented for consistency.">
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>
        <div/>
        {surfaces.map(h => <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingLeft: 11 }}>{h}</div>)}
      </div>
      {rows.map(r => (
        <div key={r.k} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 0', borderBottom: `1px solid ${M_BORDER}` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: r.c, paddingTop: 10 }}>{r.k}</div>
          {r.cells.map((c, i) => (
            <div key={i} style={{ fontSize: 11.5, color: c === '—' ? M_FAINT : M_DIM, lineHeight: 1.45, padding: '9px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{c}</div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>Invariants added</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            <b style={{ color: M_TEXT }}>One ghost per agent, always.</b> One primary action per screen, and it names the next screen. <b style={{ color: M_TEXT }}>A name chip is earned</b> — seated or selected, never worn at the bar. The attribute sheet is never open by default on a first agent.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
          <SyLbl color={M_RED}>Retired by this wave</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            &ldquo;Everyone&rsquo;s resting.&rdquo; The floating forming-ghost overlay. The dashed strip after a chip. &ldquo;Let&rsquo;s go&rdquo; with nothing to press. The bar-as-name-queue. <b style={{ color: M_TEXT }}>Six bars as the birth headline.</b>
          </div>
        </div>
      </div>
    </Sheet>
  );
};

Object.assign(window, {
  PIP, RestPip, BarGhost, WalkIn, Floor2, Flow34MatrixM,
  Floor2RestingScreenM, Floor2LiveScreenM, Floor2WalkInScreenM, D4Floor2ScreenM,
});
