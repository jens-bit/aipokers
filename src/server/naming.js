// src/server/naming.js — BUGS-B/4
//
// What he is called.
//
// A name is the first thing an owner gives him and the only thing every
// surface in the product shows: the floor card, the seat plate, the bubble,
// the ceremony, the share card, the push notification. It is not a field, it
// is his identity — so it can never be empty, and it can never be a word that
// means nothing on its own.
//
// The draft asks for it ("what's my name?") and the owner types whatever he
// likes: a name, a sentence, an emoji, "call him the grinder", nothing at all.
// This turns any of that into something that fits on a seat plate.
//
// Three rules the shape of this file comes from:
//
//   1. NEVER EMPTY. Every path out of coinName returns a usable name. The one
//      way to get nothing back is to ask for nothing back (fallback: null),
//      which is how a caller says "I have a better fallback than yours".
//   2. NEVER "The". A bare article is not a name, and neither is "Him",
//      "Name" or "Agent" — they are the words around a name. A brief that
//      produces only those produces the fallback instead.
//   3. IT FITS. NAME_MAX characters, cut at a word boundary wherever one is
//      available, because "The Relentless" truncated mid-word to "The Relentl"
//      reads as a bug and "The" reads as a placeholder.
//
// Pure and side-effect free: no clock, no store, no model.

// A seat plate is narrow and a floor card is narrower. Fourteen characters is
// what the design refs fit without ellipsis.
export const NAME_MAX = 14;

// The name nobody chose. Exactly NAME_MAX characters, on purpose.
export const DEFAULT_NAME = 'The Understudy';

// Words that are the scaffolding around a name rather than a name. A result
// made of nothing but these is not a name.
const SCAFFOLDING = new Set([
  'the', 'a', 'an', 'my', 'his', 'her', 'its', 'their', 'mine',
  'him', 'her', 'them', 'it', 'me', 'you',
  'name', 'names', 'named', 'call', 'called', 'calling',
  'agent', 'player', 'bot', 'guy', 'dude',
  'is', 'be', 'and', 'or', 'of', 'to', 'for',
  'yes', 'no', 'ok', 'okay', 'sure', 'whatever', 'anything', 'idk', 'dunno',
]);

// The ways an owner says a name without only saying the name.
const LEAD_INS = [
  /^(?:i(?:'|’)?d\s+)?(?:like\s+to\s+)?(?:call|name)\s+(?:him|it|them|me|the\s+agent)?\s*/i,
  /^let(?:'|’)?s\s+(?:call|name)\s+(?:him|it|them)?\s*/i,
  /^(?:his|the|its)\s+name\s+(?:is|should\s+be|will\s+be)?\s*/i,
  /^(?:he(?:'|’)?s|he\s+is)\s+/i,
  /^(?:how\s+about|maybe|perhaps|something\s+like)\s+/i,
  /^name\s*[:\-–—]\s*/i,
];

// Everything a seat plate cannot print. Letters (any alphabet), digits, and
// the three separators a poker name actually uses.
const UNPRINTABLE = /[^\p{L}\p{N}'\- ]/gu;

const words = (text) => String(text).split(/\s+/).filter(Boolean);

// Title case, but only where the owner did not already choose. "granite"
// becomes "Granite"; "MsAllIn" and "TAGmaster" are left exactly as typed,
// because a name with capitals inside it is a name somebody meant.
function cased(word) {
  if (word !== word.toLowerCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Trim to NAME_MAX at a word boundary where there is one, and hard-cut only
// when a single word is longer than the plate.
function clamp(name) {
  if (name.length <= NAME_MAX) return name;
  const parts = words(name);
  const kept = [];
  for (const part of parts) {
    const next = kept.length === 0 ? part : `${kept.join(' ')} ${part}`;
    if (next.length > NAME_MAX) break;
    kept.push(part);
  }
  if (kept.length > 0) return kept.join(' ');
  return name.slice(0, NAME_MAX).trim();
}

// Is what is left an actual name, or only the words that surround one?
function isName(candidate) {
  if (!candidate) return false;
  return words(candidate).some((w) => !SCAFFOLDING.has(w.toLowerCase()));
}

/**
 * Turn whatever was typed into a name that fits on a seat plate.
 *
 * @param raw      anything: a name, a sentence, a model's JSON field, null
 * @param fallback what to answer when nothing usable came out. Pass null to
 *                 get null — the way a caller says it has a better one.
 * @returns a name of at most NAME_MAX characters, or the fallback
 */
export function coinName(raw, { fallback = DEFAULT_NAME } = {}) {
  let text = String(raw ?? '');

  // A model that answered with a fence or a blob answered with nothing.
  text = text.replace(/```[\s\S]*?(?:```|$)/g, ' ');
  // One line. A name is never a paragraph, and the first line is the answer.
  text = text.split(/[\r\n]/)[0] ?? '';
  // Quotes around it are punctuation, not part of it.
  text = text.replace(/^[\s"'‘’“”«»]+|[\s"'‘’“”«»]+$/g, '');

  for (const lead of LEAD_INS) {
    const next = text.replace(lead, '');
    if (next !== text) { text = next; break; }
  }

  // A sentence that continues past the name stops at the first full stop.
  text = text.split(/[.!?;:,]/)[0] ?? '';
  text = text.replace(UNPRINTABLE, ' ').replace(/\s+/g, ' ').trim();
  // A separator with nothing on one side of it is punctuation again.
  text = text.replace(/^[-']+|[-']+$/g, '').trim();

  if (!text) return fallback;

  const titled = words(text).map(cased).join(' ');
  const clamped = clamp(titled).replace(/[-'\s]+$/, '').trim();

  // "The" survived the clamp but a bare article is not a name — and neither is
  // a brief that only ever said "call him".
  if (!isName(clamped)) return fallback;
  return clamped;
}

/**
 * A name for an agent record that has one, or the best one available.
 *
 * The repair path: records predate this file, and one of them may carry '',
 * 'The', or nothing at all. Every read goes through here so a bad name is
 * fixed the first time anybody looks at it rather than staying bad forever.
 */
export function ensureName(agent, { fallback = DEFAULT_NAME } = {}) {
  if (!agent) return fallback;
  const coined = coinName(agent.name, { fallback: null });
  if (coined && coined === agent.name) return coined;
  agent.name = coined ?? fallback;
  return agent.name;
}
