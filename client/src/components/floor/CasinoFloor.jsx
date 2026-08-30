// THE CASINO FLOOR — the camera never moves. The room redresses itself by
// how many agents are playing. Ported from design-refs/mood-casino.jsx.

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { getUserId } from '../../lib/telegram.js';
import { Occupant, PotTicker, accentFor, speedFor, M_TEAL } from './atoms.jsx';
import { RoomLayer } from './RoomLayer.jsx';
import { FloorZoom } from './FloorZoom.jsx';
import { LAYOUTS, layoutFor, projectRoom, roomStyle, zoomViewBox } from './layouts.js';
import { moodOf, stateOf, splitFloor, standupLine } from './agentView.js';
import { FlaggedHandsSheet } from './FlaggedHandsSheet.jsx';

const POLL_MS = 10_000;

export function CasinoFloor({ liveGame, onCreateAgent, onChat, onWatch }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomedId, setZoomedId] = useState(null);
  const [flaggedAgent, setFlaggedAgent] = useState(null);
  const [room, setRoom] = useState({ k: 1, ox: 0, oy: 0 });
  const rootRef = useRef(null);

  // Occupants live in the room's coordinate space, so they need the same
  // scale + centring offset the browser applies to the room SVG.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setRoom(projectRoom(el.clientWidth, el.clientHeight));
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', load);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', load);
    };
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

  // Card fan height added above the ghost body in the seated posture.
  const SEATED_CARD_H = 44;

  // Everyone resting stands at the bar. With no lounge corner in the compact
  // diamonds, the lounge crowd joins them rather than disappearing.
  const barAgents = L.corner ? [...resting, ...lounge.slice(1)] : [...resting, ...lounge];
  const barSlots = spreadAlongBar(barAgents, L.bar);

  // Every occupant's anchor is resolved once, so the zoom can aim its camera
  // at the right spot in the room and the felt/bar/lounge layers stay in sync.
  const placements = [
    ...playing.slice(0, litFelts.length).map((agent, i) => {
      const f = litFelts[i];
      // Seat the ghost at the near rail: card fan top is the anchor, ghost body
      // top lands ~10px inside the felt bottom so it overlaps the rim naturally.
      return {
        agent, felt: f, x: f.cx, y: f.cy + f.ry - 10 - 3 - SEATED_CARD_H,
        state: 'live', size: ghostSize, speed: speedFor(agent, i), accentIndex: i,
        seated: true,
      };
    }),
    ...barSlots.map(({ agent, x }, i) => ({
      agent, x, y: L.bar.y - 102, state: stateOf(agent),
      size: mini ? 44 : 48, speed: speedFor(agent, i), accentIndex: i, drink: true,
    })),
    ...(L.corner ? lounge.slice(0, 1).map((agent) => ({
      agent, x: L.corner.cx, y: L.corner.cy - 62, state: stateOf(agent),
      size: 50, speed: speedFor(agent, 3), accentIndex: 0, dim: true,
    })) : []),
  ];

  const zoomedPlacement = zoomed ? placements.find((p) => p.agent.id === zoomed.id) : null;

  // First agent with flagged hands — the standup becomes tappable when one exists.
  const flaggableAgent = agents.find((a) => (a.flaggedCount ?? 0) > 0) ?? null;

  return (
    <div className={`floor${zoomed ? ' is-zoomed' : ''}`} ref={rootRef}>
      <div className={`floor__room-wrap${zoomed ? ' is-zoomed' : ''}`}>
        <RoomLayer
          layout={layout}
          ftu={ftu}
          viewBox={zoomedPlacement ? zoomViewBox(zoomedPlacement.x, zoomedPlacement.y) : undefined}
        />
      </div>

      {/* The whole occupant layer is unmounted while zoomed — otherwise the
          agent's small floor ghost stays on screen behind its zoomed self. */}
      {!zoomed && (
        <>
          <div
            className="floor-standup"
            role={flaggableAgent ? 'button' : undefined}
            tabIndex={flaggableAgent ? 0 : undefined}
            onClick={flaggableAgent ? () => setFlaggedAgent(flaggableAgent) : undefined}
            onKeyDown={flaggableAgent ? (e) => { if (e.key === 'Enter' || e.key === ' ') setFlaggedAgent(flaggableAgent); } : undefined}
            style={flaggableAgent ? { cursor: 'pointer' } : undefined}
            aria-label={flaggableAgent ? `${flaggableAgent.flaggedCount} flagged hand${flaggableAgent.flaggedCount !== 1 ? 's' : ''} — tap to review` : undefined}
          >
            <span className="floor-standup__label">Standup</span>
            <span className="floor-standup__line">
              {loading
                ? 'Reading the room…'
                : standupLine({ playing, resting, lounge, total: agents.length })}
            </span>
            {flaggableAgent && (
              <span style={{
                flexShrink: 0, marginLeft: 'auto',
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 18, padding: '0 6px', borderRadius: 3,
                background: 'rgba(155,123,255,0.14)', border: '1px solid rgba(155,123,255,0.35)',
                color: '#9B7BFF',
                fontFamily: "'Oswald', 'Inter', sans-serif",
                fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em',
              }}>
                {flaggableAgent.flaggedCount} FLAGGED
              </span>
            )}
          </div>

          {placements.map((p) => (
            <Fragment key={p.agent.id}>
              <Occupant
                x={p.x}
                y={p.y}
                name={p.agent.name}
                accent={accentFor(p.agent, p.accentIndex)}
                mood={moodOf(p.agent)}
                state={p.state}
                size={p.size}
                speed={p.speed}
                drink={p.drink}
                dim={p.dim}
                seated={p.seated}
                room={room}
                onClick={() => setZoomedId(p.agent.id)}
              />
              {p.felt && potFor(p.agent) && (
                <PotTicker
                  x={p.felt.cx}
                  y={p.felt.cy - p.felt.ry - 12}
                  amount={potFor(p.agent)}
                  mini={mini}
                  room={room}
                />
              )}
            </Fragment>
          ))}

          {ftu && (
            <FtuStool
              onClick={onCreateAgent}
              x={LAYOUTS.quiet.bar.x1 + 100}
              y={LAYOUTS.quiet.bar.y - 102}
              room={room}
            />
          )}
        </>
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

      {flaggedAgent && (
        <FlaggedHandsSheet
          agent={flaggedAgent}
          onBack={() => setFlaggedAgent(null)}
        />
      )}
    </div>
  );
}

function potFor(agent) {
  const liveGame = agent?.liveGame;
  return Number.isFinite(liveGame?.pot) ? liveGame.pot.toLocaleString() : null;
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

function FtuStool({ x, y, onClick, room }) {
  return (
    <button
      type="button"
      className="floor-ftu"
      style={roomStyle(room, x, y)}
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
