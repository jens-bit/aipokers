// src/agent/wants.js — RELATE-1d
//
// What he wants. One line, at most one pending, raised when the night has been
// rough enough to ask.
//
//   "Can I have a beer. It's been rough."
//
// The design (design-refs/mood-snack.jsx, spec §7): items touch STATE, never
// SKILL. One item, one effect — soothe one mood step, sharing the pep-talk
// cooldown — and one button. The moment reads as feeding a pet, not buying a
// powerup, so there is no store, no price list and no currency iconography
// anywhere near it.
//
// The no-guilt guardrail applies here more than anywhere: he ASKS, once, and
// then drops it. He does not ask again, he does not sulk about being ignored,
// and "no" is a complete answer that costs him nothing but the line in his
// ledger. A want that nags is a guilt mechanic wearing a biscuit costume.

// The one item. §7.1: bought from the WALLET, never from a pocket — a pocket
// that can buy things is a purchase path into the character system.
export const ITEMS = Object.freeze({
  snack: { id: 'snack', label: 'a snack', priceChips: 200, effect: 'soothe' },
  beer:  { id: 'beer',  label: 'a beer',  priceChips: 200, effect: 'soothe' },
});

export const DEFAULT_ITEM = 'beer';

// ── When he asks ─────────────────────────────────────────────────────────────
//
// The trigger table. Heat AND a losing run — heat alone is one bad beat, and a
// run alone at low heat is a man having a quiet night. Both together is the
// night where a drink is the obvious thing to say.

export const WANT_MIN_HEAT = 55;          // frustrated or worse
export const WANT_MIN_LOSING_RUN = 2;     // not one hand
export const WANT_COOLDOWN_HANDS = 40;    // he asks rarely, and drops it

export const WANT_TRIGGERS = Object.freeze([
  { id: 'rough_run',  minHeat: 55, minRun: 2, item: 'beer',  line: "Can I have a beer. It's been rough." },
  { id: 'tilting',    minHeat: 70, minRun: 2, item: 'beer',  line: 'I could do with a drink before the next one.' },
  { id: 'long_grind', minHeat: 55, minRun: 4, item: 'snack', line: "Something to eat wouldn't hurt. Long night." },
]);

/**
 * Should he raise a want right now? Returns the trigger, or null.
 *
 * Deliberately takes plain numbers rather than the agent: nothing here reads a
 * clock or a record, so no code path can turn "he has been left alone" into a
 * want. The caller supplies heat and the losing run from the hand that just
 * finished, which is the only thing that can produce one.
 */
export function wantTrigger({ heat = 0, losingRun = 0, handsPlayed = 0, lastWantAtHand = null } = {}) {
  const h = Number(heat) || 0;
  const run = Number(losingRun) || 0;
  const hands = Number(handsPlayed) || 0;

  if (Number.isFinite(lastWantAtHand) && hands - lastWantAtHand < WANT_COOLDOWN_HANDS) return null;
  if (h < WANT_MIN_HEAT || run < WANT_MIN_LOSING_RUN) return null;

  // Most specific first: the longest grind and the hottest head win over the
  // generic rough night.
  const ordered = [...WANT_TRIGGERS].sort((a, b) => (b.minRun - a.minRun) || (b.minHeat - a.minHeat));
  return ordered.find((t) => h >= t.minHeat && run >= t.minRun) ?? null;
}

/** The moment he raises. One pending at a time — the caller enforces that. */
export function buildWant(trigger, { moodState = 'frustrated' } = {}) {
  if (!trigger) return null;
  return {
    kind: 'want',
    item: trigger.item,
    trigger: trigger.id,
    text: trigger.line,
    mood: moodState,
    at: Date.now(),
    answered: null,        // 'given' | 'ignored'
  };
}

export function isItem(id) {
  return Object.prototype.hasOwnProperty.call(ITEMS, id);
}

export function priceOf(itemId) {
  return ITEMS[itemId]?.priceChips ?? 0;
}
