// src/agent/stamina.test.js — LIFE-1 job 1
//
// The reserve. The thing these tests are really pinning is the finding that
// made the file necessary: before it, no amount of play at home could make an
// agent tired, so no agent ever slept.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STAMINA_MAX, SETTLED_AT, WORN_AT, RECOVER_PER_HOUR, HOME_HAND_WEIGHT,
  staminaStage, handCost, storedStamina, staminaNow, staminaStageNow,
  spendStamina, restStamina, worseStage, staminaPercent,
} from './stamina.js';

const HOUR = 3_600_000;
const NOW = 1_700_000_000_000;

test('LIFE-1: three states, and the two thresholds that separate them', () => {
  assert.equal(staminaStage(STAMINA_MAX), 'fresh');
  assert.equal(staminaStage(SETTLED_AT), 'fresh');
  assert.equal(staminaStage(SETTLED_AT - 1), 'settled');
  assert.equal(staminaStage(WORN_AT), 'settled');
  assert.equal(staminaStage(WORN_AT - 1), 'worn');
  assert.equal(staminaStage(0), 'worn');
});

test('LIFE-1: an agent who predates the reserve is fresh, never worn', () => {
  // The whole roster has no `stamina` on its record the moment this deploys.
  // Reading a missing reserve as empty would put every agent in prod to sleep.
  assert.equal(staminaStage(null), 'fresh');
  assert.equal(staminaStage(undefined), 'fresh');
  assert.equal(storedStamina({}), STAMINA_MAX);
  assert.equal(staminaStageNow({ id: 'a' }, { now: NOW }), 'fresh');
});

test('LIFE-1: his STAMINA attribute decides what a hand costs him', () => {
  const weak = handCost(0);
  const mid = handCost(50);
  const strong = handCost(100);
  assert.ok(weak > mid && mid > strong, `${weak} > ${mid} > ${strong}`);
  // The Grinder gets meaningfully more poker out of the same reserve. Without
  // this the attribute would be decorative here.
  assert.ok(weak / strong >= 3, `a weak agent should tire at least 3x faster (${weak / strong})`);
});

test('LIFE-1: a hand at the kitchen table costs half a hand at the casino', () => {
  assert.equal(handCost(50, { home: true }), handCost(50) * HOME_HAND_WEIGHT);
});

test('LIFE-1: playing costs the reserve, and the cost survives the session', () => {
  const agent = { attrs: { STAMINA: 50 } };
  const before = staminaNow(agent, { now: NOW });
  spendStamina(agent, 40, { staminaAttr: 50, now: NOW });
  const after = staminaNow(agent, { now: NOW });
  assert.ok(after < before, 'forty hands took something out of him');
  // And it is on the RECORD, not in a session that is about to be thrown away.
  assert.equal(agent.stamina.left, after);
  assert.equal(agent.stamina.at, NOW);
});

test('LIFE-1: a household that only ever plays at home can still reach worn', () => {
  // THE FINDING, as a test. HOME_MAX_HANDS is 40 and a home game is followed
  // by a ten-minute cooldown, so this is an evening of kitchen poker and
  // nothing else — the exact situation that used to cost an agent nothing.
  const agent = { attrs: { STAMINA: 50 } };
  let now = NOW;
  for (let game = 0; game < 12; game++) {
    spendStamina(agent, 40, { staminaAttr: 50, home: true, now });
    now += 15 * 60_000;             // five minutes of play, ten off
  }
  assert.equal(staminaStageNow(agent, { now }), 'worn',
    'an evening of kitchen poker has to be able to put him to sleep');
});

test('LIFE-1: resting gives it back, on its own clock, with nothing running', () => {
  const agent = { stamina: { left: 10, at: NOW } };
  assert.equal(staminaStage(staminaNow(agent, { now: NOW })), 'worn');
  const twoHours = staminaNow(agent, { now: NOW + 2 * HOUR });
  assert.equal(twoHours, 10 + 2 * RECOVER_PER_HOUR);
  // Full in under seven hours, and never past full.
  assert.equal(staminaNow(agent, { now: NOW + 100 * HOUR }), STAMINA_MAX);
});

test('LIFE-1: a man in a chair is not recovering', () => {
  const agent = { stamina: { left: 40, at: NOW } };
  assert.equal(staminaNow(agent, { now: NOW + 5 * HOUR, resting: false }), 40);
  assert.ok(staminaNow(agent, { now: NOW + 5 * HOUR, resting: true }) > 40);
});

test('LIFE-1: hands are charged against a rested reserve, not the one he stood up with', () => {
  const agent = { stamina: { left: 20, at: NOW } };
  spendStamina(agent, 10, { staminaAttr: 50, now: NOW + 4 * HOUR });
  // 20 + 4h of recovery, minus ten hands. If the recovery were skipped he
  // would be below where he started after a four-hour break.
  const expected = Math.min(STAMINA_MAX, 20 + 4 * RECOVER_PER_HOUR) - 10 * handCost(50);
  assert.ok(Math.abs(agent.stamina.left - expected) < 0.2, `${agent.stamina.left} vs ${expected}`);
});

test('LIFE-1: banking rest rewrites the record without spending anything', () => {
  const agent = { stamina: { left: 30, at: NOW } };
  const left = restStamina(agent, { now: NOW + HOUR });
  assert.equal(left, 30 + RECOVER_PER_HOUR);
  assert.equal(agent.stamina.at, NOW + HOUR);
});

test('LIFE-1: the worse of two stages, so neither can hide the other', () => {
  assert.equal(worseStage('fresh', 'worn'), 'worn');
  assert.equal(worseStage('worn', 'fresh'), 'worn');
  assert.equal(worseStage('settled', 'fresh'), 'settled');
  assert.equal(worseStage('fresh', 'fresh'), 'fresh');
  // An unrecognised word is not allowed to read as tired.
  assert.equal(worseStage(null, 'fresh'), 'fresh');
  assert.equal(worseStage(undefined, undefined), 'fresh');
});

test('LIFE-1: the percentage and the word never disagree', () => {
  const agent = { stamina: { left: WORN_AT - 1, at: NOW } };
  assert.equal(staminaPercent(agent, { now: NOW, resting: false }), WORN_AT - 1);
  assert.equal(staminaStageNow(agent, { now: NOW, resting: false }), 'worn');
});

test('LIFE-1: pure — the same agent at the same instant reads the same twice', () => {
  const agent = { stamina: { left: 55, at: NOW } };
  const first = staminaNow(agent, { now: NOW + HOUR });
  for (let i = 0; i < 20; i++) {
    assert.equal(staminaNow(agent, { now: NOW + HOUR }), first);
  }
  assert.equal(agent.stamina.left, 55, 'a read must not write');
});
