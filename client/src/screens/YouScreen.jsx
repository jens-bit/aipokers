// NAV-1c will replace this with the full YouScreenM port from design-refs/mood-screens-d.jsx.
import { getTelegramDisplayName } from '../lib/telegram.js';

export function YouScreen() {
  const name = getTelegramDisplayName() || 'Player';
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
      <div style={{
        width: 58, height: 58, borderRadius: '50%',
        background: 'linear-gradient(135deg, #00D4AA 0%, #00A8BA 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#0A0A0A', fontWeight: 700, fontSize: 20,
        fontFamily: '"Playfair Display",Georgia,serif',
      }}>
        {initials}
      </div>
      <span style={{ fontFamily: '"Playfair Display",Georgia,serif', fontSize: 18, color: '#EDEDED' }}>{name}</span>
      <span style={{ fontSize: 11, color: '#6B6B6B', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: '"Oswald",sans-serif' }}>
        Profile · Coming in NAV-1c
      </span>
    </div>
  );
}
