// src/agent/promptFields.test.js — COST-2 job 2

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractPromptFields } from './promptFields.js';
import { buildUserPrompt } from './handler.js';
import { sampleGameStates } from './fixtures/sampleGameStates.js';

test('pulls the facts out of a real rendered prompt', () => {
  const [gs] = sampleGameStates(1, 1);
  const fields = extractPromptFields(buildUserPrompt(gs));
  assert.equal(fields.street, gs.street.toUpperCase());
  assert.equal(fields.pot, String(gs.pot));
  assert.equal(fields.myStack, String(gs.myStack));
  assert.ok(fields.legalActions);
});

test('a field embedded in explanatory prose around it still parses the same', () => {
  const a = extractPromptFields('STREET: FLOP\nPOT: 100  MY STACK: 900  OPP STACK: 900\nLEGAL ACTIONS: fold | call\n');
  const b = extractPromptFields(
    'Some framing sentence.\nSTREET: FLOP\nPOT: 100  MY STACK: 900  OPP STACK: 900\n' +
    'A different closing paragraph that says nothing new.\nLEGAL ACTIONS: fold | call\nDecision:',
  );
  assert.deepEqual(a, b);
});

test('an opponent read line is captured whole, EXPLOIT included', () => {
  const prompt = 'STREET: FLOP\nOPPONENT READ (Granite, 40 hands): VPIP 70% (very loose), PFR 4%.\nEXPLOIT: bet for value.\nLEGAL ACTIONS: fold';
  const fields = extractPromptFields(prompt);
  assert.equal(fields.reads.length, 2);
  assert.match(fields.reads[0], /^OPPONENT READ \(Granite/);
  assert.match(fields.reads[1], /^EXPLOIT: /);
});
