// client/src/lib/telegram.test.jsx — TEST-1
//
// telegram.js is the whole boundary between the app and the Telegram SDK.
// Every helper has to survive being called outside Telegram, because that is
// how the app is opened in a browser during development — and because the
// LAND-2 guard depends on the no-initData case being detectable.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  getTelegramDisplayName,
  getTelegramInitData,
  getTelegramUser,
  getUserId,
  getWebApp,
  initTelegram,
  initViewportTracking,
  isInTelegram,
} from './telegram.js';
import { telegram } from '../test/harness.js';

describe('telegram helpers outside Telegram', () => {
  beforeEach(() => { telegram.uninstall(); });

  // getWebApp returns undefined here rather than null (optional chaining on a
  // missing window.Telegram). Every caller tests it with `!tg` or `!= null`,
  // so what matters is that it is nullish and isInTelegram says false.
  it('getWebApp is nullish and isInTelegram is false', () => {
    expect(getWebApp() ?? null).toBeNull();
    expect(isInTelegram()).toBe(false);
  });

  it('initTelegram is a no-op rather than a crash', () => {
    expect(initTelegram()).toBeNull();
  });

  it('there is no user and no display name', () => {
    expect(getTelegramUser()).toBeNull();
    expect(getTelegramDisplayName()).toBe('');
  });

  it('getTelegramInitData is the empty string', () => {
    expect(getTelegramInitData()).toBe('');
  });

  it('getUserId falls back to a localStorage id that is stable per browser', () => {
    localStorage.clear();
    const first = getUserId();
    expect(first).toMatch(/^u_/);
    expect(getUserId()).toBe(first);
    expect(localStorage.getItem('agentic_uid')).toBe(first);
  });
});

describe('telegram helpers inside Telegram', () => {
  beforeEach(() => { telegram.signIn({ id: 4242, first_name: 'Jens', username: 'jens' }); });

  it('initTelegram readies, expands and disables the vertical swipe gesture', () => {
    const tg = initTelegram();
    expect(tg).toBe(telegram.webApp);
    expect(tg.readyCalls).toBe(1);
    expect(tg.expandCalls).toBe(1);
    // Without this the sheet drag in WatchScreen is eaten by Telegram's own
    // "minimize the Mini App" gesture.
    expect(tg.disableVerticalSwipesCalls).toBe(1);
  });

  it('reads the user, the display name and the raw initData', () => {
    expect(getTelegramUser()).toMatchObject({ id: 4242, first_name: 'Jens' });
    expect(getTelegramDisplayName()).toBe('Jens');
    expect(getTelegramInitData()).toContain('hash=');
  });

  it('prefers the Telegram id over the localStorage fallback', () => {
    localStorage.setItem('agentic_uid', 'u_local_fallback');
    expect(getUserId()).toBe('4242');
  });

  it('falls back to the username when there is no first name', () => {
    telegram.webApp.initDataUnsafe = { user: { id: 7, username: 'nofirst' } };
    expect(getTelegramDisplayName()).toBe('nofirst');
  });
});

// KEY-1. Telegram shrinks viewportHeight when the iOS keyboard opens and fires
// viewportChanged. Every keyboard-aware container is height: var(--tg-h), so
// if this tracking breaks the composer disappears behind the keyboard.
describe('initViewportTracking (KEY-1)', () => {
  const tgH = () => document.documentElement.style.getPropertyValue('--tg-h');

  beforeEach(() => { telegram.signIn(); });

  it('writes the current viewport height on the first call', () => {
    telegram.webApp.viewportHeight = 800;
    const stop = initViewportTracking();
    expect(tgH()).toBe('800px');
    stop();
  });

  it('updates --tg-h when Telegram fires viewportChanged', () => {
    const stop = initViewportTracking();
    telegram.setViewportHeight(412);
    expect(tgH()).toBe('412px');
    telegram.setViewportHeight(731);
    expect(tgH()).toBe('731px');
    stop();
  });

  it('rounds fractional heights to whole pixels', () => {
    const stop = initViewportTracking();
    telegram.setViewportHeight(645.6);
    expect(tgH()).toBe('646px');
    stop();
  });

  it('unsubscribes on cleanup so a remount does not stack listeners', () => {
    const stop = initViewportTracking();
    expect(telegram.listenerCount('viewportChanged')).toBe(1);
    stop();
    expect(telegram.listenerCount('viewportChanged')).toBe(0);
  });

  it('leaves --tg-h unset outside Telegram so the CSS 100dvh fallback wins', () => {
    telegram.uninstall();
    const stop = initViewportTracking();
    expect(tgH()).toBe('');
    stop();
  });
});
