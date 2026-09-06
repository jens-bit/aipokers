// src/server/rustNight.test.js — SERVER-5 job 2
//
// The arithmetic is asserted in src/agent/rust.test.js. This is the JOB: once
// per owner per day, over the whole building, persisted, and cheap when there
// is nothing to do.
//
// The difference from homeNight's guard is the thing worth pinning here. That
// one is a SPEND limiter and a day it misses is a day nobody pays for. This one
// is only a "do not walk the store twice" guard, and a day it misses is a day
// it makes up — because applyRust works off elapsed time. Both halves of that
// are tested below.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { RUST_IDLE_MS, RUST_STEP_MS } from '../agent/rust.js';

const DAY = 24 * 60 * 60_000;
const NOW = Date.now();

const ORIGINAL_CWD = process.cwd();
let dir;
let store;
let rustNight;

function agent(id, over = {}) {
  return {
    id,
    name: id.toUpperCase(),
    status: 'idle',
    activeTableId: null,
    strategy: 'You are a poker player.',
    style: 'Balanced',
    risk: 'Medium',
    bankroll: 3_000,
    pocket: { balance: 3_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 },
    stats: { handsPlayed: 400, handsWon: 180 },
    profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
    attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    attrsBorn: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    bornAt: NOW - 400 * DAY,
    ...over,
  };
}

// Every skill last exercised `ago` ago.
const used = (ago) => ({
  READS: NOW - ago, FOCUS: NOW - ago, DISCIPLINE: NOW - ago,
  COMPOSURE: NOW - ago, DECEPTION: NOW - ago, STAMINA: NOW - ago,
});

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-rust-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);

  // Two households. One has a man who has let his reads go; the other has a
  // man who plays every night, and a man who never earned anything to lose.
  store.saveProfile('owner-a', {
    userId: 'owner-a',
    chat: [],
    agents: [
      agent('rusty', { attrs: { READS: 58, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
                       attrUsedAt: used(RUST_IDLE_MS + 2 * RUST_STEP_MS) }),
    ],
  });
  store.saveProfile('owner-b', {
    userId: 'owner-b',
    chat: [],
    agents: [
      agent('current', { attrs: { READS: 58, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
                         attrUsedAt: used(DAY) }),
      agent('flat',    { attrUsedAt: used(400 * DAY) }),
    ],
  });

  rustNight = await import('./rustNight.js');
});

after(() => {
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const read = (owner, id) => store.loadAgentStore()[owner].agents.find((a) => a.id === id);

test('SERVER-5: the pass walks the whole building and drifts what is owed', () => {
  const drifted = rustNight.runNightly({ now: NOW });

  const rusty = drifted.filter((d) => d.agentId === 'rusty');
  assert.equal(rusty.length, 3, 'a fortnight plus two weeks is three points');
  assert.ok(rusty.every((d) => d.key === 'READS'));
  assert.ok(rusty.every((d) => d.cause === 'getting rusty at reads.'));
  assert.equal(read('owner-a', 'rusty').attrs.READS, 55, 'and it is persisted');

  assert.equal(drifted.filter((d) => d.agentId === 'current').length, 0,
    'a skill he used yesterday does not rust');
  assert.equal(drifted.filter((d) => d.agentId === 'flat').length, 0,
    'and a man who earned nothing has nothing to lose');
  assert.equal(read('owner-b', 'flat').attrs.READS, 50);
});

test('SERVER-5: once per owner per day', () => {
  assert.equal(rustNight.ranToday('owner-a', { now: NOW }), true);
  assert.deepEqual(rustNight.runNightly({ now: NOW }), [], 'the same day is a no-op');
  assert.deepEqual(rustNight.runNightly({ now: NOW + 60_000 }), []);
  assert.equal(read('owner-a', 'rusty').attrs.READS, 55, 'and nothing moved on the second ask');
});

test('SERVER-5: a day the job misses is a day it makes up', () => {
  // Nobody opened the app for three weeks. The pass is not "one point per
  // run": applyRust works off elapsed time, so the missed weeks are waiting.
  const drifted = rustNight.runNightly({ now: NOW + 21 * DAY });
  const rusty = drifted.filter((d) => d.agentId === 'rusty');
  assert.equal(rusty.length, 3);
  assert.equal(read('owner-a', 'rusty').attrs.READS, 52);
});

test('SERVER-5: rust never takes him under born, however long nobody comes back', () => {
  rustNight.runNightly({ now: NOW + 400 * DAY });
  const after = read('owner-a', 'rusty');
  assert.equal(after.attrs.READS, 50, 'the eight he earned, and not one more');
  rustNight.runNightly({ now: NOW + 800 * DAY });
  assert.equal(read('owner-a', 'rusty').attrs.READS, 50);
});

test('SERVER-5: reset forgets the day, and the ledger holds every point', () => {
  rustNight.reset();
  assert.equal(rustNight.ranToday('owner-a', { now: NOW }), false);

  const log = read('owner-a', 'rusty').attrLog.filter((e) => e.cause === 'getting rusty at reads.');
  assert.equal(log.length, 8, 'one line per point, all the way down to born');
  assert.deepEqual(log.map((e) => [e.from, e.to]), [
    [58, 57], [57, 56], [56, 55], [55, 54], [54, 53], [53, 52], [52, 51], [51, 50],
  ]);
  // Dated when they were due, never all at the moment somebody looked.
  assert.ok(log.every((e, i) => i === 0 || e.ts > log[i - 1].ts));
});
