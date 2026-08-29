// Agent Live View — watch your deployed agent play

const AgentLiveHeader = ({ name = 'Aggressive v1.3' }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '6px 16px 14px',
  }}>
    {/* Bot avatar */}
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: '#0e1418',
      border: '1px solid rgba(0,212,170,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      boxShadow: '0 0 12px rgba(0,212,170,0.18) inset',
    }}>
      <svg width="30" height="30" viewBox="0 0 60 60">
        <rect x="10" y="14" width="40" height="34" rx="14" fill="#0a0f17" stroke="rgba(0,212,170,0.5)" strokeWidth="0.6"/>
        <rect x="6" y="24" width="6" height="14" rx="3" fill="#0a0f17" stroke="rgba(0,212,170,0.4)" strokeWidth="0.6"/>
        <rect x="48" y="24" width="6" height="14" rx="3" fill="#0a0f17" stroke="rgba(0,212,170,0.4)" strokeWidth="0.6"/>
        <ellipse cx="22" cy="30" rx="3.5" ry="2.5" fill="#00D4AA" opacity="0.9"/>
        <ellipse cx="38" cy="30" rx="3.5" ry="2.5" fill="#00D4AA" opacity="0.9"/>
        <text x="30" y="22" textAnchor="middle" fill="#00D4AA" fontSize="6" fontWeight="700" fontFamily="Inter">AP</text>
      </svg>
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <div style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 22, fontWeight: 600, color: '#EDEDED',
          letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          minWidth: 0,
        }}>{name}</div>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          color: '#00D4AA', background: 'rgba(0,212,170,0.1)',
          border: '1px solid rgba(0,212,170,0.3)', borderRadius: 5,
          padding: '2px 6px', flexShrink: 0,
        }}>AI</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 6px rgba(0,212,170,0.7)' }}/>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', color: '#00D4AA' }}>PLAYING LIVE</span>
      </div>
    </div>

    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: '#141414', border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', flexShrink: 0,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#A1A1A1">
        <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
      </svg>
    </div>
  </div>
);

const AgentStatStrip = () => (
  <div style={{
    margin: '0 16px 14px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: '12px 0',
    display: 'flex',
  }}>
    {[
      { label: 'WIN RATE', value: '58.2%', color: '#00D4AA' },
      { label: 'HANDS', value: '892', color: '#EDEDED' },
      { label: 'TODAY', value: '+$120', color: '#00D4AA' },
    ].map((s, i) => (
      <div key={i} style={{
        flex: 1, textAlign: 'center',
        borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: '#6B6B6B', marginBottom: 4 }}>{s.label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
      </div>
    ))}
  </div>
);

// Compact bot face for table seat
const SeatBot = ({ size = 52 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: '#0a0f17',
    border: '1.5px solid #00D4AA',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 0 12px rgba(0,212,170,0.25)',
  }}>
    <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 60 60">
      <rect x="10" y="14" width="40" height="34" rx="14" fill="#0a0f17" stroke="rgba(0,212,170,0.5)" strokeWidth="0.6"/>
      <ellipse cx="22" cy="30" rx="3" ry="2.2" fill="#00D4AA" opacity="0.9"/>
      <ellipse cx="38" cy="30" rx="3" ry="2.2" fill="#00D4AA" opacity="0.9"/>
      <text x="30" y="42" textAnchor="middle" fill="#00D4AA" fontSize="7" fontWeight="700" fontFamily="Inter">AP</text>
    </svg>
  </div>
);

const SeatHuman = ({ size = 50 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: '#141414',
    border: '1.5px solid rgba(0,212,170,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 60 60">
      <circle cx="30" cy="22" r="9" fill="#3a3a3a"/>
      <path d="M14 50 C14 38, 22 34, 30 34 C38 34, 46 38, 46 50 Z" fill="#3a3a3a"/>
    </svg>
  </div>
);

const AgentLiveTable = () => (
  <div style={{
    margin: '0 16px 16px',
    position: 'relative',
    paddingTop: 8,
  }}>
    {/* Oval table */}
    <div style={{
      position: 'relative',
      borderRadius: '50% / 32%',
      border: '1.5px solid rgba(0,212,170,0.5)',
      background: 'radial-gradient(ellipse at center, #0d1518 0%, #080d10 70%)',
      height: 380,
      boxShadow: '0 0 40px rgba(0,212,170,0.08), inset 0 0 30px rgba(0,212,170,0.05)',
    }}>
      {/* Opponent seat top */}
      <div style={{
        position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <SeatHuman size={44}/>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#A1A1A1', marginTop: 4 }}>Opponent</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#EDEDED', fontVariantNumeric: 'tabular-nums' }}>$1,240</div>
        </div>
        <div style={{ display: 'flex', gap: 3, marginTop: -22 }}>
          <CardBack w={24} h={32} branded/>
          <CardBack w={24} h={32} branded/>
        </div>
      </div>

      {/* Pot */}
      <div style={{
        position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em', color: '#6B6B6B' }}>POT</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#EDEDED', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>$340</div>
      </div>

      {/* Community cards */}
      <div style={{
        position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 6,
      }}>
        <PlayingCard rank="A" suit="s" w={50} h={68}/>
        <PlayingCard rank="K" suit="h" w={50} h={68}/>
        <PlayingCard rank="Q" suit="c" w={50} h={68}/>
      </div>

      {/* Spade watermark */}
      <div style={{
        position: 'absolute', top: 200, left: '50%', transform: 'translateX(-50%)',
        opacity: 0.18,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="#00D4AA">
          <path d="M12 2C8 7 4 11 4 15a4 4 0 0 0 7 2.7V21h2v-3.3A4 4 0 0 0 20 15c0-4-4-8-8-13z"/>
        </svg>
      </div>

      {/* Agent's hole cards (face up) */}
      <div style={{
        position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 5,
      }}>
        <PlayingCard rank="K" suit="s" w={42} h={58}/>
        <PlayingCard rank="Q" suit="h" w={42} h={58}/>
      </div>
    </div>

    {/* Agent seat bottom (overlaps table) */}
    <div style={{
      position: 'absolute', bottom: -28, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      <div style={{ position: 'relative' }}>
        <SeatBot size={50}/>
        <span style={{
          position: 'absolute', bottom: 1, right: 1,
          width: 9, height: 9, borderRadius: '50%',
          background: '#00D4AA', border: '2px solid #0A0A0A',
        }}/>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#EDEDED', marginTop: 4 }}>Aggressive v1.3</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#A1A1A1', fontVariantNumeric: 'tabular-nums' }}>$1,850</div>
    </div>
  </div>
);

const ReasonRow = ({ text }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
    <div style={{
      width: 18, height: 18, borderRadius: '50%',
      background: 'rgba(0,212,170,0.12)',
      border: '1px solid rgba(0,212,170,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5 9-11"/>
      </svg>
    </div>
    <div style={{ fontSize: 12.5, color: '#EDEDED' }}>{text}</div>
  </div>
);

const DecisionPanel = () => (
  <div style={{
    margin: '40px 16px 14px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: '16px',
  }}>
    <div style={{
      fontFamily: '"Playfair Display", Georgia, serif',
      fontSize: 30, fontWeight: 600, color: '#00D4AA',
      letterSpacing: '-0.01em', lineHeight: 1, marginBottom: 14,
      whiteSpace: 'nowrap',
    }}>Calling $120</div>

    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <div style={{
          background: '#0e0e0e',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 9,
          padding: '6px 12px', minWidth: 84, textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B6B6B' }}>EV</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#00D4AA', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>+$87.40</div>
        </div>
        <div style={{
          background: '#0e0e0e',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 9,
          padding: '6px 12px', minWidth: 84, textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B6B6B' }}>CONFIDENCE</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EDEDED', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>67%</div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <ReasonRow text="Top pair strong kicker"/>
        <ReasonRow text="Good pot odds"/>
        <ReasonRow text="Wide opponent range"/>
      </div>
    </div>
  </div>
);

const TabsRow = ({ active = 'live', onChange }) => {
  const tabs = [
    { id: 'live', label: 'LIVE ANALYSIS' },
    { id: 'history', label: 'HISTORY' },
    { id: 'notes', label: 'NOTES' },
  ];
  return (
    <div style={{
      margin: '0 16px',
      display: 'flex',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <div key={t.id} onClick={() => onChange && onChange(t.id)} style={{
            flex: 1, textAlign: 'center', padding: '10px 0', cursor: 'pointer',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: isActive ? '#00D4AA' : '#6B6B6B',
            borderBottom: isActive ? '2px solid #00D4AA' : '2px solid transparent',
          }}>
            {t.label}
          </div>
        );
      })}
    </div>
  );
};

const ActionRow = () => (
  <div style={{ margin: '14px 16px 14px', display: 'flex', gap: 10 }}>
    {/* Take action */}
    <div style={{
      flex: 1, padding: '12px 12px',
      background: '#141414',
      border: '1px solid rgba(0,212,170,0.25)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 10,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'rgba(0,212,170,0.1)',
        border: '1px solid rgba(0,212,170,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11V6a2 2 0 0 1 4 0v6"/>
          <path d="M5 11a2 2 0 0 1 4 0v3"/>
          <path d="M5 14v3a5 5 0 0 0 5 5h3a5 5 0 0 0 5-5v-5a2 2 0 0 0-4 0v2"/>
        </svg>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#EDEDED' }}>TAKE ACTION NOW</div>
        <div style={{ fontSize: 10, color: '#A1A1A1', marginTop: 2 }}>Override agent decision</div>
      </div>
    </div>

    {/* Autoplay toggle */}
    <div style={{
      flex: 1, padding: '12px 12px',
      background: '#141414',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#EDEDED' }}>AUTOPLAY</div>
        <div style={{ fontSize: 10, color: '#A1A1A1', marginTop: 2 }}>Agent acts in 12s</div>
      </div>
      {/* Toggle */}
      <div style={{
        width: 36, height: 20, borderRadius: 999,
        background: '#00D4AA', position: 'relative', flexShrink: 0,
        boxShadow: '0 0 8px rgba(0,212,170,0.4)',
      }}>
        <div style={{
          position: 'absolute', top: 2, right: 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#FFFFFF',
        }}/>
      </div>
    </div>
  </div>
);

const RecentHandsList = () => (
  <div style={{ margin: '0 16px 16px' }}>
    <div className="label" style={{ marginBottom: 6 }}>RECENT HANDS</div>
    <HandRow icon="trophy" iconColor="#CDB380" title="Won vs Balanced v2.1" cards={[['A','s'],['K','h'],['7','c'],['3','d'],['10','s']]} amount="+$340" amountColor="#00D4AA"/>
    <HandRow icon="bar-chart" iconColor="#00D4AA" title="Won vs Passive Bot" cards={[['8','s'],['10','h'],['8','c'],['6','d'],['2','s']]} amount="+$210" amountColor="#00D4AA"/>
    <div style={{ marginBottom: -11 }}>
      <HandRow icon="tilt" iconColor="#FF4D4F" title="Lost vs Value Bot" cards={[['9','s'],['7','d'],['J','c'],['4','d'],['Q','s']]} amount="-$120" amountColor="#FF4D4F"/>
    </div>
  </div>
);

// Reusing HandRow style: define a chevron variant
const HandRow = ({ icon, iconColor, title, cards, amount, amountColor }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 4px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div style={{
      width: 24, height: 24, borderRadius: 6,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={icon} size={12} color={iconColor}/>
    </div>
    <div style={{ fontSize: 11.5, color: '#EDEDED', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
    <div style={{ display: 'flex', gap: 1.5 }}>
      {cards.map((c, i) => (
        <MiniCard key={i} rank={c[0]} suit={c[1]}/>
      ))}
    </div>
    <div style={{
      fontSize: 11.5, fontWeight: 700, color: amountColor,
      width: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
    }}>{amount}</div>
    <Icon name="chevron-right" size={11} color="#6B6B6B" strokeWidth={2}/>
  </div>
);

const AgentLiveScreen = () => {
  const [tab, setTab] = React.useState('live');
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0A0A0A',
      display: 'flex', flexDirection: 'column', paddingTop: 54,
    }}>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        <AgentLiveHeader/>
        <AgentStatStrip/>
        <AgentLiveTable/>
        <DecisionPanel/>
        <TabsRow active={tab} onChange={setTab}/>
        <ActionRow/>
        <RecentHandsList/>
      </div>
    </div>
  );
};

Object.assign(window, { AgentLiveScreen });
