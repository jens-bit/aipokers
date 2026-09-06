// src/server/salience.js — COST-1
//
// Which hand he keeps thinking about.
//
// FLAG-1 already decides which hands were NOTABLE — the bad beat, the cooler,
// the pot he took with nothing. That gave the review sheet a list, and a list
// in the order things happened is a list nobody reads past the third entry. It
// also gave the tape room a button with no opinion behind it: the owner had to
// pick, and an agent who only ever watches what he is told to watch is not
// somebody with a memory, he is a video player.
//
// So the hands get a score, and the score is the two things that make a hand
// stick:
//
//   salience = intensity × recency
//
//   INTENSITY  how much of him was in it. The size of the pot against his
//              stack, first and mostly; then the specific ways a hand can be
//              worse than its size — a cooler, a beat, a bluff that got
//              called and shown — and whether the man across the table was
//              somebody he has history with.
//
//   RECENCY    it fades. A week is the window: what happened last Tuesday is
//              a story, and what happened this morning is still going on.
//
// Three rules the shape of this file comes from:
//
//   1. A WIN IS AS WATCHABLE AS A LOSS. Nothing here reads `won` except the
//      heat drift at the bottom, which reads it to decide the SIGN of a nudge
//      and not the size of it. A big pot he took off somebody is exactly as
//      much a thing he replays in his head as a beat he suffered, and a tape
//      room that only ever plays back his defeats would make every agent in
//      the product a depressive.
//
//   2. IT IS DERIVED FROM THE STORED HAND AND NOTHING ELSE. Everything comes
//      off the flagged entry buildFlaggedEntry already writes. No table, no
//      profile, no live lookup — which is what lets the ranking be computed
//      identically by the REST route, by the idle driver at home, and by a
//      test with an object literal.
//
//   3. TIME IS AN ARGUMENT. `now` is passed in everywhere. A ranking that
//      reads the clock cannot be tested and cannot be reproduced.

// The window. At DECAY_DAYS a hand has faded to FLOOR and stops moving; the
// floor is not zero so that hands older than a week still rank against each
// other by what they were rather than collapsing into one indistinguishable
// pile of nothing.
export const DECAY_DAYS = Number(process.env.TAPE_DECAY_DAYS ?? 7);
export const RECENCY_FLOOR = 0.05;

const DAY_MS = 24 * 60 * 60 * 1000;

// What intensity is made of. They sum to more than 1 on purpose — a cooler in
// a huge pot against his nemesis is pinned at 1 rather than being averaged
// down into the middle by the components it does NOT have.
export const WEIGHTS = Object.freeze({
  pot: 0.55,          // the size of it, against his own stack
  cooler: 0.20,       // both had a hand; nobody was getting away
  badBeat: 0.30,      // he was in front and lost anyway
  bluffCaught: 0.25,  // he fired, got called, and everybody saw it
  nemesis: 0.15,      // and it was HIM
});

// A pot at this multiple of the reference stack is as intense as a pot gets.
// Two buy-ins is a stack-off heads-up, which is the ceiling of what one hand
// can be worth.
const POT_CEILING_STACKS = 2;

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * Did he fire and get caught?
 *
 * Derived rather than flagged: FLAG-1 records `bigBluff` for a bluff that
 * WORKED (he bet light and they folded), and there is no flag for the other
 * half because a bluff that fails usually classifies as something else. It is
 * in the stored hand all the same — an aggressive action taken on thin equity,
 * in a hand he lost — and it is one of the things a player replays.
 */
export function bluffCaught(hand) {
  if (!hand || hand.won) return false;
  return (hand.streets ?? []).some((st) => {
    const aggressive = /^(BET|RAISE)/.test(String(st?.action ?? ''));
    // Stored as whole percentage points by buildFlaggedEntry.
    return aggressive && Number.isFinite(st?.equity) && st.equity < 40;
  });
}

/** Was somebody he has history with in this hand? */
export function nemesisIn(hand, nemesisIds) {
  if (!nemesisIds || nemesisIds.size === 0) return false;
  return (hand?.opponents ?? []).some((o) => nemesisIds.has(String(o?.playerId)));
}

/**
 * How much of him was in this hand, 0..1.
 *
 * @param stack the reference stack — his buy-in for that session. Falls back to
 *              the pot itself, which makes potWeight 1/POT_CEILING_STACKS: a
 *              hand with no stack recorded is treated as a middling one rather
 *              than as a huge one or as nothing.
 */
export function intensityOf(hand, { stack = null, nemesisIds = null } = {}) {
  if (!hand) return 0;
  const pot = Number(hand.pot) || 0;
  const reference = Number(stack) > 0 ? Number(stack) : (pot > 0 ? pot : 1);
  const potWeight = clamp01(pot / (reference * POT_CEILING_STACKS));

  let intensity = WEIGHTS.pot * potWeight;
  if (hand.flagType === 'cooler')  intensity += WEIGHTS.cooler;
  if (hand.flagType === 'badBeat') intensity += WEIGHTS.badBeat;
  if (bluffCaught(hand))           intensity += WEIGHTS.bluffCaught;
  if (nemesisIn(hand, nemesisIds)) intensity += WEIGHTS.nemesis;
  return clamp01(intensity);
}

/**
 * How present it still is, 1 down to RECENCY_FLOOR across DECAY_DAYS.
 *
 * Linear rather than exponential, because the sentence this implements is "it
 * fades over a week" and a half-life of a week means it is still half there at
 * the end of one, which is a different sentence.
 */
export function recencyOf(hand, { now = Date.now() } = {}) {
  const at = Number(hand?.flaggedAt);
  if (!Number.isFinite(at)) return RECENCY_FLOOR;
  const ageDays = Math.max(0, (now - at) / DAY_MS);
  if (ageDays >= DECAY_DAYS) return RECENCY_FLOOR;
  return Math.max(RECENCY_FLOOR, 1 - ageDays / DECAY_DAYS);
}

/** intensity × recency, 0..1. */
export function salienceOf(hand, { now = Date.now(), stack = null, nemesisIds = null } = {}) {
  return intensityOf(hand, { stack, nemesisIds }) * recencyOf(hand, { now });
}

/**
 * The tape, ranked. Highest salience first.
 *
 * Each entry is the stored hand with `salience`, `intensity` and `recency`
 * alongside it, plus `watched` — how many times he has actually gone and
 * watched this one, which is what the opener and the heat drift read.
 *
 * The tie-break is the hand number, descending: two hands that score the same
 * are ordered by which happened later, which is both stable and the answer a
 * person would give.
 */
export function rankHands(hands, { now = Date.now(), stack = null, nemesisIds = null, watches = null } = {}) {
  return (hands ?? [])
    .filter(Boolean)
    .map((hand) => {
      const intensity = intensityOf(hand, { stack, nemesisIds });
      const recency = recencyOf(hand, { now });
      return {
        ...hand,
        intensity: round3(intensity),
        recency: round3(recency),
        salience: round3(intensity * recency),
        watched: watchCount(watches, hand.handNumber),
      };
    })
    .sort((a, b) => (b.salience - a.salience) || ((b.handNumber ?? 0) - (a.handNumber ?? 0)));
}

const round3 = (n) => Math.round(n * 1000) / 1000;

// ── The rewatch ledger ──────────────────────────────────────────────────────
//
// `watches` is what agentProfiles stores on the agent: a map of hand number to
// { count, lastAt, won, flagType, subject }. It is written when a study STARTS
// (tapeRoom), because starting one is the act — an owner who closes the app
// forty seconds in still went and looked.

export function watchCount(watches, handNumber) {
  if (!watches || handNumber == null) return 0;
  return Number(watches[String(handNumber)]?.count) || 0;
}

/**
 * The hand he has gone back to most in the last week, or null.
 *
 * Ties go to the one watched most recently, because the question this answers
 * is "what is he still thinking about" and the more recent visit is the better
 * evidence of that.
 */
export function mostRewatched(watches, { now = Date.now(), withinDays = DECAY_DAYS } = {}) {
  let best = null;
  for (const [handNumber, entry] of Object.entries(watches ?? {})) {
    const count = Number(entry?.count) || 0;
    const lastAt = Number(entry?.lastAt) || 0;
    if (count <= 0) continue;
    if (now - lastAt > withinDays * DAY_MS) continue;
    const row = { handNumber: Number(handNumber), ...entry, count, lastAt };
    if (!best || row.count > best.count || (row.count === best.count && row.lastAt > best.lastAt)) {
      best = row;
    }
  }
  return best;
}

// ── What it does to him ─────────────────────────────────────────────────────
//
// A hand he cannot stop watching moves where he rests. Small — under half a
// HEAT_STEP either way — because this is a man brooding, not a man tilting:
// the whole mood machine is built on the rule that what happens AT THE TABLE
// decides how he plays, and nothing in the living room is allowed to compete
// with that.
//
// The asymmetry is the point and it is the honest one. Replaying a beat winds
// you up more than replaying a win settles you down.

export const TAPE_HEAT_LOST = 5;
export const TAPE_HEAT_WON = -3;

/**
 * The nudge to his resting heat from the hand he has been rewatching, or 0.
 * Reads `won` and nothing else about the hand — see rule 1.
 */
export function tapeHeatDrift(watched) {
  if (!watched || !((Number(watched.count) || 0) > 0)) return 0;
  return watched.won ? TAPE_HEAT_WON : TAPE_HEAT_LOST;
}

// The one hand-shaped noun the opener needs. "that flush against Granite" —
// the make of the hand is not stored, so what is available is the flag, the
// cards and the man. Returns null when there is not enough to name it, and the
// opener simply says nothing rather than something vague.
const FLAG_NOUN = Object.freeze({
  badBeat:    'that beat',
  cooler:     'that cooler',
  bigBluff:   'that bluff',
  heroCall:   'that call',
  biggestPot: 'that pot',
});

export function tapePhrase(watched) {
  if (!watched) return null;
  const noun = FLAG_NOUN[watched.flagType] ?? 'that hand';
  const who = watched.subject ? String(watched.subject).slice(0, 24) : null;
  return who ? `${noun} against ${who}` : noun;
}
