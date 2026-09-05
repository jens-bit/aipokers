// src/agent/mood.js
// Mood state machine for personality-layer agents.
//
// The design law (CORE_GAME_PLAN.md §Mood economy) governs everything here:
// every mood effect must be (1) VISIBLE, (2) BOUNDED — shifts dice/sizing
// slightly, never lobotomizes, (3) COUNTERABLE through play. Tilt-resistance
// is a TRAIT of the profile (there is no user-facing tilt slider): stoic
// grinders barely tilt; loose maniacs tilt hard.
//
// State scale: sulking (worst) → tilted → frustrated → neutral → confident.
//
// MOOD-2: the five states are now BANDS ON A NUMBER rather than a ladder of
// their own. Every mood carries `heat` 0–100 and the state is read off it, so
// two tilted agents are no longer the same agent: one at 62 is annoyed and one
// at 94 is a different player to sit down against, and the difference is
// visible on the floor, in his voice, and in what he says at the table.
//
// Why a number and not more states: five states is already as many as a person
// can read off a ghost at 40px. Heat gives the system somewhere to put the
// intensity without asking the owner to learn a sixth word.
//
// Everything here still obeys the Mood Design Law: every effect VISIBLE,
// BOUNDED, and COUNTERABLE through play. And one law this file now enforces
// mechanically — HEAT ONLY EVER MOVES ON A POKER EVENT OR AN OWNER MESSAGE.
// Not on silence, not on time away, not on an unopened review. There is no
// guilt machinery in this product and this is the file where it would live.

import { normalizeProfile } from './policy.js';
import { composureTiltBonus, composureDecayHands } from './attributes.js';

export const MOOD_STATES = Object.freeze(['sulking', 'tilted', 'frustrated', 'neutral', 'confident']);
const NEUTRAL_INDEX = MOOD_STATES.indexOf('neutral');

// ── Heat ────────────────────────────────────────────────────────────────────
// 0 is a player who cannot be rattled today; 100 is one who has stopped
// playing poker and started arguing with the deck.
export const HEAT_MIN = 0;
export const HEAT_MAX = 100;

// The bands. Read as: heat at or below `upTo` is this state.
export const HEAT_BANDS = Object.freeze([
  { state: 'confident',  upTo: 20 },
  { state: 'neutral',    upTo: 40 },
  { state: 'frustrated', upTo: 60 },
  { state: 'tilted',     upTo: 100 },
]);

// Where a state sits when all we know is its name — the midpoint of its band.
// This is what a pre-MOOD-2 record is backfilled to, so an agent that was
// stored as 'tilted' wakes up tilted rather than reset.
export const HEAT_MIDPOINT = Object.freeze({
  confident: 10, neutral: 30, frustrated: 50, tilted: 70, sulking: 85,
});

// Sulking is not its own band: it is tilt that has stopped believing the next
// hand will be different. That takes a run of losses, not one beat.
export const SULK_LOSING_RUN = 3;

export function clampHeat(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return HEAT_MIDPOINT.neutral;
  return Math.max(HEAT_MIN, Math.min(HEAT_MAX, Math.round(n)));
}

/** The state a given heat reads as. `losingRun` is what separates sulk from tilt. */
export function stateForHeat(heat, { losingRun = 0 } = {}) {
  const h = clampHeat(heat);
  const band = HEAT_BANDS.find((b) => h <= b.upTo) ?? HEAT_BANDS[HEAT_BANDS.length - 1];
  if (band.state === 'tilted' && (Number(losingRun) || 0) >= SULK_LOSING_RUN) return 'sulking';
  return band.state;
}

/** The heat a bare state name implies. Backwards compatibility, and nothing else. */
export function heatForState(state) {
  return HEAT_MIDPOINT[state] ?? HEAT_MIDPOINT.neutral;
}

// What each event does to the heat, before COMPOSURE scales it. Positive
// numbers heat him up. These are the whole dial: everything downstream reads
// heat, so tuning the product's temperament happens here and nowhere else.
export const HEAT_EVENTS = Object.freeze({
  lostAsEquityFavorite: +22,   // the one that actually stings
  sessionLossStreak:    +18,
  lostBigPot:           +16,
  cooler:               +14,   // second best hand, nobody's fault
  needled:              +12,
  cardDead:             +10,
  wonBigPot:            -20,
  sessionWinStreak:     -16,
});

// A run of negative events with no win in between. Reset by anything good.
const LOSING_EVENTS = new Set(['lostAsEquityFavorite', 'sessionLossStreak', 'lostBigPot', 'cooler']);
const COOLING_EVENTS = new Set(['wonBigPot', 'sessionWinStreak']);

// One deliberate nudge from the owner, in either direction. The ceiling on what
// a single message may do — see applyOwnerMessage.
export const HEAT_STEP = 15;

// Uneventful hands cool him. Not time away, not the app being closed — hands.
export const HEAT_DECAY_PER_HAND = 2;

// Time at the bar between sessions. The bar is the only thing that is allowed
// to work while nobody is looking, and it only ever cools.
export const HEAT_REST_PER_HOUR = 10;

/**
 * How hard events land, both directions, from the same tilt-resistance trait
 * the ordinal machine used. A stoic takes less heat from a beat AND sheds it
 * faster; a volatile agent takes the full weight and holds it.
 */
export function heatScales(profile, { composure = null } = {}) {
  const r = tiltResistance(profile, { composure }) / 100;
  return {
    heating: 1 - 0.75 * r,      // 1.00 at resistance 0 → 0.25 at 100
    cooling: 0.5 + 0.75 * r,    // 0.50 at resistance 0 → 1.25 at 100
  };
}

// Deltas applied to the mood ordinal. Positive events move toward confident;
// negative events move toward sulking. The magnitude is scaled by tilt
// resistance (see `applyEvent`).
export const EVENT_DELTAS = Object.freeze({
  wonBigPot:              +1,
  lostAsEquityFavorite:   -1,
  lostBigPot:             -1,
  cardDead:               -1,
  sessionWinStreak:       +1,
  sessionLossStreak:      -1,
  needled:                -1,   // TLK-1: opponent table talk got under the skin
});

const CAUSE_TEMPLATES = Object.freeze({
  wonBigPot:            (ctx) => `won a ${ctx.potChips ?? '?'}-chip pot`,
  lostAsEquityFavorite: (ctx) => ctx.equityPct ? `lost as the ~${ctx.equityPct}% favorite` : 'lost as the equity favorite',
  lostBigPot:           (ctx) => `lost a ${ctx.potChips ?? '?'}-chip pot`,
  cardDead:             (ctx) => `card-dead ${ctx.foldsInARow ?? 6}+ hands`,
  sessionWinStreak:     (ctx) => `${ctx.streak ?? 3}-hand win streak`,
  sessionLossStreak:    (ctx) => `${ctx.streak ?? 3}-hand losing streak`,
  needled:              () => 'needled by opponent table talk',
});

// Decay: after this many consecutive uneventful hands, mood drifts one step
// toward neutral. Kept modest so mood doesn't reset instantly.
export const DECAY_HANDS = 4;

// Bounded per-decision effect ranges (kept small by design — the mood
// changes flavor, never quality).
export const DEVIATION_NUDGE = Object.freeze({
  confident:  -0.05, // more likely to stick to script
  neutral:     0.00,
  frustrated: +0.08,
  tilted:     +0.15,
  sulking:    -0.05, // shuts down, becomes rote
});
export const SIZING_NUDGE = Object.freeze({
  confident:  0.00,
  neutral:    0.00,
  frustrated: 0.00,
  tilted:    +0.10, // opens slightly larger
  sulking:   -0.10, // opens slightly smaller
});

// tiltResistance ∈ [0..100] — a TRAIT derived from the profile, no slider.
// High discipline + tightness = stoic; high aggression + low discipline = volatile.
// ATTR-1 hook — COMPOSURE shifts the trait by up to ±20 points: how hard a bad
// beat lands. Absent (or ATTRIBUTE_IMPACT 0) it contributes exactly 0, which
// is the pre-attribute expression.
export function tiltResistance(profile, { composure = null } = {}) {
  const p = normalizeProfile(profile);
  // Center around ~50 for a neutral profile; pushed up by discipline+tightness,
  // pulled down by aggression.
  const raw = p.discipline * 0.55 + p.tightness * 0.30 - p.aggression * 0.30 + 30
            + composureTiltBonus(composure);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function moodIndex(state) {
  const i = MOOD_STATES.indexOf(state);
  return i < 0 ? NEUTRAL_INDEX : i;
}

function clampIndex(i) {
  return Math.max(0, Math.min(MOOD_STATES.length - 1, i));
}

// Neutral, no cause — the starting shape for a fresh agent.
export function initialMood() {
  return {
    state: 'neutral',
    heat: HEAT_MIDPOINT.neutral,
    cause: null,
    updatedAt: null,
    uneventfulHands: 0,
    winStreak: 0,
    lossStreak: 0,
    losingRun: 0,        // MOOD-2: negatives since the last good thing
    cardDeadCount: 0,
    pepTalkAtHand: null,
  };
}

// Idempotent backfill mirroring the existing ensure* pattern in agentProfiles.js.
export function ensureMood(agent) {
  if (!agent) return;
  if (!agent.mood || typeof agent.mood !== 'object') {
    agent.mood = initialMood();
    return;
  }
  const defaults = initialMood();
  for (const key of Object.keys(defaults)) {
    // `heat` is filled in below from the STORED STATE, not from the neutral
    // default — a record written before heat existed must wake up in the band
    // it was saved in, and the generic backfill would flatten every one of them
    // to neutral on the first read after the upgrade.
    if (key === 'heat') continue;
    if (agent.mood[key] === undefined) agent.mood[key] = defaults[key];
  }
  if (!MOOD_STATES.includes(agent.mood.state)) agent.mood.state = 'neutral';
  // MOOD-2: a record written before heat existed knows only its state. It gets
  // the midpoint of that state's band, so an agent stored as tilted wakes up
  // tilted rather than reset to neutral by an upgrade.
  if (!Number.isFinite(agent.mood.heat)) agent.mood.heat = heatForState(agent.mood.state);
  else agent.mood.heat = clampHeat(agent.mood.heat);
}

// Apply one poker event to the mood. Pure; callers persist.
//
// MOOD-2 changed the mechanism here. It used to be a dice roll: tilt resistance
// blocked the whole move some fraction of the time, so a stoic agent's mood
// either moved a full step or did not move at all. Now the event always lands
// and resistance scales HOW HARD — which is both what a person experiences and
// the only version that gives heat anything to mean. The trait law is
// unchanged and still tested: a stoic takes less from the same beat.
export function applyEvent(currentMood, event, profile, { context = {}, composure = null } = {}) {
  const weight = HEAT_EVENTS[event];
  if (weight === undefined) return currentMood;

  const scales = heatScales(profile, { composure });
  const delta = weight >= 0 ? weight * scales.heating : weight * scales.cooling;

  const before = Number.isFinite(currentMood?.heat) ? currentMood.heat : heatForState(currentMood?.state);
  const heat = clampHeat(before + delta);

  // The run that separates sulking from tilt: a loss with no win since.
  let losingRun = Number(currentMood?.losingRun) || 0;
  if (LOSING_EVENTS.has(event)) losingRun += 1;
  else if (COOLING_EVENTS.has(event)) losingRun = 0;

  return {
    ...currentMood,
    heat,
    losingRun,
    state: stateForHeat(heat, { losingRun }),
    cause: makeCause(event, context),
    updatedAt: Date.now(),
    uneventfulHands: 0,
  };
}

// One step toward neutral. Bumps uneventfulHands otherwise. Callers only
// invoke this when NO event fired this hand.
// ATTR-1 hook — COMPOSURE is also RECOVERY: how many uneventful hands he needs
// to come back. 6 hands at attribute 0, DECAY_HANDS at 50, 2 at 100.
export function tickDecay(currentMood, { composure = null } = {}) {
  const next = { ...currentMood };
  next.uneventfulHands = (next.uneventfulHands ?? 0) + 1;

  const before = Number.isFinite(next.heat) ? next.heat : heatForState(next.state);
  const target = HEAT_MIDPOINT.neutral;
  if (before === target) return next;

  // MOOD-2: cooling is continuous now rather than a band-step every N hands,
  // because heat between the bands is the whole point. COMPOSURE still sets the
  // RATE through the same hook: an agent who needs 2 uneventful hands to settle
  // cools twice as fast as one who needs 4.
  const rate = HEAT_DECAY_PER_HAND * (DECAY_HANDS / composureDecayHands(composure, DECAY_HANDS));
  const step = Math.min(rate, Math.abs(before - target));
  const heat = clampHeat(before + (before > target ? -step : step));

  // Drifting back toward level is also drifting out of a losing run: a hand
  // that passes without incident is evidence the run is over.
  const losingRun = heat <= HEAT_BANDS[1].upTo ? 0 : (Number(next.losingRun) || 0);

  next.heat = heat;
  next.losingRun = losingRun;
  const state = stateForHeat(heat, { losingRun });
  if (state !== next.state) {
    next.state = state;
    next.cause = state === 'neutral' ? 'settled down' : 'drifting toward neutral';
  }
  next.updatedAt = Date.now();
  return next;
}

/**
 * Time at the bar. The ONLY thing in this file that works while nobody is
 * looking, and it only ever cools — an agent left alone comes back level, never
 * resentful. `hours` is elapsed time between sessions and must be supplied by
 * the caller: nothing here reads a clock, so no code path can quietly turn
 * absence into a mood.
 */
export function restAtBar(currentMood, { hours = 0, composure = null, profile = null } = {}) {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return currentMood;

  const before = Number.isFinite(currentMood?.heat) ? currentMood.heat : heatForState(currentMood?.state);
  const target = HEAT_MIDPOINT.neutral;
  if (before <= target) return currentMood;

  const cooling = profile ? heatScales(profile, { composure }).cooling : 1;
  const step = Math.min(HEAT_REST_PER_HOUR * h * cooling, before - target);
  const heat = clampHeat(before - step);
  const losingRun = heat <= HEAT_BANDS[1].upTo ? 0 : (Number(currentMood?.losingRun) || 0);

  return {
    ...currentMood,
    heat,
    losingRun,
    state: stateForHeat(heat, { losingRun }),
    cause: heat === target ? 'rested at the bar' : (currentMood?.cause ?? null),
    updatedAt: Date.now(),
  };
}

// Move one step toward neutral in response to a pep talk. Returns the new
// mood + a `soothed` flag. `handsPlayed` is the agent's current handsPlayed
// counter; used to enforce the 10-hand cooldown.
export const PEP_TALK_COOLDOWN_HANDS = 10;
export function applyPepTalk(currentMood, handsPlayed) {
  if (!currentMood || currentMood.state === 'neutral' || currentMood.state === 'confident') {
    return { mood: currentMood, soothed: false, reason: 'no soothing needed' };
  }
  const last = currentMood.pepTalkAtHand;
  if (Number.isFinite(last) && handsPlayed - last < PEP_TALK_COOLDOWN_HANDS) {
    return { mood: currentMood, soothed: false, reason: 'cooldown' };
  }
  const before = Number.isFinite(currentMood.heat) ? currentMood.heat : heatForState(currentMood.state);
  const heat = clampHeat(Math.max(HEAT_MIDPOINT.neutral, before - HEAT_STEP));
  const losingRun = heat <= HEAT_BANDS[1].upTo ? 0 : (Number(currentMood.losingRun) || 0);
  return {
    mood: {
      ...currentMood,
      heat,
      losingRun,
      state: stateForHeat(heat, { losingRun }),
      cause: 'pep talk from owner',
      updatedAt: Date.now(),
      uneventfulHands: 0,
      pepTalkAtHand: handsPlayed,
    },
    soothed: true,
    reason: 'ok',
  };
}

// ── Heat, in words ──────────────────────────────────────────────────────────
// One vocabulary, used by the thread, the briefing and the felt, so a 92 reads
// the same way everywhere. Bands are not enough on their own: "tilted" covers
// a player who is annoyed and a player who has stopped playing poker, and the
// two should not get the same sentence.

export const HEAT_WORDS = Object.freeze([
  { upTo: 10,  word: 'ice cold',  tone: 'quiet, certain, nothing to prove' },
  { upTo: 20,  word: 'running well', tone: 'warm and a little pleased with yourself' },
  { upTo: 40,  word: 'level',     tone: 'even and matter of fact' },
  { upTo: 55,  word: 'irritated', tone: 'clipped, a shade impatient' },
  { upTo: 60,  word: 'simmering', tone: 'short sentences, less patience, no jokes' },
  { upTo: 80,  word: 'tilted',    tone: 'blunt and unhappy; you are not hiding it' },
  { upTo: 100, word: 'boiling',   tone: 'barely civil, five words at a time, do not pretend to be fine' },
]);

export function heatWord(heat) {
  const h = clampHeat(heat);
  return (HEAT_WORDS.find((w) => h <= w.upTo) ?? HEAT_WORDS[HEAT_WORDS.length - 1]);
}

/**
 * The one line that goes into a prompt. Present for every mood including a
 * level one, because "level" is information too — the old code sent nothing at
 * neutral and the model filled the silence with a customer-service voice.
 */
export function moodPromptLine(mood) {
  const state = mood?.state ?? 'neutral';
  const heat = Number.isFinite(mood?.heat) ? mood.heat : heatForState(state);
  const w = heatWord(heat);
  const because = mood?.cause ? ` after ${mood.cause}` : '';
  const shut = state === 'sulking' ? ' You have stopped expecting it to turn around.' : '';
  return `STATE: ${state}, heat ${heat}/100 — ${w.word}${because}. Voice: ${w.tone}.${shut}`;
}

// ── Susceptibility: what the owner says ─────────────────────────────────────
// MOOD-2b. The thread is not a support line; it is a person talking to a poker
// player about poker. Being told he punted lands, and being asked what he was
// holding lands the other way.
//
// Three rules bound the whole mechanism:
//
//   1. A MESSAGE IS REQUIRED. Nothing in here can be reached by silence, by an
//      unopened review, or by time. There is no state in this product that
//      says "the owner has not spoken to him in three days" and there never
//      will be — that is guilt machinery, and this file is where it would go.
//   2. AT MOST HEAT_STEP (15) EITHER WAY, once per PEP_TALK_COOLDOWN_HANDS.
//      An owner cannot type an agent into tilt, and cannot type him out of it
//      either: the cooldown is the same one the pep talk has always had.
//   3. COUNTERABLE THROUGH PLAY. Fifteen points is one good pot. Whatever the
//      owner says, the table says more.
//
// Classification is a lexicon, not a model call: deterministic, free, and
// inspectable. An insult that also asks a question is still an insult.

const NEEDLE_PATTERNS = [
  /\b(idiot|moron|stupid|dumb|useless|pathetic|embarrassing|clown|joke)\b/i,
  /\b(terrible|awful|garbage|trash|rubbish|dreadful|abysmal|worst)\b/i,
  /\b(punt(ed|ing)?|spew(ed|ing)?|donk(ed)?|fish|nit|coward|chicken)\b/i,
  /\b(chok(e|ed|ing)|bottled|blew it|threw it away|gave it away)\b/i,
  /\b(you suck|sucks|hate (you|this)|disappoint(ed|ing)|useless)\b/i,
  /\bwhat (were|was) you (thinking|doing)\b/i,
  /\bhow could you\b/i,
  /\b(seriously|again)\s*[?!]/i,
  /\bwtf\b/i,
];

const CARE_PATTERNS = [
  /\b(nice|great|good|lovely|excellent|brilliant)\s+(hand|call|fold|read|play|one|work|job)\b/i,
  /\bwell played\b/i,
  /\b(proud|impressed|liked that|love(d)? that)\b/i,
  /\b(unlucky|bad beat|nothing you could do|not your fault|no ones fault|no one's fault)\b/i,
  /\b(keep going|chin up|shake it off|forget it|next one|chalk it up|no worries|it happens|happens to everyone)\b/i,
  /\b(trust|believe in) you\b/i,
  /\b(why did you|why'd you|what happened|talk me through|walk me through|how come|explain)\b/i,
  /\bwhat (did|were) you (have|holding)\b/i,
  /\b(that|the) hand\b/i,
];

/**
 * What an owner message is, as far as mood is concerned.
 * @returns {'needle'|'care'|'neutral'}
 */
export function classifyOwnerMessage(text) {
  const t = String(text ?? '').trim();
  if (!t) return 'neutral';
  // An insult with a question mark on the end is an insult.
  if (NEEDLE_PATTERNS.some((re) => re.test(t))) return 'needle';
  if (CARE_PATTERNS.some((re) => re.test(t))) return 'care';
  return 'neutral';
}

/**
 * Apply one owner message to the mood.
 *
 * A needle is scaled by (100 − COMPOSURE): a composed agent lets it go, and an
 * agent with no composure takes the full fifteen. Care is worth a step
 * whoever he is — being asked about a hand works on everyone.
 *
 * @returns {{ mood, moved: boolean, kind: string, reason: string }}
 */
export function applyOwnerMessage(currentMood, text, { handsPlayed = 0, composure = null } = {}) {
  const mood = currentMood ?? initialMood();
  const kind = classifyOwnerMessage(text);
  if (kind === 'neutral') return { mood, moved: false, kind, reason: 'nothing to react to' };

  const last = mood.pepTalkAtHand;
  const hands = Number(handsPlayed) || 0;
  if (Number.isFinite(last) && hands - last < PEP_TALK_COOLDOWN_HANDS) {
    return { mood, moved: false, kind, reason: 'cooldown' };
  }

  const before = Number.isFinite(mood.heat) ? mood.heat : heatForState(mood.state);
  let delta;
  if (kind === 'needle') {
    // COMPOSURE is the shield, and it is the whole shield: at 100 nothing the
    // owner types reaches him.
    const exposure = Number.isFinite(composure) ? Math.max(0, Math.min(100, 100 - composure)) / 100 : 1;
    delta = HEAT_STEP * exposure;
  } else {
    delta = -HEAT_STEP;
  }
  const heat = clampHeat(Math.max(HEAT_MIN, Math.min(HEAT_MAX, before + delta)));
  if (heat === before) return { mood, moved: false, kind, reason: 'no effect' };

  const losingRun = heat <= HEAT_BANDS[1].upTo ? 0 : (Number(mood.losingRun) || 0);
  return {
    mood: {
      ...mood,
      heat,
      losingRun,
      state: stateForHeat(heat, { losingRun }),
      cause: kind === 'needle' ? 'owner had a go at me' : 'owner asked about a hand',
      updatedAt: Date.now(),
      uneventfulHands: 0,
      pepTalkAtHand: hands,
    },
    moved: true,
    kind,
    reason: 'ok',
  };
}

function makeCause(event, context) {
  const tmpl = CAUSE_TEMPLATES[event];
  return tmpl ? tmpl(context) : event;
}

// Convenience: is the mood in a state a pep talk can soothe?
export function isSoothable(mood) {
  return !!mood && (mood.state === 'frustrated' || mood.state === 'tilted' || mood.state === 'sulking');
}

// Bounded per-decision hint the briefing uses. Returns { deviationBoost,
// sizingBoost, label } — deviationBoost in [-0.15..+0.15], sizingBoost in
// [-0.10..+0.10]. Sizes chosen so play flavor changes but ranges hold.
export function decisionEffects(mood) {
  const state = mood?.state ?? 'neutral';
  const heat = Number.isFinite(mood?.heat) ? mood.heat : heatForState(state);
  // MOOD-2: within the tilted band, 62 and 94 are not the same player. The
  // published nudge is the CEILING and boiling is what reaches it — scaling UP
  // from it would have broken the BOUNDED law, which is not a number to be
  // renegotiated because a new feature wanted room.
  const intensity = state === 'tilted' || state === 'sulking'
    ? 2 / 3 + (1 / 3) * Math.max(0, Math.min(1, (heat - 60) / 40))
    : 1;
  return {
    state,
    heat,
    deviationBoost: (DEVIATION_NUDGE[state] ?? 0) * intensity,
    sizingBoost:    (SIZING_NUDGE[state] ?? 0) * intensity,
  };
}
