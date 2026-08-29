// Replays screen — shareable highlight moments

const ReplayHeading = () => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '6px 16px 14px', gap: 12,
  }}>
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontFamily: '"Playfair Display", Georgia, serif',
        fontSize: 32, fontWeight: 600, color: '#EDEDED',
        letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6,
      }}>Replays</div>
      <div style={{ fontSize: 12.5, color: '#A1A1A1' }}>Your best moments, ready to share.</div>
    </div>
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 32, padding: '0 12px', borderRadius: 999,
      background: 'transparent', border: '1.5px solid rgba(0,212,170,0.6)',
      color: '#00D4AA', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
      cursor: 'pointer', fontFamily: 'Inter', flexShrink: 0,
    }}>
      FILTER
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="14" y2="6"/><circle cx="17" cy="6" r="2"/>
        <line x1="20" y1="12" x2="10" y2="12"/><circle cx="7" cy="12" r="2"/>
        <line x1="4" y1="18" x2="14" y2="18"/><circle cx="17" cy="18" r="2"/>
      </svg>
    </button>
  </div>
);

const ReplayStat = ({ icon, label, value, color }) => (
  <div style={{ flex: 1, padding: '12px 4px', textAlign: 'center', minWidth: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 7 }}>{icon}</div>
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: '#6B6B6B', marginBottom: 4 }}>{label}</div>
    <div style={{
      fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2,
      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px',
    }}>{value}</div>
  </div>
);

const ReplayStatStrip = () => (
  <div style={{
    margin: '0 16px 14px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14, display: 'flex',
  }}>
    <ReplayStat
      label="TOTAL REPLAYS" value="42" color="#00D4AA"
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 9l5 3-5 3z" fill="#00D4AA"/></svg>}
    />
    <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }}/>
    <ReplayStat
      label="TOTAL PROFIT" value="+$1,248.75" color="#00D4AA"
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4"/><path d="M5 4h14v8a7 7 0 0 1-14 0V4z"/><path d="M5 7H2v3a3 3 0 0 0 3 3M19 7h3v3a3 3 0 0 1-3 3"/></svg>}
    />
    <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }}/>
    <ReplayStat
      label="BIGGEST WIN" value="+$520.00" color="#00D4AA"
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2c1.5 4 5 5 5 9 0 3-2 6-5 6s-5-3-5-6c0-2 1-3 1-5 1.5 1 2.5 2 4-4z"/></svg>}
    />
    <div style={{ width: 1, background: 'rgba(255,255,255,0.05)' }}/>
    <ReplayStat
      label="BEST AGENT" value="Aggressive v1.3" color="#00D4AA"
      icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="#00D4AA"/></svg>}
    />
  </div>
);

const FilterChip = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 32, padding: '0 12px', borderRadius: 999,
    background: active ? 'rgba(0,212,170,0.08)' : 'transparent',
    border: active ? '1.5px solid #00D4AA' : '1px solid rgba(255,255,255,0.1)',
    color: active ? '#00D4AA' : '#A1A1A1',
    fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'Inter', flexShrink: 0,
    whiteSpace: 'nowrap',
  }}>
    {icon}
    {label}
  </button>
);

const FilterChipRow = ({ active, onChange }) => (
  <div className="no-scrollbar" style={{
    margin: '0 0 14px',
    padding: '0 16px',
    display: 'flex', gap: 8,
    overflowX: 'auto',
  }}>
    <FilterChip label="All" active={active === 'all'} onClick={() => onChange('all')}
      icon={null}/>
    <FilterChip label="Wins" active={active === 'wins'} onClick={() => onChange('wins')}
      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4"/><path d="M5 4h14v8a7 7 0 0 1-14 0V4z"/></svg>}/>
    <FilterChip label="Bluffs" active={active === 'bluffs'} onClick={() => onChange('bluffs')}
      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9c0-3 3-5 9-5s9 2 9 5v2c0 4-4 8-9 8s-9-4-9-8V9z"/><circle cx="9" cy="11" r="1.5" fill="currentColor"/><circle cx="15" cy="11" r="1.5" fill="currentColor"/></svg>}/>
    <FilterChip label="Losses" active={active === 'losses'} onClick={() => onChange('losses')}
      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/></svg>}/>
    <FilterChip label="Favorites" active={active === 'favorites'} onClick={() => onChange('favorites')}
      icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l3 6 6.5 1-4.7 4.6 1.1 6.5L12 18l-5.9 3.1 1.1-6.5L2.5 10 9 9z"/></svg>}/>
  </div>
);

// ───── Replay card ─────

const ChipStack = ({ x, y, count = 4, color = '#00D4AA' }) => (
  <g transform={`translate(${x},${y})`}>
    {Array.from({ length: count }).map((_, i) => (
      <ellipse key={i} cx="0" cy={-i * 1.5} rx="7" ry="2.5"
        fill={i === count - 1 ? '#0e0e0e' : '#0a0a0a'}
        stroke={color} strokeWidth="0.6" opacity={0.7 + i * 0.05}/>
    ))}
  </g>
);

const TableMini = ({ pot, cards }) => (
  <div style={{
    width: 132, flexShrink: 0,
    background: 'radial-gradient(ellipse at center, #0d1518 0%, #060a0c 80%)',
    border: '1px solid rgba(0,212,170,0.3)',
    borderRadius: 12,
    padding: '10px 8px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* Cards row */}
    <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
      {cards.map((c, i) => (
        <PlayingCard key={i} rank={c[0]} suit={c[1]} w={20} h={28}/>
      ))}
    </div>
    {/* Chips */}
    <svg width="100%" height="22" viewBox="0 0 110 22" style={{ marginTop: 4 }}>
      <ChipStack x={20} y={18} count={5}/>
      <ChipStack x={55} y={18} count={4} color="#FF4D4F"/>
      <ChipStack x={88} y={18} count={3}/>
    </svg>
    {/* Pot */}
    <div style={{ textAlign: 'center', marginTop: 2 }}>
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', color: '#6B6B6B' }}>POT</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#EDEDED', fontVariantNumeric: 'tabular-nums' }}>{pot}</div>
    </div>
    {/* Bot avatar bottom-left */}
    <div style={{
      position: 'absolute', bottom: 6, left: 6,
      width: 22, height: 22, borderRadius: '50%',
      background: '#0a0f17',
      border: '1px solid rgba(0,212,170,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="16" height="16" viewBox="0 0 60 60">
        <ellipse cx="22" cy="30" rx="3" ry="2.2" fill="#00D4AA"/>
        <ellipse cx="38" cy="30" rx="3" ry="2.2" fill="#00D4AA"/>
        <rect x="10" y="14" width="40" height="34" rx="14" fill="none" stroke="rgba(0,212,170,0.4)" strokeWidth="1"/>
      </svg>
    </div>
  </div>
);

const ReplayBadge = ({ icon, label, color = '#00D4AA' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    height: 22, padding: '0 8px', borderRadius: 5,
    background: `${color}1F`,
    border: `1px solid ${color}55`,
    color, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
    whiteSpace: 'nowrap',
  }}>
    {icon}
    {label}
  </span>
);

const ReplayCard = ({ badge, title, stakes, time, agent, amount, amountColor, bb, cards, pot, last }) => (
  <div style={{
    margin: '0 16px 12px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '12px',
    display: 'flex', gap: 10,
  }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {badge}
      <TableMini cards={cards} pot={pot}/>
    </div>

    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
        <div style={{
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 17, fontWeight: 600, color: '#EDEDED',
          letterSpacing: '-0.01em', lineHeight: 1.15,
        }}>{title}</div>
        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B6B6B" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l3 6 6.5 1-4.7 4.6 1.1 6.5L12 18l-5.9 3.1 1.1-6.5L2.5 10 9 9z"/>
          </svg>
        </button>
      </div>

      <div style={{ fontSize: 10.5, color: '#6B6B6B', marginTop: 5 }}>
        {stakes}
      </div>
      <div style={{ fontSize: 10.5, color: '#6B6B6B', marginTop: 1 }}>
        {time}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 8 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          height: 22, padding: '0 8px', borderRadius: 999,
          background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)',
          fontSize: 10, color: '#00D4AA', whiteSpace: 'nowrap', minWidth: 0,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="#00D4AA">
            <rect x="6" y="9" width="12" height="10" rx="3"/>
          </svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent}</span>
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: amountColor, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{amount}</div>
          <div style={{ fontSize: 9.5, color: '#6B6B6B', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{bb}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button style={{
          flex: 1, height: 30, borderRadius: 7,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
          color: '#EDEDED', fontSize: 11, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          cursor: 'pointer', fontFamily: 'Inter',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#EDEDED"><path d="M8 5v14l11-7z"/></svg>
          Watch
        </button>
        <button style={{
          flex: 1, height: 30, borderRadius: 7,
          background: 'transparent', border: '1px solid rgba(0,212,170,0.4)',
          color: '#00D4AA', fontSize: 11, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          cursor: 'pointer', fontFamily: 'Inter',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v12M6 10l6-6 6 6"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>
          </svg>
          Share
        </button>
      </div>
    </div>
  </div>
);

const ReplaysScreen = () => {
  const [filter, setFilter] = React.useState('all');
  return (
    <div style={{
      width: '100%', height: '100%', background: '#0A0A0A',
      display: 'flex', flexDirection: 'column', paddingTop: 54,
    }}>
      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 14 }}>
        <ReplayHeading/>
        <ReplayStatStrip/>
        <FilterChipRow active={filter} onChange={setFilter}/>

        <ReplayCard
          badge={<ReplayBadge label="BEST WIN" color="#00D4AA" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h8M12 17v4"/><path d="M5 4h14v8a7 7 0 0 1-14 0V4z"/></svg>}/>}
          title="Won vs Balanced v2.1"
          stakes="NLHE · 0.10 / 0.25 TON"
          time="May 18, 2026 · 9:41 PM"
          agent="Aggressive v1.3"
          amount="+$520.00" amountColor="#00D4AA" bb="200 BB"
          cards={[['A','s'],['K','h'],['Q','c'],['J','d'],['10','s']]}
          pot="$1,040"
        />

        <ReplayCard
          badge={<ReplayBadge label="BIG BLUFF" color="#00D4AA" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9c0-3 3-5 9-5s9 2 9 5v2c0 4-4 8-9 8s-9-4-9-8V9z"/></svg>}/>}
          title="Big bluff vs LooseBot"
          stakes="NLHE · 0.10 / 0.25 TON"
          time="May 18, 2026 · 8:32 PM"
          agent="Aggressive v1.3"
          amount="+$210.00" amountColor="#00D4AA" bb="84 BB"
          cards={[['9','c'],['9','h'],['3','d'],['K','s'],['2','c']]}
          pot="$690"
        />

        <ReplayCard
          badge={<ReplayBadge label="COOLER" color="#5BA9F4" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="#5BA9F4"><path d="M12 2l1 4 4-1-1 4 4 1-4 1 1 4-4-1-1 4-1-4-4 1 1-4-4-1 4-1-1-4 4 1z"/></svg>}/>}
          title="Cooler vs ValueBot"
          stakes="NLHE · 0.10 / 0.25 TON"
          time="May 18, 2026 · 7:15 PM"
          agent="Aggressive v1.3"
          amount="-$120.00" amountColor="#FF4D4F" bb="-48 BB"
          cards={[['Q','h'],['J','c'],['8','s'],['8','d'],['4','c']]}
          pot="$480"
        />

        <ReplayCard
          badge={<ReplayBadge label="SOLID WIN" color="#00D4AA" icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>}/>}
          title="Won vs Passive Bot"
          stakes="NLHE · 0.10 / 0.25 TON"
          time="May 18, 2026 · 6:02 PM"
          agent="Aggressive v1.3"
          amount="+$180.00" amountColor="#00D4AA" bb="72 BB"
          cards={[['A','s'],['7','h'],['6','c'],['2','d'],['J','s']]}
          pot="$360"
        />
      </div>
    </div>
  );
};

Object.assign(window, { ReplaysScreen });
