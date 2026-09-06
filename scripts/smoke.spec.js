// scripts/smoke.spec.js — CI-2
//
// The smoke test the suite did not have: a real browser, against the real
// built client, served by the real server.
//
// `npm test` and `npm run test:e2e` both prove the SERVER is right — they play
// hands to completion and assert on payloads — and `npm run test:client` proves
// each component renders in jsdom. Nothing until now loaded the shipped bundle
// in a browser, so a screen that throws only once Vite has minified it, a style
// import that resolves in the test runner but 404s from dist, or a socket URL
// that is wrong outside of jsdom, all reached the VPS before anybody saw them.
//
// What it asserts, and deliberately no more:
//
//   1. Each of the four surfaces mounts and stays mounted — HOME, CASINO, YOU,
//      and a WATCH on a seeded table (the owner's home game on the phone; the
//      desk has no deep link into its stage, so there it is the live tile).
//   2. Nothing lands in the console. A React error boundary, a failed import,
//      an unhandled rejection: all of them are console noise before they are
//      anything else, and a screen that renders while shouting is not green.
//   3. One screenshot per screen per width, uploaded as a workflow artifact.
//      Not compared to a baseline — pixel-diffing a screen full of live poker
//      would be flaky by construction. They are there to be LOOKED at when a
//      run fails.
//
// Two widths, because the app has two shells and they share almost nothing:
// 390x844 is the Mini App's phone (HomeScreen, WatchScreen — and since HOME-2
// job 1 no bottom bar: the casino is the door and YOU is the avatar) and
// 1440x900 crosses useIsDesktop's 1100px line into DesktopHome (stage tabs,
// wallet rail, DeskTableStage). Since DESK-2 the HOME stage there is the same
// room as the phone's — HomeScreen in `home1--desk`, with DeskHome's 520 rail
// beside it — not a second desk-only layout.
//
// It talks to a server the workflow has already started against a scratch cwd,
// with no ANTHROPIC_API_KEY and no TELEGRAM_BOT_TOKEN — so every agent decision
// is the deterministic check/fold fallback and auth is open, which is what lets
// the seeding below be three HTTP calls instead of a signed Telegram session.

import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const BASE  = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8765';
const SHOTS = process.env.SMOKE_SHOT_DIR ?? 'smoke-shots';

// TWO OWNERS, one agent each, because SLOTS-1 says so: the first slot is free
// and the second costs 10,000 EARNED, which a fresh owner does not have and
// cannot be given. So a single owner cannot have a man at home AND a man at the
// casino, and the two shells want different ones —
//
//   phone   watches the home game, which needs him at home
//   desk    reaches the felt only through a live tile, which needs him deployed
//
// Both ids must survive homeGame.homeTableId()'s [^A-Za-z0-9_-] strip unchanged
// or the deep link below points at a table the server never built.
const HOME_UID  = process.env.SMOKE_HOME_USER  ?? 'smokehome';
const FLOOR_UID = process.env.SMOKE_FLOOR_USER ?? 'smokefloor';

const HOME_TABLE = `home-${HOME_UID}`;

// Console lines that are the environment talking, not the app. Each one needs a
// reason; an empty-handed entry here is how a real error gets ignored forever.
const IGNORED_CONSOLE = [
  // The scratch server serves no favicon, and Chromium reports the 404 as a
  // console error on every navigation.
  /favicon\.ico/i,
];

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

async function roster(userId) {
  const res = await api('GET', `/api/agents?userId=${encodeURIComponent(userId)}`);
  return Array.isArray(res.body?.agents) ? res.body.agents : [];
}

/**
 * The owner's one agent, built if he does not have one yet.
 *
 * Idempotent on purpose. CI always starts from an empty scratch data dir, but a
 * developer running this against `npm start` runs it more than once against the
 * same database — and the second build comes back 409 slotLocked, because the
 * second slot costs 10,000 earned and nothing here earns it.
 */
async function agentFor(userId) {
  const existing = await roster(userId);
  if (existing.length) return existing[0];

  // A build reads the creation chat; resetting first means the agent is built
  // from an empty conversation and therefore from inferFallback(), which needs
  // no model and no key.
  await api('POST', '/api/agents/chat/reset', { userId });
  const built = await api('POST', '/api/agents/build', { userId });
  const agent = built.body?.createdAgent;
  if (!agent?.id) {
    throw new Error(`agent build for ${userId} failed: ${built.status} ${JSON.stringify(built.body)}`);
  }
  return agent;
}

async function seed() {
  // Left at home. homeGame.js stands the kitchen table up for anyone home and
  // idle, and one man alone plays the House on the TV — so a roster of one is
  // a real home game with a real socket behind it.
  const homeAgent = await agentFor(HOME_UID);

  const floorAgent = await agentFor(FLOOR_UID);
  let floorTableId = floorAgent.activeTableId ?? null;
  if (!floorTableId) {
    const deployed = await api('POST', `/api/agents/${floorAgent.id}/deploy`, { userId: FLOOR_UID });
    if (deployed.status !== 200) {
      throw new Error(`deploy failed: ${deployed.status} ${JSON.stringify(deployed.body)}`);
    }
    floorTableId = deployed.body?.tableId ?? null;
  }

  return { homeAgentId: homeAgent.id, floorAgentId: floorAgent.id, floorTableId };
}

// Memoised rather than a beforeAll: there is one describe per width and both
// rosters are built once for both. A second build for either owner comes back
// 409 slotLocked, which is the product working, not a flake.
let seeding = null;
const seedOnce = () => (seeding ??= seed());

// ── Per-test plumbing ───────────────────────────────────────────────────────

/**
 * Collects everything the page complains about. The returned array is live —
 * read it at the end of the test, not at the start.
 */
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

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// ── The walk ────────────────────────────────────────────────────────────────

const SHELLS = {
  mobile:  { width: 390,  height: 844 },
  desktop: { width: 1440, height: 900 },
};

for (const [shell, viewport] of Object.entries(SHELLS)) {
  const desktop = shell === 'desktop';
  const uid = desktop ? FLOOR_UID : HOME_UID;

  test.describe(`${shell} ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('HOME, CASINO, YOU and a WATCH all render clean', async ({ page }) => {
      const seeded = await seedOnce();
      const noise = watchConsole(page);

      // Outside Telegram getUserId() falls back to a localStorage id, so this
      // is the whole of "log in as the owner we just seeded".
      await page.addInitScript((id) => {
        try { window.localStorage.setItem('agentic_uid', id); } catch { /* private mode */ }
      }, uid);

      await test.step('HOME', async () => {
        await page.goto(BASE, { waitUntil: 'domcontentloaded' });
        // Opening the app is what sends FLOOR_SUB, and FLOOR_SUB is what makes
        // the server reconcile the home game. The WATCH step below depends on
        // this having happened.
        // DESK-2: both shells render the same room. The desk wraps it in
        // .dsk-root (top bar + stage + rail); the room itself is HomeScreen's
        // home-screen either way, which is the thing worth asserting — the
        // shell can mount while the room inside it throws.
        if (desktop) await expect(page.locator('.dsk-root')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });
        await shot(page, `${shell}-home`);
      });

      // ── SAFE-2 · the safe, opened from the room ───────────────────────────
      //
      // Phone only, and it earns a step because it is the one surface whose
      // whole claim is about a NUMBER: board 29 F12 answers "how much is in
      // the safe" with one figure and three verbs, and F12b's ledger is the
      // same sheet pulled up rather than a screen behind it. Both of those are
      // things a bundle can break silently — a glass panel that renders at zero
      // height, a ledger that only exists in jsdom — so the walk is: open it,
      // read the number, pull it up, read a line of the record.
      //
      // The desk has no pull: the rail has a column for tonight and the ledger
      // at once, and DeskHome's own suite walks that.
      if (!desktop) {
        await test.step('SAFE', async () => {
          await page.getByTestId('home-safe').click();
          const safe = page.getByTestId('safe-sheet');
          await expect(safe).toBeVisible({ timeout: 20_000 });

          // ONE NUMBER, and it is money rather than an em dash: a safe that
          // could not read the wallet says "—", which is honest and is also
          // exactly the failure this step is here to catch.
          const amount = safe.locator('.safe__amount');
          await expect(amount).toBeVisible();
          await expect(amount).toHaveText(/^\$/);
          // Three verbs, no fourth.
          await expect(safe.locator('.safe__verb')).toHaveCount(3);
          // Tonight, in three lines, every one of them with its cause.
          await expect(safe.locator('.safe__line')).toHaveCount(3);
          await shot(page, `${shell}-safe`);

          // PULL UP: the same sheet's second size, with the number still on it.
          await safe.getByRole('button', { name: /pull up for the ledger/i }).click();
          await expect(page.getByTestId('safe-ledger')).toBeVisible({ timeout: 10_000 });
          await expect(safe.locator('.wal-ledger__row').first()).toBeVisible();
          await expect(amount).toBeVisible();
          await shot(page, `${shell}-safe-ledger`);

          // Out the way it came, back to the room.
          await safe.getByRole('button', { name: 'Back' }).click();
          await expect(page.getByTestId('safe-sheet')).toHaveCount(0);
        });
      }

      await test.step('CASINO', async () => {
        if (desktop) {
          await page.getByRole('button', { name: 'CASINO', exact: true }).click();
        } else {
          // HOME-2 job 1: there is no bottom bar. The casino is the DOOR.
          await page.getByTestId('home-door').click();
        }
        await expect(page.locator('.csn').first()).toBeVisible({ timeout: 20_000 });
        await shot(page, `${shell}-casino`);
      });

      await test.step('YOU', async () => {
        if (desktop) {
          // There is no YOU tab at 1440 — the money is a rail panel opened from
          // the balance in the top bar (DP-2).
          await page.locator('.dsk-top__wallet').click();
          await expect(page.locator('.dsk-wallet')).toBeVisible({ timeout: 20_000 });
        } else {
          // HOME-2 job 1: YOU is the avatar top-right, and the record is one
          // line at the foot of the roster it opens.
          await page.getByRole('button', { name: 'Your agents' }).click();
          await page.getByTestId('roster-ledger').click();
          await expect(page.locator('.wal.dr-app')).toBeVisible({ timeout: 20_000 });
        }
        await shot(page, `${shell}-you`);
      });

      await test.step('WATCH', async () => {
        if (desktop) {
          // Still the live tile, and still the casino table seed() deployed
          // FLOOR_UID's agent to rather than the home game — there is no deep
          // link into the desk stage. What DESK-2 changed is where the tile
          // LIVES: StandupPanel used to sit permanently beside the stage, and
          // is now one of the panels in DeskHome's rail. So it has to be asked
          // for, and the top bar's Standup button is what asks.
          //
          // Not the away frames on the wall, though they are the obvious
          // candidate: a frame's onWatch subscribes to that agent and never
          // sets deskTableId, so it lights the room's own live window and
          // never opens the desk table stage. onFocusTable is the only route
          // to .dtb, and a tile is the only thing wired to it.
          //
          // Back to the floor stage first — Standup only opens the standup
          // while HOME is on stage; on CASINO the same button goes to flagged
          // hands. Clicking it also drops the wallet rail from the YOU step,
          // so that panel does not need closing on its own.
          await page.getByRole('button', { name: 'HOME', exact: true }).click();
          await page.locator('.dsk-top__standup').click();
          const tile = page.locator('.dsk-tile__watch').first();
          await expect(tile).toBeVisible({ timeout: 30_000 });
          await tile.click();
          await expect(page.locator('.dtb')).toBeVisible({ timeout: 30_000 });
        } else {
          // The DEEPLINK-1 table route, which is how a notification's "watch
          // him" button arrives. `home-<uid>` is homeGame.js's stable id.
          await page.goto(`${BASE}/?startapp=table_${HOME_TABLE}`, { waitUntil: 'domcontentloaded' });
          await expect(page.locator('.watch-screen')).toBeVisible({ timeout: 30_000 });
        }
        // A felt that mounts and then throws one beat later is the failure this
        // whole file exists to catch, so give it a beat.
        await page.waitForTimeout(2_000);
        await shot(page, `${shell}-watch`);
      });

      // ── SIT-1 · the owner takes a chair at his own kitchen table ──────────
      //
      // The one flow in the product where he JOINs instead of watching, which
      // is why it earns a step of its own here rather than riding on the WATCH
      // above: everything below the felt is different code, and all of it only
      // exists once a real socket has seated him.
      //
      // Phone only. Sitting down is a phone gesture — the desk's table is a
      // rail panel and DESK-2 gave it no seat — so at 1440 there is nothing to
      // walk.
      if (!desktop) {
        await test.step('SIT', async () => {
          await page.goto(BASE, { waitUntil: 'domcontentloaded' });
          await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });

          // The table has one destination and it is the sheet (board 31 P17).
          // The SIT DOWN section is only drawn once the server says a game is
          // running, so the click is what waits for the home game to stand up.
          await page.getByTestId('home-table').click();
          const sit = page.getByTestId('home-table-sit');
          await expect(sit).toBeVisible({ timeout: 45_000 });
          await sit.click();

          // The Watch v5 felt, with him in the hero seat.
          await expect(page.locator('.watch-screen')).toBeVisible({ timeout: 30_000 });
          const hero = page.getByTestId('owner-hero');
          await expect(hero).toBeVisible({ timeout: 30_000 });
          // SEE CARDS: his own two, and no ghost of his own beside them.
          await expect(page.getByTestId('owner-hero-cards').locator('> *')).toHaveCount(2);
          await expect(hero.locator('.mood-ghost')).toHaveCount(0);
          // The verbs are where the whisper row was.
          await expect(page.getByTestId('sit-strip')).toBeVisible();
          await expect(page.locator('.watch-composer')).toHaveCount(0);
          await shot(page, `${shell}-sit`);

          // BET: the one verb that needs a number, so the one that opens a
          // panel. Waiting for it to be pressable IS waiting for the action to
          // reach him — the strip draws all four from the moment he sits down
          // and enables only what the server has offered.
          const betVerb = page.locator('.sit-verb--bet');
          await expect(betVerb).toBeEnabled({ timeout: 90_000 });
          await betVerb.click();
          const panel = page.getByTestId('sit-bet-panel');
          await expect(panel).toBeVisible();
          await expect(panel.getByText('ALL IN')).toBeVisible();
          await shot(page, `${shell}-sit-bet`);
          // Out the way it came, without sending chips: CANCEL is a word.
          await panel.getByText('CANCEL').click();
          await expect(page.getByTestId('sit-strip')).toBeVisible();

          // BACK: the room, from the top left.
          await page.getByRole('button', { name: 'Leave table' }).click();
          await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });
        });
      }

      expect(seeded.floorTableId, 'the deployed agent landed at a table').toBeTruthy();
      expect(noise, `console output on ${shell}:\n${noise.join('\n')}`).toEqual([]);
    });
  });
}
