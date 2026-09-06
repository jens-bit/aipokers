// src/server/floorPush.test.js — SERVER-4 job 1
//
// Who is allowed to receive a thread line.
//
// Its own file rather than a section of threadPush.test.js for a reason worth
// writing down: subscribing to the floor asks agentProfiles for a roster, and
// agentProfiles loads the whole store into memory on its first call and never
// reloads. A channel test that subscribes as some owner therefore fixes that
// module's idea of the world for the rest of the process — which is harmless
// here, where nothing needs a real agent, and quietly wrong next door, where
// everything does.

import test from 'node:test';
import assert from 'node:assert/strict';

import * as floor from './floorChannel.js';
import { ServerMsg } from './protocol.js';
import { ThreadKind } from './thread.js';

// ── Job 1 · who is allowed to receive one ───────────────────────────────────

test('SERVER-4: THREAD_LINE reaches the owner who PROVED it, and nobody else', () => {
  const proven = fakeSocket();
  const claimed = fakeSocket();
  const stranger = fakeSocket();
  try {
    floor.configure({});
    floor.subscribe(proven, { userId: 'u1', owner: true });
    floor.subscribe(claimed, { userId: 'u1', owner: false });
    floor.subscribe(stranger, { userId: 'u2', owner: true });

    const line = { id: 1, sessionId: 'h-1', ts: 1, kind: ThreadKind.HIM, who: 'BALANCE', text: 'mine' };
    const sent = floor.broadcastThreadLine('u1', line);

    assert.equal(sent, 1, 'one subscriber, not three');
    const got = proven.sent.filter((m) => m.type === ServerMsg.THREAD_LINE);
    assert.equal(got.length, 1);
    assert.equal(got[0].userId, 'u1');
    assert.equal(got[0].sessionId, 'h-1');
    assert.deepEqual(got[0].line, line);
    // A userId is a claim. Without initData behind it, his reasoning is not
    // yours to read — the same law heroHole already rides on.
    assert.equal(claimed.sent.some((m) => m.type === ServerMsg.THREAD_LINE), false);
    assert.equal(stranger.sent.some((m) => m.type === ServerMsg.THREAD_LINE), false);
  } finally {
    floor.reset();
  }
});

// The minimum a WebSocket has to be for floorChannel to push to it.
function fakeSocket() {
  const ws = { OPEN: 1, readyState: 1, sent: [] };
  ws.send = (raw) => ws.sent.push(JSON.parse(raw));
  return ws;
}
