import { useEffect, useRef, useState } from 'react';
import { Streets } from '../lib/protocol.js';
import { Card } from './Card.jsx';

// ─── Primitives ───────────────────────────────────────────────────────────────

// Simple teal chip dot (replaces SVG ChipIcon)
function ChipDot() { return <span className="ps-chip-dot" aria-hidden>◆</span>; }

function PosBadge({ text }) {
  if (!text) return null;
  return (
    <span className="ps-pos-badge">{text}</span>
  );
}

function SmallCardBack({ w = 30, h = 42 }) {
  return (
    <div className={`ps-card-back${w > 30 ? ' ps-card-back--lg' : ''}`}
      style={{ width: w, height: h }} aria-hidden>
      <span className="ps-card-back__ap">AP</span>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="ps-thinking-dots" aria-hidden>
      {[0, 1, 2].map(i => (
        <span key={i} className="ps-thinking-dot" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

function TableWatermark() {
  return (
    <svg width={80} height={94} viewBox="0 0 22 26" className="ps-table-watermark" aria-hidden>
      <path
        d="M11 1 C11 1,2 9,2 16 C2 19,4 21,7 21 C8.5 21,9.5 20.5,10 19.8 C10.3 21.5,9.5 23,8 24 L14 24 C12.5 23,11.7 21.5,12 19.8 C12.5 20.5,13.5 21,15 21 C18 21,20 19,20 16 C20 9,11 1,11 1 Z"
        fill="#00D4AA" stroke="#00D4AA" strokeWidth="0.4"
      />
      <path
        d="M8 14 L11 8 L14 14 M9.2 12 L12.8 12"
        stroke="#0a1212" strokeWidth="1.2" fill="none" strokeLinecap="round"
      />
    </svg>
  );
}

// ─── TimerRing ────────────────────────────────────────────────────────────────
const OPP_TIMER_TOTAL = 30;

export function TimerRing({ value, total = OPP_TIMER_TOTAL }) {
  const r = 18, c = 2 * Math.PI * r;
  const fraction = Math.max(0, value) / total;
  const off = c * (1 - fraction);
  const color = value <= 5 ? '#FF4D4F' : value <= 10 ? '#FFB020' : '#00D4AA';
  return (
    <div className="ps-timer-ring">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
        <circle
          cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="2"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 22 22)" className="ps-timer-ring__arc"
        />
      </svg>
      <div className="ps-timer-num">{value}</div>
    </div>
  );
}

function useCountdown(active, total) {
  const [left, setLeft] = useState(total);
  useEffect(() => {
    setLeft(total);
    if (!active) return;
    const id = setInterval(() => setLeft(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [active, total]);
  return left;
}

// ─── PlayHeader ───────────────────────────────────────────────────────────────
export function PlayHeader({ stack, onToggleHistory, onLeave }) {
  return (
    <div className="ps-header">
      <div className="ps-header__brand">
        AGENTIC<span className="ps-header__dot">•</span>POKER
      </div>
      <div className="ps-header__chip-pill">
        <ChipDot />
        <span className="ps-header__stack">{(stack ?? 0).toLocaleString()}</span>
      </div>
      <div className="ps-header__icons">
        <button type="button" className="ps-icon-btn" onClick={onToggleHistory} aria-label="Hand history">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </button>
        <button type="button" className="ps-icon-btn" onClick={onLeave} aria-label="Leave table">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── OpponentRow ──────────────────────────────────────────────────────────────
export function OpponentRow({ name, stack, position, isToAct, holeCards, inHand }) {
  const timeLeft = useCountdown(isToAct, OPP_TIMER_TOTAL);
  const showFaceUp = holeCards?.length === 2;

  return (
    <div className="ps-opponent-row">
      {/* Robot avatar */}
      <div className="ps-agent-avatar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          <circle cx="12" cy="16" r="1" fill="#00D4AA" />
        </svg>
      </div>

      {/* Name + status */}
      <div className="ps-opponent-row__info">
        <div className="ps-opponent-row__name-row">
          <span className="ps-opponent-row__name">{name}</span>
          <span className="ps-ai-badge">AI</span>
        </div>
        <div className="ps-opponent-row__status">
          {isToAct ? (
            <>
              <span className="ps-opponent-row__status-text">Thinking</span>
              <ThinkingDots />
            </>
          ) : (
            <span className="ps-opponent-row__status-text ps-opponent-row__status-text--idle">
              {inHand ? 'In hand' : 'Waiting'}
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="ps-opponent-row__cards">
        {showFaceUp ? (
          <>
            <Card card={holeCards[0]} size="sm" />
            <Card card={holeCards[1]} size="sm" />
          </>
        ) : (
          <>
            <SmallCardBack w={30} h={42} />
            <SmallCardBack w={30} h={42} />
          </>
        )}
      </div>

      {/* Stack + position */}
      <div className="ps-opponent-row__right">
        <div className="ps-opponent-row__stack">{(stack ?? 0).toLocaleString()}</div>
        <PosBadge text={position} />
      </div>

      {/* Timer ring when acting, spacer otherwise */}
      {isToAct
        ? <TimerRing value={timeLeft} total={OPP_TIMER_TOTAL} />
        : <div className="ps-timer-spacer" />}
    </div>
  );
}

// ─── PlayTable ────────────────────────────────────────────────────────────────
export function PlayTable({ pot, community, street }) {
  const visibleCount =
    street === Streets.FLOP ? 3 :
    street === Streets.TURN ? 4 :
    (street === Streets.RIVER || street === Streets.SHOWDOWN || street === Streets.COMPLETE) ? 5 : 0;

  const slots = [...(community ?? [])].slice(0, visibleCount);
  while (slots.length < visibleCount) slots.push('placeholder');

  return (
    <div className="ps-table">
      {/* Pot display */}
      <div className="ps-table__pot-area">
        <div className="ps-table__pot-label">POT</div>
        <div className="ps-table__pot-amount">{(pot ?? 0).toLocaleString()}</div>
        <div className="ps-table__game-type">No Limit Hold'em</div>
      </div>

      {/* Board or watermark */}
      <div className="ps-table__board-area">
        {visibleCount === 0 ? (
          <TableWatermark />
        ) : (
          <div className="ps-table__community">
            {slots.map((c, i) => <Card key={i} card={c} size="sm" />)}
          </div>
        )}
      </div>

      {/* Chip + pot footer */}
      <div className="ps-table__footer">
        <ChipDot />
        <span className="ps-table__footer-amt">{(pot ?? 0).toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── YouRow ───────────────────────────────────────────────────────────────────
export function YouRow({ name, stack, position, holeCards, isToAct }) {
  const showFaceUp = holeCards?.length === 2;

  return (
    <div className={`ps-you-row${isToAct ? ' ps-you-row--active' : ''}`}>
      <div className="ps-you-avatar">♠</div>
      <div className="ps-you-row__info">
        <div className="ps-you-row__name">{name || 'You'}</div>
        <div className="ps-you-row__stack-row">
          <span className="ps-you-row__stack-label">Stack</span>
          <span className="ps-you-row__stack">{(stack ?? 0).toLocaleString()}</span>
          <PosBadge text={position} />
        </div>
      </div>
      <div className="ps-you-row__cards">
        {showFaceUp ? (
          <>
            <Card card={holeCards[0]} size="sm" />
            <Card card={holeCards[1]} size="sm" />
          </>
        ) : (
          <>
            <SmallCardBack w={36} h={50} />
            <SmallCardBack w={36} h={50} />
          </>
        )}
      </div>
    </div>
  );
}

// ─── FooterActions ────────────────────────────────────────────────────────────
export function FooterActions({ historyCount, onToggleHistory, onLeave }) {
  return (
    <div className="ps-footer">
      <button type="button" className="ps-footer-btn" onClick={onToggleHistory}>
        <span className="ps-footer-icon" aria-hidden>↺</span>
        HAND HISTORY
        {historyCount > 0 && <span className="ps-footer-badge">{historyCount}</span>}
      </button>
      <button type="button" className="ps-footer-btn" onClick={onLeave}>
        <span className="ps-footer-icon" aria-hidden>→</span>
        LEAVE TABLE
      </button>
    </div>
  );
}
