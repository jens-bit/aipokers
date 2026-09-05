// src/server/draftGuard.js — ATTR-3 rider
//
// The output guard on the creation chat. It exists because of one transcript:
//
//   user: "be sporadic and chaotic"
//   user: "lets go"
//   assistant: ```python
//              class ChaoticAgent:
//                  def decide(self, state): ...
//              ```
//
// A code fence, and no agent at the end of it. Three separate failures, all of
// which this module answers:
//
//   1. The draft assistant is a RECRUITER, not a coding assistant. It writes
//      one or two plain sentences and nothing else. Prompting alone does not
//      guarantee that, so the output is checked here as well as asked for
//      there — a model that ignores the instruction is caught rather than
//      forwarded.
//   2. A vague brief is not a reason to interrogate the owner. "Sporadic and
//      chaotic" is a complete answer: it means loose, aggressive, bluffing
//      often, and not much respect for the rules. The recruiter says that back
//      in one line and moves on, rather than asking a second question the
//      owner has already answered.
//   3. When the model output cannot be used, the caller falls back to the last
//      good state of the draft. Raw model text is never shown: the whole point
//      of a guard is that what it rejects does not reach the screen.
//
// Pure and side-effect free. Everything here is deterministic: no model call,
// no clock, no store.

// One or two sentences. Sixty words is generous for that and still short
// enough that a wall of text can never arrive.
export const DRAFT_MAX_WORDS = 60;

// Markers that say "this is code, not conversation". Deliberately blunt: a
// false positive costs one canned recruiter line, a false negative puts a
// Python class in front of someone building a poker character.
const CODE_MARKERS = [
  /```/,                          // any fence, opening or closing
  /~~~/,
  /\bdef\s+\w+\s*\(/,             // python
  /\bclass\s+\w+\s*[:({]/,
  /\bimport\s+\w+/,
  /\bfrom\s+\w+\s+import\b/,
  /\bfunction\s+\w+\s*\(/,        // javascript
  /\bconst\s+\w+\s*=/,
  /\breturn\s+[\w{[]/,
  /=>\s*[{(]/,
  /\bself\./,
  /\bpublic\s+(class|static)\b/,
  /^\s*[{[][\s\S]*[}\]]\s*$/,     // a bare JSON/object blob
  /^\s*#!/,                       // shebang
  /;\s*$/m,                       // a statement-terminated line
];

// A fenced block, whatever language it claims.
const FENCE_BLOCK = /```[\s\S]*?(?:```|$)/g;

function words(text) {
  return String(text).trim().split(/\s+/).filter(Boolean);
}

// Trim to the last sentence that fits inside the word budget. Cutting mid
// sentence reads as a truncated bug; cutting at a full stop reads as brevity.
function trimToWords(text, max) {
  const w = words(text);
  if (w.length <= max) return text.trim();
  const clipped = w.slice(0, max).join(' ');
  const lastStop = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
  if (lastStop > 40) return clipped.slice(0, lastStop + 1).trim();
  return `${clipped.replace(/[,;:\-–—]+$/, '').trim()}.`;
}

/**
 * Check one assistant reply from the draft conversation.
 *
 * @returns {{ ok: boolean, text: string|null, reason: string }}
 *   ok:false means the caller must fall back — never show `text`, there is none.
 */
export function sanitizeDraftReply(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, text: null, reason: 'empty' };

  // A reply that is *mostly* a fenced block is code with an apology on top.
  // Strip the fences first, then judge what is left on its own merits.
  const withoutFences = raw.replace(FENCE_BLOCK, ' ').trim();
  if (FENCE_BLOCK.test(raw) && words(withoutFences).length < 4) {
    return { ok: false, text: null, reason: 'code fence' };
  }
  FENCE_BLOCK.lastIndex = 0;

  const body = withoutFences || raw;
  for (const re of CODE_MARKERS) {
    if (re.test(body)) return { ok: false, text: null, reason: 'looks like code' };
  }

  // Multi-line output with indentation is a listing of some kind, not a line
  // of conversation.
  if (/\n[ \t]{2,}\S/.test(body)) return { ok: false, text: null, reason: 'indented block' };

  const text = trimToWords(body.replace(/\s+/g, ' '), DRAFT_MAX_WORDS);
  if (words(text).length < 2) return { ok: false, text: null, reason: 'too short' };
  return { ok: true, text, reason: 'ok' };
}

/** The most recent assistant turn that would still pass the guard, or null. */
export function lastGoodDraft(chat = []) {
  for (let i = chat.length - 1; i >= 0; i--) {
    const m = chat[i];
    if (m?.role !== 'assistant') continue;
    const clean = sanitizeDraftReply(m.content);
    if (clean.ok) return clean.text;
  }
  return null;
}

// ── "Go" ─────────────────────────────────────────────────────────────────────
// The owner saying he is done briefing. Short, unpunctuated and impatient by
// nature — "lets go", "go", "do it", "ship it" — so the test is deliberately
// forgiving about apostrophes and trailing punctuation, and deliberately
// strict about length: a GO signal is never a sentence with new instructions
// in it.
const GO_PATTERNS = [
  /^(lets?'?s?\s+go|go|go\s+on|go\s+ahead)$/,
  /^(do|build|make|ship|send|run)\s*(it|him|them|that)?$/,
  /^(yes|yep|yeah|yup|ok|okay|sure|fine|perfect|great|sounds?\s+good|that'?s?\s+it|done|ready)$/,
  /^(build|create|make)\s+(the\s+)?agent$/,
];

export function isGoSignal(text) {
  const t = String(text ?? '').trim().toLowerCase().replace(/[.!?,]+$/, '');
  if (!t || words(t).length > 4) return false;
  return GO_PATTERNS.some((re) => re.test(t));
}

// ── A vague brief is still a brief ───────────────────────────────────────────
// Each entry is a way of saying "I do not want a careful player", and each maps
// to the four sliders directly. The recruiter answers with `line` — the mapping
// said out loud, so the owner can correct it — instead of asking again.
const VAGUE_BRIEFS = [
  {
    key: 'chaotic',
    re: /\b(chaot|sporadic|random|erratic|unpredictab|wild|crazy|insane|mental|bonkers|degen|maniac|reckless|nuts)\w*/i,
    profile: { tightness: 15, aggression: 90, bluffFreq: 60, discipline: 20 },
    line: 'Chaos it is — he plays almost anything, bets and raises constantly, bluffs often, and treats the strategy as a suggestion.',
    name: 'Loose Cannon',
    strategy: 'You are a chaotic, unpredictable player. You enter almost every pot, bet and raise relentlessly, and bluff far more often than anyone expects. You deliberately vary your sizing so nobody can put you on a hand, and you would rather be wrong loudly than right quietly.',
  },
  {
    key: 'scary',
    re: /\b(scary|terrif|brutal|ruthless|savage|monster|beast|nightmare|bully)\w*/i,
    profile: { tightness: 35, aggression: 92, bluffFreq: 45, discipline: 55 },
    line: 'Something to be scared of — heavy aggression, frequent bluffs, and enough discipline to keep the pressure pointed somewhere.',
    name: 'The Bully',
    strategy: 'You are a relentless bully. You apply maximum pressure with big bets and raises, attack anyone who shows weakness, and make every pot expensive to contest. You bluff often, but you pick the spots where the pressure has somewhere to land.',
  },
  {
    key: 'smart',
    re: /\b(smart|clever|genius|brilliant|sharp|thinking|intelligent)\w*/i,
    profile: { tightness: 70, aggression: 68, bluffFreq: 28, discipline: 85 },
    line: 'A thinker, then — selective about hands, aggressive when he is in one, and disciplined enough to stick to it.',
    name: 'The Professor',
    strategy: 'You are a disciplined, calculating player. You are selective about the hands you enter, aggressive once you are in one, and you value bet thinly and precisely. You follow your plan closely and only deviate when the maths genuinely says to.',
  },
  {
    key: 'boring',
    re: /\b(boring|safe|solid|steady|careful|patient|rock|nit|conservat)\w*/i,
    profile: { tightness: 88, aggression: 45, bluffFreq: 8, discipline: 88 },
    line: 'Patient it is — he folds most hands, waits for the good ones, and almost never bluffs.',
    name: 'The Rock',
    strategy: 'You are a patient, disciplined player. You fold the overwhelming majority of your hands and wait for premium holdings. When you finally commit chips you do it for value, and you almost never bluff.',
  },
  {
    key: 'fun',
    re: /\b(fun|entertain|showman|flashy|show\s*off|dramatic|spicy)\w*/i,
    profile: { tightness: 30, aggression: 80, bluffFreq: 55, discipline: 40 },
    line: 'One for the crowd — loose, aggressive and bluffing often, which is entertaining right up until it is expensive.',
    name: 'The Showman',
    strategy: 'You are playing to the room. You enter pots liberally, bet and raise for effect as much as for value, and bluff often enough that nobody is ever comfortable. You would rather make a memorable play than a safe one.',
  },
];

/**
 * Read a vague brief as sliders. Returns { key, profile, line } or null.
 * Last match wins, so a brief that drifts ends on its most recent word.
 */
export function slidersFromBrief(text) {
  const body = String(text ?? '');
  if (!body.trim()) return null;
  let hit = null;
  let at = -1;
  for (const v of VAGUE_BRIEFS) {
    const m = body.match(v.re);
    if (m && m.index >= at) { hit = v; at = m.index; }
  }
  return hit
    ? { key: hit.key, profile: { ...hit.profile }, line: hit.line, name: hit.name, strategy: hit.strategy }
    : null;
}

// The recruiter's reply when nothing else can be said: a real question about
// play, never an apology and never "something went wrong".
export const DRAFT_FALLBACK_LINE =
  'Tell me how he should play — loose or selective, and how often you want him bluffing.';

/**
 * The reply the draft turn should actually send.
 *
 * Order of preference: a clean model reply; the mapping line for a vague brief
 * the model fumbled; the last good thing the recruiter said; a plain question.
 * Raw model text never reaches the caller.
 */
export function draftReply({ raw = null, brief = null, chat = [] } = {}) {
  const clean = sanitizeDraftReply(raw);
  if (clean.ok) return { text: clean.text, source: 'model' };

  const vague = slidersFromBrief(brief);
  if (vague) return { text: vague.line, source: `brief:${vague.key}`, guarded: clean.reason };

  const last = lastGoodDraft(chat);
  if (last) return { text: last, source: 'last-good', guarded: clean.reason };

  return { text: DRAFT_FALLBACK_LINE, source: 'fallback', guarded: clean.reason };
}
