import { useEffect, useState } from 'react';
import { Card } from './Card.jsx';

function formatPL(pl) {
  if (pl === 0) return { text: '±0', cls: 'flat' };
  if (pl > 0) return { text: `+${pl}`, cls: 'up' };
  return { text: `${pl}`, cls: 'down' };
}

// Circular SVG countdown ring, shown in the top-right corner of the acting seat.
function SeatTimerRing({ timeLeft, total = 15 }) {
  const r = 12;
  const circumference = 2 * Math.PI * r;
  const progress = Math.max(0, timeLeft) / total;
  const dashOffset = circumference * (1 - progress);
  const color = timeLeft <= 5 ? 'var(--timer-critical)' : timeLeft <= 10 ? 'var(--timer-warning)' : 'var(--accent)';

  return (
    <div className="seat__timer-ring">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <circle
          cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={circumference} strokeDashoffset={dashOffset}
          strokeLinecap="round" transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dashoffset 0.95s linear, stroke 0.3s ease' }}
        />
      </svg>
      <span className="seat__timer-num">{timeLeft}</span>
    </div>
  );
}

export function PlayerSeat({
  seat,
  position,           // 'top' | 'bottom'
  data,               // server seat data: displayName, stack, contribTotal, contribThisStreet, folded, allIn, holeCards
  buyIn,              // initial buy-in for P/L calculation
  isDealer,
  isSmallBlind,
  isBigBlind,
  isToAct,
  isMine,
  inHand,             // are we mid-hand (cards are dealt or hidden)?
  onRename,
  timeLeft,           // seconds remaining on the acting player's timer (optional)
  timerTotal,         // total timer seconds, defaults to 15
}) {
  const [editingName, setEditingName] = useState(data.displayName || '');
  useEffect(() => { setEditingName(data.displayName || ''); }, [data.displayName]);

  const pl = formatPL(data.stack - (buyIn ?? data.stack));
  const holeCards = data.holeCards || [];

  // Card slots: own hole cards, face-down backs for opponent during a hand,
  // dashed placeholders otherwise.
  let cardSlots;
  if (holeCards.length === 2) cardSlots = holeCards;
  else if (inHand && !data.folded) cardSlots = [null, null];
  else cardSlots = ['placeholder', 'placeholder'];

  const commitRename = () => {
    const next = editingName.trim();
    if (!next || next === data.displayName) return;
    onRename?.(next);
  };

  return (
    <div className={`seat seat--${position} ${isToAct ? 'is-acting' : ''} ${data.folded ? 'is-folded' : ''} ${isMine ? 'is-mine' : ''}`}>
      <div className="seat__cards">
        <Card card={cardSlots[0]} size="sm" />
        <Card card={cardSlots[1]} size="sm" />
      </div>

      <div className="seat__info">
        {isMine ? (
          <input
            className="seat__name"
            value={editingName}
            onChange={(e) => se