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
  s: 'M12 2 C12 2, 4 9, 4 14 C4 17, 6 19, 9 19 C10.5 19, 11.5 18.3, 12 17.3 C12.5 18.3, 13.5 19, 15 19 C18 19, 20 17, 20 14 C20 9, 12 2, 12 2 Z M11 18 L9.5 22 L14.5 22 L13 18 Z',
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
          background: 'linear-gradient(135deg, #2a2a30 0%, #1a1a20 100%)',
          border: '1px solid rgba(255,255,255,0.18)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg
          width={Math.round(w * 0.5)} height={Math.round(w * 0.5)}
          viewBox="0 0 24 24" style={{ display: 'block', opacity: 0.7 }}
          aria-hidden
        >
          <path d={SUIT_PATHS.s} fill="#7a8a9a" />
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
