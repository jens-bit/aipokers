import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const requestText = 'Can I have a beer. It has been rough.';
async function household(page, { visitor = false } = {}) {
  const agent = { id: 'requester', name: 'Professor', nature: { name: 'Professor' },
    mood: { state: 'neutral', heat: 30 }, identity: { hood: 'indigo', glow: 'violet' },
    fatigue: 'fresh', location: { where: 'home' }, routine: { key: 'paces', label: 'pacing' },
    opener: 'The house never folds. Fine by me.', unseenRecap: false,
    pocket: { balance: 2000 }, stats: { handsPlayed: 0 }, sessionLog: [],
    want: { kind: 'beer', text: requestText, dangerous: false } };
  const sent = [];
  await page.route('https://telegram.org/**', r => r.fulfill({ body: '', contentType: 'application/javascript' }));
  await page.route('**/api/**', r => {
    const url = new URL(r.request().url());
    if (url.pathname === '/api/agents/requester/want' && r.request().method() === 'POST') {
      sent.push({ body: r.request().postDataJSON(), userId: url.searchParams.get('userId'),
        auth: r.request().headers()['x-telegram-init-data'] });
      agent.want = null;
      return r.fulfill({ json: { answered: sent.at(-1).body.answer, want: null } });
    }
    const json = url.pathname === '/api/agents' ? { agents: [agent] }
      : url.pathname === '/api/wallet' ? { balance: 54000, ledger: [] }
      : url.pathname === '/api/slots' ? { used: 1, cap: 4, next: null }
      : url.pathname.includes('/thread') ? { sessionId: 'today', lines: [], count: 0 }
      : url.pathname.includes('/study') ? { study: null, book: [], count: 0 }
      : { rooms: [], events: [], items: [], lastId: 0 };
    return r.fulfill({ json });
  });
  await page.addInitScript(({ agent, visitor }) => {
    window.Telegram = { WebApp: {
      initData: 'user=%7B%22id%22%3A4242%7D&auth_date=1756900000&hash=deadbeef',
      initDataUnsafe: { user: { id: 4242 } }, get viewportHeight() { return innerHeight; },
      ready() {}, expand() {}, disableVerticalSwipes() {}, onEvent() {}, offEvent() {},
    } };
    class Socket {
      static OPEN = 1;
      constructor() { this.readyState = 0; this.listeners = {};
        setTimeout(() => { this.readyState = 1; this.emit('open', {}); }, 20); }
      emit(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      send(raw) { if (JSON.parse(raw).type === 'floor_sub') this.emit('message', {
        data: JSON.stringify({ type: 'home_state', userId: '4242', agents: [agent], game: null,
          visitor: visitor ? { id: 'visiting', agentName: 'Away Day' } : null }),
      }); }
      close() { this.readyState = 3; }
    }
    Socket.prototype.OPEN = 1; window.WebSocket = Socket;
  }, { agent, visitor });
  await page.goto('/');
  await expect(page.getByTestId(visitor ? 'home-visitor' : 'home-want')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return sent;
}

test('BUG-186: the separately authored visitor controls retain their existing typography', async ({ page }) => {
  await household(page, { visitor: true });
  const visitor = page.getByTestId('home-visitor');
  for (const name of ['home-visitor-accept', 'home-visitor-decline']) {
    const chip = visitor.getByTestId(name);
    await expect(chip).toHaveCSS('font-family', /Inter/);
    await expect(chip).toHaveCSS('letter-spacing', 'normal');
    await expect(chip).toHaveCSS('text-transform', 'none');
  }
});

for (const height of [844, 590]) for (const answer of ['yes', 'later', 'no']) {
  test(`BUG-186: F11 ${answer} lettering and extended target post once at 390x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height });
    const sent = await household(page);
    const want = page.getByTestId('home-want');
    await want.evaluate(async e => { await Promise.all(e.getAnimations().map(a => a.finished)); });
    await expect(page.getByText(requestText, { exact: true })).toHaveCount(1);
    await expect(page.locator('.home-bubble')).toHaveCount(0);
    for (const [id, color] of [['yes', 'rgb(0, 212, 170)'], ['later', 'rgb(161, 161, 161)'], ['no', 'rgb(255, 107, 109)']]) {
      const chip = page.getByTestId(`home-want-${id}`);
      const actual = await chip.evaluate(e => { const s = getComputedStyle(e), target = getComputedStyle(e, '::after');
        return { font: s.fontFamily, fontSize: s.fontSize, weight: s.fontWeight,
          tracking: s.letterSpacing, transform: s.textTransform, color: s.color,
          visualHeight: e.getBoundingClientRect().height, computedHeight: s.height, targetHeight: target.height }; });
      expect.soft(actual.font).toMatch(/Oswald/);
      expect.soft(actual).toMatchObject({ fontSize: '8.5px', weight: '600', tracking: '0.85px', transform: 'uppercase',
        color, computedHeight: '24px', targetHeight: '42px' });
      // Chromium's transformed bounds can differ by 0.00003px; CSS height is
      // still exact above and physical bounds stay within a thousandth pixel.
      expect(actual.visualHeight).toBeCloseTo(24, 3);
      // Pseudo-element height excludes the button's two border pixels:
      // 22px padding box + 10px each way = 42px; preserve actual hit geometry.
      const extension = await chip.evaluate(e => { const s = getComputedStyle(e, '::after');
        return { top: s.top, bottom: s.bottom }; });
      expect(extension).toEqual({ top: '-10px', bottom: '-10px' });
    }
    await mkdir(testInfo.outputDir, { recursive: true });
    const targets = await want.evaluate(el => [...el.querySelectorAll('.home-want__chip')].map(chip => {
      const r = chip.getBoundingClientRect(), s = getComputedStyle(chip), p = getComputedStyle(chip, '::after');
      const x = r.x + parseFloat(s.borderLeftWidth) + parseFloat(p.left);
      const y = r.y + parseFloat(s.borderTopWidth) + parseFloat(p.top);
      const width = parseFloat(p.width), height = parseFloat(p.height);
      const hits = (px, py) => document.elementFromPoint(px, py)?.closest('.home-want__chip') === chip;
      return { id: chip.dataset.testid, visual: { x: r.x, y: r.y, width: r.width, height: r.height },
        target: { x, y, width, height },
        boundary: { border: s.borderLeftWidth, afterLeft: p.left, afterTop: p.top,
          x: Array.from({ length: 17 }, (_, i) => ({ offset: (i - 8) / 4, hit: hits(x + (i - 8) / 4, y + height / 2) })),
          y: Array.from({ length: 17 }, (_, i) => ({ offset: (i - 8) / 4, hit: hits(x + width / 2, y + (i - 8) / 4) })) },
        // Chromium includes points up to one pixel before the top/left edge
        // in elementFromPoint. Record the quarter-pixel scan above; check
        // outside beyond that observed raster hit-test fringe, not at -0.5px.
        probes: { topInside: hits(x + width / 2, y + .5), topOutside: hits(x + width / 2, y - 1.25),
          bottomInside: hits(x + width / 2, y + height - .5), bottomOutside: hits(x + width / 2, y + height + 1.25),
          leftInside: hits(x + .5, y + height / 2), leftOutside: hits(x - 1.25, y + height / 2),
          rightInside: hits(x + width - .5, y + height / 2), rightOutside: hits(x + width + 1.25, y + height / 2) } };
    }));
    const gaps = targets.slice(1).map((chip, i) => chip.target.x - targets[i].target.x - targets[i].target.width);
    await writeFile(testInfo.outputPath('hit-bounds.json'), JSON.stringify({ height, answer, targets, gaps }, null, 2));
    for (const chip of targets) expect(chip.probes).toEqual({ topInside: true, topOutside: false,
      bottomInside: true, bottomOutside: false, leftInside: true, leftOutside: false, rightInside: true, rightOutside: false });
    for (const gap of gaps) expect(gap).toBeGreaterThan(0);
    for (const [index, gap] of gaps.entries()) {
      const left = targets[index].target;
      const gapHitsChip = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.home-want__chip'),
        { x: left.x + left.width + gap / 2, y: left.y + left.height / 2 });
      expect(gapHitsChip).toBe(false);
    }
    await page.screenshot({ path: testInfo.outputPath('29-F11.png') });
    await want.screenshot({ path: testInfo.outputPath('29-F11-want.png') });
    await page.getByTestId(`home-want-${answer}`).screenshot({ path: testInfo.outputPath(`29-F11-${answer}.png`) });
    const box = await page.getByTestId(`home-want-${answer}`).boundingBox();
    expect(box.y + box.height + 7).toBeLessThan(height);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height + 7);
    await expect(want).toHaveCount(0);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ body: { userId: '4242', answer }, userId: '4242', auth: expect.any(String) });
    expect(sent[0].auth).toContain('user=');
  });
}
