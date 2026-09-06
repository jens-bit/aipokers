// WATCH v4 — ReadSheet.
// Port of design-refs/mood-watch4.jsx ReadSheet4.
//
// W4-2: the READ tab is gone. A read was never a tab — it is about ONE person,
// and you ask for it by tapping them. So the five rows, the confidence brackets
// and his line move into a sheet that opens over the felt on a seat tap and
// closes when you are done.
//
// The rows are the served W3-5 shape, read through the same normalizeReads and
// drawn with the same ReadBar as the panel it replaces, so a read cannot say
// one thing in a tab and another in a sheet.
import { useEffect, useRef, useState } from 'react';
import { normalizeReads, noEvidenceLine } from '../../lib/reads.js';
import { MoodGhost } from './MoodGhost.jsx';
import { ReadBar } from './ReadPanel.jsx';

// How long the "it just formed" treatment holds before it is simply his read.
const FORMING_MS = 4000;

export function ReadSheet({ entry, seat, onClose }) {
  const model = normalizeReads(entry);

  // The server has no `forming` flag — it stops sending a READ message once
  // nothing has changed — so the transition is noticed here: this opponent's
  // read going unformed -> formed, once, for a few seconds. W4-2 moved the
  // announcement from the panel to the sheet with the rest of the read.
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
  // Until he has formed an opinion he says so, whether or not there are numbers
  // on the bars yet. Numbers without a read are him still counting.
  const line = model.line || (model.formed ? null : noEvidenceLine());

  // The served entry names the subject of the read; the seat label is only the
  // fallback. They can differ — a House regular is seated under a table name and
  // read under a stable one — and the read is about the person the server means.
  const name = model.name || seat?.name || 'Seat';
  const hands = model.hands || 0;

  return (
    <div className="read-sheet" role="dialog" aria-label={`${name} — read`}>
      <button type="button" className="read-sheet__grab" onClick={onClose} aria-label="Close read">
        <span className="read-sheet__grab-bar" />
      </button>

      <div className="read-sheet__head">
        <div className="read-sheet__well">
          <MoodGhost mood={seat?.mood || 'neutral'} heat={Number.isFinite(seat?.heat) ? seat.heat : 45}
            accent={seat?.accent || '#00D4AA'} size={38} ring={false} />
        </div>
        <div className="read-sheet__id">
          <div className="read-sheet__name">{name}</div>
          <div className="read-sheet__meta">
            {hands > 0 ? `${hands.toLocaleString()} HANDS SEEN` : 'NO EVIDENCE YET'}
          </div>
        </div>
        {seat?.stack != null && <span className="read-sheet__stack">${seat.stack}</span>}
      </div>

      <div className="read-sheet__rows">
        {model.rows.map((row) => (
          <ReadBar key={row.key} label={row.label} v={row.v} conf={row.conf} formed={row.formed} />
        ))}
      </div>

      {line && (
        <div className={`read-sheet__line${justFormed ? ' is-forming' : ''}`}>“{line}”</div>
      )}

      <div className="read-sheet__hint">TAP ANY OTHER SEAT TO READ THEM INSTEAD</div>
    </div>
  );
}
