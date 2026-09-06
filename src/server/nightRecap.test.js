// src/server/nightRecap.test.js — COST-1
//
// One call at the end of an unwatched session, and only when there was a
// session worth writing up.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPrompt, parseRecap, writeNightRecap, MIN_LINES, MAX_LINES, MIN_HANDS,
} from './nightRecap.js';

const CAST = [
  { seat: 0, name: 'Balance', style: 'tight and patient', mood: 'tilted', note: 'lost to Granite twice' },
  { seat: 1, name: 'Granite', style: 'immovable', mood: 'neutral', note: null },
];

const SESSION = {
  hands: 84,
  net: -1240,
  biggestPot: 3200,
  moments: [
    'he was well ahead on the turn and lost it on the river to Granite',
    'he took 900 off Granite with nothing',
    'the biggest pot of the night, 3200, went to Granite',
  ],
};

// Deliberately free of the word "line" — voice.js treats it as solver speak
// ("tight aggressive line"), which is exactly right, and exactly a trap for a
// lazy fixture.
const FIVE = ['That was mine.', 'It was not.', 'River again.', 'Every time.', 'Deal.'].join('\n');

// ── the prompt ──────────────────────────────────────────────────────────────

test('the prompt is the evening that happened, not a mood and a net', () => {
  const { user } = buildPrompt(CAST, SESSION);
  assert.match(user, /84 hands/);
  assert.match(user, /biggest pot 3200/);
  assert.match(user, /lost it on the river to Granite/);
});

test('the voices arrive with their styles and where the night left them', () => {
  const { user } = buildPrompt(CAST, SESSION);
  assert.match(user, /Balance; plays tight and patient; finished the night tilted/);
  assert.ok(!/finished the night neutral/.test(user));
});

test('a session with nothing in it still asks for something honest', () => {
  const { user } = buildPrompt(CAST, { hands: 40, moments: [] });
  assert.match(user, /a long quiet grind/);
});

test('the line budget is stated in the prompt, not only enforced after', () => {
  const { system } = buildPrompt(CAST, SESSION);
  assert.match(system, new RegExp(`between ${MIN_LINES} and ${MAX_LINES} lines`));
});

// ── the parse ───────────────────────────────────────────────────────────────

test('lines cycle through the voices at the table', () => {
  const out = parseRecap(FIVE, CAST);
  assert.equal(out.length, 5);
  assert.deepEqual(out.map((l) => l.name), ['Balance', 'Granite', 'Balance', 'Granite', 'Balance']);
});

test('more than MAX_LINES comes back trimmed', () => {
  const out = parseRecap(Array.from({ length: 12 }, (_, i) => `Said ${i}.`).join('\n'), CAST);
  assert.equal(out.length, MAX_LINES);
});

test('fewer than MIN_LINES is a fragment, and a fragment is not an evening', () => {
  assert.deepEqual(parseRecap('Only this.\nAnd this.', CAST), []);
  assert.equal(parseRecap('One.\nTwo.\nThree.', CAST).length, 3);
});

test('solver lines are dropped and the rest close the gap', () => {
  const out = parseRecap('I had 72% equity.\nA.\nB.\nC.', CAST);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((l) => l.text), ['A.', 'B.', 'C.']);
  assert.equal(out[0].name, 'Balance', 'the first surviving line is the first voice');
});

test('numbering and name prefixes are stripped', () => {
  const out = parseRecap('1. Balance: Mine to lose.\n2. Granite: Never yours.\n3. Balance: Deal.', CAST);
  assert.equal(out[0].text, 'Mine to lose.');
  assert.equal(out[1].text, 'Never yours.');
});

test('nothing usable is nothing', () => {
  assert.deepEqual(parseRecap('', CAST), []);
  assert.deepEqual(parseRecap(FIVE, []), []);
  assert.deepEqual(parseRecap(null, CAST), []);
});

// ── the call ────────────────────────────────────────────────────────────────

test('a short session is not written up, and does not cost a call', async () => {
  let called = 0;
  const out = await writeNightRecap(CAST, { ...SESSION, hands: MIN_HANDS - 1 }, {
    call: async () => { called++; return FIVE; },
  });
  assert.deepEqual(out, []);
  assert.equal(called, 0);
});

test('a real session is one call, and one call only', async () => {
  let called = 0;
  const out = await writeNightRecap(CAST, SESSION, {
    call: async () => { called++; return FIVE; },
  });
  assert.equal(called, 1);
  assert.equal(out.length, 5);
  assert.equal(out[0].seat, 0);
});

test('an empty cast is a skip, not a crash', async () => {
  assert.deepEqual(await writeNightRecap([], SESSION, { call: async () => FIVE }), []);
  assert.deepEqual(await writeNightRecap(null, SESSION, { call: async () => FIVE }), []);
});

test('a call that fails costs the session its recap and nothing else', async () => {
  const out = await writeNightRecap(CAST, SESSION, {
    call: async () => { throw new Error('timeout'); },
  });
  assert.deepEqual(out, []);
});

test('without a key the real call path does nothing and spends nothing', async () => {
  const had = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.deepEqual(await writeNightRecap(CAST, SESSION), []);
  } finally {
    if (had !== undefined) process.env.ANTHROPIC_API_KEY = had;
  }
});
