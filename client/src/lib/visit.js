// client/src/lib/visit.js — VISIT-1
//
// Send him to a friend's flat, and answer the door when somebody sends theirs.
//
// Three calls, none of them owning any UI: the roster's "Send to a friend"
// button builds a link and hands it to whatever the OS can do with a link;
// the door's own POST is made by the recipient's client, at the far end of
// that link (see useDeepLink); and the toast's yes/no answers the knock.

import { getUserId, getTelegramInitData } from './telegram.js';

/** visit_<invitationToken> — the deep link prefix guest.js's own GUEST_START_PREFIX
 * is the sibling of. Read back by lib/deeplink.js's parseStartParam. */
export const VISIT_START_PREFIX = 'visit_';

export function canSendVisiting(agent) {
  return (agent?.location?.where ?? 'home') === 'home' && !agent?.visiting && !agent?.activeTableId;
}

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
async function prepareInvitation(agentId, agentName) {
  try {
    const res = await fetch('/api/auth/config');
    if (!res.ok) return { ok: false, reason: 'noLink' };
    const { botUsername } = await res.json();
    const bot = String(botUsername || '').replace(/^@/, '');
    if (!/^[a-zA-Z0-9_]+$/.test(bot)) return { ok: false, reason: 'noLink' };
    const made = await fetch(`/api/agents/${encodeURIComponent(agentId)}/visit-invite`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ userId: getUserId(), stake: 0 }),
    });
    const body = await made.json().catch(() => null);
    if (!made.ok) return { ok: false, reason: body?.reason || body?.error || 'invitationFailed', body };
    if (!body?.invitationToken || body.startParam !== `${VISIT_START_PREFIX}${body.invitationToken}` || body.maxStake !== 0) {
      return { ok: false, reason: 'invitationFailed' };
    }
    const url = `https://t.me/${bot}?start=${encodeURIComponent(body.startParam)}`;
    const title = `${body.agentName || agentName || 'My agent'} wants a game`;
    const text = `${title} at your place in Railbird. Open this invitation to let him in. Free home game · no chips staked.`;
    return { ok: true, url, title, text, expiresAt: body.expiresAt };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export async function visitLink(agentId) {
  return (await prepareInvitation(agentId))?.url ?? null;
}

/**
 * Hand the link to whatever the OS/browser can do with one — the share sheet
 * where it exists, the clipboard otherwise. Returns how it went, so the
 * button can say so ("Copied" rather than nothing happening).
 */
export async function shareVisitLink(agentId, agentName = 'Him', prepared = null) {
  const invitation = prepared?.url && prepared.expiresAt > Date.now() ? prepared : await prepareInvitation(agentId, agentName);
  if (!invitation.url) return invitation;
  const { url, title, text } = invitation;

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { ...invitation, ok: true, via: 'share' };
    } catch (error) {
      return { ...invitation, ok: false, reason: error?.name === 'AbortError' ? 'cancelled' : 'shareFailed' };
    }
  }
  return copyVisitInvitation(invitation);
}

/** Reuse the prepared invitation when a share sheet was cancelled or blocked. */
export async function copyVisitInvitation(invitation) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(`${invitation.text}\n\n${invitation.url}`);
      return { ...invitation, ok: true, via: 'clipboard' };
    } catch { return { ...invitation, ok: false, reason: 'clipboardFailed' }; }
  }
  return { ...invitation, ok: false, reason: 'clipboardUnavailable' };
}

/**
 * The one thing worth knowing before an account exists: his name. Public, no
 * auth — see the route's own note for why that is safe.
 */
export async function resolveVisitInvitation(invitationToken) {
  try {
    const res = await fetch(`/api/visit-invites/${encodeURIComponent(invitationToken)}`);
    const body = await res.json().catch(() => null);
    return { ok: res.ok && !!body?.agentId, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

export async function visitPreview(invitationToken) {
  const result = await resolveVisitInvitation(invitationToken);
  return result.ok ? result.body : null;
}

/**
 * The far end of the deep link: the RECIPIENT's own client asks the door to
 * open. `hostUserId` is always the caller's own id — the agent's owner never
 * touches this route, which is what lets the server validate ownership on the
 * door being knocked on rather than the man doing the knocking.
 */
export async function requestVisit(invitationToken) {
  const preview = await resolveVisitInvitation(invitationToken);
  if (!preview.ok) return preview;
  const { agentId, agentName } = preview.body;
  const hostUserId = getUserId();
  try {
    const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/visit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ hostUserId, stake: 0, invitationToken }),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body, agentName };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

/** Specific refusal copy; unknown transport failures remain retryable. */
export function visitErrorText(result) {
  const reason = result?.body?.reason || result?.body?.error || result?.reason;
  const lines = {
    invitationExpired: 'This invitation has expired. Ask your friend for a new invitation.',
    invitationUsed: 'This invitation has already been used. Ask your friend for a new invitation.',
    invitationRequired: 'This invitation is not valid. Ask your friend for a new invitation.',
    stakeNotAuthorized: 'This invitation is for a free home game only.',
    notHome: 'He needs to be home before he can visit. Please try again when he is back.',
    inHand: 'He is in a hand. Try again when it finishes.',
    hostBusy: 'Your room is busy. Please try again when the game finishes.',
    guestUnavailable: 'He is not available to visit yet. Try again when he is home.',
    hostFull: 'Your room is full. Make room, then try again.',
    hostInHand: 'Your table is in a hand. Try again when it finishes.',
    hostPaused: 'Your home game is paused. Resume it, then try again.',
    hostUnavailable: 'Your room is not ready yet. Please try again.',
    visitExpired: 'He has left the door. Ask your friend for a new invitation.',
    visitUnavailable: 'Could not answer the door. Please try again.',
    noLink: 'Invitations are unavailable right now. Please try again later.',
  };
  if (lines[reason]) return lines[reason];
  if (result?.status === 404 || result?.status === 410) return lines.invitationExpired;
  return 'Could not open the invitation. Please try again.';
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
