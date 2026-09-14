// src/server/bodyLevels.test.js — LIFE-1 job 2
//
// "Stamina and heat read as three dots, not a continuous bar, everywhere they
// appear (home, agent view, watch)." src/shared/levels.test.js pins what the
// three states ARE; this file pins that all three surfaces carry them, because
// a reading that exists in one place and not the others is the bar problem
// with an extra step.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-body-'));
_closeForTests();
process.chdir(dir);
process.on('exit', () => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const { saveProfile } = await import('./store.js');
saveProfile('body-owner', {
  userId: 'body-owner',
  chat: [],
  agents: [
    {
      id: 'stone', name: 'Stone', status: 'idle',
      nature: { name: 'Rock' },
      attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
      mood: { state: 'tilted', heat: 78, cause: 'a cooler', updatedAt: Date.now() },
      stamina: { left: 20, at: Date.now() },
      fatigue: 'worn',
      pocket: { balance: 5000, mode: 'topup', cap: null, realised: 0, ledger: [] },
    },
  ],
});

const profiles = await import('./agentProfiles.js');
const { STAMINA_LABELS, HEAT_LABELS } = await import('../shared/levels.js');

const SHAPE = ['dots', 'label', 'level', 'value'];

function assertBody(body, where) {
  assert.ok(body, `${where} carries no body reading`);
  for (const half of ['stamina', 'heat']) {
    assert.ok(body[half], `${where} is missing ${half}`);
    assert.deepEqual(Object.keys(body[half]).sort(), SHAPE, `${where}.${half} is a different shape`);
    assert.ok(body[half].dots >= 1 && body[half].dots <= 3,
      `${where}.${half} lit ${body[half].dots} dots`);
  }
}

test('LIFE-1: the agent view carries both readings as three states', () => {
  const agent = profiles.presentedRoster('body-owner', { owner: true })
    .find((a) => a.id === 'stone');
  assertBody(agent.body, 'agent view');
  // He is spent and steaming, and the words say so.
  assert.equal(agent.body.stamina.level, 'worn');
  assert.equal(agent.body.stamina.label, STAMINA_LABELS.worn);
  assert.equal(agent.body.heat.level, 'steaming');
  assert.equal(agent.body.heat.label, HEAT_LABELS.steaming);
  // And the old continuous fields are still exactly where they were: this is
  // additive, and a client that ignores `body` sees what it always saw.
  assert.equal(agent.fatigue, 'worn');
  assert.equal(agent.mood.heat, 78);
});

test('LIFE-1: the reserve itself is on the agent view, where an owner can see it', () => {
  const agent = profiles.presentedRoster('body-owner', { owner: true })
    .find((a) => a.id === 'stone');
  assert.equal(typeof agent.body.stamina.value, 'number');
  assert.ok(agent.body.stamina.value <= 100 && agent.body.stamina.value >= 0);
});

test('LIFE-1: home carries the same reading as the agent view, not a second one', () => {
  const home = profiles.homeSnapshot('body-owner', { owner: true });
  const him = home.agents.find((a) => a.id === 'stone');
  assertBody(him.body, 'home');
  const agent = profiles.presentedRoster('body-owner', { owner: true })
    .find((a) => a.id === 'stone');
  assert.equal(him.body.stamina.level, agent.body.stamina.level,
    'the room and the card must not disagree about one man');
  assert.equal(him.body.heat.level, agent.body.heat.level);
});

test('LIFE-1: the felt carries it on every seat that reports a mood', async () => {
  const { Table } = await import('./table.js');
  const { setPersistEnabled } = await import('./opponentStats.js');
  setPersistEnabled(false);
  const table = new Table('body-tbl', { smallBlind: 10, bigBlind: 20, maxSeats: 2 });
  const body = table._seatBody(0);
  assertBody(body, 'felt seat');
  // A seat with nobody behind it is not blank — there is nothing unknown
  // about an empty chair, and a blank on the felt reads as unknown.
  assert.equal(body.stamina.level, 'fresh');
  assert.equal(body.heat.level, 'level');
});
