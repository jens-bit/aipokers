// src/agent/tokenEstimate.test.js — COST-2

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { estimateTokens, median, percentile } from './tokenEstimate.js';

test('estimateTokens is chars/4, rounded up', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
  assert.equal(estimateTokens('a'.repeat(400)), 100);
});

test('estimateTokens is defensive about non-strings', () => {
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
  assert.equal(estimateTokens(42), 0);
});

test('median of an odd and even list', () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), 0);
});

test('percentile at the extremes and the middle', () => {
  const xs = [10, 20, 30, 40, 50];
  assert.equal(percentile(xs, 0), 10);
  assert.equal(percentile(xs, 100), 50);
  assert.equal(percentile(xs, 50), 30);
});
