// src/server/sessions.test.js — SERVER-3
//
// The session identity: an id, the five ways a stay ends, and the one bus that
// says so. Pure — no table, no sockets, no database.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SESSION_END_REASONS,
  isEndReason,
  newSessionId,
  sessionEndRecord,
  emitSessionEnd,
  sessionEndMessage,
  bus,
} from './sessions.js';

test('SERVER-3: the end-reason vocabulary is the session stop rule plus one', () => {
  assert.deepEqual(SESSION_END_REASONS, ['bust', 'allowance', 'worn', 'calledIn', 'stopped']);
  for (const r of SESSION_END_REASONS) assert.ok(isEndReason(r), `${r} is a reason`);
  assert.ok(!isEndReason('tired'), 'a near-miss is not a reason');
  assert.ok(!isEndReason(''), 'nothing is not a reason');
});

test('SERVER-3: session ids are unique and opaque', () => {
  const ids = new Set(Array.from({ length: 500 }, () => newSessionId()));
  assert.equal(ids.size, 500, 'no collisions in five hundred stays');
  for (const id of ids) assert.match(id, /^s_[0-9a-f-]+$/, 'opaque and prefixed');
});

test('SERVER-3: the record normalises rather than refuses', () => {
  const r = sessionEndRecord({
    agentId: 42,
    userId: 7,
    reason: 'exhausted',        // not in the vocabulary
    hands: 12.7,
    net: -1250.4,
    biggestPot: -5,             // a pot cannot be negative
    duration: -1,
  });
  assert.equal(r.agentId, '42', 'ids are strings on the wire');
  assert.equal(r.userId, '7');
  assert.equal(r.reason, 'stopped', 'an unknown reason falls back rather than throwing');
  assert.equal(r.hands, 13);
  assert.equal(r.net, -1250, 'net is signed and rounded');
  assert.equal(r.biggestPot, 0);
  assert.equal(r.duration, 0);
  assert.ok(Number.isFinite(r.endedAt));
  assert.ok(Object.isFrozen(r), 'nobody downstream can edit the record they were handed');
});

test('SERVER-3: a record with no agent is not a session end', () => {
  assert.equal(sessionEndRecord({ reason: 'bust' }), null);
  assert.equal(sessionEndRecord(), null);
  assert.equal(emitSessionEnd({ reason: 'bust' }), null);
});

test('SERVER-3: the emit reaches every listener, once', () => {
  const seen = [];
  const listen = (r) => seen.push(r);
  bus.on('session_end', listen);
  try {
    const sent = emitSessionEnd({
      sessionId: 's_abc', agentId: 'a1', userId: 'u1', tableId: 't1',
      reason: 'worn', hands: 61, net: 340, biggestPot: 1200, duration: 90_000,
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0], sent, 'the listener gets the record the caller was handed');
    assert.equal(seen[0].reason, 'worn');
    assert.equal(seen[0].hands, 61);
  } finally {
    bus.off('session_end', listen);
  }
});

test('SERVER-3: a broken listener cannot take the table down with it', () => {
  const boom = () => { throw new Error('listener exploded'); };
  bus.on('session_end', boom);
  try {
    const r = emitSessionEnd({ agentId: 'a1', reason: 'bust' });
    assert.equal(r.reason, 'bust', 'the record still comes back');
  } finally {
    bus.off('session_end', boom);
  }
});

test('SERVER-3: the owner id never reaches the wire', () => {
  const r = sessionEndRecord({ agentId: 'a1', userId: 'u-secret', reason: 'calledIn' });
  const wire = sessionEndMessage(r);
  assert.ok(!('userId' in wire), 'routing information stays on the server side');
  assert.equal(wire.agentId, 'a1');
  assert.equal(wire.reason, 'calledIn');
  // Everything the ceremony prints survives the trip.
  for (const k of ['sessionId', 'tableId', 'reason', 'hands', 'net', 'biggestPot', 'duration']) {
    assert.ok(k in wire, `${k} is on the wire`);
  }
  assert.equal(sessionEndMessage(null), null);
});
