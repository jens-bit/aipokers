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
  HEAT_EVENTS,
  HEAT_MIDPOINT,
  HEAT_STEP,
  HEAT_DECAY_PER_HAND,
  SULK_LOSING_RUN,
  stateForHeat,
  heatForState,
  heatScales,
  clampHeat,
  restAtBar,
  classifyOwnerMessage,
  applyOwnerMessage,
} from './mood.js';

import fs from 'node:fs';

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

console.log('\n— trait scaling: stoic takes less from the same beat —');
{
  // MOOD-2 changed the MEASURE, not the rule. Resistance used to block a whole
  // step some fraction of the time (a dice roll); now the beat always lands and
  // resistance scales how hard. The rule under test is the same one it always
  // was: a stoic is harder to rattle than a volatile agent, and neither is
  // immune.
  const beat = 'lostAsEquityFavorite';
  const stoicHit = applyEvent(initialMood(), beat, STOIC);
  const volatileHit = applyEvent(initialMood(), beat, VOLATILE);
  const stoicGain = stoicHit.heat - HEAT_MIDPOINT.neutral;
  const volatileGain = volatileHit.heat - HEAT_MIDPOINT.neutral;
  console.log(`  same beat: stoic +${stoicGain} heat, volatile +${volatileGain} heat`);

  check(`the beat lands on both — nobody is immune`, stoicGain > 0 && volatileGain > 0);
  check(`stoic takes less than volatile`, stoicGain < volatileGain);
  check(`one beat does not tilt a stoic`, stoicHit.state === 'neutral');
  check(`the same beat rattles a volatile agent`, volatileHit.state === 'frustrated');

  // "Stoic still moves sometimes" — it takes more, but it gets there.
  let stoic = initialMood();
  for (let i = 0; i < 8; i++) stoic = applyEvent(stoic, beat, STOIC);
  check(`enough beats tilt even a stoic`, stoic.state === 'tilted' || stoic.state === 'sulking');

  // And the scales themselves, both directions.
  const sScales = heatScales(STOIC);
  const vScales = heatScales(VOLATILE);
  check(`stoic heats slower`, sScales.heating < vScales.heating);
  check(`stoic cools faster`, sScales.cooling > vScales.cooling);
}

console.log('\n— uneventful hands cool him back to level —');
{
  // MOOD-2 changed this mechanism too: decay used to step one BAND every
  // DECAY_HANDS uneventful hands. It is continuous now, because heat between
  // the bands is the entire point of having heat. The rules are unchanged and
  // all still asserted: uneventful hands only ever cool, they get him back to
  // neutral, and they stop there rather than running on into confident.
  let m = applyEvent(initialMood(), 'lostAsEquityFavorite', VOLATILE);
  m = applyEvent(m, 'lostAsEquityFavorite', VOLATILE);
  check(`at tilted after two hits`, m.state === 'tilted');

  const hot = m.heat;
  m = tickDecay(m);
  check(`an uneventful hand cools him`, m.heat < hot);
  check(`it never heats him`, m.heat <= hot);
  check(`uneventfulHands counts up`, m.uneventfulHands === 1);

  // Enough of them and he is level again.
  for (let i = 0; i < 40; i++) m = tickDecay(m);
  check(`he comes back to neutral`, m.state === 'neutral');
  check(`and lands exactly at level`, m.heat === HEAT_MIDPOINT.neutral);

  // And stops. Cooling is not a route to confident: that has to be won.
  const settled = { ...m };
  m = tickDecay(m);
  check(`no-op at neutral`, m.state === 'neutral' && m.heat === settled.heat);

  // It works in the other direction too — a confident agent drifts back to
  // level rather than staying elated forever.
  let up = initialMood();
  for (let i = 0; i < 4; i++) up = applyEvent(up, 'wonBigPot', VOLATILE);
  check(`wins cool him to confident`, up.state === 'confident');
  for (let i = 0; i < 40; i++) up = tickDecay(up);
  check(`confidence drifts back to level too`, up.heat === HEAT_MIDPOINT.neutral);

  // COMPOSURE still sets the rate, through the same hook it always did.
  const hotMood = { ...initialMood(), heat: 80, state: 'tilted' };
  const calm = tickDecay(hotMood, { composure: 100 });
  const rattled = tickDecay(hotMood, { composure: 0 });
  check(`a composed agent cools faster`, calm.heat < rattled.heat);
}

console.log('\n— pep talk soothes one step + enforces cooldown —');
{
  let m = applyEvent(initialMood(), 'lostAsEquityFavorite', VOLATILE);
  m = applyEvent(m, 'lostAsEquityFavorite', VOLATILE);
  check(`start at tilted`, m.state === 'tilted');
  const first = applyPepTalk(m, 20);
  check(`pep talk works when soothable`, first.soothed === true);
  check(`cools him by one step`, first.mood.heat === m.heat - HEAT_STEP);
  check(`one step is enough to leave the tilted band here`, first.mood.state === 'frustrated');
  check(`a pep talk never overshoots past level`, first.mood.heat >= HEAT_MIDPOINT.neutral);
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

console.log('\n— heat: the bands, the backfill, and what may move it —');
{
  check(`confident is the cold end`, stateForHeat(0) === 'confident' && stateForHeat(20) === 'confident');
  check(`neutral is the middle`, stateForHeat(21) === 'neutral' && stateForHeat(40) === 'neutral');
  check(`frustrated sits above it`, stateForHeat(41) === 'frustrated' && stateForHeat(60) === 'frustrated');
  check(`tilted is the hot end`, stateForHeat(61) === 'tilted' && stateForHeat(100) === 'tilted');
  check(`every band maps back to a heat inside itself`,
    MOOD_STATES.every((st) => stateForHeat(heatForState(st), { losingRun: st === 'sulking' ? SULK_LOSING_RUN : 0 }) === st));

  // Sulking is tilt that has stopped expecting the next hand to be different.
  check(`tilt alone is not sulking`, stateForHeat(90, { losingRun: 0 }) === 'tilted');
  check(`tilt plus a losing run is`, stateForHeat(90, { losingRun: SULK_LOSING_RUN }) === 'sulking');
  check(`a losing run without the heat is not`, stateForHeat(30, { losingRun: 9 }) === 'neutral');

  check(`heat is clamped to 0..100`, clampHeat(-40) === 0 && clampHeat(400) === 100);
  check(`nonsense heat reads as level`, clampHeat('x') === HEAT_MIDPOINT.neutral);

  // Backwards compatibility: a record from before heat existed.
  const legacy = { mood: { state: 'tilted', cause: 'lost a big pot', updatedAt: 1 } };
  ensureMood(legacy);
  check(`a stateless-heat record is backfilled to its band midpoint`,
    legacy.mood.heat === HEAT_MIDPOINT.tilted);
  check(`and keeps the state it was stored with`, legacy.mood.state === 'tilted');
  const legacyConfident = { mood: { state: 'confident' } };
  ensureMood(legacyConfident);
  check(`the same for the cold end`, legacyConfident.mood.heat === HEAT_MIDPOINT.confident);

  // Every event has a weight, and they point the right way.
  check(`losing events heat him`,
    HEAT_EVENTS.lostAsEquityFavorite > 0 && HEAT_EVENTS.lostBigPot > 0 &&
    HEAT_EVENTS.cooler > 0 && HEAT_EVENTS.sessionLossStreak > 0 &&
    HEAT_EVENTS.cardDead > 0 && HEAT_EVENTS.needled > 0);
  check(`winning events cool him`, HEAT_EVENTS.wonBigPot < 0 && HEAT_EVENTS.sessionWinStreak < 0);
  check(`the beat that stings most is the worst one`,
    HEAT_EVENTS.lostAsEquityFavorite === Math.max(...Object.values(HEAT_EVENTS)));
  check(`an unknown event does nothing at all`,
    applyEvent(initialMood(), 'sneezed', VOLATILE).heat === HEAT_MIDPOINT.neutral);

  // The bar. The only thing that works while nobody is looking.
  const hot = { ...initialMood(), heat: 90, state: 'tilted', losingRun: 4 };
  check(`an hour at the bar cools him`, restAtBar(hot, { hours: 1 }).heat < hot.heat);
  check(`a long night at the bar brings him back to level`,
    restAtBar(hot, { hours: 24 }).heat === HEAT_MIDPOINT.neutral);
  check(`the bar never makes him confident`, restAtBar(hot, { hours: 999 }).state === 'neutral');
  check(`the bar never heats him`, restAtBar({ ...initialMood(), heat: 10 }, { hours: 5 }).heat === 10);

  // THE LAW. Nothing moves heat without a poker event or an owner message.
  const level = initialMood();
  check(`no hours, no change`, restAtBar(level, { hours: 0 }) === level);
  check(`negative hours cannot be used to heat him`, restAtBar(level, { hours: -50 }) === level);
  check(`nonsense hours do nothing`, restAtBar(level, { hours: 'x' }) === level);
  check(`an uneventful hand at level changes nothing`,
    tickDecay(level).heat === level.heat);
}

console.log('\n— susceptibility: what the owner says, and only what he says —');
{
  const HOT = { ...initialMood(), heat: 60, state: 'tilted', pepTalkAtHand: null };

  check(`an insult is a needle`, classifyOwnerMessage('you absolute idiot') === 'needle');
  check(`so is an insult with a question mark`,
    classifyOwnerMessage('what were you thinking there?') === 'needle');
  check(`so is naming the mistake`, classifyOwnerMessage('you punted that whole stack') === 'needle');
  check(`praise is care`, classifyOwnerMessage('nice fold') === 'care');
  check(`sympathy is care`, classifyOwnerMessage('unlucky, nothing you could do') === 'care');
  check(`asking about a hand is care`, classifyOwnerMessage('why did you call there?') === 'care');
  check(`so is asking what he held`, classifyOwnerMessage('what did you have?') === 'care');
  check(`everything else is neutral`,
    classifyOwnerMessage('see you tomorrow') === 'neutral' && classifyOwnerMessage('ok') === 'neutral');
  check(`nothing at all is neutral`,
    classifyOwnerMessage('') === 'neutral' && classifyOwnerMessage(null) === 'neutral');

  // Bounded, both directions.
  const needled = applyOwnerMessage(HOT, 'you idiot', { handsPlayed: 50, composure: 0 });
  check(`a needle heats him`, needled.mood.heat > HOT.heat);
  check(`by at most one step`, needled.mood.heat - HOT.heat <= HEAT_STEP);
  const cared = applyOwnerMessage(HOT, 'unlucky, that happens', { handsPlayed: 50 });
  check(`care cools him`, cared.mood.heat < HOT.heat);
  check(`by at most one step`, HOT.heat - cared.mood.heat <= HEAT_STEP);
  check(`a message is never worth more than a good pot`,
    HEAT_STEP <= Math.abs(HEAT_EVENTS.wonBigPot));

  // COMPOSURE is the shield, and the whole shield.
  const glass = applyOwnerMessage(HOT, 'you idiot', { handsPlayed: 50, composure: 0 });
  const stone = applyOwnerMessage(HOT, 'you idiot', { handsPlayed: 50, composure: 100 });
  check(`a composed agent lets an insult go entirely`, stone.moved === false);
  check(`an agent with no composure takes all of it`, glass.mood.heat - HOT.heat === HEAT_STEP);
  const mid = applyOwnerMessage(HOT, 'you idiot', { handsPlayed: 50, composure: 50 });
  check(`and in between, half of it`, mid.mood.heat - HOT.heat < HEAT_STEP && mid.moved === true);

  // The cooldown the pep talk has always had.
  const second = applyOwnerMessage(needled.mood, 'you idiot again', { handsPlayed: 55, composure: 0 });
  check(`a second message inside the cooldown does nothing`,
    second.moved === false && second.reason === 'cooldown');
  const later = applyOwnerMessage(needled.mood, 'you idiot again',
    { handsPlayed: 50 + PEP_TALK_COOLDOWN_HANDS, composure: 0 });
  check(`after the cooldown it lands again`, later.moved === true);
  check(`so an owner cannot type him into tilt`, (() => {
    let m = { ...initialMood() };
    for (let i = 0; i < 20; i++) m = applyOwnerMessage(m, 'you idiot', { handsPlayed: 0, composure: 0 }).mood;
    return m.state !== 'tilted' && m.state !== 'sulking';
  })());

  // ── THE LAW ──────────────────────────────────────────────────────────────
  // No code path changes heat without a message or a poker event.
  console.log('\n  — no heat without a message or a poker event —');
  const level = initialMood();
  check(`an empty message does nothing`, applyOwnerMessage(level, '', { handsPlayed: 99 }).mood === level);
  check(`a null message does nothing`, applyOwnerMessage(level, null, { handsPlayed: 99 }).mood === level);
  check(`an undefined message does nothing`, applyOwnerMessage(level, undefined, { handsPlayed: 99 }).mood === level);
  check(`whitespace does nothing`, applyOwnerMessage(level, '   \n  ', { handsPlayed: 99 }).mood === level);
  check(`small talk does nothing`, applyOwnerMessage(level, 'hey', { handsPlayed: 99 }).moved === false);
  check(`an unknown event does nothing`, applyEvent(level, 'ownerWasAway', VOLATILE).heat === level.heat);
  check(`time alone does nothing`, restAtBar(level, { hours: 0 }) === level);
  check(`a hot agent left alone COOLS, never the other way`, (() => {
    const hot = { ...initialMood(), heat: 90, state: 'tilted' };
    return restAtBar(hot, { hours: 100 }).heat < hot.heat;
  })());

  // And the source itself: nothing in this file knows what a neglected agent
  // is. A guilt mechanic would have to be spelled somewhere, so this looks.
  // Comments AND string literals stripped first. The file DESCRIBES this law in
  // these words, and a prompt string says "do NOT abandon your range" — both are
  // prose. What must not exist is an IDENTIFIER: a mechanic has to be named to
  // be built, so this looks for the name.
  const src = fs.readFileSync(new URL('./mood.js', import.meta.url), 'utf8');
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const banned = /\b(neglect\w*|\w*[Aa]bandoned\w*|unopened\w*|ignoredBy\w*|lastSeen\w*|daysSince\w*|sinceLast\w*|lonel\w*|awayFor\w*|silence\w*)\b/i;
  check(`mood.js has no absence-tracking identifier`, !banned.test(code));
  check(`mood.js never subtracts one clock reading from another`,
    !/Date\.now\(\)\s*-\s*/.test(src));
}

console.log('\n— summary —');
if (failures === 0) {
  console.log('all mood checks passed');
  process.exit(0);
} else {
  console.error(`${failures} mood checks failed`);
  process.exit(1);
}
