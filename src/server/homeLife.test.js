// src/server/homeLife.test.js — LIFE-1 job 1
//
// "I've never seen an agent sleep once. Every time I come home they just stand
// around." Every test in this file is one clause of that finding, turned into
// something that fails on the old behaviour.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Routine, ROUTINE_LABELS, routineFor, idleRoutine, idleCycle,
  spreadIdleRoutines, isEating, isCelebrating,
  EATING_MS, CELEBRATE_MS, IDLE_PHASE_MS, SULK_HEAT, Where,
} from './home.js';

const NOW = 1_700_000_000_000;

// ── The four states that could not be reached before ────────────────────────

test('LIFE-1: worn makes him sleep', () => {
  assert.equal(routineFor({ id: 'a', nature: 'Rock', fatigue: 'worn', now: NOW }).key, Routine.SLEEPS);
});

test('LIFE-1: hunger answered makes him eat, and only for as long as it takes', () => {
  const at = (ms) => routineFor({ id: 'a', nature: 'Rock', fedAt: NOW - ms, now: NOW }).key;
  assert.equal(at(0), Routine.EATS);
  assert.equal(at(EATING_MS - 1), Routine.EATS);
  assert.notEqual(at(EATING_MS + 1), Routine.EATS, 'he does not eat all afternoon');
  // An agent nobody has ever fed is not eating, and a clock that went backwards
  // does not start him eating either.
  assert.equal(isEating(null, NOW), false);
  assert.equal(isEating(NOW + 60_000, NOW), false);
});

test('LIFE-1: a win makes him celebrate, a loss does not', () => {
  const up = { pnl: 900, endedAt: NOW - 60_000, now: NOW };
  const down = { pnl: -900, endedAt: NOW - 60_000, now: NOW };
  assert.equal(isCelebrating(up), true);
  assert.equal(isCelebrating(down), false);
  assert.equal(isCelebrating({ pnl: 0, endedAt: NOW, now: NOW }), false, 'breaking even is not a win');
  assert.equal(isCelebrating({ pnl: 900, endedAt: NOW - CELEBRATE_MS - 1, now: NOW }), false);
  assert.equal(
    routineFor({ id: 'a', nature: 'Rock', celebrating: true, now: NOW }).key,
    Routine.CELEBRATES);
});

test('LIFE-1: tilt makes him sulk, not just being broke', () => {
  // The old ladder had SULKS on `broke` alone, so the one state an owner most
  // wants to see was invisible the moment he stood up from the felt.
  assert.equal(routineFor({ id: 'a', nature: 'Rock', tilted: true, now: NOW }).key, Routine.SULKS);
  assert.equal(routineFor({ id: 'a', nature: 'Rock', broke: true, now: NOW }).key, Routine.SULKS);
  assert.ok(SULK_HEAT > 0 && SULK_HEAT <= 100, 'the threshold is a real heat');
});

test('LIFE-1: every routine key has a label, including the new ones', () => {
  for (const key of Object.values(Routine)) {
    assert.ok(ROUTINE_LABELS[key], `${key} has no label`);
  }
  assert.equal(ROUTINE_LABELS[Routine.EATS], 'eating');
  assert.equal(ROUTINE_LABELS[Routine.CELEBRATES], 'celebrating');
});

test('LIFE-1: the new states sit in the documented order', () => {
  const base = { id: 'a', nature: 'Rock', now: NOW };
  // A deliberate owner act still outranks everything standing.
  assert.equal(routineFor({ ...base, studying: true, fedAt: NOW, celebrating: true }).key, Routine.TAPE);
  // You fed him a minute ago; he is not shown asleep with a sandwich in hand.
  assert.equal(routineFor({ ...base, fedAt: NOW, fatigue: 'worn', tilted: true }).key, Routine.EATS);
  // The win is louder than the heat it came with.
  assert.equal(routineFor({ ...base, celebrating: true, tilted: true }).key, Routine.CELEBRATES);
  // And a mood still beats being tired.
  assert.equal(routineFor({ ...base, tilted: true, fatigue: 'worn' }).key, Routine.SULKS);
  // Cards in his hands beat all of it.
  assert.equal(routineFor({ ...base, atHomeTable: true, fedAt: NOW, celebrating: true, tilted: true }).key,
    Routine.PLAYS);
});

// ── The room moves ──────────────────────────────────────────────────────────

test('LIFE-1: an idle agent does not hold one pose forever', () => {
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    seen.add(routineFor({ id: 'a', nature: 'Rock', now: NOW + i * IDLE_PHASE_MS }).key);
  }
  assert.ok(seen.size > 1, 'the room changed at some point in the evening');
});

test('LIFE-1: but he only ever does one of HIS OWN things', () => {
  for (const nature of ['Hothead', 'Rock', 'Shark', 'Grinder', 'Professor', 'Showman', 'Gambler', 'Sphinx']) {
    const cycle = idleCycle(nature);
    for (let i = 0; i < 12; i++) {
      const key = idleRoutine({ id: 'x', nature, now: NOW + i * IDLE_PHASE_MS });
      assert.ok(cycle.includes(key), `${nature} would not ${key}`);
    }
    // His signature habit is still the one he is in most of the time.
    const signature = cycle[0];
    const count = cycle.filter((k) => k === signature).length;
    assert.equal(count, 2, `${nature}'s own habit should hold half the cycle`);
  }
});

test('LIFE-1: an agent with no nature still has something to do', () => {
  const key = idleRoutine({ id: 'z', nature: null, now: NOW });
  assert.ok(idleCycle(null).includes(key));
});

test('LIFE-1: pure — the same agent at the same instant reads the same twice', () => {
  const state = { id: 'a', nature: 'Gambler', now: NOW };
  const first = routineFor(state);
  for (let i = 0; i < 20; i++) assert.deepEqual(routineFor(state), first);
});

// ── Never all the same thing at once ────────────────────────────────────────

test('LIFE-1: a household of identical natures is never one pose four times', () => {
  // The exact shape of the complaint: four Rocks, all idle, all home. Before
  // the spread they were four identical readers at every instant forever.
  const roster = ['a', 'b', 'c', 'd'].map((id) => ({
    id, nature: 'Rock', routine: routineFor({ id, nature: 'Rock', now: NOW }),
  }));
  const spread = spreadIdleRoutines(roster, { now: NOW });
  const keys = spread.map((p) => p.routine.key);
  assert.ok(new Set(keys).size >= 3,
    `four idle Rocks should be doing at least three different things, got ${keys.join(', ')}`);
  // And each of them is still doing one of a Rock's things.
  for (const key of keys) assert.ok(idleCycle('Rock').includes(key), key);
});

test('LIFE-1: the spread never moves a state routine', () => {
  // Two worn agents are both asleep. Shuffling one of them awake to make the
  // picture livelier would be a lie about him.
  const roster = [
    { id: 'a', nature: 'Rock', routine: { key: Routine.SLEEPS, label: ROUTINE_LABELS[Routine.SLEEPS] } },
    { id: 'b', nature: 'Rock', routine: { key: Routine.SLEEPS, label: ROUTINE_LABELS[Routine.SLEEPS] } },
    { id: 'c', nature: 'Rock', routine: { key: Routine.SULKS, label: ROUTINE_LABELS[Routine.SULKS] } },
    { id: 'd', nature: 'Rock', routine: { key: Routine.SULKS, label: ROUTINE_LABELS[Routine.SULKS] } },
  ];
  const keys = spreadIdleRoutines(roster, { now: NOW }).map((p) => p.routine.key);
  assert.deepEqual(keys, [Routine.SLEEPS, Routine.SLEEPS, Routine.SULKS, Routine.SULKS]);
});

test('LIFE-1: the spread keeps label and key in step', () => {
  const roster = ['a', 'b', 'c'].map((id) => ({
    id, nature: 'Grinder', routine: routineFor({ id, nature: 'Grinder', now: NOW }),
  }));
  for (const p of spreadIdleRoutines(roster, { now: NOW })) {
    assert.equal(p.routine.label, ROUTINE_LABELS[p.routine.key]);
  }
});

test('LIFE-1: the spread survives a malformed roster', () => {
  assert.deepEqual(spreadIdleRoutines(null, { now: NOW }), []);
  const rough = [null, { id: 'a' }, { id: 'b', routine: {} }];
  assert.equal(spreadIdleRoutines(rough, { now: NOW }).length, 3);
});

test('LIFE-1: a routine is still a HOME thing', () => {
  assert.equal(routineFor({ id: 'a', nature: 'Rock', where: Where.TABLE, fatigue: 'worn', now: NOW }), null);
  assert.equal(routineFor({ id: 'a', nature: 'Rock', where: Where.CASINO, tilted: true, now: NOW }), null);
});
