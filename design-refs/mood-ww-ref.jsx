// WATCH & WALLET — the reference sheets. Findings, laws, the haptic/sound contract,
// the extended state matrix, and the two port fixes with numbers attached.

// ── S0 · the playtest, and what each finding cost ───────────────────────────
const FINDINGS = [
  { n: '1', said: 'Everything appears at once, at machine speed.',
    was: 'The felt had one state. A $60 pot and a $3,694 pot were drawn identically, and a hand resolved in the time it took to render it.',
    now: 'Four server-driven pacing states — CALM, HEATING, ALL-IN, SHOWDOWN — with a 3\u20135s hold on the all-in and a held reveal.',
    law: 'the hold exists only while a spectator is present' },
  { n: '2', said: 'The money on the line is a small number in a corner.',
    was: 'Equity was one of four rows in an analysis stack, at 12.5px, below the fold on a short phone.',
    now: 'A tug-of-war bar directly under the board: him on one end, the villain on the other, the seam moving on every street.',
    law: 'the one thing a non-poker player reads' },
  { n: '3', said: 'The decision line reads like a solver.',
    was: '\u201cSolver line \u00b7 BET 50% \u00b7 matches his action\u201d, next to pot odds and fold equity.',
    now: 'One line of thread voice, \u226412 words. \u201cAce-ten. Fine. Let\u2019s see who\u2019s home.\u201d',
    law: 'long voice lives in the thread; the felt gets one line' },
];

const WatchFindingsSheetM = () => (
  <Sheet title="&ldquo;A simulation, not a game.&rdquo;" sub="Jens, prod, Telegram iOS, 2026-09-05. Three findings, and they are the same finding three times: nothing on the watch screen had any tension in it. The felt, the LiveBar row and every law survive this wave — what changes is pacing, one bar, and the register of one sentence.">
    {FINDINGS.map((f, i) => (
      <div key={f.n} style={{ display: 'flex', gap: 18, padding: '15px 0', borderTop: i ? `1px solid ${M_BORDER}` : 'none' }}>
        <span style={{ fontFamily: MONO, fontSize: 11, color: M_RED, width: 16, flexShrink: 0, paddingTop: 3 }}>{f.n}</span>
        <div style={{ width: 250, flexShrink: 0 }}>
          <div style={{ fontFamily: PLAYFAIR, fontSize: 17, fontWeight: 600, color: M_TEXT, lineHeight: 1.35 }}>{f.said}</div>
          <div style={{ marginTop: 8 }}><Num size={9} color={M_MUTED} weight={500}>PLAYTEST VERDICT</Num></div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr', rowGap: 9, columnGap: 12, fontSize: 12.5, lineHeight: 1.5 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, paddingTop: 2 }}>WAS</span>
            <span style={{ color: M_MUTED }}>{f.was}</span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: M_TEAL, paddingTop: 2 }}>NOW</span>
            <span style={{ color: M_DIM }}>{f.now}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_GOLD, marginTop: 9, opacity: .9 }}>{f.law}</div>
        </div>
      </div>
    ))}
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
        <SyLbl color={M_RED}>Removed, not restyled</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          The LIVE ANALYSIS / RANGE / HISTORY tabs are gone; <b style={{ color: M_TEXT }}>READ and CHAT</b> remain. The table-id &middot; blinds &middot; street line under the board is gone \u2014 street and to-call moved into the LiveBar row. Pot odds, fold equity and solver lines are gone from the felt entirely: they were the solver speaking over him.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>Bugs fixed in the same pass</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          The sit-out control no longer overlaps the chat list or composer \u2014 it lives in the between-hands strip and nowhere else. <b style={{ color: M_TEXT }}>Hero equity shows from the deal</b>, never a dash while he is to act; before the flop the rope sits dead centre rather than empty.
        </div>
      </div>
    </div>
  </Sheet>
);

// ── S1 · pacing ladder ──────────────────────────────────────────────────────
const PaceSheetM = () => (
  <Sheet title="Four states, one ladder" sub="Server-driven, not a UI mode: the client is told which state it is in. CALM is the default and looks exactly like the felt that shipped — the other three earn their difference.">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {Object.keys(PACE).map(k => (
        <div key={k} style={{ padding: '13px 14px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${PACE[k].color}44` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', color: PACE[k].color }}>{PACE[k].label}</div>
          <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.55, marginTop: 8 }}>{PACE[k].note}</div>
        </div>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '104px repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
      <div/>
      {Object.keys(PACE).map(k => <div key={k} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED }}>{PACE[k].label}</div>)}
      {[
        ['ENTERS ON', ['a deal', 'pot > 12\u00d7 the big blind', 'a stack committed', 'the last card, or a fold to a jam']],
        ['FELT', ['as shipped', 'warms, inset gold glow', 'red glow, breathing', 'teal edge, pot slides']],
        ['POT TICKER', ['23px', '30px, gold pill', '30px, red pill', 'slides to the winner']],
        ['DURATION', ['unbounded', 'until the pot resolves', '3\u20135s hold', '\u2248 2s reveal + 1s hold']],
        ['UNWATCHED', ['identical', 'identical', 'no hold \u2014 resolves at speed', 'no hold \u2014 becomes a replay']],
      ].map(([label, cells]) => (
        <React.Fragment key={label}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, paddingTop: 11 }}>{label}</div>
          {cells.map((c, i) => (
            <div key={i} style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.45, padding: '9px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{c}</div>
          ))}
        </React.Fragment>
      ))}
    </div>
    <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
      <SyLbl color={M_GOLD}>Why the hold is spectator-only</SyLbl>
      <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
        A five-second pause that nobody sees is five seconds of a worse win rate. Held only for a watcher, the same pause costs nothing and buys the whole beat &mdash; and it means <b style={{ color: M_TEXT }}>watching is never the optimal way to play</b>, which keeps the product honest about being a manager game rather than a clicker.
      </div>
    </div>
  </Sheet>
);

// ── S2 · haptics and sound, as a contract ───────────────────────────────────
const HAPTICS = [
  { ev: 'Card dealt', hap: 'impactOccurred(\u2018light\u2019)', snd: 'deal tick \u00b7 12ms', note: 'one per card, 90ms apart' },
  { ev: 'His action posts', hap: 'impactOccurred(\u2018medium\u2019)', snd: 'chip set down', note: 'only his \u2014 never an opponent\u2019s' },
  { ev: 'HEATING entered', hap: 'impactOccurred(\u2018rigid\u2019)', snd: 'low swell, 400ms', note: 'once per hand, never repeated' },
  { ev: 'ALL-IN entered', hap: 'notificationOccurred(\u2018warning\u2019)', snd: 'heavy hit + room hush', note: 'the loudest thing in the product' },
  { ev: 'Runout card', hap: 'impactOccurred(\u2018soft\u2019)', snd: 'deal tick, pitched up', note: 'during the hold only' },
  { ev: 'Won the pot', hap: 'notificationOccurred(\u2018success\u2019)', snd: 'chips sliding, 700ms', note: 'no fanfare, no jingle' },
  { ev: 'Lost the pot', hap: 'impactOccurred(\u2018soft\u2019)', snd: 'silence', note: 'losing is quiet on purpose' },
  { ev: 'Read forms', hap: 'selectionChanged()', snd: 'none', note: 'the panel animates instead' },
  { ev: 'Prediction correct', hap: 'impactOccurred(\u2018light\u2019)', snd: 'none', note: 'the streak number is the reward' },
  { ev: 'Collect confirmed', hap: 'notificationOccurred(\u2018success\u2019)', snd: 'single soft note', note: 'a transfer, not a jackpot' },
];

const HapticSheetM = () => (
  <Sheet title="Haptics and sound" sub="A contract for the port, not a mockup. Telegram’s HapticFeedback is the only haptic API in play; sound is a second layer with a mute toggle, so every beat in this table has to land on haptics alone — the phone is on silent in a bar.">
    <div style={{ display: 'grid', gridTemplateColumns: '168px 232px 1fr 1fr', gap: '0 14px' }}>
      {['Event', 'Telegram haptic', 'Sound', 'Notes'].map(h => (
        <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>{h}</div>
      ))}
      {HAPTICS.map(r => (
        <React.Fragment key={r.ev}>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 12.5, color: M_TEXT }}>{r.ev}</div>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontFamily: MONO, fontSize: 10.5, color: M_TEAL }}>{r.hap}</div>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 12, color: r.snd === 'silence' || r.snd === 'none' ? M_MUTED : M_DIM }}>{r.snd}</div>
          <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED }}>{r.note}</div>
        </React.Fragment>
      ))}
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>Rules</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Haptics fire on <b style={{ color: M_TEXT }}>his</b> events only. Never two inside 120ms. Nothing fires while the app is backgrounded, and nothing fires for an unwatched hand. <b style={{ color: M_TEXT }}>Losing is quiet</b> &mdash; a loss sound is the product telling the owner off, and there is no guilt in this design.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
        <SyLbl color={M_RED}>Banned</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Slot-machine reels, coin showers, applause, near-miss stings, and any haptic on an <b style={{ color: M_TEXT }}>opponent&rsquo;s</b> action. The owner is not playing the hand and the device must never imply that he is.
        </div>
      </div>
    </div>
  </Sheet>
);

// ── S3 · the extended state matrix ──────────────────────────────────────────
const WWMatrixM = () => {
  const cols = '116px repeat(6, 1fr)';
  const surfaces = ['Felt / watch', 'Thread', 'Floor', 'Roster', 'YOU screen', 'Notifications'];
  const rows = [
    { k: 'CALM', c: M_MUTED, cells: ['as shipped; rope live from the deal', 'LiveBar docked, no change', 'canon posture', 'live dot', 'pocket unchanged', 'silent'] },
    { k: 'HEATING', c: M_GOLD, cells: ['felt warms, ticker 30px, one rigid tap', 'LiveBar pot goes gold', 'pot ticker grows over the felt', 'pot value goes gold', '\u2014', 'silent \u2014 it resolves in seconds'] },
    { k: 'ALL-IN', c: M_RED, cells: ['3\u20135s hold on his line, red breath', 'LiveBar shows ALL-IN, no timer', 'the diorama holds too', 'row pulses once', '\u2014', 'silent'] },
    { k: 'SHOWDOWN', c: M_TEAL, cells: ['cards flip one at a time, pot slides', 'result line, then the replay card', 'chips slide at the felt', 'P&L updates', 'wallet figure animates', 'batched into the recap'] },
    { k: 'FUNDED', c: M_TEAL, cells: ['stakes match the pocket', 'no announcement', 'he walks to a felt', 'pocket figure on the row', 'pocket bar full', 'silent \u2014 the owner did it'] },
    { k: 'ALLOWANCE', c: M_TEAL, cells: ['unchanged', 'he names the number once', 'unchanged', 'ALLOWANCE tag', 'bar drains toward zero', 'one ping at 20% left'] },
    { k: 'AUTO', c: M_GOLD, cells: ['unchanged', 'a refill line, in his voice', 'unchanged', 'AUTO tag', 'refill shown against the cap', 'silent until the cap is hit'] },
    { k: 'BROKE', c: M_MUTED, cells: ['he is not at a felt', '\u201cI\u2019m out. Your call.\u201d + fund dock', 'at the bar, POCKET $0 chip', 'pocket $0, no P&L', 'Fund is the row action', 'one ping, once, no nagging'] },
    { k: 'CUT OFF', c: M_MUTED, cells: ['not seated', 'nothing pending, no plea', 'at the bar, indefinitely', 'CUT OFF tag', 'row still shows what he keeps', 'never'] },
  ];
  return (
    <Sheet title="State matrix · pacing and money" sub="The third matrix on the wall, in the shape of the other two. Pacing states are within-hand and last seconds; money states are between-session and last as long as the owner leaves them. Nothing in either column touches an attribute.">
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>
        <div/>
        {surfaces.map(h => <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingLeft: 11 }}>{h}</div>)}
      </div>
      {rows.map((r, ri) => (
        <div key={r.k} style={{ display: 'grid', gridTemplateColumns: cols, gap: 10, padding: '9px 0', borderBottom: `1px solid ${M_BORDER}`, alignItems: 'stretch', background: ri === 4 ? `${M_TEAL}05` : 'transparent' }}>
          <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', color: r.c, paddingTop: 10 }}>{r.k}</div>
          {r.cells.map((c, i) => (
            <div key={i} style={{ fontSize: 11.5, color: c === '\u2014' ? M_FAINT : M_DIM, lineHeight: 1.45, padding: '9px 11px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>{c}</div>
          ))}
        </div>
      ))}
      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
        <SyLbl color={M_RED}>The row that is deliberately empty</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          There is no <b style={{ color: M_TEXT }}>notification</b> for a hot pot, an all-in or a showdown. A push that says &ldquo;come and watch this&rdquo; is the mechanic that turns a manager game into a slot machine, and the notification ladder is already full. <b style={{ color: M_TEXT }}>Money pings once and never nags</b>: at 20% of an allowance, and when the pocket is empty.
        </div>
      </div>
    </Sheet>
  );
};

// ── S4 · header heights, with numbers the port can hit ──────────────────────
const HEADS = [
  { k: 'iOS status bar', was: 44, now: 44, note: 'device \u2014 not ours to change' },
  { k: 'GlobalHeader', was: 48, now: 40, note: 'controls stay 29px; vertical padding 2/8, not 2/10' },
  { k: 'MoodBand', was: 64, now: 56, note: 'ghost 42\u219238, cause line stays 11.5px' },
  { k: 'LiveBar (docked)', was: 82, now: 76, note: 'unchanged content, tighter top pad' },
  { k: 'Tabs (READ / CHAT)', was: 42, now: 36, note: 'two tabs need less reach than four' },
  { k: 'Composer', was: 64, now: 64, note: 'hit target \u2014 never shrinks' },
  { k: 'TabBar', was: 56, now: 56, note: 'hit target \u2014 never shrinks' },
];

const HeaderSheetM = () => {
  const wasSum = 48 + 64 + 42, nowSum = 40 + 56 + 36;
  return (
    <Sheet title="Header heights, in pixels" sub="Port finding: the birth and thread headers ate the screen — a title row plus a status strip plus a bar, before any content. The fix is not a redesign, it is a number per row that the port has to hit.">
      <div style={{ display: 'flex', gap: 26 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '164px 58px 58px 1fr', gap: '0 12px' }}>
            {['Row', 'Was', 'Now', 'How'].map(h => (
              <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>{h}</div>
            ))}
            {HEADS.map(r => (
              <React.Fragment key={r.k}>
                <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 12.5, color: M_TEXT }}>{r.k}</div>
                <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontFamily: MONO, fontSize: 11.5, color: M_MUTED }}>{r.was}</div>
                <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: r.was !== r.now ? M_TEAL : M_MUTED }}>{r.now}</div>
                <div style={{ padding: '10px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED }}>{r.note}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div style={{ width: 300, flexShrink: 0 }}>
          <SyLbl color={M_TEAL}>What the 22px buys</SyLbl>
          <div style={{ padding: '13px 15px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
            Chrome above the felt drops from <b style={{ color: M_TEXT }}>{wasSum}px to {nowSum}px</b>. On a 390&times;844 device that is <b style={{ color: M_TEXT }}>22 more pixels of felt</b> \u2014 the difference between the rope sitting under the board and the rope sitting under the fold, which was the whole point of drawing it.
          </div>
          <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
            <SyLbl color={M_GOLD}>Budget, 844 tall</SyLbl>
            <div style={{ fontFamily: MONO, fontSize: 10.5, color: M_DIM, lineHeight: 1.85 }}>
              44 status<br/>40 header<br/>56 mood band<br/>330 felt<br/>36 tabs<br/>282 panel<br/>56 tab bar
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
};

// ── S5 · the desktop overflow ───────────────────────────────────────────────
const DeskFixSheetM = () => (
  <Sheet title="1440 does not fit three columns" sub="Port finding: the thread screen with a panel open overflows by 337px — 340 roster + 917 stage + 520 panel. Both offered options were drawn; the rail wins, because losing the roster loses the thing desktop is for.">
    <div style={{ display: 'flex', gap: 16 }}>
      {[
        { t: 'Chosen \u00b7 the rail collapses', c: M_TEAL, cols: [[68, 'ICONS'], [852, 'THREAD'], [520, 'PANEL']],
          why: 'The roster becomes a 68px avatar strip the moment a panel opens \u2014 mood rims and live dots still read, so you keep the who-is-playing glance that desktop exists for. Reversible in one click, and the thread keeps 852px.' },
        { t: 'Rejected \u00b7 thread replaces the stage', c: M_RED, cols: [[340, 'ROSTER'], [580, 'THREAD'], [520, 'PANEL']],
          why: 'Fits, but it costs the floor. The room going away when you open a card is exactly the modal behaviour the desktop layout was built to avoid \u2014 and it makes the panel a second thread rather than a companion to one.' },
      ].map(o => (
        <div key={o.t} style={{ flex: 1, padding: '14px 16px 16px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${o.c}44` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: o.c }}>{o.t}</div>
          <div style={{ display: 'flex', gap: 3, marginTop: 12, height: 62 }}>
            {o.cols.map(([w, l]) => (
              <div key={l} style={{ flex: w, borderRadius: 5, background: l === 'PANEL' ? `${o.c}14` : 'rgba(255,255,255,0.03)', border: `1px solid ${l === 'PANEL' ? `${o.c}55` : M_BORDER}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, minWidth: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: M_DIM }}>{w}</span>
                <span style={{ fontFamily: OSWALD, fontSize: 7.5, letterSpacing: '0.12em', color: M_MUTED, whiteSpace: 'nowrap' }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, marginTop: 8 }}>{o.cols.reduce((s, c) => s + c[0], 0)} / 1440</div>
          <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.55, marginTop: 10 }}>{o.why}</div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
        <SyLbl color={M_GOLD}>1280 &times; 800</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Same rule, tighter: rail 68, panel 460, stage takes the rest (752). Below 1180 the panel becomes an overlay on the stage rather than a column &mdash; <b style={{ color: M_TEXT }}>the roster strip is the last thing to go</b>, because it is the only always-on answer to &ldquo;what are my agents doing&rdquo;.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>Implementation</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          One prop: <span style={{ fontFamily: MONO, fontSize: 11 }}>ThreadRosterRail collapsed</span>. Same component, same rows, same order \u2014 name, state tag and last line drop out, avatar and live dot stay. Every three-column composition passes it; two-column screens never do.
        </div>
      </div>
    </div>
  </Sheet>
);

Object.assign(window, {
  FINDINGS, HAPTICS, HEADS,
  WatchFindingsSheetM, PaceSheetM, HapticSheetM, WWMatrixM, HeaderSheetM, DeskFixSheetM,
});
