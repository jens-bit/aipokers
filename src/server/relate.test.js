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
import { recordOwnerEvent, whatDoYouThinkOfMe, isAskingAboutOwner, ownerToneScore } from '../agent/ownerMemory.js';
import {
  restingHeat, ownerDriftCause, restAtBar, tickDecay,
  OWNER_DRIFT_MAX, HEAT_MIDPOINT, HEAT_STEP,
} from '../agent/mood.js';

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

// ── RELATE-1c: bounded baseline drift ────────────────────────────────────────

test('RELATE-1c: the drift is bounded at ten, both directions', () => {
  assert.equal(restingHeat(-1), HEAT_MIDPOINT.neutral + OWNER_DRIFT_MAX, 'worst possible week');
  assert.equal(restingHeat(1), HEAT_MIDPOINT.neutral - OWNER_DRIFT_MAX, 'best possible week');
  // Values outside [-1,1] cannot buy extra drift.
  assert.equal(restingHeat(-99), HEAT_MIDPOINT.neutral + OWNER_DRIFT_MAX);
  assert.equal(restingHeat(99), HEAT_MIDPOINT.neutral - OWNER_DRIFT_MAX);
});

test("RELATE-1c: the drift never outweighs the briefing's own bounded effect", () => {
  assert.ok(OWNER_DRIFT_MAX < HEAT_STEP,
    `a week of needling (${OWNER_DRIFT_MAX}) must not beat one pep talk (${HEAT_STEP})`);
});

test('RELATE-1c: no ledger means no drift — an absent owner is not a hostile one', () => {
  assert.equal(restingHeat(null), HEAT_MIDPOINT.neutral);
  assert.equal(restingHeat(undefined), HEAT_MIDPOINT.neutral);
  assert.equal(restingHeat(NaN), HEAT_MIDPOINT.neutral);
  assert.equal(ownerToneScore({ id: 'x' }), null);
});

test('RELATE-1c: a hostile week leaves him settling hotter, and says why', () => {
  const hostile = agentWith(HOSTILE);
  const target = restingHeat(ownerToneScore(hostile));
  assert.ok(target > HEAT_MIDPOINT.neutral, `expected above neutral, got ${target}`);
  assert.ok(target <= HEAT_MIDPOINT.neutral + OWNER_DRIFT_MAX);

  const rested = restAtBar({ heat: 80, state: 'tilted', losingRun: 0 }, { hours: 24, restingTarget: target });
  assert.equal(rested.heat, target, 'a full night at the bar takes him to his baseline, not below it');
  assert.equal(rested.cause, "you've been on my back all week");
  assert.equal(ownerDriftCause(ownerToneScore(hostile)), "you've been on my back all week");
});

test('RELATE-1c: a decent week leaves him settling cooler', () => {
  const decent = agentWith(DECENT);
  const target = restingHeat(ownerToneScore(decent));
  assert.ok(target < HEAT_MIDPOINT.neutral, `expected below neutral, got ${target}`);
  assert.ok(target >= HEAT_MIDPOINT.neutral - OWNER_DRIFT_MAX);
  assert.equal(ownerDriftCause(ownerToneScore(decent)), 'been a decent week, all told');
});

test('RELATE-1c: it is counterable — treating him better moves the baseline back', () => {
  const a = agentWith(HOSTILE);
  const before = restingHeat(ownerToneScore(a));
  for (let i = 0; i < 12; i++) recordOwnerEvent(a, 'pep_talk');
  const after = restingHeat(ownerToneScore(a));
  assert.ok(after < before, `${after} should be cooler than ${before}`);
});

test('RELATE-1c: the drift is never surfaced as a number', () => {
  // The only owner-facing output is a sentence. If a cause ever contains a
  // digit, somebody has started showing a score.
  for (const t of [-1, -0.6, -0.5, 0, 0.5, 0.6, 1, null]) {
    const cause = ownerDriftCause(t);
    if (cause !== null) assert.equal(/\d/.test(cause), false, `cause carries a number: ${cause}`);
  }
});

test('RELATE-1c: with no drift supplied, decay behaves exactly as before', () => {
  const mood = { heat: 60, state: 'frustrated', losingRun: 0, uneventfulHands: 0 };
  const plain = tickDecay({ ...mood });
  const explicit = tickDecay({ ...mood }, { restingTarget: HEAT_MIDPOINT.neutral });
  assert.equal(plain.heat, explicit.heat, 'the default target is the old behaviour');
});
