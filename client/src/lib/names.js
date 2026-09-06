// client/src/lib/names.js — BUGS-A job 1
//
// HOW AN AGENT'S NAME IS WRITTEN ON A PILL OR A PLATE.
//
// Every small surface that named an agent took `name.split(' ')[0]`, which is
// not an abbreviation — it is a different name. "The Clock" became "The",
// "Wild Bill" became "Wild" and "Bluff Master" became "Bluff", so three agents
// an owner had deliberately named apart all read as the same anonymous word.
// A first word is only a name when the name happens to be one word long.
//
// So: the FULL name, and a length rule for the cases where a pill genuinely
// cannot hold it. Fourteen characters is the widest a name can be before the
// narrowest surface that uses this (the floor pill and the frame plate) starts
// pushing its own neighbours; past that it is cut and marked as cut, which is
// what an ellipsis is for. A cut name is still recognisably that agent —
// "Bluff Mast…" is not "Wild Bill" — which is the whole property the first
// word threw away.
//
// One rule, one place, so a plate and a pill can never disagree about what a
// man is called.

/** The longest name a pill carries whole. */
export const NAME_MAX = 14;

/**
 * The name as a pill or a plate writes it.
 *
 * @param {string} name  whatever the roster calls him
 * @param {number} max   characters before the ellipsis; the default is the rule
 * @returns {string} the full name, or `max` characters of it and an ellipsis
 */
export function pillName(name, max = NAME_MAX) {
  const full = String(name ?? '').trim();
  if (!full) return '';
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : NAME_MAX;
  if (full.length <= limit) return full;
  // Trailing space before the ellipsis reads as a typo rather than as a cut.
  return `${full.slice(0, limit).trimEnd()}…`;
}
