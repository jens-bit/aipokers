import { test, expect } from '@playwright/test';
import { midHandGame } from '../src/test/fixtures/game.js';
import { rooms, felt } from '../src/test/fixtures/rooms.js';

for(const width of [390,1440])for(const publicView of [false,true]) {
  test(`SHOW-3 ${publicView?'public rail':'owner'} commentary at ${width}`,async({page})=>{
    await page.setViewportSize({width,height:width===390?590:900});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const agent={id:'slick',name:'Big Slick',nature:{name:'Hothead'},identity:{hood:'sand',glow:'gold'},mood:{state:'neutral',heat:30},fatigue:'fresh',pocket:{balance:2000},stats:{},sessionLog:[],activeTableId:'owned-table',location:{where:'casino',tableId:'owned-table',room:'floor'},liveGame:{tableId:'owned-table',street:'preflop',board:[],pot:60,heroSeat:0}};
    const lastAction={seq:1,handNumber:1,seat:0,street:'preflop',type:'raise',amount:2000,chips:1980,allIn:true};
    const state={...midHandGame,tableId:publicView?'public-table':'owned-table',street:'preflop',pace:'calm',community:[],pot:2000,lastAction,
      seats:[{...midHandGame.seats[0],displayName:'Big Slick',holeCards:publicView?[]:['6s','6h']},{...midHandGame.seats[1],displayName:'Granite',holeCards:[]}],
      heroHand:publicView?null:{seq:1,handNumber:1,seat:0,street:'preflop',label:'pocket sixes'}};
    const tables=[felt({tableId:'public-table',seated:2,seats:[{seat:0,name:'Big Slick',stack:2000,inHand:true},{seat:1,name:'Granite',stack:2000,inHand:true}]})];
    await page.route('**/api/**',r=>{
      const path=new URL(r.request().url()).pathname;
      return r.fulfill({json:path==='/api/agents'?{agents:[agent]}:path==='/api/rooms'?{rooms:rooms.map((v,i)=>i===0?{...v,tables:1,seated:2}:v)}:path==='/api/slots'?{used:1,cap:4,next:null}:path==='/api/wallet'?{balance:12000,ledger:[]}:path.includes('/memory')?{memoryContext:''}:{rooms:[],events:[],lines:[],lastId:0}});
    });
    await page.addInitScript(({agent,state,tables,rooms,publicView})=>{
      window.Telegram={WebApp:{initData:'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',initDataUnsafe:{user:{id:4242}},get viewportHeight(){return innerHeight;},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},offEvent(){}}};
      window.__narratorSockets=[];
      class Socket extends EventTarget {
        static OPEN=1;OPEN=1;readyState=1;
        constructor(){super();setTimeout(()=>{this.dispatchEvent(new Event('open'));this.push({type:'home_state',agents:[agent],game:null});},10);}
        push(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
        close(){this.readyState=3;}
        send(raw){const m=JSON.parse(raw);if(m.type==='floor_sub')setTimeout(()=>{this.push({type:'floor_rooms',rooms});this.push({type:'room_tables',tables,rooms:{'public-table':'floor'}});},10);
          if(m.type==='watch'){window.__narratorSockets.push(this);setTimeout(()=>{this.push({type:'watching',tableId:state.tableId,spectatorSeat:publicView?-1:0});this.push({type:'state',state,yourSeat:publicView?-1:0,legalActions:[]});},10);}}
      }
      window.WebSocket=Socket;
      window.__narratorPush=state=>window.__narratorSockets.forEach(s=>s.push({type:'state',state,yourSeat:publicView?-1:0,legalActions:[]}));
    },{agent,state,tables,rooms:rooms.map((v,i)=>i===0?{...v,tables:1,seated:2}:v),publicView});
    await page.goto('/');
    if(publicView){await page.getByTestId('home-door').click();await page.locator('[data-table="public-table"]').click();}
    else await page.getByTestId('home-frame-slick').click();
    const line=page.locator('.action-narrator');
    await expect(line).toHaveText(publicView?'Big Slick shoves $1,980.':'Big Slick shoves with pocket sixes.');
    const terminal={...state,street:'complete',pace:'allin',community:['As','7d','2s','Kh','9c'],paceFrame:{board:[]},result:{type:'showdown',pot:4180,winners:[{seat:1,amount:4180,hand:'a pair of kings'}]}};
    await page.evaluate(s=>window.__narratorPush(s),terminal);
    await expect(line).not.toContainText('took');
    await page.evaluate(s=>window.__narratorPush(s),{...terminal,pace:'showdown',paceFrame:{board:terminal.community}});
    await expect(line).toHaveText('Granite took $4,180 with a pair of kings.');
    await expect(line).toBeInViewport();
    const box=await line.boundingBox(),feltBox=await page.locator('.watch-felt').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(feltBox.y+feltBox.height-1);
    expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
    if(!publicView && width===390)await expect(page.getByPlaceholder('Whisper to him…')).toBeInViewport();
    await page.screenshot({path:`../artifacts/show/narrator-${publicView?'public':'owner'}-${width}.png`});
    expect(errors).toEqual([]);
  });
}
