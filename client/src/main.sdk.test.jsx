import { act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchMock, telegram } from './test/harness.js';

// BUG-191/187 — WHAT THIS FILE NOW ENCODES, AND WHAT CHANGED.
//
// The rule used to be absolute: no request and no owner decision before the
// external SDK settled, in every window. It cost every entry the cold cost of
// reaching telegram.org — a little under three seconds — including windows
// Telegram had never opened, which were waiting to be told something their own
// URL already said. That rule is deliberately replaced here, not loosened:
//
//   · A window carrying a Telegram launch signal keeps it EXACTLY. No request,
//     no owner, no minted id until the real SDK has settled. (cases 1 and 2)
//   · A window carrying none takes its own door at once, because no external
//     script can turn it into a Mini App session. (case 4)
//   · The credential ORDER is untouched: a real Mini App credential that turns
//     up late still outranks a door already opened without one. (cases 2 and 3)
//   · Minting a guest still waits for the actual settlement in every window.
//     That is the one irreversible step and it never moved. (cases 6 and 7)

const location = window.location;
const MINI_APP_LAUNCH = '#tgWebAppData=user%3D%257B%2522id%2522%253A9123%257D&tgWebAppVersion=7.0&tgWebAppPlatform=android';

const at = (hash = '') => Object.defineProperty(window, 'location', { configurable: true, writable: true,
  value: { ...location, hostname: 'localhost', pathname: '/', search: '', hash } });

// The fetch stub matches by substring, and '/api/guest' is a prefix of
// '/api/guest/me'. The guest cases below need the two apart, so they say so.
const exactly = (path) => ({ url }) => url === path;

const sdkScript = () => document.querySelector('script[data-railbird-telegram]');
const settleSdk = (event = 'load') => sdkScript().dispatchEvent(new Event(event));

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  document.querySelectorAll('script[data-railbird-telegram]').forEach(s => s.remove());
  at();
  telegram.uninstall();
  fetchMock.route('/api/auth/config', { guest: false, botUsername: '' });
  fetchMock.route('/api/agents', { agents: [] });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: location });
  document.querySelectorAll('script[data-railbird-telegram]').forEach(s => s.remove());
  telegram.install();
});

it('BUG-191: a Telegram launch paints the authored loading frame and chooses no owner while the SDK is pending', async () => {
  at(MINI_APP_LAUNCH);
  let entry;
  await act(async () => { entry = await import('./main.jsx'); });
  expect(document.querySelector('.brand-loading')).toHaveTextContent('You don’t play. You raise a player.');
  expect(fetchMock.calls).toHaveLength(0);
  expect(localStorage.getItem('agentic_uid')).toBeNull();
  telegram.install(); telegram.signIn({ id: 9123 });
  await act(async () => { settleSdk(); await entry.booted; });
  await vi.waitFor(() => expect(document.querySelector('[data-testid="home-screen"]')).not.toBeNull());
  expect(telegram.webApp.readyCalls).toBe(1);
  expect(fetchMock.requestsMatching('/api/agents').every(c => c.url.includes('userId=9123'))).toBe(true);
  expect(fetchMock.posts.filter(c => c.url.includes('/api/guest'))).toHaveLength(0);
});

it('BUG-191: a late Mini App credential still outranks an existing web login', async () => {
  at(MINI_APP_LAUNCH);
  localStorage.setItem('agentic_tg_login', JSON.stringify({ id: 4242, hash: 'saved-web-fixture' }));
  let entry;
  await act(async () => { entry = await import('./main.jsx'); });
  expect(fetchMock.calls).toHaveLength(0);
  telegram.install(); telegram.signIn({ id: 9123 });
  await act(async () => { settleSdk(); await entry.booted; });
  await vi.waitFor(() => expect(fetchMock.requestsMatching('/api/agents').length).toBeGreaterThan(0));
  expect(fetchMock.requestsMatching('/api/agents').every(c => c.url.includes('userId=9123'))).toBe(true);
  expect(fetchMock.requestsMatching('/api/auth/me')).toHaveLength(0);
});

it('BUG-191: a Mini App credential that arrives after an unsignalled door still takes the room', async () => {
  fetchMock.route('/api/auth/me', { id: 4242 });
  localStorage.setItem('agentic_tg_login', JSON.stringify({ id: 4242, hash: 'saved-web-fixture' }));
  let entry;
  await act(async () => { entry = await import('./main.jsx'); await entry.booted; });
  // No launch signal: the saved login opened its own door without waiting.
  await vi.waitFor(() => expect(fetchMock.requestsMatching('/api/agents').length).toBeGreaterThan(0));
  expect(fetchMock.requestsMatching('/api/agents').every(c => c.url.includes('userId=4242'))).toBe(true);
  // The SDK settles into a real Mini App session anyway. It outranks the door.
  telegram.install(); telegram.signIn({ id: 9123 });
  await act(async () => { settleSdk(); await Promise.resolve(); });
  await vi.waitFor(() => expect(fetchMock.requestsMatching('/api/agents').some(c => c.url.includes('userId=9123'))).toBe(true));
  expect(telegram.webApp.readyCalls).toBe(1);
});

it('BUG-191/187: a window Telegram never opened reaches its door without waiting for telegram.org', async () => {
  let entry;
  await act(async () => { entry = await import('./main.jsx'); await entry.booted; });
  await vi.waitFor(() => expect(document.querySelector('.ftu-login')).not.toBeNull());
  // The external request is still in flight — the door did not wait for it.
  expect(sdkScript().dataset.railbirdTelegram).toBe('pending');
  expect(fetchMock.requestsMatching('/api/auth/config').length).toBeGreaterThan(0);
  expect(fetchMock.posts.filter(c => c.url.includes('/api/guest'))).toHaveLength(0);
});

it('BUG-191: a settled SDK network failure keeps the original guest-disabled entry decision', async () => {
  fetchMock.route('/api/auth/me', { status: 401, body: {} });
  let entry;
  await act(async () => { entry = await import('./main.jsx'); await entry.booted; });
  await vi.waitFor(() => expect(document.querySelector('.ftu-login')).not.toBeNull());
  await act(async () => { settleSdk('error'); await Promise.resolve(); });
  expect(document.querySelector('.ftu-login')).not.toBeNull();
  expect(fetchMock.requestsMatching('/api/auth/config').length).toBeGreaterThan(0);
  expect(fetchMock.posts.filter(c => c.url.includes('/api/guest'))).toHaveLength(0);
});

it('BUG-191: a pending SDK still cannot mint a guest, signal or no signal', async () => {
  fetchMock.route('/api/auth/config', { guest: true, botUsername: '' });
  fetchMock.route(exactly('/api/guest/me'), { status: 404, body: {} });
  fetchMock.route(exactly('/api/guest'), { ownerId: 'g_191' });
  let entry;
  await act(async () => { entry = await import('./main.jsx'); await Promise.resolve(); });
  await vi.waitFor(() => expect(fetchMock.requestsMatching('/api/auth/config').length).toBeGreaterThan(0));
  expect(fetchMock.posts.filter(c => c.url.includes('/api/guest'))).toHaveLength(0);
  await act(async () => { settleSdk(); await entry.booted; });
  await vi.waitFor(() => expect(fetchMock.posts.filter(c => c.url === '/api/guest')).toHaveLength(1));
});

it('BUG-191: a Mini App credential that lands before the mint spares the guest entirely', async () => {
  fetchMock.route('/api/auth/config', { guest: true, botUsername: '' });
  fetchMock.route(exactly('/api/guest/me'), { status: 404, body: {} });
  fetchMock.route(exactly('/api/guest'), { ownerId: 'g_191' });
  let entry;
  await act(async () => { entry = await import('./main.jsx'); await Promise.resolve(); });
  telegram.install(); telegram.signIn({ id: 9123 });
  // Only what this boot asks for AFTER the credential lands is this case's
  // business: a root mounted by an earlier case in this file is still polling.
  const before = fetchMock.requestsMatching('/api/agents').length;
  await act(async () => { settleSdk(); await entry.booted; });
  await vi.waitFor(() => expect(document.querySelector('[data-testid="home-screen"]')).not.toBeNull());
  expect(fetchMock.posts.filter(c => c.url === '/api/guest')).toHaveLength(0);
  const after = fetchMock.requestsMatching('/api/agents').slice(before);
  expect(after.length).toBeGreaterThan(0);
  expect(after.every(c => c.url.includes('userId=9123'))).toBe(true);
});
