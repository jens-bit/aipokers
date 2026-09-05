// SHARE-1 — getting the card out of the app.
//
// Four routes, tried in the order of how much of the card actually survives:
//
//  1. The Web Share sheet with the PNG attached. Inside Telegram's iOS and
//     Android webviews this is the native sheet with Telegram in it, so the
//     picture itself goes into the chat. Anything that ends with the real file
//     in someone else's chat wins.
//  2. WebApp.shareMessage — Telegram's own share, and the only one that can
//     put a bot-authored message in front of a chat picker. It shares a message
//     the BOT prepared (savePreparedInlineMessage), not bytes from here, so it
//     is only reachable once something hands us a prepared id. Nothing does
//     yet; the hook is here so the day the bot endpoint lands this file is the
//     only one that has to know.
//  3. WebApp.switchInlineQuery — the same handoff without a prepared message:
//     Telegram opens the chat picker with a query addressed to the bot. Also
//     needs the bot to answer inline queries, which is a server concern.
//  4. The download. No chat picker, no bot: the PNG lands in the user's files
//     and the caption on their clipboard, and they post it themselves — which
//     is exactly what people were doing with screenshots before this existed,
//     only with the card that reads.
//
// Nothing here throws at the caller. A share that fails is a share that did
// not happen, and the sheet stays open so they can try the other button.

import { shareCaption, shareFilename } from './shareModel.js';

/** @returns {'web-share'|'telegram-prepared'|'telegram-inline'|'download'|'copied'|'none'} */
export async function shareHand({
  model,
  png,
  preparedMessageId = null,
  webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : null,
  nav = typeof navigator !== 'undefined' ? navigator : null,
} = {}) {
  const caption = shareCaption(model);
  const filename = shareFilename(model);

  // 1 — the real file, through the OS.
  const file = makeFile(png, filename);
  if (file && nav?.share && nav?.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: caption });
      return 'web-share';
    } catch (err) {
      // A user who backs out of the share sheet has shared nothing and wants
      // nothing else to happen. Only a sheet that could not open falls through.
      if (isAbort(err)) return 'none';
    }
  }

  // 2 — Telegram's own share, once a bot-prepared message exists.
  if (preparedMessageId && typeof webApp?.shareMessage === 'function') {
    try {
      webApp.shareMessage(preparedMessageId);
      return 'telegram-prepared';
    } catch { /* fall through */ }
  }

  // 3 — the chat picker, with the hand named for the bot to render.
  if (typeof webApp?.switchInlineQuery === 'function') {
    try {
      webApp.switchInlineQuery(inlineQuery(model), ['users', 'groups', 'channels']);
      return 'telegram-inline';
    } catch { /* fall through */ }
  }

  // 4 — the file, in their hands.
  const saved = savePng(png, filename);
  const copied = await copyText(nav, caption);
  return saved ? 'download' : (copied ? 'copied' : 'none');
}

/** The query the bot would answer inline. Names the hand, not the card. */
export function inlineQuery(model) {
  const hand = model.stamp ? model.stamp.replace(/[^0-9]/g, '') : '';
  return hand ? `hand ${hand}` : `hand ${model.name}`;
}

function isAbort(err) {
  return err?.name === 'AbortError' || /abort|cancel/i.test(String(err?.message ?? ''));
}

function makeFile(png, filename) {
  if (!png || typeof File !== 'function') return null;
  try {
    return new File([png], filename, { type: 'image/png' });
  } catch {
    return null;
  }
}

/** The download. Returns whether the browser let us start one. */
export function savePng(png, filename) {
  if (!png || typeof document === 'undefined' || typeof URL?.createObjectURL !== 'function') return false;
  let url;
  try {
    url = URL.createObjectURL(png);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  } finally {
    // Revoked on the next task, not in this one: the click has been dispatched
    // but the download has not necessarily started reading the blob yet, and
    // pulling the URL out from under it in the same tick loses the file.
    if (url) setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* already gone */ } }, 0);
  }
}

async function copyText(nav, text) {
  try {
    await nav?.clipboard?.writeText?.(text);
    return !!nav?.clipboard?.writeText;
  } catch {
    return false;
  }
}
