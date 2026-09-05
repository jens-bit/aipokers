// scripts/verify-attributes.js — ATTR-1
//
// Prints what each of the six hooks actually does to a TAG agent at low (25),
// mid (50) and high (80) attributes, so the numbers can be read rather than
// inferred from the source. No API key, no model calls, no network.
//
// Usage:
//   node scripts/verify-attributes.js
//   ATTRIBUTE_IMPACT=0.5 node scripts/verify-attributes.js
//
// Read the OFF column first: it is what the game did before attributes
// existed. Every other column is a deviation from it, and at
// ATTRIBUTE_IMPACT=0 every column collapses back onto it.

import {
  ATTR_KEYS,
  effectiveAttrs,
  fatigueOnset,
  readMinHands,
  deceptionMinHandsMultiplier,
  focusSigma,
  perceiveEquity,
  composureTiltBonus,
  composureDecayHands,
  attributeImpact,
} from '../src/agent/attributes.js';
import { deviationPercent } from '../src/agent/policy.js';
import { tiltResistance, DECAY_HANDS } from '../src/agent/mood.js';
import { formatOpponentRead } from '../src/agent/reads.js';

// The TAG profile from scripts/arena-profiles.json — the CHOSEN half, which
// attributes never touch.
const TAG = { tightness: 70, aggression: 70, bluffFreq: 30, discipline: 80 };

const LEVELS = [
  { name: 'off',  value: 50, impact: '0' },
  { name: 'low',  value: 25, impact: null },
  { name: 'mid',  value: 50, impact: null },
  { name: 'high', value: 80, impact: null },
];

const num = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : String(v));

// Run fn with the knob pinned; null means "leave the environment alone".
function withImpact(impact, fn) {
  const prev = process.env.ATTRIBUTE_IMPACT;
  if (impact !== null) process.env.ATTRIBUTE_IMPACT = String(impact);
  try { return fn(); }
  finally {
    if (prev === undefined) delete process.env.ATTRIBUTE_IMPACT;
    else process.env.ATTRIBUTE_IMPACT = prev;
  }
}

function measure(level) {
  return withImpact(level.impact, () => {
    const v = level.value;
    const attrs = Object.fromEntries(ATTR_KEYS.map((k) => [k, v]));

    // A concrete FOCUS misjudgment: the same spot, seen by this agent.
    const trueEquity = 0.412;
    const seed = 'hand12:seat0:flop:AsKh:2d7c9h:eq';
    const seen = perceiveEquity(trueEquity, v, seed);

    const onset = fatigueOnset(v);
    const worn = effectiveAttrs({ attrs }, { sessionHands: Math.round(onset * 2) });

    return {
      attribute: v,
      impact: attributeImpact(),
      readsMinHands: readMinHands({ reads: v }),
      briefingLines: formatOpponentRead(STATION_READ, { reads: v }).length,
      focusSigma: focusSigma(v),
      seenEquity: seen,
      equityError: Number.isFinite(seen) ? (seen - trueEquity) * 100 : NaN,
      deviationPct: deviationPercent(TAG, { discipline: v }),
      tiltResistance: tiltResistance(TAG, { composure: v }),
      tiltDelta: composureTiltBonus(v),
      decayHands: composureDecayHands(v, DECAY_HANDS),
      oppMinHandsMult: deceptionMinHandsMultiplier(v),
      oppMinHands: readMinHands({ reads: 50, deception: v }),
      fatigueOnset: onset,
      wornFocus: worn.FOCUS,
      wornDiscipline: worn.DISCIPLINE,
      wornStage: worn.fatigue,
      // What the fatigue actually costs downstream. At knob 0 the stage still
      // moves — it is derived, not gated — but every hook that consumes it is
      // neutralised, so this row is 0.0 and nothing in play changes.
      wornEquityError: (perceiveEquity(trueEquity, worn.FOCUS, seed) - trueEquity) * 100,
      wornDeviationPct: deviationPercent(TAG, { discipline: worn.DISCIPLINE }),
    };
  });
}

// A Calling Station read with 12 observed hands — enough for the default
// 10-hand gate, not enough for a low-READS agent's 17.8.
const STATION_READ = {
  playerId: 'house_station', displayName: 'The Regular', handsObserved: 12,
  vpip: 96, pfr: 4, af: 0.2, foldToRaise: 6, wentToShowdown: 71,
};

const rows = LEVELS.map((l) => ({ level: l, m: measure(l) }));
const col = (pick) => rows.map(({ m }) => pick(m));

function table(title, lines) {
  console.log(`\n${title}`);
  console.log('  ' + 'metric'.padEnd(42) + LEVELS.map((l) => `${l.name} (${l.name === 'off' ? '—' : l.value})`.padStart(13)).join(''));
  for (const [label, values] of lines) {
    console.log('  ' + label.padEnd(42) + values.map((v) => String(v).padStart(13)).join(''));
  }
}

console.log('═══ ATTR-1 · what the six hooks do ═══');
console.log(`\nTAG profile (the CHOSEN half, untouched by attributes):`);
console.log(`  tightness=${TAG.tightness} aggression=${TAG.aggression} bluffFreq=${TAG.bluffFreq} discipline=${TAG.discipline}`);
console.log(`\nATTRIBUTE_IMPACT: ${attributeImpact()} (the "off" column forces 0)`);
console.log(`Every attribute is set to the column value; "off" is neutral 50 with the knob at 0.`);

table('READS — how fast he solves the table', [
  ['min hands before a read is briefed', col((m) => num(m.readsMinHands, 1))],
  ['briefing lines on a 12-hand station (0–2)', col((m) => m.briefingLines)],
  ['  0 = read withheld · 1 = stats only · 2 = + EXPLOIT', LEVELS.map(() => '')],
]);

table('FOCUS — math precision', [
  ['equity noise σ (equity units)', col((m) => num(m.focusSigma, 4))],
  ['true 41.2% equity is seen as', col((m) => `${num(m.seenEquity * 100, 1)}%`)],
  ['misjudgment on this spot (pts)', col((m) => num(m.equityError, 1))],
]);

table('DISCIPLINE — sticking to his own rules', [
  ['deviation probability (% of decisions)', col((m) => num(m.deviationPct, 1))],
]);

table('COMPOSURE — tilt resistance and recovery', [
  ['tilt resistance (0–100)', col((m) => m.tiltResistance)],
  ['…of which the attribute contributes', col((m) => num(m.tiltDelta, 1))],
  ['uneventful hands before mood decays', col((m) => m.decayHands)],
]);

table('DECEPTION — how slowly THEY solve HIM', [
  ['multiplier on an opponent\'s min hands', col((m) => `×${num(m.oppMinHandsMult, 2)}`)],
  ['hands a neutral opponent needs on him', col((m) => num(m.oppMinHands, 1))],
]);

table('STAMINA — late-session sharpness', [
  ['fatigue onset (hand number)', col((m) => num(m.fatigueOnset, 0))],
  ['stage at 2× onset', col((m) => m.wornStage)],
  ['FOCUS at 2× onset (from the column value)', col((m) => num(m.wornFocus, 1))],
  ['DISCIPLINE at 2× onset', col((m) => num(m.wornDiscipline, 1))],
  ['equity misjudged while worn (pts)', col((m) => num(m.wornEquityError, 1))],
  ['deviation while worn (%)', col((m) => num(m.wornDeviationPct, 1))],
]);

// The claim the whole design rests on, checked rather than asserted.
const off = rows[0].m;
const identical =
  num(off.readsMinHands, 6) === '10.000000' &&
  off.briefingLines === 2 &&
  off.focusSigma === 0 &&
  off.seenEquity === 0.412 &&
  off.deviationPct === 100 - TAG.discipline &&
  off.tiltResistance === tiltResistance(TAG) &&
  off.decayHands === DECAY_HANDS &&
  off.oppMinHandsMult === 1 &&
  num(off.fatigueOnset, 0) === '100' &&
  off.wornEquityError === 0 &&
  off.wornDeviationPct === 100 - TAG.discipline;

console.log(`\n═══ knob-0 identity: ${identical ? 'HOLDS' : 'BROKEN'} ═══`);
console.log('  With ATTRIBUTE_IMPACT=0 every hook returns the pre-attribute constant:');
console.log(`  reads gate 10 · exploits on · σ 0 · equity untouched · deviation ${100 - TAG.discipline}% ·`);
console.log(`  tilt ${tiltResistance(TAG)} · decay ${DECAY_HANDS} hands · deception ×1 · onset hand 100.`);
console.log('  This is what `arena --attributes off` reproduces, and it is the reason');
console.log('  a bb/100 delta between high and low can only be the attributes.\n');

process.exit(identical ? 0 : 1);
