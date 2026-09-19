import { test, expect } from '@playwright/test';
import { midHandGame } from '../src/test/fixtures/game.js';

const agents = ['Milo', 'River'].map((name, i) => ({
  id: i ? 'switch-b' : 'switch-a', name, style: 'Balanced', risk: 'Medium', nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 25 }, fatigue: 'fresh', unseenRecap: false,
  stats: { handsPlayed: 140 }, sessionLog: [], pocket: { balance: 2500 },
  activeTableId: `switch-table-${i}`, location: { where: 'casino', tableId: `switch-table-${i}`, room: 'floor' },
  liveGame: { tableId: `switch-table-${i}`, blinds: '10/20', pot: 100, street: 'flop' },
}));
const games = agents.map((agent, i) => ({
  ...midHandGame, tableId: agent.activeTableId, sessionId: `session-${agent.id}`, handNumber: 7,
  community: i ? ['9c', 'Th', 'Jc'] : ['2c', '3h', '4c'],
  seats: midHandGame.seats.map((seat, index) => index === (i ? 2 : 0)
    ? { ...seat, playerId: `agent_${agent.id}`, displayName: agent.name, holeCards: i ? ['Qs', 'Qh'] : ['As', 'Ah'] }
    : { ...seat, playerId: `house_${index}`, displayName: `House ${index}`, holeCards: [] }),
}));

async function fixture(page, { deferFirst = false } = {}) {
  let releaseFirst;
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (deferFirst && path === '/api/agents/switch-a/memory') {
      await new Promise(resolve => { releaseFirst = resolve; });
    }
    return route.fulfill({ json: path === '/api/agents' ? { agents }
      : path === '/api/wallet' ? { balance: 9000, ledger: [] }
      : path === '/api/slots' ? { used: 2, cap: 4, next: null }
      : path.includes('/memory') ? { memoryContext: '' }
      : path.includes('/thread') ? { sessionId: 'fixture', lines: [] }
      : { rooms: [], events: [], items: [], lastId: 0, recentHands: [], flaggedHands: [] } });
  });
  await page.addInitScript(({ agents, games }) => {
    window.Telegram = { WebApp: {
      initData: 'fixture', initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
      get viewportHeight() { return innerHeight; }, ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    const sockets = [];
    const observed = { requests: [], mixed: [], samples: 0 };
    window.__watchSwitch = observed;
    observed.queueCurrent = () => {
      const socket = sockets.filter(s => s.watch).at(-1);
      const game = games.find(g => g.tableId === socket.watch.tableId);
      // A real paced queue has old-table frames waiting when the viewer leaves.
      socket.push({ type: 'state', state: { ...game, pot: 240 }, legalActions: [] });
      socket.push({ type: 'state', state: { ...game, pot: 480 }, legalActions: [] });
    };
    observed.lateOldSocket = () => {
      const socket = sockets.filter(s => s.watch && s.readyState === 3).at(-1);
      const game = games.find(g => g.tableId === socket.watch.tableId);
      // Queued callbacks from a superseded socket include messages without a
      // table id, so table-id filtering alone cannot protect the next POV.
      socket.push({ type: 'watching', spectatorSeat: socket.watch.agentId === agents[0].id ? 0 : 2 });
      socket.push({ type: 'chat', seat: 0, displayName: 'STALE', text: 'OLD TABLE SPEECH', isAI: true });
      socket.push({ type: 'state', state: game, legalActions: [] });
      socket.emit('close', { code: 1006, reason: 'late old close', wasClean: false });
    };
    function sample() {
      const title = document.querySelector('.watch-screen__title')?.textContent
        || document.querySelector('[data-testid="desk-casino-table"]')?.getAttribute('aria-label');
      const i = agents.findIndex(a => title?.includes(a.name));
      if (i >= 0) {
        const board = [...document.querySelectorAll('.watch-felt__card')].map(el => el.textContent.trim());
        const hole = [...document.querySelectorAll('.watch-felt__hero-card')].map(el => el.textContent.trim());
        observed.samples++;
        if (board.some((rank, index) => rank && rank !== (games[i].community[index]?.[0] === 'T' ? '10' : games[i].community[index]?.[0]))
          || hole.some(rank => rank && rank !== (i ? 'Q' : 'A'))) observed.mixed.push({ title, board, hole });
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
    class Socket {
      static OPEN = 1;
      OPEN = 1; readyState = 0; listeners = {};
      constructor() { sockets.push(this); setTimeout(() => { this.readyState = 1; this.emit('open', {}); }, 10); }
      emit(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      push(value) { this.emit('message', { data: JSON.stringify(value) }); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      send(raw) {
        const message = JSON.parse(raw);
        if (message.type === 'home_sub') this.push({ type: 'home_state', userId: '4242', agents, game: null });
        if (message.type !== 'watch') return;
        this.watch = message; observed.requests.push({ tableId: message.tableId, agentId: message.agentId });
        const game = games.find(g => g.tableId === message.tableId);
        setTimeout(() => {
          const seat = message.agentId === agents[0].id ? 0 : 2;
          this.push({ type: 'watching', tableId: game.tableId, spectatorSeat: seat });
          this.push({ type: 'state', state: game, yourSeat: seat, legalActions: [] });
        }, 40);
      }
      close() { this.readyState = 3; this.emit('close', { code: 1000, wasClean: true }); }
    }
    window.WebSocket = Socket;
  }, { agents, games });
  await page.goto('/');
  await expect(page.getByTestId('home-frame-switch-a')).toBeVisible();
  return { releaseFirst: () => releaseFirst?.(), waitingFirst: () => !!releaseFirst };
}

async function assertTable(page, index) {
  await expect(page.locator('.watch-felt')).toBeVisible();
  await expect(page.locator('.watch-felt__card')).toHaveText([...games[index].community.map(card => card[0] === 'T' ? '10' : card[0]), '', '']);
  await expect(page.locator('.watch-felt__hero-card')).toHaveText(index ? ['Q', 'Q'] : ['A', 'A']);
}

for (const width of [390, 1440]) test(`WATCH-MULTI-1: repeated table switches keep cards and POV together at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await fixture(page);
  for (const [turn, index] of [0, 1, 0, 1].entries()) {
    await page.getByTestId(`home-frame-${agents[index].id}`).click();
    await assertTable(page, index);
    if (turn) {
      await page.evaluate(() => window.__watchSwitch.lateOldSocket());
      await assertTable(page, index);
      await expect(page.getByText('OLD TABLE SPEECH', { exact: true })).toHaveCount(0);
    }
    if (turn < 3) {
      await page.evaluate(() => window.__watchSwitch.queueCurrent());
      await page.getByRole('button', { name: width === 390 ? 'Leave table' : 'Back home', exact: true }).click();
      await expect(page.getByTestId('home-frame-switch-a')).toBeVisible();
    }
  }
  // Old close callbacks must not schedule a reconnect after the normal 1s delay.
  await page.waitForTimeout(1200);
  await assertTable(page, 1);
  const observation = await page.evaluate(() => ({ requests: window.__watchSwitch.requests,
    mixed: window.__watchSwitch.mixed, samples: window.__watchSwitch.samples }));
  expect(observation.requests).toEqual([0, 1, 0, 1].map(i => ({ tableId: agents[i].activeTableId, agentId: agents[i].id })));
  expect(observation.samples).toBeGreaterThan(5);
  expect(observation.mixed).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`watch-switch-${width}.png`) });
});

test('WATCH-MULTI-1: late optional memory cannot reopen the first selection', async ({ page }) => {
  const control = await fixture(page, { deferFirst: true });
  await page.getByTestId('home-frame-switch-a').click();
  await expect.poll(control.waitingFirst).toBe(true);
  await page.getByTestId('home-frame-switch-b').click();
  await assertTable(page, 1);
  control.releaseFirst();
  await page.waitForTimeout(150);
  await assertTable(page, 1);
  expect(await page.evaluate(() => window.__watchSwitch.requests)).toEqual([
    { tableId: agents[1].activeTableId, agentId: agents[1].id },
  ]);
});
