// Thin wrapper around the Telegram Web App SDK loaded before owner selection
// by telegramSdk.js. Safe to call outside Telegram (returns null) so the app still
// works when opened directly in a browser for development.

import { getGuestOwner } from './guest.js';

export function getWebApp() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
}

// Call once at app startup. ready() tells Telegram the UI is rendered;
// expand() asks Telegram to make the Mini App full-height.
// disableVerticalSwipes() stops Telegram from intercepting downward drags
// as a "minimize the Mini App" gesture — required for our sheet drag to work.
export function initTelegram() {
  const tg = getWebApp();
  if (!tg) return null;
  try { tg.ready(); } catch {}
  try { tg.expand(); } catch {}
  try { tg.disableVerticalSwipes?.(); } catch {}
  return tg;
}

// AUTH-1 — web login (Telegram Login Widget) session store.
// The widget hands us a signed payload object; we keep it verbatim in
// localStorage and replay it as the same x-telegram-init-data credential the
// Mini App sends. The server verifies it with the widget signature scheme.
// Everything here is try/catch'd: localStorage throws in private-mode webviews.
const WEB_LOGIN_KEY = 'agentic_tg_login';

export function setWebLogin(payload) {
  try {
    if (!payload || typeof payload !== 'object') return;
    localStorage.setItem(WEB_LOGIN_KEY, JSON.stringify(payload));
  } catch { /* storage unavailable — session just won't persist */ }
}

export function getWebLogin() {
  try {
    const raw = localStorage.getItem(WEB_LOGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.hash ? parsed : null;
  } catch {
    return null;
  }
}

export function clearWebLogin() {
  try { localStorage.removeItem(WEB_LOGIN_KEY); } catch {}
}

// Returns the Telegram user object: { id, first_name, last_name, username, ... }
// or null. Read at call time, not module load — initDataUnsafe is populated
// only after the SDK script loads. Outside Telegram, falls back to the stored
// Login Widget payload, which carries the same fields at the top level.
export function getTelegramUser() {
  const tg = getWebApp();
  return tg?.initDataUnsafe?.user || getWebLogin() || null;
}

// Best-effort display name from a Telegram user. Prefers first_name, falls
// back to username, then a generic placeholder.
export function getTelegramDisplayName() {
  const u = getTelegramUser();
  if (!u) return '';
  return (u.first_name || u.username || '').toString().trim();
}

export function isInTelegram() {
  return getWebApp() != null;
}

// AUTH-1 — stricter than isInTelegram(): the SDK script defines
// window.Telegram.WebApp in *every* browser, so the only reliable signal that
// we are really running as a Mini App is a non-empty initData string. That is
// also exactly the condition under which the initData credential is usable.
export function isMiniAppSession() {
  return !!getWebApp()?.initData;
}

// True when this browser can present a credential the server will accept —
// either a real Mini App session or a stored web login. Used by the login gate.
export function isAuthenticated() {
  return isMiniAppSession() || getWebLogin() != null;
}

// Keep keyboard-aware containers inside both Telegram and the visible browser
// bounds. Either can report a smaller height first during a resize/keyboard
// transition; a late SDK event must not put the footer below the window.
// Without SDK/visual viewport measurements, leave CSS's 100dvh fallback intact.
// Returns a cleanup function suitable for useEffect.
export function initViewportTracking() {
  const tg = window.Telegram?.WebApp;
  const viewport = window.visualViewport;
  const positive = value => Number.isFinite(value) && value > 0;
  let unzoomedVisualHeight;
  function update() {
    // Pinch zoom changes visible CSS pixels without changing layout height.
    // Retain the last normal-scale bound, including an already-open keyboard,
    // until normal-scale measurements resume instead of shrinking or growing
    // the application merely because the user zoomed.
    if (viewport && Math.abs((viewport.scale ?? 1) - 1) < 0.01) {
      unzoomedVisualHeight = positive(viewport.height) ? viewport.height : undefined;
    }
    const bounds = [tg?.viewportHeight, unzoomedVisualHeight].filter(positive);
    if (!bounds.length) return;
    if (positive(window.innerHeight)) bounds.push(window.innerHeight);
    document.documentElement.style.setProperty('--tg-h', `${Math.round(Math.min(...bounds))}px`);
  }
  update();
  tg?.onEvent('viewportChanged', update);
  window.addEventListener('resize', update);
  viewport?.addEventListener('resize', update);
  return () => {
    tg?.offEvent('viewportChanged', update);
    window.removeEventListener('resize', update);
    viewport?.removeEventListener('resize', update);
  };
}

// Returns the credential string sent as x-telegram-init-data. Inside Telegram
// that is the Mini App initData; on the web it is the stored Login Widget
// payload serialised the same way (all fields including hash), which the
// server verifies with the widget signature scheme. Empty string when neither
// exists (local dev).
export function getTelegramInitData() {
  if (isMiniAppSession()) return getWebApp().initData;
  const login = getWebLogin();
  if (!login) return '';
  try {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(login)) {
      if (v === null || v === undefined) continue;
      params.append(k, String(v));
    }
    return params.toString();
  } catch {
    return '';
  }
}

// Stable per-device user ID. Uses the Telegram user ID when inside the Mini
// App, then the web login's Telegram ID, so the same account sees the same
// agents in both places. Only an unauthenticated browser falls back to a
// localStorage-persisted random ID with its own isolated agent store.
export function getUserId() {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
  if (tgId) return tgId;
  const webId = getWebLogin()?.id;
  if (webId !== null && webId !== undefined && webId !== '') return String(webId);
  // GUEST-1: a guest session, third and last of the real identities. It sits
  // BELOW both Telegram ids on purpose — a browser that has just claimed still
  // holds a stale guest id for a moment, and the account it became must win —
  // and ABOVE the random local id, which is not an identity at all, only a way
  // for a keyless dev box to keep its own agents apart.
  const guestId = getGuestOwner();
  if (guestId) return guestId;
  let id = localStorage.getItem('agentic_uid');
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    localStorage.setItem('agentic_uid', id);
  }
  return id;
}
