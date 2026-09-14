import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { midHandGame } from '../src/test/fixtures/game.js';

const agents=[
  {id:'slick',name:'Big Slick'},
  {id:'oak',name:'Professor Oak',table:'table-oak'},
  {id:'plum',name:'Professor Plum',table:'table-plum'},
  {id:'bluff',name:'Bluff Master',nickname:'Bluff'},
].map(a=>({...a,nature:{name:'Rock'},identity:{hood:'indigo',glow:'violet'},mood:{state:'neutral',heat:20},
  fatigue:'fresh',location:{where:'casino'},routine:null,pocket:{balance:2000},sessionLog:[],
  ...(a.table?{activeTableId:a.table,liveGame:{tableId:a.table,board:['Ah','Kd','2c'],pot:480,street:'flop',heroSeat:0,seats:[{seat:0,displayName:a.name},{seat:1,displayName:'Granite'}]}}:{})}));

async function household(page,roster=agents){
  await page.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('**/api/**',r=>{
    const p=new URL(r.request().url()).pathname;
    const agent=roster.find(a=>p.includes(`/agents/${a.id}/`));
    return r.fulfill({json:p==='/api/agents'?{agents:roster}:p==='/api/wallet'?{balance:54000,ledger:[]}
      :p==='/api/slots'?{used:roster.length,cap:4,next:null}:p.includes('/thread')?{sessionId:'today',lines:[]}
      :p.includes('/memory')?{memoryContext:''}:p.endsWith('/profile')?{...agent,agent,stats:{},careerStats:{}}
      :p.includes('/study')?{study:null,book:[],count:0}:{rooms:[],events:[],items:[],lastId:0}});
  });
  await page.addInitScript(({agents,game})=>{
    window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
      initDataUnsafe:{user:{id:4242}},get viewportHeight(){return innerHeight;},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},offEvent(){}}};
    window.__awayMessages=[];
    class Socket{
      constructor(){this.readyState=0;this.listeners={};setTimeout(()=>{this.readyState=1;this.emit('open',{});
        // Real casino REST carries activeTableId; compact Home pushes omit it.
        this.push({type:'home_state',userId:'4242',agents:agents.map(({activeTableId,...compact})=>compact),game:null});},20);}
      emit(type,event){for(const f of this.listeners[type]??[])f(event);}
      push(value){this.emit('message',{data:JSON.stringify(value)});}
      addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
      removeEventListener(t,f){this.listeners[t]=(this.listeners[t]??[]).filter(v=>v!==f);}
      close(){this.readyState=3;}
      send(raw){const msg=JSON.parse(raw);window.__awayMessages.push(msg);if(msg.type==='watch')setTimeout(()=>{
        this.push({type:'watching',tableId:msg.tableId,mySeat:0});
        this.push({type:'state',state:{...game,tableId:msg.tableId},legalActions:[]});
      },20);}
    }
    Socket.OPEN=1;Socket.prototype.OPEN=1;window.WebSocket=Socket;
  },{agents:roster,game:midHandGame});
  await page.goto('/');await expect(page.getByTestId(`home-frame-${roster[0].id}`)).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
}

for(const size of [{width:390,height:844},{width:390,height:590},{width:1440,height:900}]){
  test(`BUG-190: compact AwayFrame names retain full destinations at ${size.width}x${size.height}`,async({page},testInfo)=>{
    await page.setViewportSize(size);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await household(page);
    await mkdir(testInfo.outputDir,{recursive:true});
    await page.screenshot({animations:'disabled',path:testInfo.outputPath('away-names.png')});
    await page.getByTestId('home-wall').screenshot({animations:'disabled',path:testInfo.outputPath('away-wall.png')});
    const names=await page.locator('.home-frame').evaluateAll(nodes=>nodes.map(e=>({id:e.dataset.agent,
      text:e.querySelector('.home-frame__name').textContent,accessible:e.getAttribute('aria-label')})));
    await writeFile(testInfo.outputPath('names.json'),JSON.stringify(names,null,2));
    expect(names.map(n=>[n.id,n.text])).toEqual([['slick','Big Sl'],['oak','Profes'],['plum','Profes'],['bluff','Bluff']]);
    // Same visible prefix must never select the other full identity/table.
    for(const a of agents.filter(a=>a.table)){
      await page.reload();await expect(page.getByTestId(`home-frame-${a.id}`)).toBeVisible();
      await page.getByRole('button',{name:`${a.name} at the casino. Watch him.`,exact:true}).click();
      await expect.poll(()=>page.evaluate(()=>window.__awayMessages.filter(m=>m.type==='watch').map(m=>({agentId:m.agentId,tableId:m.tableId,displayName:m.displayName})))).toEqual([
        {agentId:a.id,tableId:a.table,displayName:a.name},
      ]);
    }
    expect(errors).toEqual([]);
});
}

// BUG-207: "Open him" opens his agent view, not the numbers profile — see
// desktop-away-profile.spec.js's header note. The compact-plate identity this
// case protects is unaffected by which screen the tap lands on.
for(const height of [844,590])test(`BUG-190: a compact phone plate opens his full agent view at 390x${height}`,async({page})=>{
  await page.setViewportSize({width:390,height});await household(page);
  await page.getByRole('button',{name:'Big Slick at the casino. Open him.',exact:true}).click();
  await expect(page.getByRole('region',{name:"Big Slick's room",exact:true})).toBeVisible();
  await expect(page.locator('.agent-view__name')).toHaveText('Big Slick');
});

test('BUG-190: the source Bal nickname is carried by the same native name plate',async({page},testInfo)=>{
  const sourceAgent={...agents[1],id:'bal',name:'Balanced v2.1',nickname:'Bal',
    location:{where:'casino',room:'upstairs',since:Date.now()-41*60000},
    liveGame:{...agents[1].liveGame,net:3694,pot:4180,hot:true}};
  await household(page,[sourceAgent]);
  const frame=page.getByTestId('home-frame-bal'),name=frame.locator('.home-frame__name');
  await expect(name).toHaveText('Bal');
  await expect(frame).toHaveAccessibleName(/Balanced v2\.1 at the casino/);
  await mkdir(testInfo.outputDir,{recursive:true});
  await frame.screenshot({animations:'disabled',path:testInfo.outputPath('away-frame.png')});
  await name.screenshot({animations:'disabled',path:testInfo.outputPath('name.png')});
  await page.screenshot({animations:'disabled',path:testInfo.outputPath('home.png')});
});
