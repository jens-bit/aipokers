// src/shared/levels.js — LIFE-1 job 2
//
// Three dots, not a bar.
//
// THE FINDING. Stamina and heat were both drawn as continuous bars — a width
// in per cent on the home pill, on the agent card and on the felt. Two things
// were wrong with that, and only one of them is cosmetic:
//
//   1. THE PRECISION IS A LIE FOR STAMINA. What the bar was drawn from is a
//      THREE-STATE word ('fresh' | 'settled' | 'worn') multiplied up into a
//      percentage by the client. A bar 63% full says the server knows
//      something to the point that it does not know at all.
//   2. THE PRECISION IS USELESS FOR HEAT. Heat is a real 0-100 number, but
//      nothing an owner can DO about his agent changes at heat 54 versus heat
//      58. What changes is which of three situations he is in. A number nobody
//      can act on is decoration, and decoration that looks like data is worse
//      than either.
//
// So both read as three states, in the same shape, from one module — and this
// file is in src/shared/ deliberately, because the client already imports from
// here (identity.js, homePreview.js, shareAmount.js). One definition of "what
// half-empty means" for the server that sends it and the screen that draws it.
//
// THE SHAPE, identical for both readings so a client writes one dot component:
//
//   { level, dots, label, value }
//
//   level  the machine word. Stamina's are fatigue's own three, unchanged.
//   dots   1, 2 or 3 — HOW MANY ARE LIT, never how many exist. Both readings
//          light MORE dots as the state gets louder, which for stamina means a
//          full reserve is three and for heat means boiling is three. They are
//          not the same axis and must not be drawn as one: the labels say
//          which, and a client is expected to colour them differently.
//   label  the words, for the tap. Sentence case, no punctuation — it is a
//          caption, not a sentence.
//   value  the underlying number, kept so nothing that already had it loses
//          it and so a tooltip can be honest about precision it does have.
//          For stamina it is the reserve; for heat it is the heat.
//
// PURE. No clock, no record, no imports from the server. Everything arrives as
// a number or a word.

// ── Stamina ─────────────────────────────────────────────────────────────────

// Fatigue's own vocabulary, most-rested first — the same three words
// stamina.js, home.js's routine ladder and the felt's WORN pip already speak.
// This file introduces no fourth state and no second name for an old one.
export const STAMINA_LEVELS = Object.freeze(['worn', 'settled', 'fresh']);

export const STAMINA_LABELS = Object.freeze({
  fresh:   'Rested',
  settled: 'Settled in',
  worn:    'Worn out',
});

// ── Heat ────────────────────────────────────────────────────────────────────
//
// Three states cut out of mood.js's four HEAT_BANDS, on the two boundaries
// that already exist there rather than on new ones: 40 is where 'neutral'
// ends and 60 is where 'frustrated' does. So the dots and the mood state can
// never tell an owner two different stories about the same agent.
export const HEAT_LEVELS = Object.freeze(['level', 'simmering', 'steaming']);

export const HEAT_LABELS = Object.freeze({
  level:     'Level',
  simmering: 'Simmering',
  steaming:  'Steaming',
});

// The cuts, stated once. `upTo` is inclusive, matching mood.js's own bands.
export const HEAT_CUTS = Object.freeze([
  { upTo: 40, level: 'level' },
  { upTo: 60, level: 'simmering' },
  { upTo: 100, level: 'steaming' },
]);

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The stamina reading, from either half of what a caller might hold.
 *
 * `stage` is the three-state word when the caller already has it (every
 * projection does — it is `fatigue` on the wire). `value` is the 0-100 reserve
 * when the caller has that too. The word WINS when both are given: the stage
 * is what the rest of the system has already agreed he is, and a reading that
 * disagreed with the pip beside it would be the bar's problem all over again.
 *
 * Neither given is 'fresh' with a null value — an agent nobody has measured is
 * not a tired agent.
 */
export function staminaLevel({ stage = null, value = null } = {}) {
  const v = num(value);
  const level = STAMINA_LEVELS.includes(stage)
    ? stage
    : (v === null ? 'fresh' : levelFromReserve(v));
  return {
    level,
    dots: STAMINA_LEVELS.indexOf(level) + 1,
    label: STAMINA_LABELS[level],
    value: v,
  };
}

// The reserve's own thresholds, in the one place a client can reach them.
// Kept numerically identical to stamina.js's SETTLED_AT / WORN_AT; that module
// is the server's and importing it here would drag attributes.js into a
// browser bundle for the sake of two integers.
export const STAMINA_SETTLED_AT = 67;
export const STAMINA_WORN_AT = 34;

export function levelFromReserve(value) {
  const v = num(value);
  if (v === null) return 'fresh';
  if (v >= STAMINA_SETTLED_AT) return 'fresh';
  if (v >= STAMINA_WORN_AT) return 'settled';
  return 'worn';
}

/**
 * The heat reading. `value` is 0-100; anything else reads as 'level', which is
 * the honest answer for an agent with no mood recorded rather than the
 * alarming one.
 */
export function heatLevel(value) {
  const v = num(value);
  const h = v === null ? null : Math.max(0, Math.min(100, v));
  const level = h === null
    ? 'level'
    : (HEAT_CUTS.find((c) => h <= c.upTo) ?? HEAT_CUTS[HEAT_CUTS.length - 1]).level;
  return {
    level,
    dots: HEAT_LEVELS.indexOf(level) + 1,
    label: HEAT_LABELS[level],
    value: h,
  };
}

/**
 * Both readings, in the shape every surface carries them in.
 *
 * One function so home, the agent view and the felt cannot drift into three
 * spellings of the same pair. A seat with no agent behind it (a House regular,
 * a human) passes nothing and gets the resting reading, which is what those
 * seats already report for mood.
 */
export function bodyLevels({ stage = null, stamina = null, heat = null } = {}) {
  return {
    stamina: staminaLevel({ stage, value: stamina }),
    heat: heatLevel(heat),
  };
}
