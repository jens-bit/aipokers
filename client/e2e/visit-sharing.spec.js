import { test, expect } from '@playwright/test';

const token = '0123456789abcdefghijklmnopqrstuv';
const agent = { id:'friend1', name:'Away Day', status:'idle', style:'Tight', risk:'Low', nature:{name:'Rock'}, mood:{state:'neutral',heat:20}, location:{where:'home'}, fatigue:'fresh', opener:'Cards first.', pocket:{balance:2000}, stats:{handsPlayed:40}, careerStats:{hands:40,sessions:2,net:300}, sessionLog:[], chatHistory:[], want:null };
const preview = { agentId:agent.id, agentName:agent.name, expiresAt:Date.now()+3600000, maxStake:0 };
const invitation = { ...preview, invitationToken:token, startParam:`visit_${token}` };

async function stub(page, { start='', visitor=null } = {}) {
  await page.route('**/api/**', r => {
    const u = new URL(r.request().url());
    const bodies = {
      '/api/agents':{agents:[agent]}, '/api/auth/config':{botUsername:'RailbirdTest'},
      '/api/wallet':{balance:12000,ledger:[]}, '/api/slots':{used:1,cap:4,next:{index:2,price:0,earned:12000,unlocked:true}},
      '/api/home/thread':{lines:[]}, '/api/rooms':{rooms:[]}, '/api/events':{events:[],lastId:0},
    };
    return r.fulfill({json:bodies[u.pathname] ?? {lines:[],recentHands:[],flaggedHands:[],book:[],count:0}});
  });
  await page.route('https://telegram.org/**', r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.addInitScript(({agent,start,visitor})=>{
    window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A4242%7D&hash=fixture',initDataUnsafe:{user:{id:4242,first_name:'Test'},start_param:start},get viewportHeight(){return innerHeight;},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},offEvent(){}}};
    window.__copies=[];
    window.__shares=[];
    Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{window.__shares.push(payload);throw new DOMException('Cancelled','AbortError');}});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__copies.push(text);}}});
    window.__roomSockets=[];
    class Socket {
      static OPEN=1;
      constructor(){this.readyState=0;this.listeners={};window.__roomSockets.push(this);setTimeout(()=>{this.readyState=1;this.emit('open',{});this.room(visitor);},20);}
      addEventListener(t,f){(this.listeners[t]??=[]).push(f);}
      removeEventListener(t,f){this.listeners[t]=(this.listeners[t]??[]).filter(x=>x!==f);}
      emit(t,event){(this.listeners[t]??[]).forEach(f=>f(event));}
      room(visitor){this.emit('message',{data:JSON.stringify({type:'home_state',userId:'4242',agents:[agent],game:null,visitor})});}
      send(){} close(){this.readyState=3;}
    }
    window.WebSocket=Socket;
  },{agent,start,visitor});
}

for (const viewport of [{width:390,height:844},{width:390,height:590},{width:1440,height:900}]) {
  test(`BUG-150: actual More share/cancel/copy controls stay reachable at ${viewport.width}x${viewport.height}`, async({page})=>{
    await page.setViewportSize(viewport); await stub(page);
    let prepared=0, release;
    await page.route('**/api/agents/friend1/visit-invite', async r=>{
      prepared++; expect(r.request().postDataJSON()).toEqual({userId:'4242',stake:0});
      await new Promise(resolve=>{release=resolve;}); await r.fulfill({json:invitation});
    });
    await page.goto('/');
    await page.getByRole('button',{name:/^Away Day —/}).first().click();
    await page.getByRole('button',{name:'Profile',exact:true}).click();
    await page.getByRole('button',{name:'More actions'}).click();
    const send=page.getByRole('button',{name:'Send to a friend'});
    await send.click(); await expect(send).toBeDisabled();
    await expect(page.getByRole('status')).toHaveText('Preparing invitation…');
    await expect(page.getByRole('button',{name:'More actions'})).toHaveAttribute('aria-expanded','true');
    await expect.poll(()=>prepared).toBe(1);
    release();
    await expect(page.getByRole('status')).toHaveText('Sharing cancelled. You can copy the invitation below.');
    const copy=page.getByRole('button',{name:'Copy invitation'});
    await expect(copy).toBeVisible();
    const box=await copy.boundingBox(); expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
    await copy.click();
    await expect(page.getByRole('status')).toHaveText('Invitation copied. Paste it to your friend.');
    const copied=await page.evaluate(()=>window.__copies);
    expect(copied).toEqual([`Away Day wants a game at your place in Railbird. Open this invitation to let him in. Free home game · no chips staked.\n\nhttps://t.me/RailbirdTest?start=visit_${token}`]);
    expect(prepared).toBe(1);
    await page.screenshot({path:`../artifacts/bug150-share-${viewport.width}x${viewport.height}.png`});
    await page.keyboard.press('Escape');
    await expect(copy).toHaveCount(0);
  });
}

test('BUG-150: expired recipient launch explains failure and can be dismissed',async({page})=>{
  await stub(page,{start:`visit_${token}`});
  let knocks=0;
  await page.route(`**/api/visit-invites/${token}`,r=>r.fulfill({status:410,json:{reason:'invitationExpired',error:'Invitation expired.'}}));
  await page.route('**/api/agents/*/visit',r=>{knocks++;return r.fulfill({json:{}});});
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText('This invitation has expired. Ask your friend for a new invitation.');
  expect(knocks).toBe(0);
  await page.screenshot({path:'../artifacts/bug150-expired-invitation.png'});
  await page.getByRole('button',{name:'Got it'}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('BUG-150: actual door refusal stays visible and a later acceptance succeeds',async({page})=>{
  await stub(page,{visitor:{id:'visit1',agentId:'other1',agentName:'Visitor'}});
  let attempts=0;
  await page.route('**/api/home/visitors/visit1/answer',async r=>{
    attempts++;expect(r.request().postDataJSON()).toEqual({hostUserId:'4242',accept:true});
    if(attempts===1)return r.fulfill({status:409,json:{reason:'hostInHand',error:'Table is in a hand.'}});
    await r.fulfill({json:{visitId:'visit1',accepted:true,line:'Pull up a chair.'}});
    await page.evaluate(()=>window.__roomSockets.forEach(socket=>socket.room(null)));
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Let him in'}).click();
  await expect(page.getByRole('alert')).toHaveText('Your table is in a hand. Try again when it finishes.');
  await page.screenshot({path:'../artifacts/bug150-door-refusal.png'});
  await page.getByRole('button',{name:'Let him in'}).click();
  await expect(page.getByTestId('home-visitor')).toHaveCount(0);
  expect(attempts).toBe(2);
});
