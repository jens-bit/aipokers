// ═════════════════════════════════════════════════════════════════
// WAVE 63 · PART A — THE MARK IS THE GHOST AT THE RAIL
//
// Wave 62's birds are all dropped, and so is the magpie: a bird has nothing to
// do with this game. A railbird is the one leaning on the rail watching somebody
// else play — so the mark is the product's own character doing exactly that.
//
// Not traced from the reference: rebuilt from the ghost's own vector parts, so
// the logo IS the character in the product. Hood arch, face as a hole, the two
// eyes and flat brows, the floating fists — the same anatomy mood-atoms draws.
//
// ONE COLOUR ON DARK. The whole mark is a mask filled with a single colour, so
// every "second colour" in the reference (the dark face, the seam, the knuckle
// slits, the gap around each fist) is a HOLE and the background shows through.
// That is what makes it work on black, on burgundy, and inside a circular crop
// without a single extra fill.
// ═════════════════════════════════════════════════════════════════

const BR = {
  black: '#0B0F0E', panel: '#141B1A', teal: '#00D4AA', off: '#EDEDED',
  wine: '#3A1424', wineDeep: '#24101A', gold: '#CDB380', cream: '#F4EBDD',
  iconBg: '#06322B',                 // the app icon's solid dark teal
  felt: '#0E5B4E',                   // the reference's felt tone · LARGE LOCKUPS ONLY
};
const BR_OSWALD = '"Oswald", "Inter", sans-serif';
const BR_PLAYFAIR = '"Playfair Display", Georgia, serif';
const BR_MONO = '"JetBrains Mono", ui-monospace, monospace';

// ── the geometry, in one 64×64 box ───────────────────────────────────────
// The rail is the constant: padded band, seam inside it, one thin bright line
// under it, all three FULL BLEED with square ends. A rail has no ends; a bench
// does, and the moment you round the ends it becomes furniture.
const RB = {
  padTop: 39.2, padBot: 44.6,
  seamTop: 42.2, seamBot: 42.9,
  lineTop: 45.8, lineBot: 47.4,
  base: 45,                         // where the head's bottom disappears behind the rail
};

const rbRect = (y0, y1, x0 = -2, x1 = 66) => `M${x0} ${y0}H${x1}V${y1}H${x0}Z`;

// the hood, the product ghost's arch: vertical sides, a dome whose height equals
// its half-width. Face is a hole in it, never a fill.
const RB_HOOD = 'M14.4 45V27C14.4 15.6 22.5 8.6 32.5 8.6C42.5 8.6 50.6 15.6 50.6 27V45Z';
const RB_FACE = 'M20.8 45V27.5C20.8 20.2 26 15.7 32.65 15.7C39.3 15.7 44.5 20.2 44.5 27.5V45Z';
const RB_BROW_L = 'M23.4 24H30.1A0.7 0.7 0 0 1 30.1 25.5H23.4A0.7 0.7 0 0 1 23.4 24Z';
const RB_BROW_R = 'M34.9 24H41.6A0.7 0.7 0 0 1 41.6 25.5H34.9A0.7 0.7 0 0 1 34.9 24Z';
// THE EYES ARE NEVER DOTS. They are the ghost's own wide ellipses, and they are
// the last thing that may be simplified — at 16px they are still ellipses.
const RB_EYE_L = 'M26.6 29.8m-3 0a3 2.4 0 1 0 6 0a3 2.4 0 1 0-6 0Z';
const RB_EYE_R = 'M38.7 29.8m-3 0a3 2.4 0 1 0 6 0a3 2.4 0 1 0-6 0Z';
// THE GLYPH'S OPTICAL SIZE. At 16px the mark's own eyes are 0.95px tall and the
// mask antialiases them into the hood, so the favicon and the notification get a
// wider face hole and bigger eyes — an optical size, not a simplification. They
// are still ellipses; the brows come off, because "hood and eyes only" is what
// the 16px slot has room for.
const RB_GFACE = 'M19.4 45V27.2C19.4 19 25.3 14 32.5 14C39.7 14 45.6 19 45.6 27.2V45Z';
const RB_GEYE_L = 'M27.0 30.6m-4.2 0a4.2 3.3 0 1 0 8.4 0a4.2 3.3 0 1 0-8.4 0Z';
const RB_GEYE_R = 'M38.0 30.6m-4.2 0a4.2 3.3 0 1 0 8.4 0a4.2 3.3 0 1 0-8.4 0Z';

// a fist on the rail: the blob, a dark gap around it so it separates from both the
// rail and the hood, and two knuckle slits that are allowed to close at small size.
const RbFist = ({ x, cy = 37.4, s = 1 }) => (
  <g transform={`translate(${x} ${cy}) scale(${s})`}>
    <rect x="-6.1" y="-4.85" width="12.2" height="9.7" rx="4.7" fill="#000"/>
    <rect x="-4.95" y="-3.7" width="9.9" height="7.4" rx="3.6" fill="#fff"/>
    <rect x="-2.2" y="-2" width="1" height="3.2" rx="0.5" fill="#000"/>
    <rect x="1.2" y="-2" width="1" height="3.2" rx="0.5" fill="#000"/>
  </g>
);

// ── the mark ─────────────────────────────────────────────────────────────
// pose: close (the mark) · lean (the -close reference's framing, further back)
// · hood (marquee, he is nearer) · far (the empty room) · glyph (hood + eyes
// only — the favicon and the notification, where a rail is one grey line).
//
// The MARK is drawn at the -hood reference's framing, not -close's: a 64px box
// needs the head to fill it, and -close's head is 31% of its frame, which is a
// poster crop rather than a mark.
const RB_POSE = {
  close: { k: 1,    hands: 14.7, cy: 37.4, fist: 1 },
  lean:  { k: 0.86, hands: 17.8, cy: 38.0, fist: 0.86 },
  hood:  { k: 1.1,  hands: 13.2, cy: 37.0, fist: 1.06 },
  far:   { k: 0.7,  hands: null },
  icon:  { k: 0.86, hands: 17.5, cy: 37.6, fist: 0.9 },
  glyph: { k: 1.02, hands: null, bare: true, fill: true },
};

const BrandMark = ({ pose = 'close', size = 64, color = BR.teal, title, style }) => {
  const p = RB_POSE[pose] || RB_POSE.close;
  const uid = React.useId().replace(/:/g, '');
  const k = p.k;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block', flexShrink: 0, ...style }} role="img" aria-label={title || 'Railbird'}>
      <defs>
        <mask id={'rb' + uid} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect x="0" y="0" width="64" height="64" fill="#000"/>
          {/* the head, scaled about the point where it meets the rail. The glyph
              instead FILLS the box: at 16px a 57%-wide head is 9px of hood and
              the eyes close, so the crop tightens to the head's own bounds. */}
          <g transform={p.fill
            ? 'translate(32 32) scale(1.59) translate(-32.5 -26.8)'
            : `translate(32 ${RB.base}) scale(${k}) translate(-32 ${-RB.base})`}>
            <path d={RB_HOOD} fill="#fff"/>
            <path d={p.fill ? RB_GFACE : RB_FACE} fill="#000"/>
            {!p.fill && <path d={RB_BROW_L} fill="#fff"/>}
            {!p.fill && <path d={RB_BROW_R} fill="#fff"/>}
            <path d={p.fill ? RB_GEYE_L : RB_EYE_L} fill="#fff"/>
            <path d={p.fill ? RB_GEYE_R : RB_EYE_R} fill="#fff"/>
          </g>
          {/* the rail, over the hood's hidden bottom: nothing of the body below it */}
          {!p.bare && (
            <>
              <path d={rbRect(RB.padTop, RB.padBot)} fill="#fff"/>
              <path d={rbRect(RB.seamTop, RB.seamBot)} fill="#000"/>
              <path d={rbRect(RB.lineTop, RB.lineBot)} fill="#fff"/>
            </>
          )}
          {/* his hands, gripping it, fingers over the front edge */}
          {p.hands != null && (
            <>
              <RbFist x={p.hands} cy={p.cy} s={p.fist}/>
              <RbFist x={64 - p.hands} cy={p.cy} s={p.fist}/>
            </>
          )}
        </mask>
      </defs>
      <rect x="0" y="0" width="64" height="64" fill={color} mask={`url(#rb${uid})`}/>
    </svg>
  );
};

// the 24px notification glyph and the favicon: hood and eyes, nothing else
const BrandGlyph = ({ size = 24, color = BR.teal }) => <BrandMark pose="glyph" size={size} color={color}/>;

// the large lockup only: the felt tone under the rail, the one place the reference's
// second colour is allowed, because at 96px+ a flat mark loses the table.
const BrandMarkFelt = ({ size = 200, color = BR.teal, felt = BR.felt }) => (
  <span style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
    <span style={{ position: 'absolute', left: 0, right: 0, top: (RB.lineBot / 64) * size, bottom: 0, background: felt }}></span>
    <BrandMark size={size} color={color} style={{ position: 'relative' }}/>
  </span>
);

// ── the wordmark ─────────────────────────────────────────────────────────
const Wordmark = ({ size = 28, color = BR.off, face = 'oswald', caps = true, track }) => {
  const t = track != null ? track : (caps ? 0.26 : 0.02);
  return (
    <span style={{
      fontFamily: face === 'oswald' ? BR_OSWALD : BR_PLAYFAIR,
      fontSize: size, fontWeight: face === 'oswald' ? 500 : 600, color,
      letterSpacing: `${t}em`, lineHeight: 1, whiteSpace: 'nowrap', paddingRight: `${t}em`,
    }}>{caps ? 'RAILBIRD' : 'Railbird'}</span>
  );
};

// direction B, with this ghost: the word stands ON a rail and he peeks over its
// TOP edge. The marquee and the masthead only — it is a wordmark, not a symbol.
const WordmarkB = ({ size = 40, color = BR.off }) => {
  const ruleH = Math.max(1.6, size * 0.075);
  const head = size * 1.05;
  return (
    <span style={{ display: 'inline-block', position: 'relative', paddingTop: head * 0.64 }}>
      <span style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', width: head, height: head * 0.62, overflow: 'hidden' }}>
        <BrandMark pose="glyph" size={head} color={color}/>
      </span>
      <span style={{ display: 'block', fontFamily: BR_OSWALD, fontSize: size, fontWeight: 500, color, letterSpacing: '0.22em', lineHeight: 1, whiteSpace: 'nowrap', paddingRight: '0.22em' }}>RAILBIRD</span>
      <span style={{ display: 'block', height: ruleH, background: color, marginTop: size * 0.2, marginLeft: -size * 0.1, marginRight: -size * 0.1 }}></span>
    </span>
  );
};

// ── the lockup ───────────────────────────────────────────────────────────
// The mark's rail and the word's baseline are ONE line. The rail sits at 74.2% of
// the mark's box, so the mark drops by (0.742·m − baseline) and the eye reads a
// single horizontal through both.
const Lockup = ({ size = 22, color = BR.off, gap, caps = true, rule }) => {
  const m = size * 2.0;
  const railY = (RB.lineTop / 64) * m;      // rail line, inside the mark's box
  const drop = railY - size * 0.85;         // Oswald caps: 0.13em line-box lead + 0.72em cap
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: gap != null ? gap : size * 0.46 }}>
      <BrandMark size={m} color={color} style={{ marginTop: -drop }}/>
      <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
        <Wordmark size={size} color={color} caps={caps}/>
        {rule && <span style={{ height: 1.4, background: color, marginTop: size * 0.26 }}></span>}
      </span>
    </span>
  );
};

// ── where it lives ───────────────────────────────────────────────────────
// 1 · Telegram bot avatar. The eyes are centred in the UPPER HALF of the circle
// and the hands are inside the crop; the rail is cut by the circle, which is
// correct — a rail continues past what you can see of it.
const BotAvatar = ({ size = 512, palette = 'product', pose = 'close', ring }) => {
  const bg = palette === 'product' ? BR.black : BR.wineDeep;
  const fg = palette === 'product' ? BR.teal : BR.gold;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg, flexShrink: 0,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflow: 'hidden',
      border: ring ? '1px solid rgba(255,255,255,0.10)' : 'none', position: 'relative',
    }}>
      <BrandMark pose={pose} size={size * 1.18} color={fg} style={{ marginTop: size * -0.10 }}/>
    </div>
  );
};

// 2 · favicon / app icon. The favicon is hood and eyes; the app icon is the whole
// mark on a solid dark teal square with the rail running off both edges.
const Favicon = ({ size = 32, palette = 'product' }) => {
  const bg = palette === 'product' ? BR.black : BR.wineDeep;
  const fg = palette === 'product' ? BR.teal : BR.gold;
  return (
    <div style={{ width: size, height: size, borderRadius: Math.max(2, size * 0.2), background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
      <BrandGlyph size={size * 0.96} color={fg}/>
    </div>
  );
};

const AppIcon = ({ size = 180 }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.225, background: BR.iconBg, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <BrandMark pose="icon" size={size} color={BR.teal}/>
  </div>
);

// 3 · the page header, both breakpoints
const LandingHeader = ({ w = 1440, dir = 'A' }) => {
  const big = w > 700;
  return (
    <div style={{ width: w, background: BR.wineDeep, borderBottom: '1px solid rgba(205,179,128,0.22)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: big ? 12 : 9, padding: big ? '22px 64px' : '16px 24px' }}>
        {dir === 'B'
          ? <WordmarkB size={big ? 20 : 16} color={BR.cream}/>
          : <Lockup size={big ? 13 : 11} color={BR.cream}/>}
        <span style={{ flex: 1 }}></span>
        <span style={{ fontFamily: BR_MONO, fontSize: big ? 11 : 10, color: 'rgba(244,235,221,0.60)' }}>@railbird_app_bot</span>
      </div>
    </div>
  );
};

// 3b · the lit sign over the building's entrance in the landing hero. The door
// INSIDE the flat still says CASINO; this is the building's own sign, above it.
const MarqueeSign = ({ w = 300 }) => {
  const bulbs = Math.round(w / 15);
  return (
    <div style={{ width: w, position: 'relative', padding: '10px 0' }}>
      <div style={{
        background: '#1B0B12', border: `1px solid ${BR.gold}66`, borderRadius: 3,
        padding: `${w * 0.05}px 0 ${w * 0.045}px`, textAlign: 'center',
        boxShadow: `0 0 ${w * 0.16}px rgba(205,179,128,0.30), inset 0 0 ${w * 0.08}px rgba(205,179,128,0.10)`,
      }}>
        <WordmarkB size={w * 0.082} color="#F6E9CE"/>
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: `0 ${w * 0.02}px`, pointerEvents: 'none' }}>
        {Array.from({ length: bulbs }).map((_, i) => (
          <span key={i} style={{ width: w * 0.014, height: w * 0.014, borderRadius: '50%', background: '#F6E9CE', boxShadow: `0 0 ${w * 0.03}px rgba(246,233,206,0.9)`, animation: `brandBulb ${1.6 + (i % 3) * 0.4}s ease-in-out ${i * 0.11}s infinite` }}></span>
        ))}
      </div>
    </div>
  );
};

// 5 · share-card corner
const ShareCorner = ({ light, size = 13 }) => (
  <Lockup size={size} color={light ? '#1A0A10' : BR.off}/>
);

// 7 · loading screen
const LOADING_LINES = [
  'You don\u2019t play. You raise a player.',
  'Someone else plays the hand. You have opinions.',
  'Your player. Your rail. Your money.',
];
const LoadingScreen = ({ w = 390, h = 640, line = 0, animate = true }) => (
  <div style={{ width: w, height: h, background: BR.black, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, overflow: 'hidden' }}>
    <div style={{ width: 150, height: 150, overflow: 'hidden', animation: animate ? 'brandRise 0.56s cubic-bezier(.22,1,.36,1) 0.1s both' : 'none' }}>
      <BrandMark size={150} color={BR.teal}/>
    </div>
    <span style={{ fontFamily: BR_PLAYFAIR, fontSize: 17, color: 'rgba(237,237,237,0.78)', textAlign: 'center', maxWidth: w - 80, lineHeight: 1.45, animation: animate ? 'brandFade 0.5s ease-out 0.62s both' : 'none' }}>{LOADING_LINES[line]}</span>
  </div>
);

// 7b · the FAR pose: the empty room, before anyone lives in it
const EmptyRoomFrame = ({ w = 390, h = 844 }) => (
  <div style={{ width: w, height: h, background: 'radial-gradient(ellipse at 50% 64%, #16211F 0%, #0E1413 62%, #0A0F0E 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, overflow: 'hidden' }}>
    <BrandMark pose="far" size={196} color={BR.teal}/>
    <span style={{ fontFamily: BR_PLAYFAIR, fontSize: 19, color: 'rgba(237,237,237,0.74)' }}>Nobody lives here yet.</span>
  </div>
);

// 8 · the bot's description line
const BotDescription = ({ w = 340 }) => (
  <div style={{ width: w, display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 24, height: 24, overflow: 'hidden' }}><BrandMark size={26} color={BR.teal} style={{ marginTop: -1 }}/></div>
    <span style={{ fontSize: 14, color: BR.off }}>Railbird <span style={{ color: 'rgba(237,237,237,0.45)' }}>&middot;</span> <span style={{ color: 'rgba(237,237,237,0.72)' }}>raise a poker player</span></span>
  </div>
);

// ── THE TEST · a chat list at real size ──────────────────────────────────
const NEIGHBOURS = [
  { bg: '#2E7CF6', fg: '#fff', glyph: 'W', name: 'Weather', prev: 'Rain from 14:00, 8\u00B0' },
  { bg: '#E9573F', fg: '#fff', glyph: 'F', name: 'Fileconv', prev: 'Your PDF is ready' },
  { bg: '#5C4BD1', fg: '#fff', glyph: '\u2261', name: 'Notes', prev: 'Saved to inbox' },
  { bg: '#1C9C63', fg: '#fff', glyph: '$', name: 'Rates', prev: 'SEK 9.42 / USD' },
  { bg: '#3A3F45', fg: '#C9CDD2', glyph: '?', name: 'Support', prev: 'Ticket #8812 closed' },
];

const ChatRow = ({ avatar, name, prev, time, unread, hi }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: hi ? 'rgba(0,212,170,0.06)' : 'transparent' }}>
    <div style={{ width: 40, height: 40, flexShrink: 0 }}>{avatar}</div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: '#F0F2F3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <span style={{ flex: 1 }}></span>
        <span style={{ fontSize: 11.5, color: '#6E7479', flexShrink: 0 }}>{time}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <span style={{ fontSize: 13, color: '#8E959B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prev}</span>
        <span style={{ flex: 1 }}></span>
        {unread && <span style={{ minWidth: 19, height: 19, borderRadius: 10, background: '#2E7CF6', color: '#fff', fontSize: 11.5, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', flexShrink: 0 }}>{unread}</span>}
      </div>
    </div>
  </div>
);

const LetterAvatar = ({ bg, fg, glyph }) => (
  <div style={{ width: 40, height: 40, borderRadius: '50%', background: bg, color: fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 600 }}>{glyph}</div>
);

const ChatListTest = ({ pose = 'close', w = 360, label }) => (
  <div style={{ width: w, background: '#17212B', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 15, fontWeight: 600, color: '#F0F2F3' }}>Chats</span>
      <span style={{ flex: 1 }}></span>
      <span style={{ fontFamily: BR_MONO, fontSize: 10, color: '#6E7479' }}>{label || 'close pose · 40px'}</span>
    </div>
    <ChatRow avatar={<LetterAvatar {...NEIGHBOURS[0]}/>} name={NEIGHBOURS[0].name} prev={NEIGHBOURS[0].prev} time="09:12"/>
    <ChatRow hi avatar={<BotAvatar size={40} pose={pose}/>} name="Railbird" prev="Kase sat down at #48291" time="09:04" unread="3"/>
    {NEIGHBOURS.slice(1).map(n => <ChatRow key={n.name} avatar={<LetterAvatar {...n}/>} name={n.name} prev={n.prev} time="Yst"/>)}
  </div>
);

const TabTest = ({ label = 'Railbird \u00B7 raise a poker player' }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, background: '#202124', padding: '8px 8px 0', borderRadius: '8px 8px 0 0', width: 300 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#35363A', borderRadius: '8px 8px 0 0', padding: '7px 10px', width: 220, minWidth: 0 }}>
      <div style={{ width: 16, height: 16, flexShrink: 0 }}><Favicon size={16}/></div>
      <span style={{ fontSize: 11.5, color: '#E8EAED', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <span style={{ color: '#9AA0A6', fontSize: 13, flexShrink: 0 }}>&times;</span>
    </div>
  </div>
);

// ── reduction ────────────────────────────────────────────────────────────
// At 24 and below the hands are allowed to go. The hood and the two eyes must
// survive at 16, and the eyes stay ELLIPSES — if they round to dots the mark is
// wrong and the note says so.
const SizeLadder = ({ color = BR.teal, sizes = [96, 64, 40, 32, 24, 16] }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22 }}>
    {sizes.map(s => (
      <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <BrandMark pose={s <= 24 ? 'glyph' : 'close'} size={s} color={color}/>
        <span style={{ fontFamily: BR_MONO, fontSize: 9, color: '#6B6B6B' }}>{s}</span>
      </div>
    ))}
  </div>
);

const Construction = ({ size = 260 }) => (
  <div style={{ position: 'relative', width: size, height: size, background: BR.panel, borderRadius: 4, overflow: 'hidden' }}>
    <BrandMark size={size} color={BR.teal} style={{ position: 'absolute', inset: 0 }}/>
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ position: 'absolute', inset: 0 }}>
      {[8, 16, 24, 32, 40, 48, 56].map(v => (
        <g key={v}>
          <line x1={v} y1="0" x2={v} y2="64" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3"/>
          <line x1="0" y1={v} x2="64" y2={v} stroke="rgba(255,255,255,0.05)" strokeWidth="0.3"/>
        </g>
      ))}
      {[RB.padTop, RB.lineTop, 29.8].map(y => (
        <line key={y} x1="0" y1={y} x2="64" y2={y} stroke="#CDB380" strokeWidth="0.3" strokeDasharray="1 1.4"/>
      ))}
      <line x1="32" y1="0" x2="32" y2="64" stroke="#CDB380" strokeWidth="0.3" strokeDasharray="1 1.4"/>
    </svg>
  </div>
);

// the overlay check: our mark over the reference PNG at 512, same box
const RefOverlay = ({ src, size = 512, pose = 'close', mix = 0.55 }) => (
  <div style={{ position: 'relative', width: size, height: size, background: '#000', overflow: 'hidden', flexShrink: 0 }}>
    <img src={src} width={size} height={size} alt="pose reference" style={{ display: 'block' }}/>
    <BrandMark pose={pose} size={size} color="#FF3B6B" style={{ position: 'absolute', inset: 0, opacity: mix }}/>
  </div>
);

Object.assign(window, {
  BR, BR_OSWALD, BR_PLAYFAIR, BR_MONO, RB, RB_POSE, RB_HOOD, RB_FACE, RB_EYE_L, RB_EYE_R, RbFist,
  BrandMark, BrandGlyph, BrandMarkFelt, Wordmark, WordmarkB, Lockup, RB_GFACE, RB_GEYE_L, RB_GEYE_R,
  BotAvatar, Favicon, AppIcon, LandingHeader, MarqueeSign, ShareCorner,
  LoadingScreen, LOADING_LINES, EmptyRoomFrame, BotDescription,
  ChatListTest, ChatRow, LetterAvatar, TabTest, SizeLadder, Construction, RefOverlay,
});
