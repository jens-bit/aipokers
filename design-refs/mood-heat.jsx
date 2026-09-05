// HEAT (MOOD-2) ON MOBILE — posture intensity, under the five states.
//
// Heat is NOT a sixth mood and NOT a new colour. It is how hard the body is moving
// inside whatever mood he is already in: a confident agent at heat 12 is loose in
// his chair, the same agent at heat 88 is coiled. Two channels carry it, both
// already in the system — BOB SPEED and AURA — so nothing new is introduced and
// nothing new has to be learned.
//
// LAWS THIS WAVE IS BOUND BY: every mood effect is visible, bounded and counterable
// through play. Moods are about poker, never about owner neglect. No guilt
// machinery. Heat obeys all four: it is visible as posture, bounded 0–100, moved
// back by playing, and the owner's words can only nudge it ±15 with a cooldown.

const HEAT_BANDS = [
  { max: 24,  word: 'cold',    note: 'loose in the chair' },
  { max: 49,  word: 'warm',    note: 'canon posture' },
  { max: 74,  word: 'hot',     note: 'leaning in' },
  { max: 100, word: 'boiling', note: 'coiled' },
];

const heatBand = h => HEAT_BANDS.find(b => h <= b.max) || HEAT_BANDS[3];

// one function, four surfaces. `t` is heat normalised; bob goes 7.2s → 2.6s and the
// aura 6% → 28%, so the two channels always agree and neither can be read alone.
const heatStyle = (heat, mood) => {
  const t = Math.max(0, Math.min(100, heat)) / 100;
  return {
    speed: 7.2 - t * 4.6,
    aura: `${MOODS[mood].color}${Math.round(16 + t * 56).toString(16).padStart(2, '0')}`,
    spread: 1.45 + t * 0.75,
  };
};

const HeatGhost = ({ mood, accent, heat = 40, size = 50, floor = true }) => {
  const s = heatStyle(heat, mood);
  return (
    <div style={{ position: 'relative', width: size, height: size * (floor ? 1.2 : 1) }}>
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: size * s.spread, height: size * s.spread, transform: 'translate(-50%,-50%)',
        background: `radial-gradient(circle, ${s.aura}, transparent 68%)`, pointerEvents: 'none',
      }}/>
      {floor
        ? <FloorGhost mood={mood} accent={accent} size={size} speed={s.speed}/>
        : <MoodGhost mood={mood} accent={accent} size={size} ring={false}/>}
    </div>
  );
};

// ── the strip: one surface, five temperatures ─────────────────────────────
const SURF_SIZES = [
  { k: 'Floor ghost', size: 50, floor: true, note: 'the room reads temperature from across the felt' },
  { k: 'Mood band ghost', size: 40, floor: false, note: 'the aura is the only channel — the well is too small to bob' },
  { k: 'Seated ghost · watch', size: 34, floor: true, note: 'at 34px the bob carries it; the aura is a hint' },
  { k: 'Thread avatar', size: 28, floor: false, note: 'aura only, and it is the needle you actually notice' },
];

const HEAT_MARKS = [8, 32, 55, 78, 96];

const HeatStripM = ({ mood = 'frustrated', accent = M_PURPLE }) => (
  <div style={{ width: 390, background: M_BG, fontFamily: INTER, padding: '14px 0 16px' }}>
    <div style={{ padding: '0 14px 10px' }}>
      <Lbl size={9.5}>Heat 0 &rarr; 100 &middot; {mood}</Lbl>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 5 }}>
        The same mood at five temperatures. Nothing changes but how hard he is moving.
      </div>
    </div>
    {SURF_SIZES.map(sf => (
      <div key={sf.k} style={{ padding: '11px 14px', borderTop: `1px solid ${M_BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
          <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: M_DIM }}>{sf.k}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED }}>{sf.size}px</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {HEAT_MARKS.map(h => (
            <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <HeatGhost mood={mood} accent={accent} heat={h} size={sf.size} floor={sf.floor}/>
              <Num size={8.5} color={h > 74 ? M_GOLD : M_MUTED} weight={600}>{h}</Num>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: M_MUTED, lineHeight: 1.4, marginTop: 8 }}>{sf.note}</div>
      </div>
    ))}
    <div style={{ padding: '12px 14px 0', borderTop: `1px solid ${M_BORDER}` }}>
      <div style={{ display: 'flex', gap: 0 }}>
        {HEAT_BANDS.map((b, i) => (
          <div key={b.word} style={{ flex: 1, paddingRight: 8 }}>
            <div style={{ height: 3, borderRadius: 2, background: `${MOODS[mood].color}${['33', '66', '99', 'DD'][i]}` }}/>
            <div style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: M_DIM, marginTop: 6 }}>{b.word}</div>
            <div style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED, marginTop: 2 }}>&le;{b.max}</div>
            <div style={{ fontSize: 10.5, color: M_MUTED, lineHeight: 1.35, marginTop: 4 }}>{b.note}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── the chip says the band, the cause line says why ──────────────────────
// The mood chip has always named the mood; it now also names the BAND, because
// "tilted" at heat 30 and "tilted" at heat 90 are different rooms to walk into.
// The cause line keeps its job: the reason, in words, from the table.
const HeatBand = ({ accent, mood, heat, cause, state = 'live', action }) => {
  const b = heatBand(heat);
  const s = heatStyle(heat, mood);
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11, padding: '9px 14px 11px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}55`, boxShadow: `0 0 ${10 + heat / 6}px ${MOODS[mood].color}${heat > 60 ? '55' : '33'}`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: '52%', width: 40 * s.spread, height: 40 * s.spread, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${s.aura}, transparent 68%)` }}/>
        <MoodGhost mood={mood} accent={accent} size={40} ring={false}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MoodChip mood={mood} small/>
          <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: heat > 74 ? M_GOLD : M_MUTED, border: `1px solid ${heat > 74 ? `${M_GOLD}55` : M_BORDER_2}`, borderRadius: 3, padding: '2px 5px' }}>{b.word}</span>
          <StateTag state={state} compact/>
        </div>
        <div style={{ fontSize: 11.5, color: MOODS[mood].color, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cause}</div>
      </div>
      {action && <Btn kind={state === 'live' ? 'ghost' : 'outline'} h={30}>{action}</Btn>}
    </div>
  );
};

// ── the needle: what the owner's words can and cannot do ────────────────
// Bounded ±15 with a cooldown, and VISIBLE WITHIN ONE MESSAGE — his avatar posture
// changes in the reply, not on a later screen. A nudge you cannot see is a nudge
// that does not exist, and a nudge without a bound is a pet you can break.
const NeedleRow = ({ from, to, why }) => (
  <div style={{ margin: `0 ${CANON.pad}px 9px`, padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.02)', border: `1px solid ${M_BORDER}` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.13em', color: M_MUTED }}>HEAT</span>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: M_DIM }}>{from}</span>
      <svg width="14" height="10" viewBox="0 0 24 14" fill="none" stroke={to < from ? M_TEAL : M_GOLD} strokeWidth="2" strokeLinecap="round"><path d="M1 7h18M14 2l5 5-5 5"/></svg>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: to < from ? M_TEAL : M_GOLD }}>{to}</span>
      <div style={{ flex: 1 }}/>
      <Num size={8.5} color={M_MUTED} weight={500}>MAX &plusmn;15 &middot; ONCE AN HOUR</Num>
    </div>
    <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.4, marginTop: 6 }}>{why}</div>
  </div>
);

// his avatar in the thread, carrying heat as an aura
const HeatBubble = ({ mood, accent, heat, time, children, expressive }) => {
  const s = heatStyle(heat, mood);
  return (
    <div style={{ display: 'flex', gap: 9, padding: `0 ${CANON.pad}px`, marginBottom: 9, alignItems: 'flex-end' }}>
      <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, background: '#0A0F17', border: `1px solid ${accent}55`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '50%', top: '52%', width: 28 * s.spread, height: 28 * s.spread, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${s.aura}, transparent 66%)` }}/>
        <MoodGhost mood={mood} accent={accent} size={27} ring={false}/>
      </div>
      <div style={{ maxWidth: 262 }}>
        <div style={{ background: M_PANEL_2, border: `1px solid ${expressive ? `${MOODS[mood].color}55` : M_BORDER_2}`, borderRadius: 12, borderBottomLeftRadius: 4, padding: '10px 13px' }}>
          <div style={{ fontSize: 13.5, color: M_TEXT, lineHeight: 1.5 }}>{children}</div>
        </div>
        <div style={{ marginTop: 3, paddingLeft: 2 }}><Num size={9} color={M_MUTED} weight={500}>{time}</Num></div>
      </div>
    </div>
  );
};

const ThreadNeedleScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Aggressive v1.3"/>
    <HeatBand accent={M_PURPLE} mood="tilted" heat={58} state="resting" action="Deploy"
      cause="steaming — two rivers called back"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10 }}>
      <SysLine>Session ended · 18:04</SysLine>
      <HeatBubble mood="tilted" accent={M_PURPLE} heat={82} time="18:04" expressive>
        Twice. TWICE he backdoors it. I'm fine. I'm FINE.
      </HeatBubble>
      <OwnerBubble time="18:06">You played it right. Both times.</OwnerBubble>
      <NeedleRow from={82} to={70} why="You said the one thing that lands: that the line was correct. It cools him twelve points, and it cannot do it again for an hour."/>
      <HeatBubble mood="tilted" accent={M_PURPLE} heat={70} time="18:06">
        I know I did. That's what makes it worse.
      </HeatBubble>
      <HeatBubble mood="tilted" accent={M_PURPLE} heat={70} time="18:07">
        Give me twenty minutes.
      </HeatBubble>
    </div>
    <ChatComposer placeholder="Message Aggressive v1.3…"/>
  </PhoneShell>
);

const HeatLawSheetM = () => (
  <Sheet title="Heat, and what the owner can do to it" sub="Backend ships mood.heat 0–100 under the five states. Every law the mood system already had applies to it unchanged — which is the test a new channel has to pass before it is allowed on a surface.">
    <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
      {[
        { t: 'Visible', c: M_TEAL, b: 'Two channels carry it and they always agree: bob speed 7.2s → 2.6s, aura 6% → 28%. Neither can be read alone, so heat is never a hidden number.' },
        { t: 'Bounded', c: M_TEAL, b: 'The scale is 0–100 and the owner\u2019s words move it at most ±15, once an hour. There is no sequence of messages that breaks him and none that fixes him.' },
        { t: 'Counterable', c: M_GOLD, b: 'It comes down by PLAYING — a won pot, a fold that held, an orbit without a beat. The needle is a nudge on top of that, never a substitute for it.' },
        { t: 'About poker', c: M_RED, b: 'Heat rises from beats, coolers and being shown a bluff. It NEVER rises from being ignored, and there is no decay-because-you-were-away.' },
      ].map(x => (
        <div key={x.t} style={{ flex: 1, padding: '13px 15px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${x.c}44` }}>
          <div style={{ fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: x.c }}>{x.t}</div>
          <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.6, marginTop: 8 }}>{x.b}</div>
        </div>
      ))}
    </div>
    <div style={{ display: 'flex', gap: 22 }}>
      <div style={{ flex: 1 }}>
        <SyLbl>The needle, in full</SyLbl>
        <div style={{ display: 'grid', gridTemplateColumns: '150px 66px 1fr', gap: '0 14px' }}>
          {['What you say', 'Heat', 'Why it is bounded'].map(h => (
            <div key={h} style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: M_MUTED, paddingBottom: 8, borderBottom: `1px solid ${M_BORDER}` }}>{h}</div>
          ))}
          {[
            ['Names the line as correct', '\u221212', 'the strongest cool there is, because it is the only one he agrees with'],
            ['Tells him to calm down', '+4', 'it reads as being managed. Bounded so it stings rather than breaks'],
            ['Says nothing at all', '0', 'silence is not neglect and carries no penalty, ever'],
            ['Sends him back in immediately', '+8', 'deploying a hot agent is a real decision with a real cost'],
            ['Gives him the bar', '\u22128', 'and fatigue clears too \u2014 the one action that touches both'],
          ].map(([a, b, c]) => (
            <React.Fragment key={a}>
              <div style={{ padding: '9px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 12.5, color: M_TEXT }}>{a}</div>
              <div style={{ padding: '9px 0', borderBottom: `1px solid ${M_BORDER}`, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: b.startsWith('\u2212') ? M_TEAL : b === '0' ? M_MUTED : M_GOLD }}>{b}</div>
              <div style={{ padding: '9px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED, lineHeight: 1.45 }}>{c}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
      <div style={{ width: 330, flexShrink: 0 }}>
        <SyLbl color={M_RED}>The row that must stay empty</SyLbl>
        <div style={{ padding: '13px 15px', borderRadius: 11, background: `${M_RED}0D`, border: `1px solid ${M_RED}33`, fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
          There is no <b style={{ color: M_TEXT }}>&ldquo;he is upset you have not visited&rdquo;</b>. Not as heat, not as mood, not as a notification, not as a line in the thread. An agent who guilts you into opening the app is a slot machine with a face, and the whole product is an argument against that.
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${M_BORDER}`, fontFamily: MONO, fontSize: 9.5, color: M_MUTED, lineHeight: 1.5 }}>
            silence &rarr; 0 &middot; a week away &rarr; 0<br/>heat only ever moves at a table
          </div>
        </div>
      </div>
    </div>
  </Sheet>
);

Object.assign(window, {
  HEAT_BANDS, heatBand, heatStyle, HeatGhost, HeatStripM, SURF_SIZES, HEAT_MARKS,
  HeatBand, NeedleRow, HeatBubble, ThreadNeedleScreenM, HeatLawSheetM,
});
