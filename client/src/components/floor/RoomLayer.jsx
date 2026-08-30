// The architecture, drawn from a layout — ported from mood-casino.jsx.
// Gradients, opacities and path maths are verbatim.

import { FLOOR_W, FLOOR_H, LAYOUTS } from './layouts.js';

const M_TEAL = '#00D4AA';
const M_GOLD = '#CDB380';

export function RoomLayer({ layout, ftu, viewBox }) {
  const L = LAYOUTS[layout] || LAYOUTS.one;
  const o = ftu ? 0.4 : (L.dimRoom ? 0.62 : 1);
  const b = L.bar;
  const mid = (b.x1 + b.x2) / 2;
  const rise = b.sliver ? 8 : 22;
  const depth = b.sliver ? 16 : 26;

  return (
    <svg
      className="floor__room"
      viewBox={viewBox || `0 0 ${FLOOR_W} ${FLOOR_H}`}
      preserveAspectRatio={viewBox ? 'xMidYMid slice' : 'xMidYMid meet'}
      aria-hidden
    >
      <defs>
        <radialGradient id={`feltG${layout}`} cx="50%" cy="42%" r="62%">
          <stop offset="0" stopColor="#2f5a50" />
          <stop offset="0.65" stopColor="#1d362e" />
          <stop offset="1" stopColor="#152822" />
        </radialGradient>
        <radialGradient id={`feltD${layout}`} cx="50%" cy="42%" r="62%">
          <stop offset="0" stopColor="#213a32" />
          <stop offset="1" stopColor="#16241f" />
        </radialGradient>
        <radialGradient id={`poolG${layout}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={M_TEAL} stopOpacity="0.26" />
          <stop offset="1" stopColor={M_TEAL} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`cornerG${layout}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#2a2233" stopOpacity="0.85" />
          <stop offset="1" stopColor="#1A1A1E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`barG${layout}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#302c27" />
          <stop offset="1" stopColor="#1a1815" />
        </linearGradient>
      </defs>

      {/* a light pool per lit felt — the room's lighting follows occupancy */}
      {L.felts.filter((f) => f.lit).map((f, i) => (
        <ellipse key={`p${i}`} cx={f.cx} cy={f.cy} rx={f.rx * 1.65} ry={f.ry * 2.5}
          fill={`url(#poolG${layout})`} opacity={o} />
      ))}
      {!b.sliver && (
        <ellipse cx={mid} cy={b.y - 30} rx={(b.x2 - b.x1) * 0.62} ry="92"
          fill={`url(#poolG${layout})`} opacity={o * (L.dimRoom ? 0.9 : 0.6)} />
      )}

      {/* lounge corner — its own pool of light, dimmer and cooler than the
          room, so the corner reads as a place rather than unlit floor */}
      {L.corner && (
        <>
          <ellipse cx={L.corner.cx} cy={L.corner.cy} rx={L.corner.rx + 40} ry={L.corner.ry + 34}
            fill={`url(#cornerG${layout})`} />
          <ellipse cx={L.corner.cx} cy={L.corner.cy + 42} rx="44" ry="16"
            fill="#0e1216" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <ellipse cx={L.corner.cx} cy={L.corner.cy + 40} rx="44" ry="16" fill="#12161b" />
          <ellipse cx={L.corner.cx} cy={L.corner.cy + 40} rx="44" ry="16"
            fill="none" stroke="rgba(155,123,255,0.16)" strokeWidth="1" />
        </>
      )}

      {/* felts. A lit felt carries its full wooden rail; an unlit one keeps the
          same anatomy but recedes — the opaque rail and near-black fill were
          reading as hard dark blobs against the ground on a quiet night. */}
      {L.felts.map((f, i) => (
        <g key={`f${i}`} opacity={o}>
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx + (f.lit ? 9 : 7)} ry={f.ry + (f.lit ? 9 : 7)}
            fill="#241d15" opacity={f.lit ? 1 : 0.34} />
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry}
            fill={f.lit ? `url(#feltG${layout})` : `url(#feltD${layout})`}
            opacity={f.lit ? 1 : 0.62}
            stroke={f.lit ? `${M_TEAL}2E` : `${M_TEAL}1F`} strokeWidth={f.lit ? 1.2 : 0.9} />
          {f.lit && (
            <ellipse cx={f.cx} cy={f.cy} rx={f.rx - 13} ry={f.ry - 11}
              fill="none" stroke={`${M_TEAL}14`} strokeWidth="0.8" />
          )}
        </g>
      ))}

      {/* bar counter. The bottles sit 30px clear of the counter top, so without
          a back-bar behind them they read as strips floating in the dark. The
          back panel and shelf give them something to stand on and tie the whole
          bar together as one piece of furniture. */}
      <g opacity={o}>
        {!b.sliver && (
          <>
            <path
              d={`M${b.x1 + 10} ${b.y - 60} Q${mid} ${b.y - 60 - rise * 0.7} ${b.x2 - 10} ${b.y - 60} L${b.x2 - 10} ${b.y - 24} Q${mid} ${b.y - 24 - rise * 0.7} ${b.x1 + 10} ${b.y - 24} Z`}
              fill="#100e0c" opacity="0.85" />
            <path
              d={`M${b.x1 + 10} ${b.y - 30} Q${mid} ${b.y - 30 - rise * 0.7} ${b.x2 - 10} ${b.y - 30} L${b.x2 - 10} ${b.y - 24} Q${mid} ${b.y - 24 - rise * 0.7} ${b.x1 + 10} ${b.y - 24} Z`}
              fill="#1d1a16" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
          </>
        )}
        {!b.sliver && [0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={b.x1 + 22 + i * ((b.x2 - b.x1 - 50) / 4)} y={b.y - 52}
            width="7" height="22" rx="2.5"
            fill={i % 2 ? `${M_GOLD}26` : `${M_TEAL}26`} opacity="0.8" />
        ))}
        <path
          d={`M${b.x1} ${b.y} Q${mid} ${b.y - rise} ${b.x2} ${b.y} L${b.x2} ${b.y + depth} Q${mid} ${b.y + depth - rise + 4} ${b.x1} ${b.y + depth} Z`}
          fill={`url(#barG${layout})`} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <path d={`M${b.x1} ${b.y} Q${mid} ${b.y - rise} ${b.x2} ${b.y}`}
          fill="none" stroke={`${M_TEAL}3D`} strokeWidth="1.2" />
      </g>
    </svg>
  );
}
