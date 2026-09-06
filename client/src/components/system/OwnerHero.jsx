// SIT-1 — the hero seat when the owner is the one sitting in it.
//
// Board 29's sit-down frames (52·Y1–Y4, `OwnerChair` / `OwnerHand` in
// design-refs/mood-home2.jsx) drawn into WATCH v5's column, because SIT-1's
// felt IS the watch felt: same opponents, same board, same pot, same glass.
// Only the bottom of the axis changes hands.
//
// THERE IS NO GHOST HERE, and that is the whole point of the file rather than a
// prop on WatchHero. A ghost is a character with a mood, a face, a heat and a
// pair of hands, and none of those is a fact about the owner — the product has
// never drawn him and must not start. What he gets instead is exactly what the
// ref gives him: a YOU pill, his two cards face up, and the strip.
//
// So the column is WatchHero's minus the body: pill, cards, rope, strip. It
// keeps `watch-hero` on the root so the felt's own anchoring, the strip's glass
// and the rope's slot are the same measurements the ghost's column uses — a
// second set of numbers here is a second thing to keep in step.
//
// THE PILL GLOWS ON HIS TURN. 52·Y2's rule: three things say it is on you and
// none of them is a banner — the name pill glows, a ring lies on the felt, the
// timer drains on the chair. This owns the first; the strip (SitStrip) owns the
// verbs and the clock.
import { PlayingCard, CardBack } from './PlayingCard.jsx';
import { TugBar } from './TugBar.jsx';
import { Glass } from './Glass.jsx';
import { SeatClock } from './SeatClock.jsx';

// The ref's own owner-hand card, 46x64 (mood-home2 `OwnerHand`) — bigger than
// the ghost's 36x50, because these are the cards you are actually playing and
// nothing is holding them for you.
export const OWNER_CARD_W = 46;
export const OWNER_CARD_H = 64;

export function OwnerHero({
  hole, landed = 2, between = false, mucking = false,
  equity, villain, bigRope, deadRope,
  street, pos, toCall = 0, action, tag, warm, note,
  // Whether the table is waiting on him. The pill is the quiet register for it.
  turn = false,
  timer = null, timerOf = 12,
  toast,
}) {
  const cards = hole && hole.length ? hole : [null, null];
  return (
    <div className="watch-hero owner-hero" data-testid="owner-hero">
      {/* The pill, above the cards, where a name pill sits over a body. */}
      <span className={`owner-hero__pill${turn ? ' is-turn' : ''}`} data-turn={turn ? 'yes' : 'no'}>
        YOU
      </span>

      {/* FISH-TANK LAW, from his side of the glass: his own two cards face up.
          Face down only while there is no hand — a back between hands is the
          table waiting, not a card being kept from him. */}
      <span className="owner-hero__cards" data-testid="owner-hero-cards">
        {cards.map((c, i) => {
          const down = i < landed;
          return (
            <span
              key={i}
              className={`owner-hero__card${down ? ' is-down' : ''}${mucking ? ' is-mucking' : ''}`}
              data-landed={down ? 'yes' : 'no'}
              style={{ transform: `rotate(${i ? 6 : -6}deg) translateX(${down ? 0 : 34}px)` }}
            >
              {(c && !between)
                ? <PlayingCard rank={c[0]} suit={c[1]} w={OWNER_CARD_W} h={OWNER_CARD_H} />
                : <CardBack w={OWNER_CARD_W} h={OWNER_CARD_H} branded />}
            </span>
          );
        })}
      </span>

      {/* The rope keeps its slot: the equity is his now, and it is the one
          number on this screen that answers "am I ahead". */}
      <div className="watch-hero__tug">
        <TugBar equity={equity} villain={villain} big={bigRope} dead={deadRope} />
      </div>

      {/* The same strip the ghost has, minus his body bars — stamina and heat
          are attributes of an agent and the owner has neither. */}
      <Glass className={`watch-felt__hero watch-hero__strip owner-hero__strip${action ? ' is-active' : ''}${warm ? ' is-warm' : ''}`}>
        {toast}
        {toCall > 0 && (
          <>
            <div>
              <span className="watch-felt__hero-lbl">To call</span>
              <div><span className="watch-felt__hero-num is-gold">{`$${toCall.toLocaleString()}`}</span></div>
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
        {timer != null && <SeatClock d={22} left={timer} of={timerOf} />}
      </Glass>
    </div>
  );
}
