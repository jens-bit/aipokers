// 08 YOU · 09 MOOD SHEET (reference artifact)

const StatCell = ({ l, v, c = M_TEXT }) => (
  <div style={{ background: M_PANEL, padding: '10px 13px' }}>
    <Lbl size={9}>{l}</Lbl>
    <div style={{ marginTop: 3 }}><Num size={16} weight={700} color={c}>{v}</Num></div>
  </div>
);

const SettingRow = ({ icon, glyph, label, value, last }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderBottom: last ? 'none' : `1px solid ${M_BORDER}` }}>
    {glyph || <Icon name={icon} size={15} color={M_DIM} strokeWidth={1.7}/>}
    <span style={{ flex: 1, fontSize: 13, color: M_TEXT }}>{label}</span>
    {value && <span style={{ fontSize: 12, color: M_MUTED }}>{value}</span>}
    <Icon name="chevron-right" size={15} color={M_MUTED}/>
  </div>
);

// icons.jsx has no bell case — drawn inline, as home.jsx and ftu-home.jsx already do
const BellGlyph = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="1.7" strokeLinecap="round" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3z"/>
    <path d="M10 21a2 2 0 0 0 4 0"/>
  </svg>
);

const ReplayRow = ({ cards, label, meta, amount, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      <MiniCard rank={cards[0][0]} suit={cards[0][1]}/>
      <MiniCard rank={cards[1][0]} suit={cards[1][1]}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ marginTop: 1 }}><Num size={9.5} color={M_MUTED} weight={500}>{meta}</Num></div>
    </div>
    <Num size={12} weight={700} color={color}>{amount}</Num>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>
    </svg>
  </div>
);

const YouScreenM = () => (
  <PhoneShell>
    <GlobalHeader/>

    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* balance */}
      <div style={{ margin: '0 14px 14px', padding: '14px 16px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0A0A0A', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>JM</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: PLAYFAIR, fontSize: 17, fontWeight: 600, color: M_TEXT }}>jmorr</div>
            <div style={{ marginTop: 1 }}><Num size={10} color={M_MUTED} weight={500}>SINCE MAR 2026 · 4 AGENTS</Num></div>
          </div>
          <Btn kind="outline" h={28}>Add chips</Btn>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${M_BORDER}` }}>
          <Icon name="chip" size={16} color={M_TEAL}/>
          <Amt size={26}>2,340.50</Amt>
          <div style={{ flex: 1 }}/>
          <Lbl size={9}>Balance</Lbl>
        </div>
      </div>

      {/* lifetime */}
      <div style={{ padding: '0 14px', marginBottom: 7 }}><Lbl size={9.5}>Lifetime</Lbl></div>
      <div style={{ margin: '0 14px 14px', borderRadius: 12, overflow: 'hidden', border: `1px solid ${M_BORDER}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: M_BORDER }}>
        <StatCell l="Hands played" v="12,480"/>
        <StatCell l="Win rate" v="56.2%" c={M_TEAL}/>
        <StatCell l="Biggest pot" v="$1,240" c={M_GOLD}/>
        <StatCell l="Agents built" v="7"/>
      </div>

      {/* replays */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', marginBottom: 7 }}>
        <Lbl size={9.5}>Replays · notable hands</Lbl>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_TEAL, fontWeight: 600 }}>ALL 34</span>
      </div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        <ReplayRow cards={[['A','s'],['A','h']]} label="Set over set vs Phil_AI" meta="BALANCED V2.1 · MAY 6" amount="+$847" color={M_TEAL}/>
        <ReplayRow cards={[['7','c'],['6','c']]} label="Bluff-jammed the river" meta="AGGRESSIVE V1.3 · MAY 6" amount="−$340" color={M_RED}/>
        <ReplayRow cards={[['K','s'],['Q','s']]} label="Hero call on the river" meta="BLUFF MASTER · MAY 4" amount="+$512" color={M_TEAL}/>
      </div>

      {/* settings */}
      <div style={{ padding: '0 14px', marginTop: 15, marginBottom: 7 }}><Lbl size={9.5}>Settings</Lbl></div>
      <div style={{ margin: '0 14px', borderRadius: 12, overflow: 'hidden', background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <SettingRow glyph={<BellGlyph/>} label="Notifications" value="All agents"/>
        <SettingRow icon="shield" label="Table limits" value="$10/$20"/>
        <SettingRow icon="info" label="Help & rules" last/>
      </div>
    </div>
    <TabBar active="you"/>
  </PhoneShell>
);

// ─────────── 09 MOOD SHEET ───────────

const MOOD_ORDER = ['confident', 'neutral', 'frustrated', 'tilted', 'sulking'];

const MOOD_DOC = {
  confident:  { rule: 'Strong teal glow, eyes wide + brow lift', trig: 'Won big pots, hero call paid off' },
  neutral:    { rule: 'Eyes take the agent accent, glow off', trig: 'Even session, nothing notable' },
  frustrated: { rule: 'Gold shift, eyes narrow inward', trig: 'Lost as the equity favourite' },
  tilted:     { rule: 'Red glow, angled eyes + brow', trig: 'Bad beat again, or shown a bluff' },
  sulking:    { rule: 'Desaturated, hood slumps, eyes down', trig: 'Long card-dead stretch' },
};

const MoodSheetRow = ({ mood, accent }) => {
  const m = MOODS[mood];
  const d = MOOD_DOC[mood];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 14px', borderTop: `1px solid ${M_BORDER}` }}>
      <div style={{
        width: 62, height: 62, borderRadius: 14, flexShrink: 0,
        background: '#0A0F17', border: `1px solid ${accent}44`,
        boxShadow: `0 0 16px ${m.color}${mood === 'neutral' || mood === 'sulking' ? '1F' : '3D'}`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood={mood} accent={accent} size={60} ring={false}/>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
        <MoodAvatar mood={mood} accent={accent} size={30} pip={11}/>
        <Num size={8} color={M_MUTED} weight={500}>30px</Num>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MoodChip mood={mood} small/>
        <div style={{ fontSize: 11.5, color: M_DIM, marginTop: 6, lineHeight: 1.4 }}>{d.rule}</div>
        <div style={{ fontSize: 11, color: M_MUTED, marginTop: 3, lineHeight: 1.4, fontStyle: 'italic' }}>{d.trig}</div>
      </div>
    </div>
  );
};

const MoodSheetScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Moods"/>

    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ padding: '13px 14px 12px' }}>
        <div style={{ fontSize: 12.5, color: M_DIM, lineHeight: 1.55 }}>
          Every agent carries a mood between sessions. <span style={{ color: M_TEXT }}>Identity is the accent colour</span> on the rim; <span style={{ color: M_TEXT }}>mood is the eyes and the glow</span>. Moods come from poker only — beats, streaks, being read.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 8px' }}>
        <Lbl size={9}>Large</Lbl>
        <div style={{ width: 30 }}/>
        <Lbl size={9}>Badge</Lbl>
        <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      </div>

      {MOOD_ORDER.map((mood, i) => (
        <MoodSheetRow key={mood} mood={mood} accent={[M_TEAL, M_PURPLE, M_GOLD, M_PURPLE, M_PINK][i]}/>
      ))}

      <div style={{ margin: '14px 14px 0', padding: '11px 13px', borderRadius: 10, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <Lbl size={9} color={M_TEAL}>Rules</Lbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.55, marginTop: 6 }}>
          Tilt-resistance varies by personality — a disciplined grinder barely tilts, a hothead tilts fast. A pep talk moves state one step; a winning session moves it back on its own. Nothing references your absence.
        </div>
      </div>
    </div>
  </PhoneShell>
);

Object.assign(window, { YouScreenM, MoodSheetScreenM, MOOD_ORDER });
