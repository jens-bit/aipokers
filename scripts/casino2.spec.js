// scripts/casino2.spec.js — CASINO-2, rewritten for UI-3's one room (SPEC-1)
//
// The casino, in a real browser, against the real built client and the real
// server. It runs beside scripts/smoke.spec.js under the same config and in
// the same CI job, so the deploy waits on it too.
//
// WHY IT IS ITS OWN FILE. The smoke walks four surfaces and asserts one thing
// about each: it mounted, and it did not shout. That is the right shape for a
// smoke and the wrong shape for this — the casino's claims worth pinning are
// about LAYOUT AT A WIDTH, which is exactly what jsdom cannot see. Every
// assertion below is one a component test structurally could not make.
//
// Both shells, because they share almost nothing:
//   390x844   the Mini App's phone
//   1440x900  past useIsDesktop's 1100px line, into the desk
//
// SPEC-1 — WHAT UI-3 CHANGED UNDER THIS FILE.
//
// CASINO-2 built a BUILDING: a sign over three doorways (the floor, upstairs,
// the back room), a two-panel board (LIVE NOW over TONIGHT) bolted to a wall
// inside whichever room you had walked into, and a Floor|Board toggle to get
// between the two. UI-3 job A deleted all of it. The casino is a SINGLE room;
// every live table is on the one floor at once carrying its own stakes;
// FloorBoard.jsx, RoomDoors, CasinoDoor and the toggle are gone from the tree.
//
// So this file's walk is not the same walk. What it still has to prove is:
//
//   1  THE ROOM RENDERS AT BOTH WIDTHS AND SAYS NOTHING TO THE CONSOLE. The
//      one screen the casino has, drawn from above, at 390 and at 1440.
//   2  THE TICKER ANSWERS THE BOARD'S QUESTION. "Is anything happening right
//      now" did not stop mattering when the wall did. One line, once, at the
//      very top — CasinoTicker.jsx's own header says this is the board's job
//      inherited, and this is where that inheritance is held honest.
//   3  YOUR TABLE IS A REAL GAME. One page per man, exactly as wide as the
//      track, and the page is a live felt rather than a silhouette of one.
//   4  NOTHING SLIDES ACROSS ANYTHING, AND THE FELT DOES NOT SHRINK. DESK-3's
//      law, re-expressed: the room takes the whole desk the roster leaves, the
//      ticker and Your table are stacked above it rather than over it, and
//      Your table keeps the box its felt was drawn for.
//   5  HIS SEAT IS REACHABLE BY TAP. His body on the rim of his felt, the felt
//      named after him, hit-testable at its centre through a scaled and
//      transformed plan, and tapping it opens his table.
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

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

/**
 * Into the casino, from whichever way in this shell has.
 *
 * The two shells do NOT share a control any more, and that is the whole of
 * CI #84. HOME-2 job 1 took the bottom bar off the phone — HOME, CASINO and
 * YOU became things in the room — so on the phone the way in is the door
 * (`home-door`, a real button with the sign over it). The desk kept its rail,
 * so `HomeFlat` hands its door no destination there and draws it as furniture
 * with no test id at all; the CASINO the desk means is the one in
 * `DesktopTopBar`'s stage group. This clicked that button on both, which at
 * 390 is a control that no longer exists: the 1440 case passed and the 390
 * case sat on `locator.click` for the full two-minute timeout.
 */
async function openCasino(page, uid, desktop) {
  await page.addInitScript((id) => {
    try { window.localStorage.setItem('agentic_uid', id); } catch { /* private mode */ }
  }, uid);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });
  if (desktop) {
    await page.getByTestId('home-door').click();
  } else {
    // Named, not a bare click: if the door ever loses its test id this fails
    // saying the door is missing rather than timing out on a mystery locator.
    const door = page.getByTestId('home-door');
    await expect(door, 'the phone reaches the casino through the door').toBeVisible({ timeout: 20_000 });
    await door.click();
  }
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

    test('the ticker, your table and the room all hold at this width', async ({ page }) => {
      const agent = await seedOnce();
      const noise = watchConsole(page);
      await openCasino(page, UID, desktop);

      // ── the casino is the room ───────────────────────────────────────────
      await test.step('the casino is the room, and its name is one line', async () => {
        // UI-3 job A · ONE ROOM. There is no building left to open onto and
        // nothing to walk into: CasinoScreen renders the floor itself, always.
        // The old step tapped `casino-view-toggle` to reach a sign over three
        // `.csn-room-door`s and counted them; the toggle, the doors and the
        // building are all deleted from the tree, so those two assertions are
        // gone rather than re-expressed — there is no longer a second place
        // for the toggle to go, and no second room for a door to lead to.
        await expect(page.getByTestId('floor-view'), 'the casino IS the room')
          .toBeVisible({ timeout: 20_000 });

        // THE SIGN STILL NEVER WRAPS, and it is a longer name than it was:
        // "The casino floor", not "The casino". Two words in a narrow flex
        // column broke as "The" over "casino" once, and no amount of jsdom
        // can see it — this is the real font at the real width, measured, and
        // a third word only makes the claim worth more. C9's desktop shell
        // owns the one title; the phone's marquee went with the building, so
        // the phone's sign is the room's own header, which is where UI-3 put
        // the name.
        const sign = desktop
          ? page.locator('.dsk-top__room h1')
          : page.locator('.csn-floor__head').getByText('The casino floor', { exact: true });
        await expect(sign).toBeVisible({ timeout: 20_000 });
        const box = await sign.boundingBox();
        expect(box.height, 'the sign is one line').toBeLessThan(28);
      });

      // ── the board's question, in one line ────────────────────────────────
      await test.step('one line at the top answers what the board answered', async () => {
        // UI-3 job A retired the two-panel board: `.csn-board`, `.csn-live`
        // and `.csn-tonight` are FloorBoard.jsx, which is deleted, and there
        // is no wall left inside a single room to hang two panels on. The
        // QUESTION is not retired — CasinoTicker.jsx's own header says it
        // inherits it — so the board's three claims come here:
        //
        //   "the board is visible"            -> the ticker is
        //   "exactly one board on the screen" -> exactly one ticker (DESK-2's
        //                                        rule: one evening, told once)
        //   "LIVE NOW above TONIGHT"          -> one line, not two panels
        //
        // The one that is genuinely gone is `ON THE FLOOR RIGHT NOW`, the
        // desk board's own heading over LIVE NOW. A heading over one line
        // would be taller than the line, which is why the ticker does not
        // have one.
        const ticker = page.getByTestId('casino-ticker');
        await expect(ticker).toHaveCount(1);
        await expect(ticker).toBeVisible({ timeout: 20_000 });
        await expect(ticker, 'a quiet floor says so rather than saying nothing')
          .not.toHaveText('');
        // ONE LINE, measured against itself rather than against a number.
        // The copy span cannot wrap (nowrap + ellipsis), so the break this
        // catches is the one the old sign actually suffered: a flex row in a
        // narrow column turning into a flex column. Every part of the ticker
        // shares its centre line, and the whole bar is one part tall plus its
        // own 7px gutters — a second row would roughly double it.
        //
        // The floor is the bar's own `min-height`, not zero: on the phone the
        // ticker is a 44px tap target, which is taller than the 32px of type
        // in it and is not the ticker growing a second row.
        const row = await ticker.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const kids = [...el.children].map((c) => c.getBoundingClientRect());
          return {
            height: box.height,
            floor: parseFloat(getComputedStyle(el).minHeight) || 0,
            tallest: Math.max(...kids.map((r) => r.height)),
            offCentre: Math.max(...kids.map(
              (r) => Math.abs((r.y + r.height / 2) - (box.y + box.height / 2)),
            )),
          };
        });
        expect(row.offCentre, 'every part of the ticker is on the same line').toBeLessThan(4);
        expect(row.height, 'and the bar is that one line tall')
          .toBeLessThanOrEqual(Math.max(row.floor, row.tallest + 16));
      });

      // ── your table, as a carousel ────────────────────────────────────────
      await test.step('your table is a carousel of real games', async () => {
        const your = page.getByTestId('your-tables');
        await expect(your).toBeVisible({ timeout: 20_000 });

        // Recovery: the phone uses a compact, named live-table selector;
        // desktop retains the full felt. Both must identify the seeded agent.
        const ownedPage = your.locator(`.csn-your__page[data-agent="${agent.id}"]`);
        if (desktop) {
          const felt = ownedPage.locator('.csn-felt');
          await expect(felt).toBeVisible({ timeout: 30_000 });
          await expect(felt, 'the page is his real table').toHaveAttribute('data-mine', 'true');
        } else {
          const summary = ownedPage.getByRole('button', { name: new RegExp(`^Watch ${escapeRe(agent.name)} at `) });
          await expect(summary).toBeVisible({ timeout: 30_000 });
          await expect(summary).toContainText('YOUR TABLE');
          await expect(summary).toContainText('in the pot');
          expect((await summary.boundingBox()).height, 'the compact selector remains a touch target').toBeGreaterThanOrEqual(44);
        }

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

      // ── the room, from above ─────────────────────────────────────────────
      await test.step('the room is furnished and drawn to the width it is given', async () => {
        const view = page.getByTestId('floor-view');

        // Wave 58: it is a ROOM, drawn from above — felts as ellipses with
        // bodies on their rims, with the bar above the tables.
        const floor = view.getByTestId('the-floor');
        await expect(floor).toBeVisible({ timeout: 20_000 });
        await expect(floor.locator('.csn-felt58').first()).toBeVisible({ timeout: 20_000 });
        await expect(floor.getByText('THE BAR')).toBeVisible();

        // `THE BOARD` was the plaque on the board bolted beside the stairs.
        // UI-3 job A took the board away and gave the stairs back their only
        // other meaning — the way out — so the plaque reads HOME now. The
        // rule this assertion carries is the one the ref actually states:
        // THE ROOM IS FURNISHED. A room drawn from above with nothing on its
        // walls is a diagram of a room. So it is re-expressed against the
        // furniture that is in there now rather than dropped.
        await expect(floor.locator('.csn-floor58__stairs')).toBeVisible();
        await expect(floor.getByText('HOME', { exact: true })).toBeVisible();

        // The plan is drawn in 390 units and SCALED to the room's width. On the
        // desk that is a wide room and on the phone it is not, and either way
        // the felts have to be inside it — a scale bug puts them off the edge,
        // which is the sort of thing only a laid-out page can see.
        const floorBox = await floor.boundingBox();
        const feltBox = await floor.locator('.csn-felt58').first().boundingBox();
        expect(feltBox.x).toBeGreaterThanOrEqual(floorBox.x - 1);
        expect(feltBox.x + feltBox.width).toBeLessThanOrEqual(floorBox.x + floorBox.width + 1);
        expect(feltBox.y + feltBox.height).toBeLessThanOrEqual(floorBox.y + floorBox.height + 1);

        // What used to stand here — `.csn-room-door` back to 0, `.csn-desk__rail`
        // back to 0 — said "the building is gone, because a room is a
        // destination and not a sheet over one." There is no building on any
        // screen of this product any more, so that is not a rule the casino
        // can break; it is an absence of markup that was deleted a wave ago.
        // Both assertions are gone. So are the two at the end of the old walk
        // that toggled back to the board and re-counted the three doors.
      });

      // ── the columns, and the box the felt was drawn for ──────────────────
      await test.step('nothing slides across anything, and the felt does not shrink', async () => {
        // THE BOARD-COLUMN RULE, RE-EXPRESSED. The old walk asserted, on the
        // desk, that `.csn-floor__board` sat to the RIGHT of `.csn-floor__room`
        // and that the room took the whole desk the roster leaves; on the
        // phone, that the board sat UNDER the room. The board is gone, so the
        // selector is, but what those three assertions were about is DESK-3's
        // law — "three columns, always open, nothing sliding over anything" —
        // and that law did not go anywhere. The one room still has to take the
        // whole desk the roster leaves, and the two things UI-3 put on the
        // casino stage with it (the ticker, Your table) are STACKED ABOVE it,
        // which is the same claim the phone's "the board is under the room"
        // was making. So it is asserted about the elements that are there now.
        const ticker = await page.getByTestId('casino-ticker').boundingBox();
        const your = await page.getByTestId('your-tables').boundingBox();
        const view = await (desktop ? page.getByTestId('floor-view') : page.locator('.csn-floor__room')).boundingBox();

        expect(ticker.y + ticker.height, 'the ticker is above Your table, not over it')
          .toBeLessThanOrEqual(your.y + 1);
        expect(your.y + your.height, 'Your table is above the room, not over it')
          .toBeLessThanOrEqual(view.y + 1);

        // The 240px full-felt minimum remains on desktop. The phone's approved
        // compact selector has no felt inside it; it must leave room for the
        // actual casino rather than reserving the retired full-preview box.
        if (desktop) {
          expect(your.height, 'Your table keeps the box its felt was drawn for').toBeGreaterThanOrEqual(240);
        } else {
          expect(your.height, 'the phone selector leaves space for the room').toBeLessThanOrEqual(180);
          const head = await page.locator('.csn-floor__head').boundingBox();
          expect(head.y + head.height, 'Home navigation stays above the ticker').toBeLessThanOrEqual(ticker.y + 1);
        }

        if (desktop) {
          // ...and the room takes the whole desk THE ROSTER LEAVES. Measured
          // against the column rather than restated as a fraction of the
          // window: a hard-coded 0.82 would pass just as well if the roster
          // silently doubled, which is the bug this assertion is for.
          const roster = await page.getByTestId('desk-roster').boundingBox();
          expect(view.width, 'the room takes the whole desk the roster leaves')
            .toBeGreaterThan((viewport.width - roster.width) * 0.95);
          // Beside it, not under or over it — three columns, which is the
          // whole of the wave's law.
          expect(view.x, 'the room starts where the roster ends')
            .toBeGreaterThanOrEqual(roster.x + roster.width - 1);

          // The other half of the ceiling: a 900px-wide page is a felt with
          // its ring pulled apart, so on the desk Your table keeps a felt's
          // width and sits in the middle of the room's column rather than
          // stretching across it.
          expect(your.width, 'Your table keeps a felt’s width on the desk')
            .toBeLessThanOrEqual(641);
          expect(your.height, 'and a felt’s height').toBeLessThanOrEqual(421);
          expect(
            Math.abs((your.x + your.width / 2) - (view.x + view.width / 2)),
            'centred in the room’s column',
          ).toBeLessThan(2);
        }
      });

      await shot(page, `${shell}-casino2-room`);

      // ── his seat ─────────────────────────────────────────────────────────
      await test.step('his seat on the rim is reachable by tap', async () => {
        const floor = page.getByTestId('floor-view').getByTestId('the-floor');
        const his = floor.locator('.csn-felt58[data-mine="true"]');
        await expect(his, 'his table is drawn as his').toBeVisible({ timeout: 20_000 });
        await expect(his.locator('.csn-tiny[data-mine="true"]'), 'and he is a body on its rim')
          .toBeVisible();
        // Named after HIM, not after a table number — the one reason to look
        // at a room full of strangers' felts is to find the one that is not a
        // stranger's.
        await expect(his).toHaveAttribute(
          'aria-label',
          new RegExp(`^Watch ${escapeRe(agent.name)} at this table$`),
        );

        // REACHABLE. The plan is scaled, translated and vignetted, and a felt
        // can be perfectly visible while something invisible sits on top of
        // it — so the claim is hit-testing, not visibility: the centre of his
        // felt belongs to his felt.
        expect(
          await his.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }),
          'nothing is covering his seat',
        ).toBe(true);

        // And tapping it opens his table. The two shells land in different
        // places — the desk keeps the felt in its stage, the phone takes the
        // whole screen — so each is named rather than asserted generically.
        await his.click();
        await expect(
          desktop ? page.getByTestId('desk-casino-table') : page.locator('.watch-screen'),
        ).toBeVisible({ timeout: 30_000 });
        await shot(page, `${shell}-casino2-his-table`);
      });

      expect(noise, `console was not clean:\n${noise.join('\n')}`).toEqual([]);
    });
  });
}
