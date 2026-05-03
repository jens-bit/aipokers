function StatusDot({ state }) {
  const cls = state === 'connected' ? 'on' : state === 'connecting' ? 'connecting' : 'off';
  return <span className={`dot ${cls}`} />;
}

export function Header({ connectionStatus, tableId, onLeave, hasConfig }) {
  return (
    <header className="header">
      <div className="header__brand">
        AI <span className="dot">•</span> POKER
        <span className="sub" style={{ marginLeft: 18 }}>HEADS-UP — TESTNET</span>
      </div>
      <div className="header__status">
        {tableId && <span className="muted">TABLE {tableId}</span>}
        <span><StatusDot state={connectionStatus.a} /> SEAT A</span>
        <span><StatusDot state={connectionStatus.b} /> SEAT B</span>
        {hasConfig && (
          <button className="preset" onClick={onLeave}>Leave</button>
        )}
      </div>
    </header>
  );
}
