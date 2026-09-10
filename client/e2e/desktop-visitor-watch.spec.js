import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { midHandGame } from '../src/test/fixtures/game.js';

const guest = {
  id: 'oak', name: 'Professor Oak', nature: { name: 'Rock' },
  identity: { hood: 'indigo', glow: 'violet' }, mood: { state: 'neutral', heat: 20 },
  fatigue: 'fresh', routine: null, pocket: { balance: 2000 }, sessionLog: [],
  // Accepted kitchen visits do not write a casino activeTableId (presentAgent).
  activeTableId: null, homeTableId: 'home-5151', visiting: { hostName: 'Fidde' },
  location: { where: 'casino', tableId: null, room: null },
  liveGame: { tableId: 'home-5151', home: true, board: ['5c', '4h', '8c'], pot: 100,
    street: 'flop', heroSeat: 0, seats: [{ seat: 0, displayName: 'Professor Oak' },
      { seat: 1, displayName: 'Doyle_v3' }, { seat: 2, displayName: 'Granite' }] },
};

async function visitingHousehold(page) {
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', r => {
    const path = new URL(r.request().url()).pathname;
    return r.fulfill({ json: path === '/api/agents' ? { agents: [guest] }
      : path === '/api/wallet' ? { balance: 54000, ledger: [] }
      : path === '/api/slots' ? { used: 1, cap: 4, next: null }
      : path.includes('/thread') ? { sessionId: 'today', lines: [] }
      : path.includes('/memory') ? { memoryContext: '' }
      : { rooms: [], events: [], items: [], lastId: 0 } });
  });
  await page.addInitScript(({ guest, game }) => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
      initDataUnsafe: { user: { id: 4242 } }, get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    window.__visitorMessages = [];
    class Socket {
      constructor() {
        this.readyState = 0; this.listeners = {};
        setTimeout(() => {
          this.readyState = 1; this.emit('open', {});
          const { activeTableId, ...compact } = guest;
          this.push({ type: 'home_state', userId: '4242', agents: [compact], game: null });
        }, 20);
      }
      emit(type, event) { for (const f of this.listeners[type] ?? []) f(event); }
      push(value) { this.emit('message', { data: JSON.stringify(value) }); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(v => v !== fn); }
      close() { this.readyState = 3; }
      send(raw) {
        const msg = JSON.parse(raw); window.__visitorMessages.push(msg);
        if (msg.type === 'watch') setTimeout(() => {
          this.push({ type: 'watching', tableId: msg.tableId, spectatorSeat: 0 });
          this.push({ type: 'state', state: { ...game, tableId: msg.tableId,
            seats: game.seats.map((seat, i) => i ? seat : { ...seat, displayName: guest.name }) },
          yourSeat: 0, legalActions: [] });
        }, 20);
      }
    }
    Socket.OPEN = 1; Socket.prototype.OPEN = 1; window.WebSocket = Socket;
  }, { guest, game: midHandGame });
  await page.goto('/');
  await expect(page.getByTestId('home-frame-oak')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 390, height: 590 }]) {
  test(`BUG-193: an own visiting agent watches the actual host kitchen at ${size.width}x${size.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await visitingHousehold(page);
    const frame = page.getByTestId('home-frame-oak');
    await expect(frame).toHaveAccessibleName("Professor Oak visiting Fidde's — Fidde's. Watch him.");
    await frame.click();
    await expect.poll(() => page.evaluate(() => window.__visitorMessages.filter(m => m.type === 'watch')
      .map(m => ({ agentId: m.agentId, tableId: m.tableId, displayName: m.displayName, userId: m.userId })))).toEqual([
      { agentId: 'oak', tableId: 'home-5151', displayName: 'Professor Oak', userId: '4242' },
    ]);
    expect(await page.evaluate(() => JSON.stringify(window.__visitorMessages.find(m => m.type === 'watch'))
      .includes(window.Telegram.WebApp.initData))).toBe(true);
    await expect(page.locator('.watch-felt')).toBeVisible();
    await expect(page.locator('.watch-felt__card')).toHaveText(['5', '4', '8', '', '']);
    await expect(page.getByText('SHUFFLING UP…', { exact: true })).toHaveCount(0);
    if (size.width > 1100) await expect(page.getByTestId('desk-casino-table')).toHaveAccessibleName('Professor Oak at the table');
    await mkdir(testInfo.outputDir, { recursive: true });
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('visitor-watching.png') });
    await writeFile(testInfo.outputPath('watch-target.json'), JSON.stringify(await page.evaluate(() =>
      window.__visitorMessages.filter(m => m.type === 'watch').map(({ tableId, agentId, displayName, userId }) =>
        ({ tableId, agentId, displayName, userId }))), null, 2));
    expect(errors).toEqual([]);
  });
}
