// WATCH v4c — the lower half in glass, and the hand-end ceremony.
//
// 1 · The area under the felt was a grey sheet butted against a dark green table:
//     two different materials meeting at a hard line, which is why it looked cheap
//     next to the felt. It is now the same GLASS the floor's back button and
//     overlays use — translucent panels over the felt's own colour, thin light
//     borders, display-font section labels. Content and order are unchanged.
//
// 2 · A hand used to just stop. It now gets a 3-second ceremony on the felt, and
//     HEAT COLOURS IT: a tilted agent's loss does not look like a calm one's.

// bob speed and aura from heat, mirroring mood-heat.jsx's heatStyle so the ceremony
// works on any board without depending on that file's load order
const wStyle = (heat, mood) => {
  const t = Math.max(0, Math.min(100, heat)) / 100;
  return {
    speed: 7.2 - t * 4.6,
    aura: `${MOODS[mood].color}${Math.round(16 + t * 56).toString(16).padStart(2, '0')}`,
    spread: 1.45 + t * 0.75,
  };
};
const wBand = h => (h <= 24 ? 'cold' : h <= 49 ? 'warm' : h <= 74 ? 'hot' : 'boiling');

const GLASS = {
  panel: 'rgba(13,23,21,0.66)',
  panelUp: 'rgba(17,29,27,0.78)',
  edge: 'rgba(255,255,255,0.10)',
  edgeUp: 'rgba(255,255,255,0.16)',
  blur: 'blur(16px) saturate(1.15)',
};

// section labels take the DISPLAY face, not the Oswald label style — on glass the
// small-caps label reads as chrome, and this half of the screen is not chrome
const GLbl = ({ children, color = M_DIM, size = 13 }) => (
  <span style={{ fontFamily: PLAYFAIR, fontSize: size, fontWeight: 600, color, letterSpacing: '-0.005em' }}>{children}</span>
);

const Glass = ({ children, up, pad = '11px 13px', style }) => (
  <div style={{
    background: up ? GLASS.panelUp : GLASS.panel,
    backdropFilter: GLASS.blur, WebkitBackdropFilter: GLASS.blur,
    border: `1px solid ${up ? GLASS.edgeUp : GLASS.edge}`,
    borderRadius: 13, padding: pad, ...style,
  }}>{children}</div>
);

// ── 1 · between-hands status row ────────────────────────────────────────
const GBetween = ({ cause, truth, next = 8 }) => (
  <Glass style={{ marginBottom: 9 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <LiveDot size={5}/>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cause}</span>
      <Num size={9} color={M_MUTED} weight={500}>NEXT DEAL {next}s</Num>
    </div>
    {truth && <div style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, marginTop: 6 }}>{truth}</div>}
  </Glass>
);

// ── 2 · the TABLE tab ───────────────────────────────────────────────────
const GTab = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 3px', marginBottom: 9 }}>
    <GLbl color={M_TEXT}>Table</GLbl>
    <div style={{ height: 2, width: 22, borderRadius: 1, background: M_TEAL }}/>
    <div style={{ flex: 1 }}/>
    <Num size={9} color={M_MUTED} weight={500}>EVERYTHING SAID HERE</Num>
  </div>
);

// ── 3 · why the hand went wrong — only when there IS a cost ────────────
const GCost = () => (
  <Glass up style={{ marginBottom: 9, borderColor: `${M_GOLD}55` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
      <GLbl color={M_GOLD} size={13}>Why the hand went wrong</GLbl>
      <div style={{ flex: 1 }}/>
      <Num size={9} color={M_MUTED} weight={500}>WORN &middot; 140 HANDS</Num>
    </div>
    <AttrBar row w="100%" name="FOCUS" cur={62} lo={70} hi={75} fatigued/>
    <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 9 }}>
      He priced the river at 45% and it was 38%. <b style={{ color: M_DIM }}>The strategy was not wrong. The execution was.</b>
    </div>
  </Glass>
);

// ── 4 · sound ───────────────────────────────────────────────────────────
const GSound = ({ on = true }) => (
  <Glass style={{ marginBottom: 9 }} pad="9px 13px">
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={on ? M_TEAL : M_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M11 5 L6 9H3v6h3l5 4z"/>{on && <><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6a8 8 0 0 1 0 12"/></>}
      </svg>
      <span style={{ flex: 1, fontSize: 12.5, color: on ? M_TEXT : M_MUTED }}>Sound</span>
      <Num size={9} color={M_MUTED} weight={500}>HAPTICS STAY ON</Num>
      <div style={{ width: 34, height: 19, borderRadius: 10, background: on ? `${M_TEAL}44` : 'rgba(255,255,255,0.07)', border: `1px solid ${on ? M_TEAL : M_BORDER_2}`, position: 'relative', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: on ? 17 : 2, width: 13, height: 13, borderRadius: '50%', background: on ? M_TEAL : M_MUTED }}/>
      </div>
    </div>
  </Glass>
);

// ── 5 · the transcript, with attribution ───────────────────────────────
const GRow = ({ who, s, at, live }) => {
  const mine = who === 'HIM', yours = who === 'YOU';
  return (
    <div style={{ display: 'flex', gap: 9, padding: '7px 0', alignItems: 'baseline' }}>
      <span style={{ width: 52, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        {live && <LiveDot size={4.5}/>}
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: mine || yours ? 700 : 400, color: mine ? M_TEAL : yours ? M_GOLD : M_MUTED }}>{who}</span>
      </span>
      <span style={{ flex: 1, fontSize: mine ? 13 : 12, lineHeight: 1.42, color: mine ? M_TEXT : yours ? M_GOLD : M_MUTED, fontStyle: mine || yours ? 'normal' : 'italic' }}>
        {mine || yours ? s : <>&ldquo;{s}&rdquo;</>}
      </span>
      <Num size={8.5} color={M_MUTED} weight={500}>{at}</Num>
    </div>
  );
};

const GTranscript = ({ rows }) => (
  <Glass style={{ marginBottom: 9 }} pad="4px 13px">
    {rows.map((r, i) => <GRow key={i} {...r} live={i === rows.length - 1}/>)}
  </Glass>
);

// ── 6 · the composer ───────────────────────────────────────────────────
const GComposer = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Glass pad="0 6px 0 14px" style={{ flex: 1, display: 'flex', alignItems: 'center', height: 44, borderRadius: 22 }}>
      <span style={{ flex: 1, fontSize: 13, color: M_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Say something to him…</span>
      <button style={{ width: 32, height: 32, borderRadius: '50%', background: M_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </Glass>
  </div>
);

const G_ROWS = [
  { who: 'HIM', s: 'Ace-king, button. Raising to 60.', at: '18:31' },
  { who: 'GRANITE', s: 'Again?', at: '18:31' },
  { who: 'YOU', s: 'Careful with him.', at: '18:32' },
  { who: 'HIM', s: 'He checked twice. He’s got nothing.', at: '18:32' },
];

// the whole lower half, in order, over the felt's own colour
const LowerGlass = ({ cost, sound = true, rows = G_ROWS }) => (
  <div style={{
    flex: 1, minHeight: 0, overflow: 'hidden', padding: '10px 12px 14px',
    display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(180deg, #16221F 0%, #101A18 100%)',
  }}>
    {/* panels 1–5 are ONE SCROLL REGION with the composer pinned. The cost card is
        additive — 110px on a lower half that is only a 240px remainder — so with it
        present the six panels cannot all be resident. Scrolling them together is
        honest; clipping the transcript to fit a card it has nothing to do with is
        not, and shortening the felt would put the rope back in the hero row. */}
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <GBetween cause="rolling — three big pots in a row"
        truth={cost ? null : "+$3,712 TONIGHT · 43 HANDS · WORST BEAT: THE Q3o ON HAND 19"}/>
      <GTab/>
      {cost && <GCost/>}
      <GSound on={sound}/>
      <GTranscript rows={rows}/>
    </div>
    <div style={{ flexShrink: 0, paddingTop: 2 }}><GComposer/></div>
  </div>
);

const W4GlassScreenM = () => (
  <PhoneShell>
    <W4Header/>
    <Felt4 pace="calm" pot="480" board={B4F} flip={4} equity={87} acting="granite"
      says={[{ mine: true, text: "He checked twice. He's got nothing." }]}
      hero={<HeroRow4 toCall="240" action="BET $240" timer={9}/>}/>
    <LowerGlass/>
  </PhoneShell>
);

const W4GlassCostScreenM = () => (
  <PhoneShell>
    <W4Header mood="frustrated"/>
    <Felt4 pace="calm" pot="480" board={B5F} flip={5} equity={0} acting="granite"
      hero={<HeroRow4 street="RIVER" landed={2}/>}/>
    <LowerGlass cost sound={false}
      rows={[...G_ROWS.slice(0, 2), { who: 'HIM', s: 'He had the ace of clubs the whole way.', at: '18:34' }]}/>
  </PhoneShell>
);

// ═══ 2 · THE HAND-END CEREMONY ═══════════════════════════════════════════
// Three seconds, on the felt, and heat colours it: the same loss is a shrug at
// heat 20 and a red-rimmed silence at heat 88. One action out, and it goes where
// every other moment in this product goes — into the conversation.
const HandEnd = ({ won, name = 'Balanced v2.1', pot = '3,694', winner = 'Granite', mood = 'confident', heat = 40, delta, stack }) => {
  const s = wStyle(heat, mood);
  const hot = heat > 66;
  const key = won ? M_TEAL : hot ? M_RED : MOODS[mood].color;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, background: `radial-gradient(ellipse at 50% 46%, ${key}${hot ? '1F' : '14'} 0%, rgba(8,12,11,0.78) 52%, rgba(8,12,11,0.92) 100%)` }}>
      <div style={{ position: 'relative', marginBottom: 4 }}>
        <div style={{ position: 'absolute', left: '50%', top: '52%', width: 132 * s.spread, height: 132 * s.spread, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${key}${hot ? '3D' : '26'}, transparent 68%)` }}/>
        <MoodGhost mood={mood} accent={key} size={92} heat={heat} event={won ? 'smug' : 'stunned'} ring={false}/>
      </div>
      <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: M_MUTED }}>{name}</div>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 38, fontWeight: 600, color: won ? M_TEAL : key, letterSpacing: '-0.015em', lineHeight: 1.05, marginTop: 4 }}>
        {won ? 'WON' : 'LOST'}
      </div>
      {/* the delta AND where he stands — the pot's fate is context, his stack is
          the point. Same line on both states. */}
      <div style={{ marginTop: 9, display: 'flex', alignItems: 'baseline', gap: 9 }}>
        <Num size={24} weight={700} color={won ? M_TEAL : M_RED}>{delta || (won ? `+$${pot}` : '−$1,250')}</Num>
        <span style={{ fontSize: 12, color: M_MUTED }}>·</span>
        <span style={{ fontSize: 13, color: M_DIM }}>stack</span>
        <Num size={19} weight={700} color={M_TEXT}>${stack || (won ? '5,541' : '1,847')}</Num>
      </div>
      {!won && <div style={{ marginTop: 5 }}><Num size={9} color={M_MUTED} weight={500}>{winner.toUpperCase()} TOOK THE POT</Num></div>}
      <div style={{ marginTop: 7 }}><Num size={9} color={M_MUTED} weight={500}>{won ? 'HAND #4188 · 3s' : `HEAT ${heat} · ${wBand(heat).toUpperCase()}`}</Num></div>
      {/* the next hand starts in 3s anyway; the button only makes it now */}
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Btn kind="primary" h={46} full>Deal him in</Btn>
        <Btn kind="ghost" h={42} full>Talk to {name.split(' ')[0]} about this hand</Btn>
      </div>
    </div>
  );
};

const W4HandWonScreenM = () => (
  <PhoneShell>
    <W4Header/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ opacity: 0.5 }}>
        <Felt4 pace="showdown" pot="3,694" board={B5F} flip={5} equity={100} reveal
          hero={<HeroRow4 street="RIVER"/>}/>
      </div>
      <HandEnd won pot="3,694" mood="confident" heat={54}/>
    </div>
  </PhoneShell>
);

const W4HandLostCalmScreenM = () => (
  <PhoneShell>
    <W4Header mood="neutral"/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ opacity: 0.5 }}>
        <Felt4 pace="showdown" pot="3,694" board={B5F} flip={5} equity={0} reveal
          hero={<HeroRow4 street="RIVER"/>}/>
      </div>
      <HandEnd pot="3,694" winner="Granite" mood="neutral" heat={22}/>
    </div>
  </PhoneShell>
);

const W4HandLostTiltScreenM = () => (
  <PhoneShell>
    <W4Header mood="tilted" accent={M_PURPLE}/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
      <div style={{ opacity: 0.5 }}>
        <Felt4 pace="showdown" pot="3,694" board={B5F} flip={5} equity={0} reveal
          hero={<HeroRow4 street="RIVER"/>}/>
      </div>
      <HandEnd pot="3,694" winner="Granite" mood="tilted" heat={88}/>
    </div>
  </PhoneShell>
);

// ── the fold toss, as a strip ──────────────────────────────────────────
// 350ms, four frames, so the motion is unambiguous: the pair lifts, rotates away
// from him, travels to the muck and lands face down. Nothing fades — a fold that
// dissolves reads as a bug, a fold that is THROWN reads as a decision.
const FOLD_FRAMES = [
  { t: '0ms', x: 0, y: 0, r: 0, o: 1, s: 1, note: 'held, face up, in the hero row' },
  { t: '120ms', x: 26, y: -18, r: -14, o: 1, s: 0.94, note: 'lifted and turning — the only frame where both faces still show' },
  { t: '240ms', x: 74, y: -30, r: -34, o: 0.9, s: 0.82, note: 'travelling, backs coming round' },
  { t: '350ms', x: 118, y: -14, r: -52, o: 0.55, s: 0.7, note: 'landed in the muck, face down, at rest' },
];

const FoldTossStripM = () => (
  <div style={{ width: 390, background: 'linear-gradient(180deg, #1d2e2c 0%, #162423 100%)', fontFamily: INTER, padding: '14px 0 16px', borderRadius: 4 }}>
    <div style={{ padding: '0 14px 12px' }}>
      <GLbl color={M_TEXT}>The fold toss</GLbl>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        350ms, four frames. Nothing fades &mdash; a fold that dissolves reads as a bug.
      </div>
    </div>
    {FOLD_FRAMES.map((f, i) => (
      <div key={f.t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: `1px solid rgba(255,255,255,0.06)` }}>
        <Num size={9} color={i === 0 ? M_TEAL : M_MUTED} weight={600}>{f.t}</Num>
        <div style={{ position: 'relative', width: 168, height: 56, flexShrink: 0 }}>
          {/* the muck, where they are going */}
          <div style={{ position: 'absolute', right: 4, top: 20, width: 38, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', border: `1px dashed ${M_BORDER_2}` }}/>
          <div style={{ position: 'absolute', left: 6, top: 6, display: 'flex', gap: 2, transform: `translate(${f.x}px, ${f.y}px) rotate(${f.r}deg) scale(${f.s})`, transformOrigin: 'bottom center', opacity: f.o }}>
            {i < 3
              ? <><PlayingCard rank="7" suit="c" w={26} h={36}/><PlayingCard rank="2" suit="d" w={26} h={36}/></>
              : <><CardBack w={26} h={36}/><CardBack w={26} h={36}/></>}
          </div>
        </div>
        <div style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>{f.note}</div>
      </div>
    ))}
    <div style={{ padding: '12px 14px 0', borderTop: `1px solid rgba(255,255,255,0.06)`, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
      The turn happens between frames two and three, so the <b style={{ color: M_DIM }}>face is never visible in the muck</b> &mdash; the fish-tank law holds through the motion, not just at rest.
    </div>
  </div>
);

// ── desktop parity ─────────────────────────────────────────────────────
const D8GlassScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$3,712" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DeskFelt4 acting="granite"
        says={[{ mine: true, text: "He checked twice. He's got nothing." }, { id: 'granite', text: 'Again?' }]}/>
      <div style={{ width: 520, flexShrink: 0, borderLeft: `1px solid ${GLASS.edge}`, background: 'linear-gradient(180deg, #16221F 0%, #101A18 100%)', display: 'flex', flexDirection: 'column', padding: '14px 14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <GLbl color={M_TEXT} size={16}>Balanced v2.1</GLbl>
          <MoodChip mood="confident" small/>
          <div style={{ flex: 1 }}/>
          <StateTag state="live" compact/>
        </div>
        <GBetween cause="rolling — three big pots in a row"
          truth="+$3,712 TONIGHT · 43 HANDS · WORST BEAT: THE Q3o ON HAND 19"/>
        <GTab/>
        <GCost/>
        <GSound/>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}><GTranscript rows={G_ROWS}/></div>
        <GComposer/>
      </div>
    </div>
  </DesktopShell>
);

const D8HandEndScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$7,406" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, opacity: 0.45, display: 'flex' }}>
          <DeskFelt4 reveal board={B5F} flip={5} pot="3,694" equity={100}/>
        </div>
        <div style={{ position: 'absolute', inset: 0, zIndex: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at 50% 46%, ${M_TEAL}14 0%, rgba(8,12,11,0.8) 52%, rgba(8,12,11,0.94) 100%)` }}>
          <div style={{ position: 'relative', marginBottom: 6 }}>
            <div style={{ position: 'absolute', left: '50%', top: '52%', width: 240, height: 240, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_TEAL}26, transparent 68%)` }}/>
            <MoodGhost mood="confident" accent={M_TEAL} size={132} heat={54} event="smug" ring={false}/>
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: M_MUTED }}>Balanced v2.1</div>
          <div style={{ fontFamily: PLAYFAIR, fontSize: 56, fontWeight: 600, color: M_TEAL, letterSpacing: '-0.02em', lineHeight: 1.02, marginTop: 6 }}>WON</div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 11 }}>
            <Num size={34} weight={700} color={M_TEAL}>+$3,694</Num>
            <span style={{ fontSize: 15, color: M_MUTED }}>&middot;</span>
            <span style={{ fontSize: 15, color: M_DIM }}>stack</span>
            <Num size={26} weight={700} color={M_TEXT}>$5,541</Num>
          </div>
          <div style={{ marginTop: 9 }}><Num size={10} color={M_MUTED} weight={500}>HAND #4188 &middot; 3s</Num></div>
          <div style={{ marginTop: 26, width: 320, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Btn kind="primary" h={46} full>Deal him in</Btn>
            <Btn kind="ghost" h={42} full>Talk to Balanced about this hand</Btn>
          </div>
        </div>
      </div>
      {/* glass, not a Panel: PanelHead over black was the last flat grey surface on
          the watch screen, and it sat next to a felt. Same column as v5 desktop. */}
      <div style={{ width: 520, flexShrink: 0, borderLeft: `1px solid ${GLASS.edge}`, background: 'linear-gradient(180deg, #16221F 0%, #101A18 100%)', display: 'flex', flexDirection: 'column', padding: '14px 14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <GLbl color={M_TEXT} size={16}>Hand #4188</GLbl>
          <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: M_TEAL, background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}44`, borderRadius: 3, padding: '3px 6px' }}>WON</span>
          <div style={{ flex: 1 }}/>
          <Num size={11} weight={700} color={M_TEAL}>+$3,694</Num>
        </div>
        <GTab/>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <GTranscript rows={[...G_ROWS, { who: 'HIM', s: 'Told you. Nothing.', at: '18:34' }]}/>
        </div>
        <GComposer/>
      </div>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  wStyle, wBand, GLASS, Glass, GLbl, GBetween, GTab, GCost, GSound, GRow, GTranscript, GComposer,
  G_ROWS, LowerGlass, HandEnd, FOLD_FRAMES, FoldTossStripM,
  W4GlassScreenM, W4GlassCostScreenM, W4HandWonScreenM, W4HandLostCalmScreenM,
  W4HandLostTiltScreenM, D8GlassScreenM, D8HandEndScreenM,
});
