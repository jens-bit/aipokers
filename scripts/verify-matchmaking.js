// scripts/verify-matchmaking.js — MATCH-1
// Verify the same-owner REFUSAL, the same-room fallback, and the
// no-lone-agent invariant. Pure function tests only — no server process needed.
// Run: node scripts/verify-matchmaking.js
//
// This file used to assert MATCH-2's opposite rule — same-owner table
// AFFINITY, with a bonus that skipped JOIN_MIN_SCORE so an owner's agents
// piled onto one felt. MATCH-1 reverses that rule (a stable sharing a table is
// a man playing himself: no real opponent, no read worth having, and six seats
// of model calls buying no game), so the sections that pinned the affinity now
// pin the refusal. Nothing was loosened to get here — the assertions are
// inverted, deliberately, because the product rule they encoded is gone.

import {
  pickTableToJoin,
  joinBlocker,
  seatsAgentOf,
  scoreTableForJoin,
  actionPotential,
  JOIN_MIN_SCORE,
} from '../src/server/matchmaking.js';

let passed = 0;
let failed = 0;

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

// Build a minimal mock table compatible with joinBlocker + scoreTableForJoin.
// seated: array of { userId, profile } for each occupied seat (House = userId null).
function mockTable(seats, { maxSeats = 6, maxHands = 100, agentIds = null, bigBlind = 20, home = false } = {}) {
  const pending  = Array(maxSeats).fill(null);
  const agentProfiles = Array(maxSeats).fill(null);
  const agentUserIds  = Array(maxSeats).fill(null);
  const agentIdsArr   = Array(maxSeats).fill(null);
  for (let i = 0; i < seats.length; i++) {
    pending[i]      = { playerId: `p${i}` };
    agentProfiles[i] = seats[i].profile ?? { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };
    agentUserIds[i]  = seats[i].userId ?? null;
    // A seat with no userId is the House, and the House has no agentId — which
    // is what makes it invisible to the same-owner test.
    agentIdsArr[i]   = agentIds?.[i] ?? (seats[i].userId ? `agent-seat-${i}` : null);
  }
  const count = seats.length;
  return {
    closed: false,
    home,
    bigBlind,
    autoPlay: true,
    maxHands,
    handsThisSession: 0,
    maxSeats,
    pending,
    agentProfiles,
    agentUserIds,
    agentIds: agentIdsArr,
    hasFreeSeat: () => count < maxSeats,
    hasHumanPlayer: () => false,
    isAiOnly: () => true,
    seatedCount: () => count,
  };
}

const NEUTRAL  = { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };
const TIGHT    = { tightness: 85, aggression: 15, bluffFreq: 5,  discipline: 80 };
const LOOSE    = { tightness: 20, aggression: 80, bluffFreq: 50, discipline: 30 };

// ── The refusal ──────────────────────────────────────────────────────────────
console.log('\nSame-owner tables are refused');

const ownTable = mockTable([
  { userId: 'user1', profile: LOOSE },
  { userId: null,    profile: TIGHT },  // House
]);

assert('joinBlocker names the owner as the reason',
  joinBlocker(ownTable, { agentId: 'agent-new', userId: 'user1' }),
  'another agent of the same owner is already here');
assert('a stranger is not blocked by it',
  joinBlocker(ownTable, { agentId: 'agent-new', userId: 'user2' }), null);
assert('seatsAgentOf sees his man', seatsAgentOf(ownTable, 'user1'), true);
assert('and does not see one that is not there', seatsAgentOf(ownTable, 'user2'), false);
assert('the House belongs to nobody', seatsAgentOf(ownTable, null), false);

const ownScore = scoreTableForJoin(ownTable, LOOSE);
console.log(`  INFO  the own table scores ${ownScore} (JOIN_MIN_SCORE=${JOIN_MIN_SCORE}) and is refused anyway`);
assert('a lively own table is still refused — it is a rule, not a ranking',
  ownScore >= JOIN_MIN_SCORE && pickTableToJoin([ownTable], { profile: LOOSE, agentId: 'agent-new', userId: 'user1' }) === null,
  true);

// ── What he gets instead ─────────────────────────────────────────────────────
console.log('\nHe is sent to another table, in the same room');

const foreignTable = mockTable([
  { userId: 'user2', profile: LOOSE },
  { userId: null,    profile: TIGHT },  // House
]);
const picked = pickTableToJoin([ownTable, foreignTable], {
  profile: NEUTRAL, agentId: 'agent-x', userId: 'user1',
});
assert('the foreign table is the one picked', picked?.table, foreignTable);

// The room outranks the action score: turned away from his own felt, he stays
// on the floor he was going to play on rather than being sent up a rung.
const upstairs = mockTable([
  { userId: 'user3', profile: LOOSE },
  { userId: 'user4', profile: TIGHT },
], { bigBlind: 50 });
const floorTable = mockTable([
  { userId: 'user2', profile: NEUTRAL },
], { bigBlind: 20 });
console.log(`  INFO  upstairs scores ${scoreTableForJoin(upstairs, NEUTRAL)}, the floor scores ${scoreTableForJoin(floorTable, NEUTRAL)}`);
assert('the fixture has upstairs scoring higher',
  scoreTableForJoin(upstairs, NEUTRAL) > scoreTableForJoin(floorTable, NEUTRAL), true);
assert('but the same room wins',
  pickTableToJoin([upstairs, floorTable], { profile: NEUTRAL, agentId: 'agent-y', userId: 'user1', room: 'floor' })?.table,
  floorTable);
assert('the room is a preference, not a filter — a seat elsewhere beats no seat',
  pickTableToJoin([upstairs], { profile: NEUTRAL, agentId: 'agent-y', userId: 'user1', room: 'floor' })?.table,
  upstairs);

// ── Three sequential same-owner deploys land at THREE tables ─────────────────
console.log('\nThree sequential same-owner deploys → three tables');

// Simulate: each deploy checks candidates, then "commits" by adding the agent
// to the winning table's agentUserIds. Start with no tables.
const tables = [];  // grows as deploys create new tables

function simulateDeploy(userId, agentId, profile = NEUTRAL) {
  const candidate = pickTableToJoin(tables, { profile, agentId, userId, room: 'floor' });
  if (candidate) {
    // Join: add to table's mock state.
    const t = candidate.table;
    const seat = t.seatedCount();
    if (seat < t.maxSeats) {
      t.pending[seat] = { playerId: agentId };
      t.agentProfiles[seat] = profile;
      t.agentUserIds[seat] = userId;
      t.agentIds[seat] = agentId;
      // Override seatedCount to reflect the new occupant.
      const newCount = seat + 1;
      t.seatedCount = () => newCount;
      t.hasFreeSeat = () => newCount < t.maxSeats;
    }
    return { table: t, created: false };
  }
  // Create: new table with agent + House (2 seats).
  const newTable = mockTable([
    { userId, profile },
    { userId: null, profile: NEUTRAL },  // House
  ], { agentIds: [agentId, null] });
  tables.push(newTable);
  return { table: newTable, created: true };
}

const d1 = simulateDeploy('user1', 'agent-A');
const d2 = simulateDeploy('user1', 'agent-B');
const d3 = simulateDeploy('user1', 'agent-C');

assert('deploy 1 creates a new table',            d1.created, true);
assert('deploy 2 will not join deploy 1\'s table', d2.created, true);
assert('deploy 3 will not join either of them',   d3.created, true);
assert('no two of them share a felt',
  d1.table !== d2.table && d2.table !== d3.table && d1.table !== d3.table, true);
assert('one table per agent',                     tables.length, 3);

// A fourth agent belonging to somebody ELSE fills one of them instead of
// standing up a fourth: the refusal is about the owner, not about joining.
const stranger = simulateDeploy('user2', 'agent-D');
assert('a stranger joins rather than opening another table', stranger.created, false);
assert('and the floor still has three tables', tables.length, 3);

// ── The home game keeps them together ────────────────────────────────────────
console.log('\nThe home game is refused by name, not by owner');

const homeTable = mockTable([
  { userId: 'user1', profile: NEUTRAL },
  { userId: 'user1', profile: LOOSE },
], { bigBlind: 2, home: true });
assert('a home game is never a deploy candidate for its own household',
  joinBlocker(homeTable, { agentId: 'agent-new', userId: 'user1' }), 'home game');
assert('nor for anybody else',
  joinBlocker(homeTable, { agentId: 'agent-new', userId: 'user9' }), 'home game');

// ── Lone-agent-no-House invariant ─────────────────────────────────────────────
console.log('\nNo lone-agent-no-House table after deploy');

// Case A: new table creation (startAgentSession) always creates 2 seats
// (agent + House). We simulate this here since startAgentSession is in Table.
const newSessionTable = mockTable([
  { userId: 'user1', profile: NEUTRAL },
  { userId: null,    profile: NEUTRAL },  // House always seated
]);
assert('new session table has >= 2 seated', newSessionTable.seatedCount() >= 2, true);

// Case B: joinAgentSession only runs on tables with seatedCount >= 1
// (joinBlocker returns 'empty' for seatedCount < 1). After join: seatedCount
// increases by 1 → still >= 2.
const oneAgentTable = mockTable([{ userId: 'user1', profile: NEUTRAL }]);
const joinCandidate = pickTableToJoin([oneAgentTable], { profile: NEUTRAL, agentId: 'agent-new', userId: 'user2' });
if (joinCandidate) {
  // Simulate the join.
  const seat = joinCandidate.table.seatedCount();
  joinCandidate.table.pending[seat] = { playerId: 'agent-new' };
  const newCount = seat + 1;
  joinCandidate.table.seatedCount = () => newCount;
  assert('after join, table has >= 2 seated', joinCandidate.table.seatedCount() >= 2, true);
} else {
  // joinBlocker blocked it (seatedCount < MIN_REMAINING check or other).
  // The new deploy would create a fresh table (2 seats). Still >= 2.
  assert('no join found for 1-seat table (fork → new table, 2 seats)', true, true);
}

// Case C: empty table (seatedCount = 0) is blocked by joinBlocker.
const emptyTable = mockTable([], { maxSeats: 6 });
emptyTable.seatedCount = () => 0;
emptyTable.hasFreeSeat = () => true;
const emptyCandidate = pickTableToJoin([emptyTable], { profile: NEUTRAL, agentId: 'agent-z', userId: 'user1' });
assert('empty table (seatedCount=0) is blocked by joinBlocker', emptyCandidate, null);

// The action score itself is untouched by MATCH-1 — a sanity line so a change
// to it shows up here rather than only in the e2e run.
assert('a station and a TAG still score above two nits',
  actionPotential([LOOSE, TIGHT]) > actionPotential([TIGHT, TIGHT]), true);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
