import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.DEV_API_SECRET;
process.env.TELEGRAM_BOT_TOKEN = 'synthetic-casino-bar-browser-token';
process.env.NOTIFY_ENABLED = '0';
const store = await import('../../../src/server/store.js');
const profiles = await import('../../../src/server/agentProfiles.js');
const registry = await import('../../../src/server/tableRegistry.js');
const { createServer } = await import('../../../src/server/wsServer.js');
const { installRoomRoutes } = await import('../../../src/server/rooms.js');
const { installRoomTableRoutes } = await import('../../../src/server/roomTables.js');
const owner='28101', agentId='bar-moss';
let table, orders=0;
const app=express();app.use(express.json());
app.use((req,res,next)=>{if(req.method==='POST'&&req.path.endsWith('/bar-order'))orders++;next();});
profiles.installAgentProfileRoutes(app);installRoomRoutes(app);installRoomTableRoutes(app);
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
const {wss}=createServer({server});
const backend=`http://127.0.0.1:${server.address().port}`;
const fields={id:owner,first_name:'Jens',auth_date:String(Math.floor(Date.now()/1000))};
const checked=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
const secret=crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
const credential=new URLSearchParams({...fields,hash:crypto.createHmac('sha256',secret).update(checked).digest('hex')}).toString();
function state(){return {tableId:table.tableId,orders,public:table.feltView(),hand:table.game.getPublicState(0),safe:store.loadWallet(owner).balance,
  fridge:store.loadWallet(owner).fridge,pocket:structuredClone(profiles._agentRecordForTests(agentId,owner).pocket)};}
function seed(){
  registry.resetRegistry('next bar case');orders=0;
  store.saveWallet(owner,{balance:10000,fridge:{beer:1,snack:0},ledger:[]});
  store.saveProfile(owner,{userId:owner,agents:['Moss','Copper'].map((name,i)=>({
    id:i?'bar-copper':agentId,name,status:'idle',activeTableId:null,style:'Balanced',risk:'Medium',strategy:'Wait for value.',
    bankroll:11000,pocket:{agentId:i?'bar-copper':agentId,balance:11000,mode:'allowance',cap:15000,realised:0,ledger:[]},
    identity:i?{hood:'oxblood',glow:'ice'}:{hood:'moss',glow:'gold'},
    wardrobe:{equipped:i?{head:null,face:'round-glasses',neck:null}:{head:'rail-cap',face:null,neck:'knit-scarf'}},
    nature:{name:'Rock'},mood:{state:'neutral',heat:30},stats:{handsPlayed:140,handsWon:55},
    profile:{tightness:60,aggression:45,bluffFreq:15,discipline:80},sessionLog:[],ledger:[],
  }))});
  profiles.reloadOwners(owner);profiles.setLiveTableProvider(registry);
  for(const id of [agentId,'bar-copper']){
    const deployed=profiles.deployAgent(owner,id,{body:{rung:2,together:true}});
    assert.equal(deployed.status,200,JSON.stringify(deployed.body));
    table=registry.tableOfAgent(id);table._maybeRunAiTurn=async()=>{};table._clearTimers();
  }
  assert.equal(registry.listTables().filter(t=>!t.home).length,1);
  table.maybeStartHand();table._clearTimers();
  const agent=profiles._agentRecordForTests(agentId,owner);
  agent.mood={state:'tilted',heat:75};profiles.setAgentStamina(agentId,owner,35);profiles.saveOwner(owner);
  table._broadcastState();
  return state();
}
function flop(){
  let actions=0;
  while(table.game.street==='preflop'){
    assert.ok(actions++<12);
    const seat=table.game.toAct,legal=table.game.legalActions(seat);
    const action=legal.find(a=>a.type==='check')??legal.find(a=>a.type==='call');assert.ok(action);
    table.game.act(seat,{type:action.type});
  }
  assert.equal(table.game.street,'flop');table._broadcastState();table._clearTimers();return state();
}
async function stop(){
  for(const ws of wss.clients)ws.terminate();registry.resetRegistry('bar fixture done');
  await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));store._closeForTests();
}
process.send({event:'ready',backend,credential,owner,agentId});
process.on('message',async({id,method})=>{try{
  if(method==='stop'){await stop();process.send({id});process.disconnect();return;}
  if(!['seed','state','flop'].includes(method))throw new Error('Unknown casino fixture method');
  process.send({id,result:({seed,state,flop})[method]()});
}catch(error){process.send({id,error:error.stack});}});
