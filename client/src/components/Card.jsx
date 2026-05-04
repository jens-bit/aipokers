// SVG-based playing cards ported from design-refs/cards.jsx
// API: export function Card({ card, size })
//   card: '2s' | 'Ah' | 'Td' | null (face-down back) | 'placeholder'
//   size: 'sm' (44×62) | 'md' (56×80, default)

const SIZES = {
  sm: { w: 44, h: 62 },
  md: { w: 56, h: 80 },
};

// Exact SVG paths from design-refs/cards.jsx — do not modify.
const SUIT_PATHS = {
  s: 'M12 3 C12 3, 3 9.5, 3 14.5 C3 17.5 5.5 19.5 8.5 19.5 C10 19.5 11.2 18.8 12 17.8 C12.8 18.8 14 19.5 15.5 19.5 C18.5 19.5 21 17.5 21 14.5 C21 9.5 12 3 12 3 Z M9.5 19.5 L8 23 L16 23 L14.5 19.5 Z',
  h: 'M12 21 C12 21, 3 14.5, 3 8.5 C3 5.5, 5 3.5, 7.5 3.5 C9.5 3.5, 11 4.7, 12 6.3 C13 4.7, 14.5 3.5, 16.5 3.5 C19 3.5, 21 5.5, 21 8.5 C21 14.5, 12 21, 12 21 Z',
  d: 'M12 2 L21 12 L12 22 L3 12 Z',
  c: 'M12 2 C9.8 2, 8 3.8, 8 6 C8 6.5, 8.1 7, 8.3 7.5 C7.4 7.2, 6.5 7, 5.5 7 C3.6 7, 2 8.6, 2 10.5 C2 12.4, 3.6 14, 5.5 14 C7 14, 8.3 13.1, 8.8 11.8 C8.4 13.1, 8 14.5, 7 17 L11 17 L11.5 14 C11.7 13, 11.5 12.5, 11 12 C11.3 12.3, 11.6 12.5, 12 12.5 C12.4 12.5, 12.7 12.3, 13 12 C12.5 12.5, 12.3 13, 12.5 14 L13 17 L17 17 C16 14.5, 15.6 13.1, 15.2 11.8 C15.7 13.1, 17 14, 18.5 14 C20.4 14, 22 12.4, 22 10.5 C22 8.6, 20.4 7, 18.5 7 C17.5 7, 16.6 7.2, 15.7 7.5 C15.9 7, 16 6.5, 16 6 C16 3.8, 14.2 2, 12 2 Z M11 17 L10 22 L14 22 L13 17 Z',
};

function Suit({ suit, size }) {
  const red = suit === 'h' || suit === 'd';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }} aria-hidden>
      <path d={SUIT_PATHS[suit] ?? ''} fill={red ? '#E84545' : '#1A1A1A'} />
    </svg>
  );
}

export function Card({ card, size = 'md' }) {
  const { w, h } = SIZES[size] ?? SIZES.md;
  const r = Math.round(w * 0.14);

  // ── Empty slot ────────────���───────────────────────────────
  if (card === 'placeholder') {
    return (
      <div
        aria-hidden
        style={{
          width: w, height: h, borderRadius: r,
          border: '1.5px dashed rgba(150,150,150,0.35)',
          background: 'transparent',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      />
    );
  }

  // ── Face-down back ────────────────────────────────────────
  if (!card) {
    return (
      <div
        aria-hidden
        style={{
          width: w, height: h, borderRadius: r,
          background: 'linear-gradient(135deg, #1e2a2a 0%, #111818 100%)',
          border: '2px solid rgba(0,212,170,0.25)',
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Teal inner border inset */}
        <div style={{
          position: 'absolute',
          top: 3, left: 3, right: 3, bottom: 3,
          borderRadius: r - 2,
          border: '1px solid rgba(0,212,170,0.15)',
        }} />
        {/* Diagonal crosshatch lines */}
        <svg
          width={w} height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: 'absolute', top: 0, left: 0, opacity: 0.18 }}
          aria-hidden
        >
          <defs>
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#00D4AA" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width={w} height={h} fill="url(#hatch)" />
        </svg>
        {/* Centre spade accent */}
        <svg
          width={Math.round(w * 0.38)} height={Math.round(w * 0.38)}
          viewBox="0 0 24 24"
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.35 }}
          aria-hidden
        >
          <path d={SUIT_PATHS.s} fill="#00D4AA" />
        </svg>
      </div>
    );
  }

  // ── Face-up card ───────────────────────────��──────────────
  const rankChar = card[0];
  const suit = card[1];
  const rank = rankChar === 'T' ? '10' : rankChar;
  const red = suit === 'h' || suit === 'd';
  const suitColor = red ? '#E84545' : '#1A1A1A';

  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: '#ffffff',
      boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)',
      position: 'relative',
      flexShrink: 0,
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Rank — top-left */}
      <div style={{
        position: 'absolute',
        top: Math.round(w * 0.08), left: Math.round(w * 0.12),
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontWeight: 700,
        fontSize: Math.round(w * 0.4),
        lineHeight: 1,
        color: suitColor,
        letterSpacing: '-0.04em',
      }}>{rank}</div>
      {/* Suit — bottom-right */}
      <div style={{
        position: 'absolute',
        bottom: Math.round(w * 0.10), right: Math.round(w * 0.10),
      }}>
        <Suit suit={suit} size={Math.round(w * 0.42)} />
      </div>
    </div>
  );
}
