// scripts/casino2.spec.js — CASINO-2
//
// The casino, in a real browser, against the real built client and the real
// server. It runs beside scripts/smoke.spec.js under the same config and in
// the same CI job, so the deploy waits on it too.
//
// WHY IT IS ITS OWN FILE. The smoke walks four surfaces and asserts one thing
// about each: it mounted, and it did not shout. That is the right shape for a
// smoke and the wrong shape for this — CASINO-2 rebuilt one screen into three
// (the casino, the room, and the deploy tray's building) and the claims worth
// pinning are about LAYOUT AT A WIDTH, which is exactly what jsdom cannot see.
// Every assertion below is one a component test structurally could not make.
//
// Both shells, because they share almost nothing:
//   390x844   the Mini App's phone
//   1440x900  past useIsDesktop's 1100px line, into the desk
//
// The three jobs it covers, and what is actually browser-shaped about each:
//   2  the board splits into LIVE NOW and TONIGHT, and "The casino" does not
//      wrap at 390 — a claim about a real font at a real width
//   4  YOUR TABLE is a carousel with one page per man, and the page is exactly
//      as wide as the track — the whole of a scroll-snap carousel is layout
//   5  a door takes you INTO the room — wave 58's floor from above, scaled from
//      its 390-unit plan to whatever width it is given, full width on the desk
//      with the board as a right column, and the building gone behind it
//
// No ANTHROPIC_API_KEY here either (the workflow's server starts without one),
// so every agent decision is the deterministic check/fold fallback: the hands
// advance, the pots are real, and nothing costs anything.

import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8765';
const SHOTS = process.env.SMOKE_SHOT_DIR ?? 'smoke-shots';

// Its own owner, so it neither races nor is raced by the smoke's two. SLOTS-1
// gives a fresh owner one free slot, which is one agent, which is one felt —
// and one felt is enough to assert every claim in here.
const UID = process.env.CASINO_USER ?? 'casino2';

const IGNORED_CONSOLE = [/favicon\.ico/i];
const isIgnored = (text) => IGNORED_CONSOLE.some((re) => re.test(text));

fs.mkdirSync(SHOTS, { recursive: true });

// ── Seeding ─────────────────────────────────────────────────────────────────

async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch { /* keep the text */ }
  return { status: res.status, body: parsed };
}

/**
 * One agent, deployed. Idempotent, for the same reason the smoke's is: CI
 * starts from an empty scratch dir, and a developer running this against
 * `npm start` runs it more than once against the same database.
 */
async function seed() {
  const roster = await api('GET', `/api/agents?userId=${encodeURIComponent(UID)}`);
  let agent = (roster.body?.agents ?? [])[0] ?? null;

  if (!agent) {
    // Built from an empty conversation, so from inferFallback() — no model and
    // no key.
    await api('POST', '/api/agents/chat/reset', { userId: UID });
    const built = await api('POST', '/api/agents/build', { userId: UID });
    agent = built.body?.createdAgent ?? null;
    if (!agent?.id) {
      throw new Error(`agent build failed: ${built.status} ${JSON.stringify(built.body)}`);
    }
  }

  if (!agent.activeTableId) {
    const deployed = await api('POST', `/api/agents/${agent.id}/deploy`, { userId: UID });
    if (deployed.status !== 200) {
      throw new Error(`deploy failed: ${deployed.status} ${JSON.stringify(deployed.body)}`);
    }
  }

  // No polling for the felt. The first draft waited for it by hitting
  // GET /api/rooms/:id/tables twice a second, which is a request budget: the
  // /api rate limiter is 60 per minute per IP (rateLimit.js) and the app the
  // browser is about to open needs most of that for itself. It failed with a
  // 429 rather than with anything about the casino.
  //
  // The wait belongs in the browser anyway. `expect(felt).toBeVisible()` below
  // is the same wait, expressed as the thing actually being claimed, and it
  // costs no requests at all.
  return agent;
}

let seeding = null;
const seedOnce = () => (seeding ??= seed());

// ── Per-test plumbing ───────────────────────────────────────────────────────

function watchConsole(page) {
  const noise = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!isIgnored(text)) noise.push(`console.error: ${text}`);
  });
  page.on('pageerror', (err) => noise.push(`pageerror: ${err.message}`));
  return noise;
}

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });

async function openCasino(page, uid) {
  await page.addInitScript((id) => {
    try { window.localStorage.setItem('agentic_uid', id); } catch { /* private mode */ }
  }, uid);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'CASINO', exact: true }).click();
  await expect(page.locator('.csn').first()).toBeVisible({ timeout: 20_000 });
}

// ── The walk ────────────────────────────────────────────────────────────────

const SHELLS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
};

for (const [shell, viewport] of Object.entries(SHELLS)) {
  const desktop = shell === 'desktop';

  test.describe(`casino ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('the board, the carousel and the room all hold at this width', async ({ page }) => {
      await seedOnce();
      const noise = watchConsole(page);
      await openCasino(page, UID);

      // ── job 3 · the sign and the doors ───────────────────────────────────
      await test.step('the sign, and three doors under it', async () => {
        const sign = page.locator('.csn-marquee__word');
        await expect(sign).toBeVisible({ timeout: 20_000 });

        // "The casino" NEVER WRAPS. Two words in a narrow flex column broke as
        // "The" over "casino", and no amount of jsdom can see it: this is the
        // real font at the real width, measured.
        const box = await sign.boundingBox();
        expect(box.height, 'the sign is one line').toBeLessThan(28);

        await expect(page.locator('.csn-room-door')).toHaveCount(3);
      });

      // ── job 2 · the board, split by tense ────────────────────────────────
      await test.step('the board answers two questions', async () => {
        const board = page.locator('.csn-board').first();
        await expect(board).toBeVisible({ timeout: 20_000 });
        await expect(board.getByText('ON THE FLOOR RIGHT NOW', { exact: true })).toBeVisible();
        // Exact, because a quiet floor's own copy contains both words —
        // "Nothing has finished tonight yet." is the TONIGHT half saying it is
        // empty, which is a state this has to pass through, not trip over.
        await expect(board.getByText('LIVE NOW', { exact: true })).toBeVisible();
        await expect(board.getByText('TONIGHT', { exact: true })).toBeVisible();
        // Exactly one board on the screen: on the desk it is in the rail and
        // nowhere else, and the same evening told twice is the bug DESK-2 fixed.
        await expect(page.locator('.csn-board')).toHaveCount(1);
      });

      // ── job 4 · your table, as a carousel ────────────────────────────────
      await test.step('your table is a carousel of real games', async () => {
        const your = page.getByTestId('your-tables');
        await expect(your).toBeVisible({ timeout: 20_000 });

        // He was deployed in seed(), so his page is a live felt and not the
        // "where he is" page — never a placeholder ghost.
        const felt = your.locator('.csn-felt').first();
        await expect(felt).toBeVisible({ timeout: 30_000 });

        // A page is exactly as wide as the track, which is the whole of a
        // scroll-snap carousel and is pure layout.
        const track = your.locator('.csn-your__track');
        const pages = your.locator('.csn-your__page');
        const trackBox = await track.boundingBox();
        const pageBox = await pages.first().boundingBox();
        expect(Math.abs(pageBox.width - trackBox.width)).toBeLessThan(2);

        // And it does not push the screen sideways.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, 'the page never scrolls horizontally').toBeLessThanOrEqual(1);
      });

      await shot(page, `${shell}-casino2`);

      // ── job 5 · walking into a room ──────────────────────────────────────
      await test.step('a door takes you into the room', async () => {
        await page.locator('.csn-room-door[data-room="floor"]').click();

        const view = page.getByTestId('floor-view');
        await expect(view).toBeVisible({ timeout: 20_000 });

        // Wave 58: it is a ROOM, drawn from above — felts as ellipses with
        // bodies on their rims, the bar along the bottom wall, the board
        // bolted beside the stairs — and the real board came along for the
        // walk.
        const floor = view.getByTestId('the-floor');
        await expect(floor).toBeVisible({ timeout: 20_000 });
        await expect(floor.locator('.csn-felt58').first()).toBeVisible({ timeout: 20_000 });
        await expect(floor.getByText('THE BAR')).toBeVisible();
        await expect(floor.getByText('THE BOARD')).toBeVisible();

        // The plan is drawn in 390 units and SCALED to the room's width. On the
        // desk that is a wide room and on the phone it is not, and either way
        // the felts have to be inside it — a scale bug puts them off the edge,
        // which is the sort of thing only a laid-out page can see.
        const floorBox = await floor.boundingBox();
        const feltBox = await floor.locator('.csn-felt58').first().boundingBox();
        expect(feltBox.x).toBeGreaterThanOrEqual(floorBox.x - 1);
        expect(feltBox.x + feltBox.width).toBeLessThanOrEqual(floorBox.x + floorBox.width + 1);
        expect(feltBox.y + feltBox.height).toBeLessThanOrEqual(floorBox.y + floorBox.height + 1);

        // The building is gone: a room is a destination, not a sheet over one.
        await expect(page.locator('.csn-room-door')).toHaveCount(0);
        await expect(page.locator('.csn-desk__rail')).toHaveCount(0);

        if (desktop) {
          // Full width, board as the RIGHT column — the two are beside each
          // other, which is a claim only a laid-out page can answer.
          const room = view.locator('.csn-floor__room');
          const board = view.locator('.csn-floor__board');
          await expect(board).toBeVisible();
          const roomBox = await room.boundingBox();
          const boardBox = await board.boundingBox();
          expect(boardBox.x, 'the board is to the right of the room')
            .toBeGreaterThan(roomBox.x + roomBox.width - 2);
          const viewBox = await view.boundingBox();
          expect(viewBox.width, 'and the room takes the whole desk')
            .toBeGreaterThan(viewport.width * 0.9);
        } else {
          // On the phone the board is under the room, not beside it.
          const room = view.locator('.csn-floor__room');
          const board = view.locator('.csn-floor__board');
          const roomBox = await room.boundingBox();
          const boardBox = await board.boundingBox();
          expect(boardBox.y).toBeGreaterThan(roomBox.y);
        }

        await shot(page, `${shell}-casino2-room`);

        // And back out the way you came in.
        await page.getByRole('button', { name: 'Back to the casino' }).click();
        await expect(page.getByTestId('floor-view')).toHaveCount(0);
        await expect(page.locator('.csn-room-door')).toHaveCount(3);
      });

      expect(noise, `console was not clean:\n${noise.join('\n')}`).toEqual([]);
    });
  });
}
