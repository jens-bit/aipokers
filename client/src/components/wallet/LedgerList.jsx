// client/src/components/wallet/LedgerList.jsx — YOU-2, restyled SAFE-2
//
// The record. Every wallet entry the server writes is already
// server-authoritative and carries its own id (§7.1, src/server/wallet.js
// appendEntry) — it was just never drawn anywhere, so `wallet.ledger` arrived
// on every read and went straight in the bin.
//
// It belongs on YOU rather than in the money sheet, and the split is the point:
// the sheet is where money MOVES, this is where it turns out to have moved.
// One is a decision, the other is a receipt, and a list of receipts inside the
// screen you use to spend is a bank statement in a wallet.
//
// ── SAFE-2 · what F12b changed ──────────────────────────────────────────────
//
// TWO THINGS, and the second one is the reason the first was worth doing.
//
//   1. EVERY LINE IS A SENTENCE. "Gave chips · Aggro" was a function name and
//      an argument; "Topped up Aggro's pocket" is the thing that happened. The
//      vocabulary moved to lib/safeLines.js, where TONIGHT's three lines read
//      it too — so a top-up cannot be called one thing in the summary and
//      another in the list below it.
//   2. IT PAGES. The safe pulls this same list up as its second size, and a
//      list that stopped dead at eight rows would have nothing to pull. The
//      host owns `limit` and grows it (SafeSheet's scroller does), because the
//      host is the thing that knows whether it has been scrolled to the end.
//
// The list is still one component in two places. YOU draws it as a card under
// the summary; the safe draws it flush on its own glass.

import { money } from '../../lib/wallet.js';
import { ledgerDay, ledgerLine, ledgerTime } from '../../lib/safeLines.js';
import { Lbl, Num } from './atoms.jsx';

const M_TEAL   = '#00D4AA';
const M_GOLD   = '#CDB380';
const M_DIM    = '#A1A1A1';
const M_MUTED  = '#6B6B6B';
const M_BORDER = 'rgba(255,255,255,0.12)';

/** The owner-facing name of an entry: what happened, and who it was about. */
export function entryLabel(entry, nameOf) {
  return ledgerLine(entry, nameOf);
}

function Row({ entry, nameOf, last, now }) {
  const amount = Number(entry?.amount) || 0;
  const inbound = amount > 0;
  // Tonight's lines are stamped by the hour, the way F12b draws them. Anything
  // older carries its date instead — an hour with no day on it would let a
  // week-old line pass for one from twenty minutes ago.
  const day = ledgerDay(entry?.ts, now);
  return (
    <div
      className="wal-ledger__row"
      style={{
        display: 'flex', alignItems: 'baseline', gap: 9,
        padding: '8px 13px',
        borderBottom: last ? 'none' : `1px solid ${M_BORDER}`,
      }}
    >
      <span style={{ flexShrink: 0, width: 38 }}>
        <Num size={9.5} color={M_MUTED} weight={500}>{day ?? ledgerTime(entry?.ts)}</Num>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: M_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ledgerLine(entry, nameOf)}
        </div>
      </div>
      <Num size={12} weight={700} color={inbound ? M_TEAL : M_GOLD}>
        {inbound ? '+' : '−'}{money(Math.abs(amount))}
      </Num>
    </div>
  );
}

/**
 * Newest first, capped at `limit`.
 *
 * Renders nothing at all when there is nothing in it — an empty ledger is a
 * deployment with no wallet or an owner who has not moved money yet, and
 * neither wants a heading over an empty box.
 *
 * @param limit  how many rows to draw. The host grows it as it is scrolled.
 * @param flush  no card, no margins: the list is already on somebody's glass.
 */
export function LedgerList({
  entries, nameOf, limit = 8, label = 'Ledger', sub = null, flush = false, now,
}) {
  const rows = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && Number.isFinite(Number(e.amount)))
    .slice()
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
    .slice(0, limit);

  if (rows.length === 0) return null;

  return (
    <>
      <div
        style={{
          padding: flush ? '0 13px' : '0 14px', marginBottom: 7, flexShrink: 0,
          display: 'flex', alignItems: 'baseline', gap: 8,
        }}
      >
        <Lbl size={9.5} color={flush ? M_GOLD : M_MUTED}>{label}</Lbl>
        {sub ? <Num size={8.5} color={M_MUTED} weight={500}>{sub}</Num> : null}
      </div>
      <div
        className={`wal-ledger${flush ? ' wal-ledger--flush' : ''}`}
        style={flush ? { flexShrink: 0 } : {
          margin: '0 14px 14px', borderRadius: 12, overflow: 'hidden',
          background: '#1b1b1b', border: `1px solid ${M_BORDER}`, flexShrink: 0,
        }}
      >
        {rows.map((entry, i) => (
          <Row
            key={entry.id ?? `${entry.ts}-${i}`}
            entry={entry}
            nameOf={nameOf}
            now={now}
            last={i === rows.length - 1}
          />
        ))}
      </div>
    </>
  );
}
