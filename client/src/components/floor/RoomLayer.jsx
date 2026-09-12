// The architecture, drawn from a layout — ported from mood-casino.jsx.
// Materials follow the app palette; layout and occupancy still own the geometry.

import { FLOOR_W, FLOOR_H, LAYOUTS } from './layouts.js';

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
          <stop offset="0" stopColor="var(--felt-center)" />
          <stop offset="0.65" stopColor="color-mix(in srgb, var(--felt-center), var(--felt-edge))" />
          <stop offset="1" stopColor="var(--felt-edge)" />
        </radialGradient>
        <radialGradient id={`feltD${layout}`} cx="50%" cy="42%" r="62%">
          <stop offset="0" stopColor="var(--felt-center)" />
          <stop offset="1" stopColor="var(--felt-edge)" />
        </radialGradient>
        <radialGradient id={`poolG${layout}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.26" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`cornerG${layout}`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--wood-deep)" stopOpacity="0.85" />
          <stop offset="1" stopColor="var(--bg-primary)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`barG${layout}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--wood-light)" />
          <stop offset="1" stopColor="var(--wood-deep)" />
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
            fill="var(--wood-deep)" stroke="var(--edge-soft)" strokeWidth="1" />
          <ellipse cx={L.corner.cx} cy={L.corner.cy + 40} rx="44" ry="16" fill="var(--wood-light)" />
          <ellipse cx={L.corner.cx} cy={L.corner.cy + 40} rx="44" ry="16"
            fill="none" stroke="var(--wood-edge)" strokeWidth="1" />
        </>
      )}

      {/* felts. A lit felt carries its full wooden rail; an unlit one keeps the
          same anatomy but recedes — the opaque rail and near-black fill were
          reading as hard dark blobs against the ground on a quiet night. */}
      {L.felts.map((f, i) => (
        <g key={`f${i}`} opacity={o}>
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx + (f.lit ? 9 : 7)} ry={f.ry + (f.lit ? 9 : 7)}
            fill="var(--wood-edge)" opacity={f.lit ? 1 : 0.34} />
          <ellipse cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry}
            fill={f.lit ? `url(#feltG${layout})` : `url(#feltD${layout})`}
            opacity={f.lit ? 1 : 0.62}
            stroke="var(--felt-line)" strokeOpacity={f.lit ? 1 : 0.67} strokeWidth={f.lit ? 1.2 : 0.9} />
          {f.lit && (
            <ellipse cx={f.cx} cy={f.cy} rx={f.rx - 13} ry={f.ry - 11}
              fill="none" stroke="var(--felt-line)" strokeOpacity="0.44" strokeWidth="0.8" />
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
              fill="var(--wood-deep)" opacity="0.85" />
            <path
              d={`M${b.x1 + 10} ${b.y - 30} Q${mid} ${b.y - 30 - rise * 0.7} ${b.x2 - 10} ${b.y - 30} L${b.x2 - 10} ${b.y - 24} Q${mid} ${b.y - 24 - rise * 0.7} ${b.x1 + 10} ${b.y - 24} Z`}
              fill="var(--wood-light)" stroke="var(--wood-edge)" strokeWidth="0.8" />
          </>
        )}
        {!b.sliver && [0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={b.x1 + 22 + i * ((b.x2 - b.x1 - 50) / 4)} y={b.y - 52}
            width="7" height="22" rx="2.5"
            fill={i % 2 ? 'color-mix(in srgb, var(--gold-reward) 15%, transparent)' : 'color-mix(in srgb, var(--accent) 15%, transparent)'} opacity="0.8" />
        ))}
        <path
          d={`M${b.x1} ${b.y} Q${mid} ${b.y - rise} ${b.x2} ${b.y} L${b.x2} ${b.y + depth} Q${mid} ${b.y + depth - rise + 4} ${b.x1} ${b.y + depth} Z`}
          fill={`url(#barG${layout})`} stroke="var(--wood-edge)" strokeWidth="1" />
        <path d={`M${b.x1} ${b.y} Q${mid} ${b.y - rise} ${b.x2} ${b.y}`}
          fill="none" stroke="var(--wood-light)" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
