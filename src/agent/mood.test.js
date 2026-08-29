// src/agent/mood.test.js — run with `node src/agent/mood.test.js`

import assert from 'node:assert';
import {
  MOOD_STATES,
  EVENT_DELTAS,
  DECAY_HANDS,
  PEP_TALK_COOLDOWN_HANDS,
  tiltResistance,
  applyEvent,
  tickDecay,
  applyPepTalk,
  initialMood,
  ensureMood,
  isSoothable,
  decisionEffects,
} from './mood.js';

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
}

// Fixed profiles for reproducibility.
const STOIC = { tightness: 88, aggression: 45, bluffFreq: 8,  discipline: 90 };
const VOLATILE = { tightness: 12, aggression: 85, bluffFreq: 55, discipline: 30 };

console.log('\n— tiltResistance TRAIT scaling —');
{
  const stoic = tiltResistance(STOIC);
  const volatile_ = tiltResistance(VOLATILE);
  check(`stoic resistance high (${stoic})`,   stoic >= 70);
  check(`volatile resistance low (${volatile_})`, volatile_ <= 45);
  check(`stoic > volatile`, stoic > volatile_);
}

console.log('\n— transition table: single event moves 0 or 1 step depending on delta —');
{
  const mood0 = initialMood();
  // Force movement with a deterministic rand that always yields 0.
  const rand0 = () => 0;
  const m1 = applyEvent(mood0, 'lostAsEquityFavorite', VOLATILE, { rand: rand0, context: { equityPct: 68 } });
  check(`negative event drops one step (neutral → frustrated)`, m1.state === 'frustrated');
  const m2 = applyEvent(m1, 'lostAsEquityFavorite', VOLATILE, { rand: rand0 });
  check(`another negative event drops another step (frustrated → tilted)`, m2.state === 'tilted');
  const m3 = applyEvent(m2, 'wonBigPot', VOLATILE, { rand: rand0, context: { potChips: 800 } });
  check(`positive event moves one step back up (tilted → frustrated)`, m3.state === 'frustrated');
  check(`cause reflects the latest event`, m3.cause.includes('800'));
  check(`updatedAt set`, typeof m3.updatedAt === 'number');
}

console.log('\n— boundaries: cannot exceed sulking or confident —');
{
  const rand0 = () => 0;
  let m = initialMood();
  for (let i = 0; i < 10; i++) m = applyEvent(m, 'lostAsEquityFavorite', VOLATILE, { rand: rand0 });
  check(`clamped at sulking`, m.state === 'sulking');
  for (let i = 0; i < 10; i++) m = applyEvent(m, 'wonBigPot', VOLATILE, { rand: rand0 });
  check(`clamped at confident`, m.state === 'confident');
}

console.log('\n— trait scaling: stoic resists more, volatile moves more —');
{
  // Run 3000 trials of a negative event and compare movement rates.
  const N = 3000;
  let stoicMoved = 0, volatileMoved = 0;
  for (let i = 0; i < N; i++) {
    const s = applyEvent(initialMood(), 'lostAsEquityFavorite', STOIC);
    if (s.state !== 'neutral') stoicMoved++;
    const v = applyEvent(initialMood(), 'lostAsEquityFavorite', VOLATILE);
    if (v.state !== 'neutral') volatileMoved++;
  }
  const stoicPct = (stoicMoved / N) * 100;
  const volatilePct = (volatileMoved / N) * 100;
  console.log(`  stoic moved ${stoicPct.toFixed(1)}%, volatile moved ${volatilePct.toFixed(1)}%`);
  check(`stoic moves less than volatile on negatives`, stoicMoved < volatileMoved);
  check(`stoic still moves sometimes (>10%)`, stoicPct > 10);
  check(`volatile moves often (>60%)`, volatilePct > 60);
}

console.log('\n— decay ticks toward neutral after DECAY_HANDS uneventful hands —');
{
  const rand0 = () => 0;
  let m = applyEvent(initialMood(), 'lostAsEquityFavorite', VOLATILE, { rand: rand0 });
  m = applyEvent(m, 'lostAsEquityFavorite', VOLATILE, { rand: rand0 });
  check(`at tilted after two hits`, m.state === 'tilted');
  for (let i = 0; i < DECAY_HANDS - 1; i++) m = tickDecay(m);
  check(`still tilted before threshold`, m.state === 'tilted');
  m = tickDecay(m);
  check(`decays one step after threshold (tilted → frustrated)`, m.state === 'frustrated');
  check(`uneventfulHands reset after decay`, m.uneventfulHands === 0);
  for (let i = 0; i < DECAY_HANDS; i++) m = tickDecay(m);
  check(`decays again (frustrated → neutral)`, m.state === 'neutral');
  m = tickDecay(m);
  check(`no-op at neutral`, m.state === 'neutral');
}

console.log('\n— pep talk soothes one step + enforces cooldown —');
{
  const rand0 = () => 0;
  let m = applyEvent(initialMood(), 'lostAsEquityFavorite', VOLATILE, { rand: rand0 });
  m = applyEvent(m, 'lostAsEquityFavorite', VOLATILE, { rand: rand0 });
  check(`start at tilted`, m.state === 'tilted');
  const first = applyPepTalk(m, 20);
  check(`pep talk works when soothable`, first.soothed === true);
  check(`moved one step toward neutral`, first.mood.state === 'frustrated');
  check(`records pepTalkAtHand`, first.mood.pepTalkAtHand === 20);
  const second = applyPepTalk(first.mood, 25);  // still within 10-hand cooldown
  check(`second pep talk within cooldown blocked`, second.soothed === false && second.reason === 'cooldown');
  const third = applyPepTalk(first.mood, 20 + PEP_TALK_COOLDOWN_HANDS);
  check(`pep talk after cooldown succeeds`, third.soothed === true);
  const noop = applyPepTalk(initialMood(), 100);
  check(`pep talk on neutral is a no-op`, noop.soothed === false);
}

console.log('\n— ensureMood backfill is idempotent —');
{
  const agent = {};
  ensureMood(agent);
  check(`fresh agent gets initialMood`, agent.mood.state === 'neutral');
  const first = agent.mood;
  ensureMood(agent);
  check(`second call preserves reference`, agent.mood === first);
  agent.mood.state = 'bogus';
  ensureMood(agent);
  check(`invalid state repaired to neutral`, agent.mood.state === 'neutral');
}

console.log('\n— bounded effects: dice + sizing nudges stay small —');
{
  for (const state of MOOD_STATES) {
    const eff = decisionEffects({ state });
    check(`|deviation nudge| ≤ 0.15 for ${state}`, Math.abs(eff.deviationBoost) <= 0.15 + 1e-9);
    check(`|sizing nudge| ≤ 0.10 for ${state}`, Math.abs(eff.sizingBoost) <= 0.10 + 1e-9);
  }
}

console.log('\n— isSoothable —');
{
  check(`sulking soothable`,   isSoothable({ state: 'sulking' })   === true);
  check(`tilted soothable`,    isSoothable({ state: 'tilted' })    === true);
  check(`frustrated soothable`,isSoothable({ state: 'frustrated' })=== true);
  check(`neutral not soothable`,   isSoothable({ state: 'neutral' })  === false);
  check(`confident not soothable`, isSoothable({ state: 'confident' })=== false);
}

console.log('\n— summary —');
if (failures === 0) {
  console.log('all mood checks passed');
  process.exit(0);
} else {
  console.error(`${failures} mood checks failed`);
  process.exit(1);
}
