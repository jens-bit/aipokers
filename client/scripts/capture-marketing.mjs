// Run against the local Vite server on 5199: node scripts/capture-marketing.mjs
// Reuse the existing browser fixtures without registering their tests. The
// captures are real App renders; no sample or network override ships to users.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { roomsResponse, felts } from '../src/test/fixtures/rooms.js';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'public/welcome/screens');
await fs.mkdir(output, { recursive: true });
async function fixture(name, exports) {
  const file = path.join(root, 'e2e', name + '.spec.js');
  const require = createRequire(file);
  let code = (await fs.readFile(file, 'utf8')).split('test.describe(')[0];
  code = code.replace(/^test.use\([^\n]+\);\r?$/gm, '');
  code = code.replace(/from '([^']+)'/g, (_, spec) => `from '${spec.startsWith('node:') ? spec : pathToFileURL(spec === '@playwright/test' ? require.resolve(spec).replace(/index\.js$/, 'index.mjs') : require.resolve(spec)).href}'`);
  return import('data:text/javascript,' + encodeURIComponent(code + `\nexport { ${exports} };`));
}
const home = await fixture('home', 'room, CASTS');
const desk = await fixture('desk', 'desk, AGENTS, GAME');
const watch = await fixture('watch10', 'TABLE, stub');
const browser = await chromium.launch({ headless: true });
const records = [];
async function pageAt(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  page.on('pageerror', error => console.error('Capture page error:', error.message));
  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  return page;
}
async function shot(page, scene, kind) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  if (scene === 'casino' && kind === 'phone') {
    const composer = await page.getByTestId('home-thread-input').boundingBox();
    if (!composer || composer.y + composer.height > page.viewportSize().height) throw Error('Phone casino composer is outside the captured viewport: '+JSON.stringify(composer));
  }
  if (scene === 'casino' && kind === 'desktop') {
    const fit = await page.locator('.csn-floor__plan').evaluate(el => {
      const floor = el.querySelector('.csn-floor58').getBoundingClientRect();
      return { width: floor.width, expected: Math.min(el.clientWidth, el.clientHeight * 390 / 470) };
    });
    if (Math.abs(fit.width - fit.expected) > 1) throw Error('BUG-103: casino did not fit its stage: '+JSON.stringify(fit));
  }
  if (scene === 'sit' && kind === 'desktop') {
    const realCards=await page.getByTestId('owner-hero-cards').textContent();
    if(!/[2-9TJQKA]/.test(realCards)) throw Error('BUG-99: capture never received the matching table state');
    const stage=await page.getByTestId('desk-home-table').boundingBox();
    const cards=await page.getByTestId('owner-hero-cards').boundingBox();
    const verbs=await page.getByTestId('sit-strip').boundingBox();
    if(!stage || cards.y+cards.height>=verbs.y || Math.abs(stage.width/stage.height-900/648)>.01) throw Error('BUG-99: desktop owner seat is cropped or mis-sized');
  }
  if (scene === 'watch' && kind === 'desktop') {
    const bounds = await page.locator('.watch-hero__strip').evaluate(el => ({
      numbersBottom: Math.max(...[...el.querySelectorAll('.watch-felt__hero-num')].map(n => n.getBoundingClientRect().bottom)),
      barsTop: el.querySelector('.felt-bars').getBoundingClientRect().top,
    }));
    if (bounds.barsTop < bounds.numbersBottom) throw Error('BUG-100: condition labels overlap the desktop numbers: '+JSON.stringify(bounds));
  }
  await page.screenshot({ path: path.join(output, `${scene}-${kind}.png`) });
  records.push({ scene, kind, viewport: page.viewportSize() });
  console.log('Captured', scene, kind);
}
async function tableSocket(page, { owner = false, desktop = false } = {}) {
  const state = { ...watch.TABLE, tableId: desktop && !owner ? 't1' : 'home-4242', heroEquity: .64,
    seats: watch.TABLE.seats.slice(0, 3).map((s,i) => i === 0 ? { ...s, displayName: owner ? 'Jens' : (desktop ? 'Big Slick' : 'The Clock'), fatigue:'fresh', mood:{state:'confident',heat:24} } : s) };
  await page.addInitScript(({ state, owner }) => {
    const Base = window.WebSocket;
    window.WebSocket = class extends Base {
      send(raw) {
        const msg = JSON.parse(raw);
        if (msg.type !== 'watch' && msg.type !== 'join') return super.send(raw);
        setTimeout(() => {
          this.dispatch('message',{data:JSON.stringify(owner ? {type:'joined',seat:0,playerId:'owner'} : {type:'watching',spectatorSeat:0})});
          this.dispatch('message',{data:JSON.stringify({type:'state',state:{...state,tableId:msg.tableId,toAct:owner ? 0 : 1},legalActions:owner ? [{type:'fold'},{type:'call',amount:20},{type:'raise',min:80,max:1847}] : []})});
          if (!owner) this.dispatch('message',{data:JSON.stringify({type:'decision',seat:0,action:{type:'call',amount:40},equity:.64,reasoning:'Sixes. I can afford to see one more.'})});
        },60);
      }
    };
  }, {state,owner});
}
try {
  for (const kind of ['phone','desktop']) {
    const size = kind === 'phone' ? { width:390,height:844 } : { width:1440,height:900 };
    const page = await pageAt(size.width,size.height);
    if (kind === 'desktop') await desk.desk(page,size);
    else await home.room(page,home.CASTS.household,size);
    await shot(page,'home',kind);
    await page.close();

    const wantPage = await pageAt(size.width,size.height);
    await home.room(wantPage,home.CASTS.want,size);
    if (kind === 'desktop') await wantPage.locator('.dsk-roster-row').first().click();
    await shot(wantPage,'wants',kind);
    await wantPage.close();

    const casino = await pageAt(size.width,size.height);
    const casinoAgents=desk.AGENTS.map(a=>a.id==='a3'?{...a,location:{...a.location,room:'floor'},liveGame:{...a.liveGame,heroHole:['6h','6s']}}:a);
    await desk.desk(casino,{width:1440,height:900},{agents:casinoAgents});
    const tables=Array.from({length:6},(_,i)=>({...felts[i%2],tableId:i===1?'t1':'tbl-example-'+i,pot:240+i*180,hot:i===4,
      seats:felts[0].seats.map((seat,j)=>({...seat,...(i===1&&j===0?{name:'Big Slick',agentId:'a3'}:{})}))}));
    const rooms={...roomsResponse,rooms:roomsResponse.rooms.map((r,i)=>i===0?{...r,tables:6,seated:18,biggestPot:{tableId:'t1',pot:420}}:r)};
    await casino.route('**/api/rooms',r=>r.fulfill({json:rooms}));
    await casino.addInitScript(({tables,rooms})=>{
      const Base=window.WebSocket;
      window.WebSocket=class extends Base {
        send(raw){super.send(raw);if(JSON.parse(raw).type!=='floor_sub')return;
          setTimeout(()=>{
            this.dispatch('message',{data:JSON.stringify({type:'floor_rooms',rooms:rooms.rooms})});
            this.dispatch('message',{data:JSON.stringify({type:'room_tables',tables,rooms:Object.fromEntries(tables.map(t=>[t.tableId,t.room]))})});
          },60);
        }
      };
    },{tables,rooms});
    await casino.route('**/api/rooms/*/tables',r=>r.fulfill({json:{tables:felts}}));
    await casino.setViewportSize(size);
    await casino.reload();
    await casino.getByTestId('home-door').click();
    if (kind === 'phone') {
      await casino.getByTestId('casino-view-toggle').getByRole('button',{name:'Board',exact:true}).click();
      await casino.getByRole('tab',{name:'Big Slick',exact:true}).click();
      await casino.waitForSelector('.csn-your__page .csn-felt');
    } else { await casino.waitForSelector('.csn-floor .csn-felt58'); if (await casino.locator('.csn-floor .csn-felt58').count() !== 6) throw Error('Six example felts did not render'); }
    await shot(casino,'casino',kind);
    await casino.close();

    for (const owner of [false,true]) {
      const felt = await pageAt(size.width,size.height);
      if (kind === 'desktop' && !owner) await desk.desk(felt,size);
      else if (!owner) { await watch.stub(felt,{owned:true}); await felt.goto('http://127.0.0.1:5199/'); }
      else await home.room(felt,home.CASTS.household,size);
      await tableSocket(felt,{owner,desktop:kind==='desktop'});
      await felt.reload();
      if (kind === 'desktop' && !owner) {
        await felt.getByRole('button',{name:/Standup/}).click();
        await felt.getByRole('button',{name:'WATCH →'}).first().click();
        await felt.waitForSelector('.watch-hero__cards');
      } else if (!owner) {
        await felt.getByTestId('home-frame-a1').click();
        await felt.waitForSelector('.watch-felt');
      } else {
        await felt.getByTestId('home-table').click();
        await felt.getByTestId(owner ? 'home-table-sit' : 'home-table-watch').click();
        await felt.waitForSelector('.watch-felt');
      }
      await felt.waitForTimeout(1500);
      await shot(felt,owner ? 'sit' : 'watch',kind);
      await felt.close();
    }
  }
  await fs.writeFile(path.join(output,'capture.json'),JSON.stringify({capturedAt:new Date().toISOString(),source:'App with existing desktop/Home/Watch browser fixtures',records},null,2)+'\n');
  console.log(`Exported ${records.length} current product screens.`);
} catch (error) {
  let index=0;
  for(const context of browser.contexts()) for(const page of context.pages()) {
    console.error('Capture failure page:',page.url(),(await page.locator('body').innerText().catch(()=>'' )).slice(0,2500));
    await page.screenshot({path:path.join(root,'../artifacts/marketing-failure-'+index++ + '.png')}).catch(()=>{});
  }
  throw new Error(error.message);
} finally { await browser.close(); }