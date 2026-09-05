// src/server/cooler.js — SEAT-1b
//
// One definition of a cooler, for the whole server.
//
// Before this file there was half of one: table.js flagged a cooler off the
// LOSER's own equity, so `cooler` was true only when the agent lost. The
// biography ledger has two counters — coolersDealt and coolersTaken — and only
// one of them could ever move. `coolersDealt` was structurally always 0, which
// is why the nemesis card could say "he has coolered me three times" and the
// victim card could never say the mirror of it.
//
// A cooler is a fact about the HAND, not about one seat's view of it: a strong
// hand ran into a stronger one and the money went in anyway. So it is
// classified once, from the showdown, and both sides are told — the winner
// dealt it, the loser took it. That symmetry is the whole fix.
//
// The definition, and why each clause is here:
//
//   1. IT WENT TO SHOWDOWN. Nobody gets coolered by a fold. Cards have to be
//      face up for anyone to know what happened.
//   2. THE MONEY WENT IN. Either somebody was all-in, or the pot reached the
//      same PACE_HEAT_BB threshold the felt uses to decide a pot is worth
//      warming up for. A cooler that cost three big blinds is a fun fact, not
//      a grudge, and the ledger is a record of grudges.
//   3. THE LOSER WAS STRONG. Two pair or better. This is the clause that
//      separates a cooler from ordinary poker: one pair losing to two pair in
//      a big pot is a hand he misplayed, and the ledger should not let him
//      file it as bad luck. Deliberately excluded: aces losing to kings
//      all-in preflop on a blank board — both are one pair, and there is no
//      board-independent way to tell that hand from aces losing to seven-two
//      without special-casing starting hands, which is a different feature.
//
// Nothing here reads a store, a clock or a socket. Given a result and a board
// it returns the same answer every time.

import { potInBb, heatThresholdBb } from './pace.js';
import { evaluate } from '../engine/hand.js';

// pokersolver hand ranks: 1 high card, 2 pair, 3 two pair, 4 trips, 5 straight,
// 6 flush, 7 full house, 8 quads, 9 straight flush. Two pair is the floor.
export const COOLER_MIN_HAND_RANK = 3;

/**
 * Classify the just-completed hand.
 *
 * @param {object} result   the engine's `game.result` (needs type/pot/winners/showdown)
 * @param {array}  seats    the engine's `game.seats` (needs `allIn`)
 * @param {array}  community the finished board
 * @param {number} bigBlind
 * @returns {{ cooler: boolean, winners: number[], losers: number[], reason: string }}
 *   `winners` are the seats that DEALT it, `losers` the seats that TOOK it.
 *   Both are empty when `cooler` is false.
 */
export function classifyCooler({ result, seats = [], community = [], bigBlind = 0 } = {}) {
  const none = (reason) => ({ cooler: false, winners: [], losers: [], reason });

  if (!result || result.type !== 'showdown') return none('not a showdown');
  const contestants = Array.isArray(result.showdown) ? result.showdown : [];
  if (contestants.length < 2) return none('fewer than two hands shown');
  if (!Array.isArray(community) || community.length < 3) return none('no board to read');

  // 2. The money went in.
  const anyAllIn = contestants.some((c) => seats[c.seat]?.allIn);
  const potBb = potInBb(result.pot ?? 0, bigBlind);
  if (!anyAllIn && potBb < heatThresholdBb()) {
    return none(`pot only ${potBb}bb and nobody all-in`);
  }

  const winnerSeats = new Set(
    (Array.isArray(result.winners) ? result.winners : []).map((w) => w.seat),
  );
  if (winnerSeats.size === 0) return none('no winner');

  // A chopped pot is nobody's cooler — neither of them lost with a big hand.
  const losers = contestants.filter((c) => !winnerSeats.has(c.seat));
  if (losers.length === 0) return none('chopped');

  let bestLoserRank = 0;
  for (const c of losers) {
    const rank = rankOf(c.holeCards, community);
    if (rank > bestLoserRank) bestLoserRank = rank;
  }
  // 3. The loser was strong.
  if (bestLoserRank < COOLER_MIN_HAND_RANK) {
    return none(`best losing hand ranked ${bestLoserRank}`);
  }

  // Only the seats that actually held a strong hand took the cooler; a third
  // player who called off with a busted draw was not coolered, he was wrong.
  const took = losers
    .filter((c) => rankOf(c.holeCards, community) >= COOLER_MIN_HAND_RANK)
    .map((c) => c.seat);

  return {
    cooler: true,
    winners: [...winnerSeats],
    losers: took,
    reason: anyAllIn ? 'all-in showdown' : `${potBb}bb pot`,
  };
}

function rankOf(holeCards, community) {
  if (!Array.isArray(holeCards) || holeCards.length !== 2) return 0;
  try {
    return evaluate(holeCards, community).rank ?? 0;
  } catch {
    return 0;
  }
}
