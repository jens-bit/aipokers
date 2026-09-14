// client/e2e/casino-roster-overlap.spec.js — BUG-208
//
// Jens: "Inside the casino, at a table, opening another of his agents (e.g.
// Granite) draws that agent's screen behind the owner's seat position, which
// looks broken." The roster sheet is deliberately glass over the room (see
// styles/roster.css) — but CasinoScreen's own foreground panels while inside
// a room (the deploy card, the conversation band) are dense opaque text sat
// exactly where the roster's own rows land, so they showed straight through
// the blur and overlapped it, rather than standing down for the sheet
// reading over them. Fixed by gating both on the `rosterOpen` prop CasinoScreen
// now takes from App.jsx.
//
//   cd client && npx playwright test e2e/casino-roster-overlap.spec.js

import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 390, height: 844 };

const loc = (where = 'home', extra = {}) => ({
  where, tableId: null, room: null, since: Date.now() - 41 * 60_000, ...extra,
});

const agent = (id, name, over = {}) => ({
  id, name, style: 'Balanced', risk: 'Medium', nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 40 }, fatigue: 'fresh', location: loc('home'),
  routine: { key: 'reads', label: 'reading' }, unseenRecap: false, want: null,
  opener: 'Sit down.', activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 },
  careerStats: { hands: 140, sessions: 4, net: 1200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [], chatHistory: [],
  ...over,
});

const GRANITE = agent('granite', 'Granite', { location: loc('home') });
const SLICK = agent('slick', 'Big Slick', {
  location: loc('table', { tableId: 't1', room: 'upstairs' }),
  activeTableId: 't1',
  liveGame: { tableId: 't1', pot: 480, board: ['Ah', 'Kd', '2c'], street: 'flop', net: 340, heroStack: 1800, heroSeat: 0,
    seats: [{ seat: 0, displayName: 'Big Slick' }, { seat: 1, displayName: 'House' }] },
});

const ROOMS = [
  { id: 'floor', name: 'the floor', rung: 0, stakes: { smallBlind: 10, bigBlind: 20, buyIn: 800, label: '$10/$20' }, tables: 3, seated: 44, hot: [], biggestPot: null },
  { id: 'upstairs', name: 'upstairs', rung: 1, stakes: { smallBlind: 25, bigBlind: 50, buyIn: 2000, label: '$25/$50' }, tables: 1, seated: 2, hot: ['t1'], biggestPot: { tableId: 't1', pot: 480 } },
  { id: 'backroom', name: 'the back room', rung: 2, stakes: { smallBlind: 50, bigBlind: 100, buyIn: 4000, label: '$50/$100' }, tables: 0, seated: 0, hot: [], biggestPot: null },
];

async function household(page) {
  await page.route('**/api/agents?**', (r) => r.fulfill({ json: { agents: [GRANITE, SLICK] } }));
  await page.route('**/api/agents/*/study**', (r) => r.fulfill({ json: { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (r) => r.fulfill({ json: { sessionId: 's1', lines: [], count: 0 } }));
  await page.route('**/api/agents/*/memory**', (r) => r.fulfill({ json: { memoryContext: '' } }));
  await page.route('**/api/agents/*/hands**', (r) => r.fulfill({ json: { recentHands: [] } }));
  await page.route('**/api/agents/*/flagged**', (r) => r.fulfill({ json: { flaggedHands: [] } }));
  await page.route('**/api/wallet**', (r) => r.fulfill({ json: { balance: 12000, ledger: [] } }));
  await page.route('**/api/events**', (r) => r.fulfill({ json: { events: [], lastId: 0 } }));
  await page.route('**/api/rooms**', (r) => r.fulfill({ json: { rooms: ROOMS, hotWindowMs: 20000 } }));
  await page.route('**/api/rooms/*/tables**', (r) => r.fulfill({ json: { tables: [] } }));
  await page.route('**/api/stats**', (r) => r.fulfill({ json: { totalAgents: 2, handsPlayedToday: 3 } }));
  await page.route('**/api/auth/config**', (r) => r.fulfill({ json: { botUsername: '' } }));
  await page.route('https://telegram.org/**', (r) => r.fulfill({ body: '', contentType: 'application/javascript' }));

  await page.addInitScript(() => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
      initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
      viewportHeight: 844, ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
  });

  await page.addInitScript(([list]) => {
    const tables = [{ tableId: 't1', room: 'upstairs', seats: [{ seat: 0, displayName: 'Big Slick' }, { seat: 1, displayName: 'House' }], pot: 480, board: ['Ah', 'Kd', '2c'], street: 'flop', blinds: '$25/$50' }];
    class ScriptedSocket {
      constructor(url) {
        this.url = url; this.readyState = 0; this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1; this.dispatch('open', {});
          this.dispatch('message', { data: JSON.stringify({ type: 'home_state', userId: '4242', agents: list, game: null }) });
        }, 30);
      }
      dispatch(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { const at = this.listeners[type]?.indexOf(fn) ?? -1; if (at >= 0) this.listeners[type].splice(at, 1); }
      send(raw) {
        let msg; try { msg = JSON.parse(raw); } catch { return; }
        if (msg.type === 'floor_sub') setTimeout(() => {
          this.dispatch('message', { data: JSON.stringify({ type: 'floor_rooms', rooms: [] }) });
          this.dispatch('message', { data: JSON.stringify({ type: 'room_tables', tables, rooms: { t1: 'upstairs' } }) });
        }, 10);
      }
      close() { this.readyState = 3; }
    }
    ScriptedSocket.OPEN = 1; ScriptedSocket.prototype.OPEN = 1;
    window.WebSocket = ScriptedSocket;
  }, [[GRANITE, SLICK]]);
}

test('BUG-208: the roster stands the room\'s own foreground panels down instead of overlapping them', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await household(page);
  await page.goto('/');
  await page.waitForSelector('[data-testid="home-screen"]');
  await page.getByTestId('home-door').click();
  // The hot table decides the default room, and it lands here already open.
  await expect(page.getByTestId('floor-view')).toHaveAttribute('data-room', 'upstairs');

  // Sanity: with the roster closed, this room's own foreground panels are up.
  const playPanel = page.getByTestId('casino-play');
  const conversation = page.locator('.home-thread');
  await expect(playPanel).toBeVisible();
  await expect(conversation).toBeVisible();

  // Open the roster from inside the room and let its entrance animation settle.
  await page.getByRole('button', { name: /Your agents/i }).click();
  const sheet = page.getByTestId('roster-sheet');
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);

  // The room's own foreground panels must stand down while the sheet is up —
  // not just visually dimmed, gone from the accessibility tree too, since a
  // translucent-but-still-focusable "SEND GRANITE TO PLAY" button under a
  // modal sheet is as broken as the overlap itself.
  await expect(playPanel).toHaveCount(0);
  await expect(conversation).toHaveCount(0);

  // The roster itself must read cleanly - the exact regression: his row's
  // text must not be fighting anything else for the same pixels.
  await expect(sheet.getByRole('button', { name: /^Granite —/ })).toBeVisible();
  await expect(sheet.getByRole('button', { name: /^Big Slick —/ })).toBeVisible();

  // Opening him from here still lands cleanly on his agent view, full-screen.
  await sheet.getByRole('button', { name: /^Granite —/ }).click();
  const room = page.getByRole('region', { name: "Granite's room", exact: true });
  await expect(room).toBeVisible();
  await expect(playPanel).toHaveCount(0);

  // Back out: the room's own panels return.
  await room.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(playPanel).toBeVisible();
  await expect(conversation).toBeVisible();
});
