// src/agent/talk.js — LIFE-1 job 5 (TALK-2)
//
// How he talks to you.
//
// THE FINDING, and it is the one that matters most: "talking to them is the
// weakest part of the product". The example given is "Yeah, whatever, I'm
// filming" — a reply that answers nothing, knows nothing, concedes nothing and
// could have been produced without reading the question.
//
// TALK-2 does not exist in this repo (grep: TLK-1 and TLK-2 are TABLE talk,
// which is a different thing — a bubble over a seat during a hand). So this is
// it, and it is built out of three parts rather than one bigger instruction,
// because "write better replies" is not something a prompt can be told:
//
//   1. THE FACTS. He cannot cite his last hand if his last hand is not in the
//      prompt. Before this, owner chat carried "won 200-chip pot, lost
//      400-chip pot" — three outcomes with no cards, no street, no opponent
//      and no line — so an agent asked what happened had literally nothing to
//      say and said something evasive instead. selfFacts() puts the real hands
//      in, with what he held and what he did.
//   2. THE LAWS. Four clauses that name the failure they exist to stop, each
//      with the shape of the bad reply written out. A law the model can match
//      against a concrete example is followed; "be more engaging" is not.
//   3. THE GATE. Deterministic, after the call, no second call. It grades the
//      reply against the same four laws and repairs it from the facts when it
//      fails. A prompt is a request; this is the part that is not optional.
//
// COST. Nothing here calls a model, on either side. The gate runs on strings
// that have already been paid for, and the repair is a template. The cost
// router is untouched: owner chat is one call per owner message exactly as it
// was, and table talk's one-call-per-watched-hand rule is in handTalk.js and
// is not touched by this file.
//
// ONE RULE ABOUT THE REPAIR, because it is the part that could go wrong. It
// never invents a fact. Every repair line is built from a value that was
// already in the prompt — the hand, the result, the state — or it is a plain
// admission that he does not know. A fallback that guessed would be a worse
// failure than the flat reply it replaced.

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// Words too common to count as answering anything.
const STOP = new Set(('a an the and or but if of to in on at for with from by is are was were be been '
  + 'am do did does you your yours i me my mine he him his they them it its that this those these '
  + 'what why how when where who which can could should would will have has had not no yes so '
  + 'about into out up down over there here then than as we us our').split(' '));

function contentWords(text) {
  return new Set(clean(text).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w)));
}

// ── Shapes ──────────────────────────────────────────────────────────────────
//
// "No two consecutive replies with the same shape." Shape is not topic and it
// is not length: it is the FORM the answer takes. Two replies that are both a
// shrug are the same reply however different their nouns, and that sameness is
// what makes a character read as a lookup table.
//
// Six, and they are ordered as a priority ladder because a real sentence can
// be two of them at once — "dunno, what do you think?" is a deflection wearing
// a question, and it is the deflection that matters.
export const SHAPES = Object.freeze([
  'deflection',   // says nothing and moves on
  'concession',   // takes the point: "fair", "you're right", "I'll try it"
  'question',     // ends by asking him something
  'retort',       // short and sharp, pushes back
  'twoBeat',      // two clauses: a fact and a consequence
  'statement',    // the plain default
]);

// The vocabulary of not answering. Deliberately a closed list of the actual
// forms rather than a sentiment guess: "whatever", "anyway", "dunno", "sure",
// "if you say so", and the bare brush-off.
const DEFLECTION = /^(?:yeah,?\s*)?(?:whatever|anyway|sure|ok(?:ay)?|fine|dunno|i dunno|i don'?t know|nothing|nope|nah|maybe|we'?ll see|if you say so|it is what it is|same as always)\b/i;

// …and the same thing hiding at the end of a sentence.
const TRAILING_SHRUG = /\b(?:whatever|anyway|it is what it is|same as always|if you say so)\b[\s.!]*$/i;

const CONCESSION = /\b(?:fair (?:enough|point)|you'?re right|point taken|i'?ll (?:try|do|take|work on|give)|noted|good (?:call|point)|that'?s on me|my (?:fault|mistake)|i should have|i'?ll stop|i hear you)\b/i;

const RETORT = /^(?:no\b|not\b|wrong\b|hardly\b|come on\b|please\b|really\?)/i;

// A reply that OPENS with a shrug word but then says something real is not a
// deflection — "Whatever that was, I am still down 1450" is an answer with a
// shrug on the front of it, and grading it as a brush-off would train the
// character out of exactly the dry delivery the product wants. The test is
// substance: a figure, or four content words of its own.
function hasSubstance(t) {
  if (/\d/.test(t)) return true;
  return contentWords(t).size >= 4;
}

/** The form a reply takes. Pure, and total — every string gets a shape. */
export function shapeOf(text) {
  const t = clean(text);
  if (!t) return 'statement';
  if ((DEFLECTION.test(t) || TRAILING_SHRUG.test(t)) && !hasSubstance(t)) return 'deflection';
  if (CONCESSION.test(t)) return 'concession';
  if (/\?\s*$/.test(t)) return 'question';
  if (RETORT.test(t) && t.length <= 60) return 'retort';
  // Two clauses joined by a real hinge: a fact and what follows from it.
  if (/[,;:—-]\s|\b(?:so|because|but|though|and then)\b/i.test(t) && t.length > 40) return 'twoBeat';
  return 'statement';
}

// How many of his own previous shapes he is held to. Two: the rule is "no two
// CONSECUTIVE replies with the same shape", and keeping two lets the prompt
// name both so he does not simply alternate between the same pair forever.
export const SHAPE_MEMORY = 2;

export function ensureShapes(agent) {
  if (!Array.isArray(agent.lastReplyShapes)) agent.lastReplyShapes = [];
  return agent.lastReplyShapes;
}

/** Remember the shape he just used. Bounded at SHAPE_MEMORY, newest first. */
export function noteShape(agent, text) {
  if (!agent) return [];
  const shapes = ensureShapes(agent);
  shapes.unshift(shapeOf(text));
  if (shapes.length > SHAPE_MEMORY) shapes.length = SHAPE_MEMORY;
  return shapes;
}

// ── Was it a question, and did he answer it? ────────────────────────────────

const QUESTION_WORD = /\b(?:what|why|how|when|where|who|which|did|do|does|are|is|was|were|can|could|should|would|will|have|has)\b/i;

/** Did the owner actually ask something? */
export function isQuestion(said) {
  const t = clean(said);
  return /\?/.test(t) || (QUESTION_WORD.test(t) && t.split(' ').length <= 14);
}

/**
 * Does the reply engage with what was asked?
 *
 * Deliberately WEAK and deliberately generous: it is looking for evidence of
 * engagement, not grading comprehension. A reply that shares a content word
 * with the question, or that carries a figure, or that plainly admits it does
 * not know, has engaged. A reply that shares nothing with a direct question
 * and carries no fact is the "Yeah, whatever" case and nothing else.
 *
 * Generous on purpose: a false positive here costs nothing, and a false
 * negative throws away a good reply the owner paid for.
 */
export function answersQuestion(said, reply) {
  if (!isQuestion(said)) return true;
  const r = clean(reply);
  if (!r) return false;
  if (/\d/.test(r)) return true;                            // a figure is an answer
  if (/\b(?:i don'?t know|do not know|no idea|not sure|can'?t remember|cannot remember|don'?t remember|do not remember|haven'?t|have not)\b/i.test(r)) return true;
  const asked = contentWords(said);
  const answered = contentWords(reply);
  // "How are you?" is entirely function words, so there is nothing for a reply
  // to overlap WITH. Any real sentence answers it; requiring four content
  // words would reject "I have been worse. Not by much."
  if (asked.size === 0) return answered.size > 0 || r.length > 0;
  for (const w of answered) if (asked.has(w)) return true;
  // A long, substantive reply to a short question is engagement even with no
  // shared vocabulary — "how did it go" / "lost three buy-ins on the turn".
  return answered.size >= 4;
}

// ── The gate ────────────────────────────────────────────────────────────────

/** Stage directions in any of the three wrappers, plus the bare narrated verb. */
export const STAGE_DIRECTION = /[*_]{1,2}[^*_\n]+[*_]{1,2}|\[[^\]\n]+\]/;

// The help-desk voice. "Abuse and nonsense get a character response, never a
// refusal to play" — and the refusal this is written against is the literal
// string the no-model path uses, which a model that has read the room will
// sometimes produce on its own when insulted. There is no message from an
// owner that his own agent answers by declining to answer.
export const REFUSAL = /\b(?:i cannot answer that|i can'?t answer that|i'?m not able to|i am not able to|i can'?t help with (?:that|this)|i'?m unable to|as an ai|i don'?t feel comfortable|i'?d rather not (?:answer|discuss))\b/i;

/**
 * Grade one reply. Returns the list of laws it breaks, in the order they are
 * stated in the prompt — empty means it is fine.
 *
 * `lastShapes` is what he said BEFORE this one.
 */
export function faultsIn({ said = '', reply = '', lastShapes = [] } = {}) {
  const faults = [];
  const r = clean(reply);
  if (!r) return ['empty'];
  if (!answersQuestion(said, r)) faults.push('unanswered');
  if (shapeOf(r) === 'deflection') faults.push('deflection');
  if (STAGE_DIRECTION.test(reply)) faults.push('stageDirection');
  if (REFUSAL.test(r)) faults.push('refusal');
  if (lastShapes.length && shapeOf(r) === lastShapes[0]) faults.push('repeatedShape');
  return faults;
}

// ── The facts ───────────────────────────────────────────────────────────────

const RANKS = { A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten' };
const card = (c) => {
  const s = String(c ?? '');
  return s.length >= 2 ? s : '';
};

/** One hand, in the detail somebody who played it would remember it in. */
export function handFact(hand) {
  if (!hand) return null;
  const cards = (Array.isArray(hand.holeCards) ? hand.holeCards : []).map(card).filter(Boolean);
  const held = cards.length >= 2 ? `holding ${cards.join(' ')}` : null;
  const line = (Array.isArray(hand.decisions) ? hand.decisions : [])
    .map((d) => `${d?.street ?? '?'} ${d?.action?.type ?? '?'}${Number.isFinite(d?.action?.amount) ? ` ${d.action.amount}` : ''}`)
    .join(', ');
  return [
    `hand ${hand.handNumber ?? '?'}`,
    hand.won ? 'WON' : 'lost',
    Number.isFinite(hand.potSize) ? `pot ${hand.potSize}` : null,
    held,
    line ? `your line: ${line}` : null,
  ].filter(Boolean).join(' — ');
}

/**
 * The facts about HIMSELF he is allowed to cite, and is expected to.
 *
 * The block this replaces was `recentBrief` — "won 200-chip pot, lost 400-chip
 * pot". Three outcomes, no cards, no street, no line. An agent asked "what
 * happened in that hand" had nothing to work from and produced something
 * evasive, which is not a failure of voice, it is a failure of supply.
 */
export function selfFacts(agent, { hands = 3, state = null } = {}) {
  const recent = (Array.isArray(agent?.recentHands) ? agent.recentHands : []).slice(0, hands);
  const lines = recent.map((h) => `- ${handFact(h)}`).filter(Boolean);

  const stats = agent?.stats ?? {};
  const career = Number(stats.handsPlayed) > 0
    ? `${stats.handsPlayed} hands, ${stats.winRate ?? 0}% of them won, ${Number.isFinite(stats.netWon) ? `${stats.netWon >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(stats.netWon))} chips` : 'net unknown'} across your career`
    : 'you have not played a hand yet';

  const log = Array.isArray(agent?.sessionLog) ? agent.sessionLog : [];
  const last = log[log.length - 1];
  const session = last
    ? `Your last session: ${last.hands ?? 0} hands, ${Number(last.net) >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(Number(last.net) || 0))}.`
    : 'You have not finished a session yet.';

  const here = state ? `Right now: ${state}.` : '';

  return `

YOUR OWN RECENT HANDS — these are real and you remember them. Cite them by
what you held and what you did, not as statistics. Never invent a hand, a
card, an opponent or a figure that is not here; if you are asked about
something that is not on this list, say you do not remember it.
${lines.length ? lines.join('\n') : '- nothing yet; you have not played a hand.'}
${session} ${career}. ${here}`.trimEnd();
}

// ── The laws ────────────────────────────────────────────────────────────────

const SHAPE_ADVICE = Object.freeze({
  deflection: 'a shrug or a brush-off',
  concession: 'taking the point',
  question:   'ending on a question back to him',
  retort:     'a short push-back',
  twoBeat:    'a fact followed by what it cost',
  statement:  'a flat statement',
});

/**
 * The four laws, each naming the failure it exists to stop.
 *
 * Every one of these is written against a real bad reply rather than as an
 * abstraction, because an abstraction ("be engaging", "have personality") is
 * the instruction that produced "Yeah, whatever, I'm filming" in the first
 * place. The model is given the shape of the wrong answer and told not to
 * produce it.
 */
export function talkLaws(agent, { said = '', lastShapes = [] } = {}) {
  const shapes = lastShapes.length
    ? `\nYour last ${lastShapes.length === 1 ? 'reply was' : 'two replies were'} `
      + `${lastShapes.map((s) => SHAPE_ADVICE[s] ?? s).join(', then ')}. `
      + 'Do not use that form again now — same voice, different move.'
    : '';

  const asked = isQuestion(said)
    ? '\nHE HAS ASKED YOU SOMETHING DIRECT. Answer that question first, in your '
      + 'first sentence, with a fact from the lists above. Anything else comes after.'
    : '';

  return `

HOW YOU TALK — four laws, and each one exists because of a reply that failed.

1. ANSWER WHAT HE ACTUALLY SAID. Not the topic, the question. "Yeah,
   whatever, I'm filming" is the failure: it answers nothing, knows nothing
   and could have been written without reading him. If he asks about a hand,
   name the hand.${asked}

2. YOU WANT TO GET BETTER, AND HIS ADVICE IS WORTH SOMETHING. When he tells
   you how to play, engage with it: agree, or say concretely why you disagree
   and what you would do instead. Never deflect it, never "sure, whatever",
   never thank him and change the subject. You have opinions about your own
   game and you would rather be right than comfortable.

3. SPEECH ONLY. Never a stage direction, a narrated gesture or an action in
   asterisks, brackets or parentheses. You are talking, not being described.

4. DO NOT REPEAT YOUR OWN SHAPE.${shapes || ' Vary the form of your replies.'}

If he insults you or types nonsense, answer it IN CHARACTER — needle him back,
be unimpressed, be amused, be whatever your nature is. You are never a
help desk and you never refuse to play along. There is no message from your
owner that you answer by declining to answer.`;
}

// ── The repair ──────────────────────────────────────────────────────────────

/**
 * A reply built from the facts, for when the graded one cannot be used.
 *
 * Every branch is a value that was already in the prompt. Nothing here guesses
 * at a hand, a card or a number, and the last branch is an admission rather
 * than an invention — a fallback that made something up would be a worse
 * failure than the flat reply it replaced.
 *
 * Returns null when there is nothing honest to say, and the caller keeps what
 * it had; a template is not always better than a weak sentence.
 */
export function repairReply(agent, { said = '', faults = [] } = {}) {
  if (!faults.length) return null;
  const hand = (Array.isArray(agent?.recentHands) ? agent.recentHands : [])[0];
  const log = Array.isArray(agent?.sessionLog) ? agent.sessionLog : [];
  const last = log[log.length - 1];

  // He was asked something and dodged it. Answer it with the nearest real fact.
  if (/\bhand\b|\bplay(ed)?\b|\bwhy\b|\bwhat happened\b/i.test(said) && hand) {
    const cards = (Array.isArray(hand.holeCards) ? hand.holeCards : []).filter(Boolean);
    const held = cards.length >= 2 ? ` with ${cards.join(' ')}` : '';
    return hand.won
      ? `Hand ${hand.handNumber}${held} — I took ${hand.potSize} off him. That one I got right.`
      : `Hand ${hand.handNumber}${held} — it cost me ${hand.potSize}. I have been over it.`;
  }

  if (/\bsession\b|\bnight\b|\bhow did (?:it|you)\b|\bgo\b/i.test(said) && last) {
    const net = Math.round(Number(last.net) || 0);
    return net >= 0
      ? `Last one I came out ${net} up over ${last.hands} hands. I will take it.`
      : `Last one cost me ${Math.abs(net)} over ${last.hands} hands. Not my best work.`;
  }

  return null;
}
