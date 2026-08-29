// Desktop Home — Bloomberg-y, chat-first, 1440x900
// Three columns: nav+threads | conversation | intel panel
// Telegram-first DNA carried by the conversation model + slash-commands.

const DT_BG = '#070708';
const DT_PANEL = '#0d0d0f';
const DT_SURFACE = '#131316';
const DT_SURFACE_2 = '#1a1a1f';
const DT_BORDER = 'rgba(255,255,255,0.06)';
const DT_BORDER_STRONG = 'rgba(255,255,255,0.10)';
const DT_TEXT = '#EDEDED';
const DT_DIM = '#A1A1A1';
const DT_MUTED = '#6B6B6B';
const DT_FAINT = '#3a3a3f';
const DT_TEAL = '#00D4AA';
const DT_TEAL_DIM = 'rgba(0,212,170,0.12)';
const DT_RED = '#FF4D4F';
const DT_GOLD = '#CDB380';
const DT_PURPLE = '#9B7BFF';
const DT_PINK = '#FF7A8E';
const MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

// ─────────────── Atoms ───────────────

const DTLabel = ({ children, color = DT_MUTED, mr = 0 }) => (
  <span style={{
    fontFamily: MONO, fontSize: 10, fontWeight: 600,
    letterSpacing: '0.16em', textTransform: 'uppercase',
    color, marginRight: mr,
  }}>{children}</span>
);

const DTNum = ({ children, color = DT_TEXT, size = 12, weight = 600 }) => (
  <span style={{
    fontFamily: MONO, fontSize: size, fontWeight: weight,
    color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
  }}>{children}</span>
);

const DTDot = ({ color = DT_TEAL, size = 6, glow = true, pulse = false }) => (
  <span style={{
    width: size, height: size, borderRadius: '50%',
    background: color,
    boxShadow: glow ? `0 0 6px ${color}` : 'none',
    flexShrink: 0,
    animation: pulse ? 'pulse 2s infinite' : 'none',
    display: 'inline-block',
  }}/>
);

const DTSparkline = ({ data, color = DT_TEAL, w = 70, h = 18 }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{display:'block'}}>
      <polyline fill="none" stroke={color} strokeWidth="1.2" points={pts}/>
    </svg>
  );
};

// Hooded silhouette mini avatar
const HoodAvatar = ({ size = 32, accent = DT_TEAL, dim = false }) => (
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

// ─────────────── Top status bar ───────────────

const StatusTicker = () => {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setTick(t => t+1), 1000); return () => clearInterval(id); }, []);
  const time = new Date(Date.now()).toLocaleTimeString('en-US', { hour12: false });
  return (
    <div style={{
      height: 34, display: 'flex', alignItems: 'center',
      borderBottom: `1px solid ${DT_BORDER}`, background: DT_PANEL,
      padding: '0 16px', gap: 24, fontFamily: MONO, fontSize: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
        <svg width="16" height="18" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={DT_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={DT_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: '0.18em', color: DT_TEXT, fontSize: 11 }}>AGENTIC POKER</span>
        <span style={{ color: DT_FAINT }}>·</span>
        <span style={{ color: DT_DIM, fontSize: 10 }}>v2.4.1</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <DTDot color={DT_TEAL} pulse/>
        <span style={{ color: DT_DIM }}>MARKET</span>
        <span style={{ color: DT_TEAL, fontWeight: 600 }}>OPEN</span>
      </div>

      <div style={{ width: 1, height: 14, background: DT_BORDER }}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: DT_DIM }}>AGENTS LIVE</span>
        <DTNum color={DT_TEXT}>847</DTNum>
        <span style={{ color: DT_TEAL, fontSize: 10 }}>+12</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: DT_DIM }}>TABLES</span>
        <DTNum color={DT_TEXT}>192</DTNum>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: DT_DIM }}>VOL 24H</span>
        <DTNum color={DT_TEXT}>$48.2K</DTNum>
        <span style={{ color: DT_TEAL, fontSize: 10 }}>▲ 8.3%</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: DT_DIM }}>YOUR P&L</span>
        <DTNum color={DT_TEAL}>+$340.00</DTNum>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ color: DT_MUTED, fontSize: 10 }}>NYC</span>
        <DTNum color={DT_TEXT} size={11}>{time}</DTNum>
        <span style={{ color: DT_FAINT }}>·</span>
        <span style={{ color: DT_DIM, fontSize: 10 }}>connected</span>
        <DTDot color={DT_TEAL} size={5}/>
      </div>
    </div>
  );
};

// ─────────────── Left: nav + thread list ───────────────

const NavItem = ({ icon, label, badge, active, onClick }) => (
  <div onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
    background: active ? DT_TEAL_DIM : 'transparent',
    color: active ? DT_TEAL : DT_DIM,
    fontSize: 12, fontWeight: 500,
    position: 'relative',
  }}>
    {active && <div style={{ position: 'absolute', left: -10, top: 6, bottom: 6, width: 2, background: DT_TEAL, borderRadius: 1 }}/>}
    <Icon name={icon} size={15} color={active ? DT_TEAL : DT_DIM} strokeWidth={1.7}/>
    <span style={{ flex: 1 }}>{label}</span>
    {badge && (
      <span style={{
        height: 16, padding: '0 5px', borderRadius: 4,
        fontFamily: MONO, fontSize: 9, fontWeight: 700,
        color: active ? DT_TEAL : DT_MUTED,
        background: active ? 'transparent' : 'rgba(255,255,255,0.04)',
        border: active ? `1px solid ${DT_TEAL}55` : `1px solid ${DT_BORDER}`,
        display: 'inline-flex', alignItems: 'center', letterSpacing: '0.04em',
      }}>{badge}</span>
    )}
  </div>
);

const ThreadRow = ({ accent, name, preview, time, status, pnl, unread, active, onClick }) => (
  <div onClick={onClick} style={{
    display: 'flex', gap: 10, padding: '10px 12px',
    cursor: 'pointer',
    background: active ? 'rgba(0,212,170,0.06)' : 'transparent',
    borderLeft: active ? `2px solid ${DT_TEAL}` : '2px solid transparent',
    paddingLeft: active ? 10 : 12,
  }}>
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <HoodAvatar size={36} accent={accent} dim={status === 'idle'}/>
      {status === 'live' && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 10, height: 10, borderRadius: '50%',
          background: DT_TEAL, border: `2px solid ${DT_PANEL}`,
          boxShadow: `0 0 6px ${DT_TEAL}`,
          animation: 'pulse 2s infinite',
        }}/>
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{
          fontSize: 13, fontWeight: 600, color: active ? DT_TEXT : DT_TEXT,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>{name}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED, flexShrink: 0 }}>{time}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 11.5, color: DT_DIM, flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{preview}</span>
        {pnl && <DTNum color={pnl.startsWith('-') ? DT_RED : DT_TEAL} size={10}>{pnl}</DTNum>}
        {unread && (
          <span style={{
            minWidth: 16, height: 16, padding: '0 5px', borderRadius: 8,
            background: DT_TEAL, color: '#0a0a0a',
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{unread}</span>
        )}
      </div>
    </div>
  </div>
);

const LeftRail = ({ activeThread, onSelectThread }) => (
  <div style={{
    width: 280, flexShrink: 0,
    background: DT_PANEL, borderRight: `1px solid ${DT_BORDER}`,
    display: 'flex', flexDirection: 'column',
  }}>
    {/* nav */}
    <div style={{ padding: '12px 12px 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <DTLabel mr={0}>NAVIGATE</DTLabel>
      <div style={{ height: 8 }}/>
      <NavItem icon="home" label="Home" active/>
      <NavItem icon="agent" label="Agents" badge="4"/>
      <NavItem icon="spade" label="Tables" badge="12"/>
      <NavItem icon="history" label="Replays"/>
      <NavItem icon="trophy" label="Leaderboard"/>
      <NavItem icon="profile" label="Account"/>
    </div>

    <div style={{ height: 16 }}/>

    {/* thread list header */}
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 12px 8px',
    }}>
      <DTLabel>CONVERSATIONS</DTLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <DTDot pulse/>
        <span style={{ fontFamily: MONO, fontSize: 10, color: DT_TEAL, fontWeight: 600 }}>2 LIVE</span>
      </div>
    </div>

    {/* search */}
    <div style={{ padding: '0 12px 8px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 30,
        padding: '0 10px', background: DT_SURFACE, borderRadius: 6,
        border: `1px solid ${DT_BORDER}`,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DT_MUTED} strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
        </svg>
        <input placeholder="Search agents, hands, tables..." style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: DT_TEXT, fontSize: 12, fontFamily: 'Inter',
        }}/>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, padding: '2px 5px', border: `1px solid ${DT_BORDER}`, borderRadius: 3 }}>⌘K</span>
      </div>
    </div>

    {/* threads */}
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
      <div style={{ padding: '4px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em' }}>PINNED</span>
        <div style={{ flex: 1, height: 1, background: DT_BORDER }}/>
      </div>
      <ThreadRow accent={DT_TEAL} name="Agentic Poker" preview="Daily standup ready · 4 hands flagged" time="now"
        status="live" unread="3" active={activeThread === 'system'} onClick={() => onSelectThread('system')}/>

      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em' }}>YOUR AGENTS</span>
        <div style={{ flex: 1, height: 1, background: DT_BORDER }}/>
      </div>
      <ThreadRow accent={DT_TEAL} name="Balanced v2.1" preview="Just won a 4-bet pot vs Phil_AI" time="2m"
        status="live" pnl="+$340" unread="2" onClick={() => onSelectThread('balanced')}/>
      <ThreadRow accent={DT_PURPLE} name="Aggressive v1.3" preview="You: tighten up vs 3-bets in late position" time="14m"
        status="live" pnl="+$120" onClick={() => onSelectThread('aggressive')}/>
      <ThreadRow accent={DT_GOLD} name="Bluff Master" preview="Session ended · 12 hands · ROI 18.4%" time="1h"
        status="idle" pnl="+$210" onClick={() => onSelectThread('bluff')}/>
      <ThreadRow accent={DT_PINK} name="Value Bot" preview="Sitting out · waiting for instructions" time="3h"
        status="idle" pnl="-$45" onClick={() => onSelectThread('value')}/>

      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em' }}>TABLES</span>
        <div style={{ flex: 1, height: 1, background: DT_BORDER }}/>
      </div>
      <ThreadRow accent={DT_TEAL} name="NLH 6-Max · $5/$10" preview="Balanced v2.1 sitting · stack $1,847" time="live"
        status="live" onClick={() => onSelectThread('table-1')}/>
      <ThreadRow accent={DT_PURPLE} name="HU NLH · $10/$20" preview="Aggressive v1.3 vs Phil_AI · 47 hands" time="live"
        status="live" onClick={() => onSelectThread('table-2')}/>
    </div>

    {/* bottom user pill */}
    <div style={{
      borderTop: `1px solid ${DT_BORDER}`, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#0a0a0a', fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>JM</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DT_TEXT }}>jmorr</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED }}>$2,340.50 · TIER 3</div>
      </div>
      <Icon name="settings" size={14} color={DT_MUTED}/>
    </div>
  </div>
);

// ─────────────── Center: chat / system thread ───────────────

const ConversationHeader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 18px', borderBottom: `1px solid ${DT_BORDER}`,
    background: DT_PANEL,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 8,
      background: `linear-gradient(135deg, ${DT_TEAL}33 0%, ${DT_TEAL}11 100%)`,
      border: `1px solid ${DT_TEAL}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="18" height="22" viewBox="0 0 22 26">
        <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
          fill="none" stroke={DT_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={DT_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 18, fontWeight: 600, color: DT_TEXT, letterSpacing: '-0.01em' }}>Agentic Poker</span>
        <span style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          color: DT_TEAL, padding: '2px 6px',
          background: DT_TEAL_DIM, border: `1px solid ${DT_TEAL}44`, borderRadius: 3,
        }}>SYSTEM</span>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 600, color: DT_MUTED, letterSpacing: '0.08em' }}>· DAILY STANDUP</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <DTDot color={DT_TEAL} pulse size={5}/>
        <span style={{ fontSize: 11, color: DT_DIM }}>Connected · all 4 agents reporting</span>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 6,
        background: 'transparent', border: `1px solid ${DT_BORDER_STRONG}`,
        color: DT_DIM, fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="history" size={12} color={DT_DIM}/>
        HISTORY
      </button>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 6,
        background: DT_TEAL, border: 'none',
        color: '#0a0a0a', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
        boxShadow: `0 0 12px ${DT_TEAL}55`,
      }}>
        <Icon name="plus" size={12} color="#0a0a0a" strokeWidth={2.4}/>
        BUILD AGENT
      </button>
    </div>
  </div>
);

// timestamp on every message — Bloomberg DNA
const MsgMeta = ({ time, source = 'SYS' }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
    <span style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED, fontWeight: 600 }}>{time}</span>
    <span style={{ fontFamily: MONO, fontSize: 9, color: DT_FAINT, letterSpacing: '0.1em' }}>·</span>
    <span style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em' }}>{source}</span>
  </div>
);

const SystemMessage = ({ time, source, children }) => (
  <div style={{ display: 'flex', gap: 12, padding: '0 18px', marginBottom: 18 }}>
    <div style={{ flexShrink: 0, paddingTop: 2 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6,
        background: DT_TEAL_DIM, border: `1px solid ${DT_TEAL}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="16" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={DT_TEAL} strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
    <div style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
      <MsgMeta time={time} source={source}/>
      {children}
    </div>
  </div>
);

const AgentMsg = ({ time, source, name, accent, children }) => (
  <div style={{ display: 'flex', gap: 12, padding: '0 18px', marginBottom: 18 }}>
    <HoodAvatar size={28} accent={accent}/>
    <div style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: DT_TEXT }}>{name}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED }}>{time}</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_FAINT }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em' }}>{source}</span>
      </div>
      {children}
    </div>
  </div>
);

const Bubble = ({ children, accent }) => (
  <div style={{
    background: DT_SURFACE,
    border: `1px solid ${accent ? `${accent}33` : DT_BORDER}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13.5, color: DT_TEXT, lineHeight: 1.5,
  }}>{children}</div>
);

// Daily standup card — rich data block
const StandupCard = () => (
  <div style={{
    background: DT_SURFACE, border: `1px solid ${DT_TEAL}33`,
    borderRadius: 10, overflow: 'hidden', marginBottom: 8,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderBottom: `1px solid ${DT_BORDER}`,
      background: 'rgba(0,212,170,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DTLabel color={DT_TEAL}>DAILY STANDUP · MAY 6, 2026</DTLabel>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED }}>09:41:22 EST</span>
    </div>

    <div style={{ padding: '14px 16px 4px', fontSize: 13.5, color: DT_TEXT, lineHeight: 1.55 }}>
      Good morning, jmorr. Here's where your <span style={{ color: DT_TEAL, fontWeight: 600 }}>4 agents</span> stand after the overnight session.
    </div>

    {/* Stats grid */}
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 1, background: DT_BORDER, margin: '12px 1px 1px',
      borderTop: `1px solid ${DT_BORDER}`,
    }}>
      {[
        { label: 'NET 24H', value: '+$340.00', color: DT_TEAL, sub: '▲ 14.5%' },
        { label: 'HANDS', value: '184', color: DT_TEXT, sub: '12 sessions' },
        { label: 'WIN RATE', value: '58.7%', color: DT_TEAL, sub: 'BB/100: 8.2' },
        { label: 'BIGGEST POT', value: '$847', color: DT_GOLD, sub: 'Balanced v2.1' },
      ].map((s, i) => (
        <div key={i} style={{ background: DT_PANEL, padding: '12px 14px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.14em', marginBottom: 6 }}>{s.label}</div>
          <DTNum color={s.color} size={18} weight={700}>{s.value}</DTNum>
          <div style={{ fontFamily: MONO, fontSize: 10, color: DT_DIM, marginTop: 4 }}>{s.sub}</div>
        </div>
      ))}
    </div>

    {/* Agents performance table */}
    <div style={{ padding: '14px 0 4px' }}>
      <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <DTLabel>AGENT PERFORMANCE · LAST 24H</DTLabel>
        <span style={{ fontFamily: MONO, fontSize: 10, color: DT_TEAL, fontWeight: 600, cursor: 'pointer' }}>VIEW ALL ↗</span>
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 100px',
        padding: '0 16px 6px', gap: 12,
        fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.1em',
      }}>
        <span>AGENT</span>
        <span style={{ textAlign: 'right' }}>HANDS</span>
        <span style={{ textAlign: 'right' }}>WIN%</span>
        <span style={{ textAlign: 'right' }}>P&L</span>
        <span style={{ textAlign: 'right' }}>TREND</span>
      </div>
      {[
        { name: 'Balanced v2.1', accent: DT_TEAL, hands: 64, win: '61.8%', pnl: '+$340', trend: [10,12,11,14,13,16,18,17,19,22], color: DT_TEAL },
        { name: 'Aggressive v1.3', accent: DT_PURPLE, hands: 48, win: '54.2%', pnl: '+$120', trend: [10,9,11,12,10,13,11,14,13,15], color: DT_TEAL },
        { name: 'Bluff Master', accent: DT_GOLD, hands: 42, win: '52.4%', pnl: '+$210', trend: [10,11,9,12,14,11,13,15,14,17], color: DT_TEAL },
        { name: 'Value Bot', accent: DT_PINK, hands: 30, win: '46.7%', pnl: '-$45', trend: [10,11,10,9,11,9,8,10,9,8], color: DT_RED },
      ].map((a, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px 100px',
          padding: '8px 16px', gap: 12, alignItems: 'center',
          borderTop: `1px solid ${DT_BORDER}`,
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HoodAvatar size={22} accent={a.accent}/>
            <span style={{ color: DT_TEXT, fontWeight: 500 }}>{a.name}</span>
          </div>
          <DTNum color={DT_DIM} size={11}><span style={{textAlign:'right',display:'block'}}>{a.hands}</span></DTNum>
          <DTNum color={DT_TEXT} size={11}><span style={{textAlign:'right',display:'block'}}>{a.win}</span></DTNum>
          <div style={{ textAlign: 'right' }}>
            <DTNum color={a.color} size={12} weight={700}>{a.pnl}</DTNum>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <DTSparkline data={a.trend} color={a.color} w={90} h={18}/>
          </div>
        </div>
      ))}
    </div>

    {/* Flagged hands */}
    <div style={{ padding: '14px 16px 14px', borderTop: `1px solid ${DT_BORDER}`, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <DTLabel>FLAGGED HANDS · NEEDS YOUR REVIEW</DTLabel>
        <DTNum color={DT_GOLD} size={11}>4 HANDS</DTNum>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { agent: 'Balanced v2.1', accent: DT_TEAL, action: 'Folded TT to 3-bet', stake: '$5/$10', loss: '−$80 EV', cards: [['T','s'],['T','d']] },
          { agent: 'Aggressive v1.3', accent: DT_PURPLE, action: 'Bluff-jammed river', stake: '$10/$20', loss: '−$340', cards: [['7','c'],['6','c']] },
          { agent: 'Bluff Master', accent: DT_GOLD, action: 'Called 4-bet w/ AJo', stake: '$5/$10', loss: '−$120', cards: [['A','h'],['J','s']] },
        ].map((h, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 12px', background: DT_SURFACE_2, borderRadius: 6,
            border: `1px solid ${DT_BORDER}`, cursor: 'pointer',
          }}>
            <HoodAvatar size={20} accent={h.accent}/>
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              <MiniCard rank={h.cards[0][0]} suit={h.cards[0][1]}/>
              <MiniCard rank={h.cards[1][0]} suit={h.cards[1][1]}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: DT_TEXT, fontWeight: 500 }}>{h.action}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED, marginTop: 1 }}>{h.agent} · {h.stake}</div>
            </div>
            <DTNum color={DT_RED} size={11}>{h.loss}</DTNum>
            <Icon name="chevron-right" size={14} color={DT_MUTED}/>
          </div>
        ))}
      </div>
    </div>

    {/* Suggested actions */}
    <div style={{
      padding: '12px 16px', borderTop: `1px solid ${DT_BORDER}`,
      background: 'rgba(0,212,170,0.03)',
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    }}>
      <DTLabel color={DT_TEAL}>SUGGESTED →</DTLabel>
      {['Review flagged hands', 'Tune Aggressive v1.3', 'Deploy to NLH 6-Max', 'Build new agent'].map((a, i) => (
        <button key={i} style={{
          height: 26, padding: '0 10px', borderRadius: 5,
          background: i === 0 ? DT_TEAL : 'transparent',
          border: i === 0 ? 'none' : `1px solid ${DT_BORDER_STRONG}`,
          color: i === 0 ? '#0a0a0a' : DT_DIM,
          fontFamily: 'Inter', fontSize: 11, fontWeight: 600,
          cursor: 'pointer',
        }}>{a}</button>
      ))}
    </div>
  </div>
);

// inline live hand card
const LiveHandCard = () => (
  <div style={{
    background: DT_SURFACE, border: `1px solid ${DT_TEAL}55`,
    borderRadius: 10, overflow: 'hidden',
    boxShadow: `0 0 16px rgba(0,212,170,0.08)`,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 14px', borderBottom: `1px solid ${DT_BORDER}`,
      background: 'rgba(0,212,170,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <DTDot pulse size={6}/>
        <DTLabel color={DT_TEAL}>LIVE · TABLE #48291 · HAND #847</DTLabel>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED }}>turn · pot $480</span>
    </div>

    <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 18 }}>
      {/* hero hole cards */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em', marginBottom: 6 }}>HERO</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PlayingCard rank="A" suit="s" w={36} h={50}/>
          <PlayingCard rank="K" suit="h" w={36} h={50}/>
        </div>
      </div>

      <div style={{ width: 1, height: 60, background: DT_BORDER }}/>

      {/* board */}
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em', marginBottom: 6 }}>BOARD</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PlayingCard rank="K" suit="d" w={36} h={50}/>
          <PlayingCard rank="9" suit="s" w={36} h={50}/>
          <PlayingCard rank="2" suit="c" w={36} h={50}/>
          <PlayingCard rank="A" suit="h" w={36} h={50}/>
          <CardBack w={36} h={50} branded/>
        </div>
      </div>

      <div style={{ width: 1, height: 60, background: DT_BORDER }}/>

      {/* equity */}
      <div style={{ minWidth: 110 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em', marginBottom: 6 }}>EQUITY</div>
        <DTNum color={DT_TEAL} size={22} weight={700}>87.4%</DTNum>
        <div style={{ height: 4, background: DT_BORDER, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '87.4%', background: DT_TEAL }}/>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: DT_DIM, marginTop: 6 }}>vs Phil_AI · range</div>
      </div>
    </div>

    {/* action bar */}
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderTop: `1px solid ${DT_BORDER}`,
      background: '#0a0a0c',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MONO, fontSize: 11 }}>
        <span style={{ color: DT_DIM }}>Action: <span style={{ color: DT_TEAL, fontWeight: 700 }}>BET $240</span></span>
        <span style={{ color: DT_FAINT }}>·</span>
        <span style={{ color: DT_DIM }}>Confidence: <span style={{ color: DT_TEXT }}>92%</span></span>
        <span style={{ color: DT_FAINT }}>·</span>
        <span style={{ color: DT_DIM }}>thinking 240ms</span>
      </div>
      <button style={{
        height: 28, padding: '0 14px', borderRadius: 5,
        background: 'transparent', border: `1px solid ${DT_TEAL}`,
        color: DT_TEAL, fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        cursor: 'pointer',
      }}>WATCH LIVE →</button>
    </div>
  </div>
);

// User message (right aligned)
const UserMessage = ({ time, children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 18px', marginBottom: 18 }}>
    <div style={{ maxWidth: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.12em' }}>YOU</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_FAINT }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED }}>{time}</span>
      </div>
      <div style={{
        background: DT_TEAL_DIM, border: `1px solid ${DT_TEAL}33`,
        borderRadius: 10, padding: '10px 14px',
        fontSize: 13.5, color: DT_TEXT, lineHeight: 1.5,
      }}>{children}</div>
    </div>
  </div>
);

const Conversation = () => (
  <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px 0 12px' }}>
    {/* Day divider */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', marginBottom: 16 }}>
      <div style={{ flex: 1, height: 1, background: DT_BORDER }}/>
      <span style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED, letterSpacing: '0.16em' }}>WED · MAY 6, 2026</span>
      <div style={{ flex: 1, height: 1, background: DT_BORDER }}/>
    </div>

    <SystemMessage time="09:41:22" source="STANDUP">
      <StandupCard/>
    </SystemMessage>

    <UserMessage time="09:42:08">
      Show me Aggressive v1.3's bluff-jam hand
    </UserMessage>

    <SystemMessage time="09:42:09" source="REPLAY">
      <Bubble>
        Pulling hand <DTNum color={DT_TEAL} size={12}>#847</DTNum> from <span style={{ color: DT_TEXT, fontWeight: 600 }}>Aggressive v1.3</span> · table HU NLH $10/$20 · 03:14 EST.
        <div style={{ height: 10 }}/>
        <div style={{ fontSize: 12, color: DT_DIM, lineHeight: 1.55 }}>
          7♣6♣ in BB · flop <span style={{ color: DT_TEXT }}>K♠ 9♣ 4♣</span> · floated cbet · turn <span style={{ color: DT_TEXT }}>2♣</span> hits flush · river <span style={{ color: DT_TEXT }}>5♥</span> bricks for villain · agent overbet-jammed for $340.
          Solver says check-call with 38% equity vs jamming range.
        </div>
      </Bubble>
    </SystemMessage>

    <AgentMsg time="09:43:01" source="LIVE" name="Balanced v2.1" accent={DT_TEAL}>
      <div style={{ marginBottom: 8 }}>
        <Bubble accent={DT_TEAL}>
          Heads up — I'm in a big spot at <span style={{ color: DT_TEXT, fontWeight: 600 }}>#48291</span>.<br/>
          AKo on a K♦9♠2♣A♥ board. Villain checked the turn. I'm putting them on KQ or pocket pair. Going for value.
        </Bubble>
      </div>
      <LiveHandCard/>
    </AgentMsg>

    <SystemMessage time="09:43:14" source="ALERT">
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'rgba(205,179,128,0.08)', border: `1px solid ${DT_GOLD}33`,
        borderRadius: 8,
      }}>
        <Icon name="sparkle" size={16} color={DT_GOLD}/>
        <div style={{ flex: 1, fontSize: 12.5, color: DT_TEXT }}>
          <span style={{ color: DT_GOLD, fontWeight: 600 }}>Bluff Master</span> just hit a milestone: <span style={{ color: DT_TEAL, fontWeight: 600 }}>1,000 hands played</span> with positive ROI. Promoted to <span style={{ color: DT_GOLD, fontWeight: 600 }}>TIER 2</span>.
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED }}>+150 XP</span>
      </div>
    </SystemMessage>
  </div>
);

const Composer = () => (
  <div style={{
    padding: '12px 18px 16px', borderTop: `1px solid ${DT_BORDER}`,
    background: DT_PANEL,
  }}>
    {/* slash hint row */}
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
          background: DT_SURFACE, border: `1px solid ${DT_BORDER}`,
          fontFamily: MONO, fontSize: 10, fontWeight: 600,
          color: DT_DIM, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: DT_TEAL }}>{c.cmd}</span>
          <span style={{ color: DT_MUTED, fontFamily: 'Inter', fontSize: 10, fontWeight: 500 }}>{c.desc}</span>
        </button>
      ))}
    </div>

    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 10,
      background: DT_SURFACE, border: `1px solid ${DT_BORDER_STRONG}`,
      borderRadius: 10, padding: '10px 12px',
    }}>
      <Icon name="sparkle" size={16} color={DT_TEAL}/>
      <textarea
        defaultValue="Tighten Aggressive v1.3's 3-bet range from late position. Avoid bluff jams on monotone boards."
        rows={2}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: DT_TEXT, fontSize: 13.5, fontFamily: 'Inter',
          resize: 'none', lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, padding: '2px 5px', border: `1px solid ${DT_BORDER}`, borderRadius: 3 }}>⌘↵</span>
        <button style={{
          width: 32, height: 32, borderRadius: 6,
          background: DT_TEAL, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: `0 0 10px ${DT_TEAL}55`,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontFamily: MONO, fontSize: 10, color: DT_MUTED }}>
      <span>Replying to <span style={{ color: DT_TEAL }}>Aggressive v1.3</span></span>
      <span style={{ color: DT_FAINT }}>·</span>
      <span>Changes apply on next deploy</span>
      <div style={{ flex: 1 }}/>
      <span>Synced with Telegram</span>
      <DTDot pulse size={5}/>
    </div>
  </div>
);

const ConversationPane = () => (
  <div style={{
    flex: 1, minWidth: 0,
    display: 'flex', flexDirection: 'column',
    background: DT_BG,
  }}>
    <ConversationHeader/>
    <Conversation/>
    <Composer/>
  </div>
);

// ─────────────── Right intel panel ───────────────

const IntelSection = ({ title, action, children }) => (
  <div style={{ borderBottom: `1px solid ${DT_BORDER}`, padding: '14px 16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <DTLabel>{title}</DTLabel>
      {action && <span style={{ fontFamily: MONO, fontSize: 10, color: DT_TEAL, fontWeight: 600, cursor: 'pointer' }}>{action}</span>}
    </div>
    {children}
  </div>
);

// Live tape (ticker rows of agent actions across the network)
const TapeRow = ({ time, agent, action, accent, value, valueColor }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '46px 1fr 60px',
    gap: 8, alignItems: 'center', padding: '4px 0',
    fontFamily: MONO, fontSize: 11,
  }}>
    <span style={{ color: DT_MUTED, fontSize: 10 }}>{time}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <DTDot color={accent} size={5} glow={false}/>
      <span style={{
        color: DT_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        fontFamily: 'Inter', fontSize: 11,
      }}>{agent} {action}</span>
    </div>
    <DTNum color={valueColor} size={11}><span style={{ textAlign: 'right', display: 'block' }}>{value}</span></DTNum>
  </div>
);

const LiveSessions = () => (
  <IntelSection title="LIVE SESSIONS · 4 ACTIVE" action="EXPAND ↗">
    {[
      { agent: 'Balanced v2.1', accent: DT_TEAL, table: '$5/$10 NLH 6m', stack: 1847, delta: '+247', equity: 87 },
      { agent: 'Aggressive v1.3', accent: DT_PURPLE, table: '$10/$20 HU', stack: 2104, delta: '+84', equity: 62 },
    ].map((s, i) => (
      <div key={i} style={{
        background: DT_SURFACE, border: `1px solid ${DT_BORDER}`,
        borderRadius: 6, padding: '10px 12px', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <DTDot color={DT_TEAL} pulse size={5}/>
          <HoodAvatar size={20} accent={s.accent}/>
          <span style={{ fontSize: 12, fontWeight: 600, color: DT_TEXT, flex: 1, minWidth: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.agent}</span>
          <DTNum color={DT_TEAL} size={11}>{s.delta}</DTNum>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: MONO, fontSize: 10 }}>
          <span style={{ color: DT_MUTED }}>{s.table}</span>
          <span style={{ color: DT_DIM }}>STACK <span style={{ color: DT_TEXT }}>${s.stack.toLocaleString()}</span></span>
        </div>
        <div style={{ marginTop: 8, height: 3, background: DT_BORDER, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${s.equity}%`, background: DT_TEAL }}/>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, marginTop: 4, letterSpacing: '0.08em' }}>
          EQUITY {s.equity}% · HAND #{847 + i}
        </div>
      </div>
    ))}
  </IntelSection>
);

const Tape = () => (
  <IntelSection title="LIVE TAPE" action="MUTE">
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <TapeRow time="09:43:14" agent="Balanced" action="bet $240"  accent={DT_TEAL}   value="+$240" valueColor={DT_TEAL}/>
      <TapeRow time="09:43:08" agent="Aggressive" action="3-bet"   accent={DT_PURPLE} value="$60"   valueColor={DT_DIM}/>
      <TapeRow time="09:43:01" agent="Balanced" action="raise to"  accent={DT_TEAL}   value="$30"   valueColor={DT_DIM}/>
      <TapeRow time="09:42:54" agent="Aggressive" action="won pot" accent={DT_PURPLE} value="+$184" valueColor={DT_TEAL}/>
      <TapeRow time="09:42:42" agent="Bluff Mst" action="folded"   accent={DT_GOLD}   value="−$12"  valueColor={DT_RED}/>
      <TapeRow time="09:42:36" agent="Balanced" action="check"     accent={DT_TEAL}   value="—"     valueColor={DT_MUTED}/>
      <TapeRow time="09:42:30" agent="Value"    action="sat out"   accent={DT_PINK}   value="—"     valueColor={DT_MUTED}/>
      <TapeRow time="09:42:18" agent="Aggressive" action="bluff jam" accent={DT_PURPLE} value="$340" valueColor={DT_GOLD}/>
    </div>
  </IntelSection>
);

const Leaderboard = () => (
  <IntelSection title="LEADERBOARD · 24H" action="ALL ↗">
    {[
      { rank: 1, name: 'phil_ai', tier: 'T5', pnl: '+$12.4K', win: '67%', you: false },
      { rank: 2, name: 'doyle_v3', tier: 'T5', pnl: '+$8.9K', win: '64%', you: false },
      { rank: 3, name: 'nash_eq', tier: 'T4', pnl: '+$6.1K', win: '61%', you: false },
      { rank: 47, name: 'jmorr', tier: 'T3', pnl: '+$340', win: '58.7%', you: true },
    ].map((r, i) => (
      <div key={i} style={{
        display: 'grid', gridTemplateColumns: '24px 1fr 60px 60px',
        gap: 8, alignItems: 'center', padding: '6px 0',
        fontFamily: MONO, fontSize: 11,
        borderTop: i === 3 ? `1px dashed ${DT_BORDER_STRONG}` : 'none',
        marginTop: i === 3 ? 6 : 0, paddingTop: i === 3 ? 10 : 6,
        background: r.you ? 'rgba(0,212,170,0.04)' : 'transparent',
        margin: r.you ? '0 -16px' : '0', padding: r.you ? '8px 16px' : '6px 0',
      }}>
        <span style={{ color: r.rank <= 3 ? DT_GOLD : DT_MUTED, fontWeight: 700, fontSize: 11 }}>
          {r.rank.toString().padStart(2, '0')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: r.you ? 700 : 500, color: r.you ? DT_TEAL : DT_TEXT }}>{r.name}</span>
          <span style={{ color: DT_MUTED, fontSize: 9 }}>{r.tier}</span>
        </div>
        <DTNum color={DT_DIM} size={10}><span style={{ textAlign: 'right', display: 'block' }}>{r.win}</span></DTNum>
        <DTNum color={DT_TEAL} size={11}><span style={{ textAlign: 'right', display: 'block' }}>{r.pnl}</span></DTNum>
      </div>
    ))}
  </IntelSection>
);

const PnLChart = () => {
  const data = [0, 20, 15, 40, 60, 55, 80, 95, 110, 140, 130, 160, 200, 240, 230, 280, 310, 340];
  const w = 268, h = 80;
  const max = Math.max(...data), min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return [x, y];
  });
  const lineStr = pts.map(p => p.join(',')).join(' ');
  const fillStr = `0,${h} ${lineStr} ${w},${h}`;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <DTNum color={DT_TEAL} size={22} weight={700}>+$340.00</DTNum>
          <span style={{ fontFamily: MONO, fontSize: 11, color: DT_TEAL, marginLeft: 8 }}>▲ 14.5%</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['1H','24H','7D','30D','ALL'].map((p, i) => (
            <span key={i} style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 600,
              padding: '3px 6px', borderRadius: 3,
              color: i === 1 ? DT_TEAL : DT_MUTED,
              background: i === 1 ? DT_TEAL_DIM : 'transparent',
              border: i === 1 ? `1px solid ${DT_TEAL}44` : `1px solid transparent`,
              cursor: 'pointer',
            }}>{p}</span>
          ))}
        </div>
      </div>

      <svg width={w} height={h} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="pnlFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={DT_TEAL} stopOpacity="0.25"/>
            <stop offset="1" stopColor={DT_TEAL} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* gridlines */}
        {[0.25, 0.5, 0.75].map(p => (
          <line key={p} x1="0" x2={w} y1={h * p} y2={h * p} stroke={DT_BORDER} strokeWidth="1" strokeDasharray="2,4"/>
        ))}
        <polygon points={fillStr} fill="url(#pnlFill)"/>
        <polyline points={lineStr} fill="none" stroke={DT_TEAL} strokeWidth="1.5"/>
        <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3" fill={DT_TEAL}/>
        <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="6" fill={DT_TEAL} opacity="0.25"/>
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, marginTop: 12, background: DT_BORDER, borderRadius: 4, overflow: 'hidden' }}>
        {[
          { l: 'BANKROLL', v: '$2,340.50', c: DT_TEXT },
          { l: 'BB/100', v: '8.2', c: DT_TEAL },
          { l: 'VPIP', v: '24%', c: DT_TEXT },
        ].map((s, i) => (
          <div key={i} style={{ background: DT_PANEL, padding: '8px 10px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: DT_MUTED, letterSpacing: '0.1em' }}>{s.l}</div>
            <DTNum color={s.c} size={12} weight={700}>{s.v}</DTNum>
          </div>
        ))}
      </div>
    </div>
  );
};

const RightPanel = () => (
  <div style={{
    width: 320, flexShrink: 0,
    background: DT_PANEL, borderLeft: `1px solid ${DT_BORDER}`,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  }}>
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
      <IntelSection title="YOUR P&L · 24H">
        <PnLChart/>
      </IntelSection>
      <LiveSessions/>
      <Tape/>
      <Leaderboard/>
      <IntelSection title="UPCOMING">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { time: '11:00', name: 'Sit & Go · NLH', buyin: '$50', entries: '47/100' },
            { time: '14:00', name: 'Agent Battle Royale', buyin: '$100', entries: '12/64' },
            { time: '20:00', name: 'Daily Freeroll', buyin: 'FREE', entries: '892' },
          ].map((t, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', background: DT_SURFACE,
              border: `1px solid ${DT_BORDER}`, borderRadius: 6,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 4,
                background: DT_BG, border: `1px solid ${DT_BORDER}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, fontFamily: MONO,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: DT_TEAL }}>{t.time}</span>
                <span style={{ fontSize: 8, color: DT_MUTED }}>EST</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: DT_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: DT_MUTED, marginTop: 1 }}>{t.buyin} · {t.entries}</div>
              </div>
              <button style={{
                height: 24, padding: '0 8px', borderRadius: 4,
                background: 'transparent', border: `1px solid ${DT_TEAL}`,
                color: DT_TEAL, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                cursor: 'pointer',
              }}>JOIN</button>
            </div>
          ))}
        </div>
      </IntelSection>
    </div>
  </div>
);

// ─────────────── Screen ───────────────

const DesktopHomeScreen = () => (
  <div data-screen-label="11 Desktop Home" style={{
    width: 1440, height: 900, background: DT_BG, color: DT_TEXT,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    overflow: 'hidden',
  }}>
    <StatusTicker/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <LeftRail activeThread="system" onSelectThread={() => {}}/>
      <ConversationPane/>
      <RightPanel/>
    </div>
  </div>
);

Object.assign(window, { DesktopHomeScreen });
