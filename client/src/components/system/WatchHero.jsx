// WATCH v6 — the hero, seated at the bottom of the felt.
// Port of design-refs/mood-watch5.jsx `V5Hero` (52a–f, 52k).
//
// v4b put him in a hero row: a strip of chrome at the foot of the felt with his
// cards in it, which made the one character you own the least present thing on
// his own table. v5 seats him. He faces the viewer at the bottom edge at twice
// an opponent's size, his cards face up in front of him, his bubble above his
// head, and the rope and strip directly under him — so the whole vertical axis
// of the screen is HIM.
//
// A FLOWED COLUMN, anchored to the felt's bottom edge: bubble, him, rope, strip.
// Every gap belongs to the column, so a two-line bubble or a thicker rope moves
// its neighbours instead of landing on them — the lesson v4b paid eleven defects
// for. Nothing in here is absolutely positioned against the felt.
//
// HANDS-1:
//   · THE HANDS ARE IN FRONT OF THE CARDS. He is holding them, not standing
//     behind them — so the hand layer is its own svg over the pair rather than
//     the one inside MoodGhost, which drew under the z-index-6 cards.
//   · STACK LEFT THE STRIP. The chips ARE the stack; stating it here as well
//     made the number the truth and the pile a decoration. His pile stands on
//     the felt to his left with the figure under it.
//   · NOTHING ON THIS SCREEN MAY INSERT A ROW. The cost was a pinned panel under
//     his strip, which pushed the felt up and made 52f a different screen from
//     52a. It is a TOAST RIDING OVER THE STRIP for four seconds, then a 6px
//     amber dot at the strip's right edge — both absolutely placed, so the felt
//     geometry is identical with, without and after it.
import { useEffect, useState } from 'react';
import { MoodGhost } from './MoodGhost.jsx';
import { GhostHandLayer, HERO_GRIP } from './GhostHands.jsx';
import { PlayingCard, CardBack } from './PlayingCard.jsx';
import { TugBar } from './TugBar.jsx';
import { Glass } from './Glass.jsx';
import { Bubble } from './Bubble.jsx';
import { SeatClock } from './SeatClock.jsx';
import { BodyBars } from './FeltBodyBars.jsx';
import { SEAT_BODY, SEAT_H } from './SeatGhost.jsx';
import { money } from '../../lib/wallet.js';

// TWICE AN OPPONENT, and measured BODY TO BODY: 96 against the seat's 40. The
// old ratio compared him to a seat's whole stack — body plus gap plus pill —
// which is comparing a character to a column of chrome. The seat owns its own
// numbers (SeatGhost); this re-exports them so nothing re-derives the ratio.
export const OPP_GHOST = SEAT_BODY;
export const OPP_SEAT = SEAT_H;
export const HERO_GHOST = 96;

// 52f/52k: four seconds as a toast, then a dot until the next flop.
export const COST_TOAST_MS = 4000;

// NINE POSES AND NO MORE (mood-atoms `HAND_POSES`). Which one he is wearing is
// a fact about the hand, not a design choice, so it is derived in one place.
//
// `raise` and `cover` are NOT here. 52g/52h draw them as the ceremony's own
// gesture — arms flung wide of the money line, or both hands over the face —
// and WATCH-7's law is that a hand end is quiet. Both fists over his head at
// the end of every hand he wins is the SESSION moment fired forty times a
// session, which is the exact mistake that law exists to prevent.
export function heroPose({ between, action, pace, heat, mucking, peeking }) {
  if (mucking) return 'toss';
  if (between) return 'rest';
  if (pace === 'allin' || (Number.isFinite(heat) && heat >= 70)) return 'clench';
  const t = action && action.type;
  if (t === 'bet' || t === 'raise') return 'push';
  if (t === 'check') return 'drum';
  if (t === 'fold') return 'toss';
  if (peeking) return 'peek';
  return 'hold';
}

// The stack height IS the bet band — three bands, nothing between.
export function betBand(amount, pot) {
  if (!Number.isFinite(amount) || amount <= 0) return 'mid';
  if (!Number.isFinite(pot) || pot <= 0) return 'mid';
  const r = amount / pot;
  return r < 0.4 ? 'small' : r > 0.9 ? 'big' : 'mid';
}

// The cost, as 52f draws it: a toast over the strip for four seconds, then a dot
// at the strip's right edge. Tapping the dot brings the toast back. Both are
// absolute inside the strip, so neither costs the column a pixel.
function CostToast({ cost }) {
  const [open, setOpen] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setOpen(true);
    setNonce((n) => n + 1);
  }, [cost && cost.line, cost && cost.key]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => setOpen(false), COST_TOAST_MS);
    return () => clearTimeout(t);
  }, [open, nonce]);

  if (!cost) return null;
  if (!open) {
    return (
      <button type="button" className="watch-hero__cost-dot"
        aria-label={`Why the hand went wrong: ${cost.line}`}
        onClick={() => { setOpen(true); setNonce((n) => n + 1); }} />
    );
  }
  return (
    <div className="watch-hero__cost" role="note">
      <span className="watch-hero__cost-line">{cost.line}</span>
      {cost.key && <span className="watch-hero__cost-key">{cost.key}</span>}
    </div>
  );
}

export function WatchHero({
  says, mood = 'neutral', accent = '#00D4AA', heat = 45, pose = 'hold', bet, event, won,
  hole, landed = 2, mucking = false, between = false,
  equity, villain, bigRope, deadRope,
  stack, pos, street, toCall = 0, action, tag, warm, note,
  cost, onTapFace, timer = null, timerOf = 12,
  // WATCH-8 job 2: the body. Two 2px lines along the strip's bottom edge —
  // STAMINA from volume, HEAT from outcomes, and they never share a channel.
  fatigue = null,
  // WATCH-7: the hand-end receipt. It rides ON the strip — over his own money,
  // which is what it is about — and it is part of the column, so it can never
  // land on the board or on him.
  toast,
}) {
  const cards = hole && hole.length ? hole : [null, null];
  return (
    <div className="watch-hero">
      {/* His bubble, above his head. The band is part of the column, so it
          pushes him down rather than landing on him. */}
      {says && (
        <div className="watch-hero__says">
          <Bubble mine flow text={says} />
        </div>
      )}

      {/* Him. Twice an opponent, facing the viewer, cards face up in FRONT —
          over the lower third of his body, never behind it. */}
      <button type="button" className="watch-hero__body" onClick={onTapFace}
        aria-label="Open the thread">
        <span className="watch-hero__aura" aria-hidden
          style={{ background: `radial-gradient(circle, ${accent}${heat > 66 ? '2E' : '1A'}, transparent 68%)` }} />
        <MoodGhost mood={mood} accent={accent} size={HERO_GHOST} heat={heat}
          event={event} won={won} ring={false} />
        <span className="watch-hero__cards watch-felt__hero-cards" aria-hidden={false}>
          {cards.map((c, i) => {
            const down = i < landed;
            return (
              <span key={i}
                className={`watch-felt__hero-card${down ? ' is-down' : ''}${mucking ? ' is-mucking' : ''}`}
                data-landed={down ? 'yes' : 'no'}
                data-mucking={mucking ? 'yes' : 'no'}
                style={{
                  transform: `rotate(${i ? 14 : -14}deg) translateX(${down ? 0 : 34}px)`,
                  '--muck-base': `rotate(${i ? 14 : -14}deg)`,
                  '--muck-turn': `${i ? 22 : -18}deg`,
                }}
              >
                {(c && !between)
                  ? <PlayingCard rank={c[0]} suit={c[1]} w={36} h={50} />
                  : <CardBack w={36} h={50} branded />}
              </span>
            );
          })}
        </span>
        {/* THE HANDS ARE IN FRONT OF THE CARDS — gripping the pair's bottom
            outer corners from below. Its own layer, above the cards. */}
        <GhostHandLayer className="watch-hero__hands" pose={pose}
          size={HERO_GHOST} grip={HERO_GRIP} />
      </button>

      {/* The rope, directly under him. */}
      <div className="watch-hero__tug">
        <TugBar equity={equity} villain={villain} big={bigRope} dead={deadRope} />
      </div>

      {/* The strip: street or to-call, his action, his clock — and, for a second
          and a half after a hand, what the hand did to him. STACK is not here:
          it is under the pile of chips it describes, on the felt to his left. */}
      <Glass className={`watch-felt__hero watch-hero__strip${action ? ' is-active' : ''}${warm ? ' is-warm' : ''}`}>
        {toast}
        {toCall > 0 && (
          <>
            <div>
              <span className="watch-felt__hero-lbl">To call</span>
              <div><span className="watch-felt__hero-num is-gold">{money(toCall)}</span></div>
            </div>
            <div className="watch-felt__hero-divider" />
          </>
        )}
        <div>
          <span className="watch-felt__hero-lbl">Street</span>
          <div className="watch-hero__stack-row">
            <span className="watch-felt__hero-num is-dim">{street || '—'}</span>
            {pos && <span className="watch-felt__hero-pos">{pos}</span>}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {warm && !action && <span className="watch-felt__premium">PREMIUM</span>}
        {action
          ? <span className="watch-felt__action-chip">{action}</span>
          : (!warm && note && <span className="watch-felt__waiting">{note}</span>)}
        {tag && <span className="watch-felt__hero-tag">{tag}</span>}
        {/* His own clock — the ring the server is actually keeping (SERVER-3),
            not one the client starts on arrival. */}
        {timer != null && <SeatClock d={22} left={timer} of={timerOf} />}
        {/* W5-4 / 52f · "why the hand went wrong". A toast over the strip for
            four seconds, then a dot at its right edge. Never a row. */}
        <CostToast cost={cost} />
        {/* The body, along the strip's bottom edge. Absolute, like everything
            else that rides this strip, so it costs the column no height. */}
        <BodyBars fatigue={fatigue} heat={heat} />
      </Glass>
    </div>
  );
}
