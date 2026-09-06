// client/src/components/home/CasinoOnTv.jsx — HOME-2 job 4
//
// THE CASINO, IN MINIATURE, ON THE TELEVISION AT THE BOTTOM OF THE ROOM.
//
// The set is what lets you see the casino from the sofa without leaving. It has
// exactly two states and both of them are true things rather than decoration:
//
//   A GAME IS ON   one of yours is in a hand out there, so the set shows THAT
//                  HAND — MiniFelt (BUGS-A job 8), the same miniature the away
//                  frame on the wall draws. One drawing of a felt in this
//                  product; a second copy is a second thing to disagree.
//   NOBODY IS IN   the board: the three rooms, their stakes, how many tables
//                  are running in each. Drawing a felt he is not sitting at
//                  would be the one outright lie on the screen (board 29 F07b
//                  makes the same call about YOUR TABLE in the casino).
//
// The read is paid HERE rather than in HomeScreen, the way TableSheet pays for
// useSlots: it is one GET, it is only worth making because there is a set to
// put it on, and a room whose /api/rooms is slow must not be a room whose
// bodies are slow. Absent an answer the set names the rooms and says nothing
// about them, which is what a television with no signal looks like.

import { useEffect, useState } from 'react';

import { MiniFelt } from './MiniFelt.jsx';
import { identityOf } from '../../lib/identity.js';

export const ROOMS_URL = '/api/rooms';

/**
 * Which of yours the set is showing.
 *
 * The one actually IN a hand, and the biggest pot of them if more than one is —
 * a set showing the quietest table in the building is a set nobody looks at.
 */
export function onScreen(away = []) {
  const live = away.filter((a) => a?.liveGame?.tableId);
  if (live.length === 0) return null;
  return live.reduce((best, a) => (
    (Number(a.liveGame.pot) || 0) > (Number(best.liveGame.pot) || 0) ? a : best
  ), live[0]);
}

/** The three rooms as the set writes them: stakes, and how many are running. */
export function useRooms(enabled) {
  const [rooms, setRooms] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    fetch(ROOMS_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (alive && Array.isArray(body?.rooms)) setRooms(body.rooms); })
      .catch(() => { /* no signal; the set says the room names and no more */ });
    return () => { alive = false; };
  }, [enabled]);
  return rooms;
}

export function CasinoOnTv({ away = [] }) {
  const showing = onScreen(away);
  const rooms = useRooms(!showing);

  if (showing) {
    return (
      <span className="home-tv__live" data-testid="home-tv-felt">
        <MiniFelt
          liveGame={showing.liveGame}
          accent={identityOf(showing).glow.c}
          width={100}
          hot={!!showing.liveGame?.hot}
        />
      </span>
    );
  }

  return (
    <span className="home-tv__board" data-testid="home-tv-board">
      <span className="home-tv__title">THE CASINO</span>
      <span className="home-tv__rooms">
        {(rooms ?? []).slice(0, 3).map((room) => (
          <span key={room.id} className="home-tv__room">
            <span className="home-tv__stakes">{shortStakes(room)}</span>
            <span className="home-tv__tables">
              {room.tables === 1 ? '1 table' : `${room.tables ?? 0} tables`}
            </span>
          </span>
        ))}
      </span>
      <span className="home-tv__live-dot" aria-hidden />
    </span>
  );
}

/**
 * The third thing the set can be showing, and the ref's own first one: a hand
 * being reviewed. The ref's TV takes a `tape` prop and switches between the
 * flagged hand and the casino ticker, and this is that switch's other half —
 * three bars rising, which is what a replay running looks like at 100px. It
 * used to be drawn at a fixed point in the left corner where the old set was;
 * it lives INSIDE the screen now, so it moves when the furniture does.
 */
export function TapeOnTv() {
  return (
    <span className="home-tv__tape" data-testid="home-tape">
      {[0, 1, 2].map((i) => <i key={i} style={{ animationDelay: `${i * 0.45}s` }} />)}
    </span>
  );
}

/** "$10/$20" as the set has room to write it: "10/20". */
export function shortStakes(room) {
  const label = String(room?.stakes?.label ?? '');
  const stripped = label.replace(/\$/g, '');
  if (stripped) return stripped;
  const sb = room?.stakes?.smallBlind;
  const bb = room?.stakes?.bigBlind;
  return Number.isFinite(sb) && Number.isFinite(bb) ? `${sb}/${bb}` : '';
}
