// src/server/restFloor.js — AGENT-5 jobs A + B
//
// AN AGENT NEVER STARTS A SESSION HE CANNOT FINISH, AND EVERY REFUSAL NAMES
// THE REMEDY.
//
// ── The bug this exists for ─────────────────────────────────────────────────
//
// Jens's household was drained to empty overnight and then every agent played
// exactly ONE hand and came home with a YOU LOST screen. Nothing was broken;
// three correct numbers were meeting:
//
//   · stamina.js staminaStage has HYSTERESIS. Once 'worn' he stays 'worn'
//     until the reserve is back to SETTLED_AT (67) — not until it clears
//     WORN_AT (34). That is deliberate and it is what stops a sleeping agent
//     flickering in and out of the kitchen game.
//   · table.js's session stop rule marks a CASINO seat leaving the moment the
//     combined stage reads 'worn' after any hand.
//   · so a man deployed at reserve 40 is worn on hand one, and the stop rule
//     stands him straight back up. He paid a buy-in for one hand.
//
// AGENT-4 repaired the two things that were actually broken — food is accepted
// now, and rest runs — but neither of them stops him SITTING DOWN in the first
// place, and nothing told the owner what the number was.
//
// ── The floor, and its arithmetic ───────────────────────────────────────────
//
// The bar is SETTLED_AT, and it is not a taste call: it is the ONLY number in
// the system at which the sticky stage lets go. Below it there are exactly two
// cases and both of them are bad:
//
//   · his stored stage is 'worn' → hysteresis keeps him worn at ANY reserve
//     under 67, so the stop rule pulls him after hand one. Always.
//   · his stored stage is not 'worn' → he plays until the reserve crosses 34
//     and is then pulled mid-session, which is the same refusal arriving late
//     and with his buy-in already spent.
//
// And `reserve >= SETTLED_AT` is precisely `stage === 'fresh'`, for a worn
// record and a rested one alike. So the rule states in one line: HE SITS DOWN
// WHEN HE IS RESTED, against the same threshold the hysteresis already uses to
// let him get up. One number, two directions.
//
// CASINO ONLY. The stop rule above is a casino rule — at home nobody stands up
// from his own kitchen table, homeGame's `eligible` drops a worn agent on the
// next sync instead. A 67 floor at home would empty the flat of everyone who
// was merely 'settled', which is most of a household most of the time.
//
// ── What the refusal carries ────────────────────────────────────────────────
//
// The remedy, the item, the number, and the ACTION — through LIFE-2's existing
// `.want.action` / `.want.actionLabel` pair, so a client already drawing a want
// draws this with no new vocabulary. A refusal that cannot be acted on is the
// thing that made this a bug report instead of a mechanic.
//
// PURE. Everything arrives as a number. No clock, no record, no wallet — the
// callers in agentProfiles.js hold those.

import { SETTLED_AT, RECOVER_PER_HOUR } from '../agent/stamina.js';
import { SNACK_STAMINA } from './fridge.js';
import { natureWantLine, wantAction, wantActionLabel } from '../agent/wantVoice.js';

/** The reserve a casino seat costs at the door. See the header for why. */
export const DEPLOY_FLOOR = SETTLED_AT;

// WHEN SLEEPING IS THE BETTER ANSWER.
//
// Both remedies work from anywhere; what differs is what they cost the owner.
// A snack is money and it is instant. Sleep is free and it is time. So the cut
// is on the TIME: if he can be up again inside a couple of hours, asking
// somebody to buy him food to save that wait is a shop that opened because the
// product wanted one. Past it, "come back in four hours" is the rest of the
// evening, and food is the real answer.
//
// Two hours at RECOVER_PER_HOUR = 22 is 44 points, so the cut lands at a
// reserve of 23. From empty (the case in the bug report) the answer is food,
// and it is three snacks — which is the number nothing in the product said out
// loud before this file.
export const REST_WINS_HOURS = 2;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** How far below the floor he is, in reserve points. 0 when he is over it. */
export function restDeficit(left) {
  return Math.max(0, Math.ceil(DEPLOY_FLOOR - num(left)));
}

/** Snacks to clear a deficit. From empty: ceil(67 / 25) = 3. */
export function snacksFor(deficit) {
  return Math.max(0, Math.ceil(Math.max(0, num(deficit)) / SNACK_STAMINA));
}

/** Hours out of a seat to clear a deficit. From empty: 67 / 22 = 3.05. */
export function hoursFor(deficit) {
  return Math.max(0, num(deficit)) / RECOVER_PER_HOUR;
}

// The numbers, in words, because he is speaking them. Small integers only —
// past six the count stops being a quantity a person says and becomes a figure
// a machine reports, and nothing here ever gets there.
const COUNTS = Object.freeze(['no', 'one', 'two', 'three', 'four', 'five', 'six']);

export function countWord(n) {
  const i = Math.max(0, Math.round(num(n)));
  return COUNTS[i] ?? String(i);
}

/** "one snack" / "three snacks". */
export function snackPhrase(n) {
  const i = Math.max(1, Math.round(num(n)));
  return countWord(i) + ' snack' + (i === 1 ? '' : 's');
}

/**
 * The wait, as somebody would say it rather than as a float.
 *
 * The bands are the ones a person actually uses. "About 3.05 hours" is a
 * measurement; the reserve is not measured that finely and saying it that way
 * would be the stamina bar's old lie in a sentence.
 */
export function hoursPhrase(h) {
  const v = num(h);
  if (v <= 0) return 'no time at all';
  if (v < 0.75) return 'half an hour';
  if (v < 1.5) return 'an hour';
  if (v < 2.5) return 'a couple of hours';
  return 'about ' + countWord(Math.round(v)) + ' hours';
}

/**
 * The arithmetic, with no voice on it yet.
 *
 * `ok` true means he is over the floor and nothing below it is meaningful.
 * Kept separate from the sentence so a test can assert on the numbers without
 * reading English, and so the gate and the line cannot disagree.
 */
export function restPlan({ left = 100, snacks = 0 } = {}) {
  const deficit = restDeficit(left);
  const stock = Math.max(0, Math.floor(num(snacks)));
  if (deficit <= 0) {
    return { ok: true, left: num(left), deficit: 0, snacksNeeded: 0, hours: 0, kind: null, stock };
  }
  const hours = hoursFor(deficit);
  const needed = snacksFor(deficit);
  // WHICH REMEDY HE ASKS FOR. Two questions, in this order:
  //
  //   1. IS IT ALREADY IN THE FRIDGE? Then it is food, whatever the clock
  //      says. The owner has already paid for those snacks; telling him to
  //      wait an hour instead of pressing the button on the thing he bought is
  //      the product arguing with him. (verify-rest-floor.js found this: after
  //      two of three snacks he was told to go and have a lie down, with the
  //      third one sitting on the shelf.)
  //   2. OTHERWISE THE CLOCK DECIDES, per REST_WINS_HOURS above — a short wait
  //      is sleep, a long one is worth going shopping for.
  const kind = (stock >= needed || hours > REST_WINS_HOURS) ? 'food' : 'rest';
  return {
    ok: false,
    left: num(left),
    deficit,
    snacksNeeded: needed,
    hours,
    kind,
    // Only meaningful on the food branch, and only as "can the shelf cover it".
    stock,
  };
}

/**
 * The refusal, in his own voice, with the remedy and the action on it.
 *
 * Returns null when he is fit to sit down — the caller's "no objection".
 *
 * The SENTENCE is NATURE_WANT_LINES', so a Rock and a Showman turn the same
 * arithmetic into different men. What is added to it here is the one thing a
 * lookup table cannot hold, which is the NUMBER: "three snacks", "a couple of
 * hours". An agent with no nature yet keeps the arithmetic and loses only the
 * voice, exactly as wantView does for an unvoiced want.
 */
export function restRefusal({ left = 100, snacks = 0, nature = null, displayName = null } = {}) {
  const plan = restPlan({ left, snacks });
  if (plan.ok) return null;

  const kind = plan.kind;
  // AGENT-5 job A — THE REST LINE AT THE DOOR IS NOT THE REST LINE IN THE SEAT.
  //
  // `rest` in NATURE_WANT_LINES is a man ASKING TO COME OUT: "Get me off this
  // felt", "Sit me down". Said in the flat by somebody who is not at a table it
  // is a lie on screen, which is the exact class of bug job I is about. So the
  // refusal speaks through `turn_in`, added beside it — same eight voices, same
  // talk:eval collision audit, and a man who is standing in his own kitchen
  // saying he is going to bed.
  const voiced = natureWantLine(nature, kind === 'rest' ? 'turn_in' : kind);
  const out = kind === 'food' && plan.stock < plan.snacksNeeded;
  const amount = kind === 'food' ? snackPhrase(plan.snacksNeeded) : hoursPhrase(plan.hours);

  // FRIDGE-1 rule 3 — an empty shelf is not a punishment, it is a sentence. He
  // still asks for the thing; what changes is that the ask names what to buy.
  const tail = out
    ? "There's nothing in — " + amount + ' would do it.'
    : amount[0].toUpperCase() + amount.slice(1) + ' should do it.';

  return {
    error: 'agentSpent',
    // The machine word, so a client can branch without parsing English.
    needs: out ? 'stock' : null,
    kind,
    // LIFE-2's two fields, reused rather than reinvented: 'feed' + "Open the
    // fridge", or 'rest' + "Sit him out". A client that can already render a
    // want renders this.
    action: wantAction(kind),
    actionLabel: wantActionLabel(kind),
    item: kind === 'food' ? 'snack' : null,
    snacksNeeded: kind === 'food' ? plan.snacksNeeded : null,
    hours: kind === 'rest' ? Math.round(plan.hours * 10) / 10 : null,
    stock: kind === 'food' ? plan.stock : null,
    outOfStock: out || undefined,
    stamina: { left: Math.round(plan.left * 10) / 10, floor: DEPLOY_FLOOR, deficit: plan.deficit },
    message: [voiced, tail].filter(Boolean).join(' '),
    who: displayName || null,
  };
}
