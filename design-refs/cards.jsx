// Playing card components + suit glyphs

const Suit = ({ suit, size = 14 }) => {
  const red = suit === 'h' || suit === 'd';
  const color = red ? '#E84545' : '#1A1A1A';
  const paths = {
    s: <path d="M12 2.4 C12 2.4 4.6 8.8 4.6 13.9 C4.6 16.7 6.5 18.7 9 18.7 C10.1 18.7 11 18.3 11.6 17.6 C11.7 19.6 11 21.2 9.4 22.2 L14.6 22.2 C13 21.2 12.3 19.6 12.4 17.6 C13 18.3 13.9 18.7 15 18.7 C17.5 18.7 19.4 16.7 19.4 13.9 C19.4 8.8 12 2.4 12 2.4 Z" fill={color}/>,
    h: <path d="M12 21 C12 21, 3 14.5, 3 8.5 C3 5.5, 5 3.5, 7.5 3.5 C9.5 3.5, 11 4.7, 12 6.3 C13 4.7, 14.5 3.5, 16.5 3.5 C19 3.5, 21 5.5, 21 8.5 C21 14.5, 12 21, 12 21 Z" fill={color}/>,
    d: <path d="M12 2 L21 12 L12 22 L3 12 Z" fill={color}/>,
    c: (
      <g fill={color}>
        <circle cx="12" cy="7.1" r="4.3"/>
        <circle cx="6.7" cy="13.6" r="4.3"/>
        <circle cx="17.3" cy="13.6" r="4.3"/>
        <path d="M12 10.6 C12.7 14.8 13.2 18.9 15.4 22.2 L8.6 22.2 C10.8 18.9 11.3 14.8 12 10.6 Z"/>
      </g>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{display:'block'}}>
      {paths[suit]}
    </svg>
  );
};

// White card with rank in corner + big suit
const PlayingCard = ({ rank, suit, w = 36, h = 50, dim = false }) => {
  const red = suit === 'h' || suit === 'd';
  const color = red ? '#E84545' : '#1A1A1A';
  const fontSize = w * 0.42;
  return (
    <div style={{
      width: w, height: h,
      background: dim ? '#888' : '#fff',
      borderRadius: w * 0.14,
      position: 'relative',
      boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute',
        top: w * 0.08, left: w * 0.12,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontSize,
        lineHeight: 1,
        color,
        letterSpacing: '-0.04em',
      }}>{rank}</div>
      <div style={{
        position: 'absolute',
        bottom: w * 0.10, right: w * 0.10,
      }}>
        <Suit suit={suit} size={w * 0.42} />
      </div>
    </div>
  );
};

// Card back / face-down
const CardBack = ({ w = 36, h = 50, branded = false }) => (
  <div style={{
    width: w, height: h,
    borderRadius: w * 0.14,
    background: branded
      ? 'linear-gradient(135deg, #0e1418 0%, #0a1212 100%)'
      : 'linear-gradient(135deg, #2a2a30 0%, #1a1a20 100%)',
    border: branded ? '1px solid rgba(0,212,170,0.35)' : '1px solid rgba(255,255,255,0.18)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {branded ? (
      <>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(45deg, rgba(0,212,170,0.06) 0 2px, transparent 2px 6px)',
        }}/>
        <div style={{
          fontFamily: 'Inter', fontWeight: 800, fontSize: w * 0.32,
          letterSpacing: '0.04em', color: '#00D4AA', position: 'relative', zIndex: 1,
        }}>AP</div>
      </>
    ) : (
      <svg width={w * 0.5} height={w * 0.5} viewBox="0 0 24 24" style={{display:'block', opacity: 0.7}}>
        <path d="M12 2.4 C12 2.4 4.6 8.8 4.6 13.9 C4.6 16.7 6.5 18.7 9 18.7 C10.1 18.7 11 18.3 11.6 17.6 C11.7 19.6 11 21.2 9.4 22.2 L14.6 22.2 C13 21.2 12.3 19.6 12.4 17.6 C13 18.3 13.9 18.7 15 18.7 C17.5 18.7 19.4 16.7 19.4 13.9 C19.4 8.8 12 2.4 12 2.4 Z" fill="#7a8a9a"/>
      </svg>
    )}
  </div>
);

// Tiny card cluster used in hand history rows
const MiniCard = ({ rank, suit }) => {
  const red = suit === 'h' || suit === 'd';
  const color = red ? '#E84545' : '#fff';
  return (
    <div style={{
      width: 22, height: 28,
      background: 'rgba(255,255,255,0.96)',
      borderRadius: 3,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
      flexShrink: 0,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, lineHeight: 1,
        color: red ? '#E84545' : '#1A1A1A',
      }}>{rank}</div>
      <Suit suit={suit} size={10} />
    </div>
  );
};

Object.assign(window, { Suit, PlayingCard, CardBack, MiniCard });
