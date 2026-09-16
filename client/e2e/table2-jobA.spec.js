// client/e2e/table2-jobA.spec.js — TABLE-2 job A
//
// Reading an opponent draws his card over the felt — but BUG-133's own rule
// ("his cards, hands and strip stay above the read glass") applied uniformly
// to every overlay, including this one, when it was written for the THREAD
// sheet specifically (a conversation about the OWNER's own agent, where his
// own hand staying visible is the point). Tapping an opponent instead drew
// the hero's floating hands, his hole cards and the "Est. pot share" rope
// on top of the opponent's own card — over its rows, over the line the
// opponent's own name sits beside, close enough to its Close button to make
// it unreliable.
//
// This is a real paint-order question a browser answers and jsdom cannot
// (elementFromPoint is unimplemented there), so it lives here rather than
// in a vitest file. Same stub shape as table1-jobA.spec.js.
//
//   cd client && npx playwright test e2e/table2-jobA.spec.js

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

const HOUSEHOLD = [agent('a1', 'The Clock'), agent('a2', 'Granite')];
const seat = (name, stack, over = {}) => ({
  playerId: `p_${name}`, stack, holeCards: [], contribTotal: 20, contribThisStreet: 20,
  folded: false, allIn: false, actedThisStreet: false, displayName: name,
  fatigue: 'settled', mood: { state: 'neutral', heat: 55 }, ...over,
});

const TABLE = {
  tableId: 'home-4242', handNumber: 3, street: 'flop', smallBlind: 50, bigBlind: 100,
  dealerSeat: 0, pot: 250, community: ['3h', '7d', '2c'], currentBet: 0, lastRaiseSize: 100, toAct: 1,
  seats: [
    seat('The Clock', 15_867, { holeCards: ['3s', '7s'], contribThisStreet: 0 }),
    seat('Granite', 3_862, { contribThisStreet: 0 }),
  ],
  reads: [{ seat: 1, playerId: 'p_Granite', name: 'Granite', hands: 41, formed: true, rows: [{ key: 'plays', label: 'PLAYS', v: 0.3, conf: 0.6, formed: true }] }],
  result: null,
};

const HOME_GAME = {
  tableId: 'home-4242', state: 'running',
  seats: [
    { seat: 0, agentId: 'a1', name: 'The Clock', house: false },
    { seat: 1, agentId: 'a2', name: 'Granite', house: false },
  ],
  handsPlayed: 7,
};

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
    class ScriptedSocket {
      constructor(url) {
        sockets.push(this); this.url = url; this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          this.dispatch('message', { data: JSON.stringify({ type: 'home_state', userId: '4242', agents: list, game: home }) });
          this.dispatch('message', { data: JSON.stringify({ type: 'watching', spectatorSeat: 0 }) });
          this.dispatch('message', { data: JSON.stringify({ type: 'state', state: table, legalActions: [] }) });
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
  }, [roster, HOME_GAME, TABLE]);
}

test('TABLE-2 job A: an opened opponent card sits above every hero element on the felt', async ({ page }) => {
  await stub(page);
  await page.setViewportSize(VIEWPORT);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
  await page.getByTestId('home-table').click();
  await page.getByTestId('home-table-watch').click();
  await page.waitForSelector('.watch-felt');
  await page.waitForTimeout(400);

  // The "you are watching" context hint sits over the seat on first open.
  const hint = page.getByRole('button', { name: 'OK', exact: true });
  if (await hint.count()) await hint.click();

  await page.locator('.watch-felt__seat').first().click({ force: true });
  await page.waitForSelector('.read-sheet');
  await page.waitForTimeout(300);

  const result = await page.evaluate(() => {
    const sheet = document.querySelector('.read-sheet');
    const closeBtn = document.querySelector('.read-sheet__grab');
    const heroCards = document.querySelector('.watch-hero__cards');
    const heroTug = document.querySelector('.watch-hero__tug');
    const insideSheet = (el) => !!el && (sheet.contains(el) || el === sheet);
    const centerOf = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const closeCenter = centerOf(closeBtn);
    const heroCardsCenter = heroCards ? centerOf(heroCards) : null;
    const heroTugCenter = heroTug ? centerOf(heroTug) : null;
    return {
      closeReachable: insideSheet(document.elementFromPoint(closeCenter.x, closeCenter.y)),
      heroCardsBehindSheet: heroCardsCenter ? insideSheet(document.elementFromPoint(heroCardsCenter.x, heroCardsCenter.y)) : null,
      heroTugBehindSheet: heroTugCenter ? insideSheet(document.elementFromPoint(heroTugCenter.x, heroTugCenter.y)) : null,
      sheetZ: Number(getComputedStyle(sheet).zIndex),
      heroZ: Number(getComputedStyle(document.querySelector('.watch-hero')).zIndex),
    };
  });

  // The card's own Close button must always be the thing a tap actually hits.
  expect(result.closeReachable).toBe(true);
  // Wherever the hero's own cards and his pot-share rope fall inside the
  // sheet's 70%-of-the-felt footprint, the sheet — not the hero — must be
  // what paints there.
  expect(result.heroCardsBehindSheet).toBe(true);
  expect(result.heroTugBehindSheet).toBe(true);
  expect(result.sheetZ).toBeGreaterThan(result.heroZ);
});
