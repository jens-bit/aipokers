// WATCH v3 — the pacing ladder, client side.
//
// Pure and side-effect free: no imports, no DOM, no clock. The server owns the
// state; this module owns the names, the reading of them, and the defaults that
// keep the felt renderable while feature/pace is still being built.
//
// Server contract (all fields optional today):
//   game.pace       = 'calm' | 'heating' | 'allin' | 'showdown'   absent → calm
//   game.potBb      = the pot in big blinds at the moment it changed
//   game.heroEquity = a probability, 0..1, on every snapshot       absent → the
//                     client's last-known read for the hand (FIX-1g)
//   game.reads      = an array, one entry per opponent             absent → the
//                     "no read yet" panel. See lib/reads.js.
//
// And, off the PACE message rather than the snapshot:
//   { pace, potBb, board?, card? }   the staged runout during an all-in hold
//
// CALM → HEATING → ALL-IN → SHOWDOWN is a server-driven ladder, not a UI mode:
// the client is told which state it is in and never infers one. The ALL-IN hold
// exists only while a spectator is watching — unwatched, the hand resolves at
// machine speed — which is why the client may not manufacture it.

export const PACE_STATES = ['calm', 'heating', 'allin', 'showdown'];

// glow drives the inset shadow's spread; `heat` is the warm felt + fat ticker
// that CALM and SHOWDOWN do not get. Copied from design-refs/mood-watch3.jsx.
export const PACE = {
  calm: {
    key: 'calm', label: 'CALM', glow: 0, heat: false,
    note: 'default. Nothing about the felt asks for attention.',
  },
  heating: {
    key: 'heating', label: 'HEATING', glow: 0.5, heat: true,
    note: 'pot crossed the threshold. Felt warms, ticker grows, one haptic tap.',
  },
  allin: {
    key: 'allin', label: 'ALL-IN', glow: 1, heat: true,
    note: 'a 3–5s hold on his line before the runout. Spectator only.',
  },
  showdown: {
    key: 'showdown', label: 'SHOWDOWN', glow: 0.7, heat: false,
    note: 'cards flip one at a time, the reveal is held, then the pot slides.',
  },
};

/** The state the server put the table in. Anything unrecognised reads as calm. */
export function paceOf(game) {
  const p = game?.pace;
  return PACE_STATES.includes(p) ? p : 'calm';
}

export function paceMeta(game) {
  return PACE[paceOf(game)];
}

/** True while the felt is warm — the gold/red half of the ladder. */
export function isHeated(game) {
  return paceMeta(game).heat;
}

// The wire has carried equity as a 0..1 fraction since WV2-2, but a snapshot
// field could reasonably arrive as a percent. Accept both, the way the watch
// screen already does for a decision's equity.
export function toPct(equity) {
  const n = typeof equity === 'number' ? equity : parseFloat(equity);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

/**
 * The hero's share of the pot, for the rope under the board.
 *
 * Reads the snapshot first — feature/pace puts it on every frame, which is the
 * whole point of finding 2 — and falls back to whatever the client last learned
 * from a decision. Before the deal there is nothing to know: null, and the rope
 * sits dead centre rather than empty.
 */
export function heroEquityOf(game, fallback = null, heroSeat = 0) {
  const fromSnapshot = toPct(game?.heroEquity);
  if (fromSnapshot !== null) return fromSnapshot;

  const seat = Array.isArray(game?.seats) ? game.seats[heroSeat] : null;
  const fromSeat = toPct(seat?.equity);
  if (fromSeat !== null) return fromSeat;

  return toPct(fallback);
}

/**
 * How many board cards have landed.
 *
 * Everywhere but a showdown this is simply how many the server has dealt. On a
 * showdown the runout is revealed one card at a time, so the caller says how
 * many are face up and this clamps it to what actually exists.
 */
export function landedCount(game, revealed = null) {
  const dealt = Array.isArray(game?.community) ? game.community.length : 0;
  if (revealed == null) return dealt;
  return Math.max(0, Math.min(dealt, revealed));
}

/**
 * W3-5: the runout, as the server stages it.
 *
 * During a spectator-only all-in hold the PACE message carries the runout card
 * by card — `board` is what is visible so far and `card` is the one just turned
 * — while the STATE snapshot already holds the finished board. So the frame is
 * the truth about what is face up, and the client's own timer is only the
 * fallback for a server that is not staging (or a client whose container does
 * not forward the frames yet).
 *
 * Returns the number of cards face up, or null for "no frame, use the fallback".
 */
export function stagedCount(frame) {
  if (!frame) return null;
  if (Array.isArray(frame.board)) return frame.board.length;
  // A frame with a card but no board still means one more has landed; without
  // a board to count there is nothing to say, so defer to the fallback.
  return null;
}

// The fallback cadence, used only when the server is not staging the runout.
// One card every 450ms: five cards in 2.0s, the ww-ref's "≈ 2s reveal".
export const FLIP_MS = 450;
