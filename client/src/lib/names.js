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

// ── HOME-2 job 2 · the name on the pill over his head ───────────────────────
//
// SIX CHARACTERS. The pill in the room is not the plate on a frame and not the
// row in the roster: it hangs over a 46px body in a 390px room, with two 44px
// resource bars inside it and a bubble that has to find clearance beside it.
// Fourteen characters there is a pill wider than the man wearing it, and the
// bubble rule then measures its clearance against a box that is mostly name.
//
// Longer names are not cut with an ellipsis, which is what the PLATE does: an
// ellipsis is a promise that the rest exists somewhere, and at six characters
// over a body the honest thing is a short form. So the order is
//
//   1. the name, if it already fits;
//   2. the NICKNAME the server gives him — not on the wire yet, and read the
//      moment it is, the same way job 3 reads `identity`;
//   3. the first six characters.
//
// It is deliberately not `name.split(' ')[0]`. That is the bug BUGS-A job 1
// was filed for: a first word is a DIFFERENT NAME, so "The Clock" and "The
// Grinder" both became "The". Six characters of a name is still that name's
// beginning, and two agents who share it share it in the roster too.

/** The longest name the room's pill carries. */
export const PILL_SHORT = 6;

/**
 * The name as the room's pill writes it.
 *
 * @param {string} name      whatever the roster calls him
 * @param {string} nickname  the short form the server chose, when it sends one
 * @param {number} max       characters; the default is the rule
 */
export function shortName(name, nickname = null, max = PILL_SHORT) {
  const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : PILL_SHORT;
  const full = String(name ?? '').trim();
  if (full && full.length <= limit) return full;

  const nick = String(nickname ?? '').trim();
  // A nickname longer than the pill is still the server's own short form, so it
  // is cut rather than thrown away for the first six of the long name.
  if (nick) return nick.length <= limit ? nick : nick.slice(0, limit).trimEnd();

  return full.slice(0, limit).trimEnd();
}
