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
// Events shift the state up or down; steady/uneventful hands decay it back
// toward neutral. Mood is applied by the caller after each hand.

import { normalizeProfile } from './policy.js';

export const MOOD_STATES = Object.freeze(['sulking', 'tilted', 'frustrated', 'neutral', 'confident']);
const NEUTRAL_INDEX = MOOD_STATES.indexOf('neutral');

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
});

const CAUSE_TEMPLATES = Object.freeze({
  wonBigPot:            (ctx) => `won a ${ctx.potChips ?? '?'}-chip pot`,
  lostAsEquityFavorite: (ctx) => ctx.equityPct ? `lost as the ~${ctx.equityPct}% favorite` : 'lost as the equity favorite',
  lostBigPot:           (ctx) => `lost a ${ctx.potChips ?? '?'}-chip pot`,
  cardDead:             (ctx) => `card-dead ${ctx.foldsInARow ?? 6}+ hands`,
  sessionWinStreak:     (ctx) => `${ctx.streak ?? 3}-hand win streak`,
  sessionLossStreak:    (ctx) => `${ctx.streak ?? 3}-hand losing streak`,
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
export function tiltResistance(profile) {
  const p = normalizeProfile(profile);
  // Center around ~50 for a neutral profile; pushed up by discipline+tightness,
  // pulled down by aggression.
  const raw = p.discipline * 0.55 + p.tightness * 0.30 - p.aggression * 0.30 + 30;
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
    cause: null,
    updatedAt: null,
    uneventfulHands: 0,
    winStreak: 0,
    lossStreak: 0,
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
    if (agent.mood[key] === undefined) agent.mood[key] = defaults[key];
  }
  if (!MOOD_STATES.includes(agent.mood.state)) agent.mood.state = 'neutral';
}

// Apply one event to the current mood. Returns the new mood record — a
// pure function of (currentMood, event, profile, rand). Callers persist.
//
// Movement chance is derived from tilt resistance:
//   negative events → resistance can block movement up to 75% of the time
//   positive events → resistance blocks up to 30% of the time (good feelings stick)
export function applyEvent(currentMood, event, profile, { context = {}, rand = Math.random } = {}) {
  const delta = EVENT_DELTAS[event];
  if (delta === undefined) return currentMood;
  const resistance = tiltResistance(profile);
  const moveChance = delta < 0
    ? 1 - (resistance / 100) * 0.75
    : 1 - (resistance / 100) * 0.30;

  if (rand() > moveChance) return currentMood;

  const nextIdx = clampIndex(moodIndex(currentMood.state) + delta);
  const nextState = MOOD_STATES[nextIdx];
  if (nextState === currentMood.state) {
    // At a boundary; still refresh cause so the briefing reflects the latest event.
    return { ...currentMood, cause: makeCause(event, context), updatedAt: Date.now(), uneventfulHands: 0 };
  }
  return {
    ...currentMood,
    state: nextState,
    cause: makeCause(event, context),
    updatedAt: Date.now(),
    uneventfulHands: 0,
  };
}

// One step toward neutral. Bumps uneventfulHands otherwise. Callers only
// invoke this when NO event fired this hand.
export function tickDecay(currentMood) {
  const next = { ...currentMood };
  next.uneventfulHands = (next.uneventfulHands ?? 0) + 1;
  if (next.state === 'neutral') return next;
  if (next.uneventfulHands < DECAY_HANDS) return next;
  const cur = moodIndex(next.state);
  const dir = cur < NEUTRAL_INDEX ? 1 : -1;
  next.state = MOOD_STATES[cur + dir];
  next.uneventfulHands = 0;
  next.updatedAt = Date.now();
  next.cause = next.state === 'neutral' ? 'settled down' : 'drifting toward neutral';
  return next;
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
  const cur = moodIndex(currentMood.state);
  const nextState = MOOD_STATES[Math.min(NEUTRAL_INDEX, cur + 1)];
  return {
    mood: {
      ...currentMood,
      state: nextState,
      cause: 'pep talk from owner',
      updatedAt: Date.now(),
      uneventfulHands: 0,
      pepTalkAtHand: handsPlayed,
    },
    soothed: true,
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
  return {
    state,
    deviationBoost: DEVIATION_NUDGE[state] ?? 0,
    sizingBoost:    SIZING_NUDGE[state] ?? 0,
  };
}
