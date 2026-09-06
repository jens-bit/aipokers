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
//      buys an edge; the whole ladder of prices is small on purpose.
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

// The two items, their stock price, and what one of them does to his head.
// Prices are the brief's: a beer is twice a snack, and both are small enough
// that stocking the fridge is never a decision anybody agonises over.
export const ITEMS = Object.freeze({
  beer:  Object.freeze({ id: 'beer',  label: 'a beer',  price: 200, heat: -15, session: 'drinking' }),
  snack: Object.freeze({ id: 'snack', label: 'a snack', price: 100, heat: -8,  session: null }),
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
