// src/agent/voice.js — PACE-1c
//
// The line under his ghost on the felt, and in the thread afterwards.
//
// What it looked like before this module existed:
//
//   "tight aggressive line—open 3bb standard"
//
// That is a solver talking to another solver. It is also, word for word, what
// the owner is shown while watching his own character play — and a character
// who narrates himself in sizing notation is not a character, he is a log line.
// What the watch design asks for is his voice:
//
//   "Ace-ten. Fine. Let's see who's home."
//
// Two mechanisms, because a prompt is a request and this has to be a
// guarantee: handler.js asks for the voice, and everything the model returns
// comes through here before anyone sees it. A line that reads as solver output
// is replaced with a template one rather than shown, and every line is capped
// at twelve words whatever the model felt like writing.
//
// Pure and deterministic: no clock, no randomness, no model call. The same
// hand and action always produce the same fallback line, so a replayed hand
// says the same thing twice.

export const VOICE_MAX_WORDS = 12;

// Phrases that mean a machine is talking. Deliberately broad on the notation
// (3bb, 75% pot, +EV) and on the vocabulary of study rather than of play: the
// cost of a false positive is one template line, and the cost of a miss is the
// product's voice.
const SOLVER_MARKERS = [
  /\d+\s*bb\b/i,                     // "open 3bb"
  /\bbb\b/i,
  /\b\d+(\.\d+)?\s*%/,               // "75% pot", "31% equity"
  /\bequit(y|ies)\b/i,
  /\bpot odds\b/i,
  /\bgto\b/i,
  /\b\+?ev\b/i,
  /\brange[sd]?\b/i,
  /\bc-?bet\b/i,
  /\bvillain\b/i,
  /\bhero\b/i,
  /\bstandard\b/i,
  /\bexploit(ative)?\b/i,
  /\bfrequenc(y|ies)\b/i,
  /\bpolarised|polarized\b/i,
  /\bvalue[- ]?bet\b/i,
  /\bfold equity\b/i,
  /\bsizing\b/i,
  /\bstack[- ]to[- ]pot|spr\b/i,
  /\bcombos?\b/i,
  /\bblockers?\b/i,
  /\bline\b/i,                       // "tight aggressive line"
  /\bnodes?\b|\bsolver\b/i,
];

export function isSolverSpeak(text) {
  const t = String(text ?? '');
  if (!t.trim()) return false;
  return SOLVER_MARKERS.some((re) => re.test(t));
}

function words(text) {
  return String(text).trim().split(/\s+/).filter(Boolean);
}

function stripWrapping(text) {
  let t = String(text ?? '').replace(/\s+/g, ' ').trim();
  // Models like to wrap a line in quotes, and to prefix it with a label.
  t = t.replace(/^(reasoning|thought|line|voice)\s*[:\-–—]\s*/i, '');
  if (t.length >= 2) {
    const a = t[0], b = t[t.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'") || (a === '“' && b === '”')) t = t.slice(1, -1).trim();
  }
  return t;
}

// Twelve words, cut at a sentence end where there is one — a line chopped
// mid-clause reads as a bug, and this is supposed to sound like a person.
export function capWords(text, max = VOICE_MAX_WORDS) {
  const t = stripWrapping(text);
  const w = words(t);
  if (w.length <= max) return t;
  const clipped = w.slice(0, max).join(' ');
  const stop = Math.max(clipped.lastIndexOf('.'), clipped.lastIndexOf('!'), clipped.lastIndexOf('?'));
  if (stop > 6) return clipped.slice(0, stop + 1);
  return `${clipped.replace(/[,;:\-–—]+$/, '')}.`;
}

// ── The fallback line ────────────────────────────────────────────────────────

const RANK_WORD = {
  A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: 'Ten',
  9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two',
};
const RANK_ORDER = 'AKQJT98765432';

/** "Ace-ten", "pocket nines", "King-four suited" — how a person says a hand. */
export function cardPhrase(holeCards) {
  if (!Array.isArray(holeCards) || holeCards.length < 2) return null;
  const [c1, c2] = holeCards.map((c) => String(c ?? ''));
  if (c1.length < 2 || c2.length < 2) return null;
  const r1 = c1[0].toUpperCase(), r2 = c2[0].toUpperCase();
  const w1 = RANK_WORD[r1], w2 = RANK_WORD[r2];
  if (!w1 || !w2) return null;
  if (r1 === r2) return `Pocket ${w1.toLowerCase()}${w1.endsWith('x') ? 'es' : 's'}`;
  const hi = RANK_ORDER.indexOf(r1) <= RANK_ORDER.indexOf(r2) ? w1 : w2;
  const lo = hi === w1 ? w2 : w1;
  const suited = c1[1] === c2[1] ? ' suited' : '';
  return `${hi}-${lo.toLowerCase()}${suited}`;
}

// One clause per action, in his register: flat, a little dry, never explaining
// itself in poker theory.
const ACTION_LINE = {
  fold:  'Not with this one.',
  check: 'I will take a free card.',
  call:  'I will pay to see one more.',
  bet:   "Let's make this expensive.",
  raise: "Let's make this expensive.",
};

/**
 * What he says when the model gave us nothing usable. Deterministic in the
 * hand and the action, so the same spot always sounds the same way.
 */
export function fallbackLine({ holeCards = null, action = null } = {}) {
  const hand = cardPhrase(holeCards);
  const verb = ACTION_LINE[action?.type] ?? 'Your move.';
  const line = hand ? `${hand}. ${verb}` : verb;
  return capWords(line);
}

/**
 * The line anyone is allowed to see.
 *
 * @returns {{ line: string, source: 'model'|'capped'|'template', reason?: string }}
 */
export function voiceLine(raw, { holeCards = null, action = null } = {}) {
  const cleaned = stripWrapping(raw);
  if (!cleaned || words(cleaned).length < 2) {
    return { line: fallbackLine({ holeCards, action }), source: 'template', reason: 'empty' };
  }
  if (isSolverSpeak(cleaned)) {
    return { line: fallbackLine({ holeCards, action }), source: 'template', reason: 'solver speak' };
  }
  const capped = capWords(cleaned);
  return { line: capped, source: capped === cleaned ? 'model' : 'capped' };
}
