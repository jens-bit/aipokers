import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const now = Date.parse('2026-09-10T04:40:00Z');
const seats = [
  { displayName: 'Bal', identity: { hood: 'sand', glow: 'gold' } },
  { displayName: 'Granite', identity: { hood: 'moss', glow: 'gold' } },
  { displayName: 'River', identity: { hood: 'sand', glow: 'ember' } },
  { displayName: 'Bluff', identity: { hood: 'ash', glow: 'violet' } },
  { displayName: 'Clock', identity: { hood: 'moss', glow: 'ice' } },
];

async function household(page, { pot = 4180, net = 3694, since = now - 41 * 60000 } = {}) {
  const agents = ['Bal', 'Aggro'].map((name, i) => ({
    id: `away-${i}`, name, nature: { name: 'Rock' }, style: 'Balanced',
    mood: { state: 'neutral', heat: 40 }, fatigue: 'fresh',
    identity: i === 0 ? seats[0].identity : { hood: 'indigo', glow: 'violet' },
    stats: { handsPlayed: 40 }, pocket: { balance: 2000 }, sessionLog: [],
    want: null, opener: 'I am watching the hand.',
    routine: { key: 'shuffles', label: 'shuffling' },
    activeTableId: i === 0 ? 'casino-away' : null,
    location: { where: i === 0 ? 'table' : 'home', tableId: i === 0 ? 'casino-away' : null,
      room: i === 0 ? 'upstairs' : null, since },
    ...(i === 0 ? { liveGame: { tableId: 'casino-away', heroSeat: 0, blinds: '25/50',
      street: 'flop', board: ['Ah', 'Kd', '2c'], pot, net, seats, hot: true } } : {}),
  }));
  await page.clock.setFixedTime(new Date(now));
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', r => {
    const path = new URL(r.request().url()).pathname;
    const json = path === '/api/agents' ? { agents }
      : path === '/api/wallet' ? { balance: 54000, staked: 0, ledger: [] }
      : path === '/api/slots' ? { used: 2, cap: 4, next: null }
      : path.includes('/thread') ? { sessionId: 'home', lines: [], count: 0 }
      : path.includes('/study') ? { book: [], study: null, count: 0 }
      : path.endsWith('/memory') ? { memoryContext: '' }
      : { rooms: [], events: [], items: [], botUsername: '' };
    return r.fulfill({ json });
  });
  await page.addInitScript(({ agents }) => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
      initDataUnsafe: { user: { id: 4242 } }, get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    window.__awayFontSent = [];
    class Socket {
      constructor() { this.readyState = 0; this.listeners = {};
        setTimeout(() => { this.readyState = 1; this.dispatch('open', {}); }, 20); }
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
      removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter(x => x !== f); }
      dispatch(t, e) { (this.listeners[t] ?? []).forEach(f => f(e)); }
      emit(m) { this.dispatch('message', { data: JSON.stringify(m) }); }
      send(raw) {
        const m = JSON.parse(raw); window.__awayFontSent.push(m);
        if (m.type === 'floor_sub') this.emit({ type: 'home_state', userId: '4242', agents, game: null });
        if (m.type === 'watch') setTimeout(() => {
          const table = agents.find(a => a.id === m.agentId)?.liveGame;
          if (!table) return;
          this.emit({ type: 'watching', tableId: m.tableId, spectatorSeat: 0 });
          this.emit({ type: 'state', yourSeat: 0, legalActions: [], state: {
            tableId: m.tableId, handNumber: 2, street: table.street, pot: table.pot ?? 0,
            smallBlind: 25, bigBlind: 50, currentBet: 0, toAct: 1, community: table.board,
            seats: table.seats.map((s, i) => ({ ...s, playerId: `p${i}`, stack: 2000,
              holeCards: i === 0 ? ['9h', '9d'] : [] })),
          } });
        }, 20);
      }
      close() { this.readyState = 3; }
    }
    Socket.OPEN = 1; window.WebSocket = Socket;
  }, { agents });
  await page.goto('/');
  await expect(page.getByTestId('home-frame-away-0')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

async function typography(locator) {
  return locator.evaluate(e => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    return { text: e.textContent, family: s.fontFamily, size: s.fontSize, weight: s.fontWeight,
      tracking: s.letterSpacing, transform: s.textTransform, color: s.color,
      width: r.width, height: r.height, loaded: document.fonts.check(`${s.fontSize} ${s.fontFamily}`) }; });
}

for (const height of [844, 590]) {
  test(`BUG-188: current C7a away typography preserves Watch and control labels at390x${height}`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height }); await household(page);
    const frame = page.getByTestId('home-frame-away-0');
    const pot = await typography(frame.locator('.home-frame__pot'));
    const detail = await typography(frame.locator('.home-frame__line'));
    const name = await typography(frame.locator('.home-frame__name'));
    await mkdir(info.outputDir, { recursive: true });
    await writeFile(info.outputPath('metrics.json'), JSON.stringify({ height, pot, detail, name }, null, 2));
    await frame.screenshot({ path: info.outputPath('42-C7a-away-frame.png') });
    for (const key of ['pot', 'line', 'name']) await frame.locator(`.home-frame__${key}`).screenshot({ path: info.outputPath(`${key}.png`) });
    // Current source mood-home.jsx425/431: the numbers share Mono7.5,
    // while the agent's name retains its existing Inter8 sentence case.
    expect.soft(pot.family).toMatch(/JetBrains Mono/);
    expect.soft(detail.family).toMatch(/JetBrains Mono/);
    expect.soft(pot).toMatchObject({ text: '$4,180', size: '7.5px', weight: '700',
      tracking: 'normal', transform: 'none', color: 'rgb(205, 179, 128)', width: 27, height: 10, loaded: true });
    expect.soft(detail).toMatchObject({ text: '25/50 · +$3,694 · 41 min', size: '7.5px', weight: '400',
      tracking: 'normal', transform: 'none', color: 'rgb(0, 212, 170)', width: 116, height: 10, loaded: true });
    expect(name.family).toMatch(/Inter/);
    expect(name).toMatchObject({ text: 'Bal', size: '8px', weight: '400', transform: 'none', width: 116, height: 10 });
    // The one-pixel frame difference must resolve naturally with the face;
    // the product does not acquire a fixed height or extra spacing.
    await expect.soft(frame).toHaveCSS('height', '78px');
    await expect(frame).toHaveCSS('width', '132px');
    await expect(page.locator('.home-tv__caption')).toHaveCSS('font-family', /JetBrains Mono/);
    await expect(page.locator('.home-tv__caption')).toHaveCSS('font-size', '6.5px');
    await expect(page.locator('.home-flat__sign-word')).toHaveCSS('font-family', /Oswald/);
    await expect(page.locator('.home-flat__sign-word')).toHaveCSS('letter-spacing', '2.38px');
    await expect(page.locator('.home-flat__safe-balance')).toHaveCSS('font-family', /JetBrains Mono/);
    await expect(page.locator('.home-flat__safe-balance')).toHaveCSS('font-size', '11px');
    await expect(frame.locator('.home-frame__card')).toHaveCount(3);
    await page.screenshot({ path: info.outputPath(`home-${height}.png`) });
    await frame.click();
    await expect.poll(() => page.evaluate(() => window.__awayFontSent.filter(m => m.type === 'watch').map(m => ({
      tableId: m.tableId, agentId: m.agentId, userId: m.userId, displayName: m.displayName,
    })))).toEqual([{ tableId: 'casino-away', agentId: 'away-0', userId: '4242', displayName: 'Bal' }]);
    await expect(page.locator('.watch-felt')).toBeVisible();
  });
}

for (const sample of [
  { label: 'unknown values', values: { pot: null, net: null, since: null }, line: '25/50', color: 'rgb(0, 212, 170)' },
  { label: 'a real loss', values: { pot: 0, net: -95 }, line: '25/50 · −$95 · 41 min', color: 'rgb(255, 77, 79)' },
]) {
  test(`BUG-188: typography preserves ${sample.label} without inventing a pot`, async ({ page }) => {
    await household(page, sample.values);
    const frame = page.getByTestId('home-frame-away-0');
    await expect(frame.locator('.home-frame__pot')).toHaveCount(0);
    await expect(frame.locator('.home-frame__line')).toHaveText(sample.line);
    await expect(frame.locator('.home-frame__line')).toHaveCSS('color', sample.color);
    await expect(frame.locator('.home-frame__line')).toHaveCSS('font-family', /JetBrains Mono/);
    await expect(frame.locator('.home-frame__name')).toHaveText('Bal');
  });
}
