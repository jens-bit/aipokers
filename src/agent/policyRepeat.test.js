// BUG-177: reuse the existing public phrases without repeating this speaker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { instantLine, chooseFromPolicy } from './policyPlay.js';
import { NATURES } from './attributes.js';

const state = extra => ({ handNumber:2, seat:0, street:'flop', nature:'Shark',
  holeCards:['As','Ad'], community:['2c','7d','Th'], equity:0.7, potOdds:0.25,
  canCheck:false, canBet:false, canRaise:false, toCall:20, pot:60,
  policy:{profile:{tightness:50,aggression:50,bluffFreq:25,discipline:60},
    dice:{bluffDie:false,deviationDie:false}}, ...extra });

test('BUG-177: an exact repeat advances to the other existing action phrase', () => {
  const gs=state(), action={type:'call'};
  assert.equal(instantLine(gs,action),'I am coming with you.');
  assert.equal(instantLine(gs,action,{lastPublicLine:'I am coming with you.'}),'Go on. I am still here.');
  assert.equal(instantLine(gs,action,{lastPublicLine:'A different public remark.'}),'I am coming with you.');
  // History belongs to this speaker, even if other people talked in between.
  let previous=null;
  for(const handNumber of [2,13,22,35,44,57]) {
    const say=instantLine(state({handNumber,nature:'Rock'}),{type:'check'},{lastPublicLine:previous});
    assert.ok(say); assert.notEqual(say,previous); previous=say;
  }
});

test('BUG-177: unknown-nature river choices normalize truth before avoiding duplicates', () => {
  for(const nature of [undefined,null,'legacy unknown']) {
    const gs=state({nature,handNumber:25,street:'river'});
    assert.equal(instantLine(gs,{type:'call'}),"I'll pay.");
    assert.equal(instantLine(gs,{type:'call'},{lastPublicLine:"I'll pay."}),'Sure.');
    assert.equal(instantLine(gs,{type:'call'},{lastPublicLine:'Sure.'}),"I'll pay.");
    assert.equal(instantLine(state({nature,handNumber:35}),{type:'call'}),'One more card.');
  }
});

test('BUG-177: repeat avoidance preserves all 1000 of 8000 existing speaking opportunities', () => {
  const spoken=[];
  for(let handNumber=0;handNumber<100;handNumber++) for(let seat=0;seat<4;seat++) {
    for(const street of ['preflop','flop','turn','river']) for(const type of ['fold','check','call','bet','raise']) {
      const gs=state({handNumber,seat,street,nature:undefined}), action={type};
      const legacy=instantLine(gs,action);
      if(legacy)spoken.push(`${handNumber}:${seat}:${street}:${type}`);
      for(const nature of [undefined,'unknown',...NATURES.map(n=>n.name)]) {
        const input={...gs,nature}, first=instantLine(input,action);
        const next=instantLine(input,action,{lastPublicLine:first});
        assert.equal(Boolean(next),Boolean(legacy));
        if(first)assert.notEqual(next,first,`${nature}/${type}/${street}`);
      }
    }
  }
  assert.equal(spoken.length,1000);
  assert.equal(createHash('sha256').update(spoken.join('|')).digest('hex'),'c8c0167cad1e65d28e32fdfea95ae8861eb3acdbceebb6b52e4ba67a5d447284');
});

test('BUG-177: context changes only say, without RNG, private inputs or input mutation', t => {
  t.mock.method(Math,'random',()=>{throw Error('No extra random draw');});
  const gs=state(), before=structuredClone(gs);
  const {say,...expected}=chooseFromPolicy(gs);
  const context={lastPublicLine:say};
  const {say:next,...actual}=chooseFromPolicy(gs,context);
  assert.equal(next,'Go on. I am still here.');
  assert.deepEqual(actual,expected);
  assert.deepEqual(gs,before);
  assert.deepEqual(context,{lastPublicLine:say});
  assert.equal(chooseFromPolicy(gs,context).say,next);
  assert.equal(instantLine({...gs,holeCards:['2h','3d'],equity:0.01,
    opponentReads:[{private:'private read'}],tableTalk:'private owner instruction',
    name:'Different',mood:{state:'tilted',heat:99}},expected.action,context),next);
  assert.equal(instantLine(state({handNumber:1}),{type:'call'},context),null);
});
