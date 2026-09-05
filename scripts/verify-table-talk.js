// scripts/verify-table-talk.js — TLK-1
// Verify table talk constraints: rate limits, susceptibility logic, needle
// injection, stoic immunity. No server process needed.
// Run: node scripts/verify-table-talk.js

import {
  pickTalkLine,
  chatSusceptibility,
  isStoic,
  isSusceptible,
  TALK_INTERVAL_HANDS,
  STOIC_THRESHOLD,
  SUSCEPTIBLE_THRESHOLD,
} from '../src/agent/tableTalk.js';
import { EVENT_DELTAS, applyEvent, initialMood } from '../src/agent/mood.js';

let passed = 0;
let failed = 0;

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}
function assertClose(label, got, lo, hi) {
  if (typeof got === 'number' && got >= lo && got <= hi) {
    console.log(`  PASS  ${label} (${got} in [${lo}, ${hi}])`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got ${JSON.stringify(got)}, expected [${lo}, ${hi}]`);
    failed++;
  }
}

// ── TALK_INTERVAL_HANDS constant ──────────────────────────────────────────────
console.log('\nTALK_INTERVAL_HANDS');
assert('TALK_INTERVAL_HANDS is a positive integer', Number.isInteger(TALK_INTERVAL_HANDS) && TALK_INTERVAL_HANDS > 0, true);
assert('TALK_INTERVAL_HANDS is at least 5', TALK_INTERVAL_HANDS >= 5, true);

// ── chatSusceptibility bounds ─────────────────────────────────────────────────
console.log('\nchatSusceptibility bounds');
const maxAggProfile   = { aggression: 100, discipline: 0,   tightness: 0,   bluffFreq: 50 };
const minAggProfile   = { aggression: 0,   discipline: 100, tightness: 100, bluffFreq: 0  };
const neutralProfile  = { aggression: 50,  discipline: 50,  tightness: 50,  bluffFreq: 25 };
assert('max-aggression profile is <= 100',  chatSusceptibility(maxAggProfile) <= 100, true);
assert('max-aggression profile is >= 0',    chatSusceptibility(maxAggProfile) >= 0,   true);
assert('stoic profile is <= 100',           chatSusceptibility(minAggProfile) <= 100, true);
assert('stoic profile is >= 0',             chatSusceptibility(minAggProfile) >= 0,   true);
assert('neutral profile is in range',       chatSusceptibility(neutralProfile) >= 0 && chatSusceptibility(neutralProfile) <= 100, true);

// ── isStoic / isSusceptible thresholds ───────────────────────────────────────
console.log('\nisStoic / isSusceptible');
const stoicProfile      = { aggression: 10, discipline: 90, tightness: 80, bluffFreq: 5  };
const hotheadProfile    = { aggression: 90, discipline: 10, tightness: 20, bluffFreq: 60 };
const midProfile        = { aggression: 50, discipline: 50, tightness: 50, bluffFreq: 30 };

const stoicScore   = chatSusceptibility(stoicProfile);
const hotheadScore = chatSusceptibility(hotheadProfile);
const midScore     = chatSusceptibility(midProfile);
console.log(`  INFO  stoicScore=${stoicScore} hotheadScore=${hotheadScore} midScore=${midScore}`);

assert('stoic profile: isStoic = true',          isStoic(stoicProfile),   true);
assert('stoic profile: isSusceptible = false',   isSusceptible(stoicProfile), false);
assert('hothead profile: isStoic = false',       isStoic(hotheadProfile), false);
assert('hothead profile: isSusceptible = true',  isSusceptible(hotheadProfile), true);
assert('STOIC_THRESHOLD is 30',  STOIC_THRESHOLD,       30);
assert('SUSCEPTIBLE_THRESHOLD is 50', SUSCEPTIBLE_THRESHOLD, 50);

// Verify the formula gives correct ordering.
assert('hothead score > stoic score', hotheadScore > stoicScore, true);

// ── pickTalkLine returns values ───────────────────────────────────────────────
console.log('\npickTalkLine returns values');
const TRIGGERS = ['wonBigPot', 'lostAsFavorite', 'shownBluff', 'cardDead'];
for (const trigger of TRIGGERS) {
  const line = pickTalkLine(trigger, 'neutral');
  assert(`${trigger}/neutral returns a string`,  typeof line === 'string', true);
  assert(`${trigger}/neutral is non-empty`,      (line?.length ?? 0) > 0, true);
}
for (const trigger of TRIGGERS) {
  const line = pickTalkLine(trigger, 'tilted');
  assert(`${trigger}/tilted returns a string`,   typeof line === 'string', true);
  assert(`${trigger}/tilted is non-empty`,       (line?.length ?? 0) > 0, true);
}
for (const trigger of TRIGGERS) {
  const line = pickTalkLine(trigger, 'sulking');
  assert(`${trigger}/sulking returns a string`,  typeof line === 'string', true);
}
assert('unknown trigger returns null', pickTalkLine('unknownTrigger'), null);

// ── mood.js needled event ─────────────────────────────────────────────────────
console.log('\nneedled event in mood.js');
assert('EVENT_DELTAS.needled exists',    EVENT_DELTAS.needled !== undefined, true);
assert('EVENT_DELTAS.needled is -1',     EVENT_DELTAS.needled, -1);

// applyEvent with needled on a neutral mood. With discipline=50, tiltResistance
// ≈ 57; movement chance = 1 - 0.57*0.75 ≈ 0.57. Run 50 times and check at
// least one state change occurred (extremely unlikely to miss at 50 attempts).
let needledChangedOnce = false;
const testProfile = { tightness: 30, aggression: 70, discipline: 20, bluffFreq: 40 };
for (let i = 0; i < 50; i++) {
  const base = initialMood();
  base.state = 'neutral';
  const after = applyEvent(base, 'needled', testProfile, {});
  if (after.state !== 'neutral') { needledChangedOnce = true; break; }
}
assert('needled event can shift mood down from neutral (low-discipline profile)', needledChangedOnce, true);

// ── Rate-limit simulation ─────────────────────────────────────────────────────
console.log('\nRate-limit simulation');

// Simulate the per-seat and per-hand rate-limit decisions that
// _maybeSendAgentTalk uses, independent of a real Table.
function simulateTalkAllowed(handNumber, lastTalkHand, talkHandNumber) {
  if (handNumber - lastTalkHand < TALK_INTERVAL_HANDS) return false;
  if (talkHandNumber === handNumber) return false;
  return true;
}

// Same hand: second agent blocked by talkHandNumber lock.
{
  const hand = 10;
  const seat0result = simulateTalkAllowed(hand, -1, -1);       // first to check: allowed
  const talkHandAfterSeat0 = seat0result ? hand : -1;          // seat0 locks the hand
  const seat1result = simulateTalkAllowed(hand, -1, talkHandAfterSeat0); // blocked
  assert('first eligible agent in a hand is allowed',  seat0result,   true);
  assert('second agent in the same hand is blocked',   seat1result,   false);
}

// Within interval: blocked.
{
  const lastHand = 10;
  const nextHand = lastHand + TALK_INTERVAL_HANDS - 1;
  assert(
    `agent with last talk at ${lastHand} is blocked at hand ${nextHand} (< INTERVAL)`,
    simulateTalkAllowed(nextHand, lastHand, -1), false
  );
}

// Exactly at interval gap: allowed.
{
  const lastHand = 10;
  const nextHand = lastHand + TALK_INTERVAL_HANDS;
  assert(
    `agent with last talk at ${lastHand} is allowed at hand ${nextHand} (= INTERVAL)`,
    simulateTalkAllowed(nextHand, lastHand, -1), true
  );
}

// ── Preflop-streak trigger logic ──────────────────────────────────────────────
console.log('\nPreflop streak trigger');

function simulateStreakTrigger(streakBefore, onlyFoldedPreflop, threshold = 3) {
  let streak = streakBefore;
  if (onlyFoldedPreflop) {
    streak++;
  }
  const fires = streak >= threshold;
  if (fires) streak = 0;
  return { fires, streak };
}

assert('streak 2 + fold → fires cardDead (threshold 3)',
  simulateStreakTrigger(2, true).fires, true);
assert('streak 2 + fold → streak resets to 0',
  simulateStreakTrigger(2, true).streak, 0);
assert('streak 1 + fold → does not fire yet',
  simulateStreakTrigger(1, true).fires, false);
assert('streak 2 + non-fold → does not fire',
  simulateStreakTrigger(2, false).fires, false);

// ── Needle injection logic ────────────────────────────────────────────────────
console.log('\nNeedle injection');

function simulateNeedleDecision(oppProfile, needledThisSession) {
  // Returns {setNeedle, setMoodEvent}
  if (isStoic(oppProfile)) return { setNeedle: false, setMoodEvent: false };
  if (!isSusceptible(oppProfile)) return { setNeedle: false, setMoodEvent: false };
  const setNeedle = true;
  const setMoodEvent = needledThisSession === 0;
  return { setNeedle, setMoodEvent };
}

// Stoic opponent: nothing.
const stoicResult = simulateNeedleDecision(stoicProfile, 0);
assert('stoic opponent: setNeedle = false',     stoicResult.setNeedle,    false);
assert('stoic opponent: setMoodEvent = false',  stoicResult.setMoodEvent, false);

// Susceptible opponent, not yet needled.
const susceptibleResult = simulateNeedleDecision(hotheadProfile, 0);
assert('susceptible opponent: setNeedle = true',    susceptibleResult.setNeedle,    true);
assert('susceptible opponent: setMoodEvent = true', susceptibleResult.setMoodEvent, true);

// Susceptible opponent, already needled this session.
const alreadyNeedledResult = simulateNeedleDecision(hotheadProfile, 1);
assert('already-needled opponent: setNeedle = true',    alreadyNeedledResult.setNeedle,    true);
assert('already-needled opponent: setMoodEvent = false', alreadyNeedledResult.setMoodEvent, false);

// Mid-susceptibility (not susceptible enough): only needle if >= SUSCEPTIBLE_THRESHOLD.
const midResult = simulateNeedleDecision(midProfile, 0);
const midSusc = chatSusceptibility(midProfile);
console.log(`  INFO  midProfile susceptibility=${midSusc} (threshold=${SUSCEPTIBLE_THRESHOLD})`);
assert(
  `midProfile susceptible=${midSusc >= SUSCEPTIBLE_THRESHOLD} → setNeedle matches`,
  midResult.setNeedle,
  midSusc >= SUSCEPTIBLE_THRESHOLD
);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
