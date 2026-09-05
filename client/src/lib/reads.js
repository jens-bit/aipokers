// WATCH v3 — the opponent model, client side.
//
// The read exists server-side and nothing surfaced it. This module owns the
// shape the panel reads it in and the defaults that keep the panel honest
// before any evidence has arrived.
//
// Server contract (optional today):
//   game.reads = {
//     name,            who the read is about
//     hands,           how many hands of evidence
//     line,            his sentence about them, thread voice
//     forming,         true for the session in which it just changed
//     stats: { vpip, pfr, aggr, fold, sd }
//   }
//
// Each stat is either a number, or { v, conf } where conf is the half-width of
// the confidence bracket. Bars fill as evidence arrives and the bracket narrows
// with hands — the READS attribute decides how fast, which is the first place an
// attribute is felt rather than read.
//
// Pure and side-effect free.

// Fixed order, like the attribute cluster: an opponent's shape should be
// recognisable at a glance from one panel to the next.
export const READ_KEYS = ['vpip', 'pfr', 'aggr', 'fold', 'sd'];

export const READ_LABELS = {
  vpip: 'PLAYS',
  pfr: 'RAISES FIRST',
  aggr: 'AGGRESSION',
  fold: 'FOLDS TO HEAT',
  sd: 'GOES TO SHOWDOWN',
};

// Below this there is not enough evidence to call a number a read. The bar
// still draws — it is filling, not empty — but it does not claim to be formed.
const FORMED_AFTER = 20;

const clamp = (n) => Math.max(0, Math.min(100, n));

function readStat(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { v: clamp(Math.round(raw)), conf: 0 } : null;
  }
  if (typeof raw !== 'object') return null;
  const v = Number(raw.v ?? raw.value);
  if (!Number.isFinite(v)) return null;
  const conf = Number(raw.conf ?? raw.confidence);
  return { v: clamp(Math.round(v)), conf: Number.isFinite(conf) ? Math.max(0, Math.round(conf)) : 0 };
}

/**
 * The five rows the panel draws, always in canon order and always five long.
 * A stat the server has not sent yet reads as "··" rather than as a zero — an
 * unanswered question is not an answer of nothing.
 */
export function normalizeReads(reads) {
  const stats = reads?.stats && typeof reads.stats === 'object' ? reads.stats : (reads ?? {});
  const hands = Number.isFinite(reads?.hands) ? reads.hands : 0;

  const rows = READ_KEYS.map((key) => {
    const stat = readStat(stats[key]);
    return {
      key,
      label: READ_LABELS[key],
      v: stat ? stat.v : null,
      conf: stat ? stat.conf : 0,
      // A row is "formed" when there is enough evidence behind it. Formed rows
      // are the ones drawn in white with a teal label; the rest are still
      // filling and say so by being dim.
      formed: !!stat && hands >= FORMED_AFTER,
    };
  });

  return {
    name: typeof reads?.name === 'string' && reads.name ? reads.name : null,
    hands,
    line: typeof reads?.line === 'string' && reads.line ? reads.line : null,
    forming: !!reads?.forming,
    rows,
    // Nothing to show is a state the panel renders, not an error it hides.
    known: rows.some((r) => r.v != null),
  };
}

/**
 * What he says when he has nothing yet. Never "waiting for the first action":
 * before there is evidence he says so, in his own voice.
 */
export function noEvidenceLine() {
  return 'Give me a few hands.';
}
