// THE SHAREABLE LINE — the growth loop the playtest found.
//
// People screenshot him. They were already doing it with the OS screenshot button,
// cropping a chat bubble badly and posting it. So the product should hand them the
// card it wants them to post: his ghost, his line, and the one piece of context
// that makes the line land — "after losing as the 68% favourite".
//
// LONG-PRESS ANY LINE OF HIS. Thread or TABLE tab, live or hours old. Not a button
// on every bubble — a gesture, so the affordance costs nothing until it is wanted.

const SHARE = {
  line: "Twice. TWICE he backdoors it. I'm fine. I'm FINE.",
  ctx: 'after losing as the 68% favourite',
  name: 'Aggressive v1.3',
  mood: 'tilted',
  accent: M_PURPLE,
  heat: 82,
  stamp: 'HAND #4188 · $10/$20',
};

// ── the long-press ──────────────────────────────────────────────────────
// The bubble lifts, the rest of the thread drops back, and three options appear.
// Share is first because it is the one people were already doing by hand.
const LongPressSheet = () => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 8, background: M_PANEL, borderTop: `1px solid ${M_BORDER_2}`, borderTopLeftRadius: 18, borderTopRightRadius: 18, boxShadow: '0 -18px 40px rgba(0,0,0,0.55)', padding: '9px 14px 18px' }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 13 }}>
      <div style={{ width: 34, height: 4, borderRadius: 2, background: M_FAINT }}/>
    </div>
    {[
      { icon: 'sparkle', label: 'Share this line', sub: 'a card with his ghost and the moment', primary: true },
      { icon: 'edit', label: 'Copy text', sub: 'just the words' },
      { icon: 'risk', label: 'Open the hand', sub: 'hand #4188 · replay, 28s' },
    ].map(o => (
      <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px', borderRadius: 11, marginBottom: 8, background: o.primary ? `${M_TEAL}0D` : M_PANEL_2, border: `1px solid ${o.primary ? `${M_TEAL}44` : M_BORDER}`, cursor: 'pointer' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: o.primary ? `${M_TEAL}14` : 'rgba(255,255,255,0.04)', border: `1px solid ${o.primary ? `${M_TEAL}55` : M_BORDER_2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={o.icon} size={14} color={o.primary ? M_TEAL : M_MUTED}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: o.primary ? M_TEXT : M_DIM }}>{o.label}</div>
          <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 1 }}>{o.sub}</div>
        </div>
      </div>
    ))}
  </div>
);

const ThreadLongPressScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title={SHARE.name}/>
    <HeatBand accent={SHARE.accent} mood={SHARE.mood} heat={SHARE.heat} state="resting" action="Deploy"
      cause="steaming — two rivers called back"/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <div style={{ paddingTop: 10, opacity: 0.4 }}>
        <SysLine>Session ended · 18:04</SysLine>
      </div>
      {/* the pressed line: lifted, ringed, and the only thing at full opacity */}
      <div style={{ transform: 'scale(1.02)', transformOrigin: 'left center' }}>
        <div style={{ margin: `0 ${CANON.pad}px 9px`, display: 'flex', gap: 9, alignItems: 'flex-end' }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: '#0A0F17', border: `1px solid ${SHARE.accent}55`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
            <MoodGhost mood={SHARE.mood} accent={SHARE.accent} size={27} ring={false}/>
          </div>
          <div style={{ maxWidth: 262 }}>
            <div style={{ background: M_PANEL_2, border: `1px solid ${M_TEAL}`, borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 13px', boxShadow: `0 0 0 3px ${M_TEAL}1F, 0 6px 18px rgba(0,0,0,0.5)` }}>
              <div style={{ fontSize: 13.5, color: M_TEXT, lineHeight: 1.5 }}>{SHARE.line}</div>
            </div>
            <div style={{ marginTop: 3, paddingLeft: 2 }}><Num size={9} color={M_TEAL} weight={500}>HELD &middot; 18:04</Num></div>
          </div>
        </div>
      </div>
      <div style={{ opacity: 0.4 }}>
        <OwnerBubble time="18:06">You played it right. Both times.</OwnerBubble>
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,10,0.35)', pointerEvents: 'none' }}/>
      <LongPressSheet/>
    </div>
  </PhoneShell>
);

// ── the card ────────────────────────────────────────────────────────────
// Two crops, one composition. The line is the hero and it is set in Playfair at the
// biggest size that fits — because the thing being shared is a sentence. The ghost
// is the proof it came from somewhere, the context line is why it is funny, and the
// mark is small enough not to look like an ad.
const ShareCard = ({ w = 340, h = 340, story }) => {
  const pad = story ? 30 : 26;
  return (
    <div style={{
      width: w, height: h, position: 'relative', overflow: 'hidden', flexShrink: 0,
      background: `radial-gradient(ellipse at 50% ${story ? 34 : 40}%, #24302c 0%, #171f1d 58%, #0e1413 100%)`,
      fontFamily: INTER, borderRadius: 4,
    }}>
      {/* the felt's own arc, as the only ornament */}
      <div style={{ position: 'absolute', left: '-18%', right: '-18%', top: story ? 96 : 60, height: h * 0.62, borderRadius: '50%', border: `1px solid ${M_TEAL}1F` }}/>
      <div style={{ position: 'absolute', left: '50%', top: story ? '30%' : '32%', width: w * 0.9, height: w * 0.9, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${MOODS[SHARE.mood].color}26, transparent 68%)` }}/>

      <div style={{ position: 'absolute', left: pad, right: pad, top: story ? 56 : 30, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <MoodGhost mood={SHARE.mood} accent={SHARE.accent} size={story ? 92 : 74} ring={false}/>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: story ? 12.5 : 11.5, color: M_DIM, fontWeight: 500 }}>{SHARE.name}</span>
          <MoodChip mood={SHARE.mood} small/>
        </div>
      </div>

      <div style={{ position: 'absolute', left: pad, right: pad, top: story ? 250 : 148 }}>
        <div style={{
          fontFamily: PLAYFAIR, fontWeight: 600, color: M_TEXT, textAlign: 'center',
          fontSize: story ? 27 : 21, lineHeight: 1.28, letterSpacing: '-0.01em',
        }}>&ldquo;{SHARE.line}&rdquo;</div>
        <div style={{ marginTop: story ? 20 : 14, display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'center' }}>
          <div style={{ width: 18, height: 1, background: M_BORDER_2 }}/>
          <span style={{ fontSize: story ? 12.5 : 11.5, color: MOODS[SHARE.mood].color, fontStyle: 'italic' }}>{SHARE.ctx}</span>
          <div style={{ width: 18, height: 1, background: M_BORDER_2 }}/>
        </div>
      </div>

      <div style={{ position: 'absolute', left: pad, right: pad, bottom: story ? 34 : 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <SpadeLogo/>
        <span style={{ fontFamily: OSWALD, fontSize: story ? 11 : 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: M_TEXT }}>Agentic Poker</span>
        <div style={{ flex: 1 }}/>
        <span style={{ fontFamily: MONO, fontSize: story ? 9 : 8.5, color: M_MUTED, letterSpacing: '0.06em' }}>{SHARE.stamp}</span>
      </div>
    </div>
  );
};

const ShareCropsM = () => (
  <div style={{ display: 'flex', gap: 26, alignItems: 'flex-start', fontFamily: INTER }}>
    <div>
      <div style={{ marginBottom: 9 }}><Lbl size={9.5}>Telegram &middot; 1:1</Lbl></div>
      <ShareCard w={340} h={340}/>
      <div style={{ width: 340, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 10 }}>
        Exports 1080&times;1080. The square is the default because a Telegram forward shows it whole, and the line has to survive being seen at 240px in a chat list.
      </div>
    </div>
    <div>
      <div style={{ marginBottom: 9 }}><Lbl size={9.5}>Instagram story &middot; 9:16</Lbl></div>
      <ShareCard w={300} h={533} story/>
      <div style={{ width: 300, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 10 }}>
        Exports 1080&times;1920. Same composition, more air: the ghost grows, the line goes to 27px, and the mark sits clear of the story UI&rsquo;s bottom furniture.
      </div>
    </div>
    <div style={{ width: 300 }}>
      <div style={{ marginBottom: 9 }}><Lbl size={9.5} color={M_TEAL}>Why this and not a screenshot</Lbl></div>
      <div style={{ padding: '13px 15px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${M_TEAL}33`, fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
        People were <b style={{ color: M_TEXT }}>already screenshotting him</b> — badly cropped bubbles with the composer and the status bar still in shot. The card gives them the version that reads: <b style={{ color: M_TEXT }}>the ghost as proof it came from somewhere</b>, the line as the hero in Playfair, and one context clause that makes it funny rather than random.
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${M_BORDER}` }}>
          <SyLbl color={M_GOLD}>The context clause is the whole trick</SyLbl>
          <div style={{ marginTop: -3 }}>
            &ldquo;I&rsquo;m fine. I&rsquo;m FINE.&rdquo; is a joke about nothing on its own. <i>After losing as the 68% favourite</i> is what makes it a poker joke, and it is the one line the product knows and the screenshotter would have had to type.
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33`, fontSize: 11.5, color: M_DIM, lineHeight: 1.6 }}>
        <SyLbl color={M_RED}>Not on the card</SyLbl>
        <div style={{ marginTop: -3 }}>
          No invite code, no referral link, no &ldquo;get your own agent&rdquo; button, no QR. The mark and the hand stamp, and nothing else. <b style={{ color: M_TEXT }}>A card that asks for a signup is an ad</b>, and people do not forward ads.
        </div>
      </div>
    </div>
  </div>
);

// ── the matrix rows this wave adds ──────────────────────────────────────
const Wave40MatrixM = () => {
  const cols = '118px repeat(5, 1fr)';
  const surfaces = ['Floor ghost', 'Mood band', 'Thread', 'Watch felt', 'Profile'];
  const rows = [
    { k: 'HEAT 0–24', c: M_MUTED, cells: ['7.2s bob, 6% aura', 'aura only, barely there', 'avatar at rest', 'seated, loose', '—'] },
    { k: 'HEAT 25–49', c: M_TEAL, cells: ['canon bob and aura', 'canon', 'canon', 'canon', '—'] },
    { k: 'HEAT 50–74', c: M_GOLD, cells: ['faster bob, aura up', 'well glow lifts', 'avatar aura reads at 28px', 'leaning in', '—'] },
    { k: 'HEAT 75–100', c: M_RED, cells: ['2.6s bob, 28% aura', 'band chip reads BOILING in gold', 'the needle is visible in one message', 'coiled', '—'] },
    { k: 'NEEDLE LANDED', c: M_TEAL, cells: ['posture eases over ~2s', 'chip band may step down', 'a heat row: 82 → 70, and the bound', '—', '—'] },
    { k: 'WANT PENDING', c: M_GOLD, cells: ['gold ASKING pip at his feet, no blink', '—', 'his line, then one card with one action', 'never — he does not ask at a table', '—'] },
    { k: 'WANT ANSWERED', c: M_TEAL, cells: ['pip clears', 'heat steps down nine', 'the transfer receipt, then a different line', '—', '—'] },
    { k: 'WANT IGNORED', c: M_MUTED, cells: ['pip clears on its own', 'no change', 'nothing. He does not ask twice.', '—', '—'] },
    { k: 'LEDGER ASKED', c: M_PURPLE, cells: ['—', '—', 'three or four of his lines, in order, never a list', '—', 'the one line he would lead with today'] },
    { k: 'LINE HELD', c: M_TEAL, cells: ['—', '—', 'bubble lifts and rings, thread drops to 40%, three options', 'same gesture in the TABLE tab', '—'] },
  ];
  return (
    <Sheet title="Ten rows for heat, wants and sharing" sub="Heat is four rows because it is a scale, not a state. The want rows are the ones to read twice: ANSWERED and IGNORED differ by nine points of heat and nothing else — no sulk, no second ask, no memory of the refusal.">
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>
        <div/>
        {surfaces.map(h => <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingLeft: 11 }}>{h}</div>)}
      </div>
      {rows.map(r => (
        <div key={r.k} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '8px 0', borderBottom: `1px solid ${M_BORDER}` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', color: r.c, paddingTop: 10, lineHeight: 1.3 }}>{r.k}</div>
          {r.cells.map((c, i) => (
            <div key={i} style={{ fontSize: 11, color: c === '—' ? M_FAINT : M_DIM, lineHeight: 1.45, padding: '9px 10px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{c}</div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>Desktop parity, for the wave-39 matrix</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            Heat already has its desktop row (<span style={{ fontFamily: MONO, fontSize: 11 }}>DeskHeatGhost</span> + the roster hairline). Wants add one: <b style={{ color: M_TEXT }}>the card in the rail beside the thread</b>, since desktop can show the ask and the wallet balance it spends from at once. The ledger needs none — it is a conversation, and the thread column is the same on both. <b style={{ color: M_TEXT }}>Long-press becomes right-click</b>, same three options.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
          <SyLbl color={M_GOLD}>The one row that is deliberately blank</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            There is no <b style={{ color: M_TEXT }}>OWNER AWAY</b> row. Not on the floor, not in the band, not in the thread, not in the ledger. Silence moves heat by zero and a week away moves it by zero \u2014 <b style={{ color: M_TEXT }}>heat only ever moves at a table</b>.
          </div>
        </div>
      </div>
    </Sheet>
  );
};

Object.assign(window, {
  SHARE, LongPressSheet, ShareCard, ShareCropsM, Wave40MatrixM, ThreadLongPressScreenM,
});
