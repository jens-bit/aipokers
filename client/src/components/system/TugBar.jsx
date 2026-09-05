// WATCH v3 — the tug-of-war bar. Port of TugBar from design-refs/mood-watch3.jsx.
//
// Playtest finding 2: "the money on the line is a small number in a corner."
// It was one row of an analysis stack at 12.5px, below the fold on a short
// phone. It is now a rope directly under the board, with him on one end.
//
// Hero's number sits on hero's end; the villain end stays unlabelled — the
// owner is watching his agent, not refereeing. The seam is the only moving
// part, and it animates on every street.
//
// Styles in styles/watch.css.

export function TugBar({ equity, villain, big, dead }) {
  // `dead` is before the deal: the rope sits dead centre rather than empty, so
  // the shape is there to read before it means anything.
  const live = !dead && Number.isFinite(equity);
  const pct = live ? Math.max(2, Math.min(98, equity)) : 50;

  const cls = ['tug', big ? 'tug--big' : '', dead || !live ? 'tug--dead' : '']
    .filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <div
        className="tug__track"
        role="img"
        aria-label={live ? `Hero equity ${Math.round(equity)} percent` : 'Equity not known yet'}
      >
        <div className="tug__fill" style={{ width: `${pct}%` }} />
        <div className="tug__seam" style={{ left: `calc(${pct}% - 1px)` }} />
      </div>
      <div className="tug__legend">
        <span className="tug__value">{live ? `${Math.round(equity)}%` : '—'}</span>
        <span className="tug__spacer" />
        {villain && <span className="tug__villain">{villain.toUpperCase()}</span>}
      </div>
    </div>
  );
}
