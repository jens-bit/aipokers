import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Actions, Streets } from '../lib/protocol.js';

// ─── Timer hook (my turn, 15s auto-fold) ─────────────────────────────────────
const TIMER_TOTAL = 15;

function useMyTimer(isMyTurn, timerKey, onTimeout) {
  const [left, setLeft] = useState(TIMER_TOTAL);
  const onTimeoutRef = useRef(onTimeout);
  const firedRef = useRef(false);
  useEffect(() => { onTimeoutRef.current = onTimeout; });

  useEffect(() => {
    setLeft(TIMER_TOTAL);
    firedRef.current = false;
    if (!isMyTurn) return;
    const id = setInterval(() => setLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [isMyTurn, timerKey]);

  useEffect(() => {
    if (isMyTurn && left === 0 && !firedRef.current) {
      firedRef.current = true;
      onTimeoutRef.current?.();
    }
  }, [left, isMyTurn]);

  return left;
}

// ─── ActionBarFrame (fixed on mobile, inline on desktop) ─────────────────────
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

// ─── WaitingStrip ─────────────────────────────────────────────────────────────
// keyed by raw string values of Streets constants
const STREET_LABEL = { preflop:'Pre-Flop', flop:'Flop', turn:'Turn', river:'River', showdown:'Showdown', complete:'', waiting:'' };

function ThinkingDots() {
  return (
    <span className="ps-thinking-dots" aria-hidden>
      {[0, 1, 2].map(i => (
        <span key={i} className="ps-thinking-dot" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

function WaitingStrip({ street, opponentName, isOpponentThinking }) {
  const streetLabel = STREET_LABEL[street] ?? '';
  const text = isOpponentThinking
    ? `${opponentName || 'Opponent'} thinking`
    : 'Waiting…';
  return (
    <div className="ps-waiting-strip">
      <div className="ps-waiting-strip__left">
        {streetLabel && <span className="ps-waiting-strip__street">{streetLabel.toUpperCase()}</span>}
        {streetLabel && <span className="ps-waiting-strip__sep" />}
        <span className="ps-waiting-strip__text">{text}</span>
      </div>
      {isOpponentThinking && <ThinkingDots />}
    </div>
  );
}

// ─── InfoStrip (my turn) ──────────────────────────────────────────────────────
const STREET_DOT_INDEX = { preflop:0, flop:1, turn:2, river:3 };

function InfoStrip({ street, timeLeft, callAmount, minRaise }) {
  const dotIndex = STREET_DOT_INDEX[street] ?? 0;
  const streetLabel = STREET_LABEL[street] ?? '';
  const pct = (timeLeft / TIMER_TOTAL) * 100;
  const timerColor = timeLeft <= 5 ? '#FF4D4F' : timeLeft <= 10 ? '#FFB020' : '#00D4AA';
  const pulse = timeLeft <= 5 && timeLeft > 0;

  return (
    <div className="ps-info-strip">
      {/* Street column */}
      <div className="ps-info-strip__col">
        <div className="ps-info-strip__label">STREET</div>
        <div className="ps-info-strip__street-name">{streetLabel}</div>
        <div className="ps-info-strip__dots">
          {[0, 1, 2, 3].map(i => (
            <span key={i} className={`ps-street-dot${i === dotIndex ? ' ps-street-dot--on' : ''}`} />
          ))}
        </div>
      </div>

      {/* Timer column */}
      <div className="ps-info-strip__col ps-info-strip__col--mid">
        <div className="ps-info-strip__label ps-info-strip__label--accent">YOUR TURN</div>
        <div className="ps-info-strip__timer-text">
          You have <strong style={{ color: timerColor }}>{timeLeft}s</strong>
        </div>
        <div className="ps-info-strip__bar-track">
          <div
            className={`ps-info-strip__bar-fill${pulse ? ' ps-info-strip__bar-fill--pulse' : ''}`}
            style={{ width: `${pct}%`, background: timerColor }}
          />
        </div>
      </div>

      {/* Action column */}
      <div className="ps-info-strip__col ps-info-strip__col--right">
        <div className="ps-info-strip__label">ACTION</div>
        {callAmount > 0 ? (
          <>
            <div className="ps-info-strip__action-amt">{callAmount.toLocaleString()}</div>
            <div className="ps-info-strip__action-sub">To call</div>
          </>
        ) : minRaise > 0 ? (
          <>
            <div className="ps-info-strip__action-amt">{minRaise.toLocaleString()}</div>
            <div className="ps-info-strip__action-sub">Min raise</div>
          </>
        ) : (
          <>
            <div className="ps-info-strip__action-dash">—</div>
            <div className="ps-info-strip__action-sub">Check/Bet</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── QuickSize chip ───────────────────────────────────────────────────────────
function QuickSize({ label, amount, selected, onClick }) {
  return (
    <button
      type="button"
      className={`ps-quick-size${selected ? ' ps-quick-size--on' : ''}`}
      onClick={onClick}
    >
      <span className="ps-quick-size__label">{label}</span>
      <span className="ps-quick-size__amt">{amount.toLocaleString()}</span>
    </button>
  );
}

// ─── BetControls (quick sizes + stepper) ─────────────────────────────────────
const FRACTIONS = [
  { label: '½', f: 0.5 },
  { label: '¾', f: 0.75 },
  { label: 'POT', f: 1 },
];

function BetControls({ min, max, pot, value, onChange }) {
  const preset = (f) => Math.min(max, Math.max(min, Math.round((pot > 0 ? pot : min * 2) * f)));

  return (
    <div className="ps-bet-controls">
      <div className="ps-quick-sizes">
        {FRACTIONS.map(({ label, f }) => {
          const amt = preset(f);
          return (
            <QuickSize key={label} label={label} amount={amt}
              selected={value === amt} onClick={() => onChange(amt)} />
          );
        })}
        <QuickSize label="All-in" amount={max} selected={value === max} onClick={() => onChange(max)} />
      </div>
      <div className="ps-bet-stepper">
        <button type="button" className="ps-bet-stepper__btn" onClick={() => onChange(Math.max(min, value - 10))}>−</button>
        <input
          className="ps-bet-stepper__input"
          type="number" inputMode="numeric"
          value={value} min={min} max={max}
          onChange={e => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))); }}
          aria-label={`bet amount, min ${min} max ${max}`}
        />
        <button type="button" className="ps-bet-stepper__btn" onClick={() => onChange(Math.min(max, value + 10))}>+</button>
      </div>
    </div>
  );
}

// ─── ActionBtns ───────────────────────────────────────────────────────────────
function ActionBtns({ fold, check, call, bet, raise, amount, min, max, onAct }) {
  const aggressive = bet || raise;
  const isRaise = !!raise;
  const clamp = v => Math.max(min ?? 0, Math.min(max ?? Infinity, Math.round(v)));
  const callAmt = call?.amount ?? 0;

  return (
    <div className="ps-action-btns">
      {fold && (
        <button type="button" className="ps-btn ps-btn--fold" onClick={() => onAct({ type: Actions.FOLD })}>
          FOLD
        </button>
      )}
      {check && (
        <button type="button" className="ps-btn ps-btn--check" onClick={() => onAct({ type: Actions.CHECK })}>
          CHECK
        </button>
      )}
      {call && (
        <button type="button" className="ps-btn ps-btn--call" onClick={() => onAct({ type: Actions.CALL })}>
          CALL{callAmt > 0 ? ` ${callAmt.toLocaleString()}` : ''}
        </button>
      )}
      {aggressive && (
        <button
          type="button"
          className={`ps-btn ${isRaise ? 'ps-btn--raise' : 'ps-btn--bet'}`}
          onClick={() => onAct({ type: aggressive.type, amount: clamp(amount) })}
          disabled={!Number.isFinite(amount) || amount < (min ?? 0) || amount > (max ?? Infinity)}
        >
          {isRaise ? 'RAISE' : 'BET'} {clamp(amount).toLocaleString()}
        </button>
      )}
    </div>
  );
}

// ─── DealStrip / StatusHint ───────────────────────────────────────────────────
function DealStrip({ onDeal, hint }) {
  if (hint) {
    return (
      <div className="ps-deal-strip">
        <span className="ps-deal-strip__text">{hint}</span>
        <ThinkingDots />
      </div>
    );
  }
  return (
    <div className="ps-deal-strip">
      <button type="button" className="ps-deal-btn" onClick={onDeal}>DEAL NEXT HAND</button>
    </div>
  );
}

// ─── ActionBar (exported) ─────────────────────────────────────────────────────
function findLegal(legal, type) {
  return legal?.find(a => a.type === type) ?? null;
}

export function ActionBar({ game, mySeat, legalActions, status, reconnectAttempt, maxReconnectAttempts, onAct, onDeal }) {
  const opponentSeat = mySeat === 0 ? 1 : 0;
  const handIsActive = !!game && game.toAct !== null && game.street !== Streets.COMPLETE;
  const isMyTurn = handIsActive && game.toAct === mySeat;
  const isOpponentTurn = handIsActive && game.toAct === opponentSeat;
  const timerKey = `${game?.handNumber ?? 0}-${game?.toAct ?? -1}`;

  const fold = findLegal(legalActions, Actions.FOLD);
  const check = findLegal(legalActions, Actions.CHECK);
  const call = findLegal(legalActions, Actions.CALL);
  const bet = findLegal(legalActions, Actions.BET);
  const raise = findLegal(legalActions, Actions.RAISE);
  const aggressive = bet || raise;

  const minBet = aggressive?.min ?? 0;
  const maxBet = aggressive?.max ?? 0;
  const [betAmount, setBetAmount] = useState(minBet);
  useEffect(() => { setBetAmount(minBet); }, [minBet, maxBet, game?.street, game?.handNumber]);

  const timeLeft = useMyTimer(
    isMyTurn,
    timerKey,
    () => onAct?.({ type: Actions.FOLD }),
  );

  let content;
  if (status === 'connecting') {
    content = <DealStrip hint="Connecting…" />;
  } else if (status === 'reconnecting') {
    content = <DealStrip hint={`Reconnecting… (${reconnectAttempt}/${maxReconnectAttempts})`} />;
  } else if (status === 'closed') {
    content = <DealStrip hint="Disconnected" />;
  } else if (status === 'waiting' && (!game || game.street === Streets.WAITING)) {
    content = <DealStrip hint="Waiting for opponent…" />;
  } else if (!game || game.toAct === null || game.street === Streets.COMPLETE) {
    content = <DealStrip onDeal={onDeal} />;
  } else if (isMyTurn) {
    content = (
      <>
        <InfoStrip
          street={game.street}
          timeLeft={timeLeft}
          callAmount={call?.amount ?? 0}
          minRaise={aggressive?.min ?? 0}
        />
        {aggressive && (
          <BetControls
            min={minBet}
            max={maxBet}
            pot={game.pot}
            value={Math.max(minBet, Math.min(maxBet, betAmount))}
            onChange={setBetAmount}
          />
        )}
        <ActionBtns
          fold={fold}
          check={check}
          call={call}
          bet={bet}
          raise={raise}
          amount={Math.max(minBet, Math.min(maxBet, betAmount))}
          min={minBet}
          max={maxBet}
          onAct={onAct}
        />
      </>
    );
  } else {
    const oppName = game.seats?.[opponentSeat]?.displayName || 'Opponent';
    content = (
      <WaitingStrip
        street={game.street}
        opponentName={oppName}
        isOpponentThinking={isOpponentTurn}
      />
    );
  }

  return <ActionBarFrame>{content}</ActionBarFrame>;
}
