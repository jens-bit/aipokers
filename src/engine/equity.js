// Monte Carlo hand equity estimator. Given hero's two hole cards and the
// current community board, samples random opponent hands + board completions
// and returns hero's expected share of the pot.
//
// Ties count as 1/N where N is the number of players sharing the pot (so
// heads-up chops contribute 0.5 to the equity numerator). Not
// security-sensitive — uses Math.random for speed, unlike the game dealer.

import { createDeck } from './deck.js';
import { pickWinners } from './hand.js';

export function estimateEquity({ holeCards, community = [], nOpponents = 1, iterations = 1500 } = {}) {
  if (!Array.isArray(holeCards) || holeCards.length !== 2) {
    throw new Error('holeCards must be an array of 2 cards');
  }
  if (!Array.isArray(community)) throw new Error('community must be an array');
  if (community.length > 5) throw new Error('community cannot exceed 5 cards');
  if (!Number.isInteger(nOpponents) || nOpponents < 1) {
    throw new Error('nOpponents must be a positive integer');
  }
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error('iterations must be a positive integer');
  }

  const known = new Set([...holeCards, ...community]);
  if (known.size !== holeCards.length + community.length) {
    throw new Error('duplicate cards in holeCards/community inputs');
  }

  const remaining = createDeck().filter((c) => !known.has(c));
  const cardsPerOpp = 2;
  const boardNeeded = 5 - community.length;
  const totalNeeded = nOpponents * cardsPerOpp + boardNeeded;
  if (totalNeeded > remaining.length) {
    throw new Error('not enough cards remaining for the requested opponents/board');
  }

  // Pokersolver needs >= 3 community cards to evaluate. When the board is
  // still preflop (0 cards), boardNeeded === 5 so the completed board always
  // has 5 cards — no problem. This just documents the invariant.

  const rem = remaining.slice();
  const remLen = rem.length;

  let wins = 0;
  let ties = 0;

  for (let it = 0; it < iterations; it++) {
    // Partial Fisher-Yates over `rem` in place: sample the first `totalNeeded`
    // positions with random draws from the tail. Only these positions are
    // read this iteration, so leaving the tail permuted between iterations
    // does not bias subsequent draws.
    for (let i = 0; i < totalNeeded; i++) {
      const j = i + Math.floor(Math.random() * (remLen - i));
      const t = rem[i]; rem[i] = rem[j]; rem[j] = t;
    }

    const contestants = [{ seat: 0, holeCards }];
    let cursor = 0;
    for (let o = 0; o < nOpponents; o++) {
      contestants.push({ seat: o + 1, holeCards: [rem[cursor], rem[cursor + 1]] });
      cursor += cardsPerOpp;
    }
    const board = boardNeeded > 0
      ? community.concat(rem.slice(cursor, cursor + boardNeeded))
      : community;

    const winners = pickWinners(contestants, board);
    if (winners.some((w) => w.seat === 0)) {
      if (winners.length === 1) wins += 1;
      else ties += 1 / winners.length;
    }
  }

  return { equity: (wins + ties) / iterations, iterations };
}
