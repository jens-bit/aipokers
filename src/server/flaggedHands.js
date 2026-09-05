// src/server/flaggedHands.js — FLAG-1
// Classifies completed hands into notable types for the floor's hand-review
// sheet. Pure functions only; side-effect-free — callers in table.js handle
// storage and table.sessionBiggestPot tracks the session ceiling.

// ── Thresholds ────────────────────────────────────────────────────────────────
// All dials in one block. These will be tuned after playtesting.
export const THRESHOLDS = {
  // BIG BLUFF: agent bet/raised with low equity and opponent folded
  BLUFF_MAX_EQUITY: 0.40,      // equity < 40% on the aggressive action

  // BAD BEAT: agent lost at showdown as a heavy favourite
  BAD_BEAT_MIN_EQUITY: 0.70,   // had > 70% equity at some point this hand

  // HERO CALL: agent called aggression with marginal equity and won at showdown
  HERO_CALL_MIN_EQUITY: 0.28,  // > 28% — above pure bluff-catcher territory
  HERO_CALL_MAX_EQUITY: 0.50,  // < 50% — a coin-flip favourite is a standard call

  // COOLER: agent lost showdown with competitive equity (both players were strong)
  COOLER_MIN_EQUITY: 0.52,     // had > 52% — slight favourite but lost to a big hand

  // Session list cap — only the most recent MAX_FLAGGED hands are kept
  MAX_FLAGGED: 10,
};

// Format a raw action object into a readable display label for the review sheet.
function fmtAction(action) {
  if (!action) return '?';
  const { type, amount } = action;
  if (type === 'bet')   return Number.isFinite(amount) ? `BET ${amount}` : 'BET';
  if (type === 'raise') return Number.isFinite(amount) ? `RAISE ${amount}` : 'RAISE';
  if (type === 'call')  return Number.isFinite(amount) ? `CALL ${amount}` : 'CALL';
  if (type === 'check') return 'CHECK';
  if (type === 'fold')  return 'FOLD';
  return String(type).toUpperCase();
}

// Classify a completed hand for one agent. Returns a flag-type string or null.
//
//   won              — whether the agent won the hand
//   resultType       — 'showdown' | 'fold'
//   decisions        — currentHandDecisions filtered to this agent's seat
//   pot              — final pot size in chips
//   sessionBiggestPot — largest pot seen so far this session (before this hand)
export function classifyHand({ won, resultType, decisions, pot, sessionBiggestPot }) {
  // BIGGEST POT: always supersedes drama flags — the session high-water mark.
  if (Number.isFinite(pot) && pot > (sessionBiggestPot ?? 0)) return 'biggestPot';

  if (!Array.isArray(decisions) || decisions.length === 0) return null;

  const maxEquity = decisions.reduce(
    (m, d) => (Number.isFinite(d.equity) && d.equity > m ? d.equity : m),
    0
  );

  // Lost at showdown
  if (!won && resultType === 'showdown') {
    if (maxEquity > THRESHOLDS.BAD_BEAT_MIN_EQUITY) return 'badBeat';
    if (maxEquity > THRESHOLDS.COOLER_MIN_EQUITY)   return 'cooler';
  }

  // Won when opponent folded — look for a low-equity aggressive action
  if (won && resultType === 'fold') {
    const bluffedLow = decisions.some(
      (d) =>
        (d.action?.type === 'bet' || d.action?.type === 'raise') &&
        Number.isFinite(d.equity) &&
        d.equity < THRESHOLDS.BLUFF_MAX_EQUITY
    );
    if (bluffedLow) return 'bigBluff';
  }

  // Won at showdown — look for a marginal call that paid off
  if (won && resultType === 'showdown') {
    const heroCalledMarginal = decisions.some(
      (d) =>
        d.action?.type === 'call' &&
        Number.isFinite(d.equity) &&
        d.equity >= THRESHOLDS.HERO_CALL_MIN_EQUITY &&
        d.equity < THRESHOLDS.HERO_CALL_MAX_EQUITY
    );
    if (heroCalledMarginal) return 'heroCall';
  }

  return null;
}

// Build the stored flagged-hand entry. holeCards are always persisted but the
// GET route exposes them only to the proven owner (mirrors AGE-33 heroHole law).
// opponentShowdownCards contains revealed cards from an actual showdown
// (public information — mucked/folded cards are never stored here).
//
//   flagType              — from classifyHand()
//   decisions             — currentHandDecisions for this agent's seat
//   handNumber            — game hand counter
//   pot                   — final pot chips
//   holeCards             — agent's two hole-card strings e.g. ['Ah', 'Kd']
//   won                   — agent won the hand
//   opponentShowdownCards — [{ seat, holeCards }] for opponents revealed at showdown
//   attrCosts             — ATTR-3 [{ key, line, street?, cost? }]: where an
//                             attribute shaped this hand, in his voice. Built by
//                             attrCostsForHand; passed in rather than computed
//                             here so this module stays free of character logic.
export function buildFlaggedEntry({ flagType, decisions, handNumber, pot, holeCards, won, opponentShowdownCards = [], attrCosts = [] }) {
  const streets = (decisions ?? []).map((d) => ({
    street:    d.street    ?? 'preflop',
    board:     Array.isArray(d.community) ? [...d.community] : [],
    action:    fmtAction(d.action),
    equity:    Number.isFinite(d.equity)   ? Math.round(d.equity * 100) : null,
    potOdds:   Number.isFinite(d.potOdds)  ? Math.round(d.potOdds * 100) : null,
    reasoning: typeof d.reasoning === 'string' ? d.reasoning.slice(0, 300) : null,
  }));

  return {
    flagType,
    handNumber: handNumber ?? 0,
    pot:        Number.isFinite(pot) ? pot : 0,
    holeCards:  Array.isArray(holeCards) ? [...holeCards] : [],
    opponentShowdownCards: Array.isArray(opponentShowdownCards)
      ? opponentShowdownCards.map(({ seat, holeCards: cards }) => ({
          seat,
          holeCards: Array.isArray(cards) ? [...cards] : [],
        }))
      : [],
    won:        !!won,
    streets,
    attrCosts:  Array.isArray(attrCosts) ? attrCosts : [],
    flaggedAt:  Date.now(),
  };
}
