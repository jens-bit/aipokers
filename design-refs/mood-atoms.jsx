// Shared atoms for the mobile mood concepts — tokens, ghost avatar, phone shell.

const M_BG = '#0A0A0A';
const M_PANEL = '#111111';
const M_PANEL_2 = '#131316';
const M_SURF = '#1A1A1F';
const M_BORDER = 'rgba(255,255,255,0.06)';
const M_BORDER_2 = 'rgba(255,255,255,0.10)';
const M_TEXT = '#EDEDED';
const M_DIM = '#A1A1A1';
const M_MUTED = '#6B6B6B';
const M_FAINT = '#3A3A3F';
const M_TEAL = '#00D4AA';
const M_GOLD = '#CDB380';
const M_RED = '#FF4D4F';
const M_PURPLE = '#9B7BFF';
const M_PINK = '#FF7A8E';

const PLAYFAIR = '"Playfair Display", Georgia, serif';
// Display-only face: pot amounts, agent names at zoom, the birth title. One weight,
// no italic. NEVER body, labels, or table numerals — that is the S1 law.
const ROZHA = '"Rozha One", Georgia, serif';
const OSWALD = '"Oswald", "Inter", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INTER = '"Inter", -apple-system, system-ui, sans-serif';

// Identity = accent (border/rim). Mood = eyes + glow. Never mixed.
// Neutral/sulking use the existing --neutral and --text-muted tokens from styles.css.
const MOODS = {
  confident:  { label: 'CONFIDENT',  color: M_TEAL,   glow: 0.34, pip: '▲', cause: 'won three big pots in a row' },
  neutral:    { label: 'NEUTRAL',    color: '#888888', glow: 0.10, pip: '–', cause: 'even session, nothing notable' },
  frustrated: { label: 'FRUSTRATED', color: M_GOLD,   glow: 0.20, pip: '!', cause: 'folded the best hand twice' },
  tilted:     { label: 'TILTED',     color: M_RED,    glow: 0.36, pip: '⚡', cause: 'lost two big pots as favorite' },
  sulking:    { label: 'SULKING',    color: '#6B6B6B', glow: 0.07, pip: '▾', cause: 'got shown a bluff, wants to sit out' },
};

// ── The expression vehicle ──
const MoodGhost = ({ mood = 'neutral', accent = M_TEAL, size = 40, ring = true, tone }) => {
  const uid = React.useId().replace(/:/g, '');
  const m = MOODS[mood];
  // `tone`: a full colour override for the mood-driven parts (eyes + glow). Product
  // surfaces never pass it — it exists so marketing can render the anatomy in its own
  // territory (gold) without the atom hardcoding teal past the accent prop.
  const mc = tone || m.color;
  const eye = tone ? tone : (mood === 'neutral' ? accent : m.color);
  const slump = mood === 'sulking';
  const cy = slump ? 46 : 42;

  const eyes = () => {
    if (mood === 'confident') return (
      <g>
        <ellipse cx="33.5" cy={cy - 2} rx="3" ry="2.4" fill={eye}/>
        <ellipse cx="46.5" cy={cy - 2} rx="3" ry="2.4" fill={eye}/>
        <path d={`M30 ${cy - 7} L37 ${cy - 8.5}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.75"/>
        <path d={`M50 ${cy - 7} L43 ${cy - 8.5}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.75"/>
      </g>
    );
    if (mood === 'frustrated') return (
      <g>
        <g transform={`rotate(-14 33.5 ${cy})`}><rect x="30.4" y={cy - 1.1} width="6.4" height="2.2" rx="1.1" fill={eye}/></g>
        <g transform={`rotate(14 46.5 ${cy})`}><rect x="43.4" y={cy - 1.1} width="6.4" height="2.2" rx="1.1" fill={eye}/></g>
      </g>
    );
    if (mood === 'tilted') return (
      <g>
        <g transform={`rotate(-24 33.5 ${cy})`}><rect x="30.2" y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={eye}/></g>
        <g transform={`rotate(24 46.5 ${cy})`}><rect x="43.2" y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={eye}/></g>
        <path d={`M29.5 ${cy - 6.5} L37.5 ${cy - 4}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round"/>
        <path d={`M50.5 ${cy - 6.5} L42.5 ${cy - 4}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round"/>
      </g>
    );
    if (mood === 'sulking') return (
      <g>
        <ellipse cx="33.5" cy={cy + 2.5} rx="2.2" ry="1.3" fill={eye}/>
        <ellipse cx="46.5" cy={cy + 2.5} rx="2.2" ry="1.3" fill={eye}/>
        <path d={`M30.6 ${cy - 0.6} A3 3 0 0 1 36.4 ${cy - 0.6}`} stroke={eye} strokeWidth="1" fill="none" opacity="0.55"/>
        <path d={`M43.6 ${cy - 0.6} A3 3 0 0 1 49.4 ${cy - 0.6}`} stroke={eye} strokeWidth="1" fill="none" opacity="0.55"/>
      </g>
    );
    return (
      <g>
        <ellipse cx="34" cy={cy} rx="2.5" ry="1.7" fill={eye}/>
        <ellipse cx="46" cy={cy} rx="2.5" ry="1.7" fill={eye}/>
      </g>
    );
  };

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`g${uid}`} cx="50%" cy="54%" r="52%">
          <stop offset="0" stopColor={mc} stopOpacity={m.glow}/>
          <stop offset="1" stopColor={mc} stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={`h${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#141A22"/>
          <stop offset="1" stopColor="#0A0F17"/>
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="44" rx="44" ry="42" fill={`url(#g${uid})`}/>
      {slump
        ? <path d="M40 20 C27 20 20 32 20 48 L17 80 L63 80 L60 48 C60 32 53 20 40 20 Z" fill={`url(#h${uid})`} stroke={ring ? `${accent}66` : 'transparent'} strokeWidth="1.4"/>
        : <path d="M40 12 C26 12 18 24 18 42 L18 80 L62 80 L62 42 C62 24 54 12 40 12 Z" fill={`url(#h${uid})`} stroke={ring ? `${accent}66` : 'transparent'} strokeWidth="1.4"/>}
      <ellipse cx="40" cy={cy} rx="13.5" ry="16.5" fill="#04070C"/>
      {eyes()}
    </svg>
  );
};

// Tiny state pip that sits on a list-row avatar
const MoodPip = ({ mood, size = 15 }) => {
  const m = MOODS[mood];
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: '#0A0A0A', border: `1.5px solid ${m.color}`,
      boxShadow: `0 0 6px ${m.color}66`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: MONO, fontSize: size * 0.52, fontWeight: 700, color: m.color,
      lineHeight: 1, flexShrink: 0,
    }}>{m.pip}</span>
  );
};

// Avatar + pip, used in every list row
const MoodAvatar = ({ mood, accent, size = 44, pip = 15 }) => (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
    <div style={{
      width: size, height: size, borderRadius: 12, overflow: 'hidden',
      background: '#0A0F17', border: `1px solid ${accent}44`,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <MoodGhost mood={mood} accent={accent} size={size * 0.94} ring={false}/>
    </div>
    <div style={{ position: 'absolute', bottom: -3, right: -3 }}><MoodPip mood={mood} size={pip}/></div>
  </div>
);

const MoodChip = ({ mood, small }) => {
  const m = MOODS[mood];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: small ? 18 : 22, padding: small ? '0 6px' : '0 8px', borderRadius: 4,
      background: `${m.color}1A`, border: `1px solid ${m.color}44`,
      fontFamily: OSWALD, fontSize: small ? 9 : 10, fontWeight: 600,
      letterSpacing: '0.12em', color: m.color, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: m.color, boxShadow: `0 0 5px ${m.color}` }}/>
      {m.label}
    </span>
  );
};

// ── generic bits ──
const Lbl = ({ children, color = M_MUTED, size = 10 }) => (
  <span style={{ fontFamily: OSWALD, fontSize: size, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase', color }}>{children}</span>
);

const Num = ({ children, color = M_TEXT, size = 13, weight = 600 }) => (
  <span style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{children}</span>
);

const Amt = ({ children, color = M_TEXT, size = 24 }) => (
  <span style={{ fontFamily: ROZHA, fontSize: size, fontWeight: 400, color, letterSpacing: '0.005em' }}>{children}</span>
);

const LiveDot = ({ color = M_TEAL, size = 6 }) => (
  <span style={{ width: size, height: size, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, animation: 'pulse 2s infinite', flexShrink: 0, display: 'inline-block' }}/>
);

const Btn = ({ children, kind = 'primary', h = 34, full, onClick }) => {
  const base = { height: h, padding: '0 14px', borderRadius: 8, fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: full ? '100%' : 'auto', textTransform: 'uppercase' };
  const kinds = {
    primary: { background: M_TEAL, border: 'none', color: '#0A0A0A', boxShadow: `0 0 14px ${M_TEAL}44` },
    ghost: { background: 'transparent', border: `1px solid ${M_BORDER_2}`, color: M_DIM },
    outline: { background: 'transparent', border: `1px solid ${M_TEAL}`, color: M_TEAL },
  };
  return <button onClick={onClick} style={{ ...base, ...kinds[kind] }}>{children}</button>;
};

// ── phone shell — the real IOSDevice from ios-frame.jsx, sized to Telegram width ──
const PhoneShell = ({ children }) => (
  <IOSDevice width={390} height={844} dark={true}>
    <div style={{
      width: '100%', height: '100%', paddingTop: 54,
      background: M_BG, fontFamily: INTER, color: M_TEXT,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  </IOSDevice>
);

// Quieter than the content it sits under — slim bar, small icons, teal tint only.
const TabBar = ({ active = 'chats' }) => {
  const tabs = [
    { id: 'casino', label: 'Casino', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="12" rx="9" ry="5.5"/><ellipse cx="12" cy="12" rx="5" ry="2.6"/></svg> },
    { id: 'chats', label: 'Chats', badge: 3, icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
    { id: 'you', label: 'You', icon: (c) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg> },
  ];
  return (
    <div style={{ flexShrink: 0, height: 62, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', alignItems: 'flex-start', paddingTop: 8 }}>
      {tabs.map(t => {
        const on = t.id === active;
        const c = on ? M_TEAL : M_MUTED;
        return (
          <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <div style={{ position: 'relative' }}>
              {t.icon(c)}
              {t.badge && (
                <span style={{ position: 'absolute', top: -3, right: -7, minWidth: 13, height: 13, padding: '0 3.5px', borderRadius: 7, background: on ? M_TEAL : 'rgba(255,255,255,0.10)', color: on ? '#0A0A0A' : M_DIM, fontFamily: MONO, fontSize: 8, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span>
              )}
            </div>
            <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: c }}>{t.label}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── LAW 1 · the global header. Right side is identical on every screen. ──
const SpadeLogo = () => (
  <svg width="17" height="21" viewBox="0 0 22 26" style={{ display: 'block', flexShrink: 0 }}>
    <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z" fill="none" stroke={M_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={M_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
  </svg>
);

const GlobalHeader = ({ title, back }) => (
  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 9, padding: '2px 14px 10px' }}>
    {back && (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginRight: -2 }}><path d="M15 18l-6-6 6-6"/></svg>
    )}
    <SpadeLogo/>
    <span style={{
      fontFamily: OSWALD, fontWeight: 600, color: M_TEXT,
      fontSize: title ? 12.5 : 12,
      letterSpacing: title ? '0.14em' : '0.18em',
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      textTransform: 'uppercase',
    }}>{title || 'Agentic Poker'}</span>
    <div style={{ flex: 1, minWidth: 6 }}/>
    {/* right side — never varies */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 29, padding: '0 10px', borderRadius: 15, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, flexShrink: 0 }}>
      <Icon name="chip" size={12} color={M_TEAL}/>
      <Num size={11.5}>2,340.50</Num>
    </div>
    <div style={{ width: 29, height: 29, borderRadius: 15, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.7" strokeLinecap="round"><path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3z"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>
      <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: '50%', background: M_TEAL, boxShadow: `0 0 5px ${M_TEAL}` }}/>
    </div>
  </div>
);

// ── LAW 2 · agent states, one visual system everywhere ──
// Three states describe an agent that exists. 'drafting' describes one that does not yet:
// it borrows M_DIM (no new colour) and is marked by a dashed ring, never a filled dot.
const STATES = {
  live:     { label: 'LIVE',     color: M_TEAL },
  resting:  { label: 'RESTING',  color: M_MUTED },
  recap:    { label: 'RECAP',    color: M_GOLD },
  drafting: { label: 'DRAFTING', color: M_DIM, dashed: true },
};

const StateTag = ({ state, compact }) => {
  const s = STATES[state];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
      height: compact ? 16 : 18, padding: compact ? '0 5px' : '0 6px', borderRadius: 3,
      background: (state === 'resting' || s.dashed) ? 'rgba(255,255,255,0.04)' : `${s.color}1A`,
      border: s.dashed ? `1px dashed ${s.color}66` : `1px solid ${state === 'resting' ? M_BORDER_2 : `${s.color}55`}`,
    }}>
      {state === 'live' && <LiveDot size={4.5}/>}
      {state === 'recap' && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_GOLD} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M5 12l5 5 9-11"/></svg>
      )}
      {state === 'resting' && <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: M_MUTED }}/>}
      {s.dashed && <span style={{ width: 5.5, height: 5.5, borderRadius: '50%', border: `1px dashed ${s.color}`, animation: 'drift 3.2s ease-in-out infinite' }}/>}
      <span style={{ fontFamily: OSWALD, fontSize: compact ? 8.5 : 9, fontWeight: 600, letterSpacing: '0.12em', color: s.color }}>{s.label}</span>
    </span>
  );
};

// thread context band — sits under the global header, carries mood + state + action
const MoodBand = ({ accent, mood, cause, state, action }) => {
  const m = MOODS[mood];
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
      padding: '9px 14px 11px', borderBottom: `1px solid ${M_BORDER}`,
      background: M_PANEL,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: '#0A0F17', border: `1px solid ${accent}55`,
        boxShadow: `0 0 14px ${m.color}33`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood={mood} accent={accent} size={40} ring={false}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MoodChip mood={mood} small/>
          <StateTag state={state} compact/>
        </div>
        <div style={{ fontSize: 11.5, color: m.color, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cause}</div>
      </div>
      {action && <Btn kind={state === 'live' ? 'ghost' : 'outline'} h={30}>{action}</Btn>}
    </div>
  );
};

// THE CORE MECHANIC — one bar, two homes: docked under a thread header, and slotted
// into a zoom under the speech bubble. Same component, same size, so live state reads
// identically in both. The floor needs no bar — the felt itself is the zero-tap view.
const LiveBar = ({ table, blinds, pot, equity, action, timer = 12, board, street,
                  hole, faceDown, note, strip }) => (
  <div style={{
    flexShrink: 0, background: M_PANEL_2,
    // as a zoom strip the wrapper owns the border, so don't draw a second one
    ...(strip ? {} : { borderBottom: `1px solid ${M_TEAL}3D` }),
    boxShadow: `inset 0 1px 0 ${M_TEAL}2E, 0 6px 14px rgba(0,0,0,0.35)`,
    cursor: 'pointer',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 0' }}>
      {faceDown
        ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: M_MUTED, flexShrink: 0 }}/>
        : <LiveDot size={5}/>}
      <Lbl size={9} color={faceDown ? M_MUTED : M_TEAL}>{faceDown ? 'Between hands' : 'Live'}</Lbl>
      <Num size={9.5} color={M_MUTED} weight={500}>#{table} · {blinds}{faceDown ? '' : ` · ${street}`}</Num>
      <div style={{ flex: 1 }}/>
      {!faceDown && <Num size={10} color={timer <= 5 ? M_RED : M_DIM} weight={600}>{timer}s</Num>}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6"/></svg>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 14px 9px' }}>
      {/* the agent's own hand — the first place faces are ever shown */}
      {hole && (
        <>
          <div style={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
            {hole.map((c, i) => (
              <div key={i} style={{ transform: `rotate(${i ? 4 : -4}deg)` }}>
                {faceDown
                  ? <CardBack w={21} h={29} branded/>
                  : <PlayingCard rank={c[0]} suit={c[1]} w={21} h={29}/>}
              </div>
            ))}
          </div>
          <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
        </>
      )}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        {board.map((c, i) => (
          c && !faceDown ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={19} h={26}/>
            : <CardBack key={i} w={19} h={26} branded/>
        ))}
      </div>
      {note ? (
        <>
          <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
          <div style={{ fontSize: 12, color: M_MUTED, fontStyle: 'italic', minWidth: 0 }}>{note}</div>
          <div style={{ flex: 1 }}/>
        </>
      ) : (
        <>
          <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
          <div style={{ minWidth: 0 }}>
            <Lbl size={8.5}>Pot</Lbl>
            <div><Num size={13} weight={700}>${pot}</Num></div>
          </div>
          <div style={{ width: 1, height: 22, background: M_BORDER, flexShrink: 0 }}/>
          <div style={{ minWidth: 0 }}>
            <Lbl size={8.5}>Equity</Lbl>
            <div><Num size={13} weight={700} color={M_TEAL}>{equity}%</Num></div>
          </div>
          <div style={{ flex: 1 }}/>
          <span style={{ padding: '4px 9px', borderRadius: 5, background: M_TEAL, color: '#0A0A0A', fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', whiteSpace: 'nowrap', flexShrink: 0 }}>{action}</span>
        </>
      )}
    </div>
  </div>
);

// ── CANON · screen #5's tokens. Every screen derives from these. ──
const CANON = {
  pad: 14,          // content side padding
  radius: 12,       // card radius
  border: M_BORDER, // card border
  name: 15,         // agent name, Playfair
  body: 13.5,       // message body
  sub: 12,          // secondary line
  meta: 9.5,        // mono meta
  label: 9.5,       // section label
};

// screen chrome bits reused across chat screens
const ChatComposer = ({ placeholder = 'Message your agent…', chips, suggest, suggestLead }) => (
  <div style={{ flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, padding: '10px 14px 22px' }}>
    {suggest && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9, overflow: 'hidden' }}>
        {suggestLead && (
          <span style={{ flexShrink: 0, fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM, paddingRight: 2 }}>{suggestLead}</span>
        )}
        {suggest.map((c, i) => (
          <span key={i} style={{ flexShrink: 0, height: 26, padding: '0 10px', borderRadius: 13, background: M_PANEL_2, border: `1px solid ${i === 0 ? `${M_TEAL}55` : M_BORDER}`, display: 'inline-flex', alignItems: 'center', fontSize: 11.5, color: i === 0 ? M_TEAL : M_DIM, whiteSpace: 'nowrap' }}>{c}</span>
        ))}
      </div>
    )}
    {chips && (
      <div style={{ display: 'flex', gap: 6, marginBottom: 9, overflow: 'hidden' }}>
        {chips.map((c, i) => (
          <span key={i} style={{ flexShrink: 0, height: 24, padding: '0 9px', borderRadius: 5, background: M_PANEL_2, border: `1px solid ${M_BORDER}`, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 10, fontWeight: 600, color: M_TEAL }}>
            {c.cmd}<span style={{ fontFamily: INTER, fontSize: 10, fontWeight: 400, color: M_MUTED }}>{c.desc}</span>
          </span>
        ))}
      </div>
    )}
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, height: 44, padding: '0 6px 0 14px', borderRadius: 22, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
      <span style={{ flex: 1, fontSize: 13.5, color: M_MUTED }}>{placeholder}</span>
      <button style={{ width: 32, height: 32, borderRadius: '50%', background: M_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 10px ${M_TEAL}55` }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </div>
  </div>
);

const DayDivider = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', marginBottom: 14 }}>
    <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
    <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, letterSpacing: '0.14em' }}>{children}</span>
    <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
  </div>
);

const BackHeader = ({ children, right }) => (
  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px 12px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={M_TEXT} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M15 18l-6-6 6-6"/></svg>
    {children}
    {right}
  </div>
);

Object.assign(window, {
  M_BG, M_PANEL, M_PANEL_2, M_SURF, M_BORDER, M_BORDER_2, M_TEXT, M_DIM, M_MUTED, M_FAINT,
  M_TEAL, M_GOLD, M_RED, M_PURPLE, M_PINK, PLAYFAIR, ROZHA, OSWALD, MONO, INTER,
  MOODS, MoodGhost, MoodPip, MoodAvatar, MoodChip,
  Lbl, Num, Amt, LiveDot, Btn, PhoneShell, TabBar, ChatComposer, DayDivider, BackHeader,
  GlobalHeader, SpadeLogo, STATES, StateTag, MoodBand, LiveBar, CANON,
});
