// Agent Preview screen — full configurator with live sliders/tags

const Slider = ({ label, icon, value, onChange, min = 0, max = 100 }) => {
  const trackRef = React.useRef(null);
  const drag = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    const v = Math.round(min + (Math.max(0, Math.min(1, x / r.width))) * (max - min));
    onChange(v);
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
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <Icon name={icon} size={14} color="#00D4AA" strokeWidth={1.7}/>
      <div style={{ fontSize: 12.5, color: '#EDEDED', width: 100, flexShrink: 0 }}>{label}</div>
      <div ref={trackRef} onMouseDown={start} onTouchStart={start} style={{
        flex: 1, height: 18, position: 'relative', cursor: 'pointer',
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 8,
          height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1,
        }}/>
        <div style={{
          position: 'absolute', left: 0, top: 8, width: `${pct}%`,
          height: 2, background: '#00D4AA', borderRadius: 1,
          boxShadow: '0 0 6px rgba(0,212,170,0.5)',
        }}/>
        <div style={{
          position: 'absolute', left: `${pct}%`, top: 1,
          width: 16, height: 16, borderRadius: '50%',
          background: '#00D4AA', transform: 'translateX(-50%)',
          boxShadow: '0 0 8px rgba(0,212,170,0.6)',
        }}/>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#EDEDED', width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{value}%</div>
    </div>
  );
};

const Section = ({ title, info = true, right, children }) => (
  <div style={{ margin: '0 16px 16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="label">{title}</div>
        {info && <Icon name="info" size={11} color="#6B6B6B" strokeWidth={1.6}/>}
      </div>
      {right}
    </div>
    {children}
  </div>
);

const Tag = ({ children, color = '#00D4AA' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    height: 22, padding: '0 8px', borderRadius: 5,
    background: `${color}1F`,
    border: `1px solid ${color}55`,
    color, fontSize: 11, fontWeight: 600,
    whiteSpace: 'nowrap',
  }}>{children}</span>
);

const FocusCard = ({ icon, label, selected, onClick }) => (
  <div onClick={onClick} style={{
    flex: 1, minWidth: 0,
    background: selected ? 'rgba(0, 212, 170, 0.10)' : '#141414',
    border: selected ? '1.5px solid #00D4AA' : '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10, padding: '10px 6px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    cursor: 'pointer', position: 'relative',
  }}>
    {selected && (
      <div style={{
        position: 'absolute', top: 4, right: 4,
        width: 14, height: 14, borderRadius: '50%',
        background: '#00D4AA', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="check" size={9} color="#0A0A0A" strokeWidth={3}/>
      </div>
    )}
    <Icon name={icon} size={20} color={selected ? '#00D4AA' : '#A1A1A1'} strokeWidth={1.6}/>
    <div style={{ fontSize: 10, fontWeight: 600, color: selected ? '#00D4AA' : '#A1A1A1', textAlign: 'center', lineHeight: 1.1 }}>{label}</div>
  </div>
);

const SegBtn = ({ children, selected, onClick }) => (
  <button onClick={onClick} style={{
    flex: 1, height: 34, borderRadius: 7,
    background: selected ? 'transparent' : 'transparent',
    border: selected ? '1.5px solid #00D4AA' : '1px solid rgba(255,255,255,0.08)',
    color: selected ? '#00D4AA' : '#A1A1A1',
    fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter',
  }}>{children}</button>
);

const Dropdown = ({ value, fullWidth = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 36, padding: '0 12px', borderRadius: 8,
    background: '#141414', border: '1px solid rgba(255,255,255,0.08)',
    color: '#EDEDED', fontSize: 12.5,
    width: fullWidth ? '100%' : 'auto', minWidth: 110,
    cursor: 'pointer',
  }}>
    <span>{value}</span>
    <Icon name="chevron-down" size={14} color="#6B6B6B" strokeWidth={1.7}/>
  </div>
);

const BehaviorRow = ({ icon, title, sub, value }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div style={{
      width: 30, height: 30, borderRadius: 8,
      background: 'rgba(0,212,170,0.06)',
      border: '1px solid rgba(0,212,170,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon name={icon} size={14} color="#00D4AA" strokeWidth={1.7}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: '#EDEDED' }}>{title}</div>
      <div style={{ fontSize: 10.5, color: '#6B6B6B', marginTop: 1 }}>{sub}</div>
    </div>
    <Dropdown value={value}/>
  </div>
);

const PreviewAvatar = () => (
  <div style={{
    width: 60, height: 60, borderRadius: '50%',
    background: '#0e1418',
    border: '1px solid rgba(0, 212, 170, 0.3)',
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }}>
    <svg width="42" height="42" viewBox="0 0 40 40">
      <defs>
        <linearGradient id="prevHood" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3a4d6b"/>
          <stop offset="1" stopColor="#1a2030"/>
        </linearGradient>
      </defs>
      <path d="M20 4 C12 4 7 10 7 18 L7 32 C7 36 10 38 14 38 L26 38 C30 38 33 36 33 32 L33 18 C33 10 28 4 20 4 Z" fill="url(#prevHood)"/>
      <ellipse cx="20" cy="22" rx="7" ry="9" fill="#0a0f17"/>
      <circle cx="17" cy="20" r="1" fill="#00D4AA" opacity="0.7"/>
      <circle cx="23" cy="20" r="1" fill="#00D4AA" opacity="0.7"/>
    </svg>
    <div style={{
      position: 'absolute', bottom: 0, right: 0,
      width: 22, height: 22, borderRadius: '50%',
      background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer',
    }}>
      <Icon name="edit" size={10} color="#EDEDED" strokeWidth={1.7}/>
    </div>
  </div>
);

const AgentPreviewScreen = ({ onCreate, onBack }) => {
  const [aggression, setAggression] = React.useState(80);
  const [tightness, setTightness] = React.useState(35);
  const [bluff, setBluff] = React.useState(75);
  const [patience, setPatience] = React.useState(40);
  const [adapt, setAdapt] = React.useState(85);
  const [focus, setFocus] = React.useState('chip');
  const [game, setGame] = React.useState('cash');

  // playstyle bar position derived from aggression
  const playstylePos = aggression;
  const styleLabel = aggression > 70 ? 'Aggressive' : aggression < 35 ? 'Passive' : 'Balanced';

  // dynamic tags
  const tags = [];
  tags.push(aggression > 70 ? 'Aggressive' : aggression < 35 ? 'Passive' : 'Balanced');
  if (bluff > 60) tags.push('High Bluff');
  if (adapt > 70) tags.push('Adaptable');
  else if (adapt < 35) tags.push('Consistent');
  if (tightness > 65) tags.push('Tight');

  const focusLabels = {
    win: 'Maximize win rate',
    chip: 'Maximize chip accumulation',
    survival: 'Survive longer',
    exploit: 'Exploit opponents',
    balanced: 'Stay balanced',
  };

  return (
    <div style={{
      width: '100%', height: '100%', background: '#0A0A0A',
      display: 'flex', flexDirection: 'column', paddingTop: 54,
    }}>
      <ScreenHeader title="Agent Preview" leadingAction={onBack} trailing={
        <button style={{
          height: 32, padding: '0 12px', borderRadius: 8,
          background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)',
          color: '#EDEDED', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>Save Draft</button>
      }/>

      <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 4 }}>
        {/* Identity */}
        <div style={{
          margin: '0 16px 16px',
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <PreviewAvatar/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#EDEDED', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Pressure v1.0</span>
              <Icon name="edit" size={13} color="#6B6B6B" strokeWidth={1.7}/>
            </div>
            <div style={{ fontSize: 11.5, color: '#A1A1A1', lineHeight: 1.4, marginBottom: 8 }}>
              Aggressive player that bluffs often and puts strong pressure on weak opponents to maximize chips.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {tags.map((t, i) => (
                <Tag key={t} color={i === 0 ? '#00D4AA' : i === 1 ? '#CDB380' : '#9B7BFF'}>{t}</Tag>
              ))}
            </div>
          </div>
        </div>

        {/* Playstyle */}
        <Section title="PLAYSTYLE" right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#A1A1A1' }}>
            Preset: <span style={{ color: '#00D4AA', fontWeight: 600 }}>Custom</span>
            <Icon name="chevron-down" size={11} color="#00D4AA" strokeWidth={2}/>
          </div>
        }>
          <div style={{
            background: '#141414', border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: 12, padding: '6px 12px',
          }}>
            <Slider label="Aggression" icon="risk" value={aggression} onChange={setAggression}/>
            <Slider label="Tightness" icon="shield" value={tightness} onChange={setTightness}/>
            <Slider label="Bluff Frequency" icon="sparkle" value={bluff} onChange={setBluff}/>
            <Slider label="Patience" icon="clock" value={patience} onChange={setPatience}/>
            <Slider label="Adaptability" icon="target" value={adapt} onChange={setAdapt}/>
          </div>
          {/* Playstyle bar */}
          <div style={{ marginTop: 12, padding: '0 4px' }}>
            <div style={{
              position: 'relative', height: 4, borderRadius: 2,
              background: 'linear-gradient(90deg, #6B6B6B 0%, #888 50%, #00D4AA 100%)',
              opacity: 0.3,
            }}/>
            <div style={{ position: 'relative', height: 0 }}>
              <div style={{
                position: 'absolute', top: -10, left: `${playstylePos}%`,
                width: 14, height: 14, borderRadius: '50%',
                background: '#00D4AA', transform: 'translateX(-50%)',
                boxShadow: '0 0 8px rgba(0,212,170,0.7)',
                border: '2px solid #0A0A0A',
              }}/>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: '#A1A1A1', marginTop: 8,
            }}>
              <span style={{ color: aggression < 35 ? '#00D4AA' : '#6B6B6B', fontWeight: aggression < 35 ? 700 : 400 }}>Passive</span>
              <span style={{ color: aggression >= 35 && aggression <= 70 ? '#00D4AA' : '#6B6B6B', fontWeight: aggression >= 35 && aggression <= 70 ? 700 : 400 }}>Balanced</span>
              <span style={{ color: aggression > 70 ? '#00D4AA' : '#6B6B6B', fontWeight: aggression > 70 ? 700 : 400 }}>Aggressive</span>
            </div>
          </div>
        </Section>

        {/* Strategy focus */}
        <Section title="STRATEGY FOCUS">
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <FocusCard icon="trophy" label="Win Rate" selected={focus === 'win'} onClick={() => setFocus('win')}/>
            <FocusCard icon="chip" label="Chip Accumulation" selected={focus === 'chip'} onClick={() => setFocus('chip')}/>
            <FocusCard icon="shield" label="Survival" selected={focus === 'survival'} onClick={() => setFocus('survival')}/>
            <FocusCard icon="target" label="Exploitation" selected={focus === 'exploit'} onClick={() => setFocus('exploit')}/>
            <FocusCard icon="scales" label="Balanced" selected={focus === 'balanced'} onClick={() => setFocus('balanced')}/>
          </div>
          <div style={{ fontSize: 10.5, color: '#6B6B6B', marginBottom: 4 }}>Primary Goal</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#00D4AA' }}>{focusLabels[focus]}</div>
        </Section>

        {/* Table & Stakes */}
        <Section title="TABLE & STAKES">
          <div style={{ fontSize: 10.5, color: '#6B6B6B', marginBottom: 6 }}>Game Types</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <SegBtn selected={game === 'cash'} onClick={() => setGame('cash')}>Cash Games</SegBtn>
            <SegBtn selected={game === 'tour'} onClick={() => setGame('tour')}>Tournaments</SegBtn>
            <SegBtn selected={game === 'sng'} onClick={() => setGame('sng')}>Sit &amp; Go</SegBtn>
          </div>
          <div style={{ fontSize: 10.5, color: '#6B6B6B', marginBottom: 6 }}>Stakes</div>
          <Dropdown value="$10 / $20 NLH" fullWidth/>
        </Section>

        {/* Behavior */}
        <Section title="BEHAVIOR SETTINGS">
          <BehaviorRow icon="clock" title="Time Bank" sub="How much time it uses per decision" value="30s"/>
          <BehaviorRow icon="risk" title="Risk Tolerance" sub="Willingness to take high-variance spots" value="Medium-High"/>
          <BehaviorRow icon="tilt" title="Tilt Control" sub="How it handles bad beats & losses" value="High"/>
          <BehaviorRow icon="bet" title="Bet Sizing" sub="How it sizes bets vs pot" value="Dynamic"/>
          <div style={{ marginBottom: -12 }}>
            <BehaviorRow icon="percent" title="3-Bet Frequency" sub="How often it 3-bets preflop" value="High"/>
          </div>
        </Section>

        {/* Create button */}
        <div style={{ padding: '0 16px 16px' }}>
          <button onClick={onCreate} style={{
            width: '100%', height: 50, borderRadius: 12,
            background: '#00D4AA', border: 'none',
            color: '#0A0A0A', fontSize: 14, fontWeight: 700,
            letterSpacing: '0.06em', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 0 18px rgba(0,212,170,0.32)',
          }}>
            CREATE AGENT
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#6B6B6B', marginTop: 8 }}>
            Estimated setup time: ~2 min
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { AgentPreviewScreen, Slider, Tag });
