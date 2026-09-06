// client/e2e/watch10.spec.js — WATCH-10
//
// SIX SEATS AT 390×844, AND NOTHING TOUCHING ANYTHING.
//
// The arithmetic is lib/feltBubbles.test.jsx: a modelled box per pill and per
// bubble, and a placement that skips whoever has no clear side. A model is only
// as good as its numbers, though, and every one of them was read off a
// stylesheet by hand — so this measures the REAL boxes, in a real browser, at
// the size the Mini App actually opens at, and fails if two of them intersect.
//
// Same rules as home.spec.js and bugs-a.spec.js: outside `npm test` and outside
// CI, every fixture served through page.route, no server and no model. Run:
//
//   cd client && npx playwright test e2e/watch10.spec.js

import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 390, height: 844 };
const HOME = 'http://127.0.0.1:5199/';

const loc = (where = 'home', extra = {}) => ({
  where, tableId: null, room: null, since: Date.now() - 41 * 60_000, ...extra,
});

const agent = (id, name, over = {}) => ({
  id,
  name,
  style: 'Balanced',
  risk: 'Medium',
  nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 40 },
  fatigue: 'fresh',
  location: loc('home'),
  routine: { key: 'reads', label: 'reading' },
  unseenRecap: false,
  want: null,
  opener: 'Sit down.',
  activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 },
  careerStats: { hands: 140, sessions: 4, net: 1200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [],
  ...over,
});

const HOUSEHOLD = [agent('a1', 'The Clock'), agent('a2', 'River Rat')];

// The kitchen table, so there is something to tap into the felt with.
const HOME_GAME = {
  tableId: 'home-4242',
  state: 'running',
  seats: [
    { seat: 0, agentId: 'a1', name: 'The Clock', house: false },
    { seat: 1, agentId: 'a2', name: 'River Rat', house: false },
  ],
  handsPlayed: 7,
};

// SIX HANDED, with the widest cast the felt can be asked to draw: long names,
// four-figure stacks, and a hand in progress so every seat has cards, chips and
// a pill up at once. Hero is seat 0, so the other five take ml · tl · tc · tr ·
// mr — every slot the ring has.
const seat = (name, stack, over = {}) => ({
  playerId: `p_${name}`,
  stack,
  holeCards: [],
  contribTotal: 20,
  contribThisStreet: 20,
  folded: false,
  allIn: false,
  actedThisStreet: false,
  displayName: name,
  mood: { state: 'neutral', heat: 30 },
  ...over,
});

const TABLE = {
  tableId: 'home-4242',
  handNumber: 3,
  street: 'flop',
  smallBlind: 10,
  bigBlind: 20,
  dealerSeat: 0,
  pot: 4180,
  community: ['5c', '4h', '8c'],
  currentBet: 40,
  lastRaiseSize: 40,
  toAct: 1,
  seats: [
    seat('The Clock', 1847, { holeCards: ['6h', '6s'], contribThisStreet: 40 }),
    seat('Doyle_v3', 980),
    seat('Granite', 2104),
    seat('nash_eq', 3410),
    seat('Bluff Master General', 12_400),
    seat('ivey_bot', 880),
  ],
  result: null,
};

/** Everything the app asks for, from a fixture — and a socket that plays a hand. */
async function stub(page, { talk = [] } = {}) {
  await page.route('**/api/agents?**', (r) => r.fulfill({ json: { agents: HOUSEHOLD } }));
  await page.route('**/api/agents/*/study**', (r) => r.fulfill({ json: { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (r) => r.fulfill({ json: { sessionId: 's1', count: 0, lines: [] } }));
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
        viewportHeight: 844,
        ready() {}, expand() {},
        disableVerticalSwipes() {},
        onEvent() {}, offEvent() {},
      },
    };
  });

  // Two sockets, one class: the floor channel answers FLOOR_SUB with the
  // household and the kitchen table; the table channel answers with WATCHING,
  // the six-handed STATE, and whatever the cast is saying.
  await page.addInitScript(([list, home, table, lines]) => {
    class ScriptedSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          this.dispatch('message', {
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents: list, game: home }),
          });
          this.dispatch('message', { data: JSON.stringify({ type: 'watching', spectatorSeat: 0 }) });
          this.dispatch('message', {
            data: JSON.stringify({ type: 'state', state: table, legalActions: [] }),
          });
          for (const line of lines) {
            this.dispatch('message', {
              data: JSON.stringify({ type: 'chat', from: line.from, seat: line.seat, text: line.text, isAI: true }),
            });
          }
        }, 30);
      }
      dispatch(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) {
        const at = this.listeners[type]?.indexOf(fn) ?? -1;
        if (at >= 0) this.listeners[type].splice(at, 1);
      }
      send() {}
      close() { this.readyState = 3; }
    }
    ScriptedSocket.OPEN = 1;
    ScriptedSocket.prototype.OPEN = 1;
    window.WebSocket = ScriptedSocket;
  }, [HOUSEHOLD, HOME_GAME, TABLE, talk]);
}

/** Open the room, tap the kitchen table, and wait for six seats on the felt. */
async function felt(page, opts = {}) {
  await stub(page, opts);
  await page.setViewportSize(VIEWPORT);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
  // The kitchen table opens its sheet, and the sheet offers the game on it.
  await page.getByTestId('home-table').click();
  await page.getByTestId('home-table-watch').click();
  await page.waitForSelector('.watch-felt');
  // The deal has to finish before every seat is holding cards.
  await page.waitForFunction(
    () => document.querySelectorAll('.watch-felt__seat .seat-ghost__backs').length === 5,
    null, { timeout: 15_000 },
  );
}

/** Every box that must not touch another, with a name to fail by. */
async function boxes(page, selector) {
  return page.$$eval(selector, (nodes) => nodes.map((n) => {
    const r = n.getBoundingClientRect();
    return {
      what: `${n.className} "${(n.textContent || '').trim().slice(0, 24)}"`,
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      w: r.width, h: r.height,
    };
  }));
}

const intersects = (a, b) => a.left < b.right && b.left < a.right
  && a.top < b.bottom && b.top < a.bottom;

/** Every unordered pair that shares area. */
function collisions(list) {
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      if (intersects(list[i], list[j])) out.push(`${list[i].what}  ×  ${list[j].what}`);
    }
  }
  return out;
}

test.describe('WATCH-10 · density on the felt at 390×844', () => {
  test('seats six and draws every one of them', async ({ page }) => {
    await felt(page);
    // Five opponents in the ring, and him at the bottom: six seats.
    await expect(page.locator('.watch-felt__seat')).toHaveCount(5);
    await expect(page.locator('.watch-hero__body')).toHaveCount(1);
    await expect(page.locator('.watch-felt__seat .seat-ghost__chip')).toHaveCount(5);
    await expect(page.locator('.watch-felt__seat-pile .chip-stack__amt')).toHaveCount(5);
    await page.screenshot({ path: 'e2e/__screenshots__/watch10-six-seats.png' });
  });

  test('no name pill touches another, or the hero, or the felt\'s edge', async ({ page }) => {
    await felt(page);
    const pills = await boxes(page, '.watch-felt__seat .seat-ghost__chip');
    expect(collisions(pills), 'two name pills on top of each other').toEqual([]);

    const felted = await page.locator('.watch-felt').boundingBox();
    for (const p of pills) {
      expect(p.left, `${p.what} runs off the left`).toBeGreaterThanOrEqual(felted.x);
      expect(p.right, `${p.what} runs off the right`).toBeLessThanOrEqual(felted.x + felted.width);
    }
  });

  test('no chip pile lands on a pill, on another pile, or on the pot', async ({ page }) => {
    await felt(page);
    const all = [
      ...await boxes(page, '.watch-felt__seat .seat-ghost__chip'),
      ...await boxes(page, '.watch-felt__seat-pile'),
      ...await boxes(page, '.watch-felt__pot-pill'),
    ];
    expect(collisions(all)).toEqual([]);
  });

  test('two bubbles never overlap each other, or a pill', async ({ page }) => {
    // Two of the three top seats speaking at once is the case that was broken:
    // tl was pinned at left:6 and ran to 156, tc began at 120.
    await felt(page, { talk: [
      { from: 'Granite', seat: 2, text: 'Again?' },
      { from: 'nash_eq', seat: 3, text: 'Too rich for me.' },
    ] });
    await page.waitForSelector('.watch-felt__bubble');
    const bubbles = await boxes(page, '.watch-felt__bubble');
    const pills = await boxes(page, '.watch-felt__seat .seat-ghost__chip');
    expect(bubbles.length).toBeGreaterThan(0);
    expect(bubbles.length).toBeLessThanOrEqual(2);
    expect(collisions([...bubbles, ...pills])).toEqual([]);

    const felted = await page.locator('.watch-felt').boundingBox();
    for (const b of bubbles) {
      expect(b.left).toBeGreaterThanOrEqual(felted.x);
      expect(b.right).toBeLessThanOrEqual(felted.x + felted.width);
    }
    await page.screenshot({ path: 'e2e/__screenshots__/watch10-bubbles.png' });
  });

  test('a bubble it has no room for is not drawn at all', async ({ page }) => {
    const long = 'He does that every single time he';
    await felt(page, { talk: [
      { from: 'Granite', seat: 2, text: long },
      { from: 'nash_eq', seat: 3, text: long },
    ] });
    await page.waitForSelector('.watch-felt__bubble');
    await expect(page.locator('.watch-felt__bubble')).toHaveCount(1);
  });

  test('one thousands separator, everywhere on the felt', async ({ page }) => {
    await felt(page);
    // 12,400 is the widest figure the cast carries, and the pot is 4,180.
    const felted = await page.locator('.watch-felt').innerText();
    expect(felted).toContain('$12,400');
    expect(felted).toContain('$4,180');
    // A narrow no-break space between digits is the other locale's grouping.
    expect(felted).not.toMatch(/\d[   ]\d/);
  });
});
