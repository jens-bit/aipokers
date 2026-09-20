// An explicit owner instruction is separate from personality sliders. This
// deliberately recognizes only unconditional all-in play, not general risk.
export const ALL_IN_EVERY_HAND = 'all-in-every-hand';
export const ALL_IN_EVERY_HAND_STRATEGY = 'Move all in on every hand at the first legal opportunity. '
  + 'If a raise is unavailable, call the legal amount or check when nothing is owed.';

// BUG-223's saved fallback predates the legal call/check qualification. Keep
// those existing companions literal while applying today's legal offer.
const LEGACY_ALL_IN_STRATEGY = 'You move all in. That is the whole strategy and you do not deviate from it: '
  + 'whenever it is your turn and you have chips, you put every one of them in the middle, '
  + 'preflop or otherwise, with any two cards. You never call and you never make a small '
  + 'raise. If the only legal move is to check, you check, and then you shove on the next '
  + 'street. You are not bluffing and you are not value betting - you are making every pot '
  + 'a decision for your opponent and nothing else.';

const normalize = value => typeof value === 'string'
  ? value.normalize('NFKC').toLowerCase().replace(/([a-z])’(?=[a-z])/g, "$1'")
    .replace(/[‐‑‒–—-]/g, ' ').replace(/[^\S\n]+/g, ' ').trim()
  : '';
const known = new Set([ALL_IN_EVERY_HAND_STRATEGY, LEGACY_ALL_IN_STRATEGY].map(normalize));

export function explicitAllInIntent(strategy) {
  const text = normalize(strategy);
  if (!text || text.length > 6000) return false;
  if (known.has(text.replace(/\s+/g, ' '))) return true;
  const move = '(?:all\\s*in|shov(?:e|es|ing)|jam(?:s|ming)?|ship it|(?:put|push|move|commit)\\s+(?:(?:your|his|my|the)\\s+)?(?:entire|whole|full)\\s+stack)';
  const action = new RegExp(`\\b${move}\\b`);
  const negative = /\b(?:not|never|no|cannot|avoid|stop|refuse|without|don'?t|doesn'?t|didn'?t|won'?t|wouldn'?t|shouldn'?t|couldn'?t|can'?t|isn'?t|aren'?t|wasn'?t|weren'?t)\b/;
  const qualified = new RegExp(`\\b(?:sometimes|occasionally|rarely|usually|nearly|almost|often|frequently|might|may)\\s+(?:(?:go|goes|move|moves|always|ever|just|be|going|to)\\s+){0,4}${move}\\b`);
  const frequency = /\b(?:(?:each|every)\s+(?:single\s+|legal\s+)?(?:hand|deal|time|opportunity|chance)|all the time|always|constantly|(?:any\s*two(?:\s+cards)?)[,\s]+(?:at\s+)?any\s*time|whenever\s+(?:it is\s+)?(?:your|his|my)\s+turn|regardless\s+(?:of\s+)?(?:(?:the|your|his|my)\s+)?cards)\b/;
  let intent = false;
  // Evaluate only clauses about all-in play. A later explicit restriction
  // revokes an earlier mandate; an unrelated slider answer ('Often') does
  // not. Newlines are turn boundaries from the owner's saved draft brief.
  for (const line of text.split(/[.!;\n]+|\b(?:but|however)\b/)) {
    if (/[?"“”‘’]|(?:^|\s)'[^']*'/.test(line)
      || /\b(?:opponent|opponents|villain|example|named|name is|called|calls himself|call him)\b/.test(line)
      || /\b(?:what|why|whether|suppose|imagine)\b/.test(line)
      || /^\s*(?:should|could|would|can|do|does|did|will|is|are)\s+(?:i|you|he|she|we|they|it|an?|my)\b/.test(line)) continue;
    // A follow-up may revoke the prior instruction without repeating it.
    // These are explicit changes, not ordinary slider answers like 'Often'.
    if (/\b(?:only\s+(?:with|when|if)|stop\s+(?:doing\s+)?(?:that|it)|instead\s+(?:play|be|make|go)|(?:forget|cancel)\s+(?:that|it)|no\s+(?:longer|more)|not\s+anymore|don'?t\s+do\s+that)\b/.test(line)) {
      intent = false; continue;
    }
    if (!action.test(line)) continue;
    if (negative.test(line) || qualified.test(line)
      || /\b(?:unless|except|if|when|only|provided|assuming|depending)\b/.test(line)
      || /\b(?:nearly|almost|most)\s+(?:every|each|all|hands)\b/.test(line)
      || /\bwith\s+(?:aces|kings|queens|premiums|nuts|strong|good)\b/.test(line)) { intent = false; continue; }
    if (frequency.test(line)) intent = true;
  }
  return intent;
}

// The server has already narrowed this offer to engine-legal actions. A
// raise amount is the STREET TOTAL, including chips already committed.
export function allInStrategyAction(gs) {
  if (gs?.policy?.intent !== ALL_IN_EVERY_HAND) return null;
  if (gs.canRaise && Number.isInteger(gs.maxRaise) && gs.maxRaise > 0) return { type: 'raise', amount: gs.maxRaise };
  if (gs.canBet && Number.isInteger(gs.maxBet) && gs.maxBet > 0) return { type: 'bet', amount: gs.maxBet };
  if (Number(gs.toCall) > 0) return { type: 'call' };
  if (gs.canCheck) return { type: 'check' };
  return null;
}
