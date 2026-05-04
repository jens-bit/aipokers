const SUIT_GLYPH = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLOR = { s: 'black', h: 'red', d: 'red', c: 'black' };

// `card` is a 2-char string like 'As', 'Th', '7c'. Pass `null` for face-down,
// 'placeholder' for an empty slot.
export function Card({ card, size = 'md' }) {
  const sizeCls = size === 'sm' ? 'small' : '';
  if (!card) return <div className={`card back ${sizeCls}`} />;
  if (card === 'placeholder') return <div className={`card placeholder ${sizeCls}`} />;
  const rank = card[0] === 'T' ? '10' : card[0];
  const suit = card[1];
  const colorCls = SUIT_COLOR[suit] || 'black';
  const glyph = SUIT_GLYPH[suit] || '';
  return (
    <div className={`card ${colorCls} ${sizeCls}`}>
      <div className="card__top">
        <div className="card__rank">{rank}</div>
        <div className="card__suit-corner">{glyph}</div>
      </div>
      <div className="card__suit-center">{glyph}</div>
      <div className="card__bottom">
        <div className="card__rank">{rank}</div>
        <div className="card__suit-corner">{glyph}</div>
      </div>
    </div>
  );
}
