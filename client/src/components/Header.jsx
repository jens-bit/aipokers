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
  playing: 'IN HAND',
  reconnecting: 'RECONNECTING',
  closed: 'DISCONNECTED',
  error: 'ERROR',
};

export function Header({ status, mySeat, hasConfig, historyCount, reconnectAttempt, maxReconnectAttempts, onToggleHistory, onLeave }) {
  let label = STATUS_LABEL[status] || status;
  if (status === 'reconnecting' && reconnectAttempt > 0) {
    label = `RECONNECTING ${reconnectAttempt}/${maxReconnectAttempts}`;
  }
  return (
    <header className="header">
      <div className="header__brand">
        AGENTIC <span className="dot">•</span> POKER
      </div>
      <div className="header__status">
        <StatusDot status={status} />
        {mySeat != null && <span className="muted">{mySeat === 0 ? 'A' : 'B'}</span>}
        <span className="muted">{label}</span>
        {hasConfig && (
          <>
            <button
              type="button"
              className={`icon-btn icon-btn--mobile-only ${historyCount > 0 ? 'icon-btn--badge' : ''}`}
              onClick={onToggleHistory}
              aria-label="Open hand history"
            >
              LOG
            </button>
            <button type="button" className="icon-btn" onClick={onLeave} aria-label="Leave table">
              EXIT
            </button>
          </>
        )}
      </div>
    </header>
  );
}
