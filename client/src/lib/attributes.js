// ATTR-2 — the character-system data contract, client side.
//
// Pure, side-effect free: no imports, no DOM, no fetch. The engine (ATTR-1) owns
// the numbers; this module owns the shape the UI reads them in, and the defaults
// that keep every surface renderable while the server still sends nothing.
//
// Server contract (all fields optional today):
//   agent.attrs     = { READS, FOCUS, DISCIPLINE, COMPOSURE, DECEPTION, STAMINA }  0–100
//   agent.potential = { KEY: { lo, hi } }
//   agent.nature    = null | { name, up, down, line }        null = "still forming"
//   agent.fatigue   = 'fresh' | 'settled' | 'worn'           absent → fresh
//   agent.narrowed  = null | [KEY]   transient: the bands that moved in at the
//                                     end of the last session, one session only
//   agent.attrLog   = [{ ts, key, from, to, cause }]
//
// Constants below are copied from design-refs/char-system.jsx. Order is law:
// six bars in ATTR_KEYS order on every surface, so an agent's silhouette is
// recognisable at a glance.

export const ATTR_KEYS = ['READS', 'FOCUS', 'DISCIPLINE', 'COMPOSURE', 'DECEPTION', 'STAMINA'];

// One nature step, on the 0–100 scale.
export const ATTR_STEP = 8;

// Short forms for the nature chip's zero-sum pair — the badge has no room for
// DISCIPLINE at 10.5px.
export const ATTR_SHORT = {
  READS: 'READS', FOCUS: 'FOCUS', DISCIPLINE: 'DISC',
  COMPOSURE: 'COMP', DECEPTION: 'DECEP', STAMINA: 'STAM',
};

// meanShort + trainsShort are the two halves of the tapped panel's caption.
export const ATTR_META = {
  READS:      { meanShort: 'Opponent reading',      trainsShort: 'showdowns seen' },
  FOCUS:      { meanShort: 'Math precision',        trainsShort: 'sheer decision volume' },
  DISCIPLINE: { meanShort: 'Rule-following',        trainsShort: 'big folds made correctly' },
  COMPOSURE:  { meanShort: 'Tilt resistance',       trainsShort: 'surviving beats without tilting' },
  DECEPTION:  { meanShort: 'Unreadability',         trainsShort: 'bluffs that get through' },
  STAMINA:    { meanShort: 'Late-session sharpness', trainsShort: 'long sessions at the table' },
};

// Eight natures, zero-sum: +ATTR_STEP to one attribute, −ATTR_STEP to another.
// Assigned at birth by the server and never re-rolled — the client only renders
// what it is given and never picks one.
export const NATURES = [
  { name: 'Grinder',   up: 'STAMINA',    down: 'DECEPTION' },
  { name: 'Hothead',   up: 'DECEPTION',  down: 'COMPOSURE' },
  { name: 'Professor', up: 'FOCUS',      down: 'STAMINA' },
  { name: 'Rock',      up: 'DISCIPLINE', down: 'READS' },
  { name: 'Gambler',   up: 'DECEPTION',  down: 'DISCIPLINE' },
  { name: 'Shark',     up: 'READS',      down: 'COMPOSURE' },
  { name: 'Sphinx',    up: 'COMPOSURE',  down: 'FOCUS' },
  { name: 'Showman',   up: 'DECEPTION',  down: 'READS' },
];

// Fatigue is state, not skill: three stages, each with its own block count and
// colour. Gold only at 'worn', where it actually costs something.
export const FATIGUE_STAGES = ['fresh', 'settled', 'worn'];

export const FATIGUE = {
  fresh:   { key: 'fresh',   word: 'fresh',      blocks: 3, gold: false },
  settled: { key: 'settled', word: 'settled in', blocks: 2, gold: false },
  worn:    { key: 'worn',    word: 'worn',       blocks: 1, gold: true },
};

const DEFAULT_VALUE = 50;

// Day-one rule (design 32): a newborn's current sits at ~60% of his band's low
// edge, and the band is a 30-point rumour. Inverted here to place a band when the
// server has not scouted one yet — clamped so the band stays inside 0–100 and
// never opens below the value it is a ceiling for.
const DAY_ONE_RATIO = 0.6;
const DAY_ONE_WIDTH = 30;

const clamp = (v) => Math.max(0, Math.min(100, v));

export function bandFor(value) {
  const cur = clamp(Number.isFinite(value) ? value : DEFAULT_VALUE);
  let lo = Math.round(cur / DAY_ONE_RATIO);
  let hi = lo + DAY_ONE_WIDTH;
  if (hi > 100) { hi = 100; lo = Math.max(cur, hi - DAY_ONE_WIDTH); }
  return { lo: clamp(lo), hi: clamp(hi) };
}

function readNature(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) return null;
  const up = ATTR_KEYS.includes(raw.up) ? raw.up : null;
  const down = ATTR_KEYS.includes(raw.down) ? raw.down : null;
  return { name, up, down, line: typeof raw.line === 'string' && raw.line ? raw.line : null };
}

export function fatigueOf(agent) {
  const f = agent?.fatigue;
  return FATIGUE_STAGES.includes(f) ? f : 'fresh';
}

/**
 * The one place the UI turns a raw agent into six renderable rows.
 * Everything is optional on the way in; nothing is optional on the way out.
 *
 * @returns {{
 *   attrs: Record<string, number>,
 *   potential: Record<string, {lo:number, hi:number}>,
 *   nature: {name:string, up:string|null, down:string|null, line:string|null} | null,
 *   fatigue: string,
 *   scouted: boolean,
 *   rows: Array<{key:string, cur:number, lo:number, hi:number, fatigued:boolean, narrowed:boolean}>,
 * }}
 */
export function normalizeAttrs(agent) {
  const rawAttrs = agent?.attrs && typeof agent.attrs === 'object' ? agent.attrs : {};
  const rawPot = agent?.potential && typeof agent.potential === 'object' ? agent.potential : {};
  const fatigue = fatigueOf(agent);

  // Fatigue erodes execution on exactly two attributes, and only at 'worn'.
  const worn = fatigue === 'worn';
  const dips = { FOCUS: worn, DISCIPLINE: worn };

  // FIX-1h: the gold caret at the high end of a bar. ATTR-3 sets agent.narrowed
  // to the keys whose band moved in at the end of the last session and clears it
  // on the next one — "appears for one session after the band narrows, then
  // retires" (char-system2.jsx). AttrCluster has always passed row.narrowed
  // through to AttrBar; nothing was ever setting it, so the caret never fired.
  const narrowedKeys = Array.isArray(agent?.narrowed) ? agent.narrowed : [];

  const attrs = {};
  const potential = {};
  const rows = ATTR_KEYS.map((key) => {
    const raw = rawAttrs[key];
    const cur = clamp(Number.isFinite(raw) ? Math.round(raw) : DEFAULT_VALUE);
    const band = rawPot[key];
    const hasBand = band && Number.isFinite(band.lo) && Number.isFinite(band.hi);
    const lo = hasBand ? clamp(Math.round(Math.min(band.lo, band.hi))) : bandFor(cur).lo;
    const hi = hasBand ? clamp(Math.round(Math.max(band.lo, band.hi))) : bandFor(cur).hi;
    attrs[key] = cur;
    potential[key] = { lo, hi };
    return { key, cur, lo, hi, fatigued: !!dips[key], narrowed: narrowedKeys.includes(key) };
  });

  return {
    attrs,
    potential,
    nature: readNature(agent?.nature),
    fatigue,
    // False until the engine sends real numbers — surfaces that want to stay
    // quiet on a stub agent can check this instead of guessing.
    scouted: ATTR_KEYS.some((k) => Number.isFinite(rawAttrs[k])),
    rows,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toMillis(ts) {
  if (Number.isFinite(ts)) return ts;
  if (typeof ts === 'string') {
    const n = Date.parse(ts);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/** Growth entries for one attribute, oldest first, inside the window. */
export function entriesFor(attrLog, key, days = 90, now = Date.now()) {
  if (!Array.isArray(attrLog)) return [];
  const cutoff = now - days * DAY_MS;
  return attrLog
    .filter((e) => e && e.key === key && Number.isFinite(e.from) && Number.isFinite(e.to))
    .map((e) => ({ ...e, _ts: toMillis(e.ts) }))
    .filter((e) => e._ts == null || e._ts >= cutoff)
    .sort((a, b) => (a._ts ?? 0) - (b._ts ?? 0));
}

/**
 * The sparkline's series: the value before the first tick in the window, then
 * every value it stepped to. Empty log → an empty array, so the caller can draw
 * a flat line at the current value rather than invent a climb that never happened.
 */
export function seriesFor(attrLog, key, days = 90, now = Date.now()) {
  const entries = entriesFor(attrLog, key, days, now);
  if (entries.length === 0) return [];
  return [entries[0].from, ...entries.map((e) => e.to)];
}

// FIX-1h: not every attrLog entry is growth. ATTR-3 writes two book-keeping
// entries with the same shape — 'birth', one per attribute the moment an agent
// is created, and 'narrowed', when a scouting band moves in. Both carry
// from === to on purpose, so a sparkline never draws a phantom step for them.
// Neither is something he learned at the table, so neither may light the GREW
// badge: a newborn who has not played a hand was showing "+0 GREW" on the
// roster, and a scouting report was claiming credit for growth.
const LEDGER_CAUSES = new Set(['birth', 'narrowed']);

export function isGrowthTick(entry) {
  if (!entry || !ATTR_KEYS.includes(entry.key)) return false;
  if (!Number.isFinite(entry.from) || !Number.isFinite(entry.to)) return false;
  return !LEDGER_CAUSES.has(entry.cause);
}

/**
 * Every growth tick inside the window, across all six attributes, oldest first —
 * the thread's growth lines, in the order they happened.
 *
 * FIX-1i: ledger entries are filtered out here too. A GrowthLine reads
 * "FOCUS 62 → 62" with the cause quoted underneath as his own voice, so a
 * 'narrowed' entry rendered as him announcing a step he did not take, in a
 * sentence he never said. Growth is an event with a cause he can speak; the
 * scouting report and the birth record are neither.
 */
export function recentEntries(attrLog, hours = 24, now = Date.now()) {
  if (!Array.isArray(attrLog)) return [];
  const cutoff = now - hours * 60 * 60 * 1000;
  return attrLog
    .filter(isGrowthTick)
    .map((e) => ({ ...e, _ts: toMillis(e.ts) }))
    .filter((e) => e._ts != null && e._ts >= cutoff)
    .sort((a, b) => a._ts - b._ts);
}

/** True when he actually grew inside the window — the roster's GREW badge. */
export function grewWithin(attrLog, hours = 24, now = Date.now()) {
  if (!Array.isArray(attrLog) || attrLog.length === 0) return false;
  const cutoff = now - hours * 60 * 60 * 1000;
  return attrLog.some((e) => {
    if (!isGrowthTick(e)) return false;
    const ts = toMillis(e.ts);
    return ts != null && ts >= cutoff;
  });
}

/** Total points gained per attribute inside the window, in canon order. */
export function gainsWithin(attrLog, hours = 24, now = Date.now()) {
  if (!Array.isArray(attrLog)) return [];
  const cutoff = now - hours * 60 * 60 * 1000;
  const totals = new Map();
  for (const e of attrLog) {
    // Same filter as grewWithin: the badge's presence and its number are the
    // same claim, so they have to be counted from the same entries.
    if (!isGrowthTick(e)) continue;
    const ts = toMillis(e.ts);
    if (ts == null || ts < cutoff) continue;
    totals.set(e.key, (totals.get(e.key) ?? 0) + (e.to - e.from));
  }
  return ATTR_KEYS
    .filter((k) => (totals.get(k) ?? 0) > 0)
    .map((k) => ({ key: k, gain: totals.get(k) }));
}

/**
 * The five-word caption under a tapped bar: what the attribute means, and what
 * trains it. `value` is part of the contract so the copy can vary by level later;
 * the refs give one caption per attribute, so it does not change the wording yet.
 */
export function captionFor(key, value) { // eslint-disable-line no-unused-vars
  const meta = ATTR_META[key];
  if (!meta) return '';
  return `${meta.meanShort.toUpperCase()} · FROM ${meta.trainsShort.toUpperCase()}`;
}

/**
 * Fatigue in words. The refs always name the hand count when there is one —
 * "worn — 140 hands, Focus dipping" — and never name a cost below 'worn'.
 */
export function fatigueLineFor(stage, hands) {
  const f = FATIGUE[stage] ?? FATIGUE.fresh;
  const count = Number.isFinite(hands) && hands > 0
    ? `${hands.toLocaleString()} hand${hands === 1 ? '' : 's'}`
    : null;
  if (f.key === 'worn') {
    return count ? `worn — ${count}, Focus dipping` : 'worn — Focus dipping';
  }
  if (f.key === 'settled') return count ? `settled in — ${count}` : 'settled in';
  return count ? `fresh — ${count} in` : 'fresh';
}
