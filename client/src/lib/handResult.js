// client/src/lib/handResult.js — BUGS-A job 12
//
// THE HAND, NAMED.
//
// The felt ended every hand with "$30 → Granite": how much and to whom, and
// nothing about WHY. On a screen whose whole subject is watching somebody play
// poker, the one fact worth having at the end of a hand is what beat what — and
// the felt had it (the showdown reveals every contested seat's cards) and threw
// it away.
//
// "Granite took $30 with a pair of nines."
//
// WHERE THE NAME COMES FROM, and the order matters:
//
//   1. THE CARDS ON THE TABLE. SHARE-1's handName() already turns five to seven
//      cards into exactly this phrasing — "pair of nines", "aces full of kings",
//      "ace-high flush" — and it is fed the same showdown and the same board the
//      felt is currently drawing. It is a namer and not an evaluator: it never
//      compares two hands, so it cannot disagree with who actually won.
//   2. THE SERVER'S OWN DESCRIPTION. `winners[].hand`, or `descr` as the engine
//      writes it today. That is the authority on what took the pot, and it is
//      the only thing available when the cards are not — a hand that ended
//      before a showdown, or a payload without one.
//   3. UNCONTESTED. Everyone else folded; there is no hand to name, and saying
//      so is the truth rather than a gap.
//
// Nothing here invents a hand. With no cards and no description the line simply
// says who took what.

import { handName } from '../components/share/handName.js';

// Names that are already a quantity and take no article: "four nines", "three
// nines", "two pair, aces and kings", "aces full of kings" — and "ace-high",
// which is a description of the hand rather than a thing you hold.
const NO_ARTICLE = /^(four|three|two pair)\b|\sfull of\s|-high$/;

/**
 * The hand name as it reads inside a sentence.
 *
 * SHARE-1's handName() writes names to sit after a middot on a share card —
 * "+$3,694 · ace-high flush" — where an article would be wrong. In a sentence
 * it is the other way round: "took $30 with pair of nines" is not English. So
 * the article is added here, at the one place that builds a sentence, rather
 * than changing a namer four other surfaces already read.
 */
export function withArticle(name) {
  const n = String(name ?? '').trim();
  if (!n || NO_ARTICLE.test(n)) return n;
  return `${'aeiou'.includes(n[0].toLowerCase()) ? 'an' : 'a'} ${n}`;
}

/** A seat's display name, or a plain "Seat 3" — never an empty string. */
export function seatName(seat, seats = []) {
  const row = Array.isArray(seats) ? seats[seat] : null;
  const name = row?.displayName ?? row?.name ?? null;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return `Seat ${Number(seat) + 1}`;
}

/**
 * What this winner held, in words — or null when nothing knows.
 *
 * @param winner    one entry of result.winners
 * @param showdown  result.showdown ([{ seat, holeCards }])
 * @param community the board
 */
export function winningHand(winner, { showdown = [], community = [] } = {}) {
  const hole = (Array.isArray(showdown) ? showdown : [])
    .find((s) => s && s.seat === winner?.seat)?.holeCards ?? [];
  const named = handName([...(hole ?? []), ...(community ?? [])]);
  if (named) return named;

  // The engine's own word for it. `hand` is what the brief names; `descr` is
  // what src/engine/game.js puts on a winner today. Either is the server
  // speaking, and the server awarded the pot.
  const served = winner?.hand ?? winner?.descr ?? null;
  return typeof served === 'string' && served.trim() ? served.trim().toLowerCase() : null;
}

/**
 * The parts of the line, so a surface can style the amount without having to
 * take a sentence apart.
 *
 * @returns {{ who, amount, tail, line }|null}
 *   `who`    "Granite", or "Granite and Doyle" for a split
 *   `amount` the pot, already formatted by the caller's money function
 *   `tail`   "with a pair of nines" · "uncontested" · '' when nothing knows
 *   `line`   the whole sentence, for a label or a screen reader
 */
export function handResult(result, { seats = [], community = [], money = String } = {}) {
  const winners = Array.isArray(result?.winners) ? result.winners.filter(Boolean) : [];
  if (winners.length === 0) return null;

  const names = winners.map((w) => seatName(w.seat, seats));
  const who = names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

  const pot = Number.isFinite(result?.pot)
    ? result.pot
    : winners.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const amount = money(Math.round(pot) || 0);

  // A split has no single hand to name — two people held different cards and
  // the pot went both ways — so it states the split and stops there.
  const verb = winners.length === 1 ? 'took' : 'split';
  let tail = '';
  if (winners.length === 1) {
    if (result?.type === 'uncontested') {
      tail = 'uncontested';
    } else {
      const named = winningHand(winners[0], { showdown: result?.showdown, community });
      tail = named ? `with ${withArticle(named)}` : '';
    }
  }

  return {
    who,
    amount,
    tail,
    line: [who, verb, amount, tail].filter(Boolean).join(' '),
  };
}
