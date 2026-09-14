import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { BrandLoading } from './components/system/BrandLoading.jsx';
import { initTelegram, isMiniAppSession, getWebLogin } from './lib/telegram.js';
import { loadTelegramSdk } from './lib/telegramSdk.js';
import { hasTelegramLaunchSignal } from './lib/telegramLaunch.js';
import { resolveGuest, startGuest, installClaimCatcher } from './lib/guest.js';
import { resolveVisitInvitation, rememberPendingVisitor, visitErrorText } from './lib/visit.js';
import { parseStartParam, readStartParam } from './lib/deeplink.js';
import './styles/index.css';
import { installAudioUnlock } from './lib/audio.js';
const removeAudioUnlock=installAudioUnlock();
if(import.meta.hot)import.meta.hot.dispose(removeAudioUnlock);

// BUGS-C job 1: a Mini App session (by far the common case) always takes the
// first branch below and never renders either of these — so they are loaded
// on demand rather than bundled into the entry chunk every session pays for.
const LoginGate = lazy(() => import('./components/LoginGate.jsx'));
const GuestLanding = lazy(() => import('./components/guest/GuestLanding.jsx').then((m) => ({ default: m.GuestLanding })));

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

const wantsWelcome = /^\/welcome\/?$/.test(window.location.pathname);
const root = createRoot(document.getElementById('root'));

// BUG-191/187: once a real Mini App credential has taken the room, nothing
// the ungated path was still working on may paint over it. The credential
// order in boot() is unchanged; this is what keeps it true when the answer
// arrives after a door has already been opened.
let miniAppAdopted = false;

function render(tree) {
  if (miniAppAdopted) return undefined;
  root.render(<StrictMode>{tree}</StrictMode>);
  return undefined;
}

function renderMiniApp() {
  miniAppAdopted = true;
  initTelegram();
  root.render(<StrictMode><App /></StrictMode>);
  return undefined;
}

/**
 * The SDK has settled after we chose a door without it. If it turned out to
 * carry a real Mini App credential, that credential wins — which is the same
 * priority boot() applies, applied late.
 */
function adoptLateMiniApp() {
  if (miniAppAdopted) return true;
  if (!isMiniAppSession()) return false;
  renderMiniApp();
  return true;
}

function welcome(roomContent, options = {}) {
  return <Suspense fallback={<BrandLoading/>}><GuestLanding showDetails roomContent={roomContent} {...options}/></Suspense>;
}

async function boot() {
  // Paint the authored B12 frame while the external script loads, and keep the
  // same credential priority the parser-blocking script had.
  //
  // BUG-191/187 — WHO WAITS FOR telegram.org, AND WHO DOES NOT.
  //
  // The gate used to be absolute: every window, Telegram's or not, sat on the
  // B12 frame until an external request settled. On a cold entry that request
  // is DNS + TLS + transfer to a third party and it measured a little under
  // three seconds, so the room was three seconds late for everybody — including
  // the browsers Telegram had nothing to do with, which were waiting to be told
  // something their own URL already said.
  //
  // So the gate is now the launch signal rather than the clock:
  //
  //   · A window Telegram opened (hasTelegramLaunchSignal) behaves EXACTLY as
  //     before — B12, await the real SDK, let initData choose the owner. The
  //     Mini App path is not shortened and no credential is reconstructed here.
  //   · A window with no Telegram signal at all cannot become a Mini App
  //     session, so it opens its own door immediately. If the SDK settles into
  //     a real credential regardless, adoptLateMiniApp re-takes the room with
  //     it, so door 1 still outranks a saved web login and a guest.
  //   · Minting a guest is the one irreversible step in here, and it waits for
  //     the actual settlement in every window, signal or no signal. A slow
  //     request still cannot mint a guest early.
  const sdkLoading = loadTelegramSdk();
  if (sdkLoading) {
    render(<BrandLoading/>);
    if (hasTelegramLaunchSignal()) await sdkLoading;
    else sdkLoading.then(adoptLateMiniApp);
  }
  // (1) and (2): a credential is already here.
  //
  // initTelegram() is called INSIDE each branch that mounts something, never
  // before the branching. LAND-2's rule is that a visitor who is about to be
  // redirected to the marketing page never has the SDK initialised at all, and
  // initialising it up here to save three lines would quietly break that.
  if (isMiniAppSession()) return renderMiniApp();
  if (getWebLogin() != null) {
    initTelegram();
    const room = <Suspense fallback={<BrandLoading/>}><LoginGate><App /></LoginGate></Suspense>;
    return render(wantsWelcome ? welcome(room, { ctaLabel: 'OPEN YOUR ROOM', ctaNote: 'Free · play money only', guestAvailable: false }) : room);
  }

  // (3): is the no-account door open, and are we already through it?
  render(<BrandLoading/>);
  const { enabled, ownerId } = await resolveGuest();
  // A credential may have landed while that round trip was in the air. The
  // claim catcher wraps every fetch for a guest and must never wrap an
  // owner's, so the guest branch is not entered once door 1 has been taken.
  if (adoptLateMiniApp()) return undefined;
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
    const launch = parseStartParam(readStartParam());
    const visitInvitationToken = launch?.kind === 'visit' ? launch.invitationToken : null;

    if (ownerId) {
      // He already has a household. The special hero is for a stranger with
      // none yet — a returning guest's flat already has the answer, so this
      // is job 1's own knock, made straight away rather than staged behind a
      // birth that already happened.
      // App owns the one launch resolution, including failures and retries.
      const room = <App guestBoot="returning" />;
      return render(wantsWelcome ? welcome(room, { ctaLabel: 'OPEN YOUR ROOM', ctaNote: 'Free · play money only' }) : room);
    }

    const preview = visitInvitationToken ? await resolveVisitInvitation(visitInvitationToken) : null;
    let visitor = preview?.ok ? preview.body : null;
    let initialVisitNotice = preview && !preview.ok ? { error:true, text:visitErrorText(preview) } : null;

    // Nobody yet — mint one, and land him on the page that IS the game (job
    // 6): one hero viewport, and the room itself directly under it with the
    // recruiter already talking (G1). The five-a-day-per-address cap is what
    // bounds a crawler or a bounced tab; see guest.js for why that cap is rows
    // rather than a Map. A server that refuses falls through to the login door
    // rather than rendering an app with no owner behind it.
    // The mint waits for the real settlement even in a window with no launch
    // signal: a guest is the one thing here that cannot be taken back, and a
    // late credential must be allowed to make it unnecessary.
    if (sdkLoading) { await sdkLoading; if (adoptLateMiniApp()) return undefined; }
    const { ownerId: made, refusal } = await startGuest(visitor ? visitInvitationToken : null, { onCreated: (body) => {
      if (visitor && body.visitInvitationAccepted !== true) {
        visitor = null;
        initialVisitNotice = { error:true, text:'This invitation is no longer available. Ask your friend for a new invitation.' };
      }
    } });
    if (made) {
      // VISIT-1 job 6: "someone is at your door" — the draft's opening line
      // (BirthScreen.jsx) reads this back once, the first time it renders.
      if (visitor) rememberPendingVisitor(visitor.agentName);
      // BUGS-C-1: the landing is lazy, so a Mini App session never pays for
      // it — which is why it needs the boundary the eager import did not.
      return render(
        <Suspense fallback={<BrandLoading/>}>
          <GuestLanding showDetails visitorName={visitor?.agentName ?? null} initialVisitHandled={!!visitInvitationToken} initialVisitNotice={initialVisitNotice} />
        </Suspense>,
      );
    }

    // GUEST-3: the address has spent its guests for today. This used to fall
    // through to the login door in silence, which is the worst of both — the
    // page had just promised "free, no account needed" and then showed a
    // Telegram wall and an empty seat with no reason next to it. The door is
    // still the right destination; it simply has to say why it is the only one.
    if (refusal?.error === 'guestCap') {
      initTelegram();
      return render(
        <Suspense fallback={<BrandLoading/>}>
          <LoginGate seatClosed notice={refusal.message}><App /></LoginGate>
        </Suspense>,
      );
    }
  }

  // (4): the door that was always here.
  //
  // The marketing redirect is kept for the deployment where guests are off, so
  // turning GUEST_ENABLED off on the VPS restores today's behaviour exactly.
  const wantsLogin = new URLSearchParams(window.location.search).has('login');
  if (wantsWelcome) {
    initTelegram();
    return render(welcome(<LoginGate><App /></LoginGate>, {
      ctaLabel: 'MEET HIM', ctaNote: 'Free · sign in with Telegram', guestAvailable: false,
    }));
  }
  if (window.location.hostname === 'agenticpoker.app' && !wantsLogin) {
    render(null);
    window.location.replace(`/welcome${window.location.search || ''}${window.location.hash || ''}`);
    return undefined;
  }
  initTelegram();
  return render(<Suspense fallback={<BrandLoading/>}><LoginGate><App /></LoginGate></Suspense>);
}

// Exported so a test can await the decision. Deciding which of the four doors
// a visitor came through now needs one round trip (is the guest door open?),
// so boot is async where it used to run at module scope — and `await import()`
// resolves when the MODULE has evaluated, not when its promise has settled.
export const booted = boot();
