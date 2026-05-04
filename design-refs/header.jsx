// Top section: header (back, agent identity, settings) + stats strip

const AgentAvatar = ({ size = 48 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: 'linear-gradient(135deg, #1a2a2e 0%, #0e1518 100%)',
    border: '1px solid rgba(0, 212, 170, 0.25)',
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    {/* hooded silhouette */}
    <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 40 40" style={{display:'block'}}>
      <defs>
        <linearGradient id="hood" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3a4d6b"/>
          <stop offset="1" stopColor="#1a2030"/>
        </linearGradient>
      </defs>
      <path d="M20 4 C12 4 7 10 7 18 L7 32 C7 36 10 38 14 38 L26 38 C30 38 33 36 33 32 L33 18 C33 10 28 4 20 4 Z" fill="url(#hood)"/>
      <ellipse cx="20" cy="22" rx="7" ry="9" fill="#0a0f17"/>
      <circle cx="17" cy="20" r="1" fill="#00D4AA" opacity="0.7"/>
      <circle cx="23" cy="20" r="1" fill="#00D4AA" opacity="0.7"/>
    </svg>
    {/* online dot */}
    <div style={{
      position: 'absolute', bottom: 1, right: 1,
      width: 12, height: 12, borderRadius: '50%',
      background: '#00D4AA',
      border: '2px solid #0A0A0A',
      boxShadow: '0 0 6px rgba(0,212,170,0.6)',
    }}/>
  </div>
);

const Header = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 16px 16px',
  }}>
    <button style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'transparent', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#EDEDED', cursor: 'pointer', padding: 0, marginLeft: -8,
    }}>
      <Icon name="arrow-left" size={22} />
    </button>
    <AgentAvatar size={48} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div className="label-accent" style={{ marginBottom: 2 }}>AGENT VIEW</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em',
        lineHeight: 1.1, marginBottom: 4,
      }}>
        <span>Aggressive v1.3</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center',
          height: 18, padding: '0 6px', borderRadius: 4,
          background: 'rgba(0, 212, 170, 0.12)',
          border: '1px solid rgba(0, 212, 170, 0.35)',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          color: '#00D4AA',
        }}>AI</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#A1A1A1' }}>
        <span style={{ color: '#00D4AA' }}>In Progress</span>
        <span style={{ color: '#3a3a3a' }}>•</span>
        <span>Table #48291</span>
      </div>
    </div>
    <button style={{
      width: 38, height: 38, borderRadius: 10,
      background: '#1A1A1A',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#EDEDED', cursor: 'pointer', padding: 0,
    }}>
      <Icon name="settings" size={18} />
    </button>
  </div>
);

const StatCell = ({ label, value, valueColor = '#EDEDED' }) => (
  <div style={{ flex: 1, padding: '12px 2px', minWidth: 0 }}>
    <div style={{
      fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 6,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip',
    }}>{label}</div>
    <div style={{
      fontSize: 15, fontWeight: 700, color: valueColor,
      letterSpacing: '-0.02em', whiteSpace: 'nowrap',
    }}>{value}</div>
  </div>
);

const StatsStrip = () => (
  <div style={{
    margin: '0 16px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    display: 'flex',
    padding: '0 8px',
  }}>
    <StatCell label="WIN RATE" value="58.2%" valueColor="#00D4AA"/>
    <StatCell label="HANDS" value="892"/>
    <StatCell label="VPIP" value="32%"/>
    <StatCell label="AGGR" value="62%"/>
    <StatCell label="TODAY" value="+$120.50" valueColor="#00D4AA"/>
  </div>
);

Object.assign(window, { Header, StatsStrip, AgentAvatar });
