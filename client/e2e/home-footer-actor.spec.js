import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

async function household(page) {
  const common = { nature: { name: 'Rock' }, fatigue: 'fresh', location: { where: 'home' },
    routine: { key: 'paces', label: 'pacing' }, mood: { state: 'neutral', heat: 30 } };
  const resident = { ...common, id: 'gran', name: 'Granite', identity: { hood: 'sand', glow: 'gold' } };
  const guest = { ...common, id: 'guest', name: 'Professor', guest: true,
    mood: { state: 'sulking', heat: 61 }, identity: { hood: 'indigo', glow: 'violet' } };
  const served = [{ id: 1, ts: 1, kind: 'him', from: 'guest', who: 'Professor', text: 'Let this one go.', source: 'home' }];
  const requests = [], posts = [];
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', r => {
    const p = new URL(r.request().url()).pathname;
    requests.push(p);
    if (r.request().method() === 'POST') {
      posts.push({ path: p, body: r.request().postDataJSON() });
      if (p === '/api/home/say') return r.fulfill({ status: 503, json: { error: 'Synthetic refusal' } });
    }
    const json = p === '/api/agents' ? { agents: [resident] }
      : p === '/api/wallet' ? { balance: 54000, ledger: [] }
      : p === '/api/slots' ? { used: 1, cap: 4, next: null }
      : p === '/api/home/thread' ? { sessionId: 'today', lines: served }
      : { rooms: [], book: [], items: [], events: [], study: null };
    return r.fulfill({ json });
  });
  await page.addInitScript(agents => {
    window.Telegram = { WebApp: { initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
      initDataUnsafe: { user: { id: 4242 } }, get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    class Socket {
      constructor() { this.readyState = 0; this.listeners = {}; setTimeout(() => { this.readyState = 1; this.emit('open', {}); }, 20); }
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
      removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter(x => x !== f); }
      emit(t, e) { for (const f of this.listeners[t] ?? []) f(e); }
      send(raw) { if (JSON.parse(raw).type === 'floor_sub') {
        window.pushFooterLine = line => this.emit('message', { data: JSON.stringify({ type: 'owner_line', userId: '4242', sessionId: 'today', line }) });
        setTimeout(() => this.emit('message', { data: JSON.stringify({ type: 'home_state', userId: '4242', agents, game: null }) }), 20);
      } }
      close() { this.readyState = 3; }
    }
    Socket.OPEN = 1; Socket.prototype.OPEN = 1; window.WebSocket = Socket;
  }, [resident, guest]);
  await page.goto('/');
  await expect(page.getByTestId('home-thread-line')).toContainText('Let this one go.');
  await page.evaluate(() => document.fonts.ready);
  return { requests, posts };
}

for (const height of [844, 590]) {
  test(`BUG-184: exact actor footer and safe conversation taps at390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const { requests, posts } = await household(page);
    const line = page.getByTestId('home-thread-line'), band = page.locator('.home-thread__band');
    await mkdir(testInfo.outputDir, { recursive: true });
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('home-initial.png') });
    await band.screenshot({ animations: 'disabled', path: testInfo.outputPath('footer-initial.png') });
    const avatar = line.locator('.home-thread__avatar');
    await expect(avatar).toHaveAttribute('data-agent-id', 'guest');
    await expect(avatar.locator('svg')).toHaveAttribute('data-hood', 'indigo');
    await expect(avatar.locator('svg')).toHaveAttribute('data-mood', 'sulking');
    await expect(line).toHaveAccessibleName('Professor Let this one go.');
    await expect(line.locator('.home-thread__who')).toHaveText('Profes');
    await expect(line.locator('.home-thread__who')).toHaveCSS('color', 'rgb(139, 107, 196)');
    await expect(line.locator('.home-thread__text')).toHaveCSS('color', 'rgb(158, 158, 162)');
    await expect(line.locator('.home-thread__text')).toHaveCSS('font-size', '11px');
    await expect(line.locator('.home-thread__who')).toHaveCSS('font-weight', '600');
    await expect(avatar.locator('.home-thread__mood')).toHaveText('▾');
    await expect(avatar.locator('.home-thread__mood')).toHaveCSS('color', 'rgb(158, 158, 162)');
    await expect(avatar.locator('.home-thread__mood')).toHaveCSS('font-family', '"JetBrains Mono", monospace');
    await expect(avatar.locator('.home-thread__mood')).toHaveCSS('font-size', '7.8px');
    await expect(avatar.locator('.home-thread__mood')).toHaveCSS('font-weight', '700');
    const metrics = await line.evaluate(el => {
      const band = el.closest('.home-thread__band'), base = band.getBoundingClientRect();
      const bounds = e => { const b=e.getBoundingClientRect(); return { x:b.x-base.x, y:b.y-base.y, width:b.width, height:b.height }; };
      return { band:bounds(band), line:bounds(el), avatar:bounds(el.querySelector('.home-thread__avatar')),
        pip:bounds(el.querySelector('.home-thread__mood')), sentence:bounds(el.querySelector('.home-thread__sentence')),
        composer:bounds(band.querySelector('.home-thread__composer')) };
    });
    expect(metrics.band).toEqual({ x:0, y:0, width:390, height:78 });
    expect(metrics.line).toEqual({ x:0, y:1, width:390, height:22 });
    expect(metrics.avatar).toEqual({ x:13, y:2, width:20, height:20 });
    expect(metrics.pip).toEqual({ x:21, y:10, width:15, height:15 });
    expect(metrics.sentence).toEqual({ x:41, y:5, width:336, height:14 });
    expect(metrics.composer).toEqual({ x:12, y:31, width:366, height:36 });
    expect(metrics.pip.y + metrics.pip.height).toBeLessThan(metrics.composer.y);
    await expect(band).toHaveCSS('background-color', 'rgba(13, 23, 21, 0.72)');
    await expect(band).toHaveCSS('backdrop-filter', 'blur(18px) saturate(1.2)');
    await line.click();
    await expect(page.getByRole('dialog', { name: 'The room conversation' })).toBeVisible();
    await expect(page.getByTestId('home-thread-rows')).toContainText('“Let this one go.”');
    await page.getByRole('button', { name: 'Close the thread', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'The room conversation' })).toHaveCount(0);
    await line.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'The room conversation' })).toBeVisible();
    await page.getByRole('button', { name: 'Close the thread', exact: true }).click();
    await page.getByTestId('home-thread-input').fill('I heard you.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Could not send');
    await expect(page.getByTestId('home-thread-input')).toHaveValue('I heard you.');
    await expect(line).toHaveAccessibleName('Professor Let this one go.');
    const alertBox=await page.getByRole('alert').boundingBox(),bandBox=await band.boundingBox();
    expect(alertBox.y + alertBox.height).toBeLessThanOrEqual(bandBox.y);
    await page.screenshot({ animations:'disabled',path:testInfo.outputPath('refused-send.png') });
    expect(posts).toEqual([{path:'/api/home/say',body:{userId:'4242',text:'I heard you.'}}]);
    const longText='No hurry. '.repeat(30);
    await page.evaluate(text => window.pushFooterLine({ id:2,ts:2,kind:'him',from:'gran',who:'Granite',text }),longText);
    await expect(avatar).toHaveAttribute('data-agent-id','gran');
    await expect(line).toHaveAccessibleName(`Granite ${longText.trim()}`);
    expect(await line.locator('.home-thread__sentence').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
    expect(requests.some(p=>/\/api\/agents\/[^/]+\/(thread|profile)/.test(p))).toBe(false);
    expect(errors).toEqual([]);
    await writeFile(testInfo.outputPath('metrics.json'),JSON.stringify({height,metrics,requests,posts,errors},null,2));
  });
}
