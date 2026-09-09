import {test,expect} from '@playwright/test';
for(const viewport of [{width:390,height:560},{width:1440,height:900}]) {
  test('B12 loading frame waits for actual boot at '+viewport.width,async({page})=>{
    await page.setViewportSize(viewport);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.route('**/telegram-web-app.js',route=>route.fulfill({body:''}));
    await page.route('**/telegram-widget.js*',route=>route.fulfill({body:''}));
    await page.route('**/api/auth/me',route=>route.fulfill({status:401,json:{}}));
    await page.addInitScript(()=>localStorage.clear());
    let release;
    await page.route('**/api/auth/config',async route=>{await new Promise(resolve=>{release=resolve;});await route.fulfill({json:{guest:false,botUsername:'railbird_test_bot'}});});
    await page.goto('/?login',{waitUntil:'domcontentloaded'});
    const loading=page.getByRole('status',{name:'Loading Railbird'});
    await expect(loading).toBeVisible();
    await expect(loading.getByText('You don’t play. You raise a player.')).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    expect(await loading.boundingBox()).toEqual({x:0,y:0,...viewport});
    await expect(loading.locator('svg')).toHaveAttribute('width','150');
    await expect(loading.locator('p')).toHaveCSS('animation-name','none');
    await page.screenshot({path:'../artifacts/brand-loading-'+viewport.width+'.png'});
    // LoginGate reads config once more; release the first decision and answer that read.
    await page.route('**/api/auth/config',route=>route.fulfill({json:{guest:false,botUsername:'railbird_test_bot'}}));
    release();
    await expect(loading).toHaveCount(0);
    const manifest=await (await page.request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('Railbird');
    for(const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href','/brand/favicon.svg');
  });
}
