// client/src/lib/guest.js — GUEST-1 job 4
//
// Playing without an account, from the browser's side.
//
// The server holds the identity — an httpOnly cookie this page cannot read and
// deliberately never gets a copy of. What the page keeps is one thing: the
// OWNER ID, because every route in this product takes `userId` as a query or
// body parameter and the client has to be able to say who it is asking about.
// The id is not a credential; the cookie is. Losing the id (a cleared
// localStorage, a private window) costs nothing — GET /api/guest/me hands it
// back from the cookie.
//
// ── THE WALL IS AN EVENT, NOT A RETURN VALUE ────────────────────────────────
//
// Every guest refusal the server sends carries `claim: true`, and the client's
// answer to all of them is the same screen. That could have been a check at
// each call site, and there are more than twenty of them — the room composer,
// the whisper, the draft, deploy, the fixtures. Twenty checks is twenty places
// for the twenty-first to be forgotten, and the one that is forgotten is a
// dead button.
//
// So it is caught in ONE place: a fetch wrapper, installed only for a guest
// session, that looks at 403s and 409s. It reads nothing else, clones before
// touching the body so no caller is affected, and fires an event the app
// listens for. A refusal the page has not been taught about still raises the
// wall, which is the correct behaviour for a limit that is decided on the
// server.

const OWNER_KEY = 'agentic_guest_owner';

// The session, in memory. `null` means "not asked yet"; a string is his id;
// false means "asked, and this browser is not a guest".
let ownerId = null;

/** The guest owner id this browser is, or null. */
export function getGuestOwner() {
  if (typeof ownerId === 'string') return ownerId;
  try {
    const stored = localStorage.getItem(OWNER_KEY);
    if (stored) { ownerId = stored; return stored; }
  } catch { /* private mode — the cookie is still the truth */ }
  return null;
}

export function isGuest() {
  return getGuestOwner() != null;
}

function remember(id) {
  ownerId = id ? String(id) : null;
  try {
    if (ownerId) localStorage.setItem(OWNER_KEY, ownerId);
    else localStorage.removeItem(OWNER_KEY);
  } catch { /* storage unavailable — this session still works, the next one re-asks */ }
  return ownerId;
}

/** Forget the guest. Called after a claim: this browser is somebody now. */
export function clearGuest() {
  return remember(null);
}

// ── Boot ────────────────────────────────────────────────────────────────────

/**
 * Is the no-account door open on this deployment, and does this browser
 * already hold a guest?
 *
 * Two questions, one shape, because the app asks both at exactly the same
 * moment and neither is useful without the other:
 *
 *   { enabled, ownerId }
 *
 * `enabled` is the server's GUEST_ENABLED. A page that renders "play without
 * an account" on a deployment that would 404 it is a dead button, so the
 * client is told rather than assuming.
 */
export async function resolveGuest() {
  let enabled = false;
  try {
    const res = await fetch('/api/auth/config');
    if (res.ok) enabled = !!(await res.json())?.guest;
  } catch { /* offline — treat the door as shut and fall through to login */ }
  if (!enabled) return { enabled: false, ownerId: null };

  // The cookie is the truth, so it is asked first: a browser that still holds
  // one is that guest, whatever localStorage remembers or has forgotten.
  try {
    const res = await fetch('/api/guest/me');
    if (res.ok) {
      const me = await res.json();
      if (me?.ownerId) return { enabled: true, ownerId: remember(me.ownerId) };
    }
  } catch { /* fall through to creating one */ }

  return { enabled: true, ownerId: null };
}

/** Mint a new guest. Returns his owner id, or null when the server refused. */
export async function startGuest() {
  try {
    const res = await fetch('/api/guest', { method: 'POST' });
    if (!res.ok) return null;
    const made = await res.json();
    return made?.ownerId ? remember(made.ownerId) : null;
  } catch {
    return null;
  }
}

/** The bot deep link for the claim, built server-side. Null when unavailable. */
export async function guestDeepLink() {
  try {
    const res = await fetch('/api/guest/link');
    if (!res.ok) return null;
    return (await res.json())?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Hand him over. The cookie is the credential and the Telegram payload is the
 * proof; both ride the request the server already knows how to read.
 */
export async function claimGuest(initData) {
  try {
    const res = await fetch('/api/guest/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': initData || '' },
      body: JSON.stringify({}),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: body?.error ?? 'claimFailed' };
    clearGuest();
    return { ok: true, ownerId: body?.ownerId ?? null, agents: body?.agents ?? 0 };
  } catch {
    return { ok: false, error: 'network' };
  }
}

// ── The wall ────────────────────────────────────────────────────────────────

const WALL_EVENT = 'agentic:claim-wall';

/**
 * Ask for the wall. `reason` is the server's error code (claimToTalk,
 * guestSessionCap, guestAgentCap) or one of ours ('sessionEnd').
 */
export function openClaimWall(reason = 'claim') {
  try {
    window.dispatchEvent(new CustomEvent(WALL_EVENT, { detail: { reason } }));
  } catch { /* no window (a test importing this module) — nothing to raise */ }
}

/** Listen for it. Returns the unsubscribe. */
export function onClaimWall(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (e) => handler(e?.detail?.reason ?? 'claim');
  window.addEventListener(WALL_EVENT, fn);
  return () => window.removeEventListener(WALL_EVENT, fn);
}

/** The refusals that mean "keep him and you can". */
export const CLAIM_ERRORS = Object.freeze(['claimToTalk', 'guestSessionCap', 'guestAgentCap']);

/**
 * Install the one-place catcher. Idempotent, and a no-op outside a guest
 * session — a browser with an account must never have its fetches wrapped.
 *
 * Only 403 and 409 bodies are inspected, so the ordinary path pays one integer
 * comparison per response and nothing else. The clone is what keeps the
 * original body untouched for whoever asked for it.
 */
let installed = false;
export function installClaimCatcher() {
  if (installed || typeof window === 'undefined' || !window.fetch) return () => {};
  installed = true;
  const original = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const res = await original(...args);
    if (res.status !== 403 && res.status !== 409) return res;
    // Best-effort by construction: a body that is not JSON, a response with no
    // clone(), or a clone that throws must never break the request it was
    // riding on. The wall is a nicety on top of a refusal the caller is about
    // to handle anyway.
    try {
      res.clone?.().json().then((body) => {
        if (body?.claim === true || CLAIM_ERRORS.includes(body?.error)) {
          openClaimWall(body?.error ?? 'claim');
        }
      }).catch(() => {});
    } catch { /* not a real Response — leave it entirely alone */ }
    return res;
  };

  return () => { window.fetch = original; installed = false; };
}

/** Tests only: forget the module's memory of the session. */
export function _resetForTests() {
  ownerId = null;
  installed = false;
  try { localStorage.removeItem(OWNER_KEY); } catch { /* nothing to clear */ }
}
