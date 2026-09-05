// SHARE-1 — naming the hand, for the card's result line.
//
// "+$3,694 · ace-high flush". The amount the server already stores; the second
// half it does not — nothing on the flagged-hand record says what he ended up
// holding, and the review screens never needed it because they show the cards
// and let you read them yourself. A card seen at 240px in a chat list cannot
// ask that of anyone, so the name has to be written out.
//
// Pure, and deliberately NOT an evaluator: it names the best five of up to
// seven and never compares two hands. That is the whole reason it can be sixty
// lines instead of pulling pokersolver across the client boundary — the client
// has never imported from src/engine and this is not the feature to start on.
// Comparisons stay server-side, where the pot was actually awarded.

const RANK_ORDER = '23456789TJQKA';

const SINGULAR = {
  14: 'ace', 13: 'king', 12: 'queen', 11: 'jack', 10: 'ten', 9: 'nine',
  8: 'eight', 7: 'seven', 6: 'six', 5: 'five', 4: 'four', 3: 'three', 2: 'two',
};

const PLURAL = {
  14: 'aces', 13: 'kings', 12: 'queens', 11: 'jacks', 10: 'tens', 9: 'nines',
  8: 'eights', 7: 'sevens', 6: 'sixes', 5: 'fives', 4: 'fours', 3: 'threes', 2: 'twos',
};

/** 'Ah' → { v: 14, suit: 'h' }. Anything unreadable → null. */
export function parseCard(card) {
  if (typeof card !== 'string' || card.length < 2) return null;
  const v = RANK_ORDER.indexOf(card[0].toUpperCase()) + 2;
  const suit = card[1].toLowerCase();
  if (v < 2 || !'shdc'.includes(suit)) return null;
  return { v, suit };
}

// The high card of the best straight in `values`, or null. The wheel is the
// only special case: an ace plays low, and A-2-3-4-5 is a five-high straight.
function straightHigh(values) {
  const desc = [...new Set(values)].sort((a, b) => b - a);
  const withWheel = desc.includes(14) ? [...desc, 1] : desc;
  let run = 1;
  for (let i = 1; i < withWheel.length; i++) {
    if (withWheel[i] === withWheel[i - 1] - 1) {
      run += 1;
      if (run >= 5) return withWheel[i] + 4;
    } else {
      run = 1;
    }
  }
  return null;
}

/**
 * The name of the best five-card hand in `cards` (hole cards plus board),
 * lower case and ready to sit after a middot. Null when there are fewer than
 * five readable cards — a hand that ended before the flop, or a board shown
 * to someone who never saw the hole cards.
 *
 * @param {string[]} cards e.g. ['Ah','Kh','Qh','7h','2h','3c']
 * @returns {string|null} e.g. 'ace-high flush'
 */
export function handName(cards) {
  const parsed = (Array.isArray(cards) ? cards : []).map(parseCard).filter(Boolean);
  if (parsed.length < 5) return null;

  const values = parsed.map((c) => c.v);

  const suited = new Map();
  for (const c of parsed) suited.set(c.suit, [...(suited.get(c.suit) ?? []), c.v]);
  const flush = [...suited.values()].find((vs) => vs.length >= 5) ?? null;

  if (flush) {
    const sf = straightHigh(flush);
    if (sf) return sf === 14 ? 'royal flush' : `${SINGULAR[sf]}-high straight flush`;
  }

  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  // Highest count first, then highest rank — so trips[0] is the top set and
  // pairs[0] the top pair without a second sort at each use.
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const quads = ranked.filter(([, n]) => n === 4).map(([v]) => v);
  const trips = ranked.filter(([, n]) => n === 3).map(([v]) => v);
  const pairs = ranked.filter(([, n]) => n === 2).map(([v]) => v);

  if (quads.length) return `four ${PLURAL[quads[0]]}`;

  // Two sets is a full house — the lower one plays as the pair.
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const over = trips[0];
    const under = trips.length > 1 ? trips[1] : pairs[0];
    return `${PLURAL[over]} full of ${PLURAL[under]}`;
  }

  if (flush) return `${SINGULAR[Math.max(...flush)]}-high flush`;

  const straight = straightHigh(values);
  if (straight) return `${SINGULAR[straight]}-high straight`;

  if (trips.length) return `three ${PLURAL[trips[0]]}`;
  if (pairs.length >= 2) return `two pair, ${PLURAL[pairs[0]]} and ${PLURAL[pairs[1]]}`;
  if (pairs.length === 1) return `pair of ${PLURAL[pairs[0]]}`;
  return `${SINGULAR[Math.max(...values)]}-high`;
}
