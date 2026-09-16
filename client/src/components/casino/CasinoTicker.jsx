// client/src/components/casino/CasinoTicker.jsx — CASINO-2 job 2, UI-3 job A
//
// UI-3 JOB A — THE BOARD IS GONE; THE TICKER MOVES TO THE TOP.
//
// CASINO-2 job 2 split "the board by the stairs" into LIVE NOW (pots being
// built, off the felts) and TONIGHT (hands that are over, ranked by money,
// off the ticker), and hung both on a wall inside a room you had to walk
// into. There is one room now and no wall to hang a two-panel board on, so
// the board itself — LiveNow, Tonight, FloorBoard — is deleted along with it.
//
// What is not deleted is the QUESTION those two halves were answering — "is
// anything happening right now, and is it worth tapping" — because that
// question did not stop mattering when the doorways did. `CasinoTicker` asks
// it in one line instead of two panels, pinned to the very top of the
// screen: the biggest pot in the air if one is being built (LIVE NOW's own
// ranking, unchanged), the biggest thing that finished tonight if none is
// (TONIGHT's, unchanged), or a quiet floor says so.
//
// The ranking and the house vocabulary are the load-bearing parts of the old
// board and neither changed, so `whoIn`, `liveRows`, `usePotTicks`,
// `tonightRows`, `tonightLabel` and `replayable` are unchanged, verbatim.

import { useEffect, useMemo, useRef, useState } from 'react';

import { money } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';
import { CasinoEventType } from '../../lib/events.js';
const M_TEAL = 'var(--accent)';
const M_GOLD = 'var(--gold-reward)';
const M_RED = 'var(--error)';
import { Num } from '../wallet/atoms.jsx';
import { LiveDot, count } from './CasinoBuilding.jsx';

const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const MONO = '"JetBrains Mono",ui-monospace,monospace';
const M_DIM = 'var(--text-secondary)';
const M_MUTED = 'var(--text-muted)';

// A default that is the SAME EMPTY SET every render. `mineIds = new Set()` in a
// signature mints a new one each time, which makes every memo downstream of it
// recompute and every effect keyed on it re-run — and an effect that re-runs is
// an effect whose cleanup fires, which is how the pot tick below lost its timer
// and never expired.
const NOBODY = new Set();

// ── LIVE NOW · what is in the middle right now ──────────────────────────────

/** The most names a row spells out before the rest become a count. */
const NAMED = 2;

/**
 * Who is in this pot, as one line.
 *
 * Your own man is named first and marked as yours — "your Balanced v2.1 +3" —
 * because the whole reason to look at a board of strangers' pots is to find
 * out that one of them is not a stranger's.
 */
export function whoIn(felt, mineIds = NOBODY) {
  const seats = (felt?.seats ?? []).filter((s) => s.inHand);
  const players = seats.length ? seats : (felt?.seats ?? []);
  const mine = players.filter((s) => s.agentId && mineIds.has(String(s.agentId)));
  const rest = players.filter((s) => !mine.includes(s));
  const ordered = [...mine, ...rest];
  if (ordered.length === 0) return '';
  const named = ordered.slice(0, NAMED).map((s) => {
    const name = pillName(s.name);
    return mine.includes(s) ? `your ${name}` : name;
  });
  const more = ordered.length - named.length;
  return more > 0 ? `${named.join(', ')} +${more}` : named.join(', ');
}

/**
 * The pots being built right now, biggest first.
 *
 * Only felts with money in the middle: a table between hands is a true thing
 * about the room and it is not news, and a board padded with $0 rows to reach
 * a fixed length is a board that has stopped meaning anything.
 */
export function liveRows(felts = [], { mineIds = NOBODY, rooms = [], limit = 3 } = {}) {
  return felts
    .filter((f) => f && f.pot > 0)
    .map((f) => ({
      tableId: f.tableId,
      pot: f.pot,
      hot: !!f.hot,
      who: whoIn(f, mineIds),
      mine: (f.seats ?? []).some((s) => s.agentId && mineIds.has(String(s.agentId))),
      room: rooms.find((r) => r.id === f.room)?.stakes?.label ?? f.blinds ?? '',
    }))
    .sort((a, b) => b.pot - a.pot || a.tableId.localeCompare(b.tableId))
    .slice(0, limit);
}

/**
 * The "+" tick: how much a pot grew since the last frame, for a beat.
 *
 * It is what makes "so far" legible. A number that silently changes from 940
 * to 1,180 is a number you have to have been watching to notice; the same
 * change with "+240" beside it for a moment is a hand happening in front of
 * you. The tick expires — a stale one would say a pot is still growing when
 * it has been called and is sitting still.
 */
export function usePotTicks(rows, { ttlMs = 1600 } = {}) {
  const seen = useRef(new Map());
  const latest = useRef(rows);
  latest.current = rows;
  const [ticks, setTicks] = useState({});

  // Keyed on WHAT THE ROWS SAY, not on the array that says it. A parent that
  // re-renders for an unrelated reason hands this a new array with the same
  // pots in it; keyed on identity, that tears down the pending expiry timer and
  // the tick sticks on screen forever, claiming a pot is still growing.
  const signature = rows.map((r) => `${r.tableId}:${r.pot}`).join('|');

  useEffect(() => {
    const rows = latest.current;
    const grown = {};
    const live = new Set();
    for (const row of rows) {
      live.add(row.tableId);
      const before = seen.current.get(row.tableId);
      if (before != null && row.pot > before) grown[row.tableId] = row.pot - before;
      seen.current.set(row.tableId, row.pot);
    }
    // A table that left the board takes its history with it, so a felt that
    // comes back after a break does not tick with a delta from last time.
    for (const id of [...seen.current.keys()]) if (!live.has(id)) seen.current.delete(id);

    const ids = Object.keys(grown);
    if (ids.length === 0) return undefined;
    setTicks((prev) => ({ ...prev, ...grown }));
    const timer = setTimeout(() => {
      setTicks((prev) => {
        const next = { ...prev };
        for (const id of ids) if (next[id] === grown[id]) delete next[id];
        return next;
      });
    }, ttlMs);
    return () => clearTimeout(timer);
  }, [signature, ttlMs]);

  return ticks;
}

// ── TONIGHT · what is over ──────────────────────────────────────────────────

// EVENT-1's types in the house vocabulary. `hot` is deliberately absent: a hot
// table is a hand still being played, so it belongs to LIVE NOW and putting it
// under TONIGHT would file a live pot under things that are over.
const TONIGHT_LABELS = {
  [CasinoEventType.BIG_POT]: 'BIGGEST POT',
  [CasinoEventType.COOLER]: 'COOLER',
  [CasinoEventType.HEATER]: 'HEATER',
  [CasinoEventType.BUST]: 'BUST',
  [CasinoEventType.NEMESIS_SEATED]: 'NEMESIS',
};

export function tonightLabel(type) {
  return TONIGHT_LABELS[type] ?? 'FLOOR';
}

/**
 * The evening, ranked by money.
 *
 * RANKED, not newest-first. A bust for $0 is at the bottom of the board
 * however recently it happened, and the biggest pot of the night is the
 * headline until something beats it.
 *
 * A tie on money keeps the newer one above, so a quiet floor where every line
 * is a $0 bust still reads as a list of things that happened in order.
 */
export function tonightRows(events = [], mineIds = NOBODY, limit = 4) {
  return events
    .filter((e) => e && TONIGHT_LABELS[e.type])
    .map((e) => ({
      ...e,
      pot: Math.max(0, Number(e.pot) || 0),
      mine: (e.agentIds ?? []).some((id) => mineIds.has(String(id))),
    }))
    .sort((a, b) => b.pot - a.pot || (b.id ?? 0) - (a.id ?? 0))
    .slice(0, limit);
}

/**
 * Can this line be replayed?
 *
 * Only your own. A replay is driven by the flagged-hand record, which is filed
 * per agent under the owner who owns him — there is no such record for a
 * stranger's cooler and there is no honest way to fabricate one.
 */
export function replayable(row) {
  return !!row?.mine && !!row?.agentIds?.length && Number.isFinite(Number(row?.handNumber)) && Number(row.handNumber) > 0;
}

// ── The ticker bar ───────────────────────────────────────────────────────────

/**
 * ONE LINE, AT THE VERY TOP — UI-3 job A.
 *
 * Prefers LIVE NOW's own ranking (the biggest pot still being built, and it
 * is the one number on this screen that will be wrong in a minute) over
 * TONIGHT's (the biggest thing that already finished), because a hand you can
 * still do something about outranks one that is over. Falls back to a quiet
 * line when neither has anything to say — a floor with nothing running is a
 * true state, not an empty ticker pretending to be down.
 */
export function CasinoTicker({ felts = [], events = [], mineIds = NOBODY, rooms = [], onWatch = null, onReplay = null }) {
  const live = useMemo(() => liveRows(felts, { mineIds, rooms, limit: 1 }), [felts, mineIds, rooms]);
  const ticks = usePotTicks(live);
  const tonight = useMemo(() => tonightRows(events, mineIds, 1), [events, mineIds]);

  if (live.length > 0) {
    const row = live[0];
    const tick = ticks[row.tableId] ?? 0;
    const inner = (
      <>
        <LiveDot color={row.hot ? M_RED : M_GOLD} size={5} />
        <Num size={12} weight={700} color={row.hot ? M_RED : M_GOLD}>{money(row.pot)}</Num>
        {tick > 0 && (
          <span data-testid={`ticker-tick-${row.tableId}`} style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: M_TEAL, flexShrink: 0 }}>
            {`+${count(tick)}`}
          </span>
        )}
        <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: M_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.who ? `${row.who} in the middle` : 'in the middle'}
        </span>
        {onWatch && (
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.11em', color: row.hot ? M_RED : M_TEAL, flexShrink: 0 }}>
            {row.hot ? 'HOT · WATCH' : 'WATCH'}
          </span>
        )}
      </>
    );
    if (!onWatch) return <div className="csn-ticker" data-testid="casino-ticker">{inner}</div>;
    return (
      <button
        type="button"
        className="csn-ticker"
        data-testid="casino-ticker"
        data-hot={row.hot ? 'true' : undefined}
        aria-label={`${money(row.pot)} in the middle — ${row.who || 'a table'}. Watch this table.`}
        onClick={() => onWatch(row.tableId)}
      >{inner}</button>
    );
  }

  if (tonight.length > 0) {
    const row = tonight[0];
    const can = replayable(row) && !!onReplay;
    const inner = (
      <>
        <Num size={12} weight={700} color={M_GOLD}>{money(row.pot)}</Num>
        <span style={{ flex: 1, minWidth: 0, fontSize: 10.5, color: M_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.headline}
        </span>
        <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.11em', color: M_MUTED, flexShrink: 0 }}>
          {tonightLabel(row.type)}
        </span>
        {can && (
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.11em', color: M_TEAL, flexShrink: 0 }}>
            REPLAY
          </span>
        )}
      </>
    );
    if (!can) return <div className="csn-ticker" data-testid="casino-ticker">{inner}</div>;
    return (
      <button
        type="button"
        className="csn-ticker"
        data-testid="casino-ticker"
        aria-label={`${tonightLabel(row.type)} — ${row.headline}. Replay this hand.`}
        onClick={() => onReplay(row)}
      >{inner}</button>
    );
  }

  return (
    <div className="csn-ticker csn-ticker--quiet" data-testid="casino-ticker">
      <span style={{ fontSize: 10.5, color: M_MUTED }}>The floor is quiet.</span>
    </div>
  );
}
