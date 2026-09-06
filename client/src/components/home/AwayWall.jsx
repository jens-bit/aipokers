// client/src/components/home/AwayWall.jsx — HOME-1
//
// An agent at the casino is a FRAMED LIVE WINDOW on the wall. Ported from
// design-refs/mood-home.jsx (`AwayFrame` / `AwayWall`).
//
// The ref's own note on why this exists: round 1 drew an away agent as a chair
// with a caption, and a caption is not a presence. A picture of the table he is
// actually at — his seat lit and pulsing, cards landing, the pot in the corner —
// is a thing you look at, and it is the only place on this screen where an agent
// who is out is visible at all.
//
// The brass plate under the picture is the only line of text, and the brief
// fixes it: ROOM · NET · MINUTES. Not a status, not a mood — the three facts
// that decide whether you go and look.
//
// The data is presentAgent's `liveGame` (AGE-37: street, board, pot, heroHole,
// handNumber) plus `location.room` and `location.since`. Everything the frame
// draws is real; nothing here invents a number. A frame with no live game yet —
// he is walking to a seat, `where` is 'casino' — draws the room dark and says
// so, because a fake felt is worse than an honest empty one.

import { useEffect, useState } from 'react';
import { FLAT } from './flat.js';
import { money, signedMoney } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';

const ROOM_LABEL = { floor: '10/20', upstairs: '25/50', backroom: '50/100' };

export function roomLabel(room) {
  return ROOM_LABEL[room] ?? null;
}

/** "25/50 · +$340 · 41 min" — and never a field the server did not send. */
export function plateLine(agent, { now = Date.now() } = {}) {
  const parts = [];
  const room = roomLabel(agent?.location?.room);
  if (room) parts.push(room);

  const net = agent?.liveGame?.net ?? agent?.pocket?.sessionNet ?? null;
  if (Number.isFinite(net)) parts.push(signedMoney(Math.round(net)));

  const since = Number(agent?.location?.since);
  if (Number.isFinite(since) && since > 0) {
    const mins = Math.max(0, Math.floor((now - since) / 60_000));
    parts.push(`${mins} min`);
  }
  return parts.join(' · ');
}

export function AwayFrame({ agent, accent, width = 118, hot = false, onClick, now = Date.now() }) {
  const live = agent?.liveGame ?? null;
  const pot = Number(live?.pot) || 0;
  const board = Array.isArray(live?.board) ? live.board : [];
  const line = plateLine(agent, { now });
  const walking = !live;

  return (
    <button
      type="button"
      className={`home-frame${hot ? ' is-hot' : ''}${walking ? ' is-walking-in' : ''}`}
      style={{ width }}
      onClick={onClick}
      data-agent={agent?.id}
      data-testid={`home-frame-${agent?.id}`}
      aria-label={`${agent?.name ?? 'Agent'} at the casino${line ? ` — ${line}` : ''}. Watch him.`}
    >
      <span className="home-frame__picture" aria-hidden>
        <span className="home-frame__felt" style={{ width: width * 0.6, marginLeft: -(width * 0.3) }} />
        {/* the rest of the table: bodies, unlit, so his own seat is the one you find */}
        {[0.2, 0.36, 0.64, 0.8].map((lx, i) => (
          <span key={lx} className="home-frame__body" style={{ left: `${lx * 100}%`, top: i % 2 ? 8 : 30 }} />
        ))}
        {/* his seat, lit and pulsing */}
        <span
          className="home-frame__seat"
          style={{ background: accent, boxShadow: `0 0 7px ${accent}` }}
        />
        {/* the board he is playing, as far as it has run */}
        <span className="home-frame__cards">
          {board.slice(0, 5).map((c, i) => <span key={`${c}${i}`} className="home-frame__card" />)}
        </span>
        {pot > 0 ? <span className="home-frame__pot">{money(Math.round(pot))}</span> : null}
        {hot ? <span className="home-frame__glow" /> : null}
      </span>
      <span className="home-frame__plate">
        <span className="home-frame__name">{pillName(agent?.name)}</span>
        <span className={`home-frame__line${line.includes('−') ? ' is-down' : ''}`}>
          {line || (walking ? 'walking in' : '')}
        </span>
      </span>
    </button>
  );
}

/**
 * The wall. Frames first, then empty hooks for the agents he has not created —
 * the ref's own device, and the only "you could have more" this screen makes.
 * It is a hook on a wall, not a price.
 */
export function AwayWall({ away = [], accentFor, hooks = 0, onWatch }) {
  // Re-render once a minute so the "41 min" on the plate is not frozen at the
  // value it had when the last push happened.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const width = away.length > 3 ? 86 : away.length > 2 ? 112 : 132;
  return (
    <div
      className="home-wall"
      style={{ left: FLAT.wall.x, top: FLAT.wall.y, width: FLAT.wall.w, height: FLAT.wall.h }}
      data-testid="home-wall"
    >
      {away.map((agent) => (
        <AwayFrame
          key={agent.id}
          agent={agent}
          accent={accentFor(agent)}
          width={width}
          hot={!!agent?.liveGame?.hot}
          now={now}
          onClick={() => onWatch?.(agent)}
        />
      ))}
      {Array.from({ length: Math.max(0, hooks) }).map((_, i) => (
        <span key={`hook${i}`} className="home-wall__hook" aria-hidden><i /></span>
      ))}
    </div>
  );
}
