// client/e2e/shipped-shots.spec.js — SHOTS-1
//
// Ground truth for Claude Design. It can read the code but cannot run the
// app, so its boards drift from what actually shipped; this walks the REAL
// built client behind the REAL server — no mocked API, no scripted socket —
// against a seeded scratch SQLite database, and photographs every screen the
// app actually ships at 390×844 and 1440×900.
//
// Run with `npm run shots`, which is `scripts/shots.js`. That script does the
// SEEDING (not this file) and hands the finished household to this spec as
// plain ids over the SHOTS_CTX env var — see its header for why: unlocking
// the 2nd and 3rd agent slots for one owner needs a direct write to the
// scratch database that only stays visible across a server restart, which
// belongs beside the process it is restarting, not inside a browser test.
// It also starts two keyless servers (one plain, one GUEST_ENABLED=1 — a
// guest and an owner cannot share a process, since GUEST-1's door is a
// boot-time env var), builds the client first, and tears both servers down
// after. Running this spec any other way means doing all of that by hand and
// setting SHOTS_BASE_URL / SHOTS_GUEST_BASE_URL / SHOTS_CTX yourself.
//
// The household scripts/shots.js seeds, all real, all through the shipped
// HTTP API:
//
//   1st agent   at the kitchen table (home game running)   → home / watch-home
//   2nd agent   deployed to the floor, mid-hand              → casino-floor / watch-casino
//   3rd agent   at home, undeployed, ordinary fatigue         → the third body on HOME-1's room
//
// ONE gap on the third: the "asleep" home routine only fires once real
// fatigue reaches 'worn', and attributes.js's own fatigue curve needs roughly
// 60–240 real hands of play (STAMINA-dependent) before that happens — there
// is no debug endpoint that sets it, and forcing it here would mean playing
// that many hands for every refresh of this pack. He is seeded ordinary and
// awake instead; see design-refs/shipped/README.md for the note.
//
// A second, real gap: WATCH-PUBLIC-1's spectator view (`publicOnly`,
// `spectatorSeat: -1`) only exists when the server has a real
// TELEGRAM_BOT_TOKEN. Without one — required everywhere else in this file so
// seeding can run over plain HTTP — src/server/wsServer.js's own `localDev`
// branch (auth.js's isOwner() with no token) marks EVERY watcher the owner.
// A second browser watching the first owner's table cannot be told apart from
// the owner's own watch on this server, so there is no true spectator screen
// to capture here; recorded as a gap rather than a screenshot that lies.
//
// Two other households populate the higher stakes on the same casino floor.
// None of those agents belongs to the household being photographed.

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.SHOTS_BASE_URL ?? 'http://127.0.0.1:8793';
const GUEST_BASE = process.env.SHOTS_GUEST_BASE_URL ?? 'http://127.0.0.1:8794';

const OUT_DIR = process.env.SHOTS_OUTPUT_DIR
  ? path.resolve(process.env.SHOTS_OUTPUT_DIR)
  : fileURLToPath(new URL('../../design-refs/shipped/', import.meta.url));
fs.mkdirSync(OUT_DIR, { recursive: true });
const shot = (name) => path.join(OUT_DIR, `${name}.png`);

const OWNER_UID = 'shipowner';
// A fresh id per run — repeating this suite against the same scratch DB
// (debugging a single failing screen, say) must not resume a half-finished
// draft from the previous run, whose style chip is already spoken for.
const RUN_TAG = Date.now();

const WIDTHS = [
  { w: 390, h: 844 },
  { w: 1440, h: 900 },
];

let ctx = null;

test.beforeAll(() => {
  if (!process.env.SHOTS_CTX) throw new Error('SHOTS_CTX is not set — run this via `npm run shots`');
  ctx = JSON.parse(process.env.SHOTS_CTX);
});

// ── Navigation helpers ──────────────────────────────────────────────────────

async function loginAs(page, uid) {
  await page.addInitScript((id) => {
    try {
      window.localStorage.setItem('agentic_uid', id);
      // FirstRunGuide's own coach-mark, marked seen — every uid here is a
      // seed for a screenshot, never a first-time visitor the pack means to
      // show, and the guide's "This is <agent>. Tap to talk." card sits
      // directly over the room it would otherwise be photographing.
      window.localStorage.setItem(`railbird.guide.v1:${id}`, JSON.stringify({ version: 1, seen: true }));
    } catch { /* private mode */ }
  }, uid);
}

async function gotoHome(page, uid = OWNER_UID) {
  await loginAs(page, uid);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });
}

/** All stakes share the same casino floor since 0.18.0. */
async function openCasino(page) {
  const floorView = page.getByTestId('floor-view');
  await expect(floorView).toBeVisible({ timeout: 20_000 });
  await expect(floorView).toHaveAttribute('data-room', 'floor');
}

const watchSurface = (page) => page.locator('.watch-screen, [data-testid="desk-home-table"], [data-testid="desk-casino-table"]');

// ── The screens ─────────────────────────────────────────────────────────────

const SCREENS = [
  {
    name: 'landing',
    run: async (page) => {
      await page.goto(BASE + '/welcome', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Deal him in.', level: 1 })).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    name: 'owner-draft',
    run: async (page, { w }) => {
      await loginAs(page, `shipdraft${w}-${RUN_TAG}`);
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'DRAFT YOUR FIRST AGENT', exact: true }).click();
      await page.getByRole('button', { name: 'Aggressive bluffer', exact: true }).click();
      await page.getByPlaceholder('His name…').fill('Ember');
    },
  },
  {
    name: 'home',
    run: async (page) => { await gotoHome(page); },
  },
  {
    name: 'agent-view',
    run: async (page) => {
      await gotoHome(page);
      const body = page.locator(`.home-one[data-agent="${ctx.homeAgentId}"]`);
      const box = await body.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('agent-stage')).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    name: 'agent-profile',
    run: async (page) => {
      await gotoHome(page);
      const body = page.locator(`.home-one[data-agent="${ctx.homeAgentId}"]`);
      const box = await body.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('agent-stage')).toBeVisible({ timeout: 20_000 });
      await page.getByRole('tab', { name: 'Stats', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Skills' }).or(page.getByLabel('Skills'))).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    // Desktop has no roster SHEET — DesktopHome keeps the roster ambient in
    // its own rail (`.dsk-roster-row`), always visible rather than opened.
    name: 'roster',
    run: async (page, { w }) => {
      await gotoHome(page);
      if (w >= 1100) {
        await expect(page.locator('.dsk-roster-row').first()).toBeVisible({ timeout: 20_000 });
        return;
      }
      await page.getByRole('button', { name: 'Your agents' }).click();
      await expect(page.getByTestId('roster-sheet')).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    name: 'casino-floor',
    run: async (page) => {
      await gotoHome(page);
      await page.getByTestId('home-door').click();
      await openCasino(page);
    },
  },
  {
    name: 'watch-home',
    run: async (page) => {
      await gotoHome(page);
      await page.getByTestId('home-table').click();
      await page.getByTestId('home-table-watch').click();
      await expect(watchSurface(page)).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2_000);
    },
  },
  {
    // Mobile: the DEEPLINK-1 table route, exactly like a notification's "watch
    // him" button. Desktop: openDeepLink's watchTable() only opens the socket
    // — it never calls the desk's own onFocusTable, so DesktopHome's stage
    // stays wherever it was. The real route in is the same felt tile a
    // stranger would click from the floor (scripts/smoke.spec.js's own
    // desktop casino test uses the identical selector).
    name: 'watch-casino',
    run: async (page, { w }) => {
      if (w >= 1100) {
        await gotoHome(page);
        await page.getByTestId('home-door').click();
        await openCasino(page);
        await page.locator(`.csn-felt58[data-table="${ctx.casinoTableId}"]`).click();
      } else {
        await loginAs(page, OWNER_UID);
        await page.goto(`${BASE}/?startapp=table_${ctx.casinoTableId}`, { waitUntil: 'domcontentloaded' });
      }
      await expect(watchSurface(page)).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2_000);
    },
  },
  {
    name: 'safe',
    run: async (page) => {
      await gotoHome(page);
      await page.getByTestId('home-safe').click();
      await expect(page.getByTestId('safe-sheet')).toBeVisible({ timeout: 20_000 });
    },
  },
  {
    // Desktop's rail keeps tonight and the ledger in one column at once
    // (SafeSheet.jsx's `inRail`) — there is no pull gesture to reach there.
    name: 'ledger-safe',
    run: async (page, { w }) => {
      await gotoHome(page);
      await page.getByTestId('home-safe').click();
      const safe = page.getByTestId('safe-sheet');
      await expect(safe).toBeVisible({ timeout: 20_000 });
      if (w < 1100) await safe.getByRole('button', { name: /pull up for the ledger/i }).click();
      await expect(page.getByTestId('safe-ledger')).toBeVisible({ timeout: 10_000 });
    },
  },
  {
    // Desktop has no roster sheet to open this from either — DesktopTopBar's
    // own "Wallet for …" button is the desk's one door to the wallet rail
    // (`.dsk-wallet`), the same rail ledger-safe's desktop branch already
    // finds inline. Real, but the same destination as SAFE at this width —
    // see design-refs/shipped/README.md.
    name: 'ledger-roster',
    run: async (page, { w }) => {
      await gotoHome(page);
      if (w >= 1100) {
        await page.getByRole('button', { name: /^Wallet for /, exact: false }).click();
        await expect(page.locator('.dsk-wallet')).toBeVisible({ timeout: 20_000 });
        return;
      }
      await page.getByRole('button', { name: 'Your agents' }).click();
      await expect(page.getByTestId('roster-sheet')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('roster-ledger').click();
      await expect(page.locator('.wal.dr-app')).toBeVisible({ timeout: 20_000 });
    },
  },
];

for (const screen of SCREENS) {
  for (const { w, h } of WIDTHS) {
    test(`BUG-246 SHOTS-1 ${screen.name} @ ${w}x${h}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.setViewportSize({ width: w, height: h });
      await screen.run(page, { w, h });
      await page.screenshot({ path: shot(`${screen.name}-${w}`) });
      expect(errors, `console errors on ${screen.name} @ ${w}: ${errors.join('\n')}`).toEqual([]);
    });
  }
}

// ── Guest draft — its own server, its own fresh browser context ────────────
//
// GUEST_ENABLED changes what boot() decides with no Telegram signal AND no
// stored web login (client/src/main.jsx door 3), so this must be a context
// that has never set `agentic_uid` and has no Telegram object at all — the
// owner tests above deliberately share none of that with this one.

for (const { w, h } of WIDTHS) {
  test(`SHOTS-1 guest-draft @ ${w}x${h}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: w, height: h });
    await page.goto(GUEST_BASE, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.guest-hero .guest-hero__cta')).toBeVisible({ timeout: 20_000 });
    await page.locator('.guest-hero .guest-hero__cta').click();
    // draftHim() scrolls to it — `toBeVisible` alone is satisfied before that
    // scroll settles, and the screenshot would still be the hero at the top.
    await expect(page.getByTestId('draft-input')).toBeInViewport({ ratio: 1, timeout: 20_000 });
    await page.screenshot({ path: shot(`guest-draft-${w}`) });
    expect(errors, `console errors on guest-draft @ ${w}: ${errors.join('\n')}`).toEqual([]);
  });
}
