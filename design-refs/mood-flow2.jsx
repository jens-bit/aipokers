// FORWARD MOTION — the chain. Finding 1: after a suggestion chip the recruiter said
// "Let's go" and the screen offered nothing to press.
//
// THE RULE THIS WAVE ADDS: every screen in draft → birth → floor → watch has exactly
// ONE primary action, and it names the next screen. Where a composer sits and there is
// a usable brief, the composer gives up its place to that action — talking is still
// available, demoted to a text link. A chip is a decision, so the strip fills the
// moment one is tapped: dashes after a chip were the bug.

const CHAIN = [
  { k: 'DRAFT', screen: 'Draft · brief usable', act: 'Deal him in',
    why: 'the strip is full and the nature has formed — there is nothing left to ask' },
  { k: 'BIRTH', screen: 'The card he was born with', act: 'Deal him in',
    why: 'the same verb, because it is the same intent, now confirmed against a name' },
  { k: 'FLOOR', screen: 'The floor · he walks in', act: 'Watch him',
    why: 'he crosses the room to a seat; the action follows him rather than the screen' },
  { k: 'WATCH', screen: 'His first hand', act: 'Chat',
    why: 'the chain ends where the product lives — the only exit is into conversation' },
];

const FlowStrip = ({ w = 1180 }) => (
  <div style={{ width: w, background: M_PANEL, border: `1px solid ${M_BORDER}`, borderRadius: 14, padding: '18px 20px 20px', fontFamily: INTER }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
      <Lbl size={9.5} color={M_TEAL}>The chain</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      <Num size={9} color={M_MUTED} weight={500}>ONE PRIMARY ACTION PER SCREEN, AND IT NAMES THE NEXT ONE</Num>
    </div>
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
      {CHAIN.map((c, i) => (
        <React.Fragment key={c.k}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>{c.k}</div>
            <div style={{ fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT, marginTop: 6, lineHeight: 1.3 }}>{c.screen}</div>
            <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 13px', borderRadius: 7, background: i === 3 ? 'transparent' : M_TEAL, border: i === 3 ? `1px solid ${M_BORDER_2}` : 'none' }}>
              <span style={{ fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: i === 3 ? M_DIM : '#0A0A0A' }}>{c.act}</span>
            </div>
            <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 10, paddingRight: 16 }}>{c.why}</div>
          </div>
          {i < CHAIN.length - 1 && (
            <div style={{ width: 34, flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}>
              <svg width="22" height="12" viewBox="0 0 24 14" fill="none" stroke={M_TEAL} strokeWidth="1.6" strokeLinecap="round"><path d="M1 7h19M15 2l5 5-5 5"/></svg>
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${M_BORDER}`, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '11px 13px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33`, fontSize: 11.5, color: M_DIM, lineHeight: 1.55 }}>
        <b style={{ color: M_TEXT }}>Talking is never taken away.</b> Where the composer gives up its place, it becomes a text link under the button &mdash; &ldquo;or keep describing him&rdquo; &mdash; and one tap restores the full composer with the brief intact.
      </div>
      <div style={{ flex: 1, padding: '11px 13px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33`, fontSize: 11.5, color: M_DIM, lineHeight: 1.55 }}>
        <b style={{ color: M_TEXT }}>No dead ends and no dashes.</b> &ldquo;Let&rsquo;s go&rdquo; with nothing to press is gone. A chip is a decision: tapping one fills all four dials and forms the nature, so the strip never shows &mdash; after a tap.
      </div>
    </div>
  </div>
);

// ── the composer's place, taken ─────────────────────────────────────────────
// Same 64px band, same border, same padding as ChatComposer — so the swap reads as
// the same object changing its mind rather than a new bar appearing.
const NextAction = ({ label, sub, link = 'or keep describing him' }) => (
  <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '10px 14px 20px' }}>
    {sub && <div style={{ marginBottom: 8, textAlign: 'center' }}><Num size={9} color={M_MUTED} weight={500}>{sub}</Num></div>}
    <Btn kind="primary" h={48} full>{label}</Btn>
    <div style={{ marginTop: 9, textAlign: 'center' }}>
      <span style={{ fontSize: 12, color: M_MUTED, borderBottom: `1px solid ${M_BORDER_2}`, paddingBottom: 1, cursor: 'pointer' }}>{link}</span>
    </div>
  </div>
);

// ── the forming chip, reading the real nature ───────────────────────────────
// Was hardcoded and dashed. Now it reads the nature the brief actually implies and
// stops being a guess once the strip is full: FORMING · ROCK? becomes ROCK.
const NatureFormed = ({ nature, up, dn, guess }) => guess ? (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 28, padding: '0 11px', borderRadius: 4, border: `1px dashed ${M_GOLD}55` }}>
    <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: M_MUTED }}>Forming</span>
    <span style={{ width: 1, height: 12, background: `${M_GOLD}44` }}/>
    <span style={{ fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: M_GOLD, opacity: .75 }}>{nature}?</span>
  </div>
) : <NatureBadge nature={nature} up={up} dn={dn}/>;

// ═══ 1 · DRAFT, one chip in — the bug screen, fixed ═════════════════════════
const FlowDraftScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="New agent"/>
    <DraftBand phase={0.86} cause="aggressive bluffer · high variance" action="Skip" ready/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10 }}>
      <OwnerBubble time="09:41">Aggressive bluffer</OwnerBubble>
      <RecruiterBubble time="09:41">
        Understood. Wide opens, three barrels, and he will get caught sometimes.
      </RecruiterBubble>
      <div style={{ padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
        <DraftStrip style={78} risk={71} tight={34} aggr={82}/>
      </div>
      <RecruiterBubble time="09:41">
        That is a whole agent. His temperament came out combustible &mdash; not something you set.
      </RecruiterBubble>
      <div style={{ padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
        <NatureFormed nature="Hothead" up="DECEPTION" dn="COMPOSURE"/>
      </div>
      <RecruiterBubble time="09:42">
        Add anything you like, or put him in a seat.
      </RecruiterBubble>
    </div>
    <NextAction label="Deal him in" sub="STRATEGY SET · NATURE FORMED"/>
  </PhoneShell>
);

// ═══ 4 · HIS FIRST HAND — the chain's last screen ═══════════════════════════
// Composed from Watch v3's parts, untouched: PaceFelt, TugBar, HeroRow3, Tabs3.
const FlowFirstHandScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <MoodBand accent={M_TEAL} mood="neutral" state="live" action="Chat"
      cause="first hand — 30 seconds old"/>
    <PaceFelt pace="calm" h={330} pot="30" board={[null, null, null, null, null]} flip={0}
      equity={54} bottomBand={80} line="Right. Let's find out what I am.">
      <HeroRow3 street="PREFLOP" note="he's in"/>
    </PaceFelt>
    <Tabs3 active="read"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG }}>
      <ReadPanel rows={READ_EMPTY} hands={0} line="Give me a few hands."/>
    </div>
  </PhoneShell>
);

// ── the chain, on desktop ───────────────────────────────────────────────────
const D4FlowScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$340" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <ThreadRosterRail active="Hothead v1.0" collapsed/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG }}>
        <DraftBand phase={0.86} cause="aggressive bluffer · high variance" action="Skip" ready/>
        <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '18px 22px' }}>
          <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ alignSelf: 'flex-end', background: `${M_TEAL}14`, border: `1px solid ${M_TEAL}44`, borderRadius: 12, padding: '11px 15px', fontSize: 13.5, color: M_TEXT }}>Aggressive bluffer</div>
            <div style={{ background: M_PANEL_2, border: `1px solid ${M_BORDER_2}`, borderRadius: 12, padding: '13px 16px', fontSize: 13.5, color: M_TEXT, lineHeight: 1.55 }}>
              Understood. Wide opens, three barrels, and he will get caught sometimes.
              <div style={{ marginTop: 8 }}><Num size={9} color={M_MUTED} weight={500}>RECRUITER</Num></div>
            </div>
            <NatureFormed nature="Hothead" up="DECEPTION" dn="COMPOSURE"/>
          </div>
        </div>
        <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: M_MUTED, borderBottom: `1px solid ${M_BORDER_2}`, cursor: 'pointer' }}>or keep describing him</span>
          <div style={{ flex: 1 }}/>
          <Num size={9} color={M_MUTED} weight={500}>STRATEGY SET &middot; NATURE FORMED</Num>
          <div style={{ width: 200 }}><Btn kind="primary" h={44} full>Deal him in</Btn></div>
        </div>
      </div>
      <Panel>
        <PanelHead title="Taking shape" sub="86% DEFINED"/>
        <RailBody>
          <DraftProfile phase={0.86} style={78} risk={71} tight={34} aggr={82}/>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, fontSize: 12, color: M_DIM, lineHeight: 1.55 }}>
            <Lbl size={9.5} color={M_TEAL}>What happens on the button</Lbl>
            <div style={{ marginTop: 6 }}>He is born, names himself, and walks onto the floor. His temperament is read from this conversation and <b style={{ color: M_TEXT }}>cannot be changed afterwards</b>.</div>
          </div>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  CHAIN, FlowStrip, NextAction, NatureFormed,
  FlowDraftScreenM, FlowFirstHandScreenM, D4FlowScreenM,
});
