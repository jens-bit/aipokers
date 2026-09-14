// WATCH-8 job 2 — THE BODY ON THE FELT.
//
// Two things about an agent are true all session and neither of them was on the
// table: how much is left in him, and how hard he is running. The face carries
// mood, the hands carry what he is doing, the chips carry his money — and until
// this there was nowhere to read the body itself.
//
// ── HOME-2 job 2 · BOTH BARS ARE ANCHORED AT THE LEFT WALL ─────────────────
//
// Wave 55 pinned stamina on the RIGHT, which made a spent agent a stub floating
// away from the wall — unreadable next to heat. Wave 56 fixed it and the fix is
// the rule this file now obeys, in the ref's own words (mood-home.jsx):
//
//   STAMINA  full is the WHOLE BAR, and as it drains the RIGHT END RECEDES
//            toward the left: green → amber → red as it shortens.
//   HEAT     empty is NOTHING, and the fill GROWS left → right: ember → red.
//
// So a worn, tilted agent is a short red stub over a long red bar — two
// OPPOSITE SHAPES, which is what lets one glance separate the two causes. The
// empty end of both bars is the left end, and a short bar is never good news.
//
// The two ramps below are the ref's own step functions, verbatim, and they are
// the only definition of these colours in the product: the pill above his head
// in the room, the strip over the felt, the seat pill and the profile card all
// read them from here, so no two surfaces can disagree about what a colour
// means.
//
// BUGS-A job 10's SEPARATION IS KEPT, and it is the reason the two ramps are
// not one: two causes must never share a colour. They both end in red and the
// two reds are deliberately different — #C93F44 is the dull blood red of an
// empty man, #D43F32 the fiery one of a furious one — and nothing green ever
// means heat, nothing that is not red ever means empty.
//
// "A confident agent can be worn; a tilted agent can be fresh." That is why they
// are two lines and not one: a single meter would make an owner read one cause
// for two different things.
//
// Two pixels because this is a fact, not a panel. It rides the bottom edge of
// whatever already names the agent — his strip, or a seat's name pill — so it
// costs the felt no height at all.
//
// The class is `felt-bars`, not `body-bars`. PROFILE-2's card has a component
// of its own by that name — same two subjects, a different surface and a very
// different scale — and two components sharing one class is how a 6px pair of
// lines silently became 16px of nothing sitting over a seat's stack.

import { useState } from 'react';
import { staminaLevel, heatLevel } from '../../../../src/shared/levels.js';

// Fatigue's three stages, as a fraction of the line.
//
// HOME-2 job 2 — the thirds are gone, and they had to go. The ref's ramp is a
// STEP function over 0–100 (green above 60, amber above 35, orange above 18,
// red below), and the old 3 / 2 / 1 put fresh at 100 and settled at 67 — both
// of them green. Two of the three stages reading as the same colour is the one
// thing this bar exists not to do.
//
// So each stage lands in a band of its own, and the values are the ref's own
// picture rather than arithmetic: fresh is the WHOLE BAR in green ("stamina
// full is the whole bar"), settled is half of it in amber, and worn is the
// short red stub the ref describes ("a worn, tilted agent is a short red stub
// over a long red bar"). Fatigue is three stages on the wire; it is three
// readings on screen, and they are three different pictures.
export const STAMINA_OF = { fresh: 1, settled: 0.52, worn: 0.16 };

export function staminaOf(fatigue) {
  const v = STAMINA_OF[fatigue];
  return Number.isFinite(v) ? v : null;
}

// ── The two ramps ─────────────────────────────────────────────────────────
//
// Verbatim from design-refs/mood-home.jsx:
//
//   const staminaCol = v => (v > 60 ? '#4BC07A' : v > 35 ? '#C9B840' : v > 18 ? '#D48838' : '#C93F44');
//   const heatCol    = v => (v < 30 ? '#9A7840' : v < 55 ? '#D89433' : v < 80 ? '#DE6E33' : '#D43F32');
//
// STEPS rather than a gradient, and that is the design rather than an economy:
// a bar whose colour changes continuously has no edges, so it can never be read
// as a STATE — only as a value, which is what the number would have been for.
// Four steps is four states with four names, and the step is where the reading
// changes.
//
// What this replaces: BUGS-A job 10 drew stamina as a two-stop mix from green
// to a blood red and heat as a three-stop from TEAL through gold. Teal at the
// cold end made an unbothered agent look like a good reading rather than like
// no reading at all — heat is an accumulation, and its empty end is nothing.
// The ref's ember start says that. The two ends stay as far apart as the two
// causes, which is job 10's rule and is kept.

const clampPct = (n) => (n < 0 ? 0 : n > 100 ? 100 : n);

/** Full is green, spent is a blood red, and it passes through amber. 0–100. */
export const STAMINA_FULL  = '#4BC07A';
export const STAMINA_AMBER = '#C9B840';
export const STAMINA_LOW   = '#D48838';
export const STAMINA_SPENT = '#C93F44';
export function staminaPct(v) {
  const n = clampPct(Number(v) || 0);
  return n > 60 ? STAMINA_FULL : n > 35 ? STAMINA_AMBER : n > 18 ? STAMINA_LOW : STAMINA_SPENT;
}

/**
 * The felt and the profile hold stamina as a FRACTION and as a 0–100 value
 * respectively, so this keeps the 0–1 signature both of them were written
 * against and defers to the ramp above. One ramp, two call shapes.
 */
export function staminaColor(v) { return staminaPct((Number(v) || 0) * 100); }

/** Empty is an ember, boiling is fire — and it never touches green. 0–100. */
export const HEAT_EMBER = '#9A7840';
export const HEAT_WARM  = '#D89433';
export const HEAT_HOT   = '#DE6E33';
export const HEAT_FIRE  = '#D43F32';
export function heatColor(heat) {
  const n = clampPct(Number(heat) || 0);
  return n < 30 ? HEAT_EMBER : n < 55 ? HEAT_WARM : n < 80 ? HEAT_HOT : HEAT_FIRE;
}

/**
 * The same four steps, named. Nothing renders the word — it is a data attribute
 * on the pill and a handle for a test, so that "is he hot" is asked in one
 * vocabulary rather than in each surface's own thresholds.
 */
export function heatStep(heat) {
  const n = clampPct(Number(heat) || 0);
  return n < 30 ? 'ember' : n < 55 ? 'warm' : n < 80 ? 'hot' : 'fire';
}

// ── LIFE-1-B · three dots, not a bar ────────────────────────────────────────
//
// src/shared/levels.js is the one place that turns fatigue's word and heat's
// number into a three-state reading — { level, dots, label, value } — because
// a bar drawn from a three-state word was claiming precision ('63% full')
// that nobody, server included, actually has. This is the one place that
// draws that reading, so the felt, the seat pill and the home pill cannot
// draw three different pictures of the same three states.
//
// The dots keep the two ramps' colours (a fresh dot is the same green a full
// bar used to be, a steaming one the same red) — only the SHAPE changed, from
// a continuous fill to however many of three are lit. Tapping (or focusing)
// reveals the word, same as the bar's old label did, because "three dots" on
// its own is exactly as much of a puzzle as two unlabelled lines were.
const DOT_COLOR = {
  stamina: { fresh: STAMINA_FULL, settled: STAMINA_AMBER, worn: STAMINA_SPENT },
  heat: { level: HEAT_EMBER, simmering: HEAT_WARM, steaming: HEAT_FIRE },
};

/**
 * The dot row for one reading. `reading` is `staminaLevel()`/`heatLevel()`'s
 * own shape from src/shared/levels.js — `{ level, dots, label, value }`.
 * `compact` drops the tap-for-word affordance for the 18px seat pill, which
 * has no room for the word even revealed, exactly as the old bar's label did.
 */
export function BodyDots({ kind, reading, compact = false, labelled = !compact }) {
  const [open, setOpen] = useState(false);
  if (!reading) return null;
  const color = DOT_COLOR[kind]?.[reading.level] ?? STAMINA_AMBER;
  const name = kind === 'stamina' ? 'Stamina' : 'Heat';
  const dots = (
    <span className="body-dots__dots">
      {[1, 2, 3].map((n) => (
        <i key={n} className="body-dots__dot" data-lit={n <= reading.dots}
          style={n <= reading.dots ? { background: color, borderColor: color } : undefined} />
      ))}
    </span>
  );
  // A span with a button role, not a real <button>: every caller of this
  // component (the home pill, a seat pill) already sits inside its own
  // tappable body, and a <button> nested in a <button> is invalid HTML that
  // browsers recover from by breaking one of the two taps. `stopPropagation`
  // is what actually matters — without it, revealing the word would also
  // fire whatever the ancestor's own tap opens.
  const toggle = (e) => { e.stopPropagation(); setOpen((o) => !o); };
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    toggle(e);
  };
  return (
    <span className={`body-dots${compact ? ' body-dots--compact' : ''}`} data-kind={kind} data-level={reading.level}>
      {labelled ? (
        <span className="body-dots__tap" role="button" tabIndex={0} aria-expanded={open}
          onClick={toggle} onKeyDown={onKeyDown} aria-label={`${name}: ${reading.label}`}>
          {dots}
          <span className="body-dots__word" aria-hidden={!open}>{open ? reading.label : name.toUpperCase()}</span>
        </span>
      ) : (
        <span aria-label={`${name}: ${reading.label}`}>{dots}</span>
      )}
    </span>
  );
}

/**
 * The two readings, as dots.
 *
 * Either is drawn only when there is something to draw it from — a seat with no
 * agent behind it has no fatigue and no heat, and inventing three lit dots for
 * a House regular would be the felt making something up. `compact` is the
 * seat-pill scale; the default is the hero's strip.
 *
 * The SEAT scale keeps no word, tap or not: an 18px pill has no room for one,
 * and the strip above it has already taught the owner what each colour means.
 * One place to learn it, everywhere to use it.
 */
export function BodyBars({
  fatigue = null, heat = null, compact = false, className, labels = !compact,
}) {
  const stamina = fatigue !== null ? staminaLevel({ stage: fatigue }) : null;
  const hot = heat !== null && Number.isFinite(Number(heat)) ? heatLevel(heat) : null;
  if (stamina === null && hot === null) return null;

  return (
    <span className={`felt-bars${compact ? ' felt-bars--seat' : ''}${labels ? ' felt-bars--labelled' : ''}${className ? ` ${className}` : ''}`}>
      {stamina !== null && (
        <span className="felt-bars__row" data-bar="stamina">
          <BodyDots kind="stamina" reading={stamina} compact={compact} labelled={labels} />
        </span>
      )}
      {hot !== null && (
        <span className="felt-bars__row" data-bar="heat">
          <BodyDots kind="heat" reading={hot} compact={compact} labelled={labels} />
        </span>
      )}
    </span>
  );
}

/**
 * FRIDGE-1's bottle, beside his stack.
 *
 * `seat.drinking` is not on the wire yet — the want exists (src/agent/wants.js
 * knows what a beer is) and the fridge that answers it does not. So this draws
 * on a strict `=== true` and nothing else: an absent field, a null, or a server
 * that has never heard of FRIDGE-1 all render exactly what the felt renders
 * today, which is no bottle.
 */
export function Bottle({ size = 11, className }) {
  const w = size * 0.55;
  return (
    <svg className={`bottle${className ? ` ${className}` : ''}`}
      width={w} height={size} viewBox="0 0 12 22" aria-hidden
      style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
      {/* neck, shoulder, body — one path, so it reads as a silhouette at 11px */}
      <path d="M4.6 1 L7.4 1 L7.4 5.4 C7.4 6.6 10 7.8 10 10.4 L10 19 A2 2 0 0 1 8 21 L4 21 A2 2 0 0 1 2 19 L2 10.4 C2 7.8 4.6 6.6 4.6 5.4 Z"
        fill="#2E7D53" stroke="#16191B" strokeWidth="1.2" strokeLinejoin="round"
        vectorEffect="non-scaling-stroke" />
      <rect x="4.2" y="0" width="3.6" height="2" rx="0.6" fill="#CDB380" />
      <rect x="3" y="12" width="6" height="4.4" rx="0.8" fill="#CDB380" opacity="0.85" />
    </svg>
  );
}

/** Whether the felt should draw a bottle for this seat. Strict by design. */
export function isDrinking(seat) {
  return !!seat && seat.drinking === true;
}
