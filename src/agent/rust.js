// src/agent/rust.js — SERVER-5 job 2
//
// Rust.
//
// Growth is permanent (attributes.js: "nothing ever regresses"). That was the
// right law while the only thing that could move an attribute was a session,
// because the alternative — a number that falls while you are not looking — is
// the decay meter every Tamagotchi is remembered for and nobody enjoyed.
//
// This is the one exception, and it is narrow enough to state in a sentence:
// A SKILL HE HAS NOT USED IN A FORTNIGHT DRIFTS BACK TOWARD THE ONE HE WAS
// BORN WITH, ONE POINT A WEEK, AND STOPS THERE.
//
// Five rules, and four of them exist to keep it from becoming that meter.
//
//   1. IT CANNOT TAKE ANYTHING HE CAME WITH. `born` is the floor and it is a
//      hard one: rust removes only what was EARNED. An agent who has never
//      grown a point cannot rust a point, which means the punishing case —
//      you left, so he got worse than he started — does not exist.
//   2. A FORTNIGHT OF GRACE, THEN A POINT A WEEK. Two weeks is longer than any
//      holiday and long enough that ordinary neglect costs nothing. The first
//      point lands the day the fortnight is up; each further week is one more.
//   3. PER SKILL, NOT PER AGENT. He rusts at the things he stopped doing. An
//      agent who plays every night but never sees a showdown loses READS and
//      keeps everything else — which is a fact about how he has been deployed,
//      and the most interesting thing this rule can say.
//   4. EVERY POINT IS A LEDGER LINE WITH A CAUSE. "getting rusty at reads."
//      Same law as growth: no tick without a named cause. A number that moves
//      silently is the thing this design refuses to be.
//   5. IT CATCHES UP, AND IT IS DATED HONESTLY. The nightly job may not have
//      run for a month (nothing here is a cron; see rustNight.js). So the
//      arithmetic is over ELAPSED TIME, not over how often it was asked, and
//      each point is logged at the week boundary it was actually due. Ask
//      twice in one day and the second ask finds nothing to do.
//
// Pure, like every other file in this directory: an agent record in, a list of
// what changed out, and nothing in here reads a clock it was not handed.

import { ATTR_KEYS, ensureAttributes, logAttrChange, noteExercised } from './attributes.js';

// Re-exported so the whole of rust reads out of one file, even though the
// stamp itself is written by attributes.js — it is attribute bookkeeping, and
// applySessionGrowth has to be able to write it without importing this module
// back (which would be a cycle for the sake of a tidier import line).
export { noteExercised };

/** The grace period. Nothing rusts inside it. */
export const RUST_IDLE_MS = 14 * 24 * 60 * 60_000;

/** And one point per week after it. */
export const RUST_STEP_MS = 7 * 24 * 60 * 60_000;

// The ledger line, per attribute. Lower case and plain, because it is a thing
// he would say about himself and not a system message about a stat.
const RUST_NOUN = Object.freeze({
  READS:      'reads',
  FOCUS:      'the arithmetic',
  DISCIPLINE: 'laying one down',
  COMPOSURE:  'taking a beat',
  DECEPTION:  'the bluff',
  STAMINA:    'the long ones',
});

export function rustCause(key) {
  return `getting rusty at ${RUST_NOUN[key] ?? String(key).toLowerCase()}.`;
}

// null is NOT a number, whatever `Number(null)` says. A missing stamp read as
// epoch zero is fifty years of neglect, which would rust every agent in the
// building to his birth values the first time the pass ran.
const isNum = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

/**
 * The value he was born with, per attribute — the floor rust may not pass.
 *
 * `attrsBorn` is written at birth and backfilled from the attrLog by
 * ensureAttributes. When neither exists (an agent old enough that his birth
 * entries have been pushed out of the 200-entry ring, or one who predates the
 * log entirely), his CURRENT value stands in. That is deliberately the
 * conservative answer: an unknown birth means nothing can be shown to have
 * been earned, so nothing can be taken back.
 */
export function bornValue(agent, key) {
  const born = agent?.attrsBorn?.[key];
  if (isNum(born)) return Number(born);
  const cur = agent?.attrs?.[key];
  return isNum(cur) ? Number(cur) : null;
}

/**
 * When that skill was last exercised. The session's own stamp first (written
 * by applySessionGrowth for every key the session produced evidence for), then
 * his birth — an agent who has never played has never let anything rust, and
 * dating him from epoch zero would rust him to the floor on his first night.
 */
export function lastUsedAt(agent, key) {
  const used = agent?.attrUsedAt?.[key];
  if (isNum(used)) return Number(used);
  if (isNum(agent?.bornAt)) return Number(agent.bornAt);
  return null;
}

/**
 * The moments at which this skill's rust points were DUE, oldest first.
 *
 * Rule 5: computed from elapsed time, so a job that has not run in a month
 * finds four points waiting and dates each one at the week it belonged to.
 * `anchor` is the last thing that reset the clock, and `grace` is how long
 * that thing buys him: a session that exercised the skill buys the full
 * fortnight, a point of rust already taken buys a week. Getting that second
 * one wrong would hand him a fresh fortnight of grace for every point he lost,
 * which is a drift that stops after the first point.
 */
export function rustDueAt(anchor, { now = Date.now(), grace = RUST_IDLE_MS } = {}) {
  if (!isNum(anchor)) return [];
  const due = [];
  for (let at = Number(anchor) + grace; at <= now; at += RUST_STEP_MS) due.push(at);
  return due;
}

/**
 * What one skill owes, right now: how many points, and when the last of them
 * was due. Returns null when it owes nothing, which is the common answer.
 */
export function rustFor(agent, key, { now = Date.now() } = {}) {
  const cur = agent?.attrs?.[key];
  if (!isNum(cur)) return null;
  const born = bornValue(agent, key);
  if (born === null || Number(cur) <= born) return null;   // rule 1: nothing earned, nothing to lose

  // The clock restarts at every point taken, so a long absence produces a
  // steady drip rather than one cliff on the day somebody looks.
  const rusted = agent?.attrRustedAt?.[key];
  const anchor = isNum(rusted) ? Number(rusted) : lastUsedAt(agent, key);
  const grace = isNum(rusted) ? RUST_STEP_MS : RUST_IDLE_MS;
  const due = rustDueAt(anchor, { now, grace });
  if (due.length === 0) return null;

  const points = Math.min(due.length, Number(cur) - born);
  return { key, points, from: Number(cur), to: Number(cur) - points, dueAt: due[points - 1] };
}

/**
 * Take the rust off every skill that owes some. Mutates the agent — the same
 * contract applySessionGrowth has — and returns one entry per POINT, so a
 * caller can print exactly what moved.
 *
 * Idempotent within a step: run it twice in the same minute and the second run
 * returns nothing, because the first moved every anchor forward.
 */
export function applyRust(agent, { now = Date.now() } = {}) {
  if (!agent) return [];
  ensureAttributes(agent);
  if (!agent.attrRustedAt || typeof agent.attrRustedAt !== 'object') agent.attrRustedAt = {};

  const drifted = [];
  for (const key of ATTR_KEYS) {
    const owed = rustFor(agent, key, { now });
    if (!owed) continue;

    // One log line per point, dated at the week boundary it was due, so a
    // sparkline drawn from the log shows a drift rather than a cliff.
    const rusted = agent.attrRustedAt[key];
    const anchor = isNum(rusted) ? Number(rusted) : lastUsedAt(agent, key);
    const first = anchor + (isNum(rusted) ? RUST_STEP_MS : RUST_IDLE_MS);
    const cause = rustCause(key);
    for (let i = 0; i < owed.points; i++) {
      const from = owed.from - i;
      const to = from - 1;
      const ts = first + i * RUST_STEP_MS;
      agent.attrs[key] = to;
      logAttrChange(agent, { key, from, to, cause, ts });
      drifted.push({ key, from, to, cause, ts });
    }
    agent.attrRustedAt[key] = owed.dueAt;
  }
  return drifted;
}
