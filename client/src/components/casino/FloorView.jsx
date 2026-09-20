// client/src/components/casino/FloorView.jsx — CASINO-2 job 5, UI-3 job A
//
// THE ROOM, FROM ABOVE — and now the only one there is.
//
// This used to be one of three rooms, walked into through a doorway and left
// by swiping to the next. UI-3 job A deletes the building around it: the
// casino is a single room, so this file draws it once, always open, with
// every table on the floor at once — 10/20 beside 50/100, each carrying its
// own stakes (TheFloor/TableFelt already drew a felt's stakes off the felt
// itself, never off the room, so nothing downstream of `ranked` had to
// change). What is gone is the CHOICE of which room to be standing in: no
// swipe, no toggle, no doorway back to a building. The staircase inside the
// room (TheFloor's own furniture) is the only way out, and it goes home.
//
// TWO THINGS THIS STILL OBEYS
//
//   1. SNAPSHOTS ONLY. Every felt here is a ROOM_TABLES entry. Nothing on this
//      screen triggers a model call, opens a socket per table, or asks a table
//      anything — the room is drawn from the push the lobby is already getting.
//   2. THE FISH-TANK LAW HOLDS AT EVERY SCALE. Nobody's hole cards are on a
//      felt in here, including your own man's: the payload does not carry them
//      and TableFelt draws backs. His own two face up is a thing that happens
//      at HIS table, not in a room you are walking through.
//
// THE LIST IS STILL THE FALLBACK, NOT THE DESIGN — when no felts have
// arrived, the room falls back to liveTablesIn's honest list off `room`
// (CasinoScreen's merged venue: every room's `hot` ids and the single biggest
// pot across all of them) and still says how many tables it could not name.
//
// ON THE DESK it is full width with the deploy panel as a right column, the
// same departure from FIX-6 job 5's "every sheet opens in the rail" this
// screen always took: it is a destination, not a sheet.

import { useLayoutEffect, useRef, useState } from 'react';

import { useSheetDrag } from '../../hooks/useSheetDrag.js';
import { RosterButton } from '../Header.jsx';
import { TheFloor, FLOOR_CAP, FLOOR_W, FLOOR_H } from './TheFloor.jsx';
import { money } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';
const M_TEAL = 'var(--accent)';
const M_GOLD = 'var(--gold-reward)';
import { Btn, count } from './CasinoBuilding.jsx';

const MONO = '"JetBrains Mono",ui-monospace,monospace';
const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const PLAYFAIR = '"Playfair Display",Georgia,serif';
const M_TEXT = 'var(--text-primary)';
const M_MUTED = 'var(--text-muted)';

/** The table an agent is actually sitting at, however the payload says it. */
export function tableIdOf(agent) {
  const id = agent?.liveGame?.tableId ?? agent?.activeTableId ?? agent?.location?.tableId ?? null;
  return id == null ? null : String(id);
}

/** Kitchen/host tables are movable home-game seats, not casino admission. */
export function casinoTableIdOf(agent) {
  const homeIds = new Set([
    agent?.homeTableId,
    agent?.liveGame?.home ? agent.liveGame.tableId : null,
    ['home', 'visiting'].includes(agent?.location?.where) ? agent.location.tableId : null,
  ].filter(Boolean).map(String));
  return [agent?.liveGame?.tableId, agent?.activeTableId, agent?.location?.tableId]
    .filter(id => id != null).map(String)
    .find(id => !id.startsWith('home-') && !homeIds.has(id)) ?? null;
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
    const id = casinoTableIdOf(agent);
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
              color: M_GOLD, border: `1px solid color-mix(in srgb, ${M_GOLD} 46.67%, transparent)`, background: `color-mix(in srgb, ${M_GOLD} 10.2%, transparent)`,
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

// UI-3 JOB A — ONE ROOM, NOTHING TO SWIPE TO. The stairs used to be drawn
// here, under the room and again above the desk's board column, with the
// board bolted beside them. There is one room now and no board left to say
// the location of, so wave 58's stairs (TheFloor's FloorStairs) go back to
// being only what they always also were — the way out — and this file's own
// job shrinks to match: it draws the one room the casino has, not a room
// picked from a swipeable set of three.

/**
 * THE FLOOR — one room, seen from above.
 *
 * @param room     { id, name, hot, biggestPot, tables, seated } — the whole
 *                 casino's tables and seats, merged across every stake tier
 *                 (CasinoScreen's job; see mergedVenue there). Stakes are no
 *                 longer a fact about the room — each felt/table carries its
 *                 own, drawn by TheFloor/TableFelt directly off `felt.blinds`.
 * @param felts    every live table's ROOM_TABLES entry, across every stake
 * @param agents   all of YOUR agents who are seated somewhere on this floor
 * @param events   the ticker, for the fallback list's headlines
 * @param deployPanel the stake-picker or the quick-play card, rendered by the
 *                 caller so this file never has to know what either needs —
 *                 same division of labour the old `board` prop had
 * @param onWatch  (tableId) => spectate it
 * @param onHome   back home — the screen's only way out, and the staircase's
 * @param desktop  full width, the deploy panel as a right column
 */
export function FloorView({
  room, felts = [], agents = [], events = [], deployPanel = null,
  onWatch, onHome = null, onOpenRoster = null, onOpenBar = null, desktop = false,
  headerOwned = false, zoom = null, onZoom = null,
  ticker = null, yourTables = null,
}) {
  // The phone still drags to dismiss: the gesture is how you leave a room in
  // this app and it predates this screen. The desk does not — there is nowhere
  // to drag a full-width destination to, and it would only spring back. There
  // is nowhere left to dismiss TO but home, now that the building behind this
  // room is gone.
  const drag = useSheetDrag(onHome);
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
    else if (!['home', 'visiting'].includes(agent.location?.where)
      && (!tableIdOf(agent) || casinoTableIdOf(agent))) standing.push(agent);
  }

  // DkFloorStage: fit the 390×470 plan into both available axes. The phone
  // stays width-led and scrolls; the desktop keeps the bar inside the stage.
  // Tables arrive asynchronously, so attach measurement when this conditional
  // wrapper appears, and reconnect if the list disappears/reappears.
  const roomRef = useRef(null);
  const [floorW, setFloorW] = useState(FLOOR_W);
  const [floorH, setFloorH] = useState(FLOOR_H);
  const hasFelts = ranked.length > 0;
  useLayoutEffect(() => {
    const el = roomRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (zoom && h > 0) setFloorH(h);
      if (w > 0 && (!desktop || h > 0)) {
        setFloorW(desktop ? Math.min(w, h * FLOOR_W / FLOOR_H) : w);
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasFelts, desktop, !!zoom]);

  return (
    <div
      className={`csn-floor${desktop ? ' csn-floor--desk' : ''}${zoom ? ' csn-floor--zoom' : ''}`}
      data-testid="floor-view"
      data-room={room.id}
      role="group"
      aria-label={`${room.name} — the room`}
      ref={desktop ? undefined : drag.ref}
      style={desktop ? undefined : drag.style}
      {...(desktop ? {} : drag.handlers)}
    >
      {!headerOwned && <div className="csn-floor__head">
        <button type="button" className="csn-floor__back" onClick={zoom ? () => onZoom?.(null) : onHome} aria-label={zoom ? 'Back to the floor' : 'Back home'}>
          {zoom ? '← THE FLOOR' : '← HOME'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: PLAYFAIR, fontSize: 16, fontWeight: 600, color: M_TEXT,
            lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{zoom ? 'Table · ' + zoom.blinds : room.name}</div>
          <div aria-label={zoom ? undefined : 'Everyone on the floor, including the House'} style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>
            {zoom ? 'pinch again to watch' : <><span>{`${count(room.seated)} in · ${count(room.tables)} table${room.tables === 1 ? '' : 's'}`}</span><span className="csn-floor__census-note"> · incl. House</span></>}
          </div>
        </div>
        {onOpenRoster && <RosterButton onOpenRoster={onOpenRoster} />}
      </div>}

      <div className="csn-floor__overview" hidden={!!zoom}>{ticker}{yourTables}</div>

      <div className="csn-floor__body">
        <div className="csn-floor__room">
          {ranked.length > 0 ? (
            <div className="csn-floor__plan" ref={roomRef}>
              <TheFloor
                felts={ranked}
                zoom={zoom} onZoom={onZoom}
                mineAt={mineAt}
                standing={standing}
                onWatch={onWatch}
                onOpenBar={onOpenBar}
                onHome={zoom ? null : onHome}
                width={floorW}
                height={zoom && !desktop ? floorH : floorW * ((desktop ? FLOOR_H : 330) / FLOOR_W)}
              />
            </div>
          ) : rows.length > 0 ? (
            <ul className="csn-floor__list">
              {rows.map((row) => <TableRow key={row.tableId} row={row} onWatch={onWatch} />)}
            </ul>
          ) : (
            <p className="csn-floor__quiet">
              {room.tables > 0
                ? 'The floor has not named a table yet. Watch the ticker at the top — a felt that goes hot puts itself on this list.'
                : 'Nothing is running right now.'}
            </p>
          )}

          {!ranked.length && onOpenBar && <button type="button" className="csn-floor__bar-entry" onClick={onOpenBar}>Open casino bar</button>}

          {!zoom && beyond > 0 && (
            <p className="csn-floor__unnamed">
              {`${beyond} more table${beyond === 1 ? '' : 's'} running than the room has space to draw.`}
            </p>
          )}

          {!zoom && unnamed > 0 && (
            <p className="csn-floor__unnamed">
              {`${unnamed} more table${unnamed === 1 ? '' : 's'} the floor has not named.`}
            </p>
          )}

        </div>

        {/* The deploy panel — a stake picker while placing a man, or the
            quick-play card. One stable position regardless of whether the
            floor has named any tables yet: moving it between two different
            parents when the first felt arrives would unmount and remount it
            mid-interaction, which is a worse bug than the panel keeping the
            same modest footprint the whole time. */}
        {deployPanel && (!zoom || desktop) && (
          <div className="csn-floor__board csn-floor__board--play">
            {deployPanel}
          </div>
        )}
      </div>
    </div>
  );
}
