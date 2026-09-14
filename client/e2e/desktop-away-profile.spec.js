import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { midHandGame } from '../src/test/fixtures/game.js';

const agents=[
  {id:'slick',name:'Big Slick'},
  {id:'oak',name:'Professor Oak',table:'table-oak'},
  {id:'plum',name:'Professor Plum',table:'table-plum'},
  {id:'bluff',name:'Bluff Master',nickname:'Bluff'},
].map(a=>({...a,nature:{name:'Rock'},identity:{hood:'indigo',glow:'violet'},mood:{state:'neutral',heat:20},
  fatigue:'fresh',location:{where:'casino'},routine:null,pocket:{balance:2000},sessionLog:[],
  chatHistory:[{role:'user',content:'Keep that earlier read.'},{role:'assistant',content:'The earlier read is saved.'}],
  ...(a.table?{activeTableId:a.table,liveGame:{tableId:a.table,board:['5c','4h','8c'],pot:100,street:'flop',heroSeat:0,seats:[{seat:0,displayName:a.name},{seat:1,displayName:'Granite'}]}}:{})}));

async function household(page,roster=agents,roomRoster=roster){
  const requests=[];
  await page.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('**/api/**',r=>{
    const p=new URL(r.request().url()).pathname;
    requests.push({path:p,method:r.request().method(),body:r.request().postDataJSON(),headers:r.request().headers()});
    const agent=roster.find(a=>p.includes(`/agents/${a.id}/`));
    return r.fulfill({json:p==='/api/agents/chat'?{chat:[{role:'assistant',content:'I will wait for that hand.'}]}:p==='/api/agents'?{agents:roster}:p==='/api/wallet'?{balance:54000,ledger:[]}
      :p==='/api/slots'?{used:roster.length,cap:4,next:null}:p.includes('/thread')?{sessionId:'today',lines:[]}
      :p.includes('/memory')?{memoryContext:''}:p.endsWith('/hands')?{recentHands:[]}:p.endsWith('/profile')?{...agent,agent,stats:{},careerStats:{}}
      :p.includes('/study')?{study:null,book:[],count:0}:{rooms:[],events:[],items:[],lastId:0}});
  });
  await page.addInitScript(({agents,game})=>{
    window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
      initDataUnsafe:{user:{id:4242}},get viewportHeight(){return innerHeight;},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},offEvent(){}}};
    window.__awayMessages=[];
    class Socket{
      constructor(){this.readyState=0;this.listeners={};setTimeout(()=>{this.readyState=1;this.emit('open',{});this.push({type:'home_state',userId:'4242',agents:agents.map(({activeTableId,...a})=>a),game:null});},20);}
      emit(type,event){for(const f of this.listeners[type]??[])f(event);}
      push(value){this.emit('message',{data:JSON.stringify(value)});}
      addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
      removeEventListener(t,f){this.listeners[t]=(this.listeners[t]??[]).filter(v=>v!==f);}
      close(){this.readyState=3;}
      send(raw){const msg=JSON.parse(raw);window.__awayMessages.push(msg);if(msg.type==='watch')setTimeout(()=>{
        this.push({type:'watching',tableId:msg.tableId,mySeat:0});
        this.push({type:'state',state:{...game,tableId:msg.tableId,seats:game.seats.map((seat,i)=>i===0?{...seat,displayName:msg.displayName}:seat)},legalActions:[]});
      },20);}
    }
    Socket.OPEN=1;Socket.prototype.OPEN=1;window.WebSocket=Socket;
  },{agents:roomRoster,game:midHandGame});
  await page.goto('/');await expect(page.getByTestId(`home-frame-${roster[0].id}`)).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  return requests;
}

// BUG-207: these three tests used to open on the numbers Profile, with the
// room (AgentView) one tap deeper via "Back to chat". Jens's playtest
// instruction was explicit that this was the bug, not the design — "Open
// him" opens the agent view directly and Profile is one tap further in, from
// its own PROFILE button. Rewritten in that order rather than loosened; every
// identity, request-shape, draft-retention and guest-privacy assertion below
// still holds.
test('BUG-207: desktop opens an owned visiting companion but not a same-name guest projection',async({page})=>{
  const own={...agents[0],location:{where:'visiting'},visiting:{hostName:'Fidde'}},
    foreign={...own,id:'foreign-slick',guest:true,chatHistory:undefined};
  await page.setViewportSize({width:1440,height:900});
  const requests=await household(page,[own,agents[3]],[own,agents[3],foreign]);
  await page.getByTestId('home-frame-foreign-slick').click();
  await expect(page.locator('.agent-view')).toHaveCount(0);
  await page.getByTestId('home-frame-slick').click();
  const room=page.getByRole('region',{name:"Big Slick's room",exact:true});
  await expect(room).toBeVisible();
  await room.getByPlaceholder('Whisper to him…').fill('I can see you at Fidde’s.');
  await room.getByRole('button',{name:'Send',exact:true}).click();
  await expect(room.locator('.agent-view__thread').getByText('I will wait for that hand.',{exact:true})).toBeVisible();
  expect(requests.filter(r=>r.path.includes('/foreign-slick/'))).toEqual([]);
  expect(requests.filter(r=>r.path==='/api/agents/chat'&&r.method==='POST').map(r=>r.body)).toEqual([
    expect.objectContaining({existingAgentId:'slick',userId:'4242',content:'I can see you at Fidde’s.'})]);
  expect(await page.evaluate(()=>window.__awayMessages.filter(m=>m.type==='watch'))).toEqual([]);
});

for(const size of [{width:1440,height:900},{width:390,height:844},{width:390,height:590}]) {
test(`BUG-207: Open him lands on his agent view, and Profile preserves identity at ${size.width}x${size.height}`,async({page},testInfo)=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize(size);const requests=await household(page);
  const desktop=size.width>1000;
  const before=desktop?await page.locator('.home-flat').boundingBox():null;
  await page.getByRole('button',{name:'Big Slick at the casino. Open him.',exact:true}).click();
  const room=page.getByRole('region',{name:"Big Slick's room",exact:true});
  await expect(room).toBeVisible();
  await expect(room.locator('.agent-view__name')).toHaveText('Big Slick');
  if(desktop)expect(await page.locator('.home-flat').boundingBox()).toEqual(before);
  await page.screenshot({path:testInfo.outputPath(`room-${size.width}x${size.height}.png`)});
  await room.getByPlaceholder('Whisper to him…').fill('Wait for my next hand.');
  await room.getByRole('button',{name:'Send',exact:true}).click();
  await expect(room.locator('.agent-view__thread').getByText('I will wait for that hand.',{exact:true})).toBeVisible();
  for(const text of ['Keep that earlier read.','The earlier read is saved.','Wait for my next hand.','I will wait for that hand.'])
    await expect(room.locator('.agent-view__thread').getByText(text,{exact:true})).toHaveCount(1);
  const sends=requests.filter(r=>r.path==='/api/agents/chat'&&r.method==='POST');
  expect(sends).toEqual([expect.objectContaining({body:expect.objectContaining({existingAgentId:'slick',userId:'4242',content:'Wait for my next hand.'}),headers:expect.objectContaining({'x-telegram-init-data':expect.stringContaining('4242')})})]);
  await room.getByRole('button',{name:'Profile',exact:true}).click();
  const profile=page.getByRole('region',{name:"Big Slick's profile",exact:true});
  await expect(profile).toBeVisible();
  await expect(profile.locator('.agent-view__name')).toHaveText('Big Slick');
  await expect(profile.getByText('Condition',{exact:true})).toBeVisible();
  if(desktop)expect(await page.locator('.home-flat').boundingBox()).toEqual(before);
  await page.screenshot({path:testInfo.outputPath(`profile-${size.width}x${size.height}.png`)});
  await profile.getByRole('button',{name:'Back to chat',exact:true}).click();
  await expect(room).toBeVisible();
  if(desktop){
    const composer=room.getByPlaceholder('Whisper to him…');await composer.fill('Keep my draft');
    await page.getByTestId('home-frame-slick').click();await expect(room).toBeVisible();
    await expect(composer).toHaveValue('Keep my draft');
    await room.getByRole('button',{name:'Close panel',exact:true}).click();
    await expect(page.getByTestId('room-thread')).toBeVisible();
    expect(await page.locator('.home-flat').boundingBox()).toEqual(before);
  } else {
    await room.getByRole('button',{name:'Back',exact:true}).click();
  }
  await expect(page.getByTestId('home-frame-slick')).toBeVisible();
  expect(await page.evaluate(()=>window.__awayMessages.filter(m=>m.type==='watch'))).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(testInfo.outputPath('requests.json'),JSON.stringify(requests,null,2));
});
}

for(const width of [1440,390])for(const entry of ['away frame','television']) {
test(`BUG-192: existing ${entry} live Watch destination remains intact at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===1440?900:844});await household(page);
  await page.getByTestId(entry==='television'?'home-tv':'home-frame-plum').click();
  const id=entry==='television'?'oak':'plum',name=entry==='television'?'Professor Oak':'Professor Plum';
  await expect.poll(()=>page.evaluate(()=>window.__awayMessages.filter(m=>m.type==='watch'))).toEqual([expect.objectContaining({tableId:`table-${id}`,agentId:id,displayName:name})]);
  if(width===1440){
    await expect(page.getByTestId('desk-casino-table')).toHaveAccessibleName(`${name} at the table`);
    await page.getByRole('button',{name:'BACK TO THE FLOOR',exact:true}).click();
  }else{
    await expect(page.locator('.watch-felt')).toBeVisible();
    await page.getByRole('button',{name:'Leave table',exact:true}).click();
  }
  await expect(page.getByTestId('home-tv')).toBeVisible();
});
}
