import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

const invitation = '0123456789abcdefghijklmnopqrstuv';
const sdkBody = owner => `window.Telegram={WebApp:{initData:${JSON.stringify(owner ? 'synthetic-mini-credential' : '')},initDataUnsafe:${JSON.stringify(owner ? { user: { id: Number(owner), first_name: 'Synthetic' } } : {})},get viewportHeight(){return innerHeight},ready(){},expand(){},disableVerticalSwipes(){},onEvent(){},offEvent(){}}};`;
const cases = [
  { name: 'Mini App beats saved web login', owner: '9123', mini: true, saved: true, width: 390, height: 844 },
  { name: 'short Mini App', owner: '9123', mini: true, width: 390, height: 590 },
  { name: 'desktop Mini App', owner: '9123', mini: true, width: 1440, height: 900 },
  { name: 'saved web login', owner: '4242', saved: true },
  { name: 'returning guest visit', owner: 'g_191', guest: true, returning: true, visit: true },
  { name: 'new guest invitation', owner: 'g_191', guest: true, visit: true },
  { name: 'guest disabled', owner: null },
  { name: 'SDK network failure with guests disabled', owner: null, failure: true },
];

for (const scenario of cases) test(`BUG-191: loading before delayed SDK and correct ${scenario.name}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: scenario.width ?? 390, height: scenario.height ?? 844 });
  const requests = [], pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  let release, sdkStarted = false;
  const wait = new Promise(resolve => { release = resolve; });
  await page.route('https://telegram.org/js/telegram-web-app.js', async route => {
    sdkStarted = true;
    await wait;
    if (scenario.failure) return route.abort('failed');
    await route.fulfill({ contentType: 'application/javascript', body: sdkBody(scenario.mini ? scenario.owner : null) });
  });
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname;
    requests.push({ path: p, url: request.url(), method: request.method(), headers: request.headers(), body: request.postDataJSON() });
    if (p === '/api/auth/me') return route.fulfill({ status: scenario.saved ? 200 : 401, json: scenario.saved ? { id: 4242 } : {} });
    if (p === '/api/guest/me') return route.fulfill({ status: scenario.returning ? 200 : 404, json: scenario.returning ? { ownerId: scenario.owner } : {} });
    const json = p === '/api/auth/config' ? { guest: !!scenario.guest, botUsername: '' }
      : p === '/api/guest' ? { ownerId: scenario.owner, visitInvitationAccepted: true }
      : p === `/api/visit-invites/${invitation}` ? { agentId: 'agent_friend191', agentName: 'Away Day' }
      : p === '/api/agents/agent_friend191/visit' ? { visitId: 'visit191' }
      : p === '/api/agents' ? { agents: [] }
      : p === '/api/wallet' ? { balance: 8000, staked: 0, ledger: [] }
      : p === '/api/slots' ? { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } }
      : p === '/api/rooms' ? { rooms: [], hotWindowMs: 20000 }
      : p.endsWith('/thread') ? { sessionId: 'startup191', lines: [], count: 0 }
      : { events: [], lastId: 0, items: [] };
    await route.fulfill({ json });
  });
  await page.addInitScript(({ saved }) => {
    if (saved) localStorage.setItem('agentic_tg_login', JSON.stringify({ id: 4242, first_name: 'Web', hash: 'saved-web-fixture' }));
    class Socket {
      static OPEN = 1;
      constructor() { this.readyState = 0; this.listeners = {}; setTimeout(() => { this.readyState = 1; this.emit('open', {}); }, 20); }
      emit(type, event) { for (const fn of this.listeners[type] ?? []) fn(event); }
      addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
      removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(f => f !== fn); }
      send(raw) {
        if (JSON.parse(raw).type === 'floor_sub') {
          const userId = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? JSON.parse(localStorage.getItem('agentic_tg_login') || 'null')?.id ?? localStorage.getItem('agentic_guest_owner'));
          this.emit('message', { data: JSON.stringify({ type: 'home_state', userId, agents: [], game: null }) });
        }
      }
      close() { this.readyState = 3; }
    }
    Socket.prototype.OPEN = 1; window.WebSocket = Socket;
  }, { saved: scenario.saved });
  try {
    // commit deliberately does not wait for a parser-blocking baseline script.
    await page.goto('/' + (scenario.visit ? `?visit=${invitation}` : ''), { waitUntil: 'commit' });
    const loading = page.getByRole('status', { name: 'Loading Railbird' });
    await expect(loading).toBeVisible();
    await expect(loading).toContainText('You don’t play. You raise a player.');
    expect(sdkStarted).toBe(true);
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('agentic_uid'))).toBeNull();
    await expect.poll(() => page.evaluate(() => performance.getEntriesByType('paint').length)).toBeGreaterThan(0);
    await page.evaluate(() => document.fonts.ready);
    await fs.mkdir(testInfo.outputDir, { recursive: true });
    await page.screenshot({ path: testInfo.outputPath('41-B12-loading.png'), animations: 'disabled' });
    const pendingMetrics = await page.evaluate(() => ({ paint: performance.getEntriesByType('paint').map(p => ({ name: p.name, start: p.startTime })), beforeRelease: performance.now(), overflow: document.documentElement.scrollWidth > innerWidth }));
    expect(pendingMetrics.overflow).toBe(false);
    release();
    if (scenario.guest && !scenario.returning) {
      await expect(page.getByRole('heading', { name: 'Away Day is at your door.' })).toBeVisible();
      const mint = requests.filter(r => r.path === '/api/guest' && r.method === 'POST');
      expect(mint).toHaveLength(1);
      expect(mint[0].body).toEqual({ visitInvitationToken: invitation });
    } else if (!scenario.owner) {
      await expect(page.locator('.ftu-login')).toBeVisible();
      expect(requests.filter(r => r.path === '/api/guest' && r.method === 'POST')).toEqual([]);
      expect(requests.filter(r => r.path === '/api/agents')).toEqual([]);
    } else {
      await expect(page.getByTestId('home-screen')).toBeVisible();
      const roster = requests.filter(r => r.path === '/api/agents');
      expect(roster.length).toBeGreaterThan(0);
      expect(roster.every(r => new URL(r.url).searchParams.get('userId') === scenario.owner)).toBe(true);
      expect(requests.filter(r => r.path === '/api/guest' && r.method === 'POST')).toEqual([]);
      if (scenario.mini) expect(roster.every(r => r.headers['x-telegram-init-data'] === 'synthetic-mini-credential')).toBe(true);
      if (scenario.saved && !scenario.mini) expect(roster.every(r => r.headers['x-telegram-init-data'].includes('id=4242'))).toBe(true);
      if (scenario.returning) {
        await expect.poll(() => requests.filter(r => r.path.endsWith('/visit') && r.method === 'POST').length).toBe(1);
        expect(requests.find(r => r.path.endsWith('/visit')).body).toEqual({ hostUserId: scenario.owner, stake: 0, invitationToken: invitation });
      }
    }
    await expect(loading).toHaveCount(0);
    expect(pageErrors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('settled-entry.png') });
    await fs.writeFile(testInfo.outputPath('timing.json'), JSON.stringify({ scenario: scenario.name, pendingMetrics, requests: requests.map(({ headers, ...r }) => r) }, null, 2));
  } finally { release(); }
});
