// src/server/protocol.test.js — MERGE-12
//
// ONE WIRE NAME PER PAYLOAD SHAPE.
//
// This file exists because the rule was broken once and nothing caught it.
// WATCH-9 and SERVER-4 were built on separate branches and both landed a
// message called THREAD_LINE, both with the value 'thread_line', and their
// payloads were not the same shape:
//
//   { type, tableId, sessionId, agentId, line }   the felt's, table-scoped
//   { type, userId,  sessionId, line }            the floor's, owner-scoped
//
// Two keys in one frozen object literal is not an error in JavaScript. The
// second silently wins, the first name still resolves — to the other one's
// value — and every test on either branch keeps passing, because each branch
// only ever had one of them. What breaks is a CLIENT: it receives a
// 'thread_line' and cannot tell which of the two it is holding without
// sniffing the payload for a `userId`, and a protocol you have to sniff is a
// bug that has not happened yet.
//
// So the floor's became OWNER_LINE, and these tests are the guard. They are
// deliberately structural rather than a list of names: a list would have to be
// edited by the same commit that introduced a collision, which is no guard at
// all. Adding a message to protocol.js needs nothing here — only giving one a
// value another already has does.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ClientMsg, ServerMsg } from './protocol.js';

// A duplicate KEY is already gone by the time we can look — the object literal
// collapsed it — so what is checkable is the other half of the same mistake: a
// duplicate VALUE. Every collision of the first kind is also one of the second,
// because two keys for two shapes are only ever written with the same value by
// somebody who thinks they are describing the same message.
function duplicateValues(table) {
  const seen = new Map();
  const dupes = [];
  for (const [key, value] of Object.entries(table)) {
    if (seen.has(value)) dupes.push(`${seen.get(value)} and ${key} both send '${value}'`);
    else seen.set(value, key);
  }
  return dupes;
}

test('MERGE-12: no two ServerMsg names share a wire value', () => {
  assert.deepEqual(duplicateValues(ServerMsg), [],
    'two names for one value means a client cannot tell two payload shapes apart');
});

test('MERGE-12: no two ClientMsg names share a wire value', () => {
  assert.deepEqual(duplicateValues(ClientMsg), []);
});

test('MERGE-12: the table thread push and the owner thread push are two messages', () => {
  // The felt's. Unchanged, and it must stay unchanged: the client switches on
  // this value in useTable, so renaming it would be a protocol break for the
  // one consumer that exists.
  assert.equal(ServerMsg.THREAD_LINE, 'thread_line');
  // The floor's. The same written line, a different door and a different
  // shape — therefore a different name.
  assert.equal(ServerMsg.OWNER_LINE, 'owner_line');
  assert.notEqual(ServerMsg.THREAD_LINE, ServerMsg.OWNER_LINE);
});

test('MERGE-12: the message tables are frozen, so nothing can add a name at runtime', () => {
  assert.equal(Object.isFrozen(ServerMsg), true);
  assert.equal(Object.isFrozen(ClientMsg), true);
});

test('MERGE-12: every wire value is a lowercase snake_case string', () => {
  // Not decoration. The values are what appears on the socket and in llms.txt,
  // and a stray 'threadLine' next to a 'thread_line' is the same collision
  // wearing a different hat — two spellings a client would have to accept.
  for (const table of [ClientMsg, ServerMsg]) {
    for (const [key, value] of Object.entries(table)) {
      assert.equal(typeof value, 'string', `${key} must be a string`);
      assert.match(value, /^[a-z][a-z0-9_]*$/, `${key} sends '${value}'`);
    }
  }
});
