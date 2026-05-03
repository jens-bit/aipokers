import { useEffect, useState } from 'react';
import { Actions } from '../lib/protocol.js';

const PRESETS = [
  { label: '1/3', fraction: 1 / 3 },
  { label: '1/2', fraction: 1 / 2 },
  { label: '2/3', fraction: 2 / 3 },
  { label: 'POT', fraction: 1 },
];

function findLegal(legal, type) {
  return legal.find((a) => a.type === type) || null;
}

export function ActionBar({ game, seat, legalActions, onAct, onDeal }) {
  const isHandOver = !game || game.toAct === null;
  const yourTurn = game && game.toAct === seat;

  if (isHandOver) {
    return (
      <div className="action-bar">
        <div className="action-bar__hint">Hand complete — deal the next one when ready.</div>
        <div className="action-bar__row" style={{ justifyContent: 'center' }}>
          <button className="btn btn--deal" onClick={onDeal}>DEAL</button>
        </div>
      </div>
    );
  }

  if (!yourTurn) {
    return (
      <div className="action-bar">
        <div className="action-bar__hint">
          Waiting on seat {game.toAct === 0 ? 'A' : 'B'}…
        </div>
      </div>
    );
  }

  return <ActiveControls game={game} seat={seat} legalActions={legalActions[seat]} onAct={onAct} />;
}

function ActiveControls({ game, seat, legalActions, onAct }) {
  const fold = findLegal(legalActions, Actions.FOLD);
  const check = findLegal(legalActions, Actions.CHECK);
  const call = findLegal(legalActions, Actions.CALL);
  const bet = findLegal(legalActions, Actions.BET);
  const raise = findLegal(legalActions, Actions.RAISE);
  const aggressive = bet || raise;

  const isRaise = !!raise;
  const player = game.seats[seat];
  const callAmount = call ? call.amount : 0;
  const potAfterCall = game.pot + callAmount;

  const minTotal = aggressive?.min ?? 0;
  const maxTotal = aggressive?.max ?? 0;

  const [amount, setAmount] = useState(minTotal);
  // Reset suggested bet whenever the legal range changes (new street, new opponent action).
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
    onAct(seat, { type: aggressive.type, amount: clamp(amount) });
  };

  return (
    <div className="action-bar">
      <div className="action-bar__hint">
        Seat {seat === 0 ? 'A' : 'B'} to act — pot {game.pot.toLocaleString()} · current bet {game.currentBet.toLocaleString()}
      </div>

      {aggressive && (
        <div className="action-bar__row">
          <div className="action-bar__sizing">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                className="preset"
                onClick={() => setAmount(presetTotal(p.fraction))}
              >
                {p.label}
              </button>
            ))}
            <button className="preset" onClick={() => setAmount(maxTotal)}>ALL-IN</button>
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
          <button className="btn btn--fold" onClick={() => onAct(seat, { type: Actions.FOLD })}>
            FOLD
          </button>
        )}
        {check && (
          <button className="btn btn--check" onClick={() => onAct(seat, { type: Actions.CHECK })}>
            CHECK
          </button>
        )}
        {call && (
          <button className="btn btn--call" onClick={() => onAct(seat, { type: Actions.CALL })}>
            CALL {call.amount.toLocaleString()}
          </button>
        )}
        {aggressive && (
          <button
            className={`btn ${isRaise ? 'btn--raise' : 'btn--bet'}`}
            onClick={submitAggressive}
            disabled={!Number.isFinite(amount) || amount < minTotal || amount > maxTotal}
          >
            {isRaise ? 'RAISE TO' : 'BET'} {clamp(amount).toLocaleString()}
          </button>
        )}
        {aggressive && maxTotal === player.stack + player.contribThisStreet && (
          <button className="btn btn--allin" onClick={() => onAct(seat, { type: aggressive.type, amount: maxTotal })}>
            ALL-IN
          </button>
        )}
      </div>
    </div>
  );
}
