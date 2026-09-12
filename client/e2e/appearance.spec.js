import { test, expect } from '@playwright/test';
import { stub, CASTS } from './show-home-fixtures.js';
import { rooms, felts } from '../src/test/fixtures/rooms.js';
import { contrastOf } from './contrast.js';

// Actual routed components with API fixtures. These checks exercise the CSS
// cascade across lazy screens and sheets; they do not simulate an engine hand.
async function palette(page, mode) {
  await expect(page.locator('html')).toHaveAttribute('data-appearance', mode);
  expect(await page.evaluate(() => localStorage.getItem('railbird.home.appearance'))).toBe(mode);
}
async function ink(locator) {
  await expect(locator).toBeVisible();
  const values = await locator.evaluate(element => {
    const expected = document.createElement('i');
    expected.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text-primary');
    return { actual: getComputedStyle(element).color, expected: expected.style.color };
  });
  expect(values.actual).toBe(values.expected);
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  for (const mode of ['day', 'dusk', 'night']) test(`APPEARANCE: ${mode} follows Home, sheets, chat, profile and casino at ${viewport.width}`, async ({ page }, info) => {
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(request.method());
    });
    await page.setViewportSize(viewport);
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      const json = path === '/api/agents/a1' ? CASTS.alone.agents[0]
        : path.endsWith('/hands') ? { recentHands: [] }
        : path.endsWith('/flagged') ? { flaggedHands: [] }
        : path.endsWith('/attributes/log') ? { entries: [] }
        : path.endsWith('/session') ? { stats: {}, chat: [] }
        : {};
      return route.fulfill({ json });
    });
    await stub(page, CASTS.alone);
    await page.route('**/api/rooms**', route => route.fulfill({ json: { rooms } }));
    await page.addInitScript(() => localStorage.setItem('railbird.guide.v1:4242', JSON.stringify({ version: 1, seen: true })));
    await page.goto('/');
    const home = page.getByTestId('home-screen');
    await expect(home).toBeVisible();
    const body = home.locator('.home-one[data-agent="a1"]');
    await expect(body).toBeVisible();
    await page.getByRole('combobox', { name: 'Home appearance' }).selectOption(mode);
    await palette(page, mode);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath('home.png'), animations: 'disabled' });

    const desktop = viewport.width > 1100;
    await home.getByTestId('home-fridge').click();
    const fridge = page.getByTestId('home-fridge-sheet');
    await expect(fridge.getByTestId('fridge-shelf-beer')).toContainText('× 4');
    await palette(page, mode);
    await page.screenshot({ path: info.outputPath('fridge.png'), animations: 'disabled' });
    await (desktop ? page.getByRole('button', { name: 'Close panel', exact: true }) : fridge.locator('.home-sheet__head').getByRole('button', { name: 'Close', exact: true })).click();
    await expect(fridge).toHaveCount(0);

    await home.getByTestId('home-safe').click();
    const safe = page.getByTestId('safe-sheet');
    await expect(safe).toBeVisible();
    await palette(page, mode);
    await page.screenshot({ path: info.outputPath('safe.png'), animations: 'disabled' });
    await (desktop ? page.getByRole('button', { name: 'Close panel', exact: true }) : safe.locator('.safe__scrim')).click({ position: { x: 5, y: 5 } });
    await expect(safe).toHaveCount(0);

    await body.click();
    const chat = page.getByRole('region', { name: "The Clock's room", exact: true });
    await expect(chat).toBeVisible();
    await ink(chat);
    const draft = chat.getByPlaceholder('Whisper to him…', { exact: true });
    await draft.fill('Keep this while I look at your profile.');
    await page.screenshot({ path: info.outputPath('private-chat.png'), animations: 'disabled' });
    await chat.getByRole('button', { name: 'Profile', exact: true }).click();
    const profile = page.locator('.profile-overview');
    await expect(profile).toBeVisible();
    await expect(profile.locator('.agent-view__name')).toHaveText('The Clock');
    await ink(profile.locator('.agent-view__name'));
    await palette(page, mode);
    await page.screenshot({ path: info.outputPath('profile.png'), animations: 'disabled' });
    await profile.getByRole('button', { name: 'Back to chat', exact: true }).click();
    await expect(draft).toHaveValue('Keep this while I look at your profile.');
    await chat.getByRole('button', { name: desktop ? 'Close panel' : 'Back', exact: true }).click();
    await expect(home).toBeVisible();
    // The floor can render from REST before its socket opens. Answer its
    // actual subscription, as the server does, instead of pushing once to
    // whichever Home sockets happen to be open at that moment.
    await page.evaluate(tables => {
      const frame = { data: JSON.stringify({ type: 'room_tables', tables, rooms: Object.fromEntries(tables.map(table => [table.tableId, table.room])) }) };
      const send = window.WebSocket.prototype.send;
      window.WebSocket.prototype.send = function (raw) {
        send.call(this, raw);
        if (JSON.parse(raw).type === 'floor_sub') queueMicrotask(() => this.dispatch('message', frame));
      };
      window.__homeSockets.filter(socket => socket.readyState === 1 && socket.sent?.some(message => message.type === 'floor_sub'))
        .forEach(socket => socket.dispatch('message', frame));
    }, felts);
    await home.getByTestId('home-door').click();
    const floor = page.getByTestId('floor-view');
    await expect(floor).toBeVisible();
    await expect(floor.getByTestId('the-floor')).toBeVisible();
    await palette(page, mode);
    const firstLiveRow = floor.locator('.csn-live__row').first();
    const contrastTargets = [
      ['board player names', firstLiveRow.getByText('Ozymandias, The Grinder', { exact: true })],
      ['board stakes', firstLiveRow.getByText('$10/$20', { exact: true })],
      ['board empty history', floor.getByText('Nothing has finished tonight yet.', { exact: true })],
    ];
    const captions = floor.locator('.csn-felt58__stake');
    await expect(captions).toHaveCount(felts.length);
    for (let i = 0; i < felts.length; i++) contrastTargets.push([`table ${i + 1} stakes`, captions.nth(i)]);
    if (desktop) {
      const header = page.locator('.dsk-top--room');
      contrastTargets.push(
        ['desktop room title', header.locator('h1')],
        ['desktop room details', header.locator('.dsk-top__room p')],
        ['desktop back control', header.getByRole('button', { name: 'Back home', exact: true })],
        ['desktop active floor control', header.getByRole('button', { name: 'Floor', exact: true })],
      );
    }
    const contrast = [];
    for (const [label, target] of contrastTargets) {
      await expect(target).toBeVisible();
      contrast.push({ label, minimum: 4.5, ...await contrastOf(target) });
    }
    await info.attach('casino-contrast', { body: JSON.stringify({ mode, viewport, contrast }, null, 2), contentType: 'application/json' });
    for (const reading of contrast) expect.soft(reading.contrast, `${mode} ${reading.label}: ${JSON.stringify(reading)}`).toBeGreaterThanOrEqual(reading.minimum);
    await page.screenshot({ path: info.outputPath('casino.png'), animations: 'disabled' });
    await (desktop ? page.locator('.dsk-top--room') : floor).getByRole('button', { name: 'Back home', exact: true }).click();
    await expect(home).toBeVisible();
    await page.reload();
    await expect(home).toBeVisible();
    await palette(page, mode);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    expect(writes, 'appearance and reading never send messages, buy items or deploy').toEqual([]);
    expect(errors).toEqual([]);
  });
}
