import { test, expect } from '@playwright/test';

async function entry(page, guest) {
  const requests = [];
  await page.route('**/telegram.org/**', route => route.fulfill({ body:'' }));
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    requests.push({ pathname, method:route.request().method() });
    if (pathname === '/api/auth/config') return route.fulfill({ json:{guest,botUsername:''} });
    if (pathname === '/api/auth/me' || pathname === '/api/guest/me') return route.fulfill({status:401,json:{}});
    if (pathname === '/api/guest') return route.fulfill({json:{ownerId:'g_welcome'}});
    if (pathname === '/api/agents') return route.fulfill({json:{agents:[]}});
    if (pathname === '/api/slots') return route.fulfill({json:{used:0,cap:4,next:{index:1,price:0,earned:0,unlocked:true}}});
    if (pathname === '/api/rooms') return route.fulfill({json:{rooms:[]}});
    return route.fulfill({json:{}});
  });
  await page.addInitScript(() => {
    localStorage.clear();
    window.WebSocket = class { static OPEN=1; readyState=0; addEventListener(){} removeEventListener(){} send(){} close(){} };
  });
  return requests;
}

for (const width of [375,390,768,1280,1440]) {
  test(`L2 welcome has a real guest room and current responsive screens at ${width}`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const height=width>700?900:844;
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion:'reduce'});
    const requests=await entry(page,true);
    await page.goto('/welcome');
    await expect(page.getByRole('heading',{name:'Deal him in.',level:1})).toBeVisible();
    await expect(page.getByTestId('draft-input')).toBeAttached();
    const hero=page.locator('.guest-hero'),room=page.locator('.guest-landing__room');
    expect((await hero.boundingBox()).height).toBe(height-26);
    expect((await room.boundingBox()).y).toBe(height-26);
    await expect(page.locator('.landing-section')).toHaveCount(8);
    await hero.getByRole('button',{name:'DRAFT HIM'}).click();
    await expect(page.getByTestId('draft-input')).toBeFocused();
    await page.getByTestId('draft-input').fill('Patient until it matters');
    await expect(page.getByTestId('draft-input')).toHaveValue('Patient until it matters');
    await page.waitForTimeout(500);
    expect((await room.boundingBox()).y).toBeCloseTo(0,0);
    for(const img of await page.locator('.landing-screen img').all()){
      await img.scrollIntoViewIfNeeded();
      await expect.poll(()=>img.evaluate(el=>el.complete && el.naturalWidth>0)).toBe(true);
      const box=await img.boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    await page.locator('.landing-close').getByRole('button',{name:'DRAFT HIM'}).click();
    await expect(page.getByTestId('draft-input')).toBeFocused();
    await expect(page.getByTestId('draft-input')).toHaveValue('Patient until it matters');
    expect(requests.filter(r=>r.pathname==='/api/guest'&&r.method==='POST')).toHaveLength(1);
    if(width===390||width===1280||width===1440){
      await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.waitForTimeout(350);
      await page.screenshot({path:`../artifacts/welcome22-hero-${width}.png`});
      // Element captures taller than the app's body scroller otherwise clip at
      // the viewport. Release that export-only clip after interaction checks.
      await page.evaluate(()=>{
        document.activeElement?.blur();
        for(const el of [document.documentElement,document.body]) { el.style.height='auto';el.style.overflow='visible'; }
      });
      await page.locator('.landing-section').nth(1).screenshot({path:`../artifacts/welcome22-home-${width}.png`});
      await page.locator('.landing-section').nth(3).screenshot({path:`../artifacts/welcome22-casino-${width}.png`});
      await page.locator('.landing-section').nth(6).screenshot({path:`../artifacts/welcome25-sit-${width}.png`});
    }
    expect(errors).toEqual([]);
  });
}
for(const width of [390,1440]) {
  test(`L2 welcome respects disabled guests at ${width}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    const requests=await entry(page,false);
    await page.goto('/welcome');
    await expect(page.getByRole('heading',{name:'Deal him in.',level:1})).toBeVisible();
    await expect(page.locator('.guest-hero .guest-hero__free')).toHaveText('Free · sign in with Telegram');
    await page.locator('.guest-hero').getByRole('button',{name:'MEET HIM'}).click();
    await expect(page.locator('.ftu-login')).toBeVisible();
    await expect(page.getByTestId('draft-input')).toHaveCount(0);
    expect(requests.filter(r=>r.pathname==='/api/guest'&&r.method==='POST')).toHaveLength(0);
    expect(new URL(page.url()).pathname).toBe('/welcome');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  });
}

test('BUG-101: normal motion returns from the long footer before focusing',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await entry(page,true);
  await page.goto('/welcome');
  await expect(page.getByTestId('draft-input')).toBeAttached();
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.landing-close').scrollIntoViewIfNeeded();
  expect((await page.locator('.guest-hero').boundingBox()).y).toBeLessThan(-5000);
  await page.locator('.landing-close').getByRole('button',{name:'DRAFT HIM'}).click();
  await expect(page.getByTestId('draft-input')).toBeFocused();
  expect((await page.locator('.guest-landing__room').boundingBox()).y).toBeCloseTo(0,0);
  await page.getByTestId('draft-input').fill('No rush. Wait for your hand.');
  await expect(page.getByTestId('draft-input')).toHaveValue('No rush. Wait for your hand.');
});
