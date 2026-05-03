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
  if (status === 'connecting') {
    return <Shell hint="Connecting…" />;
  }
  if (status === 'waiting' && (!game || game.street === Streets.WAITING)) {
    return (
      <Shell hint="Seated. Waiting for an opponent — open this page in another browser tab to play.">
        <button className="btn btn--deal" disabled>DEAL</button>
      </Shell>
    );
  }
  if (status === 'closed') {
    return <Shell hint="Disconnected." />;
  }

  const handOver = !game || game.toAct === null || game.street === Streets.COMPLETE;
  if (handOver) {
    return (
      <Shell hint="Hand complete. Press DEAL when ready for the next one.">
        <button className="btn btn--deal" onClick={onDeal} type="button">DEAL</button>
      </Shell>
    );
  }

  const yourTurn = game.toAct === mySeat;
  if (!yourTurn) {
    const opponentName = game.seats[game.toAct]?.displayName || `Seat ${game.toAct}`;
    return <Shell hint={`Waiting on ${opponentName}…`} />;
  }

  return <ActiveControls game={game} mySeat={mySeat} legalActions={legalActions} onAct={onAct} />;
}

function Shell({ hint, children }) {
  return (
    <div className="action-bar">
      <div className="action-bar__hint">{hint}</div>
      {children && <div className="action-bar__row" style={{ justifyContent: 'center' }}>{children}</div>}
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
        Your turn · pot {game.pot.toLocaleString()} · current bet {game.currentBet.toLocaleString()}
      </div>

      {aggressive && (
        <div className="action-bar__row">
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
            <button type="button" className="preset" onClick={() => setAmount(maxTotal)}>ALL-IN</button>
          </div>
          <input
            className="amount-input"
            type="number"
            min={minTotal}
            max={maxTotal}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
          <span className="muted">min {minTotal} · max {maxTotal}</span>
        </div>
      )}

      <div className="action-bar__row">
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
            {isRaise ? 'RAISE TO' : 'BET'} {clamp(amount).toLocaleString()}
          </button>
        )}
        {aggressive && maxTotal === player.stack + player.contribThisStreet && (
          <button
            type="button"
            className="btn btn--allin"
            onClick={() => onAct({ type: aggressive.type, amount: maxTotal })}
          >
            ALL-IN
          </button>
        )}
      </div>
    </div>
  );
}
