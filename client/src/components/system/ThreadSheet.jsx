// WATCH v6 — the thread, as a glass sheet over the lower felt.
// Port of design-refs/mood-watch5.jsx `V5ThreadSheet` / `V5Row`.
//
// The TABLE tab is gone. History is a GLASS SHEET over the lower 70% of the felt
// with the game still playing behind it — "the felt never resizes for a sheet;
// that was the tell that the sheet was a different screen rather than a layer."
//
// Four registers, one row: HIM in teal at 13px, YOU in gold, TABLE muted (gold
// when it is a cost), and an opponent quoted and italicised, because table talk
// is background until it isn't.
import { GlassLabel } from './Glass.jsx';
import { useSheetDrag } from '../../hooks/useSheetDrag.js';

export const THREAD_WHO = ['HIM', 'YOU', 'TABLE'];

function clockOf(t) {
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// WATCH-8: the register is the server's closed `kind` when the row carries one
// — a stored line from a seat that renamed itself "TABLE" must not be drawn in
// the room's voice. A live row that has no kind is read off its label, exactly
// as it always was.
export function ThreadRow({ row }) {
  const kind = row.kind
    ? (row.kind === 'opponent' ? 'them' : row.kind)
    : (row.who === 'HIM' ? 'him' : row.who === 'YOU' ? 'you' : row.who === 'TABLE' ? 'table' : 'them');
  const him = kind === 'him';
  const you = kind === 'you';
  const table = kind === 'table';
  return (
    <div className={`thread-row thread-row--${kind}${row.cost ? ' is-cost' : ''}`}>
      <span className="thread-row__who">{row.who}</span>
      <span className="thread-row__text">{him || you || table ? row.text : `“${row.text}”`}</span>
      <span className="thread-row__at">{row.at || clockOf(row.t)}</span>
    </div>
  );
}

export function ThreadSheet({ rows = [], live = true, pending, onClose, head, foot }) {
  // BUGS-A job 5: pushed back down with a finger, anywhere on the glass — not
  // only by hitting the 34x3px grab bar.
  const drag = useSheetDrag(onClose);
  return (
    <div
      className={`thread-sheet${drag.dragging ? ' is-dragging' : ''}`}
      role="dialog"
      aria-label="The table"
      ref={drag.ref}
      style={drag.style}
      {...drag.handlers}
    >
      <button type="button" className="thread-sheet__grab" onClick={onClose} aria-label="Close the thread">
        <span className="thread-sheet__grab-bar" />
      </button>
      <div className="thread-sheet__head">
        <GlassLabel>The table</GlassLabel>
        <div style={{ flex: 1 }} />
        <span className="thread-sheet__state">
          {live ? 'THE HAND IS STILL PLAYING' : 'BETWEEN HANDS'}
        </span>
        {head}
      </div>
      <div className="thread-sheet__body no-scrollbar">
        {rows.length === 0 && !pending && (
          <div className="thread-sheet__empty">Nothing said at this table yet.</div>
        )}
        {rows.map((r, i) => <ThreadRow key={r.id || i} row={r} />)}
        {pending && (
          <div className="thread-row thread-row--him">
            <span className="thread-row__who">HIM</span>
            <span className="thread-row__text">
              <span className="dr-typing"><i /><i /><i /></span>
            </span>
            <span className="thread-row__at" />
          </div>
        )}
      </div>
      {foot && <div className="thread-sheet__foot">{foot}</div>}
    </div>
  );
}
