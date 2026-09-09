// Run through the standard isolated server runner, never against live data.
// Synthetic owners, issued consent, real Home table/engine and wallet ledger.
import test, { afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
process.env.NOTIFY_ENABLED='0';
process.env.HOME_GAME_TICK_MS='600000';
process.env.HOME_PAUSE_MS='600000';
const store=await import('./store.js');
const profiles=await import('./agentProfiles.js');
const registry=await import('./tableRegistry.js');
const home=await import('./homeGame.js');
const visit=await import('./visit.js');
const {Actions,Streets}=await import('../engine/game.js');
const {Dealer,createDeck}=await import('../engine/deck.js');
const H='audit-151-host',G='audit-151-guest';
const agent=id=>({id,name:id,status:'idle',activeTableId:null,strategy:'Patient poker.',bankroll:3000,
  pocket:{balance:3000,mode:'allowance',cap:null,realised:0,ledger:[]},stats:{handsPlayed:0,handsWon:0},
  profile:{tightness:70,aggression:35,bluffFreq:10,discipline:80}});
function setup({thirdSeat=false}={}){
  for(const id of [H,G]){store.saveProfile(id,{userId:id,chat:[],agents:[agent(id+'-agent'),...(id===H&&thirdSeat?[agent(H+'-other')]:[])]});profiles.reloadOwners(id);}
  profiles.setLiveTableProvider(registry);
  home.configure({liveTables:registry,agentsFor:id=>profiles.presentedRoster(id,{owner:true}),visitorsFor:id=>visit.listVisitorsFor(id)});
  visit.configure({liveTables:registry});
  const invitation=visit.issueVisitInvitation({agentId:G+'-agent',userId:G,stake:200});assert.equal(invitation.status,200);
  const knock=visit.requestVisit({agentId:G+'-agent',hostUserId:H,stake:200,invitationToken:invitation.body.invitationToken});assert.equal(knock.status,200);
  assert.equal(visit.answerVisit(knock.body.visitId,H,true).status,200);
  const table=registry.getTable(home.homeTableId(H));assert.ok(table);
  table._clearTimers();table._maybeRunAiTurn=async()=>{};
  return {table,id:knock.body.visitId};
}
afterEach(()=>{visit.reset();home.reset();registry.resetRegistry('audit cleanup');store.adminDb().exec('DELETE FROM visits; DELETE FROM visit_invitations;');});
after(()=>store._closeForTests());
const pocket=id=>profiles.agentsOf(id)[0].pocket.balance;
const recordFor=id=>store.loadVisitRecords().find(v=>v.id===id);
function foldHand(table,loser=H){
  table.maybeStartHand();table._clearTimers();
  const losingSeat=table.agentIds.indexOf(loser+'-agent');
  while(table.game.street!==Streets.COMPLETE){
    const seat=table.game.toAct;
    const action=seat===losingSeat?Actions.FOLD:table.game.legalActions(seat).some(a=>a.type===Actions.CALL)?Actions.CALL:Actions.CHECK;
    table.game.act(seat,{type:action});
  }
  table._handCompleted();table._clearTimers();
}
function settle(id,expected){
  for(let i=0;i<2;i++)visit._sweepNow(Date.now()+3*60*60_000);
  assert.equal(recordFor(id).result.outcome,expected);
  assert.equal(pocket(G),expected==='guest'?3200:expected==='host'?2800:3000);
  assert.equal(pocket(H),expected==='host'?3200:expected==='guest'?2800:3000);
  assert.equal(profiles.agentsOf(G)[0].visiting,null);
}
for(const count of [39,40])test(`BUG-151: visitor winning after ${count} actual home hands receives the agreed wager`,()=>{
  const {table,id}=setup();let finalStacks;
  const guestSeat=table.agentIds.indexOf(G+'-agent'),hostSeat=table.agentIds.indexOf(H+'-agent');
  assert.equal(table.maxHands,40);
  for(let hand=0;hand<count;hand++){
    assert.equal(table.closed,false);table.maybeStartHand();table._clearTimers();
    assert.notEqual(table.game.street,Streets.WAITING);
    while(table.game.street!==Streets.COMPLETE){
      const seat=table.game.toAct;
      const action=seat===hostSeat?Actions.FOLD:table.game.legalActions(seat).some(a=>a.type===Actions.CALL)?Actions.CALL:Actions.CHECK;
      table.game.act(seat,{type:action});
    }
    finalStacks={guest:table.game.seats[guestSeat].stack,host:table.game.seats[hostSeat].stack};
    table._handCompleted();table._clearTimers();
  }
  assert.ok(finalStacks.guest>finalStacks.host);
  assert.equal(table.handsThisSession,count);
  assert.equal(table.closed,count===40);
  const before={hands:table.handsThisSession,closed:table.closed,inRegistry:!!registry.getTable(table.tableId),finalStacks,guestPocket:pocket(G),hostPocket:pocket(H)};
  visit._sweepNow(Date.now()+3*60*60_000);
  const result=store.loadVisitRecords().find(v=>v.id===id);
  console.log('BUG151_PROOF '+JSON.stringify({before,after:{guestPocket:pocket(G),hostPocket:pocket(H),status:result.status,result:result.result}}));
  assert.equal(pocket(G)+pocket(H),6000,'play-money conservation is independent of correct allocation');
  assert.equal(result.result.outcome,'guest','the known winning guest must not receive a push at natural close');
  assert.equal(pocket(G),3200);assert.equal(pocket(H),2800);
});

test('BUG-151: a host winner retains the outcome at natural close',()=>{
  const {table,id}=setup();table.maxHands=2;
  foldHand(table,G);foldHand(table,G);
  assert.equal(table.closed,true);settle(id,'host');
});

test('BUG-151: a higher Home hand cap does not change the forty-hand visit result',()=>{
  const {table,id}=setup();table.maxHands=100;
  for(let i=0;i<40;i++)foldHand(table,H);
  assert.equal(table.closed,false);assert.equal(table.handsThisSession,40);
  assert.equal(visit.hasActiveVisit(H,G),false,'no new visitor access beyond the visit cap');
  visit._sweepNow();
  assert.equal(recordFor(id).result.outcome,'guest');assert.equal(pocket(G),3200);assert.equal(pocket(H),2800);
});

test('BUG-151: an expiring visit closes on the current hand boundary and retains that result',()=>{
  const {table,id}=setup();table.maxHands=100;
  for(let i=0;i<39;i++)foldHand(table,H);
  table.maybeStartHand();table._clearTimers();assert.equal(table.handInProgress(),true);
  visit._sweepNow(Date.now()+3*60*60_000);
  assert.equal(table.closed,false);assert.equal(pocket(G),2800);
  // Finish the actual fortieth hand without starting a new deal.
  const h=table.agentIds.indexOf(H+'-agent');
  while(table.game.street!==Streets.COMPLETE){
    const seat=table.game.toAct,legal=table.game.legalActions(seat);
    table.game.act(seat,{type:seat===h?Actions.FOLD:legal.some(a=>a.type===Actions.CALL)?Actions.CALL:Actions.CHECK});
  }
  table._handCompleted();table._clearTimers();
  assert.equal(table.handsThisSession,40);assert.equal(table.closed,true);settle(id,'guest');
});

test('BUG-151: equal final stacks return both stakes after the hand cap',()=>{
  const {table,id}=setup();table.maxHands=4;
  // Each loses once from each blind, leaving their real engine stacks equal.
  for(const loser of [H,H,G,G])foldHand(table,loser);
  assert.equal(table.closed,true);
  assert.equal(recordFor(id).closedGame.guestStack,recordFor(id).closedGame.hostStack);
  settle(id,'push');
});

test('BUG-151: a natural watched bust retains its winning receipt only after the award',()=>{
  const {table,id}=setup();table.maybeStartHand();table._clearTimers();
  const sent=[],ws={OPEN:1,readyState:1,send(raw){sent.push(JSON.parse(raw));}};
  table.spectators.push({ws,spectatorSeat:table.agentIds.indexOf(G+'-agent')});
  const g=table.agentIds.indexOf(G+'-agent'),h=table.agentIds.indexOf(H+'-agent');
  table.game.seats[g].holeCards=['As','Ah'];table.game.seats[h].holeCards=['Ks','Kd'];
  const runout=['4c','5h','7d','9s','8c','Jc','Tc','Qh'];
  const used=new Set([...runout,...table.game.seats.flatMap(s=>s.holeCards)]);
  table.game.dealer=new Dealer([...runout,...createDeck().filter(c=>!used.has(c))]);
  while(table.game.street!==Streets.COMPLETE){
    const seat=table.game.toAct,legal=table.game.legalActions(seat),raise=legal.find(a=>a.type===Actions.RAISE);
    table._boardBeforeAct=[...table.game.community];
    table.game.act(seat,raise?{type:Actions.RAISE,amount:raise.max}:{type:legal.some(a=>a.type===Actions.CALL)?Actions.CALL:Actions.CHECK});
  }
  assert.equal(table.game.seats[h].stack,0);table._handCompleted();
  assert.ok(table._pendingPaceResult);assert.equal(table.closed,false);
  assert.equal(recordFor(id).closedGame,undefined);assert.equal(pocket(G),2800);
  visit._sweepNow(Date.now()+3*60*60_000);
  assert.equal(table.closed,false,'expiry still waits for the authored award');
  table._finishPaceHold();
  assert.equal(table.closed,true);
  assert.ok(sent.findIndex(m=>m.type==='hand_result')<sent.findIndex(m=>m.type==='table_closed'));
  settle(id,'guest');
});

for(const close of [true,false])test(`BUG-151: a retired wager participant retains its final stack at ${close?'table close':'live visit expiry'}`,()=>{
  const {table,id}=setup({thirdSeat:true});table.maxHands=close?2:100;table.maybeStartHand();table._clearTimers();
  const g=table.agentIds.indexOf(G+'-agent'),h=table.agentIds.indexOf(H+'-agent'),other=table.agentIds.indexOf(H+'-other');
  table.game.seats[g].holeCards=['As','Ah'];table.game.seats[h].holeCards=['Ks','Kd'];table.game.seats[other].holeCards=['2c','3c'];
  const runout=['4c','5h','7d','9s','8c','Jc','Tc','Qh'];
  const used=new Set([...runout,...table.game.seats.flatMap(s=>s.holeCards)]);
  table.game.dealer=new Dealer([...runout,...createDeck().filter(c=>!used.has(c))]);
  while(table.game.street!==Streets.COMPLETE){
    const seat=table.game.toAct,legal=table.game.legalActions(seat),raise=legal.find(a=>a.type===Actions.RAISE);
    table.game.act(seat,seat===other?{type:Actions.FOLD}:raise?{type:Actions.RAISE,amount:raise.max}:{type:legal.some(a=>a.type===Actions.CALL)?Actions.CALL:Actions.CHECK});
  }
  assert.equal(table.game.seats[h].stack,0);table._handCompleted();table._clearTimers();
  assert.equal(table.closed,false,'two survivors can play the next hand');
  table.maybeStartHand();table._clearTimers();
  assert.equal(table.agentIds.includes(H+'-agent'),false,'the real seat lifecycle retired the busted host');
  while(table.game.street!==Streets.COMPLETE){
    const seat=table.game.toAct,legal=table.game.legalActions(seat);
    table.game.act(seat,{type:table.agentIds[seat]===H+'-other'?Actions.FOLD:legal.some(a=>a.type===Actions.CALL)?Actions.CALL:Actions.CHECK});
  }
  table._handCompleted();table._clearTimers();assert.equal(table.closed,close);
  settle(id,'guest');
});

test('BUG-151: the existing invitation rule permits only one accepted visitor per host',()=>{
  setup();
  const other='audit-151-other';store.saveProfile(other,{userId:other,chat:[],agents:[agent(other+'-agent')]});profiles.reloadOwners(other);
  const issued=visit.issueVisitInvitation({agentId:other+'-agent',userId:other,stake:200});assert.equal(issued.status,200);
  const second=visit.requestVisit({agentId:other+'-agent',hostUserId:H,stake:200,invitationToken:issued.body.invitationToken});
  assert.equal(second.status,409);assert.equal(second.body.reason,'hostBusy');
  assert.equal(profiles.agentsOf(other)[0].visiting??null,null);
  assert.equal(store.loadVisitRecords().filter(v=>v.hostUserId===H&&['accepted','pending'].includes(v.status)).length,1);
});

test('BUG-151: closing an unfinished hand refunds instead of inferring a winner from committed chips',()=>{
  const {table,id}=setup();foldHand(table,H);
  table.maybeStartHand();table._clearTimers();assert.equal(table.handInProgress(),true);
  table.closeTable('local interruption');
  assert.equal(recordFor(id).closedGame.completed,false);settle(id,'push');
});

test('BUG-151: the saved receipt wins over an unrelated replacement using the same Home ID',()=>{
  const {table,id}=setup();table.maxHands=1;foldHand(table,H);
  const closure=recordFor(id).closedGame;
  assert.equal(closure.guestSessionId,table.sessionIdFor(G+'-agent'));
  assert.equal(closure.hostSessionId,table.sessionIdFor(H+'-agent'));
  assert.deepEqual(Object.keys(closure).sort(),['closedAt','completed','guestSessionId','guestStack','handsPlayed','hostSessionId','hostStack','tableId']);
  assert.equal(registry.getTable(table.tableId),null);
  const replacement=registry.getOrCreateTable(table.tableId,{home:true,homeOwnerId:H,maxSeats:4,smallBlind:1,bigBlind:2});
  replacement.pending[0]={playerId:'other',buyIn:9999};replacement.agentIds[0]=G+'-agent';replacement.agentUserIds[0]=G;
  replacement.seatStacks[0]=0;replacement.pending[1]={playerId:'different',buyIn:9999};replacement.agentIds[1]=H+'-agent';replacement.agentUserIds[1]=H;
  replacement.seatStacks[1]=9999;
  replacement.closeTable('unrelated replacement');
  assert.deepEqual(recordFor(id).closedGame,closure);settle(id,'guest');
});

test('BUG-151: a failed closing-receipt save cannot strand table cleanup and retries the original result',()=>{
  const {table,id}=setup();table.maxHands=1;
  store.adminDb().exec("CREATE TRIGGER reject_close_receipt BEFORE UPDATE ON visits WHEN json_extract(NEW.data,'$.closedGame') IS NOT NULL BEGIN SELECT RAISE(ABORT,'local receipt failure'); END;");
  try{assert.doesNotThrow(()=>foldHand(table,H));}finally{store.adminDb().exec('DROP TRIGGER reject_close_receipt');}
  assert.equal(table.closed,true);assert.equal(registry.getTable(table.tableId),null);
  assert.equal(recordFor(id).closedGame,undefined);assert.equal(pocket(G),2800);
  settle(id,'guest');assert.ok(recordFor(id).closedGame);
});

test('BUG-151: replacement seat sessions cannot manufacture a missing original result',()=>{
  const {table,id}=setup();table.maxHands=1;
  registry.setCloseHook(null);foldHand(table,H);assert.equal(recordFor(id).closedGame,undefined);
  visit.configure({liveTables:registry});
  const replacement=registry.getOrCreateTable(table.tableId,{home:true,homeOwnerId:H,maxSeats:4,smallBlind:1,bigBlind:2});
  for(const [seat,owner,stack] of [[0,G,0],[1,H,9999]]){
    replacement.pending[seat]={playerId:'replacement-'+owner,buyIn:stack};replacement.agentIds[seat]=owner+'-agent';
    replacement.agentUserIds[seat]=owner;replacement.seatSessionIds[seat]='different-'+owner;replacement.seatStacks[seat]=stack;
  }
  replacement.closeTable('different generation');
  assert.equal(recordFor(id).closedGame,undefined,'same owner and Home ID are insufficient without the accepted session UUID');
  settle(id,'push');
});

test('BUG-151: a failed payout is atomic and a later sweep pays the saved winner exactly once',()=>{
  const {table,id}=setup();table.maxHands=1;foldHand(table,H);
  store.adminDb().exec(`CREATE TRIGGER reject_winner BEFORE UPDATE ON agents WHEN NEW.owner_id='${H}' BEGIN SELECT RAISE(ABORT,'local payout failure'); END;`);
  try{assert.throws(()=>visit._sweepNow(),/local payout failure/);}finally{store.adminDb().exec('DROP TRIGGER reject_winner');}
  assert.equal(pocket(G),2800);assert.equal(pocket(H),2800);assert.equal(recordFor(id).status,'accepted');
  assert.equal(recordFor(id).settledAt,undefined);settle(id,'guest');
});

test('BUG-151: explicit boot still refunds an unclaimed closed-game wager once',()=>{
  const {table,id}=setup();table.maxHands=1;foldHand(table,H);assert.ok(recordFor(id).closedGame);
  visit.reset();home.reset();registry.resetRegistry('restart');
  visit.configure({liveTables:registry});visit.reconcileVisits();visit.reconcileVisits();
  assert.equal(recordFor(id).status,'interrupted');assert.equal(recordFor(id).result.outcome,'push');
  assert.equal(pocket(G),3000);assert.equal(pocket(H),3000);
});

test('BUG-151: restarting after a paid close cannot refund or pay the wager twice',()=>{
  const {table,id}=setup();table.maxHands=1;foldHand(table,H);settle(id,'guest');
  visit.reset();home.reset();registry.resetRegistry('restart');visit.configure({liveTables:registry});
  visit.reconcileVisits();visit.reconcileVisits();
  assert.equal(pocket(G),3200);assert.equal(pocket(H),2800);assert.equal(recordFor(id).result.outcome,'guest');
});

for(const change of ['add','remove'])test(`BUG-151: ${change} a resident at the hand boundary without reseating an ended visitor`,()=>{
  const {table,id}=setup({thirdSeat:change==='remove'});
  table.maybeStartHand();table._clearTimers();
  assert.equal(table.handInProgress(),true);
  if(change==='add')profiles.agentsOf(H).push(agent(H+'-new-resident'));
  else profiles.agentsOf(H).splice(profiles.agentsOf(H).findIndex(a=>a.id===H+'-other'),1);
  profiles.saveOwner(H);
  home.sync(H);
  assert.equal(registry.getTable(table.tableId),table,'a roster change must wait for this hand');
  assert.equal(table.closed,false);assert.equal(recordFor(id).closedGame,undefined);
  assert.equal(visit.hasActiveVisit(H,G),true);

  // The guest wins the existing legal hand; any third seat folds first.
  const g=table.agentIds.indexOf(G+'-agent');
  while(table.game.street!==Streets.COMPLETE){
    const seat=table.game.toAct,legal=table.game.legalActions(seat);
    table.game.act(seat,{type:seat!==g?Actions.FOLD:legal.some(a=>a.type===Actions.CALL)?Actions.CALL:Actions.CHECK});
  }
  table._handCompleted();table._clearTimers();home.sync(H);
  const replacement=registry.getTable(table.tableId);replacement?._clearTimers();
  assert.equal(table.closed,true);assert.ok(recordFor(id).closedGame);
  assert.equal(visit.hasActiveVisit(H,G),false);
  assert.equal(visit.listVisitorsFor(H).length,0);
  assert.equal(replacement?.agentIds.includes(G+'-agent')??false,false,'closed visitor must not enter a replacement game without membership');
  if(change==='add')assert.deepEqual(replacement.agentIds.filter(Boolean).sort(),[H+'-agent',H+'-new-resident'].sort());
  else assert.equal(replacement,null,'one remaining resident returns to the ordinary solo room');

  // Return to his own household is still performed by the existing sweep.
  profiles.agentsOf(G).push(agent(G+'-housemate'));profiles.saveOwner(G);home.sync(G);
  settle(id,'guest');
  const source=registry.getTable(home.homeTableId(G));source?._clearTimers();
  assert.ok(source?.agentIds.includes(G+'-agent'),'visitor returns to his own real household');
  assert.equal(source.agentIds.filter(id=>id===G+'-agent').length,1);
  assert.equal(registry.getTable(home.homeTableId(H))?.agentIds.includes(G+'-agent')??false,false);
});
