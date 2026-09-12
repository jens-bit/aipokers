import { test, expect } from '@playwright/test';
import { felt, rooms } from '../src/test/fixtures/rooms.js';

test('SHOW-2 floor-first: real wire updates move cards/chips and expire speech without blocking Watch', async ({ page }) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const tables=Array.from({length:6},(_,i)=>felt({tableId:`table-${i}`}));
  const roomList=rooms.map((r,i)=>i===0?{...r,tables:6,seated:18}:r);
  const requests=[];
  await page.route('**/api/**',route=>{
    const url=new URL(route.request().url()), path=url.pathname;
    if(path==='/api/auth/config')return route.fulfill({json:{guest:false}});
    if(path==='/api/agents')return route.fulfill({json:{agents:[{id:'a1',name:'Balance',mood:{state:'neutral',heat:30},fatigue:'fresh',location:{where:'home'},pocket:{balance:2000},stats:{},routine:{key:'reads'}}]}});
    if(path==='/api/rooms')return route.fulfill({json:{rooms:roomList}});
    if(path==='/api/events'){
      requests.push(url.search);
      return route.fulfill({json:{events:[{id:20,ts:Date.now()-30000,type:'bigPot',tableId:'table-0',headline:'Granite wins the last pot',pot:1200}],lastId:20}});
    }
    if(path==='/api/wallet')return route.fulfill({json:{balance:12000,ledger:[]}});
    if(path==='/api/slots')return route.fulfill({json:{used:1,cap:4,next:{index:2,price:500,earned:500,unlocked:true}}});
    return route.fulfill({json:{agents:[],lines:[],events:[]}});
  });
  await page.addInitScript(({tables,rooms})=>{
    window.__showSockets=[];window.__showMessages=[];
    class Socket extends EventTarget {
      static OPEN=1;OPEN=1;readyState=1;
      constructor(){super();window.__showSockets.push(this);setTimeout(()=>{this.onopen?.({});this.dispatchEvent(new Event('open'));},10);}
      frame(data){const event=new MessageEvent('message',{data:JSON.stringify(data)});this.onmessage?.(event);this.dispatchEvent(event);}
      send(raw){const m=JSON.parse(raw);window.__showMessages.push(m);if(m.type==='floor_sub')setTimeout(()=>{
        this.frame({type:'floor_rooms',rooms});this.frame({type:'room_tables',tables,rooms:Object.fromEntries(tables.map(t=>[t.tableId,t.room]))});
      },10);}
      close(){this.readyState=3;}
    }
    window.WebSocket=Socket;
    window.__showFloor = tables => window.__showSockets.forEach(s=>s.frame({type:'room_tables',tables,rooms:Object.fromEntries(tables.map(t=>[t.tableId,t.room]))}));
  },{tables,rooms:roomList});
  await page.goto('/');
  await page.getByTestId('home-door').click();
  const floor=page.getByTestId('the-floor');
  await expect(floor).toBeVisible();
  const first=page.locator('[data-table="table-0"]');
  await expect(first.locator('[data-floor-card]')).toHaveCount(3);
  await first.evaluate(el=>{window.__showFirstCard=el.querySelector('[data-floor-card]');});
  const now=Date.now();
  tables[0]={...tables[0],board:['Ah','Kd','7c','2s'],pot:720,lastAction:{seq:1,handNumber:12,seat:1,street:'turn',type:'bet',amount:80,chips:80,allIn:false,pot:720},recentChat:{seq:1,seat:1,text:'Your move.',isAI:true,timestamp:now,expiresAt:now+4000}};
  await page.evaluate(t=>window.__showFloor(t),tables);
  await expect(first.locator('[data-floor-card]')).toHaveCount(4);
  expect(await first.evaluate(el=>window.__showFirstCard===el.querySelector('[data-floor-card]'))).toBe(true);
  await expect(first.locator('[data-floor-push]')).toHaveCount(1);
  await expect(first.locator('.csn-felt58__bubble')).toHaveText('Your move.');
  expect(await first.locator('.csn-felt58__bubble').evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
  await page.screenshot({path:'../artifacts/show/floor-phone.png'});
  await expect(first.locator('.csn-felt58__bubble')).toHaveCount(0,{timeout:5000});
  expect(requests.some(q=>q.includes('limit=20'))).toBe(true);
  const later=Date.now();
  tables[1]={...tables[1],recentChat:{seq:2,seat:1,text:'X'.repeat(280),timestamp:later,expiresAt:later+4000}};
  await page.evaluate(t=>window.__showFloor(t),tables);
  const longBubble=page.locator('[data-table="table-1"] .csn-felt58__bubble');
  await expect(longBubble).toBeVisible();
  const bounds=await longBubble.boundingBox(), room=await floor.boundingBox();
  expect(bounds.height).toBeLessThan(40);
  expect(bounds.y).toBeGreaterThanOrEqual(room.y);
  await first.click();
  expect(await page.evaluate(()=>window.__showMessages.some(m=>m.type==='watch'&&m.tableId==='table-0'))).toBe(true);
  expect(errors).toEqual([]);
});
