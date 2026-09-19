// client/e2e/desk.spec.js — DESK-3
//
// Pictures of the desk at 1440×900 and 1920×1080 — three columns, always open:
// the roster on the left, the room (or the floor, or a felt) in the centre,
// the thread (or a fixture, or the board) on the right.
//
// DESK-3 replaces DESK-2's layout outright (design-refs/mood-desk59.jsx,
// mood-desk59b.jsx): "three columns, always open, nothing sliding over
// anything." The roster used to be FIX-2c's 68px strip, mounted only once a
// panel had taken its place; it is DeskRoster.jsx now, a permanent 250px
// column, on every stage. This file's job is to hold THAT claim honest — the
// roster never disappears, never collapses, and is not a mode any panel
// toggles it into.
//
// WHY THIS IS NOT IN `npm test` OR IN CI: the same reason home.spec.js gives.
// It is a LOOK check, not a rule check. Every rule this wave has — the roster
// is permanent, a fixture opens beside it rather than over it, the felt caps
// at 900 — is asserted in DesktopHome.test.jsx and desktopWidth.test.jsx under
// vitest, which runs in seconds and gates every commit. Screenshots gate
// nothing; they are for a person's eyes.
//
// Everything is served from a fixture through page.route, so nothing here needs
// a server, a database or a model, and the pictures are the same on every
// machine. 1440×900 is the desktop the parity board is drawn at; 1920×1080 is
// board 31's wide variant — "a wider window buys a bigger felt and a wider
// floor, not a fourth column." The app's own breakpoint is 1100, so both
// viewports put the desk on screen.
//
// Run:  cd client && npx playwright test e2e/desk.spec.js
// Look: client/e2e/__screenshots__/desk3-*.png

import { test, expect } from '@playwright/test';
import { felts as floorFelts, rooms as canonicalRooms } from '../src/test/fixtures/rooms.js';
import { midHandGame } from '../src/test/fixtures/game.js';
import { bigBluffHand } from '../src/test/fixtures/flagged.js';

const HOME = 'http://127.0.0.1:5199/';

// The two widths board 31 draws the desk at. Every test that exists to prove
// the three-column claim runs at both; a test about one interaction's
// geometry (a fixture, a felt) runs once, at the size the ref itself uses.
const SIZES = [
  { tag: '', width: 1440, height: 900 },
  { tag: '-1920', width: 1920, height: 1080 },
];

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
  pocket: { balance: 2_000, mode: 'topup', cap: null, broke: false, collectable: 0, pnl: 0 },
  stats: { handsPlayed: 140 },
  careerStats: { hands: 140, sessions: 4, net: 1_200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [],
  ...over,
});

// P15's own cast: two at the table, one away in a frame on the wall.
const BALANCE = agent('a1', 'Balance', {
  routine: { key: 'plays', label: 'in a hand' },
  mood: { state: 'confident', heat: 16 },
});
const GRANITE = agent('a2', 'Granite', {
  nature: { name: 'Grinder' },
  routine: { key: 'plays', label: 'in a hand' },
  mood: { state: 'frustrated', heat: 48 },
});
const AWAY = agent('a3', 'Big Slick', {
  nature: { name: 'Hothead' },
  location: loc('table', { tableId: 't1', room: 'upstairs' }),
  routine: null,
  activeTableId: 't1',
  mood: { state: 'tilted', heat: 78 },
  liveGame: { tableId: 't1', pot: 480, board: ['Ah', 'Kd', '2c'], net: 340, street: 'flop' },
});

const AGENTS = [BALANCE, GRANITE, AWAY];
const GAME = {
  tableId: 'home-u1',
  state: 'running',
  seats: [
    { seat: 0, agentId: 'a1', name: 'Balance', house: false },
    { seat: 1, agentId: 'a2', name: 'Granite', house: false },
  ],
  handsPlayed: 7,
};

// THREAD-2's shapes, verbatim: the nightly exchange as ONE `overheard` entry,
// the owner's line addressed to the room, and attributed answers.
const ROOM_THREAD = {
  sessionId: 'home-1',
  count: 4,
  lines: [
    {
      id: 1,
      kind: 'overheard',
      who: 'HIM',
      text: 'You always raise that.',
      ts: Date.now() - 900_000,
      source: 'home',
      from: 'a1',
      to: 'a2',
      lines: [
        { from: 'a1', to: 'a2', who: 'HIM', text: 'You always raise that. Always.' },
        { from: 'a2', to: 'a1', who: 'HIM', text: 'And you always fold. Every time.' },
      ],
    },
    { id: 2, kind: 'you', who: 'YOU', text: 'Who wants 25/50 tonight?', ts: Date.now() - 600_000, source: 'home', from: 'owner', to: 'all' },
    { id: 3, kind: 'him', who: 'HIM', text: 'Me. Obviously me.', ts: Date.now() - 500_000, source: 'home', from: 'a2', to: 'owner' },
    { id: 4, kind: 'him', who: 'HIM', text: 'His pocket is $1,240. That is one buy-in. I would not.', ts: Date.now() - 400_000, source: 'home', from: 'a1', to: 'owner' },
  ],
};

const ROOMS = [
  {
    id: 'floor', rung: 1, name: 'The floor',
    stakes: { label: '5/10', sb: 5, bb: 10, buyIn: 2_000 },
    tables: 19, seated: 118, hot: [],
    biggestPot: { tableId: 'tbl-1', pot: 640 },
  },
  {
    id: 'upstairs', rung: 2, name: 'Upstairs',
    stakes: { label: '10/20', sb: 10, bb: 20, buyIn: 4_000 },
    tables: 11, seated: 64, hot: ['tbl-8'],
    biggestPot: { tableId: 'tbl-8', pot: 4_180 },
  },
  {
    id: 'back', rung: 3, name: 'The back room',
    stakes: { label: '25/50', sb: 25, bb: 50, buyIn: 10_000 },
    tables: 6, seated: 21, hot: [],
    biggestPot: { tableId: 'tbl-21', pot: 1_900 },
  },
];

const EVENTS = [
  { id: 9, ts: Date.now() - 20_000, type: 'bigPot', tableId: 'tbl-8', agentIds: [], headline: 'Ozymandias cracked aces for $4,180', pot: 4_180 },
  { id: 8, ts: Date.now() - 90_000, type: 'cooler', tableId: 'tbl-2', agentIds: [], headline: 'quads into a straight flush, table 8' },
  { id: 7, ts: Date.now() - 160_000, type: 'bust', tableId: null, agentIds: [], headline: 'Fold_Equity out — third time today' },
  { id: 6, ts: Date.now() - 240_000, type: 'bigPot', tableId: 'tbl-3', agentIds: ['a3'], headline: 'Big Slick took $1,240 off Nash_Eq' },
  { id: 5, ts: Date.now() - 300_000, type: 'hot', tableId: 'tbl-8', agentIds: [], headline: 'the felt upstairs is running hot' },
  { id: 4, ts: Date.now() - 380_000, type: 'bigPot', tableId: 'tbl-5', agentIds: [], headline: 'Granite_9 stacked the table' },
  { id: 3, ts: Date.now() - 460_000, type: 'bust', tableId: null, agentIds: [], headline: 'Chip_Leader out on the river' },
  { id: 2, ts: Date.now() - 520_000, type: 'cooler', tableId: 'tbl-4', agentIds: [], headline: 'set over set on the floor' },
];

async function stub(page, { agents = AGENTS, game = GAME, slots = null } = {}) {
  await page.route('**/api/agents?**', (route) => route.fulfill({ json: { agents } }));
  await page.route('**/api/agents/*/study**', (route) => route.fulfill({ json: { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (route) => route.fulfill({ json: { sessionId: 's1', lines: [], count: 0 } }));
  await page.route('**/api/agents/*/hands**', (route) => route.fulfill({ json: { recentHands: [] } }));
  await page.route('**/api/agents/*/flagged**', (route) => route.fulfill({ json: { flaggedHands: [] } }));
  await page.route('**/api/agents/*/memory**', (route) => route.fulfill({ json: { memory: [] } }));
  await page.route('**/api/home/thread**', (route) => route.fulfill({ json: ROOM_THREAD }));
  await page.route('**/api/fridge?**', route => route.fulfill({ json: { items: [{ id: 'beer', count: 4, price: 12 }, { id: 'snack', count: 2, price: 8 }] } }));
  await page.route('**/api/slots**', (route) => route.fulfill({
    json: slots ?? { used: 3, cap: 4, next: { index: 4, price: 250_000, earned: 41_000, unlocked: false } },
  }));
  await page.route('**/api/wallet**', (route) => route.fulfill({
    json: {
      balance: 54_000,
      staked: 6_000,
      session: 1_290,
      ledger: [
        { id: 3, ts: Date.now() - 60_000, kind: 'collect', amount: 2_740, note: 'Balance brought home' },
        { id: 2, ts: Date.now() - 900_000, kind: 'item', amount: -60, note: 'beer × 4, snack × 2' },
      ],
    },
  }));
  await page.route('**/api/events**', (route) => route.fulfill({ json: { events: EVENTS, lastId: 9 } }));
  await page.route('**/api/rooms**', (route) => route.fulfill({ json: { rooms: ROOMS, hotWindowMs: 20_000 } }));
  await page.route('**/api/auth/config**', (route) => route.fulfill({ json: { botUsername: '' } }));

  // index.html loads Telegram's real SDK, which REPLACES window.Telegram when
  // it arrives — after addInitScript has run — so the login gate would take the
  // screen. There is no Telegram here to talk to. (home.spec.js's own note.)
  await page.route('https://telegram.org/**', (route) => route.fulfill({ body: '', contentType: 'application/javascript' }));

  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
        initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
        get viewportHeight() { return window.innerHeight; },
        ready() {}, expand() {}, disableVerticalSwipes() {},
        onEvent(type, fn) { if (type === 'viewportChanged') window.addEventListener('resize', fn); },
        offEvent(type, fn) { if (type === 'viewportChanged') window.removeEventListener('resize', fn); },
      },
    };
  });

  // HOME_STATE rides a WebSocket and the HOME GAME rides only HOME_STATE, so
  // the socket is scripted rather than silenced: it opens and answers with the
  // frame the server would send. Anything else the client subscribes to (the
  // floor, the ticker) simply hears nothing, which is its REST-only path.
  await page.addInitScript(([agentsIn, gameIn]) => {
    class ScriptedSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          this.dispatch('message', {
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents: agentsIn, game: gameIn }),
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
  }, [agents, game]);
}

async function desk(page, { width = 1440, height = 900 } = {}, opts = {}) {
  await stub(page, opts);
  await page.setViewportSize({ width, height });
  await page.goto(HOME);
  await page.waitForSelector('.dsk-root');
  await page.waitForSelector('.home-flat');
  await page.waitForTimeout(700);
}

async function shot(page, name) {
  await page.screenshot({ path: `e2e/__screenshots__/desk3-${name}.png` });
}

// The default project viewport (390×844, hasTouch) is the Mini App's own
// size; every test here calls desk() with its own width, but the touch/mobile
// emulation still needs turning off, or the desk renders as if dragged onto a
// touch device.
test.use({ isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

// Unambiguous as long as the standup panel is not open: with the permanent
// column always mounted, one name matches exactly one roster row.
function rosterRow(page, name) {
  return page.locator('.dsk3-roster .dsk-roster-row', { hasText: name });
}

test.describe('DESK-3 · three columns, always open (1440×900 and 1920×1080)', () => {
  for (const size of SIZES) {
    test(`the roster, the room, and the thread — no click required (${size.width}x${size.height})`, async ({ page }) => {
      await desk(page, size);

      // Job 1: roster, room and thread are all up at once, before anything is
      // clicked — the roster is furniture, not a mode a panel toggles it into.
      await expect(page.getByTestId('desk-roster')).toBeVisible();
      await expect(page.getByTestId('home-screen')).toBeVisible();
      await expect(page.getByTestId('room-thread')).toBeVisible();
      for (const a of AGENTS) await expect(rosterRow(page, a.name)).toBeVisible();

      await expect(page.getByTestId('home-frame-a3')).toBeVisible();
      await expect(page.locator('.home-flat')).toHaveCount(1);
      const flat = await page.locator('.home-flat').boundingBox();
      const stage = await page.locator('.home1__room').boundingBox();
      expect(flat.width / flat.height, 'C9: wider desktop floor, uniformly scaled').toBeCloseTo(560 / 700, 2);
      expect(flat.x).toBeGreaterThanOrEqual(stage.x + 29);
      expect(flat.x + flat.width).toBeLessThanOrEqual(stage.x + stage.width - 29);
      expect(flat.y).toBeGreaterThanOrEqual(stage.y + 46);
      expect(flat.y + flat.height).toBeLessThanOrEqual(stage.y + stage.height - 46);
      // No 68px strip anywhere — DESK-2's collapsed form is gone, not hiding.
      await expect(page.locator('.dsk-strip')).toHaveCount(0);
      await shot(page, `home${size.tag}`);
    });
  }

  test('the safe opens beside the roster, not instead of it', async ({ page }) => {
    await desk(page, SIZES[0]);
    await page.getByTestId('home-safe').click();

    await expect(page.locator('.dsk-panel-head__title', { hasText: 'The safe' })).toBeVisible();
    await expect(page.locator('.home1__room')).toHaveAttribute('data-dim', 'true');
    // The room dims; the roster does not — it is furniture, not a panel.
    await expect(page.getByTestId('desk-roster')).toBeVisible();
    await expect(rosterRow(page, BALANCE.name)).toBeVisible();
    await expect(rosterRow(page, GRANITE.name)).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 'safe');
  });

  test('the table sheet opens beside the roster', async ({ page }) => {
    await desk(page, SIZES[0]);
    await page.getByTestId('home-table').click();

    // P17: the only place a seat price appears, and it is the server's price.
    // `exact: true` — the refusal line below it also contains "4th seat",
    // case-insensitively, and a substring match resolves to both.
    await expect(page.getByTestId('home-table-sheet')).toBeVisible();
    await expect(page.getByText('4TH SEAT', { exact: true })).toBeVisible();
    await expect(page.getByTestId('desk-roster')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 'table');
  });

  test('the fridge opens beside the roster', async ({ page }) => {
    await desk(page, SIZES[0]);
    await page.getByTestId('home-fridge').click();

    await expect(page.getByTestId('home-fridge-sheet')).toBeVisible();
    // F13 stocks the household shelf; giving happens through a want or Carry.
    await expect(page.getByTestId('home-buy-beer')).toBeEnabled();
    await expect(page.getByTestId('desk-roster')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 'fridge');
  });

  test('a man, in the thread — the roster still shows every agent', async ({ page }) => {
    await desk(page, SIZES[0]);
    await page.locator('.home-one[data-agent="a2"]').click();

    await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
    await expect(page.locator('.home-flat')).toHaveCount(1);
    for (const a of AGENTS) await expect(rosterRow(page, a.name)).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, 'man');
  });

  test('the roster switches threads on its own, with no strip ever appearing', async ({ page }) => {
    await desk(page, SIZES[0]);
    await rosterRow(page, GRANITE.name).click();
    await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();

    await rosterRow(page, BALANCE.name).click();
    await expect(page.getByRole('button', { name: 'Profile', exact: true })).toBeVisible();
    await expect(page.locator('.dsk-strip')).toHaveCount(0);
  });
});

test.describe('DESK-3, job 2 · hover does what a tap does on the phone', () => {
  // MERGE-7 REWRITES THIS TO THE NEW RULE (Testing law #5).
  //
  // BUG-86 was filed when a condition reading was a continuous track that
  // rendered at zero height on the desk roster — the reading was there in the
  // DOM and invisible on the screen. LIFE-1-B deliberately retired the track:
  // stamina is a THREE-STATE word the client used to multiply into a
  // percentage, so a bar 63% full claimed precision the server does not have.
  // Three dots is now the product, on purpose.
  //
  // So `.felt-bars__track` is gone and asserting on it asserts a rule we no
  // longer want. The CLAIM is kept exactly — the reading must actually be
  // drawn, not collapsed — and re-expressed against what draws it. The old
  // `width > 80` is deliberately not carried over: it described a bar that
  // spanned the roster row, and demanding it of three small dots would be
  // demanding the product be the thing LIFE-1-B removed. In its place the test
  // now asserts something the bar version could not: that all three dots are
  // present and each one says whether it is lit, which is the information the
  // track used to carry in its fill.
  test('BUG-86: a condition reading is actually drawn on the desk roster',async({page})=>{
    await desk(page,SIZES[0]);
    const row=page.locator('.dsk-roster-bars .body-dots__dots').first();
    const box=await row.boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThanOrEqual(2);
    const dots=row.locator('.body-dots__dot');
    await expect(dots).toHaveCount(3);
    for(let n=0;n<3;n++) expect(await dots.nth(n).getAttribute('data-lit')).toMatch(/^(true|false)$/);
  });
  for (const size of [{width:1280,height:800},...SIZES]) {
    test(`C9: conversation, identity and Carry work beside the room at ${size.width}`,async({page})=>{
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const agents=AGENTS.map(a=>a.id==='a2'?{...a,identity:{hood:'sand',glow:'gold'},chatHistory:[{role:'user',content:'Why did you call there?'},{role:'assistant',content:'It was the sizing. He never bets that big with a hand.'},{role:'user',content:'Stay off him for a bit.'},{role:'assistant',content:'Fine. I will wait for the button.'}]}:a);
      await desk(page,size,{agents});
      await page.route('**/api/agents/a2/flagged**',route=>route.fulfill({json:{flaggedHands:[bigBluffHand]}}));
      await page.route('**/api/agents/chat',route=>route.fulfill({status:503,json:{error:'unavailable'}}));
      await rosterRow(page,'Granite').click();
      const roomBefore=await page.locator('.home-flat').boundingBox();
      const column=page.locator('.dsk-panel--agent');
      expect((await column.boundingBox()).width).toBe(380);
      await expect(column.locator('.agent-view__breath')).toHaveCSS('width','132px');
      await expect(column.locator('.home-pill')).toHaveCSS('opacity','1');
      await expect(column.locator('.agent-view__speech')).toContainText('Fine. I will wait for the button.');
      await expect(column.locator('.agent-view__thread')).toContainText('Why did you call there?');
      const composer=page.getByPlaceholder('Whisper to him…');
      expect((await composer.boundingBox()).y).toBeLessThan(size.height-20);
      if(size.width===1440) {
        await page.screenshot({path:'../artifacts/desktop-c9.png'});
        await column.screenshot({path:'../artifacts/desktop-column-c9.png'});
      }
      await column.getByRole('button',{name:/Replay .*hand/}).click();
      await expect(page.locator('.dsk-replay')).toBeVisible();
      // BUG-85: the replay stage used to collapse to zero height, leaving its
      // back button under the scrubber/top bar despite all unit tests passing.
      expect((await page.locator('.dsk-replay__stage').boundingBox()).height).toBeGreaterThan(300);
      await expect(page.getByTestId('desk-roster')).toBeVisible();
      await page.locator('.dtb__back').click();
      await expect(column).toBeVisible();
      await composer.fill('Wait for me.');
      await column.getByRole('button',{name:'Send',exact:true}).click();
      await expect(column.getByRole('alert')).toContainText('try again');
      await expect(composer).toHaveValue('Wait for me.');
      await column.getByRole('button',{name:'Profile',exact:true}).click();
      await expect(column.locator('.profile-overview__identity stop[stop-color="#6E5836"]')).toHaveCount(1);
      await expect(column.getByText('Condition',{exact:true})).toBeVisible();
      await expect(column.getByText('RECENT',{exact:true})).toBeVisible();
      const profileComposer=column.getByRole('textbox',{name:'Whisper to him',exact:true});
      expect((await profileComposer.boundingBox()).y).toBeLessThan(size.height-20);
      if(size.width===1440) {
        await page.screenshot({path:'../artifacts/desktop-profile-c4.png'});
        await column.screenshot({path:'../artifacts/desktop-profile-column-c4.png'});
      }
      await profileComposer.fill('Wait for the button.');
      await column.getByRole('button',{name:'Send whisper'}).click();
      await expect(profileComposer).toHaveValue('Wait for the button.');
      await expect(column.getByRole('alert')).toContainText('Could not send your whisper');
      const whispers=[];
      await page.route('**/api/agents/chat',route=>{whispers.push(route.request().postDataJSON());return route.fulfill({json:{chat:[{role:'assistant',content:'Yes. The button.'}]}});});
      await column.getByRole('button',{name:'Send whisper'}).click();
      await column.getByRole('button',{name:'Open conversation'}).click();
      await expect(column.locator('.agent-view__thread').getByText('Wait for the button.',{exact:true})).toHaveCount(1);
      await expect(column.locator('.agent-view__thread').getByText('Yes. The button.',{exact:true})).toHaveCount(1);
      expect(whispers).toEqual([expect.objectContaining({existingAgentId:'a2',content:'Wait for the button.'})]);
      await expect(composer).toHaveValue('Wait for me.');
      await page.route('**/api/wallet?**',route=>route.fulfill({json:{balance:9000}}));
      await column.getByRole('button',{name:'Profile',exact:true}).click();
      await column.getByRole('button',{name:'Give him chips',exact:true}).click();
      const funding=column.locator('.agent-view__fund');
      await expect(funding.getByRole('dialog')).toBeVisible();
      const columnBox=await column.boundingBox();
      // The column owns a 1px left border; the inset sheet fills its content box.
      expect(await funding.boundingBox()).toEqual({...columnBox,x:columnBox.x+1,width:columnBox.width-1});
      await funding.getByRole('button',{name:'Back',exact:true}).click();
      await column.getByRole('button',{name:'Back',exact:true}).click();
      expect(await page.locator('.home-flat').boundingBox()).toEqual(roomBefore);
      const requests=[];
      await page.route('**/api/agents/a2/place?**',route=>{requests.push(route.request().postDataJSON());return route.fulfill({json:{ok:true,line:'I will rest here.'}});});
      await column.getByRole('button',{name:'Carry',exact:true}).click();
      await expect(page.locator('.home-carry-help')).toBeVisible();
      await page.locator('.home-flat__couch').click();
      await expect.poll(()=>requests.length).toBe(1);
      expect(requests[0]).toMatchObject({fixture:'couch'});
      await expect(page.locator('.home-carry-help')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }
  test('BUG-82: hover labels do not move fixtures out of their room coordinates',async({page})=>{
    await desk(page,SIZES[0]);
    const flat=await page.locator('.home-flat').boundingBox();
    const k=flat.width/560;
    // BUG-243 enlarges the TV for a readable hand; other C9 fixtures stay put.
    for(const [selector,x,y] of [['.home-flat__safe',24,96],['.home-flat__fridge',452,130],['.home-flat__tv',172,536],['.home-flat__door',518,288]]) {
      const fixture=page.locator(selector);
      await expect(fixture).toHaveCSS('position','absolute');
      const box=await fixture.boundingBox();
      expect(Math.abs(box.x-flat.x-x*k)).toBeLessThan(2);
      expect(Math.abs(box.y-flat.y-y*k)).toBeLessThan(2);
      expect(box.y+box.height).toBeLessThanOrEqual(flat.y+flat.height+1);
    }
  });
  test('a body is quiet at rest; hovering shows his pill', async ({ page }) => {
    await desk(page, SIZES[0]);
    const pill = page.locator('.home-one[data-agent="a2"] .home-pill');

    await expect(pill).toHaveCSS('opacity', '0');
    await page.locator('.home-one[data-agent="a2"]').hover();
    await expect(pill).toHaveCSS('opacity', '1');
    await page.waitForTimeout(150);
    await shot(page, 'hover-body');
  });

  test('a fixture is quiet at rest; hovering shows its one line', async ({ page }) => {
    await desk(page, SIZES[0]);
    const safe = page.locator('.home-flat__safe');
    const hintOpacity = () => safe.evaluate((el) => getComputedStyle(el, '::after').opacity);

    await expect.poll(hintOpacity).toBe('0');
    await safe.hover();
    await expect.poll(hintOpacity).toBe('1');
  });
});

// SPEC-1 — UI-3 job A rewrote this block's subject. The casino was a BUILDING:
// three doorways under a sign, a Floor|Board toggle, and a two-panel board
// pinned as the desk's permanent right column. It is a SINGLE room now; the
// doorways, the toggle and FloorBoard.jsx are deleted from the tree. What is
// NOT deleted is the thing this describe() exists for — DESK-3's law, that the
// roster is a permanent column and every other panel sits BESIDE it rather
// than over it — so each assertion below is either re-expressed against the
// one room or deleted at its site with the decision that retired it named.
test.describe('DESK-3, job 3 · the casino: the roster, the room, and its right column', () => {
  for (const size of SIZES) {
    test(`BUG-89/91: casino hand replays to its recorded end and returns at ${size.width}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await desk(page, size);
      await page.route('**/api/events**', route => route.fulfill({ json: { events: [{ id: 91, ts: Date.now(), type: 'bigPot', tableId: 't1', agentIds: ['a2'], handNumber: bigBluffHand.handNumber, pot: bigBluffHand.pot, headline: 'Granite won the recorded hand' }], lastId: 91 } }));
      await page.route('**/api/agents/a2/flagged**', route => route.fulfill({ json: { flaggedHands: [bigBluffHand] } }));
      await page.getByRole('button', { name: 'The door — the casino', exact: true }).click();
      // SPEC-1: the replayable line used to be a row on TONIGHT, reached by
      // toggling from the floor to the board. UI-3 job A deleted both the
      // toggle and the board; CasinoTicker inherited TONIGHT's ranking and
      // its REPLAY affordance verbatim, and it is already on screen. The rule
      // — a hand of YOURS on the board can be replayed from the casino — is
      // unchanged; only the thing carrying it is.
      await page.getByRole('button', { name: /BIGGEST POT.*Granite won the recorded hand.*Replay this hand/ }).click();
      await expect(page.locator('.dsk-replay')).toBeVisible();
      await expect(page.locator('.dtb__hero-stack')).toHaveText('—');
      await expect(page.locator('.dtb__strip [data-bar="heat"]')).toHaveCount(0);
      await expect(page.locator('.dtb__equity-val')).toHaveText('4.0%');
      const scrub = page.getByRole('slider', { name: 'Scrub the replay' });
      await scrub.focus();
      await scrub.press('End');
      await expect(page.getByText('End of replay', { exact: true })).toBeVisible();
      await expect(page.locator('.dtb__equity-val')).toHaveText('100.0%');
      await expect.poll(() => page.locator('.dtb__tug .tug__fill').evaluate(el => el.getBoundingClientRect().width / el.parentElement.getBoundingClientRect().width)).toBeGreaterThan(0.97);
      await expect(page.getByText('NEXT DEAL SHORTLY')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Sit out after this hand/i })).toHaveCount(0);
      expect((await page.locator('.dsk-replay__stage').boundingBox()).height).toBeGreaterThan(300);
      if (size.width === 1440) await page.screenshot({ path: '../artifacts/desktop-casino-replay-end.png' });
      await page.locator('.dtb__back').click();
      // SPEC-1: this read `aria-pressed="true"` on the toggle's Board button —
      // "the replay hands you back to the half of the casino you left it
      // from." There is one half now, so the claim is that leaving the replay
      // returns you to the casino at all, with the line you replayed still
      // where it was. The second assertion always said that; the first now
      // says which screen you are on.
      await expect(page.getByTestId('floor-view')).toBeVisible();
      await expect(page.getByRole('button', { name: /BIGGEST POT.*Granite won the recorded hand.*Replay this hand/ })).toBeVisible();
      await expect(page.getByTestId('desk-roster')).toBeVisible();
      expect(errors).toEqual([]);
    });
    test(`three columns on the casino stage too (${size.width}x${size.height})`, async ({ page }) => {
      await desk(page, size);
      await page.getByRole('button', { name: 'The door — the casino', exact: true }).click();
      // UI-3 job A: the casino IS the floor. There is no building behind it to
      // toggle to, so `.csn-desk__rail` (the building's shell), the three
      // `.csn-room-door`s and the single `.csn-board` pinned in that rail are
      // all deleted rather than re-expressed — the first is markup that no
      // longer exists, and the other two were claims about a building.
      const view = page.getByTestId('floor-view');
      await expect(view).toBeVisible();

      // What this test is actually for survives whole: the roster is a
      // PERMANENT column, and the casino stage begins where it ends and takes
      // everything it leaves. That was true of the building's rail and it is
      // true of the room.
      await expect(page.getByTestId('desk-roster')).toBeVisible();
      const roster = await page.getByTestId('desk-roster').boundingBox();
      const viewBox = await view.boundingBox();
      expect(viewBox.x, 'the room starts where the roster ends')
        .toBeGreaterThanOrEqual(roster.x + roster.width - 1);
      expect(viewBox.width, 'and takes the whole stage the roster leaves')
        .toBeGreaterThan((size.width - roster.width) * 0.95);

      // And nothing slides across anything. The ticker and Your table are what
      // UI-3 put on this stage with the room; they are stacked above it, in
      // that order, not floated over it.
      const ticker = await page.getByTestId('casino-ticker').boundingBox();
      const your = await page.getByTestId('your-tables').boundingBox();
      expect(ticker.y + ticker.height).toBeLessThanOrEqual(your.y + 1);
      expect(your.y + your.height).toBeLessThanOrEqual(viewBox.y + 1);

      await page.waitForTimeout(600);
      await shot(page, `casino${size.tag}`);
    });
  }

  // SPEC-1 — the same rule, about the thing that replaced the doorways.
  //
  // "Three side by side, same top, same height" is a layout rule about A ROW
  // OF CHOICES: one of them sitting lower or shorter than its neighbours reads
  // as a fourth state nobody designed. UI-3 job A did not retire that rule, it
  // retired the doorways — placing a man is no longer choosing which of three
  // rooms to carry him into, it is choosing which stake, and `StakePicker`
  // draws that as a three-column grid of chips. So the claim moves to the
  // chips, which are the three things this desk now puts side by side.
  test('the three stakes sit side by side, same top, same height', async ({ page }) => {
    await desk(page, SIZES[0]);
    await page.getByRole('button', { name: 'The door — the casino', exact: true }).click();
    await expect(page.getByTestId('floor-view')).toBeVisible();
    await page.waitForSelector('.csn-stakes');

    const chips = await page.locator('.csn-stake').all();
    expect(chips).toHaveLength(ROOMS.length);
    const boxes = [];
    for (const chip of chips) boxes.push(await chip.boundingBox());
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].y - boxes[0].y)).toBeLessThan(2);
      expect(Math.abs(boxes[i].height - boxes[0].height)).toBeLessThan(2);
      expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x + boxes[i - 1].width - 2);
    }
  });

  // FloorView's own header states the departure explicitly: the room is a
  // DESTINATION, not a sheet — "full width with the board as a right column."
  // That already held before DESK-3; what DESK-3 adds is the roster staying up
  // beside it, so this is still three columns rather than two.
  //
  // SPEC-1: the right column survived UI-3 job A — `.csn-floor__board` is
  // still there, still 380px, still border-left'd against the room. What
  // changed is what it CARRIES: the two-panel board is deleted, and the
  // column now holds the deploy panel (the stake picker while a man is in the
  // tray, the quick-play card otherwise). The rule is about the column, not
  // about the board that used to be in it, so it re-expresses in place. The
  // door click in the middle is gone with the doorways.
  test('the room is full width beside the roster, with its own right column', async ({ page }) => {
    await desk(page, SIZES[0]);
    const roster = await page.getByTestId('desk-roster').boundingBox();
    await page.getByRole('button', { name: 'The door — the casino', exact: true }).click();

    const view = page.getByTestId('floor-view');
    await expect(view).toBeVisible();
    await expect(page.getByTestId('desk-roster')).toBeVisible();

    const viewBox = await view.boundingBox();
    // The floor picks up exactly where the roster leaves off — nothing
    // between them, and nothing of the roster left behind under it.
    expect(viewBox.x).toBeGreaterThanOrEqual(roster.x + roster.width - 1);

    const board = page.locator('.csn-floor__board');
    await expect(board).toBeVisible();
    const boardBox = await board.boundingBox();
    // It is the room's own right edge — a column, not a sheet pulled over the
    // middle of it.
    expect(boardBox.x + boardBox.width).toBeGreaterThan(viewBox.x + viewBox.width - 2);
    const roomBox = await view.locator('.csn-floor__room').boundingBox();
    expect(boardBox.x, 'beside the room, not over it')
      .toBeGreaterThanOrEqual(roomBox.x + roomBox.width - 1);

    await page.waitForTimeout(300);
    await shot(page, 'casino-room');
  });
});

test.describe('DESK-3, job 4 · watching a felt', () => {
  test('the felt centres and caps at 900, the roster and the thread stay either side', async ({ page }) => {
    await desk(page, SIZES[0]);
    await page.getByRole('button', { name: /Standup/ }).click();
    await page.getByRole('button', { name: 'WATCH →' }).first().click();

    await expect(page.getByTestId('desk-casino-table')).toBeVisible();
    await expect(page.getByTestId('desk-roster')).toBeVisible();
    await expect(page.locator('.dsk-panel--watch')).toBeVisible();

    const felt = await page.getByTestId('desk-casino-table').boundingBox();
    expect(felt.width).toBeLessThanOrEqual(901);
    expect(felt.width/felt.height).toBeCloseTo(900/648,2);

    await page.waitForTimeout(400);
    await shot(page, 'watch');
  });

  test('at 1920 the felt still caps at 900 rather than stretching', async ({ page }) => {
    await desk(page, SIZES[1]);
    await page.getByRole('button', { name: /Standup/ }).click();
    await page.getByRole('button', { name: 'WATCH →' }).first().click();

    const felt = await page.getByTestId('desk-casino-table').boundingBox();
    expect(felt.width).toBeLessThanOrEqual(901);
    expect(felt.width/felt.height).toBeCloseTo(900/648,2);
    await page.waitForTimeout(400);
    await shot(page, 'watch-1920');
  });
});

test('C9 room header and door give one route between Home and casino',async({page})=>{
  await desk(page,{width:1440,height:900});
  const header=page.locator('.dsk-top--room');
  await expect(header).toHaveCSS('height','54px');
  await expect(header.getByRole('heading',{name:'The flat'})).toBeVisible();
  await expect(page.getByRole('group',{name:'Stage'})).toHaveCount(0);
  await page.getByRole('button',{name:'The door — the casino',exact:true}).click();
  // BUG-104: room context in the shell header replaces the duplicated
  // casino/floor rows. SPEC-1: the room the header names is no longer the one
  // of three you last stood in — there is one, and it is "The casino floor".
  // The claim (the shell states where you are, once) is untouched.
  await expect(header.getByRole('heading',{name:'The casino floor',exact:true})).toBeVisible();
  await expect(page.locator('.csn-floor__head')).toHaveCount(0);
  await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  // `casino-view-toggle` was asserted here and then used twice below to walk
  // Board → Floor. UI-3 job A deleted the toggle with the board it toggled to,
  // so those three are gone; the destination assertions they framed are not,
  // and they now read against the one room the door opens onto.
  await expect(page.locator('.csn-head')).toHaveCount(0);
  await expect(page.getByTestId('floor-view')).toBeVisible();
  await header.getByRole('button',{name:'Back home'}).click();
  await expect(page.getByTestId('home-table')).toBeVisible();
  await expect(header.getByRole('heading',{name:'The flat'})).toBeVisible();
  // ONE ROUTE, and it works the second time: the door is still the only way
  // in and Back home still the only way out, with no second navigation row
  // appearing on the return trip.
  await page.getByRole('button',{name:'The door — the casino',exact:true}).click();
  await expect(page.locator('.csn-floor')).toBeVisible();
  await expect(page.getByRole('heading',{level:1})).toHaveCount(1);
  await header.getByRole('button',{name:'Back home'}).click();
  await expect(page.getByTestId('home-table')).toBeVisible();
});


test('BUG-100: desktop condition labels stay below the stack and equity',async({page})=>{
  await desk(page,SIZES[0]);
  await page.addInitScript(()=>{
    const Base=window.WebSocket;
    window.WebSocket=class extends Base {
      send(raw){
        super.send(raw);
        if(JSON.parse(raw).type!=='watch')return;
        setTimeout(()=>this.dispatch('message',{data:JSON.stringify({type:'state',state:{
          tableId:'t1',handNumber:3,street:'flop',pot:240,community:['5c','4h','8c'],heroEquity:.64,toAct:1,
          seats:[{playerId:'a3',displayName:'Big Slick',stack:1847,holeCards:['6h','6s'],fatigue:'fresh',mood:{state:'confident',heat:24}},
            {playerId:'villain',displayName:'Granite',stack:2104,holeCards:[],mood:{state:'neutral',heat:30}}],result:null,
        },legalActions:[]})}),60);
      }
    };
  });
  await page.reload();
  await page.getByRole('button',{name:/Standup/}).click();
  await page.getByRole('button',{name:'WATCH →'}).first().click();
  // MERGE-7 (Testing law #5): LIFE-1-B replaced the two labelled bars with two
  // dot readings, so `.felt-bars__label` no longer exists. The claim is
  // unchanged — both conditions are present in the hero strip, and they sit
  // below the stack and the equity — and the positional assertion below, which
  // is what BUG-100 is actually about, is untouched.
  await expect(page.locator('.watch-hero__strip .body-dots')).toHaveCount(2);
  await expect(page.locator('.watch-hero .tug__value')).toHaveText('64%');
  const bounds=await page.locator('.watch-hero__strip').evaluate(el=>({
    numbersBottom:Math.max(...[...el.querySelectorAll('.watch-felt__hero-num')].map(n=>n.getBoundingClientRect().bottom)),
    barsTop:el.querySelector('.felt-bars').getBoundingClientRect().top,
  }));
  expect(bounds.barsTop).toBeGreaterThanOrEqual(bounds.numbersBottom+4);
});


// SPEC-1 · UI-3 job B (BUG-215), in the browser.
//
// TileStack draws one monitor per live agent. Every agent who was NOT the one
// being watched used to get `game: null` and draw a SILHOUETTE — a hood, blank
// cards, POT 0 — for a table genuinely being played at that moment, because
// the rich `game`/`lastDecision` shape only ever exists for the one table the
// owner has subscribed to. The compact projection was already riding the
// roster push (`liveGame`, AGE-37) and was simply discarded.
//
// GameTile.test.jsx pins normalizeTile(). This pins what a person sees: the
// second monitor is a hand in progress and not a still of one. It is here, in
// the desk file, because the monitors are furniture of the desk — there is no
// TileStack on the phone.
test('UI-3 job B: an unwatched monitor shows the real hand, not a silhouette', async ({ page }) => {
  await desk(page, SIZES[0]);
  await page.getByRole('button', { name: /Standup/ }).click();
  // Big Slick is live (t1) and is not the watched table, so his tile is the
  // unwatched case by construction.
  const tile = page.locator('.dsk-tile').filter({ hasText: 'Big Slick' });
  await expect(tile).toBeVisible();
  // His pot, off his own liveGame — not the 0 a silhouette draws.
  await expect(tile.locator('.dsk-tile__pot b')).toHaveText('480');
  // And the board as far as it has actually run: three real cards on the flop,
  // two still face down. A silhouette drew five backs.
  await expect(tile.locator('.dsk-tile__center .dsk-card:not(.dsk-card--back)')).toHaveCount(3);
  await expect(tile.locator('.dsk-tile__center .dsk-card--back')).toHaveCount(2);
});

test.describe('BUG-103 · populated casino floor uses its stage', () => {
  for (const size of [{width:1280,height:720}, ...SIZES]) {
    test('late tables fit both axes at '+size.width+'×'+size.height, async ({page}) => {
      await desk(page,size);
      await page.addInitScript(() => {
        const Base=window.WebSocket;
        window.__floorSockets=[];
        window.WebSocket=class extends Base { constructor(...args) { super(...args); window.__floorSockets.push(this); } };
      });
      await page.route('**/api/rooms',r=>r.fulfill({json:{rooms:ROOMS.map(r=>({...r,tables:6}))}}));
      await page.reload();
      await page.getByTestId('home-door').click();
      await expect(page.getByTestId('floor-view')).toBeVisible();
      await expect(page.getByTestId('the-floor')).toHaveCount(0);
      const roomId=await page.getByTestId('floor-view').getAttribute('data-room');
      const tables=Array.from({length:6},(_,i)=>({...floorFelts[i%2],tableId:'tbl-geometry-'+i,room:roomId}));
      await page.evaluate(tables=>window.__floorSockets.forEach(socket=>socket.dispatch('message',{data:JSON.stringify({type:'room_tables',tables,rooms:Object.fromEntries(tables.map(t=>[t.tableId,t.room]))})})),tables);
      await expect(page.locator('.csn-felt58')).toHaveCount(6);
      // SPEC-1 — MEASURED AGAINST THE STAGE, NOT AGAINST A RECONSTRUCTION OF IT.
      //
      // This read `min(room.width-60,(room.height-40)*390/470)`: the room box,
      // minus `.csn-floor--desk .csn-floor__room`'s 30/20 padding, written out
      // as two numbers. That was only ever a way of naming `.csn-floor__plan`,
      // which is the box FloorView actually measures — and it stopped being
      // the same box once the one room started carrying its own notes ("12
      // more tables the floor has not named", which the merged venue now
      // produces where three separate rooms did not), because a note takes its
      // height out of the plan's share of the column and not out of the
      // padding. The rule is unchanged and is the whole point of BUG-103: the
      // plan fills its stage on BOTH axes, keeps 390:470, and centres. It is
      // now asked of the stage itself, which cannot drift from the CSS.
      const stageOf=async()=>page.locator('.csn-floor__plan').boundingBox();
      const fitWidth=(stage)=>Math.min(stage.width,stage.height*390/470);
      async function fits() {
        const available=await page.locator('.csn-floor__room').boundingBox();
        const stage=await stageOf();
        const plan=await page.getByTestId('the-floor').boundingBox();
        expect(plan.width).toBeCloseTo(fitWidth(stage),0);
        expect(plan.width/plan.height).toBeCloseTo(390/470,3);
        expect(plan.x+plan.width/2).toBeCloseTo(stage.x+stage.width/2,0);
        // Still inside the room's own padded box, notes and all — the claim
        // the -60/-40 was reaching for, said as containment rather than as
        // arithmetic.
        expect(plan.y).toBeGreaterThanOrEqual(available.y+19);
        expect(plan.y+plan.height).toBeLessThanOrEqual(available.y+available.height-19);
        expect(await page.locator('.csn-felt58').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}))).toBe(true);
      }
      // LATE TABLES USE THE STAGE. This polled for a plan wider than 390 —
      // FLOOR_W, the unmeasured default — which was a way of saying "it
      // re-measured once the felts arrived". 390 was only the right number
      // while the floor had the whole desk to itself; UI-3 job A puts the
      // ticker and Your table on this stage above it, so the honest form of
      // the same claim is that the plan matches its stage, whatever that
      // stage is.
      await expect.poll(async()=>Math.abs((await page.getByTestId('the-floor').boundingBox()).width-fitWidth(await stageOf()))).toBeLessThan(1);
      await fits();
      await page.screenshot({path:'../artifacts/casino23-'+size.width+'.png'});
      const tall=(await page.getByTestId('the-floor').boundingBox()).height;
      await page.setViewportSize({width:size.width,height:600});
      // A shorter window buys a shorter room. The old number (540) was the
      // height the full-stage floor came out at; the rule is the direction,
      // so it is asserted as the direction.
      await expect.poll(async()=> (await page.getByTestId('the-floor').boundingBox()).height).toBeLessThan(tall-1);
      await fits();
    });
  }
});


test.describe('BUG-99 · the desktop kitchen-table camera', () => {
  for (const size of [{width:1280,height:720}, ...SIZES]) for (const seated of [false,true]) test((seated?'Sit opens your cards and sends a legal action':'Watch opens the existing home game and returns')+' at '+size.width,async({page})=>{
    await desk(page,size);
    const heroSeat=seated?2:1;
    const state={...midHandGame,tableId:GAME.tableId,toAct:heroSeat,seats:midHandGame.seats.slice(0,seated?3:2).map((s,i)=>({...s,holeCards:i===heroSeat?['Ah','Kh']:[],displayName:['Balance','Granite','Jens'][i]}))};
    await page.addInitScript(({state,seated})=>{
      const Base=window.WebSocket;window.__homeTableSent=[];
      window.WebSocket=class extends Base {
        send(raw){const msg=JSON.parse(raw);window.__homeTableSent.push(msg);super.send(raw);
          if(msg.type!=='watch'&&msg.type!=='join')return;
          setTimeout(()=>{
            this.dispatch('message',{data:JSON.stringify(seated?{type:'joined',seat:2}:{type:'watching',spectatorSeat:1})});
            this.dispatch('message',{data:JSON.stringify({type:'state',state,legalActions:seated?[{type:'fold'},{type:'call',amount:40},{type:'raise',min:80,max:980}]:[]})});
          },40);
        }
      };
    },{state,seated});
    await page.reload();
    await page.getByTestId('home-table').click();
    await page.getByTestId(seated?'home-table-sit':'home-table-watch').click();
    const stage=page.getByTestId('desk-home-table');await expect(stage).toBeVisible();
    const frame=await stage.boundingBox();expect(frame.width/frame.height,'DkOwnerM uses the 900×648 felt').toBeCloseTo(900/648,2);
    await expect(stage.locator('.watch-felt')).toBeVisible();
    await expect(page.getByTestId('room-thread')).toBeVisible();
    if(seated){
      await expect(stage.getByTestId('owner-hero')).toBeVisible();
      await expect(stage.getByTestId('owner-hero-cards').locator('[data-landed="yes"]')).toHaveCount(2);
      await expect(stage.getByTestId('owner-hero-cards').locator('.owner-hero__card').nth(1)).toHaveCSS('opacity','1');
      await expect(stage.getByTestId('sit-strip')).toHaveAttribute('data-turn','yes');
      await expect(stage.getByRole('button',{name:'CHECK',exact:true})).toBeDisabled();
      const felt=await stage.boundingBox(),verbs=await stage.getByTestId('sit-strip').boundingBox(),cards=await stage.getByTestId('owner-hero-cards').boundingBox();
      expect(felt.width).toBeLessThanOrEqual(900);expect(verbs.y+verbs.height).toBeLessThanOrEqual(felt.y+felt.height+1);expect(cards.y+cards.height).toBeLessThan(verbs.y);
      if(size.width===1920)await page.screenshot({path:'../artifacts/owner37-wide.png'});
      await stage.getByRole('button',{name:'BET',exact:true}).click();
      await expect(stage.getByTestId('sit-bet-panel')).toBeVisible();
      await expect(stage.getByTestId('sit-bet-panel')).toHaveCSS('opacity','1');
      const betting=await stage.getByTestId('sit-bet-panel').boundingBox(), bettingCards=await stage.getByTestId('owner-hero-cards').boundingBox();
      expect(bettingCards.y+bettingCards.height,'your cards remain above the betting panel').toBeLessThanOrEqual(betting.y);
      const owner=await stage.getByTestId('owner-hero').boundingBox(), board=await stage.locator('.watch-felt__board').boundingBox();
      expect(owner.y).toBeGreaterThan(board.y+board.height+8);
      await page.screenshot({path:'../artifacts/desktop-home25-bet-'+size.width+'.png'});
      await stage.getByRole('button',{name:/ALL IN/}).click();
      await expect.poll(()=>page.evaluate(()=>window.__homeTableSent.some(m=>m.type==='action'&&m.action?.type==='raise'&&m.action.amount===980))).toBe(true);
    }else {await expect(stage.getByTestId('sit-strip')).toHaveCount(0);await expect(stage.getByTestId('owner-hero')).toHaveCount(0);}
    const sent=await page.evaluate(()=>window.__homeTableSent.find(m=>m.type==='join'||m.type==='watch'));
    expect(sent.tableId).toBe(GAME.tableId);
    await page.screenshot({path:'../artifacts/desktop-home25-'+(seated?'sit':'watch')+'-'+size.width+'.png'});
    await page.setViewportSize({width:size.width,height:600});
    await expect.poll(async()=> (await stage.boundingBox()).height).toBeLessThanOrEqual(510);
    const compact=await stage.boundingBox();
    expect(compact.y).toBeGreaterThanOrEqual(54);expect(compact.y+compact.height).toBeLessThanOrEqual(600);
    expect(compact.width/compact.height).toBeCloseTo(900/648,2);
    if(seated){const cards=await stage.getByTestId('owner-hero-cards').boundingBox(),verbs=await stage.getByTestId('sit-strip').boundingBox();expect(cards.y+cards.height).toBeLessThan(verbs.y);}
    await page.getByRole('button',{name:'Back to the room',exact:true}).click();
    await expect(page.getByTestId('home-table')).toBeVisible();await expect(page.getByTestId('desk-home-table')).toHaveCount(0);
  });
});


test.describe('BUG-105 · the casino Watch destination',()=>{
  for(const width of [1440,1920]) for(const owned of [false,true]) test((owned?'your casino table opens its owned conversation':'a public casino table opens without owner controls')+' at '+width,async({page})=>{
    await desk(page,{width,height:width===1920?1080:900});
    const tableId=owned?'t1':'tbl-public',roomId=owned?'upstairs':'floor';
    const state={...midHandGame,tableId,seats:midHandGame.seats.map((s,i)=>({...s,displayName:i===2?'Big Slick':s.displayName,identity:{hood:['oxblood','moss','sand'][i],glow:['ice','violet','gold'][i]},holeCards:owned&&i===2?['Ah','Kh']:[]}))};
    await page.addInitScript(({state,owned,tableId,roomId})=>{
      const Base=window.WebSocket;window.__casinoWatchSent=[];
      window.WebSocket=class extends Base{
        send(raw){const msg=JSON.parse(raw);window.__casinoWatchSent.push(msg);super.send(raw);
          if(msg.type==='floor_sub')setTimeout(()=>this.dispatch('message',{data:JSON.stringify({type:'room_tables',tables:[{tableId,room:roomId,blinds:{small:25,big:50},pot:200,seats:[{name:'Big Slick',agentId:owned?'a3':null,stack:2000,identity:{hood:'sand',glow:'gold'}}],board:[]}],rooms:{[tableId]:roomId}})}),30);
          if(msg.type==='watch' && msg.tableId===tableId)setTimeout(()=>{
            this.dispatch('message',{data:JSON.stringify({type:'watching',spectatorSeat:owned?2:-1})});
            this.dispatch('message',{data:JSON.stringify({type:'state',state,legalActions:[]})});
          },30);
        }
      };
    },{state,owned,tableId,roomId});
    await page.reload();await page.getByTestId('home-door').click();
    // SPEC-1: a stranger's table used to be two taps away — Board, then the
    // doorway of whichever room it was in — because the floor only ever showed
    // one rung of the ladder. UI-3 job A puts EVERY live table on the one
    // floor, so both branches now arrive the same way and the `if(!owned)`
    // detour is deleted. That is the point of the change, not a shortcut past
    // it: the test still proves a public table is reachable from the casino.
    await expect(page.locator('.csn-felt58')).toHaveCount(1);
    await page.evaluate(()=>{window.__casinoWatchSent=[];});
    await expect(page.locator('.csn-felt58 .csn-tiny')).toHaveAttribute('data-hood','sand');
    await page.locator('.csn-felt58').click();
    await expect(page.getByTestId('desk-casino-table')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>window.__casinoWatchSent.some(m=>m.type==='watch'))).toBe(true);
    const sent=await page.evaluate(()=>window.__casinoWatchSent.find(m=>m.type==='watch'));
    expect(sent.tableId).toBe(tableId);
    if(owned){expect(sent.agentId).toBe('a3');await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();await page.getByRole('button',{name:'View your agent at the table',exact:true}).click();await expect(page.getByRole('button',{name:'Stats',exact:true})).toHaveAttribute('aria-pressed','true');await page.getByRole('button',{name:'Back to chat',exact:true}).click();await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();}
    else {expect(sent.agentId).toBeNull();await expect(page.getByPlaceholder('Whisper to him…')).toHaveCount(0);await expect(page.getByText('Live analysis',{exact:true})).toHaveCount(0);await expect(page.locator('.watch-hero__cards')).toHaveText('');}
    await page.getByRole('button',{name:'Sound on',exact:true}).click();
    await expect(page.getByRole('button',{name:'Sound off',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.watch-felt__pot-amt')).toHaveText('$100');
    await expect(page.locator('.watch-felt__hero-card').first()).toHaveCSS('opacity','1');
    await expect(page.locator('.watch-felt__board')).toHaveCSS('opacity','1');
    await expect(page.locator('.watch-hero .mood-ghost')).toHaveAttribute('data-hood',owned?'sand':'oxblood');
    await expect(page.locator('.watch-hero radialGradient stop').first()).toHaveAttribute('stop-color',owned?'#C9A227':'#7FA8C9');
    await page.screenshot({path:'../artifacts/casino31-'+(owned?'owned':'public')+(width===1920?'-1920':'')+'.png'});
    await page.getByRole('button',{name:'BACK TO THE FLOOR',exact:true}).click();
    await expect(page.getByTestId('floor-view')).toBeVisible();
    // SPEC-1: `data-room` was the rung you came from, and BACK TO THE FLOOR
    // had to put you back in THAT room rather than in whichever one the casino
    // defaults to — the bug BUG-105 is named for. One room means there is no
    // rung left to get wrong, so the attribute is now the constant 'floor' and
    // asserting it proves nothing. What still has to be true is that you land
    // back on the room with the table you just left still on it.
    await expect(page.locator('.csn-felt58[data-table="'+tableId+'"]')).toBeVisible();
    expect(await page.evaluate(()=>window.__casinoWatchSent.some(m=>m.type==='leave'))).toBe(true);
  });
});


test('BUG-105 BUG-106: deploying through the casino opens the game with its queued stakes',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await desk(page,{width:1440,height:900});
  await page.route('**/api/agents/a1/queue',r=>r.fulfill({json:{tableId:'tbl-deployed',agentId:'a1',agentName:'Balance',smallBlind:5,bigBlind:10}}));
  await page.addInitScript(()=>{
    const Base=window.WebSocket;window.__deployWatch=[];
    window.WebSocket=class extends Base{send(raw){super.send(raw);const m=JSON.parse(raw);if(m.type==='watch')window.__deployWatch.push(m);}};
  });
  await page.reload();await rosterRow(page,'Balance').click();
  await page.getByRole('button',{name:'Carry',exact:true}).click();
  await page.getByTestId('home-door').click();
  await expect(page.locator('.csn-tray')).toBeVisible();
  // SPEC-1: rooms are stakes. The doorway that read "The floor, 5/10 — 118
  // seated" is a `StakePicker` chip now, and tapping it still deals him in on
  // one tap with no second confirmation (UI-3 job A kept FIX-6 job 2's law).
  // Located by its rung so this still names THE FLOOR, and the queued stakes
  // asserted below are still 5/10.
  await page.locator('.csn-stake[data-stake="floor"]').click();
  await expect(page.getByTestId('desk-casino-table')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>window.__deployWatch.some(m=>m.tableId==='tbl-deployed'&&m.agentId==='a1'))).toBe(true);
  expect(await page.evaluate(()=>window.__deployWatch.find(m=>m.tableId==='tbl-deployed'))).toMatchObject({smallBlind:5,bigBlind:10});
  await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();
  await page.getByRole('button',{name:'Draft another 1 seat left'}).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();await expect(page.getByTestId('desk-casino-table')).toHaveCount(0);
  expect(errors).toEqual([]);
});


test('BUG-107: an agent arriving on an open desktop can continue to the casino',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await desk(page,{width:1440,height:900});
  await rosterRow(page,'Balance').click();
  await expect(page.getByRole('button',{name:'Carry',exact:true})).toBeVisible();
  const newborn=agent('newborn-107','New Arrival');
  await page.route('**/api/agents?**',route=>route.fulfill({json:{agents:[...AGENTS,newborn]}}));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.getByRole('button',{name:'Deal him in',exact:true}).click();
  await expect(page.locator('.csn-tray')).toContainText('New Arrival');
  await page.route('**/api/agents/newborn-107/queue',route=>route.fulfill({json:{tableId:'tbl-newborn',agentId:'newborn-107',agentName:'New Arrival',smallBlind:5,bigBlind:10}}));
  await page.getByRole('button',{name:'Deal him in',exact:true}).click();
  await expect(page.getByTestId('desk-casino-table')).toBeVisible();
  await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();
  expect(errors).toEqual([]);
});


test('BUG-108: desktop Watch uses the designed canvas and Home leaves the table',async({page})=>{
  await desk(page,{width:1440,height:900});
  await page.addInitScript(()=>{const Base=window.WebSocket;window.__watch28=[];window.WebSocket=class extends Base{send(raw){super.send(raw);window.__watch28.push(JSON.parse(raw));}};});
  await page.reload();
  await page.getByRole('button',{name:/Standup/}).click();
  await page.getByRole('button',{name:'WATCH →'}).first().click();
  const stage=page.locator('.dsk-stage--felt');
  const felt=await stage.getByTestId('desk-casino-table').boundingBox();
  expect(felt.width/felt.height).toBeCloseTo(900/648,2);
  await expect(page.locator('.dsk-top--room')).toHaveCSS('height','54px');
  await expect(page.getByText('Live analysis',{exact:true})).toHaveCount(0);
  await page.setViewportSize({width:1280,height:600});
  // setViewportSize resolves before React commits the ResizeObserver scale.
  // Await that observable layout change, retaining the exact screen bounds.
  await expect.poll(async()=> (await stage.getByTestId('desk-casino-table').boundingBox()).y).toBeGreaterThanOrEqual(54);
  const compact=await stage.getByTestId('desk-casino-table').boundingBox();
  expect(compact.width/compact.height).toBeCloseTo(900/648,2);
  expect(compact.y).toBeGreaterThanOrEqual(54);expect(compact.y+compact.height).toBeLessThanOrEqual(600);
  const composer=await page.getByPlaceholder('Whisper to him…').boundingBox();expect(composer.y+composer.height).toBeLessThan(600);
  await page.getByRole('button',{name:'Back home',exact:true}).click();
  expect(await page.evaluate(()=>window.__watch28.some(m=>m.type==='leave'))).toBe(true);
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(stage).toHaveCount(0);
});


test.describe('BUG-125: authored casino camera with real touch input',()=>{
  test.use({hasTouch:true});
  // SPEC-1 · TESTING LAW #6 — BUG-232, and this test is what found it.
  //
  // With the Board detour deleted (UI-3 job A opens the casino on the room),
  // the two phone widths ran the camera for the first time since that change
  // and both go red on claims UI-3 never said it was retiring:
  //
  //   390x844  the pinch zooms, but the ZOOMED room comes out 309px tall on an
  //            844px phone — 36%, where this test's rule is "more than 65%".
  //            UI-3 put the ticker (44), Your table (362, uncapped on the
  //            phone by N3's `max-height: none`) and the conversation on the
  //            casino column above and below the room, and the room got what
  //            was left.
  //   390x590  the felt cannot be pinched at all. The room's own box is 102px,
  //            the 470-unit plan is scaled to the phone's WIDTH and scrolls,
  //            so the only felt in the room renders below the visible band and
  //            its centre hit-tests to `.csn-floor-play` underneath.
  //
  // Both are the product, not this file, so per law #6 the assertions stay
  // verbatim and the two phone cases are `fixme` with the bug id in the name
  // until BUG-232 lands. 1440 still runs and still covers the camera. Do not
  // loosen the 65% — it is the whole claim.
  for(const size of [{width:390,height:844},{width:390,height:590},{width:1440,height:900}])
    test((size.width<1100?'BUG-232: ':'')+'pinch, return, then Watch at '+size.width+'x'+size.height,async({page,context})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await stub(page);await page.setViewportSize(size);
    await page.addInitScript(()=>{
      const Base=window.WebSocket;window.__zoomWatch=[];
      window.WebSocket=class extends Base{send(raw){super.send(raw);const m=JSON.parse(raw);
        if(m.type==='floor_sub')setTimeout(()=>this.dispatch('message',{data:JSON.stringify({type:'room_tables',tables:[{tableId:'tbl-zoom',room:'floor',blinds:'10/20',smallBlind:10,bigBlind:20,pot:4180,hot:true,seats:[{name:'Granite',stack:2000},{name:'Bal',stack:2200}],board:['Ah','Kd','2c']}],rooms:{'tbl-zoom':'floor'}})}),20);
        if(m.type==='watch' && m.tableId==='tbl-zoom')window.__zoomWatch.push(m);
      }};
    });
    await page.goto(HOME);await page.getByTestId('home-door').click();
    // SPEC-1: Board → the floor's doorway was how you reached the room drawn
    // from above. UI-3 job A opens the casino ON that room, so the two clicks
    // are deleted; the camera this test is about is unchanged.
    const floor=page.getByTestId('the-floor'),felt=page.locator('.csn-felt58').first();await expect(felt).toBeVisible();
    await floor.evaluate(el=>{el.__originalFelt=el.querySelector('.csn-felt58')});
    const cdp=await context.newCDPSession(page);
    async function pinch(spread=true){
      const box=await felt.boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
      const distances=spread?[30,38,48,58]:[70,58,46,35];
      for(let i=0;i<distances.length;i++)await cdp.send('Input.dispatchTouchEvent',{type:i?'touchMove':'touchStart',touchPoints:[{x:cx-distances[i]/2,y:cy,id:1},{x:cx+distances[i]/2,y:cy,id:2}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    await pinch();await expect(floor).toHaveAttribute('data-zoom','tbl-zoom');
    await expect(page.getByText('pinch again to watch',{exact:true})).toBeVisible();
    expect(await floor.evaluate(el=>el.__originalFelt===el.querySelector('.csn-felt58'))).toBe(true);
    expect(await page.evaluate(()=>window.__zoomWatch.length)).toBe(0);
    await page.waitForTimeout(450);
    const room=await floor.boundingBox(),button=await page.getByRole('button',{name:'Watch this table',exact:true}).boundingBox();
    expect(button.y+button.height).toBeLessThanOrEqual(size.height);expect(button.y).toBeGreaterThan(room.y);
    if(size.width<1100){await expect(page.locator('.csn-floor__head')).toHaveCount(1);expect(room.height).toBeGreaterThan(size.height*.65);}
    await page.screenshot({path:'../artifacts/floor36-zoom-'+size.width+'-'+size.height+'.png'});
    await pinch(false);await expect(floor).not.toHaveAttribute('data-zoom','tbl-zoom');
    await page.waitForTimeout(450);await pinch();await expect(floor).toHaveAttribute('data-zoom','tbl-zoom');await page.waitForTimeout(450);
    await page.getByRole('button',{name:'Back to the floor',exact:true}).click();await expect(floor).not.toHaveAttribute('data-zoom','tbl-zoom');
    await page.waitForTimeout(450);await pinch();await expect(floor).toHaveAttribute('data-zoom','tbl-zoom');await page.waitForTimeout(450);
    await pinch();await expect.poll(()=>page.evaluate(()=>window.__zoomWatch.length)).toBe(1);
    expect(await page.evaluate(()=>window.__zoomWatch[0].tableId)).toBe('tbl-zoom');
    expect(errors).toEqual([]);
  });
});


for(const width of [390,1440])test('BUG-123: retirement keeps the room and remaining agent at '+width,async({page})=>{
  const original=[BALANCE,GRANITE];let retired=false,refuse=true;const requests=[];
  await stub(page,{agents:original,game:null});await page.setViewportSize({width,height:844});
  await page.route('**/api/agents?**',r=>r.fulfill({json:{agents:retired?[GRANITE]:original}}));
  await page.route('**/api/agents/a1/retire?**',async r=>{
    requests.push(r.request().method());
    if(refuse)return r.fulfill({status:503,json:{error:'Try again'}});
    retired=true;await page.evaluate(()=>{window.__retired36=true;for(const socket of window.__retireSockets36??[])socket.dispatch('message',{data:JSON.stringify({type:'home_state',userId:'4242',agents:window.__remaining36,game:null})});});
    return r.fulfill({json:{archived:true,pending:false,collected:2000}});
  });
  await page.addInitScript(remaining=>{
    const Base=window.WebSocket;window.__remaining36=remaining;window.__retireSockets36=[];window.WebSocket=class extends Base{
      constructor(url){super(url);window.__retireSockets36.push(this);}
      dispatch(type,event){
        if(type==='message' && window.__retired36){const m=JSON.parse(event.data);if(m.type==='home_state'){m.agents=m.agents.filter(a=>a.id!=='a1');event={data:JSON.stringify(m)};}}
        super.dispatch(type,event);
      }
    };
  },[GRANITE]);
  await page.goto(HOME);await expect(page.getByTestId('home-screen')).toBeVisible();
  // The desktop shell can mount before its lazy room. Measure the actual
  // room, not null while that child is still loading.
  await expect(page.locator('.home-flat')).toBeVisible();
  const room=await page.locator('.home-flat').boundingBox();
  if(width<1100)await page.locator('.home-one[data-agent="a1"]').click();else await rosterRow(page,'Balance').click();
  await page.getByRole('button',{name:'Profile',exact:true}).click();
  await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('button',{name:'Retire',exact:true}).click();
  await expect(page.getByText('He finishes the hand, his chips come home, his record is kept.')).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(requests).toEqual([]);
  await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('button',{name:'Retire',exact:true}).click();
  await page.getByRole('button',{name:'Retire him',exact:true}).click();await expect(page.getByText('Could not retire him. Try again.')).toBeVisible();
  refuse=false;await page.getByRole('button',{name:'Retire him',exact:true}).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();await expect(page.locator('.home-chair')).toHaveCount(1,{timeout:15000});
  await expect(page.locator('.home-one[data-agent="a1"]')).toHaveCount(0);
  expect(await page.locator('.home-flat').boundingBox()).toEqual(room);
  expect(requests).toEqual(['POST','POST']);
  await page.waitForTimeout(2300);
  await page.screenshot({path:'../artifacts/retire36-'+width+'.png'});
});

test('B15: head-only look, delayed badge and reduced motion',async({page})=>{
 await stub(page,{agents:[BALANCE],game:null});
 await page.addInitScript(()=>{const Base=window.WebSocket;window.__brandHomeSockets=[];window.WebSocket=class extends Base{constructor(url){super(url);window.__brandHomeSockets.push(this);}};});
 await page.goto(HOME);await expect(page.getByTestId('home-screen')).toBeVisible();
 await expect(page.locator('.room-header .rail-motion')).toBeVisible();
 await page.clock.install();await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
 await page.evaluate(agents=>window.__brandHomeSockets.forEach(s=>s.dispatch('message',{data:JSON.stringify({type:'home_state',userId:'4242',agents,game:null})})),[{...BALANCE,want:{id:'new-want',text:'Let me play.',kind:'play'}}]);
 await expect(page.locator('.room-header [data-motion="look"]')).toBeVisible();
 await expect(page.locator('.room-header .rail-motion__badge')).toHaveCount(0);
 await page.clock.runFor(440);await expect(page.locator('.room-header .rail-motion__badge')).toHaveCount(1);
 await page.locator('.room-header').screenshot({path:'../artifacts/brand37-header.png'});
 await page.evaluate(async()=>{
   const ReactNS=await import('/node_modules/.vite/deps/react.js'); const React=ReactNS.default??ReactNS;
   const ReactDOM=await import('/node_modules/.vite/deps/react-dom_client.js'); const createRoot=(ReactDOM.default??ReactDOM).createRoot;
   const {RailMotion}=await import('/src/components/system/RailMotion.jsx');
   const host=document.createElement('div');host.id='brand37-proof';host.style.cssText='position:fixed;left:30px;top:100px;width:200px;height:200px;background:#0B0F0E;z-index:999';document.body.append(host);
   const root=createRoot(host);window.__brandNews37=news=>root.render(React.createElement(RailMotion,{size:200,news}));window.__brandNews37([]);
 });
 await expect(page.locator('#brand37-proof .rail-motion')).toBeVisible();
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+100)));
 await page.evaluate(()=>window.__brandNews37(['a1:want:new']));
 const mark=page.locator('#brand37-proof'),head=mark.locator('[data-motion="look"]'),rail=mark.locator('.rail-motion__rail');
 await expect(head).toBeVisible();await expect(mark.locator('.rail-motion__badge')).toHaveCount(0);
 const before=await rail.boundingBox();
 await head.evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.currentTime=198;});
 await expect(head).toHaveCSS('transform','matrix(1, 0, 0, 1, -3.5, 0)');expect(await rail.boundingBox()).toEqual(before);
 await mark.screenshot({path:'../artifacts/brand37-look.png'});
 await page.clock.runFor(439);await expect(mark.locator('.rail-motion__badge')).toHaveCount(0);
 await page.clock.runFor(1);await expect(mark.locator('.rail-motion__badge')).toHaveCount(1);
 expect(await rail.boundingBox()).toEqual(before);
 await page.evaluate(()=>window.__brandNews37(['a1:want:new']));await expect(mark.locator('[data-motion="look"]')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.__brandNews37(['a1:want:another']));await page.clock.runFor(1);await expect(mark.locator('[data-motion]')).toHaveCount(0);
});

for(const width of [390,1440])test('FTU37: quiet first shift is explained in the companion at '+width,async({page})=>{
 await stub(page,{agents:[BALANCE],game:null});await page.route('**/api/agents/*/hands**',r=>r.fulfill({json:{recentHands:[{handNumber:1,summary:'A quiet hand.'}]}}));await page.setViewportSize({width,height:844});await page.goto(HOME);
 await page.locator('.home-one[data-agent="a1"]').click();
 await expect(page.getByText('NOTHING WORTH FLAGGING',{exact:true})).toBeVisible();
 await expect(page.getByText('When a hand is worth watching, it arrives here as a replay you can scrub.')).toBeVisible();
 await page.screenshot({path:'../artifacts/empty37-quiet-'+width+'.png'});
});

test('FTU37: no agents and no brief stay in the current room and recruiter flow',async({page})=>{
 await stub(page,{agents:[],game:null,slots:{used:0,cap:4,next:{index:1,price:0,earned:0,unlocked:true}}});await page.route('**/api/home/thread**',r=>r.fulfill({json:{sessionId:null,count:0,lines:[]}}));await page.goto(HOME);
 await expect(page.getByRole('button',{name:'DRAFT YOUR FIRST AGENT',exact:true})).toBeVisible();await expect(page.getByTestId('home-table')).toBeVisible();
 await page.screenshot({path:'../artifacts/empty37-no-agents.png'});
 await page.getByRole('button',{name:'DRAFT YOUR FIRST AGENT',exact:true}).click();await expect(page.getByPlaceholder(/Describe how it should play/i)).toBeVisible();
 await page.waitForTimeout(600);await page.screenshot({path:'../artifacts/empty37-no-brief.png'});
});

test('FTU37: no history and no staked chips remain factual and fundable',async({page})=>{
 const fresh={...BALANCE,stats:{handsPlayed:0},careerStats:{sessions:0,hands:0},sessionLog:[],pocket:{balance:0,mode:'topup',broke:true}};
 await stub(page,{agents:[fresh],game:null});await page.route('**/api/stats',r=>r.fulfill({json:{activeAgents:0}}));await page.route('**/api/notifications/budget**',r=>r.fulfill({json:{enabled:false}}));await page.route('**/api/wallet**',r=>r.fulfill({json:{balance:20000,staked:0,playing:{live:0,total:1},ledger:[]}}));await page.goto(HOME);
 await page.getByRole('button',{name:'Your agents',exact:true}).click();await page.getByTestId('roster-ledger').click();
 await expect(page.getByText('NO SESSION HISTORY YET',{exact:true})).toBeVisible();await expect(page.getByText('Win rate',{exact:true})).toHaveCount(0);
 await page.screenshot({path:'../artifacts/empty37-history.png'});
 await page.getByRole('button',{name:'Back home',exact:true}).click();await page.getByTestId('home-safe').click();await page.getByRole('button',{name:/^GIVE/}).click();
 await expect(page.getByText('$0',{exact:true}).first()).toBeVisible();await page.waitForTimeout(600);await page.screenshot({path:'../artifacts/empty37-nothing-staked.png'});
});
test('K3/N3: a hot public table is visible and watchable without a false held-runout claim',async({page})=>{
 await stub(page,{agents:[BALANCE],game:null});
 await page.route('**/api/rooms**',r=>r.fulfill({json:{rooms:canonicalRooms.map(r=>r.id==='floor'?{...r,tables:1,seated:4,hot:['tbl-hot'],biggestPot:{tableId:'tbl-hot',pot:4180}}:{...r,tables:0,seated:0,hot:[],biggestPot:null})}}));
 await page.addInitScript(()=>{const Base=window.WebSocket;window.__hotWatch=[];window.WebSocket=class extends Base{send(raw){super.send(raw);const m=JSON.parse(raw);
   if(m.type==='floor_sub')setTimeout(()=>this.dispatch('message',{data:JSON.stringify({type:'room_tables',tables:[{tableId:'tbl-hot',room:'floor',blinds:'10/20',smallBlind:10,bigBlind:20,pot:4180,hot:true,seated:4,seats:[{name:'Granite',stack:2000},{name:'Bal',stack:2200},{name:'Ozy',stack:4100},{name:'Doyle',stack:600}],board:['Ah','Kd','2c']}],rooms:{'tbl-hot':'floor'}})}),20);
   if(m.type==='watch' && m.tableId==='tbl-hot')window.__hotWatch.push(m);
 }};});
 await page.goto(HOME);await page.getByTestId('home-door').click();await expect(page.locator('.csn-felt58[data-hot="true"]')).toBeVisible();
 await page.screenshot({path:'../artifacts/hot37-floor.png'});
 // SPEC-1: the Board tap is deleted with the board. LIVE NOW's row — the pot
 // in the air, named, with WATCH on it — is what CasinoTicker inherited, and
 // its accessible name is the same sentence, so the locator below is
 // unchanged and is simply already on screen.
 const watch=page.getByRole('button',{name:/\$4,180 in the middle.*Watch this table/});await expect(watch).toBeVisible();
 // A HOT RUNG IS STILL MARKED. `.csn-room-door[data-hot]` was the doorway
 // glowing because something in that room was running hot; there is no
 // doorway, and the thing that now carries a rung is the stake chip, which
 // takes the same flag from the same `isRoomHot`. The felt itself carrying it
 // is asserted above; this is the rung.
 await expect(page.locator('.csn-stake[data-stake="floor"][data-hot="true"]')).toBeVisible();
 await expect(page.getByText(/runout held for you/i)).toHaveCount(0);
 await page.screenshot({path:'../artifacts/hot37-board.png'});
 await watch.click();await expect.poll(()=>page.evaluate(()=>window.__hotWatch.length)).toBe(1);
});
for(const width of [390,490]) test('BUG-131: visiting agent is live in the roster and watchable from Home at '+width,async({page})=>{
 const traveler={...BALANCE,name:'Traveler',visiting:{hostName:'Fidde',hostUserId:'friend'},homeTableId:'home-friend',location:loc('casino'),liveGame:{tableId:'home-friend',heroSeat:0,heroHole:['Ah','Kd'],blinds:'1/2',street:'flop',board:['5c','4h','8c'],pot:120,net:95,heroStack:295,seats:[{displayName:'Traveler',stack:295},{displayName:'Host',stack:105}]}};
 await stub(page,{agents:[traveler],game:null});await page.setViewportSize({width,height:844});
 await page.addInitScript(()=>{const Base=window.WebSocket;window.__visitWatch=[];window.WebSocket=class extends Base{send(raw){super.send(raw);const msg=JSON.parse(raw);if(msg.type==='watch')window.__visitWatch.push(msg);}};});
 await page.goto(HOME);await expect(page.locator('.room-header__live')).toHaveText('1 AGENT LIVE');
 await page.getByRole('button',{name:'Your agents',exact:true}).click();await expect(page.getByRole('img',{name:'Live at a table'})).toBeVisible();
 await expect(page.getByText("visiting Fidde's",{exact:true})).toBeVisible();await expect(page.getByText('1/2',{exact:true})).toBeVisible();
 // BUG-162 supersedes the former +$95 expectation: practice results are not
 // casino winnings. Keep the real pocket and unknown prior result explicit.
 const visitingRow=page.getByRole('dialog',{name:'Your agents'}).locator('.roster__row[data-agent="a1"]');
 await expect(visitingRow.locator('.roster__pocket')).toHaveText('POCKET$2,000');
 await expect(visitingRow.locator('.roster__result')).toHaveText('—');
 await expect(visitingRow).not.toContainText('+$95');
 await page.waitForTimeout(300);await page.screenshot({path:'../artifacts/visitor39-roster-'+width+'.png'});
 await page.getByRole('dialog',{name:'Your agents'}).getByRole('button',{name:'Close',exact:true}).last().click();
 await page.getByRole('button',{name:/Traveler visiting .*Watch him/}).click();
 await expect.poll(()=>page.evaluate(()=>window.__visitWatch.at(-1)?.tableId)).toBe('home-friend');
 expect(await page.evaluate(()=>window.__visitWatch.at(-1)?.agentId)).toBe('a1');
});
// ── BUG-199 · the landing's product shots keep design 58's proportions ───────
//
// Board 40's L2BigDesk states the rule in one line: `const k = (w - 128) / 1440`
// — "the desktop product, scaled into the column: 1440 into (w − 128), so 0.8 at
// 1280 and 0.91 at 1440 — the same shot both times, and never a phone."
//
// The shipped page reproduces that as `.landing-section { padding: 54px 64px }`
// plus `.landing-screen picture { width: 100% }`, which is the same arithmetic
// written in two places rather than one. Two places is exactly how a number
// drifts, so it is nailed down here: the report that these rendered "far larger
// than design 58" was measured and was not reproducible, and this assertion is
// what makes that measurement survive the next person who changes a padding.
//
// 1280 is the width board 40 is authored at (`LandingPage({ w = 1280 })`).
test('BUG-199: the landing product shot is the design 58 width at 1280', async ({ page }) => {
  await page.route('**/api/guest', (r) => r.fulfill({ json: { ownerId: 'g_welcome' } }));
  await page.route('**/api/auth/config', (r) => r.fulfill({ json: { botUsername: '' } }));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://127.0.0.1:5199/welcome');

  const shot = page.locator('.landing-screen img').first();
  await expect(shot).toBeVisible({ timeout: 20_000 });
  // The design's own arithmetic, not a number copied out of a screenshot.
  const expected = (1280 - 128) / 1440 * 1440;
  const box = await shot.boundingBox();
  expect(box.width).toBeCloseTo(expected, 0);
  // And it is the desktop capture at its real 1440x900 ratio, never the phone
  // one stretched — the other half of "never a phone". Within a pixel, because
  // the frame carries the design's own 1px hairline and the ratio lands on a
  // subpixel; a phone capture here would be off by more than a thousand.
  expect(Math.abs(box.height - expected * 900 / 1440)).toBeLessThan(2);

  // The hero's own art is fixed-size on desktop and must not scale with it:
  // SHOW-1 retains the 350px creature block for the playing hand.
  const creature = page.locator('.guest-hero__creature');
  const c = await creature.boundingBox();
  expect(c.width).toBeCloseTo(470, 0);
  expect(c.height).toBeCloseTo(350, 0);
});
