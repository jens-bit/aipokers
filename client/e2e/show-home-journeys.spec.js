import { test, expect } from '@playwright/test';
import { midHandGame } from '../src/test/fixtures/game.js';
import { rooms, felt } from '../src/test/fixtures/rooms.js';

// Run against the built client with playwright.show.config.js. These journeys
// use the real screens and protocol; API/model work stays behind local routes.
test.use({ viewport: { width: 390, height: 590 } });

const OWNER = '4242';
const INIT_DATA = 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=home-journeys';
const HOME_TABLE = 'home-4242';
const UPSTAIRS_TABLE = 'home3-upstairs';
const compactAgents = [
  { id: 'clock', name: 'The Clock', nature: 'Grinder', identity: { hood: 'sand', glow: 'gold' } },
  { id: 'river', name: 'River Rat', nature: 'Shark', identity: { hood: 'slate', glow: 'mint' } },
].map(agent => ({
  ...agent, location: { where: 'home' }, routine: { key: 'plays', label: 'in a hand' },
  mood: { state: 'neutral', heat: 30 }, fatigue: 'fresh', homeTableId: HOME_TABLE,
  activeTableId: null, liveGame: null,
}));
const detailedAgents = compactAgents.map((agent, index) => ({
  ...agent, nature: { name: agent.nature }, pocket: { balance: 2000, mode: 'topup' },
  attrs: { READS: 62, FOCUS: 41, DISCIPLINE: 53, COMPOSURE: 37, DECEPTION: 0, STAMINA: 68 },
  attrLog: [{ key: 'READS', from: 61, to: 62, cause: 'Read the river sizing.', ts: 1789000000000 }],
  careerStats: { hands: 123 + index, sessions: 4, winRate: 42, biggestPot: 840, bankroll: 2000 },
  stats: { handsPlayed: 123 + index }, sessionLog: [], chatHistory: [],
}));
// The roster may already carry cached detail. A fresh profile read must update
// it; the separate delayed-roster case below starts with HOME_STATE alone.
const cachedAgents = detailedAgents.map(agent => ({
  ...agent, attrLog: [], careerStats: { ...agent.careerStats, hands: 7 },
}));
const homeGame = {
  tableId: HOME_TABLE, state: 'running', handsPlayed: 7, maxSeats: 4,
  seats: compactAgents.map((agent, index) => ({ seat: index + 1, agentId: agent.id, name: agent.name, house: false })),
};
const clockSeat = { ...midHandGame.seats[1], displayName: 'The Clock', agentId: 'clock', holeCards: [], stack: 196, contribTotal: 4, contribThisStreet: 0 };
const riverSeat = { ...midHandGame.seats[2], displayName: 'River Rat', agentId: 'river', holeCards: [], stack: 192, contribTotal: 8, contribThisStreet: 0 };
const publicHomeState = {
  ...midHandGame, tableId: HOME_TABLE, handNumber: 7, smallBlind: 1, bigBlind: 2,
  community: ['5c', '4h', '8c'], pot: 12, currentBet: 0, lastRaiseSize: 2, dealerSeat: 1, toAct: 1, pace: 'calm',
  seats: [null, clockSeat, riverSeat],
};
const seatedHomeState = {
  ...publicHomeState, handNumber: 8, toAct: 0, pot: 24,
  seats: [{ ...midHandGame.seats[0], displayName: 'Jens', stack: 192, holeCards: ['As', 'Kd'], contribTotal: 8, contribThisStreet: 0, actedThisStreet: false }, { ...clockSeat, stack: 192, contribTotal: 8 }, riverSeat],
};
const upstairsState = {
  ...midHandGame, tableId: UPSTAIRS_TABLE, handNumber: 12, smallBlind: 25, bigBlind: 50,
  community: ['Ah', 'Kd', '7c'], pot: 640, pace: 'calm',
  seats: midHandGame.seats.map((seat, index) => ({ ...seat, displayName: ['Ozymandias', 'Granite', 'Nightjar'][index], holeCards: [] })),
};
const upstairsFelt = felt({ tableId: UPSTAIRS_TABLE, room: 'upstairs', smallBlind: 25, bigBlind: 50, blinds: '25/50' });
const casinoRooms = rooms.map(room => ({
  ...room, tables: room.id === 'upstairs' ? 1 : 0, seated: room.id === 'upstairs' ? 3 : 0,
  hot: [], biggestPot: null,
}));
const LEGAL = [{ type: 'fold' }, { type: 'check' }, { type: 'bet', min: 2, max: 192 }];

function latch(held) {
  let release;
  const ready = held ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  return { ready, release: () => release?.() };
}

async function installJourney(page, { holdDetail = false, holdRoster = false, returningGuest = false } = {}) {
  const detail = latch(holdDetail), roster = latch(holdRoster);
  const ownerId = returningGuest ? 'guest_home3' : OWNER;
  const requests = [], unexpected = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    requests.push({ path, method: request.method(), userId: url.searchParams.get('userId'), initData: request.headers()['x-telegram-init-data'] });
    let json;
    if (request.method() !== 'GET') {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 500, json: { error: 'This journey must not mutate an API or invoke a model.' } });
    }
    if (path === '/api/agents') { await roster.ready; json = { agents: cachedAgents }; }
    else if (/^\/api\/agents\/[^/]+$/.test(path)) {
      await detail.ready;
      json = detailedAgents.find(agent => path.endsWith(`/${agent.id}`));
    }
    else if (path.endsWith('/hands')) json = { recentHands: [] };
    else if (path.endsWith('/flagged')) json = { flaggedHands: [] };
    else if (path.endsWith('/attributes/log')) json = { entries: [] };
    else if (path.endsWith('/thread')) json = { sessionId: 'home3', lines: [], count: 0 };
    else if (path.endsWith('/memory')) json = { memoryContext: '' };
    else if (path.endsWith('/study')) json = { study: null, book: [], count: 0 };
    else if (path === '/api/rooms') json = { rooms: casinoRooms, hotWindowMs: 20000 };
    else if (/^\/api\/rooms\/[^/]+\/tables$/.test(path)) json = { tables: path.includes('/upstairs/') ? [upstairsFelt] : [] };
    else if (path === '/api/events') json = { events: [], lastId: 0 };
    else if (path === '/api/slots') json = { used: 2, cap: 4, next: null };
    else if (path === '/api/wallet') json = { balance: 12000, staked: 0, session: 0, ledger: [] };
    else if (path === '/api/fridge') json = { items: [] };
    else if (path === '/api/auth/config') json = { botUsername: '', guest: returningGuest };
    else if (path === '/api/guest/me' && returningGuest) json = { ownerId };
    if (!json) {
      unexpected.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 404, json: { error: 'Unscripted journey route' } });
    }
    return route.fulfill({ json });
  });
  await page.addInitScript(({ ownerId, initData, returningGuest, agents, homeGame, rooms, tables, states, seatedState, legal }) => {
    window.Telegram = { WebApp: {
      initData: returningGuest ? '' : initData,
      initDataUnsafe: returningGuest ? {} : { user: { id: Number(ownerId), first_name: 'Jens' } },
      get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    window.__homeJourneyWire = [];
    window.__homeJourneyFrames = [];
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
      push(message) {
        if (this.readyState !== 1) return;
        window.__homeJourneyFrames.push(message);
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
      close() { this.readyState = 3; }
      send(raw) {
        const message = JSON.parse(raw);
        window.__homeJourneyWire.push(message);
        setTimeout(() => {
          if (this.readyState !== 1) return;
          if (message.type === 'floor_sub') {
            this.push({ type: 'home_state', userId: ownerId, agents, game: homeGame });
            this.push({ type: 'floor_rooms', rooms });
            this.push({ type: 'room_tables', tables, rooms: Object.fromEntries(tables.map(table => [table.tableId, table.room])) });
          } else if (message.type === 'watch') {
            const state = states[message.tableId];
            if (!state) { this.push({ type: 'error', message: 'Unscripted watch table' }); return; }
            this.push({ type: 'watching', tableId: message.tableId, spectatorSeat: -1 });
            this.push({ type: 'state', state, yourSeat: -1, legalActions: [] });
          } else if (message.type === 'join') {
            this.current = { ...seatedState, seats: seatedState.seats.map((seat, index) => index === 0 ? { ...seat, playerId: message.playerId } : seat) };
            this.push({ type: 'joined', tableId: message.tableId, seat: 0, waitingForNextHand: false });
            this.push({ type: 'state', state: this.current, yourSeat: 0, waitingForNextHand: false, legalActions: legal });
          } else if (message.type === 'action' && this.current) {
            this.current = { ...this.current, toAct: 1, lastAction: { seq: 1, handNumber: this.current.handNumber, seat: 0, street: 'flop', type: message.action.type, amount: 0, chips: 0 } };
            this.push({ type: 'state', state: this.current, yourSeat: 0, legalActions: [] });
          }
        }, 10);
      }
    }
    window.WebSocket = ScriptedSocket;
  }, {
    ownerId, initData: INIT_DATA, returningGuest, agents: compactAgents, homeGame,
    rooms: casinoRooms, tables: [upstairsFelt],
    states: { [HOME_TABLE]: publicHomeState, [UPSTAIRS_TABLE]: upstairsState }, seatedState: seatedHomeState, legal: LEGAL,
  });
  return { requests, unexpected, errors, releaseDetail: detail.release, releaseRoster: roster.release };
}

async function openHome(page) {
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.locator('.home-one[data-agent="clock"]')).toBeVisible();
}

async function openRosterThread(page) {
  await page.getByRole('button', { name: 'Your agents', exact: true }).click();
  const roster = page.getByTestId('roster-sheet');
  await expect(roster.getByRole('button', { name: /^The Clock — / })).toBeVisible();
  await roster.getByRole('button', { name: /^The Clock — / }).click();
  await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();
}

async function expectPublicWatch(page, tableId, board, pot) {
  await expect(page.getByRole('button', { name: 'Leave table' })).toBeVisible();
  await expect(page.locator('.watch-felt__board .watch-felt__card')).toHaveText([...board, '', '']);
  await expect(page.locator('.watch-felt__pot-amt')).toHaveText(pot);
  await expect(page.getByTestId('owner-hero')).toHaveCount(0);
  await expect(page.getByTestId('sit-strip')).toHaveCount(0);
  await expect(page.locator('.watch-felt__hero-cards')).toHaveText('');
  const frames = await page.evaluate(id => window.__homeJourneyFrames.filter(frame => frame.type === 'state' && frame.state.tableId === id), tableId);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.at(-1).yourSeat).toBe(-1);
  expect(frames.at(-1).state.seats.filter(Boolean).every(seat => seat.holeCards.length === 0)).toBe(true);
}

function expectClean(fixture) {
  expect(fixture.unexpected).toEqual([]);
  expect(fixture.errors).toEqual([]);
}

test('HOME-3 roster → Chat draft → fresh Profile career → both ways back preserve Home', async ({ page }) => {
  const fixture = await installJourney(page, { holdDetail: true });
  try {
    await openHome(page);
    await openRosterThread(page);
    const draft = page.getByPlaceholder('Whisper to him…');
    await draft.fill('Ask about that river after the hand.');
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    const career = page.getByRole('region', { name: 'Career', exact: true });
    await expect(career.getByText('7', { exact: true })).toBeVisible();
    await expect.poll(() => fixture.requests.some(request => request.path === '/api/agents/clock')).toBe(true);
    expect(fixture.requests.filter(request => request.path === '/api/agents/clock')).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'GET', userId: OWNER, initData: INIT_DATA }),
    ]));
    fixture.releaseDetail();
    await expect(career.getByText('123', { exact: true })).toBeVisible();
    await expect(career.getByText('42%', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'READS 62', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(draft).toHaveValue('Ask about that river after the hand.');
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Back to chat', exact: true }).click();
    await expect(draft).toHaveValue('Ask about that river after the hand.');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.locator('.profile-overview')).toHaveCount(0);
    expectClean(fixture);
  } finally { fixture.releaseDetail(); }
});

test('HOME-3 compact Home opens Profile before roster REST and hydrates unknown career values', async ({ page }) => {
  const fixture = await installJourney(page, { holdDetail: true, holdRoster: true });
  try {
    await openHome(page);
    await page.locator('.home-one[data-agent="clock"]').click();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    const career = page.getByRole('region', { name: 'Career', exact: true });
    await expect(career.getByText('—', { exact: true })).toHaveCount(5);
    await expect(career.getByText('0', { exact: true })).toHaveCount(0);
    fixture.releaseRoster();
    await expect(career.getByText('—', { exact: true })).toHaveCount(5);
    fixture.releaseDetail();
    await expect(career.getByText('123', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'DECEPTION 0', exact: true })).toBeVisible();
    expectClean(fixture);
  } finally { fixture.releaseRoster(); fixture.releaseDetail(); }
});

test('HOME-3 direct Home table Watch and actual seated YOU both leave for Home', async ({ page }) => {
  const fixture = await installJourney(page);
  await openHome(page);
  await page.getByTestId('home-table').click();
  await page.getByTestId('home-table-watch').click();
  await expectPublicWatch(page, HOME_TABLE, ['5', '4', '8'], '$12');
  expect(await page.evaluate(() => window.__homeJourneyWire.filter(message => message.type === 'watch'))).toEqual(expect.arrayContaining([
    expect.objectContaining({ tableId: HOME_TABLE, userId: OWNER, displayName: 'Jens', agentId: null }),
  ]));
  await page.getByRole('button', { name: 'Leave table' }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await page.getByTestId('home-table').click();
  await page.getByTestId('home-table-sit').click();
  const hero = page.getByTestId('owner-hero');
  await expect(hero.getByText('YOU', { exact: true })).toBeVisible();
  await expect(page.getByTestId('owner-hero-cards')).toHaveText('AK');
  await expect(hero.locator('.mood-ghost')).toHaveCount(0);
  await expect(page.getByTestId('sit-strip')).toHaveAttribute('data-turn', 'yes');
  await expect(page.getByRole('button', { name: 'CALL', exact: true })).toBeDisabled();
  const check = page.getByRole('button', { name: 'CHECK', exact: true });
  await expect(check).toBeEnabled();
  const joins = await page.evaluate(() => window.__homeJourneyWire.filter(message => message.type === 'join'));
  expect(joins).toHaveLength(1);
  expect(joins[0]).toMatchObject({ tableId: HOME_TABLE, userId: OWNER, initData: INIT_DATA, wantAI: false, buyIn: 200, smallBlind: 1, bigBlind: 2 });
  expect(await page.evaluate(() => window.__homeJourneyFrames.filter(frame => frame.type === 'state' && frame.yourSeat === 0).at(-1))).toMatchObject({
    yourSeat: 0, state: { tableId: HOME_TABLE, handNumber: 8, toAct: 0 }, legalActions: LEGAL,
  });
  await check.click();
  await expect.poll(() => page.evaluate(() => window.__homeJourneyWire.filter(message => message.type === 'action'))).toEqual([{ type: 'action', action: { type: 'check' } }]);
  await expect(page.getByTestId('sit-strip')).toHaveAttribute('data-turn', 'no');
  await expect(check).toBeDisabled();
  await page.getByRole('button', { name: 'Leave table' }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByTestId('owner-hero')).toHaveCount(0);
  expectClean(fixture);
});

test('HOME-3 Upstairs floor → Watch twice and nested Profile CHAT return to the same room', async ({ page }) => {
  const fixture = await installJourney(page);
  await openHome(page);
  await page.getByTestId('home-door').click();
  await expect(page.getByTestId('floor-view')).toHaveAttribute('data-room', 'floor');
  await page.getByTestId('casino-view-toggle').getByRole('button', { name: 'Board', exact: true }).click();
  await page.getByRole('button', { name: /^upstairs,/ }).click();
  for (let trip = 0; trip < 2; trip += 1) {
    const floor = page.getByTestId('floor-view');
    await expect(floor).toHaveAttribute('data-room', 'upstairs');
    await floor.getByRole('button', { name: /Watch table home3-upstairs/ }).click();
    await expectPublicWatch(page, UPSTAIRS_TABLE, ['A', 'K', '7'], '$640');
    await page.getByRole('button', { name: 'Leave table' }).click();
    await expect(page.getByTestId('floor-view')).toHaveAttribute('data-room', 'upstairs');
  }
  await openRosterThread(page);
  await page.getByPlaceholder('Whisper to him…').fill('Keep my place upstairs.');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('button', { name: 'Back to chat', exact: true }).click();
  await expect(page.getByPlaceholder('Whisper to him…')).toHaveValue('Keep my place upstairs.');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByTestId('floor-view')).toHaveAttribute('data-room', 'upstairs');
  await page.getByRole('button', { name: 'Back home', exact: true }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  expectClean(fixture);
});

test('HOME-3 a returning guest boots into the existing Home without minting another guest', async ({ page }) => {
  const fixture = await installJourney(page, { returningGuest: true });
  await openHome(page);
  await openRosterThread(page);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  expect(fixture.requests).toEqual(expect.arrayContaining([
    expect.objectContaining({ method: 'GET', path: '/api/guest/me' }),
    expect.objectContaining({ method: 'GET', path: '/api/agents', userId: 'guest_home3' }),
  ]));
  expect(fixture.requests.filter(request => request.method !== 'GET')).toEqual([]);
  expectClean(fixture);
});
