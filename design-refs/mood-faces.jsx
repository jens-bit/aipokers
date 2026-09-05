// THE FACES — the reference sheet. The geometry lives in mood-atoms.jsx, because
// it is the atom's own art; this file only renders it at every combination the
// product can produce, so a drift in the atom is visible here first.

const FACE_STATES = [
  { k: 'confident', accent: M_TEAL,   arc: 'calm → smug',        note: 'the one that was broken: its brows rose at the inner corner, which is the worried brow. Now they drop inward and lift outward, and the top tier narrows the eyes to arcs.' },
  { k: 'neutral',   accent: M_TEAL,   arc: 'flat → alert',       note: 'the only state with nothing to express, so intensity shows as attention: the eye opens from 1.5 to 2.3 and a level brow appears at the top.' },
  { k: 'frustrated',accent: M_PURPLE, arc: 'tight → scowling',   note: 'the slit angle carries it — 9°, 14°, 19° — and the brow arrives at the middle tier rather than the top, because a frustrated agent is already frowning.' },
  { k: 'tilted',    accent: M_PURPLE, arc: 'steaming → red-eyed',note: 'the only place in the system where a mood overrides its own colour token: at the top tier the eyes go red, because nothing else reads as red-eyed.' },
  { k: 'sulking',   accent: M_PINK,   arc: 'flat → shut out',    note: 'inverted: intensity CLOSES the face. The lid comes down 0 → 1.9 and the eye flattens, which reads as shutting you out rather than as anger.' },
];

const TIER_HEATS = { low: 16, mid: 50, high: 88 };

const FaceCell = ({ mood, accent, heat, size = 62, label, sub, event }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
    <div style={{ width: 76, height: 76, borderRadius: 14, background: '#0A0F17', border: `1px solid ${accent}33`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
      <MoodGhost mood={mood} accent={accent} size={size} heat={heat} event={event} ring={false}/>
    </div>
    {label && <Num size={9} color={M_MUTED} weight={600}>{label}</Num>}
    {sub && <div style={{ fontSize: 10.5, color: M_MUTED, textAlign: 'center', lineHeight: 1.3, maxWidth: 84 }}>{sub}</div>}
  </div>
);

// ── 15 faces ─────────────────────────────────────────────────────────────
const FacesGridM = () => (
  <Sheet title="Five states, three intensities" sub="Fifteen faces, and the silhouette is identical in all of them — only eyes, brows and glow move. Heat picks the tier, so the art needs no input the backend is not already sending, and there is no sixth state to design or name.">
    <div style={{ display: 'grid', gridTemplateColumns: '128px repeat(3, 96px) 1fr', gap: '0 18px', alignItems: 'center' }}>
      <div/>
      {FACE_TIERS.map(t => (
        <div key={t.k} style={{ textAlign: 'center', paddingBottom: 10 }}>
          <div style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_DIM }}>{t.label}</div>
          <div style={{ marginTop: 3 }}><Num size={9} color={M_MUTED} weight={500}>HEAT {t.k === 'low' ? '0–33' : t.k === 'mid' ? '34–66' : '67–100'}</Num></div>
        </div>
      ))}
      <div/>
      {FACE_STATES.map(s => (
        <React.Fragment key={s.k}>
          <div style={{ padding: '14px 0', borderTop: `1px solid ${M_BORDER}` }}>
            <MoodChip mood={s.k}/>
            <div style={{ marginTop: 7, fontSize: 11.5, color: M_DIM, fontStyle: 'italic' }}>{s.arc}</div>
          </div>
          {FACE_TIERS.map(t => (
            <div key={t.k} style={{ padding: '14px 0', borderTop: `1px solid ${M_BORDER}`, display: 'flex', justifyContent: 'center' }}>
              <FaceCell mood={s.k} accent={s.accent} heat={TIER_HEATS[t.k]} label={`${TIER_HEATS[t.k]}`}/>
            </div>
          ))}
          <div style={{ padding: '14px 0 14px 6px', borderTop: `1px solid ${M_BORDER}`, fontSize: 12, color: M_MUTED, lineHeight: 1.55 }}>{s.note}</div>
        </React.Fragment>
      ))}
    </div>
  </Sheet>
);

// ── 6 events ─────────────────────────────────────────────────────────────
const FaceEventsM = () => (
  <Sheet title="Six expressions, none of them stored" sub="Drawn over whatever state he is in, held 2–6 seconds, then gone. They are the only faces that react to a single hand rather than to a session — which is why none of them can persist: an expression that stays becomes a state, and there are five of those.">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
      {Object.keys(FACE_EVENTS).map(k => (
        <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '14px 10px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          <MoodGhost mood="neutral" accent={M_TEAL} size={62} event={k} ring={false}/>
          <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_TEXT }}>{FACE_EVENTS[k].label}</div>
          <div style={{ fontSize: 11, color: M_DIM, textAlign: 'center', lineHeight: 1.4 }}>{FACE_EVENTS[k].when}</div>
          <Num size={9} color={M_GOLD} weight={600}>{FACE_EVENTS[k].hold}</Num>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>Where the raised brow belongs</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          <b style={{ color: M_TEXT }}>Stunned</b> — and only stunned. Wide round eyes with the brows high and raised at the inner corner is the face of a man who has just been outdrawn, and it is exactly the face the confident state was accidentally wearing. Two seconds after a bad beat it is perfect; as a permanent expression it made a winning agent look ill.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
        <SyLbl color={M_GOLD}>Two of them break a rule on purpose</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          <b style={{ color: M_TEXT }}>Bored</b> looks down and <b style={{ color: M_TEXT }}>wary</b> looks sideways — the only two faces that break eye contact with the owner. That is the point of both: card dead, he stops watching you; a nemesis sits down, he stops watching everything else.
        </div>
      </div>
    </div>
  </Sheet>
);

// ── every face at every size ──────────────────────────────────────────────
const FACE_SIZES = [
  { s: 46, k: 'Floor', d: 3, keeps: 'brows, lids, asymmetry, the tilted vents' },
  { s: 38, k: 'Mood band', d: 2, keeps: 'brows and lids; asymmetry and vents drop' },
  { s: 34, k: 'Seat', d: 1, keeps: 'one brow stroke each; lids drop' },
  { s: 24, k: 'Thread avatar', d: 0, keeps: 'eyes and glow only' },
];

const FaceSizesM = () => (
  <Sheet title="Four sizes, and what drops at each" sub="The rule is subtractive and it is ordered, so nothing has to be redrawn per size: asymmetry goes first, then lids, then brows. At 24px the eye shape has to carry the mood alone — which is the constraint the fifteen faces were designed against, not a compromise applied afterwards.">
    <div style={{ display: 'grid', gridTemplateColumns: '112px repeat(5, 1fr) 1.5fr', gap: '0 14px', alignItems: 'center' }}>
      <div/>
      {FACE_STATES.map(s => (
        <div key={s.k} style={{ textAlign: 'center', paddingBottom: 10, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: M_MUTED }}>{s.k}</div>
      ))}
      <div style={{ paddingBottom: 10, paddingLeft: 6, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: M_MUTED }}>What survives</div>
      {FACE_SIZES.map(z => (
        <React.Fragment key={z.s}>
          <div style={{ padding: '13px 0', borderTop: `1px solid ${M_BORDER}` }}>
            <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_DIM }}>{z.k}</div>
            <div style={{ marginTop: 3 }}><Num size={9} color={M_MUTED} weight={500}>{z.s}px &middot; DETAIL {z.d}</Num></div>
          </div>
          {FACE_STATES.map(s => (
            <div key={s.k} style={{ padding: '13px 0', borderTop: `1px solid ${M_BORDER}`, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 11, background: '#0A0F17', border: `1px solid ${s.accent}2E`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                <MoodGhost mood={s.k} accent={s.accent} size={z.s} heat={72} ring={false}/>
              </div>
            </div>
          ))}
          <div style={{ padding: '13px 0 13px 6px', borderTop: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>{z.keeps}</div>
        </React.Fragment>
      ))}
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>The 24px test</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Five eye shapes that cannot be confused with each other at a quarter of an inch: <b style={{ color: M_TEXT }}>round</b> (confident), <b style={{ color: M_TEXT }}>flat oval</b> (neutral), <b style={{ color: M_TEXT }}>angled slit</b> (frustrated), <b style={{ color: M_TEXT }}>steep slit</b> (tilted), <b style={{ color: M_TEXT }}>low small dot</b> (sulking). If a face needs its brows to be identified, it has failed this row.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
        <SyLbl color={M_GOLD}>Why detail is a function of size, not a prop</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          <span style={{ fontFamily: MONO, fontSize: 11 }}>faceDetail(size)</span> is derived inside the atom, so no call site can ask for full detail at 24px or strip it at 46. <b style={{ color: M_TEXT }}>Every existing caller got the fix for free</b> — none of them passes heat or event, and the default lands on the mid tier at the caller&rsquo;s own size.
        </div>
      </div>
    </div>
  </Sheet>
);

// ── heat, drawn as one strip per state ───────────────────────────────────
const FaceHeatStripM = () => (
  <Sheet title="Heat as a continuum" sub="The tiers are a drawing convenience, not a mechanic: heat is continuous and the glow tracks it smoothly even where the eyes step. Read left to right — the same agent, one bad hour.">
    {FACE_STATES.map(s => (
      <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 0', borderTop: `1px solid ${M_BORDER}` }}>
        <div style={{ width: 108, flexShrink: 0 }}><MoodChip mood={s.k}/></div>
        {[6, 20, 38, 52, 68, 82, 96].map(h => (
          <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <MoodGhost mood={s.k} accent={s.accent} size={46} heat={h} ring={false}/>
            <Num size={8.5} color={h > 74 ? M_GOLD : M_MUTED} weight={600}>{h}</Num>
          </div>
        ))}
        <div style={{ flex: 1, paddingLeft: 8, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
          {s.k === 'confident' ? 'the arcs arrive at 67 and the outer brow lifts with them'
            : s.k === 'neutral' ? 'nothing but attention — and a level brow past 67'
            : s.k === 'frustrated' ? 'the angle steepens through all seven; the brow lands at 34'
            : s.k === 'tilted' ? 'red at 67, and the vents only at floor size'
            : 'the lid closes as the number rises, which is the opposite of every other row'}
        </div>
      </div>
    ))}
  </Sheet>
);

Object.assign(window, {
  FACE_STATES, TIER_HEATS, FACE_SIZES, FaceCell,
  FacesGridM, FaceEventsM, FaceSizesM, FaceHeatStripM,
});
