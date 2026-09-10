// BUG-170: public instant remarks keep the saved nature's cadence.
// This changes no poker decision, speaking opportunity, or private reasoning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { instantLine, chooseFromPolicy } from './policyPlay.js';
import { NATURES } from './attributes.js';
import { isSolverSpeak, VOICE_MAX_WORDS } from './voice.js';

const actions = ['fold', 'check', 'call', 'bet', 'raise'];
const streets = ['preflop', 'flop', 'turn', 'river'];
const state = overrides => ({
  handNumber: 1, seat: 0, street: 'preflop', holeCards: ['As', 'Ad'],
  community: [], toCall: 20, canCheck: false, canRaise: true,
  minRaise: 40, maxRaise: 200, pot: 40, equity: 0.7, potOdds: 0.25,
  policy: { profile: {tightness:50,aggression:50,bluffFreq:25,discipline:60},
    dice:{bluffDie:false,deviationDie:false}, sizing:{openBB:3,cbetFraction:0.55} },
  ...overrides,
});

test('BUG-170: same action opportunities do not give every nature the same generic script', () => {
  for (const type of actions) {
    const scripts = NATURES.map(({name}) => Array.from({length:100}, (_,handNumber) =>
      instantLine(state({handNumber,nature:name}), {type})).filter(Boolean).join('|'));
    assert.equal(new Set(scripts).size, NATURES.length,
      `${type}: every authored nature should have a distinct register over its remarks`);
  }
});

test('BUG-170: nature preserves the exact old speaking mask and neutral fallback', () => {
  const spoken = [];
  for (let handNumber=0;handNumber<100;handNumber++) for (let seat=0;seat<4;seat++) {
    for (const street of streets) for (const type of actions) {
      const input = state({handNumber,seat,street});
      const legacy = instantLine(input,{type});
      if (legacy) spoken.push(`${handNumber}:${seat}:${street}:${type}`);
      for (const {name} of NATURES) assert.equal(
        Boolean(instantLine({...input,nature:name},{type})), Boolean(legacy),
        'voice must not add, remove or shift a speaking opportunity');
      assert.equal(instantLine({...input,nature:'unknown legacy nature'},{type}),legacy);
    }
  }
  // Captured before the repair: this is the existing 1-in-8 opportunity mask,
  // not a second implementation of its hash.
  assert.equal(createHash('sha256').update(spoken.join('|')).digest('hex'), 'c8c0167cad1e65d28e32fdfea95ae8861eb3acdbceebb6b52e4ba67a5d447284');
});

test('BUG-170: public words depend on action and nature, never private cards, names or mood', () => {
  for (const {name} of NATURES) for (const type of actions) {
    for (let handNumber=0;handNumber<80;handNumber++) {
      const input = state({handNumber,nature:name,street:'river'});
      const first = instantLine(input,{type});
      assert.equal(instantLine({...input,holeCards:['2c','3d'],equity:0.01,
        name:'Different name',displayName:'Different display name',mood:{state:'tilted',heat:100},
        opponentReads:[{private:'I know the opponent has kings'}],
        tableTalk:'private owner instruction'}, {type}),first);
      if (!first) continue;
      assert.ok(first.split(/\s+/).length<=VOICE_MAX_WORDS,first);
      assert.equal(isSolverSpeak(first),false,first);
      assert.doesNotMatch(first,/\b(ace|king|queen|jack|pair|flush|straight|nuts|bluff|won|win|lose|lost)\b/i);
      assert.doesNotMatch(first,/one more card|free card/i,'river remark cannot promise a future card');
    }
  }
});

test('BUG-170: changing nature leaves decisions, ratings, reasoning and input unchanged without RNG', t => {
  t.mock.method(Math,'random',()=>{throw new Error('Instant voice must never roll a die');});
  const base = state();
  const {say:ignored,...expected} = chooseFromPolicy(base);
  for (const {name} of NATURES) {
    const input = {...base,nature:name}, before=structuredClone(input);
    const {say,...actual} = chooseFromPolicy(input);
    assert.deepEqual(actual,expected);
    assert.deepEqual(input,before);
    assert.equal(say,chooseFromPolicy(input).say);
  }
});

test('BUG-170: a legacy river caller does not promise another community card', () => {
  for (const nature of [null,undefined,'legacy unknown']) {
    assert.equal(instantLine(state({handNumber:25,street:'river',nature}),{type:'call'}),"I'll pay.");
    for (const [street,handNumber] of [[undefined,30],['preflop',12],['flop',35],['turn',20]]) {
      assert.equal(instantLine(state({handNumber,street,nature}),{type:'call'}),'One more card.');
    }
  }
});
