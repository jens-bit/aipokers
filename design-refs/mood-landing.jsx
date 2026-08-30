// agenticpoker.app — the marketing surface.
// Burgundy and gold territory. The product's black-and-teal appears ONLY inside device
// frames, and those frames hold real product components, not redrawn approximations —
// a screenshot that drifts from the build is a lie with a long tail.

const L_INK      = '#150710';   // deep burgundy-black ground
const L_WINE     = '#2A0E18';   // burgundy panel
const L_WINE_2   = '#3A1424';   // raised burgundy
const L_WINE_EDGE= 'rgba(205,179,128,0.16)';
const L_GOLD     = '#CDB380';
const L_GOLD_HI  = '#E8D5A8';
const L_CREAM    = '#F4EBDD';
const L_CREAM_2  = 'rgba(244,235,221,0.72)';
const L_CREAM_3  = 'rgba(244,235,221,0.44)';
// Marketing display face: Rozha One — a fat-face didone cut in one heavy weight, no
// italic. A vintage poker-poster voice, nowhere near the generated-page serif set.
// Emphasis is carried by GOLD, never by a synthesized italic slant.
const L_DISPLAY  = '"Rozha One", Georgia, serif';

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

// ── the Telegram CTA ──
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

// ── a real product screen, shown at marketing scale ──
// The frame is the iOS bezel the product already uses; the contents are the shipped
// components. Nothing here is a mock-up of a mock-up.
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

// a wide product shot, matted like a framed print rather than a phone
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

// ═══ 1 · HERO — a lone ghost at a felt, under one light ═══
// The ghost is the product's own atom, lit gold instead of teal: marketing territory,
// product anatomy. The felt is drawn here, not borrowed — this is a poster, not a screen.
const HeroScene = ({ w = 560, h = 400 }) => (
  <div style={{ position: 'relative', width: w, height: h, flexShrink: 0 }}>
    {/* the spotlight cone */}
    <div style={{
      position: 'absolute', left: '50%', top: -40, width: w * 0.86, height: h * 0.96,
      transform: 'translateX(-50%)', pointerEvents: 'none',
      background: `radial-gradient(ellipse 50% 60% at 50% 26%, rgba(232,213,168,0.16), rgba(232,213,168,0.05) 42%, transparent 72%)`,
    }}/>
    {/* felt */}
    <div style={{
      position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)',
      width: w * 0.82, height: h * 0.42, borderRadius: '50%',
      background: `radial-gradient(ellipse at 50% 34%, #43182A 0%, #2C0F1C 58%, #1E0A14 100%)`,
      border: `1px solid rgba(205,179,128,0.22)`,
      boxShadow: `inset 0 0 60px rgba(0,0,0,0.6), 0 0 0 9px #1B0912, 0 0 0 10px rgba(205,179,128,0.14), 0 24px 60px rgba(0,0,0,0.6)`,
    }}>
      <div style={{ position: 'absolute', inset: 16, borderRadius: '50%', border: `1px solid rgba(205,179,128,0.10)` }}/>
    </div>
    {/* his cards, fanned on the rail */}
    <div style={{ position: 'absolute', left: '50%', bottom: h * 0.30, transform: 'translateX(-50%)', display: 'flex', zIndex: 3 }}>
      <div style={{ transform: 'rotate(-9deg) translateX(7px)' }}><PlayingCard rank="A" suit="s" w={52} h={72}/></div>
      <div style={{ transform: 'rotate(9deg) translateX(-7px)' }}><PlayingCard rank="K" suit="h" w={52} h={72}/></div>
    </div>
    {/* the ghost, seated */}
    <div style={{ position: 'absolute', left: '50%', bottom: h * 0.36, transform: 'translateX(-50%)', zIndex: 2 }}>
      <MoodGhost mood="confident" accent={L_GOLD} tone={L_GOLD} size={132} ring={false}/>
    </div>
  </div>
);

const HeroSection = ({ mobile }) => (
  <div style={{
    position: 'relative', overflow: 'hidden',
    background: `radial-gradient(ellipse 70% 50% at 50% 0%, #3A1424 0%, ${L_WINE} 34%, ${L_INK} 78%)`,
    borderBottom: `1px solid ${L_WINE_EDGE}`,
  }}>
    {/* masthead */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: mobile ? '20px 24px 0' : '30px 72px 0',
    }}>
      <svg width="19" height="22" viewBox="0 0 22 26">
        <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
          fill="none" stroke={L_GOLD} strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={L_GOLD} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
      <LLbl size={11}>Agentic Poker</LLbl>
      <div style={{ flex: 1 }}/>
      {!mobile && <span style={{ fontFamily: MONO, fontSize: 12, color: L_CREAM_3 }}>agenticpoker.app</span>}
    </div>

    {mobile ? (
      <div style={{ padding: '28px 24px 40px' }}>
        <LHead size={62} style={{ marginBottom: 16 }}>
          Deal him <span style={{ color: L_GOLD_HI }}>in.</span>
        </LHead>
        <LBody size={15} style={{ marginBottom: 24, maxWidth: 330 }}>
          Build an AI poker player in a 30-second chat. He plays real hands — with moods, memory, and opinions of his own.
        </LBody>
        <TgCta/>
        <div style={{ marginTop: 30, display: 'flex', justifyContent: 'center' }}>
          <HeroScene w={342} h={252}/>
        </div>
      </div>
    ) : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 40, padding: '54px 72px 76px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <LHead size={104} style={{ marginBottom: 22 }}>
            Deal him <span style={{ color: L_GOLD_HI }}>in.</span>
          </LHead>
          <LBody size={19} style={{ marginBottom: 34, maxWidth: 440 }}>
            Build an AI poker player in a 30-second chat. He plays real hands — with moods, memory, and opinions of his own.
          </LBody>
          <TgCta big/>
        </div>
        <HeroScene w={560} h={400}/>
      </div>
    )}
  </div>
);

// ═══ section chrome ═══
const Sec = ({ label, title, sub, mobile, children, tint }) => (
  <div style={{
    padding: mobile ? '44px 24px' : '76px 72px',
    background: tint ? L_WINE : L_INK,
    borderBottom: `1px solid ${L_WINE_EDGE}`,
  }}>
    <LLbl>{label}</LLbl>
    <LHead size={mobile ? 28 : 40} style={{ marginTop: 12, marginBottom: sub ? 12 : 26 }}>{title}</LHead>
    {sub && <LBody size={mobile ? 14 : 17} style={{ marginBottom: 30, maxWidth: 620 }}>{sub}</LBody>}
    {children}
  </div>
);

// ═══ 2 · HOW IT WORKS ═══
const Step = ({ n, title, body, mobile, children }) => {
  const caption = (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 7 }}>
        <span style={{ fontFamily: MONO, fontSize: 12, color: L_GOLD }}>0{n}</span>
        <span style={{ fontFamily: L_DISPLAY, fontWeight: 400, fontSize: mobile ? 20 : 22, color: L_CREAM }}>{title}</span>
      </div>
      <LBody size={14} style={{ maxWidth: 300 }}>{body}</LBody>
    </div>
  );
  const shot = <div style={{ display: 'flex', justifyContent: mobile ? 'flex-start' : 'center' }}>{children}</div>;
  /* stacked, a caption between two phones pairs with the wrong one — so on mobile the
     words come first and the shot follows them */
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {mobile ? caption : shot}
      {mobile ? shot : caption}
    </div>
  );
};

const HowSection = ({ mobile }) => (
  <Sec mobile={mobile} label="How it works" title="Three conversations, and he exists."
    sub="You never fill in a form. You describe a player, he takes a seat, and he comes back with something to say about it.">
    <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 36 : 34, alignItems: 'flex-start' }}>
      <Step n={1} mobile={mobile} title="Draft him in chat"
        body="Plain words, not sliders. “Patient, hates bluffing, folds when it smells wrong.” He takes shape while you talk.">
        <Shot scale={mobile ? 0.52 : 0.46}><BirthDraftScreenM/></Shot>
      </Step>
      <Step n={2} mobile={mobile} title="He plays for real"
        body="Real No-Limit Hold’em, at real stakes, while you are asleep. You can watch the hand or leave him to it.">
        <Shot scale={mobile ? 0.52 : 0.46}><FloorOneScreenM/></Shot>
      </Step>
      <Step n={3} mobile={mobile} title="He comes back with opinions"
        body="He flags his own mistakes and asks to change his own strategy. You accept, or you argue about it.">
        <Shot scale={mobile ? 0.52 : 0.46}><ThreadRestingScreenM/></Shot>
      </Step>
    </div>
  </Sec>
);

// ═══ 3 · THE MOODS ═══
const MOOD_VOICE = [
  { m: 'confident',  line: 'Table’s passive. I’m opening wider than usual.' },
  { m: 'neutral',    line: 'Nothing to report. Grinding.' },
  { m: 'frustrated', line: 'That’s twice he’s rivered me. Noted.' },
  { m: 'tilted',     line: 'I know I’m steaming. Talk me down or let me jam.' },
  { m: 'sulking',    line: '12 hands, nothing playable. I’d rather sit out a while.' },
];

const MoodCard = ({ m, line, mobile }) => (
  <div style={{
    flex: 1, minWidth: 0, background: L_WINE_2, border: `1px solid ${L_WINE_EDGE}`,
    borderRadius: 12, padding: mobile ? '16px 16px' : '20px 16px',
    display: 'flex', flexDirection: mobile ? 'row' : 'column',
    alignItems: 'center', gap: mobile ? 14 : 12, textAlign: mobile ? 'left' : 'center',
  }}>
    <div style={{ flexShrink: 0 }}>
      <MoodGhost mood={m} accent={M_TEAL} size={mobile ? 44 : 58}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 6 }}><LLbl size={9}>{m}</LLbl></div>
      <div style={{ fontFamily: INTER, fontSize: mobile ? 12.5 : 13, color: L_CREAM_2,
        lineHeight: 1.45, fontStyle: 'italic' }}>“{line}”</div>
    </div>
  </div>
);

const MoodsSection = ({ mobile }) => (
  <Sec mobile={mobile} tint label="The moods" title="Five states, and he means all of them."
    sub="Moods are real: they change how he plays, and you can talk him down. He tilts because of bad beats and shown bluffs — never because you were away.">
    <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 10 }}>
      {MOOD_VOICE.map(v => <MoodCard key={v.m} {...v} mobile={mobile}/>)}
    </div>
  </Sec>
);

// ═══ 4 · THE FLOOR ═══
const FloorSection = ({ mobile }) => (
  <Sec mobile={mobile} label="The floor" title="The room keeps going without you."
    sub="Agents at the felts, agents at the bar, one sulking in the corner. Open the app and you are walking back into something already in progress — not starting it.">
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      {mobile
        ? <Shot scale={0.82}><FloorThreeScreenM/></Shot>
        : <WideShot scale={0.79}><DeskFloorLiveScreenM/></WideShot>}
    </div>
  </Sec>
);

// ═══ 5 · PROOF ═══
const ProofTile = ({ k, title, body, mobile }) => (
  <div style={{
    flex: 1, minWidth: 0, background: L_WINE, border: `1px solid ${L_WINE_EDGE}`,
    borderRadius: 12, padding: mobile ? '18px 18px' : '24px 22px',
  }}>
    <div style={{ marginBottom: 12 }}><LLbl size={9}>{k}</LLbl></div>
    <div style={{ fontFamily: L_DISPLAY, fontWeight: 400, fontSize: mobile ? 20 : 24, color: L_GOLD_HI,
      lineHeight: 1.18, marginBottom: 9 }}>{title}</div>
    <LBody size={13.5}>{body}</LBody>
  </div>
);

const ProofSection = ({ mobile }) => (
  <Sec mobile={mobile} label="Under the hood" title="It is a real game underneath.">
    <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 12 }}>
      <ProofTile mobile={mobile} k="Engine" title="Real NLHE"
        body="Full No-Limit Hold’em — position, ranges, bet sizing. He is playing the actual game, not a simulation of one."/>
      <ProofTile mobile={mobile} k="Transparency" title="Every decision shows its math"
        body="Open any hand and see his equity at each street, what he did, and whether the action agreed with the number."/>
      <ProofTile mobile={mobile} k="Memory" title="He remembers every opponent"
        body="Who bluffs, who folds to pressure, who rivered him last Tuesday. It changes how he plays them next time."/>
    </div>
  </Sec>
);

// ═══ 5b · THE QUOTE — one voice, clearly fictional ═══
// The no-testimonials law holds: this is an AGENT speaking, named as one, with a mood
// chip — the one kind of endorsement this product can honestly print.
const QuoteSection = ({ mobile }) => (
  <div style={{ padding: mobile ? '46px 24px' : '84px 72px', background: L_WINE,
    borderBottom: `1px solid ${L_WINE_EDGE}`, textAlign: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
      <MoodGhost mood="frustrated" accent={L_GOLD} tone={L_GOLD} size={mobile ? 56 : 72} ring={false}/>
    </div>
    <div style={{ fontFamily: L_DISPLAY, fontSize: mobile ? 24 : 38, color: L_CREAM,
      lineHeight: 1.25, maxWidth: 760, margin: '0 auto 14px' }}>
      “I had him. The river had other ideas.”
    </div>
    <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 500, letterSpacing: '0.24em',
      textTransform: 'uppercase', color: L_GOLD }}>Aggressive v1.3 · an agent, not a customer</div>
  </div>
);

// ═══ 6 · FOOTER ═══
const FooterSection = ({ mobile }) => (
  <div style={{ padding: mobile ? '36px 24px 44px' : '54px 72px 62px', background: L_INK }}>
    <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row',
      alignItems: mobile ? 'flex-start' : 'flex-end', gap: mobile ? 26 : 40 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <LHead size={mobile ? 25 : 33} style={{ marginBottom: 16 }}>Take a seat.</LHead>
        <TgCta/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: mobile ? 'flex-start' : 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
            borderRadius: 4, border: `1px solid ${L_WINE_EDGE}`, fontFamily: OSWALD, fontSize: 10,
            letterSpacing: '0.16em', color: L_GOLD }}>PLAY-MONEY CHIPS</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
            borderRadius: 4, border: `1px solid ${L_WINE_EDGE}`, fontFamily: OSWALD, fontSize: 10,
            letterSpacing: '0.16em', color: L_GOLD }}>18+</span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: L_CREAM_3 }}>@agenticpoker_bot</span>
        <span style={{ fontFamily: INTER, fontSize: 12, color: L_CREAM_3, maxWidth: 380,
          textAlign: mobile ? 'left' : 'right', lineHeight: 1.5 }}>
          Agentic Poker is played with chips that hold no cash value and cannot be withdrawn or exchanged.
          Nothing here is an opportunity to win money.
        </span>
      </div>
    </div>
    <div style={{ marginTop: 26, paddingTop: 18, borderTop: `1px solid ${L_WINE_EDGE}`,
      display: 'flex', gap: 16, alignItems: 'center' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, color: L_CREAM_3 }}>agenticpoker.app</span>
      <div style={{ flex: 1 }}/>
      <span style={{ fontFamily: MONO, fontSize: 11, color: L_CREAM_3 }}>© 2026</span>
    </div>
  </div>
);

// ═══ the two artboards ═══
const LandingDesktopM = () => (
  <div style={{ width: 1440, background: L_INK, color: L_CREAM, fontFamily: INTER }}>
    <HeroSection/>
    <HowSection/>
    <MoodsSection/>
    <FloorSection/>
    <ProofSection/>
    <QuoteSection/>
    <FooterSection/>
  </div>
);

const LandingMobileM = () => (
  <div style={{ width: 390, background: L_INK, color: L_CREAM, fontFamily: INTER }}>
    <HeroSection mobile/>
    <HowSection mobile/>
    <MoodsSection mobile/>
    <FloorSection mobile/>
    <ProofSection mobile/>
    <QuoteSection mobile/>
    <FooterSection mobile/>
  </div>
);

Object.assign(window, {
  LandingDesktopM, LandingMobileM,
  L_INK, L_WINE, L_WINE_2, L_GOLD, L_GOLD_HI, L_CREAM, L_DISPLAY,
  LHead, LLbl, LBody, TgCta, Shot, WideShot, HeroScene,
});
