// Play hub — pick AI or invite a human

const ScreenTitle = ({ title }) => (
  <div style={{
    padding: '4px 20px 16px',
  }}>
    <div style={{
      fontFamily: '"Playfair Display", Georgia, serif',
      fontSize: 30, fontWeight: 600, color: '#EDEDED',
      letterSpacing: '-0.01em', lineHeight: 1, textAlign: 'center',
    }}>{title}</div>
  </div>
);

const BotAvatar = ({ size = 80 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: '#0e1418',
    border: '1px solid rgba(0,212,170,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 0 20px rgba(0,212,170,0.18) inset',
  }}>
    <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 60 60">
      <defs>
        <linearGradient id="botBody" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1a2030"/>
          <stop offset="1" stopColor="#0a0f17"/>
        </linearGradient>
      </defs>
      {/* head */}
      <rect x="10" y="14" width="40" height="34" rx="14" fill="url(#botBody)" stroke="rgba(0,212,170,0.5)" strokeWidth="0.6"/>
      {/* antenna */}
      <line x1="30" y1="14" x2="30" y2="8" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="30" cy="6" r="2" fill="#00D4AA"/>
      {/* ear bumps */}
      <rect x="6" y="24" width="6" height="14" rx="3" fill="#0a0f17" stroke="rgba(0,212,170,0.4)" strokeWidth="0.6"/>
      <rect x="48" y="24" width="6" height="14" rx="3" fill="#0a0f17" stroke="rgba(0,212,170,0.4)" strokeWidth="0.6"/>
      {/* eyes */}
      <ellipse cx="22" cy="30" rx="3.5" ry="2.5" fill="#00D4AA" opacity="0.9"/>
      <ellipse cx="38" cy="30" rx="3.5" ry="2.5" fill="#00D4AA" opacity="0.9"/>
      {/* AP label */}
      <text x="30" y="44" textAnchor="middle" fill="#00D4AA" fontSize="7" fontWeight="700" fontFamily="Inter" letterSpacing="0.5">AP</text>
    </svg>
  </div>
);

const HumanAvatar = ({ size = 80 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: '#141414',
    border: '1px solid rgba(0,212,170,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 60 60">
      <circle cx="30" cy="22" r="9" fill="#3a3a3a" stroke="#5a5a5a" strokeWidth="0.6"/>
      <path d="M14 50 C14 38, 22 34, 30 34 C38 34, 46 38, 46 50 Z" fill="#3a3a3a" stroke="#5a5a5a" strokeWidth="0.6"/>
    </svg>
  </div>
);

const PlayCard = ({ children, glow = false }) => (
  <div style={{
    margin: '0 16px 16px',
    background: 'linear-gradient(180deg, rgba(20,20,20,0.9) 0%, rgba(14,14,14,0.9) 100%)',
    border: glow ? '1.5px solid #00D4AA' : '1px solid rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: '20px',
    boxShadow: glow ? '0 0 30px rgba(0,212,170,0.18), inset 0 0 30px rgba(0,212,170,0.04)' : 'none',
  }}>
    {children}
  </div>
);

const PlayHubScreen = ({ onStart }) => {
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0A0A0A',
      display: 'flex', flexDirection: 'column', paddingTop: 54,
    }}>
      <PlayHeader/>
      <ScreenTitle title="Play"/>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }}>
        {/* Deploy Agent — primary, glow */}
        <PlayCard glow>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <BotAvatar size={80}/>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 26, fontWeight: 600, color: '#EDEDED',
                letterSpacing: '-0.01em', lineHeight: 1.05, marginBottom: 6,
              }}>Deploy Agent</div>
              <div style={{ fontSize: 12, color: '#A1A1A1', lineHeight: 1.4 }}>
                Your AI plays for you<br/>
                <span style={{ color: '#00D4AA' }}>·</span> sit back and watch
              </div>
            </div>
          </div>
          <button onClick={onStart} style={{
            width: '100%', height: 50, borderRadius: 12,
            background: '#00D4AA', border: 'none',
            fontFamily: 'Inter', fontWeight: 700, fontSize: 14,
            letterSpacing: '0.12em', color: '#0A0A0A',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            boxShadow: '0 0 20px rgba(0,212,170,0.32)',
            position: 'relative',
          }}>
            <span>DEPLOY AGENT</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: 18 }}>
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>
        </PlayCard>

        {/* Play Yourself — split into vs AI / vs Human */}
        <PlayCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <HumanAvatar size={80}/>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontFamily: '"Playfair Display", Georgia, serif',
                fontSize: 24, fontWeight: 600, color: '#EDEDED',
                letterSpacing: '-0.01em', lineHeight: 1.05, marginBottom: 6,
              }}>Play Yourself</div>
              <div style={{ fontSize: 12, color: '#A1A1A1' }}>
                Jump in and play a game
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onStart} style={{
              flex: 1, height: 44, padding: '0 12px', borderRadius: 10,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#EDEDED',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              cursor: 'pointer', fontFamily: 'Inter',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon name="agent" size={16} color="#00D4AA" strokeWidth={1.7}/>
                <span style={{ fontSize: 13, fontWeight: 500 }}>vs AI</span>
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EDEDED" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
            <button onClick={onStart} style={{
              flex: 1.4, height: 44, padding: '0 12px', borderRadius: 10,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#EDEDED',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
              cursor: 'pointer', fontFamily: 'Inter', minWidth: 0,
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Icon name="profile" size={16} color="#00D4AA" strokeWidth={1.7}/>
                <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  vs Human <span style={{ color: '#00D4AA' }}>·</span> <span style={{ color: '#A1A1A1' }}>share link</span>
                </span>
              </span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EDEDED" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
          </div>
        </PlayCard>

        <div style={{
          textAlign: 'center', fontSize: 11, color: '#6B6B6B',
          padding: '4px 16px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          Free play
          <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#6B6B6B' }}/>
          TON stakes coming soon
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { PlayHubScreen });
