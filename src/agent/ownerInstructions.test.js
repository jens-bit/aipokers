// src/agent/ownerInstructions.test.js — LIFE-1 job 3
//
// "If you chat to them about specific plans and stuff like that, they won't
// properly remember it."

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  OWNER_INSTRUCTIONS_MAX, INSTRUCTION_MAX_CHARS, KINDS,
  classify, recordOwnerInstruction, ownerInstructions,
  ownerInstructionsContext, whenSaid,
} from './ownerInstructions.js';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

// ── What counts ─────────────────────────────────────────────────────────────

test('LIFE-1: an instruction is recognised as one', () => {
  for (const said of [
    'play tighter from early position',
    'stop bluffing the river',
    "don't call down light against the House",
    'be more aggressive when you have position',
    'you should fold small pairs out of position',
    'I want you to stick to the low room',
    'make sure you leave when you are up 2000',
    'remember that Granite always folds to a turn barrel',
  ]) {
    assert.equal(classify(said), 'instruction', said);
  }
});

test('LIFE-1: a plan is recognised as one', () => {
  for (const said of [
    'from now on only play the low room',
    "tomorrow we're going to try the 50/100 game",
    "let's grind the kitchen table tonight",
    'next session we should target Doyle',
    'going forward, no more than two buy-ins a night',
  ]) {
    assert.equal(classify(said), 'plan', said);
  }
});

test('LIFE-1: an agreement is recognised as one', () => {
  for (const said of [
    "deal — you play tight and I'll get you a beer after",
    'I promise I will not cut you off again',
    "if you win tonight I'll buy you a snack",
  ]) {
    assert.ok(['agreement', 'plan', 'instruction'].includes(classify(said)), said);
  }
  assert.equal(classify('deal'), 'agreement');
});

test('LIFE-1: everything else writes nothing, which is most messages', () => {
  for (const said of [
    'hey', 'hello there', 'thanks', 'ok', 'lol',
    'should I play tighter?',            // a question is not an order
    'do you think we should try the big room?',
    'you are an idiot',                   // ownerMemory's business, not this
    'that was a brutal cooler',
    'I hate it when you fold the turn',   // contains "you fold", is not an order
    '',
    '   ',
  ]) {
    assert.equal(classify(said), null, JSON.stringify(said));
  }
});

test('LIFE-1: every kind it can return is a declared kind', () => {
  for (const said of ['play tighter', 'from now on play low', 'deal']) {
    assert.ok(KINDS.includes(classify(said)), said);
  }
});

// ── Storage ─────────────────────────────────────────────────────────────────

test('LIFE-1: it keeps HIS WORDS, not a paraphrase', () => {
  // The opposite of ownerMemory's rule, deliberately. He has to be able to
  // quote it back, and "told me how to play" cannot be quoted.
  const agent = {};
  recordOwnerInstruction(agent, 'from now on only play the low room', { now: NOW });
  assert.equal(ownerInstructions(agent)[0].text, 'from now on only play the low room');
});

test('LIFE-1: newest first, so a later order outranks an earlier one', () => {
  const agent = {};
  recordOwnerInstruction(agent, 'play tighter', { now: NOW });
  recordOwnerInstruction(agent, 'actually play looser', { now: NOW + 1000 });
  assert.equal(ownerInstructions(agent)[0].text, 'actually play looser');
  assert.equal(ownerInstructions(agent)[1].text, 'play tighter');
});

test('LIFE-1: saying it again is one memory with a count, not two lines', () => {
  const agent = {};
  recordOwnerInstruction(agent, 'stop calling down light', { now: NOW });
  recordOwnerInstruction(agent, 'play the low room', { now: NOW + 100 });
  recordOwnerInstruction(agent, 'Stop calling down light!', { now: NOW + 200 });
  const list = ownerInstructions(agent);
  assert.equal(list.length, 2, 'case and punctuation are not a new instruction');
  assert.equal(list[0].count, 2);
  assert.equal(list[0].text, 'stop calling down light', 'the original wording survives');
  assert.equal(list[0].ts, NOW + 200, 'and it moves to the front');
});

test('LIFE-1: bounded — an owner who never stops talking does not grow the record', () => {
  const agent = {};
  for (let i = 0; i < 50; i++) {
    recordOwnerInstruction(agent, `play tighter in spot number ${i}`, { now: NOW + i });
  }
  assert.equal(ownerInstructions(agent).length, OWNER_INSTRUCTIONS_MAX);
  // What survives is the newest, not the first eight he ever said.
  assert.match(ownerInstructions(agent)[0].text, /number 49/);
});

test('LIFE-1: one line is clipped, so eight of them are a paragraph', () => {
  const agent = {};
  recordOwnerInstruction(agent, `play tighter because ${'x'.repeat(500)}`, { now: NOW });
  assert.ok(ownerInstructions(agent)[0].text.length <= INSTRUCTION_MAX_CHARS);
});

test('LIFE-1: nothing but a message the owner sent can write a line', () => {
  // The guardrail, as a property. There is no exported writer that takes
  // anything other than a string the owner typed — no clock, no event type,
  // no session hook.
  const agent = {};
  assert.equal(recordOwnerInstruction(agent, null, { now: NOW }), null);
  assert.equal(recordOwnerInstruction(agent, '', { now: NOW }), null);
  assert.equal(recordOwnerInstruction(null, 'play tighter', { now: NOW }), null);
  assert.deepEqual(ownerInstructions(agent), []);
});

// ── Reading it back ─────────────────────────────────────────────────────────

test('LIFE-1: an agent told nothing carries no block at all', () => {
  assert.equal(ownerInstructionsContext({}), '');
  assert.equal(ownerInstructionsContext({ ownerInstructions: [] }), '');
});

test('LIFE-1: the block carries the words, the age and the repetition', () => {
  const agent = {};
  recordOwnerInstruction(agent, 'play tighter from the blinds', { now: NOW - 2 * DAY });
  recordOwnerInstruction(agent, 'play tighter from the blinds', { now: NOW - DAY });
  recordOwnerInstruction(agent, 'from now on only play the low room', { now: NOW - 3600_000 });
  const block = ownerInstructionsContext(agent, { now: NOW });
  assert.match(block, /from now on only play the low room/);
  assert.match(block, /play tighter from the blinds/);
  assert.match(block, /yesterday/);
  assert.match(block, /an hour ago/);
  assert.match(block, /told you 2 times/);
  // And it says whose words they are, or the model attributes them to itself.
  assert.match(block, /HIS OWN WORDS/);
  assert.match(block, /Newest wins/);
});

test('LIFE-1: when it was said, in the words a person would use', () => {
  assert.equal(whenSaid(NOW, NOW), 'just now');
  assert.equal(whenSaid(NOW - 20 * 60_000, NOW), '20 minutes ago');
  assert.equal(whenSaid(NOW - 3600_000, NOW), 'an hour ago');
  assert.equal(whenSaid(NOW - 5 * 3600_000, NOW), '5 hours ago');
  assert.equal(whenSaid(NOW - DAY, NOW), 'yesterday');
  assert.equal(whenSaid(NOW - 3 * DAY, NOW), '3 days ago');
  assert.equal(whenSaid(NOW - 8 * DAY, NOW), 'last week');
  assert.equal(whenSaid(null, NOW), '');
  // A clock that went backwards does not produce "in 3 days".
  assert.equal(whenSaid(NOW + DAY, NOW), 'just now');
});
