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
// number on the felt would be the screen contradicting the model. What is
// drawn instead is the ref's own tell — chips scattered on the table and the
// words FOR NOTHING, which say the same thing in the opposite direction.
//
// The chips are scenery. They are drawn from the seat count, not from a stack,
// so there is no value they could be read as.

import { useEffect } from 'react';
import { FLAT } from './flat.js';
import { PlayingCard, CardBack } from '../system/PlayingCard.jsx';

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

/** The community cards as the felt has actually run them. */
export function HomeBoard({ board = [] }) {
  if (!board.length) {
    return (
      <span className="home-game__board" data-testid="home-board">
        {[0, 1].map((i) => <CardBack key={i} w={16} h={22} />)}
      </span>
    );
  }
  return (
    <span className="home-game__board" data-testid="home-board">
      {board.slice(0, 5).map((c, i) => (
        <PlayingCard key={`${c}-${i}`} rank={String(c)[0]} suit={String(c)[1]} w={17} h={24} />
      ))}
    </span>
  );
}

export function HomeGameTable({ board = [], seatCount = 2, running = true }) {
  return (
    <>
      <div
        className="home-game__centre"
        style={{ left: FLAT.table.cx, top: FLAT.table.cy - 6 }}
      >
        <HomeBoard board={board} />
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

      {/* the one label the table needs, and it is the opposite of a money line */}
      {/* The ref puts this at the table's top-left rim — which in a heads-up game
          is exactly where the far seat's body stands. Moved onto the empty left
          of the felt, which is empty in every seat count the kitchen table
          runs, so the one label the table has is never drawn over. */}
      <span
        className={`home-game__label${running ? '' : ' home-game__label--empty'}`}
        style={running
          // Left of the felt, which is empty at every seat count this table runs.
          ? { left: FLAT.table.cx - FLAT.table.rx + 8, top: FLAT.table.cy - 2 }
          // With nobody at it there are no bodies at the SEATS to duck — but the
          // band just under the table is where the idle floor spots put their
          // name pills, so "under the table" collides with whoever is standing
          // in the room. It goes on the felt instead, below the two waiting
          // card backs and above the rim.
          : { left: FLAT.table.cx, top: FLAT.table.cy + 24, transform: 'translateX(-50%)' }}
        data-testid="home-game-label"
      >
        {running ? 'FOR NOTHING' : 'NOBODY AT THE TABLE'}
      </span>
    </>
  );
}
