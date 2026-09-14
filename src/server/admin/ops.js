// src/server/admin/ops.js — ADMIN-2
//
// The write panel's actual operations. Every one of them is a thin wrapper
// around a function that already existed before this file did — ADMIN-2's
// hard constraint is that wallet.js, table.js, stamina and agentProfiles.js
// are being edited by other trees right now, so nothing here reimplements
// what any of those files already do. Where the building block this needed
// did not exist and could not be reached without writing a new path into the
// money, the action is recorded as a GAP in read-me-claude/ADMIN.md instead
// of an endpoint — see the header of index.js for the list.
//
// Every function here returns { ok: true, before, after } on success or
// { ok: false, status, error } on refusal, so the route handlers that call
// them can turn either shape into a response and an audit-log entry without
// re-deriving what happened.

import { loadWallet, saveWallet } from '../store.js';
import { emptyWallet, appendEntry } from '../wallet.js';
import {
  agentsOf, saveOwner, reloadOwners, seatStatusOf, setAgentMood, noteAgentFatigue,
} from '../agentProfiles.js';
import { coinName, NAME_MAX } from '../naming.js';
import { getTable } from '../tableRegistry.js';
import { benchCutSeat } from '../wallet.js';

// SLOTS-1's own STARTING_GRANT (agentProfiles.js:139) is not exported, and
// agentProfiles.js is off limits this job — so this is a bare fact duplicated
// here, not new money logic. If the real grant amount ever changes, this
// reset target goes stale until somebody re-reads it off that constant; it
// is not read live on purpose, because agentProfiles.js is exactly the file
// this job may not import a runtime dependency from.
export const CLEAN_STARTING_BALANCE = 10_000;

function walletOrEmpty(ownerId) {
  return loadWallet(ownerId) ?? emptyWallet(ownerId);
}

/**
 * Persist a wallet written directly through store.js, then drop
 * agentProfiles.js's in-memory wallet cache for this owner (agentProfiles.js
 * L175's `wallets` Map, reloaded lazily by its own walletFor()) — otherwise
 * the very next ordinary request that touches this owner's wallet would
 * save its stale cached copy straight back over this write. reloadOwners is
 * exported for exactly this: cross-cutting code that changed the database
 * out from under the process's own cache (see its docstring, written for
 * GUEST-1's claim reassignment).
 */
function saveWalletAndInvalidate(ownerId, wallet) {
  saveWallet(ownerId, wallet);
  reloadOwners(ownerId);
}

// ── Owner actions ────────────────────────────────────────────────────────────

/**
 * Credit or debit an owner's wallet by `amount` (either sign), through
 * wallet.js's own appendEntry — the same ledger-entry shape every other
 * wallet mutation in the product uses, so this ledger stays the same shape
 * as an ordinary one. Never goes below zero; the audit log's `after` value
 * says so when a debit was clamped.
 */
export function adjustOwnerChips(ownerId, { amount, reason }) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return { ok: false, status: 400, error: 'amount must be a non-zero number' };
  if (!reason || !String(reason).trim()) return { ok: false, status: 400, error: 'reason is required' };

  const wallet = walletOrEmpty(ownerId);
  const before = wallet.balance;
  const after = Math.max(0, before + n);
  wallet.balance = after;
  wallet.ledger = appendEntry(wallet.ledger, {
    type: 'admin_adjust', amount: after - before, reason: String(reason).trim(),
  });
  saveWalletAndInvalidate(ownerId, wallet);
  return { ok: true, before, after };
}

/** Reset an owner's wallet balance to CLEAN_STARTING_BALANCE, one ledger entry recording the delta. */
export function resetOwnerWallet(ownerId, { reason = '' } = {}) {
  const wallet = walletOrEmpty(ownerId);
  const before = wallet.balance;
  const after = CLEAN_STARTING_BALANCE;
  wallet.balance = after;
  wallet.ledger = appendEntry(wallet.ledger, {
    type: 'admin_reset', amount: after - before, reason: String(reason ?? '').trim(),
  });
  saveWalletAndInvalidate(ownerId, wallet);
  return { ok: true, before, after };
}

/** The owner's wallet ledger, newest first, paged. Read-only. */
export function ownerLedger(ownerId, { limit = 50, offset = 0 } = {}) {
  const wallet = loadWallet(ownerId);
  const all = Array.isArray(wallet?.ledger) ? wallet.ledger : [];
  const newestFirst = [...all].reverse();
  const n = Math.max(1, Math.min(Math.floor(Number(limit) || 50), 200));
  const from = Math.max(0, Math.floor(Number(offset) || 0));
  return { total: newestFirst.length, rows: newestFirst.slice(from, from + n) };
}

// ── Agent lookup ─────────────────────────────────────────────────────────────

function findAgent(ownerId, agentId) {
  return agentsOf(ownerId).find((a) => a.id === agentId) ?? null;
}

// ── Agent actions ────────────────────────────────────────────────────────────

/** Rename, through naming.js's own coiner — the same rules and NAME_MAX cap every other naming path uses. */
export function renameAgent(ownerId, agentId, { name }) {
  const agent = findAgent(ownerId, agentId);
  if (!agent) return { ok: false, status: 404, error: 'Agent not found' };
  const coined = coinName(name, { fallback: null });
  if (!coined) return { ok: false, status: 400, error: `name must produce a usable name of at most ${NAME_MAX} characters` };

  const before = agent.name;
  agent.name = coined;
  saveOwner(ownerId);
  return { ok: true, before, after: coined };
}

/**
 * Hide him from the roster, reversibly, WITHOUT going through the one-way
 * /retire route: that route (agentProfiles.js's archiveAgent, not exported)
 * also collects his pocket into the wallet and is explicitly documented as
 * "cannot be undone from the API for now — an un-retire is a product
 * decision, not a route." This sets exactly the field every roster listing
 * already filters on (agentProfiles.js's isArchived() checks agent.archived
 * — activeAgents() is `agents.filter(a => !isArchived(a))`), and nothing
 * else: no pocket collection, no ledger entry, no cleared want/proposal. His
 * money and his state sit exactly as they were, so the same toggle back is a
 * full, honest undo — not a second implementation of what retirement means
 * to the economy.
 *
 * Refuses a currently-seated agent: hiding him out from under a live hand is
 * not a UI action either, and the honest fix is unseat first.
 */
export function retireAgent(ownerId, agentId) {
  const agent = findAgent(ownerId, agentId);
  if (!agent) return { ok: false, status: 404, error: 'Agent not found' };
  if (agent.archived) return { ok: true, before: true, after: true };
  const seat = seatStatusOf(agent);
  if (seat.atTable) return { ok: false, status: 409, error: 'Agent is seated at a table — unseat him first' };

  agent.archived = true;
  agent.archivedAt = Date.now();
  saveOwner(ownerId);
  return { ok: true, before: false, after: true };
}

/** The other half of retireAgent — flip the same flag back. */
export function unretireAgent(ownerId, agentId) {
  const agent = findAgent(ownerId, agentId);
  if (!agent) return { ok: false, status: 404, error: 'Agent not found' };
  const before = !!agent.archived;
  agent.archived = false;
  agent.archivedAt = null;
  saveOwner(ownerId);
  return { ok: true, before, after: false };
}

/**
 * Release his seat through the exact path the product's own /retire route
 * uses on a seated agent: benchCutSeat (wallet.js) calls table.sitOutSeat
 * with { afterHand: true } — he finishes the hand he is in and the seat
 * frees the moment it completes, cleanly, rather than being pulled out from
 * under money that is live in a pot.
 */
export function unseatAgent(ownerId, agentId) {
  const agent = findAgent(ownerId, agentId);
  if (!agent) return { ok: false, status: 404, error: 'Agent not found' };
  const tableId = agent.activeTableId ?? null;
  if (!tableId) return { ok: false, status: 409, error: 'Agent is not seated at a table' };
  const table = getTable(tableId);
  if (!table) return { ok: false, status: 409, error: 'That table no longer exists' };

  const result = benchCutSeat(table, agentId);
  if (!result.benched) return { ok: false, status: 409, error: 'Could not release the seat (already leaving, or already empty)' };
  return { ok: true, before: { tableId }, after: { tableId, benched: true } };
}

/**
 * Force fatigue and/or mood, through the two setters other trees have
 * already landed for exactly this (agentProfiles.js's own noteAgentFatigue —
 * used by table.js after a session — and setAgentMood — used the same way).
 * Both persist on their own.
 *
 * ROUTINE IS A GAP: home.js's routineFor() computes it fresh every render
 * from fatigue and time of day; nothing stores it on the agent record and no
 * setter exists to force it directly. Forcing fatigue to 'worn' changes what
 * routineFor() derives (it is what puts him to sleep in the room), which is
 * as close as this gets without inventing a stored field agentProfiles.js
 * does not have — and agentProfiles.js is off limits this job.
 */
export function forceAgentState(ownerId, agentId, { fatigue, mood } = {}) {
  const agent = findAgent(ownerId, agentId);
  if (!agent) return { ok: false, status: 404, error: 'Agent not found' };
  if (fatigue === undefined && mood === undefined) return { ok: false, status: 400, error: 'fatigue and/or mood required' };

  const before = { fatigue: agent.fatigue ?? 'fresh', mood: agent.mood ? { ...agent.mood } : null };
  const after = { ...before };

  if (fatigue !== undefined) {
    if (!['fresh', 'settled', 'worn'].includes(fatigue)) {
      return { ok: false, status: 400, error: "fatigue must be one of 'fresh', 'settled', 'worn'" };
    }
    noteAgentFatigue(agentId, ownerId, { stage: fatigue, sessionHands: agent.sessionHands ?? 0 });
    after.fatigue = fatigue;
  }
  if (mood !== undefined) {
    const state = String(mood?.state ?? agent.mood?.state ?? 'neutral');
    const heat = Number.isFinite(Number(mood?.heat)) ? Math.max(0, Math.min(100, Number(mood.heat))) : (agent.mood?.heat ?? 0);
    const written = setAgentMood(agentId, ownerId, { state, heat });
    after.mood = written;
  }
  return { ok: true, before, after };
}
