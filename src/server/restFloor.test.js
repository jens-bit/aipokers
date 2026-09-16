// src/server/restFloor.test.js — AGENT-5 jobs A + B
//
// The arithmetic first, the sentence second. A test that only reads English
// cannot tell a floor of 67 from a floor of 60, and the floor is the whole
// point of the job.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEPLOY_FLOOR, REST_WINS_HOURS,
  restDeficit, snacksFor, hoursFor, restPlan, restRefusal,
  countWord, snackPhrase, hoursPhrase,
} from './restFloor.js';
import { SETTLED_AT, WORN_AT, RECOVER_PER_HOUR, staminaStage } from '../agent/stamina.js';
import { SNACK_STAMINA } from './fridge.js';
import { VOICED_NATURES, NATURE_WANT_LINES, ACTION_LABELS } from '../agent/wantVoice.js';

// ── the floor and why it is that number ─────────────────────────────────────

test('AGENT-5 job A: the floor is SETTLED_AT, not WORN_AT', () => {
  assert.equal(DEPLOY_FLOOR, SETTLED_AT);
  assert.equal(DEPLOY_FLOOR, 67);
  assert.notEqual(DEPLOY_FLOOR, WORN_AT);
});

test('AGENT-5 job A: the floor IS the line the hysteresis lets go at', () => {
  // The claim the whole job rests on. A man whose record last said 'worn' is
  // still worn at every reserve below the floor — so seating him is seating
  // somebody the session stop rule pulls after one hand — and is fresh at it.
  for (let left = 0; left < DEPLOY_FLOOR; left++) {
    assert.equal(staminaStage(left, 'worn'), 'worn', `reserve ${left} should still be worn`);
    assert.ok(restDeficit(left) > 0, `reserve ${left} should be under the floor`);
  }
  assert.equal(staminaStage(DEPLOY_FLOOR, 'worn'), 'fresh');
  assert.equal(restDeficit(DEPLOY_FLOOR), 0);
});

test('AGENT-5 job A: at or above the floor there is no refusal at all', () => {
  for (const left of [67, 68, 80, 100]) {
    assert.equal(restRefusal({ left, nature: 'Rock' }), null);
    assert.equal(restPlan({ left }).ok, true);
  }
});

// ── the two remedies, in numbers ────────────────────────────────────────────

test('AGENT-5 job A: from empty it is three snacks — ceil(67 / 25)', () => {
  assert.equal(restDeficit(0), 67);
  assert.equal(snacksFor(67), 3);
  assert.equal(snacksFor(67), Math.ceil(DEPLOY_FLOOR / SNACK_STAMINA));
  assert.equal(restPlan({ left: 0 }).snacksNeeded, 3);
  assert.equal(restPlan({ left: 0 }).kind, 'food');
});

test('AGENT-5 job A: from empty it is about three hours — 67 / 22', () => {
  const h = hoursFor(restDeficit(0));
  assert.equal(h, 67 / RECOVER_PER_HOUR);
  assert.ok(h > 3 && h < 3.1, `expected just over three hours, got ${h}`);
  assert.equal(hoursPhrase(h), 'about three hours');
});

test('AGENT-5 job A: two snacks leave him short, which is the bug in one line', () => {
  // 2 × 25 = 50, and 50 < 67. The hysteresis still has him. This is exactly
  // what an owner who fed him twice and redeployed him saw.
  assert.ok(2 * SNACK_STAMINA < DEPLOY_FLOOR);
  assert.equal(staminaStage(2 * SNACK_STAMINA, 'worn'), 'worn');
  assert.equal(restRefusal({ left: 50, nature: 'Rock' }) === null, false);
});

test('AGENT-5 job A: sleep wins a short wait, food wins a long one', () => {
  // The cut is REST_WINS_HOURS, which at 22/hour lands at a reserve of 23.
  const cut = DEPLOY_FLOOR - REST_WINS_HOURS * RECOVER_PER_HOUR;
  assert.equal(cut, 23);
  assert.equal(restPlan({ left: cut }).kind, 'rest');
  assert.equal(restPlan({ left: cut - 1 }).kind, 'food');
  assert.equal(restPlan({ left: 66 }).kind, 'rest');
  assert.equal(restPlan({ left: 0 }).kind, 'food');
});

// ── the sentence ────────────────────────────────────────────────────────────

test('AGENT-5 job A: a nit and a maniac phrase the same refusal differently', () => {
  const seen = new Map();
  for (const nature of VOICED_NATURES) {
    for (const left of [0, 30]) {
      const r = restRefusal({ left, nature });
      const key = `${left}:${r.message}`;
      assert.ok(!seen.has(key), `${seen.get(key)} and ${nature} say the same thing at ${left}`);
      seen.set(key, nature);
    }
  }
});

test('AGENT-5 job A: every refusal says the number out loud', () => {
  for (const nature of VOICED_NATURES) {
    const food = restRefusal({ left: 0, snacks: 9, nature });
    assert.match(food.message, /three snacks/i, `${nature} did not name the snacks`);
    const rest = restRefusal({ left: 30, nature });
    assert.match(rest.message, /a couple of hours/i, `${nature} did not name the wait`);
  }
});

test('AGENT-5 job A: the line comes out of NATURE_WANT_LINES, not out of here', () => {
  for (const nature of VOICED_NATURES) {
    const food = restRefusal({ left: 0, snacks: 9, nature });
    assert.ok(food.message.startsWith(NATURE_WANT_LINES[nature].food), nature);
    const rest = restRefusal({ left: 30, nature });
    assert.ok(rest.message.startsWith(NATURE_WANT_LINES[nature].turn_in), nature);
  }
});

test('AGENT-5 job A: the door does not use the seated rest line', () => {
  // "Get me off this felt" said by a man standing in his own kitchen is the
  // class of on-screen lie job I is about. `turn_in` exists for this.
  const r = restRefusal({ left: 30, nature: 'Hothead' });
  assert.ok(!r.message.includes('felt'), r.message);
  assert.ok(r.message.startsWith(NATURE_WANT_LINES.Hothead.turn_in));
});

test('AGENT-5 job A: an agent with no nature keeps the number and loses the voice', () => {
  const r = restRefusal({ left: 0, snacks: 9, nature: null });
  assert.equal(r.message, 'Three snacks should do it.');
  assert.equal(r.snacksNeeded, 3);
});

// ── job B · the refusal carries the fix ─────────────────────────────────────

test('AGENT-5 job B: the refusal carries LIFE-2 action and actionLabel', () => {
  const food = restRefusal({ left: 0, snacks: 9, nature: 'Rock' });
  assert.equal(food.action, 'feed');
  assert.equal(food.actionLabel, ACTION_LABELS.feed);
  assert.equal(food.item, 'snack');

  const rest = restRefusal({ left: 30, nature: 'Rock' });
  assert.equal(rest.action, 'rest');
  assert.equal(rest.actionLabel, ACTION_LABELS.rest);
  assert.equal(rest.item, null);
});

test('AGENT-5 job B: an empty fridge says so and names what to buy', () => {
  const r = restRefusal({ left: 0, snacks: 0, nature: 'Rock' });
  assert.equal(r.outOfStock, true);
  assert.equal(r.needs, 'stock');
  assert.equal(r.item, 'snack');
  assert.equal(r.snacksNeeded, 3);
  assert.match(r.message, /nothing in/);
  assert.match(r.message, /three snacks/i);
  // Still the feed verb: the thing he wants has not changed, only where it
  // has to come from.
  assert.equal(r.action, 'feed');
});

test('AGENT-5 job B: a half-stocked shelf is still out of stock for this ask', () => {
  // Two on the shelf and three needed. Telling him to open the fridge would be
  // telling him to do the thing that has already failed twice.
  const r = restRefusal({ left: 0, snacks: 2, nature: 'Rock' });
  assert.equal(r.outOfStock, true);
  assert.equal(r.stock, 2);
  assert.equal(r.snacksNeeded, 3);
  const enough = restRefusal({ left: 0, snacks: 3, nature: 'Rock' });
  assert.equal(enough.outOfStock, undefined);
  assert.equal(enough.needs, null);
});

test('AGENT-5 job B: the refusal reports the reserve and the floor it missed', () => {
  const r = restRefusal({ left: 41.4, snacks: 0 });
  assert.equal(r.stamina.floor, DEPLOY_FLOOR);
  assert.equal(r.stamina.left, 41.4);
  assert.equal(r.stamina.deficit, restDeficit(41.4));
  assert.equal(r.error, 'agentSpent');
});

// ── the small words ─────────────────────────────────────────────────────────

test('AGENT-5 job A: numbers are spoken, not printed', () => {
  assert.equal(countWord(3), 'three');
  assert.equal(snackPhrase(1), 'one snack');
  assert.equal(snackPhrase(3), 'three snacks');
  assert.equal(hoursPhrase(0.3), 'half an hour');
  assert.equal(hoursPhrase(1), 'an hour');
  assert.equal(hoursPhrase(2), 'a couple of hours');
  assert.equal(hoursPhrase(4), 'about four hours');
});
