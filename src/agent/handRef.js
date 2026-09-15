// src/agent/handRef.js — LIFE-3 job 2
//
// Which hand he is being asked about.
//
// THE DEAD END. From the transcript, in one conversation:
//
//   Jens:  why did you go all in on that hand?
//   Agent: Don't remember that one, man — which hand you talking about?
//   Jens:  queen six? the one you just busted on.
//   Agent: <a different hand entirely>
//   Jens:  why???
//   Agent: Man, I don't know what you're asking about — what happened?
//
// That last sentence is the worst line in the product and it fired three times
// in one conversation, on a question that is perfectly clear in context. LIFE-2
// fixed the middle beat — he cites a real hand now. This file is the two on
// either side of it: the question with no hand named, and the question with a
// hand named that he answered by asking one back.
//
// THE RULE IS THAT THERE IS ALWAYS AN ANSWER. Three of them, in order:
//
//   HE NAMED IT.   A hand number, or the cards. "queen six" is how a person
//                  cites a hand; Qh 6d is how a database does. Both resolve.
//   HE DID NOT.    Then it is the most recent NOTABLE hand — the all-in, the
//                  bust, the biggest pot. Never nothing. A man at a table who
//                  is asked "why did you do that" and has just shoved his
//                  stack in does not need to be told which hand is meant.
//   HE CANNOT TELL. Two hands fit what was said. Then he names the candidates
//                  in his own voice — "the queen-six, or the jack-ten?" —
//                  which is a question that moves the conversation forward,
//                  and is a different thing entirely from a shrug.
//
// AND THE FOURTH CASE, which is not a failure: he named a hand that is NOT on
// his list. "What about hand 700?" resolves to `unknown` and stops there rather
// than falling through to the notable hand, because answering a question about
// hand 700 with hand 812 is the LIFE-2 failure wearing a different coat. He
// says he cannot place it, which is exactly what law 5 asks of him.
//
// Pure, and everything is an argument. No store, no clock, no agent record —
// the caller slices the hands it is willing to have cited (talk.js owns that
// number, SELF_FACT_HANDS) and passes them in. That is what lets the resolver
// be checked against an object literal, and what keeps the gate honest: he is
// only ever graded against the hands he was actually shown.

// ── The vocabulary of a hand ────────────────────────────────────────────────
//
// These four were talk.js's, and they move here because handRef and talk both
// need them and a copy is a second place to update. talk.js imports them back.

export const RANK_WORDS = 'ace|king|queen|jack|ten|nine|eight|seven|six|five|four|three|deuce|two';

export const WORD_TO_RANK = Object.freeze({
  ace: 'A', king: 'K', queen: 'Q', jack: 'J', ten: 'T', nine: '9', eight: '8',
  seven: '7', six: '6', five: '5', four: '4', three: '3', deuce: '2', two: '2',
});

export const RANK_TO_WORD = Object.freeze({
  A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten', 9: 'nine', 8: 'eight',
  7: 'seven', 6: 'six', 5: 'five', 4: 'four', 3: 'three', 2: 'deuce',
});

/** Two ranks as one unordered key, so "queen six" and Qh 6d are the same hand. */
export const rankKey = (a, b) => [String(a).toUpperCase(), String(b).toUpperCase()].sort().join('');

const HAND_NUMBER = /(?:\bhands?\s*(?:number\s*)?#?\s*|#)(\d{1,6})\b/gi;

/** Every hand NUMBER named in a string. */
export function handNumbersIn(text) {
  const out = new Set();
  for (const m of String(text ?? '').matchAll(HAND_NUMBER)) out.add(Number(m[1]));
  return out;
}

// ── What the owner named ────────────────────────────────────────────────────
//
// Deliberately NOT the first-person pattern talk.js grades him on. That one is
// about a claim he made and has to be strict about whose cards they are; this
// one is about a question HIS OWNER asked, where there is only one player in
// the room whose hand could be meant.
//
// Three forms, and no bare two-letter shorthand. "AK" and "Q6" are how a forum
// post cites a hand, and they are also two capital letters, which is what the
// middle of an acronym looks like. The cost of missing them is that "Q6" falls
// through to the notable hand — which is the right hand most of the time
// anyway. The cost of catching them is resolving "OK" as a hand.
//
// THREE PATTERNS RATHER THAN ONE ALTERNATION, and the split is not cosmetic:
// the card-code pattern must be CASE SENSITIVE and the two word patterns must
// not be. Under an `i` flag `([2-9TJQKA])[shdc]` matches "th", so "why did you
// call with Qh 6d" resolves as the ten-queen — the "th" of "with" glued to the
// "Qh" that follows it. A card code is written in one case and only one, and
// insisting on it costs nothing: "qh 6d" typed in lower case falls through to
// the notable hand, which is the hand he meant anyway.
//
// (talk.js's first-person MY_HOLDING has the same alternation under `gi` and
// therefore the same trap, but it is unreachable there: the pattern is anchored
// behind "I had"/"I held", and no English sentence continues that with a bare
// "th" followed by a card code. Noted here rather than fixed there, because
// this file is the one where the pattern reads free text.)
const CARD_PAIR = /\b([2-9TJQKA])[shdc]\s*([2-9TJQKA])[shdc]\b/g;
const WORD_PAIR = new RegExp(`\\b(${RANK_WORDS})[\\s-]+(?:and\\s+|of\\s+)?(${RANK_WORDS})\\b`, 'gi');
const WORD_PAIR_PLURAL = new RegExp(`\\b(?:pocket\\s+|a\\s+pair\\s+of\\s+)?(${RANK_WORDS})e?s\\b`, 'gi');

/** Every holding named in a message, as unordered rank keys. */
export function namedHoldings(text) {
  const t = String(text ?? '');
  const out = new Set();
  for (const m of t.matchAll(CARD_PAIR)) out.add(rankKey(m[1], m[2]));
  for (const m of t.matchAll(WORD_PAIR)) {
    const a = WORD_TO_RANK[m[1].toLowerCase()];
    const b = WORD_TO_RANK[m[2].toLowerCase()];
    if (a && b) out.add(rankKey(a, b));
  }
  for (const m of t.matchAll(WORD_PAIR_PLURAL)) {
    const r = WORD_TO_RANK[m[1].toLowerCase()];
    if (r) out.add(rankKey(r, r));
  }
  return out;
}

/** A hand's own two cards as an unordered rank key, or null. */
export function holdingKey(hand) {
  const cards = (Array.isArray(hand?.holeCards) ? hand.holeCards : [])
    .map((c) => String(c ?? '')).filter((c) => c.length >= 2);
  return cards.length >= 2 ? rankKey(cards[0][0], cards[1][0]) : null;
}

// "sixes", and every other rank is just an s. One word in the language needs
// the exception and it is cheaper to name it than to reach for a library.
const plural = (word) => (word === 'six' ? 'sixes' : `${word}s`);

/**
 * How he would say a holding out loud: "queen-six", "pocket queens".
 * Null when the record has no cards — never a guess, never "that one".
 */
export function handNickname(hand) {
  return nicknameForKey(holdingKey(hand));
}

/** The same, from an unordered rank key — what the owner NAMED, rather than
 *  what the record holds. Null for anything that is not two ranks. */
export function nicknameForKey(key) {
  if (typeof key !== 'string' || key.length !== 2) return null;
  const [a, b] = [...key];
  if (!RANK_TO_WORD[a] || !RANK_TO_WORD[b]) return null;
  if (a === b) return `pocket ${plural(RANK_TO_WORD[a])}`;
  // High card first, which is the order a person says it in — "queen-six",
  // never "six-queen". The key is sorted for comparison, not for speech.
  const order = 'AKQJT98765432';
  const [hi, lo] = order.indexOf(a) < order.indexOf(b) ? [a, b] : [b, a];
  return `${RANK_TO_WORD[hi]}-${RANK_TO_WORD[lo]}`;
}

// ── Is this even about a hand? ──────────────────────────────────────────────

// The vocabulary of asking about one. Broad on purpose: the cost of a false
// positive is that he answers a question about his night with the hand his
// night turned on, which is a good answer to that question too.
const ABOUT_A_HAND = /\b(?:hand|hands|why|shove[dn]?|shoving|jam(?:med)?|all[\s-]?in|bust(?:ed)?|fold(?:ed)?|call(?:ed)?|rais(?:e|ed)|bet|bluff(?:ed)?|pot|board|flop|turn|river|showdown|play(?:ed)?)\b|\bwhat happened\b|\bthat one\b/i;

export function isAboutAHand(said) {
  return ABOUT_A_HAND.test(String(said ?? ''));
}

// ── LIFE-3 job 4: is this a follow-up? ──────────────────────────────────────
//
// "Why???" after his own answer is a follow-up to THAT answer. It is not a new
// question and it is certainly not an unanswerable one — it is the shortest
// sentence in the language and it means "keep going about the thing you just
// said". The transcript's third beat is exactly this, and he treated it as a
// conversation starting from nothing.
//
// A closed list of the bare continuations, anchored at both ends so only a
// message that is ENTIRELY one of them counts. "Why did you fold there" is a
// question with its own subject and does not need the previous turn; "why" on
// its own has no subject at all and is nothing without it.
const FOLLOW_UP = /^(?:and\s+|but\s+|so\s+|ok(?:ay)?,?\s+|yeah,?\s+)?(?:why(?:\s+(?:not|that|then|though|is\s+that))?|how(?:\s+(?:come|so))?|what(?:\s+for)?|really|seriously|explain(?:\s+that)?|elaborate|go\s+on|meaning|and|so)\b[\s?!.,]*$/i;

/** A message that is nothing but a continuation of the last one. */
export function isFollowUp(said) {
  const t = String(said ?? '').trim();
  return !!t && FOLLOW_UP.test(t);
}

// ── The most recent notable hand ────────────────────────────────────────────

/** Did he get his stack in? Read from the stored why first, the decisions second. */
function wentAllIn(hand) {
  if (hand?.why?.allIn) return true;
  return (Array.isArray(hand?.decisions) ? hand.decisions : []).some((d) => d?.allIn);
}

const magnitude = (hand) => (Number.isFinite(hand?.net) ? Math.abs(hand.net) : 0);

/**
 * The hand a question with no hand named is about.
 *
 * A LADDER again, and for the same reason handWhy's is one: each rung is a
 * different kind of "the obvious hand", and they are in the order a person
 * would pick between them.
 *
 *   1. THE ALL-IN. The most recent hand he got his stack in on. This is the
 *      hand from the transcript, and it is the one nobody should have to name.
 *   2. THE BUST. Otherwise the hand that moved the most chips, by his own net
 *      rather than by the pot — the pot is not his (LIFE-2 job 2).
 *   3. THE BIGGEST POT. Otherwise, for a record written before `net` existed.
 *   4. THE LAST ONE. Otherwise the hand he just played, which is always an
 *      honest answer to "that hand".
 *
 * `hands` is newest-first, as recentHands is, so rung 1 takes the first match
 * and the rest tie-break on recency by scanning in the same direction.
 */
export function notableHand(hands) {
  const list = (Array.isArray(hands) ? hands : []).filter(Boolean);
  if (!list.length) return null;

  const jam = list.find(wentAllIn);
  if (jam) return jam;

  let best = null;
  for (const h of list) if (magnitude(h) > magnitude(best)) best = h;
  if (best) return best;

  let biggest = null;
  for (const h of list) {
    if (Number.isFinite(h.potSize) && h.potSize > (biggest?.potSize ?? 0)) biggest = h;
  }
  return biggest ?? list[0];
}

// ── The resolver ────────────────────────────────────────────────────────────

/**
 * Which hand the owner means, and how we know.
 *
 * @returns {{ hand: object|null, how: string, candidates: object[] }}
 *
 *   'number'    he gave a hand number and it is one of his
 *   'cards'     he named the cards and exactly one hand has them
 *   'ambiguous' he named the cards and more than one hand has them
 *   'unknown'   he named a hand that is not on the list — and this STOPS. It
 *               does not fall through to the notable hand, because answering
 *               about hand 700 with hand 812 is the invention this tree exists
 *               to stop, made by us instead of by him.
 *   'notable'   he named nothing and the question is about a hand
 *   'none'      nothing to resolve; he was not asking about a hand at all, or
 *               he has never played one
 */
export function resolveHand(hands, said, { focus = null } = {}) {
  const list = (Array.isArray(hands) ? hands : []).filter(Boolean);
  const text = String(said ?? '');
  // What he NAMED, whether or not it resolved. The caller needs it to say what
  // it is he cannot place — "I have no hand 700" is an answer and "I cannot
  // place it" is a shrug with better manners.
  const asked = { numbers: [...handNumbersIn(text)], holdings: [...namedHoldings(text)] };
  const out = (hand, how, candidates = []) => ({ hand, how, candidates, asked });
  if (!list.length) return out(null, 'none');

  if (asked.numbers.length) {
    const hit = list.find((h) => asked.numbers.includes(Number(h.handNumber)));
    return hit ? out(hit, 'number') : out(null, 'unknown');
  }

  if (asked.holdings.length) {
    const hits = list.filter((h) => asked.holdings.includes(holdingKey(h)));
    if (hits.length === 1) return out(hits[0], 'cards');
    if (hits.length > 1) return out(null, 'ambiguous', hits);
    return out(null, 'unknown');
  }

  // LIFE-3 job 4: the hand already under discussion. It beats the notable hand
  // below, which is the whole point — once the two of them are talking about
  // the jack-ten, "why" is about the jack-ten and not about whichever hand the
  // night turned on.
  //
  // GATED, and the gate is what stops the thread becoming sticky: a message
  // that is neither a follow-up nor about a hand has CHANGED THE SUBJECT, and
  // answering "are you hungry?" with hand 811 would be worse than the dead end
  // this tree exists to remove.
  if (focus && (isFollowUp(text) || isAboutAHand(text))) {
    const held = list.find((h) => Number(h.handNumber) === Number(focus));
    if (held) return out(held, 'focus');
  }

  if (isAboutAHand(text)) {
    const hand = notableHand(list);
    return hand ? out(hand, 'notable') : out(null, 'none');
  }
  return out(null, 'none');
}

/**
 * "The queen-six, or the jack-ten?" — the ambiguous case, in his voice.
 *
 * This is the line that replaces "which hand you talking about?", and the
 * difference between them is the whole job: one of them hands the question
 * back, the other hands back the two answers it could have been. Returns null
 * when the candidates have no cards on file, because a list of hand numbers
 * read out loud is not a person talking.
 */
export function candidateQuestion(candidates) {
  const names = (Array.isArray(candidates) ? candidates : [])
    .map(handNickname).filter(Boolean).slice(0, 3);
  if (names.length < 2) return null;
  const last = names.pop();
  return `The ${names.join(', the ')}, or the ${last}?`;
}
