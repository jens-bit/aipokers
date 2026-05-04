// Recent hands list + bottom tab bar

const HandRow = ({ icon, iconColor, title, cards, amount, amountColor }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 4px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div style={{
      width: 26, height: 26, borderRadius: 7,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={icon} size={14} color={iconColor}/>
    </div>
    <div style={{ fontSize: 12, color: '#EDEDED', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
    <div style={{ display: 'flex', gap: 2 }}>
      {cards.map((c, i) => (
        <MiniCard key={i} rank={c[0]} suit={c[1]}/>
      ))}
    </div>
    <div style={{
      fontSize: 12, fontWeight: 600, color: amountColor,
      width: 76, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
    }}>{amount}</div>
  </div>
);

const RecentHands = () => (
  <div style={{
    margin: '16px 16px 16px',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: '12px 14px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
      <div className="label">RECENT HANDS</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: '#00D4AA', cursor: 'pointer' }}>
        View all <Icon name="chevron-right" size={11} color="#00D4AA" strokeWidth={2}/>
      </div>
    </div>
    <HandRow
      icon="trophy" iconColor="#CDB380"
      title="Won vs Balanced v2.1"
      cards={[['A','s'],['K','h'],['Q','c'],['J','d'],['10','s']]}
      amount="+$340.00" amountColor="#00D4AA"
    />
    <HandRow
      icon="bar-chart" iconColor="#00D4AA"
      title="Won vs Bluff Master"
      cards={[['9','h'],['9','s'],['7','c'],['2','d'],['5','h']]}
      amount="+$180.00" amountColor="#00D4AA"
    />
    <div style={{ marginBottom: -11 }}>
      <HandRow
        icon="spade" iconColor="#A1A1A1"
        title="Lost vs Value Bot"
        cards={[['K','d'],['Q','h'],['J','s'],['7','c'],['3','d']]}
        amount="-$120.00" amountColor="#FF4D4F"
      />
    </div>
  </div>
);

const NavTabBar = ({ active = 'agents', onChange }) => {
  const tabs = [
    { id: 'home', name: 'home', label: 'HOME' },
    { id: 'play', name: 'spade', label: 'PLAY' },
    { id: 'agents', name: 'agent', label: 'AGENTS' },
    { id: 'history', name: 'history', label: 'HISTORY' },
    { id: 'profile', name: 'profile', label: 'PROFILE' },
  ];
  return (
    <div style={{
      display: 'flex',
      padding: '10px 4px 6px',
      background: '#0A0A0A',
      borderTop: '1px solid rgba(255,255,255,0.05)',
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <div key={t.id} onClick={() => onChange && onChange(t.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, cursor: 'pointer',
            color: isActive ? '#00D4AA' : '#6B6B6B',
          }}>
            <Icon name={t.name} size={20} color={isActive ? '#00D4AA' : '#6B6B6B'} strokeWidth={1.7}/>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em' }}>{t.label}</div>
          </div>
        );
      })}
    </div>
  );
};

const TabBarBottom = () => <NavTabBar active="agents" onChange={(id) => { if (id === 'home' && window.gotoHome) window.gotoHome(); }}/>;

Object.assign(window, { RecentHands, TabBarBottom, NavTabBar });
