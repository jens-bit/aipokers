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
  assert.equal(repairReply({ }, { said: 'what happened in that hand?', faults: ['deflection'] }), null);
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
