// BUG-177: the remembered remark belongs to an occupied speaker, not a slot.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
const { Table }=await import('./table.js');
const { _closeForTests }=await import('./store.js');
const { chooseFromPolicy }=await import('../agent/policyPlay.js');
after(()=>_closeForTests());
let serial=0;
const ws=()=>({readyState:1,OPEN:1,received:[],send(text){this.received.push(JSON.parse(text));}});
function fixture(t,count=2) {
  const table=new Table({tableId:`bug177-${++serial}`,home:true,homeOwnerId:'first-owner',smallBlind:10,bigBlind:20,maxSeats:4});
  table._maybeRunAiTurn=async()=>{};
  table._broadcastState=()=>{};
  for(let n=0;n<count;n++)table.seatAI({displayName:'Same Name',stableId:`occupant-${n}`,userId:`owner-${n}`,buyIn:2000});
  table.autoPlay=true;table.maybeStartHand();
  t.after(()=>table._clearTimers());
  return table;
}

test('BUG-177: only a successfully sent public AI line is remembered after trimming', t => {
  const table=fixture(t), sent=ws();table.spectators.push({ws:sent,spectatorSeat:0});
  assert.equal(table._lastPublicAiLine?.[0],null);
  table.sendChat(0,'  I am coming with you.  ',true);
  assert.equal(table._lastPublicAiLine[0],'I am coming with you.');
  assert.equal(sent.received.at(-1).text,'I am coming with you.');
  table.sendChat(0,' ',true);table.sendChat(0,null,true);table.sendChat(0,'Owner says something',false);
  table.sendChat(3,'Empty chair',true);
  assert.equal(table._lastPublicAiLine[0],'I am coming with you.');
  assert.equal(table._lastPublicAiLine[3],null);
  table.sendChat(0,'x'.repeat(300),true);
  assert.equal(table._lastPublicAiLine[0],'x'.repeat(280));
  table._broadcast=()=>{throw Error('Synthetic failed delivery');};
  assert.throws(()=>table.sendChat(0,'Never delivered.',true),/failed delivery/);
  assert.equal(table._lastPublicAiLine[0],'x'.repeat(280));
});

test('BUG-177: hand caps and private owner/decision lines do not replace the public memory', t => {
  const table=fixture(t);table.agentIds[0]='agent-one';
  assert.equal(table._speakOnce(0,'Accepted public line.'),true);
  assert.equal(table._speakOnce(0,'Cap refused this one.'),false);
  assert.equal(table._lastPublicAiLine?.[0],'Accepted public line.');
  table.receiveWhisper('agent-one','Private owner instruction.');
  table._broadcastDecision({seat:0,action:{type:'call'},reasoning:'Private reasoning.',equity:0.6,potOdds:0.2});
  assert.equal(table._lastPublicAiLine[0],'Accepted public line.');
  table.whisperReply('agent-one','A private answer to the owner.');
  assert.equal(table._lastPublicAiLine[0],'Accepted public line.', 'BUG-257: private replies cannot feed later public speech');
});

test('BUG-177: the same speaker retains memory across hands and compaction, a new occupant starts clear', t => {
  const table=fixture(t,3);
  table.sendChat(1,'Second owner last said this.',true);
  table.sendChat(2,'Third owner last said this.',true);
  // More than the rolling20 messages must not erase a quiet speaker's memory.
  for(let n=0;n<25;n++)table.sendChat(0,`First owner ${n}`,true);
  assert.equal(table._lastPublicAiLine?.[1],'Second owner last said this.');
  const firstPlayer=table.pending[1].playerId;
  table._clearSeat(0);table._compactSeats();
  assert.equal(table.pending[0].playerId,firstPlayer);
  assert.equal(table._lastPublicAiLine[0],'Second owner last said this.');
  assert.equal(table._lastPublicAiLine[1],'Third owner last said this.');
  assert.equal(table._lastPublicAiLine[2],null);
  table.game=null;table.maybeStartHand();
  assert.equal(table._lastPublicAiLine[0],'Second owner last said this.');
  table._clearSeat(0);
  table.seatAI({displayName:'Same Name',stableId:'new-occupant',userId:'new-owner',buyIn:2000});
  assert.equal(table._lastPublicAiLine[0],null);
});

test('BUG-177: policy turn consumes only that speaker context and keeps it off owner snapshots', async t => {
  const table=fixture(t);
  const seat=table.game.toAct;
  const gs={...table._buildAiGameState(seat),handNumber:2,seat:0,street:'flop',nature:'Shark',
    equity:0.7,potOdds:0.25,canCheck:false,canBet:false,canRaise:false,toCall:10};
  const expected=chooseFromPolicy(gs);assert.equal(expected.say,'I am coming with you.');
  table.sendChat(seat,expected.say,true);
  table.sendChat(1-seat,'Other owner public line.',true);
  table._buildAiGameState=()=>gs;
  table.actionTimer={seat,key:'bug177-turn',deadlineTs:Date.now()};
  const before=structuredClone(gs);
  await Table.prototype._maybeRunAiTurn.call(table);
  assert.equal(table.chatHistory.at(-1).text,'Go on. I am still here.');
  assert.equal(table.chatHistory.at(-1).seat,seat);
  assert.deepEqual(table.currentHandDecisions.at(-1).action,expected.action);
  assert.equal(table.currentHandDecisions.at(-1).reasoning,expected.reasoning);
  assert.deepEqual(gs,before,'policy-only context must not be inserted into the model briefing');
  const own=ws(),other=ws();table.sendPlayerSnapshot(own,seat);table.sendPlayerSnapshot(other,1-seat);
  for(const peer of [own,other]) {
    assert.equal(JSON.stringify(peer.received).includes('lastPublic'),false);
    assert.equal(JSON.stringify(peer.received).includes('Other owner public line.'),false);
  }
});
