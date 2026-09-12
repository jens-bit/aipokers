import { test, expect } from '@playwright/test';
import { agent } from './show-home-fixtures.js';
import { rooms } from '../src/test/fixtures/rooms.js';

// This exercises the built app, authenticating through the existing owner or
// returning-guest entry. Only the network is scripted: Home, the guide, chat,
// and the casino are their real components. These checks establish behaviour;
// whether a newcomer understands it still requires the human playtest.
const OWNER = '4242';
const INIT_DATA = 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=first-session';
const AGENT = agent('first-clock', 'The Clock', {
  stats: { handsPlayed: 0 },
  careerStats: { hands: 0, sessions: 0, net: 0, biggestPot: 0, winRate: 0 },
  identity: { hood: 'sand', glow: 'gold' },
  chatHistory: [],
});
const QUIET_ROOMS = rooms.map(room => ({ ...room, tables: 0, seated: 0, hot: [], biggestPot: null }));
const STEPS = ['deal', 'preflop-call', 'flop', 'flop-bet', 'turn', 'river', 'river-bet', 'showdown', 'conversation', 'complete'];
const POINTER_TARGETS = {
  deal: '.watch-hero__body',
  'preflop-call': '.watch-felt__hero-cards',
  flop: '.watch-felt__board',
  'flop-bet': '.watch-hero__strip',
  turn: '.watch-felt__board',
  river: '.watch-felt__board',
  'river-bet': '.watch-hero__strip',
  showdown: '.watch-felt__won',
};
const VIEWPORTS = [
  { width: 390, height: 590 },
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
];

async function installSession(page, { guest = false } = {}) {
  const ownerId = guest ? 'guest_first_session' : OWNER;
  const requests = [], unexpected = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    requests.push({ path, method: request.method(), userId: url.searchParams.get('userId') });
    if (request.method() !== 'GET') {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 500, json: { error: 'The guided practice cannot mutate an API or call a model.' } });
    }
    let json;
    if (path === '/api/agents') json = { agents: [AGENT] };
    else if (path === `/api/agents/${AGENT.id}`) json = AGENT;
    else if (path.endsWith('/hands')) json = { recentHands: [] };
    else if (path.endsWith('/flagged')) json = { flaggedHands: [] };
    else if (path.endsWith('/attributes/log')) json = { entries: [] };
    else if (path.endsWith('/thread')) json = { sessionId: 'first-session', lines: [], count: 0 };
    else if (path.endsWith('/memory')) json = { memoryContext: '' };
    else if (path.endsWith('/study')) json = { study: null, book: [], count: 0 };
    else if (path === '/api/rooms') json = { rooms: QUIET_ROOMS, hotWindowMs: 20_000 };
    else if (/^\/api\/rooms\/[^/]+\/tables$/.test(path)) json = { tables: [] };
    else if (path === '/api/events') json = { events: [], lastId: 0 };
    else if (path === '/api/slots') json = { used: 1, cap: 4, next: null };
    else if (path === '/api/wallet') json = { balance: 12_000, staked: 0, session: 0, ledger: [] };
    else if (path === '/api/fridge') json = { items: [] };
    else if (path === '/api/auth/config') json = { botUsername: '', guest };
    else if (path === '/api/guest/me' && guest) json = { ownerId };
    else if (path === '/api/guest/link' && guest) json = { url: null };
    if (!json) {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 404, json: { error: 'Unscripted first-session route' } });
    }
    return route.fulfill({ json });
  });
  await page.addInitScript(({ ownerId, guest, initData, agents, rooms }) => {
    window.Telegram = { WebApp: {
      initData: guest ? '' : initData,
      initDataUnsafe: guest ? {} : { user: { id: Number(ownerId), first_name: 'Jens' } },
      get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    // Keep the record across reload, so a forbidden action cannot disappear
    // when testing resume. Playwright gives every test a fresh browser context.
    window.__firstSessionWire = JSON.parse(sessionStorage.getItem('first-session-test-wire') || '[]');
    class ScriptedSocket extends EventTarget {
      static OPEN = 1;
      OPEN = 1;
      readyState = 0;
      constructor(url) {
        super(); this.url = url;
        setTimeout(() => {
          if (this.readyState !== 0) return;
          this.readyState = 1;
          this.dispatchEvent(new Event('open'));
        }, 10);
      }
      close() { this.readyState = 3; }
      push(message) {
        if (this.readyState === 1) this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
      send(raw) {
        const message = JSON.parse(raw);
        window.__firstSessionWire.push(message);
        sessionStorage.setItem('first-session-test-wire', JSON.stringify(window.__firstSessionWire));
        if (message.type === 'floor_sub') setTimeout(() => {
          this.push({ type: 'home_state', userId: ownerId, agents, game: null });
          this.push({ type: 'floor_rooms', rooms });
          this.push({ type: 'room_tables', tables: [], rooms: {} });
        }, 10);
      }
    }
    window.WebSocket = ScriptedSocket;
  }, { ownerId, guest, initData: INIT_DATA, agents: [AGENT], rooms: QUIET_ROOMS });
  return { ownerId, requests, unexpected, errors };
}

async function openHome(page) {
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

async function openPractice(page) {
  await page.getByRole('button', { name: `Learn with ${AGENT.name}`, exact: true }).click();
  await expectStep(page, 'deal');
}

async function expectStep(page, step) {
  const guide = page.getByTestId('guided-practice');
  await expect(guide).toHaveAttribute('data-step', step);
  await expect(page.getByTestId('practice-role')).toHaveText(`You are watching. ${AGENT.name} is playing.`);
  return guide;
}

async function next(page, step) {
  await page.getByTestId('guided-practice').getByRole('button', { name: 'Next', exact: true }).click();
  await expectStep(page, step);
}

async function expectPointer(page, step) {
  const pointer = page.getByTestId('practice-pointer');
  const target = page.getByTestId('guided-practice').locator(POINTER_TARGETS[step]);
  await expect(pointer).toBeVisible();
  // A visible arrow in the wrong place teaches the wrong control. Compare
  // actual post-layout bounds, including the responsive felt's scale.
  await expect.poll(async () => {
    const [highlight, subject] = await Promise.all([pointer.boundingBox(), target.boundingBox()]);
    return !!highlight && !!subject && ['x', 'y', 'width', 'height'].every(key => Math.abs(highlight[key] - subject[key]) <= 2);
  }).toBe(true);
  await expect.poll(async () => {
    const [label, scene] = await Promise.all([
      pointer.locator('.practice-pointer > span').boundingBox(),
      page.locator('.practice-scene').boundingBox(),
    ]);
    return !!label && !!scene && label.x >= scene.x && label.y >= scene.y
      && label.x + label.width <= scene.x + scene.width
      && label.y + label.height <= scene.y + scene.height;
  }).toBe(true);
}

async function reachConversation(page) {
  for (const step of STEPS.slice(1, -1)) await next(page, step);
  await expect(page.getByTestId('practice-conversation').getByRole('button')).toHaveCount(3);
}

async function expectNoGameMutation(page, fixture) {
  const forbidden = await page.evaluate(() => window.__firstSessionWire.filter(message => ['join', 'action', 'deal', 'watch', 'chat'].includes(message.type)));
  expect(forbidden).toEqual([]);
  expect(fixture.requests.filter(request => request.method !== 'GET')).toEqual([]);
  expect(fixture.unexpected).toEqual([]);
  expect(fixture.errors).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  test(`FIRST-SESSION: optional first offer and guided hand at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const fixture = await installSession(page);
    await openHome(page);
    await expect(page.getByRole('button', { name: 'Not now', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('home-offer.png'), fullPage: true });
    await openPractice(page);
    const guide = page.getByTestId('guided-practice');
    await expect(guide).toContainText(/practice|example/i);
    await expect(guide.getByRole('button', { name: 'Back', exact: true })).toBeDisabled();
    await expect(guide.getByRole('button', { name: 'Leave practice', exact: true })).toBeVisible();
    await expect(guide.locator('.watch-felt')).toBeVisible();
    await expectPointer(page, 'deal');
    await expect(guide.locator('.watch-felt').getByText('Q', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('deal.png'), fullPage: true });

    // Fast-forward well beyond a normal hand, without advancing the lesson.
    await page.clock.install();
    await page.clock.fastForward(90_000);
    await expectStep(page, 'deal');
    await next(page, 'preflop-call');
    await guide.getByRole('button', { name: 'Back', exact: true }).click();
    await expectStep(page, 'deal');
    for (const step of STEPS.slice(1, 7)) {
      await next(page, step);
      await expectPointer(page, step);
      await expect(guide.locator('.watch-felt').getByText('Q', { exact: true })).toHaveCount(0);
    }
    await next(page, 'showdown');
    await expectPointer(page, 'showdown');
    await expect(page.getByTestId('practice-hand')).toContainText(/full house/i);
    await expect(page.getByTestId('practice-result')).toContainText('28');
    await expect(page.getByTestId('practice-result')).toContainText('+14');
    await expect(guide.locator('.watch-felt').getByText('Q', { exact: true })).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath('showdown.png'), fullPage: true });
    const result = page.getByTestId('practice-result');
    await result.getByText('+14 chips', { exact: true }).scrollIntoViewIfNeeded();
    await expect(result.getByText('+14 chips', { exact: true })).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('result-details.png'), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await expectNoGameMutation(page, fixture);
  });
}

test('FIRST-SESSION: leaving saves the step, reload resumes, and replay resets the lesson', async ({ page }) => {
  const fixture = await installSession(page);
  await openHome(page);
  await openPractice(page);
  await next(page, 'preflop-call');
  await next(page, 'flop');
  await page.getByRole('button', { name: 'Leave practice', exact: true }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Resume practice', exact: true }).click();
  await expectStep(page, 'flop');
  for (const step of STEPS.slice(3, 8)) await next(page, step);
  await page.getByRole('button', { name: 'Leave practice', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Resume practice', exact: true }).click();
  await expectStep(page, 'showdown');
  await expect(page.getByTestId('practice-result')).toContainText('+14');
  await next(page, 'conversation');
  const finish = page.getByRole('button', { name: 'Finish practice', exact: true });
  await expect(finish).toBeDisabled();
  // The explanatory choices are read-only guidance, not fabricated messages
  // attributed to the live companion or stored in his conversation.
  await page.locator('.practice-questions').getByRole('button').first().click();
  await expect(page.getByText(/^guided explanation$/i)).toBeVisible();
  await expect(finish).toBeEnabled();
  await finish.click();
  await expectStep(page, 'complete');
  await page.getByRole('button', { name: 'Back home', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Learn the table', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Not now', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Learn the table', exact: true }).click();
  await expectStep(page, 'deal');
  await expectNoGameMutation(page, fixture);
});

test('FIRST-SESSION: returning guest sees the chat requirement and can keep exploring', async ({ page }) => {
  const fixture = await installSession(page, { guest: true });
  await openHome(page);
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Learn the table', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Learn the table', exact: true }).click();
  await expectStep(page, 'deal');
  await reachConversation(page);
  await page.locator('.practice-questions').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Finish practice', exact: true }).click();
  await expectStep(page, 'complete');
  await expect(page.getByText('Sign in to send your own messages. You can keep exploring as a guest.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Sign in to chat with ${AGENT.name}`, exact: true }).click();
  const claim = page.getByRole('dialog', { name: 'Keep him', exact: true });
  await expect(claim).toBeVisible();
  await expect(page.getByPlaceholder('Whisper to him…')).toHaveCount(0);
  await claim.getByRole('button', { name: 'keep playing as a guest', exact: true }).click();
  await expect(claim).toHaveCount(0);
  await expectStep(page, 'complete');
  await page.getByRole('button', { name: 'Explore casino', exact: true }).click();
  await expect(page.getByTestId('guided-practice')).toHaveCount(0);
  await expect(page.getByTestId('floor-view')).toHaveAttribute('data-room', 'floor');
  await page.getByRole('button', { name: 'Back home', exact: true }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  expect(fixture.requests).toEqual(expect.arrayContaining([
    expect.objectContaining({ method: 'GET', path: '/api/guest/me' }),
    expect.objectContaining({ method: 'GET', path: '/api/agents', userId: fixture.ownerId }),
  ]));
  await expectNoGameMutation(page, fixture);
});

test('FIRST-SESSION: desktop casino follow-up cannot become a stale practice return', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const fixture = await installSession(page);
  await openHome(page);
  await openPractice(page);
  await reachConversation(page);
  await page.locator('.practice-questions').getByRole('button').first().click();
  await page.getByRole('button', { name: 'Finish practice', exact: true }).click();
  await page.getByRole('button', { name: 'Explore casino', exact: true }).click();
  await expect(page.getByTestId('floor-view')).toHaveAttribute('data-room', 'floor');
  await page.locator('.dsk-top').getByRole('button', { name: 'Back home', exact: true }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Learn the table', exact: true }).click();
  await expectStep(page, 'deal');
  await page.getByRole('button', { name: 'Leave practice', exact: true }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('floor-view')).toHaveCount(0);
  await expectNoGameMutation(page, fixture);
});
