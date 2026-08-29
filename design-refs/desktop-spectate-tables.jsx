// Desktop Spectate — main dashboard = live game viewports, not chat.
// 1 active agent → fills most of canvas. 2 → split. 3-4 → grid.
// Click any game → focused spectate w/ chat-with-agent drawer.

const S_BG = '#070708';
const S_PANEL = '#0d0d0f';
const S_FELT = '#0e1a17';
const S_FELT_2 = '#0a1612';
const S_SURFACE = '#131316';
const S_SURFACE_2 = '#1a1a1f';
const S_BORDER = 'rgba(255,255,255,0.06)';
const S_BORDER_STRONG = 'rgba(255,255,255,0.10)';
const S_TEXT = '#EDEDED';
const S_DIM = '#A1A1A1';
const S_MUTED = '#6B6B6B';
const S_FAINT = '#3a3a3f';
const S_TEAL = '#00D4AA';
const S_TEAL_DIM = 'rgba(0,212,170,0.10)';
const S_GOLD = '#CDB380';
const S_PURPLE = '#9B7BFF';
const S_PINK = '#FF7A8E';
const S_RED = '#FF4D4F';
const S_MONO = '"JetBrains Mono", "SF Mono", ui-monospace, monospace';

// ── Hooded avatar ──
const SHood = ({ size = 32, accent = S_TEAL, dim = false }) => (
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

// ── Top bar ──
const STop = () => {
  const [, setT] = React.useState(0);
  React.useEffect(() => { const id = setInterval(() => setT(t => t+1), 1000); return () => clearInterval(id); }, []);
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  return (
    <div style={{
      height: 38, display: 'flex', alignItems: 'center',
      borderBottom: `1px solid ${S_BORDER}`, background: S_PANEL,
      padding: '0 20px', gap: 22, fontFamily: S_MONO, fontSize: 11,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <svg width="18" height="20" viewBox="0 0 22 26">
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke={S_TEAL} strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={S_TEAL} strokeWidth="1.4" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: '0.18em', color: S_TEXT }}>AGENTIC POKER</span>
      </div>
      <span style={{ color: S_FAINT }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: S_TEAL, boxShadow: `0 0 6px ${S_TEAL}`, animation: 'pulse 2s infinite' }}/>
        <span style={{ color: S_DIM }}>2 LIVE</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: S_DIM }}>P&L 24H</span>
        <span style={{ color: S_TEAL, fontWeight: 600 }}>+$340.00</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: S_DIM }}>BANKROLL</span>
        <span style={{ color: S_TEXT, fontWeight: 600 }}>$2,340.50</span>
      </div>
      <div style={{ flex: 1 }}/>
      <span style={{ color: S_MUTED, fontSize: 10 }}>NYC</span>
      <span style={{ color: S_TEXT }}>{time}</span>
      <span style={{ color: S_FAINT }}>·</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24, padding: '0 10px', background: S_SURFACE, borderRadius: 4, border: `1px solid ${S_BORDER}` }}>
        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)', color: '#0a0a0a', fontWeight: 700, fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JM</div>
        <span style={{ fontFamily: 'Inter', fontSize: 11, color: S_TEXT, fontWeight: 500 }}>jmorr</span>
        <span style={{ fontSize: 9, color: S_GOLD, letterSpacing: '0.08em' }}>TIER 3</span>
      </div>
    </div>
  );
};

// ── Left rail (slim, just nav + roster) ──
const SNav = ({ icon, label, badge, active }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
    background: active ? S_TEAL_DIM : 'transparent',
    color: active ? S_TEAL : S_DIM,
    fontSize: 12, fontWeight: 500, position: 'relative',
  }}>
    {active && <div style={{ position: 'absolute', left: -10, top: 6, bottom: 6, width: 2, background: S_TEAL, borderRadius: 1 }}/>}
    <Icon name={icon} size={15} color={active ? S_TEAL : S_DIM} strokeWidth={1.7}/>
    <span style={{ flex: 1 }}>{label}</span>
    {badge && (
      <span style={{
        height: 16, padding: '0 5px', borderRadius: 4,
        fontFamily: S_MONO, fontSize: 9, fontWeight: 700,
        color: active ? S_TEAL : S_MUTED,
        border: active ? `1px solid ${S_TEAL}55` : `1px solid ${S_BORDER}`,
        display: 'inline-flex', alignItems: 'center',
      }}>{badge}</span>
    )}
  </div>
);

const RosterRow = ({ name, accent, status, pnl, table }) => (
  <div style={{
    display: 'flex', gap: 10, padding: '10px 12px',
    cursor: 'pointer', borderRadius: 6,
    background: status === 'live' ? 'rgba(0,212,170,0.04)' : 'transparent',
  }}>
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <SHood size={32} accent={accent} dim={status === 'idle'}/>
      {status === 'live' && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 9, height: 9, borderRadius: '50%',
          background: S_TEAL, border: `2px solid ${S_PANEL}`,
          boxShadow: `0 0 5px ${S_TEAL}`, animation: 'pulse 2s infinite',
        }}/>
      )}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: S_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <span style={{ fontFamily: S_MONO, fontSize: 10, fontWeight: 600, color: pnl.startsWith('-') ? S_RED : S_TEAL }}>{pnl}</span>
      </div>
      <div style={{ fontFamily: S_MONO, fontSize: 10, color: S_MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {status === 'live' ? table : 'Idle · last played 2h ago'}
      </div>
    </div>
  </div>
);

const SRail = () => (
  <div style={{
    width: 240, flexShrink: 0,
    background: S_PANEL, borderRight: `1px solid ${S_BORDER}`,
    display: 'flex', flexDirection: 'column',
  }}>
    <div style={{ padding: '14px 12px 4px' }}>
      <span style={{ fontFamily: S_MONO, fontSize: 9, fontWeight: 600, color: S_MUTED, letterSpacing: '0.16em', padding: '0 4px' }}>NAVIGATE</span>
      <div style={{ height: 8 }}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SNav icon="home" label="Spectate" active/>
        <SNav icon="agent" label="Agents" badge="4"/>
        <SNav icon="spade" label="Tables"/>
        <SNav icon="history" label="Replays"/>
        <SNav icon="trophy" label="Leaderboard"/>
        <SNav icon="profile" label="Account"/>
      </div>
    </div>

    <div style={{ height: 14 }}/>

    <div style={{ padding: '0 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontFamily: S_MONO, fontSize: 9, fontWeight: 600, color: S_MUTED, letterSpacing: '0.16em' }}>ROSTER</span>
      <span style={{ fontFamily: S_MONO, fontSize: 9, color: S_MUTED }}>4/4</span>
    </div>

    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
      <RosterRow name="Balanced v2.1" accent={S_TEAL} status="live" pnl="+$340" table="$5/$10 NLH 6m · #48291"/>
      <RosterRow name="Aggressive v1.3" accent={S_PURPLE} status="live" pnl="+$120" table="$10/$20 HU · #38104"/>
      <RosterRow name="Bluff Master" accent={S_GOLD} status="idle" pnl="+$210"/>
      <RosterRow name="Value Bot" accent={S_PINK} status="idle" pnl="-$45"/>
    </div>

    <div style={{ padding: '10px 12px', borderTop: `1px solid ${S_BORDER}` }}>
      <button style={{
        width: '100%', height: 34, borderRadius: 6,
        background: S_TEAL, border: 'none',
        color: '#0a0a0a', fontFamily: S_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        boxShadow: `0 0 12px ${S_TEAL}55`,
      }}>
        <Icon name="plus" size={12} color="#0a0a0a" strokeWidth={2.4}/>
        DRAFT AGENT
      </button>
    </div>

    <div style={{
      borderTop: `1px solid ${S_BORDER}`, padding: '10px 12px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#0a0a0a', fontWeight: 700, fontSize: 11, flexShrink: 0,
      }}>JM</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: S_TEXT }}>jmorr</div>
        <div style={{ fontFamily: S_MONO, fontSize: 10, color: S_MUTED }}>$2,340.50</div>
      </div>
      <Icon name="settings" size={14} color={S_MUTED}/>
    </div>
  </div>
);

// ── Poker table SVG (the centerpiece) ──
const PokerFelt = ({ width, height, agentName, agentAccent, hero, board, pot, blinds, hand, equity, action, opponents }) => {
  // Oval table sized to container
  const w = width, h = height;
  const cx = w / 2, cy = h / 2;
  const tw = w * 0.78, th = h * 0.62;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`felt-${agentName}`} cx="50%" cy="48%" r="55%">
          <stop offset="0" stopColor="#16302a"/>
          <stop offset="0.7" stopColor={S_FELT}/>
          <stop offset="1" stopColor={S_FELT_2}/>
        </radialGradient>
        <linearGradient id={`rim-${agentName}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1f1208"/>
          <stop offset="1" stopColor="#0a0604"/>
        </linearGradient>
      </defs>
      {/* table rim */}
      <ellipse cx={cx} cy={cy} rx={tw/2 + 14} ry={th/2 + 14} fill={`url(#rim-${agentName})`} stroke="rgba(0,0,0,0.6)" strokeWidth="1"/>
      {/* felt */}
      <ellipse cx={cx} cy={cy} rx={tw/2} ry={th/2} fill={`url(#felt-${agentName})`} stroke={`${agentAccent}33`} strokeWidth="1.5"/>
      {/* inner ring */}
      <ellipse cx={cx} cy={cy} rx={tw/2 - 18} ry={th/2 - 18} fill="none" stroke={`${agentAccent}1a`} strokeWidth="0.8"/>

      {/* logo watermark */}
      <text x={cx} y={cy - th/2 + 38} textAnchor="middle" fontFamily="Inter" fontWeight="800" fontSize="11" letterSpacing="3" fill={`${agentAccent}55`}>AGENTIC · POKER</text>

      {/* pot */}
      <text x={cx} y={cy - 28} textAnchor="middle" fontFamily={S_MONO} fontSize="10" fontWeight="600" letterSpacing="2" fill={S_MUTED}>POT</text>
      <text x={cx} y={cy - 6} textAnchor="middle" fontFamily={S_MONO} fontSize="22" fontWeight="700" fill={S_TEXT}>${pot}</text>
    </svg>
  );
};

// chip stack svg
const ChipStack = ({ amount, color = S_TEAL, size = 22 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <svg width={size} height={size} viewBox="0 0 24 24">
      <ellipse cx="12" cy="14" rx="9" ry="3" fill="#0a0604"/>
      <ellipse cx="12" cy="12" rx="9" ry="3" fill={color}/>
      <ellipse cx="12" cy="10" rx="9" ry="3" fill={color}/>
      <ellipse cx="12" cy="8" rx="9" ry="3" fill="#0a0604"/>
      <ellipse cx="12" cy="8" rx="9" ry="3" fill="none" stroke={color} strokeWidth="0.6"/>
      <ellipse cx="12" cy="8" rx="5" ry="1.6" fill="rgba(255,255,255,0.15)"/>
    </svg>
    <span style={{ fontFamily: S_MONO, fontSize: 11, fontWeight: 600, color: S_TEXT }}>${amount}</span>
  </div>
);

// Seat (opponent) — positioned around the table
const Seat = ({ name, stack, action, cards, folded, sb, bb, dealer }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    opacity: folded ? 0.4 : 1, position: 'relative',
  }}>
    <div style={{
      width: 56, height: 56, borderRadius: '50%',
      background: '#0a0a0c',
      border: `2px solid ${action ? S_TEAL : 'rgba(255,255,255,0.12)'}`,
      boxShadow: action ? `0 0 14px ${S_TEAL}55` : 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <div style={{
        fontFamily: 'Inter', fontWeight: 700, fontSize: 16, color: S_TEXT,
      }}>{name.slice(0,2).toUpperCase()}</div>
      {dealer && (
        <div style={{
          position: 'absolute', top: -4, right: -4,
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff', color: '#0a0a0a',
          fontFamily: S_MONO, fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(0,0,0,0.4)',
        }}>D</div>
      )}
      {(sb || bb) && (
        <div style={{
          position: 'absolute', top: -4, left: -4,
          height: 16, padding: '0 5px', borderRadius: 8,
          background: sb ? S_GOLD : S_TEAL, color: '#0a0a0a',
          fontFamily: S_MONO, fontSize: 9, fontWeight: 700,
          display: 'flex', alignItems: 'center',
        }}>{sb ? 'SB' : 'BB'}</div>
      )}
    </div>
    {cards && !folded && (
      <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
        <CardBack w={20} h={28}/>
        <CardBack w={20} h={28}/>
      </div>
    )}
    <div style={{
      padding: '3px 8px', borderRadius: 4,
      background: 'rgba(0,0,0,0.6)', border: `1px solid ${S_BORDER}`,
      fontFamily: S_MONO, fontSize: 10, fontWeight: 600, color: S_TEXT,
      whiteSpace: 'nowrap',
    }}>{name} · ${stack}</div>
    {action && (
      <div style={{
        marginTop: 2,
        padding: '2px 8px', borderRadius: 4,
        background: S_TEAL, color: '#0a0a0a',
        fontFamily: S_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
      }}>{action}</div>
    )}
  </div>
);

// Hero seat (your agent) — bottom center, larger
const HeroSeat = ({ name, accent, stack, cards, equity, action }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <PlayingCard rank={cards[0][0]} suit={cards[0][1]} w={42} h={58}/>
        <PlayingCard rank={cards[1][0]} suit={cards[1][1]} w={42} h={58}/>
      </div>
    </div>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '5px 12px 5px 5px', borderRadius: 24,
      background: 'rgba(0,0,0,0.7)', border: `1.5px solid ${accent}`,
      boxShadow: `0 0 14px ${accent}55`,
    }}>
      <SHood size={32} accent={accent}/>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: S_TEXT, lineHeight: 1.1 }}>{name}</div>
        <div style={{ fontFamily: S_MONO, fontSize: 10, color: S_DIM }}>${stack} stack</div>
      </div>
      <div style={{ width: 1, height: 22, background: S_BORDER }}/>
      <div>
        <div style={{ fontFamily: S_MONO, fontSize: 9, color: S_MUTED, letterSpacing: '0.1em' }}>EQUITY</div>
        <div style={{ fontFamily: S_MONO, fontSize: 14, fontWeight: 700, color: accent }}>{equity}%</div>
      </div>
    </div>
    {action && (
      <div style={{
        padding: '4px 12px', borderRadius: 4,
        background: accent, color: '#0a0a0a',
        fontFamily: S_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        boxShadow: `0 0 12px ${accent}66`,
      }}>{action}</div>
    )}
  </div>
);

// ── Game Viewport (the live spectate window for one agent) ──
const GameViewport = ({ size, agent, accent, table, blinds, pot, hand, equity, action, board, hero, opponents, thought, onChat }) => {
  const isLarge = size === 'large';
  const isHalf = size === 'half';
  const isQuarter = size === 'quarter';
  return (
    <div style={{
      flex: 1, minWidth: 0, minHeight: 0,
      background: '#0a0a0c',
      border: `1px solid ${accent}33`,
      borderRadius: 10, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      boxShadow: `0 0 24px ${accent}11 inset`,
    }}>
      {/* viewport header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: isQuarter ? '8px 10px' : '10px 14px',
        borderBottom: `1px solid ${S_BORDER}`,
        background: S_PANEL,
      }}>
        <SHood size={isQuarter ? 24 : 28} accent={accent}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: isQuarter ? 12 : 13.5, fontWeight: 700, color: S_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent}</span>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: S_TEAL, boxShadow: `0 0 5px ${S_TEAL}`, animation: 'pulse 2s infinite' }}/>
            <span style={{ fontFamily: S_MONO, fontSize: 9, fontWeight: 700, color: S_TEAL, letterSpacing: '0.1em' }}>LIVE</span>
          </div>
          <div style={{ fontFamily: S_MONO, fontSize: 10, color: S_MUTED, marginTop: 1 }}>{table} · {blinds} · #{hand}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={onChat} style={{
            height: 26, padding: '0 10px', borderRadius: 5,
            background: 'transparent', border: `1px solid ${S_BORDER_STRONG}`,
            color: S_DIM, fontFamily: S_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            CHAT
          </button>
          {!isQuarter && (
            <button style={{
              height: 26, width: 26, borderRadius: 5,
              background: 'transparent', border: `1px solid ${S_BORDER_STRONG}`,
              color: S_MUTED, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Felt table */}
      <div style={{ flex: 1, position: 'relative', background: 'radial-gradient(ellipse at center, #0e1a17 0%, #050a08 100%)', overflow: 'hidden' }}>
        {/* table oval */}
        <div style={{
          position: 'absolute', inset: isLarge ? '12% 14%' : isHalf ? '10% 10%' : '8% 8%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse at center, #1a3530 0%, ${S_FELT} 60%, ${S_FELT_2} 100%)`,
          border: `2px solid #0a0604`,
          boxShadow: `inset 0 0 30px rgba(0,0,0,0.6), 0 0 0 8px #1a0f06, 0 0 0 9px rgba(0,0,0,0.6)`,
        }}>
          {/* inner felt ring */}
          <div style={{
            position: 'absolute', inset: 14, borderRadius: '50%',
            border: `1px solid ${accent}22`,
          }}/>
          {/* watermark */}
          <div style={{
            position: 'absolute', top: '14%', left: 0, right: 0, textAlign: 'center',
            fontFamily: 'Inter', fontWeight: 800, fontSize: isLarge ? 12 : 10, letterSpacing: '0.3em',
            color: `${accent}44`,
          }}>AGENTIC · POKER</div>
        </div>

        {/* opponents around the table */}
        {opponents.map((o, i) => {
          const positions = isLarge
            ? [
                { top: '8%', left: '50%', tx: '-50%', ty: '0' },
                { top: '24%', right: '10%', tx: '0', ty: '0' },
                { bottom: '24%', right: '10%', tx: '0', ty: '0' },
                { bottom: '24%', left: '10%', tx: '0', ty: '0' },
                { top: '24%', left: '10%', tx: '0', ty: '0' },
              ]
            : isHalf
            ? [
                { top: '8%', left: '50%', tx: '-50%', ty: '0' },
                { top: '40%', right: '4%', tx: '0', ty: '-50%' },
                { top: '40%', left: '4%', tx: '0', ty: '-50%' },
              ]
            : [
                { top: '6%', left: '50%', tx: '-50%', ty: '0' },
                { top: '36%', right: '4%', tx: '0', ty: '-50%' },
                { top: '36%', left: '4%', tx: '0', ty: '-50%' },
              ];
          const pos = positions[i] || positions[0];
          return (
            <div key={i} style={{
              position: 'absolute',
              top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right,
              transform: `translate(${pos.tx}, ${pos.ty})`,
              zIndex: 2,
            }}>
              <div style={{ transform: isQuarter ? 'scale(0.7)' : isHalf ? 'scale(0.85)' : 'scale(1)' }}>
                <Seat {...o}/>
              </div>
            </div>
          );
        })}

        {/* center: pot + board */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          zIndex: 1,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '4px 14px', borderRadius: 20,
            background: 'rgba(0,0,0,0.6)',
            border: `1px solid ${S_BORDER}`,
          }}>
            <span style={{ fontFamily: S_MONO, fontSize: 9, color: S_MUTED, letterSpacing: '0.18em' }}>POT</span>
            <span style={{ fontFamily: S_MONO, fontSize: isQuarter ? 14 : isHalf ? 18 : 22, fontWeight: 700, color: S_TEXT, letterSpacing: '-0.01em' }}>${pot}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {board.map((c, i) => (
              c ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={isQuarter ? 28 : isHalf ? 36 : 44} h={isQuarter ? 40 : isHalf ? 50 : 62}/>
                : <CardBack key={i} w={isQuarter ? 28 : isHalf ? 36 : 44} h={isQuarter ? 40 : isHalf ? 50 : 62} branded/>
            ))}
          </div>
        </div>

        {/* hero (bottom center) */}
        <div style={{
          position: 'absolute', bottom: isLarge ? '6%' : '5%', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 3,
        }}>
          <div style={{ transform: isQuarter ? 'scale(0.78)' : isHalf ? 'scale(0.9)' : 'scale(1)' }}>
            <HeroSeat name={agent} accent={accent} stack={hero.stack} cards={hero.cards} equity={equity} action={action}/>
          </div>
        </div>

        {/* agent thought bubble top-right */}
        {thought && !isQuarter && (
          <div style={{
            position: 'absolute', top: 14, right: 14,
            maxWidth: isLarge ? 280 : 220,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            border: `1px solid ${accent}55`,
            borderRadius: 8, padding: '8px 10px',
            zIndex: 4,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Icon name="sparkle" size={11} color={accent}/>
              <span style={{ fontFamily: S_MONO, fontSize: 9, fontWeight: 700, color: accent, letterSpacing: '0.1em' }}>AGENT THINKING</span>
            </div>
            <div style={{ fontSize: 11.5, color: S_TEXT, lineHeight: 1.45, fontStyle: 'italic' }}>
              {thought}
            </div>
          </div>
        )}
      </div>

      {/* bottom action bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isQuarter ? '6px 10px' : '8px 14px',
        borderTop: `1px solid ${S_BORDER}`, background: S_PANEL,
        fontFamily: S_MONO, fontSize: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: S_MUTED }}>HAND</span>
          <span style={{ color: S_TEXT }}>{equity}% eq</span>
          <span style={{ color: S_FAINT }}>·</span>
          <span style={{ color: S_DIM }}>conf 92%</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: S_MUTED }}>SESSION</span>
          <span style={{ color: S_TEAL, fontWeight: 600 }}>+$340</span>
          <span style={{ color: S_FAINT }}>·</span>
          <span style={{ color: S_DIM }}>64 hands</span>
        </div>
      </div>
    </div>
  );
};

// ── Idle slot (for agents not playing) ──
const IdleSlot = ({ agent, accent, lastResult }) => (
  <div style={{
    flex: 1, minWidth: 0, minHeight: 0,
    background: S_SURFACE, border: `1px dashed ${S_BORDER_STRONG}`,
    borderRadius: 10,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 12, padding: 20, cursor: 'pointer',
  }}>
    <SHood size={48} accent={accent} dim/>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: S_TEXT }}>{agent}</div>
      <div style={{ fontFamily: S_MONO, fontSize: 10, color: S_MUTED, marginTop: 2 }}>IDLE · last {lastResult}</div>
    </div>
    <button style={{
      height: 28, padding: '0 14px', borderRadius: 5,
      background: 'transparent', border: `1px solid ${accent}`,
      color: accent, fontFamily: S_MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      cursor: 'pointer',
    }}>DEPLOY →</button>
  </div>
);

// ── Header strip above the viewports ──
const SHeader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 24px',
    borderBottom: `1px solid ${S_BORDER}`,
    background: S_PANEL,
  }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontSize: 22, fontWeight: 600, color: S_TEXT, letterSpacing: '-0.01em' }}>
          Spectate
        </span>
        <span style={{
          fontFamily: S_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
          color: S_TEAL, padding: '3px 7px',
          background: S_TEAL_DIM, border: `1px solid ${S_TEAL}44`, borderRadius: 3,
        }}>2 LIVE</span>
      </div>
      <div style={{ fontFamily: S_MONO, fontSize: 11, color: S_MUTED, marginTop: 4, letterSpacing: '0.04em' }}>
        Watch your agents play · click any table to focus + chat
      </div>
    </div>
    <div style={{ flex: 1 }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 6,
        background: 'transparent', border: `1px solid ${S_BORDER_STRONG}`,
        color: S_DIM, fontFamily: S_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="settings" size={12} color={S_DIM}/>
        LAYOUT
      </button>
      <button style={{
        height: 30, padding: '0 12px', borderRadius: 6,
        background: 'transparent', border: `1px solid ${S_BORDER_STRONG}`,
        color: S_DIM, fontFamily: S_MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Icon name="history" size={12} color={S_DIM}/>
        REPLAYS
      </button>
    </div>
  </div>
);

// ── The viewport grid (auto-arranges by # of live games) ──
const SpectateGrid = ({ games, idleAgents }) => {
  const liveCount = games.length;

  if (liveCount === 1) {
    // 1 live: takes most of the canvas, idle agents as small slots at bottom
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: 16, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <GameViewport size="large" {...games[0]}/>
        </div>
        {idleAgents.length > 0 && (
          <div style={{ height: 120, display: 'flex', gap: 12, flexShrink: 0 }}>
            {idleAgents.map((a, i) => <IdleSlot key={i} {...a}/>)}
          </div>
        )}
      </div>
    );
  }

  if (liveCount === 2) {
    // 2 live: split horizontally, idle as bottom strip
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: 16, minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
          <GameViewport size="half" {...games[0]}/>
          <GameViewport size="half" {...games[1]}/>
        </div>
        {idleAgents.length > 0 && (
          <div style={{ height: 110, display: 'flex', gap: 12, flexShrink: 0 }}>
            {idleAgents.map((a, i) => <IdleSlot key={i} {...a}/>)}
          </div>
        )}
      </div>
    );
  }

  // 3-4 live: 2x2 grid
  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 12, padding: 16, minHeight: 0 }}>
      {games.map((g, i) => <GameViewport key={i} size="quarter" {...g}/>)}
      {idleAgents.slice(0, 4 - liveCount).map((a, i) => <IdleSlot key={`i-${i}`} {...a}/>)}
    </div>
  );
};

// ── Main screen ──
const games = [
  {
    agent: 'Balanced v2.1', accent: S_TEAL,
    table: 'NLH 6-Max', blinds: '$5/$10', pot: 480, hand: 847, equity: 87.4,
    action: 'BET $240',
    board: [['K','d'],['9','s'],['2','c'],['A','h'], null],
    hero: { stack: 1847, cards: [['A','s'],['K','h']] },
    opponents: [
      { name: 'Phil_AI', stack: 2104, cards: true, action: 'CHECK', dealer: true },
      { name: 'doyle_v3', stack: 1290, cards: true, folded: true },
      { name: 'nash_eq', stack: 980, cards: true, folded: true, sb: true },
      { name: 'sarah.k', stack: 1560, cards: true, folded: true, bb: true },
      { name: 'lockdown', stack: 2200, cards: true, folded: true },
    ],
    thought: '"Villain checked turn → likely capped. Going for value with top two. Bet 50% pot to get called by KQ, KJ, sets."',
  },
  {
    agent: 'Aggressive v1.3', accent: S_PURPLE,
    table: 'HU NLH', blinds: '$10/$20', pot: 240, hand: 1142, equity: 62.1,
    action: '3-BET $60',
    board: [],
    hero: { stack: 2104, cards: [['Q','s'],['Q','d']] },
    opponents: [
      { name: 'Phil_AI', stack: 1847, cards: true, action: 'OPEN $30', dealer: true, sb: true },
    ],
    thought: '"QQ in BB facing a min-open from the button. Phil_AI opens 78% from BTN. Squeeze for value, target wider calling range."',
  },
];

const idleAgents = [
  { agent: 'Bluff Master', accent: S_GOLD, lastResult: '+$210 · 1h ago' },
  { agent: 'Value Bot', accent: S_PINK, lastResult: '−$45 · 3h ago' },
];

const DesktopSpectateScreen = () => (
  <div data-screen-label="14 Desktop Spectate" style={{
    width: 1440, height: 900, background: S_BG, color: S_TEXT,
    display: 'flex', flexDirection: 'column',
    fontFamily: 'Inter, -apple-system, system-ui, sans-serif',
    overflow: 'hidden',
  }}>
    <STop/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <SRail/>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <SHeader/>
        <SpectateGrid games={games} idleAgents={idleAgents}/>
      </div>
    </div>
  </div>
);

Object.assign(window, { DesktopSpectateScreen });
