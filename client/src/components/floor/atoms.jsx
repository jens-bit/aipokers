// Casino floor atoms — ported from design-refs/mood-atoms.jsx and
// design-refs/mood-casino.jsx. SVG paths, gradients and animation timings
// are verbatim; only React plumbing (useId, class names) is adapted.

import { useId } from 'react';
import { Card } from '../Card.jsx';
import { PlayingCard, CardBack, parseCard } from '../system/PlayingCard.jsx';
import { roomStyle } from './layouts.js';

const IDENTITY_ROOM = { k: 1, ox: 0, oy: 0 };

export const M_TEAL = '#00D4AA';
export const M_GOLD = '#CDB380';
export const M_RED = '#FF4D4F';
export const M_PURPLE = '#9B7BFF';
export const M_PINK = '#FF7A8E';
// FLOOR-3: the house regulars' accent. Grey is not an identity — it is the
// absence of one, which is exactly what a table's scenery should read as.
export const M_GREY = '#6B6B6B';

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
// chipMaxW: max px for the name span — use when multiple ghosts share a felt
// so the chip doesn't bleed into the neighbor's space.
export function GhostChip({ name, accent = M_TEAL, state = 'resting', stack = null, chipMaxW }) {
  return (
    <div className="floor-chip" style={{ borderColor: `${accent}44` }}>
      {state === 'live' && <span className="floor-dot" aria-hidden />}
      {state === 'recap' && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_GOLD}
          strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12l5 5 9-11" />
        </svg>
      )}
      <span
        className="floor-chip__name"
        style={chipMaxW ? { maxWidth: chipMaxW, overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}
      >{name}</span>
      {stack != null && chipMaxW == null && (
        <span className="floor-chip__stack">{stack.toLocaleString()}</span>
      )}
    </div>
  );
}

// Identical anatomy at both scales — only the type steps down.
// x/y are room coordinates; see layouts.js for the coordinate space.
// `plain` drops the room positioning for hosts that place it themselves
// (the zoom), which otherwise nests two absolute coordinate systems.
export function PotTicker({ x, y, amount, mini, plain = false, room = IDENTITY_ROOM }) {
  return (
    <div
      className={`floor-pot${mini ? ' is-mini' : ''}${plain ? ' is-plain' : ''}`}
      style={plain ? undefined : roomStyle(room, x, y)}
    >
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

// Two face-down card backs fanned on the felt in front of a seated ghost.
// MST-4: the fan scales with the ghost, so three agents seated at one felt do
// not overflow its rail.
function SeatedCardFan({ scale = 1 }) {
  return (
    <div
      style={{
        position: 'relative', width: 52, height: 44, flexShrink: 0, pointerEvents: 'none',
        transform: scale === 1 ? undefined : `scale(${scale})`,
        transformOrigin: 'bottom center',
        marginBottom: scale === 1 ? 0 : -44 * (1 - scale),
      }}
      aria-hidden
    >
      <div style={{ position: 'absolute', left: 2, top: 0, transformOrigin: 'bottom center', transform: 'rotate(-9deg)' }}>
        <Card card={null} size="felt" />
      </div>
      <div style={{ position: 'absolute', right: 2, top: 0, transformOrigin: 'bottom center', transform: 'rotate(9deg)' }}>
        <Card card={null} size="felt" />
      </div>
    </div>
  );
}

// A ghost with its chip, drink and floor shadow — the unit placed in a zone.
// `seated` flips to the near-rail posture: cards → ghost → shadow → chip.
export function Occupant({
  x, y, name, accent = M_TEAL, mood = 'neutral', state = 'resting',
  size = 56, speed = 5, drink = false, dim = false, seated = false,
  stack = null, chipMaxW, onClick, room = IDENTITY_ROOM,
}) {
  const m = MOODS[safeMood(mood)];
  const shadowAlpha = state === 'resting' ? '1A' : '2E';
  const shadow = (
    <span
      className="floor-occupant__shadow"
      style={{
        width: size * 1.1,
        background: `radial-gradient(ellipse, ${m.color}${shadowAlpha}, transparent 70%)`,
      }}
    />
  );
  return (
    <button
      type="button"
      className={`floor-occupant${dim ? ' is-dim' : ''}`}
      style={roomStyle(room, x, y)}
      onClick={onClick}
      aria-label={`${name} — ${m.label.toLowerCase()}`}
    >
      {seated ? (
        <>
          <SeatedCardFan scale={Math.min(1, size / 56)} />
          <span className="floor-occupant__body">
            <FloorGhost mood={mood} accent={accent} size={size} speed={speed} />
          </span>
          {shadow}
          <GhostChip name={name} accent={accent} state={state} stack={stack} chipMaxW={chipMaxW} />
        </>
      ) : (
        <>
          <GhostChip name={name} accent={accent} state={state} stack={stack} chipMaxW={chipMaxW} />
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
          {shadow}
        </>
      )}
    </button>
  );
}

// ── Diorama constants (match design-refs/mood-casino.jsx) ────────────────────
export const MIN_HOLE_W = 20;
export const DIORAMA_MIN_RY = 47;

// Adaptive: try decreasing board-card width until hole cards are legible, then
// fall back to a relaxed minimum for mini layouts (hole cards "slightly smaller
// than board" per the design — rank is still readable at w≥16).
export function dioramaMetrics(f, bw = 17, maxH = 32) {
  const gap = 3, rim = 2, rot = 2;
  const minW = maxH <= 24 ? 16 : MIN_HOLE_W;
  for (let b = bw; b >= 11; b--) {
    const avail = f.ry - rim - b * 0.7 - gap;
    const hh = Math.min(maxH, Math.round(avail - rot));
    const hw = Math.round(hh / 1.39);
    if (hw >= minW) return { bw: b, gap, rim, hh, hw, fits: true };
  }
  const avail = f.ry - rim - 11 * 0.7 - gap;
  const hh = Math.min(maxH, Math.round(avail - rot));
  const hw = Math.round(hh / 1.39);
  return { bw: 11, gap, rim, hh, hw, fits: hw >= minW };
}

const SHOW_STREET = new Set(['flop', 'turn', 'river', 'showdown']);

// Community board at the felt centre — rendered once per table.
export function FeltBoard({ f, board, street, room = IDENTITY_ROOM, mini = false }) {
  const bw = mini ? 13 : 17;
  const maxH = mini ? 24 : 32;
  const m = dioramaMetrics(f, bw, maxH);
  if (!m.fits) return null;

  const boardCards = Array.isArray(board)
    ? board.filter(Boolean).map(parseCard).filter(Boolean)
    : [];
  if (!boardCards.length) return null;

  const boardY = f.cy - m.bw * 0.7;
  const glow = 6;

  return (
    <>
      <div style={Object.assign(
        { position: 'absolute', display: 'flex', gap: m.bw > 16 ? 5 : 3, zIndex: 2 },
        roomStyle(room, f.cx, boardY)
      )}>
        {boardCards.map((c, i) => (
          <div key={i} style={{ filter: `drop-shadow(0 0 ${glow}px #00D4AA55)` }}>
            <PlayingCard rank={c.rank} suit={c.suit} w={m.bw} h={Math.round(m.bw * 1.4)} />
          </div>
        ))}
      </div>
      {street && SHOW_STREET.has(street) && (
        <div style={Object.assign(
          { position: 'absolute', zIndex: 3 },
          roomStyle(room, f.cx, boardY + Math.round(m.bw * 1.4) + 4)
        )}>
          <span className="floor-diorama__street">{street.toUpperCase()}</span>
        </div>
      )}
    </>
  );
}

// An agent's two hole cards fanned at their seat x-position (not the felt centre).
// Each seated agent at a multi-ghost felt calls this independently.
export function FeltHoleCards({ f, x, hole, room = IDENTITY_ROOM, mini = false }) {
  const bw = mini ? 13 : 17;
  const maxH = mini ? 24 : 32;
  const m = dioramaMetrics(f, bw, maxH);
  if (!m.fits) return null;

  const holeCards = hole && hole.length >= 2
    ? [parseCard(hole[0]), parseCard(hole[1])]
    : null;
  const holeY = f.cy - f.ry + m.rim;

  return (
    <div style={Object.assign(
      { position: 'absolute', display: 'flex', gap: 1, zIndex: 4 },
      roomStyle(room, x, holeY)
    )}>
      {[0, 1].map(i => (
        <div key={i} style={{
          transform: `rotate(${i ? 4 : -4}deg)`,
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
        }}>
          {(holeCards && holeCards[i])
            ? <PlayingCard rank={holeCards[i].rank} suit={holeCards[i].suit} w={m.hw} h={m.hh} />
            : <CardBack w={m.hw} h={m.hh} branded />}
        </div>
      ))}
    </div>
  );
}

// Convenience wrapper for single-agent felts (backward-compat).
export function FeltDiorama({ f, hole, board, street, room = IDENTITY_ROOM, mini = false }) {
  return (
    <>
      <FeltBoard f={f} board={board} street={street} room={room} mini={mini} />
      <FeltHoleCards f={f} x={f.cx} hole={hole} room={room} mini={mini} />
    </>
  );
}

// ── FL-1 · the pip at his feet ───────────────────────────────────────────────
// One pip, and only when he has news. GREW is teal because an attribute moved
// up; WORN is gold because a band settled; POCKET $0 is muted and bordered
// weakly on purpose — the broke pip states a fact and does not accuse anyone.
export const PIPS = {
  grew:  { label: 'GREW',      color: M_TEAL,  border: 'AA' },
  worn:  { label: 'WORN',      color: M_GOLD,  border: 'AA' },
  broke: { label: 'POCKET $0', color: '#6B6B6B', border: '55' },
};

export function RestPip({ kind, count }) {
  const p = PIPS[kind];
  if (!p) return null;
  const label = kind === 'grew' && count > 0 ? `+${count} ${p.label}` : p.label;
  return (
    <span
      className="floor-pip"
      data-pip={kind}
      style={{ color: p.color, border: `1px solid ${p.color}${p.border}` }}
    >{label}</span>
  );
}

// ── FL-1 · a body at the bar ─────────────────────────────────────────────────
// Names are earned, not worn: at the bar the posture is the identity, so no
// name chip is drawn unless this is the ghost the owner has selected.
//
// The chip is visual only. The button keeps its accessible name either way —
// a screen-reader user still has to know whose body they are about to tap, and
// "posture is the identity" is a rule about what the eye reads, not a licence
// to ship an unlabelled control.
export function BarGhost({
  x, y, name, accent = M_TEAL, mood = 'neutral', size = 46, speed = 6,
  drink = false, dim = false, pip = null, pipCount = 0, selected = false,
  onClick, room = IDENTITY_ROOM,
}) {
  const m = MOODS[safeMood(mood)];
  return (
    <button
      type="button"
      className={`floor-occupant floor-bar-ghost${dim ? ' is-dim' : ''}${selected ? ' is-selected' : ''}`}
      style={roomStyle(room, x, y)}
      onClick={onClick}
      aria-label={`${name} — ${m.label.toLowerCase()}`}
    >
      {selected && <GhostChip name={name} accent={accent} state="resting" />}
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
          width: size * 1.05,
          background: `radial-gradient(ellipse, ${m.color}26, transparent 70%)`,
        }}
      />
      {pip && <RestPip kind={pip} count={pipCount} />}
    </button>
  );
}

// ── FLOOR-3 · the rest of the table ──────────────────────────────────────────
// A felt carrying only the owner's agents is a lie about the game: the watch
// screen shows six seats and the floor showed two. The house regulars sit on
// the felt now, but they are scenery — grey accent, no cards, no tap, and
// dimmer than anybody the owner actually employs.
//
// The name chip is the one exception to "names are earned". A house body has
// no posture of its own (they are all drawn the same, on purpose), so the name
// is the only thing that tells the owner who his agent is up against.
export function HouseGhost({
  x, y, name, size = 32, speed = 6, room = IDENTITY_ROOM,
}) {
  return (
    <div className="floor-occupant floor-house-ghost" style={roomStyle(room, x, y)}>
      <GhostChip name={name} accent={M_GREY} state="resting" />
      <span className="floor-occupant__body">
        <FloorGhost mood="neutral" accent={M_GREY} size={size} speed={speed} />
      </span>
      <span
        className="floor-occupant__shadow"
        style={{
          width: size * 1.05,
          background: `radial-gradient(ellipse, ${M_GREY}1A, transparent 70%)`,
        }}
      />
    </div>
  );
}

// ── FL-3 · he walks in ───────────────────────────────────────────────────────
// One body, a trail behind it, a destination ahead. The newborn's arriving
// body IS his body — there is no second copy of him anywhere on the floor, so
// CasinoFloor drops him from the ordinary placements while this is on screen.
//
// He wears his name for this one crossing: he has just been born and nobody
// knows the posture yet, which is exactly the case rule 2 makes room for.
export function WalkIn({
  from, to, name, accent = M_TEAL, mood = 'neutral', size = 50,
  onClick, room = IDENTITY_ROOM,
}) {
  const { k } = room;
  const left = Math.min(from.x, to.x);
  const trail = roomStyle(room, left, to.y + size * 0.92);
  return (
    <>
      <div
        className="floor-walkin__trail"
        style={{
          ...trail,
          // The trail is a span, not a point: undo the centring roomStyle
          // applies so it starts at the door and ends under him.
          transform: `scale(${k})`,
          transformOrigin: 'top left',
          width: Math.abs(to.x - from.x),
          background: `linear-gradient(90deg, transparent, ${accent}33 55%, ${accent}66)`,
        }}
        aria-hidden
      />
      <button
        type="button"
        className="floor-occupant floor-walkin"
        style={roomStyle(room, to.x, to.y)}
        onClick={onClick}
        aria-label={`${name} — arriving`}
      >
        <GhostChip name={name} accent={accent} state="resting" />
        <span className="floor-occupant__body" style={{ position: 'relative' }}>
          <span
            className="floor-walkin__halo"
            style={{
              width: size * 2.1,
              height: size * 2.1,
              background: `radial-gradient(circle, ${accent}1F, transparent 70%)`,
            }}
            aria-hidden
          />
          <FloorGhost mood={mood} accent={accent} size={size} speed={4.2} />
        </span>
      </button>
    </>
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
