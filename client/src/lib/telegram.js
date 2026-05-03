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

export function getTelegramUser() {
  const tg = getWebApp();
  return tg?.initDataUnsafe?.user || null;
}

export function isInTelegram() {
  return getWebApp() != null;
}
