// client/src/components/casino/FloorView.jsx — CASINO-2 job 5
//
// THE ROOM, FROM ABOVE.
//
// A doorway was scenery unless you had arrived carrying an agent to place. You
// could see that the floor had 44 people in it and three tables going, and
// there was nothing to tap. The room is the unit this building is organised
// by — "where should I be looking right now" is the question it exists to
// answer — so tapping one has to answer it.
//
// BUGS-A job 7 answered it as far as the wire then allowed: a LIST of the
// tables the client could name, assembled out of the room's `hot` ids, your
// own agents' tables and the ticker, saying out loud how many it could not
// name. It guessed well and it was still a guess, and the file said so —
// "when ROOMS-1 grows a table list, this component keeps its shape and
// liveTablesIn is the only thing that changes".
//
// ROOMS-1 grew one (CASINO-2 job 1), so this is that change, and it turned out
// to be bigger than the data layer. Once every table in a room can be named,
// the room stops being a list and becomes a PLACE: felts laid out on a floor,
// tiny ghosts in the seats of each, the pot in the middle of the ones with a
// hand running, and the board by the stairs on the wall. You are standing in
// the room rather than reading its index.
//
// THREE THINGS THIS OBEYS
//
//   1. SNAPSHOTS ONLY. Every felt here is a ROOM_TABLES entry. Nothing on this
//      screen triggers a model call, opens a socket per table, or asks a table
//      anything — the room is drawn from the push the lobby is already getting.
//   2. THE FISH-TANK LAW HOLDS AT EVERY SCALE. Nobody's hole cards are on a
//      felt in here, including your own man's: the payload does not carry them
//      and TableFelt draws backs. His own two face up is a thing that happens
//      at HIS table, not in a room you are walking through.
//   3. THE LIST IS THE FALLBACK, NOT THE DESIGN. When no felts have arrived —
//      the socket is down, or the first frame has not landed — the room falls
//      back to liveTablesIn's honest list and still says how many tables it
//      could not name. A busy room drawn as an empty one would be a worse lie
//      than the guess ever was.
//
// ON THE DESK it is full width with the board as a right column, and that is a
// deliberate departure from FIX-6 job 5's "every sheet opens in the rail". The
// rail rule is about SHEETS — a bottom sheet at 1440 covers the doorway it is
// about. This is not a sheet: it is a destination, it replaces the building
// rather than sitting over it, and it brings the board with it so the ticker
// is not lost on the way in.
//
// WAVE 58 REDREW THE ROOM ITSELF. The first pass at this laid the felts out as
// a grid of cards; mood-floor58.jsx landed a week of thinking about exactly
// this screen and its verdict on that shape is in its own header — "a floor you
// have to read is a list". The room is TheFloor.jsx now: a plan seen from
// above, felts as ellipses with tiny bodies on their rims, the bar along the
// bottom wall, the board bolted beside the stairs. This file is the screen
// around it — the way in, the way out, the fallback, and the real board.

import { useEffect, useRef, useState } from 'react';

import { useSheetDrag } from '../../hooks/useSheetDrag.js';
import { TheFloor, FLOOR_CAP, FLOOR_W, FLOOR_H } from './TheFloor.jsx';
import { money } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';
import { M_TEAL, M_GOLD } from '../floor/atoms.jsx';
import { Btn, count } from './CasinoBuilding.jsx';

const MONO = '"JetBrains Mono",ui-monospace,monospace';
const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const PLAYFAIR = '"Playfair Display",Georgia,serif';
const M_TEXT = '#EDEDED';
const M_MUTED = '#6B6B6B';

/** The table an agent is actually sitting at, however the payload says it. */
export function tableIdOf(agent) {
  const id = agent?.liveGame?.tableId ?? agent?.activeTableId ?? agent?.location?.tableId ?? null;
  return id == null ? null : String(id);
}

/**
 * Every table in this room the client can name, newest information first.
 *
 * Ordering is by how much it is asking for you: hot, then the biggest pot,
 * then the ones with your own agents at them, then the rest.
 *
 * @returns {Array<{ tableId, hot, pot, mine, headline }>}
 */
export function liveTablesIn(room, { agents = [], events = [] } = {}) {
  if (!room) return [];
  const by = new Map();
  const touch = (tableId) => {
    const id = String(tableId);
    if (!by.has(id)) by.set(id, { tableId: id, hot: false, pot: null, mine: [], headline: null });
    return by.get(id);
  };

  for (const id of room.hot ?? []) touch(id).hot = true;
  if (room.biggestPot?.tableId) {
    const row = touch(room.biggestPot.tableId);
    row.pot = Math.max(row.pot ?? 0, Math.round(room.biggestPot.pot) || 0);
  }

  // Yours in this room. `agents` is already the room's bucket (agentsByRoom),
  // so no blinds arithmetic happens here.
  for (const agent of agents) {
    const id = tableIdOf(agent);
    if (!id) continue;
    const row = touch(id);
    row.mine.push(agent);
    const pot = Number(agent?.liveGame?.pot);
    if (Number.isFinite(pot) && pot > 0) row.pot = Math.max(row.pot ?? 0, Math.round(pot));
  }

  // A headline only ever DECORATES a table already in the list. An event names
  // a table this room has not claimed, and guessing it belongs here from the
  // stakes chip alone would put another room's cooler in this doorway.
  for (const e of events) {
    if (!e?.tableId) continue;
    const id = String(e.tableId);
    if (!by.has(id)) continue;
    const row = by.get(id);
    if (!row.headline) row.headline = e.headline ?? null;
  }

  const rank = (r) => (r.hot ? 0 : r.pot != null ? 1 : r.mine.length ? 2 : 3);
  return [...by.values()].sort((a, b) => rank(a) - rank(b) || a.tableId.localeCompare(b.tableId));
}

/** "3 of 8 tables in here have a name on them" — or nothing, when they all do. */
export function unnamedCount(room, named) {
  const total = Math.max(0, Number(room?.tables) || 0);
  return Math.max(0, total - named);
}


// ── The fallback list ───────────────────────────────────────────────────────
//
// Drawn only when no felts have arrived. It is the BUGS-A job 7 row, unchanged,
// because what it does is exactly what is needed as a fallback: name what can
// be named and count what cannot, rather than let a busy room read as empty.

function TableRow({ row, onWatch }) {
  const mine = row.mine.map((a) => pillName(a.name)).join(', ');
  return (
    <li style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
      borderTop: '1px solid rgba(255,255,255,0.055)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: M_TEXT }}>
            {`#${row.tableId}`}
          </span>
          {row.hot && (
            <span style={{
              fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.16em',
              color: M_GOLD, border: `1px solid ${M_GOLD}77`, background: `${M_GOLD}1A`,
              borderRadius: 3, padding: '1px 5px',
            }}>HOT</span>
          )}
          {row.pot != null && (
            <span style={{ fontFamily: MONO, fontSize: 10, color: M_GOLD }}>
              {`${money(row.pot)} in the middle`}
            </span>
          )}
        </div>
        <div style={{
          fontSize: 10, color: mine ? M_TEAL : M_MUTED, marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {mine ? `${mine} ${row.mine.length > 1 ? 'are' : 'is'} in here` : (row.headline ?? 'a game is running')}
        </div>
      </div>
      <Btn h={28} kind={row.mine.length ? 'primary' : 'outline'} onClick={() => onWatch?.(row.tableId)}>
        {row.mine.length ? 'Watch him' : 'Watch'}
      </Btn>
    </li>
  );
}

// ── The room ────────────────────────────────────────────────────────────────

/**
 * The felts in this room, with your own men's tables first.
 *
 * The server already ranked them by how loudly they are asking for anybody —
 * hot, then the money in the middle — and that ordering stands underneath.
 * This only lifts YOURS above it, because a room you walked into to check on
 * your man is a room where his table is the one you came for, however quiet it
 * happens to be.
 */
export function feltsForRoom(felts = [], agents = []) {
  const mine = new Set(agents.map((a) => tableIdOf(a)).filter(Boolean));
  return [...felts].sort(
    (a, b) => (mine.has(b.tableId) ? 1 : 0) - (mine.has(a.tableId) ? 1 : 0),
  );
}

// The stairs used to be drawn here, under the room and again above the desk's
// board column. Wave 58 puts them INSIDE the room, with the board bolted beside
// them — which is the whole point of drawing either: it says WHERE the board is
// rather than just listing what is on it. Saying it twice on one screen made
// the second one furniture about furniture.

/**
 * THE FLOOR — one room, seen from above.
 *
 * @param room     one entry of the ROOMS-1 payload
 * @param felts    the ROOM_TABLES entries for THIS room (job 1)
 * @param agents   YOUR agents in this room (agentsByRoom's bucket)
 * @param events   the ticker, for the fallback list's headlines
 * @param board    the board by the stairs, rendered by the caller so this file
 *                 never has to know what a FloorBoard needs
 * @param onWatch  (tableId) => spectate it
 * @param onClose  back to the building
 * @param desktop  full width, the board as a right column
 */
export function FloorView({
  room, felts = [], agents = [], events = [], board = null,
  onWatch, onClose, desktop = false,
}) {
  // The phone still drags to dismiss: the gesture is how you leave a room in
  // this app and it predates this screen. The desk does not — there is nowhere
  // to drag a full-width destination to, and it would only spring back.
  const drag = useSheetDrag(onClose);
  const ranked = feltsForRoom(felts, agents);
  const rows = ranked.length === 0 ? liveTablesIn(room, { agents, events }) : [];
  const unnamed = unnamedCount(room, ranked.length || rows.length);
  // The room holds six. A busier one says how many more rather than drawing
  // them smaller until none of them is legible — the ref's law, and the
  // difference between a room and a map of the building.
  const beyond = Math.max(0, ranked.length - FLOOR_CAP);

  // Your men in this room, by the felt they are at — and the ones who are in
  // here at no felt, who are the only bodies the bar has any right to.
  const mineAt = {};
  const standing = [];
  for (const agent of agents) {
    const id = tableIdOf(agent);
    if (id && ranked.some((f) => f.tableId === id)) mineAt[id] = agent;
    else standing.push(agent);
  }

  // The plan is drawn in 390 units and scaled, so the room needs a width. It
  // is measured rather than assumed: the desk's room column is whatever the
  // stage leaves it, and a hard-coded 390 in the middle of a 1,000px column is
  // the phone's layout with air poured down one side.
  //
  // Measured off a wrapper with NO PADDING of its own. The first version
  // measured the scrolling column, whose clientWidth includes its 14px gutters
  // — so at 390 it reported 390, the plan scaled by 1.0 into a 362px box, and
  // the stairs and the bar hung off the right edge of the phone.
  const roomRef = useRef(null);
  const [floorW, setFloorW] = useState(FLOOR_W);
  useEffect(() => {
    const el = roomRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      // Capped, and not at the column's width. The plan is drawn at 390 and a
      // 1,000px column would blow it up to 2.5x — the felts become lakes, the
      // bodies stay specks on them, and the room reads as a magnified phone,
      // which is exactly what FIX-6 fixed about the desk casino. 520 is about
      // a third bigger than drawn: enough that the desk is using its width,
      // not so much that the room stops being a room.
      if (w > 0) setFloorW(Math.min(520, w));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={`csn-floor${desktop ? ' csn-floor--desk' : ''}`}
      data-testid="floor-view"
      data-room={room.id}
      role="group"
      aria-label={`${room.name} — the room`}
      ref={desktop ? undefined : drag.ref}
      style={desktop ? undefined : drag.style}
      {...(desktop ? {} : drag.handlers)}
    >
      <div className="csn-floor__head">
        <button type="button" className="csn-floor__back" onClick={onClose} aria-label="Back to the casino">
          ← THE CASINO
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT,
            lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{room.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>
            {`${room.stakes.label} · ${count(room.seated)} in · ${count(room.tables)} table${room.tables === 1 ? '' : 's'}`}
          </div>
        </div>
      </div>

      <div className="csn-floor__body">
        <div className="csn-floor__room">
          {ranked.length > 0 ? (
            <div className="csn-floor__plan" ref={roomRef}>
              <TheFloor
                felts={ranked}
                mineAt={mineAt}
                standing={standing}
                boardLines={events.length}
                onWatch={onWatch}
                width={floorW}
                height={floorW * (FLOOR_H / FLOOR_W)}
              />
            </div>
          ) : rows.length > 0 ? (
            <ul className="csn-floor__list">
              {rows.map((row) => <TableRow key={row.tableId} row={row} onWatch={onWatch} />)}
            </ul>
          ) : (
            <p className="csn-floor__quiet">
              {room.tables > 0
                ? 'The floor has not named a table in here yet. Watch the board by the stairs — a felt that goes hot puts itself on this list.'
                : 'Nothing is running in here right now.'}
            </p>
          )}

          {beyond > 0 && (
            <p className="csn-floor__unnamed">
              {`${beyond} more table${beyond === 1 ? '' : 's'} running in here than the room has space to draw.`}
            </p>
          )}

          {unnamed > 0 && (
            <p className="csn-floor__unnamed">
              {`${unnamed} more table${unnamed === 1 ? '' : 's'} in here the floor has not named.`}
            </p>
          )}

        </div>

        {/* The board by the stairs. On the phone it is under the room, where
            the stairs are; on the desk it is the right column, which is the
            same place — you pass it on the way out either way. */}
        {board && (
          <div className="csn-floor__board">{board}</div>
        )}
      </div>
    </div>
  );
}
