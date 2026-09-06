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
// PORTED FROM design-refs/mood-landing2.jsx — `L2Masthead`, the hero column,
// `L2Hero`, `L2Hand` and `L2Cta`, wave 54, board 40. Two deliberate departures
// from the ref, both from the brief:
//
//   · the cards are 55% of the hood's width rather than the ref's 62%;
//   · the CTA's foot reads "Free · no account needed" rather than "Free ·
//     plays in Telegram", which was true when there was nothing but Telegram
//     and is the wrong promise on the page that removed the account.
//
// The marketing palette is burgundy and gold, and the product's teal appears in
// exactly ONE place on it — the two card backs he is holding. That is the ref's
// law and it is why the cards are drawn here rather than borrowed from the
// product's own Card component.

import { useCallback, useRef } from 'react';
import App from '../../App.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { HOODS, GLOWS } from '../../lib/identity.js';
import '../../styles/guest.css';

// The hood he wears on the poster. Fixed, not rolled: this is one drawing on
// one page, not an agent with an identity.
const HERO_HOOD = HOODS[0];
const HERO_GLOW = GLOWS[1].c;      // gold, the marketing accent

const GHOST_SIZE = 180;
// The brief's number. The ref fans them at 62%; on the phone hero, where the
// ghost is 180 rather than 280, that reaches the chin.
const CARD_W = Math.round(GHOST_SIZE * 0.55);
const CARD_H = Math.round(CARD_W * 1.4);

/** The two backs, fanned, at chest height so the face stays clear. */
function HeldCards() {
  return (
    <div className="guest-hero__hand" style={{ width: CARD_W * 1.62, height: CARD_H }}>
      {[-9, 9].map((deg, i) => (
        <div
          key={deg}
          className="guest-hero__card"
          style={{
            width: CARD_W,
            height: CARD_H,
            left: i ? 'auto' : 0,
            right: i ? 0 : 'auto',
            transform: `rotate(${deg}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export function GuestLanding() {
  const roomRef = useRef(null);

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
      room.querySelector('[data-testid="draft-input"]')?.focus();
    }, 320);
  }, []);

  return (
    <div className="guest-landing">
      <section className="guest-hero">
        <div className="guest-hero__wash" />

        <header className="guest-hero__masthead">
          <svg width="15" height="19" viewBox="0 0 22 26" aria-hidden="true">
            <path
              d="M11 1C11 1 1 9.5 1 15.2C1 19.1 4.2 21.4 7.4 21.4C8.9 21.4 10 20.9 10.5 20.3L9.4 25H12.6L11.5 20.3C12 20.9 13.1 21.4 14.6 21.4C17.8 21.4 21 19.1 21 15.2C21 9.5 11 1 11 1Z"
              fill="var(--marketing-gold, #CDB380)"
            />
          </svg>
          <span className="guest-hero__wordmark">AGENTIC POKER</span>
        </header>

        <div className="guest-hero__body">
          <div>
            <h1 className="guest-hero__head">Deal him in.</h1>
            <p className="guest-hero__lede">
              A poker player you raise. You draft him in a chat, he is born with a nature
              and six attributes, and then he lives in a room in your phone — and plays
              real hands without you.
            </p>
            <div style={{ marginTop: 22 }}>
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
                size={GHOST_SIZE}
                ring={false}
                hood={HERO_HOOD}
                glow={HERO_GLOW}
                heat={40}
              />
              <HeldCards />
            </div>
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
