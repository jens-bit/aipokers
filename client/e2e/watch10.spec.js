// client/e2e/watch10.spec.js — WATCH-10
//
// SIX SEATS AT 390×844, AND NOTHING TOUCHING ANYTHING.
//
// The arithmetic is lib/feltBubbles.test.jsx: a modelled box per pill and per
// bubble, and a placement that skips whoever has no clear side. A model is only
// as good as its numbers, though, and every one of them was read off a
// stylesheet by hand — so this measures the REAL boxes, in a real browser, at
// the size the Mini App actually opens at, and fails if two of them intersect.
//
// Same rules as home.spec.js and bugs-a.spec.js: outside `npm test` and outside
// CI, every fixture served through page.route, no server and no model. Run:
//
//   cd client && npx playwright test e2e/watch10.spec.js

import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 390, height: 844 };
const HOME = 'http://127.0.0.1:5199/';

const loc = (where = 'home', extra = {}) => ({
  where, tableId: null, room: null, since: Date.now() - 41 * 60_000, ...extra,
});

const agent = (id, name, over = {}) => ({
  id,
  name,
  style: 'Balanced',
  risk: 'Medium',
  nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 40 },
  fatigue: 'fresh',
  location: loc('home'),
  routine: { key: 'reads', label: 'reading' },
  unseenRecap: false,
  want: null,
  opener: 'Sit down.',
  activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 },
  careerStats: { hands: 140, sessions: 4, net: 1200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [],
  ...over,
});

const HOUSEHOLD = [agent('a1', 'The Clock'), agent('a2', 'River Rat')];

// The kitchen table, so there is something to tap into the felt with.
const HOME_GAME = {
  tableId: 'home-4242',
  state: 'running',
  seats: [
    { seat: 0, agentId: 'a1', name: 'The Clock', house: false },
    { seat: 1, agentId: 'a2', name: 'River Rat', house: false },
  ],
  handsPlayed: 7,
};

// SIX HANDED, with the widest cast the felt can be asked to draw: long names,
// four-figure stacks, and a hand in progress so every seat has cards, chips and
// a pill up at once. Hero is seat 0, so the other five take ml · tl · tc · tr ·
// mr — every slot the ring has.
const seat = (name, stack, over = {}) => ({
  playerId: `p_${name}`,
  stack,
  holeCards: [],
  contribTotal: 20,
  contribThisStreet: 20,
  folded: false,
  allIn: false,
  actedThisStreet: false,
  displayName: name,
  mood: { state: 'neutral', heat: 30 },
  ...over,
});

const TABLE = {
  tableId: 'home-4242',
  handNumber: 3,
  street: 'flop',
  smallBlind: 10,
  bigBlind: 20,
  dealerSeat: 0,
  pot: 4180,
  community: ['5c', '4h', '8c'],
  currentBet: 40,
  lastRaiseSize: 40,
  toAct: 1,
  seats: [
    seat('The Clock', 1847, { holeCards: ['6h', '6s'], contribThisStreet: 40 }),
    seat('Doyle_v3', 980),
    seat('Granite', 2104),
    seat('nash_eq', 3410),
    seat('Bluff Master General', 12_400),
    seat('ivey_bot', 880),
  ],
  result: null,
};

/** Everything the app asks for, from a fixture — and a socket that plays a hand. */
async function stub(page, { talk = [], owned = false, agentOverrides = {} } = {}) {
  const roster = owned ? HOUSEHOLD.map((a,i)=>i===0 ? {...a,activeTableId:TABLE.tableId,location:loc('table',{tableId:TABLE.tableId,room:'floor'}),liveGame:{tableId:TABLE.tableId,pot:TABLE.pot,board:TABLE.community}} : a) : HOUSEHOLD.map(a => ({ ...a }));
  roster[0] = { ...roster[0], ...agentOverrides };
  await page.route('**/api/agents?**', (r) => r.fulfill({ json: { agents: roster } }));
  await page.route('**/api/agents/*/study**', (r) => r.fulfill({ json: { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (r) => r.fulfill({ json: { sessionId: 's1', count: 0, lines: [] } }));
  await page.route('**/api/home/thread**', (r) => r.fulfill({ json: { sessionId: 'home', count: 0, lines: [] } }));
  await page.route('**/api/fridge?**', (r) => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/agents/*/memory**', (r) => r.fulfill({ json: { memoryContext: '' } }));
  await page.route('**/api/agents/*/hands**', (r) => r.fulfill({ json: { recentHands: [] } }));
  await page.route('**/api/wallet**', (r) => r.fulfill({ json: { balance: 12000, ledger: [] } }));
  await page.route('**/api/events**', (r) => r.fulfill({ json: { events: [], lastId: 0 } }));
  await page.route('**/api/rooms**', (r) => r.fulfill({ json: { rooms: [], hotWindowMs: 20000 } }));
  await page.route('**/api/stats**', (r) => r.fulfill({ json: { totalAgents: 12, handsPlayedToday: 3 } }));
  await page.route('**/api/slots**', (r) => r.fulfill({ json: { used: 2, cap: 4, next: null } }));
  await page.route('**/api/auth/config**', (r) => r.fulfill({ json: { botUsername: '' } }));
  await page.route('https://telegram.org/**', (r) => r.fulfill({ body: '', contentType: 'application/javascript' }));

  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
        initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
        viewportHeight: window.innerHeight,
        ready() {}, expand() {},
        disableVerticalSwipes() {},
        onEvent() {}, offEvent() {},
      },
    };
  });

  // Two sockets, one class: the floor channel answers FLOOR_SUB with the
  // household and the kitchen table; the table channel answers with WATCHING,
  // the six-handed STATE, and whatever the cast is saying.
  await page.addInitScript(([list, home, table, lines]) => {
    const sockets=[];
    window.__pushWatchMessage=msg=>sockets.forEach(socket=>socket.dispatch('message',{data:JSON.stringify(msg)}));
    window.__pushWatchState=state=>sockets.forEach(socket=>socket.dispatch('message',{data:JSON.stringify({type:'state',state,legalActions:[]})}));
    class ScriptedSocket {
      constructor(url) {
        sockets.push(this);
        this.url = url;
        this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          this.dispatch('message', {
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents: list, game: home }),
          });
          this.dispatch('message', { data: JSON.stringify({ type: 'watching', spectatorSeat: 0 }) });
          this.dispatch('message', {
            data: JSON.stringify({ type: 'state', state: table, legalActions: [] }),
          });
          for (const line of lines) {
            this.dispatch('message', {
              data: JSON.stringify({ type: 'chat', from: line.from, seat: line.seat, text: line.text, isAI: true }),
            });
          }
        }, 30);
      }
      dispatch(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) {
        const at = this.listeners[type]?.indexOf(fn) ?? -1;
        if (at >= 0) this.listeners[type].splice(at, 1);
      }
      send() {}
      close() { this.readyState = 3; }
    }
    ScriptedSocket.OPEN = 1;
    ScriptedSocket.prototype.OPEN = 1;
    window.WebSocket = ScriptedSocket;
  }, [roster, owned ? null : HOME_GAME, TABLE, talk]);
}

/** Open the room, tap the kitchen table, and wait for six seats on the felt. */
async function felt(page, opts = {}) {
  await stub(page, opts);
  await page.setViewportSize(opts.viewport ?? VIEWPORT);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
  // The kitchen table opens its sheet, and the sheet offers the game on it.
  if (opts.owned) await page.getByTestId('home-frame-a1').click();
  else {
    await page.getByTestId('home-table').click();
    await page.getByTestId('home-table-watch').click();
  }
  await page.waitForSelector('.watch-felt');
  // The deal has to finish before every seat is holding cards.
  await page.waitForFunction(
    () => document.querySelectorAll('.watch-felt__seat .seat-ghost__backs').length === 5,
    null, { timeout: 15_000 },
  );
}

/** Every box that must not touch another, with a name to fail by. */
async function boxes(page, selector) {
  return page.$$eval(selector, (nodes) => nodes.map((n) => {
    const r = n.getBoundingClientRect();
    return {
      what: `${n.className} "${(n.textContent || '').trim().slice(0, 24)}"`,
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      w: r.width, h: r.height,
    };
  }));
}

const intersects = (a, b) => a.left < b.right && b.left < a.right
  && a.top < b.bottom && b.top < a.bottom;

for (const height of [590,844]) test('BUG-144: staged all-in reveals only new cards and then settles at '+height,async({page})=>{
  await page.clock.install({time:new Date('2030-09-09T12:00:00Z')});
  await felt(page,{owned:true,viewport:{width:390,height}});
  await page.clock.pauseAt(new Date('2030-09-09T12:01:00Z'));
  const held={pace:'allin',board:TABLE.community,card:null};
  const finalBoard=[...TABLE.community,'Kd','2s'];
  const end={...TABLE,street:'complete',pace:'allin',toAct:null,community:finalBoard,paceFrame:held,
    seats:TABLE.seats.map((s,i)=>i===0?{...s,stack:s.stack-200,allIn:true}:s),
    result:{pot:4180,winners:[{seat:1,amount:4180,descr:'three eights'}],deltas:{0:-200},showdown:[{seat:1,holeCards:['8h','8d']},{seat:0,holeCards:['6h','6s']} ]}};
  await page.evaluate(({held,end})=>{
    window.__pushWatchMessage({type:'pace',...held});
    window.__pushWatchState(end);
  },{held,end});
  await page.clock.runFor(4000);
  await expect(page.locator('.watch-felt__board')).toHaveText('548');
  await expect(page.locator('.watch-felt__won')).toHaveCount(0);
  await expect(page.locator('.watch-result-toast')).toHaveCount(0);
  await page.screenshot({path:'../artifacts/batch44-runout-held-'+height+'.png'});
  await page.evaluate(board=>window.__pushWatchMessage({type:'pace',pace:'showdown',board,card:'Kd'}),finalBoard.slice(0,4));
  await page.clock.runFor(50);
  await expect(page.locator('.watch-felt__board')).toHaveText('548K');
  await expect(page.locator('.watch-felt__won')).toHaveCount(0);
  await page.evaluate(board=>window.__pushWatchMessage({type:'pace',pace:'showdown',board,card:'2s'}),finalBoard);
  await page.clock.runFor(50);
  await expect(page.locator('.watch-felt__board')).toHaveText('548K2');
  await expect(page.locator('.watch-felt__won')).toBeVisible();
  await page.evaluate(state=>window.__pushWatchState(state),{...end,pace:'showdown',paceFrame:{pace:'showdown',board:finalBoard,card:null}});
  await page.clock.runFor(50);
  await expect(page.locator('.watch-felt__card--landing')).toHaveCount(0);
  await page.screenshot({path:'../artifacts/batch44-runout-finished-'+height+'.png'});
});

/** Every unordered pair that shares area. */
function collisions(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (intersects(list[i], list[j])) out.push(`${list[i].what}  ×  ${list[j].what}`);
    }
  }
  return out;
}

test.describe('WATCH-10 · density on the felt at 390×844', () => {
  // Design 58 C8a now gives every hero win the raised glass result. The old
  // compact-only assertion encoded the earlier port, not the current board.
  for (const viewport of [{width:390,height:844},{width:390,height:590},{width:1440,height:900}]) test(`BUG-173 / C8: ordinary win card preserves the Watch layout at ${viewport.width}×${viewport.height}`,async({page})=>{
    await felt(page,{owned:viewport.width<1000,viewport});
    await page.evaluate(()=>document.fonts.ready);
    const geometry=()=>boxes(page,'.watch-felt, .watch-felt__seat, .watch-felt__board, .watch-hero__body, .watch-hero__strip, textarea, input');
    const before=await geometry();
    const game={...TABLE,street:'complete',toAct:null,community:['Kc','9c','4c','2c','5h'],seats:TABLE.seats.map((s,i)=>i===0?{...s,holeCards:['Ks','Kd'],stack:5534}:s),result:{type:'showdown',pot:3694,winners:[{seat:0,amount:3694}],showdown:[{seat:0,holeCards:['Ks','Kd']}]},bigBlind:100};
    await page.evaluate(state=>window.__pushWatchState(state),game);
    await expect(page.locator('.watch-hero__hands [data-pose="raise"]')).toHaveCount(1);
    await expect(page.getByTestId('hand-fireworks')).toHaveCount(0);
    await expect(page.locator('.watch-felt__won')).toHaveClass(/is-ordinary-win/);
    await expect(page.locator('.watch-felt__won-to')).toHaveText(viewport.width>=1000?'The Clock WON':'WON');
    await expect(page.locator('.watch-felt__won-amt')).toHaveText('$3,694');
    await expect(page.locator('.watch-felt__won-amt')).toHaveCSS('font-size','19px');
    await expect(page.locator('.watch-felt__won-amt')).toHaveCSS('font-weight','400');
    await expect(page.locator('.watch-felt__won-to')).toHaveCSS('color','rgb(0, 212, 170)');
    await expect(page.locator('.watch-felt__won-pill')).toHaveAttribute('aria-label','The Clock won $3,694 with three kings');
    await expect(page.locator('.watch-felt__won-pill')).toHaveRole('group');
    await expect(page.locator('.watch-felt__won-pill')).toHaveAccessibleName('The Clock won $3,694 with three kings');
    await expect(page.locator('.watch-felt__won')).toHaveCSS('pointer-events','none');
    await page.waitForTimeout(1200);
    // The description changes; the existing seats, board, hero, strip, and
    // composer must stay in exactly the same boxes after the result arrives.
    expect((await geometry()).map(({what,...box})=>box)).toEqual(before.map(({what,...box})=>box));
    const result=await page.locator('.watch-felt__won-pill').boundingBox();
    const board=await page.locator('.watch-felt__board').boundingBox();
    expect(result.y+result.height).toBeLessThanOrEqual(board.y);
    // Keep the existing compact-height clamp and desktop stage scale. The
    // standard phone is the reference's 96px; the 590px shell clamps to 72.875.
    await expect(page.locator('.watch-felt__won')).toHaveCSS('top',viewport.height===590?'72.875px':'96px');
    await page.screenshot({path:`../artifacts/celebration-c8a-${viewport.width}x${viewport.height}.png`});
    const composer=page.getByRole('textbox').first();
    await expect(composer).toBeVisible();
    await composer.fill('Nice hand.');
    await expect(composer).toHaveValue('Nice hand.');
  });
  for(const viewport of [{width:390,height:844},{width:390,height:590},{width:490,height:844}]) {
    test(`C8: result effects preserve the felt and composer at ${viewport.width}×${viewport.height}`,async({page})=>{
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await felt(page,{viewport,owned:true});
      const before=await page.locator('.watch-felt').boundingBox();
      const settled={...TABLE,street:'complete',toAct:null,community:['Kc','9c','4c','2c','5h'],seats:TABLE.seats.map((s,i)=>i===0?{...s,holeCards:['Ks','Kd'],stack:16640}:s),result:{type:'showdown',pot:14800,winners:[{seat:0,amount:14800}],showdown:[{seat:0,holeCards:['Ks','Kd']}]},bigBlind:100};
      await page.evaluate(game=>window.__pushWatchState(game),settled);
      await expect(page.getByTestId('hand-fireworks')).toBeVisible();
      await expect(page.locator('.watch-felt__won-pill')).toContainText('WON 148 BB');
      await expect(page.locator('.watch-hero__hands [data-pose="raise"]')).toHaveCount(1);
      expect(await page.locator('.watch-felt').boundingBox()).toEqual(before);
      const result=await page.locator('.watch-felt__won-pill').boundingBox();
      const board=await page.locator('.watch-felt__board').boundingBox();
      expect(result.y+result.height).toBeLessThanOrEqual(board.y);
      await expect(page.getByTestId('hand-fireworks')).toHaveCSS('pointer-events','none');
      if(viewport.width===390&&viewport.height===844) {
        await page.waitForTimeout(500);
        await page.screenshot({path:'../artifacts/celebration-c8b.png'});
      }
      await expect(page.getByTestId('hand-fireworks')).toHaveCount(0);
      const bust={...settled,handNumber:4,seats:settled.seats.map((s,i)=>i===2?{...s,stack:0}:s)};
      await page.evaluate(game=>window.__pushWatchState(game),bust);
      await expect(page.locator('.hand-busted-name')).toHaveText('Granite');
      await expect(page.locator('.watch-felt__seat.is-busted .seat-ghost__chip')).toHaveCSS('visibility','hidden');
      if(viewport.width===390&&viewport.height===844) {
        await page.waitForTimeout(400);
        await page.screenshot({path:'../artifacts/celebration-c8c.png'});
      }
      await page.getByPlaceholder('Whisper to him…').fill('Nice hand.');
      expect((await page.getByPlaceholder('Whisper to him…').boundingBox()).y).toBeLessThan(viewport.height);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.evaluate(game=>window.__pushWatchState({...game,handNumber:5}),bust);
      await expect(page.locator('.hand-fireworks__spark').first()).toHaveCSS('animation-name','none');
      expect(errors).toEqual([]);
    });
  }
  test('seats six and draws every one of them', async ({ page }) => {
    await felt(page);
    // Five opponents in the ring, and him at the bottom: six seats.
    await expect(page.locator('.watch-felt__seat')).toHaveCount(5);
    await expect(page.locator('.watch-hero__body')).toHaveCount(1);
    await expect(page.locator('.watch-felt__seat .seat-ghost__chip')).toHaveCount(5);
    await expect(page.locator('.watch-felt__seat-pile .chip-stack__amt')).toHaveCount(5);
    await page.screenshot({ path: 'e2e/__screenshots__/watch10-six-seats.png' });
  });

  test('no name pill touches another, or the hero, or the felt\'s edge', async ({ page }) => {
    await felt(page);
    const pills = await boxes(page, '.watch-felt__seat .seat-ghost__chip');
    expect(collisions(pills), 'two name pills on top of each other').toEqual([]);

    const felted = await page.locator('.watch-felt').boundingBox();
    for (const p of pills) {
      expect(p.left, `${p.what} runs off the left`).toBeGreaterThanOrEqual(felted.x);
      expect(p.right, `${p.what} runs off the right`).toBeLessThanOrEqual(felted.x + felted.width);
    }
  });

  test('no chip pile lands on a pill, on another pile, or on the pot', async ({ page }) => {
    await felt(page);
    const all = [
      ...await boxes(page, '.watch-felt__seat .seat-ghost__chip'),
      ...await boxes(page, '.watch-felt__seat-pile'),
      ...await boxes(page, '.watch-felt__pot-pill'),
    ];
    expect(collisions(all)).toEqual([]);
  });

  test('two bubbles never overlap each other, or a pill', async ({ page }) => {
    // Two of the three top seats speaking at once is the case that was broken:
    // tl was pinned at left:6 and ran to 156, tc began at 120.
    await felt(page, { talk: [
      { from: 'Granite', seat: 2, text: 'Again?' },
      { from: 'nash_eq', seat: 3, text: 'Too rich for me.' },
    ] });
    await page.waitForSelector('.watch-felt__bubble');
    const bubbles = await boxes(page, '.watch-felt__bubble');
    const pills = await boxes(page, '.watch-felt__seat .seat-ghost__chip');
    expect(bubbles.length).toBeGreaterThan(0);
    expect(bubbles.length).toBeLessThanOrEqual(2);
    expect(collisions([...bubbles, ...pills])).toEqual([]);

    const felted = await page.locator('.watch-felt').boundingBox();
    for (const b of bubbles) {
      expect(b.left).toBeGreaterThanOrEqual(felted.x);
      expect(b.right).toBeLessThanOrEqual(felted.x + felted.width);
    }
    await page.screenshot({ path: 'e2e/__screenshots__/watch10-bubbles.png' });
  });

  test('a bubble it has no room for is not drawn at all', async ({ page }) => {
    const long = 'He does that every single time he';
    await felt(page, { talk: [
      { from: 'Granite', seat: 2, text: long },
      { from: 'nash_eq', seat: 3, text: long },
    ] });
    await page.waitForSelector('.watch-felt__bubble');
    await expect(page.locator('.watch-felt__bubble')).toHaveCount(1);
  });

  test('one thousands separator, everywhere on the felt', async ({ page }) => {
    await felt(page);
    // 12,400 is the widest figure the cast carries, and the pot is 4,180.
    const felted = await page.locator('.watch-felt').innerText();
    expect(felted).toContain('$12,400');
    expect(felted).toContain('$4,180');
    // A narrow no-break space between digits is the other locale's grouping.
    expect(felted).not.toMatch(/\d[   ]\d/);
  });
});


test('BUG-112: real browser audio plays a new result once and mute stops output',async({page})=>{
  await page.addInitScript(()=>{
    const Native=window.AudioContext||window.webkitAudioContext;
    window.__audioStarts=[];window.__audioContexts=[];
    window.AudioContext=class extends Native {
      constructor(...args){super(...args);window.__audioContexts.push(this);}
      createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source),stop=source.stop.bind(source);source.start=(at)=>{window.__audioStarts.push({at,duration:source.buffer.duration,peak:Math.max(...source.buffer.getChannelData(0).map(Math.abs)),contextState:this.state,stopped:false});source.__entry=window.__audioStarts.at(-1);return start(at);};source.stop=(...args)=>{if(source.__entry)source.__entry.stopped=true;return stop(...args);};return source;}
    };
  });
  await felt(page,{owned:true});
  await expect.poll(()=>page.evaluate(()=>window.__audioContexts[0]?.state)).toBe('running');
  await page.evaluate(()=>{window.__audioStarts=[];});
  const ended={...TABLE,street:'complete',toAct:null,result:{winners:[{seat:0,amount:14800}]},bigBlind:100};
  await page.evaluate(game=>window.__pushWatchState(game),ended);
  await expect.poll(()=>page.evaluate(()=>window.__audioStarts.length)).toBe(2);
  const starts=await page.evaluate(()=>window.__audioStarts);
  expect(starts.map(s=>s.duration).sort()).toEqual([.4,1.2]);
  for(const s of starts){expect(s.contextState).toBe('running');expect(s.peak).toBeGreaterThan(.01);expect(s.peak).toBeLessThan(.8);}
  await page.evaluate(game=>window.__pushWatchState(game),ended);expect(await page.evaluate(()=>window.__audioStarts.length)).toBe(2);
  await page.getByRole('button',{name:'Sound on',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sound off',exact:true})).toBeVisible();
  await page.evaluate(game=>window.__pushWatchState(game),{...TABLE,handNumber:TABLE.handNumber+1});
  await page.evaluate(game=>window.__pushWatchState(game),{...ended,handNumber:TABLE.handNumber+1});
  expect(await page.evaluate(()=>window.__audioStarts.length)).toBe(2);
  expect(await page.evaluate(()=>localStorage.getItem('ap_muted'))).toBe('1');
});

for (const height of [844, 590]) test('BUG-120/121 real felt brow and expression clocks at 390x' + height, async ({ page }) => {
  await page.clock.install({ time: new Date('2030-09-09T12:00:00Z') });
  await felt(page, { owned: true, viewport: { width: 390, height } });
  await page.clock.pauseAt(new Date('2030-09-09T12:01:00Z'));
  const before = await page.locator('.watch-felt').boundingBox();
  const hot = { ...TABLE, seats: TABLE.seats.map(s => ({ ...s, mood: { state: 'neutral', heat: 55 } })) };
  await page.evaluate(state => window.__pushWatchState(state), hot);
  await expect(page.locator('[data-brow="knit"]')).toHaveCount(6);
  await page.evaluate(() => window.__pushWatchMessage({ type: 'decision', seat: 1, action: { type: 'call', amount: 40 }, event: 'raisedAgainst' }));
  await expect(page.locator('[data-brow="twitch"]')).toHaveCount(1);
  await page.clock.runFor(399); await expect(page.locator('[data-brow="twitch"]')).toHaveCount(1);
  await page.screenshot({ path: '../artifacts/reaction35-' + height + '-twitch.png' });
  await page.clock.runFor(1); await expect(page.locator('[data-brow="twitch"]')).toHaveCount(0);
  await expect(page.locator('[data-brow="knit"]')).toHaveCount(6);
  const strong = { ...TABLE, handNumber: TABLE.handNumber + 1, heroEquity: 0.8 };
  await page.evaluate(state => { window.__pushWatchMessage({ type: 'hand_start', handNumber: state.handNumber }); window.__pushWatchState(state); }, strong);
  await expect(page.locator('[data-brow="knit"]')).toHaveCount(0);
  await page.clock.runFor(180); await expect(page.locator('.watch-hero [data-brow="lift"]')).toHaveCount(1);
  await page.clock.runFor(699); await expect(page.locator('.watch-hero [data-brow="lift"]')).toHaveCount(1);
  await page.screenshot({ path: '../artifacts/reaction35-' + height + '-lift.png' });
  await page.clock.runFor(1); await expect(page.locator('[data-brow="lift"]')).toHaveCount(0);
  const result = { ...strong, street: 'complete', toAct: null, result: { pot: 4180, winners: [{ seat: 0, amount: 4180, descr: 'a pair' }], showdown: [], events: { 0: 'wonBig', 1: 'badBeat' } } };
  await page.evaluate(state => window.__pushWatchState(state), result);
  await expect(page.locator('.watch-hero g[data-event="smug"]')).toHaveCount(1);
  await expect(page.locator('.watch-felt__seat g[data-event="stunned"]')).toHaveCount(1);
  await page.clock.runFor(1500); await page.evaluate(state => window.__pushWatchState(state), result);
  await page.clock.runFor(500); await expect(page.locator('g[data-event="smug"]')).toHaveCount(0);
  await expect(page.locator('g[data-event="stunned"]')).toHaveCount(1);
  await page.clock.runFor(1000); await expect(page.locator('g[data-event="stunned"]')).toHaveCount(0);
  expect(await page.locator('.watch-felt').boundingBox()).toEqual(before);
});

test('FTU37: BUG-129 first preflop and no read retain the live felt',async({page})=>{
 await felt(page,{owned:true});
 const first={...TABLE,handNumber:1,street:'preflop',community:[],pot:30,reads:[],heroEquity:null};
 await page.evaluate(state=>{window.__pushWatchMessage({type:'hand_start',handNumber:1});window.__pushWatchState(state);},first);
 await expect(page.locator('.watch-felt')).toBeVisible();await expect(page.locator('.watch-hero__cards')).toBeVisible();
 await expect(page.locator('.watch-felt__hero-card').first()).toHaveCSS('opacity','1');
 await page.screenshot({path:'../artifacts/empty37-first-preflop.png'});
 await page.getByRole('button',{name:'Doyle_v3 — read',exact:true}).click();
 await expect(page.getByText('NO EVIDENCE YET',{exact:true})).toBeVisible();await expect(page.locator('.read-sheet .read-bar')).toHaveCount(5);await expect(page.locator('.read-sheet .read-bar__band')).toHaveCount(0);
 await expect(page.locator('.read-sheet .read-bar__value')).toHaveText(['··','··','··','··','··']);
 await page.waitForTimeout(600);await page.screenshot({path:'../artifacts/empty37-no-reads.png'});
});
for (const height of [844, 590]) test('AUDIT40 BUG-132/133: Watch whisper, companion, read and cost preserve the felt at 390x' + height, async ({ page }) => {
  await felt(page, { owned: true, viewport: { width: 390, height }, agentOverrides: {
    recentHands: [{ handNumber: 2, attrCosts: [{ key: 'DISCIPLINE', line: 'He called a river jam he had already decided to fold.', street: 'river' }] }],
  } });
  const feltBox = await page.locator('.watch-felt').boundingBox();
  const cards = page.locator('.watch-hero__cards');
  const cardsBox = await cards.boundingBox();
  await expect(page.locator('.watch-hero__cost')).toBeVisible();
  await page.screenshot({ path: '../artifacts/watch40-' + height + '-cost.png' });
  const dot = page.getByRole('button', { name: /Why the hand went wrong/ });
  await expect(dot).toBeVisible({ timeout: 6000 });
  await page.screenshot({ path: '../artifacts/watch40-' + height + '-dot.png' });
  await dot.click(); await expect(page.locator('.watch-hero__cost')).toBeVisible();
  expect(await page.locator('.watch-felt').boundingBox()).toEqual(feltBox);
  await expect(dot).toBeVisible({ timeout: 6000 });
  const next = { ...TABLE, handNumber: 4, pot: 600 };
  await page.evaluate(state => { window.__pushWatchMessage({ type: 'hand_start', handNumber: state.handNumber }); window.__pushWatchState({ ...state, street: 'preflop', community: [], pot: 30 }); }, next);
  await expect(page.locator('.watch-hero__strip')).toContainText('PREFLOP');
  await expect(dot).toBeVisible();
  await page.evaluate(state => window.__pushWatchState(state), next);
  await expect(page.locator('.watch-hero__strip')).toContainText('FLOP');
  await expect(page.locator('.watch-felt__pot')).toContainText('600');
  await expect(dot).toHaveCount(0);

  await page.route('**/api/agents/chat', r => r.fulfill({ json: { chat: [{ role: 'assistant', content: 'I have him covered.' }] } }));
  await page.getByRole('textbox', { name: /Whisper to/ }).fill('Careful with him.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('.watch-whisper')).toHaveText('Careful with him.');
  await page.screenshot({ path: '../artifacts/watch40-' + height + '-whisper.png' });
  await expect(page.locator('.watch-whisper')).toHaveCount(0, { timeout: 6000 });
  await page.getByRole('button', { name: 'Doyle_v3 — read', exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('.read-sheet')).toBeVisible();
  expect(await page.locator('.watch-felt').boundingBox()).toEqual(feltBox);
  expect(await cards.boundingBox()).toEqual(cardsBox);
  await page.screenshot({ path: '../artifacts/watch40-' + height + '-read.png' });
  expect(await page.locator('.watch-hero').evaluate(el => +getComputedStyle(el).zIndex), 'BUG-133: owned cards stay above the read glass').toBeGreaterThan(await page.locator('.read-sheet').evaluate(el => +getComputedStyle(el).zIndex));
  await expect(page.locator('.watch-hero__body > .mood-ghost')).toHaveCSS('opacity', '0.4');
  await expect(page.locator('.watch-felt__hero-card').first()).toHaveCSS('opacity', '1');
  if (height === 590) {
    await page.locator('.read-sheet').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const lineBox = await page.locator('.read-sheet__line').boundingBox();
    expect(lineBox.y + lineBox.height, 'BUG-133: the final read line can scroll clear of owned cards').toBeLessThan(cardsBox.y);
    await page.screenshot({ path: '../artifacts/watch40-590-read-scrolled.png' });
    await page.locator('.read-sheet').evaluate(el => { el.scrollTop = 0; });
  }
  await page.getByRole('button', { name: 'Close read' }).click();
  // Board42 C1 explicitly replaces 52d: tap him anywhere, including the felt,
  // and get the full companion. Do not restore the older owner history sheet.
  await page.route('**/api/agents/*/flagged**', r => r.fulfill({ json: { flagged: [] } }));
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await page.waitForTimeout(600);
  await expect(page.locator('.agent-view')).toBeVisible();
  await page.screenshot({ path: '../artifacts/watch40-' + height + '-companion.png' });
  await page.getByRole('button', { name: 'Watch live game', exact: true }).click();
  await expect(page.locator('.watch-felt')).toBeVisible();
  expect(await page.locator('.watch-felt').boundingBox()).toEqual(feltBox);
});

test('AUDIT40: each two-to-six seat ring preserves the phone felt and visible opponent cards stay hidden', async ({ page }) => {
  await felt(page, { owned: true });
  const box = await page.locator('.watch-felt').boundingBox();
  for (const count of [2, 3, 4, 5, 6]) {
    await page.evaluate(state => window.__pushWatchState(state), { ...TABLE, seats: TABLE.seats.slice(0, count) });
    await expect(page.locator('.watch-felt__seat')).toHaveCount(count - 1);
    await expect(page.locator('.watch-felt__seat .seat-ghost__backs')).toHaveCount(count - 1);
    expect(await page.locator('.watch-felt').boundingBox()).toEqual(box);
    await page.waitForTimeout(650);
    await page.screenshot({ path: '../artifacts/watch40-ring-' + count + '.png' });
  }
});
