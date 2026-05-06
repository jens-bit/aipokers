import { Streets } from '../lib/protocol.js';

function StatusDot({ status }) {
  const cls =
    status === 'connected' || status === 'playing' || status === 'waiting' ? 'on'
    : status === 'connecting' ? 'connecting'
    : status === 'reconnecting' ? 'reconnecting'
    : 'off';
  return <span className={`dot ${cls}`} />;
}

const STATUS_LABEL = {
  idle: 'IDLE',
  connecting: 'CONNECTING',
  waiting: 'WAITING',
  watching: 'WATCHING',
  playing: 'IN HAND',
  reconnecting: 'RECONNECTING',
  closed: 'DISCONNECTED',
  error: 'ERROR',
};

const STREET_LABEL = {
  [Streets.PREFLOP]: 'PREFLOP',
  [Streets.FLOP]: 'FLOP',
  [Streets.TURN]: 'TURN',
  [Streets.RIVER]: 'RIVER',
  [Streets.SHOWDOWN]: 'SHOWDOWN',
};

export function Header({ status, game, mySeat, hasConfig, historyCount, reconnectAttempt, maxReconnectAttempts, onToggleHistory, onLeave }) {
  let label = STATUS_LABEL[status] || status;
  if (status === 'reconnecting' && reconnectAttempt > 0) {
    label = `RECONNECTING ${reconnectAttempt}/${maxReconnectAttempts}`;
  }

  // Desktop pill: "Hand N · STREET" when playing, fallback to label
  const inPlay = game && game.handNumber && game.street && STREET_LABEL[game.street];
  const pillText = inPlay
    ? `Hand ${game.handNumber} · ${STREET_LABEL[game.street]}`
    : label;

  return (
    <header className="header">
      <div className="header__brand">
        <span>AGENTIC <span className="dot">•</span> POKER</span>
        {!hasConfig && <span className="header__tagline">Build the better player.</span>}
      </div>
      <div className="header__status">
        {/* Mobile status elements – hidden at ≥1100px */}
        <StatusDot status={status} />
        {mySeat != null && <span className="muted header__mobile-seat">SEAT {mySeat === 0 ? 'A' : 'B'}</span>}
        <span className="muted header__mobile-sep">·</span>
        <span className="muted header__mobile-label">{label}</span>

        {/* Desktop status pill – hidden below 1100px */}
        {hasConfig && (
          <div className="header__pill">
            <span className="live-dot" />
            {pillText}
          </div>
        )}

        {hasConfig && (
          <>
            <button
              type="button"
              className={`icon-btn icon-btn--log ${historyCount > 0 ? 'icon-btn--badge' : ''}`}
              onClick={onToggleHistory}
              aria-label="Open hand history"
            >
              LOG
            </button>
            <button type="button" className="icon-btn" onClick={onLeave} aria-label="Leave table">
              LEAVE
            </button>
          </>
        )}
      </div>
    </header>
  );
}
