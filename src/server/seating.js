// src/server/seating.js — MONEY-1 job 5
//
// ONE AGENT, ONE TABLE — the rule, and the one authority that can answer it.
//
// ── Why this is its own file ────────────────────────────────────────────────
//
// Three modules need the same answer and no two of them may import each other:
// `tableRegistry` imports `table.js`, and `table.js` imports `agentProfiles`.
// A leaf they can all reach is the only shape that works, and it is a better
// shape anyway — the rule about where a man may sit is worth being able to read
// in one place.
//
// ── The rule, and what was wrong before ─────────────────────────────────────
//
// THE FELT IS THE AUTHORITY AND THE RECORD IS A CACHE OF IT.
//
// Every door into a seat used to consult `agent.activeTableId`, which is
// written AFTER the seat is taken and cleared by a ceremony that can throw. And
// the guard built on it asked `hasTable(activeTableId)` — whether a TABLE
// exists, never whether HE IS IN IT. So the rule held only while the record
// happened to agree with the felt, and when it did not, deploy opened a second
// table and charged a second buy-in.
//
// The registry's `tableOfAgent` walks the live seats, which cannot be stale
// because they ARE the state. This module is how the other two ask it.
//
// ── The message ─────────────────────────────────────────────────────────────
//
// The only thing any of this ever said was "another of your agents is already
// at this table", which is MATCH-1's rule — a different rule, about a
// stablemate, and not true of the man in question. An owner who is refused has
// to be told WHERE HE IS, because that is the fact that explains the refusal
// and the only one he can act on.

let lookup = null;

/**
 * Registry hook: agentId -> the live Table he is seated at, or null.
 *
 * Injected rather than imported, for the cycle above. Called once, at
 * tableRegistry's module load.
 */
export function setSeatLookup(fn) {
  lookup = typeof fn === 'function' ? fn : null;
}

/** Whether anything has taught this process where its agents are sitting. */
export function hasSeatLookup() {
  return lookup !== null;
}

/**
 * The live table this agent is seated at, or null.
 *
 * Null is also the answer when no registry is wired up — which is what keeps
 * the seat-lifecycle suites driving bare Tables with nothing underneath them.
 * A lookup that throws is a lookup that cannot refuse: it must never be the
 * thing that stops a man sitting down.
 */
export function seatOf(agentId) {
  if (!agentId || !lookup) return null;
  try {
    const table = lookup(agentId);
    return table && !table.closed ? table : null;
  } catch (err) {
    console.error('[seating] seat lookup failed:', err.message);
    return null;
  }
}

/**
 * The table he is at, when it is not `table`. The argument may be a Table or a
 * table id, so a caller that only has the id does not have to find the object.
 */
export function seatedElsewhere(table, agentId) {
  const seated = seatOf(agentId);
  if (!seated) return null;
  const hereId = typeof table === 'string' ? table : table?.tableId;
  return seated.tableId === hereId ? null : seated;
}

/**
 * The sentence an owner is shown. It names the felt, because "no" does not —
 * and since AGENT-5 job D it names the WAY OUT, because a fact is not a remedy.
 *
 * "He plays one table at a time" is a rule, and an owner who has just been
 * stopped by a rule is left holding nothing he can press. What he can actually
 * do is the same two things in both cases: go and look at the game he already
 * has, or end it. The kitchen table and a casino felt take different verbs for
 * the second one, so the sentence takes different verbs.
 */
export function seatedElsewhereMessage(displayName, other) {
  const who = displayName || 'He';
  const home = !!other?.home;
  const where = home ? 'the kitchen table at home' : `table ${other?.tableId}`;
  const fix = home
    ? 'Watch the kitchen table, or take him out of it first.'
    : 'Watch that table, or finish his session there first.';
  return `${who} is already sitting at ${where}. He plays one table at a time. ${fix}`;
}
