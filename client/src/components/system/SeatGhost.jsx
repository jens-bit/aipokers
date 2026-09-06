// WATCH v5 — SeatGhost, the one seat anatomy (52m).
// Port of design-refs/mood-watch4.jsx `SeatGhost` at the geometry design 52m
// settled, with the hands from design-refs/mood-atoms.jsx.
//
// "Six slots were six different pile-ups: chips under names, names under cards,
// hands over faces." HANDS-1 puts the seat on the ref's two-row stack and gives
// it the only satellites it is allowed:
//
//   ROW 1   32px   the body. THE FACE AND BROW ARE NEVER COVERED — by cards,
//                  hands, chips or bubbles. Cards sit against the lower third
//                  (from 60% down) and the fists grip their bottom corners from
//                  below, so the hand layer is over the cards and under nothing.
//   GAP      8px   the only vertical space in the seat, and the room the fists
//                  need to hang below the cards (see SEAT_GAP).
//   ROW 2   18px   ONE pill — HIS NAME, one line, and nothing else. The timer
//                  ring and the dealer button attach to its LEFT EDGE rather
//                  than orbiting the body, which used to sit them on the face.
//   TOTAL   58px   if a seat will not fit, the pill drops to 16 — never the body.
//
// Those three read 40 / 10 / 68 until WATCH-10: an opponent draws at 80% now,
// and his money moved off the pill and onto the chips he is sitting behind. The
// anatomy — two rows, one gap, in that order — is untouched, and so is the
// hero. See SEAT_BODY and the `stack` prop below.
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
import { pillName } from '../../lib/names.js';

// WATCH-10 job 1 · DENSITY. "A panel is a picture, not a paragraph" is the
// board's law for panels; six seats at 40px on a 390px felt were the same
// mistake spatially — five opponents, five piles and five pills filled the top
// half of the table and left the hero, the one character the owner owns, no
// more room than the strangers around him. So an opponent draws at 80% of what
// he did: the body 40 → 32, the gap with it, and his card backs at 70% (15×20 →
// 11×14) because the pair only has to read as A PAIR OF CARDS, not as cards you
// could name. Nothing about the HERO moves — the whole point of taking the
// space is to give it to him.
//
// The pill does NOT scale. 9.5px name text at 80% is 7.6px, which is not a
// smaller pill, it is an unreadable one; the pill pays its share of the density
// by losing the stack instead (see below), which is worth more width than 20%
// of its height was worth in room.
export const SEAT_BODY = 32;
// The ref calls this 6 and the stack 64. It cannot be both: SEAT_GRIP puts a
// seat's fists ~24% of the body below it — they have to hang under the cards to
// grip them from underneath — so a 6px gap lands two fists on the ends of the
// name pill, which is the exact pile-up 52m exists to end. The gap absorbs the
// overhang, so it scales with the body: 8 under a 32px seat.
export const SEAT_GAP = 8;
export const SEAT_PILL = 18;
export const SEAT_H = SEAT_BODY + SEAT_GAP + SEAT_PILL;   // 58

// His card backs, at 70% of the 15×20 the pair used to be. Exported because the
// felt models these boxes when it places a bubble (lib/feltBubbles.js) and a
// second copy of the number is a second answer.
export const SEAT_BACK_W = 11;
export const SEAT_BACK_H = 14;

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
  // WATCH-10 job 1 · `stack` is now OPTIONAL, and the felt does not pass it.
  // mood-watch5.jsx moved the hero's stack out of his strip and under the pile
  // it describes — "the chips ARE the stack, so stating it here too made the
  // number the truth and the chips a decoration" — and an opponent banks a pile
  // of his own on the same felt. So his number went to his chips as well, the
  // pill went back to being a NAME pill, and the seat got the width back.
  //
  // It is still drawn here for a surface that has the seat but not the pile:
  // the replay theatre's boxed felt (`geom`) has no room to bank chips, and a
  // seat with neither chips nor a figure would say nothing about his money at
  // all. Where there are chips, the chips answer.
  name, stack = null, accent = '#00D4AA', mood = 'neutral', heat = 45, event = null,
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
            <CardBack w={SEAT_BACK_W} h={SEAT_BACK_H} />
            <CardBack w={SEAT_BACK_W} h={SEAT_BACK_H} />
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
          {/* BUGS-A job 1's rule, and the reason this is not `name` any more:
              the pill used to lean on a CSS ellipsis at 58px, which cut a name
              at whatever width the font happened to render — "Bluff Master"
              and "Bluff Machine" both became "Bluff Mas…". pillName() cuts at
              a stated number of characters, in the one place the app decides
              how a name is written on a small surface. */}
          <span className="seat-ghost__name">{pillName(name)}</span>
          {stack != null && (
            <>
              <span className="seat-ghost__sep" aria-hidden>·</span>
              {/* Already formatted by the caller (lib/wallet's money), because
                  one screen gets one thousands separator and the felt is not
                  where that gets decided. */}
              <span className="seat-ghost__stack">{stack}</span>
            </>
          )}
          {/* FRIDGE-1: at the end of his pill, beside whatever is the last
              thing in it — his name on the felt, his stack on a boxed one —
              because a bottle is what it cost him. */}
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
