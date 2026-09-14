// src/agent/stamina.js — LIFE-1 job 1
//
// The reserve. What playing actually costs him, and what resting gives back.
//
// WHY THIS FILE EXISTS. Before it, "stamina" was two different things and
// neither of them could make an agent sleep:
//
//   · the STAMINA ATTRIBUTE (attributes.js) is a permanent 0-100 rating that
//     only ever GROWS, one tick per long session. It is how much he has, never
//     how much is left.
//   · FATIGUE (effectiveAttrs) is a three-stage word derived from THIS SEAT'S
//     hand count against fatigueOnset(STAMINA) — 40 to 160 hands. It resets to
//     nothing the moment the session ends, and the kitchen table is capped at
//     HOME_MAX_HANDS = 40, so a household that only ever plays at home could
//     not reach 'worn' on its best day. That is the arithmetic behind "I have
//     never seen an agent sleep once": there was no path to it.
//
// This is the third thing, and it is the one a Tamagotchi needs: a RESERVE
// that persists across sessions, drains per hand wherever the hand was played,
// and refills while he is not in a seat. Fatigue stays exactly what it was —
// within-session execution erosion, untouched, so nothing about how he PLAYS
// changes here. The reserve decides how the day has left him.
//
// FOUR RULES the shape comes from.
//
//   1. PURE, AND THE CLOCK ARRIVES AS AN ARGUMENT. Every function takes `now`.
//      A reserve that reads its own clock cannot be tested and cannot be
//      replayed, and the same snapshot has to read the same twice.
//   2. STORED LAZILY, NOT TICKED. Nothing here needs a timer. The record keeps
//      { left, at } and recovery is computed from the elapsed time whenever
//      somebody asks. A scheduler that has to be running for an agent to get
//      tired is a scheduler that will be found not running.
//   3. THE STAGE VOCABULARY IS FATIGUE'S. 'fresh' | 'settled' | 'worn', the
//      same three words the wire, the felt pip and home.js's routine ladder
//      already speak. This file does not introduce a fourth state or a second
//      name for an old one — JOB 2's three dots are these three words.
//   4. HIS ATTRIBUTE DECIDES HIS RATE. A Grinder gets four times the hands out
//      of one reserve that a Professor does, through the same at() curve every
//      other attribute hook goes through. The reserve is the same size for
//      everybody; what differs is what a hand takes out of it.

import { at, attrsActive } from './attributes.js';

/** A full reserve. The only number on the record's scale. */
export const STAMINA_MAX = 100;

// The two thresholds, in the three-equal-thirds shape JOB 2's three dots draw:
// at or above SETTLED_AT he is fresh, at or above WORN_AT he is settled, below
// it he is worn. Whole numbers because the client prints them.
export const SETTLED_AT = 67;
export const WORN_AT = 34;

// What one hand costs an agent of neutral STAMINA, in reserve points. The
// endpoints are the attribute's: at STAMINA 0 a hand costs twice the neutral
// rate, at 100 it costs half of it. So the reserve is worth ~83 casino hands
// to the worst of them and ~333 to the best, which brackets fatigueOnset's own
// 40-to-160 band at a little under three sessions' worth either side.
export const HAND_COST = 0.6;
export const HAND_COST_LOW = 1.2;   // STAMINA 0
export const HAND_COST_HIGH = 0.3;  // STAMINA 100

// A hand at the kitchen table costs a THIRD of a hand in the casino, and the
// number comes from measurement rather than from taste (scripts/measure-stamina.js).
//
// The first cut said a half, on the reasoning that an evening in is lighter
// work than a rung at the casino. That reasoning is right and the number was
// still badly wrong, because it priced the two per HAND and the two deal at
// wildly different rates. The kitchen table deals HOME_MAX_HANDS = 40 hands
// every twelve minutes, for ever, whether or not anybody is watching — about
// 200 hands an hour and 4,800 a day. A casino session is a hundred-odd hands
// and then it is over. At a half, a household wore itself out in forty minutes
// and its agents were asleep for three quarters of their lives, which is not a
// companion, it is a coma.
//
// A third was chosen off the sweep in that script rather than argued for: it
// puts an agent asleep about a quarter of the time in a two-handed household
// and about two fifths in a four-handed one, in naps of an hour and a half,
// and it is the lowest setting at which an owner opening the app twice a day
// finds somebody asleep on most days rather than most weeks. A fifth was too
// little (8% asleep, one opening in six) and a half was far too much (three
// quarters of his life). The (c) table in the script is the only reason to
// believe any of these three numbers.
// Env-overridable like every other pace dial in this repo (HOME_PAUSE_MS,
// UNWATCHED_HAND_PAUSE_MS): it is the one number most likely to want turning
// on the VPS after a week of watching real households, and turning it should
// not need a deploy.
export const HOME_HAND_WEIGHT = Number(process.env.HOME_HAND_WEIGHT ?? 0.3);

// What an hour out of a seat gives back. 22 points takes a spent agent from
// empty to full in four and a half hours, and from the bottom of 'worn' back
// to rested — which is the nap the hysteresis above makes him take — in about
// an hour and a half. That is the number an owner actually experiences, and it
// is the one the measurement script reports as (b).
//
// It is also within sight of restedFatigue's own two hours per stage, which
// matters because both recoveries are visible on the same card and two clocks
// that visibly disagree read as a bug.
export const RECOVER_PER_HOUR = Number(process.env.STAMINA_RECOVER_PER_HOUR ?? 22);

const HOUR_MS = 3_600_000;

const clamp = (v) => (v < 0 ? 0 : v > STAMINA_MAX ? STAMINA_MAX : v);
// null is NOT zero here, whatever `Number(null)` says — dips.js's own note, and
// the same trap: a missing reserve that reads as 0 is an empty reserve, and an
// empty reserve is a sleeping agent. Every record in prod is missing one on the
// deploy that ships this file.
const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const STAGES = Object.freeze(['fresh', 'settled', 'worn']);

/**
 * The three-stage word for a reserve, with HYSTERESIS.
 *
 * A missing reserve reads as 'fresh', not as 'worn'. Every agent made before
 * this file existed has no reserve on his record, and the alternative answer
 * would put the whole roster to sleep on the deploy that shipped it.
 *
 * WHY `was` EXISTS, and it is not a refinement — without it the feature does
 * not work at all. homeGame.eligible drops a worn agent from the kitchen
 * table, so being worn is what STOPS the drain. A plain threshold therefore
 * produces a flicker rather than a sleep: he crosses WORN_AT, leaves the game,
 * recovers 0.1 of a point, is no longer worn, is dealt back in, plays one more
 * hand and is worn again — for ever, at whatever rate the tick runs. Nobody
 * would ever see him asleep, which is the exact symptom this whole tree is
 * about.
 *
 * So the trigger is asymmetric, the way a person's is: he goes to sleep when
 * he is spent, and he gets up when he is RESTED — not the instant he stops
 * being exhausted. Once worn he stays worn until the reserve is back to
 * SETTLED_AT, which is the same number that means 'fresh'.
 */
export function staminaStage(left, was = null) {
  const v = num(left);
  if (v === null) return 'fresh';
  if (was === 'worn') return v >= SETTLED_AT ? 'fresh' : 'worn';
  if (v >= SETTLED_AT) return 'fresh';
  if (v >= WORN_AT) return 'settled';
  return 'worn';
}

/** The stage his record last settled on, for the hysteresis above. */
export function storedStage(agent) {
  const was = agent?.stamina?.stage;
  return STAGES.includes(was) ? was : null;
}

/** What one hand costs him, in reserve points. Never negative, never zero. */
export function handCost(staminaAttr, { home = false } = {}) {
  const base = attrsActive(staminaAttr)
    ? at(staminaAttr, HAND_COST, HAND_COST_LOW, HAND_COST_HIGH)
    : HAND_COST;
  const cost = Math.max(0, base) * (home ? HOME_HAND_WEIGHT : 1);
  return cost;
}

/** The reserve as stored, defaulting a record that has never had one to full. */
export function storedStamina(agent) {
  const left = num(agent?.stamina?.left);
  return left === null ? STAMINA_MAX : clamp(left);
}

/**
 * The reserve RIGHT NOW: what was stored, plus whatever the time since has
 * given back. Pure — it never writes, so a projection can ask it as often as
 * it likes without the answer drifting.
 *
 * `resting` is the caller's answer to "is he out of a seat". A man in a chair
 * is not recovering, and crediting him for the hours he spent playing them is
 * how a reserve stops meaning anything.
 */
export function staminaNow(agent, { now = Date.now(), resting = true } = {}) {
  const left = storedStamina(agent);
  if (!resting) return left;
  const at_ = num(agent?.stamina?.at);
  if (at_ === null) return left;
  const hours = (now - at_) / HOUR_MS;
  if (!(hours > 0)) return left;
  return clamp(left + hours * RECOVER_PER_HOUR);
}

/** His stage right now, in one call — the form every caller actually wants. */
export function staminaStageNow(agent, opts = {}) {
  return staminaStage(staminaNow(agent, opts), storedStage(agent));
}

/**
 * Spend `hands` hands out of the reserve and write the result to the record.
 *
 * Recovery for the gap since the last write is applied FIRST, so an agent who
 * sat out four hours and then played ten hands is charged for the ten hands
 * against a rested reserve rather than against the one he stood up with.
 *
 * Returns the new reserve. Mutates `agent.stamina` and nothing else — no save,
 * no emit; the caller owns persistence, exactly as noteAgentFatigue does.
 */
export function spendStamina(agent, hands, {
  staminaAttr = null, home = false, now = Date.now(), seatedSince = null,
} = {}) {
  if (!agent) return STAMINA_MAX;
  const n = Math.max(0, num(hands) ?? 0);
  // THE REST HE HAD BEFORE HE SAT DOWN COUNTS. THE TIME HE SPENT PLAYING DOES
  // NOT. The first cut credited the whole gap since the last write as rest,
  // which is wrong in the case that matters most: the kitchen table charges
  // once per hand, so an agent playing for two hours was being paid two hours
  // of recovery for the two hours he spent at the table. At the rates below
  // that very nearly cancels the drain, and "very nearly" is not a mechanic —
  // it is a coin toss about whether an agent can get tired at all.
  //
  // `seatedSince` is the moment he took the seat (table.js has it already, as
  // seatSeatedAt). Recovery is credited up to that instant and no further.
  // Without it the old behaviour stands, which is right for a caller that is
  // not a table.
  const sat = num(seatedSince);
  const until = sat === null ? now : Math.min(now, sat);
  const before = staminaNow(agent, { now: until, resting: true });
  // THE STAGE HE HAD WHEN HE SAT DOWN, not the one his record last wrote.
  //
  // This line is the whole difference between a hysteresis that works and one
  // that depends on when a write happens to land. The stored stage is only
  // updated BY a write; a man who slept himself back over SETTLED_AT between
  // two charges has no write of his own in that window, so evaluating the new
  // stage against the stale 'worn' pins him asleep again the instant he is
  // charged for the first hand of the game he has just woken up for — for
  // ever, at whatever rate the household deals. Recovering the stage from the
  // RECOVERED reserve first makes the answer independent of write timing,
  // which is what a state machine has to be.
  const was = staminaStage(before, storedStage(agent));
  const left = clamp(before - n * handCost(staminaAttr, { home }));
  agent.stamina = {
    left: Math.round(left * 10) / 10,
    at: now,
    stage: staminaStage(left, was),
  };
  return agent.stamina.left;
}

/**
 * Bank the recovery earned so far without spending anything.
 *
 * Used when a projection wants the record to stop lying — `staminaNow` already
 * answers correctly from a stale pair, but a record that is never rewritten
 * keeps a months-old `at` and makes the stored number unreadable to anything
 * that does not know to add the hours back.
 */
export function restStamina(agent, { now = Date.now() } = {}) {
  if (!agent) return STAMINA_MAX;
  const left = staminaNow(agent, { now, resting: true });
  agent.stamina = {
    left: Math.round(left * 10) / 10,
    at: now,
    stage: staminaStage(left, storedStage(agent)),
  };
  return agent.stamina.left;
}

/**
 * The worse of two fatigue stages.
 *
 * The stored stage an owner sees is the worse of "this session" (fatigue's own
 * within-session count, unchanged) and "this week" (the reserve). Neither can
 * hide the other: four hundred hands tonight makes him worn whatever the
 * reserve says, and an empty reserve makes him worn on hand one.
 */
export function worseStage(a, b) {
  const ia = STAGES.indexOf(a);
  const ib = STAGES.indexOf(b);
  return STAGES[Math.max(ia < 0 ? 0 : ia, ib < 0 ? 0 : ib)];
}

/**
 * The reserve as a percentage, for a surface that still wants to draw a number.
 * Kept here rather than derived at each call site so the client and the server
 * cannot disagree about what "half" means.
 */
export function staminaPercent(agent, opts = {}) {
  return Math.round(staminaNow(agent, opts));
}
