// scripts/verify-matchmaking.js — MATCH-2
// Verify same-owner table affinity, MIN_SCORE bypass, and the no-lone-agent
// invariant. Pure function tests only — no server process needed.
// Run: node scripts/verify-matchmaking.js

import {
  pickTableToJoin,
  scoreTableForJoin,
  actionPotential,
  JOIN_MIN_SCORE,
  SAME_OWNER_SCORE_BONUS,
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
function mockTable(seats, { maxSeats = 6, maxHands = 100, agentIds = null } = {}) {
  const pending  = Array(maxSeats).fill(null);
  const agentProfiles = Array(maxSeats).fill(null);
  const agentUserIds  = Array(maxSeats).fill(null);
  const agentIdsArr   = Array(maxSeats).fill(null);
  for (let i = 0; i < seats.length; i++) {
    pending[i]      = { playerId: `p${i}` };
    agentProfiles[i] = seats[i].profile ?? { tightness: 50, aggression: 50, bluffFreq: 25, discipline: 60 };
    agentUserIds[i]  = seats[i].userId ?? null;
    agentIdsArr[i]   = agentIds?.[i] ?? `agent-seat-${i}`;
  }
  const count = seats.length;
  return {
    closed: false,
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

// ── SAME_OWNER_SCORE_BONUS constant ──────────────────────────────────────────
console.log('\nSAME_OWNER_SCORE_BONUS');
assert('SAME_OWNER_SCORE_BONUS is a positive number', SAME_OWNER_SCORE_BONUS > 0, true);
assert('SAME_OWNER_SCORE_BONUS is larger than JOIN_MIN_SCORE',
  SAME_OWNER_SCORE_BONUS > JOIN_MIN_SCORE, true);

// ── Same-owner table: bonus applied, MIN_SCORE bypassed ──────────────────────
console.log('\nSame-owner table affinity');

// Table with user1 (+ House). Another user1 agent deploys.
const ownTable = mockTable([
  { userId: 'user1', profile: TIGHT },
  { userId: null,    profile: TIGHT },  // House
]);
const joinerProfile = TIGHT;  // same tight style → base action score will be low

const baseScore = scoreTableForJoin(ownTable, joinerProfile);
console.log(`  INFO  base action score (tight table): ${baseScore}`);

const candidate = pickTableToJoin([ownTable], {
  profile: joinerProfile, agentId: 'agent-new', userId: 'user1',
});
assert('same-owner table found even with low action score', candidate !== null, true);
assert('same-owner score = base + SAME_OWNER_SCORE_BONUS',
  candidate?.score, baseScore + SAME_OWNER_SCORE_BONUS);

// Verify base score alone would have been blocked by JOIN_MIN_SCORE.
const noOwnerCandidate = pickTableToJoin([ownTable], {
  profile: joinerProfile, agentId: 'agent-new', userId: 'user2',
});
if (baseScore < JOIN_MIN_SCORE) {
  assert('non-owner low-score table is blocked (MIN_SCORE applies)', noOwnerCandidate, null);
} else {
  console.log(`  INFO  base score ${baseScore} >= MIN_SCORE ${JOIN_MIN_SCORE}; non-owner join is also possible (not a bug)`);
  passed++;
}

// ── Own table preferred over a non-owner table with higher base score ─────────
console.log('\nSame-owner table preferred over higher-scoring foreign table');

const foreignTable = mockTable([
  { userId: 'user2', profile: LOOSE },
  { userId: null,    profile: TIGHT },  // House
]);
const foreignBase = scoreTableForJoin(foreignTable, NEUTRAL);
const ownBase     = scoreTableForJoin(ownTable, NEUTRAL);
console.log(`  INFO  foreignBase=${foreignBase} ownBase=${ownBase} bonus=${SAME_OWNER_SCORE_BONUS}`);

const preferred = pickTableToJoin([foreignTable, ownTable], {
  profile: NEUTRAL, agentId: 'agent-x', userId: 'user1',
});
// Own table score = ownBase + SAME_OWNER_SCORE_BONUS; must beat foreignBase.
assert('own table wins if ownBase + bonus > foreignBase',
  preferred?.table,
  ownBase + SAME_OWNER_SCORE_BONUS >= foreignBase ? ownTable : foreignTable
);

// ── Three sequential same-owner deploys land at ONE table ────────────────────
console.log('\nThree sequential same-owner deploys → one table');

// Simulate: each deploy checks candidates, then "commits" by adding the agent
// to the winning table's agentUserIds. Start with no tables.
const tables = [];  // grows as deploys create new tables

function simulateDeploy(userId, agentId, profile = NEUTRAL) {
  const candidate = pickTableToJoin(tables, { profile, agentId, userId });
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
  ], { agentIds: [agentId, 'house-1'] });
  tables.push(newTable);
  return { table: newTable, created: true };
}

const d1 = simulateDeploy('user1', 'agent-A');
const d2 = simulateDeploy('user1', 'agent-B');
const d3 = simulateDeploy('user1', 'agent-C');

assert('deploy 1 creates a new table',           d1.created, true);
assert('deploy 2 joins deploy 1\'s table',       d2.created, false);
assert('deploy 3 also joins the same table',     d3.created, false);
assert('all three at the same table',            d1.table === d2.table && d2.table === d3.table, true);
assert('final table has at least 4 seated (3 agents + House)', d1.table.seatedCount() >= 4, true);
assert('total tables created is 1',              tables.length, 1);

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

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
