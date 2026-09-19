import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Real chat routes, real wallets and real seats. Only the Home transport is a
// tiny socket bridge; every command response is fetched from the actual API.
const OWNER = '4242', ID = 'command-browser';
let child, backend, scratch, pageForChanges, nextId = 0, childOutput = '';
const calls = new Map();
const rpc = (method, data = {}) => new Promise((resolve, reject) => {
  const id = ++nextId; calls.set(id, { resolve, reject }); child.send({ id, method, owner: OWNER, ...data });
});
const state = () => rpc('state', { agent: ID });
test.beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-command-browser-'));
  child = fork(fileURLToPath(new URL('./fixtures/ownerCommandServer.mjs', import.meta.url)), [],
    { cwd: scratch, execArgv: [], silent: true });
  child.stdout.on('data', data => { childOutput = (childOutput + data).slice(-6000); });
  child.stderr.on('data', data => { childOutput = (childOutput + data).slice(-6000); });
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => { if (!backend) reject(new Error(`Fixture exit ${code}: ${childOutput}`)); });
    child.on('message', message => {
      if (message.event === 'ready') { backend = message.backend; resolve(); }
      else if (message.event === 'home-change') pageForChanges?.evaluate(() => window.__refreshCommandHome?.()).catch(() => {});
      else { const call = calls.get(message.id); calls.delete(message.id);
        if (message.error) call?.reject(new Error(message.error)); else call?.resolve(message.result); }
    });
  });
});
test.beforeEach(async () => {
  await rpc('seed', { wallet: { ownerId: OWNER, balance: 10000, ledger: [], fridge: { snack: 2, beer: 2 } },
    agent: { id: ID, name: 'The Clock', status: 'idle', activeTableId: null,
    style: 'Balanced', risk: 'Medium', strategy: 'Wait for value.', bankroll: 2000,
    pocket: { agentId: ID, balance: 2000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 30 }, stamina: { left: 90, at: Date.now(), stage: 'fresh' },
    stats: { handsPlayed: 140, handsWon: 55 }, sessionLog: [], ledger: [],
    profile: { tightness: 60, aggression: 45, bluffFreq: 15, discipline: 80 },
  } });
});
test.afterEach(async () => { pageForChanges = null; await rpc('reset'); });
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
    if (url.pathname === '/api/stats') return route.fulfill({ json: { totalAgents: 1, handsPlayedToday: 0 } });
    const response = await route.fetch({ url: `${backend}${url.pathname}${url.search}` });
    await route.fulfill({ response });
  });
  await page.exposeFunction('__commandHomeSnapshot', () => rpc('snapshot'));
  await page.addInitScript(({ owner }) => {
    window.Telegram = { WebApp: { initData: `user=${encodeURIComponent(JSON.stringify({ id: Number(owner) }))}&auth_date=1756900000&hash=command-fixture`,
      initDataUnsafe: { user: { id: Number(owner), first_name: 'Jens' } }, viewportHeight: innerHeight,
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    const sockets = [];
    window.__refreshCommandHome = async () => {
      const state = await window.__commandHomeSnapshot();
      for (const socket of sockets) if (socket.readyState === 1 && socket.floor) socket.push(state);
    };
    class HomeSocket extends EventTarget {
      static OPEN = 1; OPEN = 1; readyState = 0;
      constructor() { super(); sockets.push(this); setTimeout(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }, 10); }
      close() { this.readyState = 3; }
      push(message) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) })); }
      send(raw) { if (JSON.parse(raw).type === 'floor_sub') { this.floor = true; window.__refreshCommandHome(); } }
    }
    window.WebSocket = HomeSocket;
  }, { owner: OWNER });
  pageForChanges = page;
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`BUG-251: owner talks through stakes, funding, actual seat and return at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); await connect(page); await page.goto('/');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.locator(`.home-one[data-agent="${ID}"]`).click();
    const chat = page.locator('.agent-view'); await expect(chat).toBeVisible();
    const say = async text => { await chat.getByPlaceholder('Whisper to him…').fill(text); await chat.getByRole('button', { name: 'Send', exact: true }).click(); };
    await say('go to the casino');
    await expect(chat.getByText('Which stakes: $10/$20, $25/$50, $50/$100?', { exact: true })).toBeVisible();
    expect((await state()).table).toBeNull();
    await say('25/50');
    await expect(chat.getByText('Move $3,000 from your safe and seat me at $25/$50?', { exact: true })).toBeVisible();
    expect((await state()).wallet.balance).toBe(10000);
    await say('yes');
    await expect(chat.locator('.agent-view__thread').getByText('I took $3,000 from your safe. I am seated at $25/$50.', { exact: true })).toBeVisible();
    expect((await state()).table).toBe(50);
    expect((await state()).wallet.balance).toBe(7000);
    await expect(chat.getByRole('button', { name: /watch.*25\/50/i })).toBeVisible();
    await expect(chat.locator('.agent-view__actions .agent-view__net')).toHaveText('$0');
    await expect(chat.locator('.agent-view__actions')).not.toContainText('$5,000');
    await expect(chat.getByRole('button', { name: /deploy/i })).toHaveCount(0);
    await expect(chat.getByText("I'm sat here doing nothing. Put me in.", { exact: true })).toHaveCount(0);
    if (viewport.width > 1000) {
      await expect(page.getByTestId('desk-roster').getByText('at the casino', { exact: true })).toBeVisible();
      await expect(page.getByTestId('home-safe')).toHaveText('$7,000');
      await expect(page.locator(`.home-one[data-agent="${ID}"]`)).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator(`.home-one[data-agent="${ID}"]`)).toHaveCSS('opacity', '0');
    }
    await page.screenshot({ path: testInfo.outputPath(`command-seat-${viewport.width}.png`) });
    await say('come home');
    await expect(chat.locator('.agent-view__thread').getByText(/I am called in\. I will finish the hand|I am out of the game and home\./)).toBeVisible();
    expect((await state()).pocket.mode).toBe('cut');
    await page.screenshot({ path: testInfo.outputPath(`command-return-${viewport.width}.png`) });
  });
}
