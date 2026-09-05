// WATCH v4 — the DEAL beat.
// design-refs/mood-watch4.jsx, and the HAPTIC4 table in mood-watch4b.jsx.
//
// The hand does not appear; it is dealt. His two cards land one at a time, 90ms
// apart and never simultaneous, each with its own light tap. Then the table's
// backs go out as ONE gesture — five seats in 200ms, no haptic, because their
// cards are not his event.
//
// Pure: no DOM, no timers of its own, no fetch. The screen owns the clock and
// asks this module what should be on the felt at a given elapsed time, which is
// what makes the beat testable without waiting for it.

// HAPTIC4: "90ms after the first, never simultaneous".
export const CARD_GAP_MS = 90;
// "five seats in 200ms as a single gesture" — one sweep, starting once his
// cards are down so the two beats never overlap.
export const BACKS_DELAY_MS = CARD_GAP_MS * 2 + 60;
export const BACKS_SWEEP_MS = 200;

// A hand this strong is worth a soft tap on its own. Pre-flop equity is the
// only measure available at deal time and the server already puts it on the
// snapshot; the threshold is the ref's "premium", not a number the UI invents.
export const WARM_EQUITY = 0.62;

/**
 * How much of the deal has happened at `elapsed` ms.
 *
 * @returns {{ landed: number, backs: boolean }}
 *   landed — how many of his two cards are face up (0, 1 or 2)
 *   backs  — whether the table's backs have been swept out
 */
export function dealBeat(elapsed) {
  const t = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  return {
    landed: t >= CARD_GAP_MS * 2 ? 2 : t >= CARD_GAP_MS ? 1 : 0,
    backs: t >= BACKS_DELAY_MS,
  };
}

/** The whole beat, for a caller that wants to know when it is over. */
export const DEAL_TOTAL_MS = BACKS_DELAY_MS + BACKS_SWEEP_MS;

/**
 * Is this hand worth warming his cards for?
 *
 * Owner-only by construction rather than by a flag: `heroHole` is the thing the
 * server withholds from anyone who has not proved ownership, so a viewer who
 * cannot see the cards cannot warm them either. A spectator gets no tap.
 */
export function isWarm(heroHole, equity) {
  if (!Array.isArray(heroHole) || heroHole.length < 2) return false;
  const n = typeof equity === 'number' ? equity : parseFloat(equity);
  if (!Number.isFinite(n)) return false;
  // The wire carries equity as a 0..1 fraction; a value above 1 is already a
  // percent (the flagged-hands API stores integers), so it is scaled back.
  const frac = n > 1 ? n / 100 : n;
  return frac >= WARM_EQUITY;
}

/**
 * A new hand is one this viewer has not seen dealt. Keyed on the hand number so
 * a re-render, a reconnect or a late STATE snapshot cannot re-deal a hand that
 * is already on the table.
 */
export function isNewDeal(handNumber, lastDealtHand) {
  return Number.isFinite(handNumber) && handNumber !== lastDealtHand;
}
