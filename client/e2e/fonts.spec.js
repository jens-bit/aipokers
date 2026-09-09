import { test, expect } from '@playwright/test';

for (const width of [390, 1440]) test('BUG-122 product fonts load with Google Fonts unavailable at ' + width, async ({ page }) => {
  const external = [], failed = [];
  await page.route('https://fonts.googleapis.com/**', route => { external.push(route.request().url()); return route.abort(); });
  await page.route('https://fonts.gstatic.com/**', route => { external.push(route.request().url()); return route.abort(); });
  await page.route('https://telegram.org/**', route => route.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', route => route.fulfill({ json: { flags: { guest: false }, agents: [], botUsername: '' } }));
  page.on('requestfailed', request => { if (new URL(request.url()).origin === 'http://127.0.0.1:5199') failed.push(request.url()); });
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/');
  const fonts = await page.evaluate(async () => {
    const descriptors = ['400 32px "Rozha One"', '400 32px "Playfair Display"', '900 32px "Playfair Display"', 'italic 500 32px "Playfair Display"', '400 32px "Inter"', '700 32px "Inter"', '400 32px "Oswald"', '700 32px "Oswald"', '400 32px "JetBrains Mono"', '700 32px "JetBrains Mono"'];
    return Promise.all(descriptors.map(async descriptor => ({ descriptor, loaded: (await document.fonts.load(descriptor, 'Railbird £€$0 123 —')).filter(face => face.status === 'loaded').length })));
  });
  for (const font of fonts) expect(font.loaded, font.descriptor).toBeGreaterThan(0);
  expect(external).toEqual([]);
  expect(failed).toEqual([]);
});
