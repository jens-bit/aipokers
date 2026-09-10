import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// BUG-183: real Home footer/composer with local owner-thread fixtures.
async function emptyHome(page) {
  const lines = [];
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', r => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/api/home/say') {
      const { text } = r.request().postDataJSON();
      lines.push({ id: 1, kind: 'you', from: 'owner', who: 'YOU', text, ts: Date.now() });
      return r.fulfill({ json: { sessionId: 'empty-home', said: text, home: 0, replies: [], pending: [] } });
    }
    const json = path === '/api/agents' ? { agents: [] }
      : path === '/api/wallet' ? { balance: 54000, staked: 0, ledger: [] }
      : path === '/api/slots' ? { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } }
      : path === '/api/auth/config' ? { botUsername: '' }
      : path === '/api/rooms' ? { rooms: [], hotWindowMs: 20000 }
      : path.endsWith('/thread') ? { sessionId: 'empty-home', lines, count: lines.length }
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
  test(`BUG-183: authored empty system footer and actual conversation taps at 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    await emptyHome(page);
    const line = page.getByTestId('home-thread-line');
    const text = line.locator('.home-thread__text');
    const appearance = await text.evaluate(el => {
      const style = getComputedStyle(el);
      return { text: el.textContent, fontSize: style.fontSize, fontStyle: style.fontStyle,
        color: style.color, who: el.parentElement.querySelector('.home-thread__who')?.textContent ?? null };
    });
    expect.soft(appearance).toEqual({ text: 'The room is yours. It is empty.', fontSize: '11px',
      fontStyle: 'italic', color: 'rgb(158, 158, 162)', who: null });
    const composer = page.locator('.home-thread__composer');
    await expect(composer).toHaveCSS('height', '36px');
    const box = await composer.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await mkdir(testInfo.outputDir, { recursive: true });
    await page.screenshot({ path: testInfo.outputPath('29-F01.png') });
    await page.locator('.home-thread__band').screenshot({ path: testInfo.outputPath('29-F01-footer.png') });
    await line.click();
    await expect(page.getByRole('dialog', { name: 'The room conversation' })).toBeVisible();
    await page.getByRole('button', { name: 'Close the thread', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'The room conversation' })).toHaveCount(0);
    await page.getByTestId('home-thread-input').fill('Anyone there?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(line.locator('.home-thread__who')).toHaveText('YOU');
    await expect(text).toHaveText('Anyone there?');
    await expect(text).toHaveCSS('font-style', 'normal');
    await line.click();
    await expect(page.getByTestId('home-thread-rows')).toContainText('Anyone there?');
  });
}
