import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { installAgentProfileRoutes, reloadOwners } from './agentProfiles.js';
import { loadWallet, loadProfile, saveWallet, saveProfile, moveOwner, _closeForTests } from './store.js';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
// This suite deliberately drafts repeatedly from one local IP; limiter rules
// have their own tests and must not prevent reaching the accounting path.
process.env.RATE_LIMIT_CHAT_MAX='1000';

const app=express();app.use(express.json());installAgentProfileRoutes(app);
let server,base;
test.before(async()=>{server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{await new Promise(r=>server.close(r));_closeForTests();});
const request=async(method,path,body)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value;};
const build=async userId=>(await request('POST','/api/agents/build',{userId})).createdAgent;
const retire=(userId,id)=>request('POST','/api/agents/'+id+'/retire?userId='+userId,{userId});
const total=userId=>loadWallet(userId).balance+loadProfile(userId).agents.reduce((n,a)=>n+(a.pocket?.balance??0),0);

test('BUG-136: repeated draft and retirement conserve the one owner starting grant',async()=>{
 const owner='bug136-retire';const first=await build(owner);assert.equal(first.pocket.balance,2000);assert.equal(total(owner),10000);
 for(let i=0,agent=first;i<3;i++){
  await retire(owner,agent.id);assert.equal(total(owner),10000);
  agent=await build(owner);assert.equal(total(owner),10000,'a replacement is funded from existing chips');assert.equal(agent.pocket.balance,2000);
 }
});
test('BUG-136: deleting every agent cannot reopen the grant after cache reload',async()=>{
 const owner='bug136-delete';const first=await build(owner);await retire(owner,first.id);
 await request('DELETE','/api/agents/'+first.id+'?userId='+owner);
 reloadOwners(owner);
 const next=await build(owner);assert.equal(total(owner),10000);assert.equal(next.pocket.balance,2000);
});
test('BUG-136: the grant marker survives an empty safe, truncated ledger and owner claim',async()=>{
 const from='bug136-guest',to='bug136-claimed';const a=await build(from);await retire(from,a.id);
 await request('DELETE','/api/agents/'+a.id+'?userId='+from);
 const wallet=loadWallet(from);wallet.balance=0;wallet.ledger=[];saveWallet(from,wallet);
 saveWallet(to,{ownerId:to,balance:0,earned:0,ledger:[]});moveOwner(from,to);reloadOwners(from,to);
 const b=await build(to);assert.equal(b.pocket.balance,0);assert.equal(total(to),0,'an exhausted household cannot mint another grant');
 assert.equal(loadWallet(to).startingGrantClaimed,true);
});
test('BUG-136: replacement drafts for legacy households use the existing safe',async()=>{
 const owner='bug136-legacy';saveProfile(owner,{userId:owner,chat:[],agents:[{id:'old',name:'Old',archived:true,pocket:{balance:0}}]});
 saveWallet(owner,{ownerId:owner,balance:500,earned:0,ledger:[]});reloadOwners(owner);
 const a=await build(owner);assert.equal(a.pocket.balance,500);assert.equal(total(owner),500);
});
test('BUG-136: the legacy reload route funds a bust from the safe without a new grant',async()=>{
 const owner='bug136-reload';const a=await build(owner);const profile=loadProfile(owner);
 profile.agents[0].pocket.balance=0;profile.agents[0].bankroll=0;saveProfile(owner,profile);reloadOwners(owner);
 const before=total(owner);await request('POST','/api/agents/'+a.id+'/reload',{userId:owner});
 assert.equal(loadProfile(owner).agents[0].pocket.balance,2000);assert.equal(total(owner),before);
});
test('BUG-136: reload refuses an empty safe and a retired agent without changing balances',async()=>{
 const owner='bug136-reload-refusal';const a=await build(owner);const profile=loadProfile(owner);
 profile.agents[0].pocket.balance=0;profile.agents[0].bankroll=0;
 const wallet=loadWallet(owner);wallet.balance=0;saveProfile(owner,profile,wallet);reloadOwners(owner);
 const call=()=>fetch(base+'/api/agents/'+a.id+'/reload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:owner})});
 const empty=await call();assert.equal(empty.status,409);await empty.json();assert.equal(total(owner),0);
 await retire(owner,a.id);const retired=await call();assert.equal(retired.status,409);await retired.json();assert.equal(total(owner),0);
});
test('BUG-136: a failed profile write rolls back safe and starting-grant marker together',()=>{
 const owner='bug136-atomic';saveWallet(owner,{ownerId:owner,balance:0,earned:0,ledger:[]});
 const broken={id:'broken'};broken.self=broken;
 assert.throws(()=>saveProfile(owner,{userId:owner,chat:[],agents:[broken]},{ownerId:owner,balance:8000,startingGrantClaimed:true,ledger:[]}));
 assert.equal(loadWallet(owner).balance,0);assert.equal(loadWallet(owner).startingGrantClaimed,undefined);
});
