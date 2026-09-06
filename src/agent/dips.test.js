// src/agent/dips.test.js — SERVER-5 job 1
//
// The five rules in dips.js's header, asserted. The two that matter most are
// the ones that are easy to break later without noticing:
//
//   · the total is capped at DIP_MAX no matter how many states he is in, and
//     the deltas on the wire still add up to exactly what was applied;
//   · a missing timestamp is not a timestamp. `Number(null) === 0` made every
//     agent who had never been handed a snack read as last fed in 1970, which
//     is a permanent −10 on two attributes for the crime of existing.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  dipsFor, dipCauses, dipTotals, applyDips, dipLine, dipReasons, dipDepth, hungerMs,
  DIP_MIN, DIP_MAX, DIP_ATTRS, HUNGER_MS, TILT_HEAT, DIP_LINES,
} from './dips.js';

const now = 1_700_000_000_000;
const hours = (n) => n * 60 * 60_000;

// ── No state, no dip ────────────────────────────────────────────────────────

test('a fresh, fed, level agent dips nothing', () => {
  assert.deepEqual(dipsFor({ fatigue: 'fresh', stamina: 60, heat: 20, now }), []);
  assert.equal(dipLine([]), null);
});

test('settled is not worn — only the bottom stage dips', () => {
  assert.deepEqual(dipsFor({ fatigue: 'settled', stamina: 50, now }), []);
});

test('heat one point under the line does not dip', () => {
  assert.deepEqual(dipsFor({ heat: TILT_HEAT - 1, now }), []);
  assert.equal(dipsFor({ heat: TILT_HEAT, now }).length, DIP_ATTRS.length);
});

// ── The band ────────────────────────────────────────────────────────────────

test('crossing a threshold costs DIP_MIN, the bottom of a state costs DIP_MAX', () => {
  assert.equal(dipDepth(0), DIP_MIN);
  assert.equal(dipDepth(1), DIP_MAX);
  // heat exactly at the line is the cheapest tilt there is; heat 100 the worst.
  assert.equal(dipCauses({ heat: TILT_HEAT, now })[0].delta, DIP_MIN);
  assert.equal(dipCauses({ heat: 100, now })[0].delta, DIP_MAX);
  // A man with STAMINA left in him is less hurt by being worn than one without.
  assert.equal(dipCauses({ fatigue: 'worn', stamina: 100, now })[0].delta, DIP_MIN);
  assert.equal(dipCauses({ fatigue: 'worn', stamina: 0, now })[0].delta, DIP_MAX);
});

test('both attributes are dipped, by the same amount, and nothing else is', () => {
  const dips = dipsFor({ fatigue: 'worn', stamina: 100, now });
  assert.deepEqual(dips.map((d) => d.attr).sort(), [...DIP_ATTRS].sort());
  assert.deepEqual(dipTotals(dips), { DISCIPLINE: DIP_MIN, FOCUS: DIP_MIN });

  const attrs = { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 };
  const after = applyDips(attrs, dips);
  assert.equal(after.FOCUS, 45);
  assert.equal(after.DISCIPLINE, 45);
  assert.equal(after.READS, 50);
  assert.equal(after.COMPOSURE, 50);
  assert.equal(after.DECEPTION, 50);
  assert.equal(after.STAMINA, 50);
  // Pure: the input is not touched.
  assert.equal(attrs.FOCUS, 50);
});

test('applyDips never takes an attribute below zero', () => {
  const after = applyDips({ FOCUS: 3, DISCIPLINE: 0 }, dipsFor({ heat: 100, now }));
  assert.equal(after.FOCUS, 0);
  assert.equal(after.DISCIPLINE, 0);
});

// ── Rule 3: five to ten, TOTAL ──────────────────────────────────────────────

test('three states at once still cost at most DIP_MAX per attribute', () => {
  const dips = dipsFor({
    fatigue: 'worn',
    stamina: 0,
    heat: 100,
    snackRefusedAt: now - hours(96),
    now,
  });
  const totals = dipTotals(dips);
  assert.equal(totals.DISCIPLINE, DIP_MAX);
  assert.equal(totals.FOCUS, DIP_MAX);
});

test('the deepest reason is served first and the wire adds up to what was applied', () => {
  // worn at STAMINA 30 → 9; tilted at heat 95 → 9 (worn wins the tie); hungry
  // at 40 hours → 7 and never gets a look in, because the budget is spent.
  const dips = dipsFor({ fatigue: 'worn', stamina: 30, heat: 95, snackRefusedAt: now - hours(40), now });
  assert.deepEqual(dipReasons(dips), ['worn', 'tilted']);
  assert.deepEqual(dips.filter((d) => d.attr === 'DISCIPLINE').map((d) => d.delta), [-9, -1]);
  assert.deepEqual(dipTotals(dips), { DISCIPLINE: DIP_MAX, FOCUS: DIP_MAX });
});

test('a truncated reason is dropped rather than listed at zero', () => {
  const dips = dipsFor({ fatigue: 'worn', stamina: 0, heat: 100, now });
  assert.deepEqual(dipReasons(dips), ['worn']);
  assert.ok(dips.every((d) => d.delta !== 0));
});

// ── Hunger ──────────────────────────────────────────────────────────────────

test('hunger needs a refusal — an agent nobody ever fed is not hungry', () => {
  assert.equal(hungerMs({ now }), null);
  assert.equal(hungerMs({ lastSnackAt: null, snackRefusedAt: null, now }), null);
  assert.deepEqual(dipsFor({ now }), []);
});

test('a missing lastSnackAt is not epoch zero', () => {
  // The bug this test is named after: Number(null) is 0, so "never fed" read as
  // "last fed in 1970" and every agent walked in starving.
  assert.equal(hungerMs({ lastSnackAt: null, snackRefusedAt: now - hours(1), now }), null);
  assert.equal(hungerMs({ lastSnackAt: null, snackRefusedAt: now - hours(40), now }), hours(40));
});

test('a snack inside the day answers the hunger', () => {
  const refused = now - hours(40);
  assert.equal(hungerMs({ lastSnackAt: now - hours(2), snackRefusedAt: refused, now }), null);
  // Fed BEFORE the refusal and a day ago: still hungry, and the clock runs
  // from the meal rather than from the no.
  assert.equal(hungerMs({ lastSnackAt: now - hours(50), snackRefusedAt: refused, now }), hours(50));
});

test('hunger starts at a day and bottoms out at three', () => {
  assert.equal(hungerMs({ snackRefusedAt: now - HUNGER_MS + 1, now }), null);
  assert.equal(dipCauses({ snackRefusedAt: now - hours(24), now })[0].delta, DIP_MIN);
  assert.equal(dipCauses({ snackRefusedAt: now - hours(72), now })[0].delta, DIP_MAX);
  assert.equal(dipCauses({ snackRefusedAt: now - hours(720), now })[0].delta, DIP_MAX);
});

// ── Rules 1 and 4 ───────────────────────────────────────────────────────────

test('the same state produces the same dip twice', () => {
  const state = { fatigue: 'worn', stamina: 41, heat: 83, snackRefusedAt: now - hours(30), now };
  assert.deepEqual(dipsFor(state), dipsFor(state));
});

test('every dip names a reason from the closed list, and he says one line', () => {
  // Both at the bottom of their state, so the tie is broken by DIP_REASONS and
  // the line he gives is the first one a person would say.
  const dips = dipsFor({ fatigue: 'worn', stamina: 0, heat: 100, now });
  assert.ok(dips.every((d) => Object.keys(DIP_LINES).includes(d.why)));
  assert.equal(dipLine(dips), DIP_LINES.worn);
  assert.equal(dipLine(dipsFor({ heat: 99, now })), DIP_LINES.tilted);
  assert.equal(dipLine(dipsFor({ snackRefusedAt: now - hours(30), now })), DIP_LINES.hungry);
});

test('a garbage dip list changes nothing', () => {
  const attrs = { FOCUS: 50, DISCIPLINE: 50 };
  assert.equal(applyDips(attrs, null), attrs);
  assert.equal(applyDips(attrs, []), attrs);
  assert.deepEqual(applyDips(attrs, [{ attr: 'BLUFF', delta: -50, why: 'nonsense' }]), attrs);
  assert.deepEqual(dipReasons(null), []);
});
