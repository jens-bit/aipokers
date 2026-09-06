// WATCH v5 — SeatGhost, the one seat anatomy (52m).
// Port of design-refs/mood-watch4.jsx `SeatGhost` at the geometry design 52m
// settled, with the hands from design-refs/mood-atoms.jsx.
//
// "Six slots were six different pile-ups: chips under names, names under cards,
// hands over faces." HANDS-1 puts the seat on the ref's two-row stack and gives
// it the only satellites it is allowed:
//
//   ROW 1   40px   the body. THE FACE AND BROW ARE NEVER COVERED — by cards,
//                  hands, chips or bubbles. Cards sit against the lower third
//                  (from 60% down) and the fists grip their bottom corners from
//                  below, so the hand layer is over the cards and under nothing.
//   GAP     10px   the only vertical space in the seat, and the room the fists
//                  need to hang below the cards (see SEAT_GAP).
//   ROW 2   18px   ONE pill — name regular, stack mono, one line. The timer ring
//                  and the dealer button attach to its LEFT EDGE rather than
//                  orbiting the body, which is what used to sit them on the face.
//   TOTAL   68px   if a seat will not fit, the pill drops to 16 — never the body.
//
// FOLDED: the body dims to 34% and the cards are gone entirely — no cards, and
// therefore no hands on cards. The pill stays at FULL opacity: whatever else goes
// quiet, you can always read who is sitting there.
//
// An opponent gets FOUR poses — rest, hold, toss, push. He does not peek, drum,
// clench or cover, because those are the poses that say what somebody is feeling,
// and an opponent's feelings are the read sheet's job, not the felt's.
import { FloorGhost, safeMood } from '../floor/atoms.jsx';
import { PlayingCard, CardBack } from './PlayingCard.jsx';
import { SeatClock } from './SeatClock.jsx';
import { GhostHandLayer, SEAT_GRIP } from './GhostHands.jsx';
import { BodyBars, Bottle } from './FeltBodyBars.jsx';

export const SEAT_BODY = 40;
// The ref calls this 6 and the stack 64. It cannot be both: SEAT_GRIP puts a
// seat's fists ~9.5px below the 40px body — they have to hang under the cards to
// grip them from underneath — so a 6px gap lands two fists on the ends of the
// name pill, which is the exact pile-up 52m exists to end. The gap absorbs the
// overhang; the body and the pill are the ref's own numbers.
export const SEAT_GAP = 10;
export const SEAT_PILL = 18;
export const SEAT_H = SEAT_BODY + SEAT_GAP + SEAT_PILL;   // 68

export const OPP_POSES = ['rest', 'hold', 'toss', 'push'];

// Which pose a seat is wearing is a fact about the hand, derived once, and
// clamped to the four an opponent is allowed.
export function seatPose({ folded, mucking, dealt, action }) {
  if (mucking) return 'toss';
  if (folded || !dealt) return 'rest';
  const t = action && action.type;
  if (t === 'bet' || t === 'raise') return 'push';
  return 'hold';
}

export function SeatGhost({
  name, stack, accent = '#00D4AA', mood = 'neutral', heat = 45, event = null,
  folded, acting, selected,
  dealt = true, reveal, show, history, timer, timerOf = 12, mucking = false,
  dealer = false, action = null,
  // WATCH-8 job 2: the body, on his own name pill. `fatigue` is null for a seat
  // with no agent behind it and `drinking` is FRIDGE-1's field, which may not
  // exist yet — both are absent rather than defaulted, so neither invents a
  // reading the server never gave.
  fatigue = null, drinking = false,
  size = SEAT_BODY, side = false, order = 0, onSelect,
}) {
  const m = safeMood(mood);
  const showing = !!(reveal && show && show.length && !folded);
  // W5-2: mid-throw. The backs stay mounted so there is something to throw, and
  // the dim of the folded state waits until they have landed — a seat that
  // greys out while its cards are still in the air reads as two events.
  const dimmed = folded && !mucking;
  const pose = seatPose({ folded: dimmed, mucking, dealt, action });

  return (
    <button
      type="button"
      className={`seat-ghost${acting ? ' is-acting' : ''}${dimmed ? ' is-folded' : ''}${selected ? ' is-selected' : ''}${mucking ? ' is-mucking' : ''}`}
      onClick={onSelect}
      aria-label={`${name} — read`}
      aria-pressed={!!selected}
    >
      <span className="seat-ghost__body" style={{ width: size, height: size }}>
        {selected && <span className="seat-ghost__ring" aria-hidden />}

        {/* Backs sit against the LOWER THIRD of him while the hand is live and
            he has not shown — and for the length of the throw once he folds.
            Never over the face: that is the whole point of the anatomy. */}
        {dealt && (!folded || mucking) && !showing && (
          <span className={`seat-ghost__backs${mucking ? ' is-mucking' : ''}`} aria-hidden
            data-fly={mucking ? 'muck' : null} data-fly-var="--muck">
            <CardBack w={15} h={20} />
            <CardBack w={15} h={20} />
          </span>
        )}

        <span className="seat-ghost__ghost">
          {/* A tilted opponent bobs faster. It is the only tell the posture gives. */}
          <FloorGhost mood={m} heat={heat} accent={accent} event={event}
            size={size} speed={m === 'tilted' ? 3.2 : 5.6} />
        </span>

        {/* THE HANDS ARE IN FRONT OF THE CARDS. He is holding them, not standing
            behind them — so the hand layer sits above the pair rather than inside
            the ghost, where it drew under the cards. */}
        <GhostHandLayer className="seat-ghost__hands" pose={pose} size={size} grip={SEAT_GRIP} />

        {/* How many hands he has taken off this agent — the nemesis count. */}
        {history > 0 && <span className="seat-ghost__history">{history}</span>}
      </span>

      {/* ROW 2. The ring and the button attach to the pill's LEFT EDGE; the pill
          itself is one line, and it keeps full opacity when he folds. */}
      <span className="seat-ghost__row">
        {/* The two satellites ATTACH to the pill rather than joining its row:
            in flow they widened the seat by up to 37px, and a rail seat that
            was both dealer and on the clock then hung off the felt. */}
        {(acting || dealer) && (
          <span className="seat-ghost__sat">
            {acting && <SeatClock d={SEAT_PILL - 2} left={timer ?? timerOf} of={timerOf} />}
            {dealer && <span className="seat-ghost__dealer" aria-hidden>D</span>}
          </span>
        )}
        <span className="seat-ghost__chip">
          <span className="seat-ghost__name">{name}</span>
          <span className="seat-ghost__sep" aria-hidden>·</span>
          <span className="seat-ghost__stack">{`$${stack}`}</span>
          {/* FRIDGE-1: beside his stack, because that is what it cost. */}
          {drinking === true && <Bottle size={10} className="seat-ghost__bottle" />}
          {/* The two bars, along the pill's bottom edge — the pill already
              names him, so the body costs the seat no height. */}
          <BodyBars compact fatigue={fatigue} heat={heat} />
        </span>
      </span>

      {/* The shelf: only at showdown, and only for a seat that reached it. */}
      {showing && (
        <span
          className={`seat-ghost__shelf${side ? ' is-side' : ''}`}
          style={{ animationDelay: `${order * 0.14}s` }}
        >
          {show.map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={22} h={31} />)}
        </span>
      )}
    </button>
  );
}
