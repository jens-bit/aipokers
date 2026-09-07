import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import LoginGate from './components/LoginGate.jsx';
import { GuestLanding } from './components/guest/GuestLanding.jsx';
import { initTelegram, isMiniAppSession, getWebLogin } from './lib/telegram.js';
import { resolveGuest, startGuest, installClaimCatcher } from './lib/guest.js';
import { visitPreview, rememberPendingVisitor, requestVisit } from './lib/visit.js';
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

    // VISIT-1 job 6: a friend's invite, carried as a plain query param rather
    // than a Telegram start param — a real Mini App launch never reaches this
    // branch at all (door 1 above already took it), so this is specifically
    // the "no Telegram, no account" reader of the same link.
    const visitAgentId = new URLSearchParams(window.location.search).get('visit');

    if (ownerId) {
      // He already has a household. The special hero is for a stranger with
      // none yet — a returning guest's flat already has the answer, so this
      // is job 1's own knock, made straight away rather than staged behind a
      // birth that already happened.
      if (visitAgentId) requestVisit(visitAgentId).catch(() => {});
      return render(<App guestBoot="returning" />);
    }

    const visitor = visitAgentId ? await visitPreview(visitAgentId) : null;

    // Nobody yet — mint one, and land him on the page that IS the game (job
    // 6): one hero viewport, and the room itself directly under it with the
    // recruiter already talking (G1). The five-a-day-per-address cap is what
    // bounds a crawler or a bounced tab; see guest.js for why that cap is rows
    // rather than a Map. A server that refuses falls through to the login door
    // rather than rendering an app with no owner behind it.
    const made = await startGuest(visitor ? visitAgentId : null);
    if (made) {
      // VISIT-1 job 6: "someone is at your door" — the draft's opening line
      // (BirthScreen.jsx) reads this back once, the first time it renders.
      if (visitor) rememberPendingVisitor(visitor.agentName);
      return render(<GuestLanding visitorName={visitor?.agentName ?? null} />);
    }
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
