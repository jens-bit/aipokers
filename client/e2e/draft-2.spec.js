// client/e2e/draft-2.spec.js — DRAFT-2
//
// THE ONE THING THAT CANNOT BE CHECKED IN JSDOM: whether the glass actually
// covers the door.
//
// draftGlass.test.jsx asserts the single sign and the empty chair. The room
// uses 390×612 coordinates, while wave 61 places glass at a responsive edge.
// The room is SCALED (a container
// query divides by 390), the sheet is not, and at 1440 the desk puts the sheet
// somewhere else entirely. Whether those two boxes overlap after layout is a
// question only a browser can answer, which is what this file is for.
//
// Same rules as e2e/home.spec.js, and for the same reasons: fixtures through
// page.route so nothing needs a server, a database or a model; Playwright is
// deliberately not a dependency of this repo (see that file's header); and this
// is run by hand rather than in CI.
//
//   cd client && npx playwright test e2e/draft-2.spec.js
//   look: client/e2e/__screenshots__/draft-2-*.png

import { test, expect } from '@playwright/test';

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1440, height: 900 };

const HOME = 'http://127.0.0.1:5199/';

// The draft opens from an empty room, which is where an owner meets it first.
const EMPTY = { agents: [] };

// Wave 61 keeps the desktop draft in its rail for both the first agent and
// later housemates, beside the same live room.
const ONE = {
  agents: [{
    id: 'a1', name: 'The Clock', style: 'Tight', risk: 'Low',
    nature: { name: 'Grinder' }, mood: { state: 'neutral', heat: 40 }, fatigue: 'fresh',
    location: { where: 'home', tableId: null, room: null, since: Date.now() - 600_000 },
    routine: { key: 'counts', label: 'counting chips' },
    unseenRecap: false, want: null, opener: 'Sit down.', activeTableId: null,
    pocket: { balance: 2000, mode: 'topup', cap: null },
    stats: { handsPlayed: 40 },
    careerStats: { hands: 40, sessions: 2, net: 300, biggestPot: 200, winRate: 0.5 },
    sessionLog: [],
  }],
};

const TURN = {
  chat: [
    { role: 'user', content: 'Patient. I would rather he folded than guessed.' },
    { role: 'assistant', content: 'Then he will hate folding and do it anyway. You are describing a Rock.' },
  ],
  profile: { tightness: 88, aggression: 44, bluffFreq: 6, discipline: 90 },
  natureHint: 'Rock',
  ready: false,
};

async function stub(page, cast = EMPTY, draftSession = null) {
  // Old protocol cases stay explicit; a roster GET must never stand in for
  // the new draft-session POST. Modern BUG-145 cases supply its real contract.
  await page.route('**/api/agents/draft', r => r.fulfill(draftSession ? { json: draftSession } : { status: 404, json: {} }));
  await page.route('**/api/agents?**', (route) => route.fulfill({ json: cast }));
  await page.route('**/api/agents/*/thread**', (route) => route.fulfill({ json: { lines: [] } }));
  await page.route('**/api/agents/*/study**', (route) => route.fulfill({ json: { study: null, book: [], count: 0 } }));
  await page.route('**/api/agents/chat**', (route) => route.fulfill({ json: TURN }));
  // SLOTS-1's full projection. `unlocked` is what makes the chair offer DRAFT
  // HIM rather than state a price — see TableSheet: a locked chair has no
  // action because there is no path.
  await page.route('**/api/slots**', (route) => route.fulfill({
    json: { used: 1, cap: 4, next: { index: 2, price: 0, earned: 5000, unlocked: true } },
  }));
  await page.route('**/api/wallet**', (route) => route.fulfill({ json: { balance: 12_000, ledger: [] } }));
  await page.route('**/api/events**', (route) => route.fulfill({ json: { events: [], lastId: 0 } }));
  await page.route('**/api/rooms**', (route) => route.fulfill({ json: { rooms: [], hotWindowMs: 20_000 } }));
  await page.route('**/api/home/thread**', (route) => route.fulfill({ json: { lines: [] } }));
  await page.route('**/api/auth/config**', (route) => route.fulfill({ json: { botUsername: '' } }));
  await page.route('https://telegram.org/**', (route) => route.fulfill({ body: '', contentType: 'application/javascript' }));

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

  // The room rides HOME_STATE, so the socket is scripted rather than silenced —
  // the same frame the server would send, so the picture is of the real screen.
  await page.addInitScript((agents) => {
    class Scripted {
      constructor() {
        this.readyState = 0;
        this.listeners = {};
        setTimeout(() => {
          this.readyState = 1;
          (this.listeners.open ?? []).forEach((f) => f({}));
          (this.listeners.message ?? []).forEach((f) => f({
            data: JSON.stringify({ type: 'home_state', userId: '4242', agents, game: null }),
          }));
        }, 20);
      }
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
      removeEventListener() {}
      send() {}
      close() { this.readyState = 3; }
    }
    Scripted.OPEN = 1; Scripted.prototype.OPEN = 1;
    window.WebSocket = Scripted;
  }, cast.agents);
}

/** Open the draft from the empty room's own invitation. */
async function openDraft(page, viewport, cast = EMPTY, draftSession = null) {
  await stub(page, cast, draftSession);
  await page.setViewportSize(viewport);
  await page.goto(HOME);

  if (cast === EMPTY) {
    await page.getByRole('button', { name: /make an agent|draft an agent|draft your first agent/i }).first().click();
  } else {
    // A room that already has somebody in it prices the next chair in one place
    // only — the table (BIRTH-5) — and DRAFT HIM is the door out of it.
    await page.getByTestId('home-table').click();
    await page.getByTestId('home-table-draft').click();
  }

  await page.waitForSelector('[data-testid="draft-sheet"]');
  await page.waitForTimeout(500);
}

/**
 * The assertion this file exists for.
 *
 * Not "the tag is visible" — a box under the glass is still `visible` to
 * Playwright. The rectangles must not intersect at all.
 */
async function expectDoorTagClear(page) {
  // BUG-92: both rooms use the single vertical CASINO sign.
  // Measure the actual visible sign in each shell, with the same no-overlap rule.
  const tag = page.locator('.draft2__room [data-testid="home-door-sign"]:visible, .home1__room [data-testid="home-door-sign"]:visible').first();
  await expect(tag).toBeVisible();

  const tagBox = await tag.boundingBox();
  const sheetBox = await page.getByTestId('draft-sheet').boundingBox();
  expect(tagBox, 'the door tag has no box').not.toBeNull();
  expect(sheetBox, 'the sheet has no box').not.toBeNull();

  const overlaps =
    tagBox.x < sheetBox.x + sheetBox.width &&
    tagBox.x + tagBox.width > sheetBox.x &&
    tagBox.y < sheetBox.y + sheetBox.height &&
    tagBox.y + tagBox.height > sheetBox.y;

  expect(
    overlaps,
    `the sheet covers the door tag — tag ${JSON.stringify(tagBox)} vs sheet ${JSON.stringify(sheetBox)}`,
  ).toBe(false);
}

test.describe('DRAFT-2 · the draft on glass at 390×844', () => {
  test('BUG-66: the revealed agent keeps his served colors on his birth card', async ({ page }) => {
    await openDraft(page, PHONE);
    const born = { ...ONE.agents[0], id: 'newborn', name: 'Granite', identity: { hood: 'moss', glow: 'ice' }, nature: { name: 'Rock', up: 'DISCIPLINE', down: 'DECEPTION', line: 'He waits.', builtFor: 'Not losing money. He is very hard to bluff.' }, firstWords: 'Patient, you said. Good. I will hate folding and I will do it anyway.' };
    await page.route('**/api/agents?**', r => r.fulfill({ json: { agents: [born] } }));
    await page.route('**/api/agents/chat**', r => r.fulfill({ json: { agentId: born.id, agentName: born.name, strategy: 'Patient.', chat: [{ role: 'assistant', content: 'Meet Granite.' }] } }));
    await page.getByTestId('draft-input').fill('Call him Granite.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.birth-card3 .mood-ghost')).toHaveAttribute('data-hood', 'moss');
    await expect(page.locator('.birth-card3')).toContainText(born.firstWords);
    await expect(page.locator('.birth-card3')).toHaveCSS('opacity', '1');
    await expect(page.locator('.birth-card3__deal')).toHaveCSS('text-transform', 'uppercase');
    await expect(page.locator('.birth-card3__deal')).toHaveCSS('color', 'rgb(10, 10, 10)');
    await page.screenshot({ path: '../artifacts/birth-card-identity.png' });
    await page.getByRole('button', { name: /deal him in/i }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
  });
  test('BUG-67: a long draft can be read from its first line and fills a wider phone', async ({ page }) => {
    await openDraft(page, { width: 490, height: 590 });
    const draft = page.getByTestId('draft-screen');
    expect((await draft.boundingBox()).width).toBe(490);
    for (let n = 0; n < 8; n++) {
      await page.getByTestId('draft-input').fill(`Answer ${n}: Patient, but willing to bluff when there is a good reason.`);
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(page.getByTestId('draft-input')).toBeEnabled();
    }
    const rows = page.getByTestId('draft-rows');
    await rows.evaluate(el => { el.scrollTop = 0; });
    const first = await rows.getByTestId('draft-row').first().boundingBox();
    const bounds = await rows.boundingBox();
    expect(first.y).toBeGreaterThanOrEqual(bounds.y - 1);
    expect(first.y).toBeLessThan(bounds.y + bounds.height);
    await page.screenshot({ path: '../artifacts/birth-long-490.png' });
  });
  test.use({ viewport: PHONE });

  test('opens as a sheet over the room, and the door tag stays clear', async ({ page }) => {
    await openDraft(page, PHONE);

    await expect(page.locator('.home-flat')).toBeVisible();
    await expect(page.getByTestId('draft-forming')).toBeVisible();
    await expectDoorTagClear(page);

    await page.screenshot({ path: 'e2e/__screenshots__/draft-2-phone-open.png' });
  });

  test('he forms above the sheet as answers land, and the tag is still clear', async ({ page }) => {
    await openDraft(page, PHONE);
    await expect(page.getByTestId('draft-forming')).toHaveAttribute('data-stage', '1');

    await page.getByTestId('draft-input').fill('Patient. I would rather he folded than guessed.');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByTestId('draft-forming')).toHaveAttribute('data-stage', '2');
    await expectDoorTagClear(page);

    await page.screenshot({ path: 'e2e/__screenshots__/draft-2-phone-forming.png' });
  });
});

const SESSION = { draftId: 'draft-browser', draftStep: 'briefing', ready: false, draftName: null,
  chat: [{ role: 'assistant', content: 'Tell me how he should play.' }] };
const NAMING = { ...SESSION, draftStep: 'naming', ready: true, natureHint: 'Rock', chat: [
  ...SESSION.chat, { role: 'user', content: 'Tight and patient' },
  { role: 'assistant', content: 'Patient it is. What do you call him?' },
] };
const NAMED = { ...NAMING, draftStep: 'ready', draftName: 'Go', chat: [
  ...NAMING.chat, { role: 'user', content: 'Go' }, { role: 'assistant', content: 'Go. Ready to meet him?' },
] };

test.describe('BUG-145 · an honest four-stage draft and recoverable birth', () => {
  test('draft controls retain the authored type over the app button reset', async ({ page }) => {
    await openDraft(page, PHONE, EMPTY, SESSION);
    const chip=page.getByRole('button',{name:'Tight and patient',exact:true});
    await expect(chip).toHaveCSS('font-size','12.5px');
    await expect(chip).toHaveCSS('color','rgb(0, 212, 170)');
    await page.route('**/api/agents/chat',route=>route.fulfill({json:NAMING}));
    await chip.click();
    const choose=page.getByRole('button',{name:'Choose a name for me',exact:true});
    await expect(choose).toHaveCSS('font-family',/Oswald/);
    await expect(choose).toHaveCSS('font-size','9.5px');
    await expect(choose).toHaveCSS('text-transform','uppercase');
    await page.route('**/api/agents/chat',route=>route.fulfill({json:NAMED}));
    await page.getByPlaceholder('His name…').fill('Go');
    await page.getByRole('button',{name:'Send',exact:true}).click();
    const deal=page.getByRole('button',{name:'Deal him in',exact:true});
    await expect(deal).toHaveCSS('font-family',/Oswald/);
    await expect(deal).toHaveCSS('font-size','12.5px');
    await expect(deal).toHaveCSS('font-weight','600');
    await expect(deal).toHaveCSS('text-transform','uppercase');
    await expect(deal).toHaveCSS('letter-spacing','1.5px');
    await expect(deal).toHaveCSS('color','rgb(18, 12, 4)');
    await expect(page.getByRole('button',{name:'or keep describing him'})).toHaveCSS('font-size','12px');
  });

  for (const viewport of [PHONE, { width: 390, height: 590 }, DESK]) {
    test(`name handoff, four authored appearances, and one birth at ${viewport.width}×${viewport.height}`, async ({ page }) => {
      await openDraft(page, viewport, EMPTY, SESSION);
      const size = `${viewport.width}x${viewport.height}`;
      const ghost = page.getByTestId('draft-forming');
      await expect(ghost).toHaveAttribute('data-stage', '1');
      await page.screenshot({ path: `../artifacts/batch45-draft-stage1-${size}.png`, scale: 'css', animations: 'disabled' });
      await page.evaluate(() => {
        window.draftStages = ['1'];
        new MutationObserver(() => {
          const stage = document.querySelector('[data-testid="draft-forming"]')?.dataset.stage;
          if (stage && window.draftStages.at(-1) !== stage) window.draftStages.push(stage);
        // Desktop portals the ghost from the rail into the room; observe both.
        }).observe(document.body, { childList: true, subtree: true });
      });
      const sent = [];
      let reply = NAMING;
      await page.route('**/api/agents/chat', async route => {
        sent.push(route.request().postDataJSON());
        await route.fulfill({ json: reply });
      });
      await page.getByRole('button', { name: 'Tight and patient', exact: true }).click();
      await expect(ghost).toHaveAttribute('data-stage', '2');
      await page.screenshot({ path: `../artifacts/batch45-draft-stage2-${size}.png`, scale: 'css', animations: 'disabled' });
      await expect(ghost).toHaveAttribute('data-stage', '3');
      await expect(page.getByPlaceholder('His name…')).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Deal him in', exact: true })).toHaveCount(0);
      await page.screenshot({ path: `../artifacts/batch45-draft-stage3-${size}.png`, scale: 'css', animations: 'disabled' });
      reply = NAMED;
      await page.getByPlaceholder('His name…').fill('Go');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await expect(ghost).toHaveAttribute('data-stage', '4');
      expect(sent.at(-1)).toMatchObject({ draftIntent: 'name', content: 'Go', draftId: SESSION.draftId });
      await expect(page.getByRole('button', { name: 'Deal him in', exact: true })).toBeEnabled();
      await page.screenshot({ path: `../artifacts/batch45-draft-stage4-${size}.png`, scale: 'css', animations: 'disabled' });
      expect(await page.evaluate(() => window.draftStages)).toEqual(['1', '2', '3', '4']);
      const born = { ...ONE.agents[0], id: 'born-browser', name: 'Go', identity: { hood: 'moss', glow: 'ice' },
        nature: { name: 'Rock', line: 'He waits.', builtFor: 'Not losing money. He is very hard to bluff.' },
        firstWords: 'I pick my spot.' };
      reply = { ...NAMED, draftStep: 'created', agentId: born.id, agentName: born.name, createdAgent: born, firstAgent: true };
      await page.getByRole('button', { name: 'Deal him in', exact: true }).dblclick();
      await expect(page.locator('.birth-card3')).toContainText(born.firstWords);
      await expect(page.locator('.birth-card3 .mood-ghost')).toHaveAttribute('data-hood', 'moss');
      expect(sent.filter(body => body.draftIntent === 'create')).toHaveLength(1);
      await page.screenshot({ path: `../artifacts/batch45-draft-birth-${size}.png`, scale: 'css', animations: 'disabled' });
      await page.getByRole('button', { name: 'Deal him in', exact: true }).click();
      await expect(page.getByTestId('home-screen')).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem('railbird:draft:4242'))).toBeNull();
    });
  }

  test('a lost creation response survives reload with the same draft and attempt', async ({ page }) => {
    await openDraft(page, PHONE, EMPTY, NAMED);
    const requests = [];
    await page.route('**/api/agents/chat', async route => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ status: 503, json: { error: 'temporary backend detail' } });
    });
    await page.getByRole('button', { name: 'Deal him in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Try again');
    await expect(page.getByRole('alert')).not.toContainText('backend detail');
    const first = requests.at(-1);
    expect(first.attemptId).toBeTruthy();
    await page.screenshot({ path: '../artifacts/batch45-draft-retry-390x844.png', scale: 'css', animations: 'disabled' });
    await page.reload();
    await page.getByRole('button', { name: /draft your first agent/i }).first().click();
    await page.getByRole('button', { name: 'Deal him in', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Try again');
    expect(requests.at(-1)).toMatchObject({ draftId: first.draftId, attemptId: first.attemptId });
  });
});

test.describe('DRAFT-2 · the draft in the rail at 1440×900', () => {
  test.use({ viewport: DESK });

  test('is a right-column panel beside the room, not a sheet over it', async ({ page }) => {
    await openDraft(page, DESK, ONE);

    const sheet = await page.getByTestId('draft-sheet').boundingBox();
    const room = await page.locator('.home1__room .home-flat').first().boundingBox();
    expect(sheet, 'the sheet has no box').not.toBeNull();
    expect(room, 'the room has no box').not.toBeNull();

    // The room is still on screen and the sheet is beside it, not on top of it:
    // board 31's rule, and the one real difference 1440 buys.
    expect(sheet.x).toBeGreaterThan(room.x);

    await page.screenshot({ path: 'e2e/__screenshots__/draft-2-desk.png' });
  });

  test('the door tag stays clear at 1440 too', async ({ page }) => {
    await openDraft(page, DESK, ONE);
    await expectDoorTagClear(page);
  });

  // Wave 61 supersedes the stage-sheet exception for the first agent.
  test('BUG-88: the empty desk drafts in its right column, tag still clear', async ({ page }) => {
    await openDraft(page, DESK, EMPTY);
    await expect(page.getByTestId('draft-sheet')).toBeVisible();
    await expect(page.getByTestId('home-rail')).toHaveAttribute('data-panel', 'draft');
    await expectDoorTagClear(page);
    await expect(page.locator('.home1__scale [data-testid="draft-forming"]')).toHaveCount(1);
    await expect(page.locator('.home1__rail [data-testid="draft-forming"]')).toHaveCount(0);
    const forming = await page.locator('.draft2__forming--in-room').boundingBox();
    const table = await page.getByTestId('home-table').boundingBox();
    expect(forming.y + forming.height).toBeLessThanOrEqual(table.y + 4);
    expect(Math.abs(forming.x + forming.width / 2 - table.x - table.width / 2)).toBeLessThan(2);
    await page.screenshot({ path: 'e2e/__screenshots__/draft-2-desk-empty.png' });
  });
});
