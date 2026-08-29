// Profile screen

const HoodedAvatar = ({ size = 76 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: '#0a0f17',
    border: '1.5px solid rgba(0,212,170,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
    boxShadow: '0 0 14px rgba(0,212,170,0.18)',
  }}>
    <svg width={size} height={size} viewBox="0 0 80 80">
      <defs>
        <radialGradient id="hoodAvGlow" cx="50%" cy="55%" r="55%">
          <stop offset="0" stopColor="#00D4AA" stopOpacity="0.3"/>
          <stop offset="1" stopColor="#00D4AA" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="hoodAvBody" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1a2030"/>
          <stop offset="1" stopColor="#0a0f17"/>
        </linearGradient>
      </defs>
      <circle cx="40" cy="40" r="40" fill="url(#hoodAvGlow)"/>
      {/* hood */}
      <path d="M40 14 C28 14 20 26 20 42 L20 80 L60 80 L60 42 C60 26 52 14 40 14 Z" fill="url(#hoodAvBody)"/>
      {/* face shadow */}
      <ellipse cx="40" cy="42" rx="13" ry="16" fill="#050810"/>
      {/* eyes */}
      <ellipse cx="34" cy="40" rx="2.4" ry="1.6" fill="#00D4AA" opacity="0.95"/>
      <ellipse cx="46" cy="40" rx="2.4" ry="1.6" fill="#00D4AA" opacity="0.95"/>
      {/* AP label */}
      <text x="40" y="32" textAnchor="middle" fill="#00D4AA" fontSize="6.5" fontWeight="700" fontFamily="Inter" letterSpacing="0.5">AP</text>
    </svg>
  </div>
);

const ProfileHeaderCard = () => (
  <div style={{
    margin: '0 16px 14px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: '16px',
    display: 'flex', alignItems: 'center', gap: 14,
  }}>
    <HoodedAvatar size={76}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 22, fontWeight: 600, color: '#EDEDED',
          letterSpacing: '-0.01em', whiteSpace: 'nowrap',
        }}>PokerMind</div>
        {/* Verified check */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#00D4AA" style={{ flexShrink: 0 }}>
          <path d="M12 1l2.5 2.3 3.4-.5.5 3.4L20.7 9 19 12l1.7 3-2.3 2.5-.5 3.4-3.4-.5L12 23l-2.5-2.6-3.4.5-.5-3.4L3.3 15 5 12 3.3 9l2.3-2.5.5-3.4 3.4.5L12 1z"/>
          <path d="M8 12l3 3 5-6" stroke="#0A0A0A" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div style={{ fontSize: 11.5, color: '#A1A1A1', marginTop: 2 }}>Member since May 2026</div>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: '#6B6B6B', marginTop: 10 }}>TOTAL EARNINGS</div>
      <div style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 22, fontWeight: 600, color: '#00D4AA',
        letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 1,
      }}>$1,248.75</div>
    </div>
    <button style={{
      alignSelf: 'flex-end',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 32, padding: '0 12px', borderRadius: 999,
      background: 'transparent', border: '1.5px solid #00D4AA',
      color: '#00D4AA', fontSize: 11, fontWeight: 600,
      cursor: 'pointer', fontFamily: 'Inter', flexShrink: 0,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>
      </svg>
      Edit Profile
    </button>
  </div>
);

const StatCell = ({ icon, label, value, valueColor }) => (
  <div style={{
    flex: 1, padding: '14px 6px', textAlign: 'center',
    minWidth: 0,
  }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
      {icon}
    </div>
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B6B6B', marginBottom: 4 }}>{label}</div>
    <div style={{
      fontSize: 14, fontWeight: 700, color: valueColor || '#EDEDED',
      fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
    }}>{value}</div>
  </div>
);

const ProfileStats = () => (
  <div style={{
    margin: '0 16px 14px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    display: 'flex',
  }}>
    <StatCell
      label="TOTAL HANDS" value="1,892"
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="3" width="12" height="16" rx="2"/>
          <path d="M9 7h6M9 11h6"/>
        </svg>
      }
    />
    <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }}/>
    <StatCell
      label="WIN RATE" value="58.2%" valueColor="#00D4AA"
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>
        </svg>
      }
    />
    <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }}/>
    <StatCell
      label="BEST AGENT" value="Aggressive v1.3"
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="7" width="14" height="12" rx="3"/>
          <line x1="12" y1="7" x2="12" y2="3"/><circle cx="12" cy="2.5" r="0.8" fill="#00D4AA"/>
          <circle cx="9" cy="13" r="1.2" fill="#00D4AA"/><circle cx="15" cy="13" r="1.2" fill="#00D4AA"/>
        </svg>
      }
    />
    <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }}/>
    <StatCell
      label="TOTAL PROFIT" value="$842.35" valueColor="#00D4AA"
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 1 1 0 3h-3a1.5 1.5 0 1 0 0 3h4"/>
        </svg>
      }
    />
  </div>
);

const SettingRow = ({ icon, label, right, danger = false, last = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 4px',
    borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)',
    cursor: 'pointer',
  }}>
    <div style={{
      width: 28, height: 28, borderRadius: 7,
      background: danger ? 'rgba(255,77,79,0.08)' : 'rgba(0,212,170,0.08)',
      border: '1px solid ' + (danger ? 'rgba(255,77,79,0.3)' : 'rgba(0,212,170,0.25)'),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {icon}
    </div>
    <div style={{
      flex: 1, fontSize: 13.5, fontWeight: 500,
      color: danger ? '#FF4D4F' : '#EDEDED',
    }}>{label}</div>
    {right && (
      <div style={{ fontSize: 12, color: '#00D4AA', fontVariantNumeric: 'tabular-nums' }}>{right}</div>
    )}
    {!danger && (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6"/>
      </svg>
    )}
  </div>
);

const SettingsCard = () => (
  <div style={{
    margin: '0 16px 16px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '12px 14px 8px',
  }}>
    <div className="label" style={{ marginBottom: 4 }}>SETTINGS</div>
    <SettingRow
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>}
      label="Notifications"
    />
    <SettingRow
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="17" cy="14.5" r="1" fill="#00D4AA"/></svg>}
      label="Connected Wallet"
      right="UQDF...3x9a"
    />
    <SettingRow
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>}
      label="Language"
      right="English"
    />
    <SettingRow
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v5h1"/></svg>}
      label="About"
    />
    <SettingRow
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF4D4F" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>}
      label="Log Out"
      danger
      last
    />
  </div>
);

const ProfileHeader = () => (
  <div style={{ padding: '4px 20px 16px' }}>
    <div style={{
      fontFamily: '"Playfair Display", Georgia, serif',
      fontSize: 30, fontWeight: 600, color: '#EDEDED',
      letterSpacing: '-0.01em', lineHeight: 1, textAlign: 'center',
    }}>Profile</div>
  </div>
);

const ProfileScreen = () => (
  <div style={{
    width: '100%', height: '100%', background: '#0A0A0A',
    display: 'flex', flexDirection: 'column', paddingTop: 54,
  }}>
    <ProfileHeader/>
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
      <ProfileHeaderCard/>
      <ProfileStats/>
      <SettingsCard/>
    </div>
  </div>
);

Object.assign(window, { ProfileScreen });
