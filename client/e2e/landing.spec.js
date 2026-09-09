import { test, expect } from '@playwright/test';

for (const viewport of [{ width: 390, height: 700 }, { width: 390, height: 590 }, { width: 490, height: 590 }, { width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
  test(`L2: real guest room beneath the hero at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.route('**/telegram-web-app.js', route => route.fulfill({ body: '' }));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/config') return route.fulfill({ json: { guest: true } });
      if (path === '/api/guest/me') return route.fulfill({ status: 404, json: {} });
      if (path === '/api/guest') return route.fulfill({ json: { ownerId: 'g_landing' } });
      if (path === '/api/slots') return route.fulfill({ json: { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } } });
      if (path === '/api/agents') return route.fulfill({ json: { agents: [] } });
      if (path === '/api/rooms') return route.fulfill({ json: { rooms: [] } });
      return route.fulfill({ json: {} });
    });
    await page.addInitScript(() => {
      localStorage.clear();
      class QuietSocket {
        static OPEN = 1;
        readyState = 0;
        addEventListener() {}
        removeEventListener() {}
        send() {}
        close() { this.readyState = 3; }
      }
      window.WebSocket = QuietSocket;
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Deal him in.' })).toBeVisible();
    await expect(page.getByTestId('draft-input')).toBeAttached();
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const hero = await page.locator('.guest-hero').boundingBox();
    const room = await page.locator('.guest-landing__room').boundingBox();
    expect(hero.height).toBe(viewport.height - 26);
    expect(room.y).toBe(viewport.height - 26);
    expect(room.height).toBeGreaterThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
    const cards = page.locator('.guest-hero__card');
    await expect(cards).toHaveCount(2);
    expect(await cards.first().evaluate(el => parseFloat(getComputedStyle(el).width))).toBe(viewport.width > 700 ? 85 : 54);
    const head = await page.locator('.guest-hero__head').boundingBox();
    const art = await page.locator('.guest-hero__creature').boundingBox();
    if (viewport.width > 700) expect(art.x).toBeGreaterThan(head.x + head.width);
    else expect(art.y).toBeGreaterThan(head.y + head.height);
    await page.screenshot({ path: `../artifacts/landing-${viewport.width}-${viewport.height}.png` });
    await page.getByRole('button', { name: 'DRAFT HIM' }).click();
    await expect(page.getByTestId('draft-input')).toBeFocused();
    // Focus can race a still-running smooth scroll. Check the settled page.
    await page.waitForTimeout(800);
    expect((await page.locator('.guest-landing__room').boundingBox()).y, 'BUG-93: focus must not pull the room back below the viewport').toBeCloseTo(0, 0);
    if (viewport.width < 1100) {
      await expect(page.locator('.draft2__header')).toBeHidden();
      await expect(page.getByTestId('home-door-tag')).toHaveCount(0);
      await expect(page.locator('.draft2__room .home-chair')).toHaveCount(1);
      const sign = await page.getByTestId('home-door-sign').boundingBox();
      const sheet = await page.getByTestId('draft-sheet').boundingBox();
      expect(sign.y + sign.height, 'BUG-92: the whole sign clears the glass').toBeLessThanOrEqual(sheet.y);
      if (viewport.width === 390) expect(sheet.height).toBeCloseTo(viewport.height / 2, 0);
    }
    const field = await page.getByTestId('draft-input').boundingBox();
    if (viewport.width >= 1100) {
      await expect(page.getByTestId('home-rail')).toHaveAttribute('data-panel', 'draft');
      expect((await page.locator('.home1__room').boundingBox()).width).toBeGreaterThan(300);
    }
    expect(field.width, 'BUG-88: desktop recruiter has usable width').toBeGreaterThan(100);
    expect(field.height).toBeGreaterThan(30);
    expect(field.x).toBeGreaterThanOrEqual(0);
    expect(field.x + field.width, 'BUG-88: recruiter stays inside the visible room').toBeLessThanOrEqual(viewport.width);
    expect(await page.getByTestId('draft-input').evaluate(el => {
      const b = el.getBoundingClientRect();
      return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === el;
    }), 'BUG-88: recruiter is visible above the room').toBe(true);
    expect(field.y).toBeGreaterThanOrEqual(0);
    expect(field.y + field.height).toBeLessThanOrEqual(viewport.height);
    await page.getByTestId('draft-input').fill('A patient player with a dry sense of humour');
    await expect(page.getByTestId('draft-input')).toHaveValue('A patient player with a dry sense of humour');
    await page.screenshot({ path: `../artifacts/landing-room-${viewport.width}-${viewport.height}.png` });
    if (viewport.width < 1100) {
      await page.setViewportSize({ width: viewport.width, height: 360 });
      await expect(page.locator('.guest-landing__room .app')).toHaveCSS('height', '360px');
      await expect(page.locator('.draft2__forming')).toBeHidden();
      const compact = await page.getByTestId('draft-input').boundingBox();
      expect(compact.y).toBeGreaterThanOrEqual(0);
      expect(compact.y + compact.height).toBeLessThanOrEqual(360);
      expect((await page.getByTestId('draft-rows').boundingBox()).height).toBeGreaterThan(100);
      await page.getByTestId('draft-input').fill('Patient, with room to answer on a small screen.');
      await expect(page.getByTestId('draft-input')).toHaveValue('Patient, with room to answer on a small screen.');
    }
    expect(errors).toEqual([]);
  });
}
