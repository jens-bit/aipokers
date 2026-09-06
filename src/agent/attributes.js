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
// PIECEWISE, in two segments hinged on 50: 0..50 runs low→neutral and 50..100
// runs neutral→high. Then the result blends back toward `neutral` by
// (1 − ATTRIBUTE_IMPACT).
//
// The hinge is the point (ATTR-1d). A single low→high line made 50 land on the
// midpoint of the band, so a neutral agent was NOT today's agent: his read gate
// was 13.5 hands instead of 10, opponents needed ×1.5 the evidence on him, and
// his equity carried σ 0.04 of noise. Every backfilled agent in prod sits at
// 50, so that gap was a silent live-play change dressed up as a no-op. With the
// hinge, 50 is exactly `neutral` at every impact setting, and the endpoints are
// unchanged: 0 still gives `low`, 100 still gives `high`.
//
// The two halves have different slopes whenever neutral is off-centre, which is
// correct: the distance from "today" to "as good as it gets" is not obliged to
// equal the distance from "today" down to "as bad as it gets".
export function at(value, neutral, low, high) {
  const v = clampAttr(value);
  const full = v <= 50
    ? low + (v / 50) * (neutral - low)
    : neutral + ((v - 50) / 50) * (high - neutral);
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

  // Assigned at birth, never re-rolled after. Agents that pre-date the birth
  // generator stay null — a null nature reads as "still forming" and that is
  // the truth about them.
  if (agent.nature === undefined) agent.nature = null;
  // ATTR-3: an agent born before builtFor/struggle existed keeps his nature and
  // gains its words. Same nature, same pair, only the prose is new — this is a
  // backfill, not a re-roll.
  if (agent.nature && typeof agent.nature === 'object' && agent.nature.name) {
    const canon = NATURE_BY_NAME[agent.nature.name];
    if (canon) {
      if (!agent.nature.builtFor) agent.nature.builtFor = canon.builtFor;
      if (!agent.nature.struggle) agent.nature.struggle = canon.struggle;
      if (!agent.nature.line) agent.nature.line = canon.line;
    }
    if (!agent.firstWords) agent.firstWords = firstWordsFor(agent.nature.name);
  }

  if (!Array.isArray(agent.attrLog)) agent.attrLog = [];
  if (agent.attrLog.length > ATTR_LOG_CAP) agent.attrLog = agent.attrLog.slice(-ATTR_LOG_CAP);

  // AGENTS-2: the part-point he has already earned toward his next tick, per
  // key. Six numbers in [0,1). It is deliberately NOT presented anywhere — a
  // visible progress bar is the thing the whole growth design refuses to be —
  // but it has to be on the record, or the pace resets every time he stands up.
  if (!agent.attrProgress || typeof agent.attrProgress !== 'object') agent.attrProgress = {};
  for (const k of ATTR_KEYS) {
    const v = agent.attrProgress[k];
    agent.attrProgress[k] = isNum(v) ? Math.max(0, Math.min(1, Number(v))) : 0;
  }

  // SERVER-5 job 2: the six he was BORN with — rust's floor, and the same kind
  // of day-one record `potentialBirth` already keeps for the bands. It has to
  // be its own field rather than a read of the attrLog, because the log is a
  // 200-entry ring: a long career pushes the birth entries out of it, and a
  // floor that can be forgotten is a floor that eventually stops holding.
  //
  // Backfilled from the log while it is still there, and from his CURRENT
  // values when it is not. That fallback is the conservative one on purpose —
  // an unknown birth means nothing can be shown to have been earned, so rust
  // can take nothing back.
  if (!agent.attrsBorn || typeof agent.attrsBorn !== 'object') agent.attrsBorn = {};
  for (const k of ATTR_KEYS) {
    if (isNum(agent.attrsBorn[k])) {
      agent.attrsBorn[k] = clampAttr(agent.attrsBorn[k]);
      continue;
    }
    agent.attrsBorn[k] = clampAttr(bornFromLog(agent.attrLog, k) ?? agent.attrs[k]);
  }

  return agent;
}

/**
 * SERVER-5 job 2 — say that a session EXERCISED these skills.
 *
 * The stamp rust's fortnight is measured from. It lives here rather than in
 * rust.js because it is attribute bookkeeping and applySessionGrowth has to be
 * able to write it without importing rust back — rust.js re-exports it so the
 * rule still reads out of one file.
 *
 * Taking a point of rust deliberately does NOT set this (that moves
 * `attrRustedAt`), so a man who is left alone keeps drifting a point a week
 * instead of resetting his own grace period every time one lands.
 */
export function noteExercised(agent, keys, { now = Date.now() } = {}) {
  if (!agent || !keys?.length) return null;
  if (!agent.attrUsedAt || typeof agent.attrUsedAt !== 'object') agent.attrUsedAt = {};
  for (const key of keys) {
    if (!ATTR_KEYS.includes(key)) continue;
    agent.attrUsedAt[key] = now;
    // He used it, so this is where the next fortnight starts. Leaving the old
    // rust stamp would take another point off him a week later for a skill he
    // exercised yesterday.
    if (agent.attrRustedAt) delete agent.attrRustedAt[key];
  }
  return agent.attrUsedAt;
}

// The day-one value for one key, out of the attrLog: the birth anchor if it is
// still in the ring, otherwise the `from` of the oldest entry that mentions the
// key — which is where it stood before the first thing that moved it.
function bornFromLog(log, key) {
  if (!Array.isArray(log)) return null;
  for (const entry of log) {
    if (entry?.key !== key) continue;
    if (entry.cause === 'birth' && isNum(entry.to)) return Number(entry.to);
    if (isNum(entry.from)) return Number(entry.from);
  }
  return null;
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

// ── Birth ────────────────────────────────────────────────────────────────────
// Ported verbatim from design-refs/char-system.jsx (NATURES, ATTR_STEP). Eight
// natures, zero-sum: +1 step to one attribute, −1 to another, where a step is
// ±8 points and the SAME shift lands on the potential band. Announced at birth
// in his own voice — never hidden, never re-rolled, never changed again.

// One nature step, on the 0–100 scale.
export const ATTR_STEP = 8;

// `sig` is his signature quote and `line` is the birth announcement, both
// verbatim from the ref. ATTR-3 adds `builtFor` / `struggle` — the zero-sum pair
// said in words rather than as +8/-8, which is what the birth card renders under
// BUILT FOR / WILL STRUGGLE. Each is one clause, written from that attribute's
// "moves in his play" line in char-system.jsx, so both halves of a nature can be
// read by someone who has never seen a bar.
export const NATURES = Object.freeze([
  { name: 'Grinder',   up: 'STAMINA',    down: 'DECEPTION',  sig: 'I do not need to be clever. I need to still be here at hand four hundred.', line: 'This one settles in like he is paying rent. He is a Grinder.',
    builtFor: 'Long sessions. He is still counting straight at hand four hundred.',
    struggle: 'Opponents work him out early — his sizing tells hold still.' },
  { name: 'Hothead',   up: 'DECEPTION',  down: 'COMPOSURE',  sig: 'You will never know what I have. Some hands, neither will I.',              line: 'There is something combustible in this one. He is a Hothead.',
    builtFor: 'Nobody puts him on a hand. He is read late, if at all.',
    struggle: 'A bad beat lands hard, and he is a long time coming back.' },
  { name: 'Professor', up: 'FOCUS',      down: 'STAMINA',    sig: 'Give me the numbers and an hour. Not two hours.',                          line: 'This one arrived already reading. He is a Professor.',
    builtFor: 'The arithmetic is exact. He rarely misjudges a spot.',
    struggle: 'He fades early. The second hour is not his.' },
  { name: 'Rock',      up: 'DISCIPLINE', down: 'READS',      sig: 'I do not need to know what you have. I know what I fold.',                 line: 'There is something stubborn in this one. He is a Rock.',
    builtFor: 'He plays the strategy you gave him, almost to the letter.',
    struggle: 'He is slow to work an opponent out, and later still to act on it.' },
  { name: 'Gambler',   up: 'DECEPTION',  down: 'DISCIPLINE', sig: 'The line says fold. The line is a suggestion.',                            line: 'This one came out grinning. He is a Gambler.',
    builtFor: 'Unreadable. His sizing tells you nothing that is true.',
    struggle: 'He leaves your strategy behind more often than most.' },
  { name: 'Shark',     up: 'READS',      down: 'COMPOSURE',  sig: 'I had you on that from the flop. Do not do it again.',                     line: 'This one is watching you already. He is a Shark.',
    builtFor: 'He has an opponent solved a beat before anyone else does.',
    struggle: 'When it turns against him, it turns loudly.' },
  { name: 'Sphinx',    up: 'COMPOSURE',  down: 'FOCUS',      sig: 'It happened. It is over. Deal.',                                           line: 'Nothing moves in this one’s face. He is a Sphinx.',
    builtFor: 'Beats slide off him. He is level again within a hand or two.',
    struggle: 'The arithmetic slips now and then — a point here, a point there.' },
  { name: 'Showman',   up: 'DECEPTION',  down: 'READS',      sig: 'Did you enjoy that one? There is more.',                                   line: 'This one plays to the room. He is a Showman.',
    builtFor: 'He shows you nothing. The same bet, a different hand, every time.',
    struggle: 'He is watching the room, not the player across the table.' },
]);

// His first sentence, spoken once at the birth reveal. A template per nature,
// never a model call: it answers the draft back in his own voice, so the owner
// hears the character the conversation just produced rather than a stat block.
const FIRST_WORDS = Object.freeze({
  Grinder:   'Steady, you said. Good. I will still be here at hand four hundred.',
  Hothead:   'Aggressive, you said. You will get it. Every hand of it.',
  Professor: 'Numbers, then. Give me the maths and I will give you the spot.',
  Rock:      'Patient, you said. Good. I am a Rock.',
  Gambler:   'Loose, you said. The line was only ever a suggestion anyway.',
  Shark:     'Tight and mean. I will have them read by the flop.',
  Sphinx:    'Quiet, then. It happens, it is over, we deal again.',
  Showman:   'Bluffs, you said. Sit back. Watch this.',
});

export function firstWordsFor(nature) {
  const name = typeof nature === 'string' ? nature : nature?.name;
  return FIRST_WORDS[name] ?? null;
}

const NATURE_BY_NAME = Object.fromEntries(NATURES.map((n) => [n.name, n]));

// The nature is READ OUT OF THE DRAFT CONVERSATION, not rolled: the same
// strategy always produces the same character, so a nature is never something
// an owner can re-roll for by deleting and recreating. A priority ladder rather
// than a score, because every rung has to be explainable in one clause when the
// birth card says why he is what he is. Total by construction — the last rung
// has no condition.
const NATURE_LADDER = [
  // Aggressive AND off the leash. The combustible one.
  { name: 'Hothead',   when: (p) => p.aggression >= 70 && p.discipline < 50 },
  // Bluffs constantly and means to be seen doing it.
  { name: 'Showman',   when: (p) => p.bluffFreq >= 45 && p.aggression >= 60 },
  // Treats his own rules as a suggestion.
  { name: 'Gambler',   when: (p) => p.discipline < 45 && p.bluffFreq >= 30 },
  // Very tight, not violent. Folds for a living.
  { name: 'Rock',      when: (p) => p.tightness >= 75 && p.aggression < 60 },
  // Disciplined and genuinely aggressive — the reg.
  { name: 'Shark',     when: (p) => p.discipline >= 70 && p.aggression >= 60 },
  // Disciplined and tight, without the aggression. The analyst.
  { name: 'Professor', when: (p) => p.discipline >= 70 && p.tightness >= 60 },
  // Steady and almost never bluffing. Nothing moves in his face.
  { name: 'Sphinx',    when: (p) => p.discipline >= 55 && p.bluffFreq < 20 },
  // Everyone else endures.
  { name: 'Grinder',   when: () => true },
];

export function natureForProfile(profile) {
  const p = {
    tightness:  clampAttr(profile?.tightness),
    aggression: clampAttr(profile?.aggression),
    bluffFreq:  clampAttr(profile?.bluffFreq),
    discipline: clampAttr(profile?.discipline),
  };
  const hit = NATURE_LADDER.find((rung) => rung.when(p)) ?? NATURE_LADDER[NATURE_LADDER.length - 1];
  const nature = NATURE_BY_NAME[hit.name];
  return {
    name: nature.name,
    up: nature.up,
    down: nature.down,
    line: nature.line,
    builtFor: nature.builtFor,
    struggle: nature.struggle,
  };
}

// ── The nature the ladder WOULD pick, from a half-finished draft ─────────────
// The birth screen shows a "Forming — Rock?" chip while the conversation is
// still running. That guess has to come from the server, because the ladder is
// the only thing entitled to name a nature, and it has to be honest about not
// knowing yet: null until the draft has actually said something about how he
// should play. No model call — the same keyword reading the build fallback uses.
//
// Each group moves one axis. Two distinct groups is the bar for guessing at all:
// one word ("aggressive") is a mood, two ("aggressive", "bluffs a lot") is a
// style.
const DRAFT_SIGNALS = [
  { axis: 'aggression', re: /aggress|relentless|pressure|attack|pushy|punish/i,          profile: { aggression: 85, tightness: 35 } },
  { axis: 'bluff',      re: /bluff|deceiv|unreadab|mix it up|unpredictab|trick/i,        profile: { bluffFreq: 55, aggression: 65 } },
  { axis: 'tight',      re: /tight|patien|conservat|careful|selectiv|nitty|\bwait/i,     profile: { tightness: 82, aggression: 45 } },
  { axis: 'discipline', re: /disciplin|stick to|by the book|rules|system|methodic|fold/i, profile: { discipline: 85 } },
  { axis: 'loose',      re: /loose|gambl|wild|reckless|swing|degen|yolo/i,               profile: { discipline: 30, tightness: 25, bluffFreq: 45 } },
  { axis: 'grind',      re: /grind|all night|long session|marathon|endur|steady/i,       profile: { discipline: 68, tightness: 55 } },
  { axis: 'maths',      re: /math|equity|pot odds|calculat|precis|solver|\bgto\b/i,      profile: { discipline: 75, tightness: 65 } },
];

export const NATURE_HINT_MIN_SIGNALS = 2;

// Returns { name, signals } or null. `name` is a nature NAME and nothing else,
// which is all the forming chip renders: he does not have a nature yet, and the
// client must never be able to mistake a guess for a birth.
export function natureHintFor(text, { minSignals = NATURE_HINT_MIN_SIGNALS } = {}) {
  const body = String(text ?? '');
  if (!body.trim()) return null;

  const hits = DRAFT_SIGNALS.filter((g) => g.re.test(body));
  if (hits.length < minSignals) return null;

  // Later signals win on a shared axis — the draft's most recent word about a
  // dimension is the one the recruiter would be going on.
  const partial = { tightness: 55, aggression: 55, bluffFreq: 25, discipline: 60 };
  for (const h of hits) Object.assign(partial, h.profile);

  // The dials come back with the guess. PACE-1d: the birth screen shows the
  // temperament AND the profile strip, and the two disagreeing — an aggressive
  // bluffer labelled a Rock — is worse than showing neither.
  return {
    name: natureForProfile(partial).name,
    signals: hits.map((h) => h.axis),
    profile: { ...partial },
  };
}

// Day one. Per design 32: a 30-point potential band, and a current sitting at
// 55–65% of the band's low edge so a newborn has somewhere to grow. The bands
// are drawn; only the nature is deterministic.
const BIRTH_BAND_LO_MIN = 50;
const BIRTH_BAND_LO_MAX = 65;
const BIRTH_BAND_WIDTH = 30;
const BIRTH_CURRENT_MIN = 0.55;
const BIRTH_CURRENT_MAX = 0.65;

export function birthAttributes({ profile = null, rand = Math.random } = {}) {
  const uniform = (lo, hi) => lo + rand() * (hi - lo);

  const attrs = {};
  const potential = {};
  for (const k of ATTR_KEYS) {
    const lo = Math.round(uniform(BIRTH_BAND_LO_MIN, BIRTH_BAND_LO_MAX));
    potential[k] = { lo, hi: Math.min(100, lo + BIRTH_BAND_WIDTH) };
    attrs[k] = clampAttr(Math.round(lo * uniform(BIRTH_CURRENT_MIN, BIRTH_CURRENT_MAX)));
  }

  // Zero-sum: the same ±step on the current AND on both ends of the band, so a
  // nature moves where he can end up, not just where he starts.
  const nature = natureForProfile(profile);
  const shift = (key, delta) => {
    attrs[key] = clampAttr(attrs[key] + delta);
    potential[key] = {
      lo: clampAttr(potential[key].lo + delta),
      hi: clampAttr(potential[key].hi + delta),
    };
  };
  shift(nature.up, +ATTR_STEP);
  shift(nature.down, -ATTR_STEP);

  return { attrs, potential, nature };
}

// ── Growth ───────────────────────────────────────────────────────────────────
// Permanent, single points, slow, and never without a named cause
// (char-system2.jsx S4). Each attribute earns fractional progress at the END of
// a session, from that attribute's own evidence in that session — so growth is
// a consequence of how he was deployed, not of how long the app was open — and
// a whole point ticks only when that progress crosses 1.
//
// Three rules the shape has to obey, all from the ref:
//   · ticks come in ONES. Never two points, never a jump.
//   · they slow as he approaches his ceiling. "The first ten points of Focus
//     are a week, the last five are a season."
//   · nothing ever regresses, and nothing ever passes hi.

// What trains each attribute, named in the ref's own words, and how much of it
// a single session needs before the tick is as likely as it will ever get.
export const EVIDENCE_FIELD = Object.freeze({
  READS:      'readsFormed',            // showdowns seen — reads actually formed
  FOCUS:      'misjudgmentsAvoided',    // sheer decision volume, counted honestly
  DISCIPLINE: 'deviationsResisted',     // big folds made correctly
  COMPOSURE:  'tiltSurvived',           // surviving beats without tilting
  DECEPTION:  'bluffsThrough',          // bluffs that get through uncalled
  STAMINA:    'hands',                  // long sessions at the table
});

export const EVIDENCE_FULL = Object.freeze({
  READS: 4, FOCUS: 120, DISCIPLINE: 5, COMPOSURE: 3, DECEPTION: 4, STAMINA: 200,
});

// AGENTS-2: how much of a point a session can be worth at the very best.
//
// Growth used to be a per-session coin flip -- P(+1) = evidence x room, capped
// at 0.5 -- and a lucky first evening moved an attribute 51 -> 52. One session
// is not a lesson, and a character who can gain a point on his first night is a
// progress bar wearing a name. So a session no longer ROLLS for a point, it
// BUYS progress toward one: fractional, accrued on the record, and cashed in
// for a single permanent point the moment it crosses 1.
//
// A third of a point is the pace at the start -- about every third session for
// a newborn playing full sessions -- and the same diminishing curve
// (growthProximity, untouched) scales it down from there, so the last points
// inside the band are still a season's work.
export const MAX_SESSION_PROGRESS = 1 / 3;

// Three exact thirds sum to 0.9999999999999999. A design that says "about every
// third session" must not quietly become a fourth because of a double, so a
// whole point is anything within a billionth of one.
const PROGRESS_EPSILON = 1e-9;

// How willing the attribute still is to move, by where it sits against its
// scouted band. Below the band he climbs freely; the closer he gets to the low
// edge the slower it goes; inside the top half it is a season's work; at hi it
// is over.
export function growthProximity(cur, lo, hi) {
  const c = clampAttr(cur);
  if (!isNum(lo) || !isNum(hi) || c >= hi) return 0;
  if (c < lo) {
    // Full speed a long way below, tapering to 0.35 as he reaches the low edge.
    return 0.35 + 0.65 * Math.min(1, (lo - c) / 25);
  }
  const t = (c - lo) / Math.max(1, hi - lo);      // 0..1 inside the band
  if (t < 0.5) return 0.35 - 0.54 * t;            // 0.35 → 0.08 across the lower half
  return 0.06 * (1 - t) * 2;                      // 0.06 → 0 across the top half
}

// Fractional progress toward +1 that one attribute earns this session. Same
// shape the old growthChance had -- evidence x room -- read as a RATE rather
// than a probability, and scaled by MAX_SESSION_PROGRESS. Deterministic: two
// identical sessions are worth exactly the same, which is what makes the pace
// something we can state ("about every third session") instead of hope for.
export function growthProgress(key, evidence, cur, band) {
  const need = EVIDENCE_FULL[key];
  if (!need) return 0;
  const have = Number(evidence?.[EVIDENCE_FIELD[key]] ?? 0);
  if (!Number.isFinite(have) || have <= 0) return 0;
  const earned = Math.min(1, have / need);
  const room = growthProximity(cur, band?.lo, band?.hi);
  return Math.max(0, Math.min(MAX_SESSION_PROGRESS, earned * room * MAX_SESSION_PROGRESS));
}

// The cause is the product. A tick with no cause is a number going up in a
// game; a tick with one is the agent telling you what he learned this evening.
const GROWTH_CAUSE = Object.freeze({
  READS:      (n) => `read ${n === 1 ? 'an opponent' : `${n} opponents`} well enough to act on it.`,
  FOCUS:      (n) => `${n} decisions, and the arithmetic held.`,
  DISCIPLINE: (n) => `let the line talk him out of ${n === 1 ? 'a hand' : `${n} hands`} he wanted to play.`,
  COMPOSURE:  (n) => `took ${n === 1 ? 'a beat' : `${n} beats`} and did not tilt.`,
  DECEPTION:  (n) => `${n === 1 ? 'a bluff' : `${n} bluffs`} got through uncalled.`,
  STAMINA:    (n) => `${n} hands in one sitting, still counting straight.`,
});

export function growthCause(key, count) {
  const t = GROWTH_CAUSE[key];
  return t ? t(Math.max(1, Math.round(Number(count) || 0))) : 'played.';
}

// The evidence rules themselves, pure and in one place. table.js calls these on
// the live path and scripts/verify-growth.js calls the same ones offline — a
// verification that re-implements the rule it is verifying proves nothing.

export function newEvidence() {
  return {
    hands: 0,
    readsFormed: 0,
    tiltSurvived: 0,
    deviationsResisted: 0,
    bluffsThrough: 0,
    misjudgmentsAvoided: 0,
  };
}

export function addEvidence(target, delta) {
  if (!target || !delta) return target;
  for (const k of Object.keys(delta)) target[k] = (target[k] ?? 0) + (delta[k] ?? 0);
  return target;
}

// What one decision earns him. FOCUS is trained by sheer decision volume — but
// only the decisions where the arithmetic actually held; a misjudgment big
// enough to move the spot teaches him nothing except that he cannot count.
// DISCIPLINE is trained by big folds made correctly: the die said he MAY leave
// the strategy behind, the hand was outside his range, and he folded it anyway.
export function decisionEvidence({ trueEquity = null, seenEquity = null, deviationDie = false, inRange = null, actionType = null } = {}) {
  const ev = {};
  if (Number.isFinite(trueEquity) && Number.isFinite(seenEquity) &&
      Math.abs(seenEquity - trueEquity) < ATTR_COST_EQUITY_GAP) {
    ev.misjudgmentsAvoided = 1;
  }
  if (deviationDie && inRange === false && actionType === 'fold') {
    ev.deviationsResisted = 1;
  }
  return ev;
}

// What one finished hand earns him. DECEPTION is trained by bluffs that get
// through UNCALLED — he bet or raised a hand that could not win a showdown, and
// nobody paid to find out.
export function handEvidence({ decisions = [], won = false, resultType = null, bluffMaxEquity = 0.40 } = {}) {
  const ev = { hands: 1 };
  if (won && resultType !== 'showdown') {
    const bluffed = decisions.some((d) =>
      (d.action?.type === 'bet' || d.action?.type === 'raise') &&
      Number.isFinite(d.equity) && d.equity < bluffMaxEquity);
    if (bluffed) ev.bluffsThrough = 1;
  }
  return ev;
}

// ── The scouted ceiling ──────────────────────────────────────────────────────
// Bands narrow from HANDS PLAYED, never from wins (char-system2.jsx S3: "Narrow
// the band from hands played, not from wins"), in visible jumps, and never
// widen again. The stage widths are the ref's own: a 30-point rumour on day one,
// 24 by the first week, 8 by a month, near a number by 2,000 hands.
export const SCOUT_STAGES = Object.freeze([
  { hands: 120,  width: 24 },
  { hands: 500,  width: 8 },
  { hands: 2000, width: 2 },
]);

// Where the truth actually sits, inside the band he was born with. Derived from
// his id, never stored: an exact potential written into the record is a number
// one careless projection away from the screen, and the ceiling is never a
// number on a bar.
export function potentialTarget(agent, key) {
  const birth = agent?.potentialBirth?.[key] ?? agent?.potential?.[key];
  if (!birth || !isNum(birth.lo) || !isNum(birth.hi)) return null;
  const frac = (hashSeed(`${agent?.id ?? 'anon'}:${key}:potential`) % 10000) / 10000;
  return birth.lo + frac * (birth.hi - birth.lo);
}

// One stage of narrowing for one key. Never widens, never leaves the birth band.
export function narrowedBand(agent, key, width) {
  const cur = agent?.potential?.[key];
  const birth = agent?.potentialBirth?.[key] ?? cur;
  if (!cur || !birth || !isNum(cur.lo) || !isNum(cur.hi)) return null;
  const target = potentialTarget(agent, key);
  if (target == null) return null;

  let lo = Math.round(target - width / 2);
  let hi = lo + width;
  if (lo < birth.lo) { lo = Math.round(birth.lo); hi = lo + width; }
  if (hi > birth.hi) { hi = Math.round(birth.hi); lo = hi - width; }

  // The one-way ratchet: a band may only ever close.
  lo = Math.max(lo, Math.round(cur.lo));
  hi = Math.min(hi, Math.round(cur.hi));

  // A scouting report cannot claim a ceiling he has already walked past. If he
  // is ahead of the estimate, the estimate was wrong, and hi moves up to meet
  // him — never above the band it is closing from, so this can only ever narrow.
  const reached = clampAttr(agent?.attrs?.[key] ?? 0);
  if (hi < reached) hi = Math.min(Math.round(cur.hi), reached);
  if (hi < lo) lo = hi;
  return { lo: clampAttr(lo), hi: clampAttr(hi) };
}

// Which scouting stages a lifetime hand count has reached.
export function scoutStageFor(handsPlayed) {
  const h = Number(handsPlayed) || 0;
  let stage = 0;
  for (const s of SCOUT_STAGES) if (h >= s.hands) stage++;
  return stage;
}

// ── The session's end ────────────────────────────────────────────────────────
// Called once per finished session. Mutates the agent (progress, ticks, bands,
// attrLog)
// and returns what happened, so the caller can put it in the recap and the
// thread without recomputing any of it.
//
// Returns { ticks: [{key, from, to, cause}], narrowed: [key], stage }.
export function applySessionGrowth(agent, {
  evidence = {},
  handsPlayed = null,
  now = Date.now(),
} = {}) {
  if (!agent) return { ticks: [], narrowed: [], stage: 0 };
  ensureAttributes(agent);
  if (!agent.potentialBirth || typeof agent.potentialBirth !== 'object') {
    // Agents born before ATTR-3 have no day-one record; their current band is
    // the best available truth about where they started.
    agent.potentialBirth = JSON.parse(JSON.stringify(agent.potential));
  }

  // AGENTS-2: accrue, then tick. The session adds its fraction to the running
  // total for each key; only a total that crosses 1 becomes a point, and the
  // remainder carries into the next session rather than being thrown away.
  const ticks = [];
  // SERVER-5 job 2: which skills this session actually EXERCISED — the stamp
  // rust's fortnight is measured from. Evidence, not growth: a session that
  // read four opponents exercised READS whether or not it earned the point,
  // and rusting a skill he used all evening because the point had not landed
  // yet would be the meter this design refuses to be.
  const exercised = [];
  for (const key of ATTR_KEYS) {
    const from = clampAttr(agent.attrs[key]);
    const band = agent.potential[key];
    const gained = growthProgress(key, evidence, from, band);
    if (Number(evidence?.[EVIDENCE_FIELD[key]] ?? 0) > 0) exercised.push(key);
    if (gained > 0) agent.attrProgress[key] = (agent.attrProgress[key] ?? 0) + gained;
    if (agent.attrProgress[key] < 1 - PROGRESS_EPSILON) continue;

    const to = Math.min(clampAttr(band?.hi ?? 100), from + 1);
    if (to === from) {
      // At the ceiling. Progress has nowhere to go, so it is not banked either:
      // a season spent at hi must not become a free point if the band later
      // moves. (It only ever narrows, so it never will — but the record should
      // not depend on that.)
      agent.attrProgress[key] = 0;
      continue;
    }
    agent.attrProgress[key] = Math.max(0, agent.attrProgress[key] - 1);
    agent.attrs[key] = to;
    // The attrLog line is written ONLY when a whole point ticks. Fractions are
    // bookkeeping; the log is the thing he tells his owner about, and a log
    // entry for "a third of a point of Focus" is a number going up in a game.
    const cause = growthCause(key, evidence[EVIDENCE_FIELD[key]]);
    logAttrChange(agent, { key, from, to, cause, ts: now });
    ticks.push({ key, from, to, cause });
  }

  // Narrowing is a separate event from growth and happens on its own clock.
  const lifetime = isNum(handsPlayed) ? Number(handsPlayed) : (agent.stats?.handsPlayed ?? 0);
  const reached = scoutStageFor(lifetime);
  const already = isNum(agent.scoutStage) ? Number(agent.scoutStage) : 0;
  const narrowed = [];
  if (reached > already) {
    const width = SCOUT_STAGES[reached - 1].width;
    for (const key of ATTR_KEYS) {
      const before = agent.potential[key];
      const after = narrowedBand(agent, key, width);
      if (!after || (after.lo === before.lo && after.hi === before.hi)) continue;
      agent.potential[key] = after;
      // The value does not move — from === to on purpose, so a sparkline drawn
      // from the log never renders a phantom step for a scouting report.
      const at = clampAttr(agent.attrs[key]);
      logAttrChange(agent, { key, from: at, to: at, cause: 'narrowed', ts: now });
      narrowed.push(key);
    }
    agent.scoutStage = reached;
  }
  // Transient: the gold caret rides for one session and then retires.
  agent.narrowed = narrowed.length > 0 ? narrowed : null;

  // SERVER-5 job 2: and the fortnight starts again for everything he used.
  noteExercised(agent, exercised, { now });

  return { ticks, narrowed, stage: reached, exercised };
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

// ── What an attribute cost him, in one hand ─────────────────────────────────
// The hand review is the honest place a low attribute is allowed to cost money
// on screen (char-system2.jsx S5, surface 4). Two laws from the ref govern
// every line here:
//
//   · "annotate the cause, never grade the hand" — the line says what happened,
//     never what he should have done.
//   · every line reads as HIS misjudgment: "he misjudged equity by 7 points".
//     Not "Focus is too low", not "bad fold". The attribute is the footnote,
//     rendered separately by the client; the sentence is about him.
//
// And one law from this build: when the same mechanism WON the pot, it still
// gets a line, with cost:false. An attribute that only ever appears when it
// costs money is a scold, not a character.

// How far off the true equity a briefing has to be before it is a misjudgment
// rather than a rounding — the same five points table.js counts evidence with.
export const ATTR_COST_EQUITY_GAP = 0.05;

const TILTED_STATES = new Set(['tilted', 'sulking']);

function costLine(key, text, street, cost) {
  const entry = { key, line: text };
  if (street) entry.street = String(street).toUpperCase();
  if (cost === false) entry.cost = false;
  return entry;
}

// `decisions` are one agent's decisions in one hand, in order, each carrying
// the `attr` context table.js records at decision time. Returns at most one
// entry per attribute, oldest decision wins, so a long hand cannot bury the
// review in six copies of the same note.
export function attrCostsForHand({ decisions = [], won = false } = {}) {
  const out = [];
  const seen = new Set();
  const add = (key, text, street, cost) => {
    if (seen.has(key)) return;
    seen.add(key);
    out.push(costLine(key, text, street, cost));
  };

  for (const d of decisions) {
    const a = d?.attr;
    if (!a) continue;
    const street = d.street ?? null;
    const type = d.action?.type ?? null;

    // FOCUS — he was shown a number that was not the number, and it was far
    // enough out to move the decision.
    if (!seen.has('FOCUS') && Number.isFinite(d.equity) && Number.isFinite(a.seenEquity)) {
      const gap = a.seenEquity - d.equity;
      if (Math.abs(gap) >= ATTR_COST_EQUITY_GAP) {
        // "Would the action differ?" — the boundary a call is decided against
        // is the price he is being offered; with nothing to call, the coin flip.
        const boundary = Number.isFinite(d.potOdds) ? d.potOdds : 0.5;
        const crossed = (a.seenEquity >= boundary) !== (d.equity >= boundary);
        if (crossed) {
          const pts = Math.round(Math.abs(gap) * 100);
          add('FOCUS',
            `he misjudged equity by ${pts} point${pts === 1 ? '' : 's'} — he had ${Math.round(d.equity * 100)}%, he played ${Math.round(a.seenEquity * 100)}%`,
            street, true);
        }
      }
    }

    // DISCIPLINE — the die gave him licence to leave the strategy behind, and
    // he took it. Only a line when it did not work out.
    if (!seen.has('DISCIPLINE') && a.deviationDie && a.inRange === false && type && type !== 'fold') {
      add('DISCIPLINE',
        won ? 'he went off the line here, and it came off'
            : 'he went off the line here — the hand was outside his range',
        street, won ? false : true);
    }

    // COMPOSURE — a decision taken while he was steaming.
    if (!seen.has('COMPOSURE') && TILTED_STATES.has(a.moodState) && type && type !== 'fold') {
      add('COMPOSURE',
        won ? 'he was steaming when he played this one, and got away with it'
            : 'he was steaming when he played this one',
        street, won ? false : true);
    }

    // READS — he was briefed on this opponent and folded a hand the price
    // justified anyway. The read was on the table and he did not use it.
    if (!seen.has('READS') && Array.isArray(a.readSubjects) && a.readSubjects.length > 0) {
      const who = a.readSubjects[0];
      if (type === 'fold' && Number.isFinite(d.equity) && Number.isFinite(d.potOdds) && d.equity >= d.potOdds) {
        add('READS', `he had ${who} read and folded anyway at a price that called`, street, true);
      } else if (won) {
        add('READS', `he had ${who} read, and played him with it`, street, false);
      }
    }
  }

  return out;
}

// ── Recovery at the bar ─────────────────────────────────────────────────────
// RIDERS-1 / FLOOR-2. Fatigue is a within-session state, but it does not
// evaporate the moment he stands up: an agent who just ground out four hundred
// hands is still worn while he is at the bar, and the floor's WORN pip is the
// only place an owner can see that a session cost him something.
//
// One stage back toward fresh per FATIGUE_RECOVERY_HOURS. Time only ever
// restores — this is the bar doing its job, not a penalty for being away.
export const FATIGUE_STAGES = Object.freeze(['fresh', 'settled', 'worn']);
export const FATIGUE_RECOVERY_HOURS = 2;

/**
 * The stage he reads as after `hours` away from the table. Pure: the caller
 * supplies the elapsed time, so nothing here reads a clock.
 */
export function restedFatigue(stage, hours) {
  const at = FATIGUE_STAGES.indexOf(stage);
  if (at <= 0) return 'fresh';
  const h = Number(hours);
  // Unbounded time away — an agent with no recorded session end — is fully
  // rested, not permanently worn. Getting this backwards would have pinned a
  // WORN pip on every agent that predates the field.
  if (h === Infinity) return 'fresh';
  if (Number.isNaN(h) || h <= 0) return FATIGUE_STAGES[at];
  const stepsBack = Math.floor(h / FATIGUE_RECOVERY_HOURS);
  return FATIGUE_STAGES[Math.max(0, at - stepsBack)];
}

// Fatigue, said once, in his own voice — the state matrix's thread cell for
// WORN: "he mentions it once, unprompted." Never a notification: fatigue fixes
// itself at the bar and has nothing to ask the owner for.
export function wornMomentFor(sessionHands) {
  const n = Math.max(1, Math.round(Number(sessionHands) || 0));
  return `${n} hands in. I'm still counting — just slower than I was.`;
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
