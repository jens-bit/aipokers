import test from 'node:test';
import assert from 'node:assert/strict';
import {homeStateMessage} from './home.js';

test('BUG-168: Home previews carry only public table/seat appearance even from owner or visitor records',()=>{
  const liveGame={tableId:'home-host',home:true,street:'flop',board:['Ah','Kd','2c'],pot:60,heroSeat:0,handNumber:7,blinds:'1/2',heroHole:['Qs','Qd'],reasoning:'private read',strategy:'private plan',seats:[{displayName:'Bird',identity:{hood:'indigo',glow:'violet',secret:'no'},mood:{state:'neutral',heat:20,private:'no'},holeCards:['Qs','Qd'],history:'nemesis',reasoning:'no'}]};
  for(const guest of [false,true]){
    const view=homeStateMessage('owner',[{id:'bird',name:'Bird',guest,liveGame}]).agents[0];
    assert.equal(view.guest,guest);assert.equal(view.liveGame.tableId,'home-host');
    assert.deepEqual(view.liveGame.board,['Ah','Kd','2c']);assert.equal(view.liveGame.pot,60);
    const text=JSON.stringify(view);for(const privateValue of ['Qs','Qd','private','secret','nemesis'])assert.equal(text.includes(privateValue),false,privateValue);
    assert.deepEqual(view.liveGame.seats,[{displayName:'Bird',identity:{hood:'indigo',glow:'violet'},mood:{state:'neutral',heat:20}}]);
  }
});
test('BUG-168: Home explicitly clears an absent preview and copies public board/seat data',()=>{
  assert.equal(homeStateMessage('owner',[{id:'bird'}]).agents[0].liveGame,null);
  const board=['Ah'],seats=[{displayName:'Bird'}];const view=homeStateMessage('owner',[{id:'bird',liveGame:{tableId:'live',board,seats}}]).agents[0].liveGame;
  board.push('Kd');seats[0].displayName='changed';assert.deepEqual(view.board,['Ah']);assert.equal(view.seats[0].displayName,'Bird');
});
