// client/src/components/home/MiniFelt.jsx — BUGS-A job 8
//
// THE MINIATURE FELT. One table, 46px tall, moving.
//
// This is the picture inside an away frame, and it is the same picture the
// TableSheet will use when FRONTEND lands it — which is why it is a component
// with a `liveGame` prop rather than markup living inside AwayFrame. A felt
// drawn twice is a felt that will disagree with itself.
//
// EVERYTHING HERE IS REAL. `liveGame` is AGE-37's projection off the wire —
// street, board, pot, heroSeat, seats — and nothing on this felt is invented:
//
//   the ring     one body per seat the table actually has, his lit
//   the board    the community cards as far as they have run, and no further
//   the pot      the money in the middle, or nothing
//
// A frame with no live game draws the room dark and says so at the plate. An
// honest empty felt beats a fake busy one.
//
// THE CARDS LAND. Each card is keyed by the card itself, so React mounts only
// the ones that are new and the `home-rise` keyframe plays for those alone —
// the turn arrives on the turn, rather than the whole board flashing. Suits
// are colour and nothing else: at five pixels wide a rank is a smudge, but red
// against white is legible at a glance and is the one thing about a board you
// can read at this size.

const RED = new Set(['h', 'd']);

/** How many bodies stand around a felt this size before it is just a crowd. */
const MAX_BODIES = 6;

/** Where the other seats stand, as fractions of the picture's width. */
const RING = [0.16, 0.3, 0.44, 0.58, 0.72, 0.86];

export function cardColor(card) {
  const suit = String(card ?? '').slice(1, 2).toLowerCase();
  return RED.has(suit) ? '#C6494C' : '#E8E6E0';
}

/** The seats to draw as unlit bodies: everyone at the table except him. */
export function ringSeats(liveGame) {
  const seats = Array.isArray(liveGame?.seats) ? liveGame.seats : null;
  const hero = Number.isInteger(liveGame?.heroSeat) ? liveGame.heroSeat : null;
  if (!seats) {
    // No seat list on the wire yet — four bodies, which is what the frame has
    // always drawn and reads as "a table with people at it".
    return [0, 1, 2, 3];
  }
  return seats
    .map((s, i) => (Number.isInteger(s?.seat) ? s.seat : i))
    .filter((seat) => seat !== hero)
    .slice(0, MAX_BODIES);
}

/**
 * @param liveGame  presentAgent's liveGame, or null while he walks to a seat
 * @param accent    his colour — the one lit seat
 * @param width     the frame's width; the felt is 60% of it
 * @param hot       a big pot is live here
 * @param money     how this product writes an amount (lib/wallet's `money`)
 */
export function MiniFelt({ liveGame, accent = '#00D4AA', width = 118, hot = false, money }) {
  const pot = Number(liveGame?.pot) || 0;
  const board = Array.isArray(liveGame?.board) ? liveGame.board.slice(0, 5) : [];
  const ring = ringSeats(liveGame);

  return (
    <span className="home-frame__picture" data-street={liveGame?.street ?? 'none'} aria-hidden>
      <span className="home-frame__felt" style={{ width: width * 0.6, marginLeft: -(width * 0.3) }} />

      {/* the rest of the table: bodies, unlit, so his own seat is the one you find */}
      {ring.map((seat, i) => (
        <span
          key={seat}
          className="home-frame__body"
          style={{ left: `${(RING[i] ?? RING[RING.length - 1]) * 100}%`, top: i % 2 ? 8 : 30 }}
        />
      ))}

      {/* his seat, lit and pulsing */}
      <span className="home-frame__seat" style={{ background: accent, boxShadow: `0 0 7px ${accent}` }} />

      {/* the board he is playing, as far as it has run. Keyed by the card, so
          only the new one animates in. */}
      <span className="home-frame__cards">
        {board.map((c) => (
          <span key={c} className="home-frame__card" style={{ background: cardColor(c) }} />
        ))}
      </span>

      {pot > 0 ? (
        <span className="home-frame__pot">{money ? money(Math.round(pot)) : Math.round(pot)}</span>
      ) : null}
      {hot ? <span className="home-frame__glow" /> : null}
    </span>
  );
}
