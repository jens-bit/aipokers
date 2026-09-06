// client/src/lib/slots.js — YOU-2
//
// GET /api/slots — how many agents this owner may have out at once, and what
// unlocks the next seat. The endpoint does not exist yet; this reads it the way
// the wallet is read (WUI-1's law), so the row it feeds is simply absent until
// the server grows one, and arrives without a client change when it does.
//
// Absence is a first-class answer. A 404, a 403, a body that is not a slot
// count, or no server at all all mean the same thing to the screen: this
// deployment does not have seats, so do not draw a seat row.

import { getTelegramInitData, getUserId } from './telegram.js';

/**
 * @returns {{used:number,total:number,nextAt:number|null}|null}
 *   `used`/`total` are seats. `nextAt` is the lifetime chips won at which the
 *   next seat opens, or null when there is no next seat to describe — the last
 *   one is taken, or the server did not say.
 */
export async function fetchSlots() {
  try {
    const res = await fetch(
      `/api/slots?userId=${encodeURIComponent(getUserId())}`,
      { headers: { 'x-telegram-init-data': getTelegramInitData() } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const used = Number(data?.used);
    const total = Number(data?.total);
    // Both numbers or nothing: a seat row that has to guess one half of
    // "2 of 4" is a row that will eventually print "2 of NaN".
    if (!Number.isFinite(used) || !Number.isFinite(total)) return null;
    const nextAt = Number(data?.nextAt);
    return {
      used: Math.max(0, Math.round(used)),
      total: Math.max(0, Math.round(total)),
      nextAt: Number.isFinite(nextAt) && nextAt > 0 ? Math.round(nextAt) : null,
    };
  } catch {
    return null;
  }
}

/**
 * The row's own words: "2 of 4 seats · next 10,000 won".
 *
 * The tail is dropped once every seat is taken — there is no next one to earn,
 * and printing a threshold he has already passed reads as a target he missed.
 */
export function slotsLine(slots) {
  if (!slots) return null;
  const seats = `${slots.used} of ${slots.total} seats`;
  if (slots.nextAt === null || slots.used >= slots.total) return seats;
  return `${seats} · next ${slots.nextAt.toLocaleString('en-US')} won`;
}
