import { contrastOf } from './contrast.js';
import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { agent } from './show-home-fixtures.js';

// API/WebSocket fixtures render the actual Home → WATCH route. This is not a
// real-server test: explicitly serving production's public seat -1 prevents
// keyless local development's seat-0 shortcut from masking WATCH-PUBLIC-1.
const OWNER = '4242';
const TABLE = 'home-public-4242';
const PEBBLE = agent('pebble', 'Pebble', { identity: { hood: 'moss', glow: 'ice' },
  routine: { key: 'plays', label: 'in a hand' }, mood: { state: 'neutral', heat: 18 } });
const SEATS = [
  { playerId: 'agent_pebble', displayName: 'Pebble', stack: 117, holeCards: [],
    identity: PEBBLE.identity, mood: PEBBLE.mood, fatigue: 'fresh', contribTotal: 2, contribThisStreet: 0, folded: false },
  { playerId: 'house_granite', displayName: 'Granite', stack: 279, holeCards: [],
    identity: null, mood: { state: 'neutral', heat: 30 }, contribTotal: 2, contribThisStreet: 0, folded: false },
];
const HOME_GAME = { tableId: TABLE, state: 'running', maxSeats: 4, handsPlayed: 1, seats: [
  { seat: 0, agentId: PEBBLE.id, name: PEBBLE.name, stack: 117 },
  { seat: 1, agentId: null, name: 'Granite', house: true, stack: 279 },
] };
const GAME = { tableId: TABLE, handNumber: 1, street: 'flop', pace: 'calm', pot: 4,
  smallBlind: 1, bigBlind: 2, currentBet: 0, toAct: 0, community: ['5c', '4h', '8c'],
  seats: SEATS, heroEquity: null, heroHand: null,
  lastAction: { handNumber: 1, seq: 3, street: 'flop', seat: 1, type: 'call', amount: 1 } };

async function installPublicHome(page, theme) {
  const errors = [], unexpected = [], writes = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') {
      writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 500, json: { error: 'Public Watch must not write.' } });
    }
    let json;
    if (path === '/api/agents') json = { agents: [PEBBLE] };
    else if (path === '/api/agents/pebble') json = PEBBLE;
    else if (path.endsWith('/hands')) json = { recentHands: [] };
    else if (path.endsWith('/flagged')) json = { flaggedHands: [] };
    else if (path.endsWith('/thread')) json = { sessionId: 'home', lines: [], count: 0 };
    else if (path.endsWith('/memory')) json = { memoryContext: '' };
    else if (path.endsWith('/study')) json = { study: null, book: [], count: 0 };
    else if (path.endsWith('/attributes/log')) json = { entries: [] };
    else if (path === '/api/rooms') json = { rooms: [] };
    else if (path === '/api/events') json = { events: [], lastId: 0 };
    else if (path === '/api/slots') json = { used: 1, cap: 4, next: null };
    else if (path === '/api/wallet') json = { balance: 8000, staked: 0, session: 0, ledger: [] };
    else if (path === '/api/fridge') json = { items: [] };
    else if (path === '/api/auth/config') json = { botUsername: '', guest: false };
    else {
      unexpected.push(`GET ${path}`);
      return route.fulfill({ status: 404, json: {} });
    }
    return route.fulfill({ json });
  });
  await page.addInitScript(({ owner, record, home, game, theme }) => {
    localStorage.setItem('railbird.home.appearance', theme);
    localStorage.setItem(`railbird.guide.v1:${owner}`, JSON.stringify({ version: 1, seen: true }));
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=public-watch-fixture',
      initDataUnsafe: { user: { id: Number(owner), first_name: 'Jens' } },
      get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    window.__publicWatchWire = [];
    window.__publicWatchViews = [];
    class PublicSocket extends EventTarget {
      static OPEN = 1;
      OPEN = 1;
      readyState = 0;
      constructor(url) {
        super(); this.url = url;
        setTimeout(() => {
          if (this.readyState !== 0) return;
          this.readyState = 1; this.dispatchEvent(new Event('open'));
        }, 10);
      }
      close() { this.readyState = 3; }
      push(message) {
        if (this.readyState === 1) this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
      send(raw) {
        const message = JSON.parse(raw);
        window.__publicWatchWire.push(message);
        if (message.type === 'floor_sub') setTimeout(() => {
          this.push({ type: 'home_state', userId: owner, agents: [record], game: home });
          this.push({ type: 'floor_rooms', rooms: [] });
          this.push({ type: 'room_tables', tables: [], rooms: {} });
        }, 10);
        if (message.type === 'watch' && message.tableId === game.tableId) setTimeout(() => {
          window.__publicWatchViews.push({ spectatorSeat: -1, publicOnly: true });
          this.push({ type: 'watching', tableId: game.tableId, spectatorSeat: -1, publicOnly: true });
          this.push({ type: 'state', yourSeat: -1, legalActions: [], state: game });
        }, 10);
      }
    }
    window.WebSocket = PublicSocket;
  }, { owner: OWNER, record: PEBBLE, home: HOME_GAME, game: GAME, theme });
  return { errors, unexpected, writes };
}


const CASES = [
  { theme: 'day', viewport: { width: 390, height: 844 } },
  { theme: 'day', viewport: { width: 390, height: 590 } },
  { theme: 'day', viewport: { width: 1440, height: 900 } },
  { theme: 'dusk', viewport: { width: 390, height: 844 } },
  { theme: 'night', viewport: { width: 390, height: 844 } },
];
for (const { theme, viewport } of CASES) {
  test(`WATCH-PUBLIC-1: real Home Watch with public seat -1 in ${theme} at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const fixture = await installPublicHome(page, theme);
    await page.goto('/');
    const home = page.getByTestId('home-screen');
    await expect(home).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-appearance', theme);
    await expect(home.locator('.home-one[data-agent="pebble"]')).toBeVisible();
    await home.getByTestId('home-table').click();
    const watch = page.getByTestId('home-table-watch');
    await expect(watch).toBeEnabled();
    await watch.click();
    const desktop = viewport.width >= 1100;
    const table = desktop ? page.getByTestId('desk-home-table') : page.locator('.watch-screen');
    await expect(table).toBeVisible();
    const hero = table.locator('.watch-hero');
    await expect(hero).toBeVisible();
    await expect(hero.locator('.mood-ghost')).toHaveAttribute('data-hood', 'moss');
    const name = hero.locator('.watch-felt__hero-lbl[title="Pebble"]');
    await expect(name).toHaveText('Pebble');
    await expect(name).toBeInViewport();
    const foregroundStack = table.locator('.watch-felt__hero-stack');
    await expect(foregroundStack).toContainText('$117');
    await expect(foregroundStack).toBeInViewport();
    const opponent = table.locator('.watch-felt__seat');
    await expect(opponent).toHaveCount(1);
    await expect(opponent).toContainText('Granite');
    await expect(opponent).toContainText('$279');
    await expect(opponent).toBeInViewport();
    await expect(hero.locator('.watch-hero__cards')).toHaveText('');
    await expect(hero.locator('.watch-felt__hero-card')).toHaveCount(2);
    await expect(table.getByRole('button', { name: /^(CHECK|CALL|FOLD|RAISE|DEAL)$/ })).toHaveCount(0);
    if (!desktop) {
      // DeskHomeTable has no narrator; the phone's existing narrator must keep
      // the server actor, independently from its resolved foreground camera.
      await expect(table.locator('.action-narrator')).toHaveText('Granite calls $1.');
      const header = table.locator('.watch-screen__header');
      await expect(header.locator('.watch-screen__title')).toHaveText('Watching');
      await expect(header).not.toContainText('Jens');
      await expect(header.locator('.floor-mood-chip')).toHaveCount(0);
      await expect(table.getByPlaceholder('Whisper to him…', { exact: true })).toBeDisabled();
    }
    await page.evaluate(() => document.fonts.ready);
    await expect(hero.locator('.watch-felt__hero-card').first()).toHaveCSS('opacity', '1');
    await expect(hero.locator('.watch-felt__hero-card').last()).toHaveCSS('opacity', '1');
    const contrastTargets = [
      ['foreground name', name, 4.5],
      ['opponent name', opponent.locator('.seat-ghost__name'), 4.5],
      ['foreground stack', foregroundStack.locator('.chip-stack__amt'), 4.5],
      ['opponent stack', opponent.locator('.chip-stack__amt'), 4.5],
      ['pot amount', table.locator('.watch-felt__pot-amt'), 4.5],
      ['pot label', table.locator('.watch-felt__pot-label'), 3],
      ['stack label', foregroundStack.locator('.chip-stack__label'), 3],
    ];
    if (!desktop) {
      const live = table.locator('.floor-state-tag > span').getByText('LIVE', { exact: true });
      contrastTargets.push(['LIVE', live, 4.5]);
    }
    const contrast = [];
    for (const [label, target, minimum] of contrastTargets) {
      await expect(target).toBeInViewport();
      contrast.push({ label, minimum, ...await contrastOf(target) });
    }
    const contrastPath = testInfo.outputPath('public-watch-contrast.json');
    await writeFile(contrastPath, JSON.stringify({ theme, viewport, method: 'Computed colors composited over actual ancestor backgrounds; conservative minimum across the felt gradient.', contrast }, null, 2));
    await testInfo.attach('public-watch-contrast', { path: contrastPath, contentType: 'application/json' });
    await page.screenshot({ path: testInfo.outputPath(`public-home-watch-${theme}.png`) });
    // Report all failing labels and still exercise the real read/return path.
    // Soft expectations remain test failures; neither thresholds nor coverage relax.
    for (const reading of contrast) expect.soft(reading.contrast, `${theme} ${reading.label}: ${JSON.stringify(reading)}`).toBeGreaterThanOrEqual(reading.minimum);

    await hero.getByRole('button', { name: desktop ? 'Read this player' : 'Read Pebble', exact: true }).click();
    const read = table.getByRole('dialog', { name: 'Pebble — read' });
    await expect(read).toBeVisible();
    await read.getByRole('button', { name: 'Close read', exact: true }).click();
    await expect(read).toHaveCount(0);
    await expect(name).toBeInViewport();
    // BUG-143: dismiss the actual opponent's read on exposed felt, keeping the
    // same Watch subscription. The foreground read alone missed this journey.
    const watchCount = await page.evaluate(() => window.__publicWatchWire.filter(m => m.type === 'watch').length);
    await opponent.locator('.seat-ghost').click();
    const opponentRead = table.getByRole('dialog', { name: 'Granite — read' });
    await expect(opponentRead).toBeVisible();
    await table.locator('.watch-felt').click({ position: { x: 10, y: 10 } });
    await expect(opponentRead).toHaveCount(0);
    await opponent.locator('.seat-ghost').click();
    await expect(opponentRead).toBeVisible();
    await opponentRead.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await opponentRead.getByRole('button', { name: 'Close read', exact: true }).click();
    await expect(opponentRead).toHaveCount(0);
    await expect(table).toBeVisible();
    expect(await page.evaluate(() => window.__publicWatchWire.filter(m => m.type === 'watch').length)).toBe(watchCount);
    await table.getByRole('button', { name: desktop ? 'Back to the room' : 'Stop watching', exact: true }).click();
    await expect(home).toBeVisible();
    const wire = await page.evaluate(() => window.__publicWatchWire);
    const views = await page.evaluate(() => window.__publicWatchViews);
    expect(views.length).toBeGreaterThan(0);
    expect(views.every(view => view.spectatorSeat === -1 && view.publicOnly)).toBe(true);
    expect(wire.filter(message => ['join', 'action', 'deal', 'chat'].includes(message.type))).toEqual([]);
    expect(wire.filter(message => message.type === 'watch').every(message => message.tableId === TABLE && !message.agentId)).toBe(true);
    expect(fixture.writes).toEqual([]); expect(fixture.unexpected).toEqual([]); expect(fixture.errors).toEqual([]);
    await testInfo.attach('public-watch-fixture-evidence', {
      body: JSON.stringify({ fixture: 'API/WebSocket, not a real server', theme, viewport, views, wire }, null, 2), contentType: 'application/json',
    });
  });
}
