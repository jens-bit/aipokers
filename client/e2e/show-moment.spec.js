import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { midHandGame } from '../src/test/fixtures/game.js';
import { DWELL_MS } from '../src/lib/pace.js';

const shot = name => fileURLToPath(new URL('../../artifacts/show/'+name,import.meta.url));
const board=['Kc','9c','4c','2c','5h'];
const agent={id:'bal-moment',name:'Balance',nature:{name:'Grinder'},identity:{hood:'sand',glow:'gold'},
  mood:{state:'confident',heat:24},fatigue:'fresh',pocket:{balance:2000},stats:{},sessionLog:[],
  activeTableId:'moment-table',location:{where:'casino',tableId:'moment-table',room:'backroom'},
  liveGame:{tableId:'moment-table',street:'flop',board:board.slice(0,3),pot:600,heroSeat:0}};
function scene(kind) {
  const amount=kind==='bust'?5180:kind==='ordinary-opponent'?240:kind==='split'?1000:14800;
  const winner=kind==='opponent'||kind==='ordinary-opponent'?1:0;
  const seats=['Balance','Granite','Ozymandias','Nightjar','Doyle','River Rat'].map((name,i)=>({
    ...midHandGame.seats[i%3],playerId:`moment-${i}`,displayName:name,isAI:true,identity:{hood:i===0?'sand':'slate',glow:i===0?'gold':'mint'},
    holeCards:i===0?['Ks','Kd']:[],stack:2000,contribTotal:i<2?200:0,contribThisStreet:0,folded:i>=2,
  }));
  const live={...midHandGame,tableId:'moment-table',handNumber:42,smallBlind:50,bigBlind:100,community:board.slice(0,3),
    currentBet:0,lastRaiseSize:100,pot:600,toAct:0,pace:'calm',seats};
  const finalSeats=seats.map((s,i)=>({...s,stack:kind==='bust'&&i===1?0:i===winner?(kind==='bust'?9120:kind==='big'?16640:2000+amount):2000,
    holeCards:i===0?['Ks','Kd']:i===1?['9d','9h']:[],allIn:kind==='bust'&&i===1}));
  const resultBoard=kind==='split'?['Ac','Kc','Qc','Jc','Tc']:winner===1?['9c','9s','4c','2c','5h']:board;
  const winners=kind==='split'?[{seat:0,amount:500,hand:'a royal flush'},{seat:1,amount:500,hand:'a royal flush'}]:[{seat:winner,amount,hand:winner===1?'four of a kind':'three of a kind'}];
  // Split/opponent cases are explicit public award fixtures; the design pair
  // cases alone use board26's shown cards. No hidden holding is invented.
  const final={...live,street:'complete',toAct:null,pot:0,community:resultBoard,seats:finalSeats,pace:'showdown',paceFrame:{board:resultBoard},
    result:{type:'showdown',pot:amount,winners}};
  return {live,final,amount,winner};
}

async function install(page,state) {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname;
    return r.fulfill({json:path==='/api/agents'?{agents:[agent]}:path==='/api/slots'?{used:1,cap:4,next:null}
      :path==='/api/wallet'?{balance:12000,ledger:[]}:path.includes('/memory')?{memoryContext:''}:{rooms:[],events:[],lines:[],lastId:0}});
  });
  await page.addInitScript(({agent,state})=>{
    window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=moment',initDataUnsafe:{user:{id:4242}},
      get viewportHeight(){return innerHeight;},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},offEvent(){}}};
    window.__momentSockets=[];
    class Socket extends EventTarget {
      static OPEN=1;OPEN=1;readyState=1;
      constructor(){super();setTimeout(()=>this.dispatchEvent(new Event('open')),10);}
      push(value){if(this.readyState===1)this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
      close(){this.readyState=3;}
      send(raw){const m=JSON.parse(raw);if(m.type==='floor_sub')setTimeout(()=>this.push({type:'home_state',userId:'4242',agents:[agent],game:null}),10);
        if(m.type==='watch'){window.__momentSockets.push(this);setTimeout(()=>{this.push({type:'watching',tableId:state.tableId,spectatorSeat:0});this.push({type:'state',state,yourSeat:0,legalActions:[]});},10);}}
    }
    window.WebSocket=Socket;
    window.__momentPush=state=>window.__momentSockets.forEach(s=>s.push({type:'state',state,yourSeat:0,legalActions:[]}));
  },{agent,state});
  await page.goto('/');
  await page.getByTestId('home-frame-bal-moment').click();
  await expect(page.locator('.watch-felt')).toBeVisible();
  const openedPot=state.street==='complete'?state.result.pot:state.pot;
  await expect(page.locator('.watch-felt__pot-amt')).toHaveText(`$${openedPot.toLocaleString('en-US')}`);
  return errors;
}

async function assertTravel(page,awards) {
  await expect(page.locator('[data-pot-award]')).toHaveCount(awards.length);
  for(const {seat,amount} of awards) {
    const motion=page.locator(`[data-pot-award="${seat}"]`);
    await expect(motion).toHaveAttribute('data-award-amount',String(amount));
    await expect(motion).toHaveAttribute('data-measured','true');
    const travel=await motion.evaluate((origin,seat)=>{
      const root=origin.closest('.watch-felt'),a=origin.getBoundingClientRect(),b=root.querySelector(`[data-award-seat="${seat}"]`).getBoundingClientRect(),r=root.getBoundingClientRect();
      return{dx:parseFloat(origin.style.getPropertyValue('--award-dx')),dy:parseFloat(origin.style.getPropertyValue('--award-dy')),
        expectedX:(b.x+b.width/2-a.x-a.width/2)/(r.width/root.offsetWidth),expectedY:(b.y+b.height/2-a.y-a.height/2)/(r.height/root.offsetHeight)};
    },seat);
    expect(travel.dx).toBeCloseTo(travel.expectedX,0);expect(travel.dy).toBeCloseTo(travel.expectedY,0);
  }
}

for(const kind of ['big','bust'])test(`SHOW-4 board26 ${kind==='big'?'52q':'52r'} visible moment`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const {live,final,amount}=scene(kind),errors=await install(page,live);
  // Compare only the named changed felt, at the reference's native390x647.
  const box=await page.locator('.watch-felt').boundingBox();
  await page.setViewportSize({width:390,height:844+647-Math.round(box.height)});
  await page.evaluate(()=>document.fonts.ready);
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
  const pending={...final,pace:'allin',paceFrame:{board:live.community}};
  await page.evaluate(s=>window.__momentPush(s),pending);
  await expect(page.locator('.watch-felt__won')).toHaveCount(0);
  await expect(page.getByTestId('hand-fireworks')).toHaveCount(0);
  await expect(page.locator('[data-pot-award]')).toHaveCount(0);
  await page.evaluate(s=>window.__momentPush(s),final);
  await page.clock.runFor(DWELL_MS.showdown);
  await expect(page.locator('.watch-felt__won-amt')).toHaveText(`$${amount.toLocaleString('en-US')}`);
  await expect(page.getByTestId('hand-fireworks')).toBeVisible();
  await expect(page.locator('.watch-felt__pot .pot-chip')).toHaveAttribute('data-band','big');
  await assertTravel(page,[{seat:0,amount}]);
  if(kind==='bust')await expect(page.locator('.watch-felt__won-to')).toHaveText('Granite IS OUT');
  const styles=await page.locator('.watch-felt__won-pill').evaluate(el=>{const s=getComputedStyle(el),a=getComputedStyle(el.querySelector('.watch-felt__won-amt'));return{background:s.backgroundColor,blur:s.backdropFilter,font:a.fontFamily,size:a.fontSize,weight:a.fontWeight};});
  expect(styles).toMatchObject({background:'rgba(18, 30, 28, 0.84)',size:'24px',weight:'400'});
  expect(styles.font).toContain('Rozha One');expect(styles.blur).toContain('blur(18px)');
  // The source depicts mid-flight. Pause the real CSS animations at that beat,
  // without replacing the product markup or repainting either reference PNG.
  await page.evaluate(()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=350;}));
  const frame=kind==='big'?'52q':'52r';
  await page.locator('.watch-felt').screenshot({path:shot(`show-4-${frame}-actual-felt.png`)});
  await page.screenshot({path:shot(`show-4-${frame}-actual-phone.png`)});
  await page.evaluate(()=>window.__awardFirstNode=document.querySelector('[data-pot-award]'));
  await page.evaluate(s=>window.__momentPush(s),final);
  expect(await page.evaluate(()=>window.__awardFirstNode===document.querySelector('[data-pot-award]'))).toBe(true);
  expect(errors).toEqual([]);
});

for(const [kind,width] of [['opponent',390],['ordinary-opponent',390],['split',1440]])test(`SHOW-4 ${kind} pays actual seats at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:width===390?590:900});
  const {live,final,amount,winner}=scene(kind),errors=await install(page,live);
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+100));
  await page.evaluate(s=>window.__momentPush(s),final);
  await expect(page.locator('.watch-felt__won')).toBeVisible();
  await assertTravel(page,kind==='split'?[{seat:0,amount:500},{seat:1,amount:500}]:[{seat:winner,amount}]);
  if(kind==='split')await expect(page.locator('.watch-felt__won-shared')).toHaveText('SHARED POT');
  else await expect(page.locator('.watch-felt__won-to')).toContainText('Granite');
  if(kind==='ordinary-opponent')await expect(page.locator('.watch-felt__won-amt')).toHaveCSS('font-size','19px');
  await page.screenshot({path:shot(`show-4-${kind}-${width}.png`)});
  expect(errors).toEqual([]);
});

test('SHOW-4 cold completed entry keeps the receipt without replaying the moment',async({page})=>{
  const {final}=scene('bust'),errors=await install(page,final);
  await expect(page.locator('.watch-felt__won-amt')).toHaveText('$5,180');
  await expect(page.getByTestId('hand-fireworks')).toHaveCount(0);
  await expect(page.locator('[data-pot-award],.hand-busted-name')).toHaveCount(0);
  await expect(page.locator('.hand-busted-scrim')).toHaveCount(1);
  await page.evaluate(s=>window.__momentPush(s),final);
  await expect(page.getByTestId('hand-fireworks')).toHaveCount(0);
  await expect(page.locator('[data-pot-award],.hand-busted-name')).toHaveCount(0);
  expect(errors).toEqual([]);
});
