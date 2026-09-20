import { test, expect } from '@playwright/test';
import { forwardNative } from './fixtures/forwardNative.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';

// The actual profile, appearance and wallet routes run against a disposable
// SQLite database. The native deck deals the two private cards; only automatic
// AI decisions are held so a menu test cannot race an unrelated hand result.
// No paid call, live store or browser-only pretend save is involved.
const OWNER = '4242', ID = 'character-menu-browser', NAME = 'The Clock';
let child, backend, scratch, currentPage, sequence = 0, output = '';
const pending = new Map();
function rpc(method, fields = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Fixture ${method} timed out: ${output}`)); }, 12000);
    pending.set(id, { resolve, reject, timer }); child.send({ id, method, ...fields });
  });
}

test.beforeAll(async () => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'railbird-character-menu-'));
  const file = path.join(scratch, 'server.mjs');
  fs.writeFileSync(file, `
    delete process.env.ANTHROPIC_API_KEY; delete process.env.OPENAI_API_KEY;
    delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.DEV_API_SECRET;
    process.env.NOTIFY_ENABLED = '0';
    const root = ${JSON.stringify(new URL('../../', import.meta.url).href)};
    const store = await import(new URL('src/server/store.js', root));
    const profiles = await import(new URL('src/server/agentProfiles.js', root));
    const registry = await import(new URL('src/server/tableRegistry.js', root));
    const { Table } = await import(new URL('src/server/table.js', root));
    const { default: express } = await import(new URL('node_modules/express/index.js', root));
    Table.prototype._maybeRunAiTurn = async () => {};
    const owner = ${JSON.stringify(OWNER)}, agentId = ${JSON.stringify(ID)};
    const app = express(); app.use(express.json()); profiles.installAgentProfileRoutes(app);
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    profiles.setLiveTableProvider(registry);
    profiles.setHomeChangeListener(() => process.send?.({ event: 'change' }));
    profiles.setAgentChangeListener(() => process.send?.({ event: 'change' }));
    process.on('message', async ({ id, method }) => {
      try {
        let result;
        if (method === 'seed') {
          registry.resetRegistry('next character menu case');
          store.saveWallet(owner, { ownerId: owner, balance: 10000, ledger: [] });
          store.saveProfile(owner, { userId: owner, chat: [], agents: [{
            id: agentId, name: ${JSON.stringify(NAME)}, status: 'idle', activeTableId: null,
            bornAt: Date.parse('2026-09-01T12:00:00Z'), style: 'Balanced', risk: 'Medium', strategy: 'Wait for value.',
            identity: { hood: 'indigo', glow: 'violet' }, nature: { name: 'Rock' },
            bankroll: 4000, pocket: { agentId, balance: 4000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
            mood: { state: 'neutral', heat: 24 }, stamina: { left: 90, at: Date.now(), stage: 'fresh' },
            attrs: { READS: 62, FOCUS: 57, DISCIPLINE: 68, DECEPTION: 44, COMPOSURE: 66, STAMINA: 72 },
            stats: { handsPlayed: 140, handsWon: 55, winRate: 39.3, netWon: 480, biggestPot: 620 },
            sessionLog: [{ hands: 32, net: 300, endedAt: Date.now() - 7200000 }, { hands: 24, net: 180, endedAt: Date.now() - 3600000 }],
            profile: { tightness: 60, aggression: 45, bluffFreq: 15, discipline: 80 },
            chatHistory: [{ role: 'user', content: 'Keep the river read.' }, { role: 'assistant', content: 'I remember the river read.' }],
          }] });
          profiles.reloadOwners(owner);
          const deployed = profiles.deployAgent(owner, agentId, { body: { rung: 0 } });
          if (deployed.status !== 200) throw new Error(JSON.stringify(deployed));
          const table = registry.tableOfAgent(agentId);
          if (!table) throw new Error('The funded companion was not seated');
          table._clearTimers(); table.autoPlay = false; table.maybeStartHand();
          result = profiles.presentAgentById(agentId, owner, { owner: true });
        } else if (method === 'snapshot') result = profiles.homeSnapshot(owner, { owner: true });
        else if (method === 'state') result = {
          saved: store.loadProfile(owner).agents.find(a => a.id === agentId),
          agent: profiles.presentAgentById(agentId, owner, { owner: true }),
        };
        else if (method === 'reset') registry.resetRegistry('character menu case over');
        else if (method === 'stop') {
          profiles.setHomeChangeListener(null); profiles.setAgentChangeListener(null);
          registry.resetRegistry('character menu fixture over');
          await new Promise(resolve => server.close(resolve)); store._closeForTests();
          process.send({ id }); process.disconnect(); return;
        } else throw new Error('Unknown fixture method ' + method);
        process.send({ id, result });
      } catch (error) { process.send({ id, error: error.stack }); }
    });
    process.send({ event: 'ready', backend: 'http://127.0.0.1:' + server.address().port });
  `);
  child = fork(file, [], { cwd: scratch, execArgv: [], silent: true });
  child.stdout.on('data', data => { output = (output + data).slice(-10000); });
  child.stderr.on('data', data => { output = (output + data).slice(-10000); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Fixture did not start: ${output}`)), 12000);
    child.once('error', reject);
    child.once('exit', code => { if (!backend) reject(new Error(`Fixture exit ${code}: ${output}`)); });
    child.on('message', message => {
      if (message.event === 'ready') { clearTimeout(timer); backend = message.backend; resolve(); }
      else if (message.event === 'change') currentPage?.evaluate(() => window.__refreshCharacterHome?.()).catch(() => {});
      else {
        const call = pending.get(message.id); pending.delete(message.id);
        if (!call) return;
        clearTimeout(call.timer);
        if (message.error) call.reject(new Error(message.error)); else call.resolve(message.result);
      }
    });
  });
});

test.beforeEach(async () => { await rpc('seed'); });
test.afterEach(async () => { currentPage = null; await rpc('reset'); });
test.afterAll(async () => {
  if (child?.connected) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    await rpc('stop'); await exited;
  }
  if (scratch) {
    expect(path.dirname(path.resolve(scratch))).toBe(path.resolve(os.tmpdir()));
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

async function connect(page) {
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    requests.push({ path: url.pathname, method: route.request().method(), body: route.request().postDataJSON() });
    const fixtures = {
      '/api/auth/config': { botUsername: '' }, '/api/rooms': { rooms: [], hotWindowMs: 20000 },
      '/api/events': { events: [], lastId: 0 }, '/api/stats': { totalAgents: 1, handsPlayedToday: 0 },
    };
    if (fixtures[url.pathname]) return route.fulfill({ json: fixtures[url.pathname] });
    // An accidental submit is a test failure and can never spend a model call.
    if (url.pathname === '/api/agents/chat') return route.fulfill({ status: 503, json: { error: 'This journey does not send chat' } });
    return forwardNative(route, backend);
  });
  await page.exposeFunction('__characterHomeSnapshot', () => rpc('snapshot'));
  await page.addInitScript(({ owner }) => {
    localStorage.setItem('railbird.home.appearance', 'day');
    window.Telegram = { WebApp: { initData: `user=${encodeURIComponent(JSON.stringify({ id: Number(owner) }))}&auth_date=1756900000&hash=character-fixture`,
      initDataUnsafe: { user: { id: Number(owner), first_name: 'Jens' } }, get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    const sockets = [];
    window.__refreshCharacterHome = async () => {
      const snapshot = await window.__characterHomeSnapshot();
      for (const socket of sockets) if (socket.readyState === 1 && socket.floor) socket.push(snapshot);
    };
    class HomeSocket extends EventTarget {
      static OPEN = 1; OPEN = 1; readyState = 0;
      constructor() { super(); sockets.push(this); setTimeout(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }, 10); }
      close() { this.readyState = 3; }
      push(message) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) })); }
      send(raw) { if (JSON.parse(raw).type === 'floor_sub') { this.floor = true; window.__refreshCharacterHome(); } }
    }
    window.WebSocket = HomeSocket;
  }, { owner: OWNER });
  currentPage = page;
  return { requests, errors };
}

async function openCharacter(page, width) {
  if (width > 1000) await page.getByTestId('desk-roster').getByRole('button', { name: new RegExp(NAME) }).click();
  else {
    await page.getByRole('button', { name: 'Your agents', exact: true }).click();
    await page.locator(`.roster__row[data-agent="${ID}"]`).click();
  }
  const menu = page.locator('.agent-view').filter({ has: page.getByRole('tablist', { name: 'Character sections' }) });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('tab', { name: 'Chat', exact: true })).toHaveAttribute('aria-selected', 'true');
  return menu;
}

async function visibleGeometry(page, menu) {
  const geometry = await menu.evaluate(root => {
    const box = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const stage = root.querySelector('[data-testid="agent-stage"]');
    // The cards are decorative and intentionally ignore clicks. Temporarily
    // opt the card group into hit testing without changing paint or geometry;
    // both cards then participate, so their own overlap is still detected.
    const holes = root.querySelector('[data-testid="agent-view-hole"]');
    const pointerEvents = holes.style.pointerEvents;
    holes.style.pointerEvents = 'auto';
    const targets = [stage, root.querySelector('[role="tablist"]'), ...root.querySelectorAll('.agent-view__hole-card')];
    const composer = root.querySelector('[role="tabpanel"]:not([hidden]) .agent-view__composer');
    if (composer) targets.push(composer);
    const result = { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth,
      boxes: targets.map(box), menu: box(root), stage: box(stage),
      panes: [...root.querySelectorAll('[role="tabpanel"]:not([hidden])')].map(pane => ({ width: pane.clientWidth, content: pane.scrollWidth })),
      thread: composer ? box(root.querySelector('.agent-view__thread')) : null,
      cards: [...root.querySelectorAll('.agent-view__hole-card')].map(card => {
        const rank = card.querySelector('div > div');
        const suit = card.querySelector('svg');
        return [rank, suit].map(mark => {
          const r = mark.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { visible: !!hit && card.contains(hit), box: box(mark) };
        });
      }) };
    holes.style.pointerEvents = pointerEvents;
    return result;
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport.width + 1);
  expect(geometry.boxes[1].height).toBeGreaterThanOrEqual(44);
  for (const pane of geometry.panes) expect(pane.content).toBeLessThanOrEqual(pane.width + 1);
  if (geometry.thread) expect(geometry.thread.height).toBeGreaterThanOrEqual(geometry.viewport.height <= 480 ? 40 : 100);
  for (const box of geometry.boxes) {
    expect(box.width).toBeGreaterThan(0); expect(box.height).toBeGreaterThan(0);
    expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(geometry.viewport.width + 1);
    expect(box.bottom).toBeLessThanOrEqual(geometry.viewport.height + 1);
  }
  for (const card of geometry.cards) for (const mark of card) expect(mark.visible, JSON.stringify(mark)).toBe(true);
  return geometry;
}

async function statsFromServer(menu) {
  const stats = menu.getByRole('tabpanel', { name: 'Stats', exact: true });
  await expect(stats).toBeVisible();
  const career = stats.getByRole('region', { name: 'Career', exact: true });
  await expect(career.getByText('Hands', { exact: true }).locator('..')).toContainText('140');
  await expect(career.getByText('Win rate', { exact: true }).locator('..')).toContainText('39.3%');
  await expect(career.getByText('Biggest pot', { exact: true }).locator('..')).toContainText('620');
  await expect(stats.getByRole('region', { name: 'Skills', exact: true })).toContainText('READS');
}

for (const size of [{ width: 390, height: 844 }, { width: 390, height: 590 }, { width: 1440, height: 900 }]) {
  test(`character menu retains the companion, cards and draft; saves a real look at ${size.width}x${size.height}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    const { requests, errors } = await connect(page);
    await page.goto('/');
    const menu = await openCharacter(page, size.width);
    const stage = menu.getByTestId('agent-stage'), cards = menu.getByTestId('agent-view-hole');
    const originalStage = await stage.elementHandle(), originalCards = await cards.elementHandle();
    await expect(cards.locator('.agent-view__hole-card')).toHaveCount(2);
    const cardsBefore = await cards.textContent();
    expect((await rpc('state')).agent.liveGame.heroHole).toHaveLength(2);
    const draft = menu.getByPlaceholder('Whisper to him…', { exact: true });
    await expect(menu.locator('.agent-view__thread')).toContainText('I remember the river read.');
    await draft.fill('Keep my unfinished thought while I check your look.');
    const chatGeometry = await visibleGeometry(page, menu);
    await page.screenshot({ path: info.outputPath(`character-chat-${size.width}x${size.height}.png`), animations: 'disabled' });

    await menu.getByRole('tab', { name: 'Stats', exact: true }).click();
    await statsFromServer(menu);
    await visibleGeometry(page, menu);
    expect(await stage.evaluate((element, original) => element === original, originalStage)).toBe(true);
    await page.screenshot({ path: info.outputPath(`character-stats-${size.width}x${size.height}.png`), animations: 'disabled' });

    await menu.getByRole('tab', { name: 'Wardrobe', exact: true }).click();
    const wardrobe = menu.getByRole('tabpanel', { name: 'Wardrobe', exact: true });
    await wardrobe.getByRole('button', { name: 'Rail cap', exact: true }).click();
    await wardrobe.getByRole('button', { name: 'Round glasses', exact: true }).click();
    expect((await rpc('state')).saved.identity).toEqual({ hood: 'indigo', glow: 'violet' });
    await wardrobe.getByRole('button', { name: 'Try on', exact: true }).click();
    await expect(stage.locator('.mood-ghost')).toHaveAttribute('data-hood', 'indigo');
    expect((await rpc('state')).saved.identity).toEqual({ hood: 'indigo', glow: 'violet' });
    await visibleGeometry(page, menu);
    expect(await cards.evaluate((element, original) => element === original, originalCards)).toBe(true);
    await expect(cards).toHaveText(cardsBefore);

    // A refused save cannot claim success or discard the chosen appearance.
    let attempts = 0;
    await page.route(`**/api/agents/${ID}`, async route => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 503, json: { error: 'Appearance could not be saved. Please try again.' } });
      await route.fallback();
    });
    await wardrobe.getByRole('button', { name: 'Save look', exact: true }).click();
    await expect(wardrobe.getByRole('alert')).toContainText(/save|try again/i);
    expect((await rpc('state')).saved.identity).toEqual({ hood: 'indigo', glow: 'violet' });
    await expect(wardrobe.getByRole('button', { name: 'Rail cap', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: info.outputPath(`character-save-error-${size.width}x${size.height}.png`), animations: 'disabled' });
    await wardrobe.getByRole('button', { name: 'Save look', exact: true }).click();
    await expect(wardrobe.getByText('Look saved.', { exact: true })).toBeVisible();
    expect((await rpc('state')).saved.identity).toEqual({ hood: 'indigo', glow: 'violet' });
    expect((await rpc('state')).saved.wardrobe.equipped).toEqual({ head: 'rail-cap', face: 'round-glasses', neck: null });
    await expect(stage.locator('[data-item=rail-cap]')).toBeVisible();
    await expect(stage.locator('[data-item=round-glasses]')).toBeVisible();
    expect(attempts).toBe(2);
    await visibleGeometry(page, menu);
    await page.screenshot({ path: info.outputPath(`character-wardrobe-${size.width}x${size.height}.png`), animations: 'disabled' });

    await menu.getByRole('tab', { name: 'Chat', exact: true }).click();
    await expect(draft).toHaveValue('Keep my unfinished thought while I check your look.');
    await expect(menu.locator('.agent-view__thread').getByText('I remember the river read.', { exact: true })).toHaveCount(1);
    expect(await stage.evaluate((element, original) => element === original, originalStage)).toBe(true);
    expect((await visibleGeometry(page, menu)).stage.height).toBe(chatGeometry.stage.height);
    await menu.getByRole('button', { name: size.width > 1000 ? 'Close panel' : 'Back', exact: true }).click();
    const reopened = await openCharacter(page, size.width);
    await expect(reopened.getByTestId('agent-stage').locator('.mood-ghost')).toHaveAttribute('data-hood', 'indigo');
    await page.reload();
    const reloaded = await openCharacter(page, size.width);
    await reloaded.getByRole('tab', { name: 'Wardrobe', exact: true }).click();
    await expect(reloaded.getByRole('button', { name: 'Rail cap', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(reloaded.getByRole('button', { name: 'Round glasses', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(reloaded.getByTestId('agent-stage').locator('[data-item=rail-cap]')).toBeVisible();
    // Taking off the hat is a real persisted change; his birth cloth stays.
    await reloaded.getByRole('button', { name: 'Rail cap', exact: true }).click();
    await reloaded.getByRole('button', { name: 'Try on', exact: true }).click();
    await reloaded.getByRole('button', { name: 'Save look', exact: true }).click();
    await expect(reloaded.getByText('Look saved.', { exact: true })).toBeVisible();
    expect((await rpc('state')).saved.wardrobe.equipped.head).toBeNull();
    expect((await rpc('state')).saved.identity).toEqual({ hood: 'indigo', glow: 'violet' });
    expect(requests.filter(r => r.path === '/api/agents/chat')).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const size of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`direct profile entry opens Stats inside the same character menu at ${size.width}`, async ({ page }, info) => {
    await page.setViewportSize(size);
    const { requests, errors } = await connect(page);
    await page.goto('/');
    await page.getByTestId('home-safe').click();
    await page.getByTestId('safe-sheet').getByRole('button', { name: 'GIVE to a pocket', exact: true }).click();
    await page.getByRole('button', { name: `Open ${NAME}'s profile`, exact: true }).click();
    const menu = page.locator('.agent-view').filter({ has: page.getByRole('tablist', { name: 'Character sections' }) });
    await expect(menu.getByRole('tab', { name: 'Stats', exact: true })).toHaveAttribute('aria-selected', 'true');
    await statsFromServer(menu);
    await expect(menu.getByTestId('agent-view-hole').locator('.agent-view__hole-card')).toHaveCount(2);
    await visibleGeometry(page, menu);
    await page.screenshot({ path: info.outputPath(`character-direct-stats-${size.width}.png`), animations: 'disabled' });
    await menu.getByRole('tab', { name: 'Chat', exact: true }).click();
    await expect(menu.getByPlaceholder('Whisper to him…', { exact: true })).toBeVisible();
    await expect(menu.locator('.agent-view__thread')).toContainText('I remember the river read.');
    expect(requests.filter(r => r.path === '/api/agents/chat')).toEqual([]);
    expect(errors).toEqual([]);
  });
}
