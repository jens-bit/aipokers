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
// The long marketing page is untouched and still lives at /welcome — nine
// sections, board 40. This is not a replacement for it; it is what a stranger
// gets when he opens the app itself.
//
// Board 40, waves 60/61: L2Masthead, L2Hero, L2Hand and L2Cta.
// Each back is 55% of the actual hood. The hero leaves a 26px room preview;
// desktop places the recruiter beside that room, including for the first agent.
//
// The marketing palette is burgundy and gold, and the product's teal appears in
// exactly ONE place on it — the two card backs he is holding. That is the ref's
// law and it is why the cards are drawn here rather than borrowed from the
// product's own Card component.

import { useCallback, useEffect, useRef, useState } from 'react';
import { RailMark } from '../system/RailMark.jsx';
import App from '../../App.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { HOODS } from '../../lib/identity.js';
import { Fist } from '../system/GhostHands.jsx';
import '../../styles/guest.css';

// BUG-52: main.jsx already imports App eagerly. A second lazy import cannot
// save a download; it just leaves the room blank behind a null Suspense gate.

// The hood he wears on the poster. Fixed, not rolled: this is one drawing on
// one page, not an agent with an identity.
const HERO_HOOD = HOODS[0];
const HERO_GLOW = '#CDB380';

/** The two backs, fanned, at chest height so the face stays clear. */
function HeldCards({ size }) {
  // Wave 60: measure the visible hood, which occupies 55% of the SVG box.
  const hoodWidth = size * 0.55;
  const cardWidth = Math.round(hoodWidth * 0.55);
  const cardHeight = Math.round(cardWidth * 1.4);
  const fistWidth = Math.round(hoodWidth * 0.22);
  const top = Math.round(size * 0.732) + Math.round(hoodWidth * 0.05);
  return (
    <div className="guest-hero__hand" aria-hidden="true" style={{ top, width: cardWidth * 1.62, height: cardHeight + fistWidth }}>
      {[-9, 9].map((deg, i) => (
        <div
          key={deg}
          className="guest-hero__card"
          style={{
            width: cardWidth,
            height: cardHeight,
            borderRadius: Math.round(cardWidth * 0.055),
            fontSize: Math.round(cardWidth * 0.3),
            animationDelay: `${0.3 + i * 0.22}s`,
            left: i ? 'auto' : 0,
            right: i ? 0 : 'auto',
            transform: `rotate(${deg}deg)`,
          }}
        ><span>♠</span></div>
      ))}
      {[0, 1].map(i => (
        <div key={i} className="guest-hero__fist" style={{
          left: i ? 'auto' : Math.round(cardWidth * 0.1),
          right: i ? Math.round(cardWidth * 0.1) : 'auto',
          top: cardHeight - Math.round(fistWidth * 0.42),
          transform: `rotate(${i ? 9 : -9}deg)`, animationDelay: `${0.42 + i * 0.22}s`,
        }}>
          <svg width={fistWidth} height={fistWidth * 0.72} viewBox="0 0 21.3 15.4">
            <g transform={`translate(${i ? 12.3 : 9} 0.4) scale(${i ? -1 : 1} 1)`}><Fist size={96} /></g>
          </svg>
        </div>
      ))}
    </div>
  );
}

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

// A different hood from the hero's own (HERO_HOOD) — two bodies on one poster
// have to read as two people, not one drawing twice.
const HODS_VISITOR = HOODS[2];

export function GuestLanding({ visitorName = null }) {
  const roomRef = useRef(null);
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 701px)');
    const update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const ghostSize = wide ? 280 : 180;

  // DRAFT HIM is a scroll and a focus, because what it would have opened is
  // already underneath it. The composer is found by its test id rather than
  // threaded down through App as a ref: the draft sheet is four components
  // deep and behind a branch, and a prop drilled through all of it to move a
  // cursor is a worse thing to own than one query.
  const draftHim = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    room.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // After the scroll has been asked for, not before: focusing first makes
    // some browsers jump to the field and cancel the smooth scroll.
    window.setTimeout(() => {
      room.querySelector('[data-testid="draft-input"]')?.focus({ preventScroll: true });
    }, 320);
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
                DRAFT HIM
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="#1A0A10" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M5 12h13" />
                  <path d="M13 6l6 6-6 6" />
                </svg>
              </button>
              <span className="guest-hero__free">Free · no account needed</span>
            </div>
          </div>

          <div className="guest-hero__creature">
            <div className="guest-hero__felt" />
            <div className="guest-hero__ghost">
              <MoodGhost
                mood="confident"
                size={ghostSize}
                ring={false}
                hood={HERO_HOOD}
                glow={HERO_GLOW}
                heat={40}
              />
              <HeldCards size={ghostSize} />
            </div>
            {visitorName ? <DoorWithVisitor name={visitorName} /> : null}
          </div>
        </div>
      </section>

      {/* The room, mounted. Not a picture of one. */}
      <div ref={roomRef} className="guest-landing__room">
        <App guestBoot="new" />
      </div>
    </div>
  );
}

export default GuestLanding;
