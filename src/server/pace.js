// src/server/pace.js — PACE-1
//
// The pacing ladder from design-refs/mood-ww-ref.jsx S1, server-side and pure.
//
//   CALM → HEATING → ALL-IN → SHOWDOWN
//
// "Server-driven, not a UI mode: the client is told which state it is in."
// The client never derives the state from the pot itself, because two clients
// watching the same table have to warm the felt on the same hand.
//
// Two laws the ref is explicit about, and both live here:
//
//   · IT IS A LADDER. Within a hand the state only ever advances. A pot that
//     shrinks on a refund does not cool the felt back down, and a table that
//     has gone all-in does not go back to being calm.
//   · THE HOLD IS SPECTATOR-ONLY. "A five-second pause that nobody sees is
//     five seconds of a worse win rate." Unwatched, the hand resolves at
//     machine speed; watched, the same pause costs nothing and buys the beat.
//     It also means watching is never the optimal way to play, which is what
//     keeps this a manager game rather than a clicker.
//
// Everything here is deterministic given a seed, so a test can assert the exact
// millisecond a frame lands on.

export const PACE = Object.freeze({
  CALM: 'calm',
  HEATING: 'heating',
  ALLIN: 'allin',
  SHOWDOWN: 'showdown',
});

// The ladder, in order. Index is rank; a transition to a lower rank is ignored.
export const PACE_ORDER = Object.freeze([PACE.CALM, PACE.HEATING, PACE.ALLIN, PACE.SHOWDOWN]);

export function paceRank(pace) {
  const i = PACE_ORDER.indexOf(pace);
  return i === -1 ? 0 : i;
}

// The pot, in big blinds, at which the felt warms. The ref's sheet says 12;
// PACE-1 makes it an env dial with a higher default because the ref was drawn
// against a 6-max table and the live ones are heads-up, where 12bb pots are
// routine and a felt that is always warm says nothing.
export function heatThresholdBb() {
  const raw = Number(process.env.PACE_HEAT_BB ?? 25);
  return Number.isFinite(raw) && raw > 0 ? raw : 25;
}

// Hold timings. The ref: "3–5s hold" on the all-in, "≈ 2s reveal + 1s hold".
export const ALLIN_HOLD_MIN_MS = 3000;
export const ALLIN_HOLD_MAX_MS = 5000;
export const RUNOUT_CARD_MS = 700;    // one card at a time, 700ms apart
export const REVEAL_HOLD_MS = 2000;   // the finished board, held, before the pot moves

export function potInBb(potChips, bigBlind) {
  const pot = Number(potChips);
  const bb = Number(bigBlind);
  if (!Number.isFinite(pot) || !Number.isFinite(bb) || bb <= 0) return 0;
  return Number((pot / bb).toFixed(1));
}

/**
 * The state this hand should be in right now. Pure: give it the same facts
 * twice and it answers the same way.
 *
 * @param potChips     current pot in chips
 * @param bigBlind     the table's big blind
 * @param anyAllIn     is a seat that is still in the hand all-in?
 * @param actionClosed no more betting is possible this hand
 * @param revealed     the hand has reached its showdown/result
 */
export function paceFor({ potChips = 0, bigBlind = 0, anyAllIn = false, actionClosed = false, revealed = false } = {}) {
  if (revealed) return PACE.SHOWDOWN;
  if (anyAllIn && actionClosed) return PACE.ALLIN;
  if (potInBb(potChips, bigBlind) >= heatThresholdBb()) return PACE.HEATING;
  return PACE.CALM;
}

/** The ladder rule: advance or stay, never step back. */
export function advancePace(current, next) {
  return paceRank(next) > paceRank(current) ? next : current;
}

// ── Deterministic hold length ────────────────────────────────────────────────
// The 3–5s window is a range so two all-ins in a row do not feel metronomic,
// but a range drawn from Math.random cannot be tested. Seeded on the table and
// the hand number, it is both varied and exactly reproducible.

function hashSeed(str) {
  const s = String(str);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function seedFor(tableId, handNumber) {
  return `${tableId ?? 'table'}:${handNumber ?? 0}`;
}

export function allInHoldMs(seed) {
  const frac = (hashSeed(seed) % 1000) / 1000;
  return Math.round(ALLIN_HOLD_MIN_MS + frac * (ALLIN_HOLD_MAX_MS - ALLIN_HOLD_MIN_MS));
}

/**
 * The whole staged beat, as a list of frames the caller emits on a timer.
 *
 * `heldBoard` is the board as it stood when the last chip went in; `runout` is
 * what the engine dealt after that — the cards nobody has seen yet, because the
 * engine deals them synchronously and the client has not been told.
 *
 * Returns { frames: [{ at, pace, board, card }], awardAt, totalMs }.
 * `at` and `awardAt` are milliseconds from the start of the hold.
 *
 * Unwatched (watched: false) returns an empty plan with awardAt 0: the pot is
 * pushed immediately and the hand becomes a replay.
 */
export function holdPlan({ heldBoard = [], runout = [], seed = 'x', watched = true } = {}) {
  if (!watched) return { frames: [], awardAt: 0, totalMs: 0, holdMs: 0, watched: false };

  const hold = allInHoldMs(seed);
  const frames = [
    // The line lands, and then nothing happens for three to five seconds.
    { at: 0, pace: PACE.ALLIN, board: [...heldBoard], card: null },
  ];

  let at = hold;
  const board = [...heldBoard];
  for (const card of runout) {
    board.push(card);
    frames.push({ at, pace: PACE.SHOWDOWN, board: [...board], card });
    at += RUNOUT_CARD_MS;
  }

  // The last card is followed by the reveal hold; with no runout at all (an
  // all-in called on the river) the hold still applies, so the beat exists
  // even when there is nothing left to deal.
  const lastCardAt = runout.length > 0 ? at - RUNOUT_CARD_MS : hold;
  const awardAt = lastCardAt + REVEAL_HOLD_MS;

  return { frames, awardAt, totalMs: awardAt, holdMs: hold, watched: true };
}
