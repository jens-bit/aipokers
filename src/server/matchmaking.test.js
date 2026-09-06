// src/server/matchmaking.test.js — MATCH-1
//
// Who a deploying agent is allowed to sit down with.
//
// Object literals stand in for Tables, the same way rooms.test.js does it: the
// matchmaker reads a handful of public fields off a table (closed, home,
// bigBlind, agentIds, agentUserIds, agentProfiles, pending, hasFreeSeat,
// seatedCount, isAiOnly, maxHands, handsThisSession) and that is the whole
// contract. Nothing here boots a server or deals a hand.
//
// The rule under test is MATCH-1: two agents of the same owner never sit at
// the same casino table. It reverses MATCH-2, which paid a bonus to keep them
// together — see the header in matchmaking.js for why.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  joinBlocker, pickTableToJoin, seatsAgentOf, scoreTableForJoin, JOIN_MIN_SCORE,
} from './matchmaking.js';

// A loose, aggressive shape, so every table in this file clears JOIN_MIN_SCORE
// on its own merits and a refusal is never a score in disguise.
const LOOSE = { tightness: 25, aggression: 75, bluffFreq: 40, discipline: 50 };
const TIGHT = { tightness: 75, aggression: 60, bluffFreq: 15, discipline: 70 };

// seats: [{ agentId, userId, profile }] — a null entry is an empty seat, an
// entry with no agentId is the House.
const table = ({ tableId, seats = [], bigBlind = 20, maxSeats = 6, home = false, closed = false }) => {
  const agentIds = Array(maxSeats).fill(null);
  const agentUserIds = Array(maxSeats).fill(null);
  const agentProfiles = Array(maxSeats).fill(null);
  const pending = Array(maxSeats).fill(null);
  seats.forEach((seat, i) => {
    if (!seat) return;
    pending[i] = { displayName: seat.agentId ?? 'House' };
    agentIds[i] = seat.agentId ?? null;
    agentUserIds[i] = seat.userId ?? null;
    agentProfiles[i] = seat.profile ?? LOOSE;
  });
  return {
    tableId,
    bigBlind,
    maxSeats,
    home,
    closed,
    autoPlay: true,
    maxHands: 200,
    handsThisSession: 0,
    agentIds,
    agentUserIds,
    agentProfiles,
    pending,
    hasFreeSeat: () => pending.some((p) => p === null),
    seatedCount: () => pending.filter(Boolean).length,
    hasHumanPlayer: () => false,
    isAiOnly: () => true,
  };
};

// ── The refusal ─────────────────────────────────────────────────────────────

test('MATCH-1: a table already seating one of the owner\'s agents is refused', () => {
  const t = table({
    tableId: 'floor-1',
    seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: null, userId: null }],
  });
  assert.equal(joinBlocker(t, { agentId: 'a2', userId: 'u1' }),
    'another agent of the same owner is already here');
  assert.equal(joinBlocker(t, { agentId: 'b1', userId: 'u2' }), null,
    'somebody else\'s agent is exactly who he is supposed to meet');
});

test('MATCH-1: the refusal is about the OWNER, not the agent — a stable of four cannot pile in', () => {
  const t = table({
    tableId: 'floor-1',
    seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: 'b1', userId: 'u2' }],
  });
  for (const agentId of ['a2', 'a3', 'a4']) {
    assert.ok(joinBlocker(t, { agentId, userId: 'u1' }), `${agentId} must be turned away`);
  }
});

test('MATCH-1: a seat that stood up frees the owner to sit down again', () => {
  const t = table({
    tableId: 'floor-1',
    seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: 'b1', userId: 'u2' }],
  });
  assert.ok(joinBlocker(t, { agentId: 'a2', userId: 'u1' }));
  // His man stands up: agentIds is cleared even though the userId lingers on
  // the seat record. The table keeps playing without him.
  t.agentIds[0] = null;
  t.pending[0] = null;
  assert.equal(seatsAgentOf(t, 'u1'), false, 'a stale userId on an empty seat is not a seat');
  assert.equal(joinBlocker(t, { agentId: 'a2', userId: 'u1' }), null);
});

test('MATCH-1: no userId means no ownership claim, so nothing is refused for one', () => {
  const t = table({ tableId: 'floor-1', seats: [{ agentId: 'a1', userId: 'u1' }] });
  assert.equal(joinBlocker(t, { agentId: 'a2' }), null);
  assert.equal(seatsAgentOf(t, null), false);
  assert.equal(seatsAgentOf(t, ''), false);
});

test('MATCH-1: the House is nobody\'s agent and never blocks a joiner', () => {
  const t = table({ tableId: 'floor-1', seats: [{ agentId: null, userId: null }] });
  assert.equal(seatsAgentOf(t, 'u1'), false);
});

// ── What the deploy does instead ────────────────────────────────────────────

test('MATCH-1: the matchmaker picks ANOTHER table rather than the owner\'s own', () => {
  const own = table({ tableId: 'own', seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: 'h', userId: null }] });
  const other = table({ tableId: 'other', seats: [{ agentId: 'b1', userId: 'u2' }] });
  const picked = pickTableToJoin([own, other], { profile: LOOSE, agentId: 'a2', userId: 'u1' });
  assert.equal(picked?.table.tableId, 'other');
});

test('MATCH-1: when every open table is his own, he gets no table and opens one', () => {
  const own1 = table({ tableId: 'own1', seats: [{ agentId: 'a1', userId: 'u1' }] });
  const own2 = table({ tableId: 'own2', seats: [{ agentId: 'a2', userId: 'u1' }] });
  assert.equal(pickTableToJoin([own1, own2], { profile: LOOSE, agentId: 'a3', userId: 'u1' }), null);
});

test('MATCH-1: MATCH-2\'s bonus is gone — a foreign table below the floor score is still refused', () => {
  // Two nits and a nit: the shape the score exists to skip.
  const quiet = table({
    tableId: 'quiet',
    seats: [{ agentId: 'b1', userId: 'u2', profile: { tightness: 92, aggression: 20, bluffFreq: 5, discipline: 90 } }],
  });
  const score = scoreTableForJoin(quiet, { tightness: 92, aggression: 20, bluffFreq: 5, discipline: 90 });
  assert.ok(score < JOIN_MIN_SCORE, `the fixture has to be under the floor (was ${score})`);
  assert.equal(
    pickTableToJoin([quiet], { profile: { tightness: 92, aggression: 20, bluffFreq: 5, discipline: 90 }, agentId: 'a1', userId: 'u1' }),
    null,
  );
});

// ── The room ────────────────────────────────────────────────────────────────

test('MATCH-1: the replacement table is in the same room, even when another room looks livelier', () => {
  // upstairs is the livelier felt on the action score; the floor is his room.
  const upstairs = table({
    tableId: 'upstairs-1', bigBlind: 50,
    seats: [{ agentId: 'c1', userId: 'u3', profile: LOOSE }, { agentId: 'c2', userId: 'u4', profile: TIGHT }],
  });
  const floorTable = table({
    tableId: 'floor-2', bigBlind: 20,
    seats: [{ agentId: 'b1', userId: 'u2', profile: LOOSE }],
  });
  assert.ok(scoreTableForJoin(upstairs, LOOSE) > scoreTableForJoin(floorTable, LOOSE),
    'the fixture only means something if upstairs scores higher');

  const picked = pickTableToJoin([upstairs, floorTable], {
    profile: LOOSE, agentId: 'a2', userId: 'u1', room: 'floor',
  });
  assert.equal(picked?.table.tableId, 'floor-2');
});

test('MATCH-1: the room is a preference, not a filter — a seat elsewhere beats no seat', () => {
  const upstairs = table({ tableId: 'upstairs-1', bigBlind: 50, seats: [{ agentId: 'c1', userId: 'u3' }] });
  const picked = pickTableToJoin([upstairs], { profile: LOOSE, agentId: 'a2', userId: 'u1', room: 'floor' });
  assert.equal(picked?.table.tableId, 'upstairs-1');
});

test('MATCH-1: with no room named, the action score still decides', () => {
  const dull = table({
    tableId: 'dull', bigBlind: 20,
    seats: [{ agentId: 'b1', userId: 'u2', profile: { tightness: 70, aggression: 40, bluffFreq: 20, discipline: 60 } }],
  });
  const lively = table({
    tableId: 'lively', bigBlind: 50,
    seats: [{ agentId: 'c1', userId: 'u3', profile: LOOSE }, { agentId: 'c2', userId: 'u4', profile: TIGHT }],
  });
  assert.ok(scoreTableForJoin(lively, LOOSE) > scoreTableForJoin(dull, LOOSE),
    'the fixture only means something if the lively table scores higher');
  const picked = pickTableToJoin([dull, lively], { profile: LOOSE, agentId: 'a2', userId: 'u1' });
  assert.equal(picked?.table.tableId, 'lively', 'no room named, so nothing outranks the score');
});

// ── The home game ───────────────────────────────────────────────────────────

test('MATCH-1: the home game is refused by name, so its same-owner seats are none of this', () => {
  const home = table({
    tableId: 'home-u1', bigBlind: 2, home: true,
    seats: [{ agentId: 'a1', userId: 'u1' }],
  });
  assert.equal(joinBlocker(home, { agentId: 'a2', userId: 'u1' }), 'home game');
  assert.equal(joinBlocker(home, { agentId: 'b1', userId: 'u2' }), 'home game',
    'a stranger cannot be matched into somebody\'s living room either');
});
