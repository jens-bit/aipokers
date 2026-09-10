// BUG-170: policy speech receives the saved nature of this exact owned seat.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
const { Table } = await import('./table.js');
const { saveProfile, _closeForTests } = await import('./store.js');
const { reloadOwners } = await import('./agentProfiles.js');
after(()=>_closeForTests());
let sequence=0;

function fixture(t) {
  const owner=`bug170-owner-${++sequence}`, other=`bug170-other-${sequence}`;
  const agentId=`bug170-agent-${sequence}`;
  // Same id in synthetic separate records makes an accidental global lookup
  // visibly wrong. Display name and numeric strategy must not reassign nature.
  for (const [userId,nature] of [[owner,'Rock'],[other,'Hothead']]) {
    saveProfile(userId,{userId,chat:[],agents:[{id:agentId,name:'Professor',nature:{name:nature},
      profile:{tightness:10,aggression:90,bluffFreq:90,discipline:20},
      pocket:{balance:3000},stats:{handsPlayed:0,handsWon:0}}]});
    reloadOwners(userId);
  }
  const table=new Table({tableId:`bug170-table-${sequence}`,home:true,homeOwnerId:owner,smallBlind:1,bigBlind:2,maxSeats:4});
  table._maybeRunAiTurn=async()=>{};
  t.after(()=>table._clearTimers());
  table.seatAI({agentId,userId:owner,displayName:'Professor',buyIn:200});
  table.seatAI({displayName:'House',stableId:'house',buyIn:200});
  table.autoPlay=true;
  table.maybeStartHand();
  return {table,owner,other,agentId};
}

test('BUG-170: actual policy state uses the stored owned nature rather than name or strategy',t=>{
  const {table}=fixture(t);
  assert.equal(table._buildAiGameState(0).nature,'Rock');
  assert.equal(table._buildAiGameState(1).nature,null,'House has no invented birth nature');
});

test('BUG-170: another owner or visiting seat never borrows the host agent nature',t=>{
  const {table,other}=fixture(t);
  table.agentUserIds[0]=other;
  assert.equal(table._buildAiGameState(0).nature,'Hothead','actual guest owner determines saved nature');
});

test('BUG-170: a seat with the wrong owner receives no other household nature',t=>{
  const {table}=fixture(t);
  table.agentUserIds[0]='bug170-no-such-owner';
  assert.equal(table._buildAiGameState(0).nature,null,'wrong owner must not find another household record');
});
