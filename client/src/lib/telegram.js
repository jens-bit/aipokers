// Thin wrapper around the Telegram Web App SDK loaded by the script tag in
// index.html. Safe to call outside Telegram (returns null) so the app still
// works when opened directly in a browser for development.

export function getWebApp() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
}

// Call once at app startup. ready() tells Telegram the UI is rendered;
// expand() asks Telegram to make the Mini App full-height.
export function initTelegram() {
  const tg = getWebApp();
  if (!tg) return null;
  try { tg.ready(); } catch {}
  try { tg.expand(); } catch {}
  return tg;
}

// Returns the Telegram user object: { id, first_name, last_name, username, ... }
// or null. Read at call time, not module load — initDataUnsafe is populated
// only after the SDK script loads.
export function getTelegramUser() {
  const tg = getWebApp();
  return tg?.initDataUnsafe?.user || null;
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

// Stable per-device user ID. Uses Telegram user ID when inside the Mini App,
// otherwise falls back to a localStorage-persisted random ID so every browser
// tab gets its own isolated agent store.
export function getUserId() {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
  if (tgId) return tgId;
  let id = localStorage.getItem('agentic_uid');
  if (!id) {
    id = 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    localStorage.setItem('agentic_uid', id);
  }
  return id;
}
