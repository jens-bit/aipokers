function StatusDot({ status }) {
  const cls =
    status === 'connected' || status === 'playing' || status === 'waiting' ? 'on'
    : status === 'connecting' ? 'connecting'
    : 'off';
  return <span className={`dot ${cls}`} />;
}

const STATUS_LABEL = {
  idle: 'IDLE',
  connecting: 'CONNECTING',
  waiting: 'WAITING',
  playing: 'IN HAND',
  closed: 'DISCONNECTED',
  error: 'ERROR',
};

export function Header({ status, tableId, onLeave, hasConfig, mySeat }) {
  return (
    <header className="header">
      <div className="header__brand">
        AI <span className="dot">•</span> POKER
        <span className="sub" style={{ marginLeft: 18 }}>HEADS-UP — TESTNET</span>
      </div>
      <div className="header__status">
        {tableId && <span className="muted">TABLE {tableId}</span>}
        {mySeat != null && <span className="muted">SEAT {mySeat === 0 ? 'A' : 'B'}</span>}
        <span><StatusDot status={status} /> {STATUS_LABEL[status] || status}</span>
        {hasConfig && (
          <button type="button" className="preset" onClick={onLeave}>Leave</button>
        )}
      </div>
    </header>
  );
}
