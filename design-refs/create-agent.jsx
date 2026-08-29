// Create Agent — chat-based assistant screen

const ScreenHeader = ({ title, leadingAction, trailing }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 12px 12px', gap: 8,
  }}>
    <button onClick={leadingAction} style={{
      width: 36, height: 36, borderRadius: 10,
      background: 'transparent', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#EDEDED', cursor: 'pointer', padding: 0,
    }}>
      <Icon name="arrow-left" size={22}/>
    </button>
    <div style={{
      flex: 1, fontSize: 17, fontWeight: 600, color: '#EDEDED',
      textAlign: 'center', letterSpacing: '-0.01em',
    }}>{title}</div>
    {trailing || <div style={{ width: 36 }}/>}
  </div>
);

const TemplatesPill = () => (
  <button style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 32, padding: '0 12px', borderRadius: 8,
    background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)',
    color: '#EDEDED', fontSize: 12, fontWeight: 600,
    cursor: 'pointer',
  }}>
    <Icon name="templates" size={13} color="#EDEDED" strokeWidth={1.6}/>
    Templates
  </button>
);

const AgentBubbleAvatar = () => (
  <div style={{
    width: 28, height: 28, borderRadius: '50%',
    background: '#0e1418',
    border: '1px solid rgba(0, 212, 170, 0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    <Icon name="spade" size={13} color="#00D4AA"/>
  </div>
);

const ChatBubble = ({ from = 'agent', children, time = '9:41 AM' }) => {
  const isAgent = from === 'agent';
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      marginBottom: 14,
      flexDirection: isAgent ? 'row' : 'row-reverse',
    }}>
      {isAgent && <AgentBubbleAvatar/>}
      <div style={{ maxWidth: '78%' }}>
        <div style={{
          background: isAgent ? '#1A1A1A' : 'rgba(0, 212, 170, 0.16)',
          border: isAgent ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0, 212, 170, 0.3)',
          borderRadius: 14,
          padding: '10px 12px',
          fontSize: 13, color: '#EDEDED', lineHeight: 1.4,
        }}>{children}</div>
        <div style={{
          fontSize: 10, color: '#6B6B6B', marginTop: 4,
          textAlign: isAgent ? 'left' : 'right',
        }}>{time}</div>
      </div>
    </div>
  );
};

const QuickReply = ({ letter, children, onClick, selected = false }) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 10,
    width: '100%',
    padding: '10px 12px',
    background: selected ? 'rgba(0, 212, 170, 0.10)' : '#141414',
    border: selected ? '1px solid rgba(0, 212, 170, 0.4)' : '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#EDEDED', fontSize: 12.5,
    cursor: 'pointer', textAlign: 'left',
    fontFamily: 'Inter',
  }}>
    <span style={{
      width: 20, height: 20, borderRadius: 5,
      background: selected ? '#00D4AA' : 'rgba(255,255,255,0.06)',
      color: selected ? '#0A0A0A' : '#A1A1A1',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 700,
      flexShrink: 0,
    }}>{letter}</span>
    <span>{children}</span>
  </button>
);

const SuggestedStart = ({ icon, iconColor, children, onClick }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex', alignItems: 'center', gap: 7,
    height: 32, padding: '0 12px', borderRadius: 999,
    background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)',
    color: '#EDEDED', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'Inter', whiteSpace: 'nowrap',
  }}>
    <Icon name={icon} size={13} color={iconColor} strokeWidth={1.7}/>
    {children}
  </button>
);

const ChatInput = ({ onSend }) => {
  const [val, setVal] = React.useState('');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 12px',
      background: '#0A0A0A',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 999, padding: '0 14px', height: 40,
      }}>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="Describe your strategy..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#EDEDED', fontSize: 13, fontFamily: 'Inter',
          }}
        />
      </div>
      <button onClick={() => { onSend && onSend(val); setVal(''); }} style={{
        width: 40, height: 40, borderRadius: '50%',
        background: '#00D4AA', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
        boxShadow: '0 0 12px rgba(0,212,170,0.3)',
      }}>
        <Icon name="spade" size={16} color="#0A0A0A"/>
      </button>
    </div>
  );
};

// Conversation script — advances through steps as user clicks chips
const SCRIPT = [
  {
    agent: <>Hi! I'm your poker strategy assistant.<br/><br/>Describe how you want your agent to play and I'll help build it with you.</>,
  },
  {
    user: 'I want an aggressive player that bluffs a lot and puts pressure on weak opponents.',
    agent: <>Got it — an aggressive style with high bluff frequency and pressure on weak players.<br/><br/>What's the main goal for this agent?</>,
    options: [
      { letter: 'A', text: 'Maximize chip accumulation' },
      { letter: 'B', text: 'Minimize risk / stay safe' },
    ],
  },
  {
    user: 'Maximize chip accumulation',
    agent: <>Perfect. One more thing — how should it adapt during the game?</>,
    options: [
      { letter: 'A', text: 'Adapt quickly to opponent behavior' },
      { letter: 'B', text: 'Stay consistent, minimal adjustments' },
      { letter: 'C', text: 'Mix it up occasionally' },
    ],
  },
  {
    user: 'Adapt quickly to opponent behavior',
    agent: <>Awesome! I've put together a custom strategy for your agent.<br/><br/>Here's a preview →</>,
    cta: 'Generate Agent',
  },
];

const CreateAgentScreen = ({ onGenerate, onBack }) => {
  const [step, setStep] = React.useState(0);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [step]);

  const advance = () => setStep(s => Math.min(s + 1, SCRIPT.length - 1));
  const visible = SCRIPT.slice(0, step + 1);
  const last = SCRIPT[step];

  return (
    <div style={{
      width: '100%', height: '100%', background: '#0A0A0A',
      display: 'flex', flexDirection: 'column', paddingTop: 54,
    }}>
      <ScreenHeader title="Create Agent" leadingAction={onBack} trailing={<TemplatesPill/>}/>
      <div style={{
        padding: '0 16px 12px', fontSize: 12, color: '#A1A1A1',
      }}>Describe how your agent should play.</div>

      <div ref={scrollRef} className="no-scrollbar" style={{
        flex: 1, overflowY: 'auto',
        padding: '4px 14px 12px',
      }}>
        {visible.map((s, i) => (
          <React.Fragment key={i}>
            {s.user && <ChatBubble from="user" time="9:41 AM">{s.user}</ChatBubble>}
            {s.agent && (
              <ChatBubble from="agent" time={['9:41 AM','9:41 AM','9:42 AM','9:43 AM'][i]}>
                {s.agent}
                {i === step && s.options && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    {s.options.map(o => (
                      <QuickReply key={o.letter} letter={o.letter} onClick={advance}>
                        {o.text}
                      </QuickReply>
                    ))}
                  </div>
                )}
                {i === step && s.cta && (
                  <button onClick={onGenerate} style={{
                    marginTop: 10, width: '100%',
                    height: 40, borderRadius: 8,
                    background: '#00D4AA', border: 'none',
                    color: '#0A0A0A', fontSize: 13, fontWeight: 700,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    boxShadow: '0 0 14px rgba(0,212,170,0.3)',
                  }}>{s.cta}</button>
                )}
              </ChatBubble>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Suggested starts */}
      <div style={{ padding: '8px 14px 8px' }}>
        <div className="label" style={{ marginBottom: 8 }}>SUGGESTED STARTS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <SuggestedStart icon="shield" iconColor="#00D4AA" onClick={advance}>Play tight and safe</SuggestedStart>
          <SuggestedStart icon="sparkle" iconColor="#CDB380" onClick={advance}>Bluff a lot</SuggestedStart>
          <SuggestedStart icon="target" iconColor="#9B7BFF" onClick={advance}>Exploit weak players</SuggestedStart>
          <SuggestedStart icon="scales" iconColor="#00A8BA" onClick={advance}>Balanced strategy</SuggestedStart>
        </div>
      </div>

      <ChatInput onSend={advance}/>
    </div>
  );
};

Object.assign(window, { CreateAgentScreen, ScreenHeader });
