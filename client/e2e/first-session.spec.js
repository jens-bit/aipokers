import { test, expect } from '@playwright/test';
import { agent } from './show-home-fixtures.js';
import { rooms } from '../src/test/fixtures/rooms.js';

// Real Home, table sheet and Watch components; only their network is scripted.
// HOME_STATE and WATCHING/STATE match home-clarity's fixture. No engine/model
// runs. These checks establish behaviour, not newcomer comprehension.
const OWNER = '4242';
const INIT_DATA = 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=first-session';
const AGENT = agent('first-clock', 'The Clock', {
  stats: { handsPlayed: 0 },
  careerStats: { hands: 0, sessions: 0, net: 0, biggestPot: 0, winRate: 0 },
  identity: { hood: 'sand', glow: 'gold' },
  routine: { key: 'plays', label: 'in a hand' }, chatHistory: [],
});
const QUIET_ROOMS = rooms.map(room => ({ ...room, tables: 0, seated: 0, hot: [], biggestPot: null }));
const COPY = {
  agent: `This is ${AGENT.name}. Tap to talk.`,
  table: 'The kitchen table is where you watch or join a game.',
  watch: 'Watch the kitchen game here.',
  quiet: 'The kitchen is quiet; the casino has more tables.',
  door: 'The casino has tables for your agent.',
  board: 'You are watching. The AI players make their own decisions.',
  owned: 'You are watching. Your AI agent is playing.',
  chat: 'Talk to your agent here.',
  ownAgent: `This is ${AGENT.name}. Tap for stats and chat.`,
  opponent: 'An opponent. Tap to see what is known about them.',
};
const VIEWPORTS = [
  { width: 320, height: 590 }, { width: 390, height: 590 },
  { width: 390, height: 844 }, { width: 1440, height: 900 },
];

async function installSession(page, { guest = false, running = true, legacy = false, casino = null, privateChat = false } = {}) {
  const ownerId = guest ? 'guest_first_session' : OWNER;
  const tableId = `home-${ownerId}`;
  const casinoTableId = 'casino-first-session';
  const roomSnapshots = casino === 'join' ? QUIET_ROOMS.map((room, index) => index ? room : { ...room, tables: 1, seated: 2 }) : QUIET_ROOMS;
  const floorTables = casino === 'join' ? [{ tableId: casinoTableId, room: rooms[0].id,
    blinds: '10/20', smallBlind: 10, bigBlind: 20, seated: 2, pot: 20, board: ['5c', '4h', '8c'],
    seats: [{ seat: 0, name: 'Granite', stack: 2000 }, { seat: 1, name: 'Moss', stack: 2000 }] }] : [];
  const atCasino = { ...AGENT, activeTableId: casinoTableId,
    chatHistory: privateChat ? [{ role: 'user', content: 'x'.repeat(280) }] : [],
    location: { where: 'table', tableId: casinoTableId, room: rooms[0].id },
    liveGame: { tableId: casinoTableId, blinds: '10/20', pot: 20, street: 'flop' } };
  let record = casino === 'owned' ? atCasino : running ? AGENT : { ...AGENT, routine: { key: 'counts', label: 'counting chips' } };
  const homeGame = running ? { tableId, state: 'running', maxSeats: 4, handsPlayed: 1, seats: [
    { seat: 0, agentId: AGENT.id, name: AGENT.name, stack: 200 },
    { seat: 1, agentId: null, name: 'House', house: true, stack: 200 },
  ] } : null;
  const requests = [], unexpected = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    requests.push({ path, method: request.method(), userId: url.searchParams.get('userId') });
    if (casino && request.method() === 'POST' && path === `/api/agents/${AGENT.id}/deploy`) {
      expect(request.postDataJSON()).toMatchObject({ rung: rooms[0].rung });
      record = atCasino;
      return route.fulfill({ json: { tableId: casinoTableId, agentId: AGENT.id, agentName: AGENT.name,
        room: rooms[0].id, smallBlind: rooms[0].stakes.smallBlind, bigBlind: rooms[0].stakes.bigBlind,
        stakes: rooms[0].stakes, strategy: {}, sessionStarted: true, joinedExisting: casino === 'join' } });
    }
    if (privateChat && request.method() === 'POST' && path === '/api/agents/chat') {
      expect(request.postDataJSON()).toMatchObject({ existingAgentId: AGENT.id, content: 'Be patient.' });
      record = { ...record, chatHistory: [{ role: 'user', content: 'Be patient.' }, { role: 'assistant', content: 'I will wait for my spot.' }] };
      return route.fulfill({ json: { chat: record.chatHistory } });
    }
    if (request.method() !== 'GET') {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 500, json: { error: 'Guidance must not write, deal or send a message.' } });
    }
    let json;
    if (path === '/api/agents') json = { agents: [record] };
    else if (path === `/api/agents/${AGENT.id}`) json = record;
    else if (path.endsWith('/hands')) json = { recentHands: [] };
    else if (path.endsWith('/flagged')) json = { flaggedHands: [] };
    else if (path.endsWith('/attributes/log')) json = { entries: [] };
    else if (path.endsWith('/thread')) json = { sessionId: 'first-session', lines: [], count: 0 };
    else if (path.endsWith('/memory')) json = { memoryContext: '' };
    else if (path.endsWith('/study')) json = { study: null, book: [], count: 0 };
    else if (path === '/api/rooms') json = { rooms: roomSnapshots, hotWindowMs: 20_000 };
    else if (/^\/api\/rooms\/[^/]+\/tables$/.test(path)) json = { tables: floorTables };
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
  await page.addInitScript(({ ownerId, guest, initData, agents, rooms, homeGame, legacy, casino, casinoTableId, floorTables }) => {
    const telegramEvents = new Map();
    window.__firstSessionViewportChanged = () => telegramEvents.get('viewportChanged')?.forEach(fn => fn({ isStateStable: true }));
    window.Telegram = { WebApp: {
      initData: guest ? '' : initData,
      initDataUnsafe: guest ? {} : { user: { id: Number(ownerId), first_name: 'Jens' } },
      get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {},
      onEvent(name, fn) { if (!telegramEvents.has(name)) telegramEvents.set(name, new Set()); telegramEvents.get(name).add(fn); },
      offEvent(name, fn) { telegramEvents.get(name)?.delete(fn); },
    } };
    if (legacy) localStorage.setItem(`railbird.practice.v1:${JSON.stringify([ownerId, agents[0].id])}`,
      JSON.stringify({ version: 1, step: 3 }));
    // Reload must not erase evidence of a forbidden frame.
    window.__firstSessionWire = JSON.parse(sessionStorage.getItem('first-session-test-wire') || '[]');
    class ScriptedSocket extends EventTarget {
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
        window.__firstSessionWire.push(message);
        sessionStorage.setItem('first-session-test-wire', JSON.stringify(window.__firstSessionWire));
        if (message.type === 'floor_sub') setTimeout(() => {
          this.push({ type: 'home_state', userId: ownerId, agents, game: homeGame });
          this.push({ type: 'floor_rooms', rooms });
          this.push({ type: 'room_tables', tables: floorTables, rooms: Object.fromEntries(floorTables.map(table => [table.tableId, table.room])) });
        }, 10);
        const atCasino = casino && message.tableId === casinoTableId;
        if (message.type !== 'watch' || (!atCasino && (!homeGame || message.tableId !== homeGame.tableId))) return;
        setTimeout(() => {
          const owned = atCasino && message.agentId === agents[0].id;
          const seats = atCasino ? [
            { seat: 0, agentId: null, name: 'Granite', stack: 200 },
            { seat: 1, agentId: agents[0].id, name: agents[0].name, stack: 220 },
          ] : homeGame.seats;
          this.push({ type: 'watching', tableId: message.tableId, spectatorSeat: owned ? 1 : -1, publicOnly: !owned });
          this.push({ type: 'state', yourSeat: owned ? 1 : -1, legalActions: [], state: {
            tableId: message.tableId, handNumber: 1, street: 'flop', pace: 'calm', pot: 20,
            smallBlind: 1, bigBlind: 2, currentBet: 0, toAct: 0, community: ['5c', '4h', '8c'],
            seats: seats.map(seat => ({ seat: seat.seat, playerId: seat.agentId ? `agent_${seat.agentId}` : `ai_${seat.seat}`,
              agentId: seat.agentId, displayName: seat.name, stack: seat.stack, isAI: true,
              identity: seat.agentId ? agents[0].identity : { hood: 'ink', glow: 'teal' },
              holeCards: owned && seat.agentId === agents[0].id ? ['Ah', 'Kd'] : [] })),
          } });
        }, 10);
      }
    }
    window.WebSocket = ScriptedSocket;
  }, { ownerId, guest, initData: INIT_DATA, agents: [record], rooms: roomSnapshots, homeGame, legacy, casino, casinoTableId, floorTables });
  return { ownerId, tableId, casinoTableId, requests, unexpected, errors };
}

async function openHome(page) {
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.locator(`.home-one[data-agent="${AGENT.id}"]`)).toBeVisible();
  await expectNoPracticeEntry(page);
}
async function expectNoPracticeEntry(page) {
  await expect(page.getByTestId('guided-practice')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(Learn with .+|Learn the table|Resume practice|Replay practice)$/ })).toHaveCount(0);
}
async function expectHint(page, text) {
  const hint = page.getByTestId('context-hint');
  await expect(hint).toBeVisible();
  await expect(hint.locator('p')).toHaveText(text);
  await expect(hint.getByRole('button', { name: 'Skip', exact: true })).toBeVisible();
  return hint;
}
async function expectTarget(page, target, { groupSelector = null } = {}) {
  const hint = page.getByTestId('context-hint'), outline = page.getByTestId('context-hint-target');
  await expect(target).toBeVisible(); await expect(outline).toBeVisible();
  if (groupSelector) await expect(target.locator(groupSelector)).toHaveCount(5);
  await expect.poll(async () => {
    const subjectBounds = groupSelector ? target.evaluate((el, selector) => {
      const rects = [...el.querySelectorAll(selector)].map(card => card.getBoundingClientRect());
      if (rects.length !== 5 || rects.some(rect => !rect.width || !rect.height)) return null;
      const x = Math.min(...rects.map(rect => rect.left)), y = Math.min(...rects.map(rect => rect.top));
      return { x, y, width: Math.max(...rects.map(rect => rect.right)) - x,
        height: Math.max(...rects.map(rect => rect.bottom)) - y };
    }, groupSelector) : target.boundingBox();
    const [tip, mark, subject] = await Promise.all([hint.boundingBox(), outline.boundingBox(), subjectBounds]);
    if (!tip || !mark || !subject) return false;
    const { width, height } = page.viewportSize();
    const center = { x: mark.x + mark.width / 2, y: mark.y + mark.height / 2 };
    const hit = await target.evaluate((el, { point, groupSelector }) => {
      const actual = document.elementFromPoint(point.x, point.y);
      if (!actual || !(el.closest('button,[role="button"]') || el).contains(actual)) return false;
      return !groupSelector || !!actual.closest(groupSelector);
    }, { point: center, groupSelector });
    // Clipping may expose only part of a room object. The highlight must still
    // point inside the actual visible object, whose center remains usable.
    const contained = mark.x >= subject.x - 2 && mark.y >= subject.y - 2
      && mark.x + mark.width <= subject.x + subject.width + 2
      && mark.y + mark.height <= subject.y + subject.height + 2;
    // Board guidance encloses the five actual card slots, not the much larger
    // positioning container. The center is on the third real card.
    const cardSized = !groupSelector || ['x', 'y', 'width', 'height'].every(key => Math.abs(mark[key] - subject[key]) <= 2);
    const inViewport = [tip, mark].every(rect => rect.x >= -1 && rect.y >= -1
      && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1);
    const overlapX = Math.min(tip.x + tip.width, mark.x + mark.width) - Math.max(tip.x, mark.x);
    const overlapY = Math.min(tip.y + tip.height, mark.y + mark.height) - Math.max(tip.y, mark.y);
    return mark.width > 15 && mark.height > 15 && contained && cardSized && inViewport && hit && (overlapX <= 0 || overlapY <= 0);
  }, { message: 'The hint must point at the visible real target without covering it.' }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
}
async function expectReadOnly(page, fixture, { allowWatch = true } = {}) {
  const wire = await page.evaluate(() => window.__firstSessionWire);
  expect(wire.filter(message => ['join', 'action', 'deal', 'chat'].includes(message.type))).toEqual([]);
  const watches = wire.filter(message => message.type === 'watch');
  if (!allowWatch) expect(watches).toEqual([]);
  else expect(watches.every(message => message.tableId === fixture.tableId)).toBe(true);
  expect(fixture.requests.filter(request => request.method !== 'GET')).toEqual([]);
  expect(fixture.unexpected).toEqual([]); expect(fixture.errors).toEqual([]);
}
async function advanceToTable(page) {
  const hint = await expectHint(page, COPY.agent);
  await hint.getByRole('button', { name: 'Next', exact: true }).click();
  await expectHint(page, COPY.table);
}
async function returnFromWatch(page) {
  const name = page.viewportSize().width >= 1100 ? 'Back to the room' : 'Leave table';
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId('home-table')).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test(`FIRST-SESSION: actual Home to Watch guidance at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const fixture = await installSession(page);
    await openHome(page); await expectHint(page, COPY.agent);
    await expectTarget(page, page.locator(`.home-one[data-agent="${AGENT.id}"]`));
    await page.screenshot({ path: testInfo.outputPath('first-arrival-hint.png') });
    await expect.poll(() => page.evaluate(owner => JSON.parse(localStorage.getItem(`railbird.guide.v1:${owner}`)), fixture.ownerId))
      .toMatchObject({ version: 1, seen: true });
    await expectReadOnly(page, fixture);
    await advanceToTable(page); await expectTarget(page, page.getByTestId('home-table'));
    await page.screenshot({ path: testInfo.outputPath('actual-table-hint.png') });
    await page.getByTestId('context-hint').getByRole('button', { name: 'Open table', exact: true }).click();
    await expect(page.getByTestId('home-table-sheet')).toBeVisible();
    await expectHint(page, COPY.watch); await expectTarget(page, page.getByTestId('home-table-watch'));
    await expect(page.getByTestId('context-hint').getByRole('button')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Watch game', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('home-table-watch')).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath('actual-watch-control.png') });
    await expectReadOnly(page, fixture);
    await page.getByTestId('home-table-watch').click();
    const felt = page.locator('.watch-felt').filter({ visible: true });
    await expect(felt).toBeVisible(); await expectHint(page, COPY.board);
    await expectTarget(page, page.locator('[data-watch-status]').filter({ visible: true }));
    for (const value of ['5', '4', '8']) await expect(felt.locator('.watch-felt__board')).toContainText(value);
    await expect(page.getByTestId('sit-strip')).toHaveCount(0);
    await expect(page.getByTestId('owner-hero-cards')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('actual-shared-board.png') });
    await page.getByTestId('context-hint').getByRole('button', { name: 'OK', exact: true }).click();
    await expectHint(page, COPY.opponent);
    await expectTarget(page, felt.locator('.seat-ghost').first());
    await page.getByTestId('context-hint').getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByTestId('context-hint')).toHaveCount(0);
    await returnFromWatch(page); await expect(page.getByTestId('context-hint')).toHaveCount(0);
    await page.reload(); await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('context-hint')).toHaveCount(0); await expectNoPracticeEntry(page);
    await expectReadOnly(page, fixture);
    expect((await page.evaluate(() => window.__firstSessionWire)).some(message => message.type === 'watch' && message.tableId === fixture.tableId)).toBe(true);
  });
}
for (const viewport of [{ width: 390, height: 590 }, { width: 1440, height: 900 }]) {
  test(`FIRST-SESSION: a quiet table leads to the casino without automatic deployment at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport); const fixture = await installSession(page, { running: false });
    await openHome(page); await advanceToTable(page);
    await page.getByTestId('context-hint').getByRole('button', { name: 'Open table', exact: true }).click();
    await expectHint(page, COPY.quiet); await expectTarget(page, page.getByTestId('home-table-seated'));
    await expect(page.getByTestId('home-table-watch')).toHaveCount(0);
    await expect(page.getByTestId('home-table-sit')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('quiet-table-hint.png') });
    await page.getByTestId('context-hint').getByRole('button', { name: 'Show door', exact: true }).click();
    await expect(page.getByTestId('home-table-sheet')).toHaveCount(0);
    await expectHint(page, COPY.door);
    await expectTarget(page, page.getByTestId('home-door'));
    await page.screenshot({ path: testInfo.outputPath('actual-casino-door-hint.png') });
    await expectReadOnly(page, fixture, { allowWatch: false });
    await page.getByTestId('context-hint').getByRole('button', { name: 'Enter casino', exact: true }).click();
    await expect(page.getByTestId('floor-view')).toBeVisible();
    await expect(page.getByTestId('floor-view')).toHaveAttribute('data-room', 'floor');
    await expect(page.getByTestId('context-hint')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('casino-entered-no-deployment.png') });
    await expectReadOnly(page, fixture, { allowWatch: false });
    const casinoChrome = viewport.width >= 1100 ? page.locator('.dsk-top') : page.getByTestId('floor-view');
    await casinoChrome.getByRole('button', { name: 'Back home', exact: true }).click();
    await expect(page.locator(`.home-one[data-agent="${AGENT.id}"]`)).toBeVisible();
    await expect(page.getByTestId('context-hint')).toHaveCount(0);
    await page.reload(); await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('context-hint')).toHaveCount(0);
    await expectReadOnly(page, fixture, { allowWatch: false });
  });
}
test('FIRST-SESSION: Skip suppresses another invitation on table open or reload', async ({ page }) => {
  const fixture = await installSession(page, { running: false });
  await openHome(page); await expectHint(page, COPY.agent);
  await page.getByTestId('context-hint').getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByTestId('context-hint')).toHaveCount(0);
  await page.getByTestId('home-table').click(); await expect(page.getByTestId('home-table-sheet')).toBeVisible();
  await expect(page.getByTestId('context-hint')).toHaveCount(0);
  await page.reload(); await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('context-hint')).toHaveCount(0); await expectNoPracticeEntry(page);
  await expectReadOnly(page, fixture, { allowWatch: false });
});
test('FIRST-SESSION: reloading an unfinished introduction does not start it again', async ({ page }) => {
  const fixture = await installSession(page, { running: false });
  await openHome(page); await advanceToTable(page);
  await page.reload(); await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('context-hint')).toHaveCount(0); await expectNoPracticeEntry(page);
  await expectReadOnly(page, fixture, { allowWatch: false });
});

test('FIRST-SESSION: carrying an agent clears the hint until the gesture ends', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await installSession(page, { running: false });
  await openHome(page); await expectHint(page, COPY.agent);
  const box = await page.locator(`.home-one[data-agent="${AGENT.id}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('.home-carry-help')).toBeVisible();
  await expect(page.getByTestId('context-hint')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expectHint(page, COPY.agent);
  await expectReadOnly(page, fixture, { allowWatch: false });
});
test('FIRST-SESSION: tapping the actual table and Watch controls also advances guidance', async ({ page }) => {
  const fixture = await installSession(page);
  await openHome(page); await advanceToTable(page);
  await page.getByTestId('home-table').click(); await expectHint(page, COPY.watch);
  await expect(page.getByTestId('context-hint').getByRole('button')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Watch game', exact: true })).toHaveCount(0);
  await page.getByTestId('home-table-watch').click(); await expectHint(page, COPY.board);
  await page.getByTestId('context-hint').getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.locator('.watch-felt').filter({ visible: true })).toBeVisible();
  await expectReadOnly(page, fixture);
});
for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`FIRST-SESSION: actual agent tap opens chat, then returning resumes this visit at ${viewport.width}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const fixture = await installSession(page, { running: false });
    await openHome(page); await expectHint(page, COPY.agent);
    const body = page.locator(`.home-one[data-agent="${AGENT.id}"]`);
    await expectTarget(page, body);
    await body.click();
    const chat = page.locator('.agent-view');
    await expect(chat).toBeVisible();
    await expect(chat.getByPlaceholder('Whisper to him…')).toBeVisible();
    await expect(chat.getByPlaceholder('Whisper to him…')).toHaveValue('');
    await expect(page.getByTestId('context-hint')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('actual-agent-chat.png') });
    await expectReadOnly(page, fixture, { allowWatch: false });
    await chat.getByRole('button', { name: viewport.width >= 1100 ? 'Close panel' : 'Back', exact: true }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expectHint(page, COPY.table);
    await expectTarget(page, page.getByTestId('home-table'));
    await page.screenshot({ path: testInfo.outputPath('same-visit-table-guidance.png') });
    await page.getByTestId('context-hint').getByRole('button', { name: 'Skip', exact: true }).click();
    await expectReadOnly(page, fixture, { allowWatch: false });
  });
}
test('FIRST-SESSION: a valid legacy practice record suppresses new guidance', async ({ page }) => {
  const fixture = await installSession(page, { running: false, legacy: true });
  await openHome(page); await expect(page.getByTestId('context-hint')).toHaveCount(0);
  await expectNoPracticeEntry(page);
  await page.getByTestId('home-table').click(); await expect(page.getByTestId('home-table-sheet')).toBeVisible();
  await expect(page.getByTestId('context-hint')).toHaveCount(0);
  await expectReadOnly(page, fixture, { allowWatch: false });
});
test('FIRST-SESSION: guest guidance sends no automatic message or claim request', async ({ page }, testInfo) => {
  const fixture = await installSession(page, { running: false, guest: true });
  await openHome(page); await advanceToTable(page);
  await page.getByTestId('context-hint').getByRole('button', { name: 'Open table', exact: true }).click();
  await expectHint(page, COPY.quiet);
  await page.getByTestId('context-hint').getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Keep him', exact: true })).toHaveCount(0);
  await expect(page.getByText(/Guided explanation|Cheers\. I|I am watching the hand\./)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('guest-table-no-auto-message.png') });
  expect(fixture.requests).toEqual(expect.arrayContaining([
    expect.objectContaining({ method: 'GET', path: '/api/guest/me' }),
    expect.objectContaining({ method: 'GET', path: '/api/agents', userId: fixture.ownerId }),
  ]));
  await expectReadOnly(page, fixture, { allowWatch: false });
});

for (const { viewport, guest = false, casino = 'start' } of [
  { viewport: { width: 390, height: 590 } }, { viewport: { width: 1440, height: 900 } },
  { viewport: { width: 390, height: 844 } }, { viewport: { width: 320, height: 590 } },
  { viewport: { width: 390, height: 844 }, guest: true },
  { viewport: { width: 390, height: 590 }, casino: 'join' }, { viewport: { width: 1440, height: 900 }, casino: 'join' },
]) {
  test(`CASINO-ENTRY-1: ${guest ? 'guest' : 'owner'} ${casino === 'join' ? 'populated' : 'quiet'} floor starts the named agent and guides owned Watch at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const fixture = await installSession(page, { running: false, casino, guest });
    await openHome(page); await advanceToTable(page);
    await page.getByTestId('context-hint').getByRole('button', { name: 'Open table', exact: true }).click();
    await page.getByTestId('context-hint').getByRole('button', { name: 'Show door', exact: true }).click();
    await page.getByTestId('context-hint').getByRole('button', { name: 'Enter casino', exact: true }).click();
    const floor = page.getByTestId('floor-view');
    await expect(floor).toBeVisible();
    if (casino === 'join') await expect(page.getByTestId('the-floor')).toBeVisible();
    const play = page.getByTestId('casino-play');
    await expect(play).toBeVisible(); await expect(play).toContainText(AGENT.name);
    await expect(play).toBeInViewport({ ratio: 1 });
    await expectReadOnly(page, fixture, { allowWatch: false });
    await page.screenshot({ path: testInfo.outputPath('quiet-floor-play.png') });
    await play.getByRole('button', { name: `Send ${AGENT.name} to play`, exact: true }).click();
    const felt = page.locator('.watch-felt').filter({ visible: true });
    await expect(felt).toBeVisible();
    await expect.poll(() => fixture.requests.filter(request => request.method === 'POST').length).toBe(1);
    expect(fixture.requests.filter(request => request.method === 'POST')).toEqual([
      expect.objectContaining({ path: `/api/agents/${AGENT.id}/deploy` }),
    ]);
    const watches = await page.evaluate(() => window.__firstSessionWire.filter(message => message.type === 'watch'));
    expect(watches).toContainEqual(expect.objectContaining({ tableId: fixture.casinoTableId, agentId: AGENT.id }));
    await expect(felt.locator('.watch-hero__cards')).toContainText('A');
    await expect(felt.locator('.watch-hero__cards')).toContainText('K');
    await expect(page.getByTestId('context-hint')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('owned-watch-intro.png') });
    await expectHint(page, COPY.owned);
    await expectTarget(page, page.locator('[data-watch-status]').filter({ visible: true }));
    await page.getByTestId('context-hint').getByRole('button', { name: 'OK', exact: true }).click();
    await expectHint(page, guest ? 'Sign in to talk to your agent here.' : COPY.chat);
    const composer = viewport.width >= 1100 ? page.locator('.dsk-panel--watch textarea') : page.locator('.watch-composer__input');
    await expectTarget(page, composer);
    await page.screenshot({ path: testInfo.outputPath('owned-watch-chat.png') });
    await page.getByTestId('context-hint').getByRole('button', { name: 'OK', exact: true }).click();
    await expectHint(page, COPY.ownAgent);
    await expectTarget(page, felt.locator('.watch-hero__body > .mood-ghost'));
    await page.screenshot({ path: testInfo.outputPath('owned-watch-agent.png') });
    await page.getByTestId('context-hint').getByRole('button', { name: 'OK', exact: true }).click();
    await expectHint(page, COPY.opponent);
    await expectTarget(page, felt.locator('.seat-ghost').first());
    await page.screenshot({ path: testInfo.outputPath('owned-watch-opponent.png') });
    await page.getByTestId('context-hint').getByRole('button', { name: 'OK', exact: true }).click();
    await expect(page.getByTestId('context-hint')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Keep him', exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('context-hint')).toHaveCount(0);
    expect(fixture.unexpected).toEqual([]); expect(fixture.errors).toEqual([]);
    expect((await page.evaluate(() => window.__firstSessionWire)).filter(message => ['join', 'action', 'deal', 'chat'].includes(message.type))).toEqual([]);
  });
  if (!guest && casino === 'start') test(`CASINO-ENTRY-2: opening an owned table preserves ownership at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const fixture = await installSession(page, { running: false, casino: 'owned', legacy: true, privateChat: true });
    await page.goto('/');
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.getByTestId('home-door').click();
    await expect(page.getByTestId('floor-view')).toBeVisible();
    await page.getByTestId('floor-view').getByRole('button', { name: 'Watch him', exact: true }).click();
    const felt = page.locator('.watch-felt').filter({ visible: true });
    await expect(felt).toBeVisible();
    await expect(felt.locator('.watch-hero__cards')).toContainText('A');
    await expect(felt.locator('.watch-hero__cards')).toContainText('K');
    await expect(felt.locator('.seat-ghost')).toHaveCount(1);
    await expect(felt.locator('.seat-ghost')).toContainText('Granite');
    await expect(felt.locator('.watch-hero__hand-name')).toHaveText('ace-high');
    await expect(felt.locator('.watch-hero__holding')).toContainText('FLOP · Hand now');
    await expect(felt.locator('.tug__label')).toHaveText('Est. pot share');
    await expect(felt.locator('.tug__villain')).toHaveText('vs GRANITE');
    for (const selector of ['.watch-hero__hand-name', '.tug__legend']) {
      // Chromium rounds a fully contained fractional text rectangle to an
      // intersection ratio just below 1; check the actual viewport edges.
      const bounds = await felt.locator(selector).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      expect(await felt.locator(selector).evaluate(el => el.scrollWidth - el.clientWidth), `${selector} fits the table`).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => window.__firstSessionWire.filter(message => message.type === 'watch')))
      .toContainEqual(expect.objectContaining({ tableId: fixture.casinoTableId, agentId: AGENT.id }));
    await page.evaluate(() => { window.__companionFelt = document.querySelector('.watch-felt'); });
    const beforeBounds = await felt.boundingBox();
    const beforeWatch = await page.evaluate(() => window.__firstSessionWire.filter(m => m.type === 'watch').length);
    const composer = page.getByPlaceholder('Whisper to him…', { exact: true });
    await composer.fill('Be patient.');
    await page.getByRole('button', { name: 'View your agent at the table', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Stack at this table', { exact: true })).toBeVisible();
    if (viewport.width < 1100) {
      const panel = page.locator('.watch-agent-sheet');
      await expect(panel).toHaveCSS('opacity', '1');
      expect(await panel.evaluate(el => Number(getComputedStyle(el).zIndex)), 'agent information sits above the decorative hero')
        .toBeGreaterThan(await felt.locator('.watch-hero').evaluate(el => Number(getComputedStyle(el).zIndex)));
      const panelBounds = await panel.boundingBox(), boardBounds = await felt.locator('.watch-felt__board').boundingBox();
      expect(panelBounds.y, 'the board stays above the agent panel').toBeGreaterThanOrEqual(boardBounds.y + boardBounds.height);
    }
    await page.screenshot({ path: testInfo.outputPath('in-game-agent-stats.png') });
    const desktop = viewport.width >= 1100;
    if (!desktop) {
      const lastStat = page.locator('.watch-agent-stats dl > div').last();
      await lastStat.scrollIntoViewIfNeeded();
      await expect(lastStat).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Back to table', exact: true })).toBeInViewport({ ratio: 1 });
    }
    await page.getByRole('button', { name: desktop ? 'Back to chat' : 'Conversation', exact: true }).click();
    if (!desktop) await expect.poll(() => page.locator('.watch-agent-sheet .thread-sheet__body')
      .evaluate(el => el.scrollWidth - el.clientWidth), 'long private messages wrap within the phone panel').toBeLessThanOrEqual(1);
    await expect(composer).toHaveValue('Be patient.');
    await composer.press('Enter');
    await expect(page.getByText('I will wait for my spot.', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('in-game-agent-chat.png') });
    if (!desktop && viewport.height === 844) {
      // A keyboard can leave only this much height for the Mini App.
      await page.setViewportSize({ width: viewport.width, height: 420 });
      await page.evaluate(() => window.__firstSessionViewportChanged());
      await expect(composer).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Back to table', exact: true })).toBeInViewport({ ratio: 1 });
      await expect.poll(() => page.locator('.watch-agent-sheet .thread-sheet__body')
        .evaluate(el => el.clientHeight), 'the conversation remains readable above the keyboard').toBeGreaterThanOrEqual(40);
      await page.setViewportSize(viewport);
      await page.evaluate(() => window.__firstSessionViewportChanged());
    }
    if (!desktop) {
      await page.getByRole('button', { name: 'Back to table', exact: true }).click();
      await expect(page.getByRole('dialog', { name: `${AGENT.name} at the table` })).toHaveCount(0);
    }
    expect(await felt.boundingBox()).toEqual(beforeBounds);
    expect(await page.evaluate(() => window.__companionFelt === document.querySelector('.watch-felt'))).toBe(true);
    expect(await page.evaluate(() => window.__firstSessionWire.filter(m => m.type === 'watch').length)).toBe(beforeWatch);
    expect(fixture.requests.filter(request => request.method !== 'GET')).toEqual([expect.objectContaining({ method: 'POST', path: '/api/agents/chat' })]);
    expect(fixture.unexpected).toEqual([]); expect(fixture.errors).toEqual([]);
    await expect(page.getByTestId('context-hint')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('floor-owned-watch.png') });
  });
}
