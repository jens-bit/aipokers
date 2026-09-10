import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// BUG-180: Board 29 F01's sole first-agent action has authored Oswald lettering.
// Check the real Home cascade and tap, with local API/socket fixtures only.
async function emptyHome(page) {
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', r => {
    const path = new URL(r.request().url()).pathname;
    const json = path === '/api/agents' ? { agents: [] }
      : path === '/api/wallet' ? { balance: 54000, staked: 0, ledger: [] }
      : path === '/api/slots' ? { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } }
      : path === '/api/agents/draft' ? { draftId: 'first-action', draftStep: 'briefing', ready: false,
        chat: [{ role: 'assistant', content: 'Tell me how he should play.' }] }
      : path === '/api/auth/config' ? { botUsername: '' }
      : path === '/api/rooms' ? { rooms: [], hotWindowMs: 20000 }
      : path.endsWith('/thread') ? { sessionId: 'empty-home', lines: [], count: 0 }
      : { events: [], lastId: 0, items: [] };
    return r.fulfill({ json });
  });
  await page.addInitScript(() => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
      initDataUnsafe: { user: { id: 4242, first_name: 'Synthetic' } },
      get viewportHeight() { return window.innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    class Socket {
      static OPEN = 1;
      constructor() { this.readyState = 0; this.listeners = {};
        setTimeout(() => { this.readyState = 1; this.emit('open', {}); }, 20); }
      emit(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      send(raw) { if (JSON.parse(raw).type === 'floor_sub') this.emit('message', {
        data: JSON.stringify({ type: 'home_state', userId: '4242', agents: [], game: null }),
      }); }
      close() { this.readyState = 3; }
    }
    Socket.prototype.OPEN = 1; window.WebSocket = Socket;
  });
  await page.goto('/');
  await expect(page.getByTestId('home-ftu')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const height of [844, 590]) {
  test(`BUG-180: F01 first-agent lettering and draft tap at 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    await emptyHome(page);
    const action = page.getByRole('button', { name: 'DRAFT YOUR FIRST AGENT', exact: true });
    await expect.soft(action).toHaveCSS('font-family', /Oswald/);
    await expect.soft(action).toHaveCSS('letter-spacing', '1.1px');
    await expect(action).toHaveCSS('font-size', '11px');
    await expect(action).toHaveCSS('font-weight', '600');
    await expect(page.locator('.home1__ftu-line')).toHaveCSS('font-family', /Inter/);
    const box = await action.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await mkdir(testInfo.outputDir, { recursive: true });
    await page.screenshot({ path: testInfo.outputPath('29-F01.png') });
    await action.screenshot({ path: testInfo.outputPath('29-F01-action.png') });
    await action.click();
    await expect(page.getByTestId('draft-screen')).toBeVisible();
    await expect(page.getByText('Tell me how he should play.', { exact: true })).toBeVisible();
  });
}
