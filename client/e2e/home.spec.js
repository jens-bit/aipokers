// client/e2e/home.spec.js — HOME-1
//
// Five pictures of the room at 390×844, the size the Mini App actually opens at.
//
// WHY THIS IS NOT IN `npm test` OR IN CI, and why Playwright is not a dependency
// of this repo:
//
//   * It is a LOOK check, not a rule check. Everything with a rule behind it —
//     the routine ladder, the walks, the want flow, the thread, the money law —
//     is asserted in HomeScreen.test.jsx under vitest, which runs in seconds and
//     gates every commit. Screenshots gate nothing; they are for a person's
//     eyes, and a screenshot diff in CI is a machine asking a person to look at
//     a picture, every time a shadow moves.
//   * Playwright plus a browser is a heavy install to put in every
//     contributor's `npm ci` for a check nothing blocks on. It is run with
//     `npx playwright test` from client/, which needs no entry in package.json
//     (CLAUDE.md: no new npm dependencies without a stated reason — the reason
//     for NOT adding one is this paragraph).
//
// The five states are the brief's own: one agent alone, two home and one away,
// a want, the thread open, the tape room. Each is served from a fixed fixture
// through page.route, so nothing here needs a server, a database, or a model —
// and the pictures are the same on every machine.
//
// Run:  cd client && npx playwright test e2e/home.spec.js
// Look: client/e2e/__screenshots__/*.png

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { roomsResponse } from '../src/test/fixtures/rooms.js';
import { bigBluffHand, badBeatHand } from '../src/test/fixtures/flagged.js';

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
  opener: 'Sit down. What do you want to know?',
  activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 },
  careerStats: { hands: 140, sessions: 4, net: 1200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [],
  ...over,
});

const CASTS = {
  alone: {
    name: 'one-alone',
    agents: [agent('a1', 'The Clock', { nature: { name: 'Grinder' }, routine: { key: 'counts', label: 'counting chips' } })],
    game: null,
  },
  household: {
    name: 'two-home-one-away',
    agents: [
      agent('a1', 'The Clock', { nature: { name: 'Grinder' }, routine: { key: 'plays', label: 'in a hand' } }),
      agent('a2', 'River Rat', { nature: { name: 'Shark' }, routine: { key: 'plays', label: 'in a hand' }, mood: { state: 'confident', heat: 58 } }),
      agent('a3', 'Big Slick', {
        nature: { name: 'Hothead' },
        location: loc('table', { tableId: 't1', room: 'upstairs' }),
        routine: null,
        activeTableId: 't1',
        mood: { state: 'tilted', heat: 78 },
        liveGame: { tableId: 't1', pot: 480, board: ['Ah', 'Kd', '2c'], net: 340, street: 'flop' },
      }),
    ],
    game: { tableId: 'home-u1', state: 'running', seats: [{ seat: 0, agentId: 'a1', name: 'The Clock', house: false }, { seat: 1, agentId: 'a2', name: 'River Rat', house: false }], handsPlayed: 7 },
  },
  want: {
    name: 'a-want',
    agents: [
      agent('a1', 'The Clock', {
        mood: { state: 'frustrated', heat: 64 },
        want: { kind: 'beer', text: "Can I have a beer. It's been rough.", needs: null, dangerous: false },
      }),
      agent('a2', 'River Rat', { nature: { name: 'Hothead' }, routine: { key: 'paces', label: 'pacing' } }),
    ],
    game: null,
  },
  tape: {
    name: 'the-tape-room',
    agents: [
      agent('a1', 'The Clock', { routine: { key: 'tape', label: 'the tape room' } }),
      agent('a2', 'River Rat', { routine: { key: 'sleeps', label: 'asleep' }, fatigue: 'worn', mood: { state: 'sulking', heat: 22 } }),
    ],
    game: null,
    study: {
      study: { handNumber: 41, flagType: 'badBeat', startedAt: Date.now(), endsAt: Date.now() + 60_000 },
      book: [{ playerId: 'p1', displayName: 'Granite', updatedAt: Date.now(), lines: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] }],
      count: 1,
    },
  },
};

const THREAD = {
  sessionId: 's1',
  count: 4,
  lines: [
    { id: 1, kind: 'table', who: 'TABLE', text: 'Granite raised to 240', ts: Date.now() - 500_000, source: 'table' },
    { id: 2, kind: 'him', who: 'HIM', text: 'He does that every single time.', ts: Date.now() - 480_000, source: 'table' },
    { id: 3, kind: 'you', who: 'YOU', text: 'So take it off him.', ts: Date.now() - 460_000, source: 'table' },
    { id: 4, kind: 'him', who: 'HIM', text: 'Working on it. Long night in here.', ts: Date.now() - 60_000, source: 'home' },
  ],
};

// Everything the room asks for, from a fixture. No server, no database, no model.
async function stub(page, cast) {
  await page.route('**/api/agents?**', (route) => route.fulfill({ json: { agents: cast.agents } }));
  await page.route('**/api/agents/*/study**', (route) => route.fulfill({ json: cast.study ?? { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (route) => route.fulfill({ json: THREAD }));
  await page.route('**/api/home/thread**', route => route.fulfill({ json: cast.agents.length ? THREAD : { sessionId: 'home-empty', lines: [], count: 0 } }));
  await page.route('**/api/fridge?**', route => route.fulfill({ json: { items: [{ id: 'beer', count: 4, price: 12 }, { id: 'snack', count: 2, price: 8 }] } }));
  await page.route('**/api/wallet**', (route) => route.fulfill({ json: { balance: 12_000, ledger: [] } }));
  await page.route('**/api/events**', (route) => route.fulfill({ json: { events: [], lastId: 0 } }));
  await page.route('**/api/rooms**', (route) => route.fulfill({ json: { rooms: [], hotWindowMs: 20_000 } }));
  await page.route('**/api/auth/config**', (route) => route.fulfill({ json: { botUsername: '' } }));

  // index.html loads Telegram's real SDK from telegram.org, and it REPLACES
  // window.Telegram when it arrives — which is after addInitScript has run, so
  // the stub below was being overwritten by a session with no initData and the
  // login gate took the screen. Block it: there is no Telegram here to talk to.
  await page.route('https://telegram.org/**', (route) => route.fulfill({ body: '', contentType: 'application/javascript' }));

  // The Mini App SDK, installed before the bundle runs so the login gate opens.
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
        initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
        get viewportHeight() { return window.innerHeight; },
        ready() {}, expand() {}, disableVerticalSwipes() {},
        onEvent() {}, offEvent() {},
      },
    };
  });

  // HOME_STATE rides a WebSocket, and the HOME GAME rides only HOME_STATE —
  // GET /api/agents has no kitchen table in it. So the socket is scripted
  // rather than silenced: it opens, answers FLOOR_SUB with this cast's own
  // HOME_STATE, and says nothing else. That is the frame the server would
  // send, so the picture is of the real screen and not of a fallback.
  await page.addInitScript(([agents, game]) => {
    class ScriptedSocket {
      constructor(url) {
        this.url = url;
        (window.__homeSockets ??= []).push(this);
        this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          this.dispatch('message', {
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents, game }),
          });
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
  }, [cast.agents, cast.game ?? null]);
}

async function room(page, cast, viewport = VIEWPORT) {
  await stub(page, cast);
  await page.setViewportSize(viewport);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
  // The room's own bodies have landed, so nothing is captured mid-mount.
  await page.waitForSelector('.home-flat');
  await page.waitForTimeout(600);
}

test.describe('HOME-1 · board 29 at 390×844', () => {
  for(const viewport of [{width:390,height:844},{width:390,height:590},{width:490,height:844}]) {
    test(`N3: casino conversation and carousel at ${viewport.width}×${viewport.height}`,async({page})=>{
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await room(page,{agents:[agent('bal','Bal'),agent('agg','Agg')],game:null},viewport);
      await page.route('**/api/rooms',r=>r.fulfill({json:roomsResponse}));
      await page.route('**/api/rooms/*/tables',r=>r.fulfill({json:{tables:[]}}));
      const requests=[];
      await page.route('**/api/agents/chat',r=>{requests.push({body:r.request().postDataJSON(),headers:r.request().headers()});return r.fulfill({status:503,json:{error:'Try again'}});});
      await page.getByTestId('home-door').click();
      await expect(page.getByTestId('floor-view')).toBeVisible();
      const footer=page.locator('.home-thread');
      expect((await footer.boundingBox()).y+(await footer.boundingBox()).height).toBe(viewport.height);
      const floor=await page.getByTestId('floor-view').boundingBox();
      expect(floor.y+floor.height).toBeLessThanOrEqual((await footer.boundingBox()).y);
      await page.getByTestId('casino-view-toggle').getByRole('button',{name:'Board',exact:true}).click();
      const live=await page.locator('.csn-live').boundingBox(),tonight=await page.locator('.csn-tonight').boundingBox(),door=await page.locator('.csn-room-door').first().boundingBox();
      expect(live.y+live.height).toBeLessThan(tonight.y);
      expect(tonight.y+tonight.height).toBeLessThan(door.y);
      await expect(page.getByText('ON THE FLOOR RIGHT NOW',{exact:true})).toHaveCount(0);
      await page.getByRole('tab',{name:'Agg',exact:true}).click();
      await expect(page.getByTestId('home-thread-line')).toContainText('Agg');
      const input=page.getByRole('textbox',{name:'Say something to Agg'});
      await input.fill('Play it patient');
      await page.getByRole('button',{name:'Send',exact:true}).click();
      await expect(page.getByRole('alert')).toContainText('Could not send');
      await expect(input).toHaveValue('Play it patient');
      expect(requests).toHaveLength(1);
      expect(requests[0].body.existingAgentId).toBe('agg');
      expect(requests[0].headers['x-telegram-init-data']).toContain('hash=deadbeef');
      // Capture the resting band separately from its intentional error state.
      await page.getByRole('tab',{name:'Bal',exact:true}).click();
      await expect(page.getByTestId('home-thread-line')).toContainText('Bal');
      await expect.poll(()=>page.locator('.csn-your__track').evaluate(el=>Math.abs(el.scrollLeft))).toBeLessThan(1);
      if(viewport.height===844){
        const panel=await page.getByTestId('your-tables').boundingBox();
        expect(Math.abs(panel.y+panel.height-(await footer.boundingBox()).y)).toBeLessThanOrEqual(12);
      }
      if(viewport.width===390&&viewport.height===844){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'../artifacts/casino30-n3b.png'});}
      await page.getByTestId('home-thread-line').click();
      await expect(page.getByRole('dialog',{name:"Bal's thread"})).toBeVisible();
      await page.getByRole('button',{name:'Close the thread'}).click();
      await page.getByRole('button',{name:'Back home',exact:true}).click();
      await expect(page.getByTestId('home-screen')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
  for(const viewport of [{width:390,height:844},{width:390,height:590},{width:490,height:844}]) {
    test(`C7: the television opens its live table or recorded hand at ${viewport.width}×${viewport.height}`,async({page})=>{
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/api/agents/*/memory?**',r=>r.fulfill({json:{memories:[]}}));
      await room(page,CASTS.household,viewport);
      await expect(page.getByTestId('home-tv-felt')).toBeVisible();
      if(viewport.width===390&&viewport.height===844) await page.screenshot({path:'../artifacts/tv-c7a.png'});
      await page.getByTestId('home-tv').click();
      await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();
      const study={handNumber:badBeatHand.handNumber,startedAt:Date.now()-30000,endsAt:Date.now()+60000};
      const cast={agents:[
        agent('bal','Balanced v2.1',{nickname:'Bal',routine:{key:'tape',label:'the tape room'},study,sessionFlagged:[badBeatHand]}),
        agent('agg','Aggressive v1.3',{routine:{key:'paces',label:'pacing'},mood:{state:'tilted',heat:84}}),
        agent('val','Value Bot',{routine:{key:'sleeps',label:'asleep'},fatigue:'worn'}),
      ],game:null,study:{study,book:[],count:0}};
      await room(page,cast,viewport);
      await page.route('**/api/agents/*/flagged?**',r=>r.fulfill({json:{flaggedHands:[badBeatHand]}}));
      await page.route('**/api/agents/*/hands?**',r=>r.fulfill({json:{recentHands:[]}}));
      await expect(page.getByTestId('home-tape')).toContainText('BAD BEAT');
      if(viewport.width===390&&viewport.height===844) await page.screenshot({path:'../artifacts/tv-c7b.png'});
      await page.getByTestId('home-tv').click();
      await expect(page.locator('.replay-theatre')).toBeVisible();
      expect((await page.locator('.app').boundingBox()).width).toBe(viewport.width);
      await page.getByRole('button',{name:'Back',exact:true}).click();
      await expect(page.getByTestId('home-screen')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
  for(const viewport of [{width:390,height:844},{width:390,height:590},{width:490,height:844}]) {
    test(`ROSTER-1: C6 absence and vertical door at ${viewport.width}×${viewport.height}`,async({page})=>{
      const cast=[
        agent('bal','Balanced v2.1',{nickname:'Bal',location:loc('table',{tableId:'t1',room:'upstairs'}),activeTableId:'t1',liveGame:{tableId:'t1',pot:4180,board:['Ah','Kd','2c'],net:3694,street:'flop'},mood:{state:'confident',heat:22}}),
        agent('agg','Aggressive v1.3',{nickname:'Agg',routine:{key:'plays',label:'in a hand'},mood:{state:'tilted',heat:84}}),
        agent('blf','Bluff Master',{nickname:'Bluff',routine:{key:'plays',label:'in a hand'},mood:{state:'frustrated',heat:58}}),
        agent('val','Value Bot',{nickname:'Value',routine:{key:'sleeps',label:'sleeping'},mood:{state:'sulking',heat:12},fatigue:'worn'}),
      ];
      const game={state:'running',tableId:'home-4242',seats:[{seat:0,agentId:'agg',house:false},{seat:1,agentId:'blf',house:false}],handsPlayed:7};
      await room(page,{agents:cast,game},viewport);
      await page.route('**/api/slots**',r=>r.fulfill({json:{used:4,cap:4,next:null}}));
      await expect(page.getByRole('button',{name:'Your agents',exact:true})).toHaveText('1 AGENT LIVE');
      await expect(page.getByLabel("Bal's empty chair")).toBeVisible();
      await expect(page.getByTestId('home-frame-bal')).toBeVisible();
      const sign=page.getByTestId('home-door-sign');
      await expect(sign).toHaveCount(1);
      await expect(sign.locator('.home-flat__sign-word')).toHaveCSS('writing-mode','vertical-rl');
      const door=await page.getByTestId('home-door').boundingBox(), label=await sign.boundingBox();
      expect(label.x).toBeGreaterThanOrEqual(door.x-.5);
      expect(label.x+label.width).toBeLessThanOrEqual(door.x+door.width+.5);
      if(viewport.width===390&&viewport.height===844){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'../artifacts/absence-c6.png'});}
      await page.getByTestId('home-table').click({position:{x:55,y:50}});
      await expect(page.getByTestId('home-table-sheet')).toBeVisible();
    });
  }
  for (const viewport of [{width:390,height:844},{width:390,height:590},{width:490,height:844}]) {
    test(`AGENT-1: C4 profile and whisper at ${viewport.width}×${viewport.height}`, async ({page}) => {
      const now=Date.now();
      const ag=agent('bal','Balanced v2.1',{mood:{state:'confident',heat:22},fatigue:'worn',bornAt:Date.UTC(2026,7,4),attrs:{READS:62,COMPOSURE:41},pocket:{balance:1200,stakes:{label:'25/50'}},sessionLog:[{net:3694,hands:42}],attrLog:[
        {key:'READS',from:61,to:62,cause:'Called the river sizing.',ts:now-4*60000},
        {key:'COMPOSURE',from:42,to:41,cause:'Time away softened his edge.',ts:now-18*60000},
        {key:'COMPOSURE',from:41,to:42,cause:'Held after the cooler.',ts:now-26*60000},
        {key:'READS',from:60,to:61,cause:'He had The Grinder read.',ts:now-41*60000},
      ]});
      await room(page,{agents:[ag],game:null},viewport);
      await page.route('**/api/agents/*/hands?**',r=>r.fulfill({json:{recentHands:[]}}));
      await page.route('**/api/agents/*/flagged?**',r=>r.fulfill({json:{flaggedHands:[]}}));
      const whispers=[];
      await page.route('**/api/agents/chat',r=>{whispers.push(r.request().postDataJSON());return r.fulfill({json:{chat:[{role:'assistant',content:'I will watch his river bet.'}]}});});
      await page.getByRole('button',{name:/^Balanced v2.1 —/}).click();
      await page.getByRole('button',{name:'Profile',exact:true}).click();
      const profile=page.locator('.profile-overview');
      await expect(profile.getByText(ag.name,{exact:true})).toHaveCount(1);
      await expect(profile.getByText('Called the river sizing.')).toBeVisible();
      expect((await profile.boundingBox()).width).toBe(viewport.width);
      expect((await profile.locator('.agent-view__header').boundingBox()).height).toBe(40);
      const composer=profile.getByRole('textbox',{name:'Whisper to him'});
      expect((await composer.boundingBox()).y+(await composer.boundingBox()).height).toBeLessThanOrEqual(viewport.height);
      if(viewport.width===390&&viewport.height===844){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'../artifacts/profile-c4.png'});}
      await composer.fill('Watch that river.');
      await profile.getByRole('button',{name:'Send whisper'}).click();
      await expect(profile.getByText('I will watch his river bet.')).toBeVisible();
      expect(whispers).toEqual([{userId:'4242',content:'Watch that river.',existingAgentId:'bal'}]);
      await profile.getByRole('button',{name:'More actions'}).click();
      await page.getByRole('button',{name:'His sheet'}).click();
      await expect(page.getByText('Skills',{exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Back',exact:true}).click();
      await expect(profile).toBeVisible();
    });
  }
  test('BUG-69: C5 roster distinguishes location, result and pocket in compact rows', async ({ page }) => {
    const cast = [
      agent('bal', 'Balanced v2.1', { activeTableId: 't1', location: loc('table', { tableId: 't1', room: 'upstairs' }), liveGame: { tableId: 't1', net: 3694, heroStack: 4894 }, pocket: { balance: 1200 }, mood: { state: 'confident', heat: 22 } }),
      agent('agg', 'Aggressive v1.3', { pocket: { balance: 640 }, sessionLog: [{ net: -820, endedAt: Date.now() }], mood: { state: 'tilted', heat: 84 }, want: { text: 'Let me back in there. Right now.' }, routine: { key: 'paces', label: 'pacing' } }),
      agent('blf', 'Bluff Master', { location: loc('casino'), visiting: { hostName: 'Fidde' }, pocket: { balance: 410 }, sessionLog: [{ net: 95, endedAt: Date.now() }], mood: { state: 'frustrated', heat: 60 } }),
      agent('val', 'Value Bot', { homeTableId: 'home-4242', pocket: { balance: 80 }, mood: { state: 'sulking', heat: 12 }, routine: null }),
    ];
    await room(page, { agents: cast, game: null });
    await page.getByRole('button', { name: 'Your agents', exact: true }).click();
    const sheet = page.getByTestId('roster-sheet');
    await expect(sheet).toContainText('4 agents · 1 live');
    await expect(sheet).toContainText("visiting Fidde's");
    await expect(sheet).toContainText('at your table');
    await expect(sheet).toContainText('−$820');
    await expect(sheet.getByText('POCKET', { exact: true })).toHaveCount(4);
    for (const row of await sheet.locator('.roster__row').all()) expect((await row.boundingBox()).height).toBeLessThanOrEqual(64);
    await expect(page.locator('.roster__panel')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: '../artifacts/roster-c5.png' });
    await page.route('**/api/agents/agg/hands?**', r => r.fulfill({ json: { recentHands: [] } }));
    await page.route('**/api/agents/agg/flagged?**', r => r.fulfill({ json: { flaggedHands: [] } }));
    await sheet.getByRole('button', { name: /^Aggressive v1.3 —/ }).click();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'More actions' }).click();
    await expect(page.getByRole('button', { name: 'Send to a friend' })).toBeVisible();
  });
  test('BUG-64: F13 renders stock and buys six from the safe', async ({ page }) => {
    await room(page, CASTS.alone);
    const bought = [];
    await page.route('**/api/fridge/stock', r => { bought.push(r.request().postDataJSON()); return r.fulfill({ json: { qty: 6, fridge: { beer: 10, snack: 2 } } }); });
    await page.getByTestId('home-fridge').click();
    const shelf = page.getByTestId('fridge-shelf-beer');
    await expect(shelf).toContainText('× 4');
    await expect(shelf).toContainText('$12 each');
    await expect(page.locator('.fridge-stock')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: '../artifacts/fridge-f13.png' });
    await shelf.getByRole('button', { name: 'Buy 6 beer' }).click();
    await expect(shelf).toContainText('× 10');
    expect(bought).toEqual([{ userId: '4242', item: 'beer', qty: 6 }]);
  });
  for (const [frame, companion] of [
    ['c1', agent('bal', 'Balanced v2.1', { nickname: 'Bal', mood: { state: 'confident', heat: 22 }, drinking: true, opener: 'Put me in.', pocket: { balance: 1200, cap: 5000 } })],
    ['c2', agent('agg', 'Aggressive v1.3', { nickname: 'Agg', mood: { state: 'tilted', heat: 84 }, fatigue: 'settled', opener: 'Still thinking about that cooler against The Grinder.', want: { text: 'Let me back in there. Right now.', dangerous: true }, pocket: { balance: 640, cap: 2000 } })],
    ['c3', agent('bal', 'Balanced v2.1', { nickname: 'Bal', mood: { state: 'confident', heat: 22 }, chatHistory: [{ role: 'user', content: 'Why did you call there?' }, { role: 'assistant', content: 'It was the sizing. He never bets that big with a hand.' }, { role: 'user', content: 'Which hand?' }, { role: 'assistant', content: 'This one.' }, { role: 'user', content: 'Stay off him for a bit.' }, { role: 'assistant', content: 'Fine. I will wait for the button.' }] })],
  ]) {
    test(`AGENT-1: board 42 ${frame} reference state`, async ({ page }) => {
      await room(page, { agents: [companion], game: null });
      await page.route('**/api/agents/*/hands?**', r => r.fulfill({ json: { recentHands: [] } }));
      await page.route('**/api/agents/*/flagged?**', r => r.fulfill({ json: { flaggedHands: frame === 'c3' ? [bigBluffHand] : [] } }));
      await page.getByRole('button', { name: new RegExp(`^${companion.name} — `) }).click();
      await expect(page.getByTestId('agent-stage')).toBeVisible();
      await expect(page.locator('.agent-view__thread .agent-view__text').first()).toBeVisible();
      if (companion.want) await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (companion.fatigue === 'fresh') {
        const full = page.locator('.agent-view__body [data-bar="stamina"]');
        expect((await full.locator('i').boundingBox()).width).toBeCloseTo((await full.boundingBox()).width, 0);
      }
      await page.screenshot({ path: `../artifacts/agent-${frame}.png` });
      expect(await page.locator('.agent-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    });
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 590 }, { width: 490, height: 844 }]) {
    test(`AGENT-1: character, conversation and Carry at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await room(page, CASTS.alone, viewport);
      await page.route('**/api/agents/*/hands?**', r => r.fulfill({ json: { recentHands: [] } }));
      await page.route('**/api/agents/*/attributes/log?**', r => r.fulfill({ json: { entries: [] } }));
      await page.route('**/api/agents/*/flagged?**', r => r.fulfill({ json: { flaggedHands: [] } }));
      await page.getByRole('button', { name: /^The Clock — / }).click();
      await expect(page.getByTestId('agent-stage')).toBeVisible();
      await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();
      await expect(page.locator('.dr-app-header')).toHaveCount(0);
      expect((await page.locator('.agent-view__header').boundingBox()).height).toBe(40);
      expect((await page.getByTestId('agent-stage').boundingBox()).width).toBe(viewport.width);
      const stage = await page.getByTestId('agent-stage').boundingBox();
      const namePill = await page.locator('.agent-view__body .home-pill').boundingBox();
      expect(namePill.y).toBeGreaterThanOrEqual(stage.y);
      // A clipped accessibility label has a 1px layout box, so Playwright's
      // visibility predicate deliberately calls it visible. Assert clipping.
      await expect(page.locator('.agent-view__body .sr-only')).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
      expect(namePill.height).toBeLessThanOrEqual(32);
      const composer = await page.locator('.agent-view__composer').boundingBox();
      expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: `../artifacts/agent-view-${viewport.width}-${viewport.height}.png` });
      const placements = [];
      await page.route('**/api/agents/*/place**', r => { placements.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true, line: 'I needed a rest.' } }); });
      await page.getByRole('button', { name: 'Carry', exact: true }).click();
      await expect(page.getByTestId('home-screen')).toBeVisible();
      await expect(page.locator('.home-carry-help')).toBeVisible();
      expect(placements).toHaveLength(0);
      const flat = await page.locator('.home-flat').boundingBox();
      await page.mouse.click(flat.x + 55 * flat.width / 390, flat.y + 385 * flat.width / 390);
      await expect.poll(() => placements.length).toBe(1);
      expect(placements[0].fixture).toBe('couch');
      await expect(page.locator('.home-carry-help')).toHaveCount(0);
    });
  }
  test('BUG-59: casino has one header and Home is one tap from floor or board', async ({ page }) => {
    await room(page, CASTS.alone);
    await page.route('**/api/rooms', r => r.fulfill({ json: roomsResponse }));
    await page.route('**/api/rooms/*/tables', r => r.fulfill({ json: { tables: [] } }));
    await page.getByTestId('home-door').click();
    await expect(page.getByTestId('floor-view')).toBeVisible();
    await expect(page.locator('.dr-app-header')).toHaveCount(0);
    const head = await page.locator('.csn-floor__head').boundingBox();
    expect(head.y).toBe(0);
    expect(head.height).toBeLessThanOrEqual(62);
    await page.getByTestId('casino-view-toggle').getByRole('button', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The casino', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Your agents', exact: true })).toHaveCount(1);
    expect((await page.locator('.csn-head').boundingBox()).height).toBeLessThanOrEqual(62);
    await page.screenshot({ path: '../artifacts/casino-board-shell.png' });
    await page.getByRole('button', { name: 'Back home', exact: true }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.getByTestId('home-door').click();
    await page.getByTestId('casino-view-toggle').getByRole('button', { name: 'Floor', exact: true }).click();
    await page.getByRole('button', { name: 'Back home', exact: true }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });
  test('BUG-60: the room conversation stays a compact strip with a round send control', async ({ page }) => {
    await room(page, CASTS.alone);
    const band = await page.locator('.home-thread__band').boundingBox();
    expect(band.height).toBeLessThanOrEqual(76);
    const send = await page.locator('.home-thread__send').boundingBox();
    expect(send.height).toBeCloseTo(send.width, 0);
    expect(send.height).toBe(26);
    await page.getByTestId('home-thread-input').fill('How are you?');
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    await page.getByTestId('home-thread-line').click();
    await expect(page.getByTestId('home-thread-rows')).toBeVisible();
  });
  for (const width of [390, 490]) {
    test(`BUG-59: Home uses one compact contextual header and fills ${width}px Telegram`, async ({ page }) => {
      await room(page, CASTS.alone, { width, height: 844 });
      await page.screenshot({ path: `../artifacts/home-shell-${width}.png` });
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
      const header = page.locator('[data-testid="room-header"]');
      expect((await header.boundingBox()).height).toBeLessThanOrEqual(48);
      await expect(page.getByRole('button', { name: 'Your agents', exact: true })).toHaveCount(1);
      const flat = await page.locator('.home-flat').boundingBox();
      expect(flat.width).toBeCloseTo(width, 0);
      expect(flat.x).toBeCloseTo(0, 0);
      await expect(page.getByTestId('home-table')).toBeVisible();
      await expect(page.getByTestId('home-safe')).toContainText('$12,000');
      await page.getByRole('button', { name: 'Your agents', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  }
  for (const height of [590, 844]) {
    test(`BUG-55: four agents and a pending want leave the table tappable at 390x${height}`, async ({ page }) => {
      const names = ['Loose Cannon', 'The Grinder', 'Wild Card', 'Bluff'];
      const agents = names.map((name, i) => agent(`p${i}`, name, {
        routine: { key: 'plays', label: 'in a hand' },
        want: i === 0 ? { kind: 'deploy', text: "I'm fresh and I'm sat here doing nothing. Put me in.", needs: 'deploy' } : null,
      }));
      await page.route('**/api/stats', r => r.fulfill({ json: { activeAgents: 0, totalAgents: 15 } }));
      await page.route('**/api/slots**', r => r.fulfill({ json: { used: 4, cap: 4, next: null } }));
      await room(page, { agents, game: {
        state: 'running', tableId: 'home-4242',
        seats: agents.map((a, seat) => ({ seat, agentId: a.id, name: a.name, house: false })),
      } }, { width: 390, height });
      // Real hit testing: a DOM .click() would bypass the overlay that Jens hit.
      const table = page.getByTestId('home-table');
      const box = await table.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('home-table-sheet-mobile')).toBeVisible({ timeout: 2000 });
      await page.getByTestId('home-table-sheet-mobile').getByRole('button', { name: 'Close', exact: true }).last().click();
      await expect(page.getByText("I'm fresh and I'm sat here doing nothing. Put me in.", { exact: true })).toHaveCount(1);
      // BUG-59: approved HomeHead replaces the global wordmark/count row.
      // Brand identity and the roster stay accessible in the single header.
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Railbird', exact: true })).toBeVisible();
      // Visible DOM nodes can still lie outside a clipped Telegram viewport.
      for (const control of [page.getByTestId('home-want-yes'), page.locator('.home-thread__input')]) {
        await expect(control).toBeInViewport();
      }
      await page.getByTestId('home-tv').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('home-tv')).toBeInViewport();
      await page.locator('.home1__room').evaluate(el => { el.scrollTop = 0; });
      const actual = await page.screenshot({ path: `e2e/shots/railbird-home-four-${height}.png` });
      if (height === 844) {
        const reference = await readFile(new URL('../../design-refs/frames/board29-f10-home-game.png', import.meta.url));
        const pair = await page.context().newPage();
        await pair.setViewportSize({ width: 820, height: 900 });
        await pair.setContent(`<body style="margin:0;padding:10px;background:#111818;color:#eee;font:14px system-ui"><div style="display:flex;gap:20px"><div>Reference · board 29 F10<br><img width="390" src="data:image/png;base64,${reference.toString('base64')}"></div><div>Repair · four agents + request<br><img width="390" src="data:image/png;base64,${actual.toString('base64')}"></div></div></body>`);
        await pair.screenshot({ path: 'e2e/shots/railbird-home-reference-pair.png' });
        await pair.close();
      }
    });
  }
  test('BUG-51: the first-agent action stays clear of the TV and can be clicked', async ({ page }) => {
    await page.route('**/api/slots**', route => route.fulfill({ json: { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } } }));
    await room(page, { agents: [], game: null });
    const action = page.locator('.home1__ftu-draft');
    await expect(action).toBeVisible();
    const actionBox = await action.boundingBox();
    const tvBox = await page.getByTestId('home-tv').boundingBox();
    expect(actionBox.y + actionBox.height).toBeLessThan(tvBox.y);
    const actual = await page.screenshot({ path: 'e2e/__screenshots__/home-empty-repaired.png' });
    // Optional local reference server: render the design itself for the
    // integrator's side-by-side review. Ordinary test runs need no board server.
    if (process.env.DESIGN_REF_URL) {
      const ref = await page.context().newPage();
      await ref.setViewportSize({ width: 1600, height: 1000 });
      await ref.goto(`${process.env.DESIGN_REF_URL}/Agentic%20Poker%20Home.html`);
      const frame = ref.locator('#f01 > div').first();
      await expect(frame).toBeVisible({ timeout: 30000 });
      const reference = await frame.screenshot();
      const pair = await page.context().newPage();
      await pair.setViewportSize({ width: 800, height: 900 });
      await pair.setContent(`<body style="margin:0;background:#161a1a;color:white;font:14px system-ui"><div style="display:flex;gap:20px;padding:0 0 0 0"><div>Reference · 29 F01<br><img width="390" src="data:image/png;base64,${reference.toString('base64')}"></div><div>Repair · 390 × 844<br><img width="390" src="data:image/png;base64,${actual.toString('base64')}"></div></div></body>`);
      await pair.screenshot({ path: 'e2e/shots/astra-home-empty-pair.png', fullPage: true });
      await pair.close();
      await ref.close();
    }
    await action.click();
    await expect(page.getByTestId('draft-input')).toBeVisible();
  });
  test('one agent alone', async ({ page }) => {
    await room(page, CASTS.alone);
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.screenshot({ path: `e2e/__screenshots__/home-${CASTS.alone.name}.png` });
  });

  test('two home and one away', async ({ page }) => {
    await room(page, CASTS.household);
    await expect(page.getByTestId('home-frame-a3')).toBeVisible();
    // FIX-6 job 4: a running table carries no label at all — design 52's rule
    // is no money words on the home table, and FOR NOTHING was two of them.
    await expect(page.getByTestId('home-game-label')).toHaveCount(0);
    await page.screenshot({ path: `e2e/__screenshots__/home-${CASTS.household.name}.png` });
  });

  test('a want', async ({ page }) => {
    await room(page, CASTS.want);
    await expect(page.getByTestId('home-want')).toBeVisible();
    await expect(page.getByTestId('home-want-yes')).toBeVisible();
    await page.screenshot({ path: `e2e/__screenshots__/home-${CASTS.want.name}.png` });
  });

  test('the thread open', async ({ page }) => {
    await room(page, CASTS.alone);
    await page.getByTestId('home-thread-line').click();
    await expect(page.getByTestId('home-thread-rows')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'e2e/__screenshots__/home-thread-open.png' });
  });

  test('the tape room', async ({ page }) => {
    await room(page, CASTS.tape);
    await expect(page.getByTestId('home-tape')).toBeVisible();
    await expect(page.getByTestId('home-says-a1')).toContainText('GRANITE');
    await page.screenshot({ path: `e2e/__screenshots__/home-${CASTS.tape.name}.png` });
  });
});

// BUG-117: observe actual transitions in the running room, not only a walking class.
for(const viewport of [{width:390,height:844},{width:390,height:590},{width:1440,height:900}])test('BUG-117 crossing out and home at '+viewport.width+'x'+viewport.height,async({page})=>{
 const home=agent('cross117','Granite',{routine:{key:'plays',label:'in a hand'}});
 const other=agent('other117','Bal');
 const game={state:'running',tableId:'home-4242',seats:[{seat:0,agentId:home.id,name:home.name},{seat:1,agentId:other.id,name:other.name}],handsPlayed:7};
 await page.route('**/api/slots?**',route=>route.fulfill({json:{slots:4,canAdd:false}}));
 await room(page,{agents:[home,other],game},viewport);
 const body=page.locator('.home-one[data-agent="cross117"]');
 const pose=()=>body.evaluate(el=>{const s=getComputedStyle(el);return {x:parseFloat(s.left),y:parseFloat(s.top),opacity:Number(s.opacity),duration:s.transitionDuration};});
 const start=await pose();await body.evaluate(el=>el.dataset.sameBody='yes');
 const away={...home,location:loc('table',{tableId:'t117'}),activeTableId:'t117',routine:null};
 const push=(agents,game=null)=>page.evaluate(({agents,game})=>{for(const sock of window.__homeSockets??[])sock.dispatch('message',{data:JSON.stringify({type:'home_state',userId:'4242',agents,game})});},{agents,game});
 await push([away,other],game);await expect(body).toHaveAttribute('data-crossing','out');await expect(body).toBeDisabled();
 await expect(body.locator('.home-prop')).toHaveCount(0);
 await expect(page.locator('.home-flat')).toHaveAttribute('data-door-open','true');
 await expect(page.getByTestId('home-frame-cross117')).toHaveCount(0);
 expect((await pose()).duration.split(',')[0].trim()).toBe('2.2s');
 await page.waitForTimeout(240);const first=await pose();expect(first.opacity).toBeGreaterThan(.9);
 await page.screenshot({path:'../artifacts/cross33-'+viewport.width+'-'+viewport.height+'-out-1.png'});
 await page.waitForTimeout(680);const middle=await pose();
 const goal=await body.evaluate(el=>({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));
 expect(Math.hypot(middle.x-start.x,middle.y-start.y)).toBeGreaterThan(8);
 expect(Math.hypot(middle.x-goal.x,middle.y-goal.y)).toBeGreaterThan(1);
 await page.screenshot({path:'../artifacts/cross33-'+viewport.width+'-'+viewport.height+'-out-2.png'});
 await page.waitForTimeout(900);
 await page.screenshot({path:'../artifacts/cross33-'+viewport.width+'-'+viewport.height+'-out-3.png'});
 await expect.poll(async()=> (await pose()).opacity).toBe(0);
 await expect(body).toHaveAttribute('data-same-body','yes');
 await expect(page.getByTestId('home-frame-cross117')).toBeVisible();
 await page.evaluate(()=>{for(const sock of window.__homeSockets??[])sock.dispatch('message',{data:JSON.stringify({type:'session_end',agentId:'cross117',tableId:'t117',hands:41,net:2740,reason:'stopped'})});});
 await push([home,other],game);await expect(body).toHaveAttribute('data-crossing','home');
 await expect(page.getByTestId('home-says-cross117')).toContainText('+$2,740');
 await expect(body.locator('.home-one__cards')).toHaveCount(0);expect((await pose()).duration.split(',')[0].trim()).toBe('1.9s');
 await page.waitForTimeout(180);const arriving=await pose();expect(Math.hypot(arriving.x-start.x,arriving.y-start.y)).toBeGreaterThan(5);
 await page.screenshot({path:'../artifacts/cross33-'+viewport.width+'-'+viewport.height+'-home-1.png'});
 await page.waitForTimeout(650);await page.screenshot({path:'../artifacts/cross33-'+viewport.width+'-'+viewport.height+'-home-2.png'});
 await expect(body).toHaveAttribute('data-walking','false');
 await expect(body.locator('.home-one__cards')).toHaveCount(1);
 await expect.poll(async()=>Math.hypot((await pose()).x-start.x,(await pose()).y-start.y)).toBeLessThan(1);
 await expect(body).toHaveAttribute('data-same-body','yes');await expect(body).not.toBeDisabled();
 await page.screenshot({path:'../artifacts/cross33-'+viewport.width+'-'+viewport.height+'-home-3.png'});
});

test('BUG-117 reduced motion and an initially away body do not animate or intercept the room',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 const home=agent('quiet117','Granite');const away={...home,location:loc('table',{tableId:'quiet-table'}),activeTableId:'quiet-table',routine:null};
 await room(page,{agents:[away],game:null});const body=page.locator('.home-one[data-agent="quiet117"]');
 await expect(body).toHaveCSS('opacity','0');await expect(body).toHaveAttribute('data-walking','false');await expect(body).toBeDisabled();
 const push=agents=>page.evaluate(agents=>{for(const sock of window.__homeSockets??[])sock.dispatch('message',{data:JSON.stringify({type:'home_state',userId:'4242',agents,game:null})});},agents);
 await push([home]);await expect(body).toHaveCSS('opacity','1');expect(await body.evaluate(el=>el.getAnimations().length)).toBe(0);
 await push([away]);await expect(body).toHaveCSS('opacity','0');expect(await body.evaluate(el=>el.getAnimations().length)).toBe(0);
});
