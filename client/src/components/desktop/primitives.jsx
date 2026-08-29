const TEAL = '#00D4AA';

export function Hood({ size = 32, dim = false }) {
  return (
    <div className={`dsk-hood${dim ? ' is-dim' : ''}`} style={{ width: size, height: size }}>
      <svg width={size * 0.85} height={size * 0.85} viewBox="0 0 80 80" aria-hidden>
        <path
          d="M40 14 C28 14 20 26 20 42 L20 80 L60 80 L60 42 C60 26 52 14 40 14 Z"
          fill="#0a0f17"
          stroke={dim ? 'transparent' : 'rgba(0,212,170,0.33)'}
          strokeWidth="0.6"
        />
        <ellipse cx="40" cy="42" rx="13" ry="16" fill="#050810" />
        <ellipse cx="34" cy="40" rx="2.4" ry="1.6" fill={dim ? '#3a3a3f' : TEAL} />
        <ellipse cx="46" cy="40" rx="2.4" ry="1.6" fill={dim ? '#3a3a3f' : TEAL} />
      </svg>
    </div>
  );
}

export function LogoMark({ width = 17, height = 20, stroke = TEAL }) {
  return (
    <svg width={width} height={height} viewBox="0 0 22 26" aria-hidden>
      <path
        d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
        fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round"
      />
      <path d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12" stroke={stroke} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const SUIT_GLYPH = { s: '♠', h: '♥', d: '♦', c: '♣' };

// Renders a protocol card string ("Ah", "Td") as a card face.
// size: 'board' (community), 'hero' (hole cards), 'mini' (opponent backs).
export function MiniCard({ card, size = 'board' }) {
  const sizeClass = size === 'board' ? '' : ` dsk-card--${size}`;
  if (!card || card === 'placeholder') {
    return <div className={`dsk-card dsk-card--back${sizeClass}`} aria-hidden />;
  }
  const rank = card.slice(0, -1);
  const suit = card.slice(-1).toLowerCase();
  const red = suit === 'h' || suit === 'd';
  return (
    <div className={`dsk-card${red ? ' dsk-card--red' : ''}${sizeClass}`}>
      <span>{rank}</span>
      <span className="dsk-card__suit">{SUIT_GLYPH[suit] || ''}</span>
    </div>
  );
}

export function NavIcon({ name, size = 15 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round',
    strokeLinejoin: 'round', 'aria-hidden': true,
  };
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 10.5L12 3l9 7.5V21H3z" /><path d="M9 21v-6h6v6" /></svg>;
    case 'agent':
      return <svg {...common}><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M12 8V4" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /></svg>;
    case 'spade':
      return <svg {...common}><path d="M12 3s-7 6-7 10a4 4 0 0 0 6.2 3.3L10 21h4l-1.2-4.7A4 4 0 0 0 19 13c0-4-7-10-7-10z" /></svg>;
    case 'history':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 3.5" /></svg>;
    case 'profile':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" /></svg>;
    case 'plus':
      return <svg {...common} strokeWidth="2.4"><path d="M12 5v14M5 12h14" /></svg>;
    case 'arrow-left':
      return <svg {...common}><path d="M15 18l-6-6 6-6" /></svg>;
    case 'sparkle':
      return <svg {...common}><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" /></svg>;
    case 'send':
      return <svg {...common} strokeWidth="2.4"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>;
    default:
      return null;
  }
}
