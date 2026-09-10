import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bubbleRect } from '../src/components/home/roomBubbles.js';

const out = fileURLToPath(new URL('../../artifacts/bug185-browser/', import.meta.url));
mkdirSync(out, { recursive:true });
const line = 'Got a minute? That last hour was something. I will tell you the whole story in our conversation.';
const agent = (id='a', key='reads', over={}) => ({ id, name:id==='a'?'Professor':'Granite', nature:{name:'Professor'}, location:{where:'home'},
  routine:{key}, identity:{hood:'indigo',glow:'violet'}, mood:{state:'neutral',heat:20}, fatigue:'fresh',
  pocket:{balance:2000}, sessionLog:[], unseenRecap:true, sessionRecap:{at:1,text:line}, ...over });

async function boot(page, agents, game=null, table=null) {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const started=Date.now(), network=[], consoleErrors=[];
  page.on('requestfailed', r=>network.push({at:Date.now()-started,url:r.url(),failed:r.failure()?.errorText}));
  page.on('response', r=>network.push({at:Date.now()-started,url:r.url(),status:r.status()}));
  page.on('console', m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  const posts=[];
  await page.route('https://telegram.org/**', r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('**/api/**', r=>{
    const p=new URL(r.request().url()).pathname;
    if(r.request().method()==='POST'){
      posts.push({path:p,body:r.request().postDataJSON()});
      return r.fulfill({json:p.endsWith('/want')?{answered:'later',want:null}:{lines:[]}});
    }
    return r.fulfill({json:p==='/api/agents'?{agents}:p==='/api/slots'?{used:agents.length,cap:4,next:null}:p==='/api/wallet'?{balance:54000,ledger:[]}
      :p.includes('/thread')?{sessionId:'room',lines:[{id:1,kind:'him',who:'Professor',from:'a',to:'owner',source:'home',text:'I am here.'}]}
      :p.includes('/study')||p.endsWith('/book')?{study:null,book:[],count:0}:{rooms:[],events:[],items:[],lastId:0}});
  });
  await page.addInitScript(({agents,game,table})=>{
    window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',initDataUnsafe:{user:{id:4242}},get viewportHeight(){return innerHeight;},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},offEvent(){}}};
    window.__bubbleSockets=[];
    class Socket {
      constructor(){this.readyState=0;this.listeners={};window.__bubbleSockets.push(this);setTimeout(()=>{this.readyState=1;this.emit('open',{});this.push({type:'home_state',userId:'4242',agents,game});if(table)this.push({type:'state',state:table,legalActions:[]});},20);}
      emit(t,e){for(const f of this.listeners[t]??[])f(e);}
      push(m){this.emit('message',{data:JSON.stringify(m)});}
      addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
      removeEventListener(t,f){this.listeners[t]=(this.listeners[t]??[]).filter(v=>v!==f);}
      send(){} close(){this.readyState=3;}
    }
    Socket.OPEN=1;Socket.prototype.OPEN=1;window.WebSocket=Socket;
  },{agents,game,table});
  let homeVisibleAt=null;
  try {
    await page.goto('/');await expect(page.getByTestId('home-screen')).toBeVisible();
    homeVisibleAt=Date.now()-started;
  } catch(error) {
    await test.info().attach('boot-document',{body:await page.content(),contentType:'text/html'});
    await test.info().attach('boot-screenshot',{body:await page.screenshot(),contentType:'image/png'});
    throw error;
  } finally {
    await test.info().attach('boot-diagnostics',{body:JSON.stringify({homeVisibleAt,elapsed:Date.now()-started,errors,consoleErrors,network},null,2),contentType:'application/json'});
  }
  await expect(page.locator('.home-one').first()).toBeAttached();await page.evaluate(()=>document.fonts.ready);
  return {errors,posts};
}

const intersects=(a,b)=>a.x<b.x+b.width-.5&&b.x<a.x+a.width-.5&&a.y<b.y+b.height-.5&&b.y<a.y+a.height-.5;
async function inspectBubble(page,id,{blocked=false,allowTv=false}={}) {
  const owner=page.locator(`.home-one[data-agent="${id}"]`),bubble=owner.locator('.home-bubble');
  if(blocked){await expect(bubble).toHaveCount(0);return;}
  await expect(bubble).toBeVisible();await page.waitForTimeout(350);
  const flat=await page.locator('.home-flat').boundingBox(), hood=await owner.locator('.home-one__body').boundingBox();
  const box=await bubble.boundingBox(),tail=await bubble.locator('.home-bubble__tail').boundingBox();
  const scale=flat.width/(flat.width>400?560:390),side=await bubble.getAttribute('data-side');
  expect(box.y+box.height/2).toBeCloseTo(hood.y+hood.height/2,0);
  expect(box.width/scale).toBeLessThanOrEqual(150.1);
  expect(box.height/scale).toBeLessThanOrEqual(39.1);
  expect(Math.min(box.x,tail.x)).toBeGreaterThanOrEqual(flat.x+8*scale-.5);
  expect(Math.max(box.x+box.width,tail.x+tail.width)).toBeLessThanOrEqual(flat.x+flat.width-8*scale+.5);
  expect(side==='right'?tail.x<box.x:tail.x+tail.width>box.x+box.width).toBe(true);
  await expect(bubble).toHaveCSS('overflow','visible');await expect(bubble).toHaveCSS('pointer-events','none');
  await expect(bubble.locator('.home-bubble__text')).toHaveCSS('-webkit-line-clamp','2');
  const model=bubbleRect({x:(hood.x+hood.width/2-flat.x)/scale,y:(hood.y+hood.height-flat.y)/scale,size:hood.width/scale},side);
  for(const part of [box,tail]){
    expect((part.x-flat.x)/scale).toBeGreaterThanOrEqual(model.left-.5);
    expect((part.x+part.width-flat.x)/scale).toBeLessThanOrEqual(model.right+.5);
    expect((part.y-flat.y)/scale).toBeGreaterThanOrEqual(model.top-.5);
    expect((part.y+part.height-flat.y)/scale).toBeLessThanOrEqual(model.bottom+.5);
  }
  const blockers=await page.locator('.home-pill, .home-one__body').evaluateAll((nodes,id)=>nodes.filter(n=>!n.matches('.home-one__body')||n.closest('.home-one').dataset.agent!==id).map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}),id);
  for(const selector of ['[data-testid="home-safe"]','[data-testid="home-fridge"]','[data-testid="home-table"]','.home-flat__sign',...(allowTv?[]:['[data-testid="home-tv"]'])]){
    const element=page.locator(selector);if(await element.count())blockers.push(await element.first().boundingBox());
  }
  for(const part of [box,tail])for(const blocker of blockers.filter(Boolean))expect(intersects(part,blocker)).toBe(false);
}

for(const height of [844,590]) {
  for(const key of ['reads','paces','shuffles','counts','sleeps','tape','waits','sulks']) {
    test(`BUG-185: ${key} room speech clears the room at390x${height}`,async({page})=>{
      await page.setViewportSize({width:390,height});const {errors}=await boot(page,[agent('a',key)]);
      await inspectBubble(page,'a',{blocked:['waits','sulks'].includes(key),allowTv:key==='tape'});
      if(key==='reads')await page.screenshot({animations:'disabled',path:`${out}/reads-${height}.png`});
      const table=await page.getByTestId('home-table').boundingBox();await page.mouse.click(table.x+table.width/2,table.y+table.height/2);
      await expect(page.getByTestId('home-table-sheet-mobile')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);expect(errors).toEqual([]);
    });
  }
  test(`BUG-185: all real kitchen chairs retain table taps and guest labels at390x${height}`,async({page})=>{
    await page.setViewportSize({width:390,height});
    const agents=[0,1,2,3].map((n)=>agent(`seat${n}`,'plays',{guest:n===2}));
    const game={state:'running',tableId:'home-4242',maxSeats:4,seats:agents.map((a,seat)=>({seat,agentId:a.id,name:a.name}))};
    const {errors}=await boot(page,agents,game);
    await expect(page.getByTestId('home-pill-guest')).toBeVisible();
    await expect(page.locator('.home-bubble')).toHaveCount(0); // all four150px side boxes intersect the protected felt/edge
    const table=await page.getByTestId('home-table').boundingBox();await page.mouse.click(table.x+table.width/2,table.y+table.height/2);
    await expect(page.getByTestId('home-table-sheet-mobile')).toBeVisible();expect(errors).toEqual([]);
  });
  test(`BUG-185: one pending want stays once and answers at390x${height}`,async({page})=>{
    await page.setViewportSize({width:390,height});const ask='I am fresh. Put me in.';
    const {posts,errors}=await boot(page,[agent('a','reads',{want:{kind:'deploy',text:ask,needs:'deploy'}})]);
    await expect(page.getByText(ask,{exact:true})).toHaveCount(1);await expect(page.locator('.home-bubble')).toHaveCount(0);
    await expect(page.getByTestId('home-want-later')).toBeInViewport();await page.getByTestId('home-want-later').click();
    expect(posts).toEqual([{path:'/api/agents/a/want',body:{userId:'4242',answer:'later'}}]);expect(errors).toEqual([]);
  });
}

test('BUG-185: a served line clears at3s, stays quiet on a repeated push, and name tap still opens him',async({page})=>{
  const a=agent();const {errors}=await boot(page,[a]);
  await inspectBubble(page,'a');await expect(page.locator('.home-bubble')).toHaveCount(0,{timeout:3500});
  await page.evaluate(a=>{for(const s of window.__bubbleSockets)s.push({type:'home_state',userId:'4242',agents:[a],game:null});},a);
  await page.waitForTimeout(350);await expect(page.locator('.home-bubble')).toHaveCount(0);
  await page.locator('.home-one .home-pill').click();await expect(page.getByTestId('agent-stage')).toBeVisible();expect(errors).toEqual([]);
});

test('BUG-185: the conservative envelope contains the actual entrance animation and tail',async({page})=>{
  const a=agent();const {errors}=await boot(page,[{...a,unseenRecap:false}]);
  const samples=await page.evaluate(async a=>{
    for(const s of window.__bubbleSockets)s.push({type:'home_state',userId:'4242',agents:[a],game:null});
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
    const values=[];let started;
    return await new Promise(resolve=>{const sample=now=>{
      const bubble=document.querySelector('.home-bubble');
      if(bubble){started??=now;values.push({bubble:rect(bubble),tail:rect(bubble.querySelector('.home-bubble__tail')),body:rect(document.querySelector('.home-one__body')),flat:rect(document.querySelector('.home-flat'))});}
      if(started!==undefined&&now-started>400)return resolve(values);
      requestAnimationFrame(sample);
    };requestAnimationFrame(sample);});
  },a);
  expect(samples.length).toBeGreaterThan(3);
  expect(Math.min(...samples.map(s=>s.bubble.width))).toBeLessThan(149.5);
  for(const s of samples){
    const model=bubbleRect({x:s.body.x+s.body.width/2-s.flat.x,y:s.body.y+s.body.height-s.flat.y,size:s.body.width},'right');
    for(const part of [s.bubble,s.tail]){
      expect(part.x-s.flat.x).toBeGreaterThanOrEqual(model.left-.5);expect(part.x+part.width-s.flat.x).toBeLessThanOrEqual(model.right+.5);
      expect(part.y-s.flat.y).toBeGreaterThanOrEqual(model.top-.5);expect(part.y+part.height-s.flat.y).toBeLessThanOrEqual(model.bottom+.5);
    }
  }
  expect(errors).toEqual([]);
});

test('BUG-185: a desktop resident keeps native side geometry and its guest neighbour is protected',async({page})=>{
  await page.setViewportSize({width:1440,height:900});const {errors}=await boot(page,[agent(),agent('guest','sleeps',{guest:true,unseenRecap:false})]);
  await inspectBubble(page,'a');await expect(page.getByTestId('home-pill-guest')).toBeVisible();
  await page.screenshot({animations:'disabled',path:`${out}/desktop.png`});expect(errors).toEqual([]);
});
