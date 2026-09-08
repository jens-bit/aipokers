// client/src/lib/visit.js — VISIT-1
//
// Send him to a friend's flat, and answer the door when somebody sends theirs.
//
// Three calls, none of them owning any UI: the roster's "Send to a friend"
// button builds a link and hands it to whatever the OS can do with a link;
// the door's own POST is made by the recipient's client, at the far end of
// that link (see useDeepLink); and the toast's yes/no answers the knock.

import { getUserId, getTelegramInitData } from './telegram.js';

/** visit_<agentId> — the deep link prefix guest.js's own GUEST_START_PREFIX
 * is the sibling of. Read back by lib/deeplink.js's parseStartParam. */
export const VISIT_START_PREFIX = 'visit_';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  'X-Telegram-Init-Data': getTelegramInitData() || '',
});

/**
 * The link a "Send to a friend" button hands off. Built from GET
 * /api/auth/config's botUsername — the same field the web login widget and
 * GUEST-1's claim wall already read, so a deployment with no bot configured
 * draws the button disabled rather than a link to nowhere.
 */
export async function visitLink(agentId) {
  try {
    const res = await fetch('/api/auth/config');
    if (!res.ok) return null;
    const { botUsername } = await res.json();
    if (!botUsername) return null;
    return `https://t.me/${botUsername}?start=${VISIT_START_PREFIX}${agentId}`;
  } catch {
    return null;
  }
}

/**
 * Hand the link to whatever the OS/browser can do with one — the share sheet
 * where it exists, the clipboard otherwise. Returns how it went, so the
 * button can say so ("Copied" rather than nothing happening).
 */
export async function shareVisitLink(agentId, agentName = 'Him') {
  const url = await visitLink(agentId);
  if (!url) return { ok: false, reason: 'noLink' };

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: `${agentName} wants a game`, url });
      return { ok: true, via: 'share' };
    } catch {
      // A cancelled share sheet is not a failure worth reporting.
      return { ok: true, via: 'share' };
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return { ok: true, via: 'clipboard', url };
    } catch { /* fall through */ }
  }
  return { ok: true, via: 'link', url };
}

/**
 * The one thing worth knowing before an account exists: his name. Public, no
 * auth — see the route's own note for why that is safe.
 */
export async function visitPreview(agentId) {
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/visit-preview`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * The far end of the deep link: the RECIPIENT's own client asks the door to
 * open. `hostUserId` is always the caller's own id — the agent's owner never
 * touches this route, which is what lets the server validate ownership on the
 * door being knocked on rather than the man doing the knocking.
 */
export async function requestVisit(agentId) {
  const hostUserId = getUserId();
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/visit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ hostUserId, stake: 0 }),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

// ── job 6: the handoff from the landing hero to the draft ──────────────────
//
// GuestLanding knows the visitor's name (it fetched visit-preview to draw the
// hero); BirthScreen is what writes the draft's opening line, four
// components and one scroll later. sessionStorage rather than a prop threaded
// through all of it — this is one tab's one referral, gone the moment the
// draft has read it or the tab closes, and neither of those is a shape a prop
// chain answers well.

const PENDING_VISITOR_KEY = 'agentic_visit_pending';

export function rememberPendingVisitor(name) {
  try { sessionStorage.setItem(PENDING_VISITOR_KEY, name || ''); } catch { /* private mode, etc. */ }
}

/** Read once, by the draft's opening line — call clearPendingVisitor after. */
export function pendingVisitorName() {
  try { return sessionStorage.getItem(PENDING_VISITOR_KEY) || null; } catch { return null; }
}

export function clearPendingVisitor() {
  try { sessionStorage.removeItem(PENDING_VISITOR_KEY); } catch { /* nothing to clear */ }
}

/** The host's own yes or no. */
export async function answerVisit(visitId, accept) {
  const hostUserId = getUserId();
  try {
    const res = await fetch(`/api/home/visitors/${encodeURIComponent(visitId)}/answer`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ hostUserId, accept }),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}
