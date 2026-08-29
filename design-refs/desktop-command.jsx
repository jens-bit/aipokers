// Desktop Command Center — chat-first, with live game preview tiles
// EMBEDDED inside the conversation as rich messages.
// The chat IS the command center. Tables are previews you click to focus.

const C_BG = '#070708';
const C_PANEL = '#0c0c0e';
const C_SURFACE = '#131316';
const C_SURFACE_2 = '#191920';
const C_BORDER = 'rgba(255,255,255,0.06)';
const C_BORDER_STRONG = 'rgba(255,255,255,0.10)';
const C_TEXT = '#EDEDED';
const C_DIM = '#A1A1A1';
const C_MUTED = '#6B6B6B';
const C_FAINT = '#3a3a3f';
const C_TEAL = '#00D4AA';
const C_TEAL_DIM = 'rgba(0,212,170,0.10)';
const C_RED = '#FF4D4F';
const C_GOLD = '#CDB380';
const C_PURPLE = '#9B7BFF';
const C_PINK = '#FF7A8E';
const C_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';
const C_SERIF = '"Playfair Display", Georgia, serif';

const CHood = ({ size = 32, accent = C_TEAL, dim = false }) => (
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

const CDot = ({ color = C_TEAL, size = 6, glow = true, pulse = false }) => (
  <span style={{
    width: size, height: size, borderRadius: '50%', background: color,
    boxShadow: glow ? `0 0 6px ${color}` : 'none', flexShrink: 0,
    animation: pulse ? 'pulse 2s infinite' : 'none', display: 'inline-block',
  }}/>
);

const CLabel = ({ children, color = C_MUTED, size = 10 }) => (
  <span style={{ fontFamily: C_MONO, fontSize: size, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color }}>{children}</span>
);

const CNum = ({ children, color = C_TEXT, size = 12, weight = 600 }) => (
  <span style={{ fontFamily: C_MONO, fontSize: size, fontWeight: weight, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{children}</span>
);

// Top bar
const CTop = () => {
  const [, setT] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setT(t => t+1), 1000); return () => clearInterval(id); }, []);
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  return (
    <div style={{ height: 36, display: 'flex', alignItems: 'center', borderBottom: `1px solid ${C_BORDER}`, background: C_PANEL, padding: '0 18px', gap: 22, fontFamily: C_MONO, fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <svg width="17" height="20" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z" fill="none" stroke={C_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={C_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: '0.18em', color: C_TEXT }}>AGENTIC POKER</span>
      </div>
      <span style={{ color: C_FAINT }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CDot pulse/><span style={{ color: C_DIM }}>2 LIVE</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: C_DIM }}>P&L 24H</span><span style={{ color: C_TEAL, fontWeight: 600 }}>+$340.00</span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: C_DIM }}>BANKROLL</span><span style={{ color: C_TEXT, fontWeight: 600 }}>$2,340.50</span></div>
      <div style={{ flex: 1 }}/>
      <span style={{ color: C_MUTED, fontSize: 10 }}>NYC</span><span style={{ color: C_TEXT }}>{time}</span>
      <span style={{ color: C_FAINT }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 10px', background: C_SURFACE, borderRadius: 4, border: `1px solid ${C_BORDER}` }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)', color: '#0a0a0a', fontWeight: 700, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JM</div>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: C_TEXT, fontWeight: 500 }}>jmorr</span>
        <span style={{ fontSize: 9, color: C_GOLD, letterSpacing: '0.08em' }}>TIER 3</span>
      </div>
    </div>
  );
};

// Left rail (thread list)
const CNav = ({ icon, label, badge, active }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
    background: active ? C_TEAL_DIM : 'transparent',
    color: active ? C_TEAL : C_DIM, fontSize: 12, fontWeight: 500, position: 'relative',
  }}>
    {active && <div style={{ position: 'absolute', left: -10, top: 6, bottom: 6, width: 2, background: C_TEAL, borderRadius: 1 }}/>}
    <Icon name={icon} size={15} color={active ? C_TEAL : C_DIM} strokeWidth={1.7}/>
    <span style={{ flex: 1 }}>{label}</span>
    {badge && (
      <span style={{ height: 16, padding: '0 5px', borderRadius: 4, fontFamily: C_MONO, fontSize: 9, fontWeight: 700, color: active ? C_TEAL : C_MUTED, border: active ? `1px solid ${C_TEAL}55` : `1px solid ${C_BORDER}`, display: 'inline-flex', alignItems: 'center' }}>{badge}</span>
    )}
  </div>
);

const CThread = ({ accent, name, preview, time, status, pnl, unread, active }) => (
  <div style={{
    display: 'flex', gap: 10, padding: '10px 12px', cursor: 'pointer',
    background: active ? 'rgba(0,212,170,0.06)' : 'transparent',
    borderLeft: active ? `2px solid ${C_TEAL}` : '2px solid transparent',
    paddingLeft: active ? 10 : 12,
  }}>
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <CHood size={34} accent={accent} dim={status === 'idle'}/>
      {status === 'live' && <span style={{ position: 'absolute', bottom: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: C_TEAL, border: `2px solid ${C_PANEL}`, boxShadow: `0 0 5px ${C_TEAL}`, animation: 'pulse 2s infinite' }}/>}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{name}</span>
        <span style={{ fontFamily: C_MONO, fontSize: 10, color: C_MUTED, flexShrink: 0 }}>{time}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11.5, color: C_DIM, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preview}</span>
        {pnl && <CNum color={pnl.startsWith('-') ? C_RED : C_TEAL} size={10}>{pnl}</CNum>}
        {unread && <span style={{ minWidth: 16, height: 16, padding: '0 5px', borderRadius: 8, background: C_TEAL, color: '#0a0a0a', fontFamily: C_MONO, fontSize: 9, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{unread}</span>}
      </div>
    </div>
  </div>
);

const CRail = () => (
  <div style={{ width: 270, flexShrink: 0, background: C_PANEL, borderRight: `1px solid ${C_BORDER}`, display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: '14px 12px 4px' }}>
      <CLabel size={9}>NAVIGATE</CLabel>
      <div style={{ height: 8 }}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <CNav icon="home" label="Command Center" active/>
        <CNav icon="agent" label="Agents" badge="4"/>
        <CNav icon="spade" label="Tables"/>
        <CNav icon="history" label="Replays"/>
        <CNav icon="trophy" label="Leaderboard"/>
        <CNav icon="profile" label="Account"/>
      </div>
    </div>
    <div style={{ height: 16 }}/>
    <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <CLabel size={9}>CONVERSATIONS</CLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><CDot pulse/><span style={{ fontFamily: C_MONO, fontSize: 10, color: C_TEAL, fontWeight: 600 }}>2 LIVE</span></div>
    </div>
    <div style={{ padding: '0 12px 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 10px', background: C_SURFACE, borderRadius: 6, border: `1px solid ${C_BORDER}` }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C_MUTED} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        <input placeholder="Search agents, hands, tables..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C_TEXT, fontSize: 12, fontFamily: 'Inter' }}/>
        <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED, padding: '2px 5px', border: `1px solid ${C_BORDER}`, borderRadius: 3 }}>⌘K</span>
      </div>
    </div>
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
      <div style={{ padding: '4px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED, letterSpacing: '0.12em' }}>PINNED</span>
        <div style={{ flex: 1, height: 1, background: C_BORDER }}/>
      </div>
      <CThread accent={C_TEAL} name="Command Center" preview="2 agents live · 4 hands flagged" time="now" status="live" unread="3" active/>
      <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED, letterSpacing: '0.12em' }}>YOUR AGENTS</span>
        <div style={{ flex: 1, height: 1, background: C_BORDER }}/>
      </div>
      <CThread accent={C_TEAL} name="Balanced v2.1" preview="Just won a 4-bet pot vs Phil_AI" time="2m" status="live" pnl="+$340" unread="2"/>
      <CThread accent={C_PURPLE} name="Aggressive v1.3" preview="3-bet QQ in HU vs Phil_AI" time="14m" status="live" pnl="+$120"/>
      <CThread accent={C_GOLD} name="Bluff Master" preview="Session ended · ROI 18.4%" time="1h" status="idle" pnl="+$210"/>
      <CThread accent={C_PINK} name="Value Bot" preview="Sitting out · waiting" time="3h" status="idle" pnl="-$45"/>
    </div>
    <div style={{ padding: '10px 12px', borderTop: `1px solid ${C_BORDER}` }}>
      <button style={{ width: '100%', height: 32, borderRadius: 6, background: C_TEAL, border: 'none', color: '#0a0a0a', fontFamily: C_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: `0 0 12px ${C_TEAL}55` }}>
        <Icon name="plus" size={12} color="#0a0a0a" strokeWidth={2.4}/>DRAFT AGENT
      </button>
    </div>
  </div>
);

// ─────────────── Game preview tile (lives INSIDE chat messages) ───────────────

const GameTile = ({ agent, accent, table, blinds, pot, equity, action, board, hero, oppName, oppStack, thought, phase, size = 'normal' }) => {
  const isWide = size === 'wide';   // when only 1 live game, tile is wider
  const tileH = isWide ? 280 : 240;
  const cardW = isWide ? 32 : 26;
  const cardH = isWide ? 44 : 36;
  return (
    <div style={{
      background: C_SURFACE, border: `1px solid ${accent}55`,
      borderRadius: 10, overflow: 'hidden',
      boxShadow: `0 0 14px ${accent}11`,
      cursor: 'pointer', transition: 'border-color 0.15s',
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* tile header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderBottom: `1px solid ${C_BORDER}`, background: 'rgba(0,0,0,0.3)' }}>
        <CHood size={22} accent={accent}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent}</span>
            <CDot pulse size={5}/>
          </div>
          <div style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED, marginTop: 1, letterSpacing: '0.04em' }}>{table} · {blinds}</div>
        </div>
        <span style={{ fontFamily: C_MONO, fontSize: 8, fontWeight: 700, color: C_TEAL, letterSpacing: '0.1em', padding: '2px 5px', background: C_TEAL_DIM, borderRadius: 3 }}>LIVE</span>
      </div>

      {/* mini felt */}
      <div style={{ flex: 1, position: 'relative', minHeight: tileH - 90, background: 'radial-gradient(ellipse at center, #122520 0%, #0a1612 70%, #07100c 100%)' }}>
        {/* table oval */}
        <div style={{
          position: 'absolute', inset: '14% 12%', borderRadius: '50%',
          background: `radial-gradient(ellipse at center, #1a3530 0%, #0e1a17 70%, #0a1612 100%)`,
          border: `1.5px solid #0a0604`,
          boxShadow: `inset 0 0 18px rgba(0,0,0,0.6), 0 0 0 4px #1a0f06, 0 0 0 5px rgba(0,0,0,0.5)`,
        }}>
          <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: `1px solid ${accent}22` }}/>
        </div>

        {/* opponent (top) */}
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 2,
        }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#0a0a0c', border: `1.5px solid rgba(255,255,255,0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: C_TEXT }}>
            {oppName.slice(0,2).toUpperCase()}
          </div>
          <div style={{ display: 'flex', gap: 1.5 }}>
            <CardBack w={14} h={20}/>
            <CardBack w={14} h={20}/>
          </div>
          <div style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(0,0,0,0.7)', fontFamily: C_MONO, fontSize: 9, color: C_TEXT, whiteSpace: 'nowrap' }}>{oppName} · ${oppStack}</div>
        </div>

        {/* center pot + board */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 9px', borderRadius: 12, background: 'rgba(0,0,0,0.6)', border: `1px solid ${C_BORDER}` }}>
            <span style={{ fontFamily: C_MONO, fontSize: 8, color: C_MUTED, letterSpacing: '0.16em' }}>POT</span>
            <span style={{ fontFamily: C_MONO, fontSize: 13, fontWeight: 700, color: C_TEXT }}>${pot}</span>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {board.map((c, i) => (
              c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={cardW} h={cardH}/>
                : <CardBack key={i} w={cardW} h={cardH} branded/>
            ))}
          </div>
        </div>

        {/* hero (bottom) */}
        <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 3 }}>
          <div style={{ display: 'flex', gap: 2 }}>
            <PlayingCard rank={hero.cards[0][0]} suit={hero.cards[0][1]} w={cardW + 2} h={cardH + 4}/>
            <PlayingCard rank={hero.cards[1][0]} suit={hero.cards[1][1]} w={cardW + 2} h={cardH + 4}/>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px 2px 3px', borderRadius: 14, background: 'rgba(0,0,0,0.7)', border: `1px solid ${accent}` }}>
            <CHood size={18} accent={accent}/>
            <span style={{ fontFamily: C_MONO, fontSize: 10, fontWeight: 700, color: accent }}>{equity}%</span>
            <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED }}>${hero.stack}</span>
          </div>
        </div>
      </div>

      {/* footer: action + thought + chat */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', borderTop: `1px solid ${C_BORDER}`, background: '#0a0a0c' }}>
        <span style={{ padding: '3px 8px', borderRadius: 4, background: accent, color: '#0a0a0a', fontFamily: C_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', flexShrink: 0 }}>{action}</span>
        <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_DIM, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic' }}>"{thought}"</span>
        <button style={{ height: 22, padding: '0 8px', borderRadius: 4, background: 'transparent', border: `1px solid ${C_BORDER_STRONG}`, color: C_DIM, fontFamily: C_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', flexShrink: 0 }}>WATCH →</button>
      </div>
    </div>
  );
};

// Header for the conversation
const CConvHeader = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px', borderBottom: `1px solid ${C_BORDER}`, background: C_PANEL }}>
    <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${C_TEAL}33, ${C_TEAL}11)`, border: `1px solid ${C_TEAL}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="18" height="22" viewBox="0 0 22 26">
        <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z" fill="none" stroke={C_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', minWidth: 0 }}>
        <span style={{ fontFamily: C_SERIF, fontSize: 19, fontWeight: 600, color: C_TEXT, whiteSpace: 'nowrap' }}>Command Center</span>
        <span style={{ fontFamily: C_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: C_TEAL, padding: '3px 7px', background: C_TEAL_DIM, border: `1px solid ${C_TEAL}44`, borderRadius: 3 }}>SYSTEM</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
        <CDot pulse size={5}/>
        <span style={{ fontSize: 11, color: C_DIM }}>2 agents reporting live · all systems green</span>
      </div>
    </div>
    <button style={{ height: 30, padding: '0 12px', borderRadius: 6, background: 'transparent', border: `1px solid ${C_BORDER_STRONG}`, color: C_DIM, fontFamily: C_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon name="history" size={12} color={C_DIM}/>HISTORY
    </button>
    <button style={{ height: 30, padding: '0 12px', borderRadius: 6, background: C_TEAL, border: 'none', color: '#0a0a0a', fontFamily: C_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: `0 0 12px ${C_TEAL}55` }}>
      <Icon name="plus" size={12} color="#0a0a0a" strokeWidth={2.4}/>BUILD AGENT
    </button>
  </div>
);

// Message wrapper
const CMsgMeta = ({ time, source }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
    <span style={{ fontFamily: C_MONO, fontSize: 10, color: C_MUTED, fontWeight: 600 }}>{time}</span>
    <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_FAINT }}>·</span>
    <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED, letterSpacing: '0.12em' }}>{source}</span>
  </div>
);

const CSysMsg = ({ time, source, children }) => (
  <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
    <div style={{ flexShrink: 0, paddingTop: 2 }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: C_TEAL_DIM, border: `1px solid ${C_TEAL}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="13" height="15" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z" fill="none" stroke={C_TEAL} strokeWidth="2" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <CMsgMeta time={time} source={source}/>
      {children}
    </div>
  </div>
);

const CUserMsg = ({ time, children }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
    <div style={{ maxWidth: 540 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', marginBottom: 4 }}>
        <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED, letterSpacing: '0.12em' }}>YOU</span>
        <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_FAINT }}>·</span>
        <span style={{ fontFamily: C_MONO, fontSize: 10, color: C_MUTED }}>{time}</span>
      </div>
      <div style={{ background: C_TEAL_DIM, border: `1px solid ${C_TEAL}33`, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: C_TEXT, lineHeight: 1.5 }}>{children}</div>
    </div>
  </div>
);

// Live-games message (the centerpiece): preview tiles inside a system message
const LiveGamesBlock = () => {
  const games = [
    {
      agent: 'Balanced v2.1', accent: C_TEAL,
      table: 'NLH 6-Max', blinds: '$5/$10', pot: 480,
      equity: 87.4, action: 'BET $240',
      board: [['K','d'],['9','s'],['2','c'],['A','h'],null],
      hero: { stack: 1847, cards: [['A','s'],['K','h']] },
      oppName: 'Phil_AI', oppStack: 2104,
      thought: 'Top two on a wet board, villain checked turn — going for value',
    },
    {
      agent: 'Aggressive v1.3', accent: C_PURPLE,
      table: 'HU NLH', blinds: '$10/$20', pot: 240,
      equity: 62.1, action: '3-BET $60',
      board: [],
      hero: { stack: 2104, cards: [['Q','s'],['Q','d']] },
      oppName: 'Phil_AI', oppStack: 1847,
      thought: 'QQ vs button min-open. Squeeze for value, Phil opens 78%',
    },
  ];
  return (
    <div style={{ background: C_SURFACE, border: `1px solid ${C_TEAL}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C_BORDER}`, background: 'rgba(0,212,170,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CDot pulse size={6}/>
          <CLabel color={C_TEAL}>2 AGENTS LIVE · UPDATED 2s AGO</CLabel>
        </div>
        <span style={{ fontFamily: C_MONO, fontSize: 10, color: C_TEAL, fontWeight: 600, cursor: 'pointer' }}>OPEN ALL ↗</span>
      </div>
      <div style={{ padding: 12, display: 'flex', gap: 10 }}>
        {games.map((g, i) => <GameTile key={i} {...g}/>)}
      </div>
    </div>
  );
};

// Daily Standup — balanced. Header + intro line + KPI strip + suggested actions.
const StandupBlock = () => (
  <div style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
    {/* Header strip */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${C_BORDER}` }}>
      <CLabel>DAILY STANDUP · MAY 6</CLabel>
      <span style={{ fontFamily: C_MONO, fontSize: 10, color: C_MUTED }}>09:41 EST</span>
    </div>

    {/* Intro line — plain morning + quiet italic clause for voice */}
    <div style={{ padding: '14px 16px', fontSize: 13.5, color: C_TEXT, lineHeight: 1.6 }}>
      Good morning, jmorr. <span style={{ fontStyle: 'italic', color: C_DIM }}>Quiet night — three of four ended up.</span> Your roster netted <span style={{ color: C_TEAL, fontWeight: 600 }}>+$340</span> across <span style={{ color: C_TEXT, fontWeight: 600 }}>184 hands</span>. Two agents still live, two resting. <span style={{ color: C_GOLD }}>Four hands flagged</span> for review.
    </div>

    {/* KPI strip — slightly tighter than before */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: C_BORDER, margin: '0 1px 1px', borderTop: `1px solid ${C_BORDER}` }}>
      {[
        { label: 'NET 24H', value: '+$340', color: C_TEAL, sub: '▲ 14.5%' },
        { label: 'HANDS', value: '184', color: C_TEXT, sub: '12 sessions' },
        { label: 'WIN RATE', value: '58.7%', color: C_TEAL, sub: 'BB/100: 8.2' },
        { label: 'BIGGEST POT', value: '$847', color: C_GOLD, sub: 'Balanced v2.1' },
      ].map((s, i) => (
        <div key={i} style={{ background: C_PANEL, padding: '10px 13px' }}>
          <div style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED, letterSpacing: '0.14em', marginBottom: 4 }}>{s.label}</div>
          <CNum color={s.color} size={16} weight={700}>{s.value}</CNum>
          <div style={{ fontFamily: C_MONO, fontSize: 9, color: C_DIM, marginTop: 2 }}>{s.sub}</div>
        </div>
      ))}
    </div>

    {/* Suggested actions */}
    <div style={{ padding: '11px 14px', borderTop: `1px solid ${C_BORDER}`, background: 'rgba(0,212,170,0.03)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <CLabel color={C_TEAL}>SUGGESTED →</CLabel>
      {['Review flagged hands', 'Tune Aggressive v1.3', 'Deploy Bluff Master', 'Build new agent'].map((a, i) => (
        <button key={i} style={{
          height: 26, padding: '0 10px', borderRadius: 5,
          background: i === 0 ? C_TEAL : 'transparent',
          border: i === 0 ? 'none' : `1px solid ${C_BORDER_STRONG}`,
          color: i === 0 ? '#0a0a0a' : C_DIM,
          fontFamily: 'Inter', fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>{a}</button>
      ))}
    </div>
  </div>
);

// Flagged hands block (compact list)
const FlaggedBlock = () => (
  <div style={{ background: C_SURFACE, border: `1px solid ${C_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${C_BORDER}` }}>
      <CLabel color={C_GOLD}>FLAGGED HANDS · 4 NEED REVIEW</CLabel>
      <span style={{ fontFamily: C_MONO, fontSize: 10, color: C_TEAL, fontWeight: 600, cursor: 'pointer' }}>VIEW ALL ↗</span>
    </div>
    <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {[
        { agent: 'Balanced v2.1', accent: C_TEAL, action: 'Folded TT to 3-bet', stake: '$5/$10', loss: '−$80 EV', cards: [['T','s'],['T','d']] },
        { agent: 'Aggressive v1.3', accent: C_PURPLE, action: 'Bluff-jammed river', stake: '$10/$20', loss: '−$340', cards: [['7','c'],['6','c']] },
        { agent: 'Bluff Master', accent: C_GOLD, action: 'Called 4-bet w/ AJo', stake: '$5/$10', loss: '−$120', cards: [['A','h'],['J','s']] },
      ].map((h, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', background: C_SURFACE_2, borderRadius: 6, border: `1px solid ${C_BORDER}`, cursor: 'pointer' }}>
          <CHood size={20} accent={h.accent}/>
          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            <MiniCard rank={h.cards[0][0]} suit={h.cards[0][1]}/>
            <MiniCard rank={h.cards[1][0]} suit={h.cards[1][1]}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: C_TEXT, fontWeight: 500 }}>{h.action}</div>
            <div style={{ fontFamily: C_MONO, fontSize: 10, color: C_MUTED, marginTop: 1 }}>{h.agent} · {h.stake}</div>
          </div>
          <CNum color={C_RED} size={11}>{h.loss}</CNum>
          <Icon name="chevron-right" size={14} color={C_MUTED}/>
        </div>
      ))}
    </div>
  </div>
);

// Conversation
const CConv = () => (
  <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 12px' }}>
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: C_BORDER }}/>
        <span style={{ fontFamily: C_MONO, fontSize: 10, color: C_MUTED, letterSpacing: '0.16em' }}>WED · MAY 6, 2026</span>
        <div style={{ flex: 1, height: 1, background: C_BORDER }}/>
      </div>

      <CSysMsg time="09:41:24" source="LIVE">
        <LiveGamesBlock/>
      </CSysMsg>

      <CSysMsg time="09:41:22" source="THE OVERNIGHT">
        <StandupBlock/>
      </CSysMsg>

      <CUserMsg time="09:42:08">
        Show me the 4 flagged hands
      </CUserMsg>

      <CSysMsg time="09:42:09" source="REVIEW">
        <FlaggedBlock/>
      </CSysMsg>

      <CSysMsg time="09:43:14" source="ALERT">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(205,179,128,0.08)', border: `1px solid ${C_GOLD}33`, borderRadius: 8 }}>
          <Icon name="sparkle" size={16} color={C_GOLD}/>
          <div style={{ flex: 1, fontSize: 12.5, color: C_TEXT }}>
            <span style={{ color: C_GOLD, fontWeight: 600 }}>Bluff Master</span> just hit <span style={{ color: C_TEAL, fontWeight: 600 }}>1,000 hands</span> with positive ROI. Promoted to <span style={{ color: C_GOLD, fontWeight: 600 }}>TIER 2</span>.
          </div>
          <span style={{ fontFamily: C_MONO, fontSize: 10, color: C_MUTED }}>+150 XP</span>
        </div>
      </CSysMsg>
    </div>
  </div>
);

// Composer
const CComposer = () => (
  <div style={{ padding: '12px 22px 16px', borderTop: `1px solid ${C_BORDER}`, background: C_PANEL }}>
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {[
          { cmd: '/deploy', desc: 'send agent to a table' },
          { cmd: '/build', desc: 'create new agent' },
          { cmd: '/replay', desc: 'pull a hand' },
          { cmd: '/analyze', desc: 'review last session' },
          { cmd: '/sit-out', desc: 'pause an agent' },
        ].map((c, i) => (
          <button key={i} style={{ height: 24, padding: '0 8px', borderRadius: 4, background: C_SURFACE, border: `1px solid ${C_BORDER}`, fontFamily: C_MONO, fontSize: 10, fontWeight: 600, color: C_DIM, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C_TEAL }}>{c.cmd}</span>
            <span style={{ color: C_MUTED, fontFamily: 'Inter', fontSize: 10, fontWeight: 500 }}>{c.desc}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: C_SURFACE, border: `1px solid ${C_BORDER_STRONG}`, borderRadius: 10, padding: '10px 12px' }}>
        <Icon name="sparkle" size={16} color={C_TEAL}/>
        <textarea
          defaultValue="Tighten Aggressive v1.3's 3-bet range from late position. Avoid bluff jams on monotone boards."
          rows={2}
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: C_TEXT, fontSize: 13.5, fontFamily: 'Inter', resize: 'none', lineHeight: 1.5 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 2 }}>
          <span style={{ fontFamily: C_MONO, fontSize: 9, color: C_MUTED, padding: '2px 5px', border: `1px solid ${C_BORDER}`, borderRadius: 3 }}>⌘↵</span>
          <button style={{ width: 32, height: 32, borderRadius: 6, background: C_TEAL, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 0 10px ${C_TEAL}55` }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontFamily: C_MONO, fontSize: 10, color: C_MUTED }}>
        <span>Synced with Telegram</span><CDot pulse size={5}/>
        <div style={{ flex: 1 }}/>
        <span>⌘K commands · ⌘↵ send</span>
      </div>
    </div>
  </div>
);

const DesktopCommandScreen = () => (
  <div data-screen-label="15 Desktop Command Center" style={{
    width: 1440, height: 900, background: C_BG, color: C_TEXT,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif', overflow: 'hidden',
  }}>
    <CTop/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <CRail/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: C_BG }}>
        <CConvHeader/>
        <CConv/>
        <CComposer/>
      </div>
    </div>
  </div>
);

Object.assign(window, { DesktopCommandScreen });
