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
//   2. THE LAWS. Clauses that name the failure they exist to stop, each with
//      the shape of the bad reply written out. A law the model can match
//      against a concrete example is followed; "be more engaging" is not.
//   3. THE GATE. Deterministic, after the call, no second call. It grades the
//      reply against those laws and repairs it from the facts when it fails. A
//      prompt is a request; this is the part that is not optional.
//
// LIFE-2 job 2 finished the job on part 1 and added the fifth law to parts 2
// and 3. The supply was still missing two of the four things a hand is made of:
// what CAME (the board) and what it WON OR COST (the engine's per-seat net, not
// the pot). And nothing checked the answer back — an agent given three hands
// could describe a fourth, in detail, convincingly, and the only person in a
// position to notice was the owner reading his own hand history. `invention`
// is the fault that catches it, and it is the only one in the list that says a
// reply is WRONG rather than badly shaped.
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

import { whyFact, statePhrase, actionPhrase } from './handWhy.js';
// LIFE-3 job 2 - which hand he is being asked about, and the four words a hand
// is named with. RANK_WORDS, WORD_TO_RANK, rankKey and handNumbersIn were this
// file's; they moved to handRef.js because both files need them and a copy is a
// second place to update. handNumbersIn is re-exported below, unchanged.
import {
  RANK_WORDS, WORD_TO_RANK, rankKey, handNumbersIn, resolveHand,
  candidateQuestion, handNickname, nicknameForKey,
} from './handRef.js';

export { handNumbersIn };

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

// ── LIFE-3 job 2: the dead end ──────────────────────────────────────────────
//
// "Man, I don't know what you're asking about — what happened?"
//
// Three times in one conversation, on a question that was perfectly clear in
// context. It is not a refusal (REFUSAL above is the help-desk voice) and it is
// not a deflection (it is a real question, so shapeOf calls it one) — which is
// exactly why nothing in the gate ever caught it. It is its own failure: he has
// handed the question back instead of answering it.
//
// A CLOSED LIST OF THE ACTUAL FORMS, like DEFLECTION above, rather than a
// sentiment guess. Every clause here was either said in the transcript or is
// the same sentence with a different noun in it.
export const CONFUSED = new RegExp([
  "(?:i )?don'?t know what (?:you'?re|you are|your) (?:asking|talking|on)",
  "(?:i )?(?:have )?no idea what (?:you'?re|you are|you) (?:asking|talking|mean)",
  "what (?:are you|you) (?:asking|talking|on) about",
  "which hand (?:are you |you )?(?:talking|asking|mean|on)",
  "which (?:one|hand) (?:do you mean|are you on about)",
  "don'?t remember that one",
  "what hand\?",
  "what happened\?\s*$",
].join('|'), 'i');

/**
 * Is this the dead end?
 *
 * NOT the same question as "does he say he cannot place a hand". "I do not
 * remember hand 700, it is not one of the three I have" is the honest answer
 * law 5 asks for and is not here, because it NAMES the hand it cannot place.
 * The dead end is the reply that names nothing and asks the owner to start
 * again.
 */
export function isConfused(text) {
  return CONFUSED.test(clean(text));
}

/**
 * How many times he has already said it in this conversation.
 *
 * `chatHistory` is the window, and it is the right one for free: agentProfiles
 * already keeps the last twelve messages and no more, which is what "one
 * conversation" means here. Counting it needs no new field, no new persistence
 * and cannot grow - and the count is taken BEFORE the current exchange is
 * pushed, so the reply being graded is never counted against itself.
 */
export function confusionsBefore(agent) {
  const history = Array.isArray(agent?.chatHistory) ? agent.chatHistory : [];
  return history.filter((m) => m?.role === 'assistant' && isConfused(m.content)).length;
}


/**
 * Grade one reply. Returns the list of laws it breaks, in the order they are
 * stated in the prompt — empty means it is fine.
 *
 * `lastShapes` is what he said BEFORE this one.
 *
 * LIFE-2 job 2 added `agent`, and with it the fifth law and the one that is
 * about TRUTH rather than about form: a hand he cited has to be a hand he
 * played. It is optional because four of the five faults need nothing but the
 * two strings, and a caller with no record in hand — the eval's line grader,
 * a test — should still get the other four rather than nothing. When it is
 * passed, `invention` is the fault, and it is the only one in the list that
 * says the reply is WRONG rather than badly shaped.
 */
export function faultsIn({ said = '', reply = '', lastShapes = [], agent = null } = {}) {
  const faults = [];
  const r = clean(reply);
  if (!r) return ['empty'];
  if (!answersQuestion(said, r)) faults.push('unanswered');
  if (shapeOf(r) === 'deflection') faults.push('deflection');
  if (STAGE_DIRECTION.test(reply)) faults.push('stageDirection');
  if (REFUSAL.test(r)) faults.push('refusal');
  if (lastShapes.length && shapeOf(r) === lastShapes[0]) faults.push('repeatedShape');
  if (agent) {
    const made = inventedCitations(agent, { reply: r });
    if (made.numbers.length || made.holdings.length) faults.push('invention');
  }
  // LIFE-3 job 2 - the dead end, and the two different things wrong with it.
  //
  // `confusion` is the one that depends on the record: he handed the question
  // back although there WAS an answer to give. With no record in hand it
  // cannot be judged, and a caller that passes no agent gets the other faults
  // exactly as it has since LIFE-2.
  //
  // A man who has played NO hands is still at fault here, and that is
  // deliberate: he has an answer too, and it is "I have not played a hand yet,
  // nothing to go over." The dead end is never the best he can do — it is only
  // ever the thing he says instead of the answer he has.
  //
  // `repeatConfusion` does not depend on the record and is graded whether or
  // not one is passed. Twice is the line: the first one may be the best he can
  // do, the second is a character with one string in it. The transcript had
  // three, word for word.
  if (isConfused(r)) {
    if (agent && answerFor(agent, said).line) faults.push('confusion');
    if (confusionsBefore(agent) > 0) faults.push('repeatConfusion');
  }
  return faults;
}

// ── The facts ───────────────────────────────────────────────────────────────

/**
 * How many of his own hands go into the prompt, and therefore how many he is
 * allowed to cite.
 *
 * ONE number, exported, because it is the hinge between the two halves of this
 * file. selfFacts() puts this many hands in front of him and inventedCitations()
 * grades him against exactly the same slice. If they ever disagreed, the gate
 * would fault him for citing a hand we chose not to show him — punishing him
 * for our own trimming — or let an older hand through as if he had been given
 * it. Three is a BOUND rather than a preference: the block rides on top of an
 * already long system prompt (COST-2 trimmed 435 tokens down to 291 across the
 * whole static side), and a man who reels off twenty hands is a log file.
 */
export const SELF_FACT_HANDS = 3;

// What the list says when there is no list. "Empty history means he says so
// plainly" — and the plain thing has to be IN the prompt, because an empty
// section reads to a model as a section it is free to fill. The repair below
// carries the same sentence in his voice, so the two halves of the gate agree
// about what a man with no hands behind him is entitled to claim: nothing.
const NO_HANDS_LINE = '- nothing yet; you have not played a hand. You have no hand to '
  + 'describe and you do not pretend otherwise: say so plainly.';

const RANKS = { A: 'ace', K: 'king', Q: 'queen', J: 'jack', T: 'ten' };
const card = (c) => {
  const s = String(c ?? '');
  return s.length >= 2 ? s : '';
};

/**
 * One hand, in the detail somebody who played it would remember it in.
 *
 * LIFE-2 job 2 added the two halves that were missing, and the omission is why
 * an agent asked what happened could only ever answer with an outcome:
 *
 *   WHAT CAME. The board. A hand with no board in it is a hand nobody can talk
 *   about — "I had ace king and lost 1450" is a result; "ace king, the board
 *   came Qh 7d 2s Kc" is a hand. An empty board prints as "no flop", which is
 *   itself the answer to what came.
 *
 *   WHAT IT WON OR COST. `net`, the engine's per-seat delta: what he took out
 *   of the pot minus everything he put in. NOT the pot, which is the figure he
 *   used to be given and which flatters him on every multiway pot he wins.
 *   Absent on records written before the field existed, and left out rather
 *   than guessed at when it is — a hand that cost him nothing and a hand whose
 *   cost was never written down are different facts, and only one of them is
 *   safe to say out loud.
 */
export function handFact(hand) {
  if (!hand) return null;
  const cards = (Array.isArray(hand.holeCards) ? hand.holeCards : []).map(card).filter(Boolean);
  const held = cards.length >= 2 ? `holding ${cards.join(' ')}` : null;
  const board = (Array.isArray(hand.board) ? hand.board : []).map(card).filter(Boolean);
  const came = Array.isArray(hand.board)
    ? (board.length ? `board ${board.join(' ')}` : 'no flop')
    : null;
  const line = (Array.isArray(hand.decisions) ? hand.decisions : [])
    .map((d) => `${d?.street ?? '?'} ${d?.action?.type ?? '?'}${Number.isFinite(d?.action?.amount) ? ` ${d.action.amount}` : ''}`)
    .join(', ');
  const net = Number.isFinite(hand.net)
    ? `${hand.net >= 0 ? 'made you' : 'cost you'} ${Math.abs(Math.round(hand.net))}`
    : null;
  return [
    `hand ${hand.handNumber ?? '?'}`,
    hand.won ? 'WON' : 'lost',
    Number.isFinite(hand.potSize) ? `pot ${hand.potSize}` : null,
    held,
    came,
    line ? `your line: ${line}` : null,
    net,
    // LIFE-3 job 1: and WHY. The fifth thing a hand is made of, and the one an
    // owner asks about most. It was on the record — every decision has carried
    // a `reasoning` string since the first model call — and it stopped here,
    // where the line was rebuilt as actions with the reasons stripped out. A
    // hand recorded before this tree has no `why` and prints exactly what it
    // printed before.
    whyFact(hand.why) || null,
  ].filter(Boolean).join(' — ');
}

// ── Did he make it up? ──────────────────────────────────────────────────────
//
// LIFE-2 job 2. The prompt has told him not to invent a hand since TALK-2, and
// a prompt is a request. This is the half that is not optional: it reads the
// reply back, finds every hand he CLAIMED AS HIS, and checks each one against
// the list he was actually given.
//
// Two kinds of citation are graded, and deliberately no others:
//
//   A HAND NUMBER — "hand 812", "#812", "hand number 812". A figure presented
//   as a hand is a claim about the record and is checkable against it exactly.
//
//   A HOLDING HE SAYS WAS HIS — "I had ace king", "I held Ah Kd", "I was
//   holding pocket nines". Checked on RANKS ONLY and unordered, because that is
//   how a person cites a hand and the suits are how a database does; faulting
//   him for saying "ace king" about a hand the record spells Ah Kd would be
//   faulting him for speaking English.
//
// THE FIRST PERSON IS THE WHOLE RULE, and it is a rule about false positives
// rather than about grammar. Cards appear in a reply for four reasons and only
// one of them is a claim this file can settle:
//
//   "I had ace king"          — his. On the record. Gradeable.
//   "he had the set"          — the opponent's. The record does not hold the
//                               other man's cards, so calling it a lie would be
//                               this file inventing a fact of its own.
//   "board came queen seven"  — the board. Two ranks side by side that are not
//                               a holding at all, and the reason a bare
//                               two-word pattern had to go: it faulted a
//                               truthful description of the flop as an invented
//                               hand.
//   "ace king is a call"      — a hypothetical, usually one his owner opened.
//                               Engaging with it is law 2, not a claim.
//
// So a bare "Ace king, called the turn" goes ungraded. That is the intended
// trade: this gate exists to catch a LIE, and a gate that never once faults a
// true sentence is worth more than one that catches every lie and one honest
// man with it. The prompt still asks for all four; only the first is enforced.
//
// WHAT IS NOT GRADED is every other figure in the sentence. A reply carries pot
// sizes, session nets, career nets, stacks and blinds, and a grader that
// treated a loose number as a claim about a hand would fault "I am still down
// 1450" — a true sentence about his week — as an invented hand.
//
// AND SAYING HE DOES NOT REMEMBER IS NEVER AN INVENTION. "I have no hand 999 on
// file" names a hand number that is not his, which is the point of the
// sentence. NOT_MINE below is the same admission vocabulary answersQuestion
// already accepts, and it stands the whole check down.

// The four ways he says a holding is his, as one alternation: a card-code pair
// ("Ah Kd"), a two-rank word pair ("ace king"), or a plural rank ("aces",
// "sixes" — the `e?s` is for that one). `pocket`/`a pair of` are optional
// dressing in front of any of them.
const CLAIM = '\\bi (?:had|held|have|was holding|had got)\\s+(?:a pair of\\s+|pocket\\s+)?';
const MY_HOLDING = new RegExp(
  `${CLAIM}(?:`
  + '([2-9TJQKA])[shdc]\\s*([2-9TJQKA])[shdc]'                       // 1,2  Ah Kd
  + `|(${RANK_WORDS})[\\s-]+(${RANK_WORDS})`                          // 3,4  ace king
  + `|(${RANK_WORDS})e?s`                                             // 5    aces
  + ')\\b',
  'gi');

// He is saying he cannot place it, which is exactly what the prompt asks for
// when a hand is not on his list.
const NOT_MINE = /\b(?:i don'?t know|do not know|no idea|not sure|can'?t remember|cannot remember|don'?t remember|do not remember|never played|not (?:one of )?mine|not on (?:my|the) list|no such hand|have not played)\b/i;

/** Every holding the SPEAKER claims as his own, as unordered rank keys. */
export function claimedHoldings(text) {
  const out = new Set();
  for (const m of String(text ?? '').matchAll(MY_HOLDING)) {
    if (m[1] && m[2]) { out.add(rankKey(m[1], m[2])); continue; }
    if (m[3] && m[4]) {
      const a = WORD_TO_RANK[m[3].toLowerCase()];
      const b = WORD_TO_RANK[m[4].toLowerCase()];
      if (a && b) out.add(rankKey(a, b));
      continue;
    }
    if (m[5]) {
      const r = WORD_TO_RANK[m[5].toLowerCase()];
      if (r) out.add(rankKey(r, r));
    }
  }
  return out;
}

/**
 * The hands he was actually given, indexed the two ways a reply can cite one.
 *
 * `hands` must match the number selfFacts() put in the prompt. Grading him
 * against hands he was never shown would be faulting him for our own trimming.
 */
export function handIndex(agent, { hands = SELF_FACT_HANDS } = {}) {
  const recent = (Array.isArray(agent?.recentHands) ? agent.recentHands : []).slice(0, hands);
  const numbers = new Set();
  const holdings = new Set();
  for (const h of recent) {
    if (Number.isFinite(Number(h?.handNumber))) numbers.add(Number(h.handNumber));
    const cards = (Array.isArray(h?.holeCards) ? h.holeCards : [])
      .map((c) => String(c ?? '')).filter((c) => c.length >= 2);
    if (cards.length >= 2) holdings.add(rankKey(cards[0][0], cards[1][0]));
  }
  return { numbers, holdings, count: recent.length };
}

/**
 * What he claimed that is not on his list. Both arrays empty means every hand
 * in the reply is one he actually played.
 *
 * @returns {{ numbers: number[], holdings: string[] }}
 */
export function inventedCitations(agent, { reply = '', hands = SELF_FACT_HANDS } = {}) {
  const r = clean(reply);
  if (NOT_MINE.test(r)) return { numbers: [], holdings: [] };
  const index = handIndex(agent, { hands });
  const numbers = [...handNumbersIn(r)].filter((n) => !index.numbers.has(n));
  const holdings = [...claimedHoldings(r)].filter((h) => !index.holdings.has(h));
  return { numbers, holdings };
}

/**
 * The facts about HIMSELF he is allowed to cite, and is expected to.
 *
 * The block this replaces was `recentBrief` — "won 200-chip pot, lost 400-chip
 * pot". Three outcomes, no cards, no street, no line. An agent asked "what
 * happened in that hand" had nothing to work from and produced something
 * evasive, which is not a failure of voice, it is a failure of supply.
 */
export function selfFacts(agent, { hands = SELF_FACT_HANDS, state = null } = {}) {
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

YOUR OWN RECENT HANDS — these are real and you remember them. Each line is one
hand: what you held, what came, what you did, and what it won or cost. Asked
about your night, about a hand, or about a man you played, answer with one of
THESE — by the cards and the board, not as a statistic. Never invent a hand, a
card, an opponent or a figure that is not here; if you are asked about
something that is not on this list, say you do not remember it.
${lines.length ? lines.join('\n') : NO_HANDS_LINE}
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
 * The laws, each naming the failure it exists to stop.
 *
 * Every one of these is written against a real bad reply rather than as an
 * abstraction, because an abstraction ("be engaging", "have personality") is
 * the instruction that produced "Yeah, whatever, I'm filming" in the first
 * place. The model is given the shape of the wrong answer and told not to
 * produce it.
 *
 * LIFE-2 job 2 added the fifth, and it is the only one with a grader behind it
 * that can REJECT rather than merely ask: `invention` in faultsIn. The law is
 * stated anyway, because a reply that never has to be repaired is better than
 * one that does, and because law 5's failure mode — a hand he did not play,
 * described convincingly — is the one an owner cannot detect by reading.
 */
export function talkLaws(agent, { said = '', lastShapes = [], focus = null } = {}) {
  const shapes = lastShapes.length
    ? `\nYour last ${lastShapes.length === 1 ? 'reply was' : 'two replies were'} `
      + `${lastShapes.map((s) => SHAPE_ADVICE[s] ?? s).join(', then ')}. `
      + 'Do not use that form again now — same voice, different move.'
    : '';

  const asked = isQuestion(said)
    ? '\nHE HAS ASKED YOU SOMETHING DIRECT. Answer that question first, in your '
      + 'first sentence, with a fact from the lists above. Anything else comes after.'
    : '';

  // LIFE-2 job 2: named here rather than left implicit, because "cite a hand"
  // and "cite one of THESE hands" are different instructions and only the
  // second one is checkable. A man with nothing behind him is told the one
  // thing he is allowed to say, which is that there is nothing.
  const index = handIndex(agent);
  const citable = index.count
    ? `\nYou have ${index.count} hand${index.count === 1 ? '' : 's'} on that list and they are the `
      + 'ONLY hands you may describe. Hand numbers: '
      + `${[...index.numbers].join(', ')}.`
    : '\nYou have played no hands. You have nothing to describe, and if he asks '
      + 'about one you say so plainly rather than reaching for a hand.';

  // LIFE-3 job 2: WHICH hand he is being asked about, worked out before the
  // call rather than left to him. The resolver is the same one the gate grades
  // him with (handRef.js), so the prompt and the repair can never disagree
  // about which hand is meant — and disagreeing is exactly what produced the
  // transcript's middle beat: asked about the queen-six, he described a
  // different hand, and both halves of the product thought they were right.
  const answer = answerFor(agent, said, { focus });
  const nick = answer.hand ? handNickname(answer.hand) : null;
  let which = '';
  if (answer.hand) {
    which = `\nTHE HAND HE IS ASKING ABOUT IS HAND ${answer.hand.handNumber}`
      + `${nick ? ` — the ${nick}` : ''}. `
      + `${answer.how === 'notable'
        ? 'He did not name one, and that is the hand your night turned on, so it is the one he means.'
        : 'He named it.'}`
      + ' Answer about THAT hand and no other, and say which hand you mean as you answer.';
  } else if (answer.how === 'ambiguous') {
    which = '\nTWO OF YOUR HANDS FIT WHAT HE SAID. Name them both back to him and let '
      + 'him pick — "the queen-six, or the jack-ten?" — rather than asking him a blank question.';
  } else if (answer.how === 'unknown') {
    which = '\nHE HAS NAMED A HAND THAT IS NOT ON YOUR LIST. Say which one you do not '
      + 'have, plainly and by name. That is an answer; asking him what he means is not.';
  }

  return `

HOW YOU TALK — six laws, and each one exists because of a reply that failed.

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

5. A HAND YOU CITE IS A HAND YOU PLAYED. Asked about your night, about a man
   you sat with, or about a specific hand, answer with one off YOUR OWN RECENT
   HANDS above — the cards, the board, what you did, what it won or cost. Never
   a hand that is not on that list, however well it would fit the sentence.
   "I had aces and he rivered a flush" is the failure when you held ace king:
   it is a better story and it is not yours, and your owner has the hand history
   in front of him.${citable}

6. NEVER ASK HIM WHICH HAND HE MEANS. "I don't know what you're asking about
   — what happened?" is the failure, and it is the worst line in this file:
   it hands the question straight back to the man who asked it, and he has
   already told you everything he is going to. There is ALWAYS an answer. If
   he named a hand, that is the hand. If he named none, it is the hand your
   night turned on — the all-in, the bust, the biggest pot — and you name it
   as you answer so he knows which one you mean. If two of your hands
   genuinely fit what he said, say both back to him and let him pick. If he
   is asking about a hand you do not have, say WHICH hand you do not have.
   And if he only says "why", he is still asking about the hand the two of
   you were just talking about — do not start the conversation over.${which}

If he insults you or types nonsense, answer it IN CHARACTER — needle him back,
be unimpressed, be amused, be whatever your nature is. You are never a
help desk and you never refuse to play along. There is no message from your
owner that you answer by declining to answer.`;
}

// ── The repair ──────────────────────────────────────────────────────────────

/**
 * WHAT HE OWES THIS QUESTION — one place, one answer, every time.
 *
 * LIFE-3 job 2. Before this, the question "which hand is he being asked about"
 * was answered nowhere: the prompt showed him three hands and left him to pick,
 * and the repair reached for `recentHands[0]` because that is the only hand a
 * one-line fallback can name without thinking. So an owner who NAMED a hand got
 * whichever one happened to be newest, and an owner who named none got a
 * question back.
 *
 * Now it resolves (handRef.js) and there is always an answer:
 *
 *   he named a hand that is his        the hand
 *   he named a hand that is not        that he has no such hand — by its
 *                                      number or its cards, because "I have no
 *                                      hand 700" is an answer and "I cannot
 *                                      place it" is a shrug with better manners
 *   two of his fit what he said        both of them, as a question that moves
 *                                      forward: "The queen-six, or the
 *                                      jack-ten?"
 *   he named none, and asked           the most recent notable hand: the
 *                                      all-in, the bust, the biggest pot
 *   he asked about the night           the last session
 *   he has never played                so, plainly
 *
 * `line` is null only when there is genuinely nothing honest to say, and that
 * null is load-bearing twice over: repairReply leaves his own sentence standing
 * rather than replacing it with a template, and faultsIn uses it to decide
 * whether the dead end was a fault at all. He is not at fault for not knowing
 * what he was never told.
 *
 * @returns {{ line: string|null, how: string, hand: object|null }}
 */
export function answerFor(agent, said = '', { focus = null } = {}) {
  const hands = (Array.isArray(agent?.recentHands) ? agent.recentHands : []).slice(0, SELF_FACT_HANDS);
  const res = resolveHand(hands, said, { focus });
  const log = Array.isArray(agent?.sessionLog) ? agent.sessionLog : [];
  const last = log[log.length - 1];

  if (res.how === 'ambiguous') {
    const q = candidateQuestion(res.candidates);
    if (q) return { line: q, how: res.how, hand: null };
  }
  // LIFE-3 job 3: ownSentence rather than handSentence. The question that
  // reaches this line is nearly always "why", and the identity of a hand is not
  // an answer to it. It degrades to handSentence for a hand with no why on file.
  if (res.hand) return { line: ownSentence(res.hand), how: res.how, hand: res.hand };

  if (res.how === 'unknown') {
    // He named something and it is not on the list. Say WHAT is not on it.
    const n = res.asked.numbers[0];
    if (Number.isFinite(n)) return { line: `I have no hand ${n} on my list. Not one of mine.`, how: res.how, hand: null };
    const nick = nicknameForKey(res.asked.holdings[0]);
    return {
      line: nick ? `I did not play ${nick}. Not one of mine.` : 'That is not one of mine. I do not have it.',
      how: res.how, hand: null,
    };
  }

  // Nothing about a hand resolved. Two honest things are left.
  if (!hands.length && ABOUT_A_HAND.test(said)) {
    return { line: 'I have not played a hand yet. Nothing to go over.', how: 'empty', hand: null };
  }
  if (last && /\bsession\b|\bnight\b|\bhow did (?:it|you)\b|\bgo\b/i.test(said)) {
    const net = Math.round(Number(last.net) || 0);
    return {
      line: net >= 0
        ? `Last one I came out ${net} up over ${last.hands} hands. I will take it.`
        : `Last one cost me ${Math.abs(net)} over ${last.hands} hands. Not my best work.`,
      how: 'session', hand: null,
    };
  }
  return { line: null, how: res.how, hand: null };
}

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
const ABOUT_A_HAND = /\bhand\b|\bplay(ed)?\b|\bwhy\b|\bwhat happened\b/i;

export function repairReply(agent, { said = '', faults = [], focus = null } = {}) {
  if (!faults.length) return null;
  const answer = answerFor(agent, said, { focus });

  // LIFE-2 job 2 — he made one up, and this is the branch that decides what he
  // gets instead. It is FIRST because it is the only fault where the reply was
  // not weak but false, and a false sentence has to go whatever else is right
  // about it. He is handed the real hand in the same breath, so being caught
  // out costs him the story and not the conversation.
  //
  // LIFE-3 job 2: the hand he is handed is now the one he was ASKED about
  // rather than simply the newest, which is the difference between a
  // correction and a second wrong answer.
  if (faults.includes('invention')) {
    // The hand he was ASKED about where one resolved, and otherwise the newest
    // one he has — because a man caught inventing a hand is owed a REAL hand,
    // and a session summary is not one. A message that named no hand at all
    // ("how did the session go?" answered with a hand he never played) still
    // has to be corrected with something off the record.
    const real = answer.hand ?? (Array.isArray(agent?.recentHands) ? agent.recentHands : [])[0];
    if (real) return `${handSentence(real)} That is the one, whatever I just said.`;
    // …and with nothing behind him, the plain thing. Never a hand, never a
    // hedge that sounds like one — see NO_HANDS_LINE, which is the same claim
    // made to the model.
    return 'I have not played a hand yet. There is nothing for me to tell you about.';
  }

  // Everything else the gate catches — the dodge, the shrug, the dead end — is
  // the same repair, because they are the same failure: a question with an
  // answer available got something other than the answer.
  return answer.line;
}

/**
 * One real hand, as he would say it: the cards, the board, and what it did to
 * him. Every value comes off the record — nothing here composes a fact.
 *
 * `net` is preferred over `potSize` for what it cost, for the reason handFact
 * gives: the pot is not his. It falls back to the pot only when the record
 * predates the field, and then it says "pot" rather than "cost me", because
 * the two are different claims and only one of them is on file.
 */
function handSentence(hand) {
  const cards = (Array.isArray(hand.holeCards) ? hand.holeCards : []).filter(Boolean);
  const held = cards.length >= 2 ? ` with ${cards.join(' ')}` : '';
  const board = (Array.isArray(hand.board) ? hand.board : []).filter(Boolean);
  const came = board.length ? ` Board ${board.join(' ')}.` : '';
  if (Number.isFinite(hand.net)) {
    const n = Math.abs(Math.round(hand.net));
    return hand.net >= 0
      ? `Hand ${hand.handNumber}${held} — made me ${n}.${came} That one I got right.`
      : `Hand ${hand.handNumber}${held} — cost me ${n}.${came} I have been over it.`;
  }
  return hand.won
    ? `Hand ${hand.handNumber}${held} — I took ${hand.potSize} off him.${came} That one I got right.`
    : `Hand ${hand.handNumber}${held} — pot was ${hand.potSize}.${came} I have been over it.`;
}

// ── LIFE-3 job 3: he owns it ────────────────────────────────────────────────

const trimEnd = (s) => String(s ?? '').replace(/[\s.!,;:—-]+$/, '');

/**
 * One real hand WITH THE REASON HE PLAYED IT THAT WAY.
 *
 * handSentence above is the identity of a hand — the cards, the board, the
 * number. It is what you say when the question is "which hand"; it is not what
 * you say when the question is "why". Asked why he made a call that lost, a man
 * who answers "Hand 812 with Qh 6d — cost me 820" has recited the hand history
 * back, which is a different failure from the shrug but is not an answer either.
 *
 * WHAT THIS SAYS, in the order he would say it:
 *
 *   WHICH HAND     by number and by name, so the owner knows they are talking
 *                  about the same one — law 6's other half.
 *   WHAT HE DID    the decisive action, off the stored why (handWhy.js): the
 *                  call for 400 on the turn, not the raise to 60 preflop.
 *   WHY HE DID IT  his own reasoning, VERBATIM off the record, from the model
 *                  call or the compiled policy that actually made the decision.
 *                  It is his sentence and it is not rewritten here.
 *   HOW HE WAS     the heat and the tiredness, but only at the edges, and only
 *                  when they are on file (statePhrase). "I was steaming" is
 *                  true, it is the character, and it is not an excuse — it is
 *                  the thing before the last clause rather than instead of it.
 *   AND IT IS HIS  what it cost, and that he owns it.
 *
 * THE LAST CLAUSE IS THE WHOLE POINT. A loss ends with "that one is on me" —
 * never a shrug, never the cards. "I ran bad" is the sentence this function
 * exists to make impossible: the record holds what he DECIDED, so the decision
 * is what he answers with, and the cards are context rather than a defendant.
 * He is allowed to say he was steaming because that is a fact about him; he is
 * not allowed to stop there, which is why the ownership clause comes after it
 * and not in place of it.
 *
 * Falls back to handSentence for a hand recorded before LIFE-3, which has no
 * why to speak from — the same additive rule every field in this tree follows.
 */
export function ownSentence(hand) {
  if (!hand) return null;
  const why = hand.why;
  if (!why) return handSentence(hand);

  const nick = handNickname(hand);
  const parts = [`Hand ${hand.handNumber}${nick ? `, the ${nick}` : ''}.`];

  const act = actionPhrase(why);
  const where = why.street ? ` on the ${why.street}` : '';
  const reason = trimEnd(why.reasoning);
  if (act) parts.push(reason ? `I ${act}${where} — ${reason}.` : `I ${act}${where}.`);
  else if (reason) parts.push(`${reason}.`);

  const state = statePhrase(why);
  if (state) parts.push(`${state}.`);

  if (Number.isFinite(hand.net)) {
    const n = Math.abs(Math.round(hand.net));
    parts.push(hand.net >= 0
      ? `Made me ${n}, and I would make that call again.`
      : `Cost me ${n}, and that one is on me.`);
  } else {
    parts.push(hand.won ? 'It came in.' : 'It missed, and that was my call to make.');
  }
  return parts.join(' ');
}
