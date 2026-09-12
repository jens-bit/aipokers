import { test, expect } from '@playwright/test';

for (const viewport of [{ width:390, height:844 }, { width:390, height:590 }, { width:1440, height:900 }]) {
  test(`SHOW-1 welcome hand and real room at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/config') return route.fulfill({ json:{ guest:true } });
      if (path === '/api/guest/me') return route.fulfill({ status:404, json:{} });
      if (path === '/api/guest') return route.fulfill({ json:{ ownerId:'g_demo' } });
      if (path === '/api/slots') return route.fulfill({ json:{ used:0, cap:4, next:{ index:1, price:0, earned:0, unlocked:true } } });
      return route.fulfill({ json:{ agents:[], rooms:[], events:[], lines:[] } });
    });
    await page.addInitScript(() => {
      class QuietSocket { static OPEN=1; readyState=1; send() {} close() {} addEventListener() {} removeEventListener() {} }
      window.WebSocket = QuietSocket;
    });
    await page.goto('/');
    const demo = page.getByRole('region', { name:'Demonstration poker table' });
    await expect(demo).toBeVisible();
    await expect(demo.locator('[data-seat]')).toHaveCount(2);
    await expect(demo.locator('[data-board-card]')).toHaveCount(3);
    await expect(page.getByText('Big Slick bets $80.')).toBeVisible({ timeout:4000 });
    await expect(demo).toHaveAttribute('data-street', 'showdown', { timeout:16000 });
    await expect(demo.locator('[data-opponent-card="face"]')).toHaveCount(2);
    await expect(demo).toHaveAttribute('data-street', 'preflop', { timeout:5000 });
    await expect(demo.locator('[data-opponent-card="back"]')).toHaveCount(2);
    await page.getByRole('button', { name:'Pause demo' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    await page.screenshot({ path:`../artifacts/show/landing-${viewport.width}-${viewport.height}.png`, fullPage:false });
    await page.emulateMedia({ reducedMotion:'reduce' });
    await page.locator('.guest-hero').getByRole('button', { name:'DRAFT HIM' }).click();
    await expect(page.getByTestId('draft-input')).toBeFocused();
    await expect(page.getByTestId('draft-input')).toBeInViewport();
    expect(errors).toEqual([]);
  });
}

test('SHOW-1 login demo moves while Telegram is settling', async ({ page }) => {
  await page.route('**/api/auth/config', route => route.fulfill({ json:{ guest:false, botUsername:'' } }));
  await page.route('**/api/auth/me', route => route.fulfill({ status:401, json:{} }));
  await page.goto('/');
  await expect(page.getByRole('region', { name:'Demonstration poker table' })).toBeVisible();
  await expect(page.getByText('Big Slick bets $80.')).toBeVisible({ timeout:4000 });
  await expect(page.getByText(/Open the Mini App from/)).toBeVisible();
  await page.screenshot({ path:'../artifacts/show/login-phone.png' });
});
