// src/agent/ownerInstructions.js — LIFE-1 job 3
//
// What you TOLD him.
//
// "If you chat to them about specific plans and stuff like that, they won't
// properly remember it." They will not, and the reason is structural rather
// than a tuning problem: the only two things carried into a later conversation
// were `chatHistory` — the last SIX messages, which a plan made on Tuesday
// falls out of by Tuesday evening — and `ownerMemory`, which is deliberately
// not this. ownerMemory is HIS READ ON YOU ("calls me an idiot when I lose"),
// paraphrased on purpose so that retuning a line does not rewrite history. A
// paraphrase of "from now on only play the low room" is worthless: the whole
// value of an instruction is its content.
//
// So this is the fourth book, beside poker (self-stats), opponents (the ring)
// and the owner ledger (ownerMemory): the standing instructions and plans, in
// YOUR words, newest first, bounded.
//
// FIVE RULES the shape comes from.
//
//   1. VERBATIM, CLIPPED — never paraphrased. The opposite of ownerMemory's
//      rule, for the opposite reason. "Play tighter from the blinds" cannot
//      survive being turned into "told me how to play"; what he has to be able
//      to do later is QUOTE it back.
//   2. ONLY FROM A MESSAGE THE OWNER SENT. Same guardrail ownerMemory has, and
//      the same reason: there is no writer here that a clock, a silence or an
//      unopened recap can reach. The only entry point takes a string the owner
//      typed.
//   3. AN INSTRUCTION OR A PLAN, NOTHING ELSE. A greeting is not an
//      instruction, a question is not an instruction, and an insult is not an
//      instruction. classify() returns null for all three and writes nothing —
//      a memory that fills up with "hey" holds nothing worth remembering.
//   4. BOUNDED, AND NEWEST FIRST. OWNER_INSTRUCTIONS_MAX entries, oldest
//      evicted. Newest first is not only a display order: it is how a later
//      instruction outranks an earlier one without this file having to
//      understand that "actually play looser" contradicts "play tighter".
//      He is told the order and can say so himself.
//   5. DETERMINISTIC. No model call anywhere in this file, on the write side
//      or the read side. It runs on the owner-chat path, which is already
//      paying for one call; a second one to decide whether the first was worth
//      remembering would be the most expensive way possible to store a
//      sentence.
//
// Storage is the agent record (`agent.ownerInstructions`), so it rides the
// existing save seam and needs no table of its own — exactly as ownerMemory
// does.

// How many he keeps. Eight rather than ownerMemory's twelve: these are longer
// lines (a whole instruction, not a clause), they go into every prompt, and a
// standing order list nobody can hold in their head is not a standing order
// list. Eight is about as many things as a person will actually have told him.
export const OWNER_INSTRUCTIONS_MAX = 8;

// How much of one line survives. Long enough for a real instruction with a
// reason attached; short enough that eight of them are a paragraph and not a
// transcript.
export const INSTRUCTION_MAX_CHARS = 140;

// The three kinds, and what each is for. `kind` is never shown to the owner —
// it exists so the prompt can introduce a list of orders differently from a
// list of arrangements, and so a test can assert on the classification rather
// than on the regex that produced it.
export const KINDS = Object.freeze(['instruction', 'plan', 'agreement']);

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

const clip = (s, n = INSTRUCTION_MAX_CHARS) => {
  const t = clean(s);
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
};

// A question is not an instruction, even when it is shaped like one ("should I
// play tighter?"). Checked before everything else, because several of the
// patterns below would otherwise match the inside of a question.
const QUESTION = /\?\s*$/;

// Nor is an insult, a greeting or small talk. These are ownerMemory's
// business, and it already writes them.
const NOT_AN_INSTRUCTION = [
  /^\s*(?:hi|hello|hey|hiya|yo|good\s+(?:morning|afternoon|evening|night))\b[\s,.!]*$/i,
  /^\s*(?:thanks|thank you|ok|okay|nice|cool|lol|haha|sure|yes|no|yeah|nah)\b[\s,.!]*$/i,
];

// ── The patterns ────────────────────────────────────────────────────────────
//
// Ordered, first match wins, and the order is the priority: an explicit
// "remember that …" is an instruction however it is phrased, and a plan that
// is also an imperative ("from now on play the low room") is a plan, because
// what makes it worth keeping is the standing arrangement rather than the verb.
//
// Each pattern is anchored at the start of a clause rather than searched for
// anywhere in the sentence. "I hate it when you fold" contains "you fold" and
// is not an instruction; "fold more" at the head of a clause is.
const PATTERNS = [
  // "remember that X", "keep in mind X", "don't forget X" — he was told to
  // remember it in so many words, which settles the question.
  { kind: 'instruction', re: /(?:^|[.;,]\s*)(?:please\s+)?(?:remember|keep in mind|don'?t forget|bear in mind)\b/i },

  // Arrangements with a horizon. "from now on", "tomorrow", "next session",
  // "tonight we", "this week", "later we".
  { kind: 'plan', re: /(?:^|[.;,]\s*)(?:from now on|going forward|in future|in the future|next (?:time|session|game|night)|tomorrow|tonight|this (?:week|weekend|evening)|later on|after (?:this|tonight|that))\b/i },

  // Joint intent. "let's grind the low room", "we're going to try X",
  // "we should stick to", "we'll play".
  { kind: 'plan', re: /(?:^|[.;,]\s*)(?:let'?s|we(?:'| a)?re going to|we will|we'?ll|we should|we need to|our plan is)\b/i },

  // A deal struck. "if you X then I'll Y", "deal", "you promised", "agreed".
  // "I'll buy you a snack" is a promise wherever in the sentence it lands - it
  // is nearly always the back half of one ("if you win tonight, I'll ..."), so
  // that half of this pattern is deliberately not clause-anchored.
  { kind: 'agreement', re: /(?:^|[.;,]\s*)(?:deal\b|agreed\b|it'?s a deal|you promised|i promise)|i'?ll (?:let you|get you|give you|buy you|front you)/i },

  // The plain imperative, about poker or about him. A verb at the head of a
  // clause, addressed to him. Deliberately a NAMED LIST rather than "any verb":
  // an open-ended imperative matcher turns half of ordinary conversation into
  // a standing order.
  // The optional adverb is the short list of things people put in front of an
  // imperative - "actually play looser", "just fold those", "maybe try the low
  // room". Without it the commonest way an owner CORRECTS an earlier
  // instruction is the one shape that does not register as an instruction.
  { kind: 'instruction', re: /(?:^|[.;,]\s*)(?:actually|just|maybe|now|also|instead)?\s*(?:please\s+)?(?:play|fold|call|raise|bet|check|bluff|stop|start|keep|stay|try|avoid|watch|target|stick|focus|tighten|loosen|slow|speed|quit|leave|sit|be|get|go|take|use|don'?t|do not|never|always)\b/i },

  // "you should X", "you need to X", "I want you to X", "make sure you X".
  { kind: 'instruction', re: /(?:^|[.;,]\s*)(?:you (?:should|need to|have to|must|ought to)|i want you to|i'?d like you to|make sure (?:you|to))\b/i },
];

/**
 * What kind of thing this message is, or null when it is none of them.
 *
 * Pure, and the only decision in this file. Everything downstream is storage.
 */
export function classify(text) {
  const t = clean(text);
  if (!t) return null;
  if (QUESTION.test(t)) return null;
  for (const re of NOT_AN_INSTRUCTION) if (re.test(t)) return null;
  for (const { kind, re } of PATTERNS) if (re.test(t)) return kind;
  return null;
}

// ── The list ────────────────────────────────────────────────────────────────

export function ensureOwnerInstructions(agent) {
  if (!Array.isArray(agent.ownerInstructions)) agent.ownerInstructions = [];
  return agent.ownerInstructions;
}

// For deduplication only. Case and punctuation are noise when deciding whether
// you have said the same thing twice; they are not noise in what is stored,
// which is why the ORIGINAL text is kept and only the key is flattened.
const keyOf = (text) => clean(text).toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim();

/**
 * Record one thing the owner said, if it is worth recording.
 *
 * Returns the stored entry, or null when the message was not an instruction or
 * a plan — which is most messages, and is the point.
 *
 * Saying the same thing twice does not make two memories; it moves the one
 * memory to the front and counts it. An owner who has told him three times to
 * stop calling down light has told him something about how much it matters,
 * and that is worth carrying even though the sentence is unchanged.
 */
export function recordOwnerInstruction(agent, text, { now = Date.now() } = {}) {
  if (!agent) return null;
  const kind = classify(text);
  if (!kind) return null;
  const stored = clip(text);
  if (!stored) return null;

  const list = ensureOwnerInstructions(agent);
  const key = keyOf(stored);
  const at = list.findIndex((e) => keyOf(e.text) === key);
  if (at !== -1) {
    const [existing] = list.splice(at, 1);
    existing.count = (existing.count ?? 1) + 1;
    existing.ts = now;
    existing.kind = kind;
    list.unshift(existing);
    return existing;
  }

  const entry = { ts: now, kind, text: stored, count: 1 };
  list.unshift(entry);
  // Newest first, so the eviction is off the END. Rule 4: a later instruction
  // outranks an earlier one by being nearer the top, and the oldest thing you
  // ever said is the first thing he lets go of.
  if (list.length > OWNER_INSTRUCTIONS_MAX) list.length = OWNER_INSTRUCTIONS_MAX;
  return entry;
}

/** The list, newest first, safe on a record that has never had one. */
export function ownerInstructions(agent) {
  return Array.isArray(agent?.ownerInstructions) ? agent.ownerInstructions : [];
}

// When it was said, in the words a person would use. Deliberately coarse: the
// difference between 41 and 44 hours ago is not something he should sound
// certain about, and "two days ago" is what somebody actually says.
export function whenSaid(ts, now = Date.now()) {
  // null is NOT the epoch, whatever `Number(null)` says — dips.js's own note.
  // Here it would render an absent timestamp as "2810 weeks ago", which is a
  // confident claim about when you said something you never said.
  if (ts === null || ts === undefined || ts === '') return '';
  const at = Number(ts);
  if (!Number.isFinite(at)) return '';
  const mins = Math.floor((now - at) / 60_000);
  if (mins < 0) return 'just now';
  if (mins < 5) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'last week' : `${weeks} weeks ago`;
}

/**
 * The prompt block, or '' when he has been told nothing.
 *
 * Two things it has to do that a bare list would not. It has to say these are
 * YOUR OWNER'S WORDS rather than his own conclusions, or the model blends them
 * into the strategy and starts attributing them to itself. And it has to say
 * that the newest wins, or an agent told to tighten on Monday and loosen on
 * Friday reports both with equal confidence and sounds like he has not been
 * listening to either.
 */
export function ownerInstructionsContext(agent, { now = Date.now() } = {}) {
  const list = ownerInstructions(agent);
  if (list.length === 0) return '';
  const lines = list
    .map((e) => {
      const again = (e.count ?? 1) > 1 ? `, told you ${e.count} times` : '';
      return `- (${whenSaid(e.ts, now)}${again}) "${e.text}"`;
    })
    .join('\n');
  return `

WHAT YOUR OWNER HAS TOLD YOU — his standing instructions, plans and the deals
you have struck, newest first. These are HIS OWN WORDS, not your conclusions.
Newest wins where two of them conflict. Take them seriously: follow them at the
table, bring one up yourself when it is relevant to what he just said, and say
plainly whether it has been working. Never claim to have been told something
that is not on this list.
${lines}`;
}
