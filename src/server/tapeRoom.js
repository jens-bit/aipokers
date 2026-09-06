// src/server/tapeRoom.js — HOME-STATE-1
//
// The room with the tape in it.
//
// An agent comes home from a session with a handful of flagged hands — the
// bad beat, the cooler, the pot he took off somebody with nothing. The review
// sheet already lets the OWNER look at those. This is the other half: the
// owner points at one and says watch that again, and the agent goes and does
// it, and ninety seconds later he has written one line in his book about the
// man who was across from him.
//
// Three rules, and the tests pin all three:
//
//   1. STUDYING CHANGES NO ATTRIBUTE. Not one, not by a fraction, not
//      "narrowing the band". Growth is drawn from evidence a SESSION produced
//      (ATTR-3) and there is exactly one place that draws it. If ninety
//      seconds in front of a screen could move FOCUS, the optimal way to play
//      this game would be to never deploy anybody, and the optimal way to play
//      this game has to be to play it.
//
//   2. THERE IS NO MODEL CALL IN HERE. The line is composed by reads.js from
//      the hand's own classification, deterministically. Ninety seconds that
//      cost a token every time would make the button a slot machine; the
//      answer was already in the hand, which is why watching it again is worth
//      anything at all.
//
//   3. IT IS NINETY SECONDS OF REAL TIME. Not a spinner. The whole value of
//      the routine is that the HOME screen shows him unavailable, doing a
//      thing, for long enough that you notice — he leaves the home game while
//      he is in here, and comes back when he is done.
//
// One stated limitation: the ninety seconds live in a timer, so a process
// restart mid-study drops it. The record says so (`study.endsAt` is a time,
// not a flag, and ensureHome clears an expired one), the owner sees him back
// in the front room, and the hand can be studied again. A ninety-second window
// is not worth a boot-time reconciliation pass.

import { telegramAuthMiddleware, isOwner } from './auth.js';
import {
  getFlaggedHand,
  getAgentHome,
  getAgentAttributes,
  setAgentStudy,
  getAgentStudy,
  appendAgentRead,
  getAgentReadBook,
  noteTapeWatch,
} from './agentProfiles.js';
import { getRead } from './opponentStats.js';
import { studyLine } from '../agent/reads.js';

// How long he is in there. Long enough to be a thing he is doing rather than a
// spinner; short enough that an owner who wanted to send him out is not made
// to wait for an evening.
export const STUDY_MS = Number(process.env.HOME_STUDY_MS ?? 90_000);

// agentId -> timeout. Module-level so a second POST for the same agent can be
// refused rather than stacking a second ninety seconds on the first.
const inProgress = new Map();

/**
 * Which opponent the line gets filed under.
 *
 * A multiway hand has several, and only one of them is the one he learned
 * something about. Preference order:
 *
 *   1. somebody who SHOWED HIM A HAND. A showdown is the only time he sees
 *      what the bet actually meant, so it is the only time the tape has
 *      anything in it he could not already have known.
 *   2. otherwise the first opponent recorded, which heads-up is the only one.
 *
 * Returns null for a hand recorded before opponents were stored with it — see
 * the 409 in the route, which says so rather than filing the line under a
 * guess.
 */
export function subjectOf(hand) {
  const opponents = Array.isArray(hand?.opponents) ? hand.opponents : [];
  if (opponents.length === 0) return null;
  const shown = new Set((hand.opponentShowdownCards ?? []).map((o) => o.seat));
  return opponents.find((o) => shown.has(o.seat)) ?? opponents[0];
}

/**
 * Compose the line this hand produces. Deterministic — same hand, same line —
 * so it is computed when the study STARTS and carried on the record until the
 * ninety seconds are up. That is what makes the end of a study a write and not
 * a second decision.
 */
export function lineFor(hand, subject, { reads = null } = {}) {
  const read = subject?.playerId ? getRead(subject.playerId) : null;
  return studyLine(hand, { read, reads });
}

/** Is he in the tape room right now? */
export function isStudying(agentId) {
  return inProgress.has(String(agentId));
}

/**
 * Start a study. Returns the study record now on his file.
 *
 * The write at the end is best-effort in the same sense every thread write is:
 * a read book that can throw out of a timer callback would take the process
 * with it, and one missing line is not worth that.
 */
export function startStudy(agentId, userId, { hand, subject, text, now = Date.now() } = {}) {
  const key = String(agentId);
  // COST-1: the rewatch ledger, written when the study STARTS. Starting one is
  // the act — an owner who closes the app forty seconds in still went and
  // looked — and it is what the ranking, the opener and his resting heat all
  // read. Best-effort: a ledger that can break the tape room is worse than no
  // ledger.
  try {
    noteTapeWatch(agentId, userId, hand, { subject: subject?.displayName ?? null, now });
  } catch (err) {
    console.error('[tape] watch ledger write failed:', err.message);
  }
  const study = {
    handNumber: hand?.handNumber ?? null,
    flagType: hand?.flagType ?? null,
    startedAt: now,
    endsAt: now + STUDY_MS,
    // Carried rather than recomputed at the end: see lineFor.
    pending: {
      playerId: subject.playerId,
      displayName: subject.displayName ?? subject.playerId,
      text,
    },
  };
  setAgentStudy(agentId, userId, study);

  // The pending line is handed to the callback rather than re-read off the
  // record, because by the time the timer fires the record has EXPIRED: the
  // timer runs at endsAt, and ensureHome's restart-recovery clear asks
  // `endsAt > now`, which is false at exactly that instant. Reading it back
  // would drop the line the whole ninety seconds was for.
  const timer = setTimeout(() => {
    inProgress.delete(key);
    try {
      finishStudy(agentId, userId, { pending: study.pending, handNumber: study.handNumber });
    } catch (err) {
      console.error('[tape] finish failed:', err.message);
    }
  }, STUDY_MS);
  timer.unref?.();
  inProgress.set(key, timer);
  return study;
}

/**
 * End a study early or on time: file the line, clear the room.
 *
 * `pending` is the line the caller already holds — the timer passes it,
 * because the record it would otherwise be read from has expired by exactly
 * the instant the timer runs (see startStudy). A caller with nothing in hand
 * falls back to the record, which is what an early finish does.
 *
 * Idempotent — an agent with nothing to file finishes with nothing written,
 * which is what makes it safe to call from both the timer and a shutdown.
 */
export function finishStudy(agentId, userId, { pending: handed = null, handNumber = null } = {}) {
  const study = getAgentStudy(agentId, userId);
  const timer = inProgress.get(String(agentId));
  if (timer) { clearTimeout(timer); inProgress.delete(String(agentId)); }
  if (study) setAgentStudy(agentId, userId, null);

  const pending = study?.pending ?? handed;
  const hand = study?.handNumber ?? handNumber;
  if (!pending?.playerId || !pending?.text) return null;

  appendAgentRead(agentId, userId, {
    playerId: pending.playerId,
    displayName: pending.displayName,
    text: pending.text,
    handNumber: hand ?? null,
  });
  console.log(`[tape] ${agentId} finished hand ${hand} — wrote a read on ${pending.displayName}`);
  return pending;
}

// Test/shutdown helper: drop every pending timer without writing.
export function reset() {
  for (const timer of inProgress.values()) clearTimeout(timer);
  inProgress.clear();
}

// ── REST ────────────────────────────────────────────────────────────────────

/**
 * POST /api/agents/:agentId/study   { userId, handId }
 * GET  /api/agents/:agentId/study   ?userId=
 *
 * Both are owner-gated: a read book is what he privately thinks about people
 * he has played, which is the same class of thing as his reasoning (AGE-33) —
 * public at no point. Neither route triggers a model call, so neither needs
 * the chat limiter; the app-wide /api limiter is the right bound for a button.
 */
export function installTapeRoomRoutes(app) {
  app.post('/api/agents/:agentId/study', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.body?.userId || 'anon');
    const { agentId } = req.params;
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'not your agent' });

    const agent = getAgentHome(agentId, userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // The tape room is a room in the house. A man in a seat is not in it.
    if (agent.location?.where === 'table') {
      return res.status(409).json({ error: 'He is at a table. Bring him home first.', where: agent.location.where });
    }
    if (agent.study) {
      return res.status(409).json({ error: 'He is already watching one.', study: agent.study });
    }

    const handId = req.body?.handId;
    if (handId === undefined || handId === null || String(handId).trim() === '') {
      return res.status(400).json({ error: 'handId required' });
    }
    const flagged = getFlaggedHand(agentId, userId, handId);
    if (!flagged) return res.status(404).json({ error: 'No flagged hand with that id' });

    const subject = subjectOf(flagged.hand);
    if (!subject) {
      // A hand from before opponents were stored alongside them. Filing the
      // line under a guessed seat index would put a real opinion against the
      // wrong man, which is worse than refusing.
      return res.status(409).json({ error: 'That hand records nobody to form a read on.', handId });
    }

    const text = lineFor(flagged.hand, subject, {
      reads: getAgentAttributes(agentId, userId)?.attrs?.READS ?? null,
    });
    const study = startStudy(agentId, userId, { hand: flagged.hand, subject, text });

    res.json({
      agentId,
      // The line is NOT returned. He has not watched it yet, and handing the
      // owner the conclusion at second zero is what would make the ninety
      // seconds decorative.
      study: { handNumber: study.handNumber, flagType: study.flagType, startedAt: study.startedAt, endsAt: study.endsAt },
      studyMs: STUDY_MS,
      subject: { playerId: subject.playerId, displayName: subject.displayName },
    });
  });

  app.get('/api/agents/:agentId/study', (req, res) => {
    const userId = String(req.query.userId || 'anon');
    const { agentId } = req.params;
    const agent = getAgentHome(agentId, userId);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'not your agent' });

    const study = getAgentStudy(agentId, userId);
    const book = getAgentReadBook(agentId, userId) ?? [];
    res.json({
      agentId,
      study: study
        ? { handNumber: study.handNumber, flagType: study.flagType, startedAt: study.startedAt, endsAt: study.endsAt }
        : null,
      studyMs: STUDY_MS,
      book,
      count: book.length,
    });
  });
}
