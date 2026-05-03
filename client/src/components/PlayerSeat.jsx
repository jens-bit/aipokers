import { useEffect, useState } from 'react';
import { Card } from './Card.jsx';

function formatPL(pl) {
  if (pl === 0) return { text: '±0', cls: 'flat' };
  if (pl > 0) return { text: `+${pl}`, cls: 'up' };
  return { text: `${pl}`, cls: 'down' };
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
  onRename,
}) {
  const [editingName, setEditingName] = useState(data.displayName || '');
  useEffect(() => { setEditingName(data.displayName || ''); }, [data.displayName]);

  const pl = formatPL(data.stack - (buyIn ?? data.stack));
  const holeCards = data.holeCards || [];
  const cards = holeCards.length === 2 ? holeCards : [null, null];

  const commitRename = () => {
    const next = editingName.trim();
    if (!next || next === data.displayName) return;
    onRename?.(next);
  };

  return (
    <div className={`seat seat--${position} ${isToAct ? 'is-acting' : ''} ${data.folded ? 'is-folded' : ''} ${isMine ? 'is-mine' : ''}`}>
      <div className="seat__cards">
        <Card card={cards[0]} size="sm" />
        <Card card={cards[1]} size="sm" />
      </div>

      <div className="seat__info">
        {isMine ? (
          <input
            className="seat__name"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
            aria-label="your name"
          />
        ) : (
          <div className="seat__name seat__name--readonly">{data.displayName || `Seat ${seat}`}</div>
        )}
        <div className="seat__row">
          <div className="seat__stack">{data.stack.toLocaleString()}</div>
          {buyIn != null && <div className={`seat__pl ${pl.cls}`}>{pl.text}</div>}
        </div>
        <div className="badges">
          {isMine && <span className="badge badge--you">YOU</span>}
          {isDealer && <span className="badge badge--dealer">D</span>}
          {isSmallBlind && <span className="badge badge--sb">SB</span>}
          {isBigBlind && <span className="badge badge--bb">BB</span>}
          {data.allIn && <span className="badge badge--allin">ALL-IN</span>}
        </div>
      </div>

      {data.contribThisStreet > 0 && (
        <div className="seat__bet">
          <div className="seat__bet-amount">{data.contribThisStreet.toLocaleString()}</div>
          <div className="seat__bet-label">In this street</div>
        </div>
      )}
    </div>
  );
}
