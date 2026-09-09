import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// BUG-166: rendered Home pills, not an imitation of the component. API/socket
// fixtures keep this visual check local and preserve served resource values.
const agents = [
  ['Balanced', 'Bal', 'ash', 'teal', 14],
  ['Professor', 'Prof', 'indigo', 'violet', 58],
  ['Wild Card', 'Wild C', 'moss', 'lime', 81],
  ['Loose Cannon', 'Loose', 'oxblood', 'ember', 30],
].map(([name, nickname, hood, glow, heat], index) => ({
  id: `pill-${index}`, name, nickname, identity: { hood, glow },
  style: 'Balanced', risk: 'Medium', nature: { name: 'Rock' },
  mood: { state: 'neutral', heat }, fatigue: 'fresh',
  location: { where: 'home', tableId: null, room: null, since: 1700000000000 },
  routine: { key: 'plays', label: 'in a hand' },
  unseenRecap: false, want: index === 3 ? {
    kind: 'deploy', text: "I'm fresh and I'm sat here doing nothing. Put me in.", needs: 'deploy',
  } : null,
  opener: 'Sit down. What do you want to know?', activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 }, careerStats: { hands: 140, sessions: 4, net: 1200 }, sessionLog: [],
}));
const game = { state: 'running', tableId: 'home-4242',
  seats: agents.map((a, seat) => ({ seat, agentId: a.id, name: a.name, house: false })) };

async function room(page) {
  await page.route('https://telegram.org/**', r => r.fulfill({body: '', contentType: 'application/javascript'}));
  await page.route('**/api/**', r => {
    const path = new URL(r.request().url()).pathname;
    const json = path === '/api/agents' ? { agents }
      : path === '/api/wallet' ? { balance: 12000, ledger: [] }
      : path === '/api/slots' ? { used: 4, cap: 4, next: null }
      : path === '/api/fridge' ? { items: [] }
      : path === '/api/events' ? { events: [], lastId: 0 }
      : path === '/api/rooms' ? { rooms: [], hotWindowMs: 20000 }
      : path === '/api/auth/config' ? { botUsername: '' }
      : path.endsWith('/study') ? { study: null, book: [], count: 0 }
      : path.endsWith('/thread') ? { sessionId: 'pill', count: 0, lines: [] }
      : path === '/api/stats' ? { activeAgents: 0, totalAgents: 4 } : {};
    return r.fulfill({json});
  });
  await page.addInitScript(({ agents, game }) => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
      initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
      get viewportHeight() { return window.innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    }};
    class Socket {
      static OPEN = 1;
      constructor() {
        this.readyState = 0; this.listeners = {};
        setTimeout(() => { this.readyState = 1; this.emit('open', {});
          this.emit('message', { data: JSON.stringify({ type: 'home_state', userId: '4242', agents, game }) });
        }, 30);
      }
      emit(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      send() {} close() { this.readyState = 3; }
    }
    Socket.prototype.OPEN = 1; window.WebSocket = Socket;
  }, { agents, game });
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.locator('.home-one[data-agent="pill-0"]')).toHaveAttribute('data-walking', 'false');
  await page.evaluate(() => document.fonts.ready);
}

for (const height of [844, 590]) {
  test(`BUG-166: neutral compact Home names preserve identities, bars and taps at 390x${height}`, async ({page}) => {
    await page.setViewportSize({width: 390, height});
    await room(page);
    const boxes = [];
    for (const agent of agents) {
      const body = page.locator(`.home-one[data-agent="${agent.id}"]`);
      const pill = body.locator('.home-pill');
      const name = pill.locator('.home-pill__name');
      await expect(name).toHaveCSS('color', 'rgb(237, 237, 237)');
      await expect(name).toHaveCSS('font-size', '8.5px');
      expect((await name.textContent()).length).toBeLessThanOrEqual(6);
      await expect(body.locator('.mood-ghost')).toHaveAttribute('data-hood', agent.identity.hood);
      await expect(pill.locator('[data-bar="stamina"]')).toHaveCSS('width', '44px');
      await expect(pill.locator('[data-bar="stamina"] i')).toHaveAttribute('style', /width: 100%/);
      await expect(pill.locator('[data-bar="heat"] i')).toHaveAttribute('style', new RegExp(`width: ${agent.mood.heat}%`));
      const p = await pill.boundingBox(), n = await name.boundingBox();
      expect(n.x).toBeGreaterThanOrEqual(p.x);
      expect(n.x + n.width).toBeLessThanOrEqual(p.x + p.width);
      expect(n.y + n.height).toBeLessThanOrEqual(p.y + p.height);
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x + p.width).toBeLessThanOrEqual(390);
      boxes.push(await body.boundingBox());
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
    }
    const artifacts = new URL('../../artifacts/', import.meta.url);
    await mkdir(artifacts, {recursive: true});
    await page.screenshot({path: new URL(`bug166-home-390x${height}.png`, artifacts).pathname.replace(/^\/(\w:)/, '$1')});
    if (height === 844) await page.locator('.home-one[data-agent="pill-0"] .home-pill').screenshot({path: new URL('bug166-pill-actual.png', artifacts).pathname.replace(/^\/(\w:)/, '$1')});
    const felt = await page.getByTestId('home-table').boundingBox();
    await page.mouse.click(felt.x + felt.width / 2, felt.y + felt.height / 2);
    const table = page.getByTestId('home-table-sheet-mobile');
    await expect(table).toBeVisible();
    await table.getByRole('button', {name: 'Close', exact: true}).last().click();
    await expect(page.getByText(agents[3].want.text, {exact: true})).toHaveCount(1);
    await page.locator('.home-one[data-agent="pill-0"] .home-pill__name').click();
    await expect(page.locator('.agent-view')).toBeVisible();
    await page.getByRole('button', {name: 'Back', exact: true}).click();
    await page.getByRole('button', {name: 'Your agents', exact: true}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}
