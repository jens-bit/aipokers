// THE HANDS — the reference sheet. Geometry lives in mood-atoms.jsx beside the face
// system; this renders every pose at the three sizes the product draws, the bet
// bands, the three motions that need a strip, and the brow trigger map.

const HAND_SIZES = [
  { s: 40, k: 'Seat', d: 'mitten only — fingers are sub-pixel here' },
  { s: 96, k: 'Watch hero', d: 'fingers separate, chips read individually' },
  { s: 160, k: 'Profile', d: 'everything, and the idle drift is visible' },
];

const HandCell = ({ pose, size, mood = 'neutral', accent = M_TEAL, bet, won }) => (
  <div style={{ width: size + 16, height: size + 16, borderRadius: 12, background: '#0A0F17', border: `1px solid ${accent}2E`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
    <MoodGhost mood={mood} accent={accent} size={size} heat={45} hands={pose} bet={bet} won={won} ring={false}/>
  </div>
);

const HandsSheetM = () => (
  <Sheet title="Two hands, no arms" sub="Detached hands hovering where a wrist would be, moving independently. They carry what he is DOING — the face carries what he feels — and the split earns its keep because a hand pushing a stack forward reads at 20px, where no face does.">
    <div style={{ display: 'grid', gridTemplateColumns: '150px 76px 132px 196px 1fr', gap: '0 18px', alignItems: 'center' }}>
      {['Pose', 'Seat 40', 'Hero 96', 'Profile 160', 'When'].map(h => (
        <div key={h} style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: M_MUTED, paddingBottom: 10 }}>{h}</div>
      ))}
      {Object.keys(HAND_POSES).map(k => {
        const p = HAND_POSES[k];
        const opp = OPP_POSES.includes(k);
        return (
          <React.Fragment key={k}>
            <div style={{ padding: '14px 0', borderTop: `1px solid ${M_BORDER}` }}>
              <div style={{ fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT }}>{p.label}</div>
              <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.4, marginTop: 4 }}>{p.note}</div>
              {opp && <div style={{ marginTop: 7 }}><span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: M_GOLD, background: `${M_GOLD}14`, border: `1px solid ${M_GOLD}44`, borderRadius: 3, padding: '2px 5px' }}>OPPONENTS TOO</span></div>}
            </div>
            {[40, 96, 160].map(s => (
              <div key={s} style={{ padding: '14px 0', borderTop: `1px solid ${M_BORDER}`, display: 'flex', justifyContent: 'center' }}>
                <HandCell pose={k} size={s} bet={k === 'push' ? 'mid' : undefined}/>
              </div>
            ))}
            <div style={{ padding: '14px 0 14px 6px', borderTop: `1px solid ${M_BORDER}`, fontSize: 12, color: M_DIM, lineHeight: 1.5 }}>{p.when}</div>
          </React.Fragment>
        );
      })}
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>Eight poses and no more</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Each is a fixed arrangement of the same two mittens — nothing is procedural, so nothing drifts into a ninth pose by accident. <b style={{ color: M_TEXT }}>An opponent gets four</b>: rest, hold, toss, push. He does not peek, drum, clench or cover, because those are the poses that say what somebody is feeling — and an opponent&rsquo;s feelings are the READ panel&rsquo;s job, not the felt&rsquo;s.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
        <SyLbl color={M_GOLD}>Detail drops with size, as the face&rsquo;s does</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          <span style={{ fontFamily: MONO, fontSize: 11 }}>handDetail(size)</span> is derived in the atom: at seat scale the three finger circles are sub-pixel, so the hand becomes a plain mitten rather than a smudge. <b style={{ color: M_TEXT }}>The pose still reads</b> — position and rotation carry it, which is why every pose is distinguishable in the 40px column.
        </div>
      </div>
    </div>
  </Sheet>
);

const HandBetBandsM = () => (
  <Sheet title="Push, at three bet bands" sub="The only pose that carries a quantity, and it carries it as height rather than as a number — so the size of a bet is legible on the body before the figure arrives in the hero row.">
    <div style={{ display: 'flex', gap: 30, alignItems: 'flex-end' }}>
      {[['small', '2 chips', 'a min-raise, a blind defence'], ['mid', '4 chips', 'a standard bet — half to two-thirds pot'], ['big', '7 chips', 'an overbet, or a shove short of all-in']].map(([b, n, w]) => (
        <div key={b} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <HandCell pose="push" size={96} bet={b}/>
          <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: M_TEXT }}>{b}</div>
          <Num size={9} color={M_MUTED} weight={600}>{n}</Num>
          <div style={{ width: 132, fontSize: 11.5, color: M_MUTED, textAlign: 'center', lineHeight: 1.4 }}>{w}</div>
        </div>
      ))}
      <div style={{ flex: 1, paddingLeft: 10 }}>
        <SyLbl color={M_TEAL}>Three bands, not a count</SyLbl>
        <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
          Eleven chips and twelve chips are the same gesture to a human eye, so the stack has three heights and no more. And <b style={{ color: M_TEXT }}>all-in is not the top of the scale</b> — it gets clench, because it is a different kind of decision rather than a bigger bet.
        </div>
        <div style={{ marginTop: 14, display: 'flex', gap: 14, alignItems: 'flex-end' }}>
          <HandCell pose="clench" size={96} mood="tilted" accent={M_PURPLE}/>
          <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5 }}>
            Fingers gone, one ball each. At 40px it is the most legible pose in the set, which is right for the two states that matter most: all-in, and heat at or above 70.
          </div>
        </div>
      </div>
    </div>
  </Sheet>
);

const HAND_STRIPS = {
  push: { label: 'Push', ms: '420ms', mood: 'neutral', accent: M_TEAL, frames: [
    { t: '0ms', pose: 'hold', note: 'holding, stack not yet gathered' },
    { t: '140ms', pose: 'push', bet: 'small', note: 'hands meet the stack, chips lift' },
    { t: '280ms', pose: 'push', bet: 'mid', note: 'travelling forward — the stack leads the hands' },
    { t: '420ms', pose: 'push', bet: 'big', note: 'landed at the line; the hands withdraw a beat later' },
  ] },
  toss: { label: 'Toss', ms: '350ms', mood: 'neutral', accent: M_TEAL, frames: [
    { t: '0ms', pose: 'hold', note: 'holding, face up to him only' },
    { t: '120ms', pose: 'peek', note: 'one hand takes both cards' },
    { t: '240ms', pose: 'toss', note: 'flicked away, backs coming round' },
    { t: '350ms', pose: 'rest', note: 'hands back at the sides, his square of felt empty' },
  ] },
  cover: { label: 'Cover', ms: '600ms', mood: 'tilted', accent: M_PURPLE, frames: [
    { t: '0ms', pose: 'hold', note: 'the moment the river lands' },
    { t: '200ms', pose: 'clench', note: 'balled — the involuntary half of it' },
    { t: '400ms', pose: 'cover', note: 'up and over the face' },
    { t: '600ms', pose: 'cover', note: 'held. The only pose that outlasts its own animation.' },
  ] },
};

const HandStripsM = () => (
  <Sheet title="Three motions, four frames each" sub="Push, toss and cover are the poses whose meaning lives in the movement rather than the shape — a still frame of any of them is ambiguous. The other five read at rest, which is why they get no strip.">
    {Object.keys(HAND_STRIPS).map(k => {
      const st = HAND_STRIPS[k];
      return (
        <div key={k} style={{ padding: '15px 0', borderTop: `1px solid ${M_BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
            <div style={{ fontFamily: PLAYFAIR, fontSize: 17, fontWeight: 600, color: M_TEXT }}>{st.label}</div>
            <Num size={9} color={M_GOLD} weight={600}>{st.ms}</Num>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            {st.frames.map((fr, i) => (
              <div key={fr.t} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <HandCell pose={fr.pose} size={96} bet={fr.bet} mood={st.mood} accent={st.accent} won={false}/>
                <Num size={9} color={i === 0 ? M_MUTED : M_TEAL} weight={600}>{fr.t}</Num>
                <div style={{ fontSize: 11, color: M_MUTED, textAlign: 'center', lineHeight: 1.4 }}>{fr.note}</div>
              </div>
            ))}
          </div>
        </div>
      );
    })}
    <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>On a win, cover inverts</SyLbl>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 4 }}>
          <HandCell pose="cover" size={96} won mood="confident" accent={M_TEAL}/>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.55 }}>
            One hand rakes the pot in, the other stays at his side. <b style={{ color: M_TEXT }}>Same pose slot, opposite direction</b> — hands travel toward the face on a loss and toward the body on a win, which is the whole grammar of the pair.
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
        <SyLbl color={M_RED}>What the hands never do</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Point at the owner. Wave. Gesture at another player. Hold anything that is not cards or chips. <b style={{ color: M_TEXT }}>They only ever touch the game</b> — the moment a hand addresses the person watching, the fish tank becomes a puppet show.
        </div>
      </div>
    </div>
  </Sheet>
);

const BrowTriggersM = () => (
  <Sheet title="Three brows, three triggers" sub="The resting brow belongs to the state (wave 41). These are momentary overrides drawn on top of it, and each has exactly one cause — a brow that fires for two different reasons is decoration.">
    <div style={{ display: 'grid', gridTemplateColumns: '96px 156px 96px 1fr', gap: '0 18px', alignItems: 'center' }}>
      {['', 'Trigger', 'Hold', 'Why it is drawn this way'].map(h => (
        <div key={h} style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase', color: M_MUTED, paddingBottom: 10 }}>{h}</div>
      ))}
      {Object.keys(BROW_TRIGGERS).map(k => {
        const b = BROW_TRIGGERS[k];
        return (
          <React.Fragment key={k}>
            <div style={{ padding: '13px 0', borderTop: `1px solid ${M_BORDER}` }}>
              <div style={{ width: 76, height: 76, borderRadius: 13, background: '#0A0F17', border: `1px solid ${M_TEAL}2E`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                <MoodGhost mood="neutral" accent={M_TEAL} size={68} brow={k} ring={false}/>
              </div>
            </div>
            <div style={{ padding: '13px 0', borderTop: `1px solid ${M_BORDER}` }}>
              <div style={{ fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT }}>{b.label}</div>
              <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.4, marginTop: 4 }}>{b.trigger}</div>
            </div>
            <div style={{ padding: '13px 0', borderTop: `1px solid ${M_BORDER}` }}><Num size={10} color={M_GOLD} weight={600}>{b.hold}</Num></div>
            <div style={{ padding: '13px 0 13px 6px', borderTop: `1px solid ${M_BORDER}`, fontSize: 12, color: M_MUTED, lineHeight: 1.5 }}>{b.note}</div>
          </React.Fragment>
        );
      })}
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
        <SyLbl color={M_GOLD}>Knit is the one that stays</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Twitch and lift are reflexes and last under a second. <b style={{ color: M_TEXT }}>Knit holds until heat drops below 55</b>, because its cause holds — which makes it the only brow that has to compose with all five resting states rather than briefly replace one.
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>Lift is the only friendly brow</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          None of the five resting states draws both brows raised and level — confident is level-and-lowered, stunned is raised but <i>inner</i>-raised. <b style={{ color: M_TEXT }}>Lift is reserved for one moment</b>: he peeks and the hand is strong. It is the closest thing to a smile the face has.
        </div>
      </div>
    </div>
  </Sheet>
);

Object.assign(window, {
  HAND_SIZES, HandCell, HandsSheetM, HandBetBandsM, HAND_STRIPS, HandStripsM, BrowTriggersM,
});
