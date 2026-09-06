// client/src/components/casino/RoomTablesSheet.jsx — BUGS-A job 7
//
// WHAT IS ACTUALLY RUNNING IN THIS ROOM, AND A WAY INTO IT.
//
// A doorway was scenery unless you had arrived carrying an agent to place. You
// could see that the floor had 44 people in it and three tables going, and
// there was nothing to tap. The room is the unit this building is organised
// by — "where should I be looking right now" is the question it exists to
// answer — so tapping one has to answer it.
//
// WHAT THIS SHEET CAN HONESTLY NAME, and this is the whole design constraint:
// the ROOMS-1 payload carries COUNTS (`tables`, `seated`) and only two kinds of
// named table — the ids that fired `hot` inside the window, and the room's
// biggest pot. There is no table→room map on the wire (see the header of
// useCasinoRooms.js). So the list is assembled from the three sources the
// client genuinely has:
//
//   1. the room's own `hot` ids and its `biggestPot`
//   2. YOUR agents sitting in this room — their table, by name, with the pot
//      off the same liveGame the away frames read
//   3. the ticker's lines, when the line's table is one of the above
//
// and it says out loud how many it could not name rather than pretending the
// room is only as big as the list. A lobby that quietly shows three of eleven
// tables is a lobby lying about the building.
//
// When ROOMS-1 grows a table list, this component keeps its shape and
// `liveTablesIn` is the only thing that changes.

import { useSheetDrag } from '../../hooks/useSheetDrag.js';
import { money } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';
import { M_TEAL, M_GOLD } from '../floor/atoms.jsx';
import { Btn, count } from './CasinoBuilding.jsx';

const MONO = '"JetBrains Mono",ui-monospace,monospace';
const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const PLAYFAIR = '"Playfair Display",Georgia,serif';
const M_TEXT = '#EDEDED';
const M_DIM = '#A1A1A1';
const M_MUTED = '#6B6B6B';
const M_BORDER = 'rgba(255,255,255,0.12)';

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

function TableRow({ row, onWatch }) {
  const mine = row.mine.map((a) => pillName(a.name)).join(', ');
  return (
    <li style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
      borderTop: `1px solid rgba(255,255,255,0.055)`,
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
        <div style={{ fontSize: 10, color: mine ? M_TEAL : M_MUTED, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {mine ? `${mine} ${row.mine.length > 1 ? 'are' : 'is'} in here` : (row.headline ?? 'a game is running')}
        </div>
      </div>
      <Btn h={28} kind={row.mine.length ? 'primary' : 'outline'} onClick={() => onWatch?.(row.tableId)}>
        {row.mine.length ? 'Watch him' : 'Watch'}
      </Btn>
    </li>
  );
}

/**
 * The room, opened.
 *
 * @param room     one entry of the ROOMS-1 payload
 * @param agents   YOUR agents in this room (agentsByRoom's bucket)
 * @param events   the ticker, for headlines on tables already listed
 * @param onWatch  (tableId) => spectate it
 * @param onClose  put the sheet away
 */
export function RoomTablesSheet({ room, agents = [], events = [], onWatch, onClose }) {
  const drag = useSheetDrag(onClose);
  const rows = liveTablesIn(room, { agents, events });
  const unnamed = unnamedCount(room, rows.length);

  return (
    <div className="home-sheet" role="dialog" aria-label={`${room.name} — what is running`} data-testid="room-tables-sheet">
      <button type="button" className="home-sheet__scrim" onClick={onClose} aria-label="Close" />
      <div
        className={`home-sheet__panel${drag.dragging ? ' is-dragging' : ''}`}
        ref={drag.ref}
        style={drag.style}
        {...drag.handlers}
      >
        <div className="home-sheet__head">
          <span style={{ flex: 1, fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT }}>
            {room.name}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, marginRight: 8 }}>
            {`${room.stakes.label} · ${count(room.seated)} in`}
          </span>
          <button type="button" className="home-sheet__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {rows.length === 0 ? (
          <p style={{ fontSize: 11.5, color: M_DIM, margin: '4px 0 10px', lineHeight: 1.5 }}>
            {room.tables > 0
              ? 'The floor has not named a table in here yet. Watch the board by the stairs — a felt that goes hot puts itself on this list.'
              : 'Nothing is running in here right now.'}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: '46vh', overflowY: 'auto' }}>
            {rows.map((row) => <TableRow key={row.tableId} row={row} onWatch={onWatch} />)}
          </ul>
        )}

        {unnamed > 0 && (
          <p style={{
            fontFamily: MONO, fontSize: 9.5, color: M_MUTED, margin: '10px 0 0',
            paddingTop: 9, borderTop: `1px solid ${M_BORDER}`,
          }}>
            {`${unnamed} more table${unnamed === 1 ? '' : 's'} in here the floor has not named.`}
          </p>
        )}
      </div>
    </div>
  );
}
