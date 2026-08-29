// Desktop Filled — 4 agents on roster, ongoing operation
// Same skeleton as Empty: left rail + chat-first canvas, no right intel panel.
// Conversation = system "Daily Standup" thread, scannable not editorial.

const F_BG = '#070708';
const F_PANEL = '#0d0d0f';
const F_SURFACE = '#131316';
const F_SURFACE_2 = '#1a1a1f';
const F_BORDER = 'rgba(255,255,255,0.06)';
const F_BORDER_STRONG = 'rgba(255,255,255,0.10)';
const F_TEXT = '#EDEDED';
const F_DIM = '#A1A1A1';
const F_MUTED = '#6B6B6B';
const F_FAINT = '#3a3a3f';
const F_TEAL = '#00D4AA';
const F_TEAL_DIM = 'rgba(0,212,170,0.10)';
const F_GOLD = '#CDB380';
const F_PURPLE = '#9B7BFF';
const F_PINK = '#FF7A8E';
const F_RED = '#FF4D4F';
const F_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

// ── Hooded avatar (filled) ──
const FHood = ({ size = 32, accent = F_TEAL, dim = false }) => (
  <div style={{
    width: size, height: size, borderRadius: 6,
    background: '#0a0f17',
    border: `1px solid ${dim ? 'rgba(255,255,255,0.08)' : `${accent}66`}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  }}>
    <svg width={size * 0.85} height={size * 0.85} viewBox="0 0 80 80">
      <path d="M40 14 C28 14 20 26 20 42 L20 80 L60 80 L60 42 C60 26 52 14 40 14 Z"
        fill="#0a0f17" stroke={dim ? 'transparent' : `${accent}55`} strokeWidth="0.6"/>
      <ellipse cx="40" cy="42" rx="13" ry="16" fill="#050810"/>
      <ellipse cx="34" cy="40" rx="2.4" ry="1.6" fill={dim ? '#3a3a3f' : accent}/>
      <ellipse cx="46" cy="40" rx="2.4" ry="1.6" fill={dim ? '#3a3a3f' : accent}/>
    </svg>
  </div>
);

// ── Sparkline ──
const Spark = ({ data, color = F_TEAL, w = 90, h = 22 }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return <svg width={w} height={h} style={{display:'block'}}><polyline fill="none" stroke={color} strokeWidth="1.3" points={pts}/></svg>;
};

// ── Top status bar ──
const FTopBar = () => {
  const [, setT] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setT(t => t+1), 1000); return () => clearInterval(id); }, []);
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  return (
    <div style={{
      height: 38, display: 'flex', alignItems: 'center',
      borderBottom: `1px solid ${F_BORDER}`, background: F_PANEL,
      padding: '0 20px', gap: 22, fontFamily: F_MONO, fontSize: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <svg width="18" height="20" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={F_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={F_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: '0.18em', color: F_TEXT, fontSize: 11 }}>AGENTIC POKER</span>
      </div>
      <span style={{ color: F_FAINT }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: F_TEAL, boxShadow: `0 0 6px ${F_TEAL}`, animation: 'pulse 2s infinite' }}/>
        <span style={{ color: F_DIM }}>2 LIVE</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: F_DIM }}>P&L 24H</span>
        <span style={{ color: F_TEAL, fontWeight: 600 }}>+$340.00</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: F_DIM }}>BANKROLL</span>
        <span style={{ color: F_TEXT, fontWeight: 600 }}>$2,340.50</span>
      </div>
      <div style={{ flex: 1 }}/>
      <span style={{ color: F_MUTED, fontSize: 10 }}>NYC</span>
      <span style={{ color: F_TEXT, fontVariantNumeric: 'tabular-nums' }}>{time}</span>
      <span style={{ color: F_FAINT }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 10px', background: F_SURFACE, borderRadius: 4, border: `1px solid ${F_BORDER}` }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
          color: '#0a0a0a', fontWeight: 700, fontSize: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>JM</div>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: F_TEXT, fontWeight: 500 }}>jmorr</span>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_GOLD, letterSpacing: '0.08em' }}>TIER 3</span>
      </div>
    </div>
  );
};

// ── Live ticker ──
const FTicker = () => {
  const items = [
    { who: 'phil_ai', what: 'Doyle v3 won $2,140 pot at HU NLH $25/$50', accent: F_TEAL },
    { who: 'sarah.k', what: 'just deployed Lockdown v4 to NLH 6-Max', accent: F_PURPLE },
    { who: 'm_chen', what: 'Bluff Theory hit 1,000 hands · 64% win rate', accent: F_GOLD },
    { who: 'doyle_v3', what: 'eliminated Phil_AI from the daily freeroll', accent: F_TEAL },
    { who: 'community', what: '14 new agents drafted in the last hour', accent: F_PINK },
    { who: 'nash_eq', what: 'climbed to #3 on the 24h leaderboard', accent: F_TEAL },
  ];
  const all = [...items, ...items];
  return (
    <div style={{
      height: 30, borderBottom: `1px solid ${F_BORDER}`, background: '#0a0a0c',
      display: 'flex', alignItems: 'center', overflow: 'hidden',
    }}>
      <div style={{
        flexShrink: 0, padding: '0 14px', height: '100%',
        display: 'flex', alignItems: 'center', gap: 6,
        background: F_TEAL_DIM, borderRight: `1px solid ${F_BORDER}`,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: F_TEAL, boxShadow: `0 0 5px ${F_TEAL}`, animation: 'pulse 2s infinite' }}/>
        <span style={{ fontFamily: F_MONO, fontSize: 9, fontWeight: 700, color: F_TEAL, letterSpacing: '0.16em' }}>LIVE TAPE</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', animation: 'tickerScroll 60s linear infinite' }}>
        {all.map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 22px', fontFamily: F_MONO, fontSize: 11 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: it.accent }}/>
            <span style={{ color: it.accent, fontWeight: 600 }}>{it.who}</span>
            <span style={{ color: F_DIM, fontFamily: 'Inter', fontWeight: 400 }}>{it.what}</span>
            <span style={{ color: F_FAINT, marginLeft: 6 }}>·</span>
          </div>
        ))}
      </div>
      </div>
      <style>{`@keyframes tickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
};

// ── Left rail nav item ──
const FNav = ({ icon, label, badge, active }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
    background: active ? F_TEAL_DIM : 'transparent',
    color: active ? F_TEAL : F_DIM,
    fontSize: 12, fontWeight: 500, position: 'relative',
  }}>
    {active && <div style={{ position: 'absolute', left: -10, top: 6, bottom: 6, width: 2, background: F_TEAL, borderRadius: 1 }}/>}
    <Icon name={icon} size={15} color={active ? F_TEAL : F_DIM} strokeWidth={1.7}/>
    <span style={{ flex: 1 }}>{label}</span>
    {badge && (
      <span style={{
        height: 16, padding: '0 5px', borderRadius: 4,
        fontFamily: F_MONO, fontSize: 9, fontWeight: 700,
        color: active ? F_TEAL : F_MUTED,
        border: active ? `1px solid ${F_TEAL}55` : `1px solid ${F_BORDER}`,
        display: 'inline-flex', alignItems: 'center', letterSpacing: '0.04em',
      }}>{badge}</span>
    )}
  </div>
);

// ── Conversation thread row ──
const FThread = ({ accent, name, preview, time, status, pnl, unread, active }) => (
  <div style={{
    display: 'flex', gap: 10, padding: '10px 12px',
    cursor: 'pointer',
    background: active ? 'rgba(0,212,170,0.06)' : 'transparent',
    borderLeft: active ? `2px solid ${F_TEAL}` : '2px solid transparent',
    paddingLeft: active ? 10 : 12,
  }}>
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <FHood size={36} accent={accent} dim={status === 'idle'}/>
      {status === 'live' && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 10, height: 10, borderRadius: '50%',
          background: F_TEAL, border: `2px solid ${F_PANEL}`,
          boxShadow: `0 0 6px ${F_TEAL}`, animation: 'pulse 2s infinite',
        }}/>
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: F_TEXT, flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED, flexShrink: 0 }}>{time}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11.5, color: F_DIM, flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview}</span>
        {pnl && (
          <span style={{ fontFamily: F_MONO, fontSize: 10, fontWeight: 600,
            color: pnl.startsWith('-') ? F_RED : F_TEAL,
            fontVariantNumeric: 'tabular-nums' }}>{pnl}</span>
        )}
        {unread && (
          <span style={{
            minWidth: 16, height: 16, padding: '0 5px', borderRadius: 8,
            background: F_TEAL, color: '#0a0a0a',
            fontFamily: F_MONO, fontSize: 9, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{unread}</span>
        )}
      </div>
    </div>
  </div>
);

const FLeftRail = () => (
  <div style={{
    width: 260, flexShrink: 0,
    background: F_PANEL, borderRight: `1px solid ${F_BORDER}`,
    display: 'flex', flexDirection: 'column',
  }}>
    <div style={{ padding: '14px 12px 6px' }}>
      <span style={{ fontFamily: F_MONO, fontSize: 9, fontWeight: 600, color: F_MUTED, letterSpacing: '0.16em', padding: '0 4px' }}>NAVIGATE</span>
      <div style={{ height: 8 }}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FNav icon="home" label="Home" active/>
        <FNav icon="agent" label="Agents" badge="4"/>
        <FNav icon="spade" label="Tables" badge="12"/>
        <FNav icon="history" label="Replays"/>
        <FNav icon="trophy" label="Leaderboard"/>
        <FNav icon="profile" label="Account"/>
      </div>
    </div>

    <div style={{ height: 14 }}/>

    <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: F_MONO, fontSize: 9, fontWeight: 600, color: F_MUTED, letterSpacing: '0.16em' }}>CONVERSATIONS</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: F_TEAL, boxShadow: `0 0 4px ${F_TEAL}`, animation: 'pulse 2s infinite' }}/>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_TEAL, fontWeight: 600 }}>2 LIVE</span>
      </div>
    </div>

    <div style={{ padding: '0 12px 10px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 30,
        padding: '0 10px', background: F_SURFACE, borderRadius: 6,
        border: `1px solid ${F_BORDER}`,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={F_MUTED} strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
        </svg>
        <input placeholder="Search agents, hands..." style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: F_TEXT, fontSize: 12, fontFamily: 'Inter',
        }}/>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, padding: '2px 5px', border: `1px solid ${F_BORDER}`, borderRadius: 3 }}>⌘K</span>
      </div>
    </div>

    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
      <div style={{ padding: '0 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em' }}>PINNED</span>
        <div style={{ flex: 1, height: 1, background: F_BORDER }}/>
      </div>
      <FThread accent={F_TEAL} name="Agentic Poker" preview="Daily standup ready · 4 hands flagged"
        time="now" status="live" unread="3" active/>

      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em' }}>YOUR AGENTS</span>
        <div style={{ flex: 1, height: 1, background: F_BORDER }}/>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED }}>4/4</span>
      </div>
      <FThread accent={F_TEAL} name="Balanced v2.1" preview="Just won a 4-bet pot vs Phil_AI"
        time="2m" status="live" pnl="+$340" unread="2"/>
      <FThread accent={F_PURPLE} name="Aggressive v1.3" preview="You: tighten up vs 3-bets in late position"
        time="14m" status="live" pnl="+$120"/>
      <FThread accent={F_GOLD} name="Bluff Master" preview="Session ended · 12 hands · ROI 18.4%"
        time="1h" status="idle" pnl="+$210"/>
      <FThread accent={F_PINK} name="Value Bot" preview="Sitting out · waiting for instructions"
        time="3h" status="idle" pnl="-$45"/>

      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em' }}>TABLES</span>
        <div style={{ flex: 1, height: 1, background: F_BORDER }}/>
      </div>
      <FThread accent={F_TEAL} name="NLH 6-Max · $5/$10" preview="Balanced v2.1 sitting · stack $1,847"
        time="live" status="live"/>
      <FThread accent={F_PURPLE} name="HU NLH · $10/$20" preview="Aggressive v1.3 vs Phil_AI · 47 hands"
        time="live" status="live"/>
    </div>

    <div style={{
      borderTop: `1px solid ${F_BORDER}`, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#0a0a0a', fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>JM</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: F_TEXT }}>jmorr</div>
        <div style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED, letterSpacing: '0.04em' }}>TIER 3 · $2,340.50</div>
      </div>
      <Icon name="settings" size={14} color={F_MUTED}/>
    </div>
  </div>
);

// ── Conversation header ──
const FHeader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 24px', borderBottom: `1px solid ${F_BORDER}`,
    background: F_PANEL,
  }}>
    <div style={{
      width: 38, height: 38, borderRadius: 8,
      background: `linear-gradient(135deg, ${F_TEAL}33, ${F_TEAL}11)`,
      border: `1px solid ${F_TEAL}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="20" height="22" viewBox="0 0 22 26">
        <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
          fill="none" stroke={F_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={F_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap' }}>
        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 20, fontWeight: 600, color: F_TEXT, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
          Agentic Poker
        </span>
        <span style={{
          fontFamily: F_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
          color: F_TEAL, padding: '3px 7px',
          background: F_TEAL_DIM, border: `1px solid ${F_TEAL}44`, borderRadius: 3,
        }}>SYSTEM</span>
        <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED, letterSpacing: '0.08em' }}>· DAILY STANDUP</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: F_TEAL, boxShadow: `0 0 5px ${F_TEAL}` }}/>
        <span style={{ fontSize: 11.5, color: F_DIM }}>Connected · all 4 agents reporting</span>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 6,
        background: 'transparent', border: `1px solid ${F_BORDER_STRONG}`,
        color: F_DIM, fontFamily: F_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="history" size={12} color={F_DIM}/>
        HISTORY
      </button>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 6,
        background: F_TEAL, border: 'none',
        color: '#0a0a0a', fontFamily: F_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        boxShadow: `0 0 12px ${F_TEAL}55`,
      }}>
        <Icon name="plus" size={12} color="#0a0a0a" strokeWidth={2.4}/>
        DRAFT AGENT
      </button>
    </div>
  </div>
);

// ── Message wrappers ──
const SysMsg = ({ time, source, children }) => (
  <div style={{ display: 'flex', gap: 14, padding: '0 24px', marginBottom: 24 }}>
    <div style={{ flexShrink: 0, paddingTop: 4 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: F_TEAL_DIM, border: `1px solid ${F_TEAL}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="16" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={F_TEAL} strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
    <div style={{ flex: 1, minWidth: 0, maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED, fontWeight: 600 }}>{time}</span>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_FAINT }}>·</span>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em' }}>{source}</span>
      </div>
      {children}
    </div>
  </div>
);

const AgentMsg = ({ time, name, accent, children }) => (
  <div style={{ display: 'flex', gap: 14, padding: '0 24px', marginBottom: 24 }}>
    <div style={{ flexShrink: 0, paddingTop: 4 }}>
      <FHood size={30} accent={accent}/>
    </div>
    <div style={{ flex: 1, minWidth: 0, maxWidth: 880 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: F_TEXT }}>{name}</span>
        <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED }}>{time}</span>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_FAINT }}>·</span>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em' }}>LIVE</span>
      </div>
      {children}
    </div>
  </div>
);

// ── Standup: KPI strip ──
const KPI = ({ label, value, color = F_TEXT, sub, spark, sparkColor }) => (
  <div style={{ flex: 1, padding: '12px 14px', background: F_SURFACE, border: `1px solid ${F_BORDER}`, borderRadius: 6 }}>
    <div style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.14em', marginBottom: 6 }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div style={{ fontFamily: F_MONO, fontSize: 20, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</div>
      {spark && <Spark data={spark} color={sparkColor || F_TEAL} w={56} h={18}/>}
    </div>
    {sub && <div style={{ fontFamily: F_MONO, fontSize: 10, color: F_DIM, marginTop: 4, letterSpacing: '0.04em' }}>{sub}</div>}
  </div>
);

// ── Agent mini card ──
const AgentMini = ({ name, accent, status, hands, win, pnl, spark, sparkColor }) => (
  <div style={{
    flex: 1, padding: '14px',
    background: F_SURFACE, border: `1px solid ${F_BORDER}`, borderRadius: 8,
    cursor: 'pointer',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <FHood size={32} accent={accent}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: F_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          {status === 'live' ? (
            <>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: F_TEAL, boxShadow: `0 0 4px ${F_TEAL}`, animation: 'pulse 2s infinite' }}/>
              <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_TEAL, fontWeight: 700, letterSpacing: '0.1em' }}>LIVE</span>
            </>
          ) : (
            <>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: F_FAINT }}/>
              <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, fontWeight: 700, letterSpacing: '0.1em' }}>IDLE</span>
            </>
          )}
        </div>
      </div>
    </div>
    <div style={{ marginBottom: 10 }}>
      <Spark data={spark} color={sparkColor || F_TEAL} w={210} h={28}/>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', fontFamily: F_MONO }}>
      <div>
        <div style={{ fontSize: 9, color: F_MUTED, letterSpacing: '0.12em', marginBottom: 2 }}>P&L · 24H</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: pnl.startsWith('-') ? F_RED : F_TEAL, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{pnl}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: F_DIM }}>{hands} hands</div>
        <div style={{ fontSize: 10, color: F_DIM }}>{win} win</div>
      </div>
    </div>
  </div>
);

// ── Flagged hand row ──
const FlagRow = ({ agent, accent, action, tag, tagColor, stake, loss, cards, board }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 14px', background: F_SURFACE_2,
    border: `1px solid ${F_BORDER}`, borderRadius: 6, cursor: 'pointer',
  }}>
    <FHood size={24} accent={accent}/>
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {cards.map((c, i) => <MiniCard key={i} rank={c[0]} suit={c[1]}/>)}
    </div>
    <div style={{
      fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em', flexShrink: 0,
    }}>vs</div>
    <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
      {board.map((c, i) => <MiniCard key={i} rank={c[0]} suit={c[1]}/>)}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 12, color: F_TEXT, fontWeight: 500 }}>{action}</span>
        <span style={{
          fontFamily: F_MONO, fontSize: 8, fontWeight: 700, letterSpacing: '0.12em',
          color: tagColor, padding: '2px 5px',
          background: `${tagColor}1a`, border: `1px solid ${tagColor}44`, borderRadius: 3,
        }}>{tag}</span>
      </div>
      <div style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED }}>{agent} · {stake}</div>
    </div>
    <span style={{ fontFamily: F_MONO, fontSize: 12, fontWeight: 700, color: F_RED, fontVariantNumeric: 'tabular-nums' }}>{loss}</span>
    <Icon name="chevron-right" size={14} color={F_MUTED}/>
  </div>
);

// ── Live hand inline card (when an agent posts mid-hand) ──
const LiveHandInline = () => (
  <div style={{
    background: F_SURFACE, border: `1px solid ${F_TEAL}55`,
    borderRadius: 8, overflow: 'hidden',
    boxShadow: `0 0 16px rgba(0,212,170,0.08)`,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 14px', borderBottom: `1px solid ${F_BORDER}`,
      background: 'rgba(0,212,170,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: F_TEAL, boxShadow: `0 0 6px ${F_TEAL}`, animation: 'pulse 2s infinite' }}/>
        <span style={{ fontFamily: F_MONO, fontSize: 9, fontWeight: 700, color: F_TEAL, letterSpacing: '0.14em' }}>LIVE · TABLE #48291 · HAND #847</span>
      </div>
      <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED }}>turn · pot $480</span>
    </div>
    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 18 }}>
      <div>
        <div style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em', marginBottom: 6 }}>HERO</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PlayingCard rank="A" suit="s" w={32} h={45}/>
          <PlayingCard rank="K" suit="h" w={32} h={45}/>
        </div>
      </div>
      <div style={{ width: 1, height: 56, background: F_BORDER }}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em', marginBottom: 6 }}>BOARD</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PlayingCard rank="K" suit="d" w={32} h={45}/>
          <PlayingCard rank="9" suit="s" w={32} h={45}/>
          <PlayingCard rank="2" suit="c" w={32} h={45}/>
          <PlayingCard rank="A" suit="h" w={32} h={45}/>
          <CardBack w={32} h={45} branded/>
        </div>
      </div>
      <div style={{ width: 1, height: 56, background: F_BORDER }}/>
      <div style={{ minWidth: 100 }}>
        <div style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em', marginBottom: 6 }}>EQUITY</div>
        <div style={{ fontFamily: F_MONO, fontSize: 22, fontWeight: 700, color: F_TEAL, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>87.4%</div>
        <div style={{ height: 3, background: F_BORDER, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '87.4%', background: F_TEAL }}/>
        </div>
      </div>
    </div>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderTop: `1px solid ${F_BORDER}`, background: '#0a0a0c',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: F_MONO, fontSize: 11 }}>
        <span style={{ color: F_DIM }}>Action: <span style={{ color: F_TEAL, fontWeight: 700 }}>BET $240</span></span>
        <span style={{ color: F_FAINT }}>·</span>
        <span style={{ color: F_DIM }}>Conf: <span style={{ color: F_TEXT }}>92%</span></span>
      </div>
      <button style={{
        height: 26, padding: '0 12px', borderRadius: 5,
        background: 'transparent', border: `1px solid ${F_TEAL}`,
        color: F_TEAL, fontFamily: F_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        cursor: 'pointer',
      }}>WATCH LIVE →</button>
    </div>
  </div>
);

// ── Main standup body ──
const Standup = () => (
  <SysMsg time="09:41:22" source="DAILY STANDUP">
    {/* Headline */}
    <div style={{
      fontFamily: '"Playfair Display", Georgia, serif',
      fontSize: 28, fontWeight: 600, color: F_TEXT, letterSpacing: '-0.02em', lineHeight: 1.2,
      marginBottom: 8,
    }}>
      Good morning, jmorr.
    </div>
    <div style={{ fontSize: 14.5, color: F_DIM, lineHeight: 1.55, marginBottom: 22, maxWidth: 720 }}>
      Your <span style={{ color: F_TEAL, fontWeight: 600 }}>4 agents</span> played <span style={{ color: F_TEXT, fontWeight: 600 }}>184 hands</span> overnight.
      Net <span style={{ color: F_TEAL, fontWeight: 600 }}>+$340</span> · 2 still live · 4 hands flagged for your review.
    </div>

    {/* KPI strip */}
    <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
      <KPI label="NET · 24H" value="+$340" color={F_TEAL} sub="▲ 14.5%" spark={[0,8,12,20,28,34,40,38,46,52]}/>
      <KPI label="HANDS" value="184" sub="12 sessions" spark={[12,18,14,22,20,28,32,30,36,42]}/>
      <KPI label="WIN RATE" value="58.7%" color={F_TEAL} sub="BB/100: 8.2" spark={[52,55,53,58,57,60,58,61,60,62]}/>
      <KPI label="BIGGEST POT" value="$847" color={F_GOLD} sub="Balanced v2.1"/>
    </div>

    {/* Agents grid */}
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: F_MONO, fontSize: 10, fontWeight: 600, color: F_MUTED, letterSpacing: '0.16em' }}>YOUR ROSTER · 24H</span>
        <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_TEAL, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.04em' }}>VIEW ALL ↗</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <AgentMini name="Balanced v2.1" accent={F_TEAL} status="live" hands={64} win="61.8%" pnl="+$340"
          spark={[10,12,11,14,13,16,15,18,17,19,18,22]}/>
        <AgentMini name="Aggressive v1.3" accent={F_PURPLE} status="live" hands={48} win="54.2%" pnl="+$120"
          spark={[10,9,11,12,10,13,11,14,13,15,14,15]} sparkColor={F_PURPLE}/>
        <AgentMini name="Bluff Master" accent={F_GOLD} status="idle" hands={42} win="52.4%" pnl="+$210"
          spark={[10,11,9,12,14,11,13,15,14,17,16,17]} sparkColor={F_GOLD}/>
        <AgentMini name="Value Bot" accent={F_PINK} status="idle" hands={30} win="46.7%" pnl="-$45"
          spark={[10,11,10,9,11,9,8,10,9,8,9,8]} sparkColor={F_RED}/>
      </div>
    </div>

    {/* Flagged hands */}
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: F_MONO, fontSize: 10, fontWeight: 600, color: F_MUTED, letterSpacing: '0.16em' }}>FLAGGED HANDS · NEEDS REVIEW</span>
        <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_GOLD, fontWeight: 600, letterSpacing: '0.04em' }}>4 HANDS · −$540 EV</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <FlagRow agent="Balanced v2.1" accent={F_TEAL}
          action="Folded TT to a 3-bet from button" tag="OVER FOLD" tagColor={F_GOLD}
          stake="$5/$10" loss="−$80 EV"
          cards={[['T','s'],['T','d']]} board={[['9','c'],['7','h'],['2','d']]}/>
        <FlagRow agent="Aggressive v1.3" accent={F_PURPLE}
          action="Bluff-jammed river on monotone" tag="BLUFF JAM" tagColor={F_RED}
          stake="$10/$20" loss="−$340"
          cards={[['7','c'],['6','c']]} board={[['K','c'],['9','c'],['4','c'],['2','c'],['5','h']]}/>
        <FlagRow agent="Bluff Master" accent={F_GOLD}
          action="Called 4-bet pre with AJo OOP" tag="LOOSE CALL" tagColor={F_RED}
          stake="$5/$10" loss="−$120"
          cards={[['A','h'],['J','s']]} board={[['Q','d'],['8','c'],['3','s']]}/>
      </div>
    </div>

    {/* Suggested actions */}
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {[
        { label: 'Review flagged hands', primary: true },
        { label: 'Tune Aggressive v1.3' },
        { label: 'Deploy to NLH 6-Max' },
        { label: 'Pause Value Bot' },
        { label: 'Draft new agent' },
      ].map((a, i) => (
        <button key={i} style={{
          height: 30, padding: '0 12px', borderRadius: 5,
          background: a.primary ? F_TEAL : 'transparent',
          border: a.primary ? 'none' : `1px solid ${F_BORDER_STRONG}`,
          color: a.primary ? '#0a0a0a' : F_DIM,
          fontFamily: 'Inter', fontSize: 11.5, fontWeight: 600,
          cursor: 'pointer',
        }}>{a.label}</button>
      ))}
    </div>
  </SysMsg>
);

// ── User message ──
const UserMsg = ({ time, children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 24px', marginBottom: 24 }}>
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 6 }}>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, letterSpacing: '0.12em' }}>YOU</span>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_FAINT }}>·</span>
        <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED }}>{time}</span>
      </div>
      <div style={{
        background: F_TEAL_DIM, border: `1px solid ${F_TEAL}33`,
        borderRadius: 10, padding: '10px 14px',
        fontSize: 13.5, color: F_TEXT, lineHeight: 1.5,
      }}>{children}</div>
    </div>
  </div>
);

// ── Composer ──
const FComposer = () => (
  <div style={{ padding: '12px 24px 16px', borderTop: `1px solid ${F_BORDER}`, background: F_PANEL }}>
    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
      {[
        { cmd: '/deploy', desc: 'send agent to a table' },
        { cmd: '/build', desc: 'create new agent' },
        { cmd: '/replay', desc: 'pull a hand' },
        { cmd: '/analyze', desc: 'review last session' },
        { cmd: '/sit-out', desc: 'pause an agent' },
      ].map((c, i) => (
        <button key={i} style={{
          height: 24, padding: '0 8px', borderRadius: 4,
          background: F_SURFACE, border: `1px solid ${F_BORDER}`,
          fontFamily: F_MONO, fontSize: 10, fontWeight: 600,
          color: F_DIM, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: F_TEAL }}>{c.cmd}</span>
          <span style={{ color: F_MUTED, fontFamily: 'Inter', fontSize: 10, fontWeight: 500 }}>{c.desc}</span>
        </button>
      ))}
    </div>
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 10,
      background: F_SURFACE, border: `1px solid ${F_BORDER_STRONG}`,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <Icon name="sparkle" size={16} color={F_TEAL}/>
      <textarea
        defaultValue="Tighten Aggressive v1.3's 3-bet range from late position. Avoid bluff jams on monotone boards."
        rows={2}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: F_TEXT, fontSize: 13.5, fontFamily: 'Inter',
          resize: 'none', lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
        <span style={{ fontFamily: F_MONO, fontSize: 9, color: F_MUTED, padding: '2px 5px', border: `1px solid ${F_BORDER}`, borderRadius: 3 }}>⌘↵</span>
        <button style={{
          width: 32, height: 32, borderRadius: 6,
          background: F_TEAL, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: `0 0 10px ${F_TEAL}55`,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontFamily: F_MONO, fontSize: 10, color: F_MUTED }}>
      <span>Replying to <span style={{ color: F_TEAL }}>Aggressive v1.3</span></span>
      <span style={{ color: F_FAINT }}>·</span>
      <span>Changes apply on next deploy</span>
      <div style={{ flex: 1 }}/>
      <span>Synced with Telegram</span>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: F_TEAL, boxShadow: `0 0 4px ${F_TEAL}`, animation: 'pulse 2s infinite' }}/>
    </div>
  </div>
);

// ── Screen ──
const DesktopFilledScreen = () => (
  <div data-screen-label="13 Desktop Home (Filled)" style={{
    width: 1440, height: 900, background: F_BG, color: F_TEXT,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    overflow: 'hidden',
  }}>
    <FTopBar/>
    <FTicker/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <FLeftRail/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <FHeader/>
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', marginBottom: 18 }}>
            <div style={{ flex: 1, height: 1, background: F_BORDER }}/>
            <span style={{ fontFamily: F_MONO, fontSize: 10, color: F_MUTED, letterSpacing: '0.18em' }}>WED · MAY 6, 2026</span>
            <div style={{ flex: 1, height: 1, background: F_BORDER }}/>
          </div>
          <Standup/>
          <UserMsg time="09:42:08">Show me Aggressive v1.3's bluff-jam hand</UserMsg>
          <AgentMsg time="09:43:01" name="Balanced v2.1" accent={F_TEAL}>
            <div style={{
              background: F_SURFACE, border: `1px solid ${F_TEAL}33`,
              borderRadius: 10, padding: '12px 14px', marginBottom: 10,
              fontSize: 13.5, color: F_TEXT, lineHeight: 1.5,
            }}>
              Heads up — I'm in a big spot at <span style={{ fontWeight: 600 }}>#48291</span>.
              AKo on K♦9♠2♣A♥. Villain checked the turn. I'm putting them on KQ or pocket pair. Going for value.
            </div>
            <LiveHandInline/>
          </AgentMsg>
        </div>
        <FComposer/>
      </div>
    </div>
  </div>
);

Object.assign(window, { DesktopFilledScreen });
