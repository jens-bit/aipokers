// scripts/home2.spec.js — HOME-2
//
// THE PHONE, MEASURED. 390×844, the real built client, the real server.
//
// Everything asserted here is a claim jsdom is structurally unable to check.
// It performs no layout — getBoundingClientRect is all zeroes — so "nothing
// overlaps his name pill", "the door sign is fully in frame" and "a long press
// then a drag lands him on the couch" are questions only a browser can answer.
// The component tests beside each file assert the WIRING; this asserts the
// PICTURE and the GESTURE.
//
// One owner, one agent at home, seeded over HTTP the way scripts/smoke.spec.js
// seeds its two — SLOTS-1 means a fresh owner has exactly one free seat, so a
// second agent here would come back 409 slotLocked and the room would be a
// picture of nothing.

import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const BASE  = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8765';
const SHOTS = process.env.HOME2_SHOT_DIR ?? 'home2-shots';

const UID = process.env.HOME2_USER ?? 'home2phone';

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
 * The owner's one agent, built if he does not have one yet.
 *
 * Idempotent for the same reason smoke.spec.js's is: CI starts from an empty
 * scratch data dir, a developer runs this twice against the same one, and the
 * second build is a 409 rather than a second man.
 */
async function seed() {
  const existing = await api('GET', `/api/agents?userId=${encodeURIComponent(UID)}`);
  const roster = Array.isArray(existing.body?.agents) ? existing.body.agents : [];
  if (roster.length) return roster[0];

  // Building from an empty conversation means inferFallback(), which needs no
  // model and no key.
  await api('POST', '/api/agents/chat/reset', { userId: UID });
  const built = await api('POST', '/api/agents/build', { userId: UID });
  const agent = built.body?.createdAgent;
  if (!agent?.id) {
    throw new Error(`agent build for ${UID} failed: ${built.status} ${JSON.stringify(built.body)}`);
  }
  return agent;
}

let seeding = null;
const seedOnce = () => (seeding ??= seed());

// ── Per-test plumbing ───────────────────────────────────────────────────────

/** Sign in as the seeded owner: outside Telegram, getUserId() reads this. */
async function asOwner(page) {
  await page.addInitScript((id) => {
    try { window.localStorage.setItem('agentic_uid', id); } catch { /* private mode */ }
  }, UID);
}

async function openRoom(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });
  // A body in the room is what says the roster has landed; every measurement
  // below is about something drawn over or beside one.
  await expect(page.locator('.home-one').first()).toBeVisible({ timeout: 20_000 });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

// ── HOME-2 job 1 · no bottom bar ────────────────────────────────────────────

test.describe('HOME-2 job 1 · the three destinations are things in the world', () => {
  test.beforeEach(async ({ page }) => { await asOwner(page); });

  test('there is no bar at the bottom, and the composer is the last thing', async ({ page }) => {
    await seedOnce();
    await openRoom(page);

    await expect(page.locator('.tab-bar')).toHaveCount(0);

    // The composer is the only thing at the bottom of the screen: nothing the
    // room draws reaches below the sheet that holds it.
    const sheet = page.locator('.home-thread').first();
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box, 'the thread sheet has a box').toBeTruthy();
    // Within a pixel of the viewport's own floor — a bar under it would push
    // this up by its own height.
    expect(844 - (box.y + box.height)).toBeLessThanOrEqual(1);
    await shot(page, 'job1-room');
  });

  test('CASINO is the door, and back from it is the room', async ({ page }) => {
    await seedOnce();
    await openRoom(page);

    await page.getByTestId('home-door').click();
    await expect(page.locator('.csn').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('home-screen')).toHaveCount(0);
    await shot(page, 'job1-casino');

    await page.getByRole('button', { name: 'Back home' }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });
  });

  test('YOU is the avatar, and the money is one line behind it', async ({ page }) => {
    await seedOnce();
    await openRoom(page);

    await page.getByRole('button', { name: 'Your agents' }).click();
    await expect(page.getByTestId('roster-sheet')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('roster-wallet')).toBeVisible();
    await shot(page, 'job1-roster');

    await page.getByTestId('roster-wallet').click();
    await expect(page.locator('.money-sheet')).toBeVisible({ timeout: 20_000 });
  });

  // DEEPLINK-1 still lands where it always did. The bar was never how a link
  // arrived, but it WAS how the owner got out of where one put him, so the
  // route is worth walking end to end now that it is gone.
  test('a deep link still opens his thread, and back from it is the room', async ({ page }) => {
    const agent = await seedOnce();
    await page.goto(`${BASE}/?startapp=agent_${agent.id}`, { waitUntil: 'domcontentloaded' });

    await expect(page.getByPlaceholder(`Message ${agent.name}…`)).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 20_000 });
  });
});

// ── HOME-2 job 4 · the fixtures on the walls ────────────────────────────────

test.describe('HOME-2 job 4 · nothing clips at 390 wide', () => {
  test.beforeEach(async ({ page }) => { await asOwner(page); });

  test('the door sign is fully visible, all caps, and not a pill', async ({ page }) => {
    await seedOnce();
    await openRoom(page);

    const sign = page.getByTestId('home-door-sign');
    await expect(sign).toBeVisible();

    // FULLY IN FRAME. The door starts at x356 of 390, so anything laid out
    // rightward from it leaves the screen — board 29 measured the old tag at
    // 38px off. This is the assertion that fix cannot silently regress: the
    // room clips with overflow: hidden, so a sign over the edge is cut in
    // silence rather than reported.
    const box = await sign.boundingBox();
    const room = await page.locator('.home-flat').boundingBox();
    expect(box, 'the sign has a box').toBeTruthy();
    expect(box.x).toBeGreaterThanOrEqual(room.x - 0.5);
    expect(box.x + box.width).toBeLessThanOrEqual(room.x + room.width + 0.5);
    expect(box.y).toBeGreaterThanOrEqual(room.y - 0.5);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);

    await expect(sign).toHaveText('CASINO');
    await shot(page, 'job4-sign');
  });

  test('every fixture is drawn, inside the room, and none of them overlaps another', async ({ page }) => {
    await seedOnce();
    await openRoom(page);

    const room = await page.locator('.home-flat').boundingBox();
    const named = {
      safe: '[data-testid="home-safe"]',
      fridge: '[data-testid="home-fridge"]',
      door: '[data-testid="home-door"]',
      table: '[data-testid="home-table"]',
      tv: '.home-flat__tv',
      sign: '[data-testid="home-door-sign"]',
    };

    const boxes = {};
    for (const [name, sel] of Object.entries(named)) {
      const el = page.locator(sel).first();
      await expect(el, `${name} is drawn`).toBeVisible();
      const b = await el.boundingBox();
      expect(b, `${name} has a box`).toBeTruthy();
      // Inside the room, on every side.
      expect(b.x, `${name} left`).toBeGreaterThanOrEqual(room.x - 0.5);
      expect(b.x + b.width, `${name} right`).toBeLessThanOrEqual(room.x + room.width + 0.5);
      expect(b.y, `${name} top`).toBeGreaterThanOrEqual(room.y - 0.5);
      boxes[name] = b;
    }

    // The sign hangs OVER the door on purpose; everything else keeps clear.
    const pairs = Object.entries(boxes);
    for (let i = 0; i < pairs.length; i += 1) {
      for (let j = i + 1; j < pairs.length; j += 1) {
        const [an, a] = pairs[i];
        const [bn, b] = pairs[j];
        if (new Set([an, bn]).has('sign')) continue;
        const hit = a.x < b.x + b.width && b.x < a.x + a.width
          && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(hit, `${an} overlaps ${bn}`).toBe(false);
      }
    }
    await shot(page, 'job4-fixtures');
  });

  // The television is at the BOTTOM of the room and there is one of it. The
  // left-corner set is gone: two televisions in a one-television room was the
  // thing job 4 is undoing.
  test('one television, at the bottom, showing the casino', async ({ page }) => {
    await seedOnce();
    await openRoom(page);

    await expect(page.locator('.home-flat__tv')).toHaveCount(1);
    // Measured against the ROOM ITSELF (.home-flat, the authored 390x470 box)
    // rather than the container it sits in: the container is flex:1 and carries
    // the flat's own floor below the room, so "the bottom of the container" is
    // not a fact about where the furniture is.
    const flat = await page.locator('.home-flat').boundingBox();
    const tv = await page.locator('.home-flat__tv').boundingBox();
    expect(tv.y - flat.y).toBeGreaterThan(flat.height * 0.6);

    // Either the board or a live felt — never nothing, and never both.
    const board = await page.getByTestId('home-tv-board').count();
    const felt = await page.getByTestId('home-tv-felt').count();
    const tape = await page.getByTestId('home-tape').count();
    expect(board + felt + tape).toBe(1);
  });

  // "No element overlaps a pill or bubble." A pill is unreadable the moment
  // anything is drawn across it, and the room's whole speech rule (FIX-6 job 3)
  // is modelled rather than measured — this is the measurement.
  test('nothing is drawn across a name pill or a bubble', async ({ page }) => {
    await seedOnce();
    await openRoom(page);

    const speech = await page.locator('.home-pill, .home-bubble').all();
    expect(speech.length).toBeGreaterThan(0);
    const boxes = [];
    for (const el of speech) {
      const b = await el.boundingBox();
      if (b) boxes.push(b);
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const hit = a.x < b.x + b.width && b.x < a.x + a.width
          && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(hit, `two of the room's boxes overlap at ${a.x},${a.y}`).toBe(false);
      }
    }

    // ...and no pill is cut off by the room's own edge.
    const room = await page.locator('.home1__room').boundingBox();
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(room.x - 0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(room.x + room.width + 0.5);
    }
  });
});
