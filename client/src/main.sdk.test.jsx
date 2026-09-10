import { act } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchMock, telegram } from './test/harness.js';

const location = window.location;
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = '<div id="root"></div>';
  document.querySelectorAll('script[data-railbird-telegram]').forEach(s => s.remove());
  Object.defineProperty(window, 'location', { configurable: true, writable: true,
    value: { ...location, hostname: 'localhost', pathname: '/', search: '', hash: '' } });
  telegram.uninstall();
  fetchMock.route('/api/auth/config', { guest: false, botUsername: '' });
  fetchMock.route('/api/agents', { agents: [] });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: location });
  document.querySelectorAll('script[data-railbird-telegram]').forEach(s => s.remove());
  telegram.install();
});

it('BUG-191: paints the authored loading frame before choosing any owner while the SDK is pending', async () => {
  let entry;
  await act(async () => { entry = await import('./main.jsx'); });
  expect(document.querySelector('.brand-loading')).toHaveTextContent('You don’t play. You raise a player.');
  expect(fetchMock.calls).toHaveLength(0);
  expect(localStorage.getItem('agentic_uid')).toBeNull();
  telegram.install(); telegram.signIn({ id: 9123 });
  await act(async () => {
    document.querySelector('script[data-railbird-telegram]').dispatchEvent(new Event('load'));
    await entry.booted;
  });
  await vi.waitFor(() => expect(document.querySelector('[data-testid="home-screen"]')).not.toBeNull());
  expect(telegram.webApp.readyCalls).toBe(1);
  expect(fetchMock.requestsMatching('/api/agents').every(c => c.url.includes('userId=9123'))).toBe(true);
  expect(fetchMock.posts.filter(c => c.url.includes('/api/guest'))).toHaveLength(0);
});

it('BUG-191: a late Mini App credential still outranks an existing web login', async () => {
  localStorage.setItem('agentic_tg_login', JSON.stringify({ id: 4242, hash: 'saved-web-fixture' }));
  let entry;
  await act(async () => { entry = await import('./main.jsx'); });
  expect(fetchMock.calls).toHaveLength(0);
  telegram.install(); telegram.signIn({ id: 9123 });
  await act(async () => {
    document.querySelector('script[data-railbird-telegram]').dispatchEvent(new Event('load'));
    await entry.booted;
  });
  await vi.waitFor(() => expect(fetchMock.requestsMatching('/api/agents').length).toBeGreaterThan(0));
  expect(fetchMock.requestsMatching('/api/agents').every(c => c.url.includes('userId=9123'))).toBe(true);
  expect(fetchMock.requestsMatching('/api/auth/me')).toHaveLength(0);
});

it('BUG-191: a settled SDK network failure keeps the original guest-disabled entry decision', async () => {
  fetchMock.route('/api/auth/me', { status: 401, body: {} });
  let entry;
  await act(async () => { entry = await import('./main.jsx'); });
  expect(fetchMock.calls).toHaveLength(0);
  await act(async () => {
    document.querySelector('script[data-railbird-telegram]').dispatchEvent(new Event('error'));
    await entry.booted;
  });
  await vi.waitFor(() => expect(document.querySelector('.ftu-login')).not.toBeNull());
  expect(fetchMock.requestsMatching('/api/auth/config').length).toBeGreaterThan(0);
  expect(fetchMock.posts.filter(c => c.url.includes('/api/guest'))).toHaveLength(0);
});
