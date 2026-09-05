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

import { useEffect, useRef, useState } from 'react';

import { normalizeReads, noEvidenceLine, pickOpponent } from '../../lib/reads.js';

// How long the "a read just formed" treatment stays up. Long enough to be the
// event the ww-ref calls for, short enough that it is not a badge.
const FORMING_MS = 4000;

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

// W3-5: `reads` is the server's array, one entry per opponent. `game` decides
// which of them the panel is about — see pickOpponent.
export function ReadPanel({ reads, game }) {
  const entry = Array.isArray(reads) ? pickOpponent(reads, game) : reads;
  const model = normalizeReads(entry);

  // Until he has formed an opinion he says so, whether or not there are numbers
  // on the bars yet. Numbers without a read are him still counting.
  const line = model.line || (model.formed ? null : noEvidenceLine());

  // The server has no `forming` flag — it simply stops sending a READ message
  // once nothing has changed — so the transition is noticed here: this
  // opponent's read going from unformed to formed, once, for a few seconds.
  const [justFormed, setJustFormed] = useState(false);
  const wasFormed = useRef(new Map());
  const who = model.playerId;
  useEffect(() => {
    if (!who) return undefined;
    const before = wasFormed.current.get(who);
    wasFormed.current.set(who, model.formed);
    if (before === false && model.formed) {
      setJustFormed(true);
      const id = setTimeout(() => setJustFormed(false), FORMING_MS);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [who, model.formed]);

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
        <div className={'read-panel__line' + (justFormed ? ' is-forming' : '')}>
          “{line}”
        </div>
      )}
    </div>
  );
}
