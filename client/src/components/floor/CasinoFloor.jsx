// THE CASINO FLOOR — the camera never moves. The room redresses itself by
// how many agents are playing. Ported from design-refs/mood-casino.jsx.

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { Occupant, GhostChip, FloorGhost, PotTicker, FeltBoard, FeltHoleCards, dioramaMetrics, accentFor, speedFor, MOODS, safeMood, M_TEAL } from './atoms.jsx';
import { fatigueOf } from '../../lib/attributes.js';
import { RoomLayer } from './RoomLayer.jsx';
import { FloorZoom } from './FloorZoom.jsx';
import { LAYOUTS, layoutFor, projectRoom, roomStyle, zoomViewBox } from './layouts.js';
import { moodOf, stateOf, splitFloor, standupLine } from './agentView.js';
import { FlaggedHandsSheet } from './FlaggedHandsSheet.jsx';

const POLL_MS = 10_000;

// ATTR-2e-2 — the worn posture at the felt.
// Port of design-refs/char-play.jsx WornGhost / WornOccupant. Worn is a POSTURE
// SWAP and nothing more: same ghost, same mood, same accent, same seat. He bobs
// slower (speed x1.7) and his lids ride that same bob so they cannot drift off
// the eyes. Nothing about the felt or his cards changes — the fish-tank law is
// untouched by fatigue.
const WORN_SPEED = 1.7;

function WornOccupant({
  x, y, name, accent, mood, state, size = 56, speed = 5,
  stack = null, chipMaxW, dim, onClick, room,
}) {
  const key = safeMood(mood);
  const m = MOODS[key];
  const slowed = speed * WORN_SPEED;
  // Matches FloorGhost's own eye line, so the lids sit on the eyes at any size.
  const cy = key === 'sulking' ? 46 : 42;

  return (
    <button
      type="button"
      className={`floor-occupant${dim ? ' is-dim' : ''}`}
      style={roomStyle(room, x, y)}
      onClick={onClick}
      aria-label={`${name} — ${m.label.toLowerCase()}, worn`}
    >
      <GhostChip name={name} accent={accent} state={state} stack={stack} chipMaxW={chipMaxW} />
      <span
        className="floor-occupant__body"
        style={{ position: 'relative', transform: 'translateY(4px) scale(0.985)' }}
      >
        <FloorGhost mood={mood} accent={accent} size={size} speed={slowed} />
        <span
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            animation: `floor-bob ${slowed}s ease-in-out infinite`,
          }}
          aria-hidden
        >
          <svg width={size} height={size * 1.2} viewBox="0 0 80 96" style={{ display: 'block', overflow: 'visible' }}>
            <rect x="26" y={cy - 7.6} width="28" height="6.4" fill="#04070C" />
            <path d={`M27 ${cy - 1.4} L53 ${cy - 1.4}`} stroke={`${accent}55`} strokeWidth="0.9" strokeLinecap="round" />
          </svg>
        </span>
      </span>
      <span
        className="floor-occupant__shadow"
        style={{ width: size * 1.1, background: `radial-gradient(ellipse, ${m.color}2E, transparent 70%)` }}
      />
    </button>
  );
}

export function CasinoFloor({ liveGame, onCreateAgent, onChat, onWatch, onProfile, onDeploy, desktopMode = false, onGhostSelect, selectedAgentId }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownZoomedId, setOwnZoomedId] = useState(null);
  // Desktop drives selection from the panel (roster clicks, Escape), so the
  // ghost highlight follows the owner when one is supplied. Mobile stays local.
  const controlled = desktopMode && selectedAgentId !== undefined;
  const zoomedId = controlled ? selectedAgentId : ownZoomedId;
  const setZoomedId = controlled ? () => {} : setOwnZoomedId;
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
    fetch(`/api/agents?userId=${getUserId()}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } })
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
  // MST-4: agents at the SAME table share one felt. A felt is a table, not an
  // agent -- with multi-seat matchmaking several of your ghosts routinely sit
  // down together, and drawing them at separate felts would be a lie about
  // where they are.
  const tables = groupByTable(playing);
  const layout = layoutFor(tables.length);
  const L = LAYOUTS[layout];
  const litFelts = L.felts.filter((f) => f.lit);
  const ftu = !loading && agents.length === 0;

  // Compact diamond layouts shrink the cast so four ghosts still fit.
  const mini = layout === 'three' || layout === 'full';
  const ghostSize = mini ? 40 : layout === 'two' ? 50 : 56;

  // Everyone resting stands at the bar. With no lounge corner in the compact
  // diamonds, the lounge crowd joins them rather than disappearing.
  const barAgents = L.corner ? [...resting, ...lounge.slice(1)] : [...resting, ...lounge];
  const barSlots = spreadAlongBar(barAgents, L.bar);

  // Every occupant's anchor is resolved once, so the zoom can aim its camera
  // at the right spot in the room and the felt/bar/lounge layers stay in sync.
  const placements = [
    ...tables.slice(0, litFelts.length).flatMap((group, fi) => {
      const f = litFelts[fi];
      // Up to three ghosts side by side at the near rail: same seated posture,
      // spread across the felt's width. Beyond three the felt simply stops
      // adding bodies (the pot ticker still speaks for the table).
      const seated = group.agents.slice(0, FELT_SEATS);
      const shrink = seated.length === 1 ? 1 : seated.length === 2 ? 0.84 : 0.7;
      const size = Math.round(ghostSize * shrink);
      const span = (f.rx * 2 - 18) / Math.max(seated.length, 1);
      // One ticker per felt, fed by whichever seated agent reports the pot.
      const feltPot = group.agents.map(potFor).find(Boolean) ?? null;
      const ghostY = f.cy - Math.round(size * 1.2) - 14;
      const bwCheck = mini ? 13 : 17;
      const dioFits = dioramaMetrics(f, bwCheck, mini ? 24 : 32).fits;
      const potY = feltPot != null
        ? (dioFits ? ghostY - 27 : f.cy + f.ry + 8)
        : null;
      // Clamp name chip width when multiple ghosts share a felt so they don't
      // bleed into each other. Stack value is dropped at that point — the pot
      // ticker already shows the table total.
      const chipMaxW = seated.length > 1 ? Math.max(28, Math.round(span) - 26) : undefined;
      return seated.map((agent, i) => {
        const lg = agent?.liveGame;
        const agentStack = lg?.heroStack ?? null;
        return {
          agent,
          felt: i === 0 ? f : null,
          feltRef: f,
          feltBoard: i === 0 ? { board: lg?.board ?? [], street: lg?.street ?? null } : null,
          feltHole: lg?.heroHole ?? null,
          feltPot: i === 0 ? feltPot : null,
          feltPotY: i === 0 ? potY : null,
          x: f.cx + (i - (seated.length - 1) / 2) * span,
          y: ghostY,
          state: 'live',
          size,
          speed: speedFor(agent, fi + i),
          accentIndex: fi + i,
          stack: agentStack,
          chipMaxW,
        };
      });
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
    <div className={`floor${zoomed && !desktopMode ? ' is-zoomed' : ''}${desktopMode ? ' is-desktop' : ''}`} ref={rootRef}>
      <div className={`floor__room-wrap${zoomed && !desktopMode ? ' is-zoomed' : ''}`}>
        <RoomLayer
          layout={layout}
          ftu={ftu}
          viewBox={!desktopMode && zoomedPlacement ? zoomViewBox(zoomedPlacement.x, zoomedPlacement.y) : undefined}
        />
      </div>

      {/* On mobile, unmount occupants when zoomed so the small ghost stays hidden
          behind the FloorZoom modal. On desktop, occupants stay mounted always. */}
      {(!zoomed || desktopMode) && (
        <>
          {!desktopMode && (
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
          )}

          {placements.map((p) => (
            <Fragment key={p.agent.id}>
              {/* Board: once per felt (first agent at this table). */}
              {p.feltBoard && (
                <FeltBoard
                  f={p.felt}
                  board={p.feltBoard.board}
                  street={p.feltBoard.street}
                  room={room}
                  mini={mini}
                />
              )}
              {/* Hole cards: every seated agent at their own x position. */}
              {p.feltRef && (
                <FeltHoleCards
                  f={p.feltRef}
                  x={p.x}
                  hole={p.feltHole}
                  room={room}
                  mini={mini}
                />
              )}
              {/* Selection ring — the panel is the zoom, so the floor only
                  marks who is open (mood-desktop.jsx DeskFloor `selected`). */}
              {desktopMode && zoomedId === p.agent.id && (
                <span
                  className="floor-sel-ring"
                  style={roomStyle(room, p.x, p.y + p.size * 0.62)}
                  aria-hidden
                />
              )}
              {fatigueOf(p.agent) === 'worn' ? (
                <WornOccupant
                  x={p.x}
                  y={p.y}
                  name={p.agent.name}
                  accent={accentFor(p.agent, p.accentIndex)}
                  mood={moodOf(p.agent)}
                  state={p.state}
                  size={p.size}
                  speed={p.speed}
                  dim={p.dim}
                  stack={p.stack}
                  chipMaxW={p.chipMaxW}
                  room={room}
                  onClick={() => {
                    if (desktopMode) {
                      const newId = p.agent.id === zoomedId ? null : p.agent.id;
                      setZoomedId(newId);
                      onGhostSelect?.(newId ? p.agent : null);
                    } else {
                      setZoomedId(p.agent.id);
                    }
                  }}
                />
              ) : (
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
                stack={p.stack}
                chipMaxW={p.chipMaxW}
                room={room}
                onClick={() => {
                  if (desktopMode) {
                    const newId = p.agent.id === zoomedId ? null : p.agent.id;
                    setZoomedId(newId);
                    onGhostSelect?.(newId ? p.agent : null);
                  } else {
                    setZoomedId(p.agent.id);
                  }
                }}
              />
              )}
              {p.felt && p.feltPot != null && (
                <PotTicker
                  x={p.felt.cx}
                  y={p.feltPotY}
                  amount={p.feltPot}
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

      {zoomed && !desktopMode && (
        <FloorZoom
          agent={zoomed}
          index={agents.indexOf(zoomed)}
          livePot={liveGame?.agentId === zoomed.id ? liveGame?.pot : null}
          onBack={() => setZoomedId(null)}
          onChat={() => onChat(zoomed)}
          onWatch={() => onWatch(zoomed)}
          onProfile={() => { setZoomedId(null); onProfile?.(zoomed); }}
          onDeploy={() => { setZoomedId(null); onDeploy?.(zoomed); }}
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

// How many ghosts one felt seats before it stops adding bodies. The room is a
// diorama, not a seat map: the felt says "a game is happening here", and three
// is as many as reads clearly at this scale.
const FELT_SEATS = 3;

// Playing agents grouped by the table they are actually at, newest table last.
// Agents with no table id of their own each get their own felt.
function groupByTable(playing) {
  const seenIds = new Set();
  const byId = new Map();
  const out = [];
  for (const agent of playing) {
    if (seenIds.has(agent.id)) continue;
    seenIds.add(agent.id);
    const id = agent?.liveGame?.tableId || agent?.activeTableId || null;
    if (!id) { out.push({ id: `solo:${agent.id}`, agents: [agent] }); continue; }
    let group = byId.get(id);
    if (!group) { group = { id, agents: [] }; byId.set(id, group); out.push(group); }
    group.agents.push(agent);
  }
  return out;
}

function potFor(agent) {
  const liveGame = agent?.liveGame;
  return Number.isFinite(liveGame?.pot) && liveGame.pot > 0 ? liveGame.pot.toLocaleString() : null;
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
