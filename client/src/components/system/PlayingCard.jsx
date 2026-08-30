// Port of PlayingCard and CardBack from design-refs/mood-atoms.jsx.
// API: PlayingCard({ rank, suit, w, h }) — rank 'A'|'K'|..'2'|'T', suit 's'|'h'|'d'|'c'
//      CardBack({ w, h, branded })

const SUIT_PATHS = {
  s: 'M12 2 C12 2, 4 9, 4 14 C4 17, 6 19, 9 19 C10.5 19, 11.5 18.3, 12 17.3 C12.5 18.3, 13.5 19, 15 19 C18 19, 20 17, 20 14 C20 9, 12 2, 12 2 Z M11 18 L9.5 22 L14.5 22 L13 18 Z',
  h: 'M12 21 C12 21, 3 14.5, 3 8.5 C3 5.5, 5 3.5, 7.5 3.5 C9.5 3.5, 11 4.7, 12 6.3 C13 4.7, 14.5 3.5, 16.5 3.5 C19 3.5, 21 5.5, 21 8.5 C21 14.5, 12 21, 12 21 Z',
  d: 'M12 2 L21 12 L12 22 L3 12 Z',
  c: 'M12 2 C9.8 2, 8 3.8, 8 6 C8 6.5, 8.1 7, 8.3 7.5 C7.4 7.2, 6.5 7, 5.5 7 C3.6 7, 2 8.6, 2 10.5 C2 12.4, 3.6 14, 5.5 14 C7 14, 8.3 13.1, 8.8 11.8 C8.4 13.1, 8 14.5, 7 17 L11 17 L11.5 14 C11.7 13, 11.5 12.5, 11 12 C11.3 12.3, 11.6 12.5, 12 12.5 C12.4 12.5, 12.7 12.3, 13 12 C12.5 12.5, 12.3 13, 12.5 14 L13 17 L17 17 C16 14.5, 15.6 13.1, 15.2 11.8 C15.7 13.1, 17 14, 18.5 14 C20.4 14, 22 12.4, 22 10.5 C22 8.6, 20.4 7, 18.5 7 C17.5 7, 16.6 7.2, 15.7 7.5 C15.9 7, 16 6.5, 16 6 C16 3.8, 14.2 2, 12 2 Z M11 17 L10 22 L14 22 L13 17 Z',
};

export function PlayingCard({ rank, suit, w, h }) {
  const r = Math.round(w * 0.1);
  const red = suit === 'h' || suit === 'd';
  const suitColor = red ? '#E04F5F' : '#111111';
  const displayRank = rank === 'T' ? '10' : rank;
  const suitSize = Math.round(w * 0.42);

  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: '#ffffff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
      position: 'relative',
      flexShrink: 0,
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      <div style={{
        position: 'absolute',
        top: Math.round(w * 0.07), left: Math.round(w * 0.09),
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontWeight: 700,
        fontSize: Math.round(w * 0.42),
        lineHeight: 1,
        color: suitColor,
        letterSpacing: '-0.04em',
      }}>{displayRank}</div>
      <div style={{
        position: 'absolute',
        bottom: Math.round(w * 0.08), right: Math.round(w * 0.08),
      }}>
        <svg width={suitSize} height={suitSize} viewBox="0 0 24 24" style={{ display: 'block' }} aria-hidden>
          <path d={SUIT_PATHS[suit] ?? ''} fill={suitColor} />
        </svg>
      </div>
    </div>
  );
}

export function CardBack({ w, h, branded }) {
  const r = Math.round(w * 0.1);
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(135deg, #1a1a22 0%, #0d0d14 100%)',
      border: '1px solid rgba(255,255,255,0.14)',
      flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {branded && (
        <svg width={Math.round(w * 0.52)} height={Math.round(h * 0.46)} viewBox="0 0 22 26"
          style={{ display: 'block', opacity: 0.5 }} aria-hidden>
          <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
            fill="none" stroke="#00D4AA" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

// Parse a card string 'As' → { rank: 'A', suit: 's' }
export function parseCard(cardStr) {
  if (!cardStr || cardStr.length < 2) return null;
  return { rank: cardStr[0], suit: cardStr[1] };
}
