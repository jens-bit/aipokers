import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const requestText = 'Can I have a beer. It has been rough.';

// Local API/WS fixture: exercise actual App/Home callers and DOM, without
// sending an external message or treating this as signed server proof.
async function household(page, { text = requestText, refuseFirst = false } = {}) {
  const common = { name: 'Professor', nature: { name: 'Professor' }, fatigue: 'fresh',
    location: { where: 'home' }, routine: { key: 'paces', label: 'pacing' },
    mood: { state: 'neutral', heat: 30 }, pocket: { balance: 2000 }, stats: { handsPlayed: 0 }, sessionLog: [] };
  const first = { ...common, id: 'other-professor', identity: { hood: 'sand', glow: 'gold' },
    opener: 'No hurry. I can wait.' };
  const asking = { ...common, id: 'requester', identity: { hood: 'indigo', glow: 'violet' },
    mood: { state: 'sulking', heat: 61 }, want: { kind: 'beer', text, dangerous: false } };
  const agents = [first, asking], requests = [], sent = [];
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', r => {
    const url = new URL(r.request().url());
    requests.push(url.pathname);
    if (url.pathname === '/api/agents/requester/want' && r.request().method() === 'POST') {
      sent.push({ body: r.request().postDataJSON(), userId: url.searchParams.get('userId') });
      if (refuseFirst && sent.length === 1) return r.fulfill({ status: 503, json: { error: 'Synthetic refusal' } });
      asking.want = null;
      return r.fulfill({ json: { answered: sent.at(-1).body.answer, want: null } });
    }
    const json = url.pathname === '/api/agents' ? { agents }
      : url.pathname === '/api/wallet' ? { balance: 54000, ledger: [] }
      : url.pathname === '/api/slots' ? { used: 2, cap: 4, next: null }
      : url.pathname.includes('/thread') ? { sessionId: 'today', lines: [], count: 0 }
      : url.pathname.includes('/study') ? { study: null, book: [], count: 0 }
      : { rooms: [], events: [], items: [], lastId: 0 };
    return r.fulfill({ json });
  });
  await page.addInitScript(agents => {
    window.Telegram = { WebApp: { initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=fixture',
      initDataUnsafe: { user: { id: 4242 } }, get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {} } };
    class Socket {
      static OPEN = 1;
      constructor() { this.readyState = 0; this.listeners = {};
        setTimeout(() => { this.readyState = 1; this.emit('open', {}); }, 20); }
      emit(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      send(raw) { if (JSON.parse(raw).type === 'floor_sub') this.emit('message', {
        data: JSON.stringify({ type: 'home_state', userId: '4242', agents, game: null }),
      }); }
      close() { this.readyState = 3; }
    }
    Socket.prototype.OPEN = 1; window.WebSocket = Socket;
  }, agents);
  await page.goto('/');
  await expect(page.getByTestId('home-want')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.getByTestId('home-want').evaluate(async e => {
    await Promise.all(e.getAnimations().map(a => a.finished));
  });
  return { sent, requests };
}

async function speakerGeometry(page, text) {
  const want = page.getByTestId('home-want'), avatar = want.locator('.home-mood-avatar');
  await expect(want).toHaveAccessibleName('Professor is asking for something');
  await expect(avatar).toHaveAttribute('data-agent-id', 'requester');
  await expect(avatar.locator('svg')).toHaveAttribute('data-hood', 'indigo');
  await expect(avatar.locator('svg')).toHaveAttribute('data-mood', 'sulking');
  await expect(want.locator('.home-want__who')).toHaveText('Profes');
  await expect(want.locator('.home-want__who')).toHaveCSS('color', 'rgb(139, 107, 196)');
  await expect(want.locator('.home-want__who')).toHaveCSS('font-weight', '600');
  for (const selector of ['.home-want__who', '.home-want__text']) {
    await expect(want.locator(selector)).toHaveCSS('font-size', '11.5px');
    await expect(want.locator(selector)).toHaveCSS('font-family', /Inter/);
  }
  await expect(want.locator('.home-want__text')).toHaveCSS('color', 'rgb(237, 237, 237)');
  await expect(want.locator('.home-want__text')).toHaveCSS('font-weight', '400');
  await expect(want.locator('.home-mood-avatar__pip')).toHaveCSS('font-family', '"JetBrains Mono", monospace');
  await expect(want.locator('.home-mood-avatar__pip')).toHaveCSS('font-size', '7.8px');
  await expect(want.locator('.home-mood-avatar__pip')).toHaveCSS('font-weight', '700');
  await expect(want.locator('.home-mood-avatar__pip')).toHaveCSS('color', 'rgb(158, 158, 162)');
  await expect(want).toHaveCount(1);
  await expect(want.getByText(text, { exact: true })).toHaveCount(1);
  if (page.viewportSize().width < 1000) {
    await expect(page.getByText(text, { exact: true })).toHaveCount(1);
  } else {
    // DeskRoster's existing want-priority preview is intentionally a second
    // DOM string. Preserve that clipped status; it is not another full ask.
    const preview = page.getByTestId('desk-roster').getByText(text, { exact: true });
    await expect(preview).toHaveCount(1);
    await expect(preview).toHaveCSS('text-overflow', 'ellipsis');
    expect(await preview.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  }
  await expect(page.locator('.home-bubble')).toHaveCount(0);
  const metrics = await want.evaluate(el => {
    const rect = node => { const r = node.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
    return { want:rect(el), avatar:rect(el.querySelector('.home-mood-avatar')), pip:rect(el.querySelector('.home-mood-avatar__pip')),
      content:rect(el.querySelector('.home-want__content')), sentence:rect(el.querySelector('.home-want__sentence')),
      chips:rect(el.querySelector('.home-want__chips')), whoDisplay:getComputedStyle(el.querySelector('.home-want__who')).display,
      lineHeight:getComputedStyle(el.querySelector('.home-want__sentence')).lineHeight,
      position:getComputedStyle(el).position,
      footer:document.querySelector('.home-thread__band') ? rect(document.querySelector('.home-thread__band')) : null };
  });
  expect(metrics.avatar.width).toBe(20); expect(metrics.avatar.height).toBe(20);
  expect(metrics.pip.width).toBe(15); expect(metrics.pip.height).toBe(15);
  expect(metrics.avatar.x - metrics.want.x).toBeCloseTo(11, 3);
  expect(metrics.avatar.y - metrics.want.y).toBeCloseTo(10, 3);
  expect(metrics.content.x - metrics.avatar.x - metrics.avatar.width).toBeCloseTo(8, 3);
  expect(metrics.chips.x).toBeCloseTo(metrics.content.x, 3);
  expect(metrics.chips.y - metrics.sentence.y - metrics.sentence.height).toBeCloseTo(7, 3);
  expect(metrics.pip.x + metrics.pip.width).toBeLessThan(metrics.content.x);
  expect(metrics.whoDisplay).toBe('inline'); expect(metrics.lineHeight).toBe('15.525px');
  expect(metrics.position).toBe('relative');
  if (metrics.footer) {
    expect(metrics.footer.height).toBe(78);
    expect(metrics.want.y + metrics.want.height).toBeLessThanOrEqual(metrics.footer.y - 7);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
  return metrics;
}

for (const [width, height, answer] of [[390, 844, 'yes'], [390, 590, 'later'], [1440, 900, 'no']]) {
  test(`BUG-189: saved request speaker and existing ${answer} answer at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const { sent, requests } = await household(page);
    await mkdir(testInfo.outputDir, { recursive:true });
    const targetBaseline = await page.getByTestId('home-want').evaluate(el =>
      [...el.querySelectorAll('.home-want__chip')].map(chip => {
        const style = getComputedStyle(chip), target = getComputedStyle(chip, '::after');
        return { label:chip.textContent, height:style.height, minHeight:style.minHeight,
          targetHeight:target.height, top:target.top, bottom:target.bottom };
      }));
    await writeFile(testInfo.outputPath('control-targets.json'), JSON.stringify({ width, height, targets:targetBaseline }, null, 2));
    const metrics = await speakerGeometry(page, requestText);
    if (width > 1000) await expect(page.getByTestId('room-thread').getByTestId('home-want')).toBeVisible();
    const chip = page.getByTestId(`home-want-${answer}`);
    // The existing desktop button reset removes min-height: baseline is22/40;
    // preserve it, while phones retain the24px pill and42px extended target.
    await expect(chip).toHaveCSS('height', width > 1000 ? '22px' : '24px');
    expect(await chip.evaluate(el => getComputedStyle(el, '::after').height)).toBe(width > 1000 ? '40px' : '42px');
    const box = await chip.boundingBox();
    await mkdir(testInfo.outputDir, { recursive: true });
    await page.screenshot({ path: testInfo.outputPath('want-context.png') });
    await page.getByTestId('home-want').screenshot({ path: testInfo.outputPath('want-speaker.png') });
    // Preserve the existing transparent hit area, seven pixels below the pill.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height + 7);
    await expect(page.getByTestId('home-want')).toHaveCount(0);
    expect(sent).toEqual([{ body: { userId:'4242', answer }, userId:'4242' }]);
    expect(requests.some(p => /\/api\/agents\/[^/]+\/(thread|profile)/.test(p))).toBe(false);
    await writeFile(testInfo.outputPath('metrics.json'), JSON.stringify({ width, height, answer, metrics, sent, requests }, null, 2));
  });
}

test('BUG-189: the whole wrapped request survives refusal in reserved short-phone space', async ({ page }, testInfo) => {
  await page.setViewportSize({ width:390, height:590 });
  const text = 'Can I have a beer. It has been rough, and I want a short break before I decide whether to sit down for another hand.';
  const { sent } = await household(page, { text, refuseFirst:true });
  const metrics = await speakerGeometry(page, text);
  expect(metrics.sentence.height).toBeGreaterThan(30);
  await page.getByTestId('home-want-yes').click();
  await expect(page.getByRole('alert')).toHaveText('Could not save your answer. Please try again.');
  await expect(page.getByText(text, { exact:true })).toHaveCount(1);
  await expect(page.getByTestId('home-want').locator('.home-mood-avatar')).toHaveAttribute('data-agent-id', 'requester');
  for (const answer of ['yes', 'later', 'no']) await expect(page.getByTestId(`home-want-${answer}`)).toBeEnabled();
  const alert = await page.getByRole('alert').boundingBox(), band = await page.locator('.home-thread__band').boundingBox();
  expect(alert.y + alert.height).toBeLessThan(band.y);
  await mkdir(testInfo.outputDir, { recursive:true });
  await page.screenshot({ path:testInfo.outputPath('want-refused.png') });
  await page.getByTestId('home-want-no').click();
  await expect(page.getByTestId('home-want')).toHaveCount(0);
  expect(sent.map(s => s.body)).toEqual([{userId:'4242',answer:'yes'}, {userId:'4242',answer:'no'}]);
});
