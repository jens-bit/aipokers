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
import { appendLine, readThread, latestSessionFor, ThreadKind, LINE_MAX } from './thread.js';

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
