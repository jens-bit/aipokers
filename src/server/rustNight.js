// src/server/rustNight.js — SERVER-5 job 2
//
// The nightly rust pass, beside the nightly exchange.
//
// homeNight.js runs its once-a-day thing the way this one does, and the reason
// is stated there: the server has no idea what time it is where the owner
// lives, so "nightly" is implemented as ONCE PER DAY, fired the first time the
// day's work is asked for, and never pinned to a wall-clock hour. Both hang off
// the same agent-change tick in wsServer.js. Neither is a cron.
//
// The difference between the two is what the once-a-day guard is FOR.
//
//   · The exchange spends money, so its guard is a spend limiter and a day it
//     misses is a day nobody pays for.
//   · Rust spends nothing. Its guard is only there to keep the walk over the
//     store cheap on a busy household, and a day it misses is a day it makes
//     up: applyRust works off ELAPSED time, so a process that was down for a
//     month finds four points waiting and dates each at the week it was due.
//     That is the whole reason the arithmetic is not "one point per run".
//
// It walks every owner in the store rather than only the one whose agent
// changed, because rust is a fact about agents nobody has touched — and the
// household most in need of a pass is the one that produces no changes at all.
// One owner opening the app is therefore enough to advance the whole building,
// which is the honest reading of a job with no scheduler behind it.

import { applyRust } from '../agent/rust.js';
import { allOwnerIds, agentsOf, saveOwner } from './agentProfiles.js';

// ownerId -> the day its pass last ran, as an ISO date.
const ran = new Map();

/** The day a timestamp belongs to, UTC — the same one homeNight.js uses. */
export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Has this owner's household already had today's pass? */
export function ranToday(ownerId, { now = Date.now() } = {}) {
  return ran.get(String(ownerId)) === dayKey(now);
}

/**
 * One owner's pass. Returns the points that drifted — one entry per point,
 * with the key, the values and the cause — or an empty list, which is the
 * overwhelmingly common answer.
 *
 * Stamped BEFORE the work, like the exchange's day is, so a record that throws
 * costs the day rather than being retried on every agent change for the rest
 * of it.
 */
export function runForOwner(ownerId, { now = Date.now(), force = false } = {}) {
  const owner = String(ownerId);
  if (!force && ranToday(owner, { now })) return [];
  ran.set(owner, dayKey(now));

  const drifted = [];
  let changed = false;
  for (const agent of agentsOf(owner)) {
    try {
      const points = applyRust(agent, { now });
      if (points.length === 0) continue;
      changed = true;
      for (const point of points) drifted.push({ agentId: agent.id, name: agent.name, ...point });
    } catch (err) {
      console.error(`[rust] ${owner}/${agent?.id}: ${err.message}`);
    }
  }
  if (changed) {
    saveOwner(owner);
    for (const point of drifted) {
      console.log(`[rust] ${point.name ?? point.agentId}: ${point.key} ${point.from} → ${point.to} — ${point.cause}`);
    }
  }
  return drifted;
}

/**
 * The whole building. Cheap when there is nothing to do: an owner who has
 * already had today's pass costs one map lookup, and an agent with nothing
 * earned costs six comparisons.
 */
export function runNightly({ now = Date.now() } = {}) {
  const drifted = [];
  for (const ownerId of allOwnerIds()) {
    try {
      drifted.push(...runForOwner(ownerId, { now }));
    } catch (err) {
      console.error(`[rust] pass failed for ${ownerId}:`, err.message);
    }
  }
  return drifted;
}

/** Test/shutdown helper: forget which owners have had today's pass. */
export function reset() {
  ran.clear();
}
