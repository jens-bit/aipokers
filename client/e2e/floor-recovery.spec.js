import { test, expect } from '@playwright/test';
import { rooms as ladder } from '../src/test/fixtures/rooms.js';

const agents = ['Milo', 'River', 'Sage', 'Ash'].map((name, i) => ({
  id: `recover-${i}`, name, style: 'Balanced', risk: 'Medium', nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 25 }, fatigue: 'fresh', unseenRecap: false,
  routine: { key: 'reads', label: 'reading' }, stats: { handsPlayed: 140 }, sessionLog: [],
  location: { where: i === 0 ? 'casino' : 'home', tableId: i === 0 ? 'recover-table' : null },
  activeTableId: i === 0 ? 'recover-table' : null,
  liveGame: i === 0 ? { tableId: 'recover-table', blinds: '10/20', pot: 420, street: 'flop' } : null,
  pocket: { balance: 2500, mode: 'allowance', cap: 5000, broke: false, collectable: 0, pnl: 0 },
}));
const table = {
  tableId: 'recover-table', room: 'floor', blinds: '10/20', smallBlind: 10, bigBlind: 20,
  seated: 2, maxSeats: 6, pot: 420, board: ['Ah', 'Kd', '2c'], street: 'flop', handNumber: 3,
  seats: [{ seat: 0, agentId: agents[0].id, name: 'Milo', stack: 2400 }, { seat: 1, name: 'Granite', stack: 1800 }],
};
const rooms = ladder.map((room, i) => ({ ...room, seated: i === 0 ? 2 : 0, tables: i === 0 ? 1 : 0, biggestPot: i === 0 ? { tableId: table.tableId, pot: 420 } : null, hot: [] }));

async function floor(page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/agents' ? { agents }
      : path === '/api/rooms' ? { rooms }
      : path === '/api/wallet' ? { balance: 9000, staked: 2000, session: 0, ledger: [] }
      : path === '/api/slots' ? { used: 4, cap: 4, next: null }
      : path === '/api/auth/config' ? { botUsername: '' }
      : path === '/api/fridge' ? { items: [] }
      : { events: [], lastId: 0, lines: [], count: 0, recentHands: [], flaggedHands: [] };
    return route.fulfill({ json: body });
  });
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.addInitScript(({ agents, rooms, table }) => {
    window.Telegram = { WebApp: {
      initData: 'test', initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
      get viewportHeight() { return innerHeight; }, ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    window.__recoveryWatch = [];
    window.WebSocket = class {
      static OPEN = 1;
      OPEN = 1; readyState = 0; listeners = {};
      constructor() { setTimeout(() => { this.readyState = 1; this.dispatch('open', {}); }, 20); }
      dispatch(type, payload) { for (const fn of this.listeners[type] ?? []) fn(payload); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      send(raw) {
        const m = JSON.parse(raw);
        const push = payload => this.dispatch('message', { data: JSON.stringify(payload) });
        if (m.type === 'home_sub') setTimeout(() => push({ type: 'home_state', userId: '4242', agents, game: null }), 10);
        if (m.type === 'floor_sub') setTimeout(() => {
          push({ type: 'floor_state', rooms });
          push({ type: 'room_tables', tables: [table], rooms: { [table.tableId]: 'floor' } });
        }, 10);
        if (m.type === 'watch') window.__recoveryWatch.push(m);
      }
      close() { this.readyState = 3; }
    };
  }, { agents, rooms, table });
  await page.goto('/');
  await page.getByTestId('home-door').click();
  await expect(page.getByTestId('the-floor')).toBeVisible();
}

for (const height of [844, 590]) {
  test(`BUG-232 / BUG-237: room targets, top bar and persistent Home at 390x${height}`, async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height });
    await floor(page);
    const felt = page.locator('.csn-felt58').first();
    const room = page.getByTestId('the-floor');
    const home = page.getByRole('button', { name: 'Back home', exact: true });
    const your = page.getByTestId('your-tables');
    const navBox = await home.boundingBox(), yourBox = await your.boundingBox();
    expect(navBox.y).toBeLessThan(70);
    expect(navBox.y + navBox.height).toBeLessThan(yourBox.y);
    expect(yourBox.y + yourBox.height).toBeLessThan(height * .42);
    const bar = await page.locator('.csn-floor58__bar').boundingBox();
    const feltBox = await felt.boundingBox();
    expect(bar.y + bar.height).toBeLessThan(feltBox.y);
    expect(await felt.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
    await page.screenshot({ path: `../artifacts/recovery/floor-${height}.png` });
    const cdp = await context.newCDPSession(page);
    const cx = feltBox.x + feltBox.width / 2, cy = feltBox.y + feltBox.height / 2;
    for (const [i, gap] of [30, 40, 50, 60].entries()) {
      await cdp.send('Input.dispatchTouchEvent', { type: i ? 'touchMove' : 'touchStart', touchPoints: [{ x: cx - gap / 2, y: cy, id: 1 }, { x: cx + gap / 2, y: cy, id: 2 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(room).toHaveAttribute('data-zoom', table.tableId);
    await expect.poll(async () => {
      const box = await felt.boundingBox();
      return Math.abs(box.x + box.width / 2 - 195);
    }).toBeLessThan(2);
    const zoomBox = await room.boundingBox();
    expect(zoomBox.height).toBeGreaterThan(height * .65);
    const watch = page.getByRole('button', { name: 'Watch this table', exact: true });
    const watchBox = await watch.boundingBox();
    expect(watchBox.y + watchBox.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: `../artifacts/recovery/floor-zoom-${height}.png` });
    await page.getByRole('button', { name: 'Back to the floor', exact: true }).click();
    await expect(room).not.toHaveAttribute('data-zoom');
    await page.locator('.csn-floor__body').evaluate(el => { el.scrollTop = el.scrollHeight; });
    expect((await home.boundingBox()).y).toBe(navBox.y);
    await home.click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });
}
