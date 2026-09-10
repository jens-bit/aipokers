// src/agent/policyPlay.js — COST-1
//
// The compiled policy, playing on its own.
//
// policy.js turns a personality into DIRECTIVES — a range verdict, a bluff
// die, a sizing hint — and hands them to the model as scaffolding. That was
// always half a decision procedure: the directives already contain enough to
// answer the easy spots, and the easy spots are most of them. A tight agent
// folds seven hands in ten before the flop, and every one of those folds was
// costing a model call to arrive at an answer the range verdict had already
// written down.
//
// So this module finishes the job. It RATES every legal action out of a
// hundred from the same directives, and it PICKS one. router.js decides when
// that is allowed to be the whole answer.
//
// Three rules the shape of this file comes from:
//
//   1. IT IS THE SAME POLICY, NOT A SECOND ONE. Every input here is already
//      in the briefing the model gets: the perceived equity, the pot odds, the
//      range verdict, the bluff die, the sizing directive, the aggression
//      slider. If this file needed a number the briefing does not carry, the
//      two paths would be playing two different characters, and an owner would
//      be able to tell which one answered by how his agent played.
//
//   2. IT IS PURE AND DETERMINISTIC. No clock, no Math.random, no model call.
//      The dice were already rolled by compilePolicy (server-side, from his
//      profile) and arrive on gs.policy.dice. Same state in, same rating out —
//      which is what lets a scripted hand set assert exactly which spots route
//      where, and what lets the arena's mirrored deck stay a fair mirror.
//
//   3. THE SCORES EXIST TO BE COMPARED, NOT PUBLISHED. Nothing shows a player
//      "fold: 95, call: 5". The absolute numbers are a heuristic and they are
//      allowed to be; what has to hold is the ORDER and the GAP, because the
//      gap is the whole safety mechanism — a spot where two actions rate
//      within OPTION_BAND of each other is a spot this module is not confident
//      about, and router.js sends it to the model instead.
//
// The rating scale, so the constants below read as something rather than as
// magic: 0 is "never", 50 is "no opinion", 100 is "obvious". A ten-point band
// around the top is the width of "no opinion between these two".

import { normalizeProfile } from './policy.js';
import { fallbackLine } from './voice.js';

// Two actions inside this band of each other are, as far as the compiled
// policy is concerned, the same action. See rule 3.
export const OPTION_BAND = 10;

// Above this the hand is worth building a pot with rather than only paying
// with; the aggressive action gets a value bonus that scales past it, so a
// monster rates close enough to the passive line to count as a second option
// and go to the model. That is deliberate: "I have the nuts" is exactly the
// spot worth spending a call on.
const VALUE_EQUITY = 0.65;

// Below this a bet is a bluff, and whether it happens is the die's business
// and not the equity's.
const BLUFF_EQUITY = 0.35;

// How hard the edge (equity minus pot odds) swings the pay/fold pair. 180
// means a 0.25 edge — the margin router.js calls decisive — pins call at ~95
// and fold at ~5, which is the shape the whole thing is built around.
const EDGE_WEIGHT = 180;

const clamp = (n) => Math.max(0, Math.min(100, n));

const DEFAULT_PROFILE = { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };

/**
 * The pot odds this decision actually faces.
 *
 * With nothing to call, continuing is free and the pot odds are zero — which
 * is not the same as "unknown". gs.potOdds is null in that case (table.js only
 * computes it when there is a bet), and reading the null as unknown would make
 * every check spot unratable.
 */
export function facingOdds(gs) {
  if (!(Number(gs?.toCall) > 0)) return 0;
  return Number.isFinite(gs?.potOdds) ? gs.potOdds : 0;
}

/**
 * |equity − pot odds|. The distance between what the hand is worth and what it
 * costs — the single number that says whether a spot is close.
 *
 * Null when there is no equity estimate at all (the Monte Carlo failed). A
 * spot nobody can measure is a spot nobody may shortcut, and router.js reads
 * the null that way.
 */
export function marginOf(gs) {
  if (!Number.isFinite(gs?.equity)) return null;
  return Math.abs(gs.equity - facingOdds(gs));
}

// The appetite for putting money in, out of 100, before the passive line is
// considered. Equity and the aggression slider carry it; the range verdict and
// the bluff die are the policy's own two hands on it.
function pushScore(gs, profile) {
  const eq = Number.isFinite(gs?.equity) ? gs.equity : 0.5;
  let push = 55 * eq + 35 * (profile.aggression / 100);

  // A hand worth more than a coin flip is worth building a pot with, and the
  // better it gets the more true that is.
  if (eq >= VALUE_EQUITY) push += (eq - VALUE_EQUITY) * 140;

  // Under the bluff line the die decides, because the equity has nothing to
  // say: the server rolled it from his bluffFreq and it is a fact by the time
  // it reaches here. A "no" is as informative as a "yes" and pushes the other
  // way, which is what keeps a disciplined agent from drifting into betting
  // every missed board.
  if (eq < BLUFF_EQUITY) push += gs?.policy?.dice?.bluffDie ? 25 : -25;

  // The preflop range verdict is the policy's strongest statement about a
  // hand, so it is worth more here than anywhere else.
  const range = gs?.street === 'preflop' ? gs?.policy?.range : null;
  if (range) push += range.inRange ? 5 : -20;

  return clamp(push);
}

/**
 * Rate every legal action out of 100.
 *
 * Returns [{ type, score, amount? }] sorted best first. `amount` is present
 * only on bet/raise and is already clamped into the table's disciplined offer
 * (RAISE-1's floors arrive on gs as minBet/minRaise, so honouring them is
 * simply honouring the range).
 */
export function rateActions(gs) {
  if (!gs) return [];
  const profile = normalizeProfile(gs.policy?.profile ?? DEFAULT_PROFILE);
  const push = pushScore(gs, profile);
  const out = [];

  if (Number(gs.toCall) > 0) {
    const edge = (Number.isFinite(gs.equity) ? gs.equity : 0.5) - facingOdds(gs);
    let call = clamp(50 + EDGE_WEIGHT * edge);
    let fold = clamp(50 - EDGE_WEIGHT * edge);
    // A hand the range verdict threw out is one he is looking for a reason to
    // let go of, not one he is looking for a reason to keep.
    const range = gs.street === 'preflop' ? gs.policy?.range : null;
    if (range && !range.inRange) { fold = clamp(fold + 15); call = clamp(call - 15); }

    out.push({ type: 'fold', score: fold });
    out.push({ type: 'call', score: call });
    if (gs.canRaise) {
      // You cannot raise a hand you should not even pay with: the appetite is
      // capped by the willingness to continue. Without this cap a bluff die on
      // a hand facing a big bet would rate a raise above a fold and the policy
      // would fire it off unsupervised.
      out.push({ type: 'raise', score: Math.min(push, call), amount: raiseAmount(gs, profile) });
    }
  } else {
    // Nothing to call. Folding is never the answer and is not offered — the
    // engine allows it, but rating it would put a zero in the list that can
    // only ever be noise.
    out.push({ type: 'check', score: clamp(100 - push) });
    if (gs.canBet) out.push({ type: 'bet', score: push, amount: betAmount(gs, profile) });
    else if (gs.canRaise) out.push({ type: 'raise', score: push, amount: raiseAmount(gs, profile) });
  }

  return out.sort((a, b) => b.score - a.score);
}

/**
 * How many actions the policy cannot separate — the count rated within
 * OPTION_BAND of the best one, the best one included.
 *
 * One means it has an opinion. Two or more means it does not, and router.js
 * treats that as a spot worth paying for.
 */
export function countOptions(rated) {
  if (!Array.isArray(rated) || rated.length === 0) return 0;
  const top = rated[0].score;
  return rated.filter((r) => top - r.score <= OPTION_BAND).length;
}

// The sizing directive, in chips. Preflop it is an open; after the flop it is
// a fraction of the pot. Both are clamped into the offer the table made, which
// is what keeps the policy path inside RAISE-1's discipline without knowing
// anything about it.
function betAmount(gs, profile) {
  const sizing = gs.policy?.sizing ?? {};
  const openBB = Number.isFinite(sizing.openBB) ? sizing.openBB : 3;
  const frac = Number.isFinite(sizing.cbetFraction) ? sizing.cbetFraction : 0.55;
  const want = gs.street === 'preflop'
    ? Math.round(openBB * (gs.bb ?? 0))
    : Math.round((gs.pot ?? 0) * frac);
  return clampAmount(want, gs.minBet, gs.maxBet);
}

function raiseAmount(gs, profile) {
  const frac = Number.isFinite(gs.policy?.sizing?.cbetFraction) ? gs.policy.sizing.cbetFraction : 0.55;
  // A raise is expressed as a TOTAL for the street: what he has already put in,
  // plus what it costs to call, plus the fraction of the pot he is raising by.
  const want = Math.round((gs.myContrib ?? 0) + (gs.toCall ?? 0) + (gs.pot ?? 0) * frac);
  return clampAmount(want, gs.minRaise, gs.maxRaise);
}

function clampAmount(want, min, max) {
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : lo;
  return Math.max(lo, Math.min(hi, Number.isFinite(want) ? want : lo));
}

// ── Template table talk ─────────────────────────────────────────────────────
//
// The policy path costs nothing and it must stay that way, so what it says is
// drawn from here rather than written. These are the INSTANT reactions — the
// fold and the check that cannot wait for the hand to end (see handTalk.js,
// which writes everything that can).
//
// Rare on purpose. A line on every fold is not a character, it is a chat log:
// roughly one decision in eight speaks, chosen by a hash of the hand and the
// seat so a replayed hand says the same thing in the same place.

const INSTANT_LINES = Object.freeze({
  fold:  ['Not this one.', 'Away it goes.', 'All yours.', 'No.'],
  check: ['Check.', 'Go on then.', "I'll look.", 'Nothing from me.'],
  call:  ["I'll pay.", 'Sure.', 'One more card.'],
  bet:   ['Let us make it interesting.', "That's a bet."],
  raise: ['More.', 'Up.'],
});

// BUG-170: cadence follows the eight birth voices in attributes.NATURES
// (ported from char-system.jsx), not the display name or a changing strategy.
// Only the public action is expressed: never cards, reads, a promised next
// card, or a result. These are remarks, not their birth catchphrases repeated.
const NATURE_LINES = Object.freeze({
  Grinder: {
    fold: ['I can wait.', 'Leave that one. Keep going.'],
    check: ['No hurry here.', 'Steady. Check.'],
    call: ['Still here.', 'I will stay with it.'],
    bet: ['Keep it moving.', 'A little work.'],
    raise: ['More work to do.', 'I am staying with this.'],
  },
  Hothead: {
    fold: ['Fine. Take it.', 'Out. Do not make a thing of it.'],
    check: ['Fine. Your turn.', 'Go on. Do something.'],
    call: ['Fine. I am coming.', 'You are not getting rid of me.'],
    bet: ['There. Your problem.', 'Come on, then.'],
    raise: ['Not enough. More.', 'Try that.'],
  },
  Professor: {
    fold: ['No reason to continue.', 'That is enough of this one.'],
    check: ['Nothing to add.', 'I will leave it there.'],
    call: ['That much, then.', 'I can accept that.'],
    bet: ['That will do.', 'Let us proceed.'],
    raise: ['I will add to that.', 'A little further, then.'],
  },
  Rock: {
    fold: ['Easy to leave.', 'No need to force it.'],
    check: ['I am in no rush.', 'Let it come to me.'],
    call: ['I can wait here.', 'Just the call.'],
    bet: ['I have decided.', 'This much.'],
    raise: ['I said more.', 'That is my answer.'],
  },
  Gambler: {
    fold: ['Even I can leave one.', 'I will let this one go.'],
    check: ['Tempt me.', 'Go on. Give me a reason.'],
    call: ['All right, I am curious.', 'I want to see this through.'],
    bet: ['Why be quiet?', 'Let us stir this up.'],
    raise: ['Let us go further.', 'A little more trouble.'],
  },
  Shark: {
    fold: ['Keep it. I am watching.', 'Not chasing you there.'],
    check: ['Your move. I am watching.', 'Show me what you do.'],
    call: ['I am coming with you.', 'Go on. I am still here.'],
    bet: ['Your turn to answer.', 'What do you do with that?'],
    raise: ['Answer that.', 'I am pushing back.'],
  },
  Sphinx: {
    fold: ['Done with this one.', 'It passes.'],
    check: ['I wait.', 'Nothing changes.'],
    call: ['We continue.', 'So it goes.'],
    bet: ['There it is.', 'My turn.'],
    raise: ['Further.', 'It goes up.'],
  },
  Showman: {
    fold: ['I will sit this scene out.', 'Carry on without me.'],
    check: ['The floor is yours.', 'Let someone else speak.'],
    call: ['I am staying for this.', 'You still have my attention.'],
    bet: ['Eyes this way.', 'A little something for the room.'],
    raise: ['There is more.', 'Let me hold your attention.'],
  },
});

// One in this many decisions says something out loud.
export const TALK_ONE_IN = 8;

function hash(str) {
  let h = 2166136261 >>> 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * The template line this decision says out loud, or null for the silence that
 * is the common case. Deterministic in the hand, the seat, the street and the
 * action. Optional public speech context only avoids repeating the speaker's
 * last delivered line; it never changes the speaking opportunity or action.
 */
export function instantLine(gs, action, { lastPublicLine = null } = {}) {
  const voice = Object.hasOwn(NATURE_LINES, gs?.nature) ? NATURE_LINES[gs.nature] : null;
  const pool = voice?.[action?.type] ?? INSTANT_LINES[action?.type];
  if (!pool || pool.length === 0) return null;
  const seed = `${gs?.handNumber ?? 0}:${gs?.seat ?? 0}:${gs?.street ?? ''}:${action.type}`;
  const h = hash(seed);
  if (h % TALK_ONE_IN !== 0) return null;
  const index = (h >>> 8) % pool.length;
  // Legacy/House voices keep their pool and choice. Only this impossible
  // promise changes once the last community card is already on the table.
  const truthful = line => gs?.street === 'river' && line === 'One more card.' ? "I'll pay." : line;
  const line = truthful(pool[index]);
  // BUG-177: keep the old deterministic choice unless it is exactly what
  // this speaker last said. Walk the existing pool without another hash or
  // random draw. Normalize first: two legacy river entries mean "I'll pay."
  if (line === lastPublicLine) {
    for (let offset = 1; offset < pool.length; offset++) {
      const next = truthful(pool[(index + offset) % pool.length]);
      if (next !== lastPublicLine) return next;
    }
  }
  return line;
}

/**
 * The whole policy-only decision.
 *
 * Returns the same shape getAgentAction does, minus everything that only a
 * model call can carry — { action, reasoning, say, route } — so table.js can
 * treat the two paths identically after the branch.
 *
 * `reasoning` is his voice line, built by voice.js from the hand and the
 * action, which is the same fallback the model path uses when a model returns
 * something unusable. `say` is the table-talk bubble, or null.
 */
export function chooseFromPolicy(gs, speech = {}) {
  const rated = rateActions(gs);
  const best = rated[0] ?? (gs?.canCheck ? { type: 'check' } : { type: 'call' });
  const action = best.amount === undefined
    ? { type: best.type }
    : { type: best.type, amount: best.amount };
  return {
    action,
    reasoning: fallbackLine({ holeCards: gs?.holeCards, action }),
    say: instantLine(gs, action, speech),
    rated,
    options: countOptions(rated),
  };
}
