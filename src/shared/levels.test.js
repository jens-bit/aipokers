// src/shared/levels.test.js — LIFE-1 job 2

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STAMINA_LEVELS, HEAT_LEVELS, STAMINA_LABELS, HEAT_LABELS,
  staminaLevel, heatLevel, bodyLevels, levelFromReserve,
  STAMINA_SETTLED_AT, STAMINA_WORN_AT,
} from './levels.js';

test('LIFE-1: three states each, and never a fourth', () => {
  assert.equal(STAMINA_LEVELS.length, 3);
  assert.equal(HEAT_LEVELS.length, 3);
  for (const l of STAMINA_LEVELS) assert.ok(STAMINA_LABELS[l], `${l} has no words`);
  for (const l of HEAT_LEVELS) assert.ok(HEAT_LABELS[l], `${l} has no words`);
});

test('LIFE-1: stamina lights one dot per state, rested is three', () => {
  assert.deepEqual(staminaLevel({ stage: 'worn' }).dots, 1);
  assert.deepEqual(staminaLevel({ stage: 'settled' }).dots, 2);
  assert.deepEqual(staminaLevel({ stage: 'fresh' }).dots, 3);
});

test('LIFE-1: heat lights one dot per state, steaming is three', () => {
  assert.equal(heatLevel(0).dots, 1);
  assert.equal(heatLevel(40).dots, 1, '40 is the top of level, inclusive');
  assert.equal(heatLevel(41).dots, 2);
  assert.equal(heatLevel(60).dots, 2, '60 is the top of simmering, inclusive');
  assert.equal(heatLevel(61).dots, 3);
  assert.equal(heatLevel(100).dots, 3);
});

test('LIFE-1: the heat cuts are mood.js\'s own band boundaries, not new ones', async () => {
  // If these ever diverge, an owner can be told "simmering" beside a mood pip
  // that says neutral. The bands are the shared fact; this pins them together.
  const { HEAT_BANDS } = await import('../agent/mood.js');
  const neutralTop = HEAT_BANDS.find((b) => b.state === 'neutral').upTo;
  const frustratedTop = HEAT_BANDS.find((b) => b.state === 'frustrated').upTo;
  assert.equal(heatLevel(neutralTop).level, 'level');
  assert.equal(heatLevel(neutralTop + 1).level, 'simmering');
  assert.equal(heatLevel(frustratedTop).level, 'simmering');
  assert.equal(heatLevel(frustratedTop + 1).level, 'steaming');
});

test('LIFE-1: nothing measured is rested and level, never worn and steaming', () => {
  assert.equal(staminaLevel({}).level, 'fresh');
  assert.equal(staminaLevel({ stage: null, value: null }).level, 'fresh');
  assert.equal(heatLevel(null).level, 'level');
  assert.equal(heatLevel(undefined).level, 'level');
  assert.equal(heatLevel('nonsense').level, 'level');
});

test('LIFE-1: the stage wins over the reserve when both are given', () => {
  // The stage is what the rest of the system has already agreed he is. A
  // reading that disagreed with the pip beside it is the bar problem again.
  assert.equal(staminaLevel({ stage: 'worn', value: 100 }).level, 'worn');
  assert.equal(staminaLevel({ stage: 'fresh', value: 0 }).level, 'fresh');
  // An unrecognised word falls through to the number rather than being trusted.
  assert.equal(staminaLevel({ stage: 'exhausted', value: 10 }).level, 'worn');
});

test('LIFE-1: the reserve thresholds match the ones the server charges against', async () => {
  const { SETTLED_AT, WORN_AT } = await import('../agent/stamina.js');
  assert.equal(STAMINA_SETTLED_AT, SETTLED_AT);
  assert.equal(STAMINA_WORN_AT, WORN_AT);
  assert.equal(levelFromReserve(SETTLED_AT), 'fresh');
  assert.equal(levelFromReserve(SETTLED_AT - 1), 'settled');
  assert.equal(levelFromReserve(WORN_AT - 1), 'worn');
});

test('LIFE-1: the value rides along, so nothing that had a number loses it', () => {
  assert.equal(staminaLevel({ stage: 'settled', value: 42 }).value, 42);
  assert.equal(heatLevel(55).value, 55);
  // Out of range is clamped rather than passed through.
  assert.equal(heatLevel(140).value, 100);
  assert.equal(heatLevel(-5).value, 0);
});

test('LIFE-1: both readings arrive in one shape, so one component draws both', () => {
  const body = bodyLevels({ stage: 'settled', stamina: 50, heat: 72 });
  for (const half of [body.stamina, body.heat]) {
    assert.deepEqual(Object.keys(half).sort(), ['dots', 'label', 'level', 'value']);
    assert.ok(half.dots >= 1 && half.dots <= 3);
    assert.equal(typeof half.label, 'string');
  }
  assert.equal(body.stamina.level, 'settled');
  assert.equal(body.heat.level, 'steaming');
});

test('LIFE-1: a seat with nothing behind it reads rested and level, not blank', () => {
  const body = bodyLevels({});
  assert.equal(body.stamina.level, 'fresh');
  assert.equal(body.heat.level, 'level');
  assert.equal(body.stamina.label, STAMINA_LABELS.fresh);
});

// ── AGENT-5 job I · the hysteresis, in the module the client draws from ─────
//
// levelFromReserve copied stamina.js's two thresholds and not its third rule.
// Half a rule in a shared module is a screen that can disagree with the server
// about one man, in exactly the case an owner is looking hardest: two snacks
// in, reserve 50, and he wants to know whether it worked.

// stamina.js is the server's and levels.js deliberately does not import it —
// see the note by the constants. So the two are walked against each other here
// instead, which is the only thing keeping the copy honest.
const { SETTLED_AT, WORN_AT, staminaStage } = await import('../agent/stamina.js');

test('AGENT-5 job I: a worn record stays worn until the reserve is back to rested', () => {
  // Two snacks from empty. The bare thresholds say he is settled; the rule
  // says he is still asleep, and the rule is what the deploy gate uses.
  assert.equal(levelFromReserve(50), 'settled');
  assert.equal(levelFromReserve(50, 'worn'), 'worn');

  assert.equal(levelFromReserve(SETTLED_AT - 1, 'worn'), 'worn');
  assert.equal(levelFromReserve(SETTLED_AT, 'worn'), 'fresh', 'and the third snack wakes him');
  assert.equal(levelFromReserve(WORN_AT, 'worn'), 'worn', 'clearing WORN_AT is not waking up');
});

test('AGENT-5 job I: it mirrors staminaStage rather than approximating it', () => {
  // The two are separate files on purpose (see the note by the constants), so
  // the only thing that keeps them honest is a case that walks both.
  for (let v = 0; v <= 100; v += 1) {
    for (const was of [null, 'fresh', 'settled', 'worn']) {
      assert.equal(levelFromReserve(v, was), staminaStage(v, was), `reserve ${v}, was ${was}`);
    }
  }
});

test('AGENT-5 job I: a stage still beats a reserve, history or no history', () => {
  // The existing rule, re-stated against the new argument: a caller that has
  // the word does not get it overridden by a number and a guess.
  assert.equal(staminaLevel({ stage: 'fresh', value: 10, was: 'worn' }).level, 'fresh');
  assert.equal(staminaLevel({ value: 50, was: 'worn' }).level, 'worn');
  assert.equal(staminaLevel({ value: 50 }).level, 'settled');
  assert.equal(staminaLevel({ value: 50, was: 'worn' }).dots, 1);
});
