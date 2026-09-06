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

import {
  appendThreadLine, readThreadLines, latestThreadSession, putOverheardEntry,
} from './store.js';

// The four styles the sheet renders. `who` is a label and may be anything (an
// opponent's display name); `kind` is the closed set the client switches on,
// so a player who renames himself "TABLE" cannot borrow the room's voice.
export const ThreadKind = Object.freeze({
  TABLE: 'table',
  HIM: 'him',
  YOU: 'you',
  OPPONENT: 'opponent',
  // THREAD-2: the nightly exchange between two agents at home. ONE entry
  // carrying the whole conversation (see appendOverheard) rather than a run of
  // loose lines — it is one thing that happened, and a client that receives it
  // as three separate `him` lines cannot tell it from three agents talking.
  OVERHEARD: 'overheard',
});

const KINDS = new Set(Object.values(ThreadKind));

// ── WATCH-9 · the push ──────────────────────────────────────────────────────
//
// SERVER-3 made the thread survive by storing it, and the sheet read the store
// when it was opened. That is a snapshot: a sheet left open went quiet while
// the table carried on talking, and the only way to see what had been said was
// to close it and open it again.
//
// So every write announces itself. ONE injected sink, the same shape
// floorChannel.js takes its providers in: this module still knows about no
// socket, no table and no registry — wsServer wires the listener to whatever
// can deliver, and with nothing wired the writes are exactly what they were.
//
// It is announced AFTER the row is written and with the row's own id, so a
// client can merge the push with a fetch by id rather than by guessing whether
// it already has the line.
let lineListener = null;

/** Wire the sink. Passing anything but a function unwires it. */
export function setLineListener(fn) {
  lineListener = typeof fn === 'function' ? fn : null;
}

// Best-effort, like every write in this file: a thread that can break a hand is
// worse than no thread, and that goes double for a broadcast hanging off one.
function announce(line) {
  if (!lineListener) return;
  try {
    lineListener(line);
  } catch (err) {
    console.error('[thread] line listener failed:', err.message);
  }
}

// HOME-STATE-1: where the line was said. `table` is every line that predates
// the home and every line a felt produces; `home` is the nightly exchange
// between two agents who spent the evening in — a conversation with no table
// under it, filed against a synthetic session id so it reads back through the
// same route the felt's thread does.
export const ThreadSource = Object.freeze({
  TABLE: 'table',
  HOME: 'home',
});

const SOURCES = new Set(Object.values(ThreadSource));

// Only `him` is private. `you` is the owner's own line coming back to him —
// harmless to him, but it is still his, so it travels with the private half.
// THREAD-2: `overheard` joins them. Two of his agents talking in his flat is
// the most private thing in the product; a spectator at a felt has no business
// with it, and nothing on a felt produces one.
const PRIVATE_KINDS = new Set([ThreadKind.HIM, ThreadKind.YOU, ThreadKind.OVERHEARD]);

// THREAD-2: who a line is from and who it is to. An agent id is the common
// case; these two are the parties that are not agents.
export const OWNER = 'owner';
// The room. What the owner is addressing when he says something to the house
// rather than to one of them, and what an agent is addressing when he says
// something to nobody in particular. Without it a fan-out would have to be
// stored once per listener, which is the same message three times.
export const ROOM = 'all';

// A participant id, clamped the way `who` is. Anything unusable is dropped to
// null rather than stored as a half-value the client has to guess about.
function participant(id) {
  if (id == null) return null;
  const s = String(id).trim().slice(0, 64);
  return s || null;
}

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
 *   from/to    THREAD-2: an agent id, OWNER, or ROOM. Every HOME line carries
 *              both — that is what lets the client draw "BALANCE -> GRANITE" —
 *              and a table line carries neither, because the room says it to
 *              nobody in particular.
 *   source     one of ThreadSource — where it was said. Anything unrecognised
 *              falls back to 'table' rather than being stored, so a caller
 *              cannot invent a fifth provenance the client has to switch on.
 *   cost       WATCH-9: this is the room saying an attribute cost him the
 *              hand, which the sheet draws in gold. A property of the LINE and
 *              not a fifth `kind`: it is still the room's voice, and adding a
 *              kind for it would let a client miss it and print it as an
 *              opponent. It was a client-side flag on a live row until now, so
 *              the gold went grey the moment the thread was refetched.
 */
export function appendLine({ sessionId, agentId, ownerId, tableId = null, kind, who, text, ts = null, source = ThreadSource.TABLE, from = null, to = null, cost = false } = {}) {
  if (!sessionId || !agentId) return null;
  if (!KINDS.has(kind)) return null;
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().slice(0, LINE_MAX);
  if (!trimmed) return null;
  const label = (typeof who === 'string' && who.trim()) ? who.trim().slice(0, 40) : defaultLabel(kind);
  const row = {
    sessionId,
    agentId,
    ownerId: ownerId ?? 'anon',
    tableId,
    ts: Number.isFinite(ts) ? ts : Date.now(),
    kind,
    who: label,
    text: trimmed,
    source: SOURCES.has(source) ? source : ThreadSource.TABLE,
    from: participant(from),
    to: participant(to),
    cost: !!cost,
  };

  let id = null;
  try {
    id = appendThreadLine(row);
  } catch (err) {
    console.error('[thread] append failed:', err.message);
    return null;
  }
  // Only a line that is actually in the store is announced. A push for a row
  // that failed to write would put a line on a screen that nobody could ever
  // read back.
  if (id != null) announce({ ...row, id, cost: row.cost || undefined });
  return id;
}

/**
 * THREAD-2: the day's overheard exchange, as one entry.
 *
 * `lines` is [{ from, to, who, text }] in the order it was said. The entry's
 * own `text` is the first line, so a client that has not been taught the new
 * kind still shows something a person said rather than an empty row.
 *
 * Writing a second one for the same session REPLACES the first: one exchange
 * per owner per day is a rule about what is STORED, not only about what the
 * nightly job decides to write, so a restart inside the same day cannot leave
 * two copies of the same conversation in the thread.
 *
 * Best-effort like every other write here — returns the row id, or null.
 */
export function appendOverheard({ sessionId, ownerId, lines, ts = null } = {}) {
  if (!sessionId) return null;
  const kept = (Array.isArray(lines) ? lines : [])
    .map((line) => ({
      from: participant(line?.from),
      to: participant(line?.to),
      who: (typeof line?.who === 'string' && line.who.trim()) ? line.who.trim().slice(0, 40) : 'HIM',
      text: typeof line?.text === 'string' ? line.text.trim().slice(0, LINE_MAX) : '',
    }))
    .filter((line) => line.text && line.from);
  if (kept.length === 0) return null;

  try {
    return putOverheardEntry({
      sessionId,
      // The row needs one agent_id and the exchange belongs to both. The first
      // speaker is the one it is filed under; every speaker is named inside
      // `lines`, which is where a reader should look for who was in it.
      agentId: kept[0].from,
      ownerId: ownerId ?? 'anon',
      ts: Number.isFinite(ts) ? ts : Date.now(),
      who: kept[0].who,
      text: kept[0].text,
      lines: kept,
      source: ThreadSource.HOME,
    });
  } catch (err) {
    console.error('[thread] overheard write failed:', err.message);
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
