// client/src/lib/slots.js — YOU-2, taught the server's shape in BIRTH-5
//
// GET /api/slots — how many agents this owner may have out at once, and what
// unlocks the next seat. Read the way the wallet is read (WUI-1's law), so the
// row it feeds is simply absent when the deployment has no seats.
//
// Absence is a first-class answer. A 404, a 403, a body that is not a slot
// count, or no server at all all mean the same thing to the screen: this
// deployment does not have seats, so do not draw a seat row.
//
// TWO SHAPES, and the second one is the real one. YOU-2 shipped this reader
// before the endpoint existed and guessed at `{ used, total, nextAt }`. SLOTS-1
// then built it as `{ used, cap, next: { index, price, earned, unlocked } }`,
// which this file did not recognise — so `fetchSlots` returned null against
// every live server and YOU's seat row has never once been drawn. Both are read
// now: the guess because it is what the tests and any older deployment speak,
// and the real one because it is what the product actually sends.
//
// The server's shape carries one thing the guess cannot: EARNED. That is what
// lets a screen say "you have 4,200" rather than only "next 10,000 won", and it
// is the whole reason BIRTH-5's refusal can be a sentence instead of a price
// tag.

import { getTelegramInitData, getUserId } from './telegram.js';

const whole = (n) => Math.max(0, Math.round(n));

// Grouped by hand, not with toLocaleString. Under several ordinary locales
// toLocaleString groups with a NARROW NO-BREAK SPACE instead of a comma, so the
// same seat price reads "10 000" for some owners and "10,000" for others — the
// reason lib/wallet.js's money() already does its own grouping, and the reason
// TableSheet.jsx does. One number format in the product.
const chips = (n) => String(whole(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * @returns {{used:number,total:number,nextAt:number|null,next?:object}|null}
 *   `used`/`total` are seats. `nextAt` is the lifetime chips won at which the
 *   next seat opens, or null when there is no next seat to describe — the last
 *   one is taken, or the server did not say. `next` is present only when the
 *   server sent the full projection: `{ index, price, earned, unlocked }`.
 */
export function readSlots(data) {
  const used = Number(data?.used);
  // SLOTS-1 calls the ceiling `cap`; YOU-2 guessed `total`. Either names the
  // same number.
  const total = Number(data?.total ?? data?.cap);
  // Both numbers or nothing: a seat row that has to guess one half of
  // "2 of 4" is a row that will eventually print "2 of NaN".
  if (!Number.isFinite(used) || !Number.isFinite(total)) return null;

  const next = data?.next;
  const hasNext = next && typeof next === 'object' && Number.isFinite(Number(next.price));
  // The threshold, from whichever shape said it. `next` is null at the cap by
  // design — there is no fifth seat to name a price for.
  const nextAt = Number(hasNext ? next.price : data?.nextAt);

  const out = {
    used: whole(used),
    total: whole(total),
    nextAt: Number.isFinite(nextAt) && nextAt > 0 ? Math.round(nextAt) : null,
  };
  // Added only when it was actually sent, so a body in the older shape still
  // reads back as exactly the three fields YOU-2 asked for.
  if (hasNext) {
    out.next = {
      index: Number.isFinite(Number(next.index)) ? Number(next.index) : out.used + 1,
      price: whole(Number(next.price)),
      earned: Number.isFinite(Number(next.earned)) ? whole(Number(next.earned)) : 0,
      unlocked: !!next.unlocked,
    };
  }
  return out;
}

export async function fetchSlots() {
  try {
    const res = await fetch(
      `/api/slots?userId=${encodeURIComponent(getUserId())}`,
      { headers: { 'x-telegram-init-data': getTelegramInitData() } },
    );
    if (!res.ok) return null;
    return readSlots(await res.json());
  } catch {
    return null;
  }
}

/**
 * "2nd seat costs 10,000 won · you have 4,200" — SLOTS-1's refusal, in words.
 *
 * Takes the 409 body verbatim (`{ error, price, earned }`) so the one thing the
 * owner is told is the one thing the server actually said. Null when the body
 * is not a priced refusal, because a sentence built out of undefined is worse
 * than no sentence.
 */
export const ORDINALS = ['1st', '2nd', '3rd', '4th'];

export function lockedSeatLine({ price, earned, index } = {}) {
  const cost = Number(price);
  if (!Number.isFinite(cost) || cost <= 0) return null;
  const have = Number.isFinite(Number(earned)) ? whole(Number(earned)) : 0;
  const nth = ORDINALS[(Number(index) || 0) - 1] ?? 'next';
  return `${nth} seat costs ${chips(cost)} won · you have ${chips(have)}`;
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
  return `${seats} · next ${chips(slots.nextAt)} won`;
}
