// Port of the watch-screen opponent seat chip.
// Used in the top corners of the WatchFelt.
// Props: name, stack, pos, acting?, folded?, align?

export function SeatChip({ name, stack, pos, acting, folded, align = 'left' }) {
  const rtl = align === 'right';
  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center', gap: 6,
      padding: '5px 9px', borderRadius: 9,
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
    </div>
  );
}
