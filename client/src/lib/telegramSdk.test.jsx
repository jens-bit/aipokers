import { beforeEach, expect, it, vi } from 'vitest';
import { telegram } from '../test/harness.js';
beforeEach(() => {
  vi.resetModules();
  document.querySelectorAll('script[data-railbird-telegram]').forEach(s => s.remove());
});

it('BUG-191: an already loaded SDK preserves the synchronous credential decision without another request', async () => {
  const { loadTelegramSdk } = await import('./telegramSdk.js');
  expect(loadTelegramSdk()).toBeNull();
  expect(document.querySelectorAll('script[data-railbird-telegram]')).toHaveLength(0);
});

it.each(['load', 'error'])('BUG-191: one shared async script waits for actual %s settlement', async (event) => {
  telegram.uninstall();
  const { loadTelegramSdk } = await import('./telegramSdk.js');
  const first = loadTelegramSdk();
  expect(loadTelegramSdk()).toBe(first);
  const scripts = document.querySelectorAll('script[data-railbird-telegram]');
  expect(scripts).toHaveLength(1);
  expect(scripts[0].async).toBe(true);
  expect(scripts[0].src).toBe('https://telegram.org/js/telegram-web-app.js');
  let settled = false;
  first.then(() => { settled = true; });
  await Promise.resolve();
  expect(settled).toBe(false);
  scripts[0].dispatchEvent(new Event(event));
  await first;
  expect(settled).toBe(true);
  expect(scripts[0].dataset.railbirdTelegram).toBe('settled');
  vi.resetModules();
  expect((await import('./telegramSdk.js')).loadTelegramSdk()).toBeNull();
  expect(document.querySelectorAll('script[data-railbird-telegram]')).toHaveLength(1);
});

it('BUG-191: a module reload adopts a pending script instead of duplicating or bypassing it', async () => {
  telegram.uninstall();
  const first = (await import('./telegramSdk.js')).loadTelegramSdk();
  vi.resetModules();
  const second = (await import('./telegramSdk.js')).loadTelegramSdk();
  let settled = false;
  second.then(() => { settled = true; });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(document.querySelectorAll('script[data-railbird-telegram]')).toHaveLength(1);
  document.querySelector('script[data-railbird-telegram]').dispatchEvent(new Event('load'));
  await Promise.all([first, second]);
  expect(settled).toBe(true);
});
