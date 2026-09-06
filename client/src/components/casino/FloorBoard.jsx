// client/src/components/casino/FloorBoard.jsx — CASINO-2 job 2
//
// THE BOARD BY THE STAIRS, SPLIT IN TWO.
//
// It was one list of five ticker lines, newest first, and that ordering was
// the problem: NEWEST IS NOT MOST INTERESTING. A bust that happened four
// seconds ago sat above a $14,000 pot from two minutes ago, and the $8,400 pot
// that is being built RIGHT NOW — the one thing on the board you can still do
// something about — was not on it at all, because a hand that has not ended
// has fired no event.
//
// So the board answers two different questions in two halves, and the
// difference between them is a difference in TENSE.
//
//   LIVE NOW · money in the middle of a hand still being played. The amount is
//     "so far", which is exactly why the row is worth tapping — it is the one
//     number on this screen that will be wrong in a minute. It ticks when it
//     grows. It comes off the felts (CASINO-2 job 1), not off the ticker,
//     because the ticker is a log of things that have finished.
//     The verb is WATCH.
//   TONIGHT · hands that are over, ranked by money. Biggest pot, cooler,
//     heater, bust, nemesis. The verb is REPLAY, never WATCH: the hand is
//     over, and offering to watch it would be a lie about what the tap does
//     (mood-nav.jsx says exactly this, and it is the law here).
//
// Both are ranked BY MONEY. A stranger has to be able to read this board
// without knowing poker, and the size of the pot is the one thing that needs
// no explaining.
//
// Ported from design-refs/mood-nav.jsx (LiveNow, Tonight) inside the shell of
// mood-floor3.jsx's CasinoBoard — its header ("ON THE FLOOR RIGHT NOW", the
// gold plate, "by the stairs") is what makes the two halves one object on a
// wall rather than two widgets.

import { useEffect, useMemo, useRef, useState } from 'react';

import { money } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';
import { CasinoEventType } from '../../lib/events.js';
import { M_TEAL, M_GOLD, M_RED } from '../floor/atoms.jsx';
import { Num } from '../wallet/atoms.jsx';
import { LiveDot, Stake, count } from './CasinoBuilding.jsx';

const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const MONO = '"JetBrains Mono",ui-monospace,monospace';
const M_TEXT = '#EDEDED';
const M_DIM = '#A1A1A1';
const M_MUTED = '#6B6B6B';

// A default that is the SAME EMPTY SET every render. `mineIds = new Set()` in a
// signature mints a new one each time, which makes every memo downstream of it
// recompute and every effect keyed on it re-run — and an effect that re-runs is
// an effect whose cleanup fires, which is how the pot tick below lost its timer
// and never expired.
const NOBODY = new Set();

// ── LIVE NOW ────────────────────────────────────────────────────────────────

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

function LiveRow({ row, tick, onWatch }) {
  const colour = row.hot ? M_RED : row.mine ? M_TEAL : M_TEXT;
  const inner = (
    <>
      <Num size={12} weight={700} color={colour}>{money(row.pot)}</Num>
      {tick > 0 && (
        <span
          className="csn-live__tick"
          data-testid={`pot-tick-${row.tableId}`}
          style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: M_TEAL, flexShrink: 0 }}
        >{`+${count(tick)}`}</span>
      )}
      <span style={{
        flex: 1, minWidth: 0, fontSize: 10.5, color: M_DIM, textAlign: 'left',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{row.who}</span>
      {row.room && <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, flexShrink: 0 }}>{row.room}</span>}
      <span style={{
        fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.11em',
        color: row.hot ? M_RED : M_TEAL, flexShrink: 0,
      }}>{row.hot ? 'HOT · WATCH' : 'WATCH'}</span>
    </>
  );

  const style = {
    display: 'flex', alignItems: 'baseline', gap: 9, padding: '6px 12px 7px', width: '100%',
    border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)',
    // The glow is the row itself, not a badge on it: a felt that is on fire is
    // the loudest thing on this board or the flag is decoration.
    background: row.hot
      ? `linear-gradient(90deg, ${M_RED}1C 0%, transparent 72%)`
      : row.mine ? `linear-gradient(90deg, ${M_TEAL}14 0%, transparent 72%)` : 'transparent',
    boxShadow: row.hot ? `inset 2px 0 0 ${M_RED}` : row.mine ? `inset 2px 0 0 ${M_TEAL}` : 'none',
  };

  if (!onWatch) return <div className="csn-live__row" style={style}>{inner}</div>;
  return (
    <button
      type="button"
      className="csn-live__row"
      data-hot={row.hot ? 'true' : undefined}
      style={{ ...style, cursor: 'pointer' }}
      aria-label={`${money(row.pot)} in the middle — ${row.who}. Watch this table.`}
      onClick={() => onWatch(row.tableId)}
    >{inner}</button>
  );
}

export function LiveNow({ felts = [], mineIds = NOBODY, rooms = [], limit = 3, onWatch = null }) {
  const rows = useMemo(
    () => liveRows(felts, { mineIds, rooms, limit }),
    [felts, mineIds, rooms, limit],
  );
  const ticks = usePotTicks(rows);

  return (
    <div className="csn-live">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px 7px' }}>
        <LiveDot color={M_RED} size={5} />
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_RED }}>
          LIVE NOW
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: M_MUTED }}>pot so far</span>
      </div>
      {rows.length === 0 ? (
        <div style={{
          fontSize: 10.5, color: M_MUTED, padding: '2px 12px 9px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>Nothing is in the middle right now.</div>
      ) : rows.map((row) => (
        <LiveRow key={row.tableId} row={row} tick={ticks[row.tableId] ?? 0} onWatch={onWatch} />
      ))}
    </div>
  );
}

// ── TONIGHT ─────────────────────────────────────────────────────────────────

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
 * RANKED, not newest-first — that is the whole change. A bust for $0 is at the
 * bottom of the board however recently it happened, and the biggest pot of the
 * night is the headline until something beats it, which is what a board on a
 * wall in a real room does.
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
 * stranger's cooler and there is no honest way to fabricate one. So a line
 * about somebody else is not a button: the ref's law is that the verb has to
 * be true, and "REPLAY" on a hand nothing can replay is the same lie as
 * "WATCH" on a hand that is over.
 */
export function replayable(row) {
  return !!row?.mine && !!row?.agentIds?.length && Number.isFinite(Number(row?.handNumber)) && Number(row.handNumber) > 0;
}

function TonightRow({ row, head, stakesFor, onReplay }) {
  const at = stakesFor?.(row.tableId) ?? null;
  const can = replayable(row) && !!onReplay;
  const label = tonightLabel(row.type);

  const inner = head ? (
    <>
      <Num size={26} weight={700} color={M_GOLD}>{money(row.pot)}</Num>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: 3, textAlign: 'left' }}>
        <div style={{
          fontSize: 11.5, color: M_TEXT, lineHeight: 1.25,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{row.headline}</div>
        <div style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.13em', color: M_GOLD, marginTop: 2 }}>
          {label}{at ? ` · ${at}` : ''}
        </div>
      </div>
      {can && (
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL, paddingBottom: 5, flexShrink: 0 }}>
          REPLAY →
        </span>
      )}
    </>
  ) : (
    <>
      <Num size={11} weight={700} color={row.mine ? M_GOLD : M_DIM}>{money(row.pot)}</Num>
      <span style={{
        flex: 1, minWidth: 0, fontSize: 10.5, color: M_DIM, textAlign: 'left',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{row.headline}</span>
      <span style={{
        fontFamily: OSWALD, fontSize: 7, fontWeight: 600, letterSpacing: '0.11em',
        color: row.mine ? M_GOLD : M_MUTED, flexShrink: 0,
      }}>{label}</span>
      {at && <Stake label={at} />}
    </>
  );

  const style = head
    ? { display: 'flex', alignItems: 'flex-end', gap: 9, padding: '3px 12px 9px', width: '100%', background: 'none', border: 'none' }
    : { display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 12px', width: '100%', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)' };

  if (!can) return <div className="csn-tonight__row" style={style}>{inner}</div>;
  return (
    <button
      type="button"
      className="csn-tonight__row"
      style={{ ...style, cursor: 'pointer' }}
      aria-label={`${label} — ${row.headline}. Replay this hand.`}
      onClick={() => onReplay(row)}
    >{inner}</button>
  );
}

export function Tonight({ events = [], mineIds = NOBODY, rows = 3, stakesFor = null, onReplay = null }) {
  const lines = useMemo(() => tonightRows(events, mineIds, rows + 1), [events, mineIds, rows]);
  const [head, ...rest] = lines;

  return (
    <div className="csn-tonight">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px 0' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED }}>
          TONIGHT
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: M_MUTED }}>
          done · tap yours to replay
        </span>
      </div>
      {!head ? (
        <div style={{ fontSize: 10.5, color: M_MUTED, padding: '4px 12px 10px' }}>
          Nothing has finished tonight yet.
        </div>
      ) : (
        <>
          <TonightRow row={head} head stakesFor={stakesFor} onReplay={onReplay} />
          {rest.map((row) => (
            <TonightRow key={row.id} row={row} stakesFor={stakesFor} onReplay={onReplay} />
          ))}
        </>
      )}
    </div>
  );
}

// ── The board they hang on ──────────────────────────────────────────────────

/**
 * ON THE FLOOR RIGHT NOW — the two halves, on one wall.
 *
 * `playing` is the census beside the header. `rows` is how many TONIGHT lines
 * sit under the headline; the desk's rail passes more of them, because it has
 * a column of its own and can hold the run of the evening rather than the top
 * of it.
 */
export function FloorBoard({
  felts = [], events = [], mineIds = NOBODY, rooms = [], playing = 0,
  liveLimit = 3, rows = 3, stakesFor = null, onWatch = null, onReplay = null,
}) {
  return (
    <div className="csn-board">
      <div className="csn-board__head">
        <LiveDot color={M_GOLD} />
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD }}>
          ON THE FLOOR RIGHT NOW
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, color: M_MUTED }}>
          {count(playing)} playing
        </span>
      </div>
      <div className="csn-board__body">
        <LiveNow felts={felts} mineIds={mineIds} rooms={rooms} limit={liveLimit} onWatch={onWatch} />
        <Tonight events={events} mineIds={mineIds} rows={rows} stakesFor={stakesFor} onReplay={onReplay} />
      </div>
    </div>
  );
}
