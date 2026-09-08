// client/e2e/home.spec.js — HOME-1
//
// Five pictures of the room at 390×844, the size the Mini App actually opens at.
//
// WHY THIS IS NOT IN `npm test` OR IN CI, and why Playwright is not a dependency
// of this repo:
//
//   * It is a LOOK check, not a rule check. Everything with a rule behind it —
//     the routine ladder, the walks, the want flow, the thread, the money law —
//     is asserted in HomeScreen.test.jsx under vitest, which runs in seconds and
//     gates every commit. Screenshots gate nothing; they are for a person's
//     eyes, and a screenshot diff in CI is a machine asking a person to look at
//     a picture, every time a shadow moves.
//   * Playwright plus a browser is a heavy install to put in every
//     contributor's `npm ci` for a check nothing blocks on. It is run with
//     `npx playwright test` from client/, which needs no entry in package.json
//     (CLAUDE.md: no new npm dependencies without a stated reason — the reason
//     for NOT adding one is this paragraph).
//
// The five states are the brief's own: one agent alone, two home and one away,
// a want, the thread open, the tape room. Each is served from a fixed fixture
// through page.route, so nothing here needs a server, a database, or a model —
// and the pictures are the same on every machine.
//
// Run:  cd client && npx playwright test e2e/home.spec.js
// Look: client/e2e/__screenshots__/*.png

import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { roomsResponse } from '../src/test/fixtures/rooms.js';
import { bigBluffHand } from '../src/test/fixtures/flagged.js';

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
  opener: 'Sit down. What do you want to know?',
  activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  stats: { handsPlayed: 140 },
  careerStats: { hands: 140, sessions: 4, net: 1200, biggestPot: 900, winRate: 0.52 },
  sessionLog: [],
  ...over,
});

const CASTS = {
  alone: {
    name: 'one-alone',
    agents: [agent('a1', 'The Clock', { nature: { name: 'Grinder' }, routine: { key: 'counts', label: 'counting chips' } })],
    game: null,
  },
  household: {
    name: 'two-home-one-away',
    agents: [
      agent('a1', 'The Clock', { nature: { name: 'Grinder' }, routine: { key: 'plays', label: 'in a hand' } }),
      agent('a2', 'River Rat', { nature: { name: 'Shark' }, routine: { key: 'plays', label: 'in a hand' }, mood: { state: 'confident', heat: 58 } }),
      agent('a3', 'Big Slick', {
        nature: { name: 'Hothead' },
        location: loc('table', { tableId: 't1', room: 'upstairs' }),
        routine: null,
        activeTableId: 't1',
        mood: { state: 'tilted', heat: 78 },
        liveGame: { tableId: 't1', pot: 480, board: ['Ah', 'Kd', '2c'], net: 340, street: 'flop' },
      }),
    ],
    game: { tableId: 'home-u1', state: 'running', seats: [{ seat: 0, agentId: 'a1', name: 'The Clock', house: false }, { seat: 1, agentId: 'a2', name: 'River Rat', house: false }], handsPlayed: 7 },
  },
  want: {
    name: 'a-want',
    agents: [
      agent('a1', 'The Clock', {
        mood: { state: 'frustrated', heat: 64 },
        want: { kind: 'beer', text: "Can I have a beer. It's been rough.", needs: null, dangerous: false },
      }),
      agent('a2', 'River Rat', { nature: { name: 'Hothead' }, routine: { key: 'paces', label: 'pacing' } }),
    ],
    game: null,
  },
  tape: {
    name: 'the-tape-room',
    agents: [
      agent('a1', 'The Clock', { routine: { key: 'tape', label: 'the tape room' } }),
      agent('a2', 'River Rat', { routine: { key: 'sleeps', label: 'asleep' }, fatigue: 'worn', mood: { state: 'sulking', heat: 22 } }),
    ],
    game: null,
    study: {
      study: { handNumber: 41, flagType: 'badBeat', startedAt: Date.now(), endsAt: Date.now() + 60_000 },
      book: [{ playerId: 'p1', displayName: 'Granite', updatedAt: Date.now(), lines: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] }],
      count: 1,
    },
  },
};

const THREAD = {
  sessionId: 's1',
  count: 4,
  lines: [
    { id: 1, kind: 'table', who: 'TABLE', text: 'Granite raised to 240', ts: Date.now() - 500_000, source: 'table' },
    { id: 2, kind: 'him', who: 'HIM', text: 'He does that every single time.', ts: Date.now() - 480_000, source: 'table' },
    { id: 3, kind: 'you', who: 'YOU', text: 'So take it off him.', ts: Date.now() - 460_000, source: 'table' },
    { id: 4, kind: 'him', who: 'HIM', text: 'Working on it. Long night in here.', ts: Date.now() - 60_000, source: 'home' },
  ],
};

// Everything the room asks for, from a fixture. No server, no database, no model.
async function stub(page, cast) {
  await page.route('**/api/agents?**', (route) => route.fulfill({ json: { agents: cast.agents } }));
  await page.route('**/api/agents/*/study**', (route) => route.fulfill({ json: cast.study ?? { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/*/thread**', (route) => route.fulfill({ json: THREAD }));
  await page.route('**/api/home/thread**', route => route.fulfill({ json: cast.agents.length ? THREAD : { sessionId: 'home-empty', lines: [], count: 0 } }));
  await page.route('**/api/fridge?**', route => route.fulfill({ json: { items: [{ id: 'beer', count: 4, price: 12 }, { id: 'snack', count: 2, price: 8 }] } }));
  await page.route('**/api/wallet**', (route) => route.fulfill({ json: { balance: 12_000, ledger: [] } }));
  await page.route('**/api/events**', (route) => route.fulfill({ json: { events: [], lastId: 0 } }));
  await page.route('**/api/rooms**', (route) => route.fulfill({ json: { rooms: [], hotWindowMs: 20_000 } }));
  await page.route('**/api/auth/config**', (route) => route.fulfill({ json: { botUsername: '' } }));

  // index.html loads Telegram's real SDK from telegram.org, and it REPLACES
  // window.Telegram when it arrives — which is after addInitScript has run, so
  // the stub below was being overwritten by a session with no initData and the
  // login gate took the screen. Block it: there is no Telegram here to talk to.
  await page.route('https://telegram.org/**', (route) => route.fulfill({ body: '', contentType: 'application/javascript' }));

  // The Mini App SDK, installed before the bundle runs so the login gate opens.
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
        initDataUnsafe: { user: { id: 4242, first_name: 'Jens' } },
        get viewportHeight() { return window.innerHeight; },
        ready() {}, expand() {}, disableVerticalSwipes() {},
        onEvent() {}, offEvent() {},
      },
    };
  });

  // HOME_STATE rides a WebSocket, and the HOME GAME rides only HOME_STATE —
  // GET /api/agents has no kitchen table in it. So the socket is scripted
  // rather than silenced: it opens, answers FLOOR_SUB with this cast's own
  // HOME_STATE, and says nothing else. That is the frame the server would
  // send, so the picture is of the real screen and not of a fallback.
  await page.addInitScript(([agents, game]) => {
    class ScriptedSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.listeners = { open: [], message: [], close: [], error: [] };
        setTimeout(() => {
          this.readyState = 1;
          this.dispatch('open', {});
          this.dispatch('message', {
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents, game }),
          });
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
  }, [cast.agents, cast.game ?? null]);
}

async function room(page, cast, viewport = VIEWPORT) {
  await stub(page, cast);
  await page.setViewportSize(viewport);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
  // The room's own bodies have landed, so nothing is captured mid-mount.
  await page.waitForSelector('.home-flat');
  await page.waitForTimeout(600);
}

test.describe('HOME-1 · board 29 at 390×844', () => {
  test('BUG-64: F13 renders stock and buys six from the safe', async ({ page }) => {
    await room(page, CASTS.alone);
    const bought = [];
    await page.route('**/api/fridge/stock', r => { bought.push(r.request().postDataJSON()); return r.fulfill({ json: { qty: 6, fridge: { beer: 10, snack: 2 } } }); });
    await page.getByTestId('home-fridge').click();
    const shelf = page.getByTestId('fridge-shelf-beer');
    await expect(shelf).toContainText('× 4');
    await expect(shelf).toContainText('$12 each');
    await expect(page.locator('.fridge-stock')).toHaveCSS('opacity', '1');
    await page.screenshot({ path: '../artifacts/fridge-f13.png' });
    await shelf.getByRole('button', { name: 'Buy 6 beer' }).click();
    await expect(shelf).toContainText('× 10');
    expect(bought).toEqual([{ userId: '4242', item: 'beer', qty: 6 }]);
  });
  for (const [frame, companion] of [
    ['c1', agent('bal', 'Balanced v2.1', { nickname: 'Bal', mood: { state: 'confident', heat: 22 }, drinking: true, opener: 'Put me in.', pocket: { balance: 1200, cap: 5000 } })],
    ['c2', agent('agg', 'Aggressive v1.3', { nickname: 'Agg', mood: { state: 'tilted', heat: 84 }, fatigue: 'settled', opener: 'Still thinking about that cooler against The Grinder.', want: { text: 'Let me back in there. Right now.', dangerous: true }, pocket: { balance: 640, cap: 2000 } })],
    ['c3', agent('bal', 'Balanced v2.1', { nickname: 'Bal', mood: { state: 'confident', heat: 22 }, chatHistory: [{ role: 'user', content: 'Why did you call there?' }, { role: 'assistant', content: 'It was the sizing. He never bets that big with a hand.' }, { role: 'user', content: 'Which hand?' }, { role: 'assistant', content: 'This one.' }, { role: 'user', content: 'Stay off him for a bit.' }, { role: 'assistant', content: 'Fine. I will wait for the button.' }] })],
  ]) {
    test(`AGENT-1: board 42 ${frame} reference state`, async ({ page }) => {
      await room(page, { agents: [companion], game: null });
      await page.route('**/api/agents/*/hands?**', r => r.fulfill({ json: { recentHands: [] } }));
      await page.route('**/api/agents/*/flagged?**', r => r.fulfill({ json: { flaggedHands: frame === 'c3' ? [bigBluffHand] : [] } }));
      await page.getByRole('button', { name: new RegExp(`^${companion.name} — `) }).click();
      await expect(page.getByTestId('agent-stage')).toBeVisible();
      await expect(page.locator('.agent-view__thread .agent-view__text').first()).toBeVisible();
      if (companion.want) await expect(page.getByRole('button', { name: 'Yes', exact: true })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      if (companion.fatigue === 'fresh') {
        const full = page.locator('.agent-view__body [data-bar="stamina"]');
        expect((await full.locator('i').boundingBox()).width).toBeCloseTo((await full.boundingBox()).width, 0);
      }
      await page.screenshot({ path: `../artifacts/agent-${frame}.png` });
      expect(await page.locator('.agent-view').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    });
  }
  for (const viewport of [{ width: 390, height: 844 }, { width: 390, height: 590 }, { width: 490, height: 844 }]) {
    test(`AGENT-1: character, conversation and Carry at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await room(page, CASTS.alone, viewport);
      await page.route('**/api/agents/*/hands?**', r => r.fulfill({ json: { recentHands: [] } }));
      await page.route('**/api/agents/*/attributes/log?**', r => r.fulfill({ json: { entries: [] } }));
      await page.route('**/api/agents/*/flagged?**', r => r.fulfill({ json: { flaggedHands: [] } }));
      await page.getByRole('button', { name: /^The Clock — / }).click();
      await expect(page.getByTestId('agent-stage')).toBeVisible();
      await expect(page.getByPlaceholder('Whisper to him…')).toBeVisible();
      await expect(page.locator('.dr-app-header')).toHaveCount(0);
      expect((await page.locator('.agent-view__header').boundingBox()).height).toBe(40);
      expect((await page.getByTestId('agent-stage').boundingBox()).width).toBe(viewport.width);
      const stage = await page.getByTestId('agent-stage').boundingBox();
      const namePill = await page.locator('.agent-view__body .home-pill').boundingBox();
      expect(namePill.y).toBeGreaterThanOrEqual(stage.y);
      // A clipped accessibility label has a 1px layout box, so Playwright's
      // visibility predicate deliberately calls it visible. Assert clipping.
      await expect(page.locator('.agent-view__body .sr-only')).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
      expect(namePill.height).toBeLessThanOrEqual(32);
      const composer = await page.locator('.agent-view__composer').boundingBox();
      expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height);
      await page.screenshot({ path: `../artifacts/agent-view-${viewport.width}-${viewport.height}.png` });
      const placements = [];
      await page.route('**/api/agents/*/place**', r => { placements.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true, line: 'I needed a rest.' } }); });
      await page.getByRole('button', { name: 'Carry', exact: true }).click();
      await expect(page.getByTestId('home-screen')).toBeVisible();
      await expect(page.locator('.home-carry-help')).toBeVisible();
      expect(placements).toHaveLength(0);
      const flat = await page.locator('.home-flat').boundingBox();
      await page.mouse.click(flat.x + 55 * flat.width / 390, flat.y + 385 * flat.width / 390);
      await expect.poll(() => placements.length).toBe(1);
      expect(placements[0].fixture).toBe('couch');
      await expect(page.locator('.home-carry-help')).toHaveCount(0);
    });
  }
  test('BUG-59: casino has one header and Home is one tap from floor or board', async ({ page }) => {
    await room(page, CASTS.alone);
    await page.route('**/api/rooms', r => r.fulfill({ json: roomsResponse }));
    await page.route('**/api/rooms/*/tables', r => r.fulfill({ json: { tables: [] } }));
    await page.getByTestId('home-door').click();
    await expect(page.getByTestId('floor-view')).toBeVisible();
    await expect(page.locator('.dr-app-header')).toHaveCount(0);
    const head = await page.locator('.csn-floor__head').boundingBox();
    expect(head.y).toBe(0);
    expect(head.height).toBeLessThanOrEqual(62);
    await page.getByTestId('casino-view-toggle').getByRole('button', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The casino', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Your agents', exact: true })).toHaveCount(1);
    expect((await page.locator('.csn-head').boundingBox()).height).toBeLessThanOrEqual(62);
    await page.screenshot({ path: '../artifacts/casino-board-shell.png' });
    await page.getByRole('button', { name: 'Back home', exact: true }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.getByTestId('home-door').click();
    await page.getByTestId('casino-view-toggle').getByRole('button', { name: 'Floor', exact: true }).click();
    await page.getByRole('button', { name: 'Back home', exact: true }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });
  test('BUG-60: the room conversation stays a compact strip with a round send control', async ({ page }) => {
    await room(page, CASTS.alone);
    const band = await page.locator('.home-thread__band').boundingBox();
    expect(band.height).toBeLessThanOrEqual(76);
    const send = await page.locator('.home-thread__send').boundingBox();
    expect(send.height).toBeCloseTo(send.width, 0);
    expect(send.height).toBe(26);
    await page.getByTestId('home-thread-input').fill('How are you?');
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    await page.getByTestId('home-thread-line').click();
    await expect(page.getByTestId('home-thread-rows')).toBeVisible();
  });
  for (const width of [390, 490]) {
    test(`BUG-59: Home uses one compact contextual header and fills ${width}px Telegram`, async ({ page }) => {
      await room(page, CASTS.alone, { width, height: 844 });
      await page.screenshot({ path: `../artifacts/home-shell-${width}.png` });
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
      const header = page.locator('[data-testid="room-header"]');
      expect((await header.boundingBox()).height).toBeLessThanOrEqual(48);
      await expect(page.getByRole('button', { name: 'Your agents', exact: true })).toHaveCount(1);
      const flat = await page.locator('.home-flat').boundingBox();
      expect(flat.width).toBeCloseTo(width, 0);
      expect(flat.x).toBeCloseTo(0, 0);
      await expect(page.getByTestId('home-table')).toBeVisible();
      await expect(page.getByTestId('home-safe')).toContainText('$12,000');
      await page.getByRole('button', { name: 'Your agents', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  }
  for (const height of [590, 844]) {
    test(`BUG-55: four agents and a pending want leave the table tappable at 390x${height}`, async ({ page }) => {
      const names = ['Loose Cannon', 'The Grinder', 'Wild Card', 'Bluff'];
      const agents = names.map((name, i) => agent(`p${i}`, name, {
        routine: { key: 'plays', label: 'in a hand' },
        want: i === 0 ? { kind: 'deploy', text: "I'm fresh and I'm sat here doing nothing. Put me in.", needs: 'deploy' } : null,
      }));
      await page.route('**/api/stats', r => r.fulfill({ json: { activeAgents: 0, totalAgents: 15 } }));
      await page.route('**/api/slots**', r => r.fulfill({ json: { used: 4, cap: 4, next: null } }));
      await room(page, { agents, game: {
        state: 'running', tableId: 'home-4242',
        seats: agents.map((a, seat) => ({ seat, agentId: a.id, name: a.name, house: false })),
      } }, { width: 390, height });
      // Real hit testing: a DOM .click() would bypass the overlay that Jens hit.
      const table = page.getByTestId('home-table');
      const box = await table.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('home-table-sheet-mobile')).toBeVisible({ timeout: 2000 });
      await page.getByTestId('home-table-sheet-mobile').getByRole('button', { name: 'Close', exact: true }).last().click();
      await expect(page.getByText("I'm fresh and I'm sat here doing nothing. Put me in.", { exact: true })).toHaveCount(1);
      // BUG-59: approved HomeHead replaces the global wordmark/count row.
      // Brand identity and the roster stay accessible in the single header.
      await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
      await expect(page.getByRole('img', { name: 'Railbird', exact: true })).toBeVisible();
      // Visible DOM nodes can still lie outside a clipped Telegram viewport.
      for (const control of [page.getByTestId('home-want-yes'), page.locator('.home-thread__input')]) {
        await expect(control).toBeInViewport();
      }
      await page.getByTestId('home-tv').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('home-tv')).toBeInViewport();
      await page.locator('.home1__room').evaluate(el => { el.scrollTop = 0; });
      const actual = await page.screenshot({ path: `e2e/shots/railbird-home-four-${height}.png` });
      if (height === 844) {
        const reference = await readFile(new URL('../../design-refs/frames/board29-f10-home-game.png', import.meta.url));
        const pair = await page.context().newPage();
        await pair.setViewportSize({ width: 820, height: 900 });
        await pair.setContent(`<body style="margin:0;padding:10px;background:#111818;color:#eee;font:14px system-ui"><div style="display:flex;gap:20px"><div>Reference · board 29 F10<br><img width="390" src="data:image/png;base64,${reference.toString('base64')}"></div><div>Repair · four agents + request<br><img width="390" src="data:image/png;base64,${actual.toString('base64')}"></div></div></body>`);
        await pair.screenshot({ path: 'e2e/shots/railbird-home-reference-pair.png' });
        await pair.close();
      }
    });
  }
  test('BUG-51: the first-agent action stays clear of the TV and can be clicked', async ({ page }) => {
    await page.route('**/api/slots**', route => route.fulfill({ json: { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } } }));
    await room(page, { agents: [], game: null });
    const action = page.locator('.home1__ftu-draft');
    await expect(action).toBeVisible();
    const actionBox = await action.boundingBox();
    const tvBox = await page.getByTestId('home-tv').boundingBox();
    expect(actionBox.y + actionBox.height).toBeLessThan(tvBox.y);
    const actual = await page.screenshot({ path: 'e2e/__screenshots__/home-empty-repaired.png' });
    // Optional local reference server: render the design itself for the
    // integrator's side-by-side review. Ordinary test runs need no board server.
    if (process.env.DESIGN_REF_URL) {
      const ref = await page.context().newPage();
      await ref.setViewportSize({ width: 1600, height: 1000 });
      await ref.goto(`${process.env.DESIGN_REF_URL}/Agentic%20Poker%20Home.html`);
      const frame = ref.locator('#f01 > div').first();
      await expect(frame).toBeVisible({ timeout: 30000 });
      const reference = await frame.screenshot();
      const pair = await page.context().newPage();
      await pair.setViewportSize({ width: 800, height: 900 });
      await pair.setContent(`<body style="margin:0;background:#161a1a;color:white;font:14px system-ui"><div style="display:flex;gap:20px;padding:0 0 0 0"><div>Reference · 29 F01<br><img width="390" src="data:image/png;base64,${reference.toString('base64')}"></div><div>Repair · 390 × 844<br><img width="390" src="data:image/png;base64,${actual.toString('base64')}"></div></div></body>`);
      await pair.screenshot({ path: 'e2e/shots/astra-home-empty-pair.png', fullPage: true });
      await pair.close();
      await ref.close();
    }
    await action.click();
    await expect(page.getByTestId('draft-input')).toBeVisible();
  });
  test('one agent alone', async ({ page }) => {
    await room(page, CASTS.alone);
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.screenshot({ path: `e2e/__screenshots__/home-${CASTS.alone.name}.png` });
  });

  test('two home and one away', async ({ page }) => {
    await room(page, CASTS.household);
    await expect(page.getByTestId('home-frame-a3')).toBeVisible();
    // FIX-6 job 4: a running table carries no label at all — design 52's rule
    // is no money words on the home table, and FOR NOTHING was two of them.
    await expect(page.getByTestId('home-game-label')).toHaveCount(0);
    await page.screenshot({ path: `e2e/__screenshots__/home-${CASTS.household.name}.png` });
  });

  test('a want', async ({ page }) => {
    await room(page, CASTS.want);
    await expect(page.getByTestId('home-want')).toBeVisible();
    await expect(page.getByTestId('home-want-yes')).toBeVisible();
    await page.screenshot({ path: `e2e/__screenshots__/home-${CASTS.want.name}.png` });
  });

  test('the thread open', async ({ page }) => {
    await room(page, CASTS.alone);
    await page.getByTestId('home-thread-line').click();
    await expect(page.getByTestId('home-thread-rows')).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'e2e/__screenshots__/home-thread-open.png' });
  });

  test('the tape room', async ({ page }) => {
    await room(page, CASTS.tape);
    await expect(page.getByTestId('home-tape')).toBeVisible();
    await expect(page.getByTestId('home-says-a1')).toContainText('GRANITE');
    await page.screenshot({ path: `e2e/__screenshots__/home-${CASTS.tape.name}.png` });
  });
});
