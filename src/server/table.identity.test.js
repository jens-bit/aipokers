import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Table } from './table.js';
import { Game } from '../engine/game.js';
import { saveProfile, _closeForTests } from './store.js';

// Run through the repository harness (each server file gets a scratch cwd).
test('BUG-111: live table projections preserve only the public saved identity',()=>{
  const identity={hood:'oxblood',glow:'ice',privateNote:'do not send'};
  saveProfile('identity111',{agents:[{id:'agent111',name:'Same name',identity,profile:{tightness:50,aggression:50,bluffFreq:25,discipline:60}}]});
  const table=new Table({tableId:'identity111',smallBlind:10,bigBlind:20});
  const seats=[{playerId:'p0',stack:2000},{playerId:'p1',stack:2000}];
  table.pending[0]={playerId:'p0',displayName:'Same name',buyIn:2000};
  table.pending[1]={playerId:'p1',displayName:'Same name',buyIn:2000};
  table.agentIds[0]='agent111';table.agentUserIds[0]='identity111';
  table.game=new Game({tableId:table.tableId,seats,smallBlind:10,bigBlind:20});
  table.game.startHand();table.autoPlay=true;
  try {
    const state=table._augmentState(table.game.getPublicState(-1),-1);
    for(const view of [state,table.liveGameView('agent111'),table.feltView()]) {
      assert.deepEqual(view.seats[0].identity,{hood:'oxblood',glow:'ice'});
      assert.equal(view.seats[1].identity,null);
    }
    assert.deepEqual(state.seats[0].holeCards,[]);
    assert.equal(JSON.stringify(state).includes('do not send'),false);
    table.agentIds[0]=null;
    assert.equal(table._augmentState(table.game.getPublicState(-1),-1).seats[0].identity,null);
  } finally {_closeForTests();}
});
