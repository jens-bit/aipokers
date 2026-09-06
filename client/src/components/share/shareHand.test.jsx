// SHARE-1 — which way the card leaves the app.
//
// Four routes, and the order between them is the product decision: the picture
// itself beats a handoff to the bot, and a handoff beats a file in a folder.
// Each test below pins one rung of that ladder and what happens when it breaks.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handIdOf, inlineQuery, prepareShare, savePng, shareHand } from './shareHand.js';
import { buildShareModel, shareCaption } from './shareModel.js';
import { badBeatHand } from '../../test/fixtures/flagged.js';
import { fetchMock, telegram } from '../../test/harness.js';

const model = buildShareModel(badBeatHand, { agentName: 'Aggressive v1.3', mood: 'tilted' });
const png = new Blob(['not really a png'], { type: 'image/png' });

// A navigator that can do everything, then taken apart per test.
function fullNav({ share = vi.fn().mockResolvedValue(undefined), canShare = () => true } = {}) {
  return { share, canShare, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } };
}

function telegramWebApp() {
  return { shareMessage: vi.fn(), switchInlineQuery: vi.fn() };
}

// SHARE-2 put a server round trip on route 2. Tests that are about a DIFFERENT
// rung of the ladder inject the answer rather than letting a fetch decide it,
// so what they assert is the order of the routes and nothing else.
const noPrepare = async () => null;

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

    expect(await shareHand({ model, png, nav, webApp, prepare: noPrepare })).toBe('none');
    expect(webApp.switchInlineQuery).not.toHaveBeenCalled();
    expect(clicked).toHaveLength(0);
  });

  it('falls through when the sheet could not open at all', async () => {
    const nav = fullNav({ share: vi.fn().mockRejectedValue(new Error('no share target')) });
    const webApp = telegramWebApp();

    expect(await shareHand({ model, png, nav, webApp, prepare: noPrepare })).toBe('telegram-inline');
  });
});

describe('shareHand — Telegram', () => {
  const noFiles = () => ({ canShare: () => false, share: vi.fn(), clipboard: { writeText: vi.fn() } });

  it('uses a bot-prepared message when one exists', async () => {
    const webApp = telegramWebApp();
    const prepare = vi.fn();
    const via = await shareHand({ model, png, nav: noFiles(), webApp, preparedMessageId: 'prep_1', prepare });

    expect(via).toBe('telegram-prepared');
    expect(webApp.shareMessage).toHaveBeenCalledWith('prep_1');
    expect(webApp.switchInlineQuery).not.toHaveBeenCalled();
    // An id we were handed is an id we do not go and ask the server for.
    expect(prepare).not.toHaveBeenCalled();
  });

  it('otherwise opens the chat picker with the hand named for the bot', async () => {
    const webApp = telegramWebApp();
    const via = await shareHand({ model, png, nav: noFiles(), webApp, prepare: noPrepare });

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
    expect(fetchMock.posts).toHaveLength(0);
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

// SHARE-2 — route 2, which is now a round trip.
//
// The bot cannot be told to send a message from in here; it can only be asked
// to have prepared one. These pin what leaves the browser (a picture, a hand,
// and a credential — nothing that decides what the bot SAYS), and that a prepare
// that does not come back is a fall-through rather than a dead button.

describe('prepareShare', () => {
  const noFiles = () => ({ canShare: () => false, share: vi.fn(), clipboard: { writeText: vi.fn() } });

  beforeEach(() => {
    telegram.install();
    telegram.signIn({ id: 4242 });
  });

  it('posts the picture and the hand, and returns the id the server prepared', async () => {
    fetchMock.route('/api/share/prepare', () => ({ preparedId: 'prep_9', url: 'https://x/share/a.png' }), { method: 'POST' });

    expect(await prepareShare({ model, png, agentId: 'agent-1' })).toBe('prep_9');

    const [post] = fetchMock.posts;
    expect(post.url).toContain('/api/share/prepare?userId=4242');
    expect(post.body.agentId).toBe('agent-1');
    expect(post.body.handId).toBe('37');
    // The bytes themselves, base64'd behind a data: prefix the server strips —
    // not the Blob stringified, which is what a missing await would send.
    expect(post.body.png).toMatch(/^data:image\/png;base64,/);
    expect(atob(post.body.png.split(',')[1])).toBe('not really a png');
    // The route is owner-gated; without this it answers 403.
    expect(post.headers['x-telegram-init-data']).toBeTruthy();
    // And nothing about what the message SAYS travels from here.
    expect(post.body.caption).toBeUndefined();
  });

  it('asks for nothing when it has no agent, no hand, or no picture', async () => {
    expect(await prepareShare({ model, png, agentId: null })).toBeNull();
    expect(await prepareShare({ model: { ...model, stamp: null }, png, agentId: 'agent-1' })).toBeNull();
    expect(await prepareShare({ model, png: null, agentId: 'agent-1' })).toBeNull();
    expect(fetchMock.posts).toHaveLength(0);
  });

  it('returns null rather than throwing when the server refuses', async () => {
    fetchMock.route('/api/share/prepare', () => ({ status: 429, body: { error: 'Too many shares' } }), { method: 'POST' });
    expect(await prepareShare({ model, png, agentId: 'agent-1' })).toBeNull();
  });

  it('returns null when the bot could not prepare the message but the card was stored', async () => {
    fetchMock.route('/api/share/prepare', () => ({ preparedId: null, url: 'https://x/share/a.png' }), { method: 'POST' });
    expect(await prepareShare({ model, png, agentId: 'agent-1' })).toBeNull();
  });

  it('carries the whole ladder: prepare, then shareMessage with what came back', async () => {
    fetchMock.route('/api/share/prepare', () => ({ preparedId: 'prep_9' }), { method: 'POST' });
    const webApp = telegramWebApp();

    const via = await shareHand({ model, png, agentId: 'agent-1', nav: noFiles(), webApp });

    expect(via).toBe('telegram-prepared');
    expect(webApp.shareMessage).toHaveBeenCalledWith('prep_9');
    expect(webApp.switchInlineQuery).not.toHaveBeenCalled();
  });

  it('falls through to the chat picker when the prepare does not come back', async () => {
    fetchMock.route('/api/share/prepare', () => ({ status: 500, body: {} }), { method: 'POST' });
    const webApp = telegramWebApp();

    const via = await shareHand({ model, png, agentId: 'agent-1', nav: noFiles(), webApp });

    // The picture is not lost: route 3 names the same hand, and the bot answers
    // it with whatever card it already has for that hand.
    expect(via).toBe('telegram-inline');
    expect(webApp.switchInlineQuery).toHaveBeenCalledWith('hand 37', ['users', 'groups', 'channels']);
  });

  it('does not spend a prepare when there is no picker to hand it to', async () => {
    // A desktop browser: no shareMessage, so the round trip would buy nothing.
    await shareHand({ model, png, agentId: 'agent-1', nav: noFiles(), webApp: { switchInlineQuery: vi.fn() } });
    expect(fetchMock.posts).toHaveLength(0);
  });

  it('reads the hand off the card, which is what both routes name', () => {
    expect(handIdOf(model)).toBe('37');
    expect(handIdOf({ ...model, stamp: null })).toBe('');
    expect(inlineQuery(model)).toBe(`hand ${handIdOf(model)}`);
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
