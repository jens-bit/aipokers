import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { agent, room, pushHome } from './show-home-fixtures.js';
const shot = name => fileURLToPath(new URL('../../artifacts/show/'+name,import.meta.url));

for(const [item,viewport] of [['snack',{width:390,height:790}],['beer',{width:1440,height:900}]]) {
  test(`HOME-2 accepted ${item} crosses the room once at ${viewport.width}`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const cast={agents:[
      agent('agg','Aggressive v1.3',{routine:{key:'plays'},mood:{state:'frustrated',heat:78},homeItem:null}),
      agent('blf','Bluff Master',{routine:{key:'plays'},mood:{state:'frustrated',heat:24},homeItem:null}),
      agent('val','Value Bot',{nature:{name:'Grinder'},routine:{key:'counts'},mood:{state:'neutral',heat:12},homeItem:null,
        want:{kind:item==='snack'?'food':'beer',item,text:`Could use a ${item}.`,needs:null,dangerous:false}}),
      agent('bal','Balanced v2.1',{routine:{key:'sleeps'},fatigue:'worn',mood:{state:'sulking',heat:14},homeItem:null}),
    ],game:{tableId:'home-4242',state:'running',seats:[{seat:0,agentId:'agg',name:'Aggressive v1.3'},{seat:1,agentId:'blf',name:'Bluff Master'}],handsPlayed:7},
      table:{tableId:'home-4242',handNumber:7,street:'flop',community:['9h','Js','4c'],seats:[],pot:0}};
    let answered=0;
    await room(page,cast,viewport);
    await page.route('**/api/agents/val/want?**',route=>{
      expect(route.request().postDataJSON()).toEqual({userId:'4242',answer:'yes'});
      answered++;
      cast.agents[2]={...cast.agents[2],want:null,homeItem:{item,at:Date.now()+120000}};
      return route.fulfill({json:{answered:'yes',kind:item==='snack'?'food':'beer',want:null,performed:{given:item}}});
    });
    const fetcher=page.locator('.home-one[data-agent="val"]');
    const places=()=>page.locator('.home-one').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.dataset.agent,[el.style.left,el.style.top]])));
    const original=await places();
    await expect(page.getByTestId('home-fridge-light')).toHaveCount(0);
    await page.getByTestId('home-want-yes').click();
    await expect(page.getByTestId('home-want')).toHaveCount(0);
    await pushHome(page,cast);
    await expect(fetcher).toHaveAttribute('data-home-item-phase','out');
    await expect(page.getByTestId('home-fridge-light')).toHaveCount(0);
    const during=await places();
    for(const id of ['agg','blf','bal'])expect(during[id]).toEqual(original[id]);
    await expect(fetcher).toHaveAttribute('data-home-item-phase','hold');
    await expect(page.getByTestId('home-fridge')).toHaveAttribute('data-open','true');
    await expect(page.getByTestId('home-fridge-light')).toBeVisible();
    await expect(page.getByTestId('home-table')).toBeVisible();
    if(viewport.width===390) {
      await expect(fetcher.locator('.home-one__body')).toHaveCSS('width','44px');
      await page.locator('.home1__room').screenshot({path:shot('home-1-F10-actual-room.png')});
      await page.screenshot({path:shot('home-1-F10-actual-phone.png')});
    } else await page.screenshot({path:shot('home-2-fridge-desktop.png')});
    await expect(fetcher).toHaveAttribute('data-home-item-phase','back');
    await expect(page.getByTestId(`home-item-${item}`)).toBeVisible();
    await expect(page.getByTestId('home-fridge-light')).toHaveCount(0);
    await expect(fetcher).not.toHaveAttribute('data-home-item-phase',/./,{timeout:3000});
    expect(await places()).toEqual(original);
    await pushHome(page,cast);
    await expect(fetcher).not.toHaveAttribute('data-home-item-phase',/./);
    expect(answered).toBe(1);
    expect(errors).toEqual([]);
  });
}
