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
// The two bars sit on the same track as the skills so the card stays one
// language — but HEAT runs the other way. A full skill bar is good news and a
// full HEAT bar is not, so it is coloured by band rather than in skill teal,
// off mood-heat.jsx's own thresholds. Its polarity is the whole reason it
// cannot be a seventh row in the cluster.
//
// STAMINA stays tappable, like a skill: it is a trained attribute with a
// scouted band and a 90-day series behind it. HEAT is not tappable, because
// there is nothing behind it — heat is now.

import { AttrCluster } from './AttrCluster.jsx';

// Verbatim from design-refs/mood-heat.jsx. The words are the design: "tilted"
// at heat 30 and "tilted" at heat 90 are different rooms to walk into.
export const HEAT_BANDS = [
  { max: 24,  word: 'cold',    color: '#00D4AA' },
  { max: 49,  word: 'warm',    color: '#A1A1A1' },
  { max: 74,  word: 'hot',     color: '#CDB380' },
  { max: 100, word: 'boiling', color: '#FF4D4F' },
];

export function heatBand(heat) {
  const h = Math.max(0, Math.min(100, Number.isFinite(heat) ? heat : 0));
  return HEAT_BANDS.find((b) => h <= b.max) ?? HEAT_BANDS[HEAT_BANDS.length - 1];
}

/**
 * HEAT, on the skills' own track and in its own colour.
 *
 * `composure` is the attribute underneath it — tilt resistance, the thing that
 * decides how fast heat climbs and how quickly it comes back down. It rides as
 * the caption rather than as a third bar: composure and heat are one fact read
 * twice, the stat and today's reading of it, and drawing them as two peers
 * would say they were independent.
 */
export function HeatBar({ heat, composure }) {
  const value = Math.max(0, Math.min(100, Number.isFinite(heat) ? Math.round(heat) : 0));
  const band = heatBand(value);
  return (
    <div className="body-bars__heat">
      <div className="attr-bar" style={{ cursor: 'default' }}>
        <span className="attr-bar__name">HEAT</span>
        <span className="attr-bar__track">
          <div className="attr-track attr-track--heat" style={{ '--cur': `${value}%`, '--heat-color': band.color }}>
            <div className="attr-track__fill" />
            <div className="attr-track__cap" />
          </div>
        </span>
        <span className="attr-bar__value" style={{ color: band.color }}>{value}</span>
      </div>
      <div className="body-bars__caption">
        <span className="body-bars__band" style={{ color: band.color }}>{band.word}</span>
        {Number.isFinite(composure) && (
          <span className="body-bars__composure">composure {Math.round(composure)}</span>
        )}
      </div>
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
        />
      )}
      <HeatBar heat={heat} composure={composure} />
    </div>
  );
}
