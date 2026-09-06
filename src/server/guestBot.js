// src/server/guestBot.js — GUEST-1 job 5
//
// `/start guest_<token>` — keeping him from inside Telegram.
//
// The claim wall's CONTINUE IN TELEGRAM button opens a chat with the bot and
// hands it the guest's token as a start parameter. This is the other end of
// that link: the token identifies the guest, the Telegram update identifies
// the person, and those are exactly the two things a claim needs.
//
// WHY THE BOT AT ALL, when a browser could POST the claim itself? Because a
// browser on a laptop has no Telegram credential. The Login Widget is one way
// to get one and it is a worse one for this moment — it asks a stranger to
// approve an OAuth-shaped dialog for an account he may not be signed into on
// that device. Opening the bot is a tap, and it lands him inside the Mini App,
// which is where the product actually lives.
//
// THREE THINGS THIS FILE DOES NOT DO.
//
//   1. It does not poll. Only one process may call getUpdates per bot token,
//      so this is a handler handed to share.js's existing loop rather than a
//      second loop competing with it for the same updates.
//   2. It does not re-implement the claim. claimGuest() is the same function
//      POST /api/guest/claim calls, so the two doors cannot drift into two
//      different claims — which is the whole reason that function is pure of
//      Express.
//   3. It does not verify a signature, because there is nothing to verify. An
//      update that arrived over getUpdates came from Telegram's own API on a
//      connection authenticated by the bot token; `message.from.id` is
//      Telegram's word for who sent it, and that is the strongest claim
//      available on this path.
//
// A plain `/start` with no parameter is answered like any other greeting: the
// button into the app. Nothing else is handled — this bot is not a chat bot,
// and a message it does not understand is met with silence rather than a
// "sorry, I did not get that" from a bot that never claimed to be listening.

import { claimGuest } from './guestClaim.js';
import { guestsEnabled, tokenFromStartParam } from './guest.js';

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://t.me/AigenicPokerBot/game';

/** The Mini App button every reply below carries. */
function openButton(text = 'OPEN AGENTIC POKER') {
  return { inline_keyboard: [[{ text, url: MINI_APP_URL }]] };
}

/**
 * The /start parameter in a message, or null when this is not a /start at all.
 * Exported because "did Telegram send us a command" is worth being able to
 * test without a bot.
 */
export function startParamOf(message) {
  const text = typeof message?.text === 'string' ? message.text.trim() : '';
  if (!/^\/start(@\S+)?(\s|$)/.test(text)) return null;
  const rest = text.replace(/^\/start(@\S+)?/, '').trim();
  return rest || '';
}

/**
 * Handle one message. Returns what it did, for the log and the tests:
 * 'claimed' | 'alreadyClaimed' | 'noGuest' | 'greeted' | null (not for us).
 *
 * Never throws: it is called from inside the poll loop that the share cards
 * also ride on, and a handler that can take that loop down is a handler that
 * can take inline sharing down with it.
 */
export async function handleStart(message, { bot } = {}) {
  const param = startParamOf(message);
  if (param === null) return null;

  const chatId = message?.chat?.id ?? message?.from?.id;
  const fromId = message?.from?.id;
  const say = (text) => (bot?.sendMessage
    ? bot.sendMessage(chatId, text, { reply_markup: openButton() })
    : Promise.resolve(false));

  const token = tokenFromStartParam(param);
  // A bare /start, or a parameter meant for somebody else (an agent deep link
  // that reached the chat rather than the app). Either way: the door, opened.
  if (!token || !guestsEnabled() || !fromId) {
    await say('He is upstairs. Open the app and he is where you left him.');
    return 'greeted';
  }

  const out = claimGuest(token, fromId, { via: 'bot' });

  if (out.status === 200 && out.body?.alreadyClaimed) {
    await say('Already yours. Open the app — he is in the room.');
    return 'alreadyClaimed';
  }
  if (out.status === 200) {
    const n = out.body?.agents ?? 0;
    await say(n > 0
      ? 'He is yours. Open the app — he is in the room, and now you can talk to him.'
      : 'Done. Open the app and pick up where you left off.');
    console.log(`[guest-bot] claimed ${out.body?.from} for ${fromId}`);
    return 'claimed';
  }

  // Every failure is one sentence and the same button. A stranger who followed
  // a link does not need a status code; he needs a way in.
  await say('That link has been used already. Open the app and draft somebody new.');
  return out.body?.error === 'alreadyClaimed' ? 'alreadyClaimed' : 'noGuest';
}
