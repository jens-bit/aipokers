// src/server/draftScript.js — BUG-198
//
// THE TEMPLATE RECRUITER'S SCRIPT. Four questions, asked in order, answered by
// tapping a chip or by saying it in your own words.
//
// This exists because of one transcript, from the guest draft:
//
//   recruiter: Tell me how he should play — loose or selective, and how often
//              you want him bluffing.
//   you:       loose
//   recruiter: Tell me how he should play — loose or selective, and how often
//              you want him bluffing.
//   you:       loose!!
//   recruiter: Tell me how he should play — loose or selective, and how often
//              you want him bluffing.
//
// The guest draft has no model behind it by design — a guest gets the product,
// not a bill — so the recruiter was `draftProfile()` over an accumulating
// brief, and that path could not read a one-word answer. `natureHintFor` needs
// TWO signals before it will commit to a character, and a single word carries
// exactly one. So "loose" was not an answer, and neither was "tight", nor
// "Often", nor any other chip label the design offers. Every miss appended the
// same fallback line, which is the recruiter asking a question it has already
// been given the answer to.
//
// Three rules the shape of this file comes from:
//
//   1. THE CHIPS ARE THE SCRIPT. The words on the chips and the words the
//      matcher understands are the same list, defined once, so a chip can never
//      be offered that the recruiter would not recognise if it were tapped.
//      That is the failure above, and it is structural rather than a bug in a
//      regex: a design that offers "Loose" and a matcher that has never heard
//      of it are two documents, and two documents drift.
//   2. NEVER RE-ASK. A miss is answered with the chips and one line that is not
//      a question. The stage does not move, but the recruiter does not repeat
//      itself either — repeating a question is how a template tells somebody
//      it is not listening.
//   3. ONE SENTENCE MAY ANSWER SEVERAL. "loose and bluffs often" is two
//      answers, and taking only the first would ask a question that has just
//      been answered. Words that more than one stage could claim go to the
//      stage actually being asked, so an answer is never put in somebody
//      else's mouth.
//
// Pure and side-effect free: no model, no clock, no store. The owner's draft is
// untouched — a Telegram owner keeps the conversational recruiter, and the
// chips ride along there as shortcuts.

/** The four stages, in the order the sheet counts them. */
export const STAGE_KEYS = Object.freeze(['style', 'bluffing', 'unsure', 'name']);

// The line for an answer nobody could read. Deliberately not a question: the
// chips under it are the question, and asking again in words is the bug.
export const MISS_LINE = 'Tap one, or say it another way.';

// ── The vocabulary ──────────────────────────────────────────────────────────
//
// One list per answer. `chip` is the word on the button and is always also a
// token, so tapping is only ever the fastest way to type. Tokens are matched
// case-insensitively as substrings, which is why they are word STEMS: "loos"
// catches loose, looser and loosely, and one entry does the work of three.
//
// The misspellings are not a spell checker. They are the handful somebody
// actually types at a phone keyboard in a hurry, each one earning its place by
// being a real thing a real person sends.

const STYLE = [
  {
    value: 'tight',
    chip: 'Tight',
    say: 'Tight',
    tokens: ['tight', 'selectiv', 'patien', 'careful', 'conservat', 'nitty', ' nit ', 'rock', 'solid', 'passive', 'cautious', 'disciplin'],
    typos: ['tigth', 'tihgt', 'selectiv', 'pasive'],
  },
  {
    value: 'balanced',
    chip: 'Balanced',
    say: 'Balanced',
    tokens: ['balanc', 'mixed', 'middle', 'medium', 'normal', 'standard', 'in between', 'even mix'],
    typos: ['blanced', 'ballanced', 'balanaced'],
  },
  {
    value: 'loose',
    chip: 'Loose',
    say: 'Loose',
    tokens: ['loos', 'wild', 'gambl', 'reckless', 'aggress', 'attack', 'pressure', 'maniac', 'any two', 'degen', 'crazy'],
    // "lose" is the misspelling of "loose" everybody makes, and in a question
    // about how he plays it has no other meaning worth protecting.
    typos: ['lose', 'agressive', 'agresive', 'aggresive', 'luce'],
  },
];

const BLUFFING = [
  {
    value: 'rarely',
    chip: 'Rarely',
    say: 'bluffs rarely',
    // The negations are spelled out rather than handled by a rule, because
    // "not often" contains "often" and the longest-token match would otherwise
    // read it as its own opposite. Each is longer than the word it negates, so
    // it wins on length — which is the whole mechanism, stated once here.
    tokens: [
      'rare', 'never', 'seldom', 'hardly', 'almost never', 'honest',
      'no bluff', "doesn't bluff", 'does not bluff',
      'not often', 'not much', 'not really', 'not a lot', 'not very',
    ],
    typos: ['rarly', 'nver', 'neve '],
  },
  {
    value: 'sometimes',
    chip: 'Sometimes',
    say: 'bluffs sometimes',
    tokens: ['sometime', 'occasional', 'now and then', 'now and again', 'moderate', 'here and there', 'balanc', 'medium'],
    typos: ['somtimes', 'sometmes', 'occassional'],
  },
  {
    value: 'often',
    chip: 'Often',
    say: 'bluffs often',
    // "bluff" is deliberately NOT here. It is the subject of the question, not
    // an answer to it, and reading it as "often" would make "rarely bluffs" and
    // "he bluffs" the same reply.
    tokens: ['often', 'a lot', 'lots', 'frequent', 'constant', 'always', 'all the time', 'loads', 'tons', 'plenty'],
    typos: ['ofen', 'offten', 'oftne', 'freqently'],
  },
];

const UNSURE = [
  {
    value: 'fold',
    chip: 'Fold',
    say: 'folds when unsure',
    tokens: ['fold', 'give up', 'muck', 'lay it down', 'let it go', 'get out', 'bail', 'away'],
    typos: ['fld', 'foldd'],
  },
  {
    value: 'call',
    chip: 'Call it down',
    say: 'calls it down',
    tokens: ['call', 'pay it off', 'pay off', 'see it', 'stay in', 'check it down', 'keep going', 'hang on'],
    typos: ['cal ', 'calll'],
  },
  {
    value: 'push',
    chip: 'Push',
    say: 'pushes when unsure',
    tokens: ['push', 'raise', 'shove', 'jam', 'all in', 'all-in', 'bet', 'attack', 'pressure', 'fire'],
    typos: ['psuh', 'pusn', 'shov'],
  },
];

/**
 * The script itself. `ask` is what the recruiter says; `options` is the whole
 * vocabulary for that stage, chips included.
 *
 * The three questions are deliberately different sentences. A stage that shared
 * a question with another stage would look exactly like the bug this file
 * exists to remove, even when the draft was working correctly.
 *
 * THE WORDING IS PORTED, NOT WRITTEN. Style and name are the recruiter's own
 * lines from `design-refs/mood-sit.jsx` (DRAFT_TALK, board 29 F02); "when he is
 * not sure" is `design-refs/mood-nav.jsx`'s NavDraftM. Only the bluffing
 * question has no authored line to port — the boards ask about squeezing versus
 * waiting to be paid there, and Jens's instruction for this queue is bluffing
 * frequency with Rarely / Sometimes / Often. That one sentence is therefore
 * ours, and is the only one in this file that is.
 */
export const STAGES = Object.freeze([
  {
    key: 'style',
    ask: 'How do you want him to play? Tight, loose, somewhere between?',
    options: STYLE,
  },
  {
    key: 'bluffing',
    ask: 'And how often should he bluff?',
    options: BLUFFING,
  },
  {
    key: 'unsure',
    ask: 'How should he play when he is not sure?',
    options: UNSURE,
  },
  {
    key: 'name',
    // The name stage offers a field with a name already in it rather than a
    // question with an empty box: a guest who has tapped three times is one tap
    // from a poker player, and "what shall we call him" is where that stalls.
    ask: 'He is ready. What do you call him?',
    options: [],
  },
]);

const BY_KEY = new Map(STAGES.map((s) => [s.key, s]));

/** The chips a stage offers, in the order the design draws them. */
export function chipsFor(key) {
  return (BY_KEY.get(key)?.options ?? []).map((o) => o.chip);
}

/** What the recruiter asks at a stage. */
export function questionFor(key) {
  return BY_KEY.get(key)?.ask ?? null;
}

/** Every token that means this option, chips and misspellings included. */
function tokensOf(option) {
  return [option.chip.toLowerCase(), ...option.tokens, ...option.typos];
}

/**
 * The best option for `body` within one stage, or null.
 *
 * Longest token wins, so "call it down" beats "call" and, more importantly, a
 * long specific phrase beats a short one it happens to contain. Ties go to the
 * option declared first, which is the order the chips are drawn in.
 */
function matchStage(stageKey, body) {
  let best = null;
  let bestLen = 0;
  for (const option of BY_KEY.get(stageKey)?.options ?? []) {
    for (const token of tokensOf(option)) {
      if (token.length > bestLen && body.includes(token)) {
        best = option;
        bestLen = token.length;
      }
    }
  }
  return best;
}

// A token that more than one stage claims cannot decide a stage nobody asked
// about — "balanced" is a style when style is the question and a bluffing
// frequency when bluffing is, and guessing wrong puts words in somebody's
// mouth.
//
// Computed rather than listed, and computed by MATCHING rather than by
// comparing strings: "balanced" and "balanc" are different tokens on different
// stages, so a set of shared spellings would have called them both unique and
// let one leak. Each token is instead run back through every stage's matcher,
// which is the same question the reader will ask at runtime. Adding a word to
// two stages therefore cannot quietly re-introduce the ambiguity.
const AMBIGUOUS = (() => {
  const every = new Set();
  for (const stage of STAGES) for (const option of stage.options) for (const t of tokensOf(option)) every.add(t);

  const ambiguous = new Set();
  for (const token of every) {
    const probe = ` ${token} `;
    let claimants = 0;
    for (const stage of STAGES) if (stage.options.length && matchStage(stage.key, probe)) claimants++;
    if (claimants > 1) ambiguous.add(token);
  }
  return ambiguous;
})();

/** The same match, but ignoring tokens another stage could also claim. */
function matchStageUnambiguously(stageKey, body) {
  let best = null;
  let bestLen = 0;
  for (const option of BY_KEY.get(stageKey)?.options ?? []) {
    for (const token of tokensOf(option)) {
      if (AMBIGUOUS.has(token)) continue;
      if (token.length > bestLen && body.includes(token)) {
        best = option;
        bestLen = token.length;
      }
    }
  }
  return best;
}

/**
 * Read whatever was said into answers.
 *
 * @param text   what the owner typed, or the chip they tapped
 * @param stage  the question actually on screen. Its own vocabulary is read
 *               first and in full, including words other stages share.
 * @returns a partial `{ style?, bluffing?, unsure? }` — empty when nothing was
 *          understood, which is the caller's cue to show the chips and say
 *          MISS_LINE rather than to ask again.
 */
export function readAnswer(text, { stage = 'style' } = {}) {
  const body = ` ${String(text ?? '').toLowerCase().trim()} `;
  const heard = {};
  if (!body.trim()) return heard;

  // The question being asked gets the whole vocabulary, ambiguity and all.
  const own = matchStage(stage, body);
  if (own) heard[stage] = own.value;

  // Every other question gets only the words that are unmistakably its own, so
  // one sentence can answer two things without ever inventing the second.
  for (const key of STAGE_KEYS) {
    if (key === stage || key === 'name' || heard[key]) continue;
    const other = matchStageUnambiguously(key, body);
    if (other) heard[key] = other.value;
  }
  return heard;
}

/**
 * What the recruiter says back, naming each fact it just took.
 *
 * The point is not politeness. A template that answers "ok" is indistinguishable
 * from a template that did not understand, and the owner's next move is to say
 * the same thing again louder. Naming it is the receipt.
 */
export function restate(heard = {}) {
  const said = [];
  for (const key of STAGE_KEYS) {
    if (key === 'name' || !heard[key]) continue;
    const option = BY_KEY.get(key).options.find((o) => o.value === heard[key]);
    if (option) said.push(option.say);
  }
  if (!said.length) return null;
  return `${said.join(', ')}. Got it.`;
}

/** The next unanswered question, or 'name' once the three are in. */
export function nextStage(answers = {}) {
  for (const key of STAGE_KEYS) {
    if (key === 'name') return 'name';
    if (!answers[key]) return key;
  }
  return 'name';
}

/** Whether the three playing questions have been answered. */
export function isComplete(answers = {}) {
  return STAGE_KEYS.every((k) => k === 'name' || Boolean(answers[k]));
}

// ── The dials ───────────────────────────────────────────────────────────────
//
// The rest of the product reads a profile, not this script's words: the nature
// ladder, the forming chip, the strategy the agent is born with. So the answers
// become the same four dials `draftProfile` has always produced, and everything
// downstream carries on unaware there was ever a script.
//
// The base is the neutral middle `natureHintFor` starts from, so a partial
// draft — which is what stage 4 renders a suggested name from — is never NaN
// and never accidentally a Rock.

const BASE = Object.freeze({ tightness: 55, aggression: 55, bluffFreq: 25, discipline: 60 });

const STYLE_DIALS = {
  tight: { tightness: 84, aggression: 44, discipline: 78 },
  balanced: { tightness: 55, aggression: 58, discipline: 65 },
  loose: { tightness: 26, aggression: 74, discipline: 42 },
};

const BLUFF_DIALS = {
  rarely: { bluffFreq: 8 },
  sometimes: { bluffFreq: 30 },
  often: { bluffFreq: 58 },
};

// What he does when he is not sure is the discipline question: folding is the
// strategy holding, pushing is the strategy going out of the window.
const UNSURE_DIALS = {
  fold: { discipline: 86 },
  call: { discipline: 62 },
  push: { discipline: 38, aggression: 82 },
};

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * The four dials for a set of answers, complete or not.
 *
 * Applied in stage order so a later answer refines an earlier one rather than
 * fighting it — the same "last word about an axis wins" rule the vague-brief
 * reader already uses.
 */
export function profileFromAnswers(answers = {}) {
  const dials = { ...BASE };
  if (answers.style && STYLE_DIALS[answers.style]) Object.assign(dials, STYLE_DIALS[answers.style]);
  if (answers.bluffing && BLUFF_DIALS[answers.bluffing]) Object.assign(dials, BLUFF_DIALS[answers.bluffing]);
  if (answers.unsure && UNSURE_DIALS[answers.unsure]) Object.assign(dials, UNSURE_DIALS[answers.unsure]);
  return {
    tightness: clamp(dials.tightness),
    aggression: clamp(dials.aggression),
    bluffFreq: clamp(dials.bluffFreq),
    discipline: clamp(dials.discipline),
  };
}

/**
 * The brief a completed script is worth, in the words the rest of the server
 * already reads. Kept so a script-built draft and a talked-out draft produce
 * the same KIND of record, rather than a second shape nothing else knows.
 */
export function briefFromAnswers(answers = {}) {
  const said = [];
  for (const key of STAGE_KEYS) {
    if (key === 'name' || !answers[key]) continue;
    const option = BY_KEY.get(key).options.find((o) => o.value === answers[key]);
    if (option) said.push(option.say.toLowerCase());
  }
  return said.join(', ');
}
