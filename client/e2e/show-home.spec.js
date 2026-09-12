// Built Home geometry checks against the named current design frame.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { agent, CASTS, room } from './show-home-fixtures.js';
const shot = name => fileURLToPath(new URL('../../artifacts/show/'+name,import.meta.url));

for (const [name,cast,viewport] of [
 ['alone',CASTS.alone,{width:390,height:844}],
 ['household',CASTS.household,{width:390,height:844}],
 ['want',CASTS.want,{width:390,height:844}],
 ['empty',{agents:[],game:null},{width:390,height:844}],
 ['short',CASTS.household,{width:390,height:590}],
 ['desktop',CASTS.household,{width:1440,height:900}],
]) test(`HOME-1 inspect ${name}`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await room(page,cast,viewport);
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.getByTestId('home-table')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(viewport.width);
  await page.screenshot({path:shot(`home-1-${name}.png`)});
  const metrics=await page.evaluate(()=>Object.fromEntries(['.home1','.room-header','.home1__room','.home-flat','.home-thread','.home1__scale'].map(sel=>{const el=document.querySelector(sel),r=el?.getBoundingClientRect();return[sel,r?{x:r.x,y:r.y,w:r.width,h:r.height}:null];})));
  console.log(name,JSON.stringify(metrics));
  if(viewport.width===390) {
    expect.soft(metrics['.home-flat'].h).toBeGreaterThanOrEqual(metrics['.home1__room'].h-1);
    await expect.soft(page.getByRole('button',{name:'Your agents',exact:true}).locator('svg')).toHaveAttribute('fill','none');
    if(name==='household')await expect.soft(page.locator('[data-agent="a2"] .home-one__body')).toHaveCSS('width','44px');
    await expect(page.getByRole('button',{name:'Your agents',exact:true})).toHaveCSS('color',name==='want'?'rgb(205, 179, 128)':'rgb(195, 195, 198)');
    if(name==='short'){
      await page.getByTestId('home-tv').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('home-tv')).toBeInViewport();
      await expect(page.getByPlaceholder('Say something to the room…')).toBeInViewport();
    }
  }
  expect(errors).toEqual([]);
});

// F10 comparison: declared current-state fixture. The reference's fridge
// fetching state is recorded separately until a truthful server trigger exists.
test('HOME-1 F10 current room comparison',async({page})=>{
  const four={agents:[
    agent('agg','Aggressive v1.3',{routine:{key:'plays'},mood:{state:'frustrated',heat:78}}),
    agent('blf','Bluff Master',{routine:{key:'plays'},mood:{state:'frustrated',heat:24}}),
    agent('val','Value Bot',{nature:{name:'Grinder'},routine:{key:'counts'},mood:{state:'neutral',heat:12}}),
    agent('bal','Balanced v2.1',{routine:{key:'sleeps'},fatigue:'worn',mood:{state:'sulking',heat:14}}),
  ],game:{tableId:'home-4242',state:'running',seats:[{seat:0,agentId:'agg',name:'Aggressive v1.3'},{seat:1,agentId:'blf',name:'Bluff Master'}],handsPlayed:7},
    table:{tableId:'home-4242',handNumber:7,street:'flop',community:['9h','Js','4c'],seats:[],pot:0}};
  // 54px less than the reference's phone removes only its simulated iOS bar,
  // giving both actual room crops the authored390x666 native coordinate space.
  await room(page,four,{width:390,height:790});
  await page.getByTestId('home-board').getByText('J',{exact:true}).waitFor();
  await expect(page.locator('.home-wall__hook')).toHaveCount(3);
  await expect(page.locator('[data-agent="agg"] .home-one__cards svg')).toHaveCount(2);
  await page.locator('.home1__room').screenshot({path:shot('home-1-F10-actual-room.png')});
  await page.screenshot({path:shot('home-1-F10-actual-phone.png')});
});
