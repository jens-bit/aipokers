// src/agent/handler.test.js — COST-2
//
// The prompt builders and the token estimate, in isolation. The decision call
// itself (parse, validate, route through providers) has coverage via the
// scripts that spawn under test:e2e; this file is about what goes OUT before
// anything is sent — job 1's measurement and job 2's trim both stand on it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildSystem, buildUserPrompt, estimateCallTokens, getAgentAction } from './handler.js';
import { chooseFromPolicy } from './policyPlay.js';
import { sampleGameStates } from './fixtures/sampleGameStates.js';

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === null) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('buildSystem always carries the JSON contract and the strategy', () => {
  const sys = buildSystem('Play like a rock.', '\nMemory: he folds a lot.');
  assert.match(sys, /Play like a rock\./);
  assert.match(sys, /Memory: he folds a lot\./);
  assert.match(sys, /"action"/);
});

test('buildUserPrompt carries the hand — street, cards, pot, legal actions', () => {
  const [gs] = sampleGameStates(1, 1);
  const prompt = buildUserPrompt(gs);
  assert.match(prompt, new RegExp(gs.street.toUpperCase()));
  assert.match(prompt, /HOLE CARDS:/);
  assert.match(prompt, /LEGAL ACTIONS:/);
});

test('estimateCallTokens is pure and touches no model', () => {
  const [gs] = sampleGameStates(1, 2);
  const est = estimateCallTokens(gs, 'Play tight.', '');
  assert.ok(est.staticTokens > 0);
  assert.ok(est.dynamicTokens > 0);
  assert.equal(typeof est.system, 'string');
  assert.equal(typeof est.userPrompt, 'string');
});

test('estimateCallTokens agrees with getAgentAction\'s fallback path — same prompt, no key needed', async () => {
  await withEnv({ ANTHROPIC_API_KEY: null, AI_PROVIDER: null }, async () => {
    const [gs] = sampleGameStates(1, 3);
    const est = estimateCallTokens(gs, '', '');
    const result = await getAgentAction(gs, '', '');
    // BUG-261: no key → the compiled policy, not a thrown error, and no usage
    // to bill — but the estimate above still had to be computable beforehand.
    assert.deepEqual(result.action, chooseFromPolicy(gs).action);
    assert.equal(result.fallback.reason, 'unconfigured');
    assert.equal(result.usage, undefined);
    assert.ok(est.staticTokens > 0);
  });
});
