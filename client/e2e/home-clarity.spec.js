import { test, expect } from '@playwright/test';

// Real rendered routes/taps with controlled server responses; no accounts,
// models or production data. Delay the roster independently of the thread.
const agents = ['The Clock', 'River Rat', 'Wild Card', 'Loose Cannon'].map((name, i) => ({
  id: `a${i}`, name, nature: { name: 'Rock' }, style: 'Balanced', risk: 'Medium',
  mood: { state: 'neutral', heat: 30 }, fatigue: 'fresh', stats: { handsPlayed: 20 },
  careerStats: { hands: 20, sessions: 2, net: 100, biggestPot: 80 },
  pocket: { balance: 2000, mode: 'topup', cap: null }, sessionLog: [],
  routine: i === 3 ? null : { key: 'plays', label: 'in a hand' }, want: null,
  opener: 'I am watching the hand.', unseenRecap: false,
  activeTableId: i === 3 ? 'casino-one' : null,
  location: { where: i === 3 ? 'table' : 'home', tableId: i === 3 ? 'casino-one' : null, room: i === 3 ? 'floor' : null, since: Date.now() },
}));
const game = { tableId: 'home-4242', state: 'running', maxSeats: 4, handsPlayed: 4,
  seats: agents.slice(0, 3).map((agent, seat) => ({ seat, agentId: agent.id, name: agent.name, stack: 200 })) };

async function stub(page, { delayed = false, failed = false, empty = false, full = false, paced = false } = {}) {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  let ready = !delayed && !failed;
  const roster = empty ? [] : agents;
  const homeGame = empty ? null : full ? { ...game, seats: [game.seats[0], game.seats[1],
    { seat: 2, agentId: null, name: 'House', house: true }, { seat: 3, agentId: null, name: 'YOU' }] } : game;
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/agents') {
      if (!ready && delayed) await wait;
      if (!ready && failed) return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: { agents: roster } });
    }
    if (url.pathname === '/api/slots') return route.fulfill({ json: { used: roster.length, cap: 4,
      next: empty ? { index: 1, price: 0, earned: 0, unlocked: true } : null } });
    if (url.pathname === '/api/wallet') return route.fulfill({ json: { balance: 54000, staked: 0, ledger: [] } });
    if (url.pathname.includes('/thread')) return route.fulfill({ json: { lines: [], count: 0, sessionId: 'home' } });
    if (url.pathname.includes('/study')) return route.fulfill({ json: { book: [], study: null, count: 0 } });
    if (url.pathname === '/api/auth/config') return route.fulfill({ json: { botUsername: '' } });
    if (url.pathname === '/api/rooms') return route.fulfill({ json: { rooms: [], hotWindowMs: 20000 } });
    return route.fulfill({ json: { events: [], lastId: 0, items: [] } });
  });
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.addInitScript(({ roster, homeGame, ready, paced }) => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
      initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
      get viewportHeight() { return window.innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    window.__claritySent = [];
    const sockets = [];
    let released = ready;
    const home = { type: 'home_state', userId: '4242', agents: roster, game: homeGame };
    window.__clarityRelease = () => { released = true; sockets.filter(s => s.subscribed).forEach(s => s.emit(home)); };
    window.__clarityPace = board => sockets.filter(s => s.homeTable && s.readyState === 1).forEach(s => s.emit({
      type: 'pace', tableId: homeGame.tableId, pace: 'showdown', board, card: board.at(-1),
    }));
    class Socket {
      constructor() { this.readyState = 0; this.OPEN = 1; this.listeners = {}; sockets.push(this);
        setTimeout(() => { this.readyState = 1; this.dispatch('open', {}); }, 20); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      dispatch(type, event) { (this.listeners[type] ?? []).forEach(fn => fn(event)); }
      emit(message) { this.dispatch('message', { data: JSON.stringify(message) }); }
      send(raw) {
        const message = JSON.parse(raw); window.__claritySent.push(message);
        if (message.type === 'floor_sub') { this.subscribed = true; if (released) this.emit(home); }
        if (message.type !== 'join' && message.type !== 'watch') return;
        this.homeTable = message.tableId === homeGame?.tableId;
        const sitting = message.type === 'join';
        setTimeout(() => {
          this.emit(sitting ? { type: 'joined', tableId: homeGame.tableId, seat: 3, waitingForNextHand: true }
            : { type: 'watching', tableId: homeGame.tableId, seat: -1, publicOnly: true });
          this.emit({ type: 'state', yourSeat: sitting ? 3 : -1, waitingForNextHand: sitting, legalActions: [], state: {
            tableId: homeGame.tableId, handNumber: 4, street: 'flop', pace: 'calm', pot: 20,
            smallBlind: 1, bigBlind: 2, currentBet: 0, toAct: 0, community: ['5c', '4h', '8c'],
            seats: homeGame.seats.map(s => ({ seat: s.seat, playerId: `p${s.seat}`, displayName: s.name, stack: 200, holeCards: [] })),
            waitingForNextHand: sitting,
            ...(paced ? { street: 'complete', pace: 'allin', community: ['5c', '4h', '8c', 'Ks', '2d'],
              paceFrame: { pace: 'allin', board: ['5c', '4h', '8c'], card: null } } : {}),
          } });
        }, 20);
      }
      close() { this.readyState = 3; }
    }
    Socket.OPEN = 1; window.WebSocket = Socket;
  }, { roster, homeGame, ready, paced });
  return async () => { ready = true; release(); await page.evaluate(() => { window.__clarityRelease(); window.dispatchEvent(new Event('focus')); }); };
}

for (const viewport of [{ width: 390, height: 590 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  const size = `${viewport.width}x${viewport.height}`;
  test(`BUG-154/157: saved household loads without false empty, then the actual Sit and Watch taps work at ${size}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const release = await stub(page, { delayed: true });
    await page.goto('/');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByText('Reading the room…').first()).toBeVisible();
    await expect(page.getByText(/Your room · his story starts here|Nobody is home/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Draft your first agent/i })).toHaveCount(0);
    await expect(page.getByTestId('home-game-label')).toHaveCount(0);
    await page.screenshot({ path: `../artifacts/clarity-loading-${size}.png` });
    await release();
    await expect(page.getByTestId('home-frame-a3')).toBeVisible();
    await expect(page.getByText('Reading the room…')).toHaveCount(0);
    await page.getByTestId('home-table').click({ position: { x: 55, y: 50 } });
    const table = page.getByTestId('home-table-sheet');
    const preview = table.getByTestId('home-table-preview');
    await expect(preview.getByLabel('Community cards: 5c 4h 8c')).toBeVisible();
    await expect(preview.getByRole('img')).toHaveCount(3);
    await expect(preview).toHaveCSS('height', '92px');
    if (viewport.width === 390) await expect(preview).toHaveCSS('width', '358px');
    await expect(table.getByTestId('home-table-seated')).toHaveText('3 at the table · 1 chair free');
    await expect(table.getByTestId('home-table-full')).toHaveText('Your roster has 4 of 4 agents. Retire an agent to create another.');
    await expect(table.getByTestId('home-table-sit')).toBeEnabled();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.target?.classList?.contains('home-sheet__panel')).map(a => a.finished)); });
    await page.screenshot({ path: `../artifacts/clarity-table-${size}.png` });
    await table.screenshot({ path: `../artifacts/clarity-table-crop-${size}.png` });
    await table.getByTestId('home-table-sit').click();
    await expect(page.getByText('NEXT HAND', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__claritySent.some(m => m.type === 'join' && m.tableId === 'home-4242'))).toBe(true);
    await page.getByRole('button', { name: viewport.width >= 1100 ? 'Back to the room' : 'Leave table', exact: true }).click();
    await page.getByTestId('home-table').click({ position: { x: 55, y: 50 } });
    await page.getByTestId('home-table-watch').click();
    await expect(page.locator('.watch-felt')).toBeVisible();
  });

  test(`BUG-154: House and human fill actual chairs while Watch stays usable at ${size}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stub(page, { full: true });
    await page.goto('/');
    await expect(page.getByTestId('home-frame-a3')).toBeVisible();
    await page.getByTestId('home-table').click({ position: { x: 55, y: 50 } });
    const table = page.getByTestId('home-table-sheet');
    await expect(table.getByTestId('home-table-seated')).toHaveText('4 at the table · 0 chairs free');
    await expect(table.getByTestId('home-table-sit')).toBeDisabled();
    await expect(table.getByText('This game is full. Watch until a chair opens.')).toBeVisible();
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.target?.classList?.contains('home-sheet__panel')).map(a => a.finished)); });
    await page.screenshot({ path: `../artifacts/clarity-full-${size}.png` });
    await table.getByTestId('home-table-watch').click();
    await expect(page.locator('.watch-felt')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__claritySent.filter(m => m.type === 'join').length)).toBe(0);
  });
}

for (const width of [390, 1440]) test(`BUG-157: a failed initial read can recover, and a confirmed new owner stays empty at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  const release = await stub(page, { failed: true });
  await page.goto('/');
  await expect(page.getByText('Reading the room…').first()).toBeVisible();
  await expect(page.getByText(/Your room · his story starts here|Nobody is home/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Draft your first agent/i })).toHaveCount(0);
  await release();
  await expect(page.getByTestId('home-frame-a3')).toBeVisible();
  await expect(page.getByText('Reading the room…')).toHaveCount(0);
  await page.unroute('**/api/**');
  await stub(page, { empty: true });
  await page.goto('/');
  await expect(page.getByText('Your room · his story starts here')).toBeVisible();
  await expect(page.getByRole('button', { name: /Draft your first agent/i }).first()).toBeVisible();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  const size = `${viewport.width}x${viewport.height}`;
  test(`BUG-144/154: Home and its preview both respect the server's three-four-five card runout at ${size}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stub(page, { paced: true });
    await page.goto('/');
    const roomBoard = page.getByTestId('home-board');
    await expect(roomBoard).toHaveText('548');
    await expect(roomBoard.locator(':scope > div')).toHaveCount(3);
    const watchers = await page.evaluate(() => window.__claritySent.filter(m => m.type === 'watch' && m.tableId === 'home-4242').length);
    expect(watchers).toBe(1);
    await page.getByTestId('home-table').click({ position: { x: 55, y: 50 } });
    const preview = page.getByTestId('home-table-preview');
    await expect(preview.getByLabel('Community cards: 5c 4h 8c')).toBeVisible();
    await expect(preview.locator('.table-sheet__board > div')).toHaveCount(3);
    await expect(preview.getByText('K', { exact: true })).toHaveCount(0);
    await expect(preview.getByText('2', { exact: true })).toHaveCount(0);
    if (viewport.width === 390) await expect(preview).toHaveCSS('width', '358px');
    // Opening the preview consumes the room's existing watch, rather than
    // joining the table or starting a second spectator subscription.
    expect(await page.evaluate(() => window.__claritySent.filter(m => m.type === 'watch' && m.tableId === 'home-4242').length)).toBe(watchers);
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.target?.classList?.contains('home-sheet__panel')).map(a => a.finished)); });
    await page.screenshot({ path: `../artifacts/preview-runout-3-${size}.png` });

    await page.evaluate(() => window.__clarityPace(['5c', '4h', '8c', 'Ks']));
    await expect(roomBoard).toHaveText('548K');
    await expect(roomBoard.locator(':scope > div')).toHaveCount(4);
    await expect(preview.getByLabel('Community cards: 5c 4h 8c Ks')).toBeVisible();
    await expect(preview.locator('.table-sheet__board > div')).toHaveCount(4);
    await expect(preview.getByText('2', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `../artifacts/preview-runout-4-${size}.png` });

    await page.evaluate(() => window.__clarityPace(['5c', '4h', '8c', 'Ks', '2d']));
    await expect(roomBoard).toHaveText('548K2');
    await expect(roomBoard.locator(':scope > div')).toHaveCount(5);
    await expect(preview.getByLabel('Community cards: 5c 4h 8c Ks 2d')).toBeVisible();
    await expect(preview.locator('.table-sheet__board > div')).toHaveCount(5);
    await page.screenshot({ path: `../artifacts/preview-runout-5-${size}.png` });
  });
}
