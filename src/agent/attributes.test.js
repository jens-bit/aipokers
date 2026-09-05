// src/agent/attributes.test.js — run with `node src/agent/attributes.test.js`
//
// Two things this file exists to pin:
//   1. at() is the only interpolation, and its endpoints are exactly the
//      low/high a 0 and a 100 are supposed to produce.
//   2. THE KNOB-0 IDENTITY LAW: with ATTRIBUTE_IMPACT=0 every hook returns
//      the constant the pre-attribute build used, so the game is bit-identical
//      to today. Same when an agent carries no attrs at all.

import assert from 'node:assert';
import {
  ATTR_KEYS,
  ATTR_LOG_CAP,
  NEUTRAL_ATTR,
  MAX_FATIGUE_DROP,
  at,
  attributeImpact,
  attrsActive,
  defaultAttributes,
  defaultPotential,
  ensureAttributes,
  logAttrChange,
  effectiveAttrs,
  fatigueOnset,
  readMinHands,
  deceptionMinHandsMultiplier,
  exploitsAllowed,
  focusSigma,
  perceiveEquity,
  seededNormal,
  composureTiltBonus,
  composureDecayHands,
  disciplineDeviationMultiplier,
} from './attributes.js';

import { formatOpponentRead } from './reads.js';
import { rollDice, deviationPercent } from './policy.js';
import { tiltResistance, tickDecay, DECAY_HANDS } from './mood.js';

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// Run `fn` with the knob forced to `value`, then restore the environment.
function withImpact(value, fn) {
  const prev = process.env.ATTRIBUTE_IMPACT;
  process.env.ATTRIBUTE_IMPACT = String(value);
  try { return fn(); }
  finally {
    if (prev === undefined) delete process.env.ATTRIBUTE_IMPACT;
    else process.env.ATTRIBUTE_IMPACT = prev;
  }
}

console.log('\n— canon —');
{
  check('six keys in canon order',
    ATTR_KEYS.join(',') === 'READS,FOCUS,DISCIPLINE,COMPOSURE,DECEPTION,STAMINA');
  check('defaults are all neutral',
    ATTR_KEYS.every((k) => defaultAttributes()[k] === NEUTRAL_ATTR));
  check('default potential is a band above the current value',
    defaultPotential().READS.lo === 50 && defaultPotential().READS.hi === 80);
}

console.log('\n— the knob —');
{
  check('default impact is 1', withImpact(1, () => attributeImpact()) === 1);
  check('clamped above at 1',  withImpact(4, () => attributeImpact()) === 1);
  check('clamped below at 0',  withImpact(-3, () => attributeImpact()) === 0);
  check('garbage falls back to 1', withImpact('nope', () => attributeImpact()) === 1);
  check('attrsActive false at knob 0', withImpact(0, () => attrsActive(80)) === false);
  check('attrsActive false without a value', withImpact(1, () => attrsActive(null)) === false);
  check('attrsActive true otherwise', withImpact(1, () => attrsActive(80)) === true);
}

console.log('\n— at() endpoints —');
withImpact(1, () => {
  check('0 maps to low',    near(at(0, 10, 22, 5), 22));
  check('100 maps to high', near(at(100, 10, 22, 5), 5));
  check('50 maps to the midpoint of low..high, NOT to neutral', near(at(50, 10, 22, 5), 13.5));
  check('inverted ranges work the same way', near(at(0, 100, 40, 160), 40) && near(at(100, 100, 40, 160), 160));
  check('out-of-range values clamp', near(at(-40, 0, -20, 20), -20) && near(at(999, 0, -20, 20), 20));
  check('non-numeric falls back to neutral 50', near(at(undefined, 0, -20, 20), 0));
});

console.log('\n— at() knob-0 identity —');
withImpact(0, () => {
  check('reads gate returns today\'s 10',           near(at(0, 10, 22, 5), 10) && near(at(100, 10, 22, 5), 10));
  check('focus sigma returns today\'s 0',           near(at(0, 0, 0.08, 0), 0) && near(at(100, 0, 0.08, 0), 0));
  check('discipline multiplier returns today\'s 1', near(at(0, 1, 1.6, 0.4), 1) && near(at(100, 1, 1.6, 0.4), 1));
  check('composure bonus returns today\'s 0',       near(at(0, 0, -20, 20), 0) && near(at(100, 0, -20, 20), 0));
  check('decay returns today\'s DECAY_HANDS',       near(at(0, 4, 6, 2), 4) && near(at(100, 4, 6, 2), 4));
  check('stamina onset returns today\'s 100',       near(at(0, 100, 40, 160), 100) && near(at(100, 100, 40, 160), 100));
});

console.log('\n— per-hook helper values (full impact) —');
withImpact(1, () => {
  check('READS 0 needs 22 hands, 100 needs 5',
    near(readMinHands({ reads: 0 }), 22) && near(readMinHands({ reads: 100 }), 5));
  check('READS 50 needs 13.5', near(readMinHands({ reads: 50 }), 13.5));
  check('no READS value leaves the base gate at 10', near(readMinHands({}), 10));
  check('DECEPTION 0 → ×0.6, 100 → ×2.4',
    near(deceptionMinHandsMultiplier(0), 0.6) && near(deceptionMinHandsMultiplier(100), 2.4));
  check('DECEPTION multiplies the READS gate',
    near(readMinHands({ reads: 100, deception: 100 }), 12));
  check('exploits gated below READS 40',
    exploitsAllowed(39) === false && exploitsAllowed(40) === true);
  check('FOCUS sigma 0 → 0.08, 100 → 0',
    near(focusSigma(0), 0.08) && near(focusSigma(100), 0));
  check('DISCIPLINE 0 → ×1.6, 50 → ×1.0, 100 → ×0.4',
    near(disciplineDeviationMultiplier(0), 1.6) &&
    near(disciplineDeviationMultiplier(50), 1.0) &&
    near(disciplineDeviationMultiplier(100), 0.4));
  check('COMPOSURE 0 → −20, 50 → 0, 100 → +20',
    near(composureTiltBonus(0), -20) && near(composureTiltBonus(50), 0) && near(composureTiltBonus(100), 20));
  check('COMPOSURE decay 0 → 6 hands, 50 → 4, 100 → 2',
    composureDecayHands(0, 4) === 6 && composureDecayHands(50, 4) === 4 && composureDecayHands(100, 4) === 2);
});

console.log('\n— per-hook helpers are inert at knob 0 —');
withImpact(0, () => {
  check('READS gate stays 10',      near(readMinHands({ reads: 0 }), 10) && near(readMinHands({ reads: 100 }), 10));
  check('DECEPTION multiplier is 1', deceptionMinHandsMultiplier(0) === 1 && deceptionMinHandsMultiplier(100) === 1);
  check('exploits always allowed',   exploitsAllowed(0) === true);
  check('FOCUS sigma is 0',          focusSigma(0) === 0 && focusSigma(100) === 0);
  check('DISCIPLINE multiplier is 1', disciplineDeviationMultiplier(0) === 1);
  check('COMPOSURE bonus is 0',      composureTiltBonus(0) === 0);
  check('COMPOSURE decay is the base', composureDecayHands(0, 4) === 4);
});

console.log('\n— ensureAttributes / attrLog —');
{
  const fresh = {};
  ensureAttributes(fresh);
  check('attaches all six at 50', ATTR_KEYS.every((k) => fresh.attrs[k] === 50));
  check('attaches a band per key', ATTR_KEYS.every((k) => Number.isFinite(fresh.potential[k].lo) && Number.isFinite(fresh.potential[k].hi)));
  check('nature starts null', fresh.nature === null);
  check('attrLog starts empty — growth is ATTR-3', Array.isArray(fresh.attrLog) && fresh.attrLog.length === 0);

  const partial = { attrs: { READS: 71, FOCUS: 'x' }, potential: { READS: { lo: 70, hi: 90 } }, attrLog: 'nope' };
  ensureAttributes(partial);
  check('keeps a value it already had', partial.attrs.READS === 71);
  check('repairs a non-numeric value', partial.attrs.FOCUS === 50);
  check('keeps a band it already had', partial.potential.READS.hi === 90);
  check('repairs a non-array attrLog', Array.isArray(partial.attrLog));

  const before = JSON.stringify(partial);
  ensureAttributes(partial);
  check('is idempotent', JSON.stringify(partial) === before);

  const logged = {};
  ensureAttributes(logged);
  logAttrChange(logged, { key: 'READS', from: 61, to: 62, cause: 'third showdown against the same opponent.', ts: 1 });
  check('logs {ts,key,from,to,cause}',
    logged.attrLog.length === 1 &&
    logged.attrLog[0].ts === 1 &&
    logged.attrLog[0].key === 'READS' &&
    logged.attrLog[0].from === 61 &&
    logged.attrLog[0].to === 62 &&
    typeof logged.attrLog[0].cause === 'string');
  check('refuses an unknown key', logAttrChange(logged, { key: 'LUCK', from: 1, to: 2 }) === null);
  for (let i = 0; i < ATTR_LOG_CAP + 50; i++) logAttrChange(logged, { key: 'FOCUS', from: 50, to: 51, cause: 'x', ts: i });
  check(`ring buffer caps at ${ATTR_LOG_CAP}`, logged.attrLog.length === ATTR_LOG_CAP);
  check('ring buffer keeps the newest', logged.attrLog[ATTR_LOG_CAP - 1].ts === ATTR_LOG_CAP + 49);
}

console.log('\n— effectiveAttrs: the fatigue curve —');
withImpact(1, () => {
  const agent = { attrs: { ...defaultAttributes(), FOCUS: 70, DISCIPLINE: 80, STAMINA: 50 } };
  check('STAMINA 50 → onset at hand 100', near(fatigueOnset(50), 100));
  check('STAMINA 0 → onset at hand 40, 100 → 160', near(fatigueOnset(0), 40) && near(fatigueOnset(100), 160));

  const h0 = effectiveAttrs(agent, { sessionHands: 0 });
  check('hand 0 is fresh and untouched', h0.fatigue === 'fresh' && h0.FOCUS === 70 && h0.DISCIPLINE === 80);

  const h99 = effectiveAttrs(agent, { sessionHands: 99 });
  check('one hand before onset is still fresh', h99.fatigue === 'fresh' && h99.FOCUS === 70);

  const h100 = effectiveAttrs(agent, { sessionHands: 100 });
  check('onset flips to settled with no drop yet', h100.fatigue === 'settled' && near(h100.FOCUS, 70));

  const h150 = effectiveAttrs(agent, { sessionHands: 150 });
  check('halfway to 2× onset costs half the drop',
    h150.fatigue === 'settled' && near(h150.FOCUS, 70 - MAX_FATIGUE_DROP / 2) && near(h150.DISCIPLINE, 80 - MAX_FATIGUE_DROP / 2));

  const h151 = effectiveAttrs(agent, { sessionHands: 151 });
  check('past 1.5× onset is worn', h151.fatigue === 'worn');

  const h200 = effectiveAttrs(agent, { sessionHands: 200 });
  check('2× onset is the full 20-point drop',
    near(h200.FOCUS, 50) && near(h200.DISCIPLINE, 60));

  const h500 = effectiveAttrs(agent, { sessionHands: 500 });
  check('the drop never exceeds 20', near(h500.FOCUS, 50) && near(h500.DISCIPLINE, 60));

  check('nothing but FOCUS and DISCIPLINE degrades',
    h500.READS === 50 && h500.COMPOSURE === 50 && h500.DECEPTION === 50 && h500.STAMINA === 50);

  const copy = JSON.stringify(agent);
  effectiveAttrs(agent, { sessionHands: 400 });
  check('effectiveAttrs is pure', JSON.stringify(agent) === copy);

  check('a bare six-value object works too',
    effectiveAttrs({ ...defaultAttributes(), STAMINA: 0 }, { sessionHands: 60 }).fatigue === 'settled');
  check('a missing record reads as all-neutral fresh',
    effectiveAttrs(null, { sessionHands: 0 }).FOCUS === 50);
});

console.log('\n— FOCUS noise is deterministic and mirror-stable —');
withImpact(1, () => {
  const seed = 'hand7:seat0:flop:AsKh:2d7c9h';
  check('same seed → same draw', seededNormal(seed) === seededNormal(seed));
  check('different seed → different draw', seededNormal(seed) !== seededNormal(`${seed}:po`));
  check('draw is clamped to ±3σ',
    [...Array(400)].every((_, i) => Math.abs(seededNormal(`s${i}`)) <= 3));

  check('FOCUS 100 sees the true number', perceiveEquity(0.412, 100, seed) === 0.412);
  const low = perceiveEquity(0.412, 20, seed);
  check('FOCUS 20 misjudges it', low !== 0.412);
  check('FOCUS below 35 also rounds to the nearest 5%', near(low * 20, Math.round(low * 20)));
  check('the misjudgment is repeatable for the same hand+seat', perceiveEquity(0.412, 20, seed) === low);
  check('perceived equity stays inside [0,1]',
    [...Array(200)].every((_, i) => {
      const v = perceiveEquity(0.02, 0, `edge${i}`);
      return v >= 0 && v <= 1;
    }));
  check('non-finite input passes through', perceiveEquity(null, 20, seed) === null);
});
console.log('\n— hooks: absent attrs behave exactly like today —');
withImpact(1, () => {
  // READS + DECEPTION → reads.js
  const read = { playerId: 'p1', displayName: 'House', handsObserved: 12, vpip: 96, pfr: 4, af: 0.2, foldToRaise: 6, wentToShowdown: 71 };
  const today = formatOpponentRead(read);
  check('read with no attrs briefs at 12 hands (gate 10)', today.length === 2);
  check('read with no attrs still gets its EXPLOIT line', /^EXPLOIT:/.test(today[1]));
  check('a 9-hand read is still withheld', formatOpponentRead({ ...read, handsObserved: 9 }).length === 0);

  // DISCIPLINE → policy.js
  check('deviation with no attrs is 100 − discipline',
    deviationPercent({ discipline: 72 }) === 28 && deviationPercent({ discipline: 0 }) === 100);
  const alwaysHigh = () => 0.999;
  const alwaysLow = () => 0.0;
  check('rollDice with no attrs is unchanged',
    rollDice({ discipline: 100, bluffFreq: 0 }, alwaysLow).deviationDie === false &&
    rollDice({ discipline: 0, bluffFreq: 100 }, alwaysHigh).deviationDie === true);

  // COMPOSURE → mood.js
  const stoic = { tightness: 88, aggression: 45, bluffFreq: 8, discipline: 90 };
  check('tiltResistance with no attrs is the trait alone', tiltResistance(stoic) === tiltResistance(stoic, {}));
  const moody = { state: 'tilted', uneventfulHands: DECAY_HANDS - 1 };
  check('tickDecay with no attrs still fires at DECAY_HANDS', tickDecay(moody).state === 'frustrated');
});

console.log('\n— hooks: knob 0 is bit-identical to today —');
{
  const read = { playerId: 'p1', displayName: 'House', handsObserved: 12, vpip: 96, pfr: 4, af: 0.2, foldToRaise: 6, wentToShowdown: 71 };
  const baseline = withImpact(1, () => formatOpponentRead(read));

  withImpact(0, () => {
    // READS 0 would push the gate to 22 hands and kill the exploit line at
    // full impact; at knob 0 it must do neither.
    const off = formatOpponentRead(read, { reads: 0, deception: 100 });
    check('READS/DECEPTION hooks are inert', JSON.stringify(off) === JSON.stringify(baseline));

    check('FOCUS hook is inert', perceiveEquity(0.412, 0, 'any seed') === 0.412);

    check('DISCIPLINE hook is inert',
      deviationPercent({ discipline: 72 }, { discipline: 0 }) === 28 &&
      deviationPercent({ discipline: 0 }, { discipline: 0 }) === 100);

    const stoic = { tightness: 88, aggression: 45, bluffFreq: 8, discipline: 90 };
    check('COMPOSURE tilt hook is inert',
      tiltResistance(stoic, { composure: 0 }) === tiltResistance(stoic) &&
      tiltResistance(stoic, { composure: 100 }) === tiltResistance(stoic));
    check('COMPOSURE decay hook is inert',
      tickDecay({ state: 'tilted', uneventfulHands: DECAY_HANDS - 1 }, { composure: 0 }).state === 'frustrated');

    const agent = { attrs: { ...defaultAttributes(), FOCUS: 70, DISCIPLINE: 80, STAMINA: 0 } };
    const worn = effectiveAttrs(agent, { sessionHands: 300 });
    check('STAMINA onset falls back to hand 100', near(worn.fatigueOnset, 100));
  });

  // The fatigue stage still moves at knob 0 (it is derived, not gated), but
  // the values it moves are neutralized by every downstream hook — which is
  // what "bit-identical" actually requires.
  withImpact(0, () => {
    const eff = effectiveAttrs({ attrs: { ...defaultAttributes(), FOCUS: 70 } }, { sessionHands: 300 });
    check('a worn agent at knob 0 still perceives the true equity',
      perceiveEquity(0.412, eff.FOCUS, 'seed') === 0.412);
    check('a worn agent at knob 0 still deviates at 100 − discipline',
      deviationPercent({ discipline: 72 }, { discipline: eff.DISCIPLINE }) === 28);
  });
}
console.log('\n— summary —');
if (failures === 0) {
  console.log('all attribute checks passed');
  process.exit(0);
} else {
  console.error(`${failures} attribute checks failed`);
  process.exit(1);
}

assert.ok(true);
