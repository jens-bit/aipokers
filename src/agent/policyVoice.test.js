// BUG-170: public instant remarks keep the saved nature's cadence.
// This changes no poker decision and no speaking opportunity.
//
// LIFE-2 job 4 amended the header's third clause. It read "or private
// reasoning", and that is no longer true on purpose: the line under his ghost
// on the felt is now his nature's too. See the rewritten test below for why,
// and voice.js NATURE_ACTION_LINE for the table. Everything else BUG-170 pinned
// is pinned harder.
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

// LIFE-2 job 4 REWROTE this test rather than loosening it, and the rule it
// encoded is one the product no longer wants.
//
// It used to require that changing the nature left `reasoning` unchanged along
// with the decision, the ratings and the input. That fourth clause was BUG-170
// saying what IT was touching — only the public bubble — not a law about the
// product. `reasoning` is the line under his ghost on the felt, and leaving it
// nature-blind meant a Rock and a Showman at one table, both folding, both said
// "Not with this one." for the whole session. Since COST-1 the compiled policy
// answers a large share of decisions, so that fallback is most of what an owner
// watching an unwatched-then-opened table actually reads.
//
// The three clauses that ARE laws are unchanged and still asserted here: nature
// moves no poker decision, no rating, no input, and rolls no die. What is added
// is strictly stronger than what was removed — `reasoning` must now DIFFER
// between two natures in the same spot, which nothing asserted before.
test('BUG-170/LIFE-2: nature moves the voice and nothing else, and never rolls a die', t => {
  t.mock.method(Math,'random',()=>{throw new Error('Instant voice must never roll a die');});
  const base = state();
  const {say:baseSay,reasoning:baseReasoning,...expected} = chooseFromPolicy(base);
  const reasonings = new Set();
  for (const {name} of NATURES) {
    const input = {...base,nature:name}, before=structuredClone(input);
    const {say,reasoning,...actual} = chooseFromPolicy(input);
    assert.deepEqual(actual,expected,`${name} moved the poker`);
    assert.deepEqual(input,before,`${name} mutated its input`);
    assert.equal(say,chooseFromPolicy(input).say);
    assert.equal(reasoning,chooseFromPolicy(input).reasoning,`${name} is not deterministic`);
    reasonings.add(reasoning);
  }
  // LIFE-2 job 4: eight natures, eight different lines under the ghost — and
  // none of them the natureless one a House regular still gets.
  assert.equal(reasonings.size,NATURES.length,`${[...reasonings].join(' | ')}`);
  assert.equal(reasonings.has(baseReasoning),false,'a nature borrowed the house line');
});

test('BUG-170: a legacy river caller does not promise another community card', () => {
  for (const nature of [null,undefined,'legacy unknown']) {
    assert.equal(instantLine(state({handNumber:25,street:'river',nature}),{type:'call'}),"I'll pay.");
    for (const [street,handNumber] of [[undefined,30],['preflop',12],['flop',35],['turn',20]]) {
      assert.equal(instantLine(state({handNumber,street,nature}),{type:'call'}),'One more card.');
    }
  }
});
