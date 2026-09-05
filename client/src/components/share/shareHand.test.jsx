// SHARE-1 — which way the card leaves the app.
//
// Four routes, and the order between them is the product decision: the picture
// itself beats a handoff to the bot, and a handoff beats a file in a folder.
// Each test below pins one rung of that ladder and what happens when it breaks.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { inlineQuery, savePng, shareHand } from './shareHand.js';
import { buildShareModel, shareCaption } from './shareModel.js';
import { badBeatHand } from '../../test/fixtures/flagged.js';

const model = buildShareModel(badBeatHand, { agentName: 'Aggressive v1.3', mood: 'tilted' });
const png = new Blob(['not really a png'], { type: 'image/png' });

// A navigator that can do everything, then taken apart per test.
function fullNav({ share = vi.fn().mockResolvedValue(undefined), canShare = () => true } = {}) {
  return { share, canShare, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } };
}

function telegramWebApp() {
  return { shareMessage: vi.fn(), switchInlineQuery: vi.fn() };
}

let clicked;

beforeEach(() => {
  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clicked.push({ download: this.download, href: this.href });
  });
  URL.createObjectURL = vi.fn(() => 'blob:card');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete URL.createObjectURL;
  delete URL.revokeObjectURL;
});

describe('shareHand — the picture itself', () => {
  it('puts the PNG in the OS share sheet when the browser will take a file', async () => {
    const nav = fullNav();
    const via = await shareHand({ model, png, nav, webApp: telegramWebApp() });

    expect(via).toBe('web-share');
    const [{ files, text }] = nav.share.mock.calls[0];
    expect(files[0].name).toBe('agenticpoker-aggressive-v1-3-37.png');
    expect(files[0].type).toBe('image/png');
    expect(text).toBe(shareCaption(model));
  });

  it('does nothing else when the user backs out of the sheet', async () => {
    const nav = fullNav({ share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) });
    const webApp = telegramWebApp();

    expect(await shareHand({ model, png, nav, webApp })).toBe('none');
    expect(webApp.switchInlineQuery).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(0);
  });

  it('falls through when the sheet could not open at all', async () => {
    const nav = fullNav({ share: vi.fn().mockRejectedValue(new Error('no share target')) });
    const webApp = telegramWebApp();

    expect(await shareHand({ model, png, nav, webApp })).toBe('telegram-inline');
  });
});

describe('shareHand — Telegram', () => {
  const noFiles = () => ({ canShare: () => false, share: vi.fn(), clipboard: { writeText: vi.fn() } });

  it('uses a bot-prepared message when one exists', async () => {
    const webApp = telegramWebApp();
    const via = await shareHand({ model, png, nav: noFiles(), webApp, preparedMessageId: 'prep_1' });

    expect(via).toBe('telegram-prepared');
    expect(webApp.shareMessage).toHaveBeenCalledWith('prep_1');
    expect(webApp.switchInlineQuery).not.toHaveBeenCalled();
  });

  it('otherwise opens the chat picker with the hand named for the bot', async () => {
    const webApp = telegramWebApp();
    const via = await shareHand({ model, png, nav: noFiles(), webApp });

    expect(via).toBe('telegram-inline');
    expect(webApp.switchInlineQuery).toHaveBeenCalledWith('hand 37', ['users', 'groups', 'channels']);
  });

  it('names the hand, or the agent when the hand has no number', () => {
    expect(inlineQuery(model)).toBe('hand 37');
    expect(inlineQuery({ ...model, stamp: null })).toBe('hand Aggressive v1.3');
  });
});

describe('shareHand — desktop, where Telegram share is unavailable', () => {
  // A plain desktop browser: no Telegram WebApp, no file-capable share sheet.
  const desktopNav = () => ({ clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });

  it('saves the PNG and copies the caption', async () => {
    const nav = desktopNav();
    const via = await shareHand({ model, png, nav, webApp: null });

    expect(via).toBe('download');
    expect(clicked).toEqual([{ download: 'agenticpoker-aggressive-v1-3-37.png', href: 'blob:card' }]);
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:card'));
    expect(nav.clipboard.writeText).toHaveBeenCalledWith(shareCaption(model));
  });

  it('still leaves them the words when the image could not be made', async () => {
    const nav = desktopNav();
    expect(await shareHand({ model, png: null, nav, webApp: null })).toBe('copied');
    expect(nav.clipboard.writeText).toHaveBeenCalledWith(shareCaption(model));
  });

  it('says plainly that nothing happened when the browser allows neither', async () => {
    expect(await shareHand({ model, png: null, nav: {}, webApp: null })).toBe('none');
  });
});

describe('savePng', () => {
  it('refuses rather than throwing when there is nothing to save', () => {
    expect(savePng(null, 'x.png')).toBe(false);
    expect(clicked).toHaveLength(0);
  });

  it('cleans up the object URL, but only once the download has been handed off', async () => {
    expect(savePng(png, 'x.png')).toBe(true);
    // Not in the same tick as the click — the browser may still be reading it.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1));
  });
});
