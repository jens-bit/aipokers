import pkg from 'pokersolver';
const { Hand } = pkg;

// Evaluate a player's best 5-card hand from their 2 hole cards plus the
// community board. Returns the pokersolver Hand object.
export function evaluate(holeCards, communityCards) {
  if (holeCards.length !== 2) throw new Error('expected 2 hole cards');
  if (communityCards.length < 3 || communityCards.length > 5) {
    throw new Error('expected 3–5 community cards');
  }
  return Hand.solve([...holeCards, ...communityCards]);
}

// Given an array of { seat, holeCards } and the community board, return the
// indices of the winning seats (multiple on a chop).
export function pickWinners(seats, communityCards) {
  const evaluated = seats.map(({ seat, holeCards }) => ({
    seat,
    hand: evaluate(holeCards, communityCards),
  }));
  const winningHands = Hand.winners(evaluated.map((e) => e.hand));
  const winners = evaluated
    .filter((e) => winningHands.includes(e.hand))
    .map((e) => ({ seat: e.seat, descr: e.hand.descr, name: e.hand.name }));
  return winners;
}

export function describe(holeCards, communityCards) {
  return evaluate(holeCards, communityCards).descr;
}
