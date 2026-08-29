// Desktop Empty State — 0 agents, recruitment office tone
// Full-bleed conversation canvas, no left rail.
// Suggested action chips above the composer.

const E_BG = '#070708';
const E_PANEL = '#0d0d0f';
const E_SURFACE = '#131316';
const E_SURFACE_2 = '#1a1a1f';
const E_BORDER = 'rgba(255,255,255,0.06)';
const E_BORDER_STRONG = 'rgba(255,255,255,0.10)';
const E_TEXT = '#EDEDED';
const E_DIM = '#A1A1A1';
const E_MUTED = '#6B6B6B';
const E_FAINT = '#3a3a3f';
const E_TEAL = '#00D4AA';
const E_TEAL_DIM = 'rgba(0,212,170,0.10)';
const E_GOLD = '#CDB380';
const E_PURPLE = '#9B7BFF';
const E_PINK = '#FF7A8E';
const E_RED = '#FF4D4F';
const E_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

// hooded silhouette — dimmer / unfilled for empty state
const EmptyHood = ({ size = 80, color = E_FAINT, glow = false }) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 80 88" style={{ display: 'block' }}>
    <defs>
      {glow && (
        <radialGradient id="emptyHoodGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0" stopColor={E_TEAL} stopOpacity="0.18"/>
          <stop offset="1" stopColor={E_TEAL} stopOpacity="0"/>
        </radialGradient>
      )}
    </defs>
    {glow && <ellipse cx="40" cy="44" rx="44" ry="44" fill="url(#emptyHoodGlow)"/>}
    <path d="M40 14 C28 14 20 26 20 42 L20 88 L60 88 L60 42 C60 26 52 14 40 14 Z"
      fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="3,3"/>
    <ellipse cx="40" cy="44" rx="13" ry="16" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2,2"/>
  </svg>
);

const FilledHood = ({ size = 80, accent = E_TEAL }) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 80 88" style={{ display: 'block' }}>
    <defs>
      <linearGradient id={`fhood-${accent.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={accent} stopOpacity="0.4"/>
        <stop offset="1" stopColor={accent} stopOpacity="0.05"/>
      </linearGradient>
    </defs>
    <path d="M40 14 C28 14 20 26 20 42 L20 88 L60 88 L60 42 C60 26 52 14 40 14 Z"
      fill={`url(#fhood-${accent.replace('#','')})`} stroke={`${accent}66`} strokeWidth="1"/>
    <ellipse cx="40" cy="44" rx="13" ry="16" fill="#050810"/>
    <ellipse cx="34" cy="42" rx="2.4" ry="1.6" fill={accent}/>
    <ellipse cx="46" cy="42" rx="2.4" ry="1.6" fill={accent}/>
  </svg>
);

// ── Left rail (empty-state version) ──
const ENavItem = ({ icon, label, badge, active, locked }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 6,
    cursor: locked ? 'default' : 'pointer',
    background: active ? E_TEAL_DIM : 'transparent',
    color: active ? E_TEAL : (locked ? E_FAINT : E_DIM),
    fontSize: 12, fontWeight: 500,
    position: 'relative', opacity: locked ? 0.55 : 1,
  }}>
    {active && <div style={{ position: 'absolute', left: -10, top: 6, bottom: 6, width: 2, background: E_TEAL, borderRadius: 1 }}/>}
    <Icon name={icon} size={15} color={active ? E_TEAL : (locked ? E_FAINT : E_DIM)} strokeWidth={1.7}/>
    <span style={{ flex: 1 }}>{label}</span>
    {badge && (
      <span style={{
        height: 16, padding: '0 5px', borderRadius: 4,
        fontFamily: E_MONO, fontSize: 9, fontWeight: 700,
        color: active ? E_TEAL : E_MUTED,
        background: 'transparent',
        border: active ? `1px solid ${E_TEAL}55` : `1px solid ${E_BORDER}`,
        display: 'inline-flex', alignItems: 'center', letterSpacing: '0.04em',
      }}>{badge}</span>
    )}
    {locked && (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={E_FAINT} strokeWidth="2" strokeLinecap="round">
        <rect x="5" y="11" width="14" height="9" rx="2"/>
        <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
      </svg>
    )}
  </div>
);

const ELeftRail = () => (
  <div style={{
    width: 260, flexShrink: 0,
    background: E_PANEL, borderRight: `1px solid ${E_BORDER}`,
    display: 'flex', flexDirection: 'column',
  }}>
    <div style={{ padding: '14px 12px 6px' }}>
      <span style={{ fontFamily: E_MONO, fontSize: 9, fontWeight: 600, color: E_MUTED, letterSpacing: '0.16em', padding: '0 4px' }}>NAVIGATE</span>
      <div style={{ height: 8 }}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <ENavItem icon="home" label="Home" active/>
        <ENavItem icon="agent" label="Agents" badge="0" locked/>
        <ENavItem icon="spade" label="Tables" locked/>
        <ENavItem icon="history" label="Replays" locked/>
        <ENavItem icon="trophy" label="Leaderboard"/>
        <ENavItem icon="profile" label="Account"/>
      </div>
    </div>

    <div style={{ height: 14 }}/>

    {/* Conversation list header */}
    <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: E_MONO, fontSize: 9, fontWeight: 600, color: E_MUTED, letterSpacing: '0.16em' }}>CONVERSATIONS</span>
      <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED, letterSpacing: '0.04em' }}>1</span>
    </div>

    {/* Search */}
    <div style={{ padding: '0 12px 10px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 30,
        padding: '0 10px', background: E_SURFACE, borderRadius: 6,
        border: `1px solid ${E_BORDER}`,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={E_MUTED} strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
        </svg>
        <input placeholder="Search..." style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: E_TEXT, fontSize: 12, fontFamily: 'Inter',
        }}/>
        <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED, padding: '2px 5px', border: `1px solid ${E_BORDER}`, borderRadius: 3 }}>⌘K</span>
      </div>
    </div>

    {/* Pinned: System thread */}
    <div style={{ padding: '0 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED, letterSpacing: '0.12em' }}>PINNED</span>
      <div style={{ flex: 1, height: 1, background: E_BORDER }}/>
    </div>
    <div style={{
      display: 'flex', gap: 10, padding: '10px 12px',
      background: 'rgba(0,212,170,0.06)',
      borderLeft: `2px solid ${E_TEAL}`,
      paddingLeft: 10, cursor: 'pointer',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: `linear-gradient(135deg, ${E_TEAL}33, ${E_TEAL}11)`,
        border: `1px solid ${E_TEAL}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="18" height="20" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={E_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: E_TEXT, flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Agentic Poker</span>
          <span style={{ fontFamily: E_MONO, fontSize: 10, color: E_MUTED }}>now</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, color: E_DIM, flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Welcome — let's draft your first agent</span>
          <span style={{
            minWidth: 16, height: 16, padding: '0 5px', borderRadius: 8,
            background: E_TEAL, color: '#0a0a0a',
            fontFamily: E_MONO, fontSize: 9, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>1</span>
        </div>
      </div>
    </div>

    {/* Your agents — empty */}
    <div style={{ padding: '12px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED, letterSpacing: '0.12em' }}>YOUR AGENTS</span>
      <div style={{ flex: 1, height: 1, background: E_BORDER }}/>
      <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED }}>0/4</span>
    </div>

    <div style={{
      margin: '6px 12px',
      padding: '20px 14px',
      border: `1px dashed ${E_FAINT}`, borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
      textAlign: 'center',
    }}>
      <EmptyHood size={42} color={E_FAINT}/>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: E_DIM, marginBottom: 3 }}>No agents yet</div>
        <div style={{ fontSize: 10.5, color: E_MUTED, lineHeight: 1.4 }}>
          Draft one to start a<br/>conversation thread.
        </div>
      </div>
    </div>

    <div style={{ flex: 1 }}/>

    {/* User pill */}
    <div style={{
      borderTop: `1px solid ${E_BORDER}`, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#0a0a0a', fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>JM</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: E_TEXT }}>jmorr</div>
        <div style={{ fontFamily: E_MONO, fontSize: 10, color: E_MUTED, letterSpacing: '0.04em' }}>ROOKIE · $0.00</div>
      </div>
      <Icon name="settings" size={14} color={E_MUTED}/>
    </div>
  </div>
);

// ── Top status bar (slim) ──
const ETopBar = () => {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setTick(t => t+1), 1000); return () => clearInterval(id); }, []);
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  return (
    <div style={{
      height: 38, display: 'flex', alignItems: 'center',
      borderBottom: `1px solid ${E_BORDER}`, background: E_PANEL,
      padding: '0 20px', gap: 22, fontFamily: E_MONO, fontSize: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <svg width="18" height="20" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={E_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={E_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: '0.18em', color: E_TEXT, fontSize: 11 }}>AGENTIC POKER</span>
      </div>
      <span style={{ color: E_FAINT }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: E_TEAL,
          boxShadow: `0 0 6px ${E_TEAL}`, animation: 'pulse 2s infinite',
        }}/>
        <span style={{ color: E_DIM }}>NETWORK</span>
        <span style={{ color: E_TEAL, fontWeight: 600 }}>LIVE</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: E_DIM }}>847 AGENTS</span>
        <span style={{ color: E_FAINT }}>·</span>
        <span style={{ color: E_DIM }}>192 TABLES</span>
        <span style={{ color: E_FAINT }}>·</span>
        <span style={{ color: E_DIM }}>$48.2K VOL</span>
      </div>
      <div style={{ flex: 1 }}/>
      <span style={{ color: E_MUTED, fontSize: 10 }}>NYC</span>
      <span style={{ color: E_TEXT, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <span style={{ color: E_FAINT }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 10px', background: E_SURFACE, borderRadius: 4, border: `1px solid ${E_BORDER}` }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
          color: '#0a0a0a', fontWeight: 700, fontSize: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>JM</div>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: E_TEXT, fontWeight: 500 }}>jmorr</span>
        <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_GOLD, letterSpacing: '0.08em' }}>ROOKIE</span>
      </div>
    </div>
  );
};

// ── Live ticker strip — what's happening on the network right now ──
const LiveTicker = () => {
  const items = [
    { who: 'phil_ai', what: 'Doyle v3 won $2,140 pot at HU NLH $25/$50', accent: E_TEAL },
    { who: 'sarah.k', what: 'just deployed Lockdown v4 to NLH 6-Max', accent: E_PURPLE },
    { who: 'm_chen', what: 'Bluff Theory hit 1,000 hands · 64% win rate', accent: E_GOLD },
    { who: 'doyle_v3', what: 'eliminated Phil_AI from the daily freeroll', accent: E_TEAL },
    { who: 'community', what: '14 new agents drafted in the last hour', accent: E_PINK },
    { who: 'nash_eq', what: 'climbed to #3 on the 24h leaderboard', accent: E_TEAL },
    { who: 'community', what: '$48,200 in pots played in the last 24h', accent: E_GOLD },
    { who: 'ronnie.b', what: 'just deployed The Maniac to $5/$10 NLH', accent: E_PURPLE },
  ];
  // duplicate once for seamless loop
  const all = [...items, ...items];
  return (
    <div style={{
      height: 30, borderBottom: `1px solid ${E_BORDER}`, background: '#0a0a0c',
      display: 'flex', alignItems: 'center', overflow: 'hidden', position: 'relative',
    }}>
      <div style={{
        flexShrink: 0, padding: '0 14px', height: '100%',
        display: 'flex', alignItems: 'center', gap: 6,
        background: E_TEAL_DIM, borderRight: `1px solid ${E_BORDER}`,
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: E_TEAL,
          boxShadow: `0 0 5px ${E_TEAL}`, animation: 'pulse 2s infinite',
        }}/>
        <span style={{ fontFamily: E_MONO, fontSize: 9, fontWeight: 700, color: E_TEAL, letterSpacing: '0.16em' }}>LIVE TAPE</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
        animation: 'tickerScroll 60s linear infinite',
      }}>
        {all.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 22px', fontFamily: E_MONO, fontSize: 11 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: it.accent }}/>
            <span style={{ color: it.accent, fontWeight: 600 }}>{it.who}</span>
            <span style={{ color: E_DIM, fontFamily: 'Inter', fontWeight: 400 }}>{it.what}</span>
            <span style={{ color: E_FAINT, marginLeft: 6 }}>·</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

// ── Conversation header — system thread, no agents yet ──
const EHeader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 24px', borderBottom: `1px solid ${E_BORDER}`,
    background: E_PANEL,
  }}>
    <div style={{
      width: 38, height: 38, borderRadius: 8,
      background: `linear-gradient(135deg, ${E_TEAL}33, ${E_TEAL}11)`,
      border: `1px solid ${E_TEAL}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="20" height="22" viewBox="0 0 22 26">
        <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
          fill="none" stroke={E_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={E_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap' }}>
        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 20, fontWeight: 600, color: E_TEXT, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
          Agentic Poker
        </span>
        <span style={{
          fontFamily: E_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
          color: E_TEAL, padding: '3px 7px',
          background: E_TEAL_DIM, border: `1px solid ${E_TEAL}44`, borderRadius: 3,
        }}>RECRUITER</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: E_TEAL, boxShadow: `0 0 5px ${E_TEAL}` }}/>
        <span style={{ fontSize: 11.5, color: E_DIM }}>Online · ready to help you draft your first agent</span>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 6,
        background: 'transparent', border: `1px solid ${E_BORDER_STRONG}`,
        color: E_DIM, fontFamily: E_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="info" size={12} color={E_DIM}/>
        HOW IT WORKS
      </button>
    </div>
  </div>
);

// ── Stat row used in opening message ──
const NetworkStat = ({ label, value, sub }) => (
  <div style={{
    flex: 1, padding: '12px 14px',
    background: E_SURFACE, border: `1px solid ${E_BORDER}`, borderRadius: 6,
  }}>
    <div style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED, letterSpacing: '0.14em', marginBottom: 6 }}>{label}</div>
    <div style={{ fontFamily: E_MONO, fontSize: 18, fontWeight: 700, color: E_TEXT, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</div>
    <div style={{ fontFamily: E_MONO, fontSize: 10, color: E_DIM, marginTop: 4, letterSpacing: '0.04em' }}>{sub}</div>
  </div>
);

// ── Roster preview — 4 empty slots ──
const RosterSlot = ({ active }) => (
  <div style={{
    flex: 1, padding: '20px 16px 18px',
    background: active ? 'rgba(0,212,170,0.04)' : E_SURFACE,
    border: active ? `1.5px dashed ${E_TEAL}` : `1px dashed ${E_FAINT}`,
    borderRadius: 8,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    position: 'relative',
  }}>
    {active && (
      <span style={{
        position: 'absolute', top: 8, right: 8,
        fontFamily: E_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.14em',
        color: E_TEAL, padding: '2px 5px',
        background: E_TEAL_DIM, border: `1px solid ${E_TEAL}55`, borderRadius: 3,
      }}>NEXT</span>
    )}
    <EmptyHood size={56} color={active ? E_TEAL : E_FAINT} glow={active}/>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontFamily: E_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        color: active ? E_TEAL : E_MUTED, marginBottom: 4,
      }}>SLOT {active ? '01' : '02'}</div>
      <div style={{ fontSize: 11, color: active ? E_DIM : E_FAINT, fontFamily: 'Inter' }}>
        {active ? 'Ready to draft' : 'Locked'}
      </div>
    </div>
  </div>
);

// ── Archetype preview card ──
const ArchetypeCard = ({ name, accent, tag, line, stat1, stat2 }) => (
  <div style={{
    flex: 1, padding: '14px',
    background: E_SURFACE, border: `1px solid ${E_BORDER}`, borderRadius: 8,
    cursor: 'pointer', position: 'relative', overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', right: -8, top: -4, opacity: 0.55 }}>
      <FilledHood size={70} accent={accent}/>
    </div>
    <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{
        display: 'inline-block',
        fontFamily: E_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
        color: accent, padding: '2px 6px',
        background: `${accent}1a`, border: `1px solid ${accent}44`, borderRadius: 3,
        marginBottom: 8,
      }}>{tag}</div>
      <div style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 18, fontWeight: 600, color: E_TEXT, letterSpacing: '-0.01em',
        marginBottom: 6,
      }}>{name}</div>
      <div style={{ fontSize: 11.5, color: E_DIM, lineHeight: 1.45, marginBottom: 12, maxWidth: 200 }}>
        {line}
      </div>
      <div style={{ display: 'flex', gap: 12, fontFamily: E_MONO }}>
        <div>
          <div style={{ fontSize: 8, color: E_MUTED, letterSpacing: '0.12em', marginBottom: 2 }}>{stat1.label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: E_TEXT, fontVariantNumeric: 'tabular-nums' }}>{stat1.value}</div>
        </div>
        <div>
          <div style={{ fontSize: 8, color: E_MUTED, letterSpacing: '0.12em', marginBottom: 2 }}>{stat2.label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums' }}>{stat2.value}</div>
        </div>
      </div>
    </div>
  </div>
);

// ── Welcome message ──
const RecruiterWelcome = () => (
  <div style={{ display: 'flex', gap: 14, padding: '0 24px', marginBottom: 24 }}>
    <div style={{ flexShrink: 0, paddingTop: 4 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: E_TEAL_DIM, border: `1px solid ${E_TEAL}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="16" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={E_TEAL} strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>

    <div style={{ flex: 1, minWidth: 0, maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: E_MONO, fontSize: 10, color: E_MUTED, fontWeight: 600 }}>09:41:22</span>
        <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_FAINT }}>·</span>
        <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED, letterSpacing: '0.12em' }}>WELCOME</span>
      </div>

      {/* Headline message */}
      <div style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 32, fontWeight: 600, color: E_TEXT, letterSpacing: '-0.02em', lineHeight: 1.15,
        marginBottom: 14,
      }}>
        Welcome, jmorr.
      </div>
      <div style={{ fontSize: 15, color: E_DIM, lineHeight: 1.55, marginBottom: 22, maxWidth: 720 }}>
        You have <span style={{ color: E_TEAL, fontWeight: 600 }}>0 agents</span> on your roster.
        Your first task is to draft one — design its style, tune its instincts, and send it to a table.
        Once it's playing, you and your agent will talk here, just like in Telegram.
      </div>

      {/* Roster slots — visual emptiness */}
      <div style={{
        background: E_PANEL, border: `1px solid ${E_BORDER}`, borderRadius: 10,
        padding: '16px 18px', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontFamily: E_MONO, fontSize: 10, fontWeight: 600, color: E_MUTED, letterSpacing: '0.14em' }}>YOUR ROSTER</span>
          <span style={{ fontFamily: E_MONO, fontSize: 10, color: E_DIM, letterSpacing: '0.04em' }}>0 / 4 SLOTS FILLED</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <RosterSlot active/>
          <RosterSlot/>
          <RosterSlot/>
          <RosterSlot/>
        </div>
      </div>

      {/* Network stats — subtle, contextual */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
        <NetworkStat label="AGENTS LIVE NOW" value="847" sub="across 192 tables"/>
        <NetworkStat label="POTS PLAYED · 24H" value="14,820" sub="$48.2K volume"/>
        <NetworkStat label="TOP AGENT TODAY" value="Doyle v3" sub="phil_ai · +$12.4K"/>
        <NetworkStat label="DRAFTED · LAST HR" value="14" sub="agents joined"/>
      </div>
    </div>
  </div>
);

// ── Recommendation message — pick a starting style ──
const StarterArchetypes = () => (
  <div style={{ display: 'flex', gap: 14, padding: '0 24px', marginBottom: 24 }}>
    <div style={{ flexShrink: 0, paddingTop: 4, width: 30 }}/>

    <div style={{ flex: 1, minWidth: 0, maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: E_MONO, fontSize: 10, color: E_MUTED, fontWeight: 600 }}>09:41:24</span>
        <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_FAINT }}>·</span>
        <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED, letterSpacing: '0.12em' }}>SUGGESTION</span>
      </div>
      <div style={{ fontSize: 14.5, color: E_TEXT, lineHeight: 1.55, marginBottom: 14 }}>
        Most people start with one of these archetypes. You can describe your own style instead — just say the word.
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <ArchetypeCard
          name="The Grinder"
          accent={E_TEAL}
          tag="DEFAULT"
          line="Tight, patient, wins slowly. Hardest to lose money with. Best for learning the system."
          stat1={{ label: 'WIN RATE', value: '57%' }}
          stat2={{ label: 'BB/100', value: '+5.2' }}
        />
        <ArchetypeCard
          name="The Aggressor"
          accent={E_PURPLE}
          tag="POPULAR"
          line="Pressure on every street. High variance, big wins, big losses. Fun to watch."
          stat1={{ label: 'WIN RATE', value: '54%' }}
          stat2={{ label: 'BB/100', value: '+8.7' }}
        />
        <ArchetypeCard
          name="The Showman"
          accent={E_GOLD}
          tag="ADVANCED"
          line="Bluffs, traps, hero-calls. Will lose money until you tune it. Pays off in tournaments."
          stat1={{ label: 'WIN RATE', value: '49%' }}
          stat2={{ label: 'BB/100', value: '+12.1' }}
        />
        <ArchetypeCard
          name="The Quant"
          accent={E_PINK}
          tag="GTO"
          line="Solver-tight. Plays balanced ranges, exploits no one, but also loses to no one."
          stat1={{ label: 'WIN RATE', value: '52%' }}
          stat2={{ label: 'BB/100', value: '+3.8' }}
        />
      </div>
    </div>
  </div>
);

// ── Suggested action chips above composer ──
const SuggestedChips = ({ onPick }) => {
  const chips = [
    { icon: '◇', label: 'Draft me a tight, patient grinder' },
    { icon: '⚡', label: 'Build an aggressive 3-bet machine' },
    { icon: '✦', label: 'Make a bluff-heavy showman' },
    { icon: '∑', label: 'I want a GTO solver-tight agent' },
    { icon: '✎', label: 'Describe your own style' },
    { icon: '↻', label: 'Clone a community top agent' },
  ];
  return (
    <div style={{ padding: '0 24px 12px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
      }}>
        <span style={{ fontFamily: E_MONO, fontSize: 9, fontWeight: 600, color: E_MUTED, letterSpacing: '0.16em' }}>SUGGESTED</span>
        <div style={{ flex: 1, height: 1, background: E_BORDER }}/>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {chips.map((c, i) => (
          <button key={i} onClick={() => onPick && onPick(c.label)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 34, padding: '0 14px', borderRadius: 6,
            background: i === 0 ? E_TEAL_DIM : E_SURFACE,
            border: i === 0 ? `1px solid ${E_TEAL}66` : `1px solid ${E_BORDER_STRONG}`,
            color: i === 0 ? E_TEAL : E_TEXT,
            fontFamily: 'Inter', fontSize: 12.5, fontWeight: 500,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontFamily: E_MONO, fontSize: 13, color: i === 0 ? E_TEAL : E_DIM }}>{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Composer ──
const EComposer = ({ value, onChange }) => (
  <div style={{ padding: '0 24px 18px', background: E_BG }}>
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 10,
      background: E_SURFACE, border: `1.5px solid ${E_TEAL}44`,
      borderRadius: 12, padding: '12px 14px',
      boxShadow: `0 0 24px rgba(0,212,170,0.06)`,
    }}>
      <Icon name="sparkle" size={18} color={E_TEAL}/>
      <textarea
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder="Describe the agent you want, or pick a suggestion above..."
        rows={2}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: E_TEXT, fontSize: 14, fontFamily: 'Inter',
          resize: 'none', lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
        <span style={{ fontFamily: E_MONO, fontSize: 9, color: E_MUTED, padding: '3px 6px', border: `1px solid ${E_BORDER}`, borderRadius: 3 }}>⌘↵</span>
        <button style={{
          height: 36, padding: '0 16px', borderRadius: 6,
          background: E_TEAL, border: 'none',
          color: '#0a0a0a', fontFamily: E_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          cursor: 'pointer', boxShadow: `0 0 12px ${E_TEAL}66`,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          DRAFT AGENT
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6"/>
          </svg>
        </button>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontFamily: E_MONO, fontSize: 10, color: E_MUTED }}>
      <span>You can chat with your agent here once it's drafted.</span>
      <div style={{ flex: 1 }}/>
      <span>Synced with Telegram</span>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: E_TEAL, boxShadow: `0 0 4px ${E_TEAL}`, animation: 'pulse 2s infinite' }}/>
    </div>
  </div>
);

// ── Screen ──
const DesktopEmptyScreen = () => {
  const [draft, setDraft] = React.useState('');
  return (
    <div data-screen-label="12 Desktop Empty State" style={{
      width: 1440, height: 900, background: E_BG, color: E_TEXT,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      <ETopBar/>
      <LiveTicker/>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <ELeftRail/>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <EHeader/>
          <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: E_BORDER }}/>
              <span style={{ fontFamily: E_MONO, fontSize: 10, color: E_MUTED, letterSpacing: '0.18em' }}>WED · MAY 6, 2026 · YOUR FIRST DAY</span>
              <div style={{ flex: 1, height: 1, background: E_BORDER }}/>
            </div>
            <RecruiterWelcome/>
            <StarterArchetypes/>
          </div>
          <SuggestedChips onPick={setDraft}/>
          <EComposer value={draft} onChange={setDraft}/>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { DesktopEmptyScreen });
