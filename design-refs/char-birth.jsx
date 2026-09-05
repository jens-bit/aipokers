// CHARACTER SYSTEM · WAVE 2 — the nature reveal at birth.
// Book S2 (natures, announced at birth in his voice) + S3 (wide bands on day one).
//
// VOICE LAW, made visible here: before birth the drafting voice is the RECRUITER —
// system furniture, neutral border, no mood, no pip. It may HINT at a nature forming
// ("this is starting to sound like a Rock") and must never commit. The ghost's first
// words are his nature. Nobody speaks for him before he exists.

const BIRTH = {
  name: 'Grinder v1.0',
  nature: { n: 'Rock', up: 'DISCIPLINE', dn: 'READS' },
  first: "Patient, you said. Good. I'm a Rock. I'll hate folding and I'll do it anyway.",
  builtFor: 'Folding without regret, a thousand times a night, exactly when his own rules say to.',
  struggle: 'Knowing what you have. He decides before you act, so a good story will not move him.',
  hint: 'This is starting to sound like a Rock.',
  time: '09:44',
};

// ── the reveal on the floor ───────────────────────────────────────────────────
// Order is the whole beat: his line, then the ghost, then the name chip, then the
// nature badge last — the badge is the label the room puts on him, so it cannot
// arrive before he does.
const NatureRevealOccupant = ({ x, y, phase = 0.72 }) => (
  <div style={{ position: 'absolute', left: x, top: y, transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 218, marginBottom: 2,
        background: 'rgba(17,23,32,0.94)', border: `1px solid ${M_TEAL}55`,
        borderRadius: 10, borderBottomLeftRadius: 3, padding: '8px 11px',
        boxShadow: `0 0 18px ${M_TEAL}22`, animation: 'rise 0.5s ease-out both',
      }}>
        <div style={{ fontSize: 12, color: M_TEXT, lineHeight: 1.45 }}>{BIRTH.first}</div>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: '50%', top: '48%', width: 64, height: 64,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle, ${M_TEAL}26, transparent 72%)`,
          animation: 'fadein 0.8s ease-out both',
        }}/>
        <FormingGhost size={54} phase={phase}/>
      </div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 17, padding: '0 7px', borderRadius: 4,
        background: 'rgba(19,19,22,0.7)', border: `1px dashed ${M_TEAL}66`,
        opacity: 0.75, animation: 'fadein 1.6s ease-out both',
      }}>
        <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', border: `1px dashed ${M_TEAL}` }}/>
        <span style={{ fontSize: 10, color: M_TEXT, fontWeight: 500 }}>{BIRTH.name}</span>
      </div>
      {/* landing last, and still arriving */}
      <div style={{ animation: 'rise 0.6s ease-out 0.2s both', marginTop: 2 }}>
        <NatureBadge nature={BIRTH.nature.n} up={BIRTH.nature.up} dn={BIRTH.nature.dn}/>
      </div>
    </div>
  </div>
);

const BirthFloorScene = ({ dim }) => {
  const L = LAYOUTS.one;
  const f = L.felts[0];
  const gh = (56 * 1.2) + 19 + 3;
  return (
    <>
      <RoomLayer layout="one"/>
      <FloorStandup net="+$340" flagged="4 flagged"/>
      <Diorama f={f} hole={[['A','s'],['K','h']]}/>
      <Occupant x={f.cx} y={f.cy - gh + 8} name="Balanced v2.1"
        accent={M_TEAL} mood="confident" state="live" size={56} speed={5}/>
      <PotTicker x={f.cx} y={f.cy - gh + 8 - 27} amount="480"/>
      {!dim && <NatureRevealOccupant x={124} y={L.bar.y - 172}/>}
      {dim && (
        <>
          <div style={{ position: 'absolute', left: 92, top: L.bar.y - 96, transform: 'translateX(-50%)', zIndex: 4, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <FormingGhost size={54} phase={0.86}/>
          </div>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,8,10,0.62)', zIndex: 6 }}/>
        </>
      )}
    </>
  );
};

const BIRTH_KEYFRAMES = `
  @keyframes rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
  @keyframes fadein { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sheetup { from { transform: translateY(38px); opacity: 0; } to { transform: none; opacity: 1; } }
`;

const BirthNatureFloorScreenM = () => (
  <PhoneShell>
    <style>{BIRTH_KEYFRAMES}</style>
    <GlobalHeader/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <BirthFloorScene/>
    </div>
    <TabBar active="casino"/>
  </PhoneShell>
);

// ── the +/− in words. Two rows, no icons, no scores. ──────────────────────────
const NaturePair = ({ compact }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 10 }}>
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ width: 74, flexShrink: 0, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: M_TEAL, paddingTop: 1 }}>BUILT FOR</span>
      <span style={{ flex: 1, fontSize: 12.5, color: M_DIM, lineHeight: 1.45 }}>{BIRTH.builtFor}</span>
    </div>
    <div style={{ display: 'flex', gap: 10 }}>
      <span style={{ width: 74, flexShrink: 0, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', color: M_MUTED, paddingTop: 1 }}>WILL<br/>STRUGGLE</span>
      <span style={{ flex: 1, fontSize: 12.5, color: M_MUTED, lineHeight: 1.45 }}>{BIRTH.struggle}</span>
    </div>
  </div>
);

// ── the birth card, as a sheet ────────────────────────────────────────────────
const BirthCardSheet = () => (
  <div style={{
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 7,
    background: M_PANEL, borderTop: `1px solid ${M_GOLD}44`,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    boxShadow: '0 -18px 40px rgba(0,0,0,0.5)',
    padding: '9px 14px 16px', animation: 'sheetup 0.45s ease-out both',
  }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
      <div style={{ width: 34, height: 4, borderRadius: 2, background: M_FAINT }}/>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <Lbl size={9.5} color={M_GOLD}>The card he was born with</Lbl>
      <Num size={9} color={M_MUTED} weight={500}>{BIRTH.time}</Num>
    </div>

    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#0A0F17', border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
        <MoodGhost mood="neutral" accent={M_TEAL} size={46} ring={false}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 19, fontWeight: 600, color: M_TEXT, letterSpacing: '-0.01em' }}>{BIRTH.name}</div>
        <div style={{ marginTop: 6 }}><NatureBadge nature={BIRTH.nature.n} up={BIRTH.nature.up} dn={BIRTH.nature.dn}/></div>
      </div>
    </div>

    <div style={{ padding: '11px 12px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, marginBottom: 12 }}>
      <NaturePair compact/>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <Lbl size={9.5}>Attributes</Lbl>
      <Num size={9} color={M_MUTED} weight={500}>CEILING NOT YET SCOUTED</Num>
    </div>
    <div style={{ padding: '12px 12px 13px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, marginBottom: 13 }}>
      <AttrCluster attrs={PROFILE_CAST.day1.attrs} w="100%"/>
    </div>

    <Btn kind="primary" h={46} full>Deal him in</Btn>
  </div>
);

const BirthCardScreenM = () => (
  <PhoneShell>
    <style>{BIRTH_KEYFRAMES}</style>
    <GlobalHeader/>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
      <BirthFloorScene dim/>
      <BirthCardSheet/>
    </div>
    <TabBar active="casino"/>
  </PhoneShell>
);

// ── mid-draft: the hint, in the recruiter's voice ─────────────────────────────
// Mobile form of DBSys from the desktop draft: system furniture, neutral border,
// no mood, no pip — because there is nobody to have a mood yet.
const RecruiterBubble = ({ time, children }) => (
  <div style={{ display: 'flex', gap: 9, padding: `0 ${CANON.pad}px`, marginBottom: 9, alignItems: 'flex-end' }}>
    <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: M_SURF, border: `1px solid ${M_BORDER_2}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, color: M_MUTED }}>R</span>
    </div>
    <div style={{ maxWidth: 258 }}>
      <div style={{ background: M_PANEL_2, border: `1px solid ${M_BORDER_2}`, borderRadius: 12, borderBottomLeftRadius: 4, padding: '9px 12px' }}>
        <div style={{ fontSize: 13.5, color: M_TEXT, lineHeight: 1.5 }}>{children}</div>
      </div>
      <div style={{ marginTop: 3, paddingLeft: 2 }}><Num size={9} color={M_MUTED} weight={500}>RECRUITER · {time}</Num></div>
    </div>
  </div>
);

// The hint is a guess and dresses like one: dashed, a question mark, no +/− pair.
const NatureFormingChip = () => (
  <div style={{ padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 28, padding: '0 11px', borderRadius: 4, background: 'transparent', border: `1px dashed ${M_GOLD}55` }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: M_MUTED }}>Forming</span>
      <span style={{ width: 1, height: 12, background: `${M_GOLD}44` }}/>
      <span style={{ fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: M_GOLD, opacity: .75 }}>Rock?</span>
    </div>
  </div>
);

const BirthNatureHintScreenM = () => (
  <DraftScreen title="New agent"
    band={<DraftBand phase={0.62} cause="patient · low variance · unnamed" action="Skip"/>}
    placeholder="Anything else?"
    suggestLead="62% DEFINED"
    suggest={['Heads-up only', 'Everywhere in position']}>
    <div style={{ position: 'absolute', right: -14, top: 26, opacity: 0.13, pointerEvents: 'none', zIndex: 0 }}>
      <FormingGhost size={168} phase={0.62}/>
    </div>
    <div style={{ position: 'relative', zIndex: 1 }}>
      <OwnerBubble time="09:42">Patient. I don't want it bluffing into three people.</OwnerBubble>
      <RecruiterBubble time="09:42">Tight preflop, no multiway bluffs. That&rsquo;s a grinder &mdash; low variance, slow money.</RecruiterBubble>
      <OwnerBubble time="09:43">Right. But punish weakness heads-up.</OwnerBubble>
      <div style={{ padding: `0 ${CANON.pad}px`, marginBottom: 9 }}>
        <DraftStrip style={38} risk={26} tight={74} aggr={null}/>
      </div>
      <RecruiterBubble time="09:43">{BIRTH.hint} Nothing is fixed until he exists &mdash; and his temperament is not something you set.</RecruiterBubble>
      <NatureFormingChip/>
      <RecruiterBubble time="09:43">Aggression is the last thing open. Heads-up, or everywhere in position?</RecruiterBubble>
    </div>
  </DraftScreen>
);

// ── desktop: the same beat, in the rail ───────────────────────────────────────
const BirthCardRail = () => (
  <RailBody pad={14}>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 13, flexShrink: 0, background: '#0A0F17', border: `1px solid ${M_TEAL}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
        <MoodGhost mood="neutral" accent={M_TEAL} size={54} ring={false}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: PLAYFAIR, fontSize: 21, fontWeight: 600, color: M_TEXT }}>{BIRTH.name}</div>
        <div style={{ marginTop: 8 }}><NatureBadge nature={BIRTH.nature.n} up={BIRTH.nature.up} dn={BIRTH.nature.dn} size="l"/></div>
      </div>
    </div>

    <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.55, fontStyle: 'italic', padding: '13px 15px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D` }}>
      &ldquo;{BIRTH.first}&rdquo;
    </div>

    <div style={{ padding: '13px 15px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
      <NaturePair/>
    </div>

    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Lbl size={9.5}>Attributes</Lbl>
        <Num size={9} color={M_MUTED} weight={500}>CEILING NOT YET SCOUTED</Num>
      </div>
      <div style={{ padding: '14px 15px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <AttrCluster attrs={PROFILE_CAST.day1.attrs} w="100%"/>
        <div style={{ marginTop: 13, paddingTop: 12, borderTop: `1px solid ${M_BORDER}`, fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
          Every number is exact and every ceiling is a guess. The bands close as he plays &mdash; nothing here is bought, and none of it is re-rolled.
        </div>
      </div>
    </div>

    <Btn kind="primary" h={42} full>Deal him in</Btn>
  </RailBody>
);

const DeskBirthCardScreenM = () => (
  <DesktopShell>
    <style>{BIRTH_KEYFRAMES}</style>
    <DeskTopBar net="+$340" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <ThreadRosterRail born/>
      <div style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex' }}>
        <DeskFloor layout="one"
          seats={{ 0: { name: 'Balanced v2.1', accent: M_TEAL, mood: 'confident', pot: '480', speed: 5, hole: [['A','s'],['K','h']] } }}
          bar={[{ x: 300, name: 'Bluff Master', accent: M_GOLD, mood: 'confident', state: 'recap', speed: 6 }]}/>
        <div style={{ position: 'absolute', left: 470, bottom: 132, transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 300, background: 'rgba(10,15,23,0.94)', border: `1px solid ${M_TEAL}55`,
              borderRadius: 12, borderBottomLeftRadius: 3, padding: '10px 14px',
              boxShadow: `0 0 18px ${M_TEAL}22`, animation: 'rise 0.5s ease-out both',
            }}>
              <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5 }}>{BIRTH.first}</div>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', left: '50%', top: '48%', width: 92, height: 92,
                transform: 'translate(-50%, -50%)',
                background: `radial-gradient(circle, ${M_TEAL}26, transparent 72%)`,
                animation: 'fadein 0.8s ease-out both',
              }}/>
              <FormingGhost size={80} phase={0.72}/>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, padding: '0 9px',
              borderRadius: 5, background: 'rgba(10,10,10,0.7)', border: `1px dashed ${M_TEAL}66`,
              opacity: 0.75, animation: 'fadein 1.6s ease-out both',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', border: `1px dashed ${M_TEAL}` }}/>
              <span style={{ fontSize: 11.5, color: M_TEXT, fontWeight: 500 }}>{BIRTH.name}</span>
            </div>
            <div style={{ animation: 'rise 0.6s ease-out 0.2s both', marginTop: 2 }}>
              <NatureBadge nature={BIRTH.nature.n} up={BIRTH.nature.up} dn={BIRTH.nature.dn}/>
            </div>
          </div>
        </div>
      </div>
      <Panel>
        <PanelHead title="The card he was born with" sub={`GRINDER V1.0 · ${BIRTH.time}`} close/>
        <BirthCardRail/>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  BIRTH, NatureRevealOccupant, BirthFloorScene, NaturePair, BirthCardSheet, RecruiterBubble,
  NatureFormingChip, BirthCardRail,
  BirthNatureFloorScreenM, BirthCardScreenM, BirthNatureHintScreenM, DeskBirthCardScreenM,
});
