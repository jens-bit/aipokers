// client/e2e/draft-2.spec.js — DRAFT-2
//
// THE ONE THING THAT CANNOT BE CHECKED IN JSDOM: whether the glass actually
// covers the door.
//
// draftGlass.test.jsx asserts the arithmetic — the tag's `top` in the room's
// 390×470 coordinate space is above the sheet's `top`. That is true and it is
// cheap and it runs on every commit, but it is a statement about two numbers in
// a stylesheet, not about two boxes on a screen. The room is SCALED (a container
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

// A room with somebody already in it: the case where the desk HAS a rail, so
// the draft can be a panel in it. An empty desk has no rail at all (HOME-1's
// "Nobody lives here yet" is the whole screen), and there the draft stays the
// full-stage sheet it has always been.
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

async function stub(page, cast = EMPTY) {
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
        viewportHeight: 844,
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
async function openDraft(page, viewport, cast = EMPTY) {
  await stub(page, cast);
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
  // On the desk there are two rooms in the DOM and so two tags: the real one,
  // beside the rail, and the draft's own dimmed copy, which draft2.css hides
  // there. Only the visible one is the room's, and only it can be covered.
  const tag = page.getByTestId('home-door-tag').locator('visible=true').first();
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

  // An empty desk has no rail to put a panel in, so the draft is the full-stage
  // sheet — and it must still not sit on the door tag of the room behind it.
  test('an empty desk falls back to the stage sheet, tag still clear', async ({ page }) => {
    await openDraft(page, DESK, EMPTY);
    await expect(page.getByTestId('draft-sheet')).toBeVisible();
    await expectDoorTagClear(page);
    await page.screenshot({ path: 'e2e/__screenshots__/draft-2-desk-empty.png' });
  });
});
