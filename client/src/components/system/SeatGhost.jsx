// WATCH v4 — SeatGhost.
// Port of design-refs/mood-watch4.jsx SeatGhost.
//
// W4-2, "seats as characters": an opponent stops being a chip with a number on
// it and becomes somebody sitting there. Same FloorGhost the casino floor uses,
// so a House regular looks the same at the felt as he does in the room, with
// his own accent and his own posture.
//
// The seat is a 60px stack — ghost 41 + gap 2 + name chip 17 — because the
// felt's bubble bands are measured off it.
//
// `reveal` turns their backs face up at showdown, in seat order. Backs while
// the hand is live: the fish-tank law is untouched by this wave.
import { FloorGhost, safeMood } from '../floor/atoms.jsx';
import { PlayingCard, CardBack } from './PlayingCard.jsx';
import { SeatClock } from './SeatClock.jsx';

export function SeatGhost({
  name, stack, accent = '#00D4AA', mood = 'neutral', folded, acting, selected,
  dealt = true, reveal, show, history, timer, timerOf = 12, mucking = false,
  size = 34, side = false, order = 0, onSelect,
}) {
  const m = safeMood(mood);
  const showing = !!(reveal && show && show.length && !folded);
  // W5-2: mid-throw. The backs stay mounted so there is something to throw, and
  // the dim of the folded state waits until they have landed — a seat that
  // greys out while its cards are still in the air reads as two events.
  const dimmed = folded && !mucking;

  return (
    <button
      type="button"
      className={`seat-ghost${acting ? ' is-acting' : ''}${dimmed ? ' is-folded' : ''}${selected ? ' is-selected' : ''}${mucking ? ' is-mucking' : ''}`}
      onClick={onSelect}
      aria-label={`${name} — read`}
      aria-pressed={!!selected}
    >
      <span className="seat-ghost__body">
        {acting && <SeatClock d={size + 13} left={timer ?? timerOf} of={timerOf} />}
        {selected && <span className="seat-ghost__ring" aria-hidden />}

        {/* Backs sit behind him while the hand is live and he has not shown —
            and for the 350ms it takes to throw them once he folds. */}
        {dealt && (!folded || mucking) && !showing && (
          <span className={`seat-ghost__backs${mucking ? ' is-mucking' : ''}`} aria-hidden>
            <CardBack w={15} h={21} />
            <CardBack w={15} h={21} />
          </span>
        )}

        <span className="seat-ghost__ghost">
          {/* A tilted opponent bobs faster. It is the only tell the posture gives. */}
          <FloorGhost mood={m} accent={accent} size={size} speed={m === 'tilted' ? 3.2 : 5.6} />
        </span>

        {/* How many hands he has taken off this agent — the nemesis count. */}
        {history > 0 && <span className="seat-ghost__history">{history}</span>}
      </span>

      <span className="seat-ghost__chip">
        <span className="seat-ghost__name">{name}</span>
        <span className="seat-ghost__stack">{stack}</span>
        {acting && timer != null && <span className="seat-ghost__timer">{timer}s</span>}
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
