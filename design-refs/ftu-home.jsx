// First-time user home — empty state, onboarding-focused

const FTUTopBar = ({ onCreate }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px 12px',
  }}>
    <Logo/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 30, padding: '0 4px 0 12px', borderRadius: 999,
        background: '#141414', border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Icon name="chip" size={13} color="#00D4AA"/>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#A1A1A1', fontVariantNumeric: 'tabular-nums' }}>0</span>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#EDEDED', fontSize: 14, fontWeight: 500, lineHeight: 1, paddingBottom: 2,
        }}>+</div>
      </div>
      <div style={{ position: 'relative' }}>
        <Icon name="bell" size={20} color="#EDEDED" strokeWidth={1.7}/>
        <span style={{ position: 'absolute', top: -1, right: -1, width: 7, height: 7, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 4px rgba(0,212,170,0.6)' }}/>
      </div>
    </div>
  </div>
);

const FTUHero = ({ onCreate }) => (
  <div onClick={onCreate} style={{
    margin: '0 16px 18px',
    borderRadius: 18,
    background: 'linear-gradient(135deg, #0e1418 0%, #0a1212 100%)',
    border: '1px solid rgba(0,212,170,0.18)',
    padding: '20px',
    position: 'relative', overflow: 'hidden',
    cursor: 'pointer',
    minHeight: 220,
  }}>
    {/* Hooded silhouette right side */}
    <div style={{
      position: 'absolute', right: -10, top: 0, bottom: 0, width: '55%',
      pointerEvents: 'none',
    }}>
      <svg viewBox="0 0 200 240" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="ftuGlow" cx="50%" cy="50%" r="60%">
            <stop offset="0" stopColor="#00D4AA" stopOpacity="0.35"/>
            <stop offset="1" stopColor="#00D4AA" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="ftuHood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1a2030"/>
            <stop offset="1" stopColor="#0a0f17"/>
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="120" rx="120" ry="120" fill="url(#ftuGlow)"/>
        <path d="M100 30 C70 30 50 60 50 100 L50 240 L150 240 L150 100 C150 60 130 30 100 30 Z" fill="url(#ftuHood)"/>
        <ellipse cx="100" cy="115" rx="32" ry="42" fill="#050810"/>
        {/* chips at base */}
        <ellipse cx="60" cy="220" rx="14" ry="4" fill="#0a1418" stroke="#00D4AA" strokeWidth="0.6" opacity="0.6"/>
        <ellipse cx="140" cy="225" rx="16" ry="4.5" fill="#0a1418" stroke="#00D4AA" strokeWidth="0.6" opacity="0.5"/>
      </svg>
    </div>

    {/* Plus button overlay center */}
    <div style={{
      position: 'absolute', left: '52%', top: '40%', transform: 'translate(-50%, -50%)',
      width: 56, height: 56, borderRadius: '50%',
      background: 'rgba(0,212,170,0.10)',
      border: '1.5px solid rgba(0,212,170,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 20px rgba(0,212,170,0.3)',
    }}>
      <Icon name="plus" size={26} color="#00D4AA" strokeWidth={1.8}/>
    </div>

    <div style={{ position: 'relative', zIndex: 1, maxWidth: '60%' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#EDEDED', letterSpacing: '-0.02em', lineHeight: 1.05, marginBottom: 12 }}>
        Build your<br/><span style={{ color: '#00D4AA' }}>first agent.</span>
      </div>
      <div style={{ fontSize: 13, color: '#A1A1A1', lineHeight: 1.4, marginBottom: 18 }}>
        Design agents.<br/>Compete.<br/>Win.
      </div>
      <button onClick={onCreate} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 40, padding: '0 16px', borderRadius: 10,
        background: '#00D4AA', border: 'none',
        fontFamily: 'Inter', fontWeight: 700, fontSize: 12,
        letterSpacing: '0.08em', color: '#0A0A0A',
        cursor: 'pointer', whiteSpace: 'nowrap',
        boxShadow: '0 0 16px rgba(0,212,170,0.3)',
      }}>
        CREATE AGENT
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6"/>
        </svg>
      </button>
    </div>
  </div>
);

const FTUMyAgents = ({ onCreate }) => (
  <div style={{
    margin: '0 16px 18px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: '12px 14px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div className="label">MY AGENTS</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: '#6B6B6B', cursor: 'pointer' }}>
        View all <Icon name="chevron-right" size={11} color="#6B6B6B" strokeWidth={2}/>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      {/* Active create slot */}
      <div onClick={onCreate} style={{
        flex: 1, padding: '14px 6px',
        background: 'rgba(0,212,170,0.06)',
        border: '1.5px solid #00D4AA', borderRadius: 12,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        cursor: 'pointer',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(0,212,170,0.10)',
          border: '1.5px solid #00D4AA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="plus" size={18} color="#00D4AA" strokeWidth={2}/>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#00D4AA' }}>CREATE AGENT</div>
        <div style={{ fontSize: 10, color: '#A1A1A1', textAlign: 'center', lineHeight: 1.3 }}>Start by building<br/>your first agent.</div>
      </div>

      {/* Locked slots */}
      {[0, 1].map(i => (
        <div key={i} style={{
          flex: 1, padding: '14px 6px',
          background: '#0e0e0e',
          border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          opacity: 0.7,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#A1A1A1' }}>LOCKED</div>
          <div style={{ fontSize: 10, color: '#6B6B6B', textAlign: 'center', lineHeight: 1.3 }}>Create more agents<br/>to unlock.</div>
        </div>
      ))}
    </div>
  </div>
);

const ActivityRow = ({ icon, iconColor, title, sub, time }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={icon} size={14} color={iconColor}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: '#EDEDED' }}>{title}</div>
      <div style={{ fontSize: 11, color: '#6B6B6B', marginTop: 1 }}>{sub}</div>
    </div>
    <div style={{ fontSize: 10.5, color: '#6B6B6B', flexShrink: 0 }}>{time}</div>
  </div>
);

const FTURecentActivity = () => (
  <div style={{
    margin: '0 16px 18px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: '10px 14px 6px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
      <div className="label">RECENT ACTIVITY</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: '#6B6B6B', cursor: 'pointer' }}>
        View all <Icon name="chevron-right" size={11} color="#6B6B6B" strokeWidth={2}/>
      </div>
    </div>
    <ActivityRow icon="trophy" iconColor="#CDB380" title="Welcome to Agentic Poker" sub="Build your first agent to get started." time="Just now"/>
    <ActivityRow icon="bar-chart" iconColor="#00D4AA" title="Learn how agents compete" sub="Watch the quick start guide." time="Just now"/>
    <div style={{ marginBottom: -10 }}>
      <ActivityRow icon="spade" iconColor="#A1A1A1" title="Join the community" sub="Connect with other builders." time="Just now"/>
    </div>
  </div>
);

const TableActionCard = ({ icon, title, sub, primary, onClick }) => (
  <div onClick={onClick} style={{
    flex: 1, padding: '14px 14px',
    background: primary ? 'rgba(0,212,170,0.04)' : '#141414',
    border: primary ? '1px solid rgba(0,212,170,0.25)' : '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    display: 'flex', alignItems: 'center', gap: 12,
    cursor: 'pointer',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'rgba(0,212,170,0.10)',
      border: '1px solid rgba(0,212,170,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={icon} size={16} color="#00D4AA" strokeWidth={1.8}/>
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#EDEDED', letterSpacing: '0.04em' }}>{title}</div>
      <div style={{ fontSize: 10.5, color: '#A1A1A1', marginTop: 2 }}>{sub}</div>
    </div>
  </div>
);

const FTUTableActions = ({ onPlay }) => (
  <div style={{ display: 'flex', gap: 10, margin: '0 16px 16px' }}>
    <TableActionCard icon="plus" title="CREATE TABLE" sub="Start a new game" primary onClick={onPlay}/>
    <TableActionCard icon="profile" title="JOIN TABLE" sub="Enter with code" onClick={onPlay}/>
  </div>
);

const FTUHomeScreen = ({ onCreate, onPlay }) => (
  <div style={{
    width: '100%', height: '100%',
    background: '#0A0A0A', color: '#EDEDED',
    display: 'flex', flexDirection: 'column', paddingTop: 54,
  }}>
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 4 }}>
      <FTUTopBar/>
      <FTUHero onCreate={onCreate}/>
      <FTUMyAgents onCreate={onCreate}/>
      <FTURecentActivity/>
      <FTUTableActions onPlay={onPlay}/>
    </div>
  </div>
);

Object.assign(window, { FTUHomeScreen });
