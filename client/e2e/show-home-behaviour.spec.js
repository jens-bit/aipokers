import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { agent, room } from './show-home-fixtures.js';

const shot = name => fileURLToPath(new URL('../../artifacts/show/'+name,import.meta.url));
const overlaps = (a,b) => a.x < b.x+b.width && b.x < a.x+a.width && a.y < b.y+b.height && b.y < a.y+a.height;
async function pushHome(page,cast) {
  await page.waitForFunction(()=>window.__homeSockets.some(s=>s.readyState===1&&s.sent?.some(m=>m.type==='floor_sub')));
  await page.evaluate(c=>window.__homeSockets.filter(s=>s.readyState===1).forEach(s=>s.dispatch('message',{
    data:JSON.stringify({type:'home_state',userId:'4242',agents:c.agents,game:c.game??null}),
  })),cast);
}

for (const viewport of [{width:390,height:844},{width:1440,height:900}]) {
  test(`HOME-2 supported household and visitors keep separate resting places at ${viewport.width}`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    // A repeated stale TV destination cannot stack eight visible bodies.
    const cast={agents:Array.from({length:8},(_,i)=>agent(`resident-${i}`,`Resident ${i+1}`,{
      guest:i>=4,routine:{key:'tape',label:'reviewing a hand'},
    }))};
    await room(page,cast,viewport);
    const bodies=page.locator('.home-one:not(.is-away) .home-one__body');
    await expect(bodies).toHaveCount(8);
    const boxes=await bodies.evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)expect(overlaps(boxes[i],boxes[j]),`${i} overlaps ${j}`).toBe(false);
    await expect(page.locator('.home-one[data-spot="tape"]')).toHaveCount(1);
    await expect(page.getByTestId('home-table')).toBeVisible();
    await page.screenshot({path:shot(`home-2-room-${viewport.width}.png`)});
    expect(errors).toEqual([]);
  });
}

test('HOME-2 recap clears, survives a Home remount, and new events still speak',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const recap={text:'Table closed while I was away',at:Date.now()-1000};
  const cast={agents:[agent('recap-man','Wild Cannon',{
    routine:{key:'reads',label:'reading'},unseenRecap:true,sessionRecap:recap,
  })]};
  await room(page,cast);
  const bubble=page.getByTestId('home-news-recap-man');
  await expect(bubble).toHaveText(recap.text);
  const box=await bubble.boundingBox();
  for(const id of ['home-table','home-fridge','home-tv','home-door','home-safe']) {
    const fixture=await page.getByTestId(id).boundingBox();
    expect(overlaps(box,fixture),`speech covers ${id}`).toBe(false);
  }
  await expect(bubble).toHaveCount(0,{timeout:4000});
  await page.getByTestId('home-door').click();
  await page.getByRole('button',{name:'Back home',exact:true}).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(bubble).toHaveCount(0);
  await pushHome(page,cast);
  await expect(bubble).toHaveCount(0);
  cast.agents[0].sessionRecap={...recap,at:Date.now(),text:'A different session ended.'};
  await pushHome(page,cast);
  await expect(bubble).toHaveText('A different session ended.');
  expect(errors).toEqual([]);
});

test('HOME-2 idle phases belong to characters and survive a harmless poll',async({page})=>{
  const cast={agents:['Granite','Wild Cannon','Balance','Value'].map((name,i)=>agent(`idle-${i}`,name))};
  await room(page,cast);
  const phases=()=>page.locator('.home-one').evaluateAll(els=>els.map(el=>[el.dataset.agent,el.style.getPropertyValue('--home-idle-phase')]));
  const before=await phases();
  expect(new Set(before.map(p=>p[1])).size).toBe(4);
  expect(before.every(p=>parseFloat(p[1])<0)).toBe(true);
  await pushHome(page,cast);
  expect(await phases()).toEqual(before);
});
