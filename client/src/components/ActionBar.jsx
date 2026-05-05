import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Actions, Streets } from '../lib/protocol.js';

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
  return (
    <ActionBarFrame>
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setAmount(minTotal);
  }, [minTotal, maxTotal, game.street, game.handNumber]);

  // Collapse drawer on every new street or hand
  useEffect(() => {
    setDrawerOpen(false);
  }, [game.street, game.handNumber]);

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
      {/* Bet sizing: chevron-on-line divider + collapsible drawer */}
      {aggressive && (
        <>
          {/* Hairline with chevron centered on it */}
          <div className="action-bar__drawer-rule">
            <button
              type="button"
              className="action-bar__drawer-chevron"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label={drawerOpen ? 'Close bet sizing' : 'Open bet sizing'}
            >
              <span style={{ fontSize: '9px', letterSpacing: '0.14em', fontWeight: 600 }}>SIZING</span>
              <span>{drawerOpen ? '↓' : '↑'}</span>
            </button>
          </div>

          {/* Drawer slides down from toggle */}
          <div className={`action-bar__bet-drawer${drawerOpen ? ' action-bar__bet-drawer--open' : ''}`}>
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
          </div>
        </>
      )}

      {/* Primary action buttons */}
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
