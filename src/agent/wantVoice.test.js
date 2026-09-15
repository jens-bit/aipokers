// src/agent/wantVoice.test.js — LIFE-2 job 1 (and the audit job 4 asked for)
//
// Two claims, and the second one is the job:
//
//   1. Every ask he can raise has a line and an owner-facing action behind it.
//      Both lists are DERIVED from wants.js rather than written out again, so a
//      ninth ask added there cannot ship with no voice and no verb — this file
//      goes red on the gap instead of the product going quiet.
//   2. No two natures say the same sentence in the same state. That is the
//      whole point of a nature, and it is the one thing an eye cannot check
//      across sixty-four lines, so it is computed.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ASK_KINDS, ASKS } from './wants.js';
import { NATURES } from './attributes.js';
import {
  NATURE_WANT_LINES, VOICED_NATURES, WANT_ACTIONS, ACTION_BY_KIND, ACTION_LABELS,
  natureWantLine, natureName, wantAction, wantActionLabel, voicedKinds,
} from './wantVoice.js';

// ── coverage ────────────────────────────────────────────────────────────────

test('every nature the game can birth has a voice here', () => {
  const born = NATURES.map((n) => n.name).sort();
  assert.deepEqual([...VOICED_NATURES].sort(), born);
});

test('every ask kind has a line in every voice', () => {
  const kinds = voicedKinds();
  assert.deepEqual([...kinds].sort(), [...ASK_KINDS].sort());
  for (const nature of VOICED_NATURES) {
    for (const kind of kinds) {
      const line = NATURE_WANT_LINES[nature][kind];
      assert.ok(line, `${nature} has nothing to say for ${kind}`);
      assert.ok(line.length <= 64, `${nature}/${kind} is too long for a bubble: ${line}`);
    }
  }
});

test('every ask kind names an action the owner can actually take', () => {
  for (const kind of ASK_KINDS) {
    const action = wantAction(kind);
    assert.ok(action, `${kind} leaves the owner with nothing to do`);
    assert.ok(WANT_ACTIONS.includes(action), `${kind} maps to an unknown verb ${action}`);
    assert.ok(wantActionLabel(kind), `${kind} has a verb but no button copy`);
  }
  // Every verb in the vocabulary is reachable — a verb no ask produces is an
  // adjective, and attributes.js's law 5 bans those for the same reason.
  const used = new Set(ASK_KINDS.map(wantAction));
  assert.deepEqual([...used].sort(), [...WANT_ACTIONS].sort());
  assert.deepEqual(Object.keys(ACTION_LABELS).sort(), [...WANT_ACTIONS].sort());
});

test('the four verbs the brief named are the four verbs an owner presses', () => {
  // "rest, feed, give chips, deploy" — LIFE-2 job 1, verbatim. `listen` is the
  // fifth and it belongs to `brag` alone; nothing else may reach it.
  assert.equal(ACTION_BY_KIND.rest, 'rest');
  assert.equal(ACTION_BY_KIND.beer, 'feed');
  assert.equal(ACTION_BY_KIND.food, 'feed');
  assert.equal(ACTION_BY_KIND.fund, 'chips');
  for (const kind of ['deploy', 'back_in', 'nemesis']) assert.equal(ACTION_BY_KIND[kind], 'deploy');
  assert.deepEqual(ASK_KINDS.filter((k) => wantAction(k) === 'listen'), ['brag']);
});

// ── the job-4 claim ─────────────────────────────────────────────────────────

test('no two natures say the same thing in the same state', () => {
  const collisions = [];
  for (const kind of voicedKinds()) {
    const byLine = new Map();
    for (const nature of VOICED_NATURES) {
      const line = NATURE_WANT_LINES[nature][kind];
      if (byLine.has(line)) collisions.push(`${kind}: ${byLine.get(line)} and ${nature} both say "${line}"`);
      byLine.set(line, nature);
    }
  }
  assert.deepEqual(collisions, []);
});

test('a Rock and a Showman are not the same man at the same heat', () => {
  // The sentence the job was written against. Pick the two furthest-apart
  // natures in the table and require a difference in every single state.
  for (const kind of voicedKinds()) {
    assert.notEqual(
      natureWantLine('Rock', kind, { nemesisName: 'Granite', roomPhrase: 'in the back room' }),
      natureWantLine('Showman', kind, { nemesisName: 'Granite', roomPhrase: 'in the back room' }),
      `Rock and Showman are interchangeable when they want ${kind}`,
    );
  }
});

// ── the lines themselves ────────────────────────────────────────────────────

test('the same state says the same sentence twice — nothing rolls', () => {
  // A voiced line has no seed and no alternates. An ask that rewrote itself on
  // a reopened screen would read as him changing his mind about what he wants.
  for (let i = 0; i < 5; i++) {
    assert.equal(natureWantLine('Grinder', 'beer'), "Get me a beer. It's been a long one.");
  }
});

test('nature comes off the record in either shape it is stored in', () => {
  assert.equal(natureName('Shark'), 'Shark');
  assert.equal(natureName({ name: 'Shark' }), 'Shark');
  assert.equal(natureName(null), null);
  assert.equal(natureName({}), null);
  assert.equal(natureName(''), null);
  assert.equal(natureWantLine({ name: 'Shark' }, 'rest'), natureWantLine('Shark', 'rest'));
});

test('nemesis is composed, and keeps the floor half in front of his half', () => {
  const line = natureWantLine('Shark', 'nemesis', { nemesisName: 'Granite', roomPhrase: 'in the back room' });
  assert.equal(line, "Granite is in the back room. Send me. He's mine.");
  // No man and no room is no claim — the same rule wants.askLine keeps.
  assert.equal(natureWantLine('Shark', 'nemesis', { nemesisName: 'Granite' }), null);
  assert.equal(natureWantLine('Shark', 'nemesis', { roomPhrase: 'upstairs' }), null);
});

test('an agent with no nature is given no voice, rather than a borrowed one', () => {
  // null is the whole answer: the caller keeps whatever the ask already said.
  // See the note in wantVoice.js about why there is no fallback helper here.
  for (const kind of voicedKinds()) {
    assert.equal(natureWantLine(null, kind), null);
    assert.equal(natureWantLine({ name: '' }, kind), null);
    // …and so does a nature this table has never heard of, rather than throwing.
    assert.equal(natureWantLine('Wizard', kind), null);
  }
});

test('an unknown kind has no line and no action rather than a wrong one', () => {
  assert.equal(natureWantLine('Rock', 'sandwich'), null);
  assert.equal(wantAction('sandwich'), null);
  assert.equal(wantActionLabel('sandwich'), null);
});

test('the table is frozen — a want cannot be rewritten at runtime', () => {
  assert.throws(() => { NATURE_WANT_LINES.Rock.beer = 'Get me a pint.'; }, TypeError);
  assert.throws(() => { ACTION_BY_KIND.rest = 'deploy'; }, TypeError);
  // And every kind in the priority table is a kind the voice knows about.
  assert.deepEqual(Object.keys(ASKS).sort(), [...ASK_KINDS].sort());
});
