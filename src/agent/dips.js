// src/agent/dips.js — SERVER-5 job 1
//
// The body pushes back.
//
// FRIDGE-1 § the beer's second half established the shape this file
// generalises: a STATE he arrives in can make him play worse for one session,
// and the cost is EFFECTIVE, never stored. A beer is the version of that you
// hand him yourself. These three are the versions the world hands him.
//
//   worn    he sat down still cooked from the last one
//   hungry  nobody has fed him in a day, and the last time he asked, you said
//           no
//   tilted  he walked in at heat 70 or more
//
// Each of them takes points off DISCIPLINE and FOCUS — the same two fatigue
// erodes, because they are the two that describe how carefully he executes
// rather than what he is trying to do — for THAT SESSION ONLY. His stored
// attributes are not touched by anything in this file; there is no code path
// here that writes to a record, because there is no record here to write to.
//
// FIVE RULES the shape comes from.
//
//   1. NOTHING IS STORED AND NOTHING IS ROLLED. Plain numbers in, a list of
//      dips out. The same state produces the same dip twice, so a session that
//      is described to the owner cannot be described differently a second time
//      — the same law home.js's routine ladder is written to.
//   2. THE DIP IS FROZEN AT SIT-DOWN. The caller computes it once when the
//      seat is taken and holds it for the session. That is what makes it a
//      thing that happened to him tonight rather than a live meter the felt
//      re-reads between hands, and it is why cooling him down mid-session does
//      not quietly repair the night he is already having.
//   3. FIVE TO TEN, TOTAL. Not five to ten PER REASON. A man who is worn AND
//      hungry AND steaming is having a bad night, not three bad nights
//      stacked: the deepest reason is served first and the rest fill what is
//      left under the ceiling. Without the cap, three states would be −30 on
//      two attributes, which is wider than fatigue's whole range and would
//      turn a state into a sentence.
//   4. EVERY DIP NAMES ITS REASON. `{ attr, delta, why }`, and `why` is a word
//      from a closed list. A number that appears on a card with no cause
//      attached is exactly the "adjective" attributes.js's law 5 bans.
//   5. DEEPER STATE, DEEPER DIP, LINEARLY. The bottom of each state is −10 and
//      its threshold is −5, so crossing a line costs the least it can and the
//      number means something all the way down.

import { ATTR_KEYS } from './attributes.js';

// The two attributes a state can take points off. Same pair as fatigue's, and
// for the same reason: these are the two that say how well he executes the
// line he was given, never what the line is.
export const DIP_ATTRS = Object.freeze(['DISCIPLINE', 'FOCUS']);

// The band. Crossing a threshold costs DIP_MIN; the bottom of a state costs
// DIP_MAX; and DIP_MAX is also the ceiling on everything added together.
export const DIP_MIN = 5;
export const DIP_MAX = 10;

// The closed list of reasons, in the order that breaks a tie between two
// states of identical depth. It is the order a person would say them in.
export const DIP_REASONS = Object.freeze(['worn', 'hungry', 'tilted']);

// Hunger's two marks: a day without a snack is where it starts, three days is
// where it is as bad as it gets. The clock runs from his last snack, or from
// the refusal when he has never had one.
export const HUNGER_MS = 24 * 60 * 60_000;
export const HUNGER_DEEP_MS = 72 * 60 * 60_000;

// The heat at which he is playing angry. The same number wants.js raises the
// beer ask at, deliberately: the state he asks about is the state that costs
// him something.
export const TILT_HEAT = 70;

// What he opens the thread with while a dipped session is running. One line
// per reason, template, no model call — for the reason ASK_LINES has none: a
// generated line can fail into a form letter, and a form letter is the one
// thing a character must never sound like.
export const DIP_LINES = Object.freeze({
  worn:   'Playing tired tonight.',
  hungry: 'Playing hungry tonight.',
  tilted: 'Playing angry tonight.',
});

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
// null is NOT a number here, whatever `Number(null)` says. A missing timestamp
// that reads as epoch zero is the difference between "he has never been fed"
// and "he was last fed in 1970", and the second one is a permanent dip.
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** DIP_MIN at t=0, DIP_MAX at t=1. Whole points; the wire never carries a fraction. */
export function dipDepth(t) {
  return Math.round(DIP_MIN + clamp01(t) * (DIP_MAX - DIP_MIN));
}

/**
 * How long he has gone hungry, in ms, or null when he has not.
 *
 * BOTH halves are required, and the second one is the point: an agent nobody
 * has ever handed a snack to is not hungry, he is simply an agent. He is
 * hungry when he ASKED, was told no, and then a day went by. That keeps this
 * on the owner's side of the line — it is a consequence of an answer you gave,
 * never of an app you did not open.
 */
export function hungerMs({ lastSnackAt = null, snackRefusedAt = null, now = Date.now() } = {}) {
  const refused = num(snackRefusedAt);
  if (refused === null) return null;
  const fed = num(lastSnackAt);
  // Fed since the refusal: the no was overtaken by a yes and there is no hunger.
  if (fed !== null && fed >= refused) return null;
  const elapsed = now - (fed ?? refused);
  return elapsed >= HUNGER_MS ? elapsed : null;
}

/**
 * The states he is in, deepest first, before the ceiling is applied.
 *
 * @param fatigue        'fresh' | 'settled' | 'worn' — what he carried in
 * @param stamina        his STAMINA, 0-100; a low one makes worn cost more
 * @param heat           0-100
 * @param lastSnackAt    epoch ms, or null
 * @param snackRefusedAt epoch ms of the last snack ask you said no to, or null
 * @returns [{ why, delta }], delta a positive whole number of points
 */
export function dipCauses({
  fatigue = 'fresh',
  stamina = null,
  heat = 0,
  lastSnackAt = null,
  snackRefusedAt = null,
  now = Date.now(),
} = {}) {
  const causes = [];

  if (fatigue === 'worn') {
    // A man with no STAMINA in him is worse off worn than a Grinder is.
    // Unknown STAMINA reads as the middle of the scale rather than the bottom.
    const s = num(stamina);
    causes.push({ why: 'worn', delta: dipDepth(1 - clamp01((s === null ? 50 : s) / 100)) });
  }

  const hungry = hungerMs({ lastSnackAt, snackRefusedAt, now });
  if (hungry !== null) {
    causes.push({
      why: 'hungry',
      delta: dipDepth((hungry - HUNGER_MS) / (HUNGER_DEEP_MS - HUNGER_MS)),
    });
  }

  const h = num(heat) ?? 0;
  if (h >= TILT_HEAT) {
    causes.push({ why: 'tilted', delta: dipDepth((h - TILT_HEAT) / (100 - TILT_HEAT)) });
  }

  return causes.sort((a, b) =>
    (b.delta - a.delta) || (DIP_REASONS.indexOf(a.why) - DIP_REASONS.indexOf(b.why)));
}

/**
 * The session's dips: one entry per attribute per surviving reason.
 *
 * Rule 3 in code — the causes are spent against a DIP_MAX budget in order, the
 * one that runs into the ceiling is truncated to what is left, and anything
 * after it is dropped rather than listed at zero. So the deltas the wire
 * carries always add up to exactly what was applied, per attribute, which is
 * the only way a client can honestly draw them.
 */
export function dipsFor(state = {}) {
  const dips = [];
  let budget = DIP_MAX;
  for (const cause of dipCauses(state)) {
    if (budget <= 0) break;
    const delta = Math.min(cause.delta, budget);
    budget -= delta;
    for (const attr of DIP_ATTRS) dips.push({ attr, delta: -delta, why: cause.why });
  }
  return dips;
}

/** What each attribute loses, as a positive number of points, keyed by attr. */
export function dipTotals(dips) {
  const totals = {};
  for (const dip of dips ?? []) {
    if (!ATTR_KEYS.includes(dip?.attr)) continue;
    totals[dip.attr] = (totals[dip.attr] ?? 0) + Math.abs(Number(dip.delta) || 0);
  }
  return totals;
}

/**
 * The six attributes with tonight's dips taken off. Pure, and applied on the
 * way OUT exactly where the drink's penalty is — nothing in here can reach a
 * stored record, which is what makes rule 1 provable rather than promised.
 */
export function applyDips(attrs, dips) {
  if (!attrs || !dips?.length) return attrs;
  const totals = dipTotals(dips);
  const out = { ...attrs };
  for (const [attr, lost] of Object.entries(totals)) {
    out[attr] = Math.max(0, (Number(out[attr]) || 0) - lost);
  }
  return out;
}

/** The reason he would give, or null. The deepest one — he says one thing. */
export function dipLine(dips) {
  const why = (dips ?? [])[0]?.why;
  return DIP_LINES[why] ?? null;
}

/** The reasons in play, deepest first, without the per-attribute repetition. */
export function dipReasons(dips) {
  const seen = [];
  for (const dip of dips ?? []) {
    if (dip?.why && !seen.includes(dip.why)) seen.push(dip.why);
  }
  return seen;
}
