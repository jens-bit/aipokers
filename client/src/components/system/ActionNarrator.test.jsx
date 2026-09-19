import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActionNarrator, actionNarration } from './ActionNarrator.jsx';

const action={seq:4,handNumber:3,seat:0,street:'preflop',type:'raise',amount:2000,chips:1980,allIn:true};
const game={handNumber:3,street:'preflop',pace:'calm',community:[],seats:[{displayName:'Big Slick',holeCards:['6s','6h']},{displayName:'Granite',holeCards:[]}],lastAction:action};
const holding={seq:4,handNumber:3,seat:0,street:'preflop',label:'pocket sixes'};

describe('SHOW-3 deterministic action commentary',()=>{
  it('SHOW-3: only the actor owner gets the matching hand label; camera seat is not ownership',()=>{
    expect(actionNarration({...game,heroHand:holding},{mySeat:0})).toBe('Big Slick shoves with pocket sixes.');
    expect(actionNarration({...game,heroHand:holding},{mySeat:-1})).toBe('Big Slick shoves $1,980.');
    expect(actionNarration({...game,heroHand:holding},{mySeat:1})).toBe('Big Slick shoves $1,980.');
    expect(actionNarration({...game,heroHand:{...holding,seq:3}},{mySeat:0})).toBe('Big Slick shoves $1,980.');
  });
  it('SHOW-3: every accepted verb gets plain words and the engine amount',()=>{
    for(const [type,expected] of [['fold','folds.'],['check','checks.'],['call','calls $80.'],['bet','bets $80.'],['raise','raises to $80.']]) {
      expect(actionNarration({...game,lastAction:{...action,type,amount:80,chips:80,allIn:false}},{mySeat:0})).toBe(`Big Slick ${expected}`);
    }
  });
  it('SHOW-3: does not reveal the result ahead of the all-in cards',()=>{
    const terminal={...game,heroHand:holding,street:'complete',pace:'allin',community:['As','7d','2s','Kh','9c'],paceFrame:{board:[]},result:{type:'showdown',pot:4180,winners:[{seat:1,amount:4180,hand:'a pair of kings'}]}};
    expect(actionNarration(terminal,{mySeat:0})).toBe('Big Slick shoves with pocket sixes.');
    expect(actionNarration({...terminal,pace:'showdown',paceFrame:{board:terminal.community.slice(0,4)}},{mySeat:0})).toBe('Big Slick shoves with pocket sixes.');
    expect(actionNarration({...terminal,pace:'showdown',paceFrame:{board:terminal.community}},{mySeat:0})).toBe('Granite took $4,180 with a pair of kings.');
  });
  it('SHOW-3: says who takes an uncontested pot, and names both winners in a split',()=>{
    const end={...game,street:'complete',lastAction:{...action,seat:1,type:'fold',allIn:false},result:{type:'uncontested',pot:4180,winners:[{seat:0,amount:4180}]}};
    expect(actionNarration(end)).toBe('Granite folds. $4,180 to Big Slick.');
    expect(actionNarration({...end,result:{pot:200,winners:[{seat:0,amount:100},{seat:1,amount:100}]}})).toBe('Big Slick and Granite split $200.');
  });
  it('BUG-249: settled narration names the actual award after rake for ordinary and major pots', () => {
    for (const [pot, award, rake] of [[150, 148, 2], [12000, 11940, 60]]) {
      const result = { type: 'showdown', pot, winners: [{ seat: 0, amount: pot, hand: 'three sixes' }], rake: { total: rake, bySeat: { 0: rake } } };
      const original = structuredClone(result);
      const ended = { ...game, street: 'complete', result };
      expect(actionNarration(ended)).toBe(`Big Slick took $${award === 11940 ? '11,940' : '148'} with three sixes.`);
      expect(result).toEqual(original);
    }
  });
  it('BUG-249: a raked uncontested fold names the paid amount, not the gross pot', () => {
    const ended = { ...game, street: 'complete', lastAction: { ...action, seat: 1, type: 'fold', allIn: false },
      result: { type: 'uncontested', pot: 150, winners: [{ seat: 0, amount: 150 }], rake: { total: 2, bySeat: { 0: 2 } } } };
    expect(actionNarration(ended)).toBe('Granite folds. $148 to Big Slick.');
  });
  it('BUG-249: split-pot narration totals actual awards, retaining legacy fallback for incomplete winner amounts', () => {
    const ended = { ...game, street: 'complete', result: { pot: 200,
      winners: [{ seat: 0, amount: 100 }, { seat: 1, amount: 100 }], rake: { total: 3, bySeat: { 0: 1, 1: 2 } } } };
    expect(actionNarration(ended)).toBe('Big Slick and Granite split $197.');
    expect(actionNarration({ ...ended, result: { pot: 200,
      winners: [{ seat: 0, amount: 100 }, { seat: 1 }] } })).toBe('Big Slick and Granite split $200.');
  });
  it('BUG-249: repeated side-pot awards name each recipient once and deduct rake once per seat', () => {
    const ended = { ...game, street: 'complete', result: { pot: 2000,
      winners: [{ seat: 0, amount: 600 }, { seat: 0, amount: 400 }, { seat: 1, amount: 1000 }],
      rake: { total: 20, bySeat: { 0: 10, 1: 10 } } } };
    expect(actionNarration(ended)).toBe('Big Slick and Granite split $1,980.');
    expect(actionNarration({ ...ended, result: { pot: 1000, winners: ended.result.winners.slice(0, 2),
      rake: { total: 10, bySeat: { 0: 10 } } } })).toBe('Big Slick took $990.');
  });
  it('BUG-249: legacy total-only rake never subtracts twice and unknown payouts omit a number', () => {
    for (const amount of [150, 148]) {
      expect(actionNarration({ ...game, street: 'complete', result: { pot: 150,
        winners: [{ seat: 0, amount }], rake: { total: 2 } } })).toBe('Big Slick took $148.');
    }
    expect(actionNarration({ ...game, street: 'complete', result: {
      winners: [{ seat: 0 }], rake: { total: 2 } } })).toBe('Big Slick won the hand.');
  });
  it('SHOW-3: a new action sequence is announced again, but unrelated updates keep the same entry',()=>{
    const {container,rerender}=render(<ActionNarrator game={game} mySeat={-1}/>);
    const line=container.querySelector('[data-action-line]');
    expect(screen.getByRole('status')).toHaveTextContent('Big Slick shoves $1,980.');
    rerender(<ActionNarrator game={{...game,pot:4000}} mySeat={-1}/>);
    expect(container.querySelector('[data-action-line]')).toBe(line);
    rerender(<ActionNarrator game={{...game,lastAction:{...action,seq:5}}} mySeat={-1}/>);
    expect(container.querySelector('[data-action-line]')).not.toBe(line);
    rerender(<ActionNarrator game={{...game,handNumber:4,street:'waiting',lastAction:null}} mySeat={-1}/>);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
