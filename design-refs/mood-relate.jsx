// WANTS AND THE LEDGER (RELATE-1) — his memory of the owner.
//
// Two mechanics, one law: THE LEDGER IS HIS MEMORY, READABLE ON REQUEST, NEVER A
// LOG. Twelve lines in his voice, and the only way to see them is to ask him. There
// is no relationship screen, no affinity meter, no hearts, and nothing anywhere
// that says you have been away.
//
// A WANT IS AN ASK, NOT A DEMAND. One action to answer it, one way to leave it, and
// LEAVING IT IS FREE — no guilt state, no decay, no sulk-because-you-said-no. The
// snack from design 29 is the only item, bought from the wallet, never from a pocket.

const WANT = {
  line: "Can I have a beer. It's been rough.",
  after: 'Cheers.',
  price: '$2',
  from: 'your wallet',
};

// ── the want, in the thread ──────────────────────────────────────────────
// The card is deliberately quiet: no countdown, no pulse, no red dot. It has one
// primary action and one plain dismissal, and the dismissal is a full-width tap
// target rather than a small grey word — because "not now" must be as easy to hit
// as "yes" or the choice is theatre.
const WantCard = ({ pending = true }) => (
  <div style={{ margin: `0 ${CANON.pad}px 9px`, borderRadius: 12, overflow: 'hidden', background: M_PANEL_2, border: `1px solid ${M_GOLD}44` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderBottom: `1px solid ${M_BORDER}`, background: `${M_GOLD}0A` }}>
      <Biscuit size={14}/>
      <Lbl size={9} color={M_GOLD}>He is asking for something</Lbl>
      <div style={{ flex: 1 }}/>
      <Num size={9} color={M_MUTED} weight={500}>{WANT.price} &middot; {WANT.from.toUpperCase()}</Num>
    </div>
    <div style={{ padding: '12px 13px 13px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Btn kind="primary" h={42} full>Give him one &middot; {WANT.price}</Btn>
        </div>
        <div style={{ flex: 1 }}>
          <Btn kind="ghost" h={42} full>Not now</Btn>
        </div>
      </div>
      <div style={{ fontSize: 11, color: M_MUTED, lineHeight: 1.45, marginTop: 10, textAlign: 'center' }}>
        Either answer is fine. He does not keep score of this one.
      </div>
    </div>
  </div>
);

const ThreadWantScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Aggressive v1.3"/>
    <HeatBand accent={M_PURPLE} mood="frustrated" heat={64} state="resting" action="Deploy"
      cause="rough session — down $180 over 90 hands"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10 }}>
      <SysLine>Session closed · 23:12</SysLine>
      <HeatBubble mood="frustrated" accent={M_PURPLE} heat={64} time="23:12" expressive>
        Ninety hands, down a hundred and eighty. Two of those were coolers and one was me.
      </HeatBubble>
      <HeatBubble mood="frustrated" accent={M_PURPLE} heat={64} time="23:13">
        {WANT.line}
      </HeatBubble>
      <WantCard/>
    </div>
    <ChatComposer placeholder="Message Aggressive v1.3…"/>
  </PhoneShell>
);

// ── the give, and his reaction ───────────────────────────────────────────
// The animation is a transfer, like the collect receipt: the item leaves the wallet
// and arrives at him. No burst, no coins, no sparkle — the reward is that he says
// something different afterwards.
const GaveCard = () => (
  <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '11px 13px', borderRadius: 12, background: `${M_GOLD}0A`, border: `1px solid ${M_GOLD}44` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ flex: 1 }}>
        <Lbl size={8.5}>From your wallet</Lbl>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
          <Num size={13} weight={700} color={M_MUTED}>&minus;{WANT.price}</Num>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <Biscuit size={16}/>
        <svg width="24" height="12" viewBox="0 0 26 14" fill="none" stroke={M_GOLD} strokeWidth="1.8" strokeLinecap="round"><path d="M1 7h20M16 2l5 5-5 5"/></svg>
      </div>
      <div style={{ flex: 1, textAlign: 'right' }}>
        <Lbl size={8.5} color={M_GOLD}>Heat</Lbl>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, justifyContent: 'flex-end', marginTop: 2 }}>
          <Num size={11.5} color={M_MUTED}>64</Num>
          <Num size={13} weight={700} color={M_TEAL}>&rarr; 55</Num>
        </div>
      </div>
    </div>
    <div style={{ marginTop: 10, paddingTop: 9, borderTop: `1px solid ${M_BORDER}`, fontSize: 11, color: M_MUTED, lineHeight: 1.45 }}>
      A snack cools nine points and it is the same nine every time. It does not raise an attribute, clear fatigue, or buy his opinion of you.
    </div>
  </div>
);

const ThreadGaveScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Aggressive v1.3"/>
    <HeatBand accent={M_PURPLE} mood="frustrated" heat={55} state="resting" action="Deploy"
      cause="rough session — down $180 over 90 hands"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10 }}>
      <HeatBubble mood="frustrated" accent={M_PURPLE} heat={64} time="23:13">
        {WANT.line}
      </HeatBubble>
      <GaveCard/>
      <HeatBubble mood="frustrated" accent={M_PURPLE} heat={55} time="23:14" expressive>
        {WANT.after}
      </HeatBubble>
      <HeatBubble mood="frustrated" accent={M_PURPLE} heat={55} time="23:16">
        Right. Tomorrow I fold the queens on that board.
      </HeatBubble>
      <OwnerBubble time="23:17">Good.</OwnerBubble>
    </div>
    <ChatComposer placeholder="Message Aggressive v1.3…"/>
  </PhoneShell>
);

// ── the floor, while a want is pending ───────────────────────────────────
// One gold pip at his feet, the same furniture the GREW / WORN / POCKET $0 pips use.
// It does not blink, it does not count down, and it disappears whether or not you
// answered — because a want that nags is guilt machinery with a nicer name.
const FloorWantScreenM = () => {
  const L = LAYOUTS.two;
  const f = L.felts[0];
  const gh = (50 * 1.2) + 19 + 3;
  return (
    <PhoneShell>
      <GlobalHeader/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.92 }}><RoomLayer layout="two"/></div>
        <FloorStandup line="One asking · Aggressive v1.3 wants a beer"/>
        <Diorama f={f} hole={CAST.balanced.hole}/>
        <Occupant x={f.cx} y={f.cy - gh + 8} name="Balanced v2.1" accent={M_TEAL}
          mood="confident" state="live" size={50} speed={5}/>
        <PotTicker x={f.cx} y={f.cy - gh + 8 - 27} amount="480"/>

        {/* at the bar, asking — heat still showing in the posture */}
        <div style={{ position: 'absolute', left: 96, top: L.bar.y - 100, transform: 'translateX(-50%)', zIndex: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <HeatGhost mood="frustrated" accent={M_PURPLE} heat={64} size={50}/>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', color: M_GOLD, background: 'rgba(14,16,18,0.92)', border: `1px solid ${M_GOLD}AA`, borderRadius: 3, padding: '2px 5px' }}>
              <Biscuit size={9}/>ASKING
            </span>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 5, padding: '0 14px' }}>
          <Btn kind="primary" h={46} full>Open his chat</Btn>
        </div>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// ── the ledger: twelve lines, and you have to ask ───────────────────────
// Not a list, not a screen, not a score. He answers the question the way a person
// would: three or four sentences that happen to be built from the twelve lines he
// keeps. The lines themselves are never rendered as rows anywhere in the product.
const LEDGER_REPLY = [
  "You're on my back all week and then you vanish for three days.",
  "You told me the line was right after the Granite hand. I remember that one.",
  "You've cut me off once. I'd have done the same.",
  "Mostly you leave me alone and let me play. That's the best of it.",
];

const ThreadLedgerScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Aggressive v1.3"/>
    <HeatBand accent={M_PURPLE} mood="neutral" heat={28} state="resting" action="Deploy"
      cause="settled — nothing on tonight"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10 }}>
      <OwnerBubble time="09:41">what do you think of me?</OwnerBubble>
      <HeatBubble mood="neutral" accent={M_PURPLE} heat={28} time="09:41">
        {LEDGER_REPLY[0]}
      </HeatBubble>
      <HeatBubble mood="neutral" accent={M_PURPLE} heat={28} time="09:41">
        {LEDGER_REPLY[1]}
      </HeatBubble>
      <HeatBubble mood="neutral" accent={M_PURPLE} heat={28} time="09:42">
        {LEDGER_REPLY[2]}
      </HeatBubble>
      <HeatBubble mood="neutral" accent={M_PURPLE} heat={28} time="09:42" expressive>
        {LEDGER_REPLY[3]}
      </HeatBubble>
      <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '10px 12px', borderRadius: 9, border: `1px dashed ${M_BORDER_2}` }}>
        <Num size={9} color={M_MUTED} weight={500}>HIS MEMORY &middot; 12 LINES &middot; READABLE ON REQUEST</Num>
        <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 6 }}>
          He keeps twelve. Asking is the only way to see any of them, and they are never rendered as a list &mdash; not here, not on the profile, not anywhere.
        </div>
      </div>
    </div>
    <ChatComposer placeholder="Message Aggressive v1.3…"/>
  </PhoneShell>
);

// ── the profile: one line, in his voice ─────────────────────────────────
// Where a lesser design would put a relationship meter, the card gets ONE SENTENCE
// he chose. It sits under the biography rows because it is the same kind of fact —
// history between two parties — and it is the only place the ledger surfaces
// without being asked.
const ProfileRelLineM = () => (
  <div style={{ width: 390, background: M_BG, fontFamily: INTER, padding: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
      <Lbl size={9.5}>Profile v2 &middot; how he sees you</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      <Num size={9} color={M_MUTED} weight={500}>ONE LINE, UNDER RELATIONSHIPS</Num>
    </div>
    <div style={{ padding: '12px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: M_PURPLE, background: `${M_PURPLE}14`, border: `1px solid ${M_PURPLE}44`, borderRadius: 3, padding: '3px 6px' }}>YOU</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: M_TEXT }}>Owner since March</span>
        <Num size={9} color={M_MUTED} weight={500}>41 SESSIONS</Num>
      </div>
      <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.45, fontStyle: 'italic' }}>
        &ldquo;{LEDGER_REPLY[0]}&rdquo;
      </div>
    </div>
    <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 10 }}>
      It changes as the ledger does, and it is <b style={{ color: M_DIM }}>whichever line he would lead with today</b> &mdash; sometimes generous, sometimes not. There is no meter, no score and no streak, because the moment a relationship has a number it becomes a thing to farm.
    </div>
  </div>
);

const RelateLawSheetM = () => (
  <Sheet title="Wants, and his memory of you" sub="RELATE-1 ships a twelve-line ledger in his voice and a want mechanic answered by the snack. Both are one law away from being guilt machinery, so the law is written first and the screens follow it.">
    <div style={{ display: 'flex', gap: 22 }}>
      <div style={{ flex: 1 }}>
        <SyLbl color={M_TEAL}>What a want is allowed to be</SyLbl>
        {[
          ['One ask, one action', 'A line in his voice and a card with a single primary action. Never a queue of wants, never two at once, never a want while he is at a table.'],
          ['Leaving it is free', '\u201cNot now\u201d is a full-width tap target the same size as yes. No decay, no sulk, no second ask, and the pip clears on its own.'],
          ['Bought from the wallet', 'The snack costs $2 of the owner\u2019s money and never a penny of his pocket \u2014 a pocket that can buy things is a purchase path into the character system.'],
          ['Nine points, always', 'It cools heat by nine. It does not raise an attribute, clear fatigue, narrow a band or change his opinion of you. It is a kindness, not a lever.'],
        ].map(([t, b]) => (
          <div key={t} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: `1px solid ${M_BORDER}` }}>
            <span style={{ width: 132, flexShrink: 0, fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: M_TEAL, paddingTop: 2 }}>{t}</span>
            <span style={{ flex: 1, fontSize: 12, color: M_DIM, lineHeight: 1.55 }}>{b}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <SyLbl color={M_GOLD}>What the ledger is allowed to be</SyLbl>
        {[
          ['His memory, not a log', 'Twelve lines he keeps in his own words. There is no ledger screen and the lines are never rendered as rows \u2014 asking him is the only interface.'],
          ['Readable on request', '\u201cWhat do you think of me?\u201d gets three or four sentences, in order, as a person would answer. Not a summary and not a score.'],
          ['One line, unasked', 'The profile carries whichever line he would lead with today, under the biography rows. That is the ledger\u2019s entire passive footprint.'],
          ['Never about absence', 'A line can be sharp about what you SAID or DID \u2014 \u201cyou\u2019re on my back all week\u201d, \u201cyou cut me off once\u201d. None of the twelve can be about you not being there.'],
        ].map(([t, b]) => (
          <div key={t} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: `1px solid ${M_BORDER}` }}>
            <span style={{ width: 132, flexShrink: 0, fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: M_GOLD, paddingTop: 2 }}>{t}</span>
            <span style={{ flex: 1, fontSize: 12, color: M_DIM, lineHeight: 1.55 }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
    <div style={{ marginTop: 20, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
        <SyLbl color={M_RED}>Banned outright</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          An affinity meter. Hearts. A streak. A daily-visit reward. A want that expires with a penalty. A line that says he missed you. <b style={{ color: M_TEXT }}>Any number attached to the relationship</b> &mdash; the moment it has one it becomes a thing to farm, and he stops being a colleague.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>Why sharpness is allowed</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          &ldquo;You&rsquo;re on my back all week and then you vanish for three days&rdquo; is <b style={{ color: M_TEXT }}>an observation about behaviour, not a reproach for absence</b> &mdash; and an employee who only ever flatters you is not a character. The line that closes his answer is the one that matters: <i>mostly you leave me alone and let me play. That&rsquo;s the best of it.</i>
        </div>
      </div>
    </div>
  </Sheet>
);

Object.assign(window, {
  WANT, WantCard, GaveCard, LEDGER_REPLY, ProfileRelLineM, RelateLawSheetM,
  ThreadWantScreenM, ThreadGaveScreenM, FloorWantScreenM, ThreadLedgerScreenM,
});
