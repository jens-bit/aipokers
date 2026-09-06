// client/src/components/wallet/LedgerList.jsx — YOU-2
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
// Four types reach the wallet ledger. Each is named by what actually happened
// to the owner's money, not by the function that wrote it:
//
//   fund     he gave an agent chips           out
//   refill   an auto-refill topped one up     out
//   collect  an agent's winnings came home    in
//   seed     the migration swept a bankroll   in

import { money } from '../../lib/wallet.js';
import { Lbl, Num } from './atoms.jsx';

const M_TEAL   = '#00D4AA';
const M_GOLD   = '#CDB380';
const M_DIM    = '#A1A1A1';
const M_MUTED  = '#6B6B6B';
const M_BORDER = 'rgba(255,255,255,0.12)';

const LABELS = {
  fund:    'Gave chips',
  refill:  'Auto-refill',
  collect: 'Collected',
  seed:    'Opening balance',
};

/** The owner-facing name of an entry, and who it was about. */
export function entryLabel(entry, nameOf) {
  const base = LABELS[entry?.type] ?? 'Adjustment';
  const who = entry?.agentId ? nameOf?.(entry.agentId) : null;
  return who ? `${base} · ${who}` : base;
}

function when(ts) {
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Row({ entry, nameOf, last }) {
  const amount = Number(entry?.amount) || 0;
  const inbound = amount > 0;
  return (
    <div
      className="wal-ledger__row"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 13px',
        borderBottom: last ? 'none' : `1px solid ${M_BORDER}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: M_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entryLabel(entry, nameOf)}
        </div>
      </div>
      <Num size={9.5} color={M_MUTED} weight={500}>{when(entry?.ts)}</Num>
      <Num size={12.5} weight={700} color={inbound ? M_TEAL : M_GOLD}>
        {inbound ? '+' : '−'}{money(Math.abs(amount))}
      </Num>
    </div>
  );
}

/**
 * Newest first, capped. The server keeps 100; a phone screen is not a place to
 * scroll a hundred receipts, and the ones worth seeing are the recent ones.
 *
 * Renders nothing at all when there is nothing in it — an empty ledger is a
 * deployment with no wallet or an owner who has not moved money yet, and
 * neither wants a heading over an empty box.
 */
export function LedgerList({ entries, nameOf, limit = 8 }) {
  const rows = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && Number.isFinite(Number(e.amount)))
    .slice()
    .sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))
    .slice(0, limit);

  if (rows.length === 0) return null;

  return (
    <>
      <div style={{ padding: '0 14px', marginBottom: 7, flexShrink: 0 }}>
        <Lbl size={9.5}>Ledger</Lbl>
      </div>
      <div
        className="wal-ledger"
        style={{
          margin: '0 14px 14px', borderRadius: 12, overflow: 'hidden',
          background: '#1b1b1b', border: `1px solid ${M_BORDER}`, flexShrink: 0,
        }}
      >
        {rows.map((entry, i) => (
          <Row
            key={entry.id ?? `${entry.ts}-${i}`}
            entry={entry}
            nameOf={nameOf}
            last={i === rows.length - 1}
          />
        ))}
      </div>
    </>
  );
}
