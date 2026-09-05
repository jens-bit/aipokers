// WATCH v3 — READ, his picture of the opponent.
// Port of ReadBar and ReadPanel from design-refs/mood-watch3.jsx.
//
// The opponent model exists server-side; nothing surfaced it. Bars fill as
// evidence arrives and a teal confidence bracket narrows with hands — the READS
// attribute decides how fast that happens, which is the first place an
// attribute is felt rather than read.
//
// Never "waiting for the first action": before evidence he says so himself.
//
// Styles in styles/watch.css.

import { normalizeReads, noEvidenceLine } from '../../lib/reads.js';

export function ReadBar({ label, v, conf, formed }) {
  const known = v != null;
  const lo = known ? Math.max(0, v - conf) : 0;
  const hi = known ? Math.min(100, v + conf) : 0;

  return (
    <div className={'read-bar' + (formed ? ' read-bar--formed' : '')}>
      <span className="read-bar__label">{label}</span>
      <div className="read-bar__track">
        {known && (
          <>
            {conf > 0 && (
              <div
                className="read-bar__band"
                style={{ left: `${lo}%`, width: `${hi - lo}%` }}
              />
            )}
            <div className="read-bar__fill" style={{ width: `${v}%` }} />
          </>
        )}
      </div>
      <span className={'read-bar__value' + (known ? ' is-known' : '')}>{known ? v : '··'}</span>
    </div>
  );
}

export function ReadPanel({ reads }) {
  const model = normalizeReads(reads);
  const line = model.line || (model.known ? null : noEvidenceLine());

  return (
    <div className="read-panel">
      <div className="read-panel__head">
        <span className="read-panel__who">{model.name || 'The table'}</span>
        <div className="read-panel__rule" />
        <span className="read-panel__meta">
          {model.hands > 0 ? `${model.hands.toLocaleString()} HANDS SEEN` : 'NO EVIDENCE YET'}
        </span>
      </div>

      {model.rows.map((row) => <ReadBar key={row.key} {...row} />)}

      {line && (
        <div className={'read-panel__line' + (model.forming ? ' is-forming' : '')}>
          “{line}”
        </div>
      )}
    </div>
  );
}
