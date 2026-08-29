// src/agent/moment.js
// Deterministic template-based "moment" line, in the agent's voice, written
// after every hand it played. No extra LLM calls — pulls from the hand
// outcome + the last stored reasoning line.
//
// Shape: { text: string, mood: string, at: number }.
// Consumed by the floor UI (agent.lastMoment) — one short sentence per hand.

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
