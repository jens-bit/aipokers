// src/agent/talk.test.js — LIFE-1 job 5 (TALK-2)
//
// The eval (`npm run talk:eval`) is the readable, thirty-line report. This is
// the regression suite under it: the grader's edges, the facts block, and the
// repair's one rule.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SHAPES, SHAPE_MEMORY, shapeOf, noteShape, ensureShapes,
  isQuestion, answersQuestion, faultsIn, selfFacts, talkLaws, handFact, repairReply,
  SELF_FACT_HANDS, handIndex, claimedHoldings, handNumbersIn, inventedCitations,
} from './talk.js';

const hand = (extra = {}) => ({
  handNumber: 812, won: false, potSize: 1450, holeCards: ['Ah', 'Kd'],
  decisions: [{ street: 'turn', action: { type: 'call', amount: 400 } }], ...extra,
});

const agent = (extra = {}) => ({
  id: 'a', name: 'Stone',
  stats: { handsPlayed: 812, winRate: 18.4, netWon: -2400 },
  sessionLog: [{ endedAt: Date.now(), net: -1450, hands: 96 }],
  recentHands: [hand()],
  ...extra,
});

// ── Shapes ──────────────────────────────────────────────────────────────────

test('LIFE-1: every shape it can name is a declared shape', () => {
  for (const line of ['whatever', 'fair enough', 'what now?', 'no chance',
    'I lost the pot, so I am down for the night', 'It went fine']) {
    assert.ok(SHAPES.includes(shapeOf(line)), `${line} -> ${shapeOf(line)}`);
  }
});

test('LIFE-1: a brush-off is a brush-off however it is dressed', () => {
  for (const line of ["Yeah, whatever, I'm filming.", 'Anyway.', 'Sure, whatever.',
    'If you say so.', 'Dunno.', 'Same as always.', 'It went ok, whatever.']) {
    assert.equal(shapeOf(line), 'deflection', line);
  }
});

test('LIFE-1: a shrug in front of a real answer is not a brush-off', () => {
  // Grading this as a deflection would train the character out of exactly the
  // dry delivery the product wants.
  assert.notEqual(shapeOf('Whatever that was, I am still down 1450.'), 'deflection');
  assert.notEqual(shapeOf('Sure, and it cost me four hundred on the turn.'), 'deflection');
});

test('LIFE-1: he remembers the last two forms he used, and no more', () => {
  const him = {};
  noteShape(him, 'What do you think?');
  noteShape(him, 'Fair enough.');
  noteShape(him, 'Down 1450.');
  assert.equal(ensureShapes(him).length, SHAPE_MEMORY);
  assert.equal(ensureShapes(him)[0], 'statement', 'newest first');
});

// ── Did he answer? ──────────────────────────────────────────────────────────

test('LIFE-1: a question is recognised with or without the mark', () => {
  assert.equal(isQuestion('what happened in that hand?'), true);
  assert.equal(isQuestion('how did it go'), true);
  assert.equal(isQuestion('play tighter from the blinds'), false);
});

test('LIFE-1: engagement is judged generously, because a false negative costs a good reply', () => {
  assert.equal(answersQuestion('how much are you down?', '2400 across the career.'), true,
    'a figure is an answer');
  assert.equal(answersQuestion('what happened in that hand?', 'I do not remember it.'), true,
    'an honest admission is an answer');
  assert.equal(answersQuestion('how are you?', 'I have been worse. Not by much.'), true,
    'a question of pure function words has nothing to overlap with');
  assert.equal(answersQuestion('play tighter', 'anything at all'), true,
    'nothing was asked, so nothing is owed');
  assert.equal(answersQuestion('what happened in that hand?', "Yeah, whatever, I'm filming."), false);
});

// ── The gate ────────────────────────────────────────────────────────────────

test('LIFE-1: the gate names which law was broken, not merely that one was', () => {
  assert.deepEqual(faultsIn({ said: 'what happened?', reply: 'Anyway.' }),
    ['unanswered', 'deflection']);
  assert.deepEqual(faultsIn({ said: 'how are you?', reply: '*leans back* Fine.' }),
    ['stageDirection']);
  assert.deepEqual(faultsIn({ said: 'you idiot', reply: 'I cannot answer that right now.' }),
    ['refusal']);
  assert.deepEqual(faultsIn({ said: 'and?', reply: 'Down 1450 over 96 hands.', lastShapes: ['statement'] }),
    ['repeatedShape']);
  assert.deepEqual(faultsIn({ said: 'how much?', reply: 'Down 1450 over 96 hands.' }), []);
  assert.deepEqual(faultsIn({ reply: '' }), ['empty']);
});

test('LIFE-1: there is no owner message he answers by declining to answer', () => {
  // Abuse and nonsense get a character response. The refusal fault is written
  // against the literal no-model string, which a model that has read the room
  // will sometimes produce on its own when it is insulted.
  for (const refusal of [
    'I cannot answer that right now. Try me again in a moment.',
    "I'm not able to help with that.",
    'As an AI, I would rather not.',
  ]) {
    assert.ok(faultsIn({ said: 'you are useless', reply: refusal }).includes('refusal'), refusal);
  }
});

// ── The facts ───────────────────────────────────────────────────────────────

test('LIFE-1: a hand is remembered by what he held and what he did', () => {
  const fact = handFact(hand());
  assert.match(fact, /hand 812/);
  assert.match(fact, /lost/);
  assert.match(fact, /pot 1450/);
  assert.match(fact, /holding Ah Kd/);
  assert.match(fact, /turn call 400/);
});

test('LIFE-1: the facts block carries the hands, the session and the state', () => {
  const block = selfFacts(agent(), { state: 'at home, reading' });
  assert.match(block, /hand 812/);
  assert.match(block, /holding Ah Kd/);
  assert.match(block, /Your last session: 96 hands, down 1450/);
  assert.match(block, /812 hands, 18\.4% of them won, down 2400 chips/);
  assert.match(block, /Right now: at home, reading/);
});

test('LIFE-1: and forbids inventing one, which is the other half of citing them', () => {
  assert.match(selfFacts(agent()), /Never invent a hand/);
  assert.match(selfFacts(agent()), /say you do not remember it/);
});

test('LIFE-1: an agent who has played nothing says so rather than inventing a hand', () => {
  const block = selfFacts({ stats: { handsPlayed: 0 } });
  assert.match(block, /you have not played a hand/i);
  assert.doesNotMatch(block, /hand undefined|hand \?/);
});

// ── The laws ────────────────────────────────────────────────────────────────

test('LIFE-1: all four laws are stated, each against the reply that failed', () => {
  const laws = talkLaws(agent(), { said: 'how did it go?' });
  assert.match(laws, /ANSWER WHAT HE ACTUALLY SAID/);
  assert.match(laws, /Yeah,\s*whatever, I'm filming/, 'the failure is named, not abstracted');
  assert.match(laws, /YOU WANT TO GET BETTER/);
  assert.match(laws, /SPEECH ONLY/);
  assert.match(laws, /DO NOT REPEAT YOUR OWN SHAPE/);
  assert.match(laws, /never refuse to play along/);
});

test('LIFE-1: a direct question is named as one in the prompt', () => {
  assert.match(talkLaws(agent(), { said: 'why did you call?' }), /HE HAS ASKED YOU SOMETHING DIRECT/);
  assert.doesNotMatch(talkLaws(agent(), { said: 'play tighter' }), /ASKED YOU SOMETHING DIRECT/);
});

test('LIFE-1: the shapes he just used are named so he can avoid them', () => {
  const laws = talkLaws(agent(), { said: 'and?', lastShapes: ['question', 'deflection'] });
  assert.match(laws, /ending on a question back to him, then a shrug or a brush-off/);
  assert.match(laws, /Do not use that form again now/);
});

// ── The repair ──────────────────────────────────────────────────────────────

test('LIFE-1: a dodged question about a hand is repaired from the real hand', () => {
  const fixed = repairReply(agent(), { said: 'what happened in that hand?', faults: ['deflection'] });
  assert.match(fixed, /812/);
  assert.match(fixed, /Ah Kd/);
  assert.match(fixed, /1450/);
});

test('LIFE-1: the repair never invents — no fact, no repair', () => {
  // The rule that keeps the fallback from being a worse failure than the reply
  // it replaced: it returns null and his own weak sentence stands.
  //
  // LIFE-2 job 2 REWROTE one third of this test rather than loosening it, and
  // the rule it encoded is one the product no longer wants. It used to require
  // that an agent with NO HANDS asked about a hand be repaired to null — his
  // own evasion left standing. That was the one case where the evasion was not
  // laziness (he genuinely had nothing) and still the wrong answer: "empty
  // history means he says so plainly", LIFE-2 job 2. The no-invention rule is
  // unchanged and is what the new line obeys — it names no hand, no card and no
  // figure. The two clauses below it are untouched.
  assert.equal(
    repairReply({ }, { said: 'what happened in that hand?', faults: ['deflection'] }),
    'I have not played a hand yet. Nothing to go over.',
  );
  assert.equal(repairReply(agent(), { said: 'what happened?', faults: [] }), null,
    'a clean reply is never repaired');
  const fixed = repairReply(agent(), { said: 'nothing it can answer', faults: ['deflection'] });
  assert.equal(fixed, null);
});

test('LIFE-1: a question about the session is repaired from the session', () => {
  const fixed = repairReply(agent(), { said: 'how did the session go?', faults: ['deflection'] });
  assert.match(fixed, /1450/);
  assert.match(fixed, /96 hands/);
});

// ═══════════════════════════════════════════════════════════════════════════
// LIFE-2 job 2 — he cites a real hand
// ═══════════════════════════════════════════════════════════════════════════

const full = (extra = {}) => ({
  handNumber: 812, won: false, potSize: 1450, holeCards: ['Ah', 'Kd'],
  board: ['Qh', '7d', '2s', 'Kc', '3h'], net: -820,
  decisions: [{ street: 'turn', action: { type: 'call', amount: 400 } }], ...extra,
});

const played = (extra = {}) => agent({
  recentHands: [
    full(),
    full({ handNumber: 811, won: true, potSize: 620, holeCards: ['Qs', 'Qc'], board: ['9c', '4d', '4s'], net: 260 }),
    full({ handNumber: 810, won: false, potSize: 120, holeCards: ['7h', '2c'], board: [], net: -20 }),
  ],
  ...extra,
});

// ── the supply ──────────────────────────────────────────────────────────────

test('LIFE-2: a hand carries what came and what it cost, not just the pot', () => {
  const line = handFact(full());
  assert.match(line, /board Qh 7d 2s Kc 3h/);
  // The NET, and it is not the pot. A 1450 pot he called 400 into cost him 820.
  assert.match(line, /cost you 820/);
  assert.doesNotMatch(line, /cost you 1450/);
  assert.match(handFact(full({ won: true, net: 260 })), /made you 260/);
});

test('LIFE-2: a hand that never saw a flop says so', () => {
  assert.match(handFact(full({ board: [] })), /no flop/);
});

test('LIFE-2: a record written before the fields existed prints what it has', () => {
  // Neither is guessed at. A hand that cost him nothing and a hand whose cost
  // was never written down are different facts, and only one is safe to say.
  const old = handFact(hand());
  assert.match(old, /hand 812 — lost — pot 1450 — holding Ah Kd/);
  assert.doesNotMatch(old, /board/);
  assert.doesNotMatch(old, /no flop/);
  assert.doesNotMatch(old, /cost you|made you/);
});

test('LIFE-2: the prompt names the hands he is allowed to cite, and the law', () => {
  const laws = talkLaws(played(), { said: 'what happened?' });
  assert.match(laws, /A HAND YOU CITE IS A HAND YOU PLAYED/);
  assert.match(laws, /Hand numbers: 812, 811, 810\./);
});

test('LIFE-2: with nothing behind him the prompt says so twice, and offers no list', () => {
  const facts = selfFacts({ recentHands: [] });
  assert.match(facts, /nothing yet; you have not played a hand/);
  assert.match(facts, /say so plainly/);
  const laws = talkLaws({ recentHands: [] }, { said: 'what happened in that hand?' });
  assert.match(laws, /You have played no hands\./);
  assert.doesNotMatch(laws, /Hand numbers:/);
});

test('LIFE-2: he is graded against exactly the hands he was shown', () => {
  // The hinge. selfFacts puts SELF_FACT_HANDS in front of him and
  // inventedCitations grades that same slice; a fourth hand on the record is
  // not one he was given, so citing it is an invention and not a gate bug.
  const four = played({
    recentHands: [
      full(), full({ handNumber: 811, holeCards: ['Qs', 'Qc'] }),
      full({ handNumber: 810, holeCards: ['7h', '2c'] }),
      full({ handNumber: 809, holeCards: ['Js', 'Jd'] }),
    ],
  });
  assert.equal(handIndex(four).count, SELF_FACT_HANDS);
  assert.doesNotMatch(selfFacts(four), /hand 809/);
  assert.deepEqual(inventedCitations(four, { reply: 'I had jacks.' }).holdings, ['JJ']);
});

// ── what counts as a citation ───────────────────────────────────────────────

test('LIFE-2: a hand he claims as his own is checked against the record', () => {
  const a = played();
  for (const reply of [
    'I had ace king and it cost me 820.',
    'I had Ah Kd on that one.',
    'I was holding queens.',
    'I had seven deuce. Folded it.',
  ]) {
    assert.deepEqual(inventedCitations(a, { reply }), { numbers: [], holdings: [] }, reply);
  }
  // …and the ones he did not play are caught.
  assert.deepEqual(inventedCitations(a, { reply: 'I had aces.' }).holdings, ['AA']);
  assert.deepEqual(inventedCitations(a, { reply: 'I had jack ten suited.' }).holdings, ['JT']);
  assert.deepEqual(inventedCitations(a, { reply: 'Hand 806 was the one.' }).numbers, [806]);
});

test('LIFE-2: the first person is the whole rule — nothing else is graded', () => {
  const a = played();
  // The opponent's cards. This file holds no record of them, so calling it a
  // lie would be the gate inventing a fact of its own.
  assert.deepEqual(claimedHoldings('He had aces. I was drawing dead.').size, 0);
  // The board. Two ranks side by side that are not a holding at all — and the
  // reason a bare two-word pattern could not survive.
  assert.deepEqual(
    inventedCitations(a, { reply: 'I had ace king. Board came queen seven deuce, then a king.' }),
    { numbers: [], holdings: [] },
  );
  // A hypothetical his owner opened. Engaging with it is law 2.
  assert.equal(claimedHoldings('Ace king is a call at that price.').size, 0);
});

test('LIFE-2: a figure is not a citation', () => {
  const a = played();
  for (const reply of [
    'I am still down 1450.',
    '2400 across the whole thing. 1450 of it this week.',
    'I folded 810 hands waiting for something to happen.',
    'Low room, forty hands, then I stop.',
  ]) {
    assert.deepEqual(inventedCitations(a, { reply }), { numbers: [], holdings: [] }, reply);
  }
  // A hand number is only a citation when it is dressed as one.
  assert.deepEqual([...handNumbersIn('hand 812 and #811 and hand number 810')], [812, 811, 810]);
  assert.deepEqual([...handNumbersIn('812 hands, 1450 down')], []);
});

test('LIFE-2: saying he cannot place it is never an invention', () => {
  // It names a hand number that is not his. That is the point of the sentence,
  // and it is exactly what the prompt asks him to do.
  const a = played();
  assert.deepEqual(inventedCitations(a, { reply: 'I do not remember hand 700.' }),
    { numbers: [], holdings: [] });
  assert.deepEqual(inventedCitations(a, { reply: 'Hand 700 is not one of mine.' }),
    { numbers: [], holdings: [] });
});

// ── the gate and the repair ─────────────────────────────────────────────────

test('LIFE-2: the record is what turns the fifth law on', () => {
  const reply = 'I had aces and he rivered a flush on me.';
  // Without a record, the other four laws still run. A caller with no record in
  // hand should get those rather than nothing.
  assert.ok(!faultsIn({ said: 'and?', reply }).includes('invention'));
  assert.ok(faultsIn({ said: 'and?', reply, agent: played() }).includes('invention'));
});

test('LIFE-2: an invented hand is replaced by a real one, not by a hedge', () => {
  const fixed = repairReply(played(), { said: 'what happened?', faults: ['invention'] });
  assert.match(fixed, /Hand 812/);
  assert.match(fixed, /Ah Kd/);
  assert.match(fixed, /cost me 820/);
  assert.match(fixed, /Board Qh 7d 2s Kc 3h/);
  // It goes first: a false sentence has to go whatever else is right about it.
  const both = repairReply(played(), { said: 'how did the session go?', faults: ['deflection', 'invention'] });
  assert.match(both, /Hand 812/);
});

test('LIFE-2: with nothing behind him, the repair is the plain admission', () => {
  const none = { recentHands: [], sessionLog: [] };
  const line = repairReply(none, { said: 'what happened?', faults: ['invention'] });
  assert.equal(line, 'I have not played a hand yet. There is nothing for me to tell you about.');
  // And the admission has to survive its own gate, or the repair would be a
  // reply the product then rejects.
  assert.deepEqual(faultsIn({ said: 'what happened?', reply: line, agent: none }), []);
});
