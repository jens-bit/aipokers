// Playing card components + suit glyphs

const Suit = ({ suit, size = 14 }) => {
  const red = suit === 'h' || suit === 'd';
  const color = red ? '#E84545' : '#1A1A1A';
  const paths = {
    s: <path d="M12 2 C12 2, 4 9, 4 14 C4 17, 6 19, 9 19 C10.5 19, 11.5 18.3, 12 17.3 C12.5 18.3, 13.5 19, 15 19 C18 19, 20 17, 20 14 C20 9, 12 2, 12 2 Z M11 18 L9.5 22 L14.5 22 L13 18 Z" fill={color}/>,
    h: <path d="M12 21 C12 21, 3 14.5, 3 8.5 C3 5.5, 5 3.5, 7.5 3.5 C9.5 3.5, 11 4.7, 12 6.3 C13 4.7, 14.5 3.5, 16.5 3.5 C19 3.5, 21 5.5, 21 8.5 C21 14.5, 12 21, 12 21 Z" fill={color}/>,
    d: <path d="M12 2 L21 12 L12 22 L3 12 Z" fill={color}/>,
    c: <path d="M12 2 C9.8 2, 8 3.8, 8 6 C8 6.5, 8.1 7, 8.3 7.5 C7.4 7.2, 6.5 7, 5.5 7 C3.6 7, 2 8.6, 2 10.5 C2 12.4, 3.6 14, 5.5 14 C7 14, 8.3 13.1, 8.8 11.8 C8.4 13.1, 8 14.5, 7 17 L11 17 L11.5 14 C11.7 13, 11.5 12.5, 11 12 C11.3 12.3, 11.6 12.5, 12 12.5 C12.4 12.5, 12.7 12.3, 13 12 C12.5 12.5, 12.3 13, 12.5 14 L13 17 L17 17 C16 14.5, 15.6 13.1, 15.2 11.8 C15.7 13.1, 17 14, 18.5 14 C20.4 14, 22 12.4, 22 10.5 C22 8.6, 20.4 7, 18.5 7 C17.5 7, 16.6 7.2, 15.7 7.5 C15.9 7, 16 6.5, 16 6 C16 3.8, 14.2 2, 12 2 Z M11 17 L10 22 L14 22 L13 17 Z" fill={color}/>,
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
const CardBack = ({ w = 36, h = 50 }) => (
  <div style={{
    width: w, height: h,
    borderRadius: w * 0.14,
    background: 'linear-gradient(135deg, #2a2a30 0%, #1a1a20 100%)',
    border: '1px solid rgba(255,255,255,0.18)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <svg width={w * 0.5} height={w * 0.5} viewBox="0 0 24 24" style={{display:'block', opacity: 0.7}}>
      <path d="M12 2 C12 2, 4 9, 4 14 C4 17, 6 19, 9 19 C10.5 19, 11.5 18.3, 12 17.3 C12.5 18.3, 13.5 19, 15 19 C18 19, 20 17, 20 14 C20 9, 12 2, 12 2 Z M11 18 L9.5 22 L14.5 22 L13 18 Z" fill="#7a8a9a"/>
    </svg>
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
