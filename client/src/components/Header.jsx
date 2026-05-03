function StatusDot({ status }) {
  const cls =
    status === 'connected' || status === 'playing' || status === 'waiting' ? 'on'
    : status === 'connecting' ? 'connecting'
    : 'off';
  return <span className={`dot ${cls}`} />;
}

export function Header({ status, mySeat, hasConfig, historyCount, onToggleHistory, onLeave }) {
  return (
    <header className="header">
      <div className="header__brand">
        AI <span className="dot">•</span> POKER
      </div>
      <div className="header__status">
        <StatusDot status={status} />
        {mySeat != null && <span className="muted">{mySeat === 0 ? 'A' : 'B'}</span>}
        {hasConfig && (
          <>
            <button
              type="button"
              className={`icon-btn ${historyCount > 0 ? 'icon-btn--badge' : ''}`}
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
