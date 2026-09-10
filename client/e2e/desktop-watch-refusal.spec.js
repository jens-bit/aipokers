import { test, expect } from '@playwright/test';
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

async function visitingHousehold(page, { refused = true, visiting = true, cold = false } = {}) {
  const selected = visiting ? guest : { ...guest, activeTableId: 'casino-oak', homeTableId: null, visiting: null,
    liveGame: { ...guest.liveGame, tableId: 'casino-oak', home: false } };
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', r => {
    const path = new URL(r.request().url()).pathname;
    return r.fulfill({ json: path === '/api/agents' ? { agents: [selected] }
      : path === '/api/wallet' ? { balance: 54000, ledger: [] }
      : path === '/api/slots' ? { used: 1, cap: 4, next: null }
      : path.includes('/thread') ? { sessionId: 'today', lines: [] }
      : path.includes('/memory') ? { memoryContext: '' }
      : { rooms: [], events: [], items: [], lastId: 0 } });
  });
  await page.addInitScript(({ guest, game, refused, cold }) => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
      initDataUnsafe: { user: { id: 4242 }, ...(cold ? { start_param: 'table_home-private' } : {}) }, get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    window.__visitorMessages = [];
    window.__refusalMode = refused;
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
          window.__activeWatch = this;
          if (window.__refusalMode) return this.push({ type: 'error', message: 'This kitchen is private' });
          this.push({ type: 'watching', tableId: msg.tableId, spectatorSeat: 0 });
          this.push({ type: 'state', state: { ...game, tableId: msg.tableId,
            seats: game.seats.map((seat, i) => i ? seat : { ...seat, displayName: guest.name }) },
          yourSeat: 0, legalActions: [] });
        }, 20);
      }
    }
    Socket.OPEN = 1; Socket.prototype.OPEN = 1; window.WebSocket = Socket;
  }, { guest: selected, game: midHandGame, refused, cold });
  await page.goto('/');
  await expect(page.getByTestId('home-frame-oak')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const visiting of [true, false]) for (const entry of ['away frame', 'television']) {
test(`BUG-194: refused owned ${visiting ? 'visitor' : 'casino agent'} ${entry} shows the reason, returns home and can retry`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await visitingHousehold(page, { visiting });
  const target = page.getByTestId(entry === 'television' ? 'home-tv' : 'home-frame-oak');
  await target.click();
  const alert = page.getByRole('alert');
  await expect(alert.locator('p')).toHaveText('This kitchen is private');
  await expect(page.getByTestId('desk-casino-table')).toHaveCount(0);
  await expect(page.getByText(/SHUFFLING/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('refused.png') });
  await alert.getByRole('button', { name: 'Back home', exact: true }).click();
  await expect(page.getByTestId('home-frame-oak')).toBeVisible();
  await expect(alert).toHaveCount(0);
  expect(await page.evaluate(() => window.__activeWatch.readyState)).toBe(3);
  await page.evaluate(() => { window.__refusalMode = false; });
  await target.click();
  await expect(page.getByTestId('desk-casino-table')).toHaveAccessibleName('Professor Oak at the table');
  await expect(page.locator('.watch-felt__pot-amt')).toHaveText('$100');
  const tableId = visiting ? 'home-5151' : 'casino-oak';
  await expect.poll(() => page.evaluate(() => window.__visitorMessages.filter(m => m.type === 'watch'))).toEqual([
    expect.objectContaining({ agentId: 'oak', tableId, userId: '4242' }),
    expect.objectContaining({ agentId: 'oak', tableId, userId: '4242' }),
  ]);
  await expect(alert).toHaveCount(0);
});
}

test('BUG-194: the existing desktop cold-link refusal still has a usable return', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await visitingHousehold(page, { cold: true });
  const alert = page.getByRole('alert');
  await expect(alert.locator('p')).toHaveText('This kitchen is private');
  await expect(page.getByTestId('desk-casino-table')).toHaveCount(0);
  await alert.getByRole('button', { name: 'Back home', exact: true }).click();
  await expect(page.getByTestId('home-frame-oak')).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test('BUG-194: an action error after an admitted desktop snapshot preserves the table', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await visitingHousehold(page, { refused: false });
  await page.getByTestId('home-frame-oak').click();
  await expect(page.getByTestId('desk-casino-table')).toBeVisible();
  await expect(page.locator('.watch-felt__pot-amt')).toHaveText('$100');
  await page.evaluate(() => window.__activeWatch.push({ type: 'error', message: 'That action is not legal' }));
  await expect(page.getByTestId('desk-casino-table')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
