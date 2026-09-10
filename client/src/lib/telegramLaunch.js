// BUG-191/187 — did Telegram open this window?
//
// The answer decides one thing only: whether waiting for telegram.org can
// still change who the owner is. It is not a credential and it never becomes
// one — the signed initData still comes from window.Telegram.WebApp after the
// real SDK has settled, exactly as before.
//
// All three signals below are read the way the SDK itself reads them:
//
//   1. The launch fragment. Telegram appends tgWebAppData / tgWebAppPlatform /
//      tgWebAppVersion to the page URL when it opens a Mini App; that fragment
//      is where telegram-web-app.js gets initData from in the first place.
//   2. The SDK's own sessionStorage copy of those params, which is how a
//      reload inside the client still knows it is a Mini App after the client
//      has navigated the fragment away.
//   3. The native bridge the Android and iOS clients inject into the webview
//      before any script runs. The SDK checks the same object to decide it is
//      talking to a real client rather than a browser tab.
//
// A window with none of the three was not opened by Telegram, so no amount of
// waiting for an external script can turn it into a Mini App session. That is
// the whole readiness contract: presence keeps the old behaviour (wait for the
// real SDK, let initData choose), absence removes a three-second wait for an
// answer this page already has.

const SDK_SESSION_KEY = '__telegram__initParams';

export function hasTelegramLaunchSignal() {
  // (3) The native client's bridge, injected before the document's scripts.
  try {
    if (window.TelegramWebviewProxy || window.TelegramWebviewProxyProto) return true;
  } catch { /* a hostile or partial webview — fall through to the URL */ }
  // (1) The launch fragment. Telegram web puts it on the hash; a start param
  // can also arrive on the query, so both strings are read.
  try {
    const { hash = '', search = '' } = window.location ?? {};
    if (/[?&#]tgWebApp/.test(`${hash}${search}`)) return true;
  } catch { /* exotic location object — fall through to storage */ }
  // (2) The SDK's saved copy, for a reload inside the client.
  try {
    const stored = sessionStorage.getItem(SDK_SESSION_KEY);
    if (stored && /tgWebApp(Data|Platform|Version)/.test(stored)) return true;
  } catch { /* storage unavailable in a private webview */ }
  return false;
}
