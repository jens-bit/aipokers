// Home / Main Menu screen — designed to pull the user toward engagement

const Logo = ({ onClick }) => (
  <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: onClick ? 'pointer' : 'default' }}>
    <svg width="20" height="24" viewBox="0 0 22 26" style={{display:'block'}}>
      <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
        fill="none" stroke="#00D4AA" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke="#00D4AA" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
    </svg>
    <div style={{
      fontFamily: 'Inter', fontWeight: 700, fontSize: 12,
      letterSpacing: '0.16em', color: '#EDEDED', whiteSpace: 'nowrap',
    }}>AGENTIC POKER</div>
  </div>
);

const TopBar = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px 12px',
  }}>
    <Logo/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 34, padding: '0 6px 0 10px', borderRadius: 999,
        background: '#141414', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Icon name="chip" size={14} color="#00D4AA"/>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#EDEDED', fontVariantNumeric: 'tabular-nums' }}>2,340.50</span>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0, 212, 170, 0.15)',
          border: '1px solid rgba(0, 212, 170, 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#00D4AA', fontSize: 14, fontWeight: 600, lineHeight: 1, paddingBottom: 2,
        }}>+</div>
      </div>
      <button onClick={() => window.gotoCreate && window.gotoCreate()} style={{
        width: 34, height: 34, borderRadius: '50%',
        background: 'rgba(0, 212, 170, 0.10)', border: '1px solid rgba(0, 212, 170, 0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#00D4AA', cursor: 'pointer', padding: 0,
      }}>
        <Icon name="plus" size={16} color="#00D4AA" strokeWidth={2.2}/>
      </button>
      <button style={{
        width: 34, height: 34, borderRadius: '50%',
        background: '#141414', border: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#EDEDED', cursor: 'pointer', position: 'relative', padding: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M18 16v-5a6 6 0 0 0-12 0v5l-2 3h16l-2-3z"/>
          <path d="M10 21a2 2 0 0 0 4 0"/>
        </svg>
        <span style={{
          position: 'absolute', top: 6, right: 7,
          width: 7, height: 7, borderRadius: '50%',
          background: '#00D4AA', boxShadow: '0 0 6px rgba(0,212,170,0.7)',
        }}/>
      </button>
    </div>
  </div>
);

// Pulsing status pill, top right
const ActiveAgentsPill = () => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 16px 12px' }}>
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      height: 26, padding: '0 12px 0 10px', borderRadius: 999,
      background: 'rgba(0, 212, 170, 0.08)',
      border: '1px solid rgba(0, 212, 170, 0.25)',
      cursor: 'pointer',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: '#00D4AA', boxShadow: '0 0 6px rgba(0,212,170,0.7)',
        animation: 'pulse 2s infinite',
      }}/>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#00D4AA' }}>2 agents active now</span>
      <Icon name="chevron-right" size={11} color="#00D4AA" strokeWidth={2}/>
    </div>
  </div>
);

// HERO: a single dominant CTA — deploy an agent — with a secondary line
const Hero = () => (
  <div style={{
    margin: '0 16px 16px',
    background: 'linear-gradient(160deg, #112523 0%, #0d1815 50%, #0e1212 100%)',
    border: '1px solid rgba(0, 212, 170, 0.25)',
    borderRadius: 18,
    padding: '18px 18px 16px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* glow */}
    <div style={{
      position: 'absolute', top: -40, right: -40, width: 200, height: 200,
      background: 'radial-gradient(circle, rgba(0,212,170,0.18), transparent 65%)',
      pointerEvents: 'none',
    }}/>
    {/* hooded silhouette behind text, large */}
    <div style={{
      position: 'absolute', right: -10, top: -10, opacity: 0.55,
      pointerEvents: 'none',
    }}>
      <svg width="170" height="200" viewBox="0 0 170 200">
        <defs>
          <linearGradient id="heroHood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1a3a3a" stopOpacity="0.9"/>
            <stop offset="1" stopColor="#0a1518" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d="M85 10 C50 10 30 35 30 70 L30 200 L140 200 L140 70 C140 35 120 10 85 10 Z"
          fill="url(#heroHood)"/>
        <ellipse cx="85" cy="80" rx="28" ry="36" fill="#0a0a0a"/>
        <circle cx="75" cy="74" r="3" fill="#00D4AA" opacity="0.8"/>
        <circle cx="95" cy="74" r="3" fill="#00D4AA" opacity="0.8"/>
      </svg>
    </div>

    <div style={{ position: 'relative', zIndex: 2, maxWidth: '70%' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', color: '#00D4AA', marginBottom: 6 }}>
        READY TO RUN
      </div>
      <div style={{
        fontSize: 26, fontWeight: 700, lineHeight: 1.05,
        letterSpacing: '-0.02em', color: '#EDEDED', marginBottom: 6,
      }}>
        Deploy your agent.<br/>
        <span style={{ color: '#00D4AA' }}>Sit back and watch.</span>
      </div>
      <div style={{ fontSize: 12, color: '#A1A1A1', lineHeight: 1.4, marginBottom: 16 }}>
        Your AI plays for you, 24/7.
      </div>

      <button onClick={() => window.gotoCreate && window.gotoCreate()} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 44, padding: '0 18px',
        background: '#00D4AA', border: 'none', borderRadius: 10,
        fontFamily: 'Inter', fontWeight: 700, fontSize: 13,
        letterSpacing: '0.06em', color: '#0A0A0A',
        cursor: 'pointer',
        boxShadow: '0 0 20px rgba(0, 212, 170, 0.35)',
      }}>
        BUILD AGENT
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
      </button>
    </div>

    {/* live ticker line at bottom */}
    <div style={{
      position: 'relative', zIndex: 2,
      marginTop: 14, paddingTop: 12,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#A1A1A1' }}>
        <Icon name="sparkle" size={12} color="#CDB380"/>
        <span><span style={{ color: '#EDEDED', fontWeight: 600 }}>8 agents</span> playing now</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#A1A1A1' }}>
        <span>Today's profit</span>
        <span style={{ color: '#00D4AA', fontWeight: 700 }}>+$340</span>
      </div>
    </div>
  </div>
);

// Secondary action — play yourself (smaller, more restrained)
const PlayYourselfRow = ({ onClick }) => (
  <div onClick={onClick} style={{
    margin: '0 16px 16px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '14px',
    display: 'flex', alignItems: 'center', gap: 14,
    cursor: 'pointer',
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: 12,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name="profile" size={20} color="#EDEDED"/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#EDEDED', marginBottom: 2 }}>Human vs Human</div>
      <div style={{ fontSize: 11, color: '#A1A1A1' }}>
        <span style={{ color: '#00D4AA' }}>12 tables</span> active · join in seconds
      </div>
    </div>
    <Icon name="chevron-right" size={16} color="#6B6B6B"/>
  </div>
);

// ACTIVE SESSION row (live game in progress)
const ActiveSession = () => (
  <div style={{
    margin: '0 16px 18px',
    background: '#141414',
    border: '1px solid rgba(0, 212, 170, 0.18)',
    borderRadius: 14,
    padding: '12px 14px',
    cursor: 'pointer',
  }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#00D4AA', boxShadow: '0 0 6px rgba(0,212,170,0.7)',
          animation: 'pulse 2s infinite',
        }}/>
        <span className="label-accent">LIVE SESSION</span>
      </div>
      <Icon name="chevron-right" size={14} color="#6B6B6B"/>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <AgentAvatar size={40}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#EDEDED' }}>Balanced v2.1</span>
          <span style={{
            fontSize: 9, fontWeight: 600, padding: '2px 5px',
            background: 'rgba(255,255,255,0.06)', borderRadius: 3, color: '#A1A1A1',
          }}>HU NLH</span>
        </div>
        <div style={{ fontSize: 11, color: '#A1A1A1' }}>
          Table #48291 · Blinds $10/$20
        </div>
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        <PlayingCard rank="A" suit="s" w={26} h={36}/>
        <PlayingCard rank="K" suit="h" w={26} h={36}/>
      </div>
      <button onClick={() => window.gotoAgent && window.gotoAgent()} style={{
        height: 32, padding: '0 12px',
        background: 'transparent',
        border: '1px solid #00D4AA', borderRadius: 8,
        color: '#00D4AA', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        cursor: 'pointer',
      }}>WATCH</button>
    </div>
  </div>
);

// Agent card
const AgentCard = ({ rank, name, winRate, hands, accent = '#00D4AA' }) => (
  <div style={{
    width: 130, flexShrink: 0,
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 12,
    cursor: 'pointer',
  }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 8,
    }}>
      <span style={{
        height: 17, padding: '0 5px', borderRadius: 4,
        background: `${accent}26`,
        color: accent,
        fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
        display: 'inline-flex', alignItems: 'center',
      }}>#{rank}</span>
      <Icon name="dot" size={3} color="#6B6B6B"/>
    </div>
    {/* portrait */}
    <div style={{
      height: 70, borderRadius: 10,
      background: `radial-gradient(ellipse at center bottom, ${accent}22, transparent 70%), #0e1418`,
      marginBottom: 10,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <svg width="60" height="62" viewBox="0 0 60 62" style={{display:'block'}}>
        <defs>
          <linearGradient id={`hood-${rank}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.5"/>
            <stop offset="1" stopColor={accent} stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d="M30 4 C16 4 8 14 8 28 L8 62 L52 62 L52 28 C52 14 44 4 30 4 Z" fill={`url(#hood-${rank})`}/>
        <ellipse cx="30" cy="32" rx="11" ry="14" fill="#0a0a0a"/>
        <circle cx="26" cy="29" r="1.4" fill={accent}/>
        <circle cx="34" cy="29" r="1.4" fill={accent}/>
      </svg>
    </div>
    <div style={{ fontSize: 13, fontWeight: 600, color: '#EDEDED', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div>
        <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', color: '#6B6B6B' }}>WIN RATE</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: accent, letterSpacing: '-0.02em' }}>{winRate}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#A1A1A1', fontVariantNumeric: 'tabular-nums' }}>
        <Icon name="bar-chart" size={10} color="#6B6B6B" strokeWidth={2}/>
        {hands}
      </div>
    </div>
  </div>
);

const MyAgents = () => (
  <div style={{ marginBottom: 16 }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0 16px', marginBottom: 10,
    }}>
      <div className="label">MY AGENTS</div>
      <div onClick={() => window.gotoAgent && window.gotoAgent()} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: '#00D4AA', cursor: 'pointer' }}>
        View all <Icon name="chevron-right" size={11} color="#00D4AA" strokeWidth={2}/>
      </div>
    </div>
    <div className="no-scrollbar" style={{
      display: 'flex', gap: 10, padding: '0 16px',
      overflowX: 'auto',
    }}>
      <AgentCard rank="1" name="Balanced v2.1" winRate="61.8%" hands="1,247" accent="#00D4AA"/>
      <AgentCard rank="2" name="Aggressive v1.3" winRate="58.2%" hands="892" accent="#9B7BFF"/>
      <AgentCard rank="3" name="Bluff Master" winRate="54.7%" hands="743" accent="#CDB380"/>
      <AgentCard rank="4" name="Value Bot" winRate="62.1%" hands="1,102" accent="#FF7A8E"/>
    </div>
  </div>
);

const ActivityRow = ({ icon, iconColor, title, subtitle, amount, amountColor, time }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: 8,
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={icon} size={14} color={iconColor}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#EDEDED', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 1 }}>{subtitle}</div>
    </div>
    <div style={{ textAlign: 'right' }}>
      {amount && <div style={{ fontSize: 12, fontWeight: 700, color: amountColor, fontVariantNumeric: 'tabular-nums' }}>{amount}</div>}
      <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 1 }}>{time}</div>
    </div>
    <Icon name="chevron-right" size={12} color="#3a3a3a"/>
  </div>
);

const RecentActivity = () => (
  <div style={{
    margin: '0 16px 16px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: '12px 14px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <div className="label">RECENT ACTIVITY</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#00D4AA', cursor: 'pointer' }}>View all</div>
    </div>
    <ActivityRow icon="trophy" iconColor="#CDB380"
      title="Balanced v2.1 won a hand" subtitle="vs Aggressive v1.3"
      amount="+$340.00" amountColor="#00D4AA" time="2m ago"/>
    <ActivityRow icon="bar-chart" iconColor="#00D4AA"
      title="Bluff Master completed session" subtitle="12 hands played"
      amount="+$120.50" amountColor="#00D4AA" time="15m ago"/>
    <div style={{ marginBottom: -11 }}>
      <ActivityRow icon="spade" iconColor="#A1A1A1"
        title="Aggressive v1.3 joined a table" subtitle="NLH 6-Max"
        time="1h ago"/>
    </div>
  </div>
);

const HomeScreen = ({ onPlay }) => (
  <div style={{
    width: '100%', height: '100%',
    background: '#0A0A0A',
    color: '#EDEDED',
    display: 'flex', flexDirection: 'column',
    paddingTop: 54,
  }}>
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 4 }}>
      <TopBar/>
      <ActiveAgentsPill/>
      <Hero/>
      <PlayYourselfRow onClick={onPlay}/>
      <ActiveSession/>
      <MyAgents/>
      <RecentActivity/>
    </div>
  </div>
);

Object.assign(window, { HomeScreen, Logo });
