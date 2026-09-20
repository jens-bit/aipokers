import { test, expect } from '@playwright/test';
import { forwardNative } from './fixtures/forwardNative.js';
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
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-human-seat-browser-'));
  child = fork(fileURLToPath(new URL('./fixtures/humanSeatServer.mjs', import.meta.url)), [], { cwd: scratch, execArgv: [], silent: true });
  child.stdout.on('data', data => { output = (output + data).slice(-8000); });
  child.stderr.on('data', data => { output = (output + data).slice(-8000); });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => { if (!ready) reject(new Error(`Human fixture exit ${code}: ${output}`)); });
    child.on('message', message => {
      if (message.event === 'ready') { ready = message; resolve(); }
      else { const call = calls.get(message.id); calls.delete(message.id);
        if (message.error) call?.reject(new Error(message.error)); else call?.resolve(message.result); }
    });
  });
});
test.afterAll(async () => {
  if (!child || child.exitCode != null) return;
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
    if (url.pathname === '/api/stats') return route.fulfill({ json: { totalAgents: 2, handsPlayedToday: 1 } });
    return forwardNative(route, ready.backend);
  });
  await page.addInitScript(({ owner, credential, backend }) => {
    window.Telegram = { WebApp: { initData: credential, initDataUnsafe: { user: { id: Number(owner), first_name: 'Jens' } },
      viewportHeight: innerHeight, ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    const NativeSocket = window.WebSocket;
    window.__humanWire = { received: [], actions: [] };
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) {
        super(protocols === 'vite-hmr' ? url : backend.replace('http:', 'ws:'), protocols);
        if (protocols !== 'vite-hmr') this.addEventListener('message', event => {
          const message = JSON.parse(event.data);
          if (['joined', 'state', 'error'].includes(message.type)) window.__humanWire.received.push(message);
        });
      }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === 'action') window.__humanWire.actions.push(message.action);
        super.send(raw);
      }
    };
  }, ready);
}

for (const [mode, viewport] of [
  ['fold', { width: 390, height: 844 }], ['check', { width: 1440, height: 900 }],
]) test(`BUG-267/268: signed Home Sit reconnect preserves the hand and native timeout ${mode}s at ${viewport.width}`, async ({ page }, testInfo) => {
  test.setTimeout(45000);
  await rpc('seed');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize(viewport); await connect(page); await page.goto('/');
  await page.getByTestId('home-table').click();
  await page.getByTestId('home-table-sit').click();
  await expect.poll(async () => (await rpc('state')).seat).toBeGreaterThanOrEqual(0);
  let before = await rpc('advance');
  if (mode === 'check') {
    // The owner explicitly calls their first preflop turn when necessary;
    // controlled opponents then check/call until a real free action arrives.
    for (let i = 0; i < 3 && !before.legal.some(action => action.type === 'check'); i++) {
      await page.getByRole('button', { name: /^CALL/ }).click();
      await expect.poll(async () => (await rpc('state')).actionSeq).toBeGreaterThan(before.actionSeq);
      before = await rpc('advance');
    }
  }
  expect(before.legal.some(action => action.type === 'check')).toBe(mode === 'check');
  expect(before.timer.seat).toBe(before.seat);
  expect(before.timer.totalMs).toBe(15000);
  await expect(page.getByTestId('owner-hero-cards').locator('.owner-hero__card')).toHaveCount(2);
  await expect(page.getByTestId('sit-strip')).toHaveAttribute('data-turn', 'yes');
  await expect(page.getByTestId('sit-strip')).toContainText(`timeout ${mode}s for you`);
  const sentBefore = await page.evaluate(() => window.__humanWire.actions.length);
  const joinedBefore = await page.evaluate(() => window.__humanWire.received.filter(message => message.type === 'joined').length);
  const initialWire = await page.evaluate(() => window.__humanWire.received.filter(message => message.type === 'state').at(-1));
  expect(initialWire.state.seats[before.seat].holeCards).toEqual(before.cards);
  expect(initialWire.state.seats.filter((_, index) => index !== before.seat).every(seat => seat.holeCards.length === 0)).toBe(true);
  // Drop four seconds into the real clock. Reconnect must keep this deadline,
  // rather than granting another 15 seconds or resetting the game.
  await expect.poll(async () => (await rpc('state')).now, { timeout: 6500 }).toBeGreaterThanOrEqual(before.timer.deadlineTs - 11000);
  const dropped = await rpc('drop');
  expect(dropped.connected).toBe(false);
  expect(dropped.hand).toBe(before.hand); expect(dropped.cards).toEqual(before.cards);
  expect(dropped.pot).toBe(before.pot); expect(dropped.timer.deadlineTs).toBe(before.timer.deadlineTs);
  await expect.poll(() => page.evaluate(() => window.__humanWire.received.filter(message => message.type === 'joined').length)).toBe(joinedBefore + 1);
  const restored = await rpc('state');
  expect(restored.connected).toBe(true); expect(restored.seat).toBe(before.seat);
  expect(restored.playerId).toBe(before.playerId); expect(restored.hand).toBe(before.hand);
  expect(restored.cards).toEqual(before.cards); expect(restored.pot).toBe(before.pot);
  expect(restored.timer.deadlineTs).toBe(before.timer.deadlineTs);
  await expect(page.getByTestId('sit-strip')).toHaveAttribute('data-turn', 'yes');
  await page.screenshot({ path: testInfo.outputPath(`human-reconnected-${viewport.width}.png`) });
  await expect.poll(async () => (await rpc('state')).actionSeq, { timeout: 15000 }).toBeGreaterThan(before.actionSeq);
  const expired = await rpc('state');
  expect(expired.now).toBeGreaterThanOrEqual(before.timer.deadlineTs);
  expect(expired.actions.slice(before.actions.length)).toEqual([{ seat: before.seat, street: before.street, actionType: mode }]);
  expect(expired.folded).toBe(mode === 'fold');
  expect(expired.toAct).not.toBe(before.seat);
  expect(expired.hand).toBe(before.hand); expect(expired.chips).toBe(before.chips);
  expect(expired.safe).toBe(before.safe);
  await expect(page.getByTestId('sit-strip')).toHaveAttribute('data-turn', 'no');
  expect(await page.evaluate(() => window.__humanWire.actions.length)).toBe(sentBefore);
  expect(await page.evaluate(() => window.__humanWire.received.filter(message => message.type === 'error'))).toEqual([]);
  expect(errors).toEqual([]);
  const evidencePath = testInfo.outputPath('native-human-lifecycle.json');
  fs.writeFileSync(evidencePath, JSON.stringify({ before, dropped, restored, expired }, null, 2));
  await testInfo.attach('native-human-lifecycle', { contentType: 'application/json', path: evidencePath });
  await page.screenshot({ path: testInfo.outputPath(`human-timeout-${mode}-${viewport.width}.png`) });
});
