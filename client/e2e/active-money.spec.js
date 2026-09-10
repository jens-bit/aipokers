import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { playingAgent } from '../src/test/fixtures/agents.js';
import { midHandGame } from '../src/test/fixtures/game.js';

// Actual app routes/taps and native Swedish formatting; data and sockets are
// controlled local fixtures. This is not a server/auth or pacing playtest.
test.use({ locale: 'sv-SE', isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

async function fixture(page, net) {
  const agent = { ...playingAgent, nature: { name: 'Grinder' },
    location: { where: 'table', tableId: midHandGame.tableId, room: 'floor' },
    careerStats: { ...playingAgent.careerStats, net } };
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = path === '/api/agents' ? { agents: [agent] }
      : path === '/api/auth/config' ? { botUsername: '' }
      : path === '/api/wallet' ? { balance: 12500.5, ledger: [] }
      : path === '/api/slots' ? { used: 1, cap: 4, next: null }
      : path === '/api/events' ? { events: [], lastId: 0 }
      : path === '/api/rooms' ? { rooms: [] }
      : path.endsWith('/flagged') ? { flaggedHands: [] }
      : path.endsWith('/hands') ? { recentHands: [] }
      : path.endsWith('/study') ? { study: null, book: [], count: 0 }
      : path.includes('/thread') ? { sessionId: 'money-thread', lines: [], count: 0 }
      : {};
    return route.fulfill({ json });
  });
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.addInitScript(({ agent, game }) => {
    window.Telegram = { WebApp: { initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
      initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
      get viewportHeight() { return innerHeight; }, ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    window.__moneySent = [];
    window.__moneySockets = [];
    class MoneySocket {
      constructor(url) {
        this.url = url; this.readyState = 0; this.listeners = {};
        window.__moneySockets.push(this);
        setTimeout(() => { this.readyState = 1; this.dispatch('open', {}); }, 20);
      }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      dispatch(type, value) { for (const fn of this.listeners[type] ?? []) fn(value); }
      message(value) { this.dispatch('message', { data: JSON.stringify(value) }); }
      send(raw) {
        const msg = JSON.parse(raw); window.__moneySent.push(msg);
        if (msg.type === 'floor_sub') setTimeout(() => this.message({ type: 'home_state', userId: '4242', agents: [agent], game: { state: 'none' } }), 20);
        if (msg.type === 'watch') setTimeout(() => {
          this.message({ type: 'watching', spectatorSeat: 0 });
          this.message({ type: 'state', state: game, legalActions: [] });
          this.message({ type: 'decision', seat: 0, action: { type: 'bet', amount: 12500.5 } });
        }, 20);
      }
      close() { this.readyState = 3; }
    }
    MoneySocket.OPEN = 1; MoneySocket.prototype.OPEN = 1; window.WebSocket = MoneySocket;
  }, { agent, game: midHandGame });
}

for (const [width, height, net] of [[1440, 900, 12500.5], [1440, 900, -12500.5], [390, 590, 12500.5], [390, 844, 12500.5]]) {
  test(`BUG-37: native money after real ${width > 1000 ? 'Standup and Watch' : 'TV Watch'} taps at ${width}x${height}, net ${net}`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await fixture(page, net); await page.goto('/');
    await expect(page.getByTestId('home-tv')).toBeVisible();
    expect(await page.evaluate(() => (12500.5).toLocaleString())).toBe('12\u00a0500,5');
    const out = `../artifacts/bug37-active-browser-${process.env.BUG37_PHASE ?? 'run'}`;
    mkdirSync(out, { recursive: true });
    const tag = `${width}-${height}-${net < 0 ? 'loss' : 'win'}`;
    if (width > 1000) {
      const expected = net < 0 ? '−$12,500.50' : '+$12,500.50';
      await expect(page.locator('.dsk-top__result strong')).toContainText('$');
      expect.soft(await page.locator('.dsk-top__result strong').textContent()).toBe(expected);
      await page.getByRole('button', { name: 'Standup — all-time result' }).click();
      await expect(page.locator('.dsk-panel .dsk-roster-row__pnl')).toBeVisible();
      expect.soft(await page.locator('.dsk-panel .dsk-roster-row__pnl').textContent()).toBe(expected);
      await page.locator('.dsk-panel .dsk-roster-row__pnl').scrollIntoViewIfNeeded();
      await expect(page.locator('.dsk-panel .dsk-roster-row__pnl')).toBeInViewport();
      await page.screenshot({ path: `${out}/${tag}-standup.png` });
      await page.getByRole('button', { name: 'WATCH →', exact: true }).click();
    } else {
      await page.getByTestId('home-tv').click();
    }
    await expect(page.locator('.watch-felt__action-chip')).toBeVisible();
    expect.soft(await page.locator('.watch-felt__action-chip').textContent()).toBe('BET $12,500.50');
    expect(await page.evaluate(() => window.__moneySent.find(msg => msg.type === 'watch').tableId)).toBe(midHandGame.tableId);
    await page.screenshot({ path: `${out}/${tag}-bet.png` });
    await page.evaluate(() => {
      for (const socket of window.__moneySockets) if (socket.readyState === 1)
        socket.message({ type: 'decision', seat: 0, action: { type: 'raise', amount: 25000 } });
    });
    await expect(page.locator('.watch-felt__action-chip')).toContainText('RAISE');
    expect.soft(await page.locator('.watch-felt__action-chip').textContent()).toBe('RAISE $25,000');
    await page.screenshot({ path: `${out}/${tag}-raise.png` });
    expect(errors).toEqual([]);
  });
}
