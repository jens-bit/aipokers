// REPLAY THEATRE — most hands happen while nobody watches.
// The flagged hand (BIG BLUFF / BAD BEAT / COOLER) becomes the same theatre as Watch
// v3, scrubbable: PaceFelt, TugBar and his line, driven by an authored timeline
// instead of the server. 20–40 seconds. Nothing new is invented — the ALL-IN hold and
// the showdown reveal are the same beats, replayed.

const FLAGS = {
  bluff:  { label: 'BIG BLUFF', color: M_GOLD },
  beat:   { label: 'BAD BEAT',  color: M_RED },
  cooler: { label: 'COOLER',    color: M_PURPLE },
};

// street → seconds, authored so the beats land where the tension is: the runout
// gets the same 3–5s hold a live spectator gets, and the reveal is held after it.
const TIMELINE = [
  { k: 'PRE', at: 0, s: 3.5, pot: '60', flip: 0, eq: 52, line: 'Ace-ten. Fine. Let’s see who’s home.' },
  { k: 'FLOP', at: 3.5, s: 6, pot: '180', flip: 3, eq: 38, line: 'Nothing yet. He bets small, so he has nothing either.' },
  { k: 'TURN', at: 9.5, s: 7, pot: '620', flip: 4, eq: 24, line: 'He raised. I don’t believe him.' },
  { k: 'ALL-IN', at: 16.5, s: 5, pot: '3,694', flip: 4, eq: 18, line: 'All of it.' },
  { k: 'RIVER', at: 21.5, s: 4, pot: '3,694', flip: 5, eq: 100, line: 'Told you. Nothing.' },
  { k: 'END', at: 25.5, s: 3, pot: '3,694', flip: 5, eq: 100, line: 'That is how you get paid with ace-high.' },
];
const TOTAL = 28.5;

const Scrubber = ({ at = 16.5, flag = 'bluff', playing = true }) => {
  const f = FLAGS[flag];
  return (
    <div style={{ flexShrink: 0, background: M_PANEL, borderTop: `1px solid ${M_BORDER}`, padding: '9px 14px 11px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: f.color, background: `${f.color}14`, border: `1px solid ${f.color}55`, borderRadius: 3, padding: '3px 6px' }}>{f.label}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: M_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Hand #4188 &middot; last night 23:41</span>
        <Num size={9} color={M_MUTED} weight={500}>{at.toFixed(0)}s / {TOTAL.toFixed(0)}s</Num>
      </div>
      <div style={{ position: 'relative', height: 22 }}>
        <div style={{ position: 'absolute', top: 9, left: 0, right: 0, height: 4, borderRadius: 2, background: M_SURF }}/>
        <div style={{ position: 'absolute', top: 9, left: 0, width: `${(at / TOTAL) * 100}%`, height: 4, borderRadius: 2, background: M_TEAL, boxShadow: `0 0 8px ${M_TEAL}66` }}/>
        {TIMELINE.map(t => (
          <div key={t.k} style={{ position: 'absolute', top: 4, left: `${(t.at / TOTAL) * 100}%` }}>
            <div style={{ width: 1, height: 14, background: t.at <= at ? `${M_TEAL}99` : M_BORDER_2 }}/>
            <span style={{ position: 'absolute', top: 15, left: 0, fontFamily: MONO, fontSize: 7.5, letterSpacing: '0.06em', color: t.at <= at ? M_DIM : M_FAINT, whiteSpace: 'nowrap' }}>{t.k}</span>
          </div>
        ))}
        <div style={{ position: 'absolute', top: 4, left: `calc(${(at / TOTAL) * 100}% - 6px)`, width: 12, height: 14, borderRadius: 3, background: '#EDEDED', boxShadow: '0 1px 5px rgba(0,0,0,0.6)' }}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: 19, background: M_TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', boxShadow: `0 0 12px ${M_TEAL}55` }}>
          {playing
            ? <svg width="12" height="13" viewBox="0 0 12 13"><rect x="1" y="1" width="3.4" height="11" rx="1" fill="#0A0A0A"/><rect x="7.6" y="1" width="3.4" height="11" rx="1" fill="#0A0A0A"/></svg>
            : <svg width="13" height="14" viewBox="0 0 13 14"><path d="M2 1.5v11l9.5-5.5z" fill="#0A0A0A"/></svg>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Lbl size={8.5}>Street</Lbl>
          <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500 }}>The all-in, before the river</div>
        </div>
        <Btn kind="outline" h={32}>Open hand</Btn>
      </div>
    </div>
  );
};

const ReplayTheatreScreenM = ({ at = 16.5, pace = 'allin', step = 3 }) => {
  const t = TIMELINE[step];
  return (
    <PhoneShell>
      <GlobalHeader back title="Replay"/>
      <MoodBand accent={M_GOLD} mood="confident" state="recap" action="Chat"
        cause="he bluffed $3,694 with ace-high"/>
      <PaceFelt pace={pace} h={342} pot={t.pot} board={B5} flip={t.flip} equity={t.eq} line={t.line} bottomBand={pace === 'allin' ? 34 : 0}>
        {pace === 'allin' && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, zIndex: 4, textAlign: 'center' }}>
            <Num size={9.5} color={M_RED} weight={600}>RIVER IN 3</Num>
          </div>
        )}
      </PaceFelt>
      <Scrubber at={at} flag="bluff"/>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <Lbl size={9.5}>Read at this moment</Lbl>
          <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
          <Num size={9} color={M_MUTED} weight={500}>138 HANDS SEEN</Num>
        </div>
        <ReadBar k="fold" label="FOLDS TO HEAT" v={8} conf={5} formed/>
        <ReadBar k="sd" label="GOES TO SHOWDOWN" v={41} conf={9}/>
      </div>
    </PhoneShell>
  );
};

const ReplayRevealScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Replay"/>
    <MoodBand accent={M_GOLD} mood="confident" state="recap" action="Chat"
      cause="he bluffed $3,694 with ace-high"/>
    <PaceFelt pace="showdown" h={342} pot="3,694" board={B5} flip={5} equity={100} potTo bottomBand={83}
      line="Told you. Nothing.">
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 4, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: `${M_GOLD}14`, border: `1px solid ${M_GOLD}66` }}>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <PlayingCard rank="A" suit="s" w={34} h={47}/>
          <PlayingCard rank="10" suit="d" w={34} h={47}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Lbl size={8.5} color={M_GOLD}>Ace-high. No pair.</Lbl>
          <div style={{ fontSize: 11.5, color: M_DIM, marginTop: 2 }}>Granite folded king-nine</div>
        </div>
        <Num size={17} weight={700} color={M_TEAL}>+$3,694</Num>
      </div>
    </PaceFelt>
    <Scrubber at={25.5} flag="bluff" playing={false}/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: M_BG, padding: '10px 14px' }}>
      <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.5, fontStyle: 'italic' }}>
        &ldquo;That is how you get paid with ace-high.&rdquo;
      </div>
    </div>
  </PhoneShell>
);

// ── entry · the replay card in the thread recap ─────────────────────────────
// A poster, not a link: the flag, the board, the pot, and one line. Tapping it opens
// the theatre. This is the only new furniture the replay adds to the thread.
const ReplayCard = ({ flag = 'bluff', pot = '3,694', line = 'Ace-high. He folded.' }) => {
  const f = FLAGS[flag];
  return (
    <div style={{ margin: '0 14px 9px', borderRadius: 12, overflow: 'hidden', background: M_PANEL_2, border: `1px solid ${f.color}44`, cursor: 'pointer' }}>
      <div style={{ position: 'relative', height: 104, background: 'radial-gradient(ellipse at 50% 45%, #2f4d48 0%, #1d2e2c 70%)' }}>
        <div style={{ position: 'absolute', top: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
          {B5.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={32} h={44}/>)}
        </div>
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 10 }}>
          <TugBar equity={100}/>
        </div>
        <div style={{ position: 'absolute', top: 10, left: 10, width: 30, height: 30, borderRadius: 15, background: 'rgba(10,10,10,0.6)', border: `1px solid ${f.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="11" height="12" viewBox="0 0 13 14"><path d="M2 1.5v11l9.5-5.5z" fill={f.color}/></svg>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: f.color, background: `${f.color}14`, border: `1px solid ${f.color}55`, borderRadius: 3, padding: '3px 6px', flexShrink: 0 }}>{f.label}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: M_DIM, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</span>
        <Num size={12.5} weight={700} color={M_TEAL}>+${pot}</Num>
      </div>
    </div>
  );
};

const ThreadReplayScreenM = () => (
  <ThreadScreen name="Bluff Master" accent={M_GOLD} mood="confident" state="recap" action="Deploy"
    cause="closed +$4,120 — one of them was theatre">
    <SysLine>Session closed · 23:58</SysLine>
    <AgentBubble mood="confident" accent={M_GOLD} time="23:58" expressive>
      Four hours, +$4,120. One hand did most of it and you missed it.
    </AgentBubble>
    <ReplayCard/>
    <AgentBubble mood="confident" accent={M_GOLD} time="23:58">
      Watch it. Twenty-eight seconds.
    </AgentBubble>
    <OwnerBubble time="08:02">Show-off.</OwnerBubble>
  </ThreadScreen>
);

// ── desktop parity: the theatre plays in the table stage ────────────────────
const D3ReplayScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$4,120" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: 'radial-gradient(ellipse at 48% 42%, #3b4a3f 0%, #202c28 58%, #131c1a 100%)' }}>
          <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 90px ${M_RED}33`, pointerEvents: 'none', animation: 'shimmer 1.4s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', top: 22, left: 28, zIndex: 3 }}><SeatChip name="Granite" stack="2,104" pos="BB" history="3"/></div>
          <div style={{ position: 'absolute', top: 74, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 20px', borderRadius: 20, background: `${M_RED}1F`, border: `1px solid ${M_RED}66` }}>
              <Lbl size={9.5} color={M_RED}>Pot</Lbl>
              <Amt size={34}>$3,694</Amt>
            </div>
          </div>
          <div style={{ position: 'absolute', top: 150, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 3 }}>
            {B5.map((c, i) => i < 4 ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={62} h={86}/> : <CardBack key={i} w={62} h={86} branded/>)}
          </div>
          <div style={{ position: 'absolute', top: 262, left: '28%', right: '28%', zIndex: 3 }}><TugBar equity={18} big/></div>
          <div style={{ position: 'absolute', top: 318, left: 0, right: 0, textAlign: 'center', zIndex: 3 }}>
            <span style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 12, background: 'rgba(10,10,10,0.6)', border: `1px solid ${M_RED}44`, fontFamily: PLAYFAIR, fontSize: 24, fontWeight: 600, color: M_TEXT }}>&ldquo;All of it.&rdquo;</span>
            <div style={{ marginTop: 10 }}><Num size={10} color={M_RED} weight={600}>RIVER IN 3</Num></div>
          </div>
        </div>
        <div style={{ padding: '0 24px' }}><Scrubber at={16.5} flag="bluff"/></div>
      </div>
      <Panel>
        <PanelHead title="Replay" sub="HAND #4188 · BIG BLUFF"/>
        <RailBody>
          <ReplayCard/>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
            <Lbl size={9.5}>His line, street by street</Lbl>
            <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TIMELINE.slice(0, 5).map(t => (
                <div key={t.k} style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <Num size={9} color={t.k === 'ALL-IN' ? M_RED : M_MUTED} weight={600}>{t.k}</Num>
                  <span style={{ flex: 1, fontSize: 12, color: t.k === 'ALL-IN' ? M_TEXT : M_DIM, lineHeight: 1.4, fontStyle: 'italic' }}>{t.line}</span>
                </div>
              ))}
            </div>
          </div>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  FLAGS, TIMELINE, TOTAL, Scrubber, ReplayCard,
  ReplayTheatreScreenM, ReplayRevealScreenM, ThreadReplayScreenM, D3ReplayScreenM,
});
