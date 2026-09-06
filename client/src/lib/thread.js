// client/src/lib/thread.js — WATCH-8, job 1: the thread survives.
//
// Before this the history sheet was assembled from whatever the socket happened
// to be awake for. Close the app, drop the connection, come back an hour later —
// the record of the session was gone, because it had only ever existed in a
// React state array. SERVER-3 stores the lines (src/server/thread.js) with the
// SERVER's own timestamp on them; this is the client half.
//
// Three rules the shape of this file comes from:
//
//   1. THE SERVER'S CLOCK IS THE CLOCK. Two devices watching the same agent must
//      not have to reconcile two orderings of one conversation, so a stored line
//      keeps `ts` exactly as it arrived and nothing here re-stamps it.
//   2. ATTRIBUTION IS THE `kind`, NOT THE LABEL. The room is TABLE, he is HIM,
//      you are YOU, and everybody else is printed under their own display name.
//      A seat that renames itself "TABLE" must not borrow the room's voice, so
//      the row carries the server's closed `kind` and the label is only text.
//   3. MERGING IS BY ID. The sheet holds stored lines and live ones at once —
//      a reconnect refetches everything the store has while the socket keeps
//      delivering what is said next. One row per id, the stored copy wins, and
//      a line heard live that the store also has is not printed twice.
//
// Pure: no DOM, no fetch, no timers. The screen owns the request.

// The four styles the sheet renders. Mirrors ThreadKind in src/server/thread.js.
export const ThreadKind = Object.freeze({
  TABLE: 'table',
  HIM: 'him',
  YOU: 'you',
  OPPONENT: 'opponent',
});

// How far apart two identical lines have to be before they are two lines and
// not one line heard twice. A reconnect refetches the store while the socket is
// still delivering, so the same sentence can arrive down both paths within a
// second or two; the same sentence two minutes apart is somebody repeating
// themselves, and dropping that would be the merge editing the conversation.
export const ECHO_WINDOW_MS = 120_000;

/** The request the sheet makes. Pure, so the URL is testable without a socket. */
export function threadUrl({ agentId, sessionId, userId }) {
  if (!agentId) return null;
  const q = new URLSearchParams();
  q.set('userId', userId || 'anon');
  // The session is OPTIONAL on purpose. A client that has just reconnected
  // knows which AGENT it was watching and not which stay, and the server
  // answers with his most recent one — which is what makes "a reconnect gets
  // the record back" a single request instead of a negotiation.
  if (sessionId) q.set('session', String(sessionId));
  return `/api/agents/${encodeURIComponent(agentId)}/thread?${q.toString()}`;
}

/**
 * One stored line → one sheet row.
 *
 * `who` is the label to print and `kind` is what the row is drawn as. For the
 * room, him and you they agree; for an opponent the label is his display name
 * and the kind is what stops that name from being read as a register.
 */
export function rowFromLine(line) {
  if (!line || typeof line.text !== 'string') return null;
  const kind = Object.values(ThreadKind).includes(line.kind) ? line.kind : ThreadKind.TABLE;
  const who = kind === ThreadKind.OPPONENT
    ? String(line.who || 'THEM').toUpperCase()
    : kind.toUpperCase();
  return {
    id: 's' + line.id,
    kind,
    who,
    text: line.text,
    // The server's timestamp, untouched.
    t: Number.isFinite(line.ts) ? line.ts : null,
    stored: true,
  };
}

/** A whole payload → rows, oldest first, skipping anything malformed. */
export function rowsFromThread(payload) {
  const lines = payload && Array.isArray(payload.lines) ? payload.lines : [];
  return lines.map(rowFromLine).filter(Boolean);
}

const echoKey = (r) => `${(r.kind || '').toLowerCase()}|${(r.who || '').toUpperCase()}|${(r.text || '').trim()}`;

// Oldest first. A tie on the clock is broken by which side the row came from
// and then by id, so the order is stable across renders rather than whatever
// the sort happened to do last.
function byTime(a, b) {
  const ta = Number.isFinite(a.t) ? a.t : 0;
  const tb = Number.isFinite(b.t) ? b.t : 0;
  if (ta !== tb) return ta - tb;
  if (!!a.stored !== !!b.stored) return a.stored ? -1 : 1;
  return String(a.id).localeCompare(String(b.id));
}

/**
 * Stored lines and live ones, as one ordered list.
 *
 * One row per id. Where the same line exists on both sides — the store has it
 * and the socket also delivered it — the STORED copy wins, because it carries
 * the server's clock and the live one carries this device's.
 */
export function mergeThread(stored = [], live = []) {
  const out = new Map();
  const echoes = new Map();

  for (const r of stored) {
    if (!r || r.id == null) continue;
    out.set(String(r.id), r);
    const k = echoKey(r);
    const at = echoes.get(k) || [];
    at.push(Number.isFinite(r.t) ? r.t : 0);
    echoes.set(k, at);
  }

  for (const r of live) {
    if (!r || r.id == null) continue;
    const id = String(r.id);
    if (out.has(id)) continue;
    const heard = echoes.get(echoKey(r));
    if (heard) {
      const t = Number.isFinite(r.t) ? r.t : 0;
      if (heard.some((ts) => Math.abs(ts - t) <= ECHO_WINDOW_MS)) continue;
    }
    out.set(id, r);
  }

  return [...out.values()].sort(byTime);
}

// The socket statuses useTable moves through. A thread is refetched when the
// connection comes BACK — the sheet the owner left is not the sheet the table
// has been writing while he was gone.
const DOWN = new Set(['connecting', 'reconnecting', 'closed', 'idle']);
const UP = new Set(['waiting', 'watching', 'playing']);

/** Did the connection just come back up? */
export function isReconnect(prev, next) {
  return DOWN.has(prev) && UP.has(next);
}
