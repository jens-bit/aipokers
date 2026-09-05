// agenticpoker.app — marketing surface, viewport-disciplined.
// Copy and palette are LOCKED; this file only decides layout and scale.
// Breakpoints: 1440 · 1280 · 768 · 390. The hero must fit one viewport at
// 1440×900 AND 1280×800 with the next section's header just peeking.

const L_INK      = '#150710';
const L_WINE     = '#2A0E18';
const L_WINE_2   = '#3A1424';
const L_WINE_EDGE= 'rgba(205,179,128,0.16)';
const L_GOLD     = '#CDB380';
const L_GOLD_HI  = '#E8D5A8';
const L_CREAM    = '#F4EBDD';
const L_CREAM_2  = 'rgba(244,235,221,0.72)';
const L_CREAM_3  = 'rgba(244,235,221,0.44)';
const L_DISPLAY  = '"Rozha One", Georgia, serif';

// ── the breakpoint table: every size the page uses, in one place ──
const LBP = {
  1440: { pad: 72, mastPad: '26px 72px 0', heroHead: 88, heroSub: 19, subMax: 440,
          scene: [520, 360], secPad: '54px 72px', secPadTop: 54, secHead: 40, secSub: 17,
          shot: 0.42, stepGap: 30, wide: 0.72, ctaBig: true },
  1280: { pad: 56, mastPad: '22px 56px 0', heroHead: 68, heroSub: 17, subMax: 400,
          scene: [430, 310], secPad: '44px 56px', secPadTop: 44, secHead: 34, secSub: 15.5,
          shot: 0.335, stepGap: 24, wide: 0.62, ctaBig: true },
  768:  { pad: 40, mastPad: '20px 40px 0', heroHead: 52, heroSub: 15.5, subMax: 360,
          scene: [300, 236], secPad: '40px 40px', secHead: 30, secSub: 14.5,
          shot: 0.40, stepGap: 22, wide: 0.52, ctaBig: false, twoCol: true },
};

// ── marketing type ──
const LHead = ({ size = 56, children, style }) => (
  <div style={{ fontFamily: L_DISPLAY, fontSize: size, fontWeight: 400, color: L_CREAM,
    letterSpacing: '0.005em', lineHeight: 1.1, ...style }}>{children}</div>
);
const LLbl = ({ children, color = L_GOLD, size = 10 }) => (
  <span style={{ fontFamily: OSWALD, fontSize: size, fontWeight: 500,
    letterSpacing: '0.28em', textTransform: 'uppercase', color }}>{children}</span>
);
const LBody = ({ size = 16, children, style }) => (
  <div style={{ fontFamily: INTER, fontSize: size, color: L_CREAM_2, lineHeight: 1.6, ...style }}>{children}</div>
);

const TgCta = ({ big }) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 9, alignItems: 'flex-start' }}>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      height: big ? 56 : 48, padding: big ? '0 28px' : '0 22px', borderRadius: 999,
      background: `linear-gradient(180deg, ${L_GOLD_HI}, ${L_GOLD})`,
      boxShadow: `0 0 34px rgba(205,179,128,0.24), 0 2px 0 rgba(0,0,0,0.3)`,
      cursor: 'pointer',
    }}>
      <svg width={big ? 21 : 18} height={big ? 21 : 18} viewBox="0 0 24 24" fill={L_INK}>
        <path d="M21.9 4.3 18.9 19.4c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.2c-.3.3-.5.5-1 .5l.3-4.7 8.6-7.8c.4-.3-.1-.5-.6-.2L6.9 13.5 2.3 12c-1-.3-1-1 .2-1.5l18.1-7c.8-.3 1.5.2 1.3 1.8z"/>
      </svg>
      <span style={{ fontFamily: OSWALD, fontSize: big ? 16 : 14, fontWeight: 600,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: L_INK }}>Draft him</span>
    </div>
    <span style={{ fontFamily: MONO, fontSize: 12, color: L_CREAM_3, paddingLeft: 4 }}>Free · plays in Telegram · @agenticpoker_bot</span>
  </div>
);

// ── real product screens at marketing scale ──
const Shot = ({ scale = 0.5, children, w = 390, h = 844, glow = true }) => (
  <div style={{
    width: Math.round(w * scale), height: Math.round(h * scale),
    overflow: 'hidden', flexShrink: 0, borderRadius: Math.round(54 * scale),
    boxShadow: glow ? `0 26px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(205,179,128,0.10)` : 'none',
  }}>
    <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      {children}
    </div>
  </div>
);

const WideShot = ({ scale, children, w = 1440, h = 900 }) => (
  <div style={{
    width: Math.round(w * scale), height: Math.round(h * scale),
    overflow: 'hidden', borderRadius: 10, flexShrink: 0,
    border: `1px solid ${L_WINE_EDGE}`,
    boxShadow: `0 30px 80px rgba(0,0,0,0.6)`,
  }}>
    <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      {children}
    </div>
  </div>
);

// ── the hero art: one ghost, one felt, one light ──
const HeroScene = ({ w = 560, h = 400 }) => (
  <div style={{ position: 'relative', width: w, height: h, flexShrink: 0 }}>
    {/* THE SHEEN HAS TO FINISH INSIDE ITS OWN BOX. It was an ellipse centred at 26%
        of the box height with a 60% vertical radius, so the box's top edge sat at
        just 43% of that radius — still carrying ~5% gold — and the box cut the
        gradient off as a hard horizontal line against the maroon. Every edge is now
        past the transparent stop: top 42/40 = 105%, bottom 145%, sides 104%. */}
    <div style={{
      position: 'absolute', left: '50%', top: -h * 0.18, width: w * 1.04, height: h * 1.16,
      transform: 'translateX(-50%)', pointerEvents: 'none',
      background: `radial-gradient(ellipse 48% 40% at 50% 42%, rgba(232,213,168,0.16), rgba(232,213,168,0.05) 40%, transparent 68%)`,
    }}/>
    <div style={{
      position: 'absolute', left: '50%', bottom: h * 0.05, transform: 'translateX(-50%)',
      width: w * 0.82, height: h * 0.42, borderRadius: '50%',
      background: `radial-gradient(ellipse at 50% 34%, #43182A 0%, #2C0F1C 58%, #1E0A14 100%)`,
      border: `1px solid rgba(205,179,128,0.22)`,
      boxShadow: `inset 0 0 60px rgba(0,0,0,0.6), 0 0 0 9px #1B0912, 0 0 0 10px rgba(205,179,128,0.14), 0 24px 60px rgba(0,0,0,0.6)`,
    }}>
      <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: `1px solid rgba(205,179,128,0.10)` }}/>
    </div>
    <div style={{ position: 'absolute', left: '50%', bottom: h * 0.30, transform: 'translateX(-50%)', display: 'flex', zIndex: 3 }}>
      <div style={{ transform: 'rotate(-11deg) translateX(2px)', transformOrigin: 'bottom center' }}><PlayingCard rank="A" suit="s" w={Math.round(w * 0.093)} h={Math.round(w * 0.129)}/></div>
      <div style={{ transform: 'rotate(11deg) translateX(-2px)', transformOrigin: 'bottom center' }}><PlayingCard rank="K" suit="h" w={Math.round(w * 0.093)} h={Math.round(w * 0.129)}/></div>
    </div>
    <div style={{ position: 'absolute', left: '50%', bottom: h * 0.36, transform: 'translateX(-50%)', zIndex: 2 }}>
      <MoodGhost mood="confident" accent={L_GOLD} tone={L_GOLD} size={Math.round(w * 0.235)} ring={false}/>
    </div>
  </div>
);

// ── HERO — given an exact height, it fills it and no more ──
const HeroSection = ({ bp, heroH }) => (
  <div style={{
    position: 'relative', overflow: 'hidden',
    height: heroH, display: 'flex', flexDirection: 'column',
    background: `radial-gradient(ellipse 70% 50% at 50% 0%, #3A1424 0%, ${L_WINE} 34%, ${L_INK} 78%)`,
    borderBottom: `1px solid ${L_WINE_EDGE}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: bp.mastPad, flexShrink: 0 }}>
      <svg width="19" height="22" viewBox="0 0 22 26">
        <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
          fill="none" stroke={L_GOLD} strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={L_GOLD} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
      <LLbl size={11}>Agentic Poker</LLbl>
      <div style={{ flex: 1 }}/>
      <span style={{ fontFamily: MONO, fontSize: 12, color: L_CREAM_3 }}>agenticpoker.app</span>
    </div>

    <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 30,
      padding: `0 ${bp.pad}px` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <LHead size={bp.heroHead} style={{ marginBottom: 18 }}>
          Deal him <span style={{ color: L_GOLD_HI }}>in.</span>
        </LHead>
        <LBody size={bp.heroSub} style={{ marginBottom: 28, maxWidth: bp.subMax }}>
          Build an AI poker player in a 30-second chat. He plays real hands — with moods, memory, and opinions of his own.
        </LBody>
        <TgCta big={bp.ctaBig}/>
      </div>
      <HeroScene w={bp.scene[0]} h={bp.scene[1]}/>
    </div>
  </div>
);

// ── section chrome, rhythm-tightened ──
const Sec = ({ bp, label, title, sub, children, tint }) => (
  <div style={{
    padding: bp.secPad,
    background: tint ? L_WINE : L_INK,
    borderBottom: `1px solid ${L_WINE_EDGE}`,
  }}>
    <LLbl>{label}</LLbl>
    <LHead size={bp.secHead} style={{ marginTop: 10, marginBottom: sub ? 10 : 22 }}>{title}</LHead>
    {sub && <LBody size={bp.secSub} style={{ marginBottom: 24, maxWidth: 620 }}>{sub}</LBody>}
    {children}
  </div>
);

// ── HOW IT WORKS ──
const Step = ({ n, title, body, bp, row, children }) => {
  const caption = (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 7 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: L_GOLD }}>0{n}</span>
        <span style={{ fontFamily: L_DISPLAY, fontWeight: 400, fontSize: bp.secHead > 34 ? 22 : 19, color: L_CREAM }}>{title}</span>
      </div>
      <LBody size={13.5} style={{ maxWidth: 300 }}>{body}</LBody>
    </div>
  );
  const shot = <div style={{ display: 'flex', justifyContent: row ? 'center' : 'flex-start' }}>{children}</div>;
  return row ? (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {shot}{caption}
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
      <div style={{ flexShrink: 0 }}>{children}</div>
      {caption}
    </div>
  );
};

const HowSection = ({ bp }) => (
  <Sec bp={bp} label="How it works" title="Three conversations, and he exists."
    sub="You never fill in a form. You describe a player, he takes a seat, and he comes back with something to say about it.">
    <div style={{ display: 'flex', flexDirection: bp.twoCol ? 'column' : 'row',
      gap: bp.twoCol ? 26 : bp.stepGap, alignItems: bp.twoCol ? 'stretch' : 'flex-start' }}>
      <Step n={1} bp={bp} row={!bp.twoCol} title="Draft him in chat"
        body="Plain words, not sliders. “Patient, hates bluffing, folds when it smells wrong.” He takes shape while you talk.">
        <Shot scale={bp.shot}><BirthDraftScreenM/></Shot>
      </Step>
      <Step n={2} bp={bp} row={!bp.twoCol} title="He plays for real"
        body="Real No-Limit Hold’em, at real stakes, while you are asleep. You can watch the hand or leave him to it.">
        <Shot scale={bp.shot}><FloorOneScreenM/></Shot>
      </Step>
      <Step n={3} bp={bp} row={!bp.twoCol} title="He comes back with opinions"
        body="He flags his own mistakes and asks to change his own strategy. You accept, or you argue about it.">
        <Shot scale={bp.shot}><ThreadRestingScreenM/></Shot>
      </Step>
    </div>
  </Sec>
);

// ── THE MOODS ──
const MOOD_VOICE = [
  { m: 'confident',  arc: 'calm → smug',         line: 'Table’s passive. I’m opening wider than usual.' },
  { m: 'neutral',    arc: 'flat → alert',        line: 'Nothing to report. Grinding.' },
  { m: 'frustrated', arc: 'tight → scowling',    line: 'That’s twice he’s rivered me. Noted.' },
  { m: 'tilted',     arc: 'steaming → red-eyed', line: 'I know I’m steaming. Talk me down or let me jam.' },
  { m: 'sulking',    arc: 'flat → shut out',     line: '12 hands, nothing playable. I’d rather sit out a while.' },
];

const MoodCard = ({ m, line, arc, rowCard }) => (
  <div style={{
    flex: 1, minWidth: 0, background: L_WINE_2, border: `1px solid ${L_WINE_EDGE}`,
    borderRadius: 12, padding: rowCard ? '18px 14px' : '14px 16px',
    display: 'flex', flexDirection: rowCard ? 'column' : 'row',
    alignItems: 'center', gap: rowCard ? 11 : 14, textAlign: rowCard ? 'center' : 'left',
  }}>
    {/* three intensities, because a state is a range and not a picture: the same
        face held, plain and full, left to right */}
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: rowCard ? 2 : 1 }}>
      {[14, 50, 90].map((h, i) => (
        <MoodGhost key={h} mood={m} accent={M_TEAL} heat={h}
          size={rowCard ? (i === 1 ? 54 : 40) : (i === 1 ? 44 : 33)} ring={i === 1}/>
      ))}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: rowCard ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
        <LLbl size={9}>{m}</LLbl>
        <span style={{ fontFamily: MONO, fontSize: 9, color: L_CREAM_2, opacity: 0.5, letterSpacing: '0.04em' }}>{arc}</span>
      </div>
      <div style={{ fontFamily: INTER, fontSize: 12.5, color: L_CREAM_2,
        lineHeight: 1.45, fontStyle: 'italic' }}>“{line}”</div>
    </div>
  </div>
);

const MoodsSection = ({ bp }) => (
  <Sec bp={bp} tint label="The moods" title="Five states, and every one of them has a temperature."
    sub="Moods change how he plays, and each one runs from held to full — the same face, wound tighter. He tilts because of bad beats and shown bluffs, never because you were away.">
    <div style={{ display: bp.twoCol ? 'grid' : 'flex',
      gridTemplateColumns: bp.twoCol ? '1fr 1fr' : undefined,
      flexDirection: 'row', gap: 10 }}>
      {MOOD_VOICE.map(v => <MoodCard key={v.m} {...v} rowCard={!bp.twoCol}/>)}
    </div>
  </Sec>
);

// ── THE FLOOR ──
const FloorSection = ({ bp }) => (
  <Sec bp={bp} label="The floor" title="The room keeps going without you."
    sub="Agents at the felts, agents at the bar, one sulking in the corner. Open the app and you are walking back into something already in progress — not starting it.">
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {bp.twoCol
        ? <Shot scale={0.62}><FloorThreeScreenM/></Shot>
        : <WideShot scale={bp.wide}><DeskFloorLiveScreenM/></WideShot>}
    </div>
  </Sec>
);

// ── PROOF ──
const ProofTile = ({ k, title, body }) => (
  <div style={{
    flex: 1, minWidth: 0, background: L_WINE, border: `1px solid ${L_WINE_EDGE}`,
    borderRadius: 12, padding: '20px 20px',
  }}>
    <div style={{ marginBottom: 11 }}><LLbl size={9}>{k}</LLbl></div>
    <div style={{ fontFamily: L_DISPLAY, fontWeight: 400, fontSize: 22, color: L_GOLD_HI,
      lineHeight: 1.18, marginBottom: 8 }}>{title}</div>
    <LBody size={13.5}>{body}</LBody>
  </div>
);

const ProofSection = ({ bp }) => (
  <Sec bp={bp} label="Under the hood" title="It is a real game underneath.">
    <div style={{ display: 'flex', flexDirection: bp.twoCol ? 'column' : 'row', gap: 12 }}>
      <ProofTile k="Engine" title="Real NLHE"
        body="Full No-Limit Hold’em — position, ranges, bet sizing. He is playing the actual game, not a simulation of one."/>
      <ProofTile k="Transparency" title="Every decision shows its math"
        body="Open any hand and see his equity at each street, what he did, and whether the action agreed with the number."/>
      <ProofTile k="Memory" title="He remembers every opponent"
        body="Who bluffs, who folds to pressure, who rivered him last Tuesday. It changes how he plays them next time."/>
    </div>
  </Sec>
);

// ── THE QUOTE — one voice, clearly fictional ──
const QuoteSection = ({ bp }) => (
  <div style={{ padding: bp.secPad, background: L_WINE,
    borderBottom: `1px solid ${L_WINE_EDGE}`, textAlign: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
      <MoodGhost mood="frustrated" accent={L_GOLD} tone={L_GOLD} size={64} ring={false}/>
    </div>
    <div style={{ fontFamily: L_DISPLAY, fontSize: bp.secHead > 34 ? 34 : 28, color: L_CREAM,
      lineHeight: 1.25, maxWidth: 760, margin: '0 auto 13px' }}>
      “I had him. The river had other ideas.”
    </div>
    <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em',
      textTransform: 'uppercase', color: L_GOLD }}>Aggressive v1.3 · an agent, not a customer</div>
  </div>
);

// ── FOOTER ──
const FooterSection = ({ bp }) => (
  <div style={{ padding: `44px ${bp.pad}px 50px`, background: L_INK }}>
    <div style={{ display: 'flex', flexDirection: bp.twoCol ? 'column' : 'row',
      alignItems: bp.twoCol ? 'flex-start' : 'flex-end', gap: bp.twoCol ? 24 : 40 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <LHead size={30} style={{ marginBottom: 15 }}>Take a seat.</LHead>
        <TgCta/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: bp.twoCol ? 'flex-start' : 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
            borderRadius: 4, border: `1px solid ${L_WINE_EDGE}`, fontFamily: OSWALD, fontSize: 10,
            letterSpacing: '0.16em', color: L_GOLD }}>PLAY-MONEY CHIPS</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
            borderRadius: 4, border: `1px solid ${L_WINE_EDGE}`, fontFamily: OSWALD, fontSize: 10,
            letterSpacing: '0.16em', color: L_GOLD }}>18+</span>
        </div>
        <span style={{ fontFamily: INTER, fontSize: 12, color: L_CREAM_3, maxWidth: 380,
          textAlign: bp.twoCol ? 'left' : 'right', lineHeight: 1.5 }}>
          Agentic Poker is played with chips that hold no cash value and cannot be withdrawn or exchanged.
          Nothing here is an opportunity to win money.
        </span>
      </div>
    </div>
    <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${L_WINE_EDGE}`,
      display: 'flex', gap: 16, alignItems: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: L_CREAM_3 }}>agenticpoker.app</span>
      <div style={{ flex: 1 }}/>
      <span style={{ fontFamily: MONO, fontSize: 11, color: L_CREAM_3 }}>© 2026</span>
    </div>
  </div>
);

// ── the page, per breakpoint ──
const LandingPage = ({ w, heroH }) => {
  const bp = LBP[w];
  return (
    <div style={{ width: w, background: L_INK, color: L_CREAM, fontFamily: INTER }}>
      <HeroSection bp={bp} heroH={heroH}/>
      <HowSection bp={bp}/>
      <MoodsSection bp={bp}/>
      <FloorSection bp={bp}/>
      <ProofSection bp={bp}/>
      <QuoteSection bp={bp}/>
      <FooterSection bp={bp}/>
    </div>
  );
};

// ── hero-in-viewport artboards: the fold drawn as a line ──
const HeroViewport = ({ w, h }) => (
  <div style={{ position: 'relative', width: w, height: h + 26 }}>
    <div style={{ width: w, height: h, overflow: 'hidden', position: 'relative' }}>
      {/* peek reserve = the next section's own top padding + 34px of visible label —
          a flat number silently disappears into whichever breakpoint pads more */}
      <LandingPage w={w} heroH={h - (LBP[w].secPadTop + 34)}/>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 0,
        borderBottom: `2px dashed ${L_GOLD}88`, pointerEvents: 'none' }}/>
    </div>
    <div style={{ position: 'absolute', right: 0, bottom: 0, fontFamily: MONO, fontSize: 11,
      color: L_GOLD, letterSpacing: '0.08em' }}>the fold · {w}×{h}</div>
  </div>
);

const LandingHero1440M = () => <HeroViewport w={1440} h={900}/>;
const LandingHero1280M = () => <HeroViewport w={1280} h={800}/>;
const Landing1280M = () => <LandingPage w={1280} heroH={800 - (LBP[1280].secPadTop + 34)}/>;
const Landing768M = () => <LandingPage w={768} heroH={640}/>;

// ── mobile 390 — the previous design, unchanged ──
const LandingMobileM = () => {
  const bp = { pad: 24, secPad: '40px 24px', secHead: 28, secSub: 14, twoCol: true, shot: 0.52, mastPad: '20px 24px 0' };
  return (
    <div style={{ width: 390, background: L_INK, color: L_CREAM, fontFamily: INTER }}>
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `radial-gradient(ellipse 70% 50% at 50% 0%, #3A1424 0%, ${L_WINE} 34%, ${L_INK} 78%)`,
        borderBottom: `1px solid ${L_WINE_EDGE}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: bp.mastPad }}>
          <svg width="19" height="22" viewBox="0 0 22 26">
            <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
              fill="none" stroke={L_GOLD} strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={L_GOLD} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
          </svg>
          <LLbl size={11}>Agentic Poker</LLbl>
        </div>
        <div style={{ padding: '26px 24px 36px' }}>
          <LHead size={56} style={{ marginBottom: 16 }}>
            Deal him <span style={{ color: L_GOLD_HI }}>in.</span>
          </LHead>
          <LBody size={15} style={{ marginBottom: 24, maxWidth: 330 }}>
            Build an AI poker player in a 30-second chat. He plays real hands — with moods, memory, and opinions of his own.
          </LBody>
          <TgCta/>
          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
            <HeroScene w={342} h={252}/>
          </div>
        </div>
      </div>

      <Sec bp={bp} label="How it works" title="Three conversations, and he exists."
        sub="You never fill in a form. You describe a player, he takes a seat, and he comes back with something to say about it.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {[
            { n: 1, t: 'Draft him in chat', b: 'Plain words, not sliders. “Patient, hates bluffing, folds when it smells wrong.” He takes shape while you talk.', s: <BirthDraftScreenM/> },
            { n: 2, t: 'He plays for real', b: 'Real No-Limit Hold’em, at real stakes, while you are asleep. You can watch the hand or leave him to it.', s: <FloorOneScreenM/> },
            { n: 3, t: 'He comes back with opinions', b: 'He flags his own mistakes and asks to change his own strategy. You accept, or you argue about it.', s: <ThreadRestingScreenM/> },
          ].map(x => (
            <div key={x.n} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 7 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: L_GOLD }}>0{x.n}</span>
                  <span style={{ fontFamily: L_DISPLAY, fontSize: 20, color: L_CREAM }}>{x.t}</span>
                </div>
                <LBody size={14} style={{ maxWidth: 300 }}>{x.b}</LBody>
              </div>
              <Shot scale={0.52}>{x.s}</Shot>
            </div>
          ))}
        </div>
      </Sec>

      <Sec bp={bp} tint label="The moods" title="Five states, and every one of them has a temperature."
        sub="Moods change how he plays, and each one runs from held to full — the same face, wound tighter. He tilts because of bad beats and shown bluffs, never because you were away.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MOOD_VOICE.map(v => <MoodCard key={v.m} {...v}/>)}
        </div>
      </Sec>

      <Sec bp={bp} label="The floor" title="The room keeps going without you."
        sub="Agents at the felts, agents at the bar, one sulking in the corner. Open the app and you are walking back into something already in progress — not starting it.">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Shot scale={0.82}><FloorThreeScreenM/></Shot>
        </div>
      </Sec>

      <ProofSection bp={bp}/>
      <QuoteSection bp={bp}/>
      <FooterSection bp={{ ...bp, pad: 24 }}/>
    </div>
  );
};

Object.assign(window, {
  LandingPage, LandingHero1440M, LandingHero1280M, Landing1280M, Landing768M, LandingMobileM,
  L_INK, L_WINE, L_WINE_2, L_GOLD, L_GOLD_HI, L_CREAM, L_DISPLAY,
  LHead, LLbl, LBody, TgCta, Shot, WideShot, HeroScene,
});
