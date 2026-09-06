// src/server/thread.js — SERVER-3
//
// The table thread: what a session SOUNDED like, kept.
//
// The v5 watch screen's history sheet (design-refs/mood-watch5.jsx, V5_THREAD)
// is four kinds of line and nothing else:
//
//   TABLE     what happened at the felt, in the room's voice — "Granite raised
//             to 240", "He misjudged equity by 7% · FOCUS"
//   HIM       the agent, in his own voice — his read, his trash talk
//   YOU       the owner's whisper into the felt
//   <name>    another seat talking, printed under its display name
//
// Before this the sheet was assembled from whatever messages the socket
// happened to be awake for, which meant a reconnect got an empty sheet and a
// look back an hour later got nothing at all. So the lines are STORED, per
// session, with the SERVER's timestamp on them — two devices watching the same
// agent must not have to reconcile two orderings of one conversation.
//
// Three rules the shape of this file comes from:
//
//   1. THE THREAD IS PER SESSION, NOT PER TABLE. It is his stay that ended,
//      and his stay the ceremony summarises. A table that outlives him keeps
//      talking; his thread stops.
//   2. HIS REASONING IS HIS OWNER'S. `him` lines carry the same content the
//      DECISION broadcast withholds from everyone but the owner's spectator
//      (BUG-12/15, AGE-33), so reading the thread is owner-gated the same way.
//      A non-owner gets the public half — the room's lines and what people
//      said out loud — and never the private one.
//   3. WRITING IS BEST-EFFORT. A thread that can break a hand is worse than no
//      thread. Every write here is wrapped; the caller is never told and never
//      has to care.
//
// Persistence is store.js's session_thread table. This module owns the
// vocabulary, the clamping and the ownership filter; it owns no SQL.

import { appendThreadLine, readThreadLines, latestThreadSession } from './store.js';

// The four styles the sheet renders. `who` is a label and may be anything (an
// opponent's display name); `kind` is the closed set the client switches on,
// so a player who renames himself "TABLE" cannot borrow the room's voice.
export const ThreadKind = Object.freeze({
  TABLE: 'table',
  HIM: 'him',
  YOU: 'you',
  OPPONENT: 'opponent',
});

const KINDS = new Set(Object.values(ThreadKind));

// Only `him` is private. `you` is the owner's own line coming back to him —
// harmless to him, but it is still his, so it travels with the private half.
const PRIVATE_KINDS = new Set([ThreadKind.HIM, ThreadKind.YOU]);

// The same clamp table chat uses. A thread line is a line, not a document.
export const LINE_MAX = 280;

/**
 * Append one line. Best-effort by construction — returns the row id, or null
 * when the line was empty, malformed, or the write failed.
 *
 *   sessionId  which stay this belongs to (required; a line with no session
 *              has nowhere to be read back from, so it is dropped)
 *   kind       one of ThreadKind
 *   who        the label to print: 'TABLE' | 'HIM' | 'YOU' | a display name
 *   text       the line
 *   ts         server clock, defaulted here so no caller can supply a
 *              client's idea of the time
 */
export function appendLine({ sessionId, agentId, ownerId, tableId = null, kind, who, text, ts = null } = {}) {
  if (!sessionId || !agentId) return null;
  if (!KINDS.has(kind)) return null;
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().slice(0, LINE_MAX);
  if (!trimmed) return null;
  const label = (typeof who === 'string' && who.trim()) ? who.trim().slice(0, 40) : defaultLabel(kind);

  try {
    return appendThreadLine({
      sessionId,
      agentId,
      ownerId: ownerId ?? 'anon',
      tableId,
      ts: Number.isFinite(ts) ? ts : Date.now(),
      kind,
      who: label,
      text: trimmed,
    });
  } catch (err) {
    console.error('[thread] append failed:', err.message);
    return null;
  }
}

function defaultLabel(kind) {
  if (kind === ThreadKind.TABLE) return 'TABLE';
  if (kind === ThreadKind.HIM) return 'HIM';
  if (kind === ThreadKind.YOU) return 'YOU';
  return 'THEM';
}

/**
 * One session's thread, oldest first.
 *
 * `owner` is the ownership proof the REST layer already computes. Without it
 * the private half is withheld rather than the whole thread refused: the room
 * talking and the seats talking are public at a real table, and a spectator
 * who can watch the felt can hear them.
 */
export function readThread(sessionId, { owner = false, limit } = {}) {
  if (!sessionId) return [];
  let rows = [];
  try {
    rows = readThreadLines(sessionId, limit ? { limit } : {});
  } catch (err) {
    console.error('[thread] read failed:', err.message);
    return [];
  }
  const visible = owner ? rows : rows.filter((r) => !PRIVATE_KINDS.has(r.kind));
  return visible.map(({ ownerId, agentId, ...line }) => line);
}

/**
 * The last session this agent said anything in, or null. What the REST route
 * falls back to when the client names no session — a reconnect knows the
 * agent, not the id of the stay it was watching.
 */
export function latestSessionFor(agentId) {
  if (!agentId) return null;
  try {
    return latestThreadSession(agentId);
  } catch (err) {
    console.error('[thread] latest session lookup failed:', err.message);
    return null;
  }
}
