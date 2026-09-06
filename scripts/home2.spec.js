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
