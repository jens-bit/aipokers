import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { badBeatHand } from '../src/test/fixtures/flagged.js';

const artifact = name => fileURLToPath(new URL(`../../artifacts/${name}`, import.meta.url));

// The real Home and Watch routes with controlled public table state. These
// snapshots prove a visual port, not server/feed behaviour (BUG-168 owns that).
const seats = [
  { displayName: 'Bal', identity: { hood: 'sand', glow: 'gold' } },
  { displayName: 'Granite', identity: { hood: 'moss', glow: 'gold' } },
  { displayName: 'River', identity: { hood: 'sand', glow: 'ember' } },
  { displayName: 'Bluff', identity: { hood: 'ash', glow: 'violet' } },
  { displayName: 'Clock', identity: { hood: 'moss', glow: 'ice' } },
];
const roster = ['Bal', 'Aggro', 'Bluff'].map((name, i) => ({
  id: `tv-${i}`, name, nature: { name: 'Rock' }, style: 'Balanced', risk: 'Medium',
  mood: { state: i === 1 ? 'tilted' : 'neutral', heat: 40 }, fatigue: 'fresh',
  stats: { handsPlayed: 40 }, careerStats: { hands: 40, sessions: 2, net: 3694 },
  identity: i === 0 ? seats[0].identity : { hood: i === 1 ? 'sand' : 'oxblood', glow: i === 1 ? 'ember' : 'teal' },
  pocket: { balance: 2000, mode: 'topup', cap: null }, sessionLog: [], want: null,
  opener: i === 1 ? 'He is going to give it all back.' : 'I am watching the hand.',
  routine: i === 0 ? null : { key: i === 1 ? 'tv' : 'shuffles', label: i === 1 ? 'watching' : 'shuffling' },
  activeTableId: i === 0 ? 'casino-tv' : null,
  location: { where: i === 0 ? 'table' : 'home', tableId: i === 0 ? 'casino-tv' : null, room: i === 0 ? 'upstairs' : null, since: Date.now() - 41 * 60000 },
  ...(i === 0 ? { liveGame: { tableId: 'casino-tv', heroSeat: 0, blinds: '25/50', street: 'flop', board: ['Ah', 'Kd', '2c'], pot: 4180, net: 3694, seats } } : {}),
}));

async function fixture(page) {
  let publicRoster = roster;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/agents' ? { agents: publicRoster }
      : path === '/api/slots' ? { used: 3, cap: 4, next: null }
      : path === '/api/wallet' ? { balance: 54000, staked: 0, ledger: [] }
      : path.includes('/thread') ? { lines: [], count: 0, sessionId: 'home' }
      : path.includes('/study') ? { book: [], study: null, count: 0 }
      : path.endsWith('/flagged') ? { flaggedHands: [badBeatHand] }
      : path.endsWith('/hands') ? { recentHands: [] }
      : path === '/api/auth/config' ? { botUsername: '' }
      : path === '/api/rooms' ? { rooms: [] } : { events: [], items: [] };
    return route.fulfill({ json: body });
  });
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.addInitScript(({ roster, seats }) => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
      initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
      get viewportHeight() { return window.innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    window.__tvSent = [];
    const sockets = [];
    let currentRoster = roster;
    window.__tvRoster = agents => {
      currentRoster = agents;
      sockets.filter(s => s.floor).forEach(s => s.emit({ type: 'home_state', userId: '4242', agents, game: null }));
    };
    class Socket {
      constructor() { this.readyState = 0; this.listeners = {}; sockets.push(this); setTimeout(() => { this.readyState = 1; this.dispatch('open', {}); }, 20); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      dispatch(type, event) { (this.listeners[type] ?? []).forEach(fn => fn(event)); }
      emit(message) { this.dispatch('message', { data: JSON.stringify(message) }); }
      send(raw) {
        const message = JSON.parse(raw); window.__tvSent.push(message);
        if (message.type === 'floor_sub') { this.floor = true; this.emit({ type: 'home_state', userId: '4242', agents: currentRoster, game: null }); }
        if (message.type === 'watch') setTimeout(() => {
          const table = currentRoster.find(a => a.id === message.agentId)?.liveGame;
          const [smallBlind, bigBlind] = table.blinds.split('/').map(Number);
          this.emit({ type: 'watching', tableId: message.tableId, seat: 0 });
          this.emit({ type: 'state', yourSeat: 0, legalActions: [], state: {
            tableId: message.tableId, handNumber: 2, street: table.street, pot: table.pot,
            smallBlind, bigBlind, currentBet: 0, toAct: 1, community: table.board,
            seats: table.seats.map((s, i) => ({ ...s,
              playerId: `p${i}`, stack: 2000, holeCards: i === 0 ? ['9h', '9d'] : [] })),
          } });
        }, 20);
      }
      close() { this.readyState = 3; }
    }
    Socket.OPEN = 1; window.WebSocket = Socket;
  }, { roster, seats });
  return async agents => {
    publicRoster = agents;
    await page.evaluate(next => { window.__tvRoster(next); window.dispatchEvent(new Event('focus')); }, agents);
  };
}

test('BUG-172: desktop away-frame and TV taps open the named live table, including a changed TV selection', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const updateRoster = await fixture(page);
  await page.goto('/');
  await page.getByTestId('home-frame-tv-0').click();
  await expect(page.getByTestId('desk-casino-table')).toHaveAccessibleName('Bal at the table');
  await expect(page.locator('.watch-felt')).toBeVisible();
  await page.getByRole('button', { name: 'BACK TO THE FLOOR', exact: true }).click();
  await expect(page.getByTestId('home-tv')).toBeVisible();
  const changed = roster.map((agent, i) => i !== 2 ? agent : { ...agent,
    activeTableId: 'casino-bluff', location: { ...agent.location, where: 'table', tableId: 'casino-bluff', room: 'backroom' },
    liveGame: { ...roster[0].liveGame, tableId: 'casino-bluff', blinds: '50/100', pot: 9000,
      seats: [{ displayName: 'Bluff', identity: agent.identity }, seats[1]] },
  });
  await updateRoster(changed);
  const tv = page.getByTestId('home-tv');
  await expect(tv).toHaveAccessibleName("Television — Watch Bluff's live table");
  await expect(tv.locator('.home-tv__caption')).toHaveText('Bluff · 50/100');
  await expect(tv.locator('.home-tv__ghost')).toHaveCount(2);
  await tv.click();
  await expect(page.getByTestId('desk-casino-table')).toHaveAccessibleName('Bluff at the table');
  await expect(page.getByRole('heading', { name: 'The table · 50/100' })).toBeVisible();
  await expect(page.locator('.watch-felt')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__tvSent.filter(m => m.type === 'watch').at(-1))).toMatchObject({ tableId: 'casino-bluff', agentId: 'tv-2' });
  await page.screenshot({ path: artifact('desktop-tv172-selected-table.png') });
});

for (const width of [390, 1440]) {
  test(`BUG-169: the live picture can return to an actual saved tape without changing its tap at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const updateRoster = await fixture(page);
    await page.goto('/');
    await expect(page.getByTestId('home-tv-felt')).toBeVisible();
    const returned = roster.map((agent, i) => ({ ...agent, activeTableId: null, liveGame: null,
      location: { where: 'home', tableId: null, room: null, since: Date.now() },
      routine: { key: 'reads', label: 'reading' },
      sessionFlagged: i === 0 ? [badBeatHand] : [],
    }));
    await updateRoster(returned);
    const tv = page.getByTestId('home-tv');
    await expect(tv).toHaveAccessibleName("Television — Replay Bal's hand #37");
    await expect(tv.getByTestId('home-tape')).toContainText('BAD BEAT');
    await expect(tv.locator('.home-tv__recording-cards > *')).toHaveCount(5);
    await expect(tv.locator('.home-tv__recording-caption')).toHaveText('Bal · #37');
    await expect(tv.locator('.home-tv__live-signal, .home-tv__ghost, .home-tv__recording-progress')).toHaveCount(0);
    await tv.scrollIntoViewIfNeeded();
    await tv.screenshot({ path: artifact(`tape-unchanged-${width}.png`) });
    await tv.click();
    await expect(page.locator(width === 390 ? '.replay-theatre' : '.dsk-replay')).toBeVisible();
  });
}

for (const viewport of [{ width: 390, height: 590 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`BUG-169: authored live-TV identities and caption lead to the actual table at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page);
    await page.goto('/');
    const tv = page.getByTestId('home-tv');
    await expect(tv).toHaveAccessibleName("Television — Watch Bal's live table");
    await tv.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    const tag = `${process.env.BUG169_PHASE || 'green'}-${viewport.width}x${viewport.height}`;
    await page.screenshot({ path: artifact(`tv-${tag}.png`) });
    await tv.screenshot({ path: artifact(`tv-crop-${tag}.png`) });
    await expect(tv.locator('.home-tv__ghost')).toHaveCount(5);
    await expect(tv.locator('.home-tv__caption')).toHaveText('Bal · 25/50');
    await expect(tv.locator('.home-tv__caption')).toHaveCSS('text-align', 'left');
    await expect(tv.locator('.home-tv__caption')).toHaveCSS('font-family', /JetBrains Mono/);
    await expect(tv.locator('.home-tv__live-signal')).toHaveCSS('background-color', 'rgb(255, 107, 109)');
    await expect(tv.locator('.home-tv__ghost.is-own path')).toHaveAttribute('fill', '#6E5836');
    await expect(tv.locator('.home-tv__ghost.is-own ellipse').first()).toHaveAttribute('fill', '#C9A227');
    await expect(tv).toHaveCSS('width', viewport.width >= 1100 ? '140px' : '100px');
    await expect(tv).toHaveCSS('height', viewport.width >= 1100 ? '78px' : '58px');
    // The authored TV ring has no cards; the separate away frame still has
    // the actual three-card board and pot from the same table.
    await expect(tv.locator('.home-frame__card')).toHaveCount(0);
    await expect(page.getByTestId('home-frame-tv-0').locator('.home-frame__card')).toHaveCount(3);
    await tv.click();
    await expect(page.locator('.watch-felt')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__tvSent.some(m => m.type === 'watch' && m.tableId === 'casino-tv' && m.agentId === 'tv-0'))).toBe(true);
    expect(errors).toEqual([]);
  });
}
