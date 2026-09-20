import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';

let child,ready,scratch,sequence=0,output='';const calls=new Map();
const rpc=method=>new Promise((resolve,reject)=>{const id=++sequence;calls.set(id,{resolve,reject});child.send({id,method});});
test.beforeAll(async()=>{
  scratch=fs.mkdtempSync(path.join(os.tmpdir(),'railbird-casino-bar-browser-'));
  child=fork(fileURLToPath(new URL('./fixtures/casinoBarServer.mjs',import.meta.url)),[],{cwd:scratch,execArgv:[],silent:true});
  child.stdout.on('data',data=>{output=(output+data).slice(-7000);});child.stderr.on('data',data=>{output=(output+data).slice(-7000);});
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>{if(!ready)reject(new Error(`Casino fixture exit ${code}: ${output}`));});
    child.on('message',message=>{if(message.event==='ready'){ready=message;resolve();}else{const call=calls.get(message.id);calls.delete(message.id);if(message.error)call?.reject(new Error(message.error));else call?.resolve(message.result);}});
  });
});
test.afterAll(async()=>{
  const exited=new Promise(resolve=>child.once('exit',resolve));await rpc('stop');await exited;
  expect(path.dirname(path.resolve(scratch))).toBe(path.resolve(os.tmpdir()));fs.rmSync(scratch,{recursive:true,force:true,maxRetries:5,retryDelay:100});
});
async function connect(page){
  await page.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/api/auth/config')return route.fulfill({json:{botUsername:''}});
    if(url.pathname==='/api/events')return route.fulfill({json:{events:[],lastId:0}});
    if(url.pathname==='/api/stats')return route.fulfill({json:{totalAgents:2,handsPlayedToday:1}});
    const response=await route.fetch({url:`${ready.backend}${url.pathname}${url.search}`});await route.fulfill({response});
  });
  await page.addInitScript(({owner,credential,backend})=>{
    window.Telegram={WebApp:{initData:credential,initDataUnsafe:{user:{id:Number(owner),first_name:'Jens'}},get viewportHeight(){return innerHeight;},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},offEvent(){}}};
    const NativeSocket=window.WebSocket;window.__roomFrames=[];
    window.WebSocket=class extends NativeSocket{constructor(url,protocols){super(protocols==='vite-hmr'?url:backend.replace('http:','ws:'),protocols);
      if(protocols!=='vite-hmr')this.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.type==='room_tables')window.__roomFrames.push(data);});}};
  },ready);
}
for(const viewport of [{width:390,height:844},{width:390,height:590},{width:1440,height:900}]){
  test(`BUG-281/282: native floor mirrors a populated hand and the bar serves safely at ${viewport.width}x${viewport.height}`,async({page},testInfo)=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    const initial=await rpc('seed');await page.setViewportSize(viewport);await connect(page);await page.goto('/');
    await page.getByTestId('home-door').click();await expect(page.getByTestId('the-floor')).toBeVisible();
    const felt=page.locator(`.csn-felt58[data-table="${initial.tableId}"]`);
    await expect(felt.locator('.csn-felt58__seat')).toHaveCount(initial.public.seated);
    await expect.poll(()=>page.evaluate(()=>window.__roomFrames.length)).toBeGreaterThan(0);
    expect(await page.evaluate(id=>window.__roomFrames.at(-1).tables.find(table=>table.tableId===id).seated,initial.tableId)).toBe(initial.public.seated);
    await expect(felt.locator('[data-item="rail-cap"]')).toHaveCount(1);
    await expect(felt.locator('[data-item="round-glasses"]')).toHaveCount(1);
    // The room scales uniformly on desktop. IntersectionObserver rounds a
    // fully contained transformed SVG to .999998; check its actual bounds.
    const roomBox=await page.getByTestId('the-floor').boundingBox();
    for(const ghost of await felt.locator('.csn-tiny').all()){
      await expect(ghost).toBeVisible();const box=await ghost.boundingBox();
      expect(box.width).toBeGreaterThan(0);expect(box.height).toBeGreaterThan(0);
      expect(box.x).toBeGreaterThanOrEqual(Math.max(0,roomBox.x));expect(box.y).toBeGreaterThanOrEqual(Math.max(0,roomBox.y));
      expect(box.x+box.width).toBeLessThanOrEqual(Math.min(viewport.width,roomBox.x+roomBox.width));
      expect(box.y+box.height).toBeLessThanOrEqual(Math.min(viewport.height,roomBox.y+roomBox.height));
    }
    const flopped=await rpc('flop');
    await expect(felt.locator('[data-floor-card]')).toHaveCount(3);
    expect(await felt.locator('[data-floor-card]').evaluateAll(cards=>cards.map(card=>card.dataset.floorCard))).toEqual(flopped.public.board);
    await expect(felt.locator('.csn-felt58__pot')).toBeVisible();
    await testInfo.attach('authoritative-room', {contentType:'application/json',body:JSON.stringify(flopped.public,null,2)});
    await page.screenshot({path:testInfo.outputPath(`populated-floor-${viewport.width}-${viewport.height}.png`)});
    const open=page.getByRole('button',{name:'Open casino bar',exact:true});
    const barBox=await open.boundingBox();expect(barBox.x).toBeGreaterThanOrEqual(0);expect(barBox.y).toBeGreaterThanOrEqual(0);
    expect(barBox.x+barBox.width).toBeLessThanOrEqual(viewport.width);expect(barBox.y+barBox.height).toBeLessThanOrEqual(viewport.height);
    expect(await open.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
    await open.click();
    const dialog=page.getByRole('dialog',{name:'The casino bar'});await expect(dialog).toBeVisible();
    const beer=dialog.getByRole('button',{name:'Serve one beer from stock'}),snack=dialog.getByRole('button',{name:'Buy and serve one snack for $100'});
    await expect(beer).toBeEnabled();await expect(snack).toBeEnabled();
    expect((await rpc('state')).orders).toBe(0);
    // The scrim is a button, so the global button stacking rule must not
    // place it above the panel while only the panel's own buttons escape.
    const panelBox=await dialog.boundingBox();
    expect(panelBox.x).toBeGreaterThanOrEqual(0);expect(panelBox.y).toBeGreaterThanOrEqual(0);
    expect(panelBox.x+panelBox.width).toBeLessThanOrEqual(viewport.width);expect(panelBox.y+panelBox.height).toBeLessThanOrEqual(viewport.height);
    const recipient=dialog.getByRole('combobox',{name:'Who is it for?'});
    const panelHitTests=[];
    for(const target of [dialog.getByRole('heading',{name:'The bar',exact:true}),recipient]){
      panelHitTests.push(await target.evaluate(el=>{
        const box=el.getBoundingClientRect(),stack=document.elementsFromPoint(box.x+box.width/2,box.y+box.height/2);
        return {target:el.tagName,exposed:el.contains(stack[0]),stack:stack.slice(0,5).map(node=>({tag:node.tagName,className:node.className,zIndex:getComputedStyle(node).zIndex}))};
      }));
    }
    await testInfo.attach('bar-panel-hit-tests',{contentType:'application/json',body:JSON.stringify(panelHitTests,null,2)});
    for(const probe of panelHitTests)expect(probe.exposed,`${probe.target} is covered: ${JSON.stringify(probe.stack)}`).toBe(true);
    await recipient.click();await page.keyboard.press('End');await page.keyboard.press('Enter');
    await expect(recipient).toHaveValue('bar-copper');
    await recipient.click();await page.keyboard.press('Home');await page.keyboard.press('Enter');
    await expect(recipient).toHaveValue('bar-moss');
    expect((await rpc('state')).orders).toBe(0);
    for(const button of [beer,snack]){await expect(button).toBeInViewport({ratio:1});expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);}
    await page.screenshot({path:testInfo.outputPath(`bar-open-${viewport.width}-${viewport.height}.png`)});
    await beer.click();await expect(dialog.getByRole('status')).toHaveText('Moss had a beer. From household stock.');
    const served=await rpc('state');expect(served.hand).toEqual(flopped.hand);expect(served.pocket).toEqual(flopped.pocket);expect(served.safe).toBe(flopped.safe);expect(served.fridge.beer).toBe(0);
    await snack.click();await expect(dialog.getByRole('status')).toHaveText('Moss had a snack. $100 from your safe.');
    const bought=await rpc('state');expect(bought.hand).toEqual(flopped.hand);expect(bought.pocket).toEqual(flopped.pocket);expect(bought.safe).toBe(flopped.safe-100);expect(bought.fridge.snack).toBe(0);expect(bought.orders).toBe(2);
    await page.screenshot({path:testInfo.outputPath(`bar-served-${viewport.width}-${viewport.height}.png`)});
    await dialog.getByRole('button',{name:'Close bar',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
    await open.click();await expect(dialog).toBeVisible();
    // An actual exposed scrim point still dismisses the bar after layering it
    // behind the panel; it must not become an inert full-screen backdrop.
    const scrim=page.getByRole('button',{name:'Close casino bar',exact:true});
    const scrimBox=await scrim.boundingBox();
    await page.mouse.click(scrimBox.x+8,scrimBox.y+8);
    await expect(dialog).toHaveCount(0);await expect(open).toBeFocused();
    expect(errors).toEqual([]);
  });
}
