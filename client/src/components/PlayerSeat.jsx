import { Card } from './Card.jsx';

function formatPL(pl) {
  if (pl === 0) return { text: '±0', cls: 'flat' };
  if (pl > 0) return { text: `+${pl}`, cls: 'up' };
  return { text: `${pl}`, cls: 'down' };
}

export function PlayerSeat({
  seat,
  position,           // 'top' | 'bottom'
  player,             // { displayName, buyIn }
  data,               // server seat data: stack, contribTotal, contribThisStreet, folded, allIn
  holeCards,
  isDealer,
  isSmallBlind,
  isBigBlind,
  isToAct,
  showCards,
  onRename,
}) {
  const pl = formatPL(data.stack - player.buyIn);
  const cards = showCards
    ? (holeCards.length === 2 ? holeCards : ['placeholder', 'placeholder'])
    : (holeCards.length === 2 ? [null, null] : ['placeholder', 'placeholder']);

  return (
    <div className={`seat seat--${position} ${isToAct ? 'is-acting' : ''} ${data.folded ? 'is-folded' : ''}`}>
      <div className="seat__cards">
        <Card card={cards[0]} size="sm" />
        <Card card={cards[1]} size="sm" />
      </div>

      <div className="seat__info">
        <input
          className="seat__name"
          value={player.displayName}
          onChange={(e) => onRename(seat, e.target.value)}
          aria-label={`name for seat ${seat}`}
        />
        <div className="seat__row">
          <div className="seat__stack">{data.stack.toLocaleString()}</div>
          <div className={`seat__pl ${pl.cls}`}>{pl.text}</div>
        </div>
        <div className="badges">
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
