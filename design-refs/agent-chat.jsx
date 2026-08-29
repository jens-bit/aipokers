// Agent Chat — when you tap an idle agent, you land in chat with it
// Tabs: CHAT (default) / STRATEGY / HISTORY

const AgentChatHeader = ({ name = 'Aggressive v1.3', onBack }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 12px 14px',
  }}>
    <button onClick={onBack} style={{
      width: 32, height: 32, borderRadius: 8,
      background: 'transparent', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EDEDED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    </button>

    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: '#0a0f17',
      border: '1.5px solid rgba(0,212,170,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, boxShadow: '0 0 10px rgba(0,212,170,0.18)',
    }}>
      <svg width="34" height="34" viewBox="0 0 80 80">
        <path d="M40 14 C28 14 20 26 20 42 L20 80 L60 80 L60 42 C60 26 52 14 40 14 Z" fill="#0a0f17" stroke="rgba(0,212,170,0.5)" strokeWidth="0.6"/>
        <ellipse cx="40" cy="42" rx="13" ry="16" fill="#050810"/>
        <ellipse cx="34" cy="40" rx="2.4" ry="1.6" fill="#00D4AA"/>
        <ellipse cx="46" cy="40" rx="2.4" ry="1.6" fill="#00D4AA"/>
        <text x="40" y="32" textAnchor="middle" fill="#00D4AA" fontSize="6" fontWeight="700" fontFamily="Inter">AP</text>
      </svg>
    </div>

    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 20, fontWeight: 600, color: '#EDEDED',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 11, color: '#A1A1A1' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#A1A1A1' }}/>
        <span>Idle</span>
        <span style={{ color: '#6B6B6B' }}>·</span>
        <span>Last played 2h ago</span>
      </div>
    </div>

    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 32, padding: '0 12px', borderRadius: 8,
      background: 'transparent', border: '1.5px solid #00D4AA',
      color: '#00D4AA', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      cursor: 'pointer', fontFamily: 'Inter', flexShrink: 0,
    }}>
      DEPLOY
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#00D4AA">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </button>
  </div>
);

const AgentChatTabs = ({ active, onChange }) => {
  const tabs = [
    { id: 'chat', label: 'CHAT' },
    { id: 'strategy', label: 'STRATEGY' },
    { id: 'history', label: 'HISTORY' },
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
          <div key={t.id} onClick={() => onChange(t.id)} style={{
            flex: 1, textAlign: 'center', padding: '10px 0', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
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

// ───────── CHAT TAB ─────────

const ChatBubbleAvatar = () => (
  <div style={{
    width: 30, height: 30, borderRadius: '50%',
    background: '#0a0f17',
    border: '1px solid rgba(0,212,170,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    <svg width="22" height="22" viewBox="0 0 80 80">
      <path d="M40 14 C28 14 20 26 20 42 L20 80 L60 80 L60 42 C60 26 52 14 40 14 Z" fill="#0a0f17"/>
      <ellipse cx="40" cy="42" rx="13" ry="16" fill="#050810"/>
      <ellipse cx="34" cy="40" rx="2.4" ry="1.6" fill="#00D4AA"/>
      <ellipse cx="46" cy="40" rx="2.4" ry="1.6" fill="#00D4AA"/>
    </svg>
  </div>
);

const AgentMessage = ({ children, time }) => (
  <div style={{ display: 'flex', gap: 10, padding: '0 16px', marginBottom: 16 }}>
    <ChatBubbleAvatar/>
    <div style={{
      maxWidth: 280,
      background: '#141414',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 14,
      borderTopLeftRadius: 4,
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: 13.5, color: '#EDEDED', lineHeight: 1.5 }}>{children}</div>
      <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 6, textAlign: 'right' }}>{time}</div>
    </div>
  </div>
);

const ChatInput = () => (
  <div style={{
    padding: '10px 16px 14px',
    background: '#0A0A0A',
    borderTop: '1px solid rgba(255,255,255,0.04)',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#141414',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 999,
      padding: '6px 6px 6px 14px', height: 44,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M21 11.5a8.5 8.5 0 0 1-17 0V7a4 4 0 0 1 8 0v8a2 2 0 0 1-4 0V8"/>
      </svg>
      <input
        placeholder="Message your agent..."
        style={{
          flex: 1, background: 'transparent', border: 'none', outline: 'none',
          color: '#EDEDED', fontSize: 13.5, fontFamily: 'Inter',
        }}
      />
      <button style={{
        width: 32, height: 32, borderRadius: '50%',
        background: '#00D4AA', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
        boxShadow: '0 0 8px rgba(0,212,170,0.3)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  </div>
);

const ChatTab = () => (
  <>
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingTop: 14 }}>
      {/* Today divider */}
      <div style={{ textAlign: 'center', fontSize: 10.5, color: '#6B6B6B', marginBottom: 14 }}>Today</div>

      <AgentMessage time="9:41 AM">
        Hey — I just finished 12 hands. Won 8, lost 4.<br/>
        Net <span style={{ color: '#00D4AA', fontWeight: 600 }}>+$120.50</span>.
        <div style={{ marginTop: 10 }}>
          Want to review any hands or adjust my strategy?
        </div>
      </AgentMessage>
    </div>
    <ChatInput/>
  </>
);

// ───────── STRATEGY TAB ─────────

const StrategyTab = () => {
  const [aggression, setAggression] = React.useState(72);
  const [bluff, setBluff] = React.useState(35);
  const [tightness, setTightness] = React.useState(28);
  const [risk, setRisk] = React.useState(60);
  const [patience, setPatience] = React.useState(45);

  return (
    <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 0 16px' }}>
      <div style={{ padding: '0 16px 4px' }}>
        <div style={{ fontSize: 13.5, color: '#A1A1A1', lineHeight: 1.5 }}>
          Tune how <span style={{ color: '#EDEDED', fontWeight: 600 }}>Aggressive v1.3</span> plays. Changes apply on next deploy.
        </div>
      </div>

      <div style={{ margin: '14px 16px', background: '#141414', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: '6px 14px' }}>
        <Slider label="Aggression" icon="bet" value={aggression} onChange={setAggression}/>
        <Slider label="Bluff freq" icon="sparkle" value={bluff} onChange={setBluff}/>
        <Slider label="Tightness" icon="shield" value={tightness} onChange={setTightness}/>
        <Slider label="Risk" icon="risk" value={risk} onChange={setRisk}/>
        <Slider label="Patience" icon="clock" value={patience} onChange={setPatience}/>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 8 }}>STYLE TAGS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Tag>Aggressive</Tag>
          <Tag>3-bet heavy</Tag>
          <Tag>Float flops</Tag>
          <Tag color="#A1A1A1">Tight pre</Tag>
          <Tag color="#A1A1A1">Pot control</Tag>
        </div>
      </div>

      <div style={{ padding: '0 16px', marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 8 }}>NOTES TO AGENT</div>
        <div style={{
          background: '#141414',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 12, padding: '12px 14px',
          fontSize: 12.5, color: '#A1A1A1', lineHeight: 1.5, minHeight: 80,
        }}>
          Avoid bluffing into multiway pots. Prefer 3-bets in position.
        </div>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', gap: 10 }}>
        <button style={{
          flex: 1, height: 44, borderRadius: 10,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          color: '#A1A1A1', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
          cursor: 'pointer', fontFamily: 'Inter',
        }}>RESET</button>
        <button style={{
          flex: 2, height: 44, borderRadius: 10,
          background: '#00D4AA', border: 'none',
          color: '#0A0A0A', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em',
          cursor: 'pointer', fontFamily: 'Inter',
          boxShadow: '0 0 12px rgba(0,212,170,0.3)',
        }}>SAVE STRATEGY</button>
      </div>
    </div>
  );
};

// ───────── HISTORY TAB ─────────

const SessionRow = ({ date, hands, result, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12, marginBottom: 8,
  }}>
    <div style={{
      width: 32, height: 32, borderRadius: 8,
      background: 'rgba(0,212,170,0.08)',
      border: '1px solid rgba(0,212,170,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#EDEDED' }}>{date}</div>
      <div style={{ fontSize: 11, color: '#A1A1A1', marginTop: 2 }}>{hands} hands played</div>
    </div>
    <div style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{result}</div>
  </div>
);

const HistoryTab = () => (
  <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 16px' }}>
    <SessionRow date="Today, 9:30 AM" hands={12} result="+$120.50" color="#00D4AA"/>
    <SessionRow date="Yesterday, 8:12 PM" hands={28} result="+$340.00" color="#00D4AA"/>
    <SessionRow date="Yesterday, 2:04 PM" hands={15} result="-$60.00" color="#FF4D4F"/>
    <SessionRow date="May 2, 11:48 AM" hands={42} result="+$210.75" color="#00D4AA"/>
    <SessionRow date="May 1, 7:20 PM" hands={9} result="-$45.00" color="#FF4D4F"/>
  </div>
);

// ───────── SCREEN ─────────

const AgentChatScreen = ({ onBack }) => {
  const [tab, setTab] = React.useState('chat');
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0A0A0A',
      display: 'flex', flexDirection: 'column', paddingTop: 54,
    }}>
      <AgentChatHeader onBack={onBack}/>
      <AgentChatTabs active={tab} onChange={setTab}/>
      {tab === 'chat' && <ChatTab/>}
      {tab === 'strategy' && <StrategyTab/>}
      {tab === 'history' && <HistoryTab/>}
    </div>
  );
};

Object.assign(window, { AgentChatScreen });
