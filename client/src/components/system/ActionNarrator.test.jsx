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
