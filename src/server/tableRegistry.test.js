// src/server/tableRegistry.test.js — BUGS-B/6
//
// The floor's own count of itself.
//
// "N agents live" in the header is the number this file is about. It has to be
// the SEATS — not sockets, not the roster — and it has to be a number even
// when there is nothing to count, because a client that gets no number prints
// a dash and a dash reads as broken.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getOrCreateTable, resetRegistry, seatedAgentIds, seatedAgentCount,
  activeFloorTableCount, listFloorTables,
} from './tableRegistry.js';

function seat(table, agentId, userId = 'u1') {
  return table.seatAI({
    displayName: agentId,
    strategy: 'You are a poker player.',
    agentId,
    userId,
    buyIn: table.bigBlind * 100,
  });
}

test('BUGS-B/6: an empty floor is 0, never null and never a dash', () => {
  resetRegistry('test');
  assert.equal(seatedAgentCount(), 0);
  assert.equal(activeFloorTableCount(), 0);
  assert.equal(typeof seatedAgentCount(), 'number');
  resetRegistry('test');
});

test('BUGS-B/6: it counts the seats, across every table on the floor', () => {
  resetRegistry('test');
  const a = getOrCreateTable('bugsb6-a');
  const b = getOrCreateTable('bugsb6-b');
  seat(a, 'agent-1', 'u1');
  seat(a, 'agent-2', 'u2');
  seat(b, 'agent-3', 'u3');
  assert.equal(seatedAgentCount(), 3);
  assert.deepEqual([...seatedAgentIds()].sort(), ['agent-1', 'agent-2', 'agent-3']);
  resetRegistry('test');
});

test('BUGS-B/6: a House regular is not an agent and is not counted', () => {
  resetRegistry('test');
  const t = getOrCreateTable('bugsb6-house');
  seat(t, 'agent-1', 'u1');
  // A cast member sits with no agentId — nobody owns him and nobody is
  // watching their own man play when he takes a pot.
  t.seatAI({ displayName: 'Granite', strategy: 'You wait.', buyIn: 2000, stableId: 'granite' });
  assert.equal(t.seatedCount(), 2, 'two bodies at the felt');
  assert.equal(seatedAgentCount(), 1, "only one of them is somebody's agent");
  resetRegistry('test');
});

test('BUGS-B/6: a seat that stood up stops counting', () => {
  resetRegistry('test');
  const t = getOrCreateTable('bugsb6-leave');
  seat(t, 'agent-1', 'u1');
  seat(t, 'agent-2', 'u2');
  assert.equal(seatedAgentCount(), 2);
  t._clearSeat(0);
  assert.equal(seatedAgentCount(), 1);
  resetRegistry('test');
});

test('BUGS-B/6: the living room is not the casino', () => {
  resetRegistry('test');
  const floor = getOrCreateTable('bugsb6-floor');
  const home = getOrCreateTable('bugsb6-home', { home: true });
  seat(floor, 'agent-1', 'u1');
  seat(home, 'agent-2', 'u1');
  seat(home, 'agent-3', 'u1');
  assert.equal(seatedAgentCount(), 1, 'only the man at the casino is live');
  assert.equal(listFloorTables().length, 1);
  resetRegistry('test');
});

test('BUGS-B/6: a closed table takes its seats with it', () => {
  resetRegistry('test');
  const t = getOrCreateTable('bugsb6-closed');
  seat(t, 'agent-1', 'u1');
  assert.equal(seatedAgentCount(), 1);
  t.closed = true;
  assert.equal(seatedAgentCount(), 0);
  resetRegistry('test');
});

test('BUGS-B/6: activeTables counts tables with a hand on, not tables that exist', () => {
  resetRegistry('test');
  const t = getOrCreateTable('bugsb6-idle');
  seat(t, 'agent-1', 'u1');
  assert.equal(activeFloorTableCount(), 0, 'seated is not dealing');
  resetRegistry('test');
});
