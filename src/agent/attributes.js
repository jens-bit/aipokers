// src/agent/attributes.js
// The attribute engine — the GROWN half of the character system.
//
// Design source: design-refs/char-system.jsx (ATTRS, NATURES, ATTR_STEP),
// char-system2.jsx (potential band, growth vs fatigue), char-close.jsx (state
// matrix + the seam rule), and the "Character System — design LOCKED" section
// of CORE_GAME_PLAN.md. Port, don't reinvent.
//
// The split this module implements:
//   STRATEGY  (chosen)  — aggression, tightness, bluffFreq, discipline slider.
//                         Lives in policy.js. NOT touched here, ever.
//   ATTRIBUTES (grown)  — six 0–100 values that change how WELL he executes
//                         the strategy he was given, never WHAT he is told to do.
//
// Laws, binding (char-system.jsx S0):
//   1. Attributes affect execution within a bounded band.
//   2. No purchase path. Earned at the table or not at all.
//   3. Fixed birth budget — no build is strictly better, only different.
//   4. Nothing here gates whether he can play. Fatigue degrades execution
//      late in a session; it never locks a table.
//   5. Every attribute names the thing it moves. A stat that changes nothing
//      is an adjective, and adjectives are banned.
//
// And the law this module enforces mechanically: with ATTRIBUTE_IMPACT at 0
// the game is bit-identical to the pre-attribute build. Every hook either
// blends back to its neutral value through `at()`, or is skipped outright
// when the knob is 0 (the ones carrying a boolean gate or a clamp, which
// cannot be interpolated).

// Canon order. Six bars, fixed sequence, on every surface — "order is law".
export const ATTR_KEYS = Object.freeze(['READS', 'FOCUS', 'DISCIPLINE', 'COMPOSURE', 'DECEPTION', 'STAMINA']);

// The value at which an attribute does nothing distinctive.
export const NEUTRAL_ATTR = 50;

// attrLog ring buffer size — ~90 days of ticks at the design's rate (single
// points over weeks), which is what the profile sparkline draws.
export const ATTR_LOG_CAP = 200;

// Day-one band width when a band has to be invented (char-system2.jsx S3:
// "born. The ceiling is a rumour: a 30-point band"). ATTR-1 does not generate
// birth bands — that is ATTR-3's job, with the nature shift applied. This is
// only the neutral backfill for agents that pre-date the system.
const DEFAULT_BAND_WIDTH = 30;

// STAMINA: max points of FOCUS/DISCIPLINE erosion, reached at 2× onset.
export const MAX_FATIGUE_DROP = 20;

// FOCUS: below this the equity he is shown is also rounded to the nearest 5%
// — he stops counting to the decimal, not just to the point.
export const FOCUS_ROUNDING_BELOW = 35;

// READS: below this he does not get the EXPLOIT directive at all — he sees
// the raw stat line and has to work it out himself.
export const EXPLOIT_MIN_READS = 40;

// ── The knob ─────────────────────────────────────────────────────────────────
// Read live from the environment rather than frozen at import, so a harness
// (arena --attributes off, the tests) can set it without controlling module
// load order.
export function attributeImpact() {
  const raw = Number(process.env.ATTRIBUTE_IMPACT ?? 1);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(0, Math.min(1, raw));
}

// The value at import, for callers that want the setting rather than the
// live reading.
export const ATTRIBUTE_IMPACT = attributeImpact();

// A strict numeric test. `Number(null)` is 0 and `Number('')` is 0, which
// would quietly turn "this agent has no attributes" into "this agent has a 0"
// — the difference between the hook standing down and the hook firing at full
// strength in the wrong direction.
function isNum(v) {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.trim() !== '' && Number.isFinite(Number(v));
  return false;
}

function clampAttr(v) {
  if (!isNum(v)) return NEUTRAL_ATTR;
  return Math.max(0, Math.min(100, Number(v)));
}

// ── at() — the one interpolation every hook goes through ────────────────────
// Maps the 0–100 attribute onto low..high (low is what a 0 does, high is what
// a 100 does), then blends back toward `neutral` — the value the code used
// before attributes existed — by (1 − ATTRIBUTE_IMPACT).
//
// Note the deliberate consequence: at full impact a value of 50 lands at the
// MIDPOINT of low..high, which is not necessarily `neutral`. `neutral` is the
// knob-0 anchor, not the mid-scale value. Where the two differ (READS,
// DECEPTION, FOCUS) that gap is real and shows up in verify-attributes.js.
export function at(value, neutral, low, high) {
  const v = clampAttr(value);
  const full = low + (v / 100) * (high - low);
  const k = attributeImpact();
  return neutral + (full - neutral) * k;
}

// True when a hook should engage at all. Hooks that carry a boolean gate or a
// clamp (which have no interpolated form) check this and otherwise fall
// through to the pre-attribute code path exactly.
export function attrsActive(value) {
  return isNum(value) && attributeImpact() > 0;
}

// ── Records ──────────────────────────────────────────────────────────────────

export function defaultAttributes() {
  const out = {};
  for (const k of ATTR_KEYS) out[k] = NEUTRAL_ATTR;
  return out;
}

function defaultBand(current) {
  const lo = clampAttr(current);
  return { lo, hi: Math.min(100, lo + DEFAULT_BAND_WIDTH) };
}

export function defaultPotential(attrs = defaultAttributes()) {
  const out = {};
  for (const k of ATTR_KEYS) out[k] = defaultBand(attrs[k]);
  return out;
}

// Idempotent backfill, mirroring ensureMood/ensureStats in agentProfiles.js.
// Attaches { attrs, potential, nature, attrLog } and repairs partial records.
export function ensureAttributes(agent) {
  if (!agent || typeof agent !== 'object') return agent;

  if (!agent.attrs || typeof agent.attrs !== 'object') {
    agent.attrs = defaultAttributes();
  } else {
    for (const k of ATTR_KEYS) {
      if (!isNum(agent.attrs[k])) agent.attrs[k] = NEUTRAL_ATTR;
      else agent.attrs[k] = clampAttr(agent.attrs[k]);
    }
  }

  if (!agent.potential || typeof agent.potential !== 'object') agent.potential = {};
  for (const k of ATTR_KEYS) {
    const band = agent.potential[k];
    if (!band || !isNum(band.lo) || !isNum(band.hi)) {
      agent.potential[k] = defaultBand(agent.attrs[k]);
    }
  }

  // Assigned at birth in ATTR-3; null until then, never re-rolled after.
  if (agent.nature === undefined) agent.nature = null;

  if (!Array.isArray(agent.attrLog)) agent.attrLog = [];
  if (agent.attrLog.length > ATTR_LOG_CAP) agent.attrLog = agent.attrLog.slice(-ATTR_LOG_CAP);

  return agent;
}

// Every attribute change is an EVENT WITH A CAUSE, never a silent number
// change (char-system2.jsx S4: "no tick without a named cause"). Nothing in
// ATTR-1 calls this — growth is ATTR-3 — but the shape and the cap are fixed
// here so the log the client draws is the same log from the first tick on.
export function logAttrChange(agent, { key, from, to, cause = null, ts = Date.now() } = {}) {
  if (!agent || !ATTR_KEYS.includes(key)) return null;
  ensureAttributes(agent);
  const entry = { ts, key, from: clampAttr(from), to: clampAttr(to), cause: cause ?? null };
  agent.attrLog.push(entry);
  if (agent.attrLog.length > ATTR_LOG_CAP) agent.attrLog = agent.attrLog.slice(-ATTR_LOG_CAP);
  return entry;
}

// ── STAMINA / fatigue ────────────────────────────────────────────────────────
// The only attribute that acts on other attributes. Onset is a hand number,
// not an outcome; after onset FOCUS and DISCIPLINE erode linearly, reaching
// −MAX_FATIGUE_DROP at 2× onset. Nothing else degrades, and the potential
// band never moves — fatigue is not a lower ceiling.

export function fatigueOnset(stamina) {
  return at(stamina, 100, 40, 160);
}

// Pure. Returns the six values after fatigue plus the fatigue stage.
export function effectiveAttrs(agent, { sessionHands = 0 } = {}) {
  const src = agent && typeof agent === 'object'
    ? (agent.attrs && typeof agent.attrs === 'object' ? agent.attrs : agent)
    : null;

  const base = {};
  for (const k of ATTR_KEYS) base[k] = isNum(src?.[k]) ? clampAttr(src[k]) : NEUTRAL_ATTR;

  const hands = isNum(sessionHands) ? Math.max(0, Number(sessionHands)) : 0;
  const onset = fatigueOnset(base.STAMINA);

  let stage = 'fresh';
  let drop = 0;
  if (onset > 0 && hands >= onset) {
    stage = hands > onset * 1.5 ? 'worn' : 'settled';
    drop = MAX_FATIGUE_DROP * Math.min(1, (hands - onset) / onset);
  }

  return {
    ...base,
    FOCUS: clampAttr(base.FOCUS - drop),
    DISCIPLINE: clampAttr(base.DISCIPLINE - drop),
    fatigue: stage,
    fatigueOnset: onset,
    fatigueDrop: drop,
    sessionHands: hands,
  };
}

// ── READS / DECEPTION — the two sides of the same table ─────────────────────
// How many observed hands the hero needs before a read on an opponent is
// briefed at all. READS pulls it down (he solves them faster); the SUBJECT's
// DECEPTION pushes it up (they solve him slower). Same number, both ends.

export function readMinHands({ reads = null, deception = null, base = 10 } = {}) {
  let gate = base;
  if (attrsActive(reads)) gate = at(reads, base, 22, 5);
  if (attrsActive(deception)) gate *= at(deception, 1.0, 0.6, 2.4);
  return gate;
}

export function deceptionMinHandsMultiplier(deception) {
  return attrsActive(deception) ? at(deception, 1.0, 0.6, 2.4) : 1;
}

// He only gets the explicit counter-strategy once he can read the table.
export function exploitsAllowed(reads) {
  if (!attrsActive(reads)) return true;
  return clampAttr(reads) >= EXPLOIT_MIN_READS;
}

// ── FOCUS — math precision ───────────────────────────────────────────────────
// The equity and pot-odds lines the briefing shows him are his PERCEPTION of
// the number, not the number. Low FOCUS misjudges a spot now and then; this
// is the honest place a low attribute costs money ("he misjudged equity by
// 7% · Focus" in the hand review).
//
// The noise is deterministic in the seed, which is built from the hand, the
// seat and the cards — so the duplicate-deck mirror in the arena draws the
// SAME misperception on both halves and the measurement stays a clean A/B.

function hashSeed(str) {
  const s = String(str);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a) {
  let x = a | 0;
  return function next() {
    x = (x + 0x6D2B79F5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal from a string seed, clamped to ±3σ so a tail draw can never
// turn a 20% equity into a 60% one.
export function seededNormal(seed) {
  const rnd = mulberry32(hashSeed(seed));
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-3, Math.min(3, z));
}

export function focusSigma(focus) {
  return attrsActive(focus) ? at(focus, 0, 0.08, 0) : 0;
}

// `value` and the return are equity units (0..1). Non-finite passes through.
export function perceiveEquity(value, focus, seed) {
  if (!Number.isFinite(value)) return value;
  if (!attrsActive(focus)) return value;
  const sigma = focusSigma(focus);
  let v = value + seededNormal(seed) * sigma;
  if (clampAttr(focus) < FOCUS_ROUNDING_BELOW) v = Math.round(v * 20) / 20;
  return Math.max(0, Math.min(1, v));
}

// ── COMPOSURE — tilt resistance and recovery ─────────────────────────────────
// How hard a bad beat lands, and how many hands he needs to come back.

export function composureTiltBonus(composure) {
  return attrsActive(composure) ? at(composure, 0, -20, +20) : 0;
}

export function composureDecayHands(composure, base) {
  if (!attrsActive(composure)) return base;
  return Math.max(1, Math.round(at(composure, base, 6, 2)));
}

// ── DISCIPLINE — rule-following ──────────────────────────────────────────────
// Multiplies the profile's own deviation frequency. The profile still decides
// how loose the leash is; DISCIPLINE decides how hard he pulls on it.

export function disciplineDeviationMultiplier(discipline) {
  return attrsActive(discipline) ? at(discipline, 1.0, 1.6, 0.4) : 1;
}
