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
//     the BOT prepared (savePreparedInlineMessage), not bytes from here, so
//     getting there is a round trip: SHARE-2 POSTs the PNG we just drew to
//     /api/share/prepare, the server hosts it and asks the bot to remember a
//     photo message pointing at it, and the prepared id comes back.
//  3. WebApp.switchInlineQuery — the same handoff without a prepared message:
//     Telegram opens the chat picker with a query addressed to the bot, which
//     answers it with the card SHARE-2 already stored for that hand. This is
//     what catches a prepare that failed — the picture is on the server either
//     way, so route 3 still has something to show.
//  4. The download. No chat picker, no bot: the PNG lands in the user's files
//     and the caption on their clipboard, and they post it themselves — which
//     is exactly what people were doing with screenshots before this existed,
//     only with the card that reads.
//
// Nothing here throws at the caller. A share that fails is a share that did
// not happen, and the sheet stays open so they can try the other button.

import { getTelegramInitData, getUserId } from '../../lib/telegram.js';
import { shareCaption, shareFilename } from './shareModel.js';

/** @returns {'web-share'|'telegram-prepared'|'telegram-inline'|'download'|'copied'|'none'} */
export async function shareHand({
  model,
  png,
  agentId = null,
  preparedMessageId = null,
  prepare = prepareShare,
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

  // 2 — Telegram's own share, through a message the bot has been asked to
  // remember. The round trip only happens when there is a picker to hand it to;
  // a browser with no shareMessage must not spend a prepare on the server.
  if (typeof webApp?.shareMessage === 'function') {
    const id = preparedMessageId ?? await prepare({ model, png, agentId });
    if (id) {
      try {
        webApp.shareMessage(id);
        return 'telegram-prepared';
      } catch { /* fall through */ }
    }
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

/** The hand this card is about, as the server knows it. '' when unstamped. */
export function handIdOf(model) {
  return model?.stamp ? model.stamp.replace(/[^0-9]/g, '') : '';
}

/** The query the bot would answer inline. Names the hand, not the card. */
export function inlineQuery(model) {
  const hand = handIdOf(model);
  return hand ? `hand ${hand}` : `hand ${model.name}`;
}

/**
 * SHARE-2 — hand the PNG to the server and get back the id of the message the
 * bot will send. Only the picture travels: the caption and the button are built
 * server-side from the flagged hand, so nothing here can decide what the bot
 * says.
 *
 * Returns null for every failure, and never throws. A share that could not be
 * prepared is a share that falls through to the chat picker, which by then has
 * a card of its own to find — not an error in front of someone who pressed a
 * button once.
 */
export async function prepareShare({
  model,
  png,
  agentId,
  fetchImpl = typeof fetch === 'function' ? fetch : null,
} = {}) {
  const handId = handIdOf(model);
  if (!agentId || !handId || !png || !fetchImpl) return null;

  try {
    const base64 = await toBase64(png);
    if (!base64) return null;

    const res = await fetchImpl(`/api/share/prepare?userId=${encodeURIComponent(getUserId())}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The route is owner-gated — without the credential the server cannot
        // tell it is his hand and answers 403.
        'x-telegram-init-data': getTelegramInitData(),
      },
      body: JSON.stringify({ agentId, handId, png: base64 }),
    });
    if (!res?.ok) return null;
    const data = await res.json();
    return data?.preparedId ?? null;
  } catch {
    return null;
  }
}

/**
 * The Blob as a data: URL — which is base64, with a prefix the server strips.
 *
 * FileReader rather than blob.arrayBuffer() + btoa: arrayBuffer is missing from
 * jsdom, so the test environment could not have exercised this path at all, and
 * a route that only its own tests cannot reach is a route nobody checks. It
 * also does the base64 itself, so there is no chunked String.fromCharCode loop
 * here waiting to overflow the stack on a bigger card.
 */
function toBase64(blob) {
  if (!blob || typeof FileReader !== 'function') return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    try {
      reader.readAsDataURL(blob);
    } catch {
      resolve(null);
    }
  });
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
