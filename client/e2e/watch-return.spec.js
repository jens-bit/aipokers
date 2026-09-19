import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let child, ready, scratch, sequence = 0, output = '';
const calls = new Map();
const rpc = method => new Promise((resolve, reject) => {
  const id = ++sequence; calls.set(id, { resolve, reject }); child.send({ id, method });
});
test.beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-watch-return-browser-'));
  child = fork(fileURLToPath(new URL('./fixtures/watchReturnServer.mjs', import.meta.url)), [], { cwd: scratch, execArgv: [], silent: true });
  child.stdout.on('data', data => { output = (output + data).slice(-5000); });
  child.stderr.on('data', data => { output = (output + data).slice(-5000); });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => { if (!ready) reject(new Error(`Return fixture exit ${code}: ${output}`)); });
    child.on('message', message => {
      if (message.event === 'ready') { ready = message; resolve(); }
      else { const call = calls.get(message.id); calls.delete(message.id);
        if (message.error) call?.reject(new Error(message.error)); else call?.resolve(message.result); }
    });
  });
});
test.afterAll(async () => {
  const exited = new Promise(resolve => child.once('exit', resolve));
  await rpc('stop'); await exited;
  expect(path.dirname(path.resolve(scratch))).toBe(path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function connect(page) {
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/config') return route.fulfill({ json: { botUsername: '' } });
    if (url.pathname === '/api/rooms') return route.fulfill({ json: { rooms: [], hotWindowMs: 20000 } });
    if (url.pathname === '/api/events') return route.fulfill({ json: { events: [], lastId: 0 } });
    if (url.pathname === '/api/stats') return route.fulfill({ json: { totalAgents: 1, handsPlayedToday: 1 } });
    const response = await route.fetch({ url: `${ready.backend}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.addInitScript(({ owner, credential, backend }) => {
    window.Telegram = { WebApp: { initData: credential, initDataUnsafe: { user: { id: Number(owner), first_name: 'Jens' } },
      viewportHeight: innerHeight, ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    // Real native sockets and real signed WATCH frames; only the API origin
    // differs from Vite's static asset origin in this isolated test.
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) { super(protocols === 'vite-hmr' ? url : backend.replace('http:', 'ws:'), protocols); }
    };
  }, ready);
}

async function expectReadableHoleCards(page) {
  // BUG-265 investigation: opacity alone can still describe the preceding
  // render while the deal starts. Wait for the actual two-card landing, then
  // test the visible corners rather than photographing its 90ms stagger.
  for (const card of await page.locator('.watch-felt__hero-card').all()) {
    await expect(card).toHaveAttribute('data-landed', 'yes');
    await expect(card).toHaveCSS('opacity', '1');
  }
  await expect.poll(() => page.locator('.watch-felt__hero-card').evaluateAll(cards => cards.every(card => {
    const matrix = new DOMMatrix(getComputedStyle(card).transform);
    return Math.abs(matrix.m41) < .1 && Math.abs(matrix.m42) < .1;
  }))).toBe(true);
  const pair = await page.locator('.watch-hero__cards').evaluate(cards => {
    const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return [...cards.children].map(card => {
      const rank = card.querySelector(':scope > div > div'), suit = card.querySelector('svg');
      const rankBox = box(rank), suitBox = box(suit);
      const topAt = rectangle => document.elementsFromPoint(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2)
        .find(element => element.closest('.watch-felt__hero-card'));
      return { rank: rank.textContent, card: box(card), rankBox, suitBox,
        rankExposed: card.contains(topAt(rankBox)), suitExposed: card.contains(topAt(suitBox)),
        display: getComputedStyle(card).display, transform: getComputedStyle(card).transform,
        opacity: getComputedStyle(card).opacity, landed: card.dataset.landed };
    });
  });
  expect(pair).toHaveLength(2);
  for (const card of pair) {
    expect(card.opacity, JSON.stringify(pair)).toBe('1');
    expect(card.rankExposed, JSON.stringify(pair)).toBe(true);
    expect(card.suitExposed, JSON.stringify(pair)).toBe(true);
  }
  // Two elements laid on top of each other are still only one readable card.
  expect(Math.abs(pair[1].rankBox.x - pair[0].rankBox.x), JSON.stringify(pair)).toBeGreaterThan(18);
  expect(Math.abs(pair[1].suitBox.x - pair[0].suitBox.x), JSON.stringify(pair)).toBeGreaterThan(18);
  return pair;
}

test('BUG-259: narrow Watch keeps its guide target and navigation visible at 320x590', async ({ page }, testInfo) => {
  await rpc('seed');
  await page.setViewportSize({ width: 320, height: 590 });
  await connect(page); await page.goto('/');
  await page.getByTestId(`home-frame-${ready.agentId}`).click();
  const header = page.locator('.watch-screen__header');
  const title = header.locator('[data-watch-status]');
  await expect(title).toHaveText('The Clock');
  const titleBox = await title.boundingBox();
  expect(titleBox.width).toBeGreaterThanOrEqual(65);
  await expect(header.locator('.floor-mood-chip')).toBeVisible();
  await expect(header.locator('.floor-state-tag')).toBeVisible();
  for (const control of ['Stop watching', 'Sound on', 'Chat']) {
    const button = header.getByRole('button', { name: control, exact: true });
    const box = await button.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await testInfo.attach('header-geometry', { contentType: 'application/json', body: JSON.stringify(await header.evaluate(el => ({
    header: el.getBoundingClientRect().toJSON(),
    parts: [...el.querySelectorAll('button, [data-watch-status], .floor-mood-chip, .floor-state-tag')].map(node => ({
      text: node.textContent, rect: node.getBoundingClientRect().toJSON(),
    })),
  })), null, 2) });
  await page.screenshot({ path: testInfo.outputPath('narrow-watch-header.png') });
});

for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 590 }, { width: 390, height: 420 }, { width: 1440, height: 900 }]) {
  test(`BUG-259: stop viewing versus finish-and-return uses real settlement at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const initial = await rpc('seed');
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport); await connect(page); await page.goto('/');
    const desktop = viewport.width > 1000;
    const open = async () => {
      await page.getByTestId(`home-frame-${ready.agentId}`).click();
      await expect(page.locator('.watch-felt__hero-card')).toHaveCount(2);
      await expect(page.locator('.watch-felt__hero-card').nth(1)).toHaveCSS('opacity', '1');
      if (!desktop) await page.getByRole('button', { name: 'Chat', exact: true }).click();
    };
    await open();
    const control = () => page.getByRole('button', { name: 'Bring home', exact: true });
    await expect(control()).toBeVisible();
    await expectReadableHoleCards(page);
    if (!desktop) {
      const panel = await page.getByRole('dialog', { name: 'The Clock at the table' }).boundingBox();
      expect(panel.height).toBeLessThanOrEqual(viewport.height / 3 + 1);
      const cards = await page.locator('.watch-felt__hero-card').first().boundingBox();
      expect(cards.y + cards.height).toBeLessThanOrEqual(panel.y);
      const box = await control().boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height);
      expect(box.height).toBeGreaterThanOrEqual(44);
      if (viewport.height === 420) {
        const body = await page.locator('.watch-agent-sheet .thread-sheet__body').boundingBox();
        expect(body.height).toBeGreaterThanOrEqual(40);
        await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Back to table', exact: true })).toBeVisible();
        await expect(page.locator('.watch-agent-sheet__head > .mood-ghost')).toBeHidden();
        const close = await page.getByRole('button', { name: 'Back to table', exact: true }).boundingBox();
        expect(close.height).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width).toBeLessThanOrEqual(close.x);
      }
      await page.getByRole('button', { name: 'Back to table', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Stop watching', exact: true }).click();
    let state = await rpc('state');
    expect(state.requests).toBe(0); expect(state.activeTableId).toBe(initial.tableId);
    expect(state.pocket).toEqual(initial.pocket);
    await open();
    await control().click();
    await expect(page.getByRole('button', { name: 'Returning…', exact: true })).toBeDisabled();
    state = await rpc('state');
    expect(state.requests).toBe(1); expect(state.pending).toBe(true); expect(state.folded).toBe(false);
    expect(state.activeTableId).toBe(initial.tableId); expect(state.pocket).toEqual(initial.pocket);
    await expectReadableHoleCards(page);
    if (desktop) {
      const button = page.getByRole('button', { name: 'Returning…', exact: true });
      await expect(page.locator('.dsk-panel--watch').getByRole('button', { name: 'Returning…' })).toBeVisible();
      const box = await button.boundingBox(), felt = await page.locator('.watch-felt').boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(felt.x + felt.width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`return-pending-${viewport.width}-${viewport.height}.png`) });
    // A fresh view reads the authoritative pending flag, not an in-memory receipt.
    if (!desktop) await page.getByRole('button', { name: 'Back to table', exact: true }).click();
    await page.getByRole('button', { name: 'Stop watching', exact: true }).click();
    await open();
    await expect(page.getByRole('button', { name: 'Returning…', exact: true })).toBeDisabled();
    expect((await rpc('state')).requests).toBe(1);
    state = await rpc('settle');
    expect(state.activeTableId).toBeNull(); expect(state.safe).toBe(initial.safe);
    expect(state.pocket.mode).toBe('auto'); expect(state.pocket.cap).toBe(6000);
    expect(state.pocket.ledger.filter(entry => entry.type === 'cashout')).toHaveLength(1);
    if (desktop) {
      await expect(page.getByRole('button', { name: 'Returned home', exact: true })).toBeDisabled();
      // SESSION_END arrives before the ordinary 10s roster/private-profile
      // refresh. Capture the completed stay after all three surfaces agree.
      await expect(page.getByTestId('desk-roster').locator('.dsk-roster-place')).toHaveText('at home', { timeout: 12000 });
      await expect(page.locator('.dsk-panel--watch').getByText(/^I finished 1 hand at/)).toBeVisible({ timeout: 12000 });
      await expect(page.locator('.watch-hero__strip')).toContainText('COMPLETE');
      await expect(page.locator('.watch-hero__strip')).not.toContainText('TO ACT');
    }
    else await expect(page.getByRole('button', { name: 'Back home', exact: true })).toBeVisible();
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`return-settled-${viewport.width}-${viewport.height}.png`) });
    expect(errors).toEqual([]);
  });
}
