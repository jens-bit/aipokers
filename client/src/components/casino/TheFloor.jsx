// client/src/components/casino/TheFloor.jsx — CASINO-2 job 5, wave 58
//
// THE FLOOR, FROM ABOVE.
//
// Ported from design-refs/mood-floor58.jsx (TheFloor, MiniFelt, TinyGhost,
// FloorBar, FloorStairs), which landed while CASINO-2 was being built and is
// this job's brief drawn properly. The ref states what it is for:
//
//   "THE FLOOR is what the casino has been missing: a room you look into.
//    Board 27's casino was three doorways and a board — accurate, and
//    completely abstract. This is the floor itself from above, six to eight
//    live felts with tiny bodies in the seats, a bar with a few standing at
//    it, and the board by the stairs. The only text on it is the stakes per
//    felt, because a floor you have to read is a list."
//
// The first pass at this job was a grid of felt cards. It was accurate and it
// was a list — which is the exact thing the ref names as the failure. A room
// is not a list of its tables any more than a bar is a list of its stools.
//
// FOUR THINGS THE REF DECIDES, and this file keeps all four:
//
//   1. A FELT IS AN ELLIPSE WITH BODIES ON ITS RIM. Not a card, not a tile. It
//      is a table seen from above, and its only label is its stake, because
//      "a floor you have to read is a list".
//   2. A BODY IS 14px OF HOOD AND TWO EYES. Any more detail at this size is
//      noise, and the face system's own tiers already say so. Yours is the one
//      with a teal rim and teal eyes: finding him is never a search.
//   3. THE ROOM IS NEVER A MAP OF ALL 1,600. It is the room you are standing
//      in. Six felts is the plan; a busier room says how many more it holds
//      rather than drawing them smaller until none of them is legible.
//   4. THE FURNITURE IS THE POINT. The bar exists so that "not playing" has
//      somewhere to be, and the stairs exist so the building has floors.
//
// AND ONE THING THE REF CANNOT DECIDE, because it is hand-placed: where N
// felts go. `floorPlan` derives that, and reproduces the ref's own six exactly
// — the jitter tables below are its coordinates, read back out.

import { HOODS, GLOWS } from '../../lib/identity.js';
import { M_TEAL, M_GOLD, M_RED } from '../floor/atoms.jsx';
import { pillName } from '../../lib/names.js';

const MONO = '"JetBrains Mono",ui-monospace,monospace';
const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const M_MUTED = '#6B6B6B';

// The coordinate space the ref drew in. Everything below is in these units and
// the whole plan is scaled to whatever width it is given, so the room holds
// its proportions on a phone and on a desk.
export const FLOOR_W = 390;
export const FLOOR_H = 470;

// Six felts is the room. The ref: "It is never a map of all 1,600: it is the
// room you are standing in." A seventh drawn smaller helps nobody.
export const FLOOR_CAP = 6;

// The ref's own six, read back out as offsets. Column x and row y are regular;
// these are what stop the plan reading as a spreadsheet — no two rims touch
// and the gaps between them read as walkways.
const COL_X = [64, 190, 314];
const ROW_Y = 108;
const ROW_GAP = 128;
const DX = [0, 0, 0, 6, 6, 6];
const DY = [0, -20, 4, 0, -16, 8];
const RADII = [44, 40, 44, 42, 46, 40];

/**
 * Where N felts stand on the floor.
 *
 * Deterministic: the same room always draws the same way, so a felt does not
 * hop across the room when the pot on another one changes. Reproduces the ref's
 * hand-placed six exactly for n <= 6, which is the test that it is a port.
 */
export function floorPlan(n) {
  const count = Math.max(0, Math.min(FLOOR_CAP, Math.floor(n) || 0));
  return Array.from({ length: count }).map((_, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      x: COL_X[col] + DX[i % 6],
      y: ROW_Y + row * ROW_GAP + DY[i % 6],
      r: RADII[i % 6],
    };
  });
}

/**
 * A body at floor scale: a hood and two eyes, and nothing else.
 *
 * The hood and glow are picked from the index rather than from an identity
 * roll, exactly as the ref does — these are strangers, and what matters is
 * that a room of them reads as a crowd of individuals rather than as one
 * repeated shape. Yours overrides both, because yours is the one you are
 * looking for.
 */
export function TinyGhost({ i = 0, mine = false, hot = false, size = 14 }) {
  const hood = HOODS[((i * 5 + 1) % 6 + 6) % 6];
  const glow = GLOWS[((i * 3) % 6 + 6) % 6];
  return (
    <svg
      width={size} height={size} viewBox="0 0 80 80" aria-hidden
      className="csn-tiny"
      data-mine={mine ? 'true' : undefined}
      style={{ display: 'block', animation: `casino-bob ${4 + (i % 3)}s ease-in-out ${(i % 5) * 0.4}s infinite` }}
    >
      <path
        d="M40 8 C58 8 70 20 70 38 L70 68 C70 76 62 75 58 79 C54 83 46 83 40 79 C34 83 26 83 22 79 C18 75 10 76 10 68 L10 38 C10 20 22 8 40 8Z"
        fill={hood.top}
        stroke={mine ? `${M_TEAL}99` : 'rgba(0,0,0,0.5)'}
        strokeWidth={mine ? 4 : 2}
      />
      {/* the eyes narrow when the table is hot — the one expression a 14px
          body has room for */}
      <ellipse cx="29" cy="40" rx="6" ry={hot ? 4 : 7} fill={mine ? M_TEAL : glow.c} />
      <ellipse cx="51" cy="40" rx="6" ry={hot ? 4 : 7} fill={mine ? M_TEAL : glow.c} />
    </svg>
  );
}

/** Where a seat sits on the rim, with the dealer's gap centred on the bottom. */
export function seatAngle(index, n) {
  const gap = 1.0;
  return (Math.PI / 2 + gap / 2) + (index + 0.5) * (Math.PI * 2 - gap) / Math.max(1, n);
}

/**
 * One felt, seen from above. An ellipse, bodies around its rim, a pot dot, and
 * its stake — which is the only text a felt is allowed.
 *
 * `mineSeat` is the index ON THE RIM of your own man, not his seat number at
 * the table: the rim draws whoever is there in order, and a table where seats
 * 0 and 4 are taken puts them side by side.
 */
function Felt({ felt, place, index, mineSeat = -1, mineName = null, onWatch }) {
  const bodies = Math.max(0, Math.min(9, felt.seated || felt.seats?.length || 0));
  const hot = !!felt.hot;
  const label = felt.blinds || '';

  const inner = (
    <>
      {hot && (
        <span className="csn-felt58__heat" style={{
          background: `radial-gradient(ellipse, ${M_RED}2E 0%, transparent 68%)`,
        }} />
      )}
      {mineSeat >= 0 && <span className="csn-felt58__ring" style={{ border: `1px solid ${M_TEAL}`, boxShadow: `0 0 14px ${M_TEAL}55` }} />}
      <span className="csn-felt58__cloth" style={{
        background: hot
          ? 'radial-gradient(ellipse at 50% 38%, #3A4A42 0%, #22302C 74%)'
          : 'radial-gradient(ellipse at 50% 38%, #2E3F3A 0%, #1C2825 76%)',
        border: `1px solid ${hot ? `${M_RED}5C` : 'rgba(255,255,255,0.09)'}`,
      }} />

      {/* the pot: one gold dot, the smallest thing that says money. Drawn only
          when there IS money — a felt between hands has nothing in the middle,
          and a dot that is always there stops meaning anything. */}
      {felt.pot > 0 && (
        <span className="csn-felt58__pot" style={{
          width: hot ? 7 : 5, height: hot ? 7 : 5,
          background: M_GOLD, boxShadow: `0 0 ${hot ? 9 : 5}px ${M_GOLD}`,
        }} />
      )}

      {Array.from({ length: bodies }).map((_, i) => {
        const th = seatAngle(i, bodies);
        return (
          <span
            key={i}
            className="csn-felt58__seat"
            style={{ left: `${50 + Math.cos(th) * 52}%`, top: `${50 + Math.sin(th) * 56}%` }}
          >
            <TinyGhost i={i + place.x} mine={i === mineSeat} hot={hot} />
          </span>
        );
      })}

      {label && (
        <span className="csn-felt58__stake" style={{
          fontFamily: MONO, fontSize: 8, color: hot ? M_RED : M_MUTED,
        }}>{label}</span>
      )}
    </>
  );

  const style = {
    left: place.x, top: place.y, width: place.r * 2, height: place.r * 1.5,
  };

  const label58 = mineName
    ? `Watch ${mineName} at this table`
    : `Watch table ${felt.tableId}`;

  // `data-mine` is a fact about the felt, not about whether it is tappable, so
  // it rides both branches.
  if (!onWatch) {
    return (
      <div
        className="csn-felt58"
        data-table={felt.tableId}
        data-hot={hot ? 'true' : undefined}
        data-mine={mineSeat >= 0 ? 'true' : undefined}
        style={style}
      >
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="csn-felt58"
      data-table={felt.tableId}
      data-hot={hot ? 'true' : undefined}
      data-mine={mineSeat >= 0 ? 'true' : undefined}
      style={style}
      aria-label={label58}
      onClick={() => onWatch(felt.tableId)}
    >
      {inner}
    </button>
  );
}

/**
 * The bar along the bottom wall.
 *
 * The ref stands four anonymous bodies at it. There is no "who is at the bar"
 * on the wire, and four invented ones would be the only thing on this floor
 * that is not true — so the counter is drawn as furniture (it is why "not
 * playing" has somewhere to be) and the only bodies at it are YOURS: an agent
 * this room contains who is not at one of its felts is a man looking for a
 * seat, which is exactly what standing at the bar means.
 */
function FloorBar({ standing = [] }) {
  return (
    <div className="csn-floor58__bar">
      <span className="csn-floor58__counter" style={{ boxShadow: `0 -3px 14px ${M_GOLD}14` }} />
      {standing.length > 0 && (
        <div className="csn-floor58__standing">
          {standing.map((agent, i) => (
            <span key={agent.id} title={pillName(agent.name)}>
              <TinyGhost i={i * 7 + 3} mine />
            </span>
          ))}
        </div>
      )}
      <span className="csn-floor58__barlabel" style={{
        fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.16em', color: `${M_GOLD}B3`,
      }}>THE BAR</span>
    </div>
  );
}

/**
 * The stairs, and the board bolted beside them.
 *
 * A picture of the board, not the board: the real one is under the room on the
 * phone and beside it on the desk. What this says is WHERE it is — by the
 * stairs, on the wall, in the room — which is the thing a list of headlines
 * cannot say about itself.
 */
function FloorStairs({ lines = 0 }) {
  return (
    <div className="csn-floor58__stairs" aria-hidden>
      <div className="csn-floor58__treads">
        {[9, 14, 19, 24, 29, 34].map((h, i) => (
          <span key={h} style={{
            height: h,
            background: `linear-gradient(180deg, rgba(205,179,128,${0.06 + i * 0.02}) 0%, rgba(255,255,255,0.02) 100%)`,
          }} />
        ))}
      </div>
      <div className="csn-floor58__plaque" style={{ border: `1px solid ${M_GOLD}3D` }}>
        <span style={{ fontFamily: OSWALD, fontSize: 6, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>
          THE BOARD
        </span>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="csn-floor58__rule"
            style={{
              background: i === 0 && lines > 0 ? `${M_GOLD}88` : 'rgba(255,255,255,0.13)',
              width: i ? `${72 - i * 18}%` : '100%',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * THE FLOOR.
 *
 * @param felts    the room's ROOM_TABLES entries, in the order they should be
 *                 placed (yours first — see FloorView.feltsForRoom)
 * @param mineAt   { [tableId]: agent } — your own men, by the table they are at
 * @param standing your agents in this room who are at no felt
 * @param onWatch  (tableId) => watch it
 * @param width    the room's drawn width; the plan is scaled to it
 */
export function TheFloor({
  felts = [], mineAt = {}, standing = [], boardLines = 0, onWatch = null, width = FLOOR_W, height = FLOOR_H,
}) {
  const k = width / FLOOR_W;
  const shown = felts.slice(0, FLOOR_CAP);
  const plan = floorPlan(shown.length);

  return (
    <div className="csn-floor58" style={{ width, height }} data-testid="the-floor">
      <div
        className="csn-floor58__room"
        style={{ width: FLOOR_W, height: height / k, transform: `scale(${k})` }}
      >
        {/* the carpet, running away from the door */}
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="csn-floor58__carpet" style={{ top: 40 + i * 42 }} />
        ))}

        <FloorStairs lines={boardLines} />

        {shown.map((felt, i) => {
          const agent = mineAt[felt.tableId] ?? null;
          // Which body on the rim is his. The rim is drawn in seat order, so
          // his place on it is his index among the seats that are taken.
          const seats = [...(felt.seats ?? [])].sort((a, b) => a.seat - b.seat);
          const mineSeat = agent
            ? seats.findIndex((s) => s.agentId && String(s.agentId) === String(agent.id))
            : -1;
          return (
            <Felt
              key={felt.tableId}
              felt={felt}
              place={plan[i]}
              index={i}
              mineSeat={mineSeat}
              mineName={agent?.name ?? null}
              onWatch={onWatch}
            />
          );
        })}

        <FloorBar standing={standing} />
      </div>
    </div>
  );
}
