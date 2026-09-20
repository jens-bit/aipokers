import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
let child, ready, scratch, nextId = 0, output = '';
const calls = new Map();
const rpc = (method, data = {}) => new Promise((resolve, reject) => {
  const id = ++nextId; calls.set(id, { resolve, reject }); child.send({ id, method, ...data });
});
test.beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-home-care-browser-'));
  child = fork(fileURLToPath(new URL('./fixtures/homeCareServer.mjs', import.meta.url)), [], { cwd: scratch, execArgv: [], silent: true });
  child.stdout.on('data', data => { output = (output + data).slice(-6000); });
  child.stderr.on('data', data => { output = (output + data).slice(-6000); });
  await new Promise((resolve, reject) => {
    child.once('error', reject); child.once('exit', code => { if (!ready) reject(new Error(`Fixture exit ${code}: ${output}`)); });
    child.on('message', message => {
      if (message.event === 'ready') { ready = message; resolve(); }
      else { const call = calls.get(message.id); calls.delete(message.id);
        if (message.error) call?.reject(new Error(message.error)); else call?.resolve(message.result); }
    });
  });
});
test.afterAll(async () => {
  const exited = new Promise(resolve => child.once('exit', resolve)); await rpc('stop'); await exited;
  expect(path.dirname(path.resolve(scratch))).toBe(path.resolve(os.tmpdir()));
  fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});
async function connect(page) {
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/config') return route.fulfill({ json: { botUsername: '' } });
    if (url.pathname === '/api/stats') return route.fulfill({ json: { totalAgents: 1, handsPlayedToday: 0 } });
    const response = await route.fetch({ url: `${ready.backend}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.addInitScript(({ owner, credential, backend }) => {
    window.Telegram = { WebApp: { initData: credential, initDataUnsafe: { user: { id: Number(owner), first_name: 'Jens' } },
      viewportHeight: innerHeight, ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    const NativeSocket = window.WebSocket;
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) { super(protocols === 'vite-hmr' ? url : backend.replace('http:', 'ws:'), protocols); }
    };
  }, ready);
}
for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`BUG-279: visible Home fetches two real snacks; hidden Home stops at ${viewport.width}`, async ({ page }, testInfo) => {
    await rpc('seed', { snacks: 3 }); await page.setViewportSize(viewport); await connect(page); await page.goto('/');
    const body = page.locator(`.home-one[data-agent="${ready.agentId}"]`);
    await expect(body).toHaveAttribute('data-home-item-phase', 'back', { timeout: 10000 });
    await expect(body.getByTestId('home-item-snack')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`fridge-fetch-${viewport.width}.png`) });
    expect((await rpc('state')).snacks).toBe(2);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(6500);
    expect((await rpc('state')).snacks).toBe(2);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(body).toHaveAttribute('data-home-item-phase', 'back', { timeout: 10000 });
    await expect(body.getByTestId('home-item-snack')).toBeVisible();
    const recovered = await rpc('state'); expect(recovered.snacks).toBe(1); expect(recovered.refusal).toBeNull();
    expect(recovered.safe).toBe(10000); expect(recovered.tableId).toBeNull();
    await page.screenshot({ path: testInfo.outputPath(`fridge-recovered-${viewport.width}.png`) });
  });
  test(`BUG-279: empty shelf asks, buying stocks only, Home return shows eating at ${viewport.width}`, async ({ page }, testInfo) => {
    await rpc('seed', { snacks: 0 }); await page.setViewportSize(viewport); await connect(page); await page.goto('/');
    await expect(page.getByText(/out of snacks/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Open the fridge', exact: true }).click();
    await expect(page.getByTestId('home-fridge-sheet')).toBeVisible();
    await page.getByRole('button', { name: 'Buy 1 snack' }).click();
    await page.getByRole('button', { name: 'Buy 1 snack' }).click();
    const bought = await rpc('state'); expect(bought.snacks).toBe(2); expect(bought.left).toBeLessThan(21);
    expect(bought.safe).toBeLessThan(10000);
    if (viewport.width < 1100) await page.getByTestId('home-fridge-sheet').getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(page.getByTestId('home-safe')).toContainText(`$${bought.safe.toLocaleString('en-US')}`);
    const body = page.locator(`.home-one[data-agent="${ready.agentId}"]`);
    // The desktop fridge sits beside the visible room: its next regular
    // heartbeat can take five seconds, then the authored outward/hold phases.
    await expect(body).toHaveAttribute('data-home-item-phase', 'back', { timeout: 10000 });
    await expect(body.getByTestId('home-item-snack')).toBeVisible();
    if (viewport.width >= 1100) await expect(page.getByTestId('fridge-shelf-snack')).toContainText('× 1');
    await page.screenshot({ path: testInfo.outputPath(`fridge-stock-recovery-${viewport.width}.png`) });
    await expect.poll(async () => (await rpc('state')).refusal, { timeout: 12000 }).toBeNull();
    expect((await rpc('state')).snacks).toBe(0);
    if (viewport.width >= 1100) await expect(page.getByTestId('fridge-shelf-snack')).toContainText('out');
    expect((await rpc('state')).safe).toBe(bought.safe);
  });
}
