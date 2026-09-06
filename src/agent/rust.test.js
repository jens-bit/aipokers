// src/agent/rust.test.js — SERVER-5 job 2
//
// The five rules in rust.js's header, and one of them matters more than the
// rest: RUST CANNOT TAKE ANYTHING HE CAME WITH. Every other decay mechanic in
// this genre is remembered for punishing absence, and `born` as a hard floor
// is the single line of arithmetic that keeps this one from being that.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyRust, rustFor, rustDueAt, bornValue, lastUsedAt, rustCause, noteExercised,
  RUST_IDLE_MS, RUST_STEP_MS,
} from './rust.js';
import { ATTR_KEYS, ensureAttributes, applySessionGrowth } from './attributes.js';

const DAY = 24 * 60 * 60_000;
const NOW = 1_700_000_000_000;

// An agent who was born at 50 across the board and has since earned a few
// points, with every skill last exercised `usedAgo` ago.
function grown({ attrs = {}, born = {}, usedAgo = 0, rusted = null } = {}) {
  const agent = ensureAttributes({
    id: 'him',
    name: 'GRANITE',
    bornAt: NOW - 400 * DAY,
    attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50, ...attrs },
    attrsBorn: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50, ...born },
    attrLog: [],
  });
  agent.attrUsedAt = Object.fromEntries(ATTR_KEYS.map((k) => [k, NOW - usedAgo]));
  if (rusted) agent.attrRustedAt = rusted;
  return agent;
}

// ── Rule 1: the floor ───────────────────────────────────────────────────────

test('SERVER-5: an agent who never grew a point can never rust one', () => {
  const agent = grown({ usedAgo: 400 * DAY });   // idle for over a year
  assert.deepEqual(applyRust(agent, { now: NOW }), []);
  assert.equal(agent.attrs.READS, 50);
  assert.deepEqual(agent.attrLog, [], 'and nothing is written about nothing happening');
});

test('SERVER-5: rust stops at born and never goes under it', () => {
  const agent = grown({ attrs: { READS: 53 }, usedAgo: 400 * DAY });
  const drifted = applyRust(agent, { now: NOW });
  assert.equal(agent.attrs.READS, 50, 'the three he earned, and not one more');
  assert.equal(drifted.filter((d) => d.key === 'READS').length, 3);

  // And again a year later: there is nothing left to take.
  assert.deepEqual(applyRust(agent, { now: NOW + 400 * DAY }), []);
  assert.equal(agent.attrs.READS, 50);
});

test('SERVER-5: born is read off the record, and an unknown birth takes nothing', () => {
  const agent = grown({ attrs: { FOCUS: 70 }, born: { FOCUS: 61 } });
  assert.equal(bornValue(agent, 'FOCUS'), 61);
  // No attrsBorn at all: his current value stands in, so nothing is earned and
  // nothing can be taken back.
  const unknown = { attrs: { FOCUS: 70 } };
  assert.equal(bornValue(unknown, 'FOCUS'), 70);
  assert.equal(rustFor(unknown, 'FOCUS', { now: NOW }), null);
});

test('SERVER-5: ensureAttributes recovers born from the attrLog', () => {
  const agent = ensureAttributes({
    attrs: { READS: 58, FOCUS: 44, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    attrLog: [
      { ts: 1, key: 'READS', from: 51, to: 51, cause: 'birth' },
      { ts: 2, key: 'READS', from: 51, to: 52, cause: 'read an opponent well enough to act on it.' },
      // No birth anchor for FOCUS — the oldest entry's `from` is where it stood.
      { ts: 3, key: 'FOCUS', from: 40, to: 41, cause: '120 decisions, and the arithmetic held.' },
    ],
  });
  assert.equal(agent.attrsBorn.READS, 51);
  assert.equal(agent.attrsBorn.FOCUS, 40);
  // Never mentioned in the log: his current value.
  assert.equal(agent.attrsBorn.STAMINA, 50);
});

// ── Rule 2: a fortnight of grace, then a point a week ───────────────────────

test('SERVER-5: nothing rusts inside the fortnight', () => {
  const agent = grown({ attrs: { READS: 60 }, usedAgo: RUST_IDLE_MS - 1 });
  assert.deepEqual(applyRust(agent, { now: NOW }), []);
  assert.equal(agent.attrs.READS, 60);
});

test('SERVER-5: the first point lands the day the fortnight is up', () => {
  const agent = grown({ attrs: { READS: 60 }, usedAgo: RUST_IDLE_MS });
  const drifted = applyRust(agent, { now: NOW });
  assert.equal(drifted.length, 1);
  assert.equal(agent.attrs.READS, 59);
});

test('SERVER-5: and one more per week after it', () => {
  for (const [weeks, expected] of [[0, 1], [1, 2], [2, 3], [6, 7]]) {
    const agent = grown({ attrs: { READS: 70 }, usedAgo: RUST_IDLE_MS + weeks * RUST_STEP_MS });
    assert.equal(applyRust(agent, { now: NOW }).length, expected, `${weeks} further week(s)`);
    assert.equal(agent.attrs.READS, 70 - expected);
  }
});

test('SERVER-5: the due-dates are week boundaries, oldest first', () => {
  const due = rustDueAt(NOW - RUST_IDLE_MS - 2 * RUST_STEP_MS, { now: NOW });
  assert.equal(due.length, 3);
  assert.deepEqual(due, [NOW - 2 * RUST_STEP_MS, NOW - RUST_STEP_MS, NOW]);
  assert.deepEqual(rustDueAt(null, { now: NOW }), []);
});

// ── Rule 3: per skill ───────────────────────────────────────────────────────

test('SERVER-5: he rusts at the thing he stopped doing, and only at that', () => {
  const agent = grown({ attrs: { READS: 60, FOCUS: 60 } });
  agent.attrUsedAt = { ...agent.attrUsedAt, READS: NOW - 40 * DAY };   // FOCUS is current
  const drifted = applyRust(agent, { now: NOW });
  assert.ok(drifted.length > 0);
  assert.ok(drifted.every((d) => d.key === 'READS'));
  assert.equal(agent.attrs.FOCUS, 60, 'a skill he uses every night does not rust');
});

// ── Rules 4 and 5: the ledger line, and catching up ─────────────────────────

test('SERVER-5: every point is a ledger line with a cause, dated when it was due', () => {
  const agent = grown({ attrs: { READS: 60 }, usedAgo: RUST_IDLE_MS + 2 * RUST_STEP_MS });
  const drifted = applyRust(agent, { now: NOW });
  assert.equal(drifted.length, 3);
  assert.deepEqual(drifted.map((d) => d.cause), Array(3).fill('getting rusty at reads.'));
  assert.deepEqual(drifted.map((d) => [d.from, d.to]), [[60, 59], [59, 58], [58, 57]]);
  // Dated at the week boundaries, oldest first, so a sparkline shows a drift
  // rather than a cliff on the day somebody happened to look.
  assert.deepEqual(drifted.map((d) => d.ts), [
    NOW - 2 * RUST_STEP_MS, NOW - RUST_STEP_MS, NOW,
  ]);
  assert.equal(agent.attrLog.length, 3);
  assert.equal(agent.attrLog[0].cause, 'getting rusty at reads.');
  assert.equal(rustCause('COMPOSURE'), 'getting rusty at taking a beat.');
});

test('SERVER-5: asking twice in a day finds nothing the second time', () => {
  const agent = grown({ attrs: { READS: 60 }, usedAgo: RUST_IDLE_MS + RUST_STEP_MS });
  assert.equal(applyRust(agent, { now: NOW }).length, 2);
  assert.deepEqual(applyRust(agent, { now: NOW }), []);
  assert.deepEqual(applyRust(agent, { now: NOW + RUST_STEP_MS - 1 }), []);
  assert.equal(applyRust(agent, { now: NOW + RUST_STEP_MS }).length, 1, 'and one more a week later');
  assert.equal(agent.attrs.READS, 57);
});

test('SERVER-5: a month with the process down is four points, not one', () => {
  const agent = grown({ attrs: { READS: 70 }, usedAgo: RUST_IDLE_MS });
  // Nobody asked for 21 days, then somebody did.
  const drifted = applyRust(agent, { now: NOW + 21 * DAY });
  assert.equal(drifted.length, 4);
  assert.equal(agent.attrs.READS, 66);
});

// ── The stamp ───────────────────────────────────────────────────────────────

test('SERVER-5: a session that exercised a skill restarts its fortnight', () => {
  const agent = grown({ attrs: { READS: 60 }, usedAgo: RUST_IDLE_MS + RUST_STEP_MS });
  applyRust(agent, { now: NOW });
  assert.equal(agent.attrs.READS, 58);

  noteExercised(agent, ['READS'], { now: NOW });
  assert.equal(lastUsedAt(agent, 'READS'), NOW);
  assert.equal(agent.attrRustedAt.READS, undefined, 'the old rust stamp goes with it');
  assert.deepEqual(applyRust(agent, { now: NOW + RUST_IDLE_MS - 1 }), [],
    'and he gets the whole fortnight again');
});

test('SERVER-5: applySessionGrowth stamps every skill the session gave evidence for', () => {
  const agent = grown({ attrs: { READS: 60 }, usedAgo: 30 * DAY });
  const res = applySessionGrowth(agent, {
    evidence: { hands: 40, readsFormed: 2, tiltSurvived: 0, deviationsResisted: 0, bluffsThrough: 0, misjudgmentsAvoided: 0 },
    handsPlayed: 40,
    now: NOW,
  });
  assert.deepEqual([...res.exercised].sort(), ['READS', 'STAMINA']);
  assert.equal(agent.attrUsedAt.READS, NOW);
  assert.equal(agent.attrUsedAt.STAMINA, NOW);
  // Evidence, not growth: READS was exercised whether or not the point landed.
  assert.notEqual(agent.attrUsedAt.COMPOSURE, NOW);
});

test('SERVER-5: an agent who has never played dates from his birth, not from epoch', () => {
  const agent = grown({ attrs: { READS: 60 } });
  delete agent.attrUsedAt;
  assert.equal(lastUsedAt(agent, 'READS'), agent.bornAt);
  // Born 400 days ago and never deployed: he rusts back to born and stops.
  applyRust(agent, { now: NOW });
  assert.equal(agent.attrs.READS, 50);

  // And one with no birth on the record at all cannot be rusted by a clock
  // nobody can read.
  const undated = { attrs: { READS: 60 }, attrsBorn: { READS: 50 } };
  assert.equal(lastUsedAt(undated, 'READS'), null);
  assert.deepEqual(applyRust(undated, { now: NOW }), []);
});

test('SERVER-5: garbage in, nothing out', () => {
  assert.deepEqual(applyRust(null, { now: NOW }), []);
  assert.equal(rustFor({}, 'READS', { now: NOW }), null);
  assert.equal(rustFor(grown(), 'NONSENSE', { now: NOW }), null);
  assert.equal(noteExercised(grown(), []), null);
});
