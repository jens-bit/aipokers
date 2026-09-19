import { test, expect } from '@playwright/test';

const VIEWPORT = { width: 390, height: 844 };
const HOME = '/';

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
  tableId: 'casino-repair',
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
async function stub(page, { talk = [], owned = false, agentOverrides = {}, table = TABLE } = {}) {
  const roster = owned ? HOUSEHOLD.map((a,i)=>i===0 ? {...a,activeTableId:table.tableId,location:loc('table',{tableId:table.tableId,room:'floor'}),liveGame:{tableId:table.tableId,pot:table.pot,board:table.community}} : a) : HOUSEHOLD.map(a => ({ ...a }));
  roster[0] = { ...roster[0], ...agentOverrides };
  await page.route('**/api/agents?**', (r) => r.fulfill({ json: { agents: roster } }));
  await page.route(/\/api\/agents\/a[12]\?/, (r) => r.fulfill({ json: { agent: roster.find(agent => r.request().url().includes(`/agents/${agent.id}?`)) } }));
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
    const sockets=[];
    window.__pushWatchMessage=msg=>sockets.forEach(socket=>socket.dispatch('message',{data:JSON.stringify(msg)}));
    window.__pushWatchState=state=>sockets.forEach(socket=>socket.dispatch('message',{data:JSON.stringify({type:'state',state,legalActions:[]})}));
    class ScriptedSocket {
      constructor(url) {
        sockets.push(this);
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
  }, [roster, owned ? null : HOME_GAME, table, talk]);
}

/** Open the room, tap the kitchen table, and wait for six seats on the felt. */
async function felt(page, opts = {}) {
  await stub(page, opts);
  await page.setViewportSize(opts.viewport ?? VIEWPORT);
  await page.goto(HOME);
  await page.waitForSelector('[data-testid="home-screen"]');
  // The kitchen table opens its sheet, and the sheet offers the game on it.
  if (opts.owned) await page.getByTestId('home-frame-a1').click();
  else {
    await page.getByTestId('home-table').click();
    await page.getByTestId('home-table-watch').click();
  }
  await page.waitForSelector('.watch-felt');
  // The deal has to finish before every seat is holding cards.
  await page.waitForFunction(
    () => document.querySelectorAll('.watch-felt__seat .seat-ghost__backs').length === 5,
    null, { timeout: 15_000 },
  );
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`BUG-271: opponent read keeps the felt identity at ${viewport.width}`, async ({ page }, testInfo) => {
    const identities = [
      { name: 'Doyle_v3', hood: 'moss', glow: 'gold', color: '#C9A227' },
      { name: 'Granite', hood: 'indigo', glow: 'ice', color: '#7FA8C9' },
    ];
    const table = { ...TABLE, seats: TABLE.seats.map((seat, index) => index === 1 || index === 2
      ? { ...seat, identity: { hood: identities[index - 1].hood, glow: identities[index - 1].glow } }
      : seat) };
    await felt(page, { owned: true, viewport, table });
    for (const identity of identities) {
      const opponent = page.getByRole('button', { name: `${identity.name} — read`, exact: true });
      await expect(opponent.locator('.floor-ghost')).toHaveAttribute('data-hood', identity.hood);
      await opponent.click();
      const sheet = page.getByRole('dialog', { name: `${identity.name} — read`, exact: true });
      await expect(sheet.locator('.mood-ghost')).toHaveAttribute('data-hood', identity.hood);
      await expect(sheet.locator('.mood-ghost radialGradient stop').first()).toHaveAttribute('stop-color', identity.color);
      await expect(sheet).toHaveCSS('opacity', '1');
      await expect(sheet.getByText('NO EVIDENCE YET')).toBeVisible();
      await expect(page.locator('.watch-hero__cards')).toContainText('6');
      await page.screenshot({ path: testInfo.outputPath(`opponent-read-${identity.hood}-${viewport.width}.png`) });
      await sheet.getByRole('button', { name: 'Close read' }).click();
      await expect(sheet).not.toBeVisible();
    }
  });
}

for (const height of [590, 844]) test(`BUG-241: private panel fits one third and keeps the hand visible at 390x${height}`, async ({ page }, testInfo) => {
  await felt(page, { owned: true, viewport: { width: 390, height }, agentOverrides: {
    attrs: { READS: 41, FOCUS: 55, DISCIPLINE: 60, DECEPTION: 35 },
    chatHistory: [{ role: 'assistant', content: 'I am watching how Granite plays this flop.' }],
  } });
  await page.getByRole('button', { name: 'View your agent at the table' }).click();
  const sheet = page.getByRole('dialog', { name: 'The Clock at the table' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath(`watch-agent-${height}.png`) });
  const panel = await sheet.boundingBox();
  expect(panel.height).toBeLessThanOrEqual(height / 3 + 1);
  const hero = await page.locator('.watch-hero__body').boundingBox();
  const cards = await page.locator('.watch-hero__cards').boundingBox();
  const board = await page.locator('.watch-felt__board').boundingBox();
  expect(hero.y).toBeGreaterThanOrEqual(board.y + board.height);
  expect(cards.y + cards.height).toBeLessThanOrEqual(panel.y);
  expect(hero.y + hero.height).toBeLessThanOrEqual(panel.y);
  await expect(sheet.getByRole('button', { name: 'Conversation', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // The hole-card ranks remain visible and hit the hero, never the sheet.
  await expect(page.locator('.watch-hero__cards')).toContainText('6');
  const overlaps = await page.locator('.watch-felt').evaluate(felt => {
    const all = [...felt.querySelectorAll('.seat-ghost__chip, .watch-felt__seat-pile, .watch-felt__seat-bet, .watch-felt__pot-pill, .watch-felt__board, .watch-felt__hero-stack')]
      .map(el => ({ name: el.textContent, box: el.getBoundingClientRect() }));
    const bounds = felt.getBoundingClientRect();
    return [...all.filter(a => a.box.left < bounds.left || a.box.right > bounds.right).map(a => `${a.name} leaves the felt`),
      ...all.flatMap((a, i) => all.slice(i + 1).filter(b => a.box.left < b.box.right && b.box.left < a.box.right
        && a.box.top < b.box.bottom && b.box.top < a.box.bottom).map(b => `${a.name} overlaps ${b.name}`))];
  });
  expect(overlaps).toEqual([]);
  expect(await page.locator('.watch-hero__cards').evaluate(node => {
    const r = node.getBoundingClientRect();
    return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.watch-hero');
  })).toBe(true);
  await sheet.getByRole('button', { name: 'Stats', exact: true }).click();
  await expect(sheet.locator('.attr-cluster')).toBeVisible();
  const body = sheet.locator('.thread-sheet__body');
  await body.evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(sheet.getByText('DECEPTION', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`watch-stats-${height}.png`) });
  await page.getByPlaceholder('Whisper to him…').fill('Stay patient');
  await expect(sheet.getByRole('button', { name: 'Conversation', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByPlaceholder('Whisper to him…')).toHaveValue('Stay patient');
  await page.getByRole('button', { name: 'Back to table', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  // The preserved opponent-read rule keeps all hero layers below its glass.
  await page.locator('.watch-felt__seat button').first().click();
  expect(await page.locator('.watch-hero').evaluate(node => Number(getComputedStyle(node).zIndex))).toBeLessThan(
    await page.locator('.read-sheet').evaluate(node => Number(getComputedStyle(node).zIndex)));
});

for (const height of [590, 844]) test(`BUG-218, BUG-238 and BUG-249: preflop has no board, postflop payout and rake agree at ${height}`, async ({ page }, testInfo) => {
  await felt(page, { owned: true, viewport: { width: 390, height } });
  const slot = page.locator('.watch-felt__rake');
  const before = await slot.boundingBox();
  await expect(slot).toBeEmpty();
  await page.evaluate(table => window.__pushWatchState({ ...table, street: 'complete', community: [], toAct: null,
    result: { type: 'uncontested', pot: 150, winners: [{ seat: 0, amount: 150 }], showdown: [], deltas: { 0: 130 }, rake: { total: 0, bySeat: {} } },
  }), TABLE);
  await expect(page.locator('.watch-felt__won')).toBeVisible();
  await expect(page.locator('.watch-felt__board > *')).toHaveCount(0);
  await expect(page.locator('.watch-felt__won-amt')).toHaveText('$150');
  await expect(slot).toBeEmpty();
  // A zero-rake preflop result; the following hand reaches a flop and pays
  // the configured default 1% rake, with the actual cut recorded by seat.
  await page.evaluate(table => window.__pushWatchState({ ...table, handNumber: table.handNumber + 1,
    street: 'complete', toAct: null,
    seats: table.seats.map((seat, index) => index === 0 ? { ...seat, stack: seat.stack + 198 } : seat),
    result: { type: 'uncontested', pot: 200, winners: [{ seat: 0, amount: 200 }], showdown: [], deltas: { 0: 178 },
      rake: { total: 2, bySeat: { 0: 2 } } },
  }), TABLE);
  await expect(slot).toHaveText('Rake $2');
  await expect(page.locator('.watch-felt__won-amt')).toHaveText('$198');
  await expect(page.locator('.action-narrator')).toHaveText('The Clock took $198 uncontested.');
  await expect(page.locator('.watch-felt__hero-stack .chip-stack__amt')).toHaveText('$2,045');
  await expect(page.locator('.watch-felt__board')).toHaveText('548');
  expect(await slot.boundingBox()).toEqual(before);
  const award = await page.locator('.watch-felt__won-pill').boundingBox();
  const rake = await slot.boundingBox();
  expect(rake.y + rake.height <= award.y || rake.y >= award.y + award.height).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('watch-uncontested-rake.png') });
});

test('BUG-218 and BUG-249: a major win keeps the rake readable and every payout consistent on a short phone', async ({ page }, testInfo) => {
  await felt(page, { owned: true, viewport: { width: 390, height: 590 } });
  await page.evaluate(table => window.__pushWatchState({ ...table, street: 'complete', toAct: null,
    community: ['6c', '4h', '8c', 'Kd', '2s'],
    seats: table.seats.map((seat, index) => index === 0 ? { ...seat, stack: seat.stack + 11940 } : seat),
    result: { type: 'showdown', pot: 12000, winners: [{ seat: 0, amount: 12000, hand: 'three sixes' }],
      showdown: [{ seat: 0, holeCards: ['6h', '6s'] }], deltas: { 0: 11920 }, rake: { total: 60, bySeat: { 0: 60 } } },
  }), TABLE);
  await expect(page.locator('.watch-felt.is-major-result')).toBeVisible();
  await expect(page.locator('.watch-felt__board')).toHaveText('648K2');
  await expect(page.locator('.watch-hero__hand-name')).toHaveText('three sixes');
  await expect(page.locator('.watch-felt__won-amt')).toHaveText('$11,940');
  await expect(page.locator('.action-narrator')).toHaveText('The Clock took $11,940 with three sixes.');
  await expect(page.locator('.watch-felt__hero-stack .chip-stack__amt')).toHaveText('$13,787');
  const rake = await page.locator('.watch-felt__rake').boundingBox();
  const award = await page.locator('.watch-felt__won-pill').boundingBox();
  expect(rake.y + rake.height <= award.y || rake.y >= award.y + award.height).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('watch-major-rake-590.png') });
});
