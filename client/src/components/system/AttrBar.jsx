// ATTR-2a — AttrTrack + AttrBar.
// Port of design-refs/char-system.jsx. Styles in styles/attributes.css.
//
// The bar carries three facts at once: where he IS (teal fill), where he could
// END (gold scouted band), and how sure the scouting is (band width). The
// ceiling is never a number — it is a width.

const pct = (v) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));

/**
 * The track alone — six pixels of state.
 * `narrowed` shows the gold caret at the high end for one session after the band
 * moved in; `below` puts it under the track, which is what the row layout uses.
 */
export function AttrTrack({ cur, lo, hi, dim, narrowed, below }) {
  const hasBand = Number.isFinite(lo) && Number.isFinite(hi);
  return (
    <div
      className={`attr-track${dim ? ' attr-track--dim' : ''}`}
      style={{ '--cur': `${pct(cur)}%` }}
    >
      {hasBand && (
        <div
          className="attr-track__band"
          style={{ '--band-lo': `${pct(lo)}%`, '--band-w': `${pct(hi) - pct(lo)}%` }}
        />
      )}
      <div className="attr-track__fill" />
      <div className="attr-track__cap" />
      {narrowed && hasBand && (
        <div
          className={`attr-track__caret attr-track__caret--${below ? 'below' : 'above'}`}
          style={{ '--hi': `${pct(hi)}%` }}
        />
      )}
    </div>
  );
}

/**
 * Row layout — name · track · value on one line. The only layout that ships on
 * a phone: six bars have to read as one silhouette rather than six widgets.
 * Renders as a <button> when it can be tapped open, a <div> otherwise.
 */
export function AttrBar({ name, cur, lo, hi, dim, narrowed, fatigued, on, onClick }) {
  const cls = [
    'attr-bar',
    dim ? 'attr-bar--dim' : '',
    on ? 'attr-bar--on' : '',
    fatigued ? 'attr-bar--fatigued' : '',
  ].filter(Boolean).join(' ');

  const inner = (
    <>
      <span className="attr-bar__name">{name}</span>
      <span className="attr-bar__track">
        <AttrTrack cur={cur} lo={lo} hi={hi} dim={dim} narrowed={narrowed} below />
      </span>
      <span className="attr-bar__value">{cur}</span>
    </>
  );

  if (!onClick) return <div className={cls} style={{ cursor: 'default' }}>{inner}</div>;

  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      aria-expanded={!!on}
      aria-label={`${name} ${cur}`}
    >
      {inner}
    </button>
  );
}
