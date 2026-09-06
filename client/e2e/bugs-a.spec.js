// client/e2e/bugs-a.spec.js — BUGS-A
//
// The four jobs in this queue that are about what a FINGER meets on a phone,
// checked at 390×844, the size the Mini App actually opens at:
//
//   job 2  the empty-state race — the room must be there while the roster is
//          still in flight, and the "nobody lives here" claim must not flash
//   job 5  sheets are above the room, and a finger drags one down to dismiss
//   job 7  the taps that did nothing: the home table, an away frame, a room in
//          the casino, a line on the board
//   job 9  the roster sheet behind the top-right avatar
//
// Same rules as home.spec.js: outside `npm test` and outside CI, every fixture
// served through page.route, no server and no model. Run:
//
//   cd client && npx playwright test e2e/bugs-a.spec.js

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
  opener: 'Sit down. What do you want to know?',
  activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 },
  careerStats: { hands: 140, sessions: 4, net: 1200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [],
  ...over,
});

const AWAY = agent('a3', 'Big Slick', {
  nature: { name: 'Hothead' },
  location: loc('table', { tableId: 't1', room: 'upstairs' }),
  routine: null,
  activeTableId: 't1',
  mood: { state: 'tilted', heat: 78 },
  liveGame: {
    tableId: 't1', pot: 480, board: ['Ah', 'Kd', '2c'], street: 'flop',
    net: 340, heroStack: 1800, heroSeat: 0,
    seats: [{ seat: 0, displayName: 'Big Slick' }, { seat: 1, displayName: 'Granite' }],
  },
});

const HOUSEHOLD = [agent('a1', 'The Clock'), agent('a2', 'River Rat'), AWAY];

const ROOMS = [
  { id: 'floor', name: 'the floor', rung: 0, stakes: { smallBlind: 10, bigBlind: 20, buyIn: 800, label: '$10/$20' }, tables: 3, seated: 44, hot: ['t9'], biggestPot: { tableId: 't7', pot: 4180 } },
  { id: 'upstairs', name: 'upstairs', rung: 1, stakes: { smallBlind: 25, bigBlind: 50, buyIn: 2000, label: '$25/$50' }, tables: 2, seated: 11, hot: [], biggestPot: null },
  { id: 'backroom', name: 'the back room', rung: 2, stakes: { smallBlind: 50, bigBlind: 100, buyIn: 4000, label: '$50/$100' }, tables: 0, seated: 0, hot: [], biggestPot: null },
];

const EVENTS = [
  { id: 1, type: 'bigPot', headline: 'Granite took $4,180 off the table', tableId: 't7', agentIds: [], at: Date.now() - 40_000 },
];

const THREAD = {
  sessionId: 's1',
  count: 2,
  lines: [
    { id: 1, kind: 'him', who: 'HIM', text: 'He does that every single time.', ts: Date.now() - 480_000, source: 'table' },
    { id: 2, kind: 'you', who: 'YOU', text: 'So take it off him.', ts: Date.now() - 460_000, source: 'table' },
  ],
};

const HOME_GAME = {
  tableId: 'home-u1',
  state: 'running',
  seats: [
    { seat: 0, agentId: 'a1', name: 'The Clock', house: false },
    { seat: 1, agentId: 'a2', name: 'River Rat', house: false },
  ],
  handsPlayed: 7,
};

/**
 * Everything the app asks for, from a fixture.
 *
 * `hold` leaves GET /api/agents hanging so job 2 can photograph the exact beat
 * the bug lived in: the roster in flight, and no answer about the household
 * yet.
 */
async function stub(page, {
  agents = HOUSEHOLD, game = null, hold = false, rooms = ROOMS, events = EVENTS,
} = {}) {
  await page.route('**/api/agents?**', async (route) => {
    if (hold) return;
    await route.fulfill({ json: { agents } });
  });
  await page.route('**/api/agents/*/study**', (r) => r.fulfill({ json: { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (r) => r.fulfill({ json: THREAD }));
  await page.route('**/api/agents/*/memory**', (r) => r.fulfill({ json: { memoryContext: '' } }));
  await page.route('**/api/agents/*/hands**', (r) => r.fulfill({ json: { recentHands: [] } }));
  await page.route('**/api/wallet**', (r) => r.fulfill({ json: { balance: 12000, ledger: [] } }));
  await page.route('**/api/events**', (r) => r.fulfill({ json: { events, lastId: events.length } }));
  await page.route('**/api/rooms**', (r) => r.fulfill({ json: { rooms, hotWindowMs: 20000 } }));
  await page.route('**/api/stats**', (r) => r.fulfill({ json: { totalAgents: 12, handsPlayedToday: 3 } }));
  await page.route('**/api/auth/config**', (r) => r.fulfill({ json: { botUsername: '' } }));
  await page.route('https://telegram.org/**', (r) => r.fulfill({ body: '', contentType: 'application/javascript' }));

  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
        initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
        viewportHeight: 844,
        ready() {}, expand() {},
        disableVerticalSwipes() { window.__swipesDisabled = true; },
        onEvent() {}, offEvent() {},
      },
    };
  });

  // The socket, scripted: it opens and answers FLOOR_SUB with this cast's
  // HOME_STATE, and says nothing else. `hold` silences it too — the point of
  // that state is that NOTHING has answered yet.
  await page.addInitScript(([list, g, silent]) => {
    class ScriptedSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          if (silent) return;
          this.dispatch('message', {
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents: list, game: g }),
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
  }, [agents, game, hold]);
}

async function open(page, opts = {}) {
  await stub(page, opts);
  await page.setViewportSize(VIEWPORT);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
}

/** A finger dragging down the middle of an element, in three real touch beats. */
async function dragDown(page, selector, distance = 200) {
  const box = await page.locator(selector).boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) await page.mouse.move(x, y + (distance * i) / 6);
  await page.mouse.up();
}

// ── job 2 ───────────────────────────────────────────────────────────────────

test.describe('BUGS-A job 2 · the empty-state race', () => {
  test('the room is on screen while the roster is still in flight', async ({ page }) => {
    await open(page, { hold: true });
    // The flat, with its fixtures — not a sentence about having nobody.
    await expect(page.getByTestId('home-fridge')).toBeVisible();
    await expect(page.getByTestId('home-safe')).toBeVisible();
    await expect(page.getByText(/Nobody lives here yet/)).toHaveCount(0);
    await page.screenshot({ path: 'e2e/__screenshots__/bugsa-2-roster-in-flight.png' });
  });

  test('an answer of zero, and only that, is the empty state', async ({ page }) => {
    await open(page, { agents: [] });
    await expect(page.getByText(/Nobody lives here yet/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Make an agent' })).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/bugsa-2-answered-zero.png' });
  });

  test('the household arrives and the room fills', async ({ page }) => {
    await open(page);
    await expect(page.locator('.home-one')).toHaveCount(2);
    await expect(page.getByTestId('home-frame-a3')).toBeVisible();
    await page.screenshot({ path: 'e2e/__screenshots__/bugsa-2-household.png' });
  });
});
