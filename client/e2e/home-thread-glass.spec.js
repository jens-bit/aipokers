import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

for (const height of [590, 844]) {
  test(`BUG-181: Home glass preserves the want, conversation and table taps at390x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const sent = [];
    const agent = { id: 'prof', name: 'Professor', nature: { name: 'Professor' },
      mood: { state: 'neutral', heat: 30 }, identity: { hood: 'indigo', glow: 'violet' },
      location: { where: 'home' }, routine: { key: 'paces', label: 'pacing' }, fatigue: 'fresh',
      pocket: { balance: 2000 }, stats: { handsPlayed: 0 }, sessionLog: [],
      opener: 'The house never folds. Fine by me.', want: { kind: 'deploy', text: 'I am fresh. Put me in.', needs: 'deploy' } };
    await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
    await page.route('**/api/**', route => {
      const p = new URL(route.request().url()).pathname;
      if (route.request().method() === 'POST') {
        sent.push({ path: p, body: route.request().postDataJSON() });
        return route.fulfill({ json: p.endsWith('/want') ? { answered: 'later', want: null } : { lines: [] } });
      }
      const body = p === '/api/agents' ? { agents: [agent] }
        : p === '/api/slots' ? { used: 1, cap: 4, next: null }
        : p === '/api/wallet' ? { balance: 54000, ledger: [] }
        : p.includes('/thread') ? { sessionId: 'today', lines: [{ id: 1, kind: 'him', who: 'Professor', from: 'prof', to: 'owner', source: 'home', text: agent.opener }] }
        : { rooms: [], items: [], events: [], book: [], study: null };
      return route.fulfill({ json: body });
    });
    await page.addInitScript(agent => {
      window.Telegram = { WebApp: { initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
        initDataUnsafe: { user: { id: 4242 } }, get viewportHeight() { return innerHeight; },
        ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
      class Socket {
        constructor() { this.readyState = 0; this.listeners = {}; setTimeout(() => { this.readyState = 1; this.emit('open', {}); }, 20); }
        addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
        removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter(x => x !== f); }
        emit(t, e) { for (const f of this.listeners[t] ?? []) f(e); }
        send(raw) { if (JSON.parse(raw).type === 'floor_sub') setTimeout(() => this.emit('message', { data: JSON.stringify({ type: 'home_state', userId: '4242', agents: [agent], game: { state: 'none' } }) }), 20); }
        close() { this.readyState = 3; }
      }
      Socket.OPEN = 1; Socket.prototype.OPEN = 1; window.WebSocket = Socket;
    }, agent);
    await page.goto('/');
    await expect(page.getByTestId('home-want')).toBeVisible();
    const line = page.getByTestId('home-thread-line'), band = page.locator('.home-thread__band');
    await expect(line).toContainText(agent.opener);
    await page.evaluate(() => document.fonts.ready);
    expect.soft(await band.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgba(13, 23, 21, 0.72)');
    expect.soft(await band.evaluate(e => getComputedStyle(e).backdropFilter)).toBe('blur(18px) saturate(1.2)');
    expect.soft(await band.evaluate(e => getComputedStyle(e).borderTopColor)).toBe('rgba(255, 255, 255, 0.17)');
    const box = await band.boundingBox(), composer = await page.locator('.home-thread__composer').boundingBox();
    expect(box).toMatchObject({ x: 0, width: 390, height: 76, y: height - 76 });
    expect(composer.height).toBe(36);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await expect(page.getByTestId('home-want')).toBeInViewport();
    await expect(page.getByText(agent.want.text, { exact: true })).toHaveCount(1);
    const out = fileURLToPath(new URL(`../../artifacts/bug181-browser-${process.env.BUG181_PHASE ?? 'run'}`, import.meta.url));
    mkdirSync(out, { recursive: true });
    await page.screenshot({ animations: 'disabled', path: `${out}/home-${height}.png` });
    await band.screenshot({ animations: 'disabled', path: `${out}/strip-${height}.png` });
    await page.getByTestId('home-want-later').click();
    await expect(page.getByTestId('home-want')).toHaveCount(0);
    expect(sent).toEqual([{ path: '/api/agents/prof/want', body: { userId: '4242', answer: 'later' } }]);
    await line.click();
    await expect(page.getByRole('dialog', { name: 'The room conversation' })).toBeVisible();
    await page.getByRole('button', { name: 'Close the thread', exact: true }).click();
    await page.getByTestId('home-thread-input').fill('One more hand.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1]).toMatchObject({ path: '/api/home/say', body: { userId: '4242', text: 'One more hand.' } });
    await page.getByTestId('home-table').click();
    await expect(page.getByTestId('home-table-sheet')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
