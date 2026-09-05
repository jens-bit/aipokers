// WATCH v3 — the opponent model, client side.
//
// W3-5: adapted to the shape feature/pace actually sends. W3-2 was written
// against a guessed contract — a single opponent, stats in a map, `conf` as a
// ± half-width in points. All three were wrong.
//
// Server contract (src/server/protocol.js, ServerMsg.READ, and the same array
// on every STATE snapshot for the owner's spectator only):
//
//   state.reads = [{
//     playerId, displayName, seat,
//     handsObserved,          how many hands of evidence
//     gate,                   the evidence bar THIS hero needs, from his READS
//                             and the subject's DECEPTION — so it varies per pair
//     formed,                 handsObserved >= gate
//     shape,                  station | maniac | nit | tag | null
//     line,                   his sentence, or null
//     rows: [{ k, label, value, confidence, formed }]   five, in canon order
//   }]
//
// There is NO `forming` field: src/server/table.js _maybeBroadcastReads() only
// sends when the fingerprint (playerId, formed, shape) changes, so the event IS
// the message arriving. A client watching snapshots has to notice the
// transition itself — see ReadPanel.
//
// The rows arrive built, labelled and ordered. The client's job is to pick
// which opponent to show and to turn `confidence` into a bracket width — not to
// re-derive anything.
//
// CONFIDENCE IS A CERTAINTY, NOT A WIDTH. src/agent/reads.js readConfidence()
// returns 0..1 and "reaches 1 at three times the number of hands this hero
// needs before he will act on a read at all". The bar draws the inverse: full
// certainty is a number, no certainty is the widest bracket the design allows.
//
// Pure and side-effect free.

export const READ_KEYS = ['vpip', 'pfr', 'aggr', 'fold', 'sd'];

// Fallback labels only. The server sends its own and they win — READ_ROWS in
// src/agent/reads.js is the source of truth for the wording.
export const READ_LABELS = {
  vpip: 'PLAYS',
  pfr: 'RAISES FIRST',
  aggr: 'AGGRESSION',
  fold: 'FOLDS TO HEAT',
  sd: 'GOES TO SHOWDOWN',
};

// The widest the confidence bracket ever gets, in points either side. At
// confidence 1 it closes to nothing and the bar is just a number, which is what
// "the bracket narrows with hands" ends in.
export const MAX_BRACKET = 12;

const clamp = (n) => Math.max(0, Math.min(100, n));

/** Certainty (0..1) → the half-width the bar draws. */
export function bracketFor(confidence) {
  const c = Number(confidence);
  if (!Number.isFinite(c) || c <= 0) return MAX_BRACKET;
  if (c >= 1) return 0;
  return Math.round(MAX_BRACKET * (1 - c));
}

function readRow(raw, key) {
  // Number(null) is 0, and a null row rendered as a confident zero is exactly
  // the law this panel exists to keep: an unanswered question is not an answer
  // of nothing. Only a real number counts.
  const raw_v = raw?.value;
  const known = typeof raw_v === 'number' && Number.isFinite(raw_v);
  const value = known ? raw_v : null;
  return {
    key,
    label: (typeof raw?.label === 'string' && raw.label) || READ_LABELS[key] || key,
    v: known ? clamp(Math.round(value)) : null,
    // No evidence, no bracket: an unanswered row draws nothing rather than a
    // maximum-width claim about a number it does not have.
    conf: known ? bracketFor(raw?.confidence) : 0,
    formed: !!raw?.formed,
  };
}

/**
 * One opponent's panel, from the entry the server sent.
 *
 * Always five rows in canon order, whatever the server sent — a short or
 * reordered array is filled from READ_KEYS so the panel's shape never moves.
 */
export function normalizeReads(entry) {
  const served = Array.isArray(entry?.rows) ? entry.rows : [];
  const byKey = new Map(served.filter((r) => r && r.k).map((r) => [r.k, r]));
  const rows = READ_KEYS.map((key) => readRow(byKey.get(key), key));

  const hands = Number.isFinite(entry?.handsObserved) ? entry.handsObserved : 0;

  return {
    playerId: entry?.playerId ?? null,
    name: (typeof entry?.displayName === 'string' && entry.displayName) || null,
    seat: Number.isInteger(entry?.seat) ? entry.seat : null,
    hands,
    gate: Number.isFinite(entry?.gate) ? entry.gate : null,
    shape: entry?.shape ?? null,
    line: (typeof entry?.line === 'string' && entry.line) || null,
    // `formed` is the server's own gate decision — handsObserved >= gate, with
    // the gate derived from this hero's READS and the subject's DECEPTION — so
    // the panel can never claim a read he is not already playing with.
    formed: !!entry?.formed,
    rows,
    known: rows.some((r) => r.v != null),
  };
}

/**
 * Which opponent the panel is about.
 *
 * The one still live in the hand — that is the read that is costing or earning
 * money right now — and failing that the one he has seen most of, because a
 * panel about somebody he barely knows is not worth the space. Ties keep the
 * server's order, which is seat order.
 */
export function pickOpponent(reads, game = null) {
  const list = Array.isArray(reads) ? reads.filter(Boolean) : [];
  if (list.length === 0) return null;

  const seats = Array.isArray(game?.seats) ? game.seats : null;
  const stillIn = (entry) => {
    if (!seats) return false;
    const seat = Number.isInteger(entry.seat) ? seats[entry.seat] : null;
    if (!seat) return false;
    return !seat.folded;
  };

  const live = list.filter(stillIn);
  const pool = live.length > 0 ? live : list;

  return pool.reduce((best, entry) => {
    const mine = Number.isFinite(entry.handsObserved) ? entry.handsObserved : 0;
    const theirs = Number.isFinite(best.handsObserved) ? best.handsObserved : 0;
    return mine > theirs ? entry : best;
  }, pool[0]);
}

/**
 * What he says when he has nothing yet. Never "waiting for the first action":
 * before there is evidence he says so, in his own voice.
 */
export function noEvidenceLine() {
  return 'Give me a few hands.';
}
