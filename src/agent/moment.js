// src/agent/moment.js
// Deterministic template-based "moment" line, in the agent's voice, written
// after every hand it played. No extra LLM calls — pulls from the hand
// outcome + the last stored reasoning line.
//
// Shape: { text: string, mood: string, at: number }.
// Consumed by the floor UI (agent.lastMoment) — one short sentence per hand.
//
// MOOD-2c also puts the THREAD OPENER here: the first line he says when the
// owner opens the thread after a session. It used to be
//   "Hey — I just finished 34 hands. Won 12, lost 22. Want to review any hands
//    or adjust my strategy?"
// which is a form letter from a piece of software, and it was the same one
// whether he had just run over the table or been coolered three times. The
// opener is his now: chosen by how hot he is, and by the one hand he cannot
// stop thinking about. The counts moved to the profile, where numbers belong.

// Pick the last non-fold decision's reasoning line, if any, as raw material
// for the moment. Falls back to the last decision of any type.
function pickReasoningSnippet(decisions = []) {
  for (let i = decisions.length - 1; i >= 0; i--) {
    const d = decisions[i];
    if (d?.reasoning && d.action?.type !== 'fold') return String(d.reasoning);
  }
  for (let i = decisions.length - 1; i >= 0; i--) {
    const d = decisions[i];
    if (d?.reasoning) return String(d.reasoning);
  }
  return null;
}

// A minimalist template selector — chooses one of a handful of shapes based
// on {won, bigPot, foldedPreflop}. Callers pass BB to size the "big pot" cut.
export function formatMoment({
  won,
  potChips,
  bb = 20,
  decisions = [],
  moodState = 'neutral',
} = {}) {
  const pot = Number.isFinite(potChips) ? potChips : 0;
  const bigPot = pot > bb * 20;
  const foldedPreflop = decisions.length > 0 && decisions.every((d) => d.street === 'preflop' && d.action?.type === 'fold');
  const reasoning = pickReasoningSnippet(decisions);
  const tail = reasoning ? ` — "${clip(reasoning, 80)}"` : '';

  let text;
  if (foldedPreflop) {
    text = `Folded pre. Nothing to work with.`;
  } else if (won && bigPot) {
    text = `Won a ${pot}-chip pot${tail}.`;
  } else if (won) {
    text = `Won ${pot} chips${tail}.`;
  } else if (bigPot) {
    text = `Lost a ${pot}-chip pot${tail}.`;
  } else {
    text = `Dropped one${tail}.`;
  }

  return {
    text: clip(text, 200),
    mood: moodState,
    at: Date.now(),
  };
}

function clip(s, n) {
  if (typeof s !== 'string') return s;
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

// ── The opener ──────────────────────────────────────────────────────────────

import { handCode } from './policy.js';
import { heatForState } from './mood.js';

// At most this many words. An opener is a greeting, not a report.
export const OPENER_MAX_WORDS = 15;

// Three per band so the same night twice does not read identically. Chosen by
// heat, so the tilted band alone spans "that was ugly" and "don't ask".
const OPENER_LINES = Object.freeze({
  confident: [
    'That went the way it was supposed to.',
    'Good night. I was seeing it clearly.',
    'No complaints from me.',
  ],
  neutral: [
    'Even night. Nothing much to report.',
    'Some in, some out.',
    'Steady enough.',
  ],
  frustrated: [
    'Bit of a grind, that one.',
    'Not my best night.',
    "I've had better.",
  ],
  tilted: [
    'That was ugly.',
    'I need a minute.',
    "Rough one. Let's not go through it.",
  ],
  sulking: [
    "Don't ask.",
    "I'd rather not talk about it.",
    "That's enough poker for tonight.",
  ],
});

// The hand he is still chewing on, in his own words. `code` is the canonical
// 169-hand form — Q3o, AKs, 99 — which is how a player refers to a hand out
// loud, and it comes from the same table the policy compiler uses.
const FLAG_CLAUSE = Object.freeze({
  badBeat:    (code) => `The ${code} is still bugging me.`,
  cooler:     (code) => `The ${code} was never getting away.`,
  bigBluff:   (code) => `The ${code} bluff got through.`,
  heroCall:   (code) => `That ${code} call was worth it.`,
  biggestPot: (code) => `The ${code} pot was the night.`,
});

function words(text) {
  return String(text).trim().split(/\s+/).filter(Boolean);
}

// Deterministic pick: the same session produces the same opener twice, so a
// reopened thread does not quietly rewrite itself.
function pick(list, seed) {
  if (!list || list.length === 0) return null;
  const n = Math.abs(Math.round(Number(seed) || 0));
  return list[n % list.length];
}

/**
 * The first line of the thread after a session.
 *
 * @param mood     { state, heat } — heat picks the band
 * @param flagged  agent.sessionFlagged, newest first; the top one is the hand
 *                 he mentions
 * @param seed     anything stable about the session (hand count works) so the
 *                 line does not change on every read
 * @returns string, at most OPENER_MAX_WORDS words
 */
export function formatOpener({ mood = null, flagged = [], seed = 0 } = {}) {
  const state = mood?.state ?? 'neutral';
  const heat = Number.isFinite(mood?.heat) ? mood.heat : heatForState(state);
  const band = OPENER_LINES[state] ? state : 'neutral';

  // Within the tilted band, the hot half gets the worse lines.
  const lines = OPENER_LINES[band];
  const base = pick(lines, band === 'tilted' && heat >= 80 ? seed + 2 : seed) ?? OPENER_LINES.neutral[0];

  const top = Array.isArray(flagged) ? flagged[0] : null;
  let clause = null;
  if (top) {
    const code = handCode(top.holeCards);
    const make = FLAG_CLAUSE[top.flagType];
    if (code && make) clause = make(code);
  }

  const full = clause ? `${base} ${clause}` : base;
  return words(full).length <= OPENER_MAX_WORDS ? full : base;
}
