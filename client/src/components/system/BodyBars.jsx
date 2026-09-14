// client/src/components/system/BodyBars.jsx — PROFILE-2
//
// The split frame's top half: the BODY.
//
// The card used to be one six-bar cluster — READS, FOCUS, DISCIPLINE,
// COMPOSURE, DECEPTION, STAMINA — all drawn the same way, which reads as six
// skills. Two of them are not skills. STAMINA is how much is left in him
// tonight and HEAT is how rattled he is right now: both are STATE, both move
// inside a single session, and neither is something he has got better AT. They
// belong at the top of the card with his face, next to the mood they explain,
// and not in a list of things he trains.
//
// HEAT runs the other way from a skill — a full skill bar is good news and a
// full heat reading is not — so it is coloured by what it READS rather than
// in skill teal. Its polarity is the whole reason it cannot be a seventh row.
//
// LIFE-1-B: heat is three dots now (system/FeltBodyBars.jsx's `BodyDots`,
// reading src/shared/levels.js), the same reading the felt and the room pill
// draw, tapped to reveal its word — "not tappable, because there is nothing
// behind it" was true of a bare number and stopped being true once the
// reading got a name.
//
// STAMINA stays tappable in its OWN way: it is a trained attribute with a
// scouted band and a 90-day series behind it, so it keeps the skills' own
// track and expand behaviour rather than becoming a third dot row — heat and
// this STAMINA are not the same axis (see BodyDots' own header comment).

import { AttrCluster } from './AttrCluster.jsx';
import { BodyDots, staminaColor } from './FeltBodyBars.jsx';
import { heatLevel } from '../../../../src/shared/levels.js';

/**
 * HEAT, as three dots and its own colour.
 *
 * LIFE-1-B: heat's 0-100 was drawn as a continuous fill and named from a
 * four-band word list this card alone kept (`cold`/`warm`/`hot`/`boiling`).
 * `src/shared/levels.js`'s three states are what the felt and the room pill
 * now read too, so this card reads the same one rather than a fourth
 * definition of "what heat means". `composure` — tilt resistance, the thing
 * that decides how fast heat climbs and how quickly it comes back down —
 * rides as the caption rather than as a third dot row: composure and heat are
 * one fact read twice, and drawing them as two peers would say they were
 * independent.
 */
export function HeatBar({ heat, composure }) {
  const reading = heatLevel(heat);
  return (
    <div className="body-bars__heat">
      <div className="attr-bar" style={{ cursor: 'default' }}>
        <BodyDots kind="heat" reading={reading} />
      </div>
      {Number.isFinite(composure) && (
        <div className="body-bars__caption">
          <span className="body-bars__composure">composure {Math.round(composure)}</span>
        </div>
      )}
    </div>
  );
}

/**
 * The pair. `staminaRow` is one row out of normalizeAttrs(agent).rows, so the
 * bar, the scouted band and the fatigue dip all arrive already computed; the
 * body half does not get its own arithmetic.
 */
export function BodyBars({ staminaRow, heat, composure, expand, onExpand, seriesFor }) {
  return (
    <div className="body-bars">
      {staminaRow && (
        <AttrCluster
          rows={[staminaRow]}
          expand={expand}
          onExpand={onExpand}
          seriesFor={seriesFor}
          // SAME TWO RULES EVERYWHERE. On the felt a spent stamina line is red
          // and a full one is green; on this card it was skill teal at every
          // value, so the same man read as fine here and as running on empty
          // there. Same function, same colour, one fact. It stays on the
          // skills' track — the scouted band and the 90-day series are real and
          // belong to an attribute, and the ref's bare rule carries neither —
          // but it is coloured by what it says rather than by which list it is
          // in.
          tintFor={(row) => staminaColor(Math.max(0, Math.min(100, row.cur)) / 100)}
        />
      )}
      <HeatBar heat={heat} composure={composure} />
    </div>
  );
}
