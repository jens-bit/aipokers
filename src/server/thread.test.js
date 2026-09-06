// src/server/thread.test.js — SERVER-3
//
// The table thread: what a session sounded like, kept in SQLite and read back
// per session. Runs against a real database in a scratch cwd — store.js
// resolves data/ from process.cwd(), which is what keeps this out of the
// developer's own ledger.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests, THREAD_CAP_PER_SESSION } from './store.js';
import { appendLine, readThread, latestSessionFor, setLineListener, ThreadKind, LINE_MAX } from './thread.js';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-thread-'));
_closeForTests();
process.chdir(dir);

process.on('exit', () => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const line = (over = {}) => ({
  sessionId: 's1', agentId: 'a1', ownerId: 'u1', tableId: 't1',
  kind: ThreadKind.TABLE, who: 'TABLE', text: 'something happened', ...over,
});

test('SERVER-3: the four kinds come back in the order they were said', () => {
  appendLine(line({ sessionId: 's-order', text: 'Granite raised to 240' }));
  appendLine(line({ sessionId: 's-order', kind: ThreadKind.HIM, who: 'HIM', text: 'He has shown that sizing twice.' }));
  appendLine(line({ sessionId: 's-order', kind: ThreadKind.OPPONENT, who: 'Granite', text: 'Again?' }));
  appendLine(line({ sessionId: 's-order', kind: ThreadKind.YOU, who: 'YOU', text: 'Careful with him.' }));

  const rows = readThread('s-order', { owner: true });
  assert.deepEqual(rows.map((r) => r.kind), ['table', 'him', 'opponent', 'you']);
  assert.deepEqual(rows.map((r) => r.who), ['TABLE', 'HIM', 'Granite', 'YOU']);
  assert.equal(rows[0].text, 'Granite raised to 240');
  for (const r of rows) assert.ok(Number.isFinite(r.ts), 'every line carries a server timestamp');
});

test('SERVER-3: the timestamp is the SERVER\'s, not the caller\'s', () => {
  const before = Date.now();
  appendLine(line({ sessionId: 's-clock', text: 'now' }));
  const [row] = readThread('s-clock', { owner: true });
  assert.ok(row.ts >= before && row.ts <= Date.now(), 'stamped between the two readings of this process\'s clock');
});

test('SERVER-3: his reasoning is his owner\'s', () => {
  appendLine(line({ sessionId: 's-own', text: 'Granite bet 120' }));
  appendLine(line({ sessionId: 's-own', kind: ThreadKind.HIM, who: 'HIM', text: 'He is bluffing and I am calling.' }));
  appendLine(line({ sessionId: 's-own', kind: ThreadKind.YOU, who: 'YOU', text: 'Careful.' }));
  appendLine(line({ sessionId: 's-own', kind: ThreadKind.OPPONENT, who: 'Granite', text: 'Good luck.' }));

  const owner = readThread('s-own', { owner: true });
  assert.equal(owner.length, 4, 'the owner hears all of it');

  const stranger = readThread('s-own', { owner: false });
  assert.deepEqual(stranger.map((r) => r.kind), ['table', 'opponent'],
    'a watcher hears the room and what was said out loud, and nothing else');
  assert.ok(!stranger.some((r) => r.text.includes('bluffing')),
    'never his read');
});

test('SERVER-3: a thread is per session, not per agent', () => {
  appendLine(line({ sessionId: 's-A', agentId: 'a-multi', text: 'first stay' }));
  appendLine(line({ sessionId: 's-B', agentId: 'a-multi', text: 'second stay' }));
  assert.deepEqual(readThread('s-A', { owner: true }).map((r) => r.text), ['first stay']);
  assert.deepEqual(readThread('s-B', { owner: true }).map((r) => r.text), ['second stay']);
  assert.equal(latestSessionFor('a-multi'), 's-B', 'the reconnect falls back to his most recent stay');
  assert.equal(latestSessionFor('nobody'), null);
  assert.deepEqual(readThread('never-existed', { owner: true }), [], 'an unknown session is empty, not an error');
  assert.deepEqual(readThread(null, { owner: true }), []);
});

test('SERVER-3: nothing unsayable is written', () => {
  assert.equal(appendLine(line({ sessionId: 's-junk', text: '   ' })), null, 'whitespace is not a line');
  assert.equal(appendLine(line({ sessionId: 's-junk', text: null })), null);
  assert.equal(appendLine(line({ sessionId: 's-junk', kind: 'shouting' })), null, 'a fifth kind is not a kind');
  assert.equal(appendLine(line({ sessionId: null })), null, 'a line with no session has nowhere to be read from');
  assert.equal(appendLine(line({ sessionId: 's-junk', agentId: null })), null);
  assert.deepEqual(readThread('s-junk', { owner: true }), []);

  appendLine(line({ sessionId: 's-long', text: 'x'.repeat(LINE_MAX + 200) }));
  const [row] = readThread('s-long', { owner: true });
  assert.equal(row.text.length, LINE_MAX, 'a line is a line, not a document');
});

test('SERVER-3: a renamed opponent cannot borrow the room\'s voice', () => {
  appendLine(line({ sessionId: 's-spoof', kind: ThreadKind.OPPONENT, who: 'TABLE', text: 'trust me' }));
  const [row] = readThread('s-spoof', { owner: true });
  assert.equal(row.who, 'TABLE', 'the label is whatever the felt shows');
  assert.equal(row.kind, 'opponent', 'but the style the client renders is the kind, which he cannot set');
});

test('SERVER-3: the thread is bounded per session', () => {
  const n = THREAD_CAP_PER_SESSION + 25;
  for (let i = 0; i < n; i++) appendLine(line({ sessionId: 's-cap', text: `line ${i}` }));
  const rows = readThread('s-cap', { owner: true });
  assert.equal(rows.length, THREAD_CAP_PER_SESSION, 'a runaway session cannot fill a disk');
  assert.equal(rows[0].text, `line ${n - THREAD_CAP_PER_SESSION}`, 'the OLDEST lines are the ones dropped');
  assert.equal(rows.at(-1).text, `line ${n - 1}`);
});

// ── WATCH-9 · the gold line survives a refetch ──────────────────────────────
//
// The room's voice has one line in it that is not neutral: where a low
// attribute cost him the hand. The felt drew it in gold from a flag it put on
// its own live row, so the moment the thread was refetched — a reconnect, or a
// look back an hour later — the line came back in the room's ordinary grey. A
// stored line has to be able to say what it is.

test('WATCH-9: a cost line says so on the way back out', () => {
  appendLine(line({
    sessionId: 's-cost',
    text: 'he misjudged equity by 7 points — he had 41%, he played 48% · FOCUS',
    cost: true,
  }));
  const [row] = readThread('s-cost', { owner: true });
  assert.equal(row.cost, true);
  assert.equal(row.kind, 'table', 'it is still the room talking — cost is not a fifth kind');
});

test('WATCH-9: every other line is silent about it rather than saying false', () => {
  appendLine(line({ sessionId: 's-cost-not', text: 'Granite raised to 240' }));
  const [row] = readThread('s-cost-not', { owner: true });
  assert.equal('cost' in row, false, 'one register is gold; the rest do not carry a flag saying they are not');
});

test('WATCH-9: a line written before the column existed is not a cost line', () => {
  // What a row inserted by the pre-WATCH-9 code looks like: no `cost` at all.
  appendLine(line({ sessionId: 's-cost-legacy', text: 'The Grinder took 30 uncontested' }));
  const [row] = readThread('s-cost-legacy', { owner: true });
  assert.notEqual(row.cost, true);
});

// ── WATCH-9 · the push ──────────────────────────────────────────────────────

test('WATCH-9: every stored line announces itself to the listener', () => {
  const seen = [];
  setLineListener((l) => seen.push(l));
  try {
    appendLine(line({ sessionId: 's-push', text: 'Granite raised to 240' }));
    appendLine(line({ sessionId: 's-push', kind: ThreadKind.HIM, who: 'HIM', text: 'Not this time.' }));
  } finally {
    setLineListener(null);
  }

  assert.equal(seen.length, 2);
  assert.equal(seen[0].text, 'Granite raised to 240');
  assert.equal(seen[0].kind, 'table');
  assert.equal(seen[0].tableId, 't1', 'the table is on it, which is how the push is routed');
  assert.equal(seen[1].kind, 'him', 'and the private kinds are announced too — the gate is at delivery');
  for (const l of seen) assert.ok(Number.isFinite(l.id), 'announced with the row id, so a client can merge by it');
});

test('WATCH-9: the announced line carries the cost flag, and only when it is one', () => {
  const seen = [];
  setLineListener((l) => seen.push(l));
  try {
    appendLine(line({ sessionId: 's-push-cost', text: 'he went off the line here · DISCIPLINE', cost: true }));
    appendLine(line({ sessionId: 's-push-cost', text: 'Granite called' }));
  } finally {
    setLineListener(null);
  }
  assert.equal(seen[0].cost, true);
  assert.equal(seen[1].cost, undefined);
});

test('WATCH-9: a line that was never stored is never announced', () => {
  const seen = [];
  setLineListener((l) => seen.push(l));
  try {
    appendLine(line({ sessionId: 's-push-bad', text: '   ' }));   // empty after trim
    appendLine(line({ sessionId: 's-push-bad', kind: 'shouting' })); // not a kind
    appendLine(line({ sessionId: null, text: 'nowhere to be read back from' }));
  } finally {
    setLineListener(null);
  }
  assert.equal(seen.length, 0, 'a push for a row nobody can read back is a line on a screen and nowhere else');
});

test('WATCH-9: a listener that throws does not take the write down with it', () => {
  setLineListener(() => { throw new Error('the socket went away mid-send'); });
  try {
    assert.ok(appendLine(line({ sessionId: 's-push-throw', text: 'still stored' })) != null);
  } finally {
    setLineListener(null);
  }
  const [row] = readThread('s-push-throw', { owner: true });
  assert.equal(row.text, 'still stored', 'a thread that can break a hand is worse than no thread');
});

test('WATCH-9: unwiring the listener stops the announcements', () => {
  const seen = [];
  setLineListener((l) => seen.push(l));
  appendLine(line({ sessionId: 's-push-off', text: 'heard' }));
  setLineListener(null);
  appendLine(line({ sessionId: 's-push-off', text: 'not heard' }));
  assert.deepEqual(seen.map((l) => l.text), ['heard']);
});
