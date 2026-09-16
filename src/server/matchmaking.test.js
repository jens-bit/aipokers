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
// ── TESTING LAW #5 · WHAT AGENT-5 JOB E CHANGED HERE ────────────────────────
//
// The rule this file was written for was MATCH-1: two agents of the same owner
// never sit at the same casino table. JENS HAS EXPLICITLY OVERRULED IT. The
// product is not wrong, the rule is one we no longer want, which is the one
// circumstance in which a red case is rewritten rather than the code fixed.
//
// So `joinBlocker` no longer refuses a stablemate at all, and the cases that
// asserted it do now assert the opposite, each with its reasoning at the case.
//
// WHAT REPLACED IT (job F) is a preference inside `pickTableToJoin`, and the
// cases below hold it to a higher bar than the rule ever had to meet, because
// a preference has two directions:
//
//   default        a table seating one of his own sorts LAST
//   together:true  the same table sorts FIRST
//
// and in both directions it is a ranking, never a filter — the man is seated
// either way when there is nowhere else, which is the case MATCH-1 answered
// with "go home".

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  joinBlocker, pickTableToJoin, seatsAgentOf, scoreTableForJoin, JOIN_MIN_SCORE,
} from './matchmaking.js';
import { roomForBigBlind } from './rooms.js';

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

test('AGENT-5 job E: a stablemate is no longer a blocker', () => {
  // Was: "a table already seating one of the owner's agents is refused",
  // asserting the string 'another agent of the same owner is already here'.
  // There is no such string any more. Rewritten under testing law #5.
  const t = table({
    tableId: 'floor-1',
    seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: null, userId: null }],
  });
  assert.equal(joinBlocker(t, { agentId: 'a2', userId: 'u1' }), null,
    'his own man at the table stops nothing');
  assert.equal(joinBlocker(t, { agentId: 'b1', userId: 'u2' }), null,
    'somebody else\'s agent is exactly who he is supposed to meet');
});

test('AGENT-5 job E: a stable of four may pile in, if that is what is asked for', () => {
  // Was: "the refusal is about the OWNER, not the agent — a stable of four
  // cannot pile in". It can now. What stops it happening by ACCIDENT is job
  // F's default, which is a different mechanism asserted further down.
  const t = table({
    tableId: 'floor-1',
    seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: 'b1', userId: 'u2' }],
  });
  for (const agentId of ['a2', 'a3', 'a4']) {
    assert.equal(joinBlocker(t, { agentId, userId: 'u1' }), null, `${agentId} may sit down`);
  }
});

test('AGENT-5 job E: the one-seat rule survived the overrule untouched', () => {
  // Removing "not two of yours" must not have removed "not the same man
  // twice", which is a different rule about a different thing and the one that
  // stops a single agent holding two chairs and two buy-ins.
  const t = table({
    tableId: 'floor-1',
    seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: 'b1', userId: 'u2' }],
  });
  assert.equal(joinBlocker(t, { agentId: 'a1', userId: 'u1' }), 'agent already seated');
});

test('MATCH-1: a stale userId on an empty seat is not a seat', () => {
  // The predicate itself is unchanged and still worth holding: `seatsAgentOf`
  // is what job F's ranking and job G's greeting both read.
  const t = table({
    tableId: 'floor-1',
    seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: 'b1', userId: 'u2' }],
  });
  assert.equal(seatsAgentOf(t, 'u1'), true);
  t.agentIds[0] = null;
  t.pending[0] = null;
  assert.equal(seatsAgentOf(t, 'u1'), false);
});

test('MATCH-1: no userId means no ownership claim at all', () => {
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

test('AGENT-5 job F: by default the matchmaker still picks ANOTHER table', () => {
  // The behaviour MATCH-1 was protecting, preserved by a ranking instead of a
  // wall. `own` is the FULLER table, which the old sort would have preferred.
  const own = table({ tableId: 'own', seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: 'h', userId: null }] });
  const other = table({ tableId: 'other', seats: [{ agentId: 'b1', userId: 'u2' }] });
  const picked = pickTableToJoin([own, other], { profile: LOOSE, agentId: 'a2', userId: 'u1' });
  assert.equal(picked?.table.tableId, 'other');
  assert.equal(picked?.stablemate, false);
});

test('AGENT-5 job F: `together` turns the same ranking the other way up', () => {
  const own = table({ tableId: 'own', seats: [{ agentId: 'a1', userId: 'u1' }, { agentId: 'h', userId: null }] });
  const other = table({ tableId: 'other', seats: [{ agentId: 'b1', userId: 'u2' }] });
  const picked = pickTableToJoin([own, other], {
    profile: LOOSE, agentId: 'a2', userId: 'u1', together: true,
  });
  assert.equal(picked?.table.tableId, 'own', 'asked to gather, he gathers');
  assert.equal(picked?.stablemate, true);
});

test('AGENT-5 job F: a preference is not a filter — his own table beats no table', () => {
  // Was: "when every open table is his own, he gets no table and opens one",
  // asserting null. THIS IS THE ONE BEHAVIOURAL CHANGE THE OVERRULE BUYS. The
  // picker now returns the table, flagged; deployAgent is what prefers opening
  // a fresh one, and only while the floor has room for it. Past the cap, a
  // seat beside his own man beats being sent home, which is what MATCH-1 did.
  const own1 = table({ tableId: 'own1', seats: [{ agentId: 'a1', userId: 'u1' }] });
  const own2 = table({ tableId: 'own2', seats: [{ agentId: 'a2', userId: 'u1' }] });
  const picked = pickTableToJoin([own1, own2], { profile: LOOSE, agentId: 'a3', userId: 'u1' });
  assert.ok(picked, 'a table is offered rather than nothing');
  assert.equal(picked.stablemate, true, 'and it is flagged as one of his own');
});

test('AGENT-5 job F: the room still outranks the together preference', () => {
  // A stablemate in the right room beats a stranger in the wrong one, even on
  // the default. Sending a man up a floor to avoid his own agent is a worse
  // answer than the thing it was avoiding.
  const mateHere = table({ tableId: 'mate-here', bigBlind: 20, seats: [{ agentId: 'a1', userId: 'u1' }] });
  const strangerUpstairs = table({ tableId: 'up', bigBlind: 500, seats: [{ agentId: 'b1', userId: 'u2' }] });
  const room = roomForBigBlind(20)?.id ?? null;
  const picked = pickTableToJoin([strangerUpstairs, mateHere], {
    profile: LOOSE, agentId: 'a2', userId: 'u1', room,
  });
  assert.equal(picked?.table.tableId, 'mate-here');
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
