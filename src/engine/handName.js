// src/engine/handName.js — BUGS-B/5
//
// What a winning hand is CALLED, in the words a person would use.
//
// pokersolver already describes every hand, but it describes it the way a
// solver does: "Pair, 9's", "Flush, Ad High", "Full House, 10's over 5's".
// That is a label for a machine. A player watching his agent take a pot wants
// to read "a pair of nines" and "an ace-high flush", and the ceremony, the
// thread and the hand history all want the SAME words — so the translation
// lives in one pure function rather than three sprinkled template literals.
//
// Two rules the shape of this file comes from:
//
//   1. IT READS OFF THE CARDS, NOT THE DESCRIPTION. Parsing `descr` back into
//      English would make us the second parser of a string pokersolver builds
//      with a known bug (the Flush branch appends whatever `suit` the loop
//      variable happened to end on). The evaluated hand's `cards` array is
//      already sorted into hand order by the library — the pair first, then
//      the kickers; the trips, then the pair — so the name is a lookup, not a
//      parse.
//   2. IT ALWAYS ANSWERS. A winner with no readable hand is still a winner:
//      anything this cannot name comes back as the family name in lower case,
//      and a hand it cannot read at all comes back null for the caller to
//      replace. Nothing here throws.
//
// Pure and side-effect free: no clock, no store, no model.

// A hand nobody had to show. The pot that ends when everybody else folds has
// no cards behind it and must not be dressed up as if it did.
export const UNCONTESTED = 'uncontested';

// pokersolver's card values, in the words people say. '1' is the wheel ace —
// the library rewrites A to 1 when the ace plays low in A-2-3-4-5.
const WORD = Object.freeze({
  1: 'ace', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven',
  8: 'eight', 9: 'nine', T: 'ten', J: 'jack', Q: 'queen', K: 'king', A: 'ace',
});

const PLURAL = Object.freeze({
  1: 'aces', 2: 'twos', 3: 'threes', 4: 'fours', 5: 'fives', 6: 'sixes',
  7: 'sevens', 8: 'eights', 9: 'nines', T: 'tens', J: 'jacks', Q: 'queens',
  K: 'kings', A: 'aces',
});

// 'a' or 'an', decided by how the next word SOUNDS. Only 'ace' and 'eight'
// start with a vowel sound among the words this file produces, but the test is
// written on the letter so a future word gets it right for free.
function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

function valueAt(cards, i) {
  const v = cards?.[i]?.value;
  return typeof v === 'string' ? v : null;
}

const word = (v) => WORD[v] ?? null;
const plural = (v) => PLURAL[v] ?? null;

/**
 * The plain-English name of an evaluated pokersolver hand.
 *
 * @param hand a solved pokersolver Hand (`.name` + `.cards`), or anything —
 *             a shape this cannot read returns null.
 * @returns e.g. 'a pair of nines', 'an ace-high flush', 'nines full of fives'
 */
export function plainHandName(hand) {
  const family = typeof hand?.name === 'string' ? hand.name : null;
  const cards = Array.isArray(hand?.cards) ? hand.cards : [];
  if (!family) return null;

  const high = word(valueAt(cards, 0));
  const top = plural(valueAt(cards, 0));

  switch (family) {
    case 'Straight Flush': {
      // The library calls the broadway one a Royal Flush in `descr` and leaves
      // `name` as Straight Flush, so the ace-high case is recognised here.
      if (valueAt(cards, 0) === 'A') return 'a royal flush';
      return high ? `${article(high)} ${high}-high straight flush` : 'a straight flush';
    }
    case 'Four of a Kind':
      return top ? `four ${top}` : 'four of a kind';
    case 'Full House': {
      const over = plural(valueAt(cards, 3));
      return top && over ? `${top} full of ${over}` : 'a full house';
    }
    case 'Flush':
      return high ? `${article(high)} ${high}-high flush` : 'a flush';
    case 'Straight':
      return high ? `${article(high)} ${high}-high straight` : 'a straight';
    case 'Three of a Kind':
      return top ? `three ${top}` : 'three of a kind';
    case 'Two Pair': {
      const low = plural(valueAt(cards, 2));
      return top && low ? `two pair, ${top} and ${low}` : 'two pair';
    }
    case 'Pair':
      return top ? `a pair of ${top}` : 'a pair';
    case 'High Card':
      return high ? `${high} high` : 'high card';
    default:
      // A family this file has not been taught (a wild-card game, a future
      // pokersolver) is still named — just less well than it could be.
      return family.toLowerCase();
  }
}
