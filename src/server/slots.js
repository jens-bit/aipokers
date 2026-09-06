// src/server/slots.js — SLOTS-1
//
// How many agents you may have, and what the next one costs.
//
// AGENTS-2 capped a roster at four and handed all four out on day one. That
// cap is a design constraint — the game is about knowing a handful of
// characters well enough to have opinions about them — but handing them all
// out at once makes the second agent a menu item rather than a thing that
// happened. So the four are still the ceiling, and now only the first is free:
//
//   1st   free            you always have somebody
//   2nd   10,000 earned
//   3rd   50,000 earned
//   4th   250,000 earned
//
// THREE RULES, and every one of them is about what "earned" means.
//
//   1. EARNED IS WON, NEVER GIVEN. It is the sum of POSITIVE session nets
//      across the owner's agents — money his characters took off other people
//      at a felt. A deposit is not earnings, a top-up is not earnings, and the
//      float he was seeded with is not earnings. That is the whole point: a
//      slot is a thing an agent won for you, so it cannot be bought, and there
//      is no path from a wallet balance to a roster size.
//   2. IT ONLY EVER GOES UP. A losing session does not take a slot back. The
//      counter is a lifetime total, not a balance — an owner who unlocked the
//      third slot and then lost it all still has three agents, because he did
//      once win that money and the record of it is not a debt.
//   3. THE HOME GAME PAYS NOTHING. Nothing at the kitchen table moves a career
//      number (see `home` in table.js), so nothing at the kitchen table
//      unlocks a slot either. That falls out of where the counter is written —
//      the casino's session-end path — rather than being a special case here.
//
// This module is pure. It knows about no profile, no wallet record and no
// request; agentProfiles hands it two numbers and renders what comes back.

// The ladder, in slot order. Index 0 is the FIRST slot, and it is free.
export const SLOT_PRICES = Object.freeze([0, 10_000, 50_000, 250_000]);

// The ceiling. Same four as AGENTS-2's AGENT_CAP — slots.test.js pins the two
// together so a change to either has to be a change to both, deliberately.
export const SLOT_CAP = SLOT_PRICES.length;

const chips = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0);

/**
 * The price of one slot, by its 1-based number. Zero for the first, and zero
 * for anything past the cap — a slot that does not exist has no price, and
 * saying "Infinity" here would only ever reach a screen.
 */
export function priceOfSlot(index) {
  const n = Math.floor(Number(index));
  if (!Number.isFinite(n) || n < 1 || n > SLOT_CAP) return 0;
  return SLOT_PRICES[n - 1];
}

/** How many slots this much earned money has opened. Never fewer than one. */
export function unlockedSlots(earned) {
  const e = chips(earned);
  let n = 1;
  for (let i = 1; i < SLOT_PRICES.length; i++) {
    if (e >= SLOT_PRICES[i]) n = i + 1;
    else break;
  }
  return n;
}

/**
 * What GET /api/slots answers.
 *
 * `next` is the slot he would take if he made an agent right now — its number,
 * its price, what he has earned towards it, and whether that is enough. It is
 * null at the cap, because there is no next one and a card that renders a
 * price for a slot nobody can ever have is a card that promises a fifth agent.
 */
export function slotsProjection({ used = 0, earned = 0 } = {}) {
  const taken = chips(used);
  const e = chips(earned);
  const index = taken + 1;
  return {
    used: taken,
    cap: SLOT_CAP,
    next: index > SLOT_CAP ? null : {
      index,
      price: priceOfSlot(index),
      earned: e,
      unlocked: e >= priceOfSlot(index),
    },
  };
}

/**
 * Why he may not make another agent, or null when he may.
 *
 * Two refusals, deliberately distinct and both 409:
 *   agentCap    the roster is full. Retiring one is the only way past it.
 *   slotLocked  the slot exists but has not been earned yet. Winning is.
 *
 * The body is exactly what the route returns, so a route cannot dress one of
 * these up differently from the other by accident.
 */
export function slotBlocker({ used = 0, earned = 0 } = {}) {
  const taken = chips(used);
  if (taken >= SLOT_CAP) return { error: 'agentCap', cap: SLOT_CAP };
  if (taken >= unlockedSlots(earned)) {
    return { error: 'slotLocked', price: priceOfSlot(taken + 1), earned: chips(earned) };
  }
  return null;
}
