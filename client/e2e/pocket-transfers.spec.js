import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { forwardNative } from './fixtures/forwardNative.js';

let child, ready, scratch, sequence = 0, output = '';
const calls = new Map();
const rpc = method => new Promise((resolve, reject) => {
  const id = ++sequence;
  const timer = setTimeout(() => { calls.delete(id); reject(new Error(`${method} timed out: ${output}`)); }, 12000);
  calls.set(id, { resolve, reject, timer }); child.send({ id, method });
});
test.beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-pocket-browser-'));
  child = fork(fileURLToPath(new URL('./fixtures/pocketTransferServer.mjs', import.meta.url)), [], { cwd: scratch, execArgv: [], silent: true });
  child.stdout.on('data', data => { output = (output + data).slice(-8000); });
  child.stderr.on('data', data => { output = (output + data).slice(-8000); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Pocket fixture did not start: ${output}`)), 12000);
    child.once('error', reject);
    child.once('exit', code => { if (!ready) reject(new Error(`Pocket fixture exit ${code}: ${output}`)); });
    child.on('message', message => {
      if (message.event === 'ready') { clearTimeout(timer); ready = message; resolve(); }
      else {
        const call = calls.get(message.id); calls.delete(message.id);
        if (!call) return;
        clearTimeout(call.timer);
        if (message.error) call.reject(new Error(message.error)); else call.resolve(message.result);
      }
    });
  });
});
test.afterAll(async () => {
  if (child?.connected) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    await rpc('stop'); await exited;
  }
  expect(path.dirname(path.resolve(scratch))).toBe(path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test.afterEach(async ({ page }) => {
  // Drain fixture handlers; the browser owns continued native responses.
  await page.unrouteAll({ behavior: 'wait' });
});

async function connect(page) {
  const requests = [], errors = [];
  let refuseFirstTake = true;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url()), method = route.request().method();
    const fixtures = { '/api/auth/config': { botUsername: '' }, '/api/rooms': { rooms: [], hotWindowMs: 20000 },
      '/api/events': { events: [], lastId: 0 }, '/api/stats': { totalAgents: 1, handsPlayedToday: 1 } };
    if (fixtures[url.pathname]) return route.fulfill({ json: fixtures[url.pathname] });
    if (method === 'POST' && /\/(fund|collect|finish)$/.test(url.pathname)) {
      requests.push({ path: url.pathname, body: route.request().postDataJSON() });
      // Only this one refusal is synthetic. Successful transfers are signed,
      // persisted native routes and are independently read from the ledger.
      if (url.pathname.endsWith('/collect') && refuseFirstTake) {
        refuseFirstTake = false;
        return route.fulfill({ status: 503, json: { error: 'fixture unavailable' } });
      }
    }
    return forwardNative(route, ready.backend);
  });
  await page.addInitScript(({ owner, credential, backend }) => {
    window.Telegram = { WebApp: { initData: credential, initDataUnsafe: { user: { id: Number(owner), first_name: 'Jens' } },
      viewportHeight: innerHeight, ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) { super(protocols === 'vite-hmr' ? url : backend.replace('http:', 'ws:'), protocols); }
    };
  }, ready);
  return { requests, errors };
}

test('BUG-286: unregistering the native proxy preserves both concurrent backend responses', async ({ page }) => {
  let markBothHeld;
  const bothHeld = new Promise(resolve => { markBothHeld = resolve; });
  const held = new Map(), escaped = [];
  const reply = key => {
    const response = held.get(key);
    if (!response || response.writableEnded) return;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ source: 'native backend', key }));
  };
  const backend = http.createServer((request, response) => {
    const key = new URL(request.url, 'http://local').searchParams.get('key');
    held.set(key, response);
    if (held.size === 2) markBothHeld();
  });
  const origin = http.createServer((request, response) => {
    if (request.url.startsWith('/api/')) {
      escaped.push(request.url);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ source: 'unproxied origin' }));
      // If interception wrongly falls through, complete the held native
      // response too. This exposes its rejected late fulfillment rather than
      // leaving a diagnostic request pending until the test timeout.
      reply('slow');
    } else response.end('<!doctype html><title>Native proxy lifecycle</title>');
  });
  const listen = async server => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  };
  const backendUrl = await listen(backend), originUrl = await listen(origin);
  try {
    await page.route('**/api/proxy-lifetime?*', route => forwardNative(route, backendUrl));
    await page.goto(originUrl);
    await page.evaluate(() => {
      window.proxyResponses = Promise.all(['fast', 'slow'].map(key =>
        fetch(`/api/proxy-lifetime?key=${key}`).then(response => response.json())));
    });
    await bothHeld;
    // Two real responses are pending when interception is removed. With
    // fetch+fulfill, fast completion can unregister slow before it fulfills.
    // Direct continuation hands both responses to the browser before removal.
    const draining = page.unrouteAll({ behavior: 'wait' });
    reply('fast');
    await draining;
    reply('slow');
    expect(await page.evaluate(() => window.proxyResponses)).toEqual([
      { source: 'native backend', key: 'fast' },
      { source: 'native backend', key: 'slow' },
    ]);
    expect(escaped).toEqual([]);
  } finally {
    reply('fast'); reply('slow');
    await page.unrouteAll({ behavior: 'wait' });
    await new Promise(resolve => origin.close(resolve));
    await new Promise(resolve => backend.close(resolve));
  }
});

for (const viewport of [{ width: 390, height: 590 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`BUG-284: Safe GIVE controls stay inside the mini-app at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const initial = await rpc('seedHistory');
    await page.setViewportSize(viewport);
    const { requests, errors } = await connect(page);
    await page.goto('/');
    await expect(page.getByTestId('home-safe')).toBeVisible();
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.isVisible()) await skip.click();

    // The reported phone path is the owner's You statement, not the Home
    // overlay covered by BUG-280. Desktop opens its actual room-safe rail.
    if (viewport.width < 1000) {
      await page.getByRole('button', { name: 'Your agents', exact: true }).click();
      await page.getByTestId('roster-ledger').click();
      await page.getByRole('button', { name: 'Money', exact: true }).click();
    } else await page.getByTestId('home-safe').click();

    const safe = page.getByTestId('safe-sheet');
    await safe.getByRole('button', { name: /^GIVE/ }).click();
    await safe.locator(`.wal-row[data-agent="${ready.agentId}"]`).getByRole('button', { name: 'Give him chips', exact: true }).click();
    const sheet = safe.getByRole('dialog', { name: 'Fund The Clock' });
    await expect(sheet).toBeAttached();
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`safe-give-${viewport.width}x${viewport.height}.png`) });
    const geometry = await sheet.evaluate(node => ({
      sheet: node.getBoundingClientRect().toJSON(),
      panel: node.closest('.safe__panel').getBoundingClientRect().toJSON(),
      host: node.closest('.you-shell, .dsk-home__rail')?.getBoundingClientRect().toJSON(),
      viewport: { width: innerWidth, height: innerHeight },
    }));
    await testInfo.attach('safe-give-geometry', { contentType: 'application/json', body: JSON.stringify(geometry, null, 2) });
    await expect(sheet).toBeVisible();
    expect(geometry.sheet.y, 'the sheet starts inside the mini-app').toBeGreaterThanOrEqual(0);
    expect(geometry.sheet.bottom, 'the sheet ends inside the mini-app').toBeLessThanOrEqual(viewport.height);

    const hitTarget = async locator => {
      await expect(locator).toBeInViewport({ ratio: 1 });
      expect(await locator.evaluate(node => {
        const box = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      }), 'the visible control receives the tap, not a backdrop').toBe(true);
    };
    const back = sheet.getByRole('button', { name: 'Back', exact: true });
    const confirm = sheet.getByRole('button', { name: 'Give him chips', exact: true });
    await hitTarget(back);
    await hitTarget(confirm);
    const amount = sheet.getByLabel('Amount to give');
    await amount.scrollIntoViewIfNeeded();
    await hitTarget(amount);
    await amount.fill('137');
    // Internal scrolling must not carry the sheet's escape or commit buttons
    // outside the visible mini-app, even on Telegram's shorter viewport.
    await hitTarget(back);
    await hitTarget(confirm);
    await confirm.click();
    await expect(sheet).toHaveCount(0);
    await expect(safe.locator('.safe__amount')).toHaveText('$9,863');
    const state = await rpc('state');
    expect(state.pocket.balance).toBe(initial.pocket.balance + 137);
    expect(state.safe).toBe(initial.safe - 137);
    expect(state.game).toEqual(initial.game);
    expect(state.pocket.openBuyIns).toEqual(initial.pocket.openBuyIns);
    expect(requests.filter(request => request.path.endsWith('/fund'))).toHaveLength(1);

    await safe.getByRole('button', { name: /^GIVE/ }).click();
    await safe.locator(`.wal-row[data-agent="${ready.agentId}"]`).getByRole('button', { name: 'Give him chips', exact: true }).click();
    await hitTarget(back);
    await back.click();
    await expect(sheet).toHaveCount(0);
    await expect(safe.getByText('Who gets it', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`BUG-280: real pocket transfers preserve a committed hand at ${viewport.width}`, async ({ page }, testInfo) => {
    const initial = await rpc('seed');
    await page.setViewportSize(viewport);
    const { requests, errors } = await connect(page);
    await page.goto('/');
    await expect(page.getByTestId('home-safe')).toBeVisible();
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.isVisible()) await skip.click();
    const desktop = viewport.width > 1000;
    if (desktop) await page.getByRole('button', { name: /^Wallet for / }).click();
    else await page.getByTestId('home-safe').click();
    const panel = desktop ? page.locator('.dsk-wallet') : page.getByTestId('safe-sheet');
    const takePage = async () => {
      if (!desktop) await panel.getByRole('button', { name: /^TAKE/ }).click();
    };
    const row = () => panel.locator(`.wal-row[data-agent="${ready.agentId}"]`);
    const intact = async (pocket, safe) => {
      const state = await rpc('state');
      expect(state.pocket.balance).toBe(pocket); expect(state.safe).toBe(safe);
      expect(state.pocket.balance + state.safe).toBe(initial.pocket.balance + initial.safe);
      expect(state.game).toEqual(initial.game);
      expect(state.pocket.openBuyIns).toEqual(initial.pocket.openBuyIns);
      expect(state.activeTableId).toBe(initial.tableId); expect(state.pending).toBe(false);
      expect(state.saved.balance).toBe(pocket);
      return state;
    };

    await takePage();
    if (desktop) await expect(row().getByRole('button', { name: 'Give him chips', exact: true }))
      .not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await row().getByRole('button', { name: 'Take all — $2,000' }).click();
    await expect(panel.getByRole('alert')).toContainText('Could not move the chips');
    await intact(2000, 10000);
    await row().getByRole('button', { name: 'Choose amount' }).click();
    let sheet = panel.getByRole('dialog', { name: 'Take from The Clock' });
    await sheet.getByLabel('Amount to take').fill('137');
    await sheet.getByRole('button', { name: 'Take $137', exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await intact(1863, 10137);

    await takePage();
    await row().getByRole('button', { name: 'Take all — $1,863' }).click();
    await expect(row().getByRole('button', { name: 'Take all — $0' })).toBeDisabled();
    await expect(row()).toContainText('committed');
    await intact(0, 12000);
    await expect(page.getByTestId('home-safe')).toContainText('$12,000');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`pocket-only-${viewport.width}.png`) });

    if (!desktop) {
      await panel.getByRole('button', { name: 'Back', exact: true }).click();
      await panel.getByRole('button', { name: /^GIVE/ }).click();
    }
    await row().getByRole('button', { name: 'Give him chips', exact: true }).click();
    sheet = panel.getByRole('dialog', { name: 'Fund The Clock' });
    await sheet.getByRole('button', { name: 'All from safe' }).click();
    await expect(sheet.getByLabel('Amount to give')).toHaveValue('12000');
    await sheet.getByLabel('Amount to give').fill('137');
    await expect(sheet).toContainText('Pocket after giving: $137');
    await testInfo.attach('funding-geometry', { contentType: 'application/json', body: JSON.stringify(await sheet.evaluate(node => ({
      sheet: node.getBoundingClientRect().toJSON(), body: node.querySelector('.wal-sheet__body').getBoundingClientRect().toJSON(),
      parent: node.closest('.safe__panel')?.getBoundingClientRect().toJSON(),
      amount: node.querySelector('[aria-label="Amount to give"]').getBoundingClientRect().toJSON(),
      all: node.querySelector('.wal-preset--all').getBoundingClientRect().toJSON(),
    })), null, 2) });
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`give-any-amount-${viewport.width}.png`) });
    await expect(sheet.getByRole('button', { name: 'All from safe' })).toBeInViewport();
    const bodyBox = await sheet.locator('.wal-sheet__body').boundingBox();
    expect(bodyBox.height).toBeGreaterThan(200);
    await expect(sheet.getByLabel('Amount to give')).toBeInViewport();
    await expect(sheet.getByRole('button', { name: 'Give him chips', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await sheet.getByRole('button', { name: 'Give him chips', exact: true }).click();
    await expect(sheet).toHaveCount(0);
    const final = await intact(137, 11863);
    expect(final.pocket.ledger.filter(entry => entry.type === 'collect').map(entry => entry.amount)).toEqual([-137, -1863]);
    expect(final.pocket.ledger.filter(entry => entry.type === 'fund').map(entry => entry.amount)).toEqual([137]);
    expect(requests.some(request => request.path.endsWith('/finish') || request.body.verb === 'callin')).toBe(false);
    expect(requests.filter(request => request.path.endsWith('/collect')).map(request => request.body))
      .toEqual([null, 137, null].map(amount => ({ userId: ready.owner, all: true, amount })));
    expect(errors).toEqual([]);
  });
}
