// THE BIRTH CARD, REDRAWN. Findings 2 and 3.
//
// F2: the card led with six attribute bars, and READS / FOCUS / DISCIPLINE mean
// nothing to someone who has owned an agent for four seconds. The card is now about
// HIM — name, nature, his first words, one line of what he is built for — and the
// sheet lives behind a fold that says so. On a first agent the fold is never open.
//
// F3: the forming ghost floated over the chat, did not fit, and was then covered by
// the card. He now has a PLACE: the mood band's 42px well before birth, and the
// sheet's own header well after it. The card rises from him, so there is exactly one
// ghost on screen at any moment.

const B3 = {
  name: 'Hothead v1.0',
  nature: { n: 'Hothead', up: 'DECEPTION', dn: 'COMPOSURE' },
  first: "Aggressive, you said. Good. I'll bluff too much and I'll enjoy it.",
  builtFor: 'Making people fold. He is very hard to read and he knows it.',
  attrs: [
    { k: 'READS', cur: 33, lo: 54, hi: 78 },
    { k: 'FOCUS', cur: 38, lo: 62, hi: 88 },
    { k: 'DISCIPLINE', cur: 31, lo: 52, hi: 74 },
    { k: 'COMPOSURE', cur: 24, lo: 41, hi: 62 },
    { k: 'DECEPTION', cur: 47, lo: 76, hi: 96 },
    { k: 'STAMINA', cur: 36, lo: 60, hi: 82 },
  ],
};

// ── the fold. The whole point is that it is closed. ─────────────────────────
const SheetFold = ({ open }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px',
    borderRadius: 10, background: open ? 'transparent' : M_PANEL_2,
    border: `1px solid ${open ? M_BORDER : M_BORDER_2}`, cursor: 'pointer',
  }}>
    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: open ? M_TEAL : M_DIM }}>His sheet</span>
    <Num size={9} color={M_MUTED} weight={500}>{open ? 'SIX ATTRIBUTES · THEY GROW' : 'IF YOU WANT THE NUMBERS'}</Num>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={open ? M_TEAL : M_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
  </div>
);

// ── the card. He is the headline; the numbers are a drawer. ─────────────────
const BirthCard3 = ({ open, first = true }) => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 7,
    background: M_PANEL, borderTop: `1px solid ${M_TEAL}44`,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    boxShadow: `0 -18px 44px rgba(0,0,0,0.6), 0 0 40px ${M_TEAL}14`,
    padding: '0 14px 16px', animation: 'sheetup 0.5s cubic-bezier(.2,.8,.2,1) both',
  }}>
    {/* his place: the header well, half out of the sheet. The card rises from here. */}
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: -34, marginBottom: 4 }}>
      <div style={{
        width: 68, height: 68, borderRadius: 20, background: '#0A0F17',
        border: `1px solid ${M_TEAL}66`, boxShadow: `0 0 26px ${M_TEAL}3D`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood="neutral" accent={M_TEAL} size={64} ring={false}/>
      </div>
    </div>

    <div style={{ textAlign: 'center', marginBottom: 12 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 25, fontWeight: 600, color: M_TEXT, letterSpacing: '-0.01em' }}>{B3.name}</div>
      <div style={{ marginTop: 9 }}><NatureBadge nature={B3.nature.n} up={B3.nature.up} dn={B3.nature.dn} size="l"/></div>
    </div>

    <div style={{ padding: '13px 15px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_TEAL}33`, marginBottom: 11 }}>
      <div style={{ fontSize: 14, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic' }}>&ldquo;{B3.first}&rdquo;</div>
    </div>

    <div style={{ display: 'flex', gap: 10, marginBottom: 12, padding: '0 2px' }}>
      <span style={{ width: 62, flexShrink: 0, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: M_TEAL, paddingTop: 2 }}>BUILT FOR</span>
      <span style={{ flex: 1, fontSize: 12.5, color: M_DIM, lineHeight: 1.45 }}>{B3.builtFor}</span>
    </div>

    <div style={{ marginBottom: 12 }}>
      <SheetFold open={open}/>
      {open && (
        <div style={{ marginTop: 9, padding: '13px 13px 14px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, animation: 'rise 0.35s ease-out both' }}>
          <AttrCluster attrs={B3.attrs} w="100%"/>
          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
            Every number is exact. The gold band is <b style={{ color: M_DIM }}>how good he might get</b> &mdash; it narrows as he plays. Nothing here is bought.
          </div>
        </div>
      )}
    </div>

    <Btn kind="primary" h={48} full>Deal him in</Btn>
    {first && !open && (
      <div style={{ marginTop: 9, textAlign: 'center' }}>
        <Num size={9} color={M_MUTED} weight={500}>YOU CAN READ THE NUMBERS LATER · HE EXPLAINS THEM AS THEY MATTER</Num>
      </div>
    )}
  </div>
);

// the room he was born into, dimmed, with no second ghost in it
const BirthRoom = () => {
  const L = LAYOUTS.one;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.5 }}><RoomLayer layout="one"/></div>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 78%, rgba(0,212,170,0.10) 0%, rgba(8,8,10,0.72) 58%, rgba(8,8,10,0.92) 100%)' }}/>
      {/* the light he is standing in — the sheet's well sits directly above it */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 150, height: 150, borderRadius: '50%', background: `radial-gradient(circle, ${M_TEAL}1F, transparent 70%)`, animation: 'fadein 0.9s ease-out both' }}/>
      </div>
    </>
  );
};

const BirthCardClosedScreenM = () => (
  <PhoneShell>
    <style>{`@keyframes sheetup{from{transform:translateY(44px);opacity:0}to{transform:none;opacity:1}}`}</style>
    <GlobalHeader title="Casino"/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <BirthRoom/>
      <BirthCard3/>
    </div>
    <TabBar active="casino"/>
  </PhoneShell>
);

const BirthCardOpenScreenM = () => (
  <PhoneShell>
    <style>{`@keyframes sheetup{from{transform:translateY(44px);opacity:0}to{transform:none;opacity:1}}`}</style>
    <GlobalHeader title="Casino"/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <BirthRoom/>
      <BirthCard3 open/>
    </div>
    <TabBar active="casino"/>
  </PhoneShell>
);

// ── F3 · the ghost's place BEFORE birth: the mood band well ─────────────────
// The overlay is gone. DraftBand already owns a 42px well and the draft already
// carries a phase — the forming ghost belongs in it, at the size it was designed for.
// The watermark behind the chat is the only other place he appears, at 8% and clipped
// to the scroll area, so it can never cover or be covered.
const DraftGhostPlaceScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="New agent"/>
    <DraftBand phase={0.86} cause="aggressive bluffer · high variance" action="Skip" ready/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10, position: 'relative' }}>
      <div style={{ position: 'absolute', right: 8, bottom: 8, opacity: 0.08, pointerEvents: 'none', zIndex: 0 }}>
        <FormingGhost size={186} phase={0.86}/>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <RecruiterBubble time="09:42">
          That is a whole agent. Nothing left to ask.
        </RecruiterBubble>
        <div style={{ padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
          <NatureFormed nature="Hothead" up="DECEPTION" dn="COMPOSURE"/>
        </div>
      </div>
    </div>
    <NextAction label="Deal him in" sub="STRATEGY SET · NATURE FORMED"/>
  </PhoneShell>
);

// ── F2 · onboarding, the only way it is allowed to happen ───────────────────
// No tutorial screen, no text wall, no six-card carousel. An attribute explains
// itself the first time it costs or earns something, in the thread, one sentence,
// on a tap. After the first time, the label is just a label.
const AttrExplain = ({ k }) => {
  const a = (typeof ATTRS !== 'undefined' && ATTRS.find(x => x.k === k)) || { k, mean: '', trainsShort: '' };
  return (
    <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '12px 13px', borderRadius: 11, background: M_PANEL, border: `1px solid ${M_GOLD}55`, animation: 'rise 0.35s ease-out both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD }}>{a.k}</span>
        <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
        <Num size={9} color={M_MUTED} weight={500}>FIRST TIME ONLY</Num>
      </div>
      <div style={{ fontSize: 13.5, color: M_TEXT, lineHeight: 1.5 }}>{a.mean} It grows from {a.trainsShort}.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11, paddingTop: 10, borderTop: `1px solid ${M_BORDER}` }}>
        <AttrBar row w="100%" name={a.k} cur={38} lo={62} hi={88}/>
      </div>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 9 }}>
        His is 38. The gold band is how good he might get.
      </div>
    </div>
  );
};

const FirstCostLineScreenM = () => (
  <ThreadScreen name="Hothead v1.0" accent={M_TEAL} mood="frustrated" state="recap" action="Deploy"
    cause="closed −$180 · first session">
    <SysLine>Session closed · 23:12</SysLine>
    <AgentBubble mood="frustrated" accent={M_TEAL} time="23:12" expressive>
      Ninety hands. I got two of them badly wrong.
    </AgentBubble>
    <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '10px 12px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ flex: 1, fontSize: 12.5, color: M_DIM, lineHeight: 1.4 }}>He misjudged equity by 7% on the river</span>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD, background: `${M_GOLD}1F`, border: `1px solid ${M_GOLD}88`, borderRadius: 3, padding: '3px 6px', cursor: 'pointer' }}>FOCUS</span>
      </div>
      <div style={{ marginTop: 7 }}><Num size={9} color={M_MUTED} weight={500}>HAND #12 &middot; TAP THE LABEL</Num></div>
    </div>
    <AttrExplain k="FOCUS"/>
    <AgentBubble mood="frustrated" accent={M_TEAL} time="23:13">
      It'll get better. That is what the hands are for.
    </AgentBubble>
  </ThreadScreen>
);

// ── desktop parity: the card in the rail, fold closed ───────────────────────
const D4BirthCardScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$340" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        <DeskFloor layout="one"
          seats={{ 0: { ...CAST.balanced, pot: '480' } }}
          bar={[{ ...CAST.bluff, x: 300, state: 'recap', speed: 6 }]}/>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 62% 72%, rgba(0,212,170,0.10) 0%, rgba(8,8,10,0.45) 60%, rgba(8,8,10,0.7) 100%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', left: 560, bottom: 96, transform: 'translateX(-50%)', textAlign: 'center', zIndex: 4 }}>
          <div style={{ position: 'absolute', left: '50%', top: '46%', width: 190, height: 190, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_TEAL}26, transparent 70%)` }}/>
          <MoodGhost mood="neutral" accent={M_TEAL} size={96} ring={false}/>
          <div style={{ marginTop: 10, position: 'relative' }}>
            <span style={{ fontFamily: PLAYFAIR, fontSize: 22, fontWeight: 600, color: M_TEXT }}>{B3.name}</span>
          </div>
        </div>
      </div>
      <Panel>
        <PanelHead title="He is here" sub="HOTHEAD V1.0 · 09:44"/>
        <RailBody>
          <div style={{ textAlign: 'center', padding: '4px 0 2px' }}>
            <NatureBadge nature={B3.nature.n} up={B3.nature.up} dn={B3.nature.dn} size="l"/>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${M_TEAL}33`, fontSize: 14, color: M_TEXT, lineHeight: 1.55, fontStyle: 'italic' }}>
            &ldquo;{B3.first}&rdquo;
          </div>
          <div style={{ display: 'flex', gap: 11 }}>
            <span style={{ width: 62, flexShrink: 0, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: M_TEAL, paddingTop: 2 }}>BUILT FOR</span>
            <span style={{ flex: 1, fontSize: 12.5, color: M_DIM, lineHeight: 1.45 }}>{B3.builtFor}</span>
          </div>
          <SheetFold/>
          <Btn kind="primary" h={44} full>Deal him in</Btn>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  B3, SheetFold, BirthCard3, BirthRoom, AttrExplain,
  BirthCardClosedScreenM, BirthCardOpenScreenM, DraftGhostPlaceScreenM,
  FirstCostLineScreenM, D4BirthCardScreenM,
});
