// Port of MoodGhost from design-refs/mood-atoms.jsx.
// The chat / list / band ghost — viewBox 0 0 80 80, no floor bob animation.
// Identity accent = rim. Mood = eyes + glow.

import { useId } from 'react';

const MOODS = {
  confident:  { color: '#00D4AA', glow: 0.34 },
  neutral:    { color: '#888888', glow: 0.10 },
  frustrated: { color: '#CDB380', glow: 0.20 },
  tilted:     { color: '#FF4D4F', glow: 0.36 },
  sulking:    { color: '#6B6B6B', glow: 0.07 },
};

export function MoodGhost({ mood = 'neutral', accent = '#00D4AA', size = 40, ring = true }) {
  const uid = useId().replace(/:/g, '');
  const m = MOODS[mood] || MOODS.neutral;
  const eye = mood === 'neutral' ? accent : m.color;
  const slump = mood === 'sulking';
  const cy = slump ? 46 : 42;

  const eyes = () => {
    if (mood === 'confident') return (
      <g>
        <ellipse cx="33.5" cy={cy - 2} rx="3" ry="2.4" fill={eye} />
        <ellipse cx="46.5" cy={cy - 2} rx="3" ry="2.4" fill={eye} />
        <path d={`M30 ${cy - 7} L37 ${cy - 8.5}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.75" />
        <path d={`M50 ${cy - 7} L43 ${cy - 8.5}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.75" />
      </g>
    );
    if (mood === 'frustrated') return (
      <g>
        <g transform={`rotate(-14 33.5 ${cy})`}><rect x="30.4" y={cy - 1.1} width="6.4" height="2.2" rx="1.1" fill={eye} /></g>
        <g transform={`rotate(14 46.5 ${cy})`}><rect x="43.4" y={cy - 1.1} width="6.4" height="2.2" rx="1.1" fill={eye} /></g>
      </g>
    );
    if (mood === 'tilted') return (
      <g>
        <g transform={`rotate(-24 33.5 ${cy})`}><rect x="30.2" y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={eye} /></g>
        <g transform={`rotate(24 46.5 ${cy})`}><rect x="43.2" y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={eye} /></g>
        <path d={`M29.5 ${cy - 6.5} L37.5 ${cy - 4}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round" />
        <path d={`M50.5 ${cy - 6.5} L42.5 ${cy - 4}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
    if (mood === 'sulking') return (
      <g>
        <ellipse cx="33.5" cy={cy + 2.5} rx="2.2" ry="1.3" fill={eye} />
        <ellipse cx="46.5" cy={cy + 2.5} rx="2.2" ry="1.3" fill={eye} />
        <path d={`M30.6 ${cy - 0.6} A3 3 0 0 1 36.4 ${cy - 0.6}`} stroke={eye} strokeWidth="1" fill="none" opacity="0.55" />
        <path d={`M43.6 ${cy - 0.6} A3 3 0 0 1 49.4 ${cy - 0.6}`} stroke={eye} strokeWidth="1" fill="none" opacity="0.55" />
      </g>
    );
    return (
      <g>
        <ellipse cx="34" cy={cy} rx="2.5" ry="1.7" fill={eye} />
        <ellipse cx="46" cy={cy} rx="2.5" ry="1.7" fill={eye} />
      </g>
    );
  };

  return (
    <svg width={size} height={size} viewBox="0 0 80 80" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <radialGradient id={`mg${uid}`} cx="50%" cy="54%" r="52%">
          <stop offset="0" stopColor={m.color} stopOpacity={m.glow} />
          <stop offset="1" stopColor={m.color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`mh${uid}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#141A22" />
          <stop offset="1" stopColor="#0A0F17" />
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="44" rx="44" ry="42" fill={`url(#mg${uid})`} />
      {slump
        ? <path d="M40 20 C27 20 20 32 20 48 L17 80 L63 80 L60 48 C60 32 53 20 40 20 Z"
            fill={`url(#mh${uid})`} stroke={ring ? `${accent}66` : 'transparent'} strokeWidth="1.4" />
        : <path d="M40 12 C26 12 18 24 18 42 L18 80 L62 80 L62 42 C62 24 54 12 40 12 Z"
            fill={`url(#mh${uid})`} stroke={ring ? `${accent}66` : 'transparent'} strokeWidth="1.4" />}
      <ellipse cx="40" cy={cy} rx="13.5" ry="16.5" fill="#04070C" />
      {eyes()}
    </svg>
  );
}
