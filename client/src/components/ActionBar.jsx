import { useEffect, useState } from 'react';
import { Actions, Streets } from '../lib/protocol.js';

const PRESETS = [
  { label: '1/3', fraction: 1 / 3 },
  { label: '1/2', fraction: 1 / 2 },
  { label: '2/3', fraction: 2 / 3 },
  { label: 'POT', fraction: 1 },
];

function findLegal(legal, type) {
  return legal.find((a) => a.type === type) || null;
}

export function ActionBar({ game, mySeat, legalActions, status, onAct, onDeal }) {
  if (status === 'connecting') return <Shell hint="Connecting…" />;

  if (status === 'waiting' && (!game || game.street === Streets.WAITING)) {
    return (
      <Shell hint="Waiting for opponent — share the link to fill the seat.">
        <button type="button" className="btn btn--deal" disabled>DEAL</button>
      </Shell>
    );
  }
  if (status === 'closed') return <Shell hint="Disconnected." />;

  const handOver = !game || game.toAct === null || game.street === Streets.COMPLETE;
  if (handOver) {
    return (
      <Shell hint="Hand complete">
        <button type="button" className="btn btn--deal" onClick={onDeal}>DEAL</button>
      </Shell>
    );
  }

  const yourTurn = game.toAct === mySeat;
  if (!yourTurn) {
    const opponentName = game.seats[game.toAct]?.displayName || 'opponent';
    return <Shell hint={`${opponentName} to act…`} />;
  }

  return <ActiveControls game={game} mySeat={mySeat} legalActions={legalActions} onAct={onAct} />;
}

function Shell({ hint, children }) {
  return (
    <div className="action-bar">
      <div className="action-bar__hint">{hint}</div>
      {children && <div className="action-bar__row action-bar__row--primary">{children}</div>}
    </div>
  );
}

function ActiveControls({ game, mySeat, legalActions, onAct }) {
  const fold = findLegal(legalActions, Actions.FOLD);
  const check = findLegal(legalActions, Actions.CHECK);
  const call = findLegal(legalActions, Actions.CALL);
  const bet = findLegal(legalActions, Actions.BET);
  const raise = findLegal(legalActions, Actions.RAISE);
  const aggressive = bet || raise;
  const isRaise = !!raise;

  const player = game.seats[mySeat];
  const callAmount = call ? call.amount : 0;
  const potAfterCall = game.pot + callAmount;

  const minTotal = aggressive?.min ?? 0;
  const maxTotal = aggressive?.max ?? 0;

  const [amount, setAmount] = useState(minTotal);
  useEffect(() => {
    setAmount(minTotal);
  }, [minTotal, maxTotal, game.street, game.handNumber]);

  const clamp = (v) => Math.max(minTotal, Math.min(maxTotal, Math.round(v)));

  const presetTotal = (fraction) => {
    if (isRaise) return clamp(game.currentBet + potAfterCall * fraction);
    return clamp(game.pot * fraction);
  };

  const submitAggressive = () => {
    if (!aggressive) return;
    onAct({ type: aggressive.type, amount: clamp(amount) });
  };

  return (
    <div className="action-bar">
      <div className="action-bar__hint">
        Pot {game.pot.toLocaleString()} · bet {game.currentBet.toLocaleString()}
      </div>

      {aggressive && (
        <>
          <div className="action-bar__sizing">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.label}
                className="preset"
                onClick={() => setAmount(presetTotal(p.fraction))}
              >
                {p.label}
              </button>
            ))}
            <button type="button" className="preset" onClick={() => setAmount(maxTotal)}>MAX</button>
          </div>
          <div className="action-bar__row">
            <input
              className="amount-input"
              type="number"
              inputMode="numeric"
              min={minTotal}
              max={maxTotal}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              aria-label={`bet amount; min ${minTotal} max ${maxTotal}`}
            />
          </div>
        </>
      )}

      <div className="action-bar__row action-bar__row--primary">
        {fold && (
          <button type="button" className="btn btn--fold" onClick={() => onAct({ type: Actions.FOLD })}>
            FOLD
          </button>
        )}
        {check && (
          <button type="button" className="btn btn--check" onClick={() => onAct({ type: Actions.CHECK })}>
            CHECK
          </button>
        )}
        {call && (
          <button type="button" className="btn btn--call" onClick={() => onAct({ type: Actions.CALL })}>
            CALL {call.amount.toLocaleString()}
          </button>
        )}
        {aggressive && (
          <button
            type="button"
            className={`btn ${isRaise ? 'btn--raise' : 'btn--bet'}`}
            onClick={submitAggressive}
            disabled={!Number.isFinite(amount) || amount < minTotal || amount > maxTotal}
          >
            {isRaise ? 'RAISE' : 'BET'} {clamp(amount).toLocaleString()}
          </button>
        )}
      </div>
    </div>
  );
}
