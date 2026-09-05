// src/agent/ownerMemory.test.js — RELATE-1
//
// The owner ledger. The load-bearing test here is the guardrail one: no code
// path writes a line without a message or an owner action. It is written as a
// property of the WRITERS table rather than a check on today's call sites, so
// it still fails when somebody adds a `days_since_login` event next year.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OWNER_MEMORY_MAX, COMPRESS_EVERY_SESSIONS, TONE, WRITERS, OWNER_EVENTS,
  ensureOwnerMemory, recordOwnerEvent, compressOwnerMemory, tickOwnerMemorySession,
  ownerToneScore, ownerMemoryContext,
  isAskingAboutOwner, whatDoYouThinkOfMe,
} from './ownerMemory.js';

const agent = (over = {}) => ({ id: 'a1', name: 'Balanced', ...over });

// ── the guardrail ────────────────────────────────────────────────────────────

test('RELATE-1: every writer is an owner ACT — none can fire on silence', () => {
  // The Mood Design Law's no-guilt guardrail, enforced on the table itself.
  const SILENCE = /silence|absent|absence|away|neglect|ignored you|forgot|days? since|hasn'?t (logged|come|been)|no one came|left me alone|didn'?t (visit|come|open|log)/i;

  for (const [type, writer] of Object.entries(WRITERS)) {
    assert.equal(typeof writer.ownerAct, 'string', `${type} must name the owner act`);
    assert.ok(writer.ownerAct.length > 0, `${type} ownerAct is empty`);
    assert.equal(SILENCE.test(writer.ownerAct), false,
      `${type} is written from absence, not an act: "${writer.ownerAct}"`);
    assert.equal(SILENCE.test(type), false, `event name "${type}" describes absence`);
    assert.ok([TONE.HOSTILE, TONE.NEUTRAL, TONE.DECENT].includes(writer.tone), `${type} tone`);
    assert.equal(typeof writer.line, 'function', `${type} line`);
  }
});

test('RELATE-1: an unknown event writes nothing rather than inventing a line', () => {
  const a = agent();
  assert.equal(recordOwnerEvent(a, 'days_since_login', { days: 9 }), null);
  assert.equal(recordOwnerEvent(a, 'you_never_visit'), null);
  assert.deepEqual(a.ownerMemory ?? [], []);
});

test('RELATE-1: no writer produces a line about being left alone', () => {
  const a = agent();
  const GUILT = /alone|abandon|neglect|miss(ed)? you|never (come|visit|here)|forgot about me|where were you/i;
  for (const type of OWNER_EVENTS) {
    recordOwnerEvent(a, type, {
      text: 'you idiot', item: 'beer', amount: 500, what: 'tighten up',
      holeCards: ['Qh', '3d'], handNumber: 12, losing: true, aboutHand: true,
    });
  }
  for (const e of a.ownerMemory) {
    assert.equal(GUILT.test(e.text), false, `guilt line from ${e.type}: "${e.text}"`);
  }
});

// ── writing ──────────────────────────────────────────────────────────────────

test('a needle from a losing night becomes a line in his voice', () => {
  const a = agent();
  const e = recordOwnerEvent(a, 'needle', { text: 'you absolute idiot', losing: true });
  assert.equal(e.text, 'gets on my back when I lose');
  assert.equal(e.tone, TONE.HOSTILE);
  assert.equal(e.count, 1);
  assert.ok(e.id && e.ts);
});

test('a question about a hand he actually read becomes a decent line', () => {
  const a = agent();
  const e = recordOwnerEvent(a, 'care', { aboutHand: true, holeCards: ['Qh', '3d'] });
  assert.equal(e.text, 'asked about the Q3o hand and actually read it');
  assert.equal(e.tone, TONE.DECENT);
});

test('being cut off names the night it happened', () => {
  const a = agent();
  const e = recordOwnerEvent(a, 'cut', { holeCards: ['Qh', '3d'] });
  assert.equal(e.text, 'cut me off after the Q3o hand');
  assert.equal(e.tone, TONE.HOSTILE);
});

test('the same fact twice is one memory with a count, never two lines', () => {
  const a = agent();
  for (let i = 0; i < 7; i++) recordOwnerEvent(a, 'needle', { losing: true });
  assert.equal(a.ownerMemory.length, 1);
  assert.equal(a.ownerMemory[0].count, 7);
});

test('the ledger is capped at twelve lines, oldest out first', () => {
  const a = agent();
  for (let i = 0; i < 20; i++) recordOwnerEvent(a, 'funded', { amount: i * 100 });
  assert.equal(a.ownerMemory.length, OWNER_MEMORY_MAX);
  assert.equal(a.ownerMemory.at(-1).text, 'staked me 1900');
});

test('nothing stores a transcript, on EITHER needle branch', () => {
  const secret = 'my card number is 4111 1111 1111 1111 and I live at 12 Elm Street';
  // Both branches, because the losing:false branch is the one that used to
  // quote the owner and relate.test.js caught it.
  for (const losing of [true, false]) {
    const a = agent();
    recordOwnerEvent(a, 'needle', { text: secret, losing });
    recordOwnerEvent(a, 'care', { aboutHand: false });
    const blob = JSON.stringify(a.ownerMemory);
    assert.equal(blob.includes('4111'), false, `losing=${losing}: message body stored verbatim`);
    assert.equal(blob.includes('Elm Street'), false, `losing=${losing}`);
    assert.equal(blob.includes('card number'), false, `losing=${losing}`);
  }
});

test('no writer echoes the owner text back, whatever is passed in', () => {
  const marker = 'ZZQXMARKERQXZZ';
  for (const type of OWNER_EVENTS) {
    const a = agent();
    recordOwnerEvent(a, type, {
      text: marker, item: marker, what: marker,
      amount: 100, holeCards: ['Qh', '3d'], losing: false, aboutHand: false,
    });
    const blob = JSON.stringify(a.ownerMemory);
    // `what` is a proposal HIS OWN engine wrote, so it is allowed through;
    // everything sourced from the owner's keyboard is not.
    if (type === 'proposal_accepted' || type === 'proposal_rejected') continue;
    assert.equal(blob.includes(marker), false, `${type} echoed owner input`);
  }
});

// ── compression ──────────────────────────────────────────────────────────────

test('compression merges duplicates and keeps the loudest', () => {
  const a = agent({ ownerMemory: [] });
  // Hand-built so two entries carry the same text with separate counts, which
  // is what a pre-compression ledger written across sessions looks like.
  a.ownerMemory = [
    { id: '1', ts: 1, type: 'needle', tone: -1, text: 'gets on my back when I lose', count: 3 },
    { id: '2', ts: 2, type: 'needle', tone: -1, text: 'gets on my back when I lose', count: 4 },
    { id: '3', ts: 3, type: 'care', tone: 1, text: 'asked about the Q3o hand and actually read it', count: 1 },
  ];
  compressOwnerMemory(a);
  assert.equal(a.ownerMemory.length, 2);
  const needle = a.ownerMemory.find((e) => e.type === 'needle');
  assert.equal(needle.count, 7, 'counts add up rather than one copy winning');
});

test('compression runs on the session cadence, not every session', () => {
  const a = agent();
  for (let i = 0; i < COMPRESS_EVERY_SESSIONS - 1; i++) {
    assert.equal(tickOwnerMemorySession(a), false, `session ${i + 1}`);
  }
  assert.equal(tickOwnerMemorySession(a), true, `session ${COMPRESS_EVERY_SESSIONS}`);
});

// ── reading ──────────────────────────────────────────────────────────────────

test('tone score weights by how often it happened', () => {
  const hostile = agent();
  for (let i = 0; i < 6; i++) recordOwnerEvent(hostile, 'needle', { losing: true });
  recordOwnerEvent(hostile, 'care', { aboutHand: true, holeCards: ['Ah', 'Kd'] });
  assert.ok(ownerToneScore(hostile) < -0.5, `got ${ownerToneScore(hostile)}`);

  const decent = agent();
  for (let i = 0; i < 6; i++) recordOwnerEvent(decent, 'pep_talk');
  assert.ok(ownerToneScore(decent) > 0.5);
});

test('an empty ledger has no tone — no ledger is not a bad relationship', () => {
  assert.equal(ownerToneScore(agent()), null);
  assert.equal(ownerToneScore(agent({ ownerMemory: [] })), null);
});

test('only the last week counts toward the tone', () => {
  const a = agent({ ownerMemory: [] });
  const old = Date.now() - 30 * 24 * 60 * 60 * 1000;
  a.ownerMemory.push({ id: '1', ts: old, type: 'needle', tone: -1, text: 'old grudge', count: 20 });
  assert.equal(ownerToneScore(a), null, 'a month-old grievance is not this week');
  recordOwnerEvent(a, 'pep_talk');
  assert.equal(ownerToneScore(a), 1, 'this week is what reads');
});

test('the prompt block is lines, not a log', () => {
  const a = agent();
  for (let i = 0; i < 3; i++) recordOwnerEvent(a, 'needle', { losing: true });
  recordOwnerEvent(a, 'funded', { amount: 5000 });
  const ctx = ownerMemoryContext(a);
  assert.match(ctx, /What you remember about your owner/);
  assert.match(ctx, /- gets on my back when I lose \(3×\)/);
  assert.match(ctx, /- staked me 5000/);
  assert.equal(ownerMemoryContext(agent()), '', 'nothing to say when nothing happened');
});

// ── "what do you think of me?" ───────────────────────────────────────────────

test('the question is recognised in the shapes people actually type', () => {
  for (const q of [
    'what do you think of me?', 'What do you make of me',
    "what's your read on me?", 'do you like me',
    'am i a good owner?', 'how would you describe me',
  ]) {
    assert.equal(isAskingAboutOwner(q), true, q);
  }
  for (const q of ['what do you think of that hand', 'how are you', '', 'deploy him']) {
    assert.equal(isAskingAboutOwner(q), false, q);
  }
});

test('he answers from the ledger, and the answer differs with the record', () => {
  const hostile = agent();
  for (let i = 0; i < 5; i++) recordOwnerEvent(hostile, 'needle', { losing: true });
  recordOwnerEvent(hostile, 'cut', { holeCards: ['Qh', '3d'] });

  const decent = agent();
  for (let i = 0; i < 4; i++) recordOwnerEvent(decent, 'care', { aboutHand: true, holeCards: ['Ah', 'Kd'] });
  recordOwnerEvent(decent, 'pep_talk');

  const mixed = agent();
  recordOwnerEvent(mixed, 'needle', { losing: true });
  recordOwnerEvent(mixed, 'care', { aboutHand: true, holeCards: ['Ah', 'Kd'] });

  const hot = whatDoYouThinkOfMe(hostile);
  const good = whatDoYouThinkOfMe(decent);
  const mid = whatDoYouThinkOfMe(mixed);

  assert.notEqual(hot, good);
  assert.notEqual(hot, mid);
  assert.notEqual(good, mid);
  assert.match(hot, /gets on my back|cut me off/);
  assert.match(good, /asked about|talked me down/);
  assert.match(mid, /Mixed/);
});

test('with no ledger he says so instead of making something up', () => {
  assert.match(whatDoYouThinkOfMe(agent()), /Not much to go on yet/);
});

test('the answer is short enough for the thread and carries no guilt', () => {
  const GUILT = /you never|you should have|your fault|why don'?t you|you owe me/i;
  const a = agent();
  for (const type of OWNER_EVENTS) {
    recordOwnerEvent(a, type, { text: 'idiot', item: 'beer', amount: 100, what: 'tighten up', holeCards: ['Qh', '3d'], losing: true, aboutHand: true });
    const answer = whatDoYouThinkOfMe(a);
    assert.ok(answer.length < 200, `too long after ${type}: ${answer.length}`);
    assert.equal(GUILT.test(answer), false, `guilt after ${type}: ${answer}`);
  }
});

test('ensureOwnerMemory is idempotent and never drops what is there', () => {
  const a = agent();
  ensureOwnerMemory(a);
  recordOwnerEvent(a, 'pep_talk');
  ensureOwnerMemory(a);
  assert.equal(a.ownerMemory.length, 1);
});
