// src/server/relate.test.js — RELATE-1b
//
// The ledger has to reach the model, and it has to change the answer. This is
// the fixed-stub test: one identical needle, two agents with opposite records,
// and the assertion is that the prompt the model would receive differs in the
// way that matters — and that a stub model given those two prompts produces
// two different replies.
//
// No live call: the "model" is a deterministic function of its prompt, which
// is exactly what makes the assertion meaningful. If the ledger were dropped
// from the prompt, both prompts would be byte-identical and the stub could not
// tell them apart — which is the failure this test exists to catch.

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAgentChatSystem } from './agentProfiles.js';
import { recordOwnerEvent, whatDoYouThinkOfMe, isAskingAboutOwner } from '../agent/ownerMemory.js';

function agentWith(events) {
  const a = {
    id: 'a1',
    name: 'Balanced v2.1',
    strategy: 'tight-aggressive',
    stats: { handsPlayed: 240, winRate: 52 },
    recentHands: [{ won: false, potSize: 900, holeCards: ['Qh', '3d'] }],
    mood: { state: 'frustrated', heat: 55, cause: 'ran into the nuts', losingRun: 1 },
  };
  for (const [type, ctx, times = 1] of events) {
    for (let i = 0; i < times; i++) recordOwnerEvent(a, type, ctx);
  }
  return a;
}

// A stand-in model with no network and no randomness. It reads the prompt the
// way the real one is asked to: if the owner block says he is being got at, he
// answers short; if it says the owner reads his hands back, he answers open.
function stubModel(systemText) {
  const block = systemText.split('What you remember about your owner')[1] ?? '';
  const hostile = /gets on my back|cut me off|Nothing\./i.test(block);
  const decent = /actually read it|talked me down|staked me/i.test(block);
  if (hostile && !decent) return "Yeah, I punted it. You'll tell me anyway.";
  if (decent) return "Fair. I got shown a better hand — want the turn card back?";
  return 'It happens.';
}

const HOSTILE = [
  ['needle', { losing: true }, 6],
  ['cut', { holeCards: ['Qh', '3d'] }],
];
const DECENT = [
  ['care', { aboutHand: true, holeCards: ['Ah', 'Kd'] }, 4],
  ['pep_talk', {}, 2],
  ['funded', { amount: 5000 }],
];

// ── the ledger reaches the prompt ────────────────────────────────────────────

test('RELATE-1b: the reply prompt carries the owner ledger', () => {
  const sys = buildAgentChatSystem(agentWith(HOSTILE));
  assert.match(sys, /What you remember about your owner/);
  assert.match(sys, /gets on my back when I lose \(6×\)/);
  assert.match(sys, /cut me off after the Q3o hand/);
});

test('RELATE-1b: an agent with no history carries no owner block', () => {
  const sys = buildAgentChatSystem(agentWith([]));
  assert.equal(/What you remember about your owner/.test(sys), false,
    'no ledger means no block — an empty relationship is not a bad one');
});

test('RELATE-1b: the ledger is lines, never the owner\'s words', () => {
  const a = agentWith([['needle', { text: 'you are a clown, agent 4111', losing: false }]]);
  const sys = buildAgentChatSystem(a);
  assert.equal(sys.includes('4111'), false);
});

// ── the same needle, two owners, two replies ─────────────────────────────────

test('RELATE-1b: the same needle gets different replies from different records', () => {
  const hostileSys = buildAgentChatSystem(agentWith(HOSTILE));
  const decentSys = buildAgentChatSystem(agentWith(DECENT));

  // The prompts must actually differ, or the stub is proving nothing.
  assert.notEqual(hostileSys, decentSys);

  const hostileReply = stubModel(hostileSys);
  const decentReply = stubModel(decentSys);
  assert.notEqual(hostileReply, decentReply,
    'a needle from an owner who is always on his back must not read like one from an owner who reads his hands back');
  assert.match(hostileReply, /You'll tell me anyway/);
  assert.match(decentReply, /want the turn card back/);
});

test('RELATE-1b: strip the ledger and the two prompts collapse — the guard against silently dropping it', () => {
  const strip = (s) => s.split('What you remember about your owner')[0];
  const hostileSys = buildAgentChatSystem(agentWith(HOSTILE));
  const decentSys = buildAgentChatSystem(agentWith(DECENT));
  assert.equal(strip(hostileSys), strip(decentSys),
    'everything except the ledger is identical, so the ledger is the only thing carrying the difference');
});

// ── "what do you think of me?" ───────────────────────────────────────────────

test('RELATE-1b: the question is answered from the ledger with no model call', () => {
  // The route short-circuits before callClaude; here we assert the template
  // path itself produces a real, record-specific answer for each register.
  assert.equal(isAskingAboutOwner('what do you think of me?'), true);

  const hostile = whatDoYouThinkOfMe(agentWith(HOSTILE));
  const decent = whatDoYouThinkOfMe(agentWith(DECENT));
  const mixed = whatDoYouThinkOfMe(agentWith([
    ['needle', { losing: true }, 2],
    ['care', { aboutHand: true, holeCards: ['Ah', 'Kd'] }, 2],
  ]));

  assert.match(hostile, /gets on my back when I lose/);
  assert.match(decent, /You're alright/);
  assert.match(mixed, /^Mixed\./);
  assert.equal(new Set([hostile, decent, mixed]).size, 3);
});

test('RELATE-1b: the answer names a specific memory rather than a feeling', () => {
  const answer = whatDoYouThinkOfMe(agentWith(HOSTILE));
  assert.ok(
    /gets on my back|cut me off/.test(answer),
    `must quote the record, got: ${answer}`,
  );
});
