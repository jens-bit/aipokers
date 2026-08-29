// Unit tests for the policy compiler. Run with:
//   node src/agent/policy.test.js

import assert from 'node:assert';
import {
  compilePolicy,
  rangeVerdict,
  rollDice,
  sizingDirectives,
  normalizeProfile,
  inferProfileFromStyleRisk,
  handCode,
} from './policy.js';

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
}

// A representative sample of hands spanning the strength spectrum.
const SAMPLE_HANDS = [
  ['As', 'Ah'],  // AA
  ['Kc', 'Kd'],  // KK
  ['Qh', 'Qs'],  // QQ
  ['As', 'Ks'],  // AKs
  ['Ah', 'Kd'],  // AKo
  ['Ts', '9s'],  // T9s
  ['8c', '7d'],  // 87o
  ['7c', '2d'],  // 72o
  ['6h', '2c'],  // 62o
  ['3s', '2d'],  // 32o
];

console.log('\n— handCode canonicalization —');
check('AA code', handCode(['As','Ah']) === 'AA');
check('AKs code', handCode(['As','Ks']) === 'AKs');
check('AKo code', handCode(['As','Kh']) === 'AKo');
check('72o code',  handCode(['2c','7d']) === '72o');
check('unknown card returns null', handCode(['Zz','Ah']) === null);

console.log('\n— range monotonicity: tighter ⊂ looser —');
// For each hand + position, iterate tightness 0..100 and check that once a
// hand is OUT of range at higher tightness, it never re-enters at a still
// higher tightness value. Equivalent: inRange is monotonically non-increasing
// as tightness rises.
{
  let breaks = 0;
  for (const hand of SAMPLE_HANDS) {
    for (const position of ['BTN/SB', 'BB']) {
      let lastInRange = null;
      for (let t = 0; t <= 100; t += 5) {
        const v = rangeVerdict(hand, position, { tightness: t });
        if (lastInRange === false && v.inRange === true) breaks++;
        lastInRange = v.inRange;
      }
    }
  }
  check('no monotonicity breaks across sample hands x positions x tightness', breaks === 0);
}

console.log('\n— range makes sense at extremes —');
{
  const looseNit  = rangeVerdict(['As','Ah'], 'BTN/SB', { tightness: 100 });
  const looseJunk = rangeVerdict(['3s','2d'], 'BTN/SB', { tightness: 100 });
  const wideNit   = rangeVerdict(['As','Ah'], 'BTN/SB', { tightness: 0 });
  const wideJunk  = rangeVerdict(['3s','2d'], 'BTN/SB', { tightness: 0 });
  check('AA in the tightest possible range',   looseNit.inRange === true);
  check('32o out of the tightest range',       looseJunk.inRange === false);
  check('AA still in the loosest range',       wideNit.inRange === true);
  check('32o inside a wide open (t=0) range',  wideJunk.inRange === true);
}

console.log('\n— target VPIP scales with tightness —');
{
  const nit  = rangeVerdict(['As','Ah'], 'BTN/SB', { tightness: 90 });
  const cannon = rangeVerdict(['As','Ah'], 'BTN/SB', { tightness: 10 });
  check(`nit tightness=90 targetVpip ≈ 12-20 (got ${nit.targetVpip})`,   nit.targetVpip >= 10 && nit.targetVpip <= 22);
  check(`cannon tightness=10 targetVpip ≈ 60-80 (got ${cannon.targetVpip})`, cannon.targetVpip >= 55 && cannon.targetVpip <= 80);
}

console.log('\n— dice frequencies within ±5% over 10k rolls —');
{
  const cases = [
    { bluffFreq: 30, discipline: 60 },
    { bluffFreq: 5,  discipline: 90 },
    { bluffFreq: 60, discipline: 20 },
  ];
  const N = 10000;
  for (const c of cases) {
    let bluffs = 0, devs = 0;
    for (let i = 0; i < N; i++) {
      const d = rollDice({ tightness: 50, aggression: 50, bluffFreq: c.bluffFreq, discipline: c.discipline });
      if (d.bluffDie) bluffs++;
      if (d.deviationDie) devs++;
    }
    const bluffPct = (bluffs / N) * 100;
    const devPct = (devs / N) * 100;
    const expectedDev = 100 - c.discipline;
    check(`bluff freq bF=${c.bluffFreq}: measured ${bluffPct.toFixed(1)}%`, Math.abs(bluffPct - c.bluffFreq) < 5);
    check(`deviation freq (100-disc=${expectedDev}): measured ${devPct.toFixed(1)}%`, Math.abs(devPct - expectedDev) < 5);
  }
}

console.log('\n— sizing scales with aggression —');
{
  const passive  = sizingDirectives({ aggression: 10 });
  const balanced = sizingDirectives({ aggression: 50 });
  const aggro    = sizingDirectives({ aggression: 90 });
  check('passive open < balanced open < aggro open',
    passive.openBB <= balanced.openBB && balanced.openBB <= aggro.openBB);
  check('passive cbet < balanced cbet < aggro cbet',
    passive.cbetFraction < balanced.cbetFraction && balanced.cbetFraction < aggro.cbetFraction);
  check('sizing text non-empty and includes "c-bet"',
    typeof aggro.text === 'string' && aggro.text.includes('c-bet'));
}

console.log('\n— compilePolicy bundles all directives —');
{
  const p = compilePolicy(
    { tightness: 70, aggression: 70, bluffFreq: 30, discipline: 80 },
    { holeCards: ['As','Ks'], position: 'BTN/SB' },
  );
  check('bundle has profile', p.profile && Number.isFinite(p.profile.tightness));
  check('bundle has dice',    p.dice && typeof p.dice.bluffDie === 'boolean' && typeof p.dice.deviationDie === 'boolean');
  check('bundle has sizing text', typeof p.sizing.text === 'string');
  check('bundle has range when preflop hand + position supplied',
    p.range && typeof p.range.inRange === 'boolean' && Number.isFinite(p.range.percentile));
}

console.log('\n— normalizeProfile clamps + defaults —');
{
  const n = normalizeProfile({ tightness: 150, aggression: -20, bluffFreq: NaN, discipline: 'bad' });
  check('clamps > 100 down', n.tightness === 100);
  check('clamps < 0 up',      n.aggression === 0);
  check('NaN → default 50',   n.bluffFreq === 50);
  check('non-numeric → 50',   n.discipline === 50);
}

console.log('\n— inferProfileFromStyleRisk sanity —');
{
  const nitLow = inferProfileFromStyleRisk('Tight', 'Low');
  const aggHi  = inferProfileFromStyleRisk('Aggressive', 'High');
  check('Tight/Low has high tightness + discipline', nitLow.tightness >= 65 && nitLow.discipline >= 65);
  check('Aggressive/High has low tightness + high aggression + high bluff',
    aggHi.tightness <= 40 && aggHi.aggression >= 80 && aggHi.bluffFreq >= 45);
}

console.log('\n— summary —');
if (failures === 0) {
  console.log('all policy checks passed');
  process.exit(0);
} else {
  console.error(`${failures} policy checks failed`);
  process.exit(1);
}
