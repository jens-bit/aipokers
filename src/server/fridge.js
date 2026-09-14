// src/server/fridge.js — FRIDGE-1
//
// The fridge in the flat.
//
// RELATE-1d gave him one thing to ask for and answered it by buying a beer on
// the spot, out of the wallet, at the moment he asked. That made the ask a
// purchase prompt: every "get me a beer" was a checkout, and the honest reading
// of a checkout that appears when your character is upset is not a good one.
//
// So the item becomes FURNITURE, exactly as the design says it (design-refs/
// mood-home2.jsx, "2 · THE FRIDGE"): you stock the fridge when you feel like
// it, out of the wallet, and he fetches his own beer out of it later. The two
// moments come apart — the spend is yours, on your own time, and the drink is
// his, when he wants one.
//
// FOUR RULES the shape comes from.
//
//   1. THE FRIDGE IS THE OWNER'S, NOT THE AGENT'S. It hangs off the wallet
//      record, one per owner, and the whole household drinks out of it. A
//      per-agent fridge would be four fridges in one flat, which is not a
//      thing anybody has, and it would make stocking a chore you do four
//      times.
//   2. ITEMS TOUCH STATE, NEVER SKILL — with the beer's one honest exception,
//      which is that a drink makes him play WORSE (§ below). Nothing in here
//      buys an edge; the whole ladder of prices is small on purpose. LIFE-1
//      added the second STATE an item can touch: the stamina reserve. Still
//      not a skill, and still not an edge — a fed agent plays exactly as well
//      as a hungry one, he simply stays up longer.
//   3. AN EMPTY FRIDGE IS NOT A PUNISHMENT. "he will simply say so" is the
//      design's own line. The want does not vanish and it does not nag: it
//      changes what he says to "we're out of beer", and pressing yes opens the
//      fridge instead of failing.
//   4. NOTHING HERE READS A CLOCK OR A RECORD. Counts in, counts out. The
//      module is pure and everything it needs arrives as an argument, so all
//      of it is testable with two object literals — the same law rooms.js and
//      home.js are written to.
//
// § THE BEER'S SECOND HALF. A beer cools him now (heat −15) and costs him
// something later: for his NEXT session he plays with DISCIPLINE −5 and bluffs
// 10 points more often. That is not a nerf bolted onto a treat, it is the
// treat being honest — a man who has had a drink is looser and less careful,
// and if giving him one were pure upside the answer to every want would be yes
// and there would be nothing to decide. The effect is EFFECTIVE, never stored:
// the agent's own DISCIPLINE is untouched, the seat carries `drinking: true`
// for that one session so the client can draw the bottle, and it is gone the
// next time he sits down.

// LIFE-1 follow-up 3 · WHAT A SNACK IS FOR.
//
// design-refs/mood-snack.jsx draws the snack and states the scope law this
// file already quotes: "items touch STATE, never SKILL. One snack, one
// effect." The board's parenthetical names that one effect as a mood step,
// because when it was drawn there was no other STATE for an item to touch.
// There is now — the stamina reserve (src/agent/stamina.js) — and feeding a
// hungry man is what food is actually for.
//
// So a snack puts SNACK_STAMINA back. It keeps its small heat effect, and that
// is a deliberate reading of the law rather than a second effect smuggled in:
// the law's target is an item that becomes a grab-bag of buffs, and eating is
// ONE act whose consequences are that he is less hungry and a little calmer.
// Neither number touches a skill. Dropping the cooling would also have broken
// wants.js's `long_grind`, which is a HEAT-triggered ask ("Something to eat
// wouldn't hurt. Long night.") answered with a snack.
//
// A quarter of the reserve: enough to be worth doing, not enough to replace
// sleeping. A worn agent cannot be fed awake by one snack — the hysteresis in
// stamina.js wants him back at SETTLED_AT before he gets up — which is the
// right shape for a Tamagotchi. Three of them will do it, and that is a real
// choice about stock rather than a free button.
export const SNACK_STAMINA = 25;

// The two items, their stock price, and what each of them does to him.
// Prices are the brief's: a beer is twice a snack, and both are small enough
// that stocking the fridge is never a decision anybody agonises over.
export const ITEMS = Object.freeze({
  beer:  Object.freeze({ id: 'beer',  label: 'a beer',  price: 200, heat: -15, stamina: 0, session: 'drinking' }),
  snack: Object.freeze({ id: 'snack', label: 'a snack', price: 100, heat: -8,  stamina: SNACK_STAMINA, session: null }),
});

export const ITEM_IDS = Object.freeze(Object.keys(ITEMS));

// The most of one thing that may be bought in one press. The design's button
// says BUY 6; this is the ceiling on what the route will honour, so a typo (or
// a client bug) cannot empty a wallet in one request.
export const MAX_STOCK_PER_BUY = 24;

// § the beer's second half, in numbers. Applied at the seat, never stored.
export const DRINK_DISCIPLINE_PENALTY = 5;
export const DRINK_BLUFF_BONUS = 10;

// What he says when there is none left. Not an error, not a nag — a sentence.
const OUT_LINES = Object.freeze({
  beer:  "we're out of beer",
  snack: "we're out of snacks",
});

// LIFE-1 follow-up 3: "is he upset" has one definition and it lives in
// mood.js. Imported rather than restated — a second copy of that rule is a
// second chance for the fridge and the thread to disagree about one man.
import { isSoothable } from '../agent/mood.js';

const count = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0);

export function isItem(id) {
  return Object.prototype.hasOwnProperty.call(ITEMS, id);
}

export function priceOf(itemId) {
  return ITEMS[itemId]?.price ?? 0;
}

export function heatEffectOf(itemId) {
  return ITEMS[itemId]?.heat ?? 0;
}

export function staminaEffectOf(itemId) {
  return ITEMS[itemId]?.stamina ?? 0;
}

// ── "He's fine. Save it." — asked over ALL of an item's effects ─────────────
//
// THE BUG THIS REPLACES, and it is the reason the fridge appeared to do
// nothing. giveItemTo refused any item to an agent who was not SOOTHABLE
// (frustrated, tilted or sulking), and applyItem floors heat at the neutral
// midpoint — which is exactly where a resting agent sits by default. So for
// the overwhelmingly common state, neutral at heat 30, EVERY item was refused
// with "He's fine. Save it.", nothing left the fridge and nothing changed.
// Verified rather than assumed: a calm agent was refused both items, and a
// spent-but-calm agent was refused a snack — the precise case the snack now
// exists for.
//
// The gate was written when cooling was the only thing an item could do. It
// asks over every effect now, per item, and says WHICH of them it could not
// help with, so the refusal is a sentence about this item and this man rather
// than one string for both.
//
// The beer is still refused to a calm agent, and that is correct rather than
// an oversight: its only benefit is the cooling, and its other half is a
// PENALTY he carries into his next session. Handing it to a man who is fine is
// all cost. "He's fine. Save it." is the right answer and now it is the right
// answer for a stated reason.
/**
 * What this item could actually do for him right now. Pure: facts in, an
 * answer out — the module's fourth rule.
 *
 * COOLING IS JUDGED ON HIS MOOD STATE, not on a heat number over a floor, and
 * that is deliberate rather than convenient. "He's fine" is a thing the mood
 * system already has an opinion about (isSoothable: frustrated, tilted or
 * sulking), the board's refusal copy is written about a state, and an owner
 * whose agent has just been talked down from tilted to neutral should be told
 * to save the second beer rather than sold one for the five points of heat
 * still technically above the floor. A first cut of this used the floor and
 * verify-personality-layer.js caught the drift.
 *
 * @param mood        his mood record, { state, heat }
 * @param staminaLeft his reserve, 0-100 (100 when a caller has none to give)
 */
export function itemHelp(itemId, { mood = null, staminaLeft = 100 } = {}) {
  if (!isItem(itemId)) return { any: false, cools: false, feeds: false, reason: 'unknown item' };
  const left = Number.isFinite(Number(staminaLeft)) ? Number(staminaLeft) : 100;
  const cools = heatEffectOf(itemId) < 0 && isSoothable(mood);
  const feeds = staminaEffectOf(itemId) > 0 && left < 100;
  const any = cools || feeds;
  return {
    any, cools, feeds,
    reason: any ? 'ok' : (staminaEffectOf(itemId) > 0 ? 'rested and level' : 'level'),
  };
}

/** What he says when that shelf is empty. */
export function outOfStockLine(itemId) {
  return OUT_LINES[itemId] ?? "we're out";
}

export function emptyFridge() {
  return { beer: 0, snack: 0 };
}

/**
 * The fridge on a wallet record, created if this owner has never had one.
 * Mutates, like ensurePocket does, and returns it.
 */
export function ensureFridge(wallet) {
  if (!wallet) return emptyFridge();
  const current = wallet.fridge && typeof wallet.fridge === 'object' ? wallet.fridge : {};
  wallet.fridge = { beer: count(current.beer), snack: count(current.snack) };
  return wallet.fridge;
}

/** How many of that item are in there. */
export function countOf(wallet, itemId) {
  if (!isItem(itemId)) return 0;
  return count(wallet?.fridge?.[itemId]);
}

export function hasStock(wallet, itemId) {
  return countOf(wallet, itemId) > 0;
}

/**
 * Take one out. Returns true when there was one to take — the caller decides
 * what to do about false, and the answer is never an error page (rule 3).
 */
export function takeOne(wallet, itemId) {
  if (!wallet || !isItem(itemId)) return false;
  const fridge = ensureFridge(wallet);
  if (fridge[itemId] <= 0) return false;
  fridge[itemId] -= 1;
  return true;
}

/**
 * Stock up. Debits the wallet and puts the items on the shelf, or explains
 * why it did neither. All or nothing: a wallet that covers four of six buys
 * none, because a button that says BUY 6 and silently buys four is worse than
 * one that says you cannot afford six.
 *
 * Returns { ok, spent, qty, fridge } or { ok: false, error, ... }.
 */
export function stock(wallet, { item, qty = 1 } = {}) {
  if (!wallet) return { ok: false, error: 'no wallet' };
  if (!isItem(item)) {
    return { ok: false, error: `item must be one of ${ITEM_IDS.join(', ')}` };
  }
  const want = count(qty);
  if (want < 1) return { ok: false, error: 'qty must be at least 1' };
  if (want > MAX_STOCK_PER_BUY) {
    return { ok: false, error: `qty must be ${MAX_STOCK_PER_BUY} or fewer`, max: MAX_STOCK_PER_BUY };
  }
  const cost = priceOf(item) * want;
  if (count(wallet.balance) < cost) {
    return { ok: false, error: 'wallet does not cover that', cost, available: count(wallet.balance) };
  }
  const fridge = ensureFridge(wallet);
  wallet.balance = count(wallet.balance) - cost;
  fridge[item] += want;
  return { ok: true, spent: cost, qty: want, item, fridge: { ...fridge } };
}

/**
 * What the fridge sheet draws: a count and a price per shelf, in a stable
 * order, plus the flat counts so a caller does not have to walk the list to
 * answer "is there a beer".
 */
export function fridgeProjection(wallet) {
  const fridge = ensureFridge(wallet);
  return {
    items: ITEM_IDS.map((id) => ({
      id,
      label: ITEMS[id].label,
      count: fridge[id],
      price: ITEMS[id].price,
    })),
    beer: fridge.beer,
    snack: fridge.snack,
  };
}
