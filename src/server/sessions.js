// src/server/sessions.js — SERVER-3
//
// A SESSION is one agent's stay at one table: he sits down, he plays, he
// stands up. Everything else in the server already had a name for the two ends
// of it — deploy, finishAgentSession — but the thing in between had no
// identity, which is why nothing could be filed under it and why the client
// had to infer "his session ended" from a table closing.
//
// This module is that identity and nothing else:
//
//   * an id, minted when a seat is taken (`newSessionId`)
//   * the vocabulary of ways a session can end (`SESSION_END_REASONS`)
//   * one bus that says a session ended, once (`bus`, `emitSessionEnd`)
//
// It knows nothing about tables, sockets or the database, exactly like
// events.js — tables and routes call in, the floor channel and the table
// listen. That is what lets the whole thing be tested by emitting four
// endings and reading them back.
//
// WHY A MESSAGE OF ITS OWN. The ceremony the watch screen runs at the end of a
// session ("WON / +$1,240 / stack $5,541") is a SESSION moment, not a hand
// moment. Before this it was reconstructed from TABLE_CLOSED plus a poll of
// the agent record, which meant it fired on the wrong events (a table closing
// for a reason that was not his session ending) and missed the numbers it
// wanted. This is the message that fires it, and it carries the four numbers
// the ceremony prints.

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';

// The five ways a stay ends. Four of them are the session stop rule — the
// pocket busts, the allowance is gone, STAMINA wears him out, or the owner
// calls him in — and the fifth is everything the rule does not cover: the hand
// cap, the idle reaper, the table closing under him.
export const SESSION_END_REASONS = Object.freeze([
  'bust',       // his stack reached zero at the felt
  'allowance',  // the budget behind him is spent; he cannot buy in again
  'worn',       // STAMINA fatigue reached 'worn' — he sits at the bar himself
  'calledIn',   // the owner stopped him (SIT_OUT, POST /finish, or a wallet cut)
  'stopped',    // everything else: hand cap, idle, stall, the room closing
]);

const REASONS = new Set(SESSION_END_REASONS);

export function isEndReason(reason) {
  return REASONS.has(reason);
}

// Only one signal rides this bus: 'session_end', with the record below.
// Listener count is generous for the same reason events.js's is — a process
// that composes several servers (every e2e script does) attaches several.
export const bus = new EventEmitter();
bus.setMaxListeners(50);

/**
 * Mint an id for one stay. Opaque to every consumer: it is a key, not a
 * description, and nothing may parse meaning back out of it.
 */
export function newSessionId() {
  return `s_${randomUUID().slice(0, 12)}`;
}

const int = (n) => (Number.isFinite(n) ? Math.round(n) : 0);

/**
 * Build the record, normalised and frozen, without saying it happened.
 *
 * The builder is separate from the emit because two audiences need the same
 * record from two different places: the table hands it to finishAgentSession
 * (which puts it on the bus, for the floor) and broadcasts it to its own
 * sockets in the same breath. One builder means one shape, so the ceremony
 * cannot be told two different stories about the same session.
 *
 * Never throws, and never rejects: a session that ends is a fact. An unknown
 * reason normalises to 'stopped' rather than failing.
 *
 *   sessionId   the stay this ends (null for a session that predates ids)
 *   agentId     whose stay it was
 *   userId      the owner — routing only; it never reaches the wire
 *   tableId     where he was sitting
 *   reason      one of SESSION_END_REASONS
 *   hands       hands HE was dealt into, not the table's total
 *   net         chips, signed: final stack minus his buy-in
 *   biggestPot  the largest pot he had money in this session
 *   duration    milliseconds between sitting down and standing up
 */
export function sessionEndRecord({
  sessionId = null,
  agentId,
  userId = null,
  tableId = null,
  reason = 'stopped',
  hands = 0,
  net = 0,
  biggestPot = 0,
  duration = 0,
  endedAt = null,
} = {}) {
  if (!agentId) return null;
  return Object.freeze({
    sessionId: sessionId ?? null,
    agentId: String(agentId),
    userId: userId == null ? null : String(userId),
    tableId: tableId ?? null,
    reason: isEndReason(reason) ? reason : 'stopped',
    hands: Math.max(0, int(hands)),
    net: int(net),
    biggestPot: Math.max(0, int(biggestPot)),
    duration: Math.max(0, int(duration)),
    endedAt: Number.isFinite(endedAt) ? Math.round(endedAt) : Date.now(),
  });
}

/**
 * Say that one session ended. Takes either the fields or a record already
 * built by sessionEndRecord (re-normalising a normalised record is a no-op).
 * Returns the frozen record that went on the bus, so a caller can assert on
 * exactly what it emitted.
 *
 * A listener that breaks must not be able to take a table down with it, so the
 * emit is wrapped.
 */
export function emitSessionEnd(fields = {}) {
  const record = sessionEndRecord(fields);
  if (!record) return null;
  try {
    bus.emit('session_end', record);
  } catch (err) {
    console.error('[sessions] session_end listener failed:', err.message);
  }
  return record;
}

/**
 * The wire shape. The owner id is routing information — the floor channel uses
 * it to decide who hears about this — and has no business on a message that
 * also travels to a table's spectators, so it is dropped here rather than
 * remembered not to be sent at each call site.
 */
export function sessionEndMessage(record) {
  if (!record) return null;
  const { userId, ...wire } = record;
  return wire;
}
