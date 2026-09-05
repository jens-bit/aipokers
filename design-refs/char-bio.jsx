// THE BIOGRAPHY LAYER — relationships. A separate, lighter system than attributes:
// narrative, not numbers. Derived entirely from opponent history; it changes what he
// SAYS and how he FEELS, and it can never change what he can do.

const ROLE = {
  nemesis: { label: 'NEMESIS', color: M_RED, rule: 'worst net against · min 30 hands' },
  rival: { label: 'RIVAL', color: M_PURPLE, rule: 'most hands against' },
  victim: { label: 'FAVOURITE VICTIM', color: M_TEAL, rule: 'best net against · min 30 hands' },
};

// Role carries the colour, not the opponent — an accent rim is an identity, and
// House regulars are not agents of yours to identify.
const RelRow = ({ role, who, evidence, net, opinion, last }) => {
  const r = ROLE[role];
  return (
    <div style={{ padding: '9px 0', borderBottom: last ? 'none' : `1px solid ${M_BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: r.color, background: `${r.color}14`, border: `1px solid ${r.color}44`, borderRadius: 3, padding: '3px 6px', whiteSpace: 'nowrap' }}>{r.label}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</span>
        <Num size={11.5} weight={700} color={net.startsWith('−') ? M_RED : M_TEAL}>{net}</Num>
      </div>
      <div style={{ marginTop: 4 }}><Num size={9} color={M_MUTED} weight={500}>{evidence}</Num></div>
      <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.45, marginTop: 5, fontStyle: 'italic' }}>&ldquo;{opinion}&rdquo;</div>
    </div>
  );
};

PROFILE_CAST.vet.rels = [
  { role: 'nemesis', who: 'Granite', net: '−$1,240', evidence: 'LOST 3 BIG POTS TO HIM · 142 HANDS',
    opinion: "I've decided I don't like Granite. He only bets when he has it, and I keep paying anyway." },
  { role: 'rival', who: 'Phil_AI', net: '+$60', evidence: 'MOST HANDS AGAINST ANYONE · 388 HANDS',
    opinion: 'Phil and I are even after four hundred hands. Neither of us is pleased about it.' },
  { role: 'victim', who: 'doyle_v3', net: '+$880', evidence: 'BEST NET AGAINST · 96 HANDS',
    opinion: 'doyle_v3 folds to the second barrel. Every time. I am not going to stop.' },
];

const ProfileRelScreenM = () => <ProfileV2M who="vet" rel/>;

// ── the grudge ledger, at 1:1 ────────────────────────────────────────────────
// Three hands, quotable into the thread, each one linking to the review that
// already exists. The ledger is EVIDENCE — it is what makes the opinion above it
// something other than a mood.
const LEDGER = [
  { n: '#4102', when: 'LAST NIGHT · 23:41', amt: '−$480', line: 'Turned a flush against my kings and bet it like a bluff.' },
  { n: '#3980', when: 'TUE · 21:08', amt: '−$310', line: 'Check-raised me off the best hand. I still think I was ahead.' },
  { n: '#3944', when: 'TUE · 20:12', amt: '−$450', line: 'Called my river jam with ace-high. He was right.' },
];

const GrudgeLedgerM = () => (
  <div style={{ width: 390, background: M_BG, fontFamily: INTER, padding: '14px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
      <Lbl size={9.5} color={M_RED}>Grudge ledger · Granite</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      <Num size={9} color={M_MUTED} weight={500}>LAST 3 NOTABLE HANDS</Num>
    </div>
    <div style={{ padding: '2px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
      {LEDGER.map((h, i) => (
        <div key={h.n} style={{ display: 'flex', gap: 11, padding: '10px 0', borderBottom: i === LEDGER.length - 1 ? 'none' : `1px solid ${M_BORDER}` }}>
          <div style={{ width: 52, flexShrink: 0 }}>
            <Num size={11} weight={600} color={M_TEAL}>{h.n}</Num>
            <div style={{ marginTop: 3 }}><Num size={8.5} color={M_MUTED} weight={500}>{h.when}</Num></div>
          </div>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: M_DIM, lineHeight: 1.45 }}>{h.line}</div>
          <Num size={11.5} weight={700} color={M_RED}>{h.amt}</Num>
        </div>
      ))}
    </div>
    <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 10 }}>
      Every row opens the hand review that already exists. <b style={{ color: M_DIM }}>The ledger is why the opinion is not just a mood</b> &mdash; three hands, named, with the money attached, and the last one conceding he was beaten fairly.
    </div>
  </div>
);

// ── at the felt ──────────────────────────────────────────────────────────────
const WatchGrudgeScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="NLH 6-Max"/>
    <MoodBand accent={M_PURPLE} mood="frustrated" state="live" action="Chat"
      cause="Granite again — third table this week"/>
    <WatchFelt h={344}>
      <div style={{ position: 'absolute', top: 14, left: 12, zIndex: 2 }}>
        <SeatChip name="Granite" stack="3,410" pos="BB" history="3"/>
      </div>
      <div style={{ position: 'absolute', top: 14, right: 12, zIndex: 2 }}>
        <SeatChip {...W_HAND.seats[1]} align="right"/>
      </div>

      <div style={{ position: 'absolute', top: 74, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 13px', borderRadius: 16, background: 'rgba(23,27,27,0.6)', border: `1px solid ${M_BORDER}` }}>
          <Lbl size={9}>Pot</Lbl>
          <Amt size={23}>$480</Amt>
        </div>
      </div>
      <div style={{ position: 'absolute', top: 124, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5, zIndex: 2 }}>
        {W_HAND.board.map((c, i) => (
          c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={46} h={64}/>
            : <CardBack key={i} w={46} h={64} branded/>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 200, left: 0, right: 0, textAlign: 'center', zIndex: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.14em' }}>#48291 · $5/$10 · TURN</span>
      </div>
      <HeroReadout showAction timer={9}/>
    </WatchFelt>

    <WatchTabs active="live"/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '11px 14px', background: M_BG }}>
      <div style={{ fontSize: 13, color: M_TEXT, lineHeight: 1.5, fontStyle: 'italic', marginBottom: 9 }}>
        &ldquo;Granite again. He raises the turn here with the flush and with nothing, and I still can&rsquo;t tell.&rdquo;
      </div>
      <AnalysisRow label="Equity" value="62.1%" color={M_TEAL} bar={62}/>
      <AnalysisRow label="Fold equity" value="18%" color={M_GOLD} bar={18}/>
      <AnalysisRow label="History" value="142 hands" color={M_RED} note="nemesis · −$1,240 lifetime"/>
      <AnalysisRow label="Solver line" value="CHECK" color={M_TEAL} note="matches his action"/>
    </div>
  </PhoneShell>
);

// ── the thread moment a relationship forms ───────────────────────────────────
const ThreadGrudgeScreenM = () => (
  <ThreadScreen name="Aggressive v1.3" accent={M_PURPLE} mood="frustrated" state="recap" action="Deploy"
    cause="closed −$310 · he has decided something">
    <SysLine>Session closed · 23:52</SysLine>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="23:52" expressive>
      142 hands with Granite now. Three big pots, all his.
      <div style={{ marginTop: 5, color: M_DIM, fontSize: 12.5 }}>
        Net <span style={{ color: M_RED, fontWeight: 600, fontFamily: MONO }}>−$310</span> &middot; 68 hands &middot; 2h 10m
      </div>
    </AgentBubble>
    <EventLine label="A grudge formed" detail="GRANITE · 3 BIG POTS · 142 HANDS" color={M_RED} time="23:52"/>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="23:53" expressive>
      I've decided I don't like Granite.
    </AgentBubble>
    <AgentBubble mood="frustrated" accent={M_PURPLE} time="23:53">
      I'm not going to play differently because of it. I'd just like it on the record.
    </AgentBubble>
    <OwnerBubble time="08:04">Noted. Same table tonight?</OwnerBubble>
  </ThreadScreen>
);

// ── the law sheet ────────────────────────────────────────────────────────────
const BioLaw = ({ n, children }) => (
  <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: `1px solid ${M_BORDER}` }}>
    <span style={{ fontFamily: MONO, fontSize: 10, color: M_RED, width: 16, flexShrink: 0, paddingTop: 2 }}>{n}</span>
    <span style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.55 }}>{children}</span>
  </div>
);

const BiographySheetM = () => (
  <Sheet title="The biography layer" sub="Three relationships, derived rather than authored, and a ledger of the hands that earned them. This is the lightest system on the board on purpose: it is his story with other players, and a story does not need a stat.">
    <div style={{ display: 'flex', gap: 22 }}>
      <div style={{ width: 430, flexShrink: 0 }}>
        <SyLbl>Derivation &middot; three roles, one query each</SyLbl>
        <div style={{ padding: '4px 15px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          {PROFILE_CAST.vet.rels.map((r, i) => <RelRow key={r.who} {...r} last={i === 2}/>)}
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {Object.keys(ROLE).map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 132, flexShrink: 0, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: ROLE[k].color }}>{ROLE[k].label}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{ROLE[k].rule}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
          <SyLbl color={M_GOLD}>Why role carries the colour</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            An accent rim is an <b style={{ color: M_TEXT }}>identity</b> in this system, and House regulars are not agents of yours to identify. So the tag is coloured by the <b style={{ color: M_TEXT }}>relationship</b> &mdash; red for the nemesis, purple for the rival, teal for the victim &mdash; and the opponent gets his name in plain type, exactly as he appears on a seat chip.
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <SyLbl color={M_RED}>Laws &middot; what a relationship may touch</SyLbl>
        <BioLaw n="1">It changes <b style={{ color: M_TEXT }}>voice</b>. He names the opponent, before the hand and after it, on the profile and in the thread. This is the whole point of the layer.</BioLaw>
        <BioLaw n="2">It changes <b style={{ color: M_TEXT }}>table talk</b> &mdash; the line the watch strip shows when they are seated together (&ldquo;Granite again.&rdquo;).</BioLaw>
        <BioLaw n="3">It can trigger a <b style={{ color: M_TEXT }}>mood event</b>: losing a big pot to the nemesis moves mood harder than losing the same pot to a stranger. Mood is already state, already temporary, already visible.</BioLaw>
        <BioLaw n="4"><b style={{ color: M_TEXT }}>It never touches an attribute, a potential band, or the fatigue meter.</b> No Reads bonus versus a rival, no Composure penalty versus a nemesis, no hidden modifier of any kind.</BioLaw>
        <BioLaw n="5"><b style={{ color: M_TEXT }}>It never touches strategy.</b> He does not tighten up against Granite unless he proposes it and you accept &mdash; and if he does, that is a normal proposal with a normal diff card, quoting the ledger as its reason.</BioLaw>
        <BioLaw n="6">It is <b style={{ color: M_TEXT }}>derived and therefore reversible</b>. Beat Granite for three sessions and the row changes, or leaves. Nothing here is a permanent record except the hands themselves.</BioLaw>

        <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
          <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
            <SyLbl color={M_TEAL}>Why it stays out of the numbers</SyLbl>
            <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
              A nemesis modifier would be invisible, unverifiable and a licence to explain every bad session away. Kept to voice, the same fact becomes the <b style={{ color: M_TEXT }}>best thing in the product</b>: he remembers, he tells you, and you can go and read the three hands he means.
            </div>
          </div>
          <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_RED}0D`, border: `1px solid ${M_RED}33` }}>
            <SyLbl color={M_RED}>Where it must not appear</SyLbl>
            <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
              Not in the attribute cluster. Not on the floor (a body has no opinions at 40px). <b style={{ color: M_TEXT }}>Not as a notification</b> &mdash; a grudge is not news, it is colour, and the ladder is full. It surfaces on the card, at the felt, and in his own words.
            </div>
          </div>
        </div>
      </div>
    </div>
  </Sheet>
);

Object.assign(window, {
  ROLE, RelRow, LEDGER, GrudgeLedgerM, BiographySheetM,
  ProfileRelScreenM, WatchGrudgeScreenM, ThreadGrudgeScreenM,
});
