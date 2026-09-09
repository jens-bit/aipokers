import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';

delete process.env.ANTHROPIC_API_KEY;
process.env.TELEGRAM_BOT_TOKEN = '123456:visit-consent-local-test-only';
process.env.NOTIFY_ENABLED = '0';
process.env.HOME_GAME_TICK_MS = '600000';
process.env.HOME_PAUSE_MS = '600000';
process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_CHAT_MAX = '100000';
const store = await import('./store.js');
const profiles = await import('./agentProfiles.js');
const registry = await import('./tableRegistry.js');
const home = await import('./homeGame.js');
const visit = await import('./visit.js');
const guest = await import('./guest.js');
const place = await import('./place.js');
const tape = await import('./tapeRoom.js');
const claim = await import('./guestClaim.js');
const H='9301', G='9302', X='9303';
let server, base;
const agent = id => ({id,name:id,status:'idle',activeTableId:null,strategy:'Patient poker.',
  bankroll:3000,pocket:{balance:3000,mode:'allowance',cap:null,realised:0,ledger:[]},
  stats:{handsPlayed:0,handsWon:0},profile:{tightness:70,aggression:35,bluffFreq:10,discipline:80}});
function seed(owner, count=1) {
  store.saveProfile(owner,{userId:owner,chat:[],agents:Array.from({length:count},(_,i)=>agent(`${owner}-${i}`))});
  profiles.reloadOwners(owner);
}
function auth(id) {
  const q=new URLSearchParams({id,first_name:'Local',auth_date:String(Math.floor(Date.now()/1000))});
  const data=[...q].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  q.set('hash',crypto.createHmac('sha256',crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest()).update(data).digest('hex'));
  return q.toString();
}
async function post(url, body, owner=H) {
  const r=await fetch(base+url,{method:'POST',headers:{'content-type':'application/json',...(owner?{'x-telegram-init-data':auth(owner)}:{})},body:JSON.stringify(body)});
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={text};}
  return {status:r.status,body:data};
}
const issue=(stake=0,owner=G,id=`${G}-0`)=>post(`/api/agents/${id}/visit-invite`,{userId:owner,stake},owner);
async function knock({stake=0,host=H,invitationToken=null}={}) {
  const token=invitationToken??(await issue(stake)).body.invitationToken;
  return post(`/api/agents/${G}-0/visit`,{hostUserId:host,stake,invitationToken:token},host);
}
const answer=(id,accept=true,host=H)=>post(`/api/home/visitors/${id}/answer`,{hostUserId:host,accept},host);
const pocket=owner=>profiles.agentsOf(owner)[0].pocket.balance;
function configure(){profiles.setLiveTableProvider(registry);home.configure({liveTables:registry,agentsFor:id=>profiles.presentedRoster(id,{owner:true}),visitorsFor:id=>visit.listVisitorsFor(id)});visit.configure({liveTables:registry});}
before(async()=>{const app=express();app.use(express.json());guest.installGuestRoutes(app);claim.installClaimRoute(app);profiles.installAgentProfileRoutes(app);visit.installVisitRoutes(app);server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base=`http://127.0.0.1:${server.address().port}`;});
beforeEach(()=>{visit.reset();home.reset();registry.resetRegistry('visit consent test');if(store.adminDb().prepare("SELECT 1 FROM sqlite_master WHERE name='visits'").get()){store.adminDb().exec('DELETE FROM visits; DELETE FROM visit_invitations;');}seed(H);seed(G);seed(X);configure();});
after(async()=>{visit.reset();home.reset();registry.resetRegistry('visit consent complete');await new Promise(r=>server.close(r));store._closeForTests();});

test('BUG-149: a signed host cannot move a public agent id or escrow another owner without consent',async()=>{
  const r=await post(`/api/agents/${G}-0/visit`,{hostUserId:H,stake:200});
  assert.equal(r.status,403);assert.equal(r.body.reason,'invitationRequired');assert.equal(profiles.agentsOf(G)[0].visiting??null,null);assert.equal(pocket(G),3000);
});
test('BUG-149: only the actual signed owner can issue a bounded invitation',async()=>{
  assert.equal((await post(`/api/agents/${G}-0/visit-invite`,{userId:G},null)).status,401);
  assert.equal((await post(`/api/agents/${G}-0/visit-invite`,{userId:G},X)).status,403);
  assert.equal((await issue(0,X)).status,404);
  const r=await issue();assert.equal(r.status,200);assert.match(r.body.invitationToken,/^[A-Za-z0-9_-]{32}$/);assert.equal(r.body.startParam,`visit_${r.body.invitationToken}`);assert.equal(r.body.maxStake,0);
  const preview=await fetch(`${base}/api/visit-invites/${r.body.invitationToken}`).then(r=>r.json());
  assert.deepEqual(Object.keys(preview).sort(),['agentId','agentName','expiresAt','maxStake']);
  assert.equal(profiles.agentsOf(G)[0].visiting??null,null,'issuing a link never moves its owner');
});
test('BUG-149: invitation is agent-bound and rejects a host raising the agreed stake',async()=>{
  const made=await issue();const token=made.body.invitationToken;
  const raised=await post(`/api/agents/${G}-0/visit`,{hostUserId:H,stake:200,invitationToken:token});
  assert.equal(raised.status,403);assert.equal(raised.body.reason,'stakeNotAuthorized');
  const swapped=await post(`/api/agents/${X}-0/visit`,{hostUserId:H,invitationToken:token});
  assert.equal(swapped.status,403);assert.equal(pocket(G),3000);assert.equal(visit.pendingVisitorFor(H),null);
});
test('BUG-149: duplicate launch reuses one pending visit and a used invitation cannot move to another host',async()=>{
  const token=(await issue()).body.invitationToken;
  const [a,b]=await Promise.all([knock({invitationToken:token}),knock({invitationToken:token})]);
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.body.visitId,b.body.visitId);
  assert.equal((await knock({host:X,invitationToken:token})).status,409);
  await answer(a.body.visitId,false);assert.equal((await knock({invitationToken:token})).status,409);
});
test('BUG-149: tampered and expired capabilities cannot authorize travel',async()=>{
  const made=await issue();assert.equal((await knock({invitationToken:'x'.repeat(32)})).status,403);
  const real=Date.now;Date.now=()=>made.body.expiresAt+1;
  try{const r=await knock({invitationToken:made.body.invitationToken});assert.equal(r.status,410);assert.equal(r.body.reason,'invitationExpired');}finally{Date.now=real;}
  assert.equal(profiles.agentsOf(G)[0].visiting??null,null);
});
test('BUG-152: source home hand refuses departure honestly and remains a single unchanged seat',async()=>{
  seed(G,2);home.sync(G);const table=registry.getTable(home.homeTableId(G));table.maybeStartHand();assert.equal(table.handInProgress(),true);
  const r=await knock();assert.equal(r.status,409);assert.equal(r.body.reason,'inHand');assert.doesNotMatch(r.body.error,/will go/);assert.equal(profiles.agentsOf(G)[0].visiting??null,null);assert.ok(table.agentIds.includes(`${G}-0`));
});
test('BUG-153: an expired knock cannot be accepted before the sweep',async()=>{
  const pending=await knock();const real=Date.now;Date.now=()=>pending.body.respondBy+1;
  try{const r=await answer(pending.body.visitId);assert.equal(r.status,410);assert.equal(r.body.reason,'visitExpired');}finally{Date.now=real;}
  assert.equal(profiles.agentsOf(G)[0].visiting,null);assert.equal(pocket(G)+pocket(H),6000);
});
test('BUG-153: four eligible residents refuse acceptance before any wager debit',async()=>{
  seed(H,4);const pending=await knock({stake:200});const r=await answer(pending.body.visitId);
  assert.equal(r.status,409);assert.equal(r.body.reason,'hostFull');assert.equal(pocket(G),3000);assert.equal(pocket(H),3000);assert.ok(visit.pendingVisitorFor(H));
});
test('BUG-153: host hand is not truncated to add a visitor and its chips are untouched',async()=>{
  seed(H,2);home.sync(H);const table=registry.getTable(home.homeTableId(H));table.maybeStartHand();
  const pending=await knock({stake:200});const r=await answer(pending.body.visitId);
  assert.equal(r.status,409);assert.equal(r.body.reason,'hostInHand');assert.equal(table.closed,false);assert.equal(pocket(G),3000);
});
test('BUG-151: restart clears a persisted pending visit and legacy orphan stamp once',async()=>{
  const pending=await knock();assert.equal(pending.status,200);visit.reset();home.reset();registry.resetRegistry('restart');configure();
  assert.equal(typeof visit.reconcileVisits,'function');visit.reconcileVisits();assert.equal(profiles.agentsOf(G)[0].visiting,null);assert.equal(visit.pendingVisitorFor(H),null);
  profiles.agentsOf(X)[0].visiting={visitId:'old-orphan',hostUserId:H};profiles.saveOwner(X);visit.reconcileVisits();assert.equal(profiles.agentsOf(X)[0].visiting,null);visit.reconcileVisits();assert.equal(pocket(G),3000);
});
test('BUG-151: persisted escrow refunds both pockets exactly once across repeated restarts',async()=>{
  const pending=await knock({stake:200});assert.equal((await answer(pending.body.visitId)).status,200);assert.equal(pocket(G),2800);assert.equal(pocket(H),2800);
  for(let i=0;i<2;i++){visit.reset();home.reset();registry.resetRegistry('restart');profiles.reloadOwners(H,G);configure();assert.equal(typeof visit.reconcileVisits,'function');visit.reconcileVisits();assert.equal(pocket(G),3000);assert.equal(pocket(H),3000);assert.equal(profiles.agentsOf(G)[0].visiting,null);}
});
test('BUG-151: failed escrow persistence rolls back both wallets and accepted state',async()=>{
  const pending=await knock({stake:200});store.adminDb().exec(`CREATE TRIGGER reject_visit BEFORE UPDATE ON agents WHEN NEW.owner_id='${H}' BEGIN SELECT RAISE(ABORT,'local visit failure'); END;`);
  try{const r=await answer(pending.body.visitId);assert.equal(r.status,503);}finally{store.adminDb().exec('DROP TRIGGER reject_visit');}
  assert.equal(pocket(G),3000);assert.equal(pocket(H),3000);assert.ok(visit.pendingVisitorFor(H));assert.equal((await answer(pending.body.visitId)).status,200);assert.equal(pocket(G),2800);assert.equal(pocket(H),2800);
});

test('BUG-149: recipient identity is authenticated and another owner cannot answer the knock',async()=>{
  const invitationToken=(await issue()).body.invitationToken,body={hostUserId:H,invitationToken};
  assert.equal((await post(`/api/agents/${G}-0/visit`,body,null)).status,401);
  assert.equal((await post(`/api/agents/${G}-0/visit`,body,X)).status,403);
  const pending=await post(`/api/agents/${G}-0/visit`,body,H);
  assert.equal((await post(`/api/home/visitors/${pending.body.visitId}/answer`,{hostUserId:H,accept:true},X)).status,403);
  assert.equal((await answer(pending.body.visitId,true,X)).status,404);
  assert.equal(visit.pendingVisitorFor(H)?.id,pending.body.visitId);
});
test('BUG-151: interrupted refund failure is atomic and the next restart refunds only once',async()=>{
  const pending=await knock({stake:200});await answer(pending.body.visitId);
  visit.reset();home.reset();registry.resetRegistry('restart');configure();
  store.adminDb().exec(`CREATE TRIGGER reject_refund BEFORE UPDATE ON agents WHEN NEW.owner_id='${H}' BEGIN SELECT RAISE(ABORT,'local refund failure'); END;`);
  try{assert.throws(()=>visit.reconcileVisits(),/local refund failure/);}finally{store.adminDb().exec('DROP TRIGGER reject_refund');}
  assert.equal(pocket(G),2800);assert.equal(pocket(H),2800);
  visit.reconcileVisits();visit.reconcileVisits();assert.equal(pocket(G),3000);assert.equal(pocket(H),3000);
});
test('BUG-153: a cooling household refuses acceptance and retains its pending knock',async()=>{
  seed(H,2);home.sync(H);registry.getTable(home.homeTableId(H)).closeTable('local cooldown');home.sync(H);
  const pending=await knock({stake:200});const r=await answer(pending.body.visitId);
  assert.equal(r.status,409);assert.equal(r.body.reason,'hostPaused');assert.equal(pocket(G),3000);assert.ok(visit.pendingVisitorFor(H));
});
test('BUG-149: a cookie guest may host an invited agent but cannot issue one itself',async()=>{
  process.env.GUEST_ENABLED='1';
  try {
    const invitationToken=(await issue()).body.invitationToken;
    const made=await fetch(base+'/api/guest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({visitInvitationToken:invitationToken})});
    assert.equal(made.status,200);const cookie=made.headers.get('set-cookie').split(';')[0],{ownerId}=await made.json();seed(ownerId);
    assert.equal(guest.guestFor(ownerId).visitInvitationToken,invitationToken);
    const refused=await fetch(base+`/api/agents/${ownerId}-0/visit-invite`,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({userId:ownerId})});
    assert.equal(refused.status,403);assert.equal((await refused.json()).reason,'guestCannotVisit');
    const pending=visit.requestReferredVisit(ownerId);assert.equal(pending.status,200);assert.equal(visit.requestReferredVisit(ownerId).body.visitId,pending.body.visitId);
    const accepted=await fetch(base+`/api/home/visitors/${pending.body.visitId}/answer`,{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({hostUserId:ownerId,accept:true})});
    assert.equal(accepted.status,200);assert.equal((await accepted.json()).game.seats.some(s=>s.agentId===`${G}-0`),true);
  }finally{delete process.env.GUEST_ENABLED;}
});

test('BUG-151: deleting or retiring an escrow agent cannot strand the visit or its refund',async()=>{
  const pending=await knock({stake:200});assert.equal((await answer(pending.body.visitId)).status,200);
  for(const owner of [G,H]) {
    const del=await fetch(`${base}/api/agents/${owner}-0?userId=${owner}`,{method:'DELETE',headers:{'x-telegram-init-data':auth(owner)}});
    assert.equal(del.status,409);assert.equal((await del.json()).reason,'visitActive');
    const retire=await post(`/api/agents/${owner}-0/retire`,{userId:owner},owner);assert.equal(retire.status,409);assert.equal(retire.body.reason,'visitActive');
    assert.equal(profiles.archiveAllAgents(owner),0,'stale-guest retirement also waits for its visit');
  }
  visit.reset();home.reset();registry.resetRegistry('restart');configure();visit.reconcileVisits();assert.equal(pocket(G),3000);assert.equal(pocket(H),3000);
});
test('BUG-151: call-in refuses during the visit instead of claiming an unperformed return',async()=>{
  const pending=await knock({stake:200});await answer(pending.body.visitId);
  for(const owner of [G,H]){const r=await post(`/api/agents/${owner}-0/fund`,{userId:owner,verb:'callin'},owner);assert.equal(r.status,409);assert.equal(r.body.reason,'visitActive');assert.equal(pocket(owner),2800);}
});

test('BUG-152: an accepted visitor cannot also deploy, enter the tape room or finish a casino session',async()=>{
  const pending=await knock();await answer(pending.body.visitId);
  const before=registry.getTable(home.homeTableId(H));
  const deployed=profiles.deployAgent(G,`${G}-0`);assert.equal(deployed.status,409);assert.equal(deployed.body.reason,'visitActive');
  for(const fixture of ['table','couch','tv','door']){const moved=place.placeAgent(`${G}-0`,G,fixture);assert.equal(moved.status,409);assert.equal(moved.body.reason,'visitActive');}
  const study=tape.beginStudy(`${G}-0`,G);assert.equal(study.status,409);assert.equal(study.body.reason,'visitActive');
  const finished=await post(`/api/agents/${G}-0/finish`,{userId:G},G);assert.equal(finished.status,409);assert.equal(finished.body.reason,'visitActive');
  assert.equal(registry.homeTableOf(`${G}-0`),before);assert.equal(profiles.agentsOf(G)[0].activeTableId,null);
});

test('BUG-149: one invitation raced by two signed households only admits one host',async()=>{
  const token=(await issue()).body.invitationToken;
  const outcomes=await Promise.all([knock({host:H,invitationToken:token}),knock({host:X,invitationToken:token})]);
  assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
  const winner=outcomes.find(r=>r.status===200).body;
  assert.equal(profiles.agentsOf(G)[0].visiting.hostUserId,winner.hostUserId);
  assert.equal([visit.pendingVisitorFor(H),visit.pendingVisitorFor(X)].filter(Boolean).length,1);
  assert.equal(pocket(G),3000);
});
test('BUG-149: visit exemption does not exempt deploy or lookalike mutation routes',async()=>{
  for(const action of ['deploy','visit-invite','visit-other']){
    const r=await post(`/api/agents/${G}-0/${action}`,{userId:G,hostUserId:H},H);assert.equal(r.status,403);
  }
  assert.equal(profiles.agentsOf(G)[0].activeTableId,null);
});
test('BUG-151: an expired visit keeps an unfinished runout until the hand boundary then settles once',async()=>{
  const pending=await knock({stake:200});await answer(pending.body.visitId);
  const table=registry.getTable(home.homeTableId(H));table._pendingPaceResult={timers:[],afterAward:null};
  const future=Date.now()+3*60*60_000;
  visit._sweepNow(future);assert.equal(table.closed,false);assert.ok(profiles.agentsOf(G)[0].visiting);assert.equal(pocket(G),2800);
  table._pendingPaceResult=null;
  visit._sweepNow(future);visit._sweepNow(future);assert.equal(profiles.agentsOf(G)[0].visiting,null);assert.equal(pocket(G)+pocket(H),6000);
});
test('BUG-153: acceptance does not erase a human already seated at the host table',async()=>{
  home.sync(H,{manual:true});const table=registry.getTable(home.homeTableId(H));
  const slot=table.pending.findIndex(p=>p===null);table.pending[slot]={playerId:'human-host',displayName:'YOU',buyIn:200};table.aiSeats[slot]=false;table.agentUserIds[slot]=H;
  const pending=await knock();const r=await answer(pending.body.visitId);
  assert.equal(r.status,409);assert.equal(r.body.reason,'hostPlaying');assert.equal(table.closed,false);assert.equal(table.pending[slot].playerId,'human-host');
});
test('BUG-153: three residents and a human fill all four real chairs before acceptance',async()=>{
  seed(H,3);home.sync(H);const table=registry.getTable(home.homeTableId(H));
  const slot=table.pending.findIndex(p=>p===null);table.pending[slot]={playerId:'human-host',displayName:'YOU',buyIn:200};table.aiSeats[slot]=false;
  const pending=await knock({stake:200});const r=await answer(pending.body.visitId);
  assert.equal(r.status,409);assert.equal(r.body.reason,'hostFull');assert.equal(pocket(G),3000);assert.equal(table.closed,false);
});
test('BUG-149: a replay beyond the accepted visit hand cap never reports another live arrival',async()=>{
  const invitationToken=(await issue()).body.invitationToken;const pending=await knock({invitationToken});await answer(pending.body.visitId);
  registry.getTable(home.homeTableId(H)).handsThisSession=visit.VISIT_MAX_HANDS;
  assert.equal(visit.hasActiveVisit(H,G),false);
  const replay=await knock({invitationToken});assert.equal(replay.status,409);assert.equal(replay.body.reason,'invitationUsed');
});

for(const accepted of [false,true])test(`BUG-151: signed guest-host claim safely ends a ${accepted?'between-hand accepted':'pending'} visit before owner transfer`,async()=>{
  process.env.GUEST_ENABLED='1';
  const host=`g_claim_${accepted}`,token=`claim-${accepted}`;
  try{
    store.insertGuest({token,ownerId:host});seed(host);
    const invitationToken=(await issue(200)).body.invitationToken;
    const pending=visit.requestVisit({agentId:`${G}-0`,hostUserId:host,stake:200,invitationToken});assert.equal(pending.status,200);
    if(accepted)assert.equal(visit.answerVisit(pending.body.visitId,host,true).status,200);
    const result=await post('/api/guest/claim',{token},X);assert.equal(result.status,200);
    assert.equal(profiles.agentsOf(G)[0].visiting,null);assert.equal(visit.pendingVisitorFor(host),null);assert.equal(visit.listVisitorsFor(host).length,0);
    assert.equal(profiles.agentsOf(X).find(a=>a.id===`${host}-0`).pocket.balance,3000);assert.equal(pocket(G),3000);
    assert.equal(store.loadGuestByToken(token).claimedBy,X);
    visit.reconcileVisits();assert.equal(pocket(G),3000);
  }finally{delete process.env.GUEST_ENABLED;}
});
test('BUG-151: a signed guest claim waits for its active visit runout without moving identity or chips',async()=>{
  process.env.GUEST_ENABLED='1';const host='g_claim_runout',token='claim-runout';
  try{
    store.insertGuest({token,ownerId:host});seed(host);
    const invitationToken=(await issue(200)).body.invitationToken;
    const pending=visit.requestVisit({agentId:`${G}-0`,hostUserId:host,stake:200,invitationToken});visit.answerVisit(pending.body.visitId,host,true);
    const table=registry.getTable(home.homeTableId(host));table._pendingPaceResult={timers:[],afterAward:null};
    const result=await post('/api/guest/claim',{token},X);assert.equal(result.status,409);assert.equal(result.body.error,'visitInHand');
    assert.equal(store.loadGuestByToken(token).claimedBy,null);assert.equal(pocket(host),2800);assert.equal(pocket(G),2800);assert.equal(table.closed,false);
    table._pendingPaceResult=null;
    const retried=await post('/api/guest/claim',{token},X);assert.equal(retried.status,200);assert.equal(profiles.agentsOf(G)[0].visiting,null);assert.equal(pocket(G),3000);
  }finally{delete process.env.GUEST_ENABLED;}
});
test('BUG-152: a returning visitor does not erase the source household hand still in progress',async()=>{
  seed(G,3);const pending=await knock();
  const source=registry.getTable(home.homeTableId(G));source.maybeStartHand();const game=source.game;
  assert.equal(source.handInProgress(),true);assert.equal(source.agentIds.includes(`${G}-0`),false);
  assert.equal((await answer(pending.body.visitId,false)).status,200);
  assert.equal(source.closed,false);assert.equal(source.game,game);assert.equal(profiles.agentsOf(G)[0].visiting,null);
  home.sync(G);assert.equal(source.closed,false,'the periodic roster sync also waits');
});
