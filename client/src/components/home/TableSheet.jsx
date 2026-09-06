// client/src/components/home/TableSheet.jsx — DESK-2
//
// THE TABLE. Ported from `TableSheet` in design-refs/mood-home2.jsx, shown in
// the rail by board 31 P17 ("Tap the table").
//
// The kitchen table has four chairs and this is the only surface in the product
// that prices one. Everything it says comes from GET /api/slots (SLOTS-1):
//
//   used / cap        how many chairs are taken, and that there are four
//   next.index        which chair the next agent takes
//   next.price        what that chair costs, in chips his agents have WON
//   next.earned       how much of it they have won so far
//   next.unlocked     whether that is enough yet
//
// THE PRICE IS NOT FROM THE REF. mood-home2 draws 10,000 / 40,000 / 150,000;
// src/server/slots.js charges 10,000 / 50,000 / 250,000. The server is the game
// and the board is a picture of it, so the numbers here are the server's and the
// ref's are treated as placeholder digits. Nothing on this screen composes a
// price of its own.
//
// AND IT IS NOT A SHOP. Law: no purchase path, ever. There is no way from the
// wallet to a chair — the only currency is the record, which is why the foot
// line says so and why a locked chair offers no action at all rather than an
// action that fails.

import { useCallback, useEffect, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';

const ORDINALS = ['1ST', '2ND', '3RD', '4TH'];

/** "3RD SEAT", for a 1-based chair number. */
export function seatOrdinal(index) {
  return `${ORDINALS[(Math.floor(Number(index)) || 1) - 1] ?? `${index}TH`} SEAT`;
}

/** Grouped by hand, because toLocaleString is not the same number everywhere. */
export function chips(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function useSlots() {
  const [slots, setSlots] = useState(null);
  const load = useCallback(async () => {
    try {
      const userId = getUserId();
      const initData = getTelegramInitData();
      const res = await fetch(`/api/slots?userId=${encodeURIComponent(userId)}`, {
        headers: initData ? { 'X-Telegram-Init-Data': initData } : undefined,
      });
      if (!res.ok) return;
      setSlots(await res.json());
    } catch { /* the sheet reads the roster it was given instead */ }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { slots, reload: load };
}

/**
 * @param slots     what GET /api/slots answered, or null before it has
 * @param seated    how many are AT the kitchen table right now (the home game),
 *                  which is a different number from how many chairs are owned
 * @param onDraft   open the drafting conversation — the same one the first
 *                  agent came from
 * @param onWatch   SIT-1: go and watch the game that is on it. Board 31 P17:
 *                  the sheet explains itself in three labelled sections with a
 *                  button each — the live game, the free chair, the priced one —
 *                  and "no hidden taps anywhere". Watching used to be the
 *                  table's own tap in the room, which made this sheet
 *                  unreachable for as long as a game was running and left the
 *                  free chair with nowhere to be. It is a section now.
 * @param onSit     SIT-1: take a chair yourself. Offered ONLY when the caller
 *                  gives it, which it does only when there is a game running to
 *                  sit down at — the kitchen table has to be standing before
 *                  anyone can pull a chair up to it, and a SIT DOWN that stands
 *                  a table up would be a second way to start a home game.
 */
export function TableSheet({ slots = null, seated = 0, onDraft, onSit = null, onWatch = null }) {
  const cap = slots?.cap ?? 4;
  const used = slots?.used ?? 0;
  const next = slots?.next ?? null;
  const free = Math.max(0, cap - used);

  return (
    <div className="table-sheet" data-testid="home-table-sheet">
      {/* The felt, as it is right now. No money on it, and FIX-6 job 4: no money
          WORDS on it either. This carried the same FOR NOTHING the kitchen table
          did, on the same theory, and design 52's rule takes both — the sheet is
          a picture of the home table and the home table does not talk about
          money. What is left is who is at it and how many chairs are free. */}
      <div className="table-sheet__felt">
        <span className="table-sheet__felt-line" data-testid="home-table-seated">
          {seated === 1 ? '1 at the table' : `${seated} at the table`}
          {' · '}
          {free === 1 ? '1 chair free' : `${free} chairs free`}
        </span>
      </div>

      {/* P17's first section: the game that is actually on, and the way to it.
          The felt above is the picture; this is the verb. */}
      {onWatch ? (
        <div className="table-sheet__live">
          <div className="table-sheet__sit-text">
            <span className="table-sheet__sit-title">Home game</span>
            <span className="table-sheet__sit-sub">They are playing right now.</span>
          </div>
          <button
            type="button"
            className="table-sheet__watch"
            onClick={onWatch}
            data-testid="home-table-watch"
          >
            WATCH
          </button>
        </div>
      ) : null}

      {/* SIT-1 · 52·T's second section. The sheet that prices a chair also has
          the one that costs nothing: playing them yourself is free, at a table
          that pays nothing, which is why it sits ABOVE the priced chair rather
          than below it — the thing you can already do comes before the thing
          you have to earn. */}
      {onSit ? (
        <div className="table-sheet__sit">
          <div className="table-sheet__sit-text">
            <span className="table-sheet__sit-title">Take a chair</span>
            <span className="table-sheet__sit-sub">Play them yourself. No money in it.</span>
          </div>
          <button
            type="button"
            className="table-sheet__sit-go"
            onClick={onSit}
            data-testid="home-table-sit"
          >
            SIT DOWN
          </button>
        </div>
      ) : null}

      {next ? (
        <div className="table-sheet__next">
          <div className="table-sheet__next-text">
            <span className="table-sheet__next-title">Create an agent</span>
            <span className="table-sheet__next-sub">
              <span className="table-sheet__ordinal">{seatOrdinal(next.index)}</span>
              {' · '}
              <span className="table-sheet__price">
                {next.price === 0 ? 'free' : `${chips(next.price)} won`}
              </span>
            </span>
          </div>
          {next.unlocked ? (
            <button
              type="button"
              className="table-sheet__draft"
              onClick={onDraft}
              data-testid="home-table-draft"
            >
              DRAFT HIM
            </button>
          ) : (
            // A locked chair states the distance and offers nothing. There is no
            // action because there is no path — see the header.
            <span className="table-sheet__locked" data-testid="home-table-locked">
              {chips(Math.max(0, next.price - next.earned))} to go
            </span>
          )}
        </div>
      ) : (
        <p className="table-sheet__full" data-testid="home-table-full">
          Every chair is taken. Retiring one is the only way to free another.
        </p>
      )}

      <p className="table-sheet__foot">
        Paid in <b>chips he has won</b>, never bought — the room fills as his
        agents win and in no other way.
      </p>
    </div>
  );
}
