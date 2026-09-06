import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import LoginGate from './components/LoginGate.jsx';
import { initTelegram, isMiniAppSession, getWebLogin } from './lib/telegram.js';
import { resolveGuest, startGuest, installClaimCatcher } from './lib/guest.js';
import './styles/index.css';

// AUTH-1 — two ways in: the Telegram Mini App (initData) and the web Login
// Widget (LoginGate).
//
// GUEST-1 — and now a third, which changes what happens to a visitor holding
// NEITHER. Before this, the production domain sent him to the marketing page
// and everywhere else put the login widget in front of him. Wave 61's rule is
// that the landing IS the game: a stranger arrives, reads one screen, and
// starts drafting — no account, no install, no redirect.
//
// The order below is the order of certainty, and it does not change:
//
//   1. A Mini App session. The credential is in the page; nothing to ask.
//   2. A stored web login. Same, replayed as the same header.
//   3. The guest door, IF the server says it is open. GET /api/auth/config
//      answers that, so a deployment with GUEST_ENABLED unset never renders a
//      button that would 404 — it falls through to (4) exactly as before.
//   4. The login widget, which is what everybody without an account got until
//      today.
//
// Everything after (2) is asynchronous, which is why the render moved inside a
// function: the first two paths still render on the same tick they always did,
// and only a visitor who has no credential at all waits for one round trip.

const root = createRoot(document.getElementById('root'));

function render(tree) {
  root.render(<StrictMode>{tree}</StrictMode>);
}

async function boot() {
  // (1) and (2): a credential is already here.
  //
  // initTelegram() is called INSIDE each branch that mounts something, never
  // before the branching. LAND-2's rule is that a visitor who is about to be
  // redirected to the marketing page never has the SDK initialised at all, and
  // initialising it up here to save three lines would quietly break that.
  if (isMiniAppSession()) { initTelegram(); return render(<App />); }
  if (getWebLogin() != null) { initTelegram(); return render(<LoginGate><App /></LoginGate>); }

  // (3): is the no-account door open, and are we already through it?
  const { enabled, ownerId } = await resolveGuest();
  if (enabled) {
    initTelegram();
    // Every guest refusal, from anywhere, raises the same wall. Installed
    // before the first render so nothing can slip past it, and only ever for a
    // guest — a browser with an account must not have its fetches wrapped.
    installClaimCatcher();

    if (ownerId) return render(<App guestBoot="returning" />);

    // Nobody yet — mint one and open into the flat with the recruiter already
    // talking (G1). The five-a-day-per-address cap is what bounds a crawler
    // or a bounced tab; see guest.js for why that cap is rows rather than a
    // Map. A server that refuses falls through to the login door rather than
    // rendering an app with no owner behind it.
    const made = await startGuest();
    if (made) return render(<App guestBoot="new" />);
  }

  // (4): the door that was always here.
  //
  // The marketing redirect is kept for the deployment where guests are off, so
  // turning GUEST_ENABLED off on the VPS restores today's behaviour exactly.
  const wantsLogin = new URLSearchParams(window.location.search).has('login');
  if (window.location.hostname === 'agenticpoker.app' && !wantsLogin) {
    window.location.replace('/welcome');
    return undefined;
  }
  initTelegram();
  return render(<LoginGate><App /></LoginGate>);
}

// Exported so a test can await the decision. Deciding which of the four doors
// a visitor came through now needs one round trip (is the guest door open?),
// so boot is async where it used to run at module scope — and `await import()`
// resolves when the MODULE has evaluated, not when its promise has settled.
export const booted = boot();
