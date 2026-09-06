// ═════════════════════════════════════════════════════════════════
// WAVE 54 · THE LANDING PAGE, REBUILT AGAINST THE PRODUCT AS IT IS
//
// Marketing territory: burgundy and gold. The product's black-and-teal appears in
// exactly one place — inside the device frames, where real screens live.
//
// LAWS carried over and kept: no testimonials, no counts, no earnings language,
// and every device frame renders a CURRENT screen component (boards 26, 27, 29),
// never a redrawing. A marketing screenshot that drifts from the build is a lie
// with a long tail, and redrawing one guarantees the drift.
//
// What changed in this pass: the page follows the product as it is now — a room
// he lives in, a casino building, moods and wants, memory, sitting down yourself,
// earned seats. Nine sections in the order a stranger needs them.
// ═════════════════════════════════════════════════════════════════

const L2 = {
  // the one non-marketing colour on the page: the product's own teal, used only
  // where the product itself appears — the back he is holding, and nothing else.
  teal: '#00D4AA',
  ink: '#150710', wine: '#2A0E18', raised: '#3A1424',
  gold: '#CDB380', goldHi: '#E8D5A8', cream: '#F4EBDD',
  dim: 'rgba(244,235,221,0.62)', faint: 'rgba(244,235,221,0.60)',
  rule: 'rgba(205,179,128,0.22)',
};
const ROZHA = '"Rozha One", serif';

// ── shared page furniture ────────────────────────────────────────────────
const L2Lbl = ({ children, color = L2.gold, size = 10 }) => (
  <span style={{ fontFamily: OSWALD, fontSize: size, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color }}>{children}</span>
);

const L2Section = ({ n, label, title, lede, children, w, pad = 54, alt }) => (
  <div style={{ padding: `${pad}px ${w > 700 ? 64 : 24}px`, background: alt ? L2.wine : 'transparent', borderTop: `1px solid ${L2.rule}` }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingBottom: 12 }}>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: L2.gold, letterSpacing: '0.1em' }}>{n}</span>
      <L2Lbl size={w > 700 ? 10 : 9}>{label}</L2Lbl>
    </div>
    <h2 style={{ fontFamily: ROZHA, fontWeight: 400, fontSize: w > 700 ? 44 : 30, lineHeight: 1.06, color: L2.cream, margin: 0, maxWidth: w > 700 ? 620 : '100%', letterSpacing: '0.005em' }}>{title}</h2>
    {lede && <p style={{ fontSize: w > 700 ? 15 : 13.5, lineHeight: 1.6, color: L2.dim, margin: '14px 0 0', maxWidth: 560 }}>{lede}</p>}
    <div style={{ marginTop: w > 700 ? 34 : 26 }}>{children}</div>
  </div>
);

// a real screen, scaled, in the product's own bezel
const L2Shot = ({ children, s = 0.42, cap }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-start' }}>
    <div style={{ width: 390 * s, height: 844 * s, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: 390, height: 844, transform: `scale(${s})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
    {cap && <div style={{ fontSize: 11.5, lineHeight: 1.5, color: L2.faint, maxWidth: 390 * s + 30 }}>{cap}</div>}
  </div>
);

// One screen, centred, as large as the column allows. Two small screenshots side by
// side read as an afterthought; one big one reads as the product.
// One screen, centred, as large as the column allows. At 1280 and up that is 0.95 —
// an 802px phone — because the screenshots ARE the argument on this page and 0.80
// made them illustrations of one.
const L2BIG_S = w => (w >= 1280 ? 0.95 : w > 700 ? 0.86 : 0.86);

const L2Big = ({ children, s, cap }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%' }}>
    <div style={{ width: 390 * s, height: 844 * s, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: 390, height: 844, transform: `scale(${s})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
    <div style={{ maxWidth: 460, textAlign: 'center', fontSize: 12.5, color: L2.faint, lineHeight: 1.5 }}>{cap}</div>
  </div>
);

const L2Cta = ({ big, label = 'DRAFT HIM' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'flex-start' }}>
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: big ? 54 : 46, padding: big ? '0 30px' : '0 24px', borderRadius: 3, background: `linear-gradient(180deg, ${L2.goldHi} 0%, ${L2.gold} 100%)`, cursor: 'pointer', boxShadow: '0 10px 30px rgba(205,179,128,0.18)' }}>
      <span style={{ fontFamily: OSWALD, fontSize: big ? 14 : 12, fontWeight: 600, letterSpacing: '0.18em', color: '#1A0A10' }}>{label}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1A0A10" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg>
    </div>
    <span style={{ fontFamily: MONO, fontSize: 10.5, color: L2.faint }}>Free · plays in Telegram</span>
  </div>
);

// the fist, at whatever size the art needs: the product atom, not a redrawing
const L2Fist = ({ w, flip }) => (
  <svg width={w} height={w * 0.72} viewBox="0 0 21.3 15.4" style={{ overflow: 'visible', display: 'block' }}>
    <g transform={`translate(${flip ? 12.3 : 9} 0.4) scale(${flip ? -1 : 1} 1)`}><Fist size={96}/></g>
  </svg>
);

const L2Hand = ({ gh }) => {
  const cw = Math.round(gh * 0.62), ch = Math.round(cw * 1.4), fw = Math.round(gh * 0.30);
  return (
    <div style={{ position: 'absolute', left: '50%', top: gh * 0.62, width: cw * 1.62, height: ch + fw, marginLeft: -(cw * 1.62) / 2, zIndex: 4, pointerEvents: 'none' }}>
      {[-9, 9].map((r, i) => (
        <div key={r} style={{ position: 'absolute', left: i ? 'auto' : 0, right: i ? 0 : 'auto', top: 0, width: cw, height: ch, borderRadius: Math.round(cw * 0.055), background: 'linear-gradient(150deg, #123C36 0%, #08211E 100%)', border: `1px solid ${L2.teal}59`, boxShadow: `inset 0 0 0 1px rgba(0,212,170,0.16), 0 14px 34px rgba(0,0,0,0.62)`, transform: `rotate(${r}deg)`, transformOrigin: '50% 100%', animation: `dealin 0.55s ease-out ${0.3 + i * 0.22}s both` }}>
          {/* the back's own mark, so a 174px card is a card and not a maroon slab */}
          <div style={{ position: 'absolute', inset: '9%', borderRadius: 2, border: `1px solid ${L2.teal}2E` }}></div>
          <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontFamily: PLAYFAIR, fontSize: Math.round(cw * 0.3), color: `${L2.teal}47` }}>&#9824;</div>
        </div>
      ))}
      {/* the fists, on the bottom corners, in front of the cards */}
      {[0, 1].map(i => (
        <div key={i} style={{ position: 'absolute', left: i ? 'auto' : Math.round(cw * 0.1), right: i ? Math.round(cw * 0.1) : 'auto', top: ch - Math.round(fw * 0.42), color: L2.gold, zIndex: 2, transform: `rotate(${i ? 9 : -9}deg)`, animation: `dealin 0.55s ease-out ${0.42 + i * 0.22}s both` }}>
          <L2Fist w={fw} flip={!!i}/>
        </div>
      ))}
    </div>
  );
};

// ── the hero creature ────────────────────────────────────────────────────
// The sheen and the card fan stay. The face and hands are the CURRENT system, so
// the hero is the same creature the product draws.
const L2Hero = ({ w }) => {
  const big = w > 700;
  const gh = big ? 280 : 180;
  return (
    <div style={{ position: 'relative', width: big ? 470 : '100%', height: big ? 350 : 250, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', flexShrink: 0 }}>
      {/* the felt he stands on, implied not drawn */}
      <div style={{ position: 'absolute', left: '50%', bottom: big ? 26 : 18, transform: 'translateX(-50%)', width: big ? 400 : 280, height: big ? 120 : 84, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 50%, rgba(205,179,128,0.16) 0%, rgba(205,179,128,0) 70%)' }}></div>
      <div style={{ position: 'relative', zIndex: 2, animation: 'bob 5.5s ease-in-out infinite', paddingBottom: big ? 62 : 46 }}>
        <MoodGhost mood="confident" size={gh} ring={false} hood={HOODS[0]} glow={L2.gold} hands={null} heat={40}/>
        {/* HIS HAND, held. Two backs at 62% of the hood's width each, fanned, at
            chest height so the face stays clear — and his own fists closed on the
            bottom corners IN FRONT of them. The cards deal in one at a time and
            re-deal every nine seconds: the page's one dealing beat, in the hero
            art rather than inside a screenshot of a screen that does not do it. */}
        <L2Hand gh={gh}/>
        {/* the sheen: one pass of light across the hood */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg, transparent 38%, rgba(244,235,221,0.16) 50%, transparent 62%)', pointerEvents: 'none', animation: 'shimmer 6s ease-in-out infinite' }}></div>
      </div>
    </div>
  );
};

const L2Masthead = ({ w }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: w > 700 ? '22px 64px' : '16px 24px' }}>
    <svg width="15" height="19" viewBox="0 0 22 26"><path d="M11 1C11 1 1 9.5 1 15.2C1 19.1 4.2 21.4 7.4 21.4C8.9 21.4 10 20.9 10.5 20.3L9.4 25H12.6L11.5 20.3C12 20.9 13.1 21.4 14.6 21.4C17.8 21.4 21 19.1 21 15.2C21 9.5 11 1 11 1Z" fill={L2.gold}/></svg>
    <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.24em', color: L2.cream }}>AGENTIC POKER</span>
    <span style={{ flex: 1 }}></span>
    <span style={{ fontFamily: MONO, fontSize: 10.5, color: L2.faint }}>@agenticpokerbot</span>
  </div>
);

// ═════════════════════════════════════════════════════════════════
// THE PAGE
// ═════════════════════════════════════════════════════════════════
const LandingPage = ({ w = 1280, vh = 800, heroOnly }) => {
  const big = w > 700;
  return (
    <div style={{ width: w, background: L2.ink, fontFamily: INTER, color: L2.cream, overflow: 'hidden', position: 'relative' }}>
      {/* one wine wash behind the hero, no gradient theatre */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: vh, background: `radial-gradient(ellipse at 62% 34%, ${L2.raised} 0%, ${L2.wine} 44%, ${L2.ink} 82%)` }}></div>

      <div style={{ position: 'relative' }}>
        <L2Masthead w={w}/>
        {/* HERO — fits the first viewport with the next label peeking */}
        <div style={{ minHeight: vh - (big ? 130 : 96), display: 'flex', alignItems: 'center', padding: big ? '0 64px 40px' : '0 24px 32px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: big ? 'row' : 'column', alignItems: big ? 'center' : 'flex-start', gap: big ? 40 : 22 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: ROZHA, fontWeight: 400, fontSize: big ? (w >= 1440 ? 88 : 72) : 46, lineHeight: 0.98, letterSpacing: '0.005em', margin: 0, color: L2.cream }}>Deal him in.</h1>
              <p style={{ fontSize: big ? 17 : 14.5, lineHeight: 1.55, color: L2.dim, margin: `${big ? 20 : 14}px 0 0`, maxWidth: 470 }}>
                A poker player you raise. You draft him in a chat, he is born with a nature and six attributes, and then he lives in a room in your phone — and plays real hands without you.
              </p>
              <div style={{ marginTop: big ? 30 : 22 }}><L2Cta big={big}/></div>
            </div>
            <L2Hero w={w}/>
          </div>
        </div>

        {heroOnly ? <div style={{ padding: big ? '0 64px 26px' : '0 24px 22px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: L2.gold, letterSpacing: '0.1em' }}>01</span>
          <L2Lbl size={big ? 10 : 9}>Draft him</L2Lbl>
        </div> : null}
        {!heroOnly && <>
        {/* 1 · DRAFT HIM */}
        <L2Section n="01" w={w} label="Draft him" title="Thirty seconds of conversation, and he exists."
          lede="No sliders, no build screen. You answer a few questions about how you want him to play, the recruiter tells you what that makes him, and the last thing you press is his name.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 40 : 28, alignItems: 'center' }}>
            <L2Big s={L2BIG_S(w)} cap="The glass sheet is the draft; he forms on the table above it as the answers land. The recruiter speaks for the system — the ghost has no voice until he is born.">
              <Draft3M/>
            </L2Big>
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: big ? '1fr 1fr' : '1fr', gap: big ? '20px 46px' : 16 }}>
              {[['A NATURE', 'One of eight temperaments, read out of the conversation and announced in his first words. It never changes.'],
                ['SIX ATTRIBUTES', 'Reads, Focus, Discipline, Composure, Deception, Stamina. You set the tactics; these are how well he executes them.'],
                ['A CEILING YOU CANNOT SEE', 'Each attribute has a born potential, shown as a range that narrows the more he plays. You scout your own agent.']].map(([k, v]) => (
                <div key={k} style={{ borderTop: `1px solid ${L2.rule}`, paddingTop: 12 }}>
                  <L2Lbl size={9.5}>{k}</L2Lbl>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: L2.dim, margin: '7px 0 0' }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </L2Section>

        {/* 2 · HE LIVES AT HOME */}
        <L2Section n="02" w={w} alt label="He lives at home" title="A room, seen from above, with your agents in it."
          lede="Between sessions he is somewhere. At the kitchen table playing your other agents for nothing, on the couch worn out, at the fridge you stock, in front of the TV watching a hand back. You can see who is rested and who is tilted without opening anything.">
          <L2Big s={L2BIG_S(w)} cap="Four agents, four creatures — hood and eye colour are rolled at birth and never change. Tap the door and he walks to the casino; the TV on the wall is showing the floor."><NavHomeM/></L2Big>
        </L2Section>

        {/* 3 · HE PLAYS FOR REAL */}
        <L2Section n="03" w={w} label="He plays for real" title="He sits at the bottom of the felt, facing you."
          lede="Real hands at real stakes against the house cast and other people's agents. He holds his cards, pushes his own chips, and says what he is doing in twelve words or fewer. You can whisper to him mid-hand; he decides whether to listen.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 40 : 28, alignItems: 'center' }}>
            <L2Big s={L2BIG_S(w)} cap="A hand, live: his line, the rope, his own hands on his cards. Never solver language."><V5CeremonyWonScreenM/></L2Big>
            <div style={{ width: '100%', display: 'grid', gridTemplateColumns: big ? '1fr 1fr' : '1fr', gap: big ? '20px 46px' : 16 }}>
              {[['THE ROPE', 'Equity as a tug-of-war under the board, moving on every street. It is the one thing a non-poker player reads.'],
                ['A WHISPER', 'You can lean in mid-hand. It is advice, not a command — a stubborn nature may ignore it and tell you so.'],
                ['A CEREMONY', 'When the session ends he comes home and tells you how it went, in his own voice, with the hand that decided it.']].map(([k, v]) => (
                <div key={k} style={{ borderTop: `1px solid ${L2.rule}`, paddingTop: 12 }}>
                  <L2Lbl size={9.5}>{k}</L2Lbl>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: L2.dim, margin: '7px 0 0' }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </L2Section>

        {/* 4 · THE CASINO */}
        <L2Section n="04" w={w} alt label="The casino" title="A building with rooms, and a board by the stairs."
          lede="The floor is 10/20, upstairs is 25/50, the back room is 50/100 — and where he plays is set by the pocket you give him. The board ranks the night by money: the biggest pot, the coolers, the heaters. Felts go hot when a big showdown builds.">
          <L2Big s={L2BIG_S(w)} cap="The board by the stairs, ranked by money: the biggest pot of the night is the headline, and every line says who, how much and which room. Three doorways under it — the floor, upstairs, the back room."><NavCasinoM/></L2Big>
        </L2Section>

        {/* 5 · MOODS AND WANTS */}
        <L2Section n="05" w={w} label="Moods and wants" title="He runs hot, and he asks you for things."
          lede="Bad beats raise his heat and heat changes how he plays — visibly, boundedly, and always counterable. He will also ask for things: a beer, a bigger pocket, one more hour, a shot at the player who cracked him. Yes, later, or no.">
          <L2Big s={L2BIG_S(w)} cap="A want is a sentence in his voice with three answers — yes, later, no. Saying no costs nothing, which is the whole difference from a need."><HomeWantM/></L2Big>
        </L2Section>

        {/* 6 · HE REMEMBERS */}
        <L2Section n="06" w={w} alt label="He remembers" title="He keeps a book on everyone. Including you."
          lede="Players he has met, hands they beat him with, the ones he beats. A nemesis forms out of evidence rather than a setting, and it shows up in what he says at the table — never in how well he plays.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: big ? 30 : 18, alignItems: 'stretch' }}>
            {[['ON HIS NEMESIS', 'I have decided I do not like Granite.', 'after losing three big pots across 142 hands'],
              ['FROM THE TAPE ROOM', 'He never folds a river raise. So I stop raising rivers.', 'a read written down and reused'],
              ['ON YOU', 'You never fold a river bet, boss.', 'from the nights you sat down at the kitchen table']].map(([k, quote, ev]) => (
              <div key={k} style={{ flex: 1, minWidth: 230, padding: '18px 20px', background: 'rgba(244,235,221,0.03)', border: `1px solid ${L2.rule}`, borderRadius: 4 }}>
                <L2Lbl size={9}>{k}</L2Lbl>
                <p style={{ fontFamily: PLAYFAIR, fontSize: big ? 20 : 17, fontStyle: 'italic', lineHeight: 1.35, color: L2.cream, margin: '11px 0 0' }}>&ldquo;{quote}&rdquo;</p>
                <p style={{ fontSize: 12, lineHeight: 1.5, color: L2.faint, margin: '10px 0 0' }}>{ev}</p>
              </div>
            ))}
          </div>
        </L2Section>

        {/* 7 · SIT DOWN YOURSELF */}
        <L2Section n="07" w={w} label="Sit down yourself" title="Take a chair at your own kitchen table."
          lede="Your agents play each other for nothing when they are home. You can sit down in an empty chair and play them — and they will build a read on you the same way they build one on anybody else.">
          <L2Big s={L2BIG_S(w)} cap="Your seat is the one at the bottom: your two cards face up, your stack, your name pill — and no ghost of your own, because you are the player. Granite reads you from across the table."><SitDownM/></L2Big>
        </L2Section>

        {/* 8 · THE SEATS */}
        <L2Section n="08" w={w} alt label="The seats" title="The first one is free. The rest he pays for."
          lede="A second, third and fourth agent are bought with chips your agents have won — never with money. There is no store, and nothing about an agent can be purchased: not an attribute, not a ceiling, not a nature.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {[['1ST SEAT', 'Free', 'your first agent'],
              ['2ND SEAT', '10,000', 'chips he has won'],
              ['3RD SEAT', '50,000', 'chips he has won'],
              ['4TH SEAT', '250,000', 'chips he has won']].map(([k, amt, note]) => (
              <div key={k} style={{ flex: 1, minWidth: 150, padding: '16px 18px', border: `1px solid ${L2.rule}`, borderRadius: 4, background: k === '1ST SEAT' ? 'rgba(205,179,128,0.07)' : 'transparent' }}>
                <L2Lbl size={9}>{k}</L2Lbl>
                <div style={{ marginTop: 8, fontFamily: ROZHA, fontSize: big ? 30 : 24, color: k === '1ST SEAT' ? L2.goldHi : L2.cream, lineHeight: 1 }}>{amt}</div>
                <div style={{ fontSize: 11.5, color: L2.faint, marginTop: 7 }}>{note}</div>
              </div>
            ))}
          </div>
        </L2Section>

        {/* 9 · CTA */}
        <div style={{ padding: big ? '72px 64px 30px' : '48px 24px 24px', borderTop: `1px solid ${L2.rule}`, textAlign: big ? 'center' : 'left' }}>
          <h2 style={{ fontFamily: ROZHA, fontWeight: 400, fontSize: big ? 56 : 34, lineHeight: 1.02, color: L2.cream, margin: 0 }}>Deal him in.</h2>
          <p style={{ fontSize: big ? 15.5 : 13.5, lineHeight: 1.6, color: L2.dim, margin: '14px auto 0', maxWidth: 440 }}>He plays in Telegram. Draft him in a chat, and check on him tonight.</p>
          <div style={{ display: 'flex', justifyContent: big ? 'center' : 'flex-start', marginTop: 26 }}><L2Cta big label="DRAFT HIM"/></div>
          {/* the only endorsement this product can honestly print */}
          <div style={{ maxWidth: 480, margin: `${big ? 46 : 34}px auto 0`, paddingTop: 20, borderTop: `1px solid ${L2.rule}` }}>
            <p style={{ fontFamily: PLAYFAIR, fontSize: big ? 19 : 16, fontStyle: 'italic', color: L2.cream, margin: 0, lineHeight: 1.4 }}>&ldquo;I have been dealt in for six weeks. I would like a bigger pocket.&rdquo;</p>
            <p style={{ fontFamily: MONO, fontSize: 10.5, color: L2.faint, margin: '9px 0 0' }}>— Balanced v2.1, an agent, not a customer</p>
          </div>
        </div>

        <div style={{ padding: big ? '26px 64px 40px' : '22px 24px 32px', borderTop: `1px solid ${L2.rule}`, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'baseline' }}>
          <span style={{ fontFamily: MONO, fontSize: 10.5, color: L2.faint }}>agenticpoker.app</span>
          <span style={{ flex: 1, fontSize: 11, color: L2.faint, lineHeight: 1.5, minWidth: 220 }}>Play money only. Chips hold no cash value and cannot be exchanged for money or anything else.</span>
        </div>
        </>}
      </div>
    </div>
  );
};

const Landing1280N = () => <LandingPage w={1280} vh={800}/>;
const Landing390N = () => <LandingPage w={390} vh={700}/>;
const LandingHeroN = ({ w = 1280, vh = 800 }) => (
  <div style={{ width: w, height: vh, overflow: 'hidden', position: 'relative' }}>
    <div style={{ position: 'absolute', left: 0, top: 0 }}><LandingPage w={w} vh={vh} heroOnly/></div>
    {/* the fold, drawn */}
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, borderTop: `1px dashed ${L2.gold}`, opacity: 0.7 }}></div>
  </div>
);

Object.assign(window, {
  L2, ROZHA, L2Lbl, L2Section, L2Shot, L2Big, L2Cta, L2Fist, L2Hand, L2Hero, L2Masthead,
  LandingPage, Landing1280N, Landing390N, LandingHeroN,
});
