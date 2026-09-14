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

// A hand at the kitchen table costs half what a hand in the casino does. It is
// still work — the whole point of this file is that an evening in is not free,
// because for most households an evening in is ALL there is — but it is a game
// with people he lives with for chips that are not real, and pricing it the
// same as a rung at the casino would make the casino pointless.
export const HOME_HAND_WEIGHT = 0.5;

// What an hour out of a seat gives back. 15 points takes a spent agent from
// empty to full in a little under seven hours and from 'worn' to 'fresh' in
// about two and a quarter — deliberately close to restedFatigue's own two
// hours per stage, so the two recoveries a client can see do not visibly
// disagree with each other.
export const RECOVER_PER_HOUR = 15;

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

/**
 * The three-stage word for a reserve.
 *
 * A missing reserve reads as 'fresh', not as 'worn'. Every agent made before
 * this file existed has no reserve on his record, and the alternative answer
 * would put the whole roster to sleep on the deploy that shipped it.
 */
export function staminaStage(left) {
  const v = num(left);
  if (v === null) return 'fresh';
  if (v >= SETTLED_AT) return 'fresh';
  if (v >= WORN_AT) return 'settled';
  return 'worn';
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
  return staminaStage(staminaNow(agent, opts));
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
export function spendStamina(agent, hands, { staminaAttr = null, home = false, now = Date.now() } = {}) {
  if (!agent) return STAMINA_MAX;
  const n = Math.max(0, num(hands) ?? 0);
  // The gap since the last write is rest by definition: whatever he was doing,
  // these hands are being charged now and everything before them is behind him.
  const before = staminaNow(agent, { now, resting: true });
  const left = clamp(before - n * handCost(staminaAttr, { home }));
  agent.stamina = { left: Math.round(left * 10) / 10, at: now };
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
  agent.stamina = { left: Math.round(left * 10) / 10, at: now };
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
export const STAGES = Object.freeze(['fresh', 'settled', 'worn']);

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
