// Casino floor atoms — ported from design-refs/mood-atoms.jsx and
// design-refs/mood-casino.jsx. SVG paths, gradients and animation timings
// are verbatim; only React plumbing (useId, class names) is adapted.

import { useId } from 'react';

export const M_TEAL = '#00D4AA';
export const M_GOLD = '#CDB380';
export const M_RED = '#FF4D4F';
export const M_PURPLE = '#9B7BFF';
export const M_PINK = '#FF7A8E';

// Identity = accent (border/rim). Mood = eyes + glow. Never mixed.
export const MOODS = {
  confident:  { label: 'CONFIDENT',  color: M_TEAL,    glow: 0.34, pip: '▲' },
  neutral:    { label: 'NEUTRAL',    color: '#888888', glow: 0.10, pip: '–' },
  frustrated: { label: 'FRUSTRATED', color: M_GOLD,    glow: 0.20, pip: '!' },
  tilted:     { label: 'TILTED',     color: M_RED,     glow: 0.36, pip: '⚡' },
  sulking:    { label: 'SULKING',    color: '#6B6B6B', glow: 0.07, pip: '▾' },
};

// How each mood holds itself in the room.
export const POSTURE = {
  confident:  { lift: -7, tilt: -2, aura: 0.30, scale: 1.05, shimmer: false },
  neutral:    { lift: 0,  tilt: 0,  aura: 0.12, scale: 1.00, shimmer: false },
  frustrated: { lift: 2,  tilt: 3,  aura: 0.18, scale: 0.99, shimmer: false },
  tilted:     { lift: 3,  tilt: 6,  aura: 0.32, scale: 0.98, shimmer: true },
  sulking:    { lift: 8,  tilt: -7, aura: 0.06, scale: 0.93, shimmer: false },
};

export const STATES = {
  live:    { label: 'LIVE',    color: M_TEAL },
  resting: { label: 'RESTING', color: '#6B6B6B' },
  recap:   { label: 'RECAP',   color: M_GOLD },
};

// Any mood value the API has not produced yet degrades to neutral.
export function safeMood(mood) {
  return MOODS[mood] ? mood : 'neutral';
}

// ── The floating ghost. Eye geometry identical to MoodGhost. ──────────────
export function FloorGhost({ mood = 'neutral', accent = M_TEAL, size = 56, speed = 5 }) {
  const uid = useId().replace(/:/g, '');
  const key = safeMood(mood);
  const m = MOODS[key];
  const p = POSTURE[key];
  const eye = key === 'neutral' ? accent : m.color;
  const slump = key === 'sulking';
  const cy = slump ? 46 : 42;

  const eyes = () => {
    if (key === 'confident') return (
      <g>
        <ellipse cx="33.5" cy={cy - 2} rx="3" ry="2.4" fill={eye} />
        <ellipse cx="46.5" cy={cy - 2} rx="3" ry="2.4" fill={eye} />
        <path d={`M30 ${cy - 7} L37 ${cy - 8.5}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.75" />
        <path d={`M50 ${cy - 7} L43 ${cy - 8.5}`} stroke={eye} strokeWidth="1.1" strokeLinecap="round" opacity="0.75" />
      </g>
    );
    if (key === 'frustrated') return (
      <g>
        <g transform={`rotate(-14 33.5 ${cy})`}><rect x="30.4" y={cy - 1.1} width="6.4" height="2.2" rx="1.1" fill={eye} /></g>
        <g transform={`rotate(14 46.5 ${cy})`}><rect x="43.4" y={cy - 1.1} width="6.4" height="2.2" rx="1.1" fill={eye} /></g>
      </g>
    );
    if (key === 'tilted') return (
      <g>
        <g transform={`rotate(-24 33.5 ${cy})`}><rect x="30.2" y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={eye} /></g>
        <g transform={`rotate(24 46.5 ${cy})`}><rect x="43.2" y={cy - 1.2} width="6.8" height="2.4" rx="1.2" fill={eye} /></g>
        <path d={`M29.5 ${cy - 6.5} L37.5 ${cy - 4}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round" />
        <path d={`M50.5 ${cy - 6.5} L42.5 ${cy - 4}`} stroke={eye} strokeWidth="1.4" strokeLinecap="round" />
      </g>
    );
    if (key === 'sulking') return (
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

  // No legs — the body tapers into a scalloped wisp.
  const body = slump
    ? 'M40 18 C27 18 20 31 20 47 L20 80 Q25 88 30 82 Q35 76 40 82 Q45 88 50 82 Q55 76 60 82 L60 47 C60 31 53 18 40 18 Z'
    : 'M40 10 C26 10 18 24 18 42 L18 78 Q23 87 28 81 Q33 75 39 81 Q45 87 50 81 Q55 75 60 81 L60 42 C60 24 54 10 40 10 Z';

  return (
    <div
      className="floor-ghost"
      style={{
        width: size,
        height: size * 1.2,
        transform: `translateY(${p.lift}px) rotate(${p.tilt}deg) scale(${p.scale})`,
        animationDuration: `${speed}s`,
      }}
    >
      <svg width={size} height={size * 1.2} viewBox="0 0 80 96" style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <radialGradient id={`fa${uid}`} cx="50%" cy="50%" r="55%">
            <stop offset="0" stopColor={m.color} stopOpacity={p.aura} />
            <stop offset="1" stopColor={m.color} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`fb${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#182030" />
            <stop offset="0.7" stopColor="#0B1018" />
            <stop offset="1" stopColor="#0B1018" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <ellipse cx="40" cy="46" rx="46" ry="44" fill={`url(#fa${uid})`} />
        {p.shimmer && (
          <ellipse className="floor-ghost__shimmer" cx="40" cy="46" rx="36" ry="40" fill="none"
            stroke={M_RED} strokeWidth="1" opacity="0.35" />
        )}
        <path d={body} fill={`url(#fb${uid})`} stroke={`${accent}55`} strokeWidth="1.1" />
        <ellipse cx="40" cy={cy} rx="13.5" ry="16.5" fill="#04070C" />
        {eyes()}
      </svg>
    </div>
  );
}

// ── Name + state marker chip that floats above a ghost ────────────────────
export function GhostChip({ name, accent = M_TEAL, state = 'resting' }) {
  return (
    <div className="floor-chip" style={{ borderColor: `${accent}44` }}>
      {state === 'live' && <span className="floor-dot" aria-hidden />}
      {state === 'recap' && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_GOLD}
          strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12l5 5 9-11" />
        </svg>
      )}
      <span className="floor-chip__name">{name}</span>
    </div>
  );
}

// Identical anatomy at both scales — only the type steps down.
export function PotTicker({ amount, mini }) {
  return (
    <div className={`floor-pot${mini ? ' is-mini' : ''}`}>
      <span className="floor-pot__label">Pot</span>
      <span className="floor-pot__amount">{amount}</span>
    </div>
  );
}

export function MoodChip({ mood, small }) {
  const m = MOODS[safeMood(mood)];
  return (
    <span
      className={`floor-mood-chip${small ? ' is-small' : ''}`}
      style={{ background: `${m.color}1A`, borderColor: `${m.color}44`, color: m.color }}
    >
      <span className="floor-mood-chip__dot" style={{ background: m.color, boxShadow: `0 0 5px ${m.color}` }} />
      {m.label}
    </span>
  );
}

export function StateTag({ state = 'resting', compact }) {
  const s = STATES[state] || STATES.resting;
  const resting = state === 'resting';
  return (
    <span
      className={`floor-state-tag${compact ? ' is-compact' : ''}`}
      style={{
        background: resting ? 'rgba(255,255,255,0.04)' : `${s.color}1A`,
        borderColor: resting ? 'rgba(255,255,255,0.10)' : `${s.color}55`,
      }}
    >
      {state === 'live' && <span className="floor-dot" aria-hidden />}
      {state === 'recap' && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_GOLD}
          strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12l5 5 9-11" />
        </svg>
      )}
      {resting && <span className="floor-state-tag__dot" aria-hidden />}
      <span style={{ color: s.color }}>{s.label}</span>
    </span>
  );
}

// A ghost with its chip, drink and floor shadow — the unit placed in a zone.
export function Occupant({
  name, accent = M_TEAL, mood = 'neutral', state = 'resting',
  size = 56, speed = 5, drink = false, dim = false, onClick,
}) {
  const m = MOODS[safeMood(mood)];
  const shadowAlpha = state === 'resting' ? '1A' : '2E';
  return (
    <button
      type="button"
      className={`floor-occupant${dim ? ' is-dim' : ''}`}
      onClick={onClick}
      aria-label={`${name} — ${m.label.toLowerCase()}`}
    >
      <GhostChip name={name} accent={accent} state={state} />
      <span className="floor-occupant__body">
        <FloorGhost mood={mood} accent={accent} size={size} speed={speed} />
        {drink && (
          <svg width="13" height="20" viewBox="0 0 13 20" className="floor-occupant__drink" aria-hidden>
            <path d="M2 3 L11 3 L8.4 11 L4.6 11 Z" fill={`${M_GOLD}44`} stroke={`${M_GOLD}88`} strokeWidth="0.8" />
            <path d="M6.5 11 L6.5 17" stroke={`${M_GOLD}88`} strokeWidth="0.8" />
            <path d="M3.4 17.6 L9.6 17.6" stroke={`${M_GOLD}88`} strokeWidth="0.8" />
          </svg>
        )}
      </span>
      <span
        className="floor-occupant__shadow"
        style={{
          width: size * 1.1,
          background: `radial-gradient(ellipse, ${m.color}${shadowAlpha}, transparent 70%)`,
        }}
      />
    </button>
  );
}

// Identity accent is stable per agent — derived from id so it never shuffles.
const ACCENTS = [M_TEAL, M_PURPLE, M_GOLD, M_PINK];
export function accentFor(agent, index = 0) {
  const id = String(agent?.id || '');
  if (!id) return ACCENTS[index % ACCENTS.length];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

// Float speed varies slightly per agent so the room never pulses in unison.
export function speedFor(agent, index = 0) {
  const base = [4.6, 5.6, 3.4, 7][index % 4];
  return base;
}
