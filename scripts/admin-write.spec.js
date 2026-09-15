// scripts/admin-write.spec.js — ADMIN-2
//
// The one browser check: a real Chromium tab opens /admin, types the real
// key, and drives the write panel's own form to adjust a real seeded
// owner's chips — the same door a person opening this page would use, not
// a fetch dressed up as one. See playwright.adminwrite.config.js for how to
// run it; it needs a server already running with ADMIN_KEY set to the same
// value this test reads from its own environment.
//
// Correctness is opsRoutes.test.js's job (every status code, every
// refusal, the audit line's exact shape). What only a browser can prove is
// that the panel's own JS actually reaches the route, reads the response,
// and paints something a person would trust — the same reason CI-2's smoke
// exists for the product's own screens.

import { test, expect } from '@playwright/test';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8765';
const ADMIN_KEY = process.env.ADMIN_KEY;

test.skip(!ADMIN_KEY, 'ADMIN_KEY is not set in this shell — nothing to log into');

async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

test('ADMIN-2: the write panel adjusts a real owner\'s chips and shows the audit line', async ({ page }) => {
  const uid = 'admincheck' + Date.now();
  await api('POST', '/api/agents/chat/reset', { userId: uid });
  const built = await api('POST', '/api/agents/build', { userId: uid });
  const agent = built.body?.createdAgent;
  expect(agent?.id, `seeding failed: ${JSON.stringify(built.body)}`).toBeTruthy();

  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE}/admin`);
  await page.getByLabel('Admin key').fill(ADMIN_KEY);
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('#app')).toBeVisible({ timeout: 10_000 });

  // Owner — adjust chips, a real write through the real form.
  await page.locator('#opOwnerA').fill(uid);
  await page.locator('#opAmount').fill('250');
  await page.locator('#opReasonA').fill('ADMIN-2 browser check');
  await page.locator('#opAdjust').click();
  // A fresh owner's first agent always grants an 8,000-chip wallet (the
  // 10,000 starting grant minus the 2,000 pocket float) — deterministic,
  // never a model call.
  await expect(page.locator('#opOwnerMsg')).toHaveText('ok — 8,000 → 8,250', { timeout: 10_000 });

  // The audit table reloads itself after every write — the row must be there.
  const auditRow = page.locator('#opAuditTable tbody tr').first();
  await expect(auditRow).toContainText('owner.adjust', { timeout: 10_000 });
  await expect(auditRow).toContainText('ADMIN-2 browser check');

  // Agent — rename, through naming.js's own rules.
  await page.locator('#opAgentOwner').fill(uid);
  await page.locator('#opAgentId').fill(agent.id);
  await page.locator('#opName').fill('Checked');
  await page.locator('#opRename').click();
  await expect(page.locator('#opAgentMsg')).toHaveText(/ok — ".*" → "Checked"/, { timeout: 10_000 });

  expect(errors).toEqual([]);
});
