// The poker table card

const PlayerRow = ({ name, stack, position, compact = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
  }}>
    <AgentAvatar size={compact ? 32 : 34} />
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#EDEDED', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 96 }}>{name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#EDEDED', lineHeight: 1.3 }}>{stack}</div>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#6B6B6B' }}>{position}</div>
      </div>
    </div>
  </div>
);

const ThinkingBadge = () => (
  <div style={{
    display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
  }}>
    <div className="label" style={{ color: '#A1A1A1' }}>OPPONENT TURN</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13, color: '#EDEDED', fontWeight: 500 }}>Thinking</span>
      <span style={{ display: 'flex', gap: 3 }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width: 4, height: 4, borderRadius: '50%',
            background: '#00D4AA',
            opacity: 0.4 + i * 0.2,
            animation: `pulse 1.4s infinite ${i * 0.15}s`,
          }}/>
        ))}
      </span>
    </div>
  </div>
);

const Equity = () => (
  <div style={{ textAlign: 'right', minWidth: 0 }}>
    <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#A1A1A1', marginBottom: 4, whiteSpace: 'nowrap' }}>EQUITY (vs RANGE)</div>
    <div style={{
      fontSize: 22, fontWeight: 700, color: '#00D4AA',
      letterSpacing: '-0.02em', lineHeight: 1,
    }}>67.3%</div>
  </div>
);

const PokerTable = () => (
  <div style={{
    margin: '16px 16px 0',
    background: '#141414',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: '14px 14px 16px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* Table label + timer */}
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 12,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#EDEDED' }}>HEADS-UP NLH</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#A1A1A1', fontVariantNumeric: 'tabular-nums' }}>02:14:38</span>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4AA', boxShadow: '0 0 6px rgba(0,212,170,0.6)' }}/>
      </div>
    </div>

    {/* Felt area */}
    <div style={{
      position: 'relative',
      borderRadius: 999,
      background: 'radial-gradient(ellipse at center, #1a2a2c 0%, #0f1818 70%, #0a1212 100%)',
      border: '1px solid rgba(0, 212, 170, 0.08)',
      padding: '14px 12px',
      minHeight: 280,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* subtle inner glow */}
      <div style={{
        position: 'absolute', inset: 6, borderRadius: 999,
        background: 'radial-gradient(ellipse at center, rgba(0,212,170,0.04), transparent 60%)',
        pointerEvents: 'none',
      }}/>

      {/* Opponent row */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
      }}>
        <PlayerRow name="Opponent" stack="$1,820" position="BB" />
        <div style={{ display: 'flex', gap: 4 }}>
          <CardBack w={30} h={42} />
          <CardBack w={30} h={42} />
        </div>
        <ThinkingBadge />
      </div>

      {/* Pot label */}
      <div style={{
        position: 'relative', zIndex: 2,
        textAlign: 'center', marginTop: 14,
      }}>
        <div className="label" style={{ color: '#A1A1A1', marginBottom: 2 }}>POT</div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: '#EDEDED',
          letterSpacing: '-0.02em', lineHeight: 1,
        }}>$340</div>
      </div>

      {/* Community cards */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', justifyContent: 'center', gap: 6,
        marginTop: 12,
      }}>
        <PlayingCard rank="A" suit="s" w={42} h={58}/>
        <PlayingCard rank="K" suit="h" w={42} h={58}/>
        <PlayingCard rank="Q" suit="c" w={42} h={58}/>
        <PlayingCard rank="J" suit="d" w={42} h={58}/>
        <PlayingCard rank="10" suit="s" w={42} h={58}/>
      </div>

      {/* Pot chip indicator */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        marginTop: 10,
      }}>
        <Icon name="chip" size={16} color="#00D4AA"/>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#00D4AA' }}>$340</span>
      </div>

      {/* Agent row */}
      <div style={{
        position: 'relative', zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 6, marginTop: 14,
      }}>
        <PlayerRow name="Aggressive" stack="$2,340" position="BTN" compact />
        <div style={{ display: 'flex', gap: 4 }}>
          <PlayingCard rank="K" suit="s" w={32} h={44}/>
          <PlayingCard rank="Q" suit="h" w={32} h={44}/>
        </div>
        <Equity />
      </div>
    </div>
  </div>
);

Object.assign(window, { PokerTable });
