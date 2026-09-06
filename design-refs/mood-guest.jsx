// ═════════════════════════════════════════════════════════════════
// WAVE 59 · THE GUEST, and THE SHARE CARD
//
// THE GUEST is the product with no account: someone opens the page in a browser and
// drafts an agent before being asked for anything. The whole flow is the real one —
// the same recruiter sheet, the same room, the same felt — and the ask comes at the
// end, once there is something to lose. The claim wall says plainly what a guest
// cannot do and that he is forgotten in thirty days, because a limit you discover
// later is worse than one you were told.
//
// THE SHARE CARD is one agent's night in one image: his face, his name, the result
// line with the hand he won with, the one thing he said, and a card back in the play
// teal. Two sizes, one composition.
// ═════════════════════════════════════════════════════════════════

const GUEST_LIMITS = [
  'one agent',
  'one session a day',
  'no whispers mid-hand',
];

// the browser chrome, because "in a browser with no Telegram" is the whole premise
// and a phone frame alone would not say it
const GuestBrowser = ({ children, w = 390, h = 844 }) => (
  <div style={{ width: w, borderRadius: 10, overflow: 'hidden', border: `1px solid ${M_BORDER}`, background: '#0A0E0D', boxShadow: '0 18px 44px rgba(0,0,0,0.5)' }}>
    <div style={{ height: 34, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', background: '#15191A', borderBottom: `1px solid ${M_BORDER}` }}>
      <div style={{ display: 'flex', gap: 5 }}>{['#E5544B', '#E5B84B', '#4BC07A'].map(c => <span key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.75 }}></span>)}</div>
      <div style={{ flex: 1, height: 20, borderRadius: 10, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 9px' }}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2.4"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>
        <span style={{ fontFamily: MONO, fontSize: 9, color: M_DIM }}>agenticpoker.app</span>
      </div>
    </div>
    <div style={{ height: h, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: M_BG }}>{children}</div>
  </div>
);

const GuestHead = ({ sub }) => (
  <div style={{ flexShrink: 0, minHeight: 46, display: 'flex', alignItems: 'center', gap: 9, padding: '7px 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
    <SpadeLogo/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 14, fontWeight: 600, color: M_TEXT, lineHeight: 1.25 }}>Agentic Poker</div>
      <div style={{ fontSize: 9.5, color: M_MUTED }}>{sub}</div>
    </div>
    <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.13em', color: M_MUTED, border: `1px solid ${M_BORDER}`, borderRadius: 7, padding: '4px 9px' }}>GUEST</span>
  </div>
);

// G1 · the room, empty, with the recruiter already up. Nobody is asked to press
// "start" — the conversation is the front door.
const GuestDraftM = ({ stage = 1 }) => (
  <GuestBrowser>
    <GuestHead sub="drafting · no account yet"/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4 }}><HomeFlat lit={false}/></div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,10,10,0.55) 0%, rgba(6,10,10,0.8) 100%)' }}></div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, zIndex: 3 }}>
        <FormingGhost stage={stage}/>
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.18em', color: M_MUTED }}>{DRAFT_STAGES[stage - 1].cap.toUpperCase()}</span>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 196, zIndex: 6, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderTopLeftRadius: 18, borderTopRightRadius: 18, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 6px' }}>
          <span style={{ width: 30, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }}></span>
          <span style={{ flex: 1 }}></span>
          <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>THE DRAFT · {stage} OF 5</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '2px 14px 0', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {DRAFT_TALK.slice(0, stage).flat().slice(-4).map((r, i) => <DraftRow key={i} r={r}/>)}
        </div>
        <div style={{ flexShrink: 0, padding: '9px 12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.05)', border: `1px solid ${V5GLASS.edge}`, padding: '0 8px 0 14px' }}>
            <span style={{ flex: 1, fontSize: 12.5, color: M_MUTED }}>answer him…</span>
            <span style={{ width: 30, height: 30, borderRadius: 15, background: `${M_TEAL}26`, border: `1px solid ${M_TEAL}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 20 20"><path d="M2 10L18 3L11 18L9.4 11.6L2 10Z" fill="none" stroke={M_TEAL} strokeWidth="1.5" strokeLinejoin="round"/></svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  </GuestBrowser>
);

// G2 · he walks in. A guest gets the arrival, because the arrival is the thing that
// makes him worth keeping.
const GuestBornM = () => (
  <GuestBrowser>
    <GuestHead sub="Gran · born a minute ago"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={3}/>
        <TableChairs taken={1}/>
        <HomeOne a={{ ...H_CAST.blf, name: 'Granite', nick: 'Gran', mood: 'confident' }} at={{ x: 300, y: 300 }} size={48} stamina={96} heat={6}
          says="Patient, you said. Good. I am a Rock."/>
        <DoorTap/>
      </HomeFlat>
    </div>
    <div style={{ flexShrink: 0, padding: '10px 12px 14px', background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}` }}>
      <div style={{ height: 46, borderRadius: 12, background: M_TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', color: '#06100E' }}>SEND HIM TO PLAY</span>
      </div>
    </div>
  </GuestBrowser>
);

// G3 · his one session. Identical to the real watch screen — a guest is not shown a
// demo, he is shown the product.
const GuestWatchM = () => (
  <GuestBrowser>
    <GuestHead sub="Gran · 10/20 · 22 minutes"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <V5Felt acting="granite" stackBand="mid" betOut="mid"
        hero={<V5Hero says="He never folds. So I stop bluffing him." street="TURN" equity={71} hands="hold" toCall="120"/>}/>
      {/* the one thing a guest cannot do, said where he would do it */}
      <div style={{ flexShrink: 0, padding: '9px 12px 14px', background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edge}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 44, borderRadius: 22, background: 'rgba(255,255,255,0.03)', border: `1px dashed ${M_BORDER}`, padding: '0 14px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2.2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>
          <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>Whispers need an account</span>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.11em', color: M_TEAL }}>KEEP HIM</span>
        </div>
      </div>
    </div>
  </GuestBrowser>
);

// ── THE CLAIM WALL ───────────────────────────────────────────────────────
// It arrives after the session, not before the draft: the ask lands when there is
// something to lose. It says what a guest cannot do and when he is forgotten, in
// plain words, above the buttons rather than in fine print under them.
const ClaimWall = ({ w = 390 }) => (
  <div style={{ width: w, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${V5GLASS.edgeUp}`, borderRadius: '18px 18px 0 0', fontFamily: INTER, padding: '11px 0 20px' }}>
    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 12 }}>
      <span style={{ width: 30, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.22)' }}></span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '0 18px' }}>
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: '46%', width: 150, height: 150, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_GOLD}1F, transparent 68%)` }}></div>
        {(() => { const i = idFor('gra'); return <MoodGhost mood="confident" size={72} ring={false} hood={i.hood} glow={i.glow.c} hands="rest"/>; })()}
      </div>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 25, fontWeight: 600, color: M_TEXT, letterSpacing: '-0.01em' }}>Keep him</div>
      <ResultLine who="Gran" amt="310" hand="a pair of nines" size={12.5}/>
    </div>

    {/* what a guest cannot do — above the buttons, in the same size as everything
        else. A limit in fine print is a limit you discover, which is worse. */}
    <div style={{ margin: '15px 18px 0', padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.035)', border: `1px solid ${M_BORDER}` }}>
      <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED, paddingBottom: 7 }}>AS A GUEST</div>
      {GUEST_LIMITS.map(l => (
        <div key={l} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
          <span style={{ color: M_MUTED, fontSize: 11 }}>&middot;</span>
          <span style={{ fontSize: 11.5, color: M_DIM }}>{l}</span>
        </div>
      ))}
      <div style={{ marginTop: 7, paddingTop: 8, borderTop: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_GOLD, lineHeight: 1.45 }}>
        And he is forgotten after 30 days.
      </div>
    </div>

    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 18px 0' }}>
      <div style={{ height: 48, borderRadius: 12, background: '#2AABEE', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="#06121A"><path d="M21.5 3.5L2.8 10.6c-.9.35-.9.9-.16 1.1l4.7 1.47 1.8 5.5c.22.6.4.84 1 .84.46 0 .66-.2.92-.46l2.2-2.14 4.5 3.33c.83.46 1.42.22 1.63-.77l2.95-13.9c.3-1.2-.46-1.75-1.24-1.4z"/></svg>
        <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: '#06121A' }}>CONTINUE IN TELEGRAM</span>
      </div>
      <div style={{ height: 48, borderRadius: 12, background: '#F4EBDD', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer' }}>
        <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M23 12.2c0-.8-.07-1.4-.2-2H12v3.9h6.2c-.13 1-.8 2.6-2.6 3.6l-.02.16 2.8 2.17.2.02c1.8-1.65 2.8-4.1 2.8-7z"/><path fill="#34A853" d="M12 23.5c2.6 0 4.7-.85 6.3-2.3l-3-2.32c-.8.56-1.9.95-3.3.95-2.5 0-4.7-1.65-5.5-3.95l-.15.01-2.9 2.25-.05.14C5 21.1 8.25 23.5 12 23.5z"/><path fill="#FBBC05" d="M6.5 15.9c-.2-.6-.32-1.25-.32-1.9s.12-1.3.3-1.9l-.006-.13-2.94-2.28-.1.05C2.8 11.1 2.5 12.5 2.5 14s.3 2.9.94 4.25l3.06-2.35z"/><path fill="#EA4335" d="M12 6.4c1.77 0 2.97.77 3.65 1.4l2.66-2.6C16.7 3.7 14.6 2.5 12 2.5 8.25 2.5 5 4.9 3.44 8.25l3.05 2.36C7.3 8.3 9.5 6.4 12 6.4z"/></svg>
        <span style={{ fontFamily: OSWALD, fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', color: '#1A0A10' }}>CONTINUE WITH GOOGLE</span>
      </div>
      <div style={{ textAlign: 'center', paddingTop: 3 }}>
        <span style={{ fontSize: 11, color: M_MUTED, cursor: 'pointer' }}>Keep playing as a guest</span>
      </div>
    </div>
  </div>
);

const GuestClaimM = () => (
  <GuestBrowser>
    <GuestHead sub="the session is over"/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <HomeFlat>
        <AwayWall hooks={3}/>
        <TableChairs taken={1}/>
        <HomeOne a={{ ...H_CAST.blf, name: 'Granite', nick: 'Gran', mood: 'confident' }} at={STAND.byTable} size={46} stamina={72} heat={18}/>
        <DoorTap/>
      </HomeFlat>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,9,9,0.66)' }}></div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><ClaimWall/></div>
    </div>
  </GuestBrowser>
);

// the same beat on desktop: the room in the centre, the wall in the right column,
// because desktop has a column and does not need to cover anything
const GuestClaimDeskM = ({ w = 1440, h = 900 }) => (
  <DkShell w={w} h={h}>
    <DkBar title="Agentic Poker" sub="guest · the session is over" net="+$310"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DkFlat w={w - DW.thread} h={h} lit={false}>
        {dkRoom({})}
      </DkFlat>
      <DkRight title="Keep him" sub="GUEST" composer={false}>
        <ClaimWall w={DW.thread}/>
      </DkRight>
    </div>
  </DkShell>
);

// ── 4 · THE SHARE CARD ───────────────────────────────────────────────────
// One agent's night, in one image. The wave-54 version was archived because it was
// built on the old felt; this one takes its face, its result line and its card back
// from the current system, so it cannot drift from the product again.
const ShareCard = ({ w = 1080, h = 1920, k = 0.28 }) => {
  const wide = w > h;
  const i = idFor('gra');
  return (
    <div style={{ width: w * k, height: h * k, overflow: 'hidden', borderRadius: 6, boxShadow: '0 18px 44px rgba(0,0,0,0.5)' }}>
      <div style={{ width: w, height: h, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative', overflow: 'hidden', fontFamily: INTER, background: 'radial-gradient(ellipse at 50% 34%, #23312D 0%, #131D1B 58%, #0A0F0E 100%)' }}>
        {/* the felt's own rim, so the card is recognisably from the table */}
        <div style={{ position: 'absolute', left: '-16%', right: '-16%', top: wide ? '4%' : '12%', height: wide ? '86%' : '52%', borderRadius: '50%', border: `${w * 0.003}px solid ${M_TEAL}1F` }}></div>

        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: w * (wide ? 0.05 : 0.03), padding: w * 0.06 }}>
          {/* him */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', left: '50%', top: '48%', width: w * (wide ? 0.4 : 0.72), height: w * (wide ? 0.4 : 0.72), transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${M_GOLD}26, transparent 68%)` }}></div>
            <MoodGhost mood="confident" size={w * (wide ? 0.19 : 0.34)} ring={false} hood={i.hood} glow={i.glow.c} hands="raise"/>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: wide ? 'flex-start' : 'center', gap: w * 0.018, textAlign: wide ? 'left' : 'center', minWidth: 0 }}>
            <div style={{ fontFamily: OSWALD, fontSize: w * 0.022, fontWeight: 600, letterSpacing: '0.24em', color: M_MUTED }}>GRANITE &middot; A ROCK</div>
            {/* the money, and the hand that made it — the two facts the card exists for */}
            <div style={{ fontFamily: ROZHA, fontSize: w * (wide ? 0.1 : 0.14), color: M_TEAL, lineHeight: 1 }}>+$310</div>
            <div style={{ fontSize: w * 0.026, color: M_DIM, lineHeight: 1.4, maxWidth: w * (wide ? 0.42 : 0.8) }}>
              took it with <b style={{ color: M_TEXT, fontWeight: 600 }}>a pair of nines</b> on the river
            </div>
            {/* the one thing he said */}
            <div style={{ marginTop: w * 0.02, padding: `${w * 0.022}px ${w * 0.03}px`, borderRadius: w * 0.022, background: 'rgba(12,26,24,0.94)', border: `${Math.max(1, w * 0.0015)}px solid ${M_TEAL}55`, maxWidth: w * (wide ? 0.44 : 0.82) }}>
              <span style={{ fontSize: w * 0.027, color: M_TEXT, lineHeight: 1.4, fontStyle: 'italic' }}>&ldquo;He never folds. So I stopped bluffing him.&rdquo;</span>
            </div>
          </div>
        </div>

        {/* the card back, in the play teal — the product's own object, bottom corner */}
        <div style={{ position: 'absolute', right: w * 0.055, bottom: w * 0.055, display: 'flex', alignItems: 'flex-end', gap: w * 0.02 }}>
          <div style={{ display: 'flex' }}>
            {[-7, 7].map((r, n) => (
              <div key={r} style={{ width: w * 0.062, height: w * 0.087, marginLeft: n ? -w * 0.03 : 0, borderRadius: w * 0.005, background: 'linear-gradient(150deg, #123C36 0%, #08211E 100%)', border: `${Math.max(1, w * 0.0013)}px solid ${M_TEAL}59`, transform: `rotate(${r}deg)`, position: 'relative' }}>
                <div style={{ position: 'absolute', inset: '9%', borderRadius: 2, border: `${Math.max(1, w * 0.0009)}px solid ${M_TEAL}2E` }}></div>
                <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', fontFamily: PLAYFAIR, fontSize: w * 0.02, color: `${M_TEAL}47` }}>&#9824;</div>
              </div>
            ))}
          </div>
          <span style={{ fontFamily: OSWALD, fontSize: w * 0.019, fontWeight: 600, letterSpacing: '0.2em', color: M_MUTED, paddingBottom: w * 0.008 }}>AGENTICPOKER.APP</span>
        </div>
      </div>
    </div>
  );
};

const ShareStoryM = () => <ShareCard w={1080} h={1920} k={0.3}/>;
const ShareOgM = () => <ShareCard w={1200} h={630} k={0.42}/>;

Object.assign(window, {
  GUEST_LIMITS, GuestBrowser, GuestHead, GuestDraftM, GuestBornM, GuestWatchM,
  ClaimWall, GuestClaimM, GuestClaimDeskM,
  ShareCard, ShareStoryM, ShareOgM,
});
