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

function AgentAvatarInline() {
  return (
    <div className="dr-game-header__avatar">
      <svg width="30" height="30" viewBox="0 0 40 40" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="ghhood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3a4d6b" />
            <stop offset="1" stopColor="#1a2030" />
          </linearGradient>
        </defs>
        <path d="M20 4 C12 4 7 10 7 18 L7 32 C7 36 10 38 14 38 L26 38 C30 38 33 36 33 32 L33 18 C33 10 28 4 20 4 Z" fill="url(#ghhood)" />
        <ellipse cx="20" cy="22" rx="7" ry="9" fill="#0a0f17" />
        <circle cx="17" cy="20" r="1" fill="#00D4AA" opacity="0.7" />
        <circle cx="23" cy="20" r="1" fill="#00D4AA" opacity="0.7" />
      </svg>
      <div className="dr-game-header__avatar-dot" />
    </div>
  );
}

function BackArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function Header({
  status, game, mySeat, hasConfig,
  historyCount, reconnectAttempt, maxReconnectAttempts,
  onToggleHistory, onLeave,
  agentName, isSpectator,
}) {
  const inGame = hasConfig && (mySeat != null || isSpectator);

  if (inGame) {
    const eyebrow = isSpectator ? 'WATCHING' : 'AGENT VIEW';
    const name = agentName || 'Agent';
    const isLive = game && game.street && game.street !== Streets.WAITING && game.street !== Streets.COMPLETE;
    const statusText = isLive
      ? `Hand ${game.handNumber} · ${STREET_LABEL[game.street] ?? game.street}`
      : (STATUS_LABEL[status] ?? status);

    return (
      <header className="dr-game-header">
        <button
          type="button"
          className="dr-game-header__back"
          onClick={onLeave}
          aria-label="Leave"
        >
          <BackArrow />
        </button>
        <AgentAvatarInline />
        <div className="dr-game-header__info">
          <div className="dr-game-header__eyebrow">{eyebrow}</div>
          <div className="dr-game-header__name-row">
            <span className="dr-game-header__name">{name}</span>
            <span className="dr-game-header__ai-pill">AI</span>
          </div>
          <div className="dr-game-header__sub">
            <span className={isLive ? 'dr-game-header__status--live' : ''}>{statusText}</span>
          </div>
        </div>
        <button
          type="button"
          className="dr-game-header__action"
          onClick={onLeave}
          aria-label="Leave table"
        >
          <SettingsIcon />
        </button>
      </header>
    );
  }

  let label = STATUS_LABEL[status] || status;
  if (status === 'reconnecting' && reconnectAttempt > 0) {
    label = `RECONNECTING ${reconnectAttempt}/${maxReconnectAttempts}`;
  }

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
        {mySeat != null && <span className="muted header__mobile-seat">SEAT {mySeat + 1}</span>}
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
