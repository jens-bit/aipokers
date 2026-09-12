// client/src/components/guest/GuestLanding.jsx — GUEST-1 job 6
//
// The landing IS the game.
//
// Wave 61's rule, and this is the whole of it: one hero viewport, and directly
// under it the room — the real one, with the real recruiter in it, minted and
// live. Not a screenshot of the product, not a "try it" button that navigates
// somewhere. Scroll down and you are drafting.
//
// WHY THE ROOM IS MOUNTED, NOT LINKED. Every landing page this product has had
// ended in a call to action that took you somewhere else, and the somewhere
// else was where people stopped. There is nowhere else now: DRAFT HIM is a
// scroll, because the thing it would have navigated to is already on the page
// and already his.
//
// The same entry also serves /welcome. Its nine explanatory sections follow
// the real room, using captures of current product components.
//
// Board 40 keeps the masthead, copy and real room below. SHOW-1 replaces
// the static character illustration with a local demonstration hand, using
// the product's existing felt, cards, chips and saved character palette.

import { useCallback, useEffect, useRef, useState } from 'react';
import { LandingDetails } from './LandingDetails.jsx';
import { RailMark } from '../system/RailMark.jsx';
import App from '../../App.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { HOODS } from '../../lib/identity.js';
import { LandingDemo } from './LandingDemo.jsx';
import '../../styles/guest.css';

// BUG-52: main.jsx already imports App eagerly. A second lazy import cannot
// save a download; it just leaves the room blank behind a null Suspense gate.

/**
 * VISIT-1 job 6 — a small door, and a body standing outside it. Not the
 * product's own HomeFlat door (this page is the marketing palette, and
 * nothing here is meant to be mistaken for the room a household actually
 * lives in) — a simple mark that reads as "outside", so the ghost beside it
 * reads as somebody who has not been let in yet.
 */
function DoorWithVisitor({ name }) {
  return (
    <div className="guest-hero__door-scene" data-testid="guest-hero-visitor">
      <div className="guest-hero__door" aria-hidden>
        <span className="guest-hero__door-glow" />
      </div>
      <div className="guest-hero__door-visitor">
        <MoodGhost mood="neutral" size={72} ring={false} hood={HODS_VISITOR} glow="#CDB380" heat={40} />
        <span className="guest-hero__door-name">{name}</span>
      </div>
    </div>
  );
}

// A different hood from the demo hero — two bodies on one poster
// have to read as two people, not one drawing twice.
const HODS_VISITOR = HOODS[2];

export function GuestLanding({ visitorName = null, roomContent = null, showDetails = false,
  ctaLabel = 'DRAFT HIM', ctaNote = 'Free · no account needed', guestAvailable = true,
  initialVisitHandled = false, initialVisitNotice = null }) {
  const roomRef = useRef(null);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 701px)');
    const update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  // DRAFT HIM is a scroll and a focus, because what it would have opened is
  // already underneath it. The composer is found by its test id rather than
  // threaded down through App as a ref: the draft sheet is four components
  // deep and behind a branch, and a prop drilled through all of it to move a
  // cursor is a worse thing to own than one query.
  const scrollCleanup = useRef(() => {});
  useEffect(() => () => scrollCleanup.current(), []);
  const draftHim = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    scrollCleanup.current();
    let timer;
    const focus = () => {
      if (Math.abs(room.getBoundingClientRect().top) > 1) return;
      scrollCleanup.current();
      room.querySelector('[data-testid="draft-input"]')?.focus({ preventScroll: true });
    };
    scrollCleanup.current = () => {
      window.clearTimeout(timer);
      window.removeEventListener('scrollend', focus, true);
    };
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant) {
      room.scrollIntoView({ behavior: 'instant', block: 'start' });
      focus();
    } else {
      window.addEventListener('scrollend', focus, true);
      room.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // The footer can be many screens away. Focus after the actual scroll,
      // with a fallback for WebViews that do not emit scrollend yet.
      if (Math.abs(room.getBoundingClientRect().top) < 1) focus();
      else timer = window.setTimeout(focus, 1500);
    }
  }, []);

  return (
    <div className="guest-landing">
      <section className="guest-hero">
        <div className="guest-hero__wash" />

        <header className="guest-hero__masthead">
          <RailMark size={wide ? 24 : 20} color="#CDB380" /><span className="guest-hero__wordmark">RAILBIRD</span>
        </header>

        <div className="guest-hero__body">
          <div className="guest-hero__copy">
            {/* VISIT-1 job 6: a knock changes the promise on the page from "make
                somebody" to "let somebody in" — the first fact this stranger
                needs is not the product, it is that he is expected. */}
            <h1 className="guest-hero__head">
              {visitorName ? `${visitorName} is at your door.` : 'Deal him in.'}
            </h1>
            <p className="guest-hero__lede">
              {visitorName
                ? `${visitorName} wants to sit down for a while. Draft somebody of your own and you can let him in.`
                : 'A poker player you raise. You draft him in a chat, he is born with a nature and six attributes, and then he lives in a room in your phone — and plays real hands without you.'}
            </p>
            <div className="guest-hero__action">
              <button type="button" className="guest-hero__cta" onClick={draftHim}>
                {ctaLabel}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="#1A0A10" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h13" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </button>
              <span className="guest-hero__free">{ctaNote}</span>
            </div>
          </div>

          <div className="guest-hero__creature">
            <LandingDemo />
            {visitorName ? <DoorWithVisitor name={visitorName} /> : null}
          </div>
        </div>
      </section>

      {/* The room, mounted. Not a picture of one. */}
      <div ref={roomRef} className="guest-landing__room">
        {roomContent ?? <App guestBoot="new" initialVisitHandled={initialVisitHandled} initialVisitNotice={initialVisitNotice} />}
      </div>
      {showDetails && <LandingDetails onDraft={draftHim} ctaLabel={ctaLabel} ctaNote={ctaNote} guestAvailable={guestAvailable} />}
    </div>
  );
}

export default GuestLanding;
