// client/src/components/casino/TableFelt.jsx — CASINO-2 job 4
//
// A REAL GAME, IN MINIATURE.
//
// Ported from design-refs/mood-nav.jsx (YourTable / MINI_RING). The ref states
// why it exists, and the reason is the whole of this file:
//
//   "A lone ghost with three cards floating beside him was a picture OF poker
//    rather than a view of his hand, and it is the one block on this screen the
//    owner opens the screen to see."
//
// So NOTHING HERE IS DECORATION. Every body is a seat the table actually has,
// every card is a card that has actually been dealt, the pot is the money in
// the middle, and the ring on a body is whose turn it is. A felt with nothing
// live behind it does not draw a quiet game — it draws nothing, and the caller
// says where the man is instead.
//
// WHY IT IS NOT home/MiniFelt.jsx. That one is the picture inside an away
// frame: 46px of abstract shapes driven by ONE AGENT'S liveGame, at a size
// where a rank is a smudge and a suit is a colour. This is driven by the
// PUBLIC FELT (CASINO-2 job 1) — real seats, real names, real moods — at a
// size where they are legible, and it is the same object in the carousel and
// in the room seen from above. Two payloads, two scales, two questions.
//
// THE FISH-TANK LAW, at this size. His own two cards are face up. Everybody
// else's are backs — and there is nothing else to get wrong here, because the
// felt payload does not carry another man's cards at all: the server never put
// them on the wire. The law is enforced upstream and drawn honestly here.

import { MoodGhost } from '../system/MoodGhost.jsx';
import { PlayingCard, CardBack, parseCard } from '../system/PlayingCard.jsx';
import { M_TEAL, M_GOLD } from '../floor/atoms.jsx';
import { money } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';
import { LiveDot } from './CasinoBuilding.jsx';

const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const M_TEXT = '#EDEDED';
const M_DIM = '#A1A1A1';
const M_BORDER = 'rgba(255,255,255,0.12)';

// Where the other seats stand, as fractions of the picture. Verbatim from the
// ref: five places, which is exactly a six-max table minus the hero.
export const MINI_RING = [
  { x: 0.20, y: 0.16 }, { x: 0.50, y: 0.10 }, { x: 0.80, y: 0.16 },
  { x: 0.12, y: 0.50 }, { x: 0.88, y: 0.50 },
];

/**
 * The seats around the ring — everybody at this table except him, in seat
 * order starting from the seat after his, so the man on his left is on his
 * left. A table with more players than the ring has places keeps the ones
 * nearest him: at that point the felt is a crowd and the far seats are not
 * what the picture is for.
 */
export function ringOf(felt, heroSeat) {
  const seats = [...(felt?.seats ?? [])].sort((a, b) => a.seat - b.seat);
  if (!Number.isInteger(heroSeat)) return seats.slice(0, MINI_RING.length);
  const after = seats.filter((s) => s.seat > heroSeat);
  const before = seats.filter((s) => s.seat < heroSeat);
  return [...after, ...before].slice(0, MINI_RING.length);
}

/** His seat at this table, or null when he is not at it. */
export function heroSeatOf(felt, agentId) {
  if (!agentId) return null;
  const seat = (felt?.seats ?? []).find((s) => String(s.agentId) === String(agentId));
  return seat ? seat.seat : null;
}

function moodStateOf(seat) {
  const state = seat?.mood?.state;
  return typeof state === 'string' ? state : 'neutral';
}

function heatOfSeat(seat) {
  const heat = Number(seat?.mood?.heat);
  return Number.isFinite(heat) ? heat : 45;
}

/**
 * One table, drawn.
 *
 * @param felt      a ROOM_TABLES entry (job 1). Required — there is no felt
 *                  without a live table behind it.
 * @param agentId   whose table this is, if it is anybody's of yours
 * @param heroHole  his two cards, from his own liveGame. The felt payload does
 *                  not carry them and never will; they come from the roster,
 *                  which is owner-scoped, and are simply absent otherwise.
 * @param accent    his colour, for the one lit seat
 * @param scale     1 is the carousel's size; the room seen from above uses 0.6
 * @param label     the strip across the top-left, or null
 * @param onWatch   tap handler; without one the felt is a picture
 */
export function TableFelt({
  felt, agentId = null, heroHole = null, accent = M_TEAL, scale = 1,
  label = null, live = true, onWatch = null, ariaLabel = null,
}) {
  if (!felt) return null;
  const heroSeat = heroSeatOf(felt, agentId);
  const ring = ringOf(felt, heroSeat);
  const hero = heroSeat == null ? null : (felt.seats ?? []).find((s) => s.seat === heroSeat);
  const board = (felt.board ?? []).slice(0, 5);
  const hole = Array.isArray(heroHole) ? heroHole.slice(0, 2) : [];

  const px = (n) => Math.round(n * scale);
  const ghost = px(hero ? 22 : 24);
  const heroGhost = px(46);
  const cardW = px(13);
  const cardH = px(18);
  const backW = px(6);
  const backH = px(8);

  const body = (
    <>
      {label && (
        <div style={{
          position: 'absolute', left: px(12), top: px(11), zIndex: 4,
          display: 'flex', alignItems: 'center', gap: px(6),
        }}>
          <span style={{
            fontFamily: OSWALD, fontSize: px(8), fontWeight: 600,
            letterSpacing: '0.15em', color: felt.hot ? M_GOLD : M_DIM,
          }}>{label}</span>
          {live && <LiveDot size={px(5)} color={felt.hot ? M_GOLD : M_TEAL} />}
        </div>
      )}

      {/* the ring: everybody else, their cards face down, and the one to act
          carrying the only ring on the felt */}
      {ring.map((seat, i) => {
        const place = MINI_RING[i] ?? MINI_RING[MINI_RING.length - 1];
        const toAct = felt.toAct === seat.seat;
        return (
          <div
            key={seat.seat}
            style={{
              position: 'absolute', left: `${place.x * 100}%`, top: `${place.y * 100}%`,
              transform: 'translate(-50%,0)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: px(2),
              opacity: seat.inHand || !felt.pot ? 1 : 0.42,
            }}
          >
            <MoodGhost
              mood={moodStateOf(seat)}
              heat={heatOfSeat(seat)}
              accent={seat.accentColor ?? '#888888'}
              size={toAct ? ghost + px(4) : ghost}
              ring={false}
            />
            {seat.inHand && (
              <div style={{ display: 'flex', gap: 1 }}>
                {[0, 1].map((k) => <CardBack key={k} w={backW} h={backH} />)}
              </div>
            )}
            {toAct && (
              <span style={{
                fontFamily: OSWALD, fontSize: px(6), fontWeight: 600,
                letterSpacing: '0.1em', color: M_GOLD,
              }}>TO ACT</span>
            )}
          </div>
        );
      })}

      {/* the money in the middle. No pot, no pill: a felt between hands says so
          by having nothing in the middle, which is what it looks like. */}
      {felt.pot > 0 && (
        <div style={{
          position: 'absolute', left: '50%', top: '44%', transform: 'translate(-50%,-50%)',
          display: 'flex', alignItems: 'center', gap: px(6), padding: `${px(2)}px ${px(9)}px`,
          borderRadius: px(11), background: 'rgba(10,14,14,0.66)', border: `1px solid ${M_BORDER}`,
        }}>
          <span style={{ fontFamily: OSWALD, fontSize: px(7), letterSpacing: '0.12em', color: '#6B6B6B' }}>POT</span>
          <span style={{
            fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: px(11),
            fontWeight: 700, color: M_GOLD,
          }}>{money(felt.pot)}</span>
        </div>
      )}

      {/* the board, as far as it has run and no further */}
      {board.length > 0 && (
        <div data-board="" style={{
          position: 'absolute', left: '50%', top: '61%', transform: 'translate(-50%,-50%)',
          display: 'flex', gap: px(2),
        }}>
          {board.map((c) => {
            const card = parseCard(c);
            return card ? <PlayingCard key={c} rank={card.rank} suit={card.suit} w={cardW} h={cardH} /> : null;
          })}
        </div>
      )}

      {/* him, at the bottom, with his pill above and his own cards face up */}
      {hero && (
        <div style={{
          position: 'absolute', left: '50%', bottom: px(10), transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: px(2),
        }}>
          <span style={{
            fontSize: px(8), color: M_TEXT, background: 'rgba(8,12,12,0.9)',
            border: `1px solid ${accent}55`, borderRadius: px(7),
            padding: `${px(1.5)}px ${px(7)}px`, whiteSpace: 'nowrap',
          }}>{pillName(hero.name)}</span>
          <div style={{ position: 'relative' }}>
            <MoodGhost
              mood={moodStateOf(hero)}
              heat={heatOfSeat(hero)}
              accent={accent}
              size={heroGhost}
              ring={false}
              hands="hold"
            />
            {(hole.length > 0 || hero.inHand) && (
              <div data-hole={hole.length > 0 ? 'up' : 'down'} style={{
                position: 'absolute', left: '50%', top: '60%', transform: 'translateX(-50%)',
                display: 'flex', gap: px(1.5), zIndex: 4,
              }}>
                {hole.length > 0
                  // FISH-TANK LAW: his own, face up.
                  ? hole.map((c) => {
                    const card = parseCard(c);
                    return card ? <PlayingCard key={c} rank={card.rank} suit={card.suit} w={cardW} h={cardH} /> : null;
                  })
                  // He has cards; we are not the owner, so we do not know them.
                  // Backs, not blanks — he IS holding two.
                  : [0, 1].map((k) => <CardBack key={k} w={cardW} h={cardH} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  const frame = {
    position: 'relative', width: '100%', minHeight: 0, overflow: 'hidden', padding: 0,
    borderRadius: px(10), display: 'block', textAlign: 'left',
    border: `1px solid ${felt.hot ? `${M_GOLD}66` : hero ? `${M_GOLD}3D` : M_BORDER}`,
    background: 'radial-gradient(ellipse at 50% 42%, #24312C 0%, #16201E 72%)',
    boxShadow: felt.hot ? `0 0 20px ${M_GOLD}2E` : 'none',
  };

  const props = {
    className: 'csn-felt',
    'data-table': felt.tableId,
    'data-hot': felt.hot ? 'true' : undefined,
    'data-mine': hero ? 'true' : undefined,
  };

  if (!onWatch) return <div {...props} style={frame}>{body}</div>;
  return (
    <button
      type="button"
      {...props}
      style={{ ...frame, cursor: 'pointer' }}
      aria-label={ariaLabel ?? `${money(felt.pot)} in the middle at ${felt.blinds}. Watch this table.`}
      onClick={() => onWatch(felt.tableId)}
    >{body}</button>
  );
}
