// Single-row seat component for the oval-felt table design.
// Ported from design-refs/table.jsx (PlayerRow, ThinkingBadge, Equity) and
// design-refs/header.jsx (AgentAvatar).

const SUIT_PATHS = {
  s: 'M12 2 C12 2, 4 9, 4 14 C4 17, 6 19, 9 19 C10.5 19, 11.5 18.3, 12 17.3 C12.5 18.3, 13.5 19, 15 19 C18 19, 20 17, 20 14 C20 9, 12 2, 12 2 Z M11 18 L9.5 22 L14.5 22 L13 18 Z',
  h: 'M12 21 C12 21, 3 14.5, 3 8.5 C3 5.5, 5 3.5, 7.5 3.5 C9.5 3.5, 11 4.7, 12 6.3 C13 4.7, 14.5 3.5, 16.5 3.5 C19 3.5, 21 5.5, 21 8.5 C21 14.5, 12 21, 12 21 Z',
  d: 'M12 2 L21 12 L12 22 L3 12 Z',
  c: 'M12 2 C9.8 2, 8 3.8, 8 6 C8 6.5, 8.1 7, 8.3 7.5 C7.4 7.2, 6.5 7, 5.5 7 C3.6 7, 2 8.6, 2 10.5 C2 12.4, 3.6 14, 5.5 14 C7 14, 8.3 13.1, 8.8 11.8 C8.4 13.1, 8 14.5, 7 17 L11 17 L11.5 14 C11.7 13, 11.5 12.5, 11 12 C11.3 12.3, 11.6 12.5, 12 12.5 C12.4 12.5, 12.7 12.3, 13 12 C12.5 12.5, 12.3 13, 12.5 14 L13 17 L17 17 C16 14.5, 15.6 13.1, 15.2 11.8 C15.7 13.1, 17 14, 18.5 14 C20.4 14, 22 12.4, 22 10.5 C22 8.6, 20.4 7, 18.5 7 C17.5 7, 16.6 7.2, 15.7 7.5 C15.9 7, 16 6.5, 16 6 C16 3.8, 14.2 2, 12 2 Z M11 17 L10 22 L14 22 L13 17 Z',
};

function AgentAvatar({ size = 34 }) {
  const dotSize = Math.round(size * 0.3);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #1a2a2e 0%, #0e1518 100%)',
      border: '1px solid rgba(0, 212, 170, 0.25)',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 40 40" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="dr-hood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3a4d6b" />
            <stop offset="1" stopColor="#1a2030" />
          </linearGradient>
        </defs>
        <path d="M20 4 C12 4 7 10 7 18 L7 32 C7 36 10 38 14 38 L26 38 C30 38 33 36 33 32 L33 18 C33 10 28 4 20 4 Z" fill="url(#dr-hood)" />
        <ellipse cx="20" cy="22" rx="7" ry="9" fill="#0a0f17" />
        <circle cx="17" cy="20" r="1" fill="#00D4AA" opacity="0.7" />
        <circle cx="23" cy="20" r="1" fill="#00D4AA" opacity="0.7" />
      </svg>
      <div style={{
        position: 'absolute', bottom: 1, right: 1,
        width: dotSize, height: dotSize, borderRadius: '50%',
        background: '#00D4AA',
        border: '2px solid #0A0A0A',
        boxShadow: '0 0 6px rgba(0,212,170,0.6)',
      }} />
    </div>
  );
}

function ThinkingBadge() {
  return (
    <div className="dr-thinking">
      <div className="dr-label">OPPONENT TURN</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#EDEDED', fontWeight: 500 }}>Thinking</span>
        <span style={{ display: 'flex', gap: 3 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="dr-thinking-dot" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

// Small card renderer for hole cards — the felt uses custom sizes not in Card.jsx.
function FeltCard({ card, w, h }) {
  const r = Math.round(w * 0.14);

  if (!card) {
    return (
      <div aria-hidden style={{
        width: w, height: h, borderRadius: r,
        background: 'linear-gradient(135deg, #2a2a30 0%, #1a1a20 100%)',
        border: '1px solid rgba(255,255,255,0.18)',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width={Math.round(w * 0.5)} height={Math.round(w * 0.5)} viewBox="0 0 24 24"
          style={{ display: 'block', opacity: 0.7 }} aria-hidden>
          <path d={SUIT_PATHS.s} fill="#7a8a9a" />
        </svg>
      </div>
    );
  }

  const rankChar = card[0];
  const suit = card[1];
  const rank = rankChar === 'T' ? '10' : rankChar;
  const red = suit === 'h' || suit === 'd';
  const suitColor = red ? '#E84545' : '#1A1A1A';

  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: '#ffffff',
      boxShadow: '0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)',
      position: 'relative', flexShrink: 0, overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: Math.round(w * 0.08), left: Math.round(w * 0.12),
        fontFamily: 'Arial, Helvetica, sans-serif', fontWeight: 700,
        fontSize: Math.round(w * 0.4), lineHeight: 1,
        color: suitColor, letterSpacing: '-0.04em',
      }}>{rank}</div>
      <div style={{ position: 'absolute', bottom: Math.round(w * 0.10), right: Math.round(w * 0.10) }}>
        <svg width={Math.round(w * 0.42)} height={Math.round(w * 0.42)} viewBox="0 0 24 24"
          style={{ display: 'block' }} aria-hidden>
          <path d={SUIT_PATHS[suit] ?? ''} fill={suitColor} />
        </svg>
      </div>
    </div>
  );
}

export function TableSeat({
  name,
  stack,
  position,
  holeCards = [],
  isToAct,
  isSelf,
  isCompact,
  inHand,
  folded,
}) {
  const hasCards = holeCards.length === 2;
  const showFaceDown = !hasCards && inHand && !folded;
  const cardW = isSelf ? 32 : 30;
  const cardH = isSelf ? 44 : 42;

  return (
    <div className="dr-felt-row" style={{ opacity: folded ? 0.4 : 1 }}>
      <div className="dr-player-row">
        <AgentAvatar size={isCompact ? 32 : 34} />
        <span>
          <b>{name}</b>
          <small>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#EDEDED' }}>{stack.toLocaleString()}</span>
            {position && (
              <span style={{ marginLeft: 5, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', color: '#6B6B6B' }}>
                {position}
              </span>
            )}
          </small>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4 }}>
        {hasCards ? (
          <>
            <FeltCard card={holeCards[0]} w={cardW} h={cardH} />
            <FeltCard card={holeCards[1]} w={cardW} h={cardH} />
          </>
        ) : showFaceDown ? (
          <>
            <FeltCard card={null} w={cardW} h={cardH} />
            <FeltCard card={null} w={cardW} h={cardH} />
          </>
        ) : (
          <div style={{ width: cardW * 2 + 4, height: cardH }} />
        )}
      </div>

      <div style={{ minWidth: 80, textAlign: isSelf ? 'right' : 'left' }}>
        {isSelf ? (
          <div className="dr-equity">
            <small>EQUITY</small>
            {/* TODO: equity calculation not yet implemented */}
            <b>—</b>
          </div>
        ) : isToAct ? (
          <ThinkingBadge />
        ) : null}
      </div>
    </div>
  );
}
