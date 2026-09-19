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
// BUG-245: the board is the picture's subject. Legible ranks and suits replace
// five-pixel colored marks, with the public turn directly underneath. Cards
// retain their keys so only a newly dealt card animates.

const RED = new Set(['h', 'd']);

/** How many bodies stand around a felt this size before it is just a crowd. */
const MAX_BODIES = 6;

const SUITS = { h: '♥', d: '♦', c: '♣', s: '♠' };

export function cardColor(card) {
  const suit = String(card ?? '').slice(1, 2).toLowerCase();
  return RED.has(suit) ? '#C6494C' : '#111111';
}

/** The seats to draw as unlit bodies: everyone at the table except him. */
export function ringSeats(liveGame) {
  const seats = Array.isArray(liveGame?.seats) ? liveGame.seats : null;
  const hero = Number.isInteger(liveGame?.heroSeat) ? liveGame.heroSeat : null;
  if (!seats) return [];
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
  // Home's practice pot is real table state, but is not a money result.
  const pot = liveGame?.home ? 0 : Number(liveGame?.pot) || 0;
  const board = Array.isArray(liveGame?.board) ? liveGame.board.filter(c => /^[2-9TJQKA][cdhs]$/i.test(c)).slice(0, 5) : [];
  const ring = ringSeats(liveGame);
  const seats = Array.isArray(liveGame?.seats) ? liveGame.seats : [];
  const hero = seats.find((s,i) => (Number.isInteger(s?.seat) ? s.seat : i) === liveGame?.heroSeat);
  const actor = Number.isInteger(liveGame?.toAct) ? seats.find((s,i) => (Number.isInteger(s?.seat) ? s.seat : i) === liveGame.toAct) : null;
  const action = !liveGame || liveGame.street === 'waiting' ? 'Waiting for a hand'
    : liveGame.street === 'complete' ? 'Hand complete'
      : actor ? `${actor.displayName ?? 'Player'} to act` : 'Hand in progress';
  const cardWidth = Math.max(11, Math.min(20, (width - 16) / 5 - 2));

  return (
    <span className="home-frame__picture" data-street={liveGame?.street ?? 'none'} aria-hidden style={{ '--preview-card-w': `${cardWidth}px` }}>
      <span className="home-frame__felt" style={{ width: width * 0.6, marginLeft: -(width * 0.3) }} />

      {/* the rest of the table: bodies, unlit, so his own seat is the one you find */}
      {ring.map((seat, i) => (
        <span
          key={seat}
          className="home-frame__body"
          style={{ left: 12 + i * 6, top: 4 }}
        />
      ))}

      {/* his seat, lit and pulsing */}
      {hero && <span className="home-frame__seat" style={{ background: accent }} />}

      {/* the board he is playing, as far as it has run. Keyed by the card, so
          only the new one animates in. */}
      <span className="home-frame__cards">
        {board.map((c) => (
          <span key={c} className="home-frame__card" aria-label={c} style={{ color: cardColor(c) }}>
            <b>{c[0].toUpperCase() === 'T' ? '10' : c[0].toUpperCase()}</b><i>{SUITS[c[1].toLowerCase()]}</i>
          </span>
        ))}
      </span>

      {pot > 0 ? (
        <span className="home-frame__pot">{money ? money(Math.round(pot)) : Math.round(pot)}</span>
      ) : null}
      <span className="home-frame__action" title={action}>{action}</span>
      {hot ? <span className="home-frame__glow" /> : null}
    </span>
  );
}
