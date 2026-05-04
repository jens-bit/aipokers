// Play screen — human vs AI live game
// phase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown'

const PlayHeader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px 12px',
  }}>
    <Logo/>
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
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Icon name="bar-chart" size={20} color="#EDEDED" strokeWidth={1.7}/>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EDEDED" strokeWidth="1.7" strokeLinecap="round">
        <path d="M3 6h18M3 12h18M3 18h18"/>
      </svg>
    </div>
  </div>
);

const TimerRing = ({ value = 12 }) => {
  const r = 18, c = 2 * Math.PI * r;
  const off = c * (1 - value / 30);
  return (
    <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2"/>
        <circle cx="22" cy="22" r={r} fill="none" stroke="#00D4AA" strokeWidth="2"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 22 22)"/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#EDEDED' }}>{value}</div>
    </div>
  );
};

const OpponentRow = () => (
  <div style={{
    margin: '0 16px 14px', padding: '12px 14px',
    background: '#141414', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <AgentAvatar size={44}/>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#EDEDED', whiteSpace: 'nowrap' }}>Aggressive v1.3</span>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.35)', color: '#00D4AA', letterSpacing: '0.06em' }}>AI</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#A1A1A1' }}>
        Thinking
        <span style={{ display: 'flex', gap: 3 }}>
          {[0,1,2].map(i => (
            <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#00D4AA', opacity: 0.4 + i*0.2, animation: `pulse 1.4s infinite ${i*0.15}s` }}/>
          ))}
        </span>
      </div>
    </div>
    <div style={{ display: 'flex', gap: 4, marginRight: 4 }}>
      <CardBack w={30} h={42} branded/>
      <CardBack w={30} h={42} branded/>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#EDEDED' }}>$1,820</div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#00D4AA' }}>BB</div>
    </div>
    <TimerRing value={12}/>
  </div>
);

const TableWatermark = ({ size = 70 }) => (
  <svg width={size} height={size * 1.18} viewBox="0 0 22 26" style={{ opacity: 0.18 }}>
    <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
      fill="#00D4AA" stroke="#00D4AA" strokeWidth="0.4"/>
    <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke="#0a1212" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
  </svg>
);

const PlayTable = ({ phase, pot }) => {
  const board = ['As', 'Kh', 'Qc', 'Jd', '10s'];
  const visible =
    phase === 'flop' ? 3 :
    phase === 'turn' ? 4 :
    phase === 'river' || phase === 'showdown' ? 5 : 0;

  return (
    <div style={{
      margin: '0 16px 14px', padding: '22px 16px 26px',
      background: 'radial-gradient(ellipse at center, #1a2a2c 0%, #0f1818 70%, #0a1212 100%)',
      border: '1px solid rgba(0,212,170,0.18)', borderRadius: 999,
      position: 'relative', minHeight: 280,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div className="label" style={{ color: '#A1A1A1', marginBottom: 4 }}>POT</div>
        <div style={{ fontSize: 34, fontWeight: 700, color: '#EDEDED', letterSpacing: '-0.02em', lineHeight: 1 }}>${pot}</div>
        <div style={{ fontSize: 10.5, color: '#6B6B6B', marginTop: 4 }}>No Limit Hold'em</div>
      </div>

      {visible === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 90 }}>
          <TableWatermark size={90}/>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12, minHeight: 80 }}>
          {board.slice(0, visible).map((c, i) => (
            <PlayingCard key={i} rank={c.slice(0, -1)} suit={c.slice(-1)} w={50} h={68}/>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14 }}>
        <Icon name="chip" size={16} color="#00D4AA"/>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#00D4AA' }}>${pot}</span>
      </div>
    </div>
  );
};

const YouRow = ({ phase }) => {
  const showCards = phase !== 'preflop';
  return (
    <div style={{
      margin: '0 16px 12px', padding: '10px 12px',
      background: '#141414',
      border: '1px solid rgba(0,212,170,0.4)', borderRadius: 14,
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 0 16px rgba(0,212,170,0.18)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: '#0e1418', border: '1px solid rgba(0,212,170,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="spade" size={16} color="#00D4AA"/>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#EDEDED' }}>You</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#A1A1A1' }}>Stack <span style={{ color: '#EDEDED', fontWeight: 600 }}>$2,340</span></span>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#00D4AA', padding: '1px 5px', borderRadius: 4, background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.35)', letterSpacing: '0.06em' }}>BTN</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {showCards ? (
          <>
            <PlayingCard rank="K" suit="s" w={36} h={50}/>
            <PlayingCard rank="Q" suit="h" w={36} h={50}/>
          </>
        ) : (
          <>
            <CardBack w={36} h={50} branded/>
            <CardBack w={36} h={50} branded/>
          </>
        )}
      </div>
    </div>
  );
};

// Compact street/status indicator shown when it's NOT your turn
const WaitingStrip = ({ phase }) => {
  const streetLabel = phase === 'preflop' ? 'Pre-flop' : phase === 'flop' ? 'Flop' : phase === 'turn' ? 'Turn' : 'River';
  const waitText = phase === 'preflop' ? 'Dealing cards...' : 'Opponent thinking';
  return (
    <div style={{
      margin: '0 16px 12px', padding: '10px 14px',
      background: '#141414', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="label">{streetLabel.toUpperCase()}</span>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }}/>
        <span style={{ fontSize: 11.5, color: '#A1A1A1' }}>{waitText}</span>
      </div>
      <span style={{ display: 'flex', gap: 3 }}>
        {[0,1,2].map(i => (
          <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#00D4AA', opacity: 0.4 + i*0.2, animation: `pulse 1.4s infinite ${i*0.15}s` }}/>
        ))}
      </span>
    </div>
  );
};

const InfoStrip = ({ phase }) => {
  const isPreflop = phase === 'preflop';
  const dotIndex = phase === 'preflop' ? 0 : phase === 'flop' ? 1 : phase === 'turn' ? 2 : 3;
  const streetLabel = isPreflop ? 'Pre-flop' : phase === 'flop' ? 'Flop' : phase === 'turn' ? 'Turn' : 'River';

  return (
    <div style={{
      margin: '0 16px 12px', padding: '10px 8px',
      background: '#141414', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12, display: 'flex',
    }}>
      <div style={{ flex: 1, padding: '0 8px' }}>
        <div className="label" style={{ marginBottom: 4 }}>STREET</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#00D4AA' }}>{streetLabel}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {[0,1,2,3].map(i => (
            <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i === dotIndex ? '#00D4AA' : 'rgba(255,255,255,0.1)' }}/>
          ))}
        </div>
      </div>
      <div style={{ flex: 1.3, padding: '0 8px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="label-accent" style={{ marginBottom: 4 }}>YOUR TURN</div>
        <div style={{ fontSize: 12, color: '#EDEDED' }}>You have <span style={{ fontWeight: 700 }}>12s</span></div>
        <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: '60%', height: '100%', background: '#00D4AA', boxShadow: '0 0 6px rgba(0,212,170,0.6)' }}/>
        </div>
      </div>
      <div style={{ flex: 1, padding: '0 8px', textAlign: 'right' }}>
        <div className="label" style={{ marginBottom: 4 }}>ACTION TO YOU</div>
        {isPreflop ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#6B6B6B', lineHeight: 1 }}>—</div>
            <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 4 }}>Awaiting deal</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#00D4AA' }}>$120</div>
            <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 2 }}>Min raise</div>
          </>
        )}
      </div>
    </div>
  );
};

const QuickSize = ({ x, amt, selected }) => (
  <div style={{
    flex: 1, padding: '6px 4px', borderRadius: 8,
    background: selected ? 'rgba(0,212,170,0.10)' : 'transparent',
    border: selected ? '1.5px solid #00D4AA' : '1px solid rgba(255,255,255,0.08)',
    textAlign: 'center', cursor: 'pointer',
  }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: selected ? '#00D4AA' : '#EDEDED' }}>{x}</div>
    <div style={{ fontSize: 9, color: selected ? '#00D4AA' : '#6B6B6B', fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{amt}</div>
  </div>
);

const BetControls = () => {
  const [val, setVal] = React.useState(120);
  const trackRef = React.useRef(null);
  const drag = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const v = Math.round(120 + Math.max(0, Math.min(1, x / r.width)) * (2340 - 120));
    setVal(v);
  };
  const start = (e) => {
    e.preventDefault();
    drag(e);
    const move = (ev) => drag(ev);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move);
    window.addEventListener('touchend', up);
  };
  const pct = ((val - 120) / (2340 - 120)) * 100;
  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '0 4px', height: 36, flexShrink: 0,
        }}>
          <button onClick={() => setVal(v => Math.max(120, v - 10))} style={{ width: 24, height: 28, background: 'transparent', border: 'none', color: '#A1A1A1', fontSize: 16, cursor: 'pointer', padding: 0 }}>−</button>
          <input value={val} onChange={e => setVal(parseInt(e.target.value) || 0)} style={{ width: 48, background: 'transparent', border: 'none', outline: 'none', color: '#00D4AA', fontSize: 14, fontWeight: 700, textAlign: 'center', fontFamily: 'Inter' }}/>
          <button onClick={() => setVal(v => Math.min(2340, v + 10))} style={{ width: 24, height: 28, background: 'transparent', border: 'none', color: '#A1A1A1', fontSize: 16, cursor: 'pointer', padding: 0 }}>+</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flex: 1 }}>
          <QuickSize x="2.5x" amt="$300"/>
          <QuickSize x="3x" amt="$360"/>
          <QuickSize x="4x" amt="$480"/>
          <QuickSize x="All-in" amt="$2,340"/>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 10, color: '#6B6B6B', width: 24 }}>Min</span>
        <div ref={trackRef} onMouseDown={start} onTouchStart={start} style={{ flex: 1, height: 18, position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 8, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1 }}/>
          <div style={{ position: 'absolute', left: 0, top: 8, width: `${pct}%`, height: 2, background: '#00D4AA', borderRadius: 1, boxShadow: '0 0 6px rgba(0,212,170,0.5)' }}/>
          <div style={{ position: 'absolute', left: `${pct}%`, top: 1, width: 16, height: 16, borderRadius: '50%', background: '#00D4AA', transform: 'translateX(-50%)', boxShadow: '0 0 8px rgba(0,212,170,0.6)' }}/>
        </div>
        <span style={{ fontSize: 10, color: '#6B6B6B', textAlign: 'right', width: 24 }}>Max</span>
      </div>
    </div>
  );
};

const ActionBtns = ({ phase }) => {
  const isPreflop = phase === 'preflop';
  return (
    <div style={{ display: 'flex', gap: 8, margin: '0 16px 12px', opacity: isPreflop ? 0.55 : 1 }}>
      <button disabled={isPreflop} style={{
        flex: 1, height: 50, borderRadius: 12,
        background: 'transparent', border: '1.5px solid rgba(255,255,255,0.15)',
        color: '#EDEDED', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em',
        cursor: isPreflop ? 'not-allowed' : 'pointer', fontFamily: 'Inter',
      }}>FOLD</button>
      <button disabled={isPreflop} style={{
        flex: 1.2, height: 50, borderRadius: 12,
        background: 'transparent', border: '1.5px solid #00D4AA',
        color: '#00D4AA', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
        cursor: isPreflop ? 'not-allowed' : 'pointer', fontFamily: 'Inter',
      }}>{isPreflop ? 'CALL —' : 'CALL $120'}</button>
      <button disabled={isPreflop} style={{
        flex: 1.4, height: 50, borderRadius: 12,
        background: isPreflop ? '#1A1A1A' : '#00D4AA',
        border: isPreflop ? '1.5px solid rgba(0,212,170,0.3)' : 'none',
        color: isPreflop ? '#00D4AA' : '#0A0A0A',
        fontSize: 13, fontWeight: 700, letterSpacing: '0.06em',
        cursor: isPreflop ? 'not-allowed' : 'pointer', fontFamily: 'Inter',
        boxShadow: isPreflop ? 'none' : '0 0 16px rgba(0,212,170,0.35)',
      }}>{isPreflop ? 'RAISE —' : 'RAISE $120'}</button>
    </div>
  );
};

const FooterActions = () => (
  <div style={{
    margin: '0 16px 8px', padding: '10px 4px 0',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#A1A1A1', cursor: 'pointer', letterSpacing: '0.06em' }}>
      <Icon name="history" size={13} color="#A1A1A1" strokeWidth={1.7}/>
      HAND HISTORY
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#A1A1A1', cursor: 'pointer', letterSpacing: '0.06em' }}>
      <Icon name="profile" size={13} color="#A1A1A1" strokeWidth={1.7}/>
      TABLE INFO <span style={{ color: '#00D4AA' }}>6 / 6</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#A1A1A1', cursor: 'pointer', letterSpacing: '0.06em' }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>
      </svg>
      LEAVE TABLE
    </div>
  </div>
);

const PlayScreen = ({ phase = 'preflop', myTurn = false }) => {
  const pot = phase === 'preflop' ? 0 : phase === 'flop' ? 340 : phase === 'turn' ? 520 : 980;
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0A0A0A',
      display: 'flex', flexDirection: 'column', paddingTop: 54,
    }}>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 4 }}>
        <PlayHeader/>
        <OpponentRow/>
        <PlayTable phase={phase} pot={pot}/>
        <YouRow phase={phase}/>
        {myTurn ? (
          <>
            <InfoStrip phase={phase}/>
            <BetControls/>
            <ActionBtns phase={phase}/>
          </>
        ) : (
          <WaitingStrip phase={phase}/>
        )}
        <FooterActions/>
      </div>
    </div>
  );
};

Object.assign(window, { PlayScreen });
