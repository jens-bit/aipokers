// Desktop Home v2 — chat-first, less dashboard
// Two columns only: thread list + conversation. No right intel panel.
// Standup is editorial — written briefing first, data woven in.

const D2_BG = '#070708';
const D2_PANEL = '#0c0c0e';
const D2_SURFACE = '#131316';
const D2_SURFACE_2 = '#191920';
const D2_BORDER = 'rgba(255,255,255,0.06)';
const D2_BORDER_STRONG = 'rgba(255,255,255,0.10)';
const D2_TEXT = '#EDEDED';
const D2_DIM = '#A1A1A1';
const D2_MUTED = '#6B6B6B';
const D2_FAINT = '#3a3a3f';
const D2_TEAL = '#00D4AA';
const D2_TEAL_DIM = 'rgba(0,212,170,0.12)';
const D2_RED = '#FF4D4F';
const D2_GOLD = '#CDB380';
const D2_PURPLE = '#9B7BFF';
const D2_PINK = '#FF7A8E';
const MONO2 = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
const SERIF2 = '"Playfair Display", Georgia, serif';

// ─────────────── Atoms ───────────────

const D2Label = ({ children, color = D2_MUTED, size = 10 }) => (
  <span style={{
    fontFamily: MONO2, fontSize: size, fontWeight: 600,
    letterSpacing: '0.16em', textTransform: 'uppercase', color,
  }}>{children}</span>
);

const D2Num = ({ children, color = D2_TEXT, size = 12, weight = 600 }) => (
  <span style={{
    fontFamily: MONO2, fontSize: size, fontWeight: weight,
    color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
  }}>{children}</span>
);

const D2Dot = ({ color = D2_TEAL, size = 6, glow = true, pulse = false }) => (
  <span style={{
    width: size, height: size, borderRadius: '50%',
    background: color,
    boxShadow: glow ? `0 0 6px ${color}` : 'none',
    flexShrink: 0,
    animation: pulse ? 'pulse 2s infinite' : 'none',
    display: 'inline-block',
  }}/>
);

const D2Spark = ({ data, color = D2_TEAL, w = 80, h = 20 }) => {
  const max = Math.max(...data); const min = Math.min(...data); const r = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / r) * h}`).join(' ');
  return <svg width={w} height={h} style={{display:'block'}}><polyline fill="none" stroke={color} strokeWidth="1.4" points={pts}/></svg>;
};

const HoodAvatar2 = ({ size = 32, accent = D2_TEAL, dim = false }) => (
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

// ─────────────── Trim top bar ───────────────

const SlimTopBar = () => {
  const [t, setT] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setT(x => x+1), 1000); return () => clearInterval(id); }, []);
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  return (
    <div style={{
      height: 38, display: 'flex', alignItems: 'center',
      borderBottom: `1px solid ${D2_BORDER}`, background: D2_PANEL,
      padding: '0 20px', gap: 18, fontFamily: 'Inter',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="16" height="18" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={D2_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={D2_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: '0.18em', color: D2_TEXT, fontSize: 11 }}>AGENTIC POKER</span>
      </div>

      <div style={{ flex: 1 }}/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <D2Dot pulse size={5}/>
        <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_DIM, letterSpacing: '0.1em' }}>2 AGENTS LIVE</span>
      </div>
      <div style={{ width: 1, height: 14, background: D2_BORDER }}/>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED, letterSpacing: '0.1em' }}>P&L 24H</span>
        <D2Num color={D2_TEAL} size={11}>+$340.00</D2Num>
      </div>
      <div style={{ width: 1, height: 14, background: D2_BORDER }}/>
      <D2Num color={D2_DIM} size={11}>{time}</D2Num>

      <button style={{
        marginLeft: 8,
        width: 30, height: 30, borderRadius: 6,
        background: 'transparent', border: `1px solid ${D2_BORDER_STRONG}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={D2_DIM} strokeWidth="1.7" strokeLinecap="round">
          <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3z"/>
          <path d="M10 21a2 2 0 0 0 4 0"/>
        </svg>
        <span style={{ position: 'absolute', top: 6, right: 7, width: 6, height: 6, borderRadius: '50%', background: D2_TEAL }}/>
      </button>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 30, padding: '0 4px 0 12px', borderRadius: 6,
        background: D2_SURFACE, border: `1px solid ${D2_BORDER}`,
      }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%',
          background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#0a0a0a', fontWeight: 700, fontSize: 10,
        }}>JM</div>
        <span style={{ fontSize: 12, color: D2_TEXT, fontWeight: 500 }}>jmorr</span>
      </div>
    </div>
  );
};

// ─────────────── Left rail ───────────────

const NavItem2 = ({ icon, label, badge, active }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
    background: active ? D2_TEAL_DIM : 'transparent',
    color: active ? D2_TEAL : D2_DIM,
    fontSize: 12.5, fontWeight: 500,
  }}>
    <Icon name={icon} size={15} color={active ? D2_TEAL : D2_DIM} strokeWidth={1.7}/>
    <span style={{ flex: 1 }}>{label}</span>
    {badge && (
      <span style={{
        height: 16, padding: '0 5px', borderRadius: 4,
        fontFamily: MONO2, fontSize: 9, fontWeight: 700,
        color: active ? D2_TEAL : D2_MUTED,
        border: active ? `1px solid ${D2_TEAL}55` : `1px solid ${D2_BORDER}`,
        display: 'inline-flex', alignItems: 'center',
      }}>{badge}</span>
    )}
  </div>
);

const ThreadRow2 = ({ accent, name, preview, time, status, pnl, unread, active, pinned }) => (
  <div style={{
    display: 'flex', gap: 12, padding: '12px 14px',
    cursor: 'pointer',
    background: active ? 'rgba(0,212,170,0.05)' : 'transparent',
    borderLeft: active ? `2px solid ${D2_TEAL}` : '2px solid transparent',
    paddingLeft: active ? 12 : 14,
    position: 'relative',
  }}>
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <HoodAvatar2 size={38} accent={accent} dim={status === 'idle'}/>
      {status === 'live' && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 11, height: 11, borderRadius: '50%',
          background: D2_TEAL, border: `2px solid ${D2_PANEL}`,
          boxShadow: `0 0 6px ${D2_TEAL}`, animation: 'pulse 2s infinite',
        }}/>
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        {pinned && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill={D2_MUTED}>
            <path d="M12 2 L14 8 L20 9 L15.5 13 L17 19 L12 16 L7 19 L8.5 13 L4 9 L10 8 Z"/>
          </svg>
        )}
        <span style={{
          fontSize: 13, fontWeight: 600, color: D2_TEXT,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          flex: 1, minWidth: 0,
        }}>{name}</span>
        <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED, flexShrink: 0 }}>{time}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 11.5, color: D2_DIM, flex: 1, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.4,
        }}>{preview}</span>
        {pnl && <D2Num color={pnl.startsWith('-') ? D2_RED : D2_TEAL} size={10}>{pnl}</D2Num>}
        {unread && (
          <span style={{
            minWidth: 18, height: 18, padding: '0 6px', borderRadius: 9,
            background: D2_TEAL, color: '#0a0a0a',
            fontFamily: MONO2, fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>{unread}</span>
        )}
      </div>
    </div>
  </div>
);

const LeftRail2 = () => (
  <div style={{
    width: 300, flexShrink: 0,
    background: D2_PANEL, borderRight: `1px solid ${D2_BORDER}`,
    display: 'flex', flexDirection: 'column',
  }}>
    {/* nav */}
    <div style={{ padding: '14px 12px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <NavItem2 icon="home" label="Home" active/>
      <NavItem2 icon="agent" label="Agents" badge="4"/>
      <NavItem2 icon="spade" label="Tables" badge="12"/>
      <NavItem2 icon="history" label="Replays"/>
      <NavItem2 icon="trophy" label="Leaderboard"/>
    </div>

    <div style={{ height: 12 }}/>

    {/* search */}
    <div style={{ padding: '0 14px 10px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, height: 32,
        padding: '0 10px', background: D2_SURFACE, borderRadius: 6,
        border: `1px solid ${D2_BORDER}`,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D2_MUTED} strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
        </svg>
        <input placeholder="Search agents, hands, tables..." style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: D2_TEXT, fontSize: 12, fontFamily: 'Inter',
        }}/>
        <span style={{ fontFamily: MONO2, fontSize: 9, color: D2_MUTED, padding: '2px 5px', border: `1px solid ${D2_BORDER}`, borderRadius: 3 }}>⌘K</span>
      </div>
    </div>

    {/* divider label */}
    <div style={{ padding: '4px 16px 6px' }}>
      <D2Label>CONVERSATIONS</D2Label>
    </div>

    {/* threads */}
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
      <ThreadRow2 accent={D2_TEAL} name="Agentic Poker" preview="Daily standup ready · 4 hands flagged" time="now"
        status="live" unread="3" active pinned/>

      <div style={{ padding: '10px 16px 4px' }}>
        <span style={{ fontFamily: MONO2, fontSize: 9, color: D2_MUTED, letterSpacing: '0.14em' }}>YOUR AGENTS</span>
      </div>
      <ThreadRow2 accent={D2_TEAL} name="Balanced v2.1" preview="In a big spot at #48291. AKo, board K9 2A." time="2m"
        status="live" pnl="+$340" unread="2"/>
      <ThreadRow2 accent={D2_PURPLE} name="Aggressive v1.3" preview="You: tighten up vs 3-bets in late position" time="14m"
        status="live" pnl="+$120"/>
      <ThreadRow2 accent={D2_GOLD} name="Bluff Master" preview="Session ended — 12 hands, ROI 18.4%" time="1h"
        status="idle" pnl="+$210"/>
      <ThreadRow2 accent={D2_PINK} name="Value Bot" preview="Sitting out, waiting on instructions." time="3h"
        status="idle" pnl="-$45"/>

      <div style={{ padding: '10px 16px 4px' }}>
        <span style={{ fontFamily: MONO2, fontSize: 9, color: D2_MUTED, letterSpacing: '0.14em' }}>TABLES</span>
      </div>
      <ThreadRow2 accent={D2_TEAL} name="NLH 6-Max · $5/$10" preview="Balanced sitting · stack $1,847" time="live" status="live"/>
      <ThreadRow2 accent={D2_PURPLE} name="HU NLH · $10/$20" preview="Aggressive vs Phil_AI · 47 hands" time="live" status="live"/>
    </div>

    {/* footer pill */}
    <div style={{
      borderTop: `1px solid ${D2_BORDER}`, padding: '12px 14px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#0a0a0a', fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>JM</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: D2_TEXT }}>jmorr</div>
        <div style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED }}>$2,340.50</div>
      </div>
      <button style={{
        height: 26, padding: '0 10px', borderRadius: 5,
        background: 'transparent', border: `1px solid ${D2_BORDER_STRONG}`,
        color: D2_DIM, fontFamily: MONO2, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
        cursor: 'pointer',
      }}>SETTINGS</button>
    </div>
  </div>
);

// ─────────────── Center conversation ───────────────

const ConversationHeader2 = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 28px', borderBottom: `1px solid ${D2_BORDER}`,
    background: D2_BG,
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 8,
      background: `linear-gradient(135deg, ${D2_TEAL}33 0%, ${D2_TEAL}11 100%)`,
      border: `1px solid ${D2_TEAL}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="20" height="24" viewBox="0 0 22 26">
        <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
          fill="none" stroke={D2_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
        <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={D2_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: SERIF2, fontSize: 22, fontWeight: 600, color: D2_TEXT, letterSpacing: '-0.01em' }}>Agentic Poker</span>
        <span style={{
          fontFamily: MONO2, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
          color: D2_TEAL, padding: '3px 6px',
          background: D2_TEAL_DIM, border: `1px solid ${D2_TEAL}44`, borderRadius: 3,
        }}>SYSTEM</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
        <D2Dot color={D2_TEAL} pulse size={5}/>
        <span style={{ fontSize: 11.5, color: D2_DIM }}>4 agents reporting · last sync 41s ago</span>
      </div>
    </div>
    <button style={{
      height: 32, padding: '0 14px', borderRadius: 6,
      background: D2_TEAL, border: 'none',
      color: '#0a0a0a', fontFamily: MONO2, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      boxShadow: `0 0 12px ${D2_TEAL}55`,
    }}>
      <Icon name="plus" size={12} color="#0a0a0a" strokeWidth={2.4}/>
      BUILD AGENT
    </button>
  </div>
);

// Big P&L chart — visual hero of standup
const HeroChart = () => {
  const data = [0, 20, 15, 40, 60, 55, 80, 95, 110, 90, 130, 160, 200, 240, 230, 280, 310, 340];
  const w = 760, h = 160;
  const max = Math.max(...data), min = Math.min(...data, 0); const range = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / range) * h]);
  const lineStr = pts.map(p => p.join(',')).join(' ');
  const fillStr = `0,${h} ${lineStr} ${w},${h}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="heroFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={D2_TEAL} stopOpacity="0.35"/>
          <stop offset="1" stopColor={D2_TEAL} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1="0" x2={w} y1={h * p} y2={h * p} stroke={D2_BORDER} strokeWidth="1" strokeDasharray="2,5"/>
      ))}
      <polygon points={fillStr} fill="url(#heroFill)"/>
      <polyline points={lineStr} fill="none" stroke={D2_TEAL} strokeWidth="2"/>
      <circle cx={last[0]} cy={last[1]} r="4" fill={D2_TEAL}/>
      <circle cx={last[0]} cy={last[1]} r="9" fill={D2_TEAL} opacity="0.25"/>
    </svg>
  );
};

// Visuals-first standup — agents are the heroes (Football Manager DNA)
const StandupCard2 = () => {
  const squad = [
    { name: 'Balanced v2.1',   accent: D2_TEAL,   role: 'GRINDER',     hands: 64, pnl: '+$340', form: ['W','W','L','W','W'], rating: 8.4, trend: [10,12,11,14,13,16,18,17,19,22], color: D2_TEAL, status: 'LIVE',   tier: 3, traits: ['Tight', 'Patient', 'Value'] },
    { name: 'Aggressive v1.3', accent: D2_PURPLE, role: 'AGGRESSOR',   hands: 48, pnl: '+$120', form: ['W','L','W','W','L'], rating: 6.7, trend: [10,9,11,12,10,13,11,14,13,15],  color: D2_TEAL, status: 'LIVE',   tier: 2, traits: ['3-bet heavy', 'Float', 'Tilts'] },
    { name: 'Bluff Master',    accent: D2_GOLD,   role: 'SHOWMAN',     hands: 42, pnl: '+$210', form: ['W','W','W','L','W'], rating: 7.9, trend: [10,11,9,12,14,11,13,15,14,17],   color: D2_TEAL, status: 'TIER ↑', tier: 2, traits: ['Bluff', 'Creative', 'Reads'] },
    { name: 'Value Bot',       accent: D2_PINK,   role: 'CALLING STN', hands: 30, pnl: '−$45',  form: ['L','L','W','L','L'], rating: 4.2, trend: [10,11,10,9,11,9,8,10,9,8],       color: D2_RED,  status: 'TILT',   tier: 1, traits: ['Loose', 'Sticky', 'Tilted'] },
  ];

  return (
  <div style={{
    background: D2_PANEL, border: `1px solid ${D2_BORDER}`,
    borderRadius: 12, overflow: 'hidden',
  }} data-wrapper="standup">
    {/* date strip + brief totals */}
    <div style={{
      padding: '14px 24px',
      borderBottom: `1px solid ${D2_BORDER}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <span style={{ fontFamily: MONO2, fontSize: 11, color: D2_TEAL, fontWeight: 600, letterSpacing: '0.16em' }}>SQUAD REPORT</span>
      <span style={{ color: D2_FAINT }}>·</span>
      <span style={{ fontFamily: MONO2, fontSize: 11, color: D2_MUTED, letterSpacing: '0.08em' }}>WED · MAY 6 · 09:41</span>
      <div style={{ flex: 1 }}/>
      <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED, letterSpacing: '0.1em' }}>NET 24H</span>
      <D2Num color={D2_TEAL} size={16} weight={700}>+$340.00</D2Num>
      <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_TEAL }}>▲ 14.5%</span>
      <span style={{ color: D2_FAINT }}>·</span>
      <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED, letterSpacing: '0.1em' }}>184 HANDS</span>
    </div>

    {/* hero — headline + roster intro */}
    <div style={{ padding: '20px 28px 4px' }}>
      <div style={{ fontFamily: SERIF2, fontSize: 28, fontWeight: 600, color: D2_TEXT, letterSpacing: '-0.015em', lineHeight: 1.1, marginBottom: 6 }}>
        Good morning, jmorr.
      </div>
      <div style={{ fontSize: 14, color: D2_DIM, lineHeight: 1.5 }}>
        Your <span style={{ color: D2_TEXT, fontWeight: 600 }}>4-agent squad</span> overnight: 3 in form, 1 on tilt.
      </div>
    </div>

    {/* THE SQUAD — Football Manager-style roster, the visual hero */}
    <div style={{ padding: '18px 28px 8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {squad.map((a, i) => (
          <div key={i} style={{
            background: D2_SURFACE, border: `1px solid ${a.status === 'TILT' ? D2_RED + '33' : D2_BORDER}`,
            borderRadius: 10, overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: '110px 1fr 130px 110px 130px 80px',
            alignItems: 'stretch',
            cursor: 'pointer', position: 'relative',
          }}>
            {/* Portrait pillar — big hooded silhouette */}
            <div style={{
              background: `linear-gradient(180deg, ${a.accent}1A 0%, ${a.accent}05 100%)`,
              borderRight: `1px solid ${D2_BORDER}`,
              padding: '14px 0 12px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              position: 'relative',
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 8,
                background: '#0a0f17', border: `1.5px solid ${a.accent}88`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 14px ${a.accent}33`,
              }}>
                <svg width="50" height="50" viewBox="0 0 80 80">
                  <path d="M40 12 C26 12 18 24 18 42 L18 80 L62 80 L62 42 C62 24 54 12 40 12 Z"
                    fill="#0a0f17" stroke={`${a.accent}88`} strokeWidth="0.8"/>
                  <ellipse cx="40" cy="42" rx="14" ry="17" fill="#050810"/>
                  <ellipse cx="33" cy="40" rx="2.6" ry="1.8" fill={a.accent}/>
                  <ellipse cx="47" cy="40" rx="2.6" ry="1.8" fill={a.accent}/>
                </svg>
              </div>
              {/* tier pips */}
              <div style={{ display: 'flex', gap: 2 }}>
                {[1,2,3,4,5].map(t => (
                  <span key={t} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: t <= a.tier ? a.accent : 'rgba(255,255,255,0.08)',
                  }}/>
                ))}
              </div>
              <span style={{ fontFamily: MONO2, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', color: a.accent }}>
                T{a.tier} · {a.role}
              </span>
            </div>

            {/* Name + traits */}
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: SERIF2, fontSize: 19, fontWeight: 600, color: D2_TEXT, letterSpacing: '-0.01em' }}>{a.name}</span>
                <span style={{
                  fontFamily: MONO2, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
                  color: a.status === 'TILT' ? D2_RED : a.status === 'TIER ↑' ? D2_GOLD : D2_TEAL,
                  padding: '2px 6px', borderRadius: 3,
                  background: a.status === 'TILT' ? 'rgba(255,77,79,0.12)' : a.status === 'TIER ↑' ? 'rgba(205,179,128,0.12)' : D2_TEAL_DIM,
                  border: `1px solid ${a.status === 'TILT' ? D2_RED + '44' : a.status === 'TIER ↑' ? D2_GOLD + '44' : D2_TEAL + '44'}`,
                }}>{a.status === 'LIVE' && <span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: D2_TEAL, marginRight: 5, animation: 'pulse 2s infinite' }}/>}{a.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {a.traits.map((t, j) => (
                  <span key={j} style={{
                    fontFamily: 'Inter', fontSize: 10, fontWeight: 500,
                    color: D2_DIM, padding: '2px 7px', borderRadius: 3,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${D2_BORDER}`,
                  }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Form (W/L last 5) — Football Manager hallmark */}
            <div style={{
              padding: '14px 12px',
              borderLeft: `1px solid ${D2_BORDER}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6,
            }}>
              <D2Label size={9}>FORM · L5</D2Label>
              <div style={{ display: 'flex', gap: 3 }}>
                {a.form.map((r, j) => (
                  <span key={j} style={{
                    width: 18, height: 18, borderRadius: 3,
                    background: r === 'W' ? D2_TEAL_DIM : 'rgba(255,77,79,0.12)',
                    border: `1px solid ${r === 'W' ? D2_TEAL + '55' : D2_RED + '55'}`,
                    color: r === 'W' ? D2_TEAL : D2_RED,
                    fontFamily: MONO2, fontSize: 10, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{r}</span>
                ))}
              </div>
            </div>

            {/* Rating — the FM stat */}
            <div style={{
              padding: '14px 12px',
              borderLeft: `1px solid ${D2_BORDER}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 4,
            }}>
              <D2Label size={9}>RATING</D2Label>
              <D2Num color={a.rating >= 7 ? D2_TEAL : a.rating >= 6 ? D2_GOLD : D2_RED} size={26} weight={700}>{a.rating.toFixed(1)}</D2Num>
              <span style={{ fontFamily: MONO2, fontSize: 9, color: D2_MUTED, letterSpacing: '0.08em' }}>{a.hands} HANDS</span>
            </div>

            {/* P&L sparkline */}
            <div style={{
              padding: '14px 14px',
              borderLeft: `1px solid ${D2_BORDER}`,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <D2Label size={9}>P&L</D2Label>
                <D2Num color={a.color} size={16} weight={700}>{a.pnl}</D2Num>
              </div>
              <D2Spark data={a.trend} color={a.color} w={110} h={26}/>
            </div>

            {/* Action chevron */}
            <div style={{
              borderLeft: `1px solid ${D2_BORDER}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(0,0,0,0.2)',
            }}>
              <button style={{
                height: 28, padding: '0 10px', borderRadius: 5,
                background: a.status === 'LIVE' ? D2_TEAL_DIM : 'transparent',
                border: `1px solid ${a.status === 'LIVE' ? D2_TEAL : D2_BORDER_STRONG}`,
                color: a.status === 'LIVE' ? D2_TEAL : D2_DIM,
                fontFamily: MONO2, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                cursor: 'pointer',
              }}>{a.status === 'LIVE' ? 'WATCH' : a.status === 'TILT' ? 'WAKE' : 'OPEN'}</button>
              <Icon name="chevron-right" size={14} color={D2_MUTED}/>
            </div>
          </div>
        ))}
      </div>

      {/* squad-level summary strip */}
      <div style={{
        marginTop: 14,
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 1, background: D2_BORDER, borderRadius: 6, overflow: 'hidden',
        border: `1px solid ${D2_BORDER}`,
      }}>
        {[
          { l: 'AVG RATING', v: '6.8',     c: D2_TEAL },
          { l: 'WIN RATE',   v: '58.7%',   c: D2_TEXT },
          { l: 'BB/100',     v: '8.2',     c: D2_TEAL },
          { l: 'BIGGEST POT', v: '$847',   c: D2_GOLD },
          { l: 'STREAK',     v: '4 days',  c: D2_TEAL },
        ].map((s, i) => (
          <div key={i} style={{ background: D2_PANEL, padding: '10px 14px' }}>
            <D2Label size={9}>{s.l}</D2Label>
            <div style={{ height: 4 }}/>
            <D2Num color={s.c} size={16} weight={700}>{s.v}</D2Num>
          </div>
        ))}
      </div>
    </div>

    {/* flagged hands — visual cards, no prose */}
    <div style={{ padding: '14px 28px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <D2Label>4 HANDS NEED REVIEW</D2Label>
        <div style={{ flex: 1, height: 1, background: D2_BORDER }}/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {[
          { agent: 'Aggressive v1.3', accent: D2_PURPLE, hole: [['7','c'],['6','c']], board: [['K','s'],['9','c'],['4','c'],['2','c'],['5','h']], loss: '−$340', stake: '$10/$20', tag: 'BLUFF JAM' },
          { agent: 'Balanced v2.1',   accent: D2_TEAL,   hole: [['T','s'],['T','d']], board: [['A','h'],['J','c'],['7','d']],                       loss: '−$80',  stake: '$5/$10',  tag: 'OVER FOLD' },
          { agent: 'Bluff Master',    accent: D2_GOLD,   hole: [['A','h'],['J','s']], board: [['Q','d'],['8','s'],['3','c'],['K','h']],             loss: '−$120', stake: '$5/$10',  tag: '4-BET CALL' },
        ].map((h, i) => (
          <div key={i} style={{
            background: D2_SURFACE, border: `1px solid ${D2_BORDER}`,
            borderRadius: 8, padding: '12px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <HoodAvatar2 size={20} accent={h.accent}/>
                <span style={{ fontFamily: MONO2, fontSize: 9.5, color: D2_MUTED, letterSpacing: '0.08em' }}>{h.stake}</span>
              </div>
              <span style={{
                fontFamily: MONO2, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                color: D2_RED, padding: '2px 5px',
                background: 'rgba(255,77,79,0.08)', border: `1px solid ${D2_RED}33`, borderRadius: 3,
              }}>{h.tag}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {h.hole.map((c, j) => <PlayingCard key={j} rank={c[0]} suit={c[1]} w={26} h={36}/>)}
              </div>
              <span style={{ color: D2_FAINT, margin: '0 4px' }}>·</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {h.board.map((c, j) => <PlayingCard key={j} rank={c[0]} suit={c[1]} w={22} h={30}/>)}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <D2Num color={D2_RED} size={16} weight={700}>{h.loss}</D2Num>
              <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_TEAL, fontWeight: 600, letterSpacing: '0.08em' }}>REVIEW →</span>
            </div>
          </div>
        ))}
      </div>

      {/* quick action chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {[
          { label: 'Review all flagged', primary: true },
          { label: 'Tune Aggressive v1.3' },
          { label: 'Wake Value Bot' },
          { label: 'Deploy Balanced v2.1' },
        ].map((a, i) => (
          <button key={i} style={{
            height: 30, padding: '0 14px', borderRadius: 6,
            background: a.primary ? D2_TEAL : 'transparent',
            border: a.primary ? 'none' : `1px solid ${D2_BORDER_STRONG}`,
            color: a.primary ? '#0a0a0a' : D2_TEXT,
            fontFamily: 'Inter', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
          }}>{a.label}</button>
        ))}
      </div>
    </div>
  </div>
  );
};

// Compact live hand inline message — only when an agent is mid-hand
const LiveHandInline = () => (
  <div style={{
    background: D2_PANEL, border: `1px solid ${D2_TEAL}44`,
    borderRadius: 12, overflow: 'hidden',
    boxShadow: `0 0 20px rgba(0,212,170,0.06)`,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 18px', borderBottom: `1px solid ${D2_BORDER}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <D2Dot pulse size={6}/>
        <D2Label color={D2_TEAL}>LIVE · TABLE #48291 · TURN</D2Label>
      </div>
      <span style={{ fontFamily: MONO2, fontSize: 11, color: D2_DIM }}>POT <span style={{ color: D2_TEXT, fontWeight: 600 }}>$480</span></span>
    </div>
    <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 24 }}>
      <div>
        <div style={{ fontFamily: MONO2, fontSize: 9, color: D2_MUTED, letterSpacing: '0.12em', marginBottom: 8 }}>HOLE</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PlayingCard rank="A" suit="s" w={38} h={52}/>
          <PlayingCard rank="K" suit="h" w={38} h={52}/>
        </div>
      </div>
      <div style={{ width: 1, height: 64, background: D2_BORDER }}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: MONO2, fontSize: 9, color: D2_MUTED, letterSpacing: '0.12em', marginBottom: 8 }}>BOARD</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PlayingCard rank="K" suit="d" w={38} h={52}/>
          <PlayingCard rank="9" suit="s" w={38} h={52}/>
          <PlayingCard rank="2" suit="c" w={38} h={52}/>
          <PlayingCard rank="A" suit="h" w={38} h={52}/>
          <CardBack w={38} h={52} branded/>
        </div>
      </div>
      <div style={{ width: 1, height: 64, background: D2_BORDER }}/>
      <div style={{ minWidth: 110 }}>
        <div style={{ fontFamily: MONO2, fontSize: 9, color: D2_MUTED, letterSpacing: '0.12em', marginBottom: 8 }}>EQUITY</div>
        <D2Num color={D2_TEAL} size={26} weight={700}>87.4%</D2Num>
        <div style={{ height: 4, background: D2_BORDER, borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '87.4%', background: D2_TEAL }}/>
        </div>
      </div>
    </div>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 18px', borderTop: `1px solid ${D2_BORDER}`,
      background: D2_BG,
    }}>
      <div style={{ fontFamily: MONO2, fontSize: 11, color: D2_DIM }}>
        ACTION <span style={{ color: D2_TEAL, fontWeight: 700 }}>BET $240</span>
        <span style={{ color: D2_FAINT, margin: '0 10px' }}>·</span>
        CONFIDENCE <span style={{ color: D2_TEXT }}>92%</span>
      </div>
      <button style={{
        height: 28, padding: '0 14px', borderRadius: 5,
        background: 'transparent', border: `1px solid ${D2_TEAL}`,
        color: D2_TEAL, fontFamily: MONO2, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        cursor: 'pointer',
      }}>WATCH LIVE →</button>
    </div>
  </div>
);

const SystemMessage2 = ({ time, children, wide = true }) => (
  <div style={{ padding: '0 28px', marginBottom: 22 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{
        width: 22, height: 22, borderRadius: 4,
        background: D2_TEAL_DIM, border: `1px solid ${D2_TEAL}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="11" height="13" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={D2_TEAL} strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: D2_TEXT }}>Agentic Poker</span>
      <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED }}>{time}</span>
    </div>
    <div style={{ maxWidth: wide ? '100%' : 720 }}>
      {children}
    </div>
  </div>
);

const AgentMsg2 = ({ time, name, accent, status, children }) => (
  <div style={{ padding: '0 28px', marginBottom: 22 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <HoodAvatar2 size={22} accent={accent}/>
      <span style={{ fontSize: 12, fontWeight: 600, color: D2_TEXT }}>{name}</span>
      {status && (
        <span style={{
          fontFamily: MONO2, fontSize: 9, fontWeight: 700,
          color: D2_TEAL, letterSpacing: '0.1em',
          padding: '2px 5px', background: D2_TEAL_DIM,
          border: `1px solid ${D2_TEAL}44`, borderRadius: 3,
        }}>{status}</span>
      )}
      <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED }}>{time}</span>
    </div>
    {children}
  </div>
);

const Bubble2 = ({ children, accent }) => (
  <div style={{
    background: D2_SURFACE,
    border: `1px solid ${accent ? `${accent}33` : D2_BORDER}`,
    borderRadius: 10,
    padding: '14px 18px',
    fontSize: 14, color: D2_TEXT, lineHeight: 1.55,
    maxWidth: 720,
  }}>{children}</div>
);

const UserMessage2 = ({ time, children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 28px', marginBottom: 22 }}>
    <div style={{ maxWidth: 540 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: D2_TEXT }}>You</span>
        <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED }}>{time}</span>
      </div>
      <div style={{
        background: D2_TEAL_DIM, border: `1px solid ${D2_TEAL}33`,
        borderRadius: 10, padding: '12px 16px',
        fontSize: 14, color: D2_TEXT, lineHeight: 1.55,
      }}>{children}</div>
    </div>
  </div>
);

const Conversation2 = () => (
  <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px 0 12px' }}>
    {/* day divider */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 28px', marginBottom: 22 }}>
      <div style={{ flex: 1, height: 1, background: D2_BORDER }}/>
      <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED, letterSpacing: '0.18em' }}>WED · MAY 6, 2026</span>
      <div style={{ flex: 1, height: 1, background: D2_BORDER }}/>
    </div>

    <SystemMessage2 time="09:41">
      <StandupCard2/>
    </SystemMessage2>

    <UserMessage2 time="09:42">
      Show me Aggressive v1.3's bluff-jam.
    </UserMessage2>

    <SystemMessage2 time="09:42" wide={false}>
      <Bubble2>
        Pulling hand <D2Num color={D2_TEAL} size={12.5}>#847</D2Num> from <span style={{ color: D2_TEXT, fontWeight: 600 }}>Aggressive v1.3</span> — <span style={{ color: D2_DIM }}>HU NLH $10/$20, 03:14 EST.</span>
        <div style={{ height: 8 }}/>
        7♣6♣ in BB. Floated a cbet on K♠ 9♣ 4♣, hit the flush turn (2♣), river bricked 5♥. Agent overbet-jammed for $340 — solver says check-call has 38% equity vs villain's value-jamming range. Classic spot for restraint.
      </Bubble2>
    </SystemMessage2>

    <AgentMsg2 time="09:43" name="Balanced v2.1" accent={D2_TEAL} status="LIVE">
      <Bubble2 accent={D2_TEAL}>
        Heads up — I'm in a big spot at <span style={{ color: D2_TEXT, fontWeight: 600 }}>#48291</span>. AKo on K♦9♠2♣A♥. Villain checked the turn. I'm reading them on KQ or a small pocket pair. Going for value.
      </Bubble2>
      <div style={{ height: 12 }}/>
      <LiveHandInline/>
    </AgentMsg2>

    <SystemMessage2 time="09:43" wide={false}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', maxWidth: 720,
        background: 'rgba(205,179,128,0.06)',
        border: `1px solid ${D2_GOLD}33`, borderRadius: 10,
      }}>
        <Icon name="sparkle" size={18} color={D2_GOLD}/>
        <div style={{ flex: 1, fontSize: 13.5, color: D2_TEXT, lineHeight: 1.5 }}>
          <span style={{ color: D2_GOLD, fontWeight: 600 }}>Bluff Master</span> hit a milestone: <span style={{ color: D2_TEAL, fontWeight: 600 }}>1,000 lifetime hands</span> with positive ROI. Promoted to <span style={{ color: D2_GOLD, fontWeight: 600 }}>TIER 2</span>.
        </div>
        <span style={{ fontFamily: MONO2, fontSize: 10, color: D2_MUTED }}>+150 XP</span>
      </div>
    </SystemMessage2>
  </div>
);

const Composer2 = () => (
  <div style={{
    padding: '14px 28px 20px',
    borderTop: `1px solid ${D2_BORDER}`, background: D2_BG,
  }}>
    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
      {[
        { cmd: '/deploy', desc: 'send agent to a table' },
        { cmd: '/build',  desc: 'create new agent' },
        { cmd: '/replay', desc: 'pull a hand' },
        { cmd: '/analyze', desc: 'review last session' },
      ].map((c, i) => (
        <button key={i} style={{
          height: 26, padding: '0 10px', borderRadius: 5,
          background: D2_SURFACE, border: `1px solid ${D2_BORDER}`,
          fontFamily: MONO2, fontSize: 10.5, fontWeight: 600,
          color: D2_DIM, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: D2_TEAL }}>{c.cmd}</span>
          <span style={{ color: D2_MUTED, fontFamily: 'Inter', fontSize: 11, fontWeight: 500 }}>{c.desc}</span>
        </button>
      ))}
    </div>

    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 12,
      background: D2_SURFACE, border: `1px solid ${D2_BORDER_STRONG}`,
      borderRadius: 12, padding: '12px 14px',
    }}>
      <Icon name="sparkle" size={18} color={D2_TEAL}/>
      <textarea
        defaultValue="Tighten Aggressive v1.3's 3-bet range from late position. Avoid bluff jams on monotone boards."
        rows={2}
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: D2_TEXT, fontSize: 14, fontFamily: 'Inter',
          resize: 'none', lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
        <span style={{ fontFamily: MONO2, fontSize: 9.5, color: D2_MUTED, padding: '3px 6px', border: `1px solid ${D2_BORDER}`, borderRadius: 3 }}>⌘↵</span>
        <button style={{
          width: 34, height: 34, borderRadius: 7,
          background: D2_TEAL, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', boxShadow: `0 0 12px ${D2_TEAL}55`,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
          </svg>
        </button>
      </div>
    </div>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginTop: 10,
      fontFamily: MONO2, fontSize: 10, color: D2_MUTED,
    }}>
      <span>Replying to <span style={{ color: D2_TEAL }}>Aggressive v1.3</span></span>
      <span style={{ color: D2_FAINT }}>·</span>
      <span>Changes apply on next deploy</span>
      <div style={{ flex: 1 }}/>
      <span>Synced with Telegram</span>
      <D2Dot pulse size={5}/>
    </div>
  </div>
);

const ConversationPane2 = () => (
  <div style={{
    flex: 1, minWidth: 0,
    display: 'flex', flexDirection: 'column',
    background: D2_BG,
  }}>
    <ConversationHeader2/>
    {/* center column with comfortable max-width */}
    <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 920, display: 'flex', flexDirection: 'column' }}>
        <Conversation2/>
        <Composer2/>
      </div>
    </div>
  </div>
);

// ─────────────── Screen ───────────────

const DesktopHomeScreenV2 = () => (
  <div data-screen-label="11 Desktop Home v2" style={{
    width: 1440, height: 900, background: D2_BG, color: D2_TEXT,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    overflow: 'hidden',
  }}>
    <SlimTopBar/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <LeftRail2/>
      <ConversationPane2/>
    </div>
  </div>
);

Object.assign(window, { DesktopHomeScreenV2 });
