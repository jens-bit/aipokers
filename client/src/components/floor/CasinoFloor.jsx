// THE CASINO FLOOR — the camera never moves. The room redresses itself by
// how many agents are playing. Ported from design-refs/mood-casino.jsx.

import { Fragment, useCallback, useEffect, useState } from 'react';
import { getUserId } from '../../lib/telegram.js';
import { Occupant, PotTicker, accentFor, speedFor, M_TEAL } from './atoms.jsx';
import { RoomLayer } from './RoomLayer.jsx';
import { FloorZoom } from './FloorZoom.jsx';
import { LAYOUTS, layoutFor, pctX, pctY } from './layouts.js';
import { moodOf, stateOf, splitFloor, standupLine } from './agentView.js';

const POLL_MS = 10_000;

export function CasinoFloor({ liveGame, onCreateAgent, onChat, onWatch }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomedId, setZoomedId] = useState(null);

  const load = useCallback(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => setAgents(Array.isArray(data.agents) ? data.agents : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Resolve against the latest poll so a zoomed agent stays current (and
  // closes cleanly if it disappears from the roster).
  const zoomed = agents.find((a) => a.id === zoomedId) || null;

  const { playing, resting, lounge } = splitFloor(agents);
  const layout = layoutFor(playing.length);
  const L = LAYOUTS[layout];
  const litFelts = L.felts.filter((f) => f.lit);
  const ftu = !loading && agents.length === 0;

  // Compact diamond layouts shrink the cast so four ghosts still fit.
  const mini = layout === 'three' || layout === 'full';
  const ghostSize = mini ? 40 : layout === 'two' ? 50 : 56;

  // Ghost block height, so an occupant hangs above its felt like the ref.
  const ghostBlock = (ghostSize * 1.2) + 19 + 3;

  // Everyone resting stands at the bar. With no lounge corner in the compact
  // diamonds, the lounge crowd joins them rather than disappearing.
  const barAgents = L.corner ? [...resting, ...lounge.slice(1)] : [...resting, ...lounge];
  const barSlots = spreadAlongBar(barAgents, L.bar);

  return (
    <div className={`floor${zoomed ? ' is-zoomed' : ''}`}>
      <div className="floor__room-wrap">
        <RoomLayer layout={layout} ftu={ftu} />
      </div>

      <div className="floor-standup">
        <span className="floor-standup__label">Standup</span>
        <span className="floor-standup__line">
          {loading
            ? 'Reading the room…'
            : standupLine({ playing, resting, lounge, total: agents.length })}
        </span>
      </div>

      {/* seated agents, one per lit felt */}
      {playing.slice(0, litFelts.length).map((agent, i) => {
        const f = litFelts[i];
        const pot = liveGame?.agentId === agent.id && Number.isFinite(liveGame?.pot)
          ? liveGame.pot.toLocaleString()
          : null;
        return (
          <Fragment key={agent.id}>
            <Occupant
              x={f.cx}
              y={f.cy - ghostBlock + 8}
              name={agent.name}
              accent={accentFor(agent, i)}
              mood={moodOf(agent)}
              state="live"
              size={ghostSize}
              speed={speedFor(agent, i)}
              onClick={() => setZoomedId(agent.id)}
            />
            {pot && <PotTicker x={f.cx} y={f.cy + f.ry + 8} amount={pot} mini={mini} />}
          </Fragment>
        );
      })}

      {/* the bar — resting agents spread along the counter */}
      {barSlots.map(({ agent, x }, i) => (
        <Occupant
          key={agent.id}
          x={x}
          y={L.bar.y - 102}
          name={agent.name}
          accent={accentFor(agent, i)}
          mood={moodOf(agent)}
          state={stateOf(agent)}
          size={mini ? 44 : 48}
          speed={speedFor(agent, i)}
          drink
          onClick={() => setZoomedId(agent.id)}
        />
      ))}

      {/* the lounge corner — one sulking or tilted agent sits apart */}
      {L.corner && lounge.slice(0, 1).map((agent) => (
        <Occupant
          key={agent.id}
          x={L.corner.cx}
          y={L.corner.cy - 62}
          name={agent.name}
          accent={accentFor(agent, 0)}
          mood={moodOf(agent)}
          state={stateOf(agent)}
          size={50}
          speed={speedFor(agent, 3)}
          dim
          onClick={() => setZoomedId(agent.id)}
        />
      ))}

      {ftu && (
        <FtuStool
          onClick={onCreateAgent}
          x={LAYOUTS.quiet.bar.x1 + 100}
          y={LAYOUTS.quiet.bar.y - 102}
        />
      )}

      {zoomed && (
        <FloorZoom
          agent={zoomed}
          index={agents.indexOf(zoomed)}
          livePot={liveGame?.agentId === zoomed.id ? liveGame?.pot : null}
          onBack={() => setZoomedId(null)}
          onChat={() => onChat(zoomed)}
          onWatch={() => onWatch(zoomed)}
        />
      )}
    </div>
  );
}

// Evenly spaces agents along the bar counter, capped at what physically fits
// so ghosts never stack on top of each other on a narrow bar.
const BAR_SLOT_W = 62;
function spreadAlongBar(agents, bar) {
  if (!agents.length) return [];
  const span = bar.x2 - bar.x1;
  const capacity = Math.max(1, Math.floor(span / BAR_SLOT_W));
  const shown = agents.slice(0, capacity);
  const step = span / (shown.length + 1);
  return shown.map((agent, i) => ({ agent, x: bar.x1 + step * (i + 1) }));
}

function FtuStool({ x, y, onClick }) {
  return (
    <button
      type="button"
      className="floor-ftu"
      style={{ left: pctX(x), top: pctY(y) }}
      onClick={onClick}
    >
      <span className="floor-ftu__chip">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={M_TEAL}
          strokeWidth="3" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        Draft your first agent
      </span>
      <svg width="58" height="70" viewBox="0 0 80 96" style={{ display: 'block' }} aria-hidden>
        <defs>
          <radialGradient id="ftuFloorGlow" cx="50%" cy="50%" r="55%">
            <stop offset="0" stopColor={M_TEAL} stopOpacity="0.16" />
            <stop offset="1" stopColor={M_TEAL} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="40" cy="46" rx="44" ry="42" fill="url(#ftuFloorGlow)" />
        <path d="M40 10 C26 10 18 24 18 42 L18 78 Q23 87 28 81 Q33 75 39 81 Q45 87 50 81 Q55 75 60 81 L60 42 C60 24 54 10 40 10 Z"
          fill="none" stroke={`${M_TEAL}66`} strokeWidth="1.3" strokeDasharray="4,4" />
        <ellipse cx="40" cy="42" rx="13.5" ry="16.5" fill="none"
          stroke={`${M_TEAL}44`} strokeWidth="1" strokeDasharray="2,3" />
      </svg>
      <span className="floor-ftu__shadow" />
    </button>
  );
}
