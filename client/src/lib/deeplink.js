// client/src/lib/deeplink.js — DEEPLINK-1
//
// The other end of the links NOTIFY and SHARE already send. Both build a
// Telegram deep link of the form `<mini app>?startapp=<param>`:
//
//   agent_<agentId>            src/server/notify.js — every inline button
//   hand_<agentId>_<handId>    src/server/share.js  shareOpenUrl()
//   table_<tableId>            the watch on a table
//
// Telegram hands the param back as `initDataUnsafe.start_param`. An agent id
// is itself `agent_<base36>` (agentProfiles.js), so `agent_agent_m3x9q1` is
// the ordinary case and a parser that splits on `_` is wrong: the PREFIX is
// stripped and the remainder is the payload, with the hand id taken off the
// END because a hand number never contains an underscore and an agent id
// always may.
//
// Nothing here touches React. Reading the param, parsing it, and resolving it
// against the API are three separable things, and only the last one needs the
// network — which is what lets the parser be tested without one.

import { getTelegramInitData, getUserId, getWebApp } from './telegram.js';

// ── Parsing ─────────────────────────────────────────────────────────────────

/**
 * A start param → a route, or null when it is not one of ours. Unknown params
 * are not an error: Telegram will happily deliver anything, and a link from a
 * future version of the bot must land the app on its home screen rather than
 * on a crash.
 */
export function parseStartParam(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) return null;

  if (s.startsWith('agent_')) {
    const agentId = s.slice(6);
    return agentId ? { kind: 'agent', agentId } : null;
  }

  if (s.startsWith('hand_')) {
    const rest = s.slice(5);
    // The LAST underscore: everything before it is the agent id, which has one
    // of its own. `hand_agent_m3x9q1_37` → agent_m3x9q1 / 37.
    const cut = rest.lastIndexOf('_');
    if (cut <= 0) return null;
    const agentId = rest.slice(0, cut);
    const handId  = rest.slice(cut + 1);
    return agentId && handId ? { kind: 'hand', agentId, handId } : null;
  }

  if (s.startsWith('table_')) {
    const tableId = s.slice(6);
    return tableId ? { kind: 'table', tableId } : null;
  }

  return null;
}

// ── Reading it off the launch ───────────────────────────────────────────────

/**
 * The start param this launch carries, or ''. The SDK is asked first; it is
 * the only source inside Telegram. The two URL forms are the fallback so a
 * link still works in the browser build (AUTH-1 web login) and so a param that
 * arrived after launch — Telegram rewrites the hash rather than reloading — is
 * seen even when the SDK's cached copy is stale.
 */
export function readStartParam() {
  const fromSdk = getWebApp()?.initDataUnsafe?.start_param;
  if (fromSdk) return String(fromSdk);
  try {
    const hash = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''));
    const fromHash = hash.get('tgWebAppStartParam');
    if (fromHash) return fromHash;
    const query = new URLSearchParams(window.location.search || '');
    return query.get('tgWebAppStartParam') || query.get('startapp') || '';
  } catch {
    return '';
  }
}

/**
 * Calls back with the start param whenever it CHANGES while the app is open —
 * the second tap on a notification, with the Mini App already in front. The
 * current value is the seed, not a first callback: a cold start is the caller's
 * own business and handling it here would deliver it twice.
 *
 * Telegram fires `activated` when the app is brought back to the front (Bot
 * API 8.0) and rewrites the launch hash when the param changes, so both are
 * listened to; whichever arrives first wins and the other is a no-op because
 * the value is compared, not the event.
 */
export function subscribeStartParam(onChange) {
  let last = readStartParam();

  const check = () => {
    const next = readStartParam();
    if (next === last) return;
    last = next;
    if (next) onChange(next);
  };

  const tg = getWebApp();
  try { tg?.onEvent?.('activated', check); } catch { /* older SDK */ }
  window.addEventListener('hashchange', check);
  window.addEventListener('popstate', check);

  return () => {
    try { tg?.offEvent?.('activated', check); } catch { /* older SDK */ }
    window.removeEventListener('hashchange', check);
    window.removeEventListener('popstate', check);
  };
}

// ── Resolving it against the API ────────────────────────────────────────────

const authHeaders = () => ({ 'x-telegram-init-data': getTelegramInitData() });

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** The roster, or [] when it cannot be read. */
async function roster() {
  const data = await getJson(`/api/agents?userId=${encodeURIComponent(getUserId())}`);
  return Array.isArray(data?.agents) ? data.agents : [];
}

/**
 * A route → what the app should actually open, with the records already
 * fetched. Null when the link points at nothing this owner has.
 *
 *   { kind: 'agent', agent }
 *   { kind: 'hand',  agent, hand }
 *   { kind: 'table', tableId, agent }   agent may be null — a table can be
 *                                       watched without knowing whose it is
 */
export async function resolveDeepLink(route) {
  if (!route) return null;

  if (route.kind === 'table') {
    // Who is at that table, if he is one of ours. It is what lets the watch
    // screen offer his thread; a table with nobody of ours at it is still
    // watchable, so this never fails the link.
    const agent = (await roster()).find((a) => a.activeTableId === route.tableId) ?? null;
    return { kind: 'table', tableId: route.tableId, agent };
  }

  const agent = (await roster()).find((a) => a.id === route.agentId) ?? null;
  if (!agent) return null;

  if (route.kind === 'agent') return { kind: 'agent', agent };

  const hand = await findFlaggedHand(route.agentId, route.handId);
  // The theatre is driven by the flagged entry's `streets` (replay/timeline.js);
  // recentHands has no such shape, so a hand that has aged out of this session's
  // flagged list cannot be replayed. The tap then lands on the agent it was
  // about rather than on an error — which is the whole message anyway.
  if (!hand) return { kind: 'agent', agent };
  return { kind: 'hand', agent, hand: { ...hand, agentName: agent.name } };
}

async function findFlaggedHand(agentId, handId) {
  const data = await getJson(
    `/api/agents/${encodeURIComponent(agentId)}/flagged?userId=${encodeURIComponent(getUserId())}`,
  );
  const hands = Array.isArray(data?.flaggedHands) ? data.flaggedHands : [];
  return hands.find((h) => String(h?.handNumber) === String(handId)) ?? null;
}
