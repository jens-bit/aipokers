// ATTR-2a — AttrCluster, AttrSpark, AttrFocusPanel.
// Port of design-refs/char-profile.jsx. Styles in styles/attributes.css.
//
// CLUSTER, NOT RADAR. A hexagon cannot show a RANGE — the scouted band would
// have to become a second overlapping polygon, illegible at any phone size. The
// row cluster shows current + band + tick natively at 12px pitch and keeps the
// canon order, so an agent's silhouette is recognisable across every surface.

import { AttrBar } from './AttrBar.jsx';
import { captionFor } from '../../lib/attributes.js';

const M_BG   = '#1A1A1E';
const M_TEAL = '#00D4AA';

/**
 * SHOW, DON'T TELL. Three growth ticks were three sentences; they are now three
 * dots on a line rising toward a gold ceiling zone. One glance answers the two
 * questions worth asking — is he still climbing, and how much is left.
 *
 * `series` may be empty: a flat line at the current value is the honest picture
 * of an agent who has not grown yet, and beats inventing a climb.
 */
export function AttrSpark({ series, cur, lo, hi, w = 300, h = 58 }) {
  const pts0 = (Array.isArray(series) && series.length > 1) ? series : [cur, cur];
  const min = Math.min(...pts0, lo) - 3;
  const max = Math.max(...pts0, hi) + 3;
  const span = max - min || 1;
  const yy = (v) => h - ((v - min) / span) * h;
  const xx = (i) => 4 + (i / (pts0.length - 1)) * (w - 8);
  const pts = pts0.map((v, i) => [xx(i), yy(v)]);
  const last = pts[pts.length - 1];

  // the ticks that actually happened, most recent three
  const ticks = [];
  for (let i = 1; i < pts0.length; i++) if (pts0[i] > pts0[i - 1]) ticks.push(i);
  const recent = ticks.slice(-3);

  return (
    <svg
      className="attr-spark"
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect x="0" y={yy(hi)} width={w} height={Math.max(3, yy(lo) - yy(hi))} fill="rgba(205,179,128,0.10)" />
      <line x1="0" y1={yy(hi)} x2={w} y2={yy(hi)} stroke="rgba(205,179,128,0.60)" strokeWidth="1" />
      <line x1="0" y1={yy(lo)} x2={w} y2={yy(lo)} stroke="rgba(205,179,128,0.33)" strokeWidth="1" strokeDasharray="3 3" />
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={M_TEAL} strokeWidth="1.8" strokeLinejoin="round" />
      {recent.map((i) => (
        <circle key={i} cx={pts[i][0]} cy={pts[i][1]} r="2.8" fill={M_BG} stroke={M_TEAL} strokeWidth="1.4" />
      ))}
      <circle cx={last[0]} cy={last[1]} r="3.4" fill="#EDEDED" />
    </svg>
  );
}

/**
 * The tapped bar, expanded: a sparkline, a big value, and a five-word caption.
 * His voice moved out entirely — the thread is the text-heavy surface, the card
 * is not. This is the one place an exact ceiling is printed, in gold, because
 * tapping is the user asking for precision.
 */
export function AttrFocusPanel({ row, series, days = 90 }) {
  const pts = Array.isArray(series) ? series : [];
  const gain = pts.length > 1 ? pts[pts.length - 1] - pts[0] : 0;
  return (
    <div className={`attr-focus${row.fatigued ? ' attr-focus--fatigued' : ''}`}>
      <div className="attr-focus__head">
        <span className="attr-focus__key">{row.key}</span>
        {gain > 0 && <span className="attr-focus__gain">+{gain}</span>}
        <span className="attr-focus__window">{days}D</span>
      </div>
      <div className="attr-focus__body">
        <div className="attr-focus__spark">
          <AttrSpark series={pts} cur={row.cur} lo={row.lo} hi={row.hi} />
        </div>
        <div className="attr-focus__nums">
          <span className="attr-focus__cur">{row.cur}</span>
          <span className="attr-focus__band">{row.lo}–{row.hi}</span>
        </div>
      </div>
      <div className="attr-focus__caption">{captionFor(row.key, row.cur)}</div>
    </div>
  );
}

/**
 * The six bars, canon order, with the tapped one expanded in place.
 * `rows` comes from normalizeAttrs(agent).rows.
 */
export function AttrCluster({ rows, expand, onExpand, seriesFor: seriesOf, tintFor }) {
  return (
    <div className="attr-cluster">
      {rows.map((row) => (
        <div key={row.key}>
          <AttrBar
            name={row.key}
            cur={row.cur}
            lo={row.lo}
            hi={row.hi}
            fatigued={row.fatigued}
            narrowed={row.narrowed}
            // BUGS-A job 10: absent for every skill, which is every row but
            // one. See the note on AttrTrack.
            tint={tintFor ? tintFor(row) : undefined}
            on={expand === row.key}
            onClick={onExpand ? () => onExpand(expand === row.key ? null : row.key) : undefined}
          />
          {expand === row.key && (
            <AttrFocusPanel row={row} series={seriesOf ? seriesOf(row.key) : []} />
          )}
        </div>
      ))}
    </div>
  );
}
