// src/server/guestNight.js — GUEST-1 job 2
//
// The nightly pass that forgets a guest nobody came back for.
//
// It is a file of its own for the same reason rustNight.js is one: a nightly
// job is a job, not a rule, and guest.js is the rules. It is also what keeps
// the import graph one-directional — guest.js reaches nothing but the store,
// auth and the limiter, and THIS file is the one that knows about a roster.
// Putting the pass inside guest.js would have closed a ring through
// agentProfiles, which imports guest.js for the limits.
//
// Everything below follows rustNight.js's shape, and the reasoning is stated
// there: the server has no idea what time it is where an owner lives, so
// "nightly" is ONCE PER DAY, fired the first time the day's work is asked for
// and never pinned to a wall-clock hour. It rides the same agent-change tick,
// and it is not a cron.

import {
  guestsEnabled, dayKey, listStaleGuests, GUEST_STALE_DAYS, DAY_MS,
} from './guest.js';
import { archiveAllAgents } from './agentProfiles.js';

// ── The pass ────────────────────────────────────────────────────────────────
//
// A guest is forgotten after thirty days of not being touched. Not thirty days
// after he was CREATED — every resolved request restamps him (see the resolver
// in guest.js), so this is thirty days of SILENCE, which is the honest reading
// of "nobody came back".
//
// WHAT RETIRING MEANS IS NOT REDEFINED HERE. It goes through
// archiveAllAgents → archiveAgent, the same function POST /retire ends at, so
// a forgotten agent's pocket comes home the way a retired one's does. Nothing
// is deleted: the rows stay, the guest row stays, and a cookie that somehow
// outlives thirty days finds a flat with a retired man in it rather than a
// 404. That is a sadder screen than an empty one, and it is the true one.

let lastPassDay = null;

/**
 * Retire every guest untouched for GUEST_STALE_DAYS. Returns what it closed.
 * Once a day; `force` is for the tests.
 */
export function runNightly({ now = Date.now(), force = false } = {}) {
  if (!guestsEnabled()) return [];
  const today = dayKey(now);
  if (!force && lastPassDay === today) return [];
  lastPassDay = today;

  const cutoff = now - GUEST_STALE_DAYS * DAY_MS;
  const retired = [];
  let stale = [];
  try { stale = listStaleGuests(cutoff); }
  catch (err) { console.error('[guest] stale sweep failed:', err.message); return []; }

  for (const row of stale) {
    try {
      const agents = archiveAllAgents(row.ownerId);
      if (agents > 0) {
        retired.push({ ownerId: row.ownerId, agents, lastSeenAt: row.lastSeenAt });
        console.log(`[guest] forgotten: ${row.ownerId} — ${agents} agent(s) retired after ${GUEST_STALE_DAYS} days`);
      }
    } catch (err) {
      console.error(`[guest] retiring ${row.ownerId} failed:`, err.message);
    }
  }
  return retired;
}

/** Test hook: forget that today's pass has run. */
export function resetNightly() {
  lastPassDay = null;
}
