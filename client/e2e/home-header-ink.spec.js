import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const resident = { id: 'bal', name: 'Balanced v2.1', nickname: 'Bal',
  nature: { name: 'Rock' }, identity: { hood: 'indigo', glow: 'violet' },
  mood: { state: 'neutral', heat: 20 }, fatigue: 'fresh',
  routine: { key: 'reads', label: 'reading' }, location: { where: 'home' },
  activeTableId: null, pocket: { balance: 2000 }, sessionLog: [] };
const playing = id => ({ ...resident, id, name: `Player ${id}`, routine: null,
  location: { where: 'casino', tableId: `table-${id}`, room: 'upstairs' }, activeTableId: `table-${id}`,
  liveGame: { tableId: `table-${id}`, board: [], pot: 0, seats: [] } });

async function household(page, hold = false) {
  let agents = [resident], release;
  const ready = hold ? new Promise(r => { release = r; }) : Promise.resolve();
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async r => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/api/agents') await ready;
    return r.fulfill({ json: path === '/api/agents' ? { agents }
      : path === '/api/wallet' ? { balance: 54000, ledger: [] }
      : path === '/api/slots' ? { used: agents.length, cap: 4, next: null }
      : path.includes('/thread') ? { sessionId: 'today', lines: [] }
      : path.includes('/study') ? { study: null, book: [], count: 0 }
      : { rooms: [], events: [], items: [], lastId: 0 } });
  });
  await page.addInitScript(() => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
      initDataUnsafe: { user: { id: 4242 } }, get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    const sockets = [];
    class Socket {
      constructor() { this.readyState = 0; this.listeners = {}; sockets.push(this);
        setTimeout(() => { this.readyState = 1; this.emit('open', {}); }, 20); }
      emit(type, event) { for (const f of this.listeners[type] ?? []) f(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(v => v !== fn); }
      close() { this.readyState = 3; } send() {}
    }
    Socket.OPEN = 1; Socket.prototype.OPEN = 1; window.WebSocket = Socket;
    window.__headerHomeState = agents => sockets.filter(s => s.readyState === 1).forEach(s =>
      s.emit('message', { data: JSON.stringify({ type: 'home_state', userId: '4242', agents, game: null }) }));
  });
  await page.goto('/'); await expect(page.getByTestId('room-header')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return { release: () => release?.(), update: async next => {
    agents = next; await page.evaluate(a => window.__headerHomeState(a), next);
  } };
}

async function headerMetrics(header) {
  return header.evaluate(el => {
    const read = selector => {
      const node = el.querySelector(selector), style = getComputedStyle(node), r = node.getBoundingClientRect();
      return { text: node.textContent, color: style.color, background: style.backgroundColor,
        font: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight,
        width: r.width, height: r.height, x: r.x, y: r.y };
    };
    const pseudo = getComputedStyle(el.querySelector('.room-header__roster'), '::before');
    return { subtitle: read('.room-header__sub'), quietText: read('.room-header__live > span'),
      dot: read('.room-header__live > i'), live: read('.room-header__live'), roster: read('.room-header__roster'),
      headerHeight: el.getBoundingClientRect().height,
      target: { top: pseudo.top, left: pseudo.left, right: pseudo.right, bottom: pseudo.bottom,
        width: pseudo.width, height: pseudo.height } };
  });
}

for (const height of [844, 590]) {
  test(`BUG-195: Home subtitle and known-zero text use authored muted ink at 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height }); await household(page);
    const header = page.getByTestId('room-header');
    await expect(header.locator('.room-header__sub')).toHaveText('1 home');
    await expect(header.locator('.room-header__live > span')).toHaveText('NOBODY LIVE');
    const metrics = await headerMetrics(header);
    await mkdir(testInfo.outputDir, { recursive: true });
    await writeFile(testInfo.outputPath('header-metrics.json'), JSON.stringify(metrics, null, 2));
    await header.screenshot({ animations: 'disabled', path: testInfo.outputPath('home-header.png') });
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('home.png') });
    expect.soft(metrics.subtitle.color).toBe('rgb(158, 158, 162)');
    expect.soft(metrics.quietText.color).toBe('rgb(158, 158, 162)');
    expect(metrics.dot.background).toBe('rgb(107, 107, 107)');
    expect(metrics.headerHeight).toBe(46);
    expect(metrics.live.height).toBe(19);
    expect(metrics.roster.width).toBe(30); expect(metrics.roster.height).toBe(30);
    expect(metrics.subtitle.fontSize).toBe('9.5px'); expect(metrics.quietText.fontSize).toBe('8.5px');
    expect(metrics.target).toMatchObject({ top: '-7px', left: '-7px', right: '-7px', bottom: '-7px' });
  });

  test(`BUG-195: unknown zero and live counts keep their separate usable roster control at 390x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height }); const state = await household(page, true);
    const header = page.getByTestId('room-header'), button = header.getByRole('button', { name: 'Your agents', exact: true });
    await expect(header.locator('.room-header__sub')).toHaveText('Reading the room…');
    await expect(header.locator('.room-header__live')).toHaveCount(0);
    await expect(button).toBeVisible();
    state.release(); await expect(header.getByText('NOBODY LIVE', { exact: true })).toBeVisible();
    // The drawn30px circle retains its existing pseudo hit area, including this point outside its border.
    const r = await button.boundingBox();
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.getAttribute('aria-label'),
      { x: r.x - 5, y: r.y + r.height / 2 })).toBe('Your agents');
    await page.mouse.click(r.x - 5, r.y + r.height / 2);
    await expect(page.getByRole('dialog', { name: 'Your agents' })).toBeVisible();
    await page.locator('.roster__close').click();
    await expect(page.getByRole('dialog', { name: 'Your agents' })).toHaveCount(0);
    await state.update([resident, playing('oak')]);
    await expect(header.getByText('1 AGENT LIVE', { exact: true })).toBeVisible();
    await state.update([resident, playing('oak'), playing('plum')]);
    await expect(header.getByText('2 AGENTS LIVE', { exact: true })).toBeVisible();
    await expect(header.locator('.room-header__sub')).toHaveText('2 at the casino · 1 home');
    await expect(header.locator('.room-header__live > span')).toHaveCSS('color', 'rgb(0, 212, 170)');
    await expect(header.locator('.room-header__live > i')).toHaveCSS('background-color', 'rgb(0, 212, 170)');
    expect(await header.locator('.room-header__live').evaluate(e => e.closest('button'))).toBeNull();
    await button.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Your agents' })).toBeVisible();
    await page.locator('.roster__close').click(); await expect(button).toBeVisible();
    await expect(header).toHaveCSS('height', '46px');
  });
}

test('BUG-195: the exact Home text selectors leave other header ink and long-subtitle geometry alone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await household(page);
  await expect(page.getByText('NOBODY LIVE', { exact: true })).toBeVisible();
  // Stylesheet isolation/stress probes, not additional product screens or invented live data.
  const metrics = await page.getByTestId('room-header').evaluate(el => {
    return [false, true].map(home => {
      const wrapper = document.createElement('div'); wrapper.className = home ? 'home1' : 'outside-home';
      wrapper.style.cssText = 'position:fixed;top:-200px;left:0;width:390px;height:46px';
      const clone = el.cloneNode(true); wrapper.append(clone); document.body.append(wrapper);
      const subtitle = clone.querySelector('.room-header__sub');
      subtitle.textContent = 'A deliberately long location subtitle that must retain the existing single-line ellipsis';
      const s = getComputedStyle(subtitle), rect = clone.getBoundingClientRect();
      const result = { subtitle: s.color, quiet: getComputedStyle(clone.querySelector('.room-header__live > span')).color,
        height: rect.height, whitespace: s.whiteSpace, overflow: s.overflow, ellipsis: s.textOverflow,
        textWiderThanBox: subtitle.scrollWidth > subtitle.clientWidth };
      wrapper.remove(); return result;
    });
  });
  expect(metrics).toEqual([
    { subtitle: 'rgb(136, 136, 136)', quiet: 'rgb(107, 107, 107)',
      height: 46, whitespace: 'nowrap', overflow: 'hidden', ellipsis: 'ellipsis', textWiderThanBox: true },
    { subtitle: 'rgb(158, 158, 162)', quiet: 'rgb(158, 158, 162)',
      height: 46, whitespace: 'nowrap', overflow: 'hidden', ellipsis: 'ellipsis', textWiderThanBox: true },
  ]);
});
