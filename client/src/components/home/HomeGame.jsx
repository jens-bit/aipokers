// client/src/components/home/HomeGame.jsx — HOME-1
//
// The kitchen table, live. Ported from design-refs/mood-home.jsx (`HomeGame`).
//
// The board on this table is the REAL board. HOME_STATE hands over an ordinary
// tableId (HOME-STATE-1: "WATCH it exactly as you watch any other table"), so
// this opens the normal spectator socket and draws what comes back. Nothing here
// simulates a hand.
//
// THE ONE THING THIS TABLE MUST NOT HAVE IS MONEY, and that is Jens's
// correction as much as it is the server's law: no pot pill, no P&L, no stack,
// no buy-in. The server plays this game at no stakes and credits nobody; a
// number on the felt would be the screen contradicting the model.
//
// FIX-6 job 4 — AND NO MONEY WORDS EITHER. The felt used to carry the ref's own
// tell, the words FOR NOTHING, on the theory that saying there are no stakes is
// the opposite of naming a stake. Design 52's rule is flatter than that and it
// is the one that stands: no money words on the home table, and FOR NOTHING is
// two of them. A running table now says nothing at all, which is what a kitchen
// table looks like. The label is kept for the empty case, where it is not about
// money — NOBODY AT THE TABLE is a fact about the room.
//
// The chips stay, and they are scenery. They are drawn from the seat count, not
// from a stack, so there is no value they could be read as.

import { useEffect } from 'react';
import { PHONE_ROOM, tableSeats } from './flat.js';
import { pillName } from '../../lib/names.js';
import { PlayingCard, CardBack } from '../system/PlayingCard.jsx';
import { stagedCount } from '../../lib/pace.js';

// BUG-144: terminal STATE can contain the full runout while PACE still holds
// the flop. The room and its preview must reveal the same cards as Watch.
export function homeBoardFor(table, tableId) {
  if (!tableId || table?.config?.tableId !== tableId) return [];
  const community = Array.isArray(table.game?.community) ? table.game.community : [];
  const count = stagedCount(table.paceFrame || table.game?.paceFrame);
  return community.slice(0, Math.min(5, count ?? 5))
    .filter(card => typeof card === 'string' && /^[2-9TJQKA][shdc]$/.test(card));
}

/**
 * Keep a spectator socket pointed at the home table.
 *
 * Its own socket, not the app's: the app's table socket belongs to whatever the
 * owner chose to watch, and the home game must not be able to take it from him.
 */
export function useHomeTable(table, tableId) {
  const { watch, disconnect } = table ?? {};
  useEffect(() => {
    if (!tableId || !watch) return undefined;
    watch({ tableId, displayName: 'Home' });
    return () => { try { disconnect?.(); } catch { /* already gone */ } };
  }, [tableId, watch, disconnect]);
}

/**
 * HOME-2 job 7 — THE CHAIRS ROUND THE TABLE. Ported from `TableChairs` in
 * design-refs/mood-home2.jsx.
 *
 * One chair per agent the owner HAS, and never fewer than one — because there
 * is always a first seat and SLOTS-1 gives it away free. The ones with somebody
 * in them are not drawn: a body IS a taken chair, and an outline behind him
 * would be a second chair at the same seat.
 *
 * This is what makes both of job 7's empty states pictures rather than
 * captions. Nobody yet is ONE CHAIR, nobody in it. A retire is the room with
 * ONE CHAIR FEWER — and nothing else changes, because nothing else should: what
 * is gone is gone, the others do not comment, and the room simply has more
 * space in it (board 29 F16).
 *
 * @param taken  how many seats have a body in them
 * @param of     how many chairs the table has
 */
export function TableChairs({ taken = 0, of = 4, away = [], geometry = PHONE_ROOM }) {
  // Home bodies use a two/three/four-player arrangement. Subtract their
  // actual footprints, not the first N slots of the four-player arrangement.
  const occupied = taken > 0 ? tableSeats(taken, geometry).slice(0, taken) : [];
  const seats = geometry.seats[4].filter(s => occupied.every(p => Math.hypot(p.x-s.x,p.y-s.y)>32))
    .slice(0, Math.max(0, Math.min(4, Math.round(of))-taken));
  return seats.map((seat, i) => {
    const absent=away[i];
    const name=absent ? (absent.nickname || pillName(absent.name)) : null;
    return (
    <span
      key={`chair-${i}`}
      className={`home-chair${absent ? ' home-chair--absent' : ''}`}
      style={{ left: seat.x, top: seat.y }}
      data-chair={i}
      data-absent={absent?.id}
      role={absent ? 'img' : undefined}
      aria-label={absent ? `${name}'s empty chair` : undefined}
      aria-hidden={absent ? undefined : true}
    >{absent && <><span className="home-chair__name">{name}</span><i/></>}</span>
  );});
}

/** The community cards as the felt has actually run them. */
export function HomeBoard({ board = [], desktop = false }) {
  if (!board.length) {
    return (
      <span className="home-game__board" data-testid="home-board">
        {[0, 1].map((i) => <CardBack key={i} w={desktop ? 20 : 16} h={desktop ? 28 : 22} />)}
      </span>
    );
  }
  return (
    <span className="home-game__board" data-testid="home-board">
      {board.slice(0, 5).map((c, i) => (
        <PlayingCard key={`${c}-${i}`} rank={String(c)[0]} suit={String(c)[1]} w={desktop ? 20 : 17} h={desktop ? 28 : 24} />
      ))}
    </span>
  );
}

export function HomeGameTable({ board = [], seatCount = 2, running = true, statusKnown = true, geometry = PHONE_ROOM }) {
  const FLAT = geometry.flat;
  // C9's empty table is bare; its one empty chair says what it is.
  if (!running && geometry.width === 560) return null;
  return (
    <>
      <div
        className="home-game__centre"
        style={{ left: FLAT.table.cx, top: FLAT.table.cy - 6 }}
      >
        <HomeBoard board={board} desktop={geometry.width === 560} />
      </div>

      {/* scenery chips — never a stack, never a pot */}
      <span className="home-game__chips home-game__chips--right" style={{ left: FLAT.table.cx + 34, top: FLAT.table.cy + 10 }} aria-hidden>
        {[0, 1, 2].map((i) => <i key={i} className={i % 2 ? 'is-green' : 'is-pale'} style={{ bottom: i * 2.4 }} />)}
      </span>
      {seatCount > 1 ? (
        <span className="home-game__chips home-game__chips--left" style={{ left: FLAT.table.cx - 46, top: FLAT.table.cy + 14 }} aria-hidden>
          {[0, 1].map((i) => <i key={i} className="is-red" style={{ bottom: i * 2.4 }} />)}
        </span>
      ) : null}

      {/* The only label left, and it is a fact about the room rather than about
          money. With nobody at it there are no bodies at the SEATS to duck — but
          the band just under the table is where the idle floor spots put their
          name pills, so "under the table" collides with whoever is standing in
          the room. It goes on the felt instead, below the two waiting card backs
          and above the rim. */}
      {running || !statusKnown ? null : (
        <span
          className="home-game__label home-game__label--empty"
          style={{ left: FLAT.table.cx, top: FLAT.table.cy + 24, transform: 'translateX(-50%)' }}
          data-testid="home-game-label"
        >
          NOBODY AT THE TABLE
        </span>
      )}
    </>
  );
}
