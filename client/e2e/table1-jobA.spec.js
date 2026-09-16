// client/e2e/table1-jobA.spec.js — TABLE-1 job A
//
// "No element in this view may change size as a result of a card, an action,
// a pot change or a state change." This is that claim, measured: the hero
// strip's stamina and heat row is snapshotted through preflop, flop, turn,
// river and showdown, plus an opponent's check, a hero call and (in a second
// hand) a hero fold — and the box must be byte-identical every time.
//
// Root cause this proves fixed: ActionNarrator used to return null (no box
// at all) whenever it had nothing to say, and a real box once a hand settled
// or an action landed. It sits between the felt (flex:1) and the composer, so
// that difference was the felt's own height — and everything positioned by a
// fixed offset or a percentage of the felt (the hero strip, its stamina/heat
// row, the pot, the board) shifted by the same amount every time.
//
// Same fixture and stub shape as watch10.spec.js. Outside `npm test`/CI —
// same reason home.spec.js gives: this is a browser measurement jsdom cannot
// make, not a rule that changes behaviour under test doubles.
//
//   cd client && npx playwright test e2e/table1-jobA.spec.js

import { test, expect } from '@playwright/test';

const HOME = 'http://127.0.0.1:5199/';
const VIEWPORT = { width: 390, height: 844 };

const loc = (where = 'home', extra = {}) => ({ where, tableId: null, room: null, since: Date.now() - 41 * 60_000, ...extra });
const agent = (id, name, over = {}) => ({
  id, name, style: 'Balanced', risk: 'Medium', nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 40 }, fatigue: 'fresh', location: loc('home'),
  routine: { key: 'reads', label: 'reading' }, unseenRecap: false, want: null,
  opener: 'Sit down.', activeTableId: null, pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 }, careerStats: { hands: 140, sessions: 4, net: 1200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [], ...over,
});

const HOUSEHOLD = [agent('a1', 'The Clock'), agent('a2', 'River Rat')];
const seat = (name, stack, over = {}) => ({
  playerId: `p_${name}`, stack, holeCards: [], contribTotal: 20, contribThisStreet: 20,
  folded: false, allIn: false, actedThisStreet: false, displayName: name,
  // Fatigue and heat set on the hero seat so the strip has something to draw
  // a stamina/heat row FROM — a null-fatigue seat draws neither (BodyBars
  // returns null), which would make this test trivially pass on an empty row.
  fatigue: 'settled', mood: { state: 'neutral', heat: 55 }, ...over,
});

const HOME_GAME = {
  tableId: 'home-4242', state: 'running',
  seats: [
    { seat: 0, agentId: 'a1', name: 'The Clock', house: false },
    { seat: 1, agentId: 'a2', name: 'Granite', house: false },
  ],
  handsPlayed: 7,
};

function baseTable(over = {}) {
  return {
    tableId: 'home-4242', handNumber: 3, street: 'preflop', smallBlind: 50, bigBlind: 100,
    dealerSeat: 0, pot: 150, community: [], currentBet: 100, lastRaiseSize: 100, toAct: 0,
    seats: [
      // "two pair, threes and sevens" — handName()'s own longest output — so
      // the box is measured against the widest thing it will ever have to
      // hold, not a short placeholder that happens to fit.
      seat('The Clock', 15_867, { holeCards: ['3s', '7s'], contribThisStreet: 50 }),
      seat('Granite', 3_862, { contribThisStreet: 100 }),
    ],
    result: null,
    ...over,
  };
}

async function stub(page) {
  const roster = HOUSEHOLD.map((a) => ({ ...a }));
  await page.route('**/api/agents?**', (r) => r.fulfill({ json: { agents: roster } }));
  await page.route('**/api/agents/*/study**', (r) => r.fulfill({ json: { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (r) => r.fulfill({ json: { sessionId: 's1', count: 0, lines: [] } }));
  await page.route('**/api/home/thread**', (r) => r.fulfill({ json: { sessionId: 'home', count: 0, lines: [] } }));
  await page.route('**/api/fridge?**', (r) => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/agents/*/memory**', (r) => r.fulfill({ json: { memoryContext: '' } }));
  await page.route('**/api/agents/*/hands**', (r) => r.fulfill({ json: { recentHands: [] } }));
  await page.route('**/api/wallet**', (r) => r.fulfill({ json: { balance: 12000, ledger: [] } }));
  await page.route('**/api/events**', (r) => r.fulfill({ json: { events: [], lastId: 0 } }));
  await page.route('**/api/rooms**', (r) => r.fulfill({ json: { rooms: [], hotWindowMs: 20000 } }));
  await page.route('**/api/stats**', (r) => r.fulfill({ json: { totalAgents: 12, handsPlayedToday: 3 } }));
  await page.route('**/api/slots**', (r) => r.fulfill({ json: { used: 2, cap: 4, next: null } }));
  await page.route('**/api/auth/config**', (r) => r.fulfill({ json: { botUsername: '' } }));
  await page.route('https://telegram.org/**', (r) => r.fulfill({ body: '', contentType: 'application/javascript' }));

  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
        initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
        viewportHeight: window.innerHeight,
        ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
      },
    };
  });

  await page.addInitScript(([list, home, table]) => {
    const sockets = [];
    window.__pushWatchState = (state) => sockets.forEach((s) => s.dispatch('message', {
      data: JSON.stringify({ type: 'state', state, legalActions: [{ type: 'fold' }, { type: 'call', amount: 50 }, { type: 'raise', min: 200, max: 15867 }] }),
    }));
    window.__pushDecision = (decision) => sockets.forEach((s) => s.dispatch('message', {
      data: JSON.stringify({ type: 'decision', ...decision }),
    }));
    class ScriptedSocket {
      constructor(url) {
        sockets.push(this); this.url = url; this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          this.dispatch('message', { data: JSON.stringify({ type: 'home_state', userId: '4242', agents: list, game: home }) });
          this.dispatch('message', { data: JSON.stringify({ type: 'watching', spectatorSeat: 0 }) });
          this.dispatch('message', { data: JSON.stringify({ type: 'state', state: table, legalActions: [{ type: 'fold' }, { type: 'call', amount: 50 }, { type: 'raise', min: 200, max: 15867 }] }) });
        }, 30);
      }
      dispatch(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { const at = this.listeners[type]?.indexOf(fn) ?? -1; if (at >= 0) this.listeners[type].splice(at, 1); }
      send() {}
      close() { this.readyState = 3; }
    }
    ScriptedSocket.OPEN = 1;
    ScriptedSocket.prototype.OPEN = 1;
    window.WebSocket = ScriptedSocket;
  }, [roster, HOME_GAME, baseTable()]);
}

async function felt(page) {
  await stub(page);
  await page.setViewportSize(VIEWPORT);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
  await page.getByTestId('home-table').click();
  await page.getByTestId('home-table-watch').click();
  await page.waitForSelector('.watch-felt');
  await page.waitForTimeout(400);
}

/** The stamina/heat row's own box, plus the felt's — a box that moved because
 * the FELT moved (TABLE-1 job A's actual bug) is exactly as much a failure as
 * one that moved on its own. */
function bars(page) {
  return page.evaluate(() => {
    const r = document.querySelector('.watch-hero__strip .felt-bars').getBoundingClientRect();
    const f = document.querySelector('.watch-felt').getBoundingClientRect();
    return {
      bars: { top: r.top, left: r.left, width: r.width, height: r.height },
      felt: { top: f.top, left: f.left, width: f.width, height: f.height },
    };
  });
}

// The "Hand now" reading, never the "To call" one that sits beside it —
// `.watch-felt__hero-lbl` alone resolves to both once toCall > 0.
const HAND_LBL = '.watch-hero__holding .watch-felt__hero-lbl';

test.describe('TABLE-1 job A · the stamina/heat row never moves', () => {
  test('preflop, flop, turn, river, an opponent check, a hero call — same box every time', async ({ page }) => {
    await felt(page);
    const readings = [];

    readings.push(['preflop', await bars(page)]);

    await page.evaluate((t) => window.__pushWatchState({ ...t, street: 'flop', community: ['3h', '7d', '2c'], pot: 250, currentBet: 0, toAct: 1, seats: t.seats.map((s) => ({ ...s, contribThisStreet: 0 })) }), baseTable());
    await expect(page.locator(HAND_LBL)).toHaveText('FLOP · Hand now', { timeout: 10_000 });
    readings.push(['flop', await bars(page)]);

    // The opponent checks: his action chip and pill update, hero's strip does not.
    await page.evaluate((t) => window.__pushDecision({ action: { type: 'check' }, seat: 1, reasoning: null, equity: null }), baseTable());
    await page.evaluate((t) => window.__pushWatchState({ ...t, street: 'flop', community: ['3h', '7d', '2c'], pot: 250, currentBet: 0, toAct: 0 }), baseTable());
    await page.waitForTimeout(150);
    readings.push(['opponent check', await bars(page)]);

    await page.evaluate((t) => window.__pushWatchState({ ...t, street: 'turn', community: ['3h', '7d', '2c', '4s'], pot: 450, currentBet: 0, toAct: 1 }), baseTable());
    await expect(page.locator(HAND_LBL)).toHaveText('TURN · Hand now', { timeout: 10_000 });
    readings.push(['turn', await bars(page)]);

    // River, facing a bet: the "To call" column joins the hand-name column.
    await page.evaluate((t) => window.__pushWatchState({ ...t, street: 'river', community: ['3h', '7d', '2c', '4s', '9d'], pot: 450, currentBet: 100, toAct: 0 }), baseTable());
    await expect(page.locator(HAND_LBL)).toHaveText('RIVER · Hand now', { timeout: 10_000 });
    await expect(page.getByText('To call', { exact: true })).toBeVisible();
    readings.push(['river, facing a bet', await bars(page)]);

    // Hero calls: the action chip appears on his own strip.
    await page.evaluate((t) => window.__pushDecision({ action: { type: 'call', amount: 100 }, seat: 0, reasoning: null, equity: null }));
    await page.evaluate((t) => window.__pushWatchState({ ...t, street: 'river', community: ['3h', '7d', '2c', '4s', '9d'], pot: 550, currentBet: 100, toAct: null }), baseTable());
    await expect(page.locator('.watch-hero__strip .watch-felt__action-chip')).toBeVisible({ timeout: 10_000 });
    readings.push(['hero calls', await bars(page)]);

    const finalState = {
      ...baseTable(), street: 'complete', toAct: null,
      community: ['3h', '7d', '2c', '4s', '9d'],
      seats: [
        { ...baseTable().seats[0], holeCards: ['3s', '7s'], stack: 15_867 + 550 },
        { ...baseTable().seats[1], stack: 6_000, folded: false },
      ],
      pot: 0, bigBlind: 100,
      result: { type: 'showdown', pot: 550, winners: [{ seat: 0, amount: 550 }], showdown: [{ seat: 0, holeCards: ['3s', '7s'] }, { seat: 1, holeCards: ['Ts', 'Tc'] }] },
    };
    await page.evaluate((s) => window.__pushWatchState(s), finalState);
    await expect(page.locator('.watch-felt__won')).toBeVisible({ timeout: 10_000 });
    readings.push(['showdown', await bars(page)]);

    const [, first] = readings[0];
    for (const [label, reading] of readings) {
      expect(reading, `${label}: stamina/heat row moved`).toEqual(first);
    }
  });

  test('a hero fold: same box before and after', async ({ page }) => {
    await felt(page);
    const before = await bars(page);

    await page.evaluate(() => window.__pushDecision({ action: { type: 'fold' }, seat: 0, reasoning: null, equity: null }));
    await page.evaluate((t) => window.__pushWatchState({ ...t, street: 'preflop', toAct: null, seats: t.seats.map((s, i) => (i === 0 ? { ...s, folded: true } : s)) }), baseTable());
    await expect(page.locator('.watch-hero__strip .watch-felt__action-chip')).toHaveText('FOLD', { timeout: 10_000 });
    const after = await bars(page);

    expect(after).toEqual(before);
  });
});
