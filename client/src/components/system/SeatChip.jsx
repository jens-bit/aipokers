// Port of the watch-screen opponent seat chip.
// Used around the WatchFelt for every seat that is not the hero.
// Props: name, stack, pos, acting?, folded?, align?, cards?, dense?
//
// MST-4: `cards` draws two face-down backs for a seat still in the hand. An
// opponent's hole cards are never sent to a spectator, so backs are the only
// truthful thing to draw -- face-up cards belong to the hero seat alone.

import { CardBack } from './PlayingCard.jsx';

export function SeatChip({ name, stack, pos, acting, folded, align = 'left', cards = false, dense = false }) {
  const rtl = align === 'right';
  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 6,
      padding: dense ? '4px 7px' : '5px 9px', borderRadius: 9,
      background: 'rgba(6,8,9,0.86)',
      border: `1px solid ${acting ? '#00D4AA55' : 'rgba(255,255,255,0.08)'}`,
      opacity: folded ? 0.48 : 1,
    }}>
      {acting && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: '#00D4AA', boxShadow: '0 0 6px #00D4AA',
          animation: 'pulse 2s infinite', flexShrink: 0,
        }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: rtl ? 'flex-end' : 'flex-start', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexDirection: rtl ? 'row-reverse' : 'row' }}>
          <span style={{
            fontFamily: '"Inter",-apple-system,system-ui,sans-serif',
            fontSize: 11, fontWeight: 500, color: '#EDEDED',
          }}>{name}</span>
          {pos && (
            <span style={{
              fontFamily: '"Oswald","Inter",sans-serif',
              fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#6B6B6B',
            }}>{pos}</span>
          )}
        </div>
        <span style={{
          fontFamily: '"JetBrains Mono",ui-monospace,monospace',
          fontSize: 10, fontWeight: 500, color: '#A1A1A1',
          fontVariantNumeric: 'tabular-nums',
        }}>${stack}</span>
      </div>
      {cards && !folded && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} aria-hidden>
          <CardBack w={dense ? 14 : 16} h={dense ? 20 : 23} />
          <CardBack w={dense ? 14 : 16} h={dense ? 20 : 23} />
        </div>
      )}
    </div>
  );
}
