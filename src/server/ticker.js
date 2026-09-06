// src/server/ticker.js — EVENTS-3
//
// The casino's public voice: a Telegram channel fed by the event bus.
//
// EVENT-1 built the wire every table shouts into and the floor ticker inside
// the app that reads it. This is the same wire, pointed OUT of the app — at a
// channel anyone can subscribe to without installing anything, so the casino
// is audible to somebody who has never opened it. That is the whole argument
// for it: a game nobody can hear from outside has to be discovered one person
// at a time.
//
// Four rules the shape of this file comes from:
//
//   1. THE CHANNEL IS PUBLIC, SO IT SAYS LESS THAN THE FLOOR DOES. Agent names
//      travel; owner names never do, and there is no owner name to leak here
//      by construction — a casino event carries display names inside its
//      headline and an owner id nowhere at all. The private half of a fact
//      rides `detail`, which this file does not subscribe to and must not.
//   2. A TICKER IS A WINDOW, NOT A QUEUE. Six an hour, never two inside five
//      minutes, and an event that arrives while the window is shut is DROPPED
//      rather than held. A held headline arrives after the hand it describes
//      has been forgotten, and a channel that posts stale news is one people
//      mute. notify.js holds because a person's own agent busting is still
//      worth hearing an hour later; nobody else's is.
//   3. THE HOUSE SPEAKS IN DOLLARS. The felt says 90bb because a player has a
//      blind to divide by; a reader in a chat list does not. The line is the
//      headline the table already wrote, with its big-blind figure read back
//      in money, placed in the room it happened in, and closed with the one
//      word the house would use — "Cooler.", "Busted.", "Heater."
//   4. THE PICTURE IS NEVER ONE WE MADE. A SHARE-2 card carries hole cards and
//      belongs to its owner until he sends it (share.js rule 2). This file
//      cannot draw one — only a client can — so it attaches a card ONLY when
//      one already exists for exactly that hand, meaning the owner already
//      asked the bot to send it somewhere. Everything else is text, which is
//      the normal case and not the failure case: at hand end, no card exists
//      yet for the hand that just finished.
//
// Off unless TICKER_ENABLED is set and TICKER_CHANNEL_ID names a chat. Like
// the notifier, it is attached once from src/index.js and injected everywhere
// else, so the tests drive the whole thing with a fake bot and a fake clock.

import { bus as eventBus, EventType } from './events.js';
import { roomForBigBlind, roomPhrase } from './rooms.js';
import { listShares, shareImageUrl } from './share.js';

// ── Dials ────────────────────────────────────────────────────────────────────

export const ENABLED = process.env.TICKER_ENABLED === '1' || process.env.TICKER_ENABLED === 'true';

// The chat the bot posts into: a numeric chat id (-1001234567890) or an
// @channelusername. Read at attach time, not at import time, so a deployment
// that sets it after boot in a test does not need a module reload.
export function channelId() {
  return String(process.env.TICKER_CHANNEL_ID || '').trim();
}

// Six an hour is a channel somebody can leave notifications on for. Five
// minutes apart is what stops a single wild table from being the whole feed —
// one table can produce a cooler, a bust and a heater inside thirty seconds,
// and three lines about the same felt is the moment a reader stops reading.
export const BUDGET = Object.freeze({
  maxPerHour: 6,
  windowMs: 60 * 60 * 1000,
  minGapMs: 5 * 60 * 1000,
});

// What the channel carries. `hot` is deliberately absent: it is the one event
// with a deadline on it ("come and watch this pot finish"), and a line that
// waits up to five minutes for a gap to open would be pointing at a hand that
// ended before anybody could tap it.
export const POSTED_TYPES = Object.freeze([
  EventType.BIG_POT,
  EventType.COOLER,
  EventType.BUST,
  EventType.HEATER,
  EventType.NEMESIS_SEATED,
]);

const POSTED = new Set(POSTED_TYPES);

// ── The voice ────────────────────────────────────────────────────────────────

// The word the house puts at the end. bigPot has none on purpose — the money
// is the news there, and "Big pot." after a sentence that just said so is the
// sort of line that makes a feed feel automated.
const VERDICT = Object.freeze({
  [EventType.COOLER]: 'Cooler.',
  [EventType.BUST]: 'Busted.',
  [EventType.HEATER]: 'Heater.',
  [EventType.NEMESIS_SEATED]: 'Grudge.',
  [EventType.BIG_POT]: null,
});

const money = (n) => `$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-US')}`;

/**
 * The headline, with its big-blind figure read back in money.
 *
 * This is a UNIT SWAP on a token this repo writes itself (table.js builds
 * every headline), not an attempt to parse English: the `<n>bb` in
 * "coolered Bluff Master for 90bb" is replaced by the pot the event already
 * carries in chips. A headline with no bb figure, or an event with no pot,
 * comes back untouched — a bust and a heater have nothing to convert.
 */
export function inDollars(headline, pot) {
  const chips = Math.round(Number(pot) || 0);
  const line = String(headline ?? '');
  if (chips <= 0) return line;
  return line.replace(/\b\d+bb\b/, money(chips));
}

/** The one line the channel posts. Pure — the room is resolved by the caller. */
export function tickerLine(event, { room = null } = {}) {
  const sentence = inDollars(event?.headline, event?.pot).trim();
  if (!sentence) return null;
  const where = roomPhrase(room);
  const verdict = VERDICT[event?.type] ?? null;
  return `${sentence}${where ? ` ${where}` : ''}.${verdict ? ` ${verdict}` : ''}`;
}

// ── The picture ──────────────────────────────────────────────────────────────

/**
 * The URL of a SHARE-2 card for exactly this hand, or null.
 *
 * The match is (agent in this event) AND (the same hand number) — never a
 * card for another hand of his that happens to be recent. See rule 4: this
 * file cannot make a card, so a hit means the owner already prepared one.
 *
 * `shares` is injected so the test does not have to write PNGs to disk.
 */
export function cardUrlFor(event, { shares = listShares } = {}) {
  const hand = Number(event?.handNumber ?? 0);
  if (!Number.isFinite(hand) || hand <= 0) return null;
  const agents = new Set((event?.agentIds ?? []).map(String));
  if (agents.size === 0) return null;
  try {
    // listShares(null) is every owner's cards, newest first — so the newest
    // card for the hand wins if one was somehow prepared twice.
    const record = shares(null).find(
      (r) => agents.has(String(r?.agentId)) && String(r?.handId) === String(hand),
    );
    return record?.id ? shareImageUrl(record.id) : null;
  } catch (err) {
    console.error('[ticker] share lookup failed:', err.message);
    return null;
  }
}

// ── The Telegram client ──────────────────────────────────────────────────────
//
// Injected, so the tests hold a fake one. Two methods, each shaped like the
// Bot API call it makes:
//   sendMessage(chatId, text)                  -> Promise<boolean>
//   sendPhoto(chatId, photoUrl, { caption })   -> Promise<boolean>

export function defaultTickerBot(token = process.env.TELEGRAM_BOT_TOKEN || '') {
  if (!token) {
    return {
      async sendMessage(chatId, text) {
        console.warn(`[ticker] TELEGRAM_BOT_TOKEN not set — would have posted to ${chatId}: ${text}`);
        return false;
      },
      async sendPhoto(chatId, _url, opts = {}) {
        console.warn(`[ticker] TELEGRAM_BOT_TOKEN not set — would have posted to ${chatId}: ${opts.caption ?? ''}`);
        return false;
      },
    };
  }

  const call = async (method, body) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(`[ticker] telegram ${method} ${res.status}: ${detail.slice(0, 200)}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`[ticker] ${method} failed:`, err.message);
      return false;
    }
  };

  return {
    sendMessage(chatId, text) {
      return call('sendMessage', { chat_id: String(chatId), text, disable_web_page_preview: true });
    },
    sendPhoto(chatId, photoUrl, opts = {}) {
      return call('sendPhoto', { chat_id: String(chatId), photo: photoUrl, caption: opts.caption ?? '' });
    },
  };
}

// ── The budget ───────────────────────────────────────────────────────────────
//
// In memory, like the event ring itself: what the channel is allowed to say in
// the next hour is a statement about right now, and a restart that forgets it
// costs at most one extra line. (A crash LOOP would cost one line per boot,
// which is why the gap is checked before the hourly count — the first thing a
// fresh process does is wait, not shout.)

let sends = [];   // ts of every attempted post, oldest first

/**
 * May the channel speak at `at`? Returns { post: true } or { drop: reason }.
 * Pure apart from reading the ledger, so the rules are testable on their own.
 */
export function tickerDecide(at = Date.now()) {
  const window = sends.filter((t) => t > at - BUDGET.windowMs);
  const last = window[window.length - 1];
  if (last !== undefined && at - last < BUDGET.minGapMs) {
    return { drop: 'gap', nextAt: last + BUDGET.minGapMs };
  }
  if (window.length >= BUDGET.maxPerHour) {
    return { drop: 'hour', nextAt: window[0] + BUDGET.windowMs };
  }
  return { post: true };
}

// Counted the moment the decision is made, not when Telegram answers: two
// events emitted in the same tick must not both find an open window, and a
// post that fails is a headline that was spent, not one to retry. Retrying
// would mean holding it, and rule 2 says a ticker does not hold.
function spend(at) {
  sends.push(at);
  const cutoff = at - BUDGET.windowMs;
  sends = sends.filter((t) => t > cutoff);
}

/** Tests only. */
export function _resetBudget() { sends = []; }

/** What the channel has posted inside the last hour — the /tasks-style peek. */
export function tickerBudget(at = Date.now()) {
  const window = sends.filter((t) => t > at - BUDGET.windowMs);
  return { postedThisHour: window.length, max: BUDGET.maxPerHour, lastAt: window[window.length - 1] ?? null };
}

// ── Attach ───────────────────────────────────────────────────────────────────

let active = null;

export function isAttached() { return active !== null; }

/**
 * Subscribe the channel to the casino bus.
 *
 * @param {object} bot          Telegram client (see above); defaults to the real one
 * @param {string} chatId       the channel; defaults to TICKER_CHANNEL_ID
 * @param {boolean} enabled     defaults to TICKER_ENABLED
 * @param {function} now        clock, for tests
 * @param {object} liveTables   `{ getTable(tableId) }` — how a tableId becomes a room
 * @param {function} shares     SHARE-2 lookup, injected for tests
 */
export function attachTicker({
  bot = null,
  chatId = null,
  enabled = ENABLED,
  now = () => Date.now(),
  liveTables = null,
  shares = listShares,
} = {}) {
  const channel = String(chatId ?? channelId());
  if (!enabled) {
    console.log('[ticker] TICKER_ENABLED is not set — the channel is silent');
    return null;
  }
  if (!channel) {
    console.warn('[ticker] TICKER_ENABLED is set but TICKER_CHANNEL_ID is empty — nothing to post to');
    return null;
  }

  active = { bot: bot || defaultTickerBot(), chatId: channel, now, liveTables, shares };

  // off-then-on is idempotent because `onEvent` is a stable module-level
  // function, so a process that composes several servers (the tests do) still
  // has exactly one listener.
  eventBus.off('event', onEvent);
  eventBus.on('event', onEvent);

  console.log(`[ticker] attached to ${channel} — ${BUDGET.maxPerHour}/hour, ${BUDGET.minGapMs / 60000}min apart`);
  return active;
}

export function detachTicker() {
  eventBus.off('event', onEvent);
  active = null;
}

// The room a table is in, resolved AT RECEIPT rather than at post time: a bust
// closes its table within the second, and "the back room" is not a fact we can
// look up once the felt is gone.
function roomFor(tableId) {
  if (!tableId || !active?.liveTables?.getTable) return null;
  try {
    const table = active.liveTables.getTable(String(tableId));
    return table ? roomForBigBlind(table.bigBlind) : null;
  } catch (err) {
    console.error('[ticker] room lookup failed:', err.message);
    return null;
  }
}

/**
 * One event, decided synchronously and posted in the background.
 *
 * Synchronous decision is not an optimisation: `emit` is called inside the
 * hand that produced the event, so two headlines from one hand arrive in the
 * same tick, and a budget checked after an await would let both through.
 */
function onEvent(event) {
  if (!active || !event || !POSTED.has(event.type)) return;
  try {
    const decision = tickerDecide(active.now());
    if (!decision.post) return;

    const line = tickerLine(event, { room: roomFor(event.tableId) });
    if (!line) return;

    const photo = cardUrlFor(event, { shares: active.shares });
    spend(active.now());
    post(line, photo);
  } catch (err) {
    // A ticker that can break a hand is worse than no ticker — the same law
    // table.js applies at the emit site, applied again at the receiving end.
    console.error('[ticker] post failed:', err.message);
  }
}

function post(line, photoUrl) {
  const { bot, chatId } = active;
  const sent = photoUrl
    ? bot.sendPhoto(chatId, photoUrl, { caption: line })
    : bot.sendMessage(chatId, line);
  // Fire and forget: the bus is inside a hand, and nothing at the felt waits
  // on Telegram. A rejection is logged and the headline is gone (rule 2).
  Promise.resolve(sent).catch((err) => console.error('[ticker] send rejected:', err.message));
}
