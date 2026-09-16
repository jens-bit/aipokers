// src/server/seatRules.test.js — AGENT-5 job E
//
// THREE RULES, ONE FUNCTION, PROVED INDEPENDENTLY.
//
// `seatAI` is the only function in the codebase that puts an agent in a chair,
// which is why AGENT-4 job A moved the one-table rule into it and why AGENT-5
// job A put the stamina floor beside it. Three things were true at that one
// point, and the job that removed one of them (job E — Jens's overrule of the
// same-owner rule) is exactly the kind of change that takes a neighbour with it
// without anybody noticing: the removed rule shared a predicate with one
// survivor and a throw site with the other.
//
// So each rule is exercised ON ITS OWN below, with the others arranged so they
// cannot fire, and then all of them at one table. A test that only ever trips
// all three at once cannot tell you which one is left.
//
//   1. ONE AGENT, ONE TABLE     (AGENT-4 job A / MONEY-1 job 5)
//      He may not hold two chairs. Refused wherever he is already sitting.
//   2. HE MUST BE FIT TO START  (AGENT-5 job A)
//      A reserve under SETTLED_AT is a man the session stop rule pulls after
//      one hand. Casino only — the kitchen table has its own door.
//   3. NOT TWO OF ONE OWNER     — REMOVED, and asserted removed. Jens's call.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OWNER = 'seat-rules-owner';
const ORIGINAL_CWD = process.cwd();

let dir;
let store;
let Table;
let seating;
let profiles;
let DEPLOY_FLOOR;

// A record is only needed by rule 2; the rest run against a bare Table with
// nothing underneath it, which is how every other seat suite runs.
const agent = (id, over = {}) => ({
  id,
  name: id.toUpperCase(),
  status: 'idle',
  activeTableId: null,
  nature: { name: 'Rock' },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
  ...over,
});

const full = { left: 100, at: Date.now() };
const empty = { left: 0, at: Date.now() };

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-seatrules-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);

  store.saveProfile(OWNER, {
    userId: OWNER,
    chat: [],
    agents: [
      agent('r1', { stamina: full }),
      agent('r2', { stamina: empty }),
      agent('r2h', { stamina: empty }),
      agent('r3a', { stamina: full }),
      agent('r3b', { stamina: full }),
      agent('c-rested', { stamina: full }),
      agent('c-mate', { stamina: full }),
      agent('c-spent', { stamina: empty }),
    ],
  });
  // An empty shelf, so the spent man's refusal is the out-of-stock one and the
  // test does not depend on a starting grant somebody changes later.
  store.saveWallet(OWNER, { ownerId: OWNER, balance: 10_000, fridge: { beer: 0, snack: 0 }, ledger: [] });

  ({ Table } = await import('./table.js'));
  seating = await import('./seating.js');
  profiles = await import('./agentProfiles.js');
  ({ DEPLOY_FLOOR } = await import('./restFloor.js'));
});

after(() => {
  process.chdir(ORIGINAL_CWD);
  try { store?._closeForTests?.(); } catch { /* best effort */ }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

function table(opts = {}) {
  const t = new Table({ tableId: 'rules-t', smallBlind: 10, bigBlind: 20, ...opts });
  t._scheduleNextHand = () => {};
  t.startSessionLoop = () => {};
  return t;
}

// ── 1 · one agent, one table ────────────────────────────────────────────────

test('AGENT-5 job E: rule 1 alone — the same man may not hold two chairs', () => {
  const first = table({ tableId: 'first' });
  const second = table({ tableId: 'second' });
  first.seatAI({ agentId: 'r1', userId: OWNER, displayName: 'R1', buyIn: 2_000 });
  seating.setSeatLookup((id) => (id === 'r1' ? first : null));

  try {
    assert.throws(
      () => second.seatAI({ agentId: 'r1', userId: OWNER, displayName: 'R1', buyIn: 2_000 }),
      /one table at a time/,
    );
    assert.equal(second.seatedCount(), 0, 'and nobody was seated on the way out');
  } finally {
    seating.setSeatLookup(null);
  }
});

// ── 2 · fit to start ────────────────────────────────────────────────────────

test('AGENT-5 job E: rule 2 alone — a spent man is refused at an empty table', () => {
  // Empty on purpose: rule 1 has nowhere to fire and the removed rule 3 has
  // nobody to fire about, so what refuses him can only be the floor.
  const t = table({ tableId: 'spent' });
  assert.throws(
    () => t.seatAI({ agentId: 'r2', userId: OWNER, displayName: 'R2', buyIn: 2_000 }),
    (err) => {
      // The sentence he actually says at the door, not a generic error — the
      // same one the deploy route hands the owner.
      assert.equal(err.message, profiles.restRefusalFor('r2', OWNER, { displayName: 'R2' }).message);
      return true;
    },
  );
  assert.equal(t.seatedCount(), 0);

  // And at the floor he sits straight down. Same man, same table, one number.
  profiles.setAgentStamina('r2', OWNER, DEPLOY_FLOOR);
  assert.equal(t.seatAI({ agentId: 'r2', userId: OWNER, displayName: 'R2', buyIn: 2_000 }), 0);
});

test('AGENT-5 job E: rule 2 is a casino rule — the kitchen table is untouched', () => {
  const home = table({ tableId: 'home-seat-rules', home: true, homeOwnerId: OWNER });
  assert.equal(home.seatAI({ agentId: 'r2h', userId: OWNER, displayName: 'R2H', buyIn: 200 }), 0,
    'a spent man still sits down at his own kitchen table');
});

// ── 3 · the rule Jens removed ───────────────────────────────────────────────

test('AGENT-5 job E: rule 3 is gone — two of one owner, neither other rule firing', () => {
  const t = table({ tableId: 'together' });
  assert.equal(t.seatAI({ agentId: 'r3a', userId: OWNER, displayName: 'R3A', buyIn: 2_000 }), 0);
  assert.equal(t.seatAI({ agentId: 'r3b', userId: OWNER, displayName: 'R3B', buyIn: 2_000 }), 1,
    'his stablemate takes the next chair');
  assert.equal(t.seatedCount(), 2);
});

// ── all three at one table ──────────────────────────────────────────────────

test('AGENT-5 job E: the three coexist, and each still answers for itself', () => {
  const t = table({ tableId: 'all-three' });
  const elsewhere = table({ tableId: 'elsewhere' });

  // Rule 3 removed: two of his sit down together.
  assert.equal(t.seatAI({ agentId: 'c-rested', userId: OWNER, displayName: 'RESTED', buyIn: 2_000 }), 0);
  assert.equal(t.seatAI({ agentId: 'c-mate', userId: OWNER, displayName: 'MATE', buyIn: 2_000 }), 1);

  // Rule 2 fires at that very table, for the man it is about and for nobody
  // else — his two stablemates are sitting there rested.
  assert.throws(
    () => t.seatAI({ agentId: 'c-spent', userId: OWNER, displayName: 'SPENT', buyIn: 2_000 }),
    /snack|hour/i,
  );

  // Rule 1 fires at that very table, for the man it is about.
  seating.setSeatLookup((id) => (id === 'c-rested' ? t : null));
  try {
    assert.throws(
      () => elsewhere.seatAI({ agentId: 'c-rested', userId: OWNER, displayName: 'RESTED', buyIn: 2_000 }),
      /one table at a time/,
    );
  } finally {
    seating.setSeatLookup(null);
  }

  assert.equal(t.seatedCount(), 2, 'two seated, and nothing taken by either refusal');
  assert.equal(elsewhere.seatedCount(), 0);
});
