// src/server/tapeIdle.js — COST-1
//
// He puts the tape on himself.
//
// HOME-STATE-1 built the tape room as a BUTTON: the owner points at a flagged
// hand and the agent goes and watches it for ninety seconds. That was the
// right first half, and it left the second half missing — an agent who only
// ever watches what he is told to watch does not have a memory, he has a video
// player, and the whole premise of the home screen is that he is doing things
// in there whether or not anybody asked.
//
// So when he is home with nothing else on, he picks the top hand off his own
// tape (salience.js — intensity × recency, wins and losses alike) and goes and
// watches it. The owner opens the app and finds him in the tape room, in front
// of the hand a person would have picked.
//
// Five rules the shape of this file comes from, and four of them are bounds:
//
//   1. TWICE A DAY. Claimed against his record before the study starts (see
//      claimSelfStudy), so two ticks in the same second cannot both decide he
//      is free. The owner's button is untouched and stays unlimited: it is his
//      agent and his ninety seconds.
//
//   2. IDLE MEANS IDLE. Home, not in a seat, not already studying, not worn
//      out, and not in the home game. The home game is the one that has to be
//      said out loud: homeGame.eligible already excludes a man who is
//      studying, so putting him in the tape room takes him OUT of the kitchen
//      table, and doing that to somebody mid-hand would be worse than the
//      feature is good.
//
//   3. IT COSTS NOTHING. Not a bound, a fact: the tape room contains no model
//      call by construction (tapeRoom.js rule 2), and the pick is a sort. This
//      whole file is free, which is why it is in a tree about cost at all —
//      it is the one place the product got MORE alive without the bill moving.
//
//   4. THE SAME PATH THE BUTTON TAKES. It calls startStudy, so the study is
//      the same record, the ninety seconds are the same ninety seconds, the
//      read it writes is written the same way, and the HOME screen draws him
//      the same. Nothing here is a second implementation of studying.
//
//   5. IT IS DRIVEN BY THE SAME TICK EVERYTHING ELSE AT HOME IS. An agent's
//      standing changing is what wakes the home game and the nightly
//      exchange, and "who is home doing nothing" is exactly the question a
//      standing change answers.

import {
  getAgentTape,
  getFlaggedHand,
  claimSelfStudy,
  getAgentAttributes,
} from './agentProfiles.js';
import { startStudy, lineFor, subjectOf, isStudying } from './tapeRoom.js';
import { Where } from './home.js';

// Rule 1. Two is enough to be a habit and few enough that a man who is in all
// week is not permanently unavailable.
export const SELF_STUDY_PER_DAY = Number(process.env.TAPE_SELF_PER_DAY ?? 2);

// A hand has to be worth going back to. Below this the top of his tape is a
// 40-chip pot from Tuesday, and watching that is not a character trait, it is
// a screensaver.
export const MIN_SALIENCE = Number(process.env.TAPE_MIN_SALIENCE ?? 0.25);

/**
 * Is this agent free to put a tape on?
 *
 * Takes the PRESENTED agent (the same projection homeGame.eligible reads), so
 * this module needs no record and no table — see homeGame rule 3, which is the
 * same rule.
 */
export function idleAtHome(agent) {
  return !!agent
    && agent.location?.where === Where.HOME
    && !agent.study
    && agent.fatigue !== 'worn';
}

/**
 * The hand he would pick, or null.
 *
 * The top of the ranked tape, provided it clears MIN_SALIENCE and provided the
 * hand records somebody to form a read on — the same 409 the owner's route
 * returns rather than filing a real opinion against a guessed seat.
 */
export function pickHand(agentId, userId, { now = Date.now() } = {}) {
  const ranked = getAgentTape(agentId, userId, { now });
  if (!Array.isArray(ranked) || ranked.length === 0) return null;
  const top = ranked[0];
  if (!top || (top.salience ?? 0) < MIN_SALIENCE) return null;
  if (!subjectOf(top)) return null;
  return top;
}

/**
 * Put him in front of the top hand if he is free and has one worth watching.
 *
 * Returns the study that is now on his record, or null for every skip — which
 * is the overwhelmingly common answer and which the caller never has to
 * distinguish.
 */
export function maybeStudy(agent, userId, { now = Date.now() } = {}) {
  if (!idleAtHome(agent)) return null;
  const agentId = agent.id;
  // The module-level timer map is the fast, authoritative answer for "is he in
  // there right now" — the record can lag it by a save.
  if (isStudying(agentId)) return null;

  const hand = pickHand(agentId, userId, { now });
  if (!hand) return null;

  // Claimed BEFORE the study starts: the day and the count are stamped on the
  // record first, so a failure past this point costs him one of today's two
  // rather than retrying on the next tick and spending them both on a hand it
  // cannot start.
  if (!claimSelfStudy(agentId, userId, { limit: SELF_STUDY_PER_DAY, now })) return null;

  const stored = getFlaggedHand(agentId, userId, hand.handNumber);
  if (!stored) return null;
  const subject = subjectOf(stored.hand);
  if (!subject) return null;

  const text = lineFor(stored.hand, subject, {
    reads: getAgentAttributes(agentId, userId)?.attrs?.READS ?? null,
  });
  const study = startStudy(agentId, userId, { hand: stored.hand, subject, text, now });
  console.log(
    `[tape] ${agent.name || agentId} put on hand ${hand.handNumber} himself ` +
    `(${hand.flagType}, salience ${hand.salience}) — nobody asked him to`,
  );
  return study;
}

/**
 * The whole household, on one standing change. Returns how many went and put a
 * tape on, which is almost always zero.
 *
 * Runs BEFORE homeGame.sync in the listener, deliberately: a man who has just
 * gone into the tape room is not eligible for the kitchen table, and syncing
 * first would seat him and then take him straight back out of a hand.
 */
export function sweep(userId, roster, { now = Date.now() } = {}) {
  let started = 0;
  for (const agent of roster ?? []) {
    try {
      if (maybeStudy(agent, userId, { now })) started++;
    } catch (err) {
      console.error('[tape] idle study failed:', err.message);
    }
  }
  return started;
}

/**
 * Whether an agent is at home doing nothing, without the tape.
 * Re-exported shape used by the home screen's tests; kept next to the rule it
 * mirrors so the two cannot drift.
 */
export function eligibleCount(roster) {
  return (roster ?? []).filter(idleAtHome).length;
}
