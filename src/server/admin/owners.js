// src/server/admin/owners.js — ADMIN-1 job 3
//
// The two lists: a row per owner, and the last fifty agents born.
//
// The tiles on the page say how the game is doing. These say WHO — which is a
// different question and the one you ask second, when a tile has moved and you
// want to know whether it was fifty people or one. Read-only, ADMIN_KEY, and
// one statement each.
//
// Two rules about identity, because this is the only surface in the product
// that shows one owner's data to somebody who is not him:
//
//   1. THE ID IS MASKED, ALWAYS, AND MASKED HERE. Never the whole Telegram id;
//      the last four characters and nothing else. Four is enough to tell two
//      rows apart on a screen and to match a row against a support message,
//      and it is not enough to open a chat with somebody. The masking happens
//      in the query result, not in the page, so there is no version of this
//      endpoint whose JSON carries the full id and no client mistake that can
//      reveal it.
//   2. NOTHING PRIVATE TRAVELS. No chat, no strategy text, no hole cards, no
//      hand history. Counts, timestamps and money — the things a row has to
//      carry to be a row.

import { adminDb } from '../store.js';
import * as registry from '../tableRegistry.js';
import { FALLBACK_STRATEGIES } from './stats.js';

const DAY = 24 * 60 * 60 * 1000;

export const OWNERS_DEFAULT_LIMIT = 50;
export const OWNERS_MAX_LIMIT = 500;
export const RECENT_BIRTHS = 50;

// Rule 1. A guest id (g_ plus nine random bytes) and a Telegram id (digits)
// both mask the same way — there is no format here that is safe to print in
// full, so there is no branch that prints one.
export function maskOwnerId(id) {
  const s = String(id ?? '');
  return s.length <= 4 ? `…${s}` : `…${s.slice(-4)}`;
}

const utcDay = (at) => new Date(at).toISOString().slice(0, 10);

// Sortable by any column, from a fixed map rather than by interpolating what
// the caller sent: a sort parameter that reaches SQL is an injection whatever
// the surrounding validation looks like today.
export const OWNER_SORTS = Object.freeze({
  lastSeen: 'last_seen DESC',
  agents: 'agents DESC',
  hands7d: 'hands_7d DESC',
  usd7d: 'usd_7d DESC',
  chips: 'chips DESC',
  guest: 'is_guest DESC, last_seen DESC',
  name: 'name COLLATE NOCASE ASC',
  id: 'owner_id ASC',
});

/**
 * A row per owner.
 *
 * One statement. Every per-owner number is a correlated aggregate rather than
 * a query in a loop, because the loop version is 500 owners times six
 * statements on the page that refreshes every minute.
 *
 * `name` is the name of his OLDEST agent, not his own: the database holds no
 * human name for an owner anywhere (Telegram's is verified and thrown away,
 * a guest never had one), and his first agent is the only handle that ever
 * appears on a screen beside him.
 */
export function ownerRows({ sort = 'lastSeen', limit = OWNERS_DEFAULT_LIMIT, now = Date.now() } = {}) {
  const db = adminDb();
  const order = OWNER_SORTS[sort] ?? OWNER_SORTS.lastSeen;
  const n = Math.max(1, Math.min(Math.floor(Number(limit) || OWNERS_DEFAULT_LIMIT), OWNERS_MAX_LIMIT));
  const since7Day = utcDay(now - 6 * DAY);

  const rows = db.prepare(`
    SELECT o.owner_id AS owner_id,
           (SELECT a.name FROM agents a WHERE a.owner_id = o.owner_id
             ORDER BY a.created_at, a.id LIMIT 1)                                        AS name,
           (SELECT COUNT(*) FROM agents a WHERE a.owner_id = o.owner_id)                 AS agents,
           MAX(COALESCE((SELECT MAX(last_seen) FROM owner_activity v WHERE v.owner_id = o.owner_id), 0),
               COALESCE((SELECT MAX(last_seen_at) FROM guests g WHERE g.owner_id = o.owner_id), 0)) AS last_seen,
           COALESCE((SELECT SUM(w.hands) FROM watch_hands w
                      WHERE w.owner_id = o.owner_id AND w.day >= ?), 0)                  AS hands_7d,
           COALESCE((SELECT SUM(m.usd) FROM model_calls m
                      WHERE m.owner_id = o.owner_id AND m.day >= ?), 0)                  AS usd_7d,
           COALESCE((SELECT balance FROM wallets wa WHERE wa.owner_id = o.owner_id), 0)
             + COALESCE((SELECT SUM(pocket_balance) FROM agents a WHERE a.owner_id = o.owner_id), 0) AS chips,
           EXISTS(SELECT 1 FROM guests g WHERE g.owner_id = o.owner_id AND g.claimed_by IS NULL)     AS is_guest
      FROM (SELECT owner_id FROM profiles UNION SELECT owner_id FROM wallets) o
     ORDER BY ${order}
     LIMIT ?
  `).all(since7Day, since7Day, n);

  return rows.map((r) => ({
    id: maskOwnerId(r.owner_id),
    name: r.name ?? null,
    agents: r.agents ?? 0,
    lastSeen: r.last_seen || null,
    hands7d: r.hands_7d ?? 0,
    usd7d: Math.round((r.usd_7d ?? 0) * 1e6) / 1e6,
    chips: r.chips ?? 0,
    guest: !!r.is_guest,
  }));
}

export const OWNER_ROWS_DEFINITION =
  'One row per owner id in profiles UNION wallets, ordered by the requested column. '
  + 'id: the last four characters only — the full id never leaves the server. '
  + 'name: the name of his OLDEST agent, because the database holds no human name for an owner anywhere. '
  + 'agents: COUNT(*) FROM agents. '
  + 'lastSeen: the later of MAX(owner_activity.last_seen) and MAX(guests.last_seen_at), epoch ms. '
  + 'hands7d: SUM(watch_hands.hands) over the last 7 UTC days — the meter\'s own per-owner hand count. '
  + 'usd7d: SUM(model_calls.usd) over the same days. '
  + 'chips: his wallet balance plus every pocket on his roster. '
  + 'guest: he has an UNCLAIMED row in guests.';

/**
 * The last fifty agents born, newest first.
 *
 * "Where he is now" is answered from the LIVE registry and not from the stored
 * status, because BUG-16's law holds here too: the table is the witness. A
 * record that says "playing" after a restart is a record that is wrong, and a
 * dashboard repeating it is a dashboard that hides the very thing you opened
 * it to find.
 */
export function recentBirths({ limit = RECENT_BIRTHS } = {}) {
  const db = adminDb();
  const n = Math.max(1, Math.min(Math.floor(Number(limit) || RECENT_BIRTHS), OWNERS_MAX_LIMIT));

  const rows = db.prepare(`
    SELECT owner_id, id, name, created_at, active_table_id,
           json_extract(data, '$.strategy')          AS strategy,
           json_extract(data, '$.archived')          AS archived,
           json_extract(data, '$.visiting.visitId')  AS visiting,
           json_extract(data, '$.stats.handsPlayed') AS hands
      FROM agents
     ORDER BY created_at DESC, id DESC
     LIMIT ?
  `).all(n);

  const fallback = new Set(FALLBACK_STRATEGIES);
  return rows.map((r) => ({
    owner: maskOwnerId(r.owner_id),
    id: r.id,
    name: r.name ?? null,
    bornAt: r.created_at ?? null,
    fallback: fallback.has(r.strategy ?? ''),
    hands: r.hands ?? 0,
    where: whereIs(r),
  }));
}

// The five answers, in the order they beat each other. Wrapped: the registry is
// in memory and an exception out of it must cost one row's location, not the
// whole list.
function whereIs(row) {
  try {
    if (row.archived === 1 || row.archived === true) return 'retired';
    if (row.visiting) return 'visiting';
    if (row.active_table_id && registry.hasTable(row.active_table_id)) return 'casino';
    if (registry.homeTableOf(row.id)) return 'home game';
    return 'home';
  } catch {
    return 'unknown';
  }
}

export const RECENT_BIRTHS_DEFINITION =
  'The last 50 rows of agents by created_at DESC. '
  + 'owner: masked to the last four characters. '
  + 'fallback: his strategy is EXACTLY one of inferFallback()\'s three canned strings (BUG-46) — on a deployment with a key this is always false. '
  + 'hands: agent.stats.handsPlayed, his lifetime count. '
  + 'where: asked of the LIVE table registry, not of his stored status — retired, visiting, casino, home game, or home. A stored "playing" that survived a restart is wrong, and this is the surface that has to show that rather than repeat it.';
