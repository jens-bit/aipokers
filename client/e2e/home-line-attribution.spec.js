import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

for (const height of [590, 844]) {
  test(`BUG-174: recap, owner send and room history retain the real speaker at 390x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height });
    const agents = ['Granite', 'Bluff'].map((name, i) => ({
      id: `speaker-${i}`, name, nature: { name: i ? 'Hothead' : 'Rock' },
      style: 'Balanced', risk: 'Medium', mood: { state: 'neutral', heat: 40 },
      identity: { hood: i ? 'oxblood' : 'sand', glow: 'gold' }, fatigue: 'fresh',
      location: { where: 'home' }, routine: { key: 'reads', label: 'reading' },
      pocket: { balance: 2000 }, stats: { handsPlayed: 40 }, sessionLog: [],
      opener: 'No need to rush.', unseenRecap: i === 0,
      sessionRecap: i === 0 ? { text: 'Quiet night. Nothing to report.' } : null,
    }));
    let sentRoute;
    await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/home/say') { sentRoute = route; return; }
      const body = path === '/api/agents' ? { agents }
        : path === '/api/slots' ? { cap: 4, used: 2, next: null }
        : path === '/api/wallet' ? { balance: 54000, ledger: [] }
        : path.includes('/thread') ? { sessionId: 'today', lines: [
          { id: 1, kind: 'him', who: 'Bluff', text: 'I folded the river.', ts: 1 },
        ] }
        : path === '/api/auth/config' ? { botUsername: '' }
        : path.endsWith('/flagged') ? { flaggedHands: [] }
        : path.endsWith('/hands') ? { recentHands: [] }
        : { items: [], events: [], rooms: [] };
      return route.fulfill({ json: body });
    });
    await page.addInitScript(agents => {
      window.Telegram = { WebApp: {
        initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
        initDataUnsafe: { user: { id: 4242 } }, get viewportHeight() { return innerHeight; },
        ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
      } };
      const sockets = [];
      class Socket {
        constructor() { this.readyState = 0; this.listeners = {}; sockets.push(this); setTimeout(() => { this.readyState = 1; this.dispatch('open', {}); }, 20); }
        addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
        removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
        dispatch(type, event) { (this.listeners[type] ?? []).forEach(fn => fn(event)); }
        emit(data) { this.dispatch('message', { data: JSON.stringify(data) }); }
        send(raw) { if (JSON.parse(raw).type === 'floor_sub') { this.floor = true; this.emit({ type: 'home_state', userId: '4242', agents, game: null }); } }
        close() { this.readyState = 3; }
      }
      Socket.OPEN = 1; window.WebSocket = Socket;
      window.__clearRecap = () => sockets.filter(s => s.floor).forEach(s => s.emit({
        type: 'home_state', userId: '4242', agents: agents.map(a => ({ ...a, unseenRecap: false })), game: null,
      }));
    }, agents);
    await page.goto('/');
    const line = page.getByTestId('home-thread-line');
    await expect(line.locator('.home-thread__text')).toHaveText('Quiet night. Nothing to report.');
    await line.click();
    await expect(page.getByTestId('home-thread-rows')).toContainText('I folded the river.');
    await expect(line.locator('.home-thread__who')).toHaveText('Granite');
    await page.getByRole('button', { name: 'Close the thread', exact: true }).click();
    await page.getByTestId('home-thread-input').fill('That was close.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(line.locator('.home-thread__who')).toHaveText('YOU');
    await expect(line.locator('.home-thread__text')).toHaveText('That was close.');
    await expect.poll(() => !!sentRoute).toBe(true);
    await sentRoute.fulfill({ status: 503, json: { error: 'Synthetic refusal' } });
    await expect(page.getByTestId('home-thread-input')).toHaveValue('That was close.');
    await expect(line.locator('.home-thread__who')).toHaveText('Granite');
    await expect(line.locator('.home-thread__text')).toHaveText('Quiet night. Nothing to report.');
    await page.evaluate(() => window.__clearRecap());
    await expect(line.locator('.home-thread__who')).toHaveText('Bluff');
    await expect(line.locator('.home-thread__text')).toHaveText('I folded the river.');
    await line.click();
    await expect(page.getByRole('dialog', { name: 'The room conversation' })).toBeVisible();
    await page.getByRole('button', { name: 'Close the thread', exact: true }).click();
    await expect(page.getByTestId('home-table')).toBeVisible();
    await page.screenshot({ path: fileURLToPath(new URL(`../../artifacts/bug174-home-${height}.png`, import.meta.url)) });
  });
}
