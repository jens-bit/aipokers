// client/e2e/desk.spec.js — DESK-2
//
// Six pictures of the desk at 1440×900 — HOME and its rail, each fixture, and
// the casino with the ticker in the rail.
//
// WHY THIS IS NOT IN `npm test` OR IN CI: the same reason home.spec.js gives.
// It is a LOOK check, not a rule check. Every rule this wave has — the room is
// the phone's room, the thread is the ROOM's thread, a fixture opens in the
// rail, the ticker is in the rail and holds more than five lines — is asserted
// in DeskHome.test.jsx and CasinoScreen.desk.test.jsx under vitest, which runs
// in seconds and gates every commit. Screenshots gate nothing; they are for a
// person's eyes.
//
// Everything is served from a fixture through page.route, so nothing here needs
// a server, a database or a model, and the pictures are the same on every
// machine. 1440×900 is the desktop the parity board is drawn at; the app's own
// breakpoint is 1100, so this viewport is what puts the desk on screen.
//
// Run:  cd client && npx playwright test e2e/desk.spec.js
// Look: client/e2e/__screenshots__/desk-*.png

import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 1440, height: 900 };
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
  await page.route('**/api/home/thread**', (route) => route.fulfill({ json: ROOM_THREAD }));
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
        viewportHeight: 900,
        ready() {}, expand() {}, disableVerticalSwipes() {},
        onEvent() {}, offEvent() {},
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
  }, [AGENTS, GAME]);
}

async function desk(page, opts = {}) {
  await stub(page, opts);
  await page.setViewportSize(VIEWPORT);
  await page.goto(HOME);
  await page.waitForSelector('.dsk-root');
  await page.waitForSelector('.home-flat');
  await page.waitForTimeout(700);
}

async function shot(page, name) {
  await page.screenshot({ path: `e2e/__screenshots__/desk-${name}.png` });
}

test.use({ viewport: VIEWPORT, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

test.describe('DESK-2 · HOME at 1440×900', () => {
  test('the room, and the thread', async ({ page }) => {
    await desk(page);

    // P15: one room, the thread permanently beside it, and away shown as a
    // frame on the wall rather than as a row somewhere.
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('room-thread')).toBeVisible();
    await expect(page.getByTestId('home-frame-a3')).toBeVisible();
    await expect(page.locator('.home-flat')).toHaveCount(1);
    await shot(page, 'home');
  });

  test('the safe, in the rail', async ({ page }) => {
    await desk(page);
    await page.getByTestId('home-safe').click();

    // P16: the money in the rail, the room dimmed rather than covered.
    await expect(page.getByText('The safe')).toBeVisible();
    await expect(page.locator('.home1__room')).toHaveAttribute('data-dim', 'true');
    await page.waitForTimeout(300);
    await shot(page, 'safe');
  });

  test('tap the table', async ({ page }) => {
    await desk(page);
    await page.getByTestId('home-table').click();

    // P17: the only place a seat price appears, and it is the server's price.
    await expect(page.getByTestId('home-table-sheet')).toBeVisible();
    await expect(page.getByText('4TH SEAT')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 'table');
  });

  test('the fridge, in the rail', async ({ page }) => {
    await desk(page);
    await page.getByTestId('home-fridge').click();

    // P18's fixture: the same stock sheet, mounted rather than glassed.
    await expect(page.getByTestId('home-fridge-sheet')).toBeVisible();
    await expect(page.getByTestId('home-give-beer')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 'fridge');
  });

  test('a man, in the rail', async ({ page }) => {
    await desk(page);
    await page.locator('.home-one[data-agent="a2"]').click();

    await expect(page.getByRole('tab', { name: /player card/i })).toBeVisible();
    await expect(page.locator('.home-flat')).toHaveCount(1);
    await page.waitForTimeout(400);
    await shot(page, 'man');
  });
});

test.describe('DESK-2 · the casino at 1440×900', () => {
  test('the building on the stage, the ticker in the rail', async ({ page }) => {
    await desk(page);
    await page.getByRole('button', { name: 'CASINO', exact: true }).click();

    await page.waitForSelector('.csn-desk__rail');
    await expect(page.locator('.csn-door')).toHaveCount(ROOMS.length);
    // One ticker, and it is in the rail.
    await expect(page.locator('.csn-board')).toHaveCount(1);
    await expect(page.locator('.csn-desk__rail .csn-board')).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, 'casino');
  });
});

// ── FIX-6 job 5 ─────────────────────────────────────────────────────────────
//
// THE ONE CHECK THIS SUITE MAKES THAT IS NOT A PICTURE, and it is here rather
// than in vitest because it is about GEOMETRY: jsdom has no layout, so "the
// sheet does not span the viewport" is a claim only a real browser can settle.
// Where the sheet is mounted is asserted in CasinoScreen.desk.test.jsx, which
// runs in CI; this asserts what that mounting is FOR.

test.describe('FIX-6 · no sheet spans the desk', () => {
  test('the rooms are three cards across, and every sheet opens in the rail', async ({ page }) => {
    await desk(page);
    await page.getByRole('button', { name: 'CASINO', exact: true }).click();
    await page.waitForSelector('.csn-rooms__row');

    // Three cards side by side: same top, same height, left to right.
    const doors = await page.locator('.csn-door').all();
    expect(doors).toHaveLength(ROOMS.length);
    const boxes = [];
    for (const door of doors) boxes.push(await door.boundingBox());
    for (let i = 1; i < boxes.length; i++) {
      expect(Math.abs(boxes[i].y - boxes[0].y)).toBeLessThan(2);
      expect(Math.abs(boxes[i].height - boxes[0].height)).toBeLessThan(2);
      expect(boxes[i].x).toBeGreaterThan(boxes[i - 1].x + boxes[i - 1].width - 2);
    }
    await shot(page, 'casino-rooms');

    // A doorway opens the room in the RAIL. Not a bottom sheet: it must not
    // reach the left edge of the desk and must not be the width of it.
    const rail = await page.locator('.csn-desk__rail').boundingBox();
    await page.getByRole('button', { name: /^The floor,/ }).click();
    const sheet = page.getByTestId('room-tables-sheet');
    await expect(sheet).toBeVisible();

    const box = await sheet.boundingBox();
    expect(box.width).toBeLessThan(VIEWPORT.width * 0.6);
    expect(box.x).toBeGreaterThanOrEqual(rail.x - 1);
    // ...and the building it is about is still on screen beside it.
    await expect(page.locator('.csn-door')).toHaveCount(ROOMS.length);
    await page.waitForTimeout(300);
    await shot(page, 'casino-room-sheet');
  });
});
