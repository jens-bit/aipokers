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
// full HEAT bar is not, so it is coloured by what it READS rather than in skill
// teal. Its polarity is the whole reason it cannot be a seventh row.
//
// HOME-2 job 2 · the same rule the pill and the felt obey. Both bars on this
// card are anchored at the LEFT WALL, and both take their colour from the one
// pair of ramps in the product (system/FeltBodyBars.jsx): stamina green → amber
// → red as it drains, heat ember → red as it fills. BUGS-A job 10's separation
// is kept — two causes, two different reds — but its two drawings are not: this
// card started heat at teal and the felt started it at teal too, so an
// unbothered man read as a good reading rather than as no reading at all.
//
// STAMINA stays tappable, like a skill: it is a trained attribute with a
// scouted band and a 90-day series behind it. HEAT is not tappable, because
// there is nothing behind it — heat is now.

import { AttrCluster } from './AttrCluster.jsx';
import { heatColor, staminaColor } from './FeltBodyBars.jsx';

// The WORDS are verbatim from design-refs/mood-heat.jsx, and they are the
// design: "tilted" at heat 30 and "tilted" at heat 90 are different rooms to
// walk into.
//
// HOME-2 job 2 — the COLOURS are not here any more. They were a fourth
// definition of heat's ramp (this card, the felt, the seat pill, the room's
// pill), and the four disagreed: this one started at teal and passed through
// grey. It reads FeltBodyBars' single ramp now, so a man who is boiling is the
// same red on his card as he is over his head. The word and the colour are one
// reading of one fact and they are taken at the same value.
export const HEAT_BANDS = [
  { max: 24,  word: 'cold' },
  { max: 49,  word: 'warm' },
  { max: 74,  word: 'hot' },
  { max: 100, word: 'boiling' },
];

export function heatBand(heat) {
  const h = Math.max(0, Math.min(100, Number.isFinite(heat) ? heat : 0));
  const band = HEAT_BANDS.find((b) => h <= b.max) ?? HEAT_BANDS[HEAT_BANDS.length - 1];
  return { ...band, color: heatColor(h) };
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
  // HOME-2 job 2: the fill is anchored at the LEFT and grows rightward, ember
  // → red, off the one ramp in the product. A step rather than a gradient, for
  // the reason this card of all surfaces cares about: it is where the reading
  // is NAMED ("hot", "boiling"), and a named state whose colour changes
  // continuously is a state with no edges.
  const color = band.color;
  return (
    <div className="body-bars__heat">
      <div className="attr-bar" style={{ cursor: 'default' }}>
        <span className="attr-bar__name">HEAT</span>
        <span className="attr-bar__track">
          <div className="attr-track attr-track--heat" style={{ '--cur': `${value}%`, '--heat-color': color }}>
            <div className="attr-track__fill" />
            <div className="attr-track__cap" />
          </div>
        </span>
        <span className="attr-bar__value" style={{ color }}>{value}</span>
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
