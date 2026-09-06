// src/server/threadPush.test.js — SERVER-4 job 1
//
// A line that is written is a line that is SENT.
//
// Nothing in a thread should ever have to be discovered by asking again. Every
// write emits — the overheard entry included, each of its inner lines with its
// own clock — and the emit is as best-effort as the write it follows.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendLine, appendOverheard, setThreadListener, readThread,
  ThreadKind, ThreadSource, OWNER, ROOM, OVERHEARD_LINE_STEP_MS,
} from './thread.js';
import { homeSessionId, dayKey } from './homeNight.js';
import { _closeForTests } from './store.js';

// ── Job 1 · every write is announced ────────────────────────────────────────

test('SERVER-4: a written thread line is pushed, with the ownership it was written under', () => {
  withStore(() => {
    const seen = [];
    setThreadListener((ownerId, line) => seen.push({ ownerId, line }));

    appendLine({
      sessionId: 'sess-1', agentId: 'balance', ownerId: 'u1', tableId: 'tbl-1',
      kind: ThreadKind.TABLE, who: 'TABLE', text: 'Granite raised to 240',
    });

    assert.equal(seen.length, 1);
    assert.equal(seen[0].ownerId, 'u1', 'the push is addressed to the owner of the line');
    assert.equal(seen[0].line.text, 'Granite raised to 240');
    assert.equal(seen[0].line.sessionId, 'sess-1');
    assert.equal(seen[0].line.tableId, 'tbl-1');
    assert.equal(seen[0].line.kind, ThreadKind.TABLE);
    assert.ok(Number.isFinite(seen[0].line.ts), 'stamped by the server, like the row');
    assert.ok(seen[0].line.id, 'and it carries the row id, so a client can dedupe against a fetch');
  });
});

test('SERVER-4: the pushed line is the same shape the thread route returns', () => {
  withStore(() => {
    let pushed = null;
    setThreadListener((_ownerId, line) => { pushed = line; });
    appendLine({
      sessionId: 'sess-2', agentId: 'balance', ownerId: 'u1',
      kind: ThreadKind.HIM, who: 'BALANCE', text: 'He is bluffing.',
      source: ThreadSource.HOME, from: 'balance', to: OWNER,
    });
    const [fetched] = readThread('sess-2', { owner: true });
    // A client appends pushed lines onto a fetched thread. If the two shapes
    // disagree it has to reconcile two vocabularies for one sentence.
    assert.deepEqual(pushed, fetched);
    // And neither carries the ids a reader is not given.
    assert.equal(pushed.ownerId, undefined);
    assert.equal(pushed.agentId, undefined);
  });
});

test('SERVER-4: a line that was not written is not pushed', () => {
  withStore(() => {
    const seen = [];
    setThreadListener((_o, line) => seen.push(line));
    appendLine({ sessionId: 'sess-3', agentId: 'a', ownerId: 'u1', kind: ThreadKind.HIM, who: 'A', text: '   ' });
    appendLine({ sessionId: null, agentId: 'a', ownerId: 'u1', kind: ThreadKind.HIM, who: 'A', text: 'hi' });
    appendLine({ sessionId: 'sess-3', agentId: 'a', ownerId: 'u1', kind: 'shouting', who: 'A', text: 'hi' });
    assert.deepEqual(seen, [], 'the refusals above write nothing, so they announce nothing');
  });
});

test('SERVER-4: a listener that throws costs the push and never the line', () => {
  withStore(() => {
    setThreadListener(() => { throw new Error('the socket went away'); });
    const id = appendLine({
      sessionId: 'sess-4', agentId: 'a', ownerId: 'u1',
      kind: ThreadKind.TABLE, who: 'TABLE', text: 'Still dealt.',
    });
    assert.ok(id, 'the row was written');
    assert.equal(readThread('sess-4', { owner: true }).length, 1, 'and it reads back');
  });
});

// ── Job 1 · the nightly exchange ────────────────────────────────────────────

test('SERVER-4: the overheard exchange is pushed as the one entry it is', () => {
  withStore(() => {
    let pushed = null;
    setThreadListener((_o, line) => { pushed = line; });
    const sessionId = homeSessionId('u1', dayKey());
    appendOverheard({
      sessionId, ownerId: 'u1',
      lines: [
        { from: 'balance', to: 'granite', who: 'BALANCE', text: 'Long evening.' },
        { from: 'granite', to: 'balance', who: 'GRANITE', text: 'They all are.' },
      ],
    });
    assert.ok(pushed);
    assert.equal(pushed.kind, ThreadKind.OVERHEARD);
    assert.equal(pushed.source, ThreadSource.HOME);
    assert.equal(pushed.lines.length, 2, 'one entry, two lines inside it');
  });
});

test('SERVER-4: each overheard line carries its own ts, in the order it was said', () => {
  withStore(() => {
    const sessionId = homeSessionId('u2', dayKey());
    const at = 1_700_000_000_000;
    appendOverheard({
      sessionId, ownerId: 'u2', ts: at,
      lines: [
        { from: 'a', to: 'b', who: 'A', text: 'First.' },
        { from: 'b', to: 'a', who: 'B', text: 'Second.' },
        { from: 'a', to: 'b', who: 'A', text: 'Third.' },
      ],
    });
    const [entry] = readThread(sessionId, { owner: true });
    const stamps = entry.lines.map((l) => l.ts);
    assert.deepEqual(stamps, [
      at,
      at + OVERHEARD_LINE_STEP_MS,
      at + 2 * OVERHEARD_LINE_STEP_MS,
    ]);
    // The point of the step: three lines are three keys, and sorting by ts
    // gives back the order they were said in.
    assert.equal(new Set(stamps).size, 3, 'no two lines share a clock');
    assert.deepEqual([...stamps].sort((x, y) => x - y), stamps);
    // The entry itself is stamped when the exchange happened, not after it.
    assert.equal(entry.ts, at);
  });
});

// ── harness ─────────────────────────────────────────────────────────────────

function withStore(fn) {
  const ORIGINAL_CWD = process.cwd();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-threadpush-'));
  _closeForTests();
  process.chdir(dir);
  try {
    fn();
  } finally {
    setThreadListener(null);
    _closeForTests();
    process.chdir(ORIGINAL_CWD);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
