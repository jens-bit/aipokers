// Port of LiveBar from design-refs/mood-atoms.jsx.
// THE CORE MECHANIC — one bar, two homes:
//   full: docked under a thread header (watch screen)
//   strip: slotted into a zoom under the speech bubble
// Props:
//   table, blinds, street, pot, equity, action, timer
//   board: [[rank,suit]|null, ...] (5 elements)
//   hole?: [[rank,suit], [rank,suit]]
//   faceDown?: boolean (between-hands state)
//   note?: string (replaces pot/equity/action area when present)
//   strip?: boolean (zoom variant — no bottom border, wrapped by parent)

import { PlayingCard, CardBack } from './PlayingCard.jsx';

export function LiveBar({ table, blinds, pot, equity, action, timer = 12, board = [], street,
  hole, faceDown, note, strip }) {
  const timerCritical = !faceDown && typeof timer === 'number' && timer <= 5;

  return (
    <div style={{
      flexShrink: 0,
      background: '#131316',
      ...(strip ? {} : { borderBottom: '1px solid #00D4AA3D' }),
      boxShadow: 'inset 0 1px 0 #00D4AA2E, 0 6px 14px rgba(0,0,0,0.35)',
      cursor: 'pointer',
    }}>
      {/* ── Top row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px 0' }}>
        {faceDown
          ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6B6B6B', flexShrink: 0 }} />
          : <LiveDot />}
        <span style={{
          fontFamily: '"Oswald","Inter",sans-serif', fontSize: 9, fontWeight: 500,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: faceDown ? '#6B6B6B' : '#00D4AA',
        }}>{faceDown ? 'Between hands' : 'Live'}</span>
        <span style={{
          fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 9.5,
          color: '#6B6B6B', fontWeight: 500,
        }}>#{table} · {blinds}{faceDown ? '' : ` · ${(street || '').toUpperCase()}`}</span>
        <div style={{ flex: 1 }} />
        {!faceDown && typeof timer === 'number' && (
          <span style={{
            fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 10,
            color: timerCritical ? '#FF4D4F' : '#A1A1A1', fontWeight: 600,
          }}>{timer}s</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D4AA"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      </div>

      {/* ── Bottom row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 14px 9px' }}>
        {/* hole cards */}
        {hole && (
          <>
            <div style={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
              {hole.map((c, i) => (
                <div key={i} style={{ transform: `rotate(${i ? 4 : -4}deg)` }}>
                  {faceDown
                    ? <CardBack w={21} h={29} branded />
                    : <PlayingCard rank={c[0]} suit={c[1]} w={21} h={29} />}
                </div>
              ))}
            </div>
            <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
          </>
        )}

        {/* board */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {(board.length ? board : [null, null, null, null, null]).map((c, i) => (
            c && !faceDown
              ? <PlayingCard key={i} rank={c[0]} suit={c[1]} w={19} h={26} />
              : <CardBack key={i} w={19} h={26} branded />
          ))}
        </div>

        {/* stats or note */}
        {note ? (
          <>
            <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
            <div style={{ fontSize: 12, color: '#6B6B6B', fontStyle: 'italic', minWidth: 0 }}>{note}</div>
            <div style={{ flex: 1 }} />
          </>
        ) : (
          <>
            <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <span style={{
                fontFamily: '"Oswald","Inter",sans-serif', fontSize: 8.5, fontWeight: 500,
                letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B6B6B',
              }}>Pot</span>
              <div>
                <span style={{
                  fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 13,
                  fontWeight: 700, color: '#EDEDED', fontVariantNumeric: 'tabular-nums',
                }}>${pot}</span>
              </div>
            </div>
            <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <span style={{
                fontFamily: '"Oswald","Inter",sans-serif', fontSize: 8.5, fontWeight: 500,
                letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B6B6B',
              }}>Equity</span>
              <div>
                <span style={{
                  fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 13,
                  fontWeight: 700, color: '#00D4AA', fontVariantNumeric: 'tabular-nums',
                }}>{equity != null ? `${equity}%` : '—'}</span>
              </div>
            </div>
            <div style={{ flex: 1 }} />
            {action && (
              <span style={{
                padding: '4px 9px', borderRadius: 5,
                background: '#00D4AA', color: '#0A0A0A',
                fontFamily: '"Oswald","Inter",sans-serif', fontSize: 9.5,
                fontWeight: 600, letterSpacing: '0.1em',
                whiteSpace: 'nowrap', flexShrink: 0, textTransform: 'uppercase',
              }}>{action}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LiveDot() {
  return (
    <span style={{
      width: 5, height: 5, borderRadius: '50%',
      background: '#00D4AA', boxShadow: '0 0 6px #00D4AA',
      animation: 'pulse 2s infinite', flexShrink: 0, display: 'inline-block',
    }} />
  );
}
