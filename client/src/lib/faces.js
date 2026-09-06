// faces.js — SERVER-3's face triggers, turned into the expression a ghost wears.
//
// The server names SIX moments a ghost pulls a face for. Three are knowable at
// the moment of a decision and ride DECISION's `event`; three need the hand to
// be over and ride `result.events`. Same vocabulary either way — which is the
// point: this module maps ONE name to ONE expression and never has to know
// which message brought it.
//
//   dealtStrong   he looked down at a premium holding   → pleased
//   raisedAgainst somebody put in a raise he must answer → wary
//   allIn         the action he took committed his stack → locked
//   wonBig        he took a big pot                      → smug
//   badBeat       he got there with the best of it and lost → stunned
//   bluffCaught   he fired without the goods and got looked up → bored
//
// `bored` for bluffCaught is the face's own vocabulary for "nothing to show":
// the eyes go flat rather than wide, which is what a caught bluff looks like
// when the alternative — stunned — is already spoken for by the bad beat.
//
// Pure: no DOM, no timers, no fetch. The screen owns the clock.

import { FACE_EVENTS } from '../components/system/GhostFace.jsx';

export const SERVER_FACE_EVENTS = [
  'dealtStrong', 'raisedAgainst', 'allIn', 'wonBig', 'badBeat', 'bluffCaught',
];

const FACE_FOR = {
  dealtStrong:   'pleased',
  raisedAgainst: 'wary',
  allIn:         'locked',
  wonBig:        'smug',
  badBeat:       'stunned',
  bluffCaught:   'bored',
};

/** The expression for one server trigger, or null for anything unrecognised. */
export function faceFor(event) {
  const f = FACE_FOR[event] || null;
  return f && FACE_EVENTS.indexOf(f) >= 0 ? f : null;
}

/**
 * What one seat's ghost is wearing right now.
 *
 * The hand-end triggers outrank the decision ones: once the hand is over, what
 * he was reacting to before he acted is history, and a ghost that tried to look
 * wary and stunned at once would look like neither.
 *
 * @param seat          the seat to draw
 * @param lastDecision  { seat, event } off the DECISION frame, or null
 * @param result        the settled hand's result, or null
 */
export function faceOf(seat, lastDecision, result) {
  if (!Number.isInteger(seat)) return null;
  const ended = result && result.events ? result.events[seat] : null;
  if (ended) return faceFor(ended);
  if (result) return null;   // the hand is over and this seat had nothing to say
  if (lastDecision && lastDecision.seat === seat) return faceFor(lastDecision.event);
  return null;
}

/**
 * HOW LONG A FACE HOLDS. An expression is a MOMENT — the ref gives the brow
 * triggers 400–700ms and only `knit` persists. A face that stays up for the rest
 * of the street stops being a reaction and becomes the character's resting
 * state, which is the one thing the mood system is for.
 */
export const FACE_HOLD_MS = 1400;
