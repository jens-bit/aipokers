// src/agent/fixtures/sampleGameStates.test.js — COST-2

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sampleGameStates } from './sampleGameStates.js';

test('the same seed deals the same spots, every time', () => {
  const a = sampleGameStates(50, 7);
  const b = sampleGameStates(50, 7);
  assert.deepEqual(a, b);
});

test('a different seed deals a different deck', () => {
  const a = sampleGameStates(50, 7);
  const b = sampleGameStates(50, 8);
  assert.notDeepEqual(a, b);
});

test('covers every street', () => {
  const spots = sampleGameStates(200, 42);
  const streets = new Set(spots.map((gs) => gs.street));
  assert.deepEqual([...streets].sort(), ['flop', 'preflop', 'river', 'turn']);
});

test('covers priced and free decisions, policy and no-policy, moody and level', () => {
  const spots = sampleGameStates(200, 42);
  assert.ok(spots.some((gs) => gs.toCall > 0), 'at least one priced spot');
  assert.ok(spots.some((gs) => gs.toCall === 0), 'at least one free spot');
  assert.ok(spots.some((gs) => gs.policy === null), 'at least one spot with no policy block');
  assert.ok(spots.some((gs) => gs.mood.state !== 'neutral'), 'at least one non-neutral mood');
  assert.ok(spots.some((gs) => gs.tableTalk), 'at least one needled spot');
  assert.ok(spots.some((gs) => gs.opponentReads.length > 0), 'at least one spot carrying a read');
});
