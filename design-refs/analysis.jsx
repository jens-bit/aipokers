// Live analysis tabs section + action queue / autoplay row

const TabBar = ({ active = 0 }) => {
  const tabs = ['LIVE ANALYSIS', 'RANGE', 'HISTORY', 'NOTES'];
  return (
    <div style={{
      display: 'flex', gap: 18, padding: '0 4px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: 14,
    }}>
      {tabs.map((t, i) => (
        <div key={t} style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
          color: i === active ? '#00D4AA' : '#6B6B6B',
          position: 'relative',
          paddingBottom: 12,
          marginBottom: -13,
          borderBottom: i === active ? '2px solid #00D4AA' : '2px solid transparent',
          cursor: 'pointer',
        }}>{t}</div>
      ))}
    </div>
  );
};

const ConfidenceRing = ({ value = 67 }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
        <circle cx="32" cy="32" r={r} fill="none" stroke="#00D4AA" strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 32 32)"/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#EDEDED', lineHeight: 1 }}>{value}%</div>
        <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.06em', color: '#6B6B6B', marginTop: 2 }}>Confidence</div>
      </div>
    </div>
  );
};

const DecisionCard = () => (
  <div style={{
    background: '#141414', border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12, padding: 12, flex: 1, minWidth: 0,
  }}>
    <div className="label" style={{ marginBottom: 8 }}>CURRENT DECISION</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: '#00D4AA', letterSpacing: '-0.02em' }}>Call $120</div>
    <div style={{ fontSize: 11, color: '#A1A1A1', marginTop: 2, marginBottom: 8 }}>
      EV: <span style={{ color: '#EDEDED' }}>+$87.40</span>
    </div>
    <ConfidenceRing value={67}/>
  </div>
);

const ReasoningCard = () => {
  const items = [
    'Top pair, strong kicker',
    'Good pot odds: 21%',
    'Opponent range is wide',
    'Board is favorable',
  ];
  return (
    <div style={{
      background: '#141414', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12, padding: 12, flex: 1.1, minWidth: 0,
    }}>
      <div className="label" style={{ marginBottom: 10 }}>REASONING</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(x => (
          <div key={x} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#EDEDED', lineHeight: 1.3 }}>
            <Icon name="check" size={13} color="#00D4AA" strokeWidth={2.2}/>
            <span>{x}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RangeMatrix = () => {
  // 13x13 grid like a poker hand range chart
  const ranks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
  // generate intensity pattern
  const intensity = (r, c) => {
    if (r === c) return Math.max(0, 1 - r * 0.07);
    if (r < c) {
      const d = c - r;
      return Math.max(0, 0.85 - d * 0.12 - r * 0.04);
    }
    const d = r - c;
    return Math.max(0, 0.55 - d * 0.10 - c * 0.04);
  };
  return (
    <div style={{
      background: '#141414', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12, padding: 10, flex: 1.4, minWidth: 0,
    }}>
      <div className="label" style={{ marginBottom: 8 }}>OPPONENT RANGE</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ width: 11, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingTop: 11 }}>
          {ranks.map(r => (
            <div key={r} style={{ fontSize: 7, color: '#6B6B6B', textAlign: 'right', height: 7, lineHeight: '7px' }}>{r}</div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 2, height: 9 }}>
            {ranks.map(r => (
              <div key={r} style={{ fontSize: 7, color: '#6B6B6B', flex: 1, textAlign: 'center' }}>{r}</div>
            ))}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(13, 1fr)`,
            gap: 1,
          }}>
            {ranks.map((_, ri) => (
              ranks.map((_, ci) => {
                const v = intensity(ri, ci);
                return (
                  <div key={`${ri}-${ci}`} style={{
                    aspectRatio: '1',
                    background: v > 0.05
                      ? `rgba(0, 212, 170, ${Math.min(0.95, v)})`
                      : 'rgba(255,255,255,0.04)',
                    borderRadius: 1,
                  }}/>
                );
              })
            ))}
          </div>
          {/* legend */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 6,
            fontSize: 7, color: '#A1A1A1',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, background: '#00D4AA', borderRadius: 1 }}/> Likely
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, background: 'rgba(0,212,170,0.4)', borderRadius: 1 }}/> Possible
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }}/> Unlikely
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActionRow = () => (
  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
    {/* Action queue */}
    <div style={{
      background: '#141414', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12, padding: 10, flex: 1.2, minWidth: 0,
    }}>
      <div className="label" style={{ marginBottom: 8 }}>ACTION QUEUE</div>
      <div style={{ fontSize: 11, color: '#EDEDED', lineHeight: 1.5 }}>
        If called <span style={{ color: '#6B6B6B' }}>→</span> Bet 65% pot
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <span style={{ fontSize: 11, color: '#EDEDED' }}>On turn</span>
        {[0,1,2,3].map(i => (
          <span key={i} style={{
            width: 18, height: 18, borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#6B6B6B',
          }}>?</span>
        ))}
      </div>
    </div>

    {/* Take action button */}
    <button style={{
      background: 'transparent',
      border: '1.5px solid #00D4AA',
      borderRadius: 12,
      padding: '10px 12px',
      flex: 1.4, minWidth: 0,
      cursor: 'pointer',
      boxShadow: '0 0 16px rgba(0, 212, 170, 0.18), inset 0 0 0 1px rgba(0,212,170,0.1)',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
        color: '#00D4AA',
      }}>TAKE ACTION NOW</div>
      <div style={{ fontSize: 10, color: '#A1A1A1', marginTop: 3 }}>
        Override agent decision
      </div>
    </button>

    {/* Autoplay */}
    <div style={{
      background: '#141414', border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 12, padding: 10, flex: 1, minWidth: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div className="label">AUTOPLAY</div>
        {/* toggle */}
        <div style={{
          width: 30, height: 18, borderRadius: 999,
          background: '#00D4AA',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', top: 2, right: 2,
            width: 14, height: 14, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          }}/>
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#A1A1A1', lineHeight: 1.3 }}>
        Agent will act in 12s
      </div>
    </div>
  </div>
);

const AnalysisSection = () => (
  <div style={{ margin: '16px 16px 0' }}>
    <TabBar />
    <div style={{ display: 'flex', gap: 8 }}>
      <DecisionCard/>
      <ReasoningCard/>
      <RangeMatrix/>
    </div>
    <ActionRow/>
  </div>
);

Object.assign(window, { AnalysisSection });
