// src/server/staminaDots.test.js — AGENT-5 job I
//
// THE THREE DOTS AND THE RULE HAVE TO AGREE.
//
// The question the job asked: what do the dots read? If `agent.stamina.stage`,
// they are correct. If the raw reserve against 34 and 67, then after two
// snacks — reserve 50 — the dot says SETTLED IN while the man is still worn
// and still cannot take a seat. A lie on screen, and the worst kind: it is a
// lie at the exact moment an owner is looking to find out whether the thing he
// just paid for worked.
//
// THE ANSWER, and it is why this file is mostly a guard rather than a fix:
// they read the stage. `staminaLevel` takes the word over the number when it
// has both, presentAgent hands it `fatigue` (which is visibleFatigue, which is
// staminaStageNow, which applies the hysteresis), and the felt and the home
// pill both pass `{ stage }` and nothing else.
//
// WHAT WAS WRONG was one step further back, and nothing was drawing it yet:
// `levelFromReserve` in src/shared/levels.js copied stamina.js's two
// thresholds and NOT its hysteresis. Half a rule, in the module the client
// draws from, waiting for the first caller who had a number and no word. That
// is fixed and asserted in levels.test.js; this file asserts the whole walk,
// because a unit test on a threshold cannot tell you what the screen says.
//
// The walk: feed an empty agent twice, through the real fridge, and read the
// projection the client renders.

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SNACK_STAMINA } from './fridge.js';
import { SETTLED_AT, WORN_AT } from '../agent/stamina.js';

const OWNER = 'dots-owner';
const ORIGINAL_CWD = process.cwd();

let dir;
let store;
let profiles;
let levels;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-dots-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);

  store.saveProfile(OWNER, {
    userId: OWNER,
    chat: [],
    agents: [{
      id: 'spent',
      name: 'SPENT',
      status: 'idle',
      activeTableId: null,
      nature: { name: 'Rock' },
      mood: { state: 'neutral', heat: 30, losingRun: 0 },
      profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
      attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
      // Empty, and his record SAYS worn — which is what the hysteresis reads.
      // This is the overnight drain in one literal.
      stamina: { left: 0, at: Date.now(), stage: 'worn' },
    }],
  });
  store.saveWallet(OWNER, {
    ownerId: OWNER, balance: 10_000, fridge: { beer: 0, snack: 6 }, ledger: [],
  });

  profiles = await import('./agentProfiles.js');
  levels = await import('../shared/levels.js');
});

after(() => {
  process.chdir(ORIGINAL_CWD);
  try { store?._closeForTests?.(); } catch { /* best effort */ }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// The projection the client renders, by id — the same one GET /api/agents
// builds a roster out of.
const view = () => profiles.presentAgentById('spent', OWNER, { owner: true });

// And the real fridge door: the shelf is debited, the reserve is credited and
// the record is saved, exactly as POST /api/agents/:id/give does it.
const record = () => profiles.agentsOf(OWNER).find((a) => a.id === 'spent');
const feed = () => {
  const r = profiles.giveItemFrom(record(), OWNER, 'snack');
  assert.equal(r.status, 200, JSON.stringify(r.body));
};

test('AGENT-5 job I: two snacks leave the dot reading WORN', () => {
  feed();
  feed();

  const body = view()?.body;
  assert.ok(body, 'the projection carries a body reading');

  // The number moved, and it moved to the exact place the lie lives: above
  // WORN_AT, below SETTLED_AT.
  assert.equal(body.stamina.value, 2 * SNACK_STAMINA);
  assert.ok(body.stamina.value > WORN_AT, 'past the bare worn threshold');
  assert.ok(body.stamina.value < SETTLED_AT, 'and short of rested');

  // And the dot did not.
  assert.equal(body.stamina.level, 'worn', 'the dot must not say settled here');
  assert.equal(body.stamina.dots, 1);
  assert.equal(body.stamina.label, 'Worn out');
});

test('AGENT-5 job I: the dot agrees with the rule, not with the number', () => {
  // Same reserve, read the two ways. Without his history the bare thresholds
  // say 'settled'; with it the rule says 'worn'. The projection must be the
  // second one, or the screen and the deploy gate tell an owner two different
  // things about one man on the same afternoon.
  assert.equal(levels.levelFromReserve(2 * SNACK_STAMINA), 'settled');
  assert.equal(levels.levelFromReserve(2 * SNACK_STAMINA, 'worn'), 'worn');
  assert.equal(view().body.stamina.level, 'worn');

  // And the gate agrees with the dot, which is the whole point of job A.
  assert.ok(profiles.restRefusalFor('spent', OWNER), 'still refused a seat');
});

test('AGENT-5 job I: the third snack lights all three', () => {
  feed();
  const body = view().body;
  assert.ok(body.stamina.value >= SETTLED_AT, `reserve ${body.stamina.value}`);
  assert.equal(body.stamina.level, 'fresh');
  assert.equal(body.stamina.dots, 3);
  assert.equal(profiles.restRefusalFor('spent', OWNER), null, 'and he may sit down');
});
