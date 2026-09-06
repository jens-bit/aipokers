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

import { useEffect, useRef, useState } from 'react';
import { FLAT } from './flat.js';
import { MiniFelt } from './MiniFelt.jsx';
import { useOnScreen, useThrottled } from '../../hooks/useThrottledFrame.js';
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
  const line = plateLine(agent, { now });
  const walking = !agent?.liveGame;

  // BUGS-A job 8 · THE FRAME PLAYS, AND IT PAYS FOR ITSELF.
  //
  // The picture is fed straight off HOME_STATE, which pushes whenever anything
  // in the household changes — so without this, four frames repaint several
  // times a second in the corner of a screen whose subject is the room. One
  // repaint a second is more than a 46px felt can show, and a frame that is
  // scrolled out of the room, or a Mini App the owner has swiped away from,
  // paints nothing at all until he comes back.
  //
  // The plate is deliberately NOT throttled: "41 min" and the session net are
  // not motion, and holding them back would be a stale fact rather than a
  // skipped frame.
  const ref = useRef(null);
  const awake = useOnScreen(ref);
  const live = useThrottled(agent?.liveGame ?? null, 1000, { active: awake });

  return (
    <button
      type="button"
      ref={ref}
      className={`home-frame${hot ? ' is-hot' : ''}${walking ? ' is-walking-in' : ''}`}
      style={{ width }}
      onClick={onClick}
      data-agent={agent?.id}
      data-live={awake ? 'true' : 'paused'}
      data-testid={`home-frame-${agent?.id}`}
      aria-label={`${agent?.name ?? 'Agent'} at the casino${line ? ` — ${line}` : ''}. Watch him.`}
    >
      <MiniFelt liveGame={live} accent={accent} width={width} hot={hot} money={money} />
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
