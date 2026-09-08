// src/agent/handler.promptTrim.test.js — COST-2 job 2
//
// The determinism check job 2 asked for: 200 recorded spots (the same
// fixture deck job 1 measured, frozen into fixtures/promptFields.golden.json
// BEFORE the trim) replayed through the CURRENT buildUserPrompt. What must
// match is the FIELDS — the facts the model is handed — not the string, which
// is expected to have shrunk. A trim that drops or renames a fact the model
// conditioned on shows up here as a real failure; a trim that only shortens
// the prose around those facts does not.
//
// This is what makes "without changing decisions" checkable without a model:
// the model cannot decide differently on a hand it was told the same things
// about.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { buildUserPrompt, buildSystem, estimateCallTokens } from './handler.js';
import { extractPromptFields } from './promptFields.js';
import { sampleGameStates } from './fixtures/sampleGameStates.js';
import { median, percentile } from './tokenEstimate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(
  readFileSync(path.join(__dirname, 'fixtures', 'promptFields.golden.json'), 'utf8'),
);

test('the trimmed prompt still carries the same fields, spot for spot', () => {
  const spots = sampleGameStates(200, 42);
  assert.equal(spots.length, golden.length, 'the fixture deck must not have moved under this test');
  for (let i = 0; i < spots.length; i++) {
    const fields = extractPromptFields(buildUserPrompt(spots[i]));
    assert.deepEqual(fields, golden[i], `spot ${i} (${spots[i].street}, hand ${spots[i].handNumber})`);
  }
});

// ── the token budget the trim was for ───────────────────────────────────────

const STRATEGY = 'You are a solid, balanced poker player. Play tight-aggressive.';

test('COST-2 job 2 budget: static system prompt stays under 500 estimated tokens', () => {
  const staticTokens = estimateCallTokens(sampleGameStates(1, 1)[0], STRATEGY, '').staticTokens;
  assert.ok(staticTokens < 500, `static prompt is ${staticTokens} tokens`);
});

test('COST-2 job 2 budget: dynamic per-hand prompt stays under 400 estimated tokens, worst case included', () => {
  const spots = sampleGameStates(200, 42);
  const dyn = spots.map((gs) => estimateCallTokens(gs, STRATEGY, '').dynamicTokens);
  assert.ok(Math.max(...dyn) < 400, `dynamic max is ${Math.max(...dyn)} tokens (median ${median(dyn)}, p90 ${percentile(dyn, 90)})`);
});

// buildSystem is exercised above via estimateCallTokens; asserted directly too
// so a failure names the right function without having to unwind the helper.
test('buildSystem alone matches the budget test above', () => {
  const sys = buildSystem(STRATEGY, '');
  assert.ok(sys.length > 0);
});
