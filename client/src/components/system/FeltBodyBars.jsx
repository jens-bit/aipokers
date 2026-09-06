// WATCH-8 job 2 — THE BODY ON THE FELT.
//
// Two things about an agent are true all session and neither of them was on the
// table: how much is left in him, and how hard he is running. The face carries
// mood, the hands carry what he is doing, the chips carry his money — and until
// this there was nowhere to read the body itself.
//
// TWO BARS, TWO PIXELS, AND THEY NEVER SHARE A CHANNEL:
//
//   STAMINA  green → grey.  Comes from VOLUME (fatigue: fresh / settled / worn)
//                           and retreats as the session wears him down.
//   HEAT     teal  → red.   Comes from OUTCOMES (mood.heat, 0–100) and fills as
//                           he runs hot.
//
// "A confident agent can be worn; a tilted agent can be fresh." That is why they
// are two lines and not one: a single meter would make an owner read one cause
// for two different things. The colours are as far apart as the causes — nothing
// green ever means heat and nothing red ever means tiredness.
//
// Two pixels because this is a fact, not a panel. It rides the bottom edge of
// whatever already names the agent — his strip, or a seat's name pill — so it
// costs the felt no height at all.

// Fatigue's three stages, as a fraction of the line. The same 3 / 2 / 1 the
// block meter already uses, so the two readings of fatigue cannot disagree.
export const STAMINA_OF = { fresh: 1, settled: 2 / 3, worn: 1 / 3 };

export function staminaOf(fatigue) {
  const v = STAMINA_OF[fatigue];
  return Number.isFinite(v) ? v : null;
}

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

function mix(a, b, t) {
  const k = clamp01(t);
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const to = (n) => Math.round(n).toString(16).padStart(2, '0');
  return `#${to(ar + (br - ar) * k)}${to(ag + (bg - ag) * k)}${to(ab + (bb - ab) * k)}`;
}

// Green when there is plenty left, grey when there is not. Grey is M_FAINT —
// the token that is explicitly NOT text: a spent line is furniture, not a number
// somebody has to read.
export const STAMINA_FULL = '#3FBF7F';
export const STAMINA_SPENT = '#55555C';
export function staminaColor(v) { return mix(STAMINA_SPENT, STAMINA_FULL, v); }

// Teal at rest, red when he is boiling — THROUGH GOLD, not straight across.
// A direct interpolation between those two hexes lands on khaki at heat 50,
// which reads as neither end and as no state the system has a name for. Gold is
// already the warning colour everywhere else on this screen, and the three
// stops are the heat bands' own words: cold, warm, boiling.
export const HEAT_COLD = '#00D4AA';
export const HEAT_WARM = '#CDB380';
export const HEAT_HOT = '#FF4D4F';
export function heatColor(heat) {
  const t = clamp01((Number(heat) || 0) / 100);
  return t <= 0.5
    ? mix(HEAT_COLD, HEAT_WARM, t * 2)
    : mix(HEAT_WARM, HEAT_HOT, (t - 0.5) * 2);
}

/**
 * The two lines.
 *
 * Either is drawn only when there is something to draw it from — a seat with no
 * agent behind it has no fatigue and no heat, and inventing a full green line
 * for a House regular would be the felt making something up. `compact` is the
 * seat-pill scale; the default is the hero's strip.
 */
export function BodyBars({ fatigue = null, heat = null, compact = false, className }) {
  const stamina = staminaOf(fatigue);
  const hot = Number.isFinite(Number(heat)) && heat !== null ? clamp01(Number(heat) / 100) : null;
  if (stamina === null && hot === null) return null;

  return (
    <span className={`body-bars${compact ? ' body-bars--seat' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden>
      {stamina !== null && (
        <span className="body-bars__track" data-bar="stamina">
          <span className="body-bars__fill"
            style={{ width: `${stamina * 100}%`, background: staminaColor(stamina) }} />
        </span>
      )}
      {hot !== null && (
        <span className="body-bars__track" data-bar="heat">
          <span className="body-bars__fill"
            style={{ width: `${hot * 100}%`, background: heatColor(heat) }} />
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
