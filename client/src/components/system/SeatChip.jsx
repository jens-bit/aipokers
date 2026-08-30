// Seat chips for the watch felt.
//
// WV2-4: ported from design-refs/mood-screens-c.jsx (SeatChip, with design 26's
// dealer pip) and design-refs/mood-watch2.jsx (SeatChipSm, BetPill).
//
// Two densities, and the degrade order between them is a rule, not a
// preference: the full chip carries avatar + name + stack + position; the
// compact one drops the position first and shrinks the avatar second, and the
// stack never goes. Full chip through 4-handed; the side rails and the
// 6-handed ring take the compact one.
//
// An opponent's hole cards are never sent to a spectator mid-hand, so a seat
// still in the hand can only truthfully draw backs. Face-up opponent cards
// happen at showdown and only for the seats that actually revealed.

import { CardBack } from './PlayingCard.jsx';

// design-refs/header.jsx — the hooded silhouette every seat wears.
export function AgentAvatar({ size = 24 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #1a2a2e 0%, #0e1518 100%)',
      border: '1px solid rgba(0, 212, 170, 0.25)',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }} aria-hidden>
      <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 40 40" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="seat-hood" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#3a4d6b" />
            <stop offset="1" stopColor="#1a2030" />
          </linearGradient>
        </defs>
        <path d="M20 4 C12 4 7 10 7 18 L7 32 C7 36 10 38 14 38 L26 38 C30 38 33 36 33 32 L33 18 C33 10 28 4 20 4 Z" fill="url(#seat-hood)" />
        <ellipse cx="20" cy="22" rx="7" ry="9" fill="#0a0f17" />
        <circle cx="17" cy="20" r="1" fill="#00D4AA" opacity="0.7" />
        <circle cx="23" cy="20" r="1" fill="#00D4AA" opacity="0.7" />
      </svg>
      {/* presence dot, at the ref's fixed 12px -- it does not scale with the
          avatar, so it reads large on the compact chip's 18px circle. Kept as
          drawn rather than quietly rescaled; if that is wrong it is a one-line
          fix in design-refs/header.jsx. */}
      <div style={{
        position: 'absolute', bottom: 1, right: 1,
        width: 12, height: 12, borderRadius: '50%',
        background: '#00D4AA',
        border: '2px solid #0A0A0A',
        boxShadow: '0 0 6px rgba(0,212,170,0.6)',
      }} />
    </div>
  );
}

// The dealer button. The full chip pins it to whichever corner is the OUTER
// one for its alignment; the compact chip's ref keeps it on the right
// unconditionally, and that is left as drawn.
function DealerPip({ align, small }) {
  const side = (!small && align === 'right') ? { left: -4 } : { right: -4 };
  const d = small ? 13 : 14;
  return (
    <span style={{
      position: 'absolute', top: -5, ...side,
      width: d, height: d, borderRadius: d / 2,
      background: '#F4EBDD', color: '#0A0A0A',
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: small ? 8 : 8.5, fontWeight: 700,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid rgba(0,0,0,0.5)',
    }}>D</span>
  );
}

export function SeatChip({ name, stack, pos, acting, folded, align = 'left', dealer = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '4px 9px 4px 5px', borderRadius: 18,
      background: 'rgba(8,10,10,0.72)',
      border: `1px solid ${acting ? 'rgba(0,212,170,0.40)' : 'rgba(255,255,255,0.06)'}`,
      boxShadow: acting ? '0 0 10px rgba(0,212,170,0.18)' : 'none',
      opacity: folded ? 0.42 : 1,
      flexDirection: align === 'right' ? 'row-reverse' : 'row',
      position: 'relative',
    }}>
      {dealer && <DealerPip align={align} />}
      <AgentAvatar size={24} />
      <div style={{ minWidth: 0, textAlign: align === 'right' ? 'right' : 'left' }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#EDEDED',
          lineHeight: 1.15, whiteSpace: 'nowrap',
        }}>{name}</div>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 5,
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}>
          <span style={{
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 10, fontWeight: 600, color: '#EDEDED',
            fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
          }}>${stack}</span>
          {pos && (
            <span style={{
              fontFamily: '"Oswald", "Inter", sans-serif',
              fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', color: '#6B6B6B',
            }}>{pos}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact chip — earned by the side rails and 6-handed density alone.
export function SeatChipSm({ name, stack, acting, folded, dealer = false }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 7px 3px 4px', borderRadius: 14,
      background: 'rgba(8,10,10,0.78)',
      border: `1px solid ${acting ? 'rgba(0,212,170,0.40)' : 'rgba(255,255,255,0.06)'}`,
      boxShadow: acting ? '0 0 8px rgba(0,212,170,0.18)' : 'none',
      opacity: folded ? 0.42 : 1,
      position: 'relative',
    }}>
      {dealer && <DealerPip small />}
      <AgentAvatar size={18} />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: '#EDEDED',
          lineHeight: 1.1, whiteSpace: 'nowrap',
        }}>{name}</div>
        <span style={{
          fontFamily: '"JetBrains Mono", ui-monospace, monospace',
          fontSize: 9.5, fontWeight: 600, color: '#A1A1A1',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
        }}>${stack}</span>
      </div>
    </div>
  );
}

// One street-bet, sitting in front of a seat.
export function BetPill({ amount }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px 2px 5px', borderRadius: 11,
      background: 'rgba(8,10,10,0.78)',
      border: '1px solid rgba(205,179,128,0.27)',
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden>
        <ellipse cx="12" cy="13" rx="8" ry="2.6" fill="#0A0604" />
        <ellipse cx="12" cy="11" rx="8" ry="2.6" fill="#CDB380" />
        <ellipse cx="12" cy="9" rx="8" ry="2.6" fill="#0A0604" />
        <ellipse cx="12" cy="9" rx="8" ry="2.6" fill="none" stroke="#CDB380" strokeWidth="0.7" />
      </svg>
      <span style={{
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10, fontWeight: 700, color: '#CDB380',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em',
      }}>${amount}</span>
    </div>
  );
}

// Two face-down backs for a seat still in the hand.
export function SeatCardBacks({ mucked = false }) {
  return (
    <div style={{ display: 'flex', gap: 2, opacity: mucked ? 0.38 : 1 }} aria-hidden>
      <CardBack w={20} h={28} />
      <CardBack w={20} h={28} />
    </div>
  );
}
