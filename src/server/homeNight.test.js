// src/server/homeNight.test.js — HOME-STATE-1 (item 4)
//
// "While you were out": the one part of the home that costs money.
//
// So the cap is what most of this file is about. One model call per owner per
// day, nothing without half an hour of evidence, and a call that fails costs
// the day rather than retrying into a bill. The model is injected, so nothing
// here talks to one — which is also the testing law (TEST-2).

delete process.env.ANTHROPIC_API_KEY;

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  TOGETHER_MIN_MS, MAX_CREDIT_MS, MAX_LINES,
  dayKey, noteHousehold, longestPair, ranToday, maybeRunNightly,
  homeSessionId, parseExchange, buildPrompt, reset,
} from './homeNight.js';
import { Where } from './home.js';
import { ThreadSource } from './thread.js';
import { _closeForTests } from './store.js';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-homenight-'));

let thread;

before(async () => {
  _closeForTests();
  process.chdir(dir);
  thread = await import('./thread.js');
});

after(() => {
  reset();
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

beforeEach(() => reset());

const at = (id, name, where = Where.HOME) => ({
  id, name,
  nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 30 },
  sessionRecap: { text: 'quiet night' },
  location: { where, tableId: where === Where.HOME ? null : 't1', room: null, since: 0 },
});

// Walk a household forward in MAX_CREDIT_MS steps — the same shape the live
// observations arrive in — so the counter is exercised the way it actually
// runs rather than through one giant jump it would clamp away.
function spendEvening(ownerId, agents, ms, start = 1_000) {
  let now = start;
  noteHousehold(ownerId, agents, { now });
  for (let spent = 0; spent < ms; spent += MAX_CREDIT_MS) {
    now += MAX_CREDIT_MS;
    noteHousehold(ownerId, agents, { now });
  }
  return now;
}

// ── The counter ─────────────────────────────────────────────────────────────

test('HOME-STATE-1: only the ones actually home are counted as in together', () => {
  const now = 10_000;
  noteHousehold('o1', [at('a', 'A'), at('b', 'B', Where.TABLE)], { now });
  noteHousehold('o1', [at('a', 'A'), at('b', 'B', Where.TABLE)], { now: now + 60_000 });
  assert.equal(longestPair('o1', { now: now + 60_000 }), null, 'one of them was out all evening');
});

test('HOME-STATE-1: a third coming home does not reset the two who were already in', () => {
  let now = spendEvening('o2', [at('a', 'A'), at('b', 'B')], 20 * 60_000);
  const beforeThird = longestPair('o2', { now }).ms;
  assert.ok(beforeThird >= 20 * 60_000 - MAX_CREDIT_MS);

  now = spendEvening('o2', [at('a', 'A'), at('b', 'B'), at('c', 'C')], 5 * 60_000, now);
  const pair = longestPair('o2', { now });
  assert.deepEqual([pair.a.id, pair.b.id].sort(), ['a', 'b']);
  assert.ok(pair.ms > beforeThird, 'their evening kept accumulating');
});

test('HOME-STATE-1: a gap in observations cannot credit an evening nobody was there for', () => {
  // A laptop that slept for six hours. One observation may only ever credit
  // MAX_CREDIT_MS, so the counter under-counts rather than unlocking a spend.
  noteHousehold('o3', [at('a', 'A'), at('b', 'B')], { now: 0 });
  noteHousehold('o3', [at('a', 'A'), at('b', 'B')], { now: 6 * 3_600_000 });
  assert.equal(longestPair('o3', { now: 6 * 3_600_000 }).ms, MAX_CREDIT_MS);
});

test('HOME-STATE-1: yesterday does not pay for today', () => {
  const monday = Date.parse('2026-09-06T20:00:00Z');
  spendEvening('o4', [at('a', 'A'), at('b', 'B')], TOGETHER_MIN_MS + 60_000, monday);
  const tuesday = Date.parse('2026-09-07T20:00:00Z');
  assert.equal(dayKey(monday) === dayKey(tuesday), false);
  assert.equal(longestPair('o4', { now: tuesday }), null);
});

// ── The cap ─────────────────────────────────────────────────────────────────

test('HOME-STATE-1: no half hour, no call — and the skip is free', async () => {
  let calls = 0;
  const call = async () => { calls++; return 'a\nb'; };
  const agents = [at('a', 'A'), at('b', 'B')];

  const now = spendEvening('o5', agents, 10 * 60_000);
  assert.equal(await maybeRunNightly('o5', agents, { now, call }), null);
  assert.equal(calls, 0, 'ten minutes in is not an evening in');
  assert.equal(ranToday('o5', { now }), false, 'and the day is still open, so tonight can still happen');
});

test('HOME-STATE-1: half an hour in earns exactly one exchange, once', async () => {
  let calls = 0;
  const call = async () => { calls++; return 'Long day.\nThey are all long.\nGo to bed.'; };
  const agents = [at('a', 'The Clock'), at('b', 'River Rat')];

  const now = spendEvening('o6', agents, TOGETHER_MIN_MS + MAX_CREDIT_MS);
  const run = await maybeRunNightly('o6', agents, { now, call });
  assert.ok(run, 'they were in together long enough');
  assert.equal(calls, 1);
  assert.equal(run.lines.length, 3);
  assert.equal(ranToday('o6', { now }), true);

  // Everything after this today is free.
  const later = spendEvening('o6', agents, 60 * 60_000, now);
  assert.equal(await maybeRunNightly('o6', agents, { now: later, call }), null);
  assert.equal(calls, 1, 'one model call per owner per day');
});

test('HOME-STATE-1: a call that fails costs the day, not a retry loop', async () => {
  let calls = 0;
  const call = async () => { calls++; throw new Error('timeout'); };
  const agents = [at('a', 'A'), at('b', 'B')];

  const now = spendEvening('o7', agents, TOGETHER_MIN_MS + MAX_CREDIT_MS);
  assert.equal(await maybeRunNightly('o7', agents, { now, call }), null);
  assert.equal(calls, 1);

  // The day is stamped BEFORE the call goes out, so the next observation — and
  // on a busy household that is seconds away — does not spend again.
  assert.equal(await maybeRunNightly('o7', agents, { now: now + 1_000, call }), null);
  assert.equal(calls, 1, 'a failure that reopened the day would be a bill');
});

test('HOME-STATE-1: no key, no call, no exchange', async () => {
  // The default caller returns null without a key, which is what makes this
  // module safe inside the automated suites.
  const agents = [at('a', 'A'), at('b', 'B')];
  const now = spendEvening('o8', agents, TOGETHER_MIN_MS + MAX_CREDIT_MS);
  assert.equal(process.env.ANTHROPIC_API_KEY, undefined);
  assert.equal(await maybeRunNightly('o8', agents, { now }), null);
});

// ── What comes out ──────────────────────────────────────────────────────────

test('HOME-STATE-1: the exchange is stored as thread lines with source home', async () => {
  const call = async () => 'Long day.\nThey are all long.\nGo to bed.';
  const agents = [at('a', 'The Clock'), at('b', 'River Rat')];
  const now = spendEvening('o9', agents, TOGETHER_MIN_MS + MAX_CREDIT_MS);
  const run = await maybeRunNightly('o9', agents, { now, call });

  assert.equal(run.sessionId, homeSessionId('o9', dayKey(now)));
  const lines = thread.readThread(run.sessionId, { owner: true });
  assert.equal(lines.length, 3);
  for (const line of lines) {
    assert.equal(line.source, ThreadSource.HOME);
    assert.equal(line.tableId, null, 'there was no table under this');
  }
  assert.deepEqual(lines.map((l) => l.who), ['The Clock', 'River Rat', 'The Clock'],
    'they take turns, starting with the first');

  // It is a conversation in his house: private, like his reasoning.
  assert.equal(thread.readThread(run.sessionId, { owner: false }).length, 0);
});

test('HOME-STATE-1: solver speak is dropped, never dressed up', () => {
  const speakers = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const parsed = parseExchange(
    'Long day.\nMy c-bet frequency was 68% on the turn.\nGo to bed.',
    speakers);
  assert.equal(parsed.length, 2, 'the middle line was a machine talking');
  assert.deepEqual(parsed.map((l) => l.text), ['Long day.', 'Go to bed.']);
  // And the speakers still alternate over what SURVIVED, so the exchange reads
  // as an exchange rather than as one man talking to himself.
  assert.deepEqual(parsed.map((l) => l.name), ['A', 'B']);
});

test('HOME-STATE-1: never more than three lines, whatever the model felt like', () => {
  const speakers = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const parsed = parseExchange('one.\ntwo.\nthree.\nfour.\nfive.', speakers);
  assert.equal(parsed.length, MAX_LINES);
});

test('HOME-STATE-1: the model\'s formatting habits are stripped', () => {
  const speakers = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  const parsed = parseExchange('- The Clock: Long day.\n2) River Rat: They are all long.', speakers);
  assert.deepEqual(parsed.map((l) => l.text), ['Long day.', 'They are all long.']);
});

test('HOME-STATE-1: nothing usable back means nothing written', async () => {
  const call = async () => 'My range was too wide.';   // one line, and solver speak
  const agents = [at('a', 'A'), at('b', 'B')];
  const now = spendEvening('o10', agents, TOGETHER_MIN_MS + MAX_CREDIT_MS);
  assert.equal(await maybeRunNightly('o10', agents, { now, call }), null);
  assert.equal(thread.readThread(homeSessionId('o10', dayKey(now)), { owner: true }).length, 0);
});

test('HOME-STATE-1: the prompt carries the two characters and no jargon licence', () => {
  const prompt = buildPrompt(at('a', 'The Clock'), at('b', 'River Rat'), { ms: 2 * 3_600_000 });
  assert.match(prompt.user, /The Clock/);
  assert.match(prompt.user, /River Rat/);
  assert.match(prompt.user, /2 hour/);
  assert.match(prompt.system, /NEVER use poker jargon/);
});
