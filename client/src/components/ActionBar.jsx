import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Actions, Streets } from '../lib/protocol.js';

const TIMER_TOTAL = 15;

function ActionTimer({ isMyTurn, onTimeout }) {
  const [left, setLeft] = useState(TIMER_TOTAL);
  const onTimeoutRef = useRef(onTimeout);
  const firedRef = useRef(false);
  useEffect(() => { onTimeoutRef.current = onTimeout; });

  useEffect(() => {
    if (!isMyTurn) return;
    firedRef.current = false;
    const id = setInterval(() => setLeft(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [isMyTurn]);

  useEffect(() => {
    if (isMyTurn && left === 0 && !firedRef.current) {
      firedRef.current = true;
      onTimeoutRef.current?.();
    }
  }, [left, isMyTurn]);

  if (!isMyTurn) return null;

  const pct = (left / TIMER_TOTAL) * 100;
  const color = left <= 5 ? 'var(--timer-critical)' : left <= 10 ? 'var(--timer-warning)' : 'var(--accent)';
  const pulse = left <= 5 && left > 0;

  return (
    <div className="action-timer">
      <div className="action-timer__track">
        <div
          className={`action-timer__fill${pulse ? ' action-timer__fill--pulse' : ''}`}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="action-timer__count" style={{ color }}>{left}s</span>
    </div>
  );
}

const PRESETS = [
  { label: '⅓', fraction: 1 / 3 },
  { label: '½', fraction: 1 / 2 },
  { label: '⅔', fraction: 2 / 3 },
  { label: 'POT', fraction: 1 },
];

function findLegal(legal, type) {
  return legal.find((a) => a.type === type) || null;
}

export function ActionBar(props) {
  const { game, mySeat, onAct } = props;
  const handIsActive = !!game && game.toAct !== null && game.street !== Streets.COMPLETE;
  const yourTurn = handIsActive && game.toAct === mySeat;
  const timerKey = `${game?.handNumber ?? 0}-${game?.toAct ?? -1}`;
  const handleTimeout = useCallback(() => onAct?.({ type: Actions.FOLD }), [onAct]);

  return (
    <ActionBarFrame>
      <ActionTimer key={timerKey} isMyTurn={yourTurn} onTimeout={handleTimeout} />
      <ActionBarContent {...props} />
    </ActionBarFrame>
  );
}

// Owns the .action-bar wrapper and measures its height so the mobile layout can
// push the bottom seat above the fixed bar. At ≥1100px the bar is inline and
// --action-bar-h is unused, but keeping the observer here is harmless.
function ActionBarFrame({ children }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) document.documentElement.style.setProperty('--action-bar-h', `${h}px`);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  });
  return <div ref={ref} className="action-bar">{children}</div>;
}

function ActionBarContent({ game, mySeat, legalActions, status, reconnectAttempt, maxReconnectAttempts, onAct, onDeal }) {
  if (status === 'connecting') return <Hint text="Connecting…" />;
  if (status === 'reconnecting') {
    return <Hint text={`Reconnecting… (${reconnectAttempt}/${maxReconnectAttempts})`} />;
  }

  if (status === 'waiting' && (!game || game.street === Streets.WAITING)) {
    return (
      <>
        <Hint text="Waiting for opponent — share the link to fill the seat." />
        <div className="action-bar__row action-bar__row--primary">
          <button type="button" className="btn btn--deal" disabled>DEAL</button>
        </div>
      </>
    );
  }
  if (status === 'closed') return <Hint text="Disconnected." />;

  const handOver = !game || game.toAct === null || game.street === Streets.COMPLETE;
  if (handOver) {
    return (
      <>
        <Hint text="Hand complete" />
        <div className="action-bar__row action-bar__row--primary">
          <button type="button" className="btn btn--deal" onClick={onDeal}>DEAL</button>
        </div>
      </>
    );
  }

  const yourTurn = game.toAct === mySeat;
  if (!yourTurn) {
    const opponentName = game.seats[game.toAct]?.displayName || 'opponent';
    return <Hint text={`${opponentName} to act…`} />;
  }

  return <ActiveControls game={game} mySeat={mySeat} legalActions={legalActions} onAct={onAct} />;
}

function Hint({ text }) {
  return <div className="action-bar__hint">{text}</div>;
}

function ActiveControls({ game, mySeat, legalActions, onAct }) {
  const fold = findLegal(legalActions, Actions.FOLD);
  const check = findLegal(legalActions, Actions.CHECK);
  const call = findLegal(legalActions, Actions.CALL);
  const bet = findLegal(legalActions, Actions.BET);
  const raise = findLegal(legalActions, Actions.RAISE);
  const aggressive = bet || raise;
  const isRaise = !!raise;

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
    <>
      {/* Desktop context row — styled as plain hint on mobile */}
      <div className="action-bar__context">
        <span className="action-bar__context-text">
          <strong>To call:</strong> {callAmount.toLocaleString()} &nbsp;·&nbsp; <strong>Pot:</strong> {game.pot.toLocaleString()}
        </span>
        {aggressive && (
          <span className="action-bar__context-text action-bar__context-right">
            Min raise: {minTotal.toLocaleString()}
          </span>
        )}
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
    </>
  );
}
