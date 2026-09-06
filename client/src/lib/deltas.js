// WATCH-7 — what the hand did to a seat.
//
// The wire has always carried the POT and WHO TOOK IT, never a per-seat net, so
// the watch screen worked the number out for itself: his stack when the hand was
// dealt against his stack now. That derivation is correct while you watch a hand
// start to finish and wrong the moment you join mid-hand, reconnect, or the
// paced queue hands the screen a snapshot whose predecessor it never showed.
//
// SERVER-3 puts the real number on the result as `result.deltas`. This module is
// the seam: PREFER the server's number, fall back to the derived one, and never
// make a caller care which it got.
//
// The shape is deliberately not pinned to one encoding, because the server side
// is still being written and a client that only understands one of these would
// be a merge-order bug waiting to happen. All four are read:
//
//   deltas: { '0': -30, '1': 30 }          keyed by seat
//   deltas: [-30, 30]                      indexed by seat
//   deltas: [{ seat: 0, delta: -30 }, …]   a row per seat
//   deltas: [{ seat: 0, net: -30 }, …]     ditto, under the other obvious name
//
// Anything else reads as absent, which is exactly what the fallback is for.

function num(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The net chips a seat won or lost on this hand, from the server's own number.
 * Returns null when the result carries no delta for that seat — the caller then
 * falls back to the stack-at-deal derivation.
 */
export function serverDelta(result, seat) {
  if (!result || !Number.isInteger(seat)) return null;
  const d = result.deltas;
  if (d == null) return null;

  if (Array.isArray(d)) {
    // A row per seat wins over positional indexing: a list of objects is never
    // a list of numbers, so there is nothing to disambiguate.
    if (d.length && typeof d[0] === 'object' && d[0] !== null) {
      const row = d.find((r) => r && r.seat === seat);
      if (!row) return null;
      return num(row.delta != null ? row.delta : row.net);
    }
    return seat < d.length ? num(d[seat]) : null;
  }

  if (typeof d === 'object') {
    const v = Object.prototype.hasOwnProperty.call(d, seat) ? d[seat] : d[String(seat)];
    return v === undefined ? null : num(v);
  }

  return null;
}

/**
 * The delta the screen should show: the server's if it sent one, otherwise the
 * derived `now - atDeal`. Null when neither is available, which is a real state
 * — joining mid-hand — and renders as no toast rather than as "+$0".
 */
export function handDelta(result, seat, { stackNow, stackAtDeal } = {}) {
  const fromServer = serverDelta(result, seat);
  if (fromServer !== null) return fromServer;
  if (!Number.isFinite(stackNow) || !Number.isFinite(stackAtDeal)) return null;
  return stackNow - stackAtDeal;
}

/** "+$30" / "−$30", with the real minus sign the felt uses everywhere else. */
export function money(n) {
  if (!Number.isFinite(n)) return null;
  return (n < 0 ? '−$' : '+$') + Math.abs(n).toLocaleString();
}
