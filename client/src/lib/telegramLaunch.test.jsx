import { afterEach, beforeEach, expect, it } from 'vitest';
import { hasTelegramLaunchSignal } from './telegramLaunch.js';

// BUG-191/187. This decides one thing: whether waiting for telegram.org can
// still change who the owner is. A false positive costs a wait nobody notices;
// a false negative would open a door before the credential arrived, so every
// place the SDK reads its launch params from is read here too.

const location = window.location;
const at = ({ hash = '', search = '' } = {}) =>
  Object.defineProperty(window, 'location', { configurable: true, writable: true,
    value: { ...location, hostname: 'localhost', pathname: '/', hash, search } });

beforeEach(() => { at(); sessionStorage.clear(); delete window.TelegramWebviewProxy; });
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: location });
  sessionStorage.clear();
  delete window.TelegramWebviewProxy;
});

it('BUG-191: an ordinary browser tab carries no Telegram signal', () => {
  expect(hasTelegramLaunchSignal()).toBe(false);
  at({ search: '?visit=0123456789abcdefghijklmnopqrstuv', hash: '#anything' });
  expect(hasTelegramLaunchSignal()).toBe(false);
});

it('BUG-191: the launch fragment Telegram appends is a signal', () => {
  at({ hash: '#tgWebAppData=user%3D%257B%2522id%2522%253A9123%257D&tgWebAppVersion=7.0' });
  expect(hasTelegramLaunchSignal()).toBe(true);
  at({ hash: '#tgWebAppPlatform=tdesktop' });
  expect(hasTelegramLaunchSignal()).toBe(true);
});

it('BUG-191: a start param carried on the query is a signal too', () => {
  at({ search: '?tgWebAppStartParam=visit_abc' });
  expect(hasTelegramLaunchSignal()).toBe(true);
});

it('BUG-191: the SDK stored copy still answers after a reload has lost the fragment', () => {
  sessionStorage.setItem('__telegram__initParams', JSON.stringify({ tgWebAppData: 'user%3D1', tgWebAppVersion: '7.0' }));
  expect(hasTelegramLaunchSignal()).toBe(true);
});

it('BUG-191: an unrelated stored blob is not a signal', () => {
  sessionStorage.setItem('__telegram__initParams', JSON.stringify({ somethingElse: 1 }));
  expect(hasTelegramLaunchSignal()).toBe(false);
});

it('BUG-191: the native client bridge is a signal on its own', () => {
  window.TelegramWebviewProxy = { postEvent() {} };
  expect(hasTelegramLaunchSignal()).toBe(true);
});
