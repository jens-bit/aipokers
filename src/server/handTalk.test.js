// src/server/handTalk.test.js — COST-1
//
// One call per hand, and what comes back is attributed to the right mouth.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPrompt, parseTalk, writeHandTalk, MAX_SPEAKERS } from './handTalk.js';

const HAND = {
  board: ['As', '7d', '2c', 'Kh', '9s'],
  pot: 860,
  result: 'showdown',
  log: [
    { street: 'preflop', who: 'Balance', action: 'raised to 60' },
    { street: 'preflop', who: 'Granite', action: 'called' },
    { street: 'turn', who: 'Granite', action: 'raised to 400' },
    { street: 'river', who: 'Balance', action: 'called' },
  ],
};

const CAST = [
  { seat: 0, name: 'Balance', style: 'tight and patient', mood: 'tilted', trigger: 'lostAsFavorite', note: 'Granite is his nemesis' },
  { seat: 2, name: 'Granite', style: 'immovable', mood: 'neutral', trigger: 'wonBigPot', note: null },
];

// ── the prompt ──────────────────────────────────────────────────────────────

test('the prompt carries the hand, not just the trigger', () => {
  const { user } = buildPrompt(CAST, HAND);
  assert.match(user, /As 7d 2c Kh 9s/);
  assert.match(user, /860/);
  assert.match(user, /turn: Granite raised to 400/, 'the writer can see the turn raise');
});

test('each speaker arrives with his voice, his mood and what he knows', () => {
  const { user } = buildPrompt(CAST, HAND);
  assert.match(user, /Balance; plays tight and patient; currently tilted/);
  assert.match(user, /Granite is his nemesis/);
  assert.match(user, /he was well ahead and lost it anyway/);
  assert.match(user, /he just took a big pot/);
  // A neutral mood is not worth a word.
  assert.ok(!/currently neutral/.test(user));
});

test('the prompt asks for exactly as many lines as there are speakers', () => {
  assert.match(buildPrompt(CAST, HAND).user, /Write 2 line\(s\):/);
  assert.match(buildPrompt([CAST[0]], HAND).user, /Write 1 line\(s\):/);
});

test('a hand with no betting still describes itself', () => {
  const { user } = buildPrompt(CAST, { board: [], pot: 30, result: 'fold', log: [] });
  assert.match(user, /\(no betting\)/);
  assert.match(user, /BOARD: none/);
});

// ── the parse ───────────────────────────────────────────────────────────────

test('lines are handed out in order, one per speaker', () => {
  const out = parseTalk('That was mine to lose.\nIt was never yours.', CAST);
  assert.deepEqual(out, [
    { seat: 0, name: 'Balance', text: 'That was mine to lose.' },
    { seat: 2, name: 'Granite', text: 'It was never yours.' },
  ]);
});

test('numbering, bullets and name prefixes the model added are stripped', () => {
  const out = parseTalk('1. Balance: That was mine to lose.\n- Granite: It was never yours.', CAST);
  assert.equal(out[0].text, 'That was mine to lose.');
  assert.equal(out[1].text, 'It was never yours.');
});

test('a solver line is dropped and does NOT slide onto the next man', () => {
  const out = parseTalk('I had 72% equity there.\nIt was never yours.', CAST);
  assert.equal(out.length, 1);
  assert.equal(out[0].seat, 2, 'the second line stays the second player\'s');
  assert.equal(out[0].text, 'It was never yours.');
});

test('extra lines beyond the cast are ignored', () => {
  const out = parseTalk('One.\nTwo.\nThree.\nFour.', CAST);
  assert.equal(out.length, 2);
});

test('a long line is capped rather than shown at full length', () => {
  const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen.';
  const out = parseTalk(`${long}\nShort.`, CAST);
  assert.ok(out[0].text.split(/\s+/).length <= 12, out[0].text);
});

test('nothing usable comes back as nothing, not as an empty bubble', () => {
  assert.deepEqual(parseTalk('', CAST), []);
  assert.deepEqual(parseTalk(null, CAST), []);
  assert.deepEqual(parseTalk('lines', null), []);
});

// ── the call ────────────────────────────────────────────────────────────────

test('no speakers means no call at all', async () => {
  let called = 0;
  const out = await writeHandTalk([], HAND, { call: async () => { called++; return 'x'; } });
  assert.deepEqual(out, []);
  assert.equal(called, 0, 'the common case has to be free');
});

test('one call covers every seat that spoke', async () => {
  let called = 0;
  const out = await writeHandTalk(CAST, HAND, {
    call: async () => { called++; return 'Mine to lose.\nNever yours.'; },
  });
  assert.equal(called, 1, 'one call, not one per seat');
  assert.equal(out.length, 2);
});

test('the cast is capped so a full table cannot become a conversation', async () => {
  const many = Array.from({ length: 6 }, (_, i) => ({ seat: i, name: `P${i}`, trigger: 'cardDead' }));
  let seen = 0;
  await writeHandTalk(many, HAND, {
    call: async ({ user }) => { seen = Number(/Write (\d+) line/.exec(user)?.[1]); return ''; },
  });
  assert.equal(seen, MAX_SPEAKERS);
});

test('a call that throws costs the table its talk and nothing else', async () => {
  const out = await writeHandTalk(CAST, HAND, {
    call: async () => { throw new Error('timeout'); },
  });
  assert.deepEqual(out, []);
});

test('without a key the real call path does nothing and spends nothing', async () => {
  const had = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    assert.deepEqual(await writeHandTalk(CAST, HAND), []);
  } finally {
    if (had !== undefined) process.env.ANTHROPIC_API_KEY = had;
  }
});
