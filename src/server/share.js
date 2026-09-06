// src/server/share.js — SHARE-2
//
// The half of the share that only a server can do.
//
// SHARE-1 built the card and four ways out of the app, and three of the four
// work with nothing behind them: the OS share sheet takes the bytes, the
// download writes them to disk. The two that put a BOT-authored message in
// front of a chat picker cannot — Telegram will not let a Mini App author a
// message on the bot's behalf, only ask the bot to have prepared one. That is
// what this file is: the bot end of routes 2 and 3.
//
//   route 2 — savePreparedInlineMessage. The client POSTs the PNG it already
//     rendered, we host it, hand Telegram an InlineQueryResultPhoto pointing at
//     it, and get back a prepared id. WebApp.shareMessage(id) then opens the
//     chat picker with that exact message in it.
//   route 3 — answerInlineQuery. The same card, reached the other way: the user
//     types the bot's name and the hand, Telegram asks us, we answer with the
//     photo we already stored. Route 3 is what catches a client that could not
//     reach route 2 — and because both read the same record, the two routes
//     cannot show two different cards for one hand.
//
// Three rules the shape of this file comes from:
//
//   1. THE CAPTION IS OURS, NOT THE CLIENT'S. The picture arrives from the
//      browser because the browser is where it was drawn; the words do not.
//      A caption posted by the client would be a way to make the BOT say an
//      arbitrary sentence in someone else's chat, and it would drift from what
//      the inline route says about the same hand. Both are built here, from the
//      flagged-hand record the server already holds.
//   2. THE CARD IS THE OWNER'S UNTIL HE SENDS IT. The URL is 32 random hex
//      characters, not a hash of anything guessable, because the card carries
//      his hole cards and he may still decide not to post it.
//   3. WHAT IS HOSTED IS BOUNDED. Five prepares per owner per hour, 8 MB per
//      PNG, and the newest KEEP_SHARES cards on disk — older ones are deleted
//      when a new one lands. Nothing here may be the thing that fills the VPS.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe as describeHand } from '../engine/hand.js';
import { getFlaggedHand } from './agentProfiles.js';
import { telegramAuthMiddleware, isOwner } from './auth.js';

// ── Dials ────────────────────────────────────────────────────────────────────

// Five an hour. A share is a deliberate act on one hand someone just watched,
// so five is far above real use and far below anything that could be used to
// park files on the box.
export const SHARE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };

// The card exports at 1080x1080; a PNG of it is a few hundred KB. 8 MB is
// generous enough that a future higher-resolution card still fits and small
// enough that it is not a place to store something else.
export const MAX_PNG_BYTES = 8 * 1024 * 1024;
export const SHARE_BODY_LIMIT = '12mb';   // base64 inflates by 4/3, plus JSON

// How many cards stay on disk. Beyond this the oldest are deleted, which also
// kills their inline result — a card nobody has shared in two hundred shares
// is not one anyone is still typing the bot's name to find.
export const KEEP_SHARES = 200;

export const MARK = 'agenticpoker.app';

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://t.me/AigenicPokerBot/game';

// Telegram fetches the photo itself, so the URL has to be reachable from the
// public internet — a relative path or localhost is useless to it.
export function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || 'https://agenticpoker.app').replace(/\/+$/, '');
}

// ── Where the cards live ─────────────────────────────────────────────────────
//
// Resolved from process.cwd() for the same reason store.js is: the test harness
// spawns each suite in a scratch cwd, and that is the only thing keeping a test
// run out of the real data/.

function shareDir()   { return path.join(process.cwd(), 'data', 'share'); }
function indexPath()  { return path.join(shareDir(), 'index.json'); }
function pngPath(id)  { return path.join(shareDir(), `${id}.png`); }

// The index is one small JSON file next to the PNGs rather than a table in
// app.db: these records are cache, not state. Losing the file costs the inline
// route the cards it had and nothing else, and a directory you can delete to
// reclaim the space is worth more here than a migration.
function readIndex() {
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath(), 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeIndex(records) {
  fs.mkdirSync(shareDir(), { recursive: true });
  fs.writeFileSync(indexPath(), JSON.stringify(records, null, 2));
}

/** Newest first. The list is stored oldest-first, as it is appended. */
export function listShares(ownerId = null) {
  const all = readIndex();
  const mine = ownerId == null ? all : all.filter((r) => r.ownerId === String(ownerId));
  return [...mine].reverse();
}

/** The most recent card this owner prepared for this hand, or null. */
export function findShare(ownerId, handId) {
  return listShares(ownerId).find((r) => String(r.handId) === String(handId)) ?? null;
}

/** The most recent card this owner prepared at all — what an empty query gets. */
export function latestShare(ownerId) {
  return listShares(ownerId)[0] ?? null;
}

/**
 * The ledger after one more card lands: the newest KEEP_SHARES kept, and the
 * ones that fell off the front named so their bytes can go with them. Pure, so
 * the boundary is checked without writing two hundred files.
 */
export function pruneShares(records, record) {
  const all = [...records, record];
  const cut = Math.max(0, all.length - KEEP_SHARES);
  return { keep: all.slice(cut), drop: all.slice(0, cut) };
}

function storeShare(record, png) {
  fs.mkdirSync(shareDir(), { recursive: true });
  fs.writeFileSync(pngPath(record.id), png);

  const { keep, drop } = pruneShares(readIndex(), record);
  for (const old of drop) {
    try { fs.unlinkSync(pngPath(old.id)); } catch { /* already gone */ }
  }
  writeIndex(keep);
  return record;
}

/** Tests only: forget every stored card. */
export function _resetShares() {
  try { fs.rmSync(shareDir(), { recursive: true, force: true }); } catch { /* nothing to clear */ }
}

// ── The words that travel with the picture ───────────────────────────────────
//
// Same order as the card reads and as client shareModel.shareCaption builds it:
// his line, then who and what it cost, then the mark. Nothing is composed — if
// he said nothing in the hand, the caption says nothing for him.

const money = (n) => `$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-US')}`;

/** The last thing he actually said in the hand, or null. */
export function talkLine(hand) {
  const streets = Array.isArray(hand?.streets) ? hand.streets : [];
  for (let i = streets.length - 1; i >= 0; i--) {
    const line = streets[i]?.reasoning;
    if (typeof line === 'string' && line.trim()) return line.trim();
  }
  return null;
}

/**
 * "Flush, Ah High", read off his own cards and the board as it finished.
 *
 * The engine's evaluator, verbatim — the same one that awarded the pot and the
 * same wording the app already uses at showdown. The card itself says
 * "ace-high flush" (client handName.js) because it is written out for someone
 * reading a picture in a chat list; the caption is beside the picture and
 * matching the felt is worth more there than matching the card.
 *
 * Null whenever the record cannot name a hand: an unfinished board, or a
 * record with no hole cards on it.
 */
export function handDescription(hand) {
  const hole = (Array.isArray(hand?.holeCards) ? hand.holeCards : [])
    .filter((c) => typeof c === 'string' && c.length >= 2);
  const streets = Array.isArray(hand?.streets) ? hand.streets : [];
  const board = (streets[streets.length - 1]?.board ?? [])
    .filter((c) => typeof c === 'string' && c.length >= 2);
  if (hole.length !== 2 || board.length < 3 || board.length > 5) return null;
  try {
    return String(describeHand(hole, board));
  } catch {
    // A malformed card in a stored record must not cost the whole share.
    return null;
  }
}

export function shareCaption(hand, agentName) {
  const amount = `${hand?.won ? '+' : '−'}${money(hand?.pot)}`;
  const named = handDescription(hand);
  const talk = talkLine(hand);

  const parts = [];
  if (talk) parts.push(`“${talk}”`);
  parts.push(`${agentName || 'Your agent'} · ${named ? `${amount} · ${named}` : amount}`);
  parts.push(MARK);
  // Telegram caps a caption at 1024 characters. Reasoning is stored capped at
  // 300, so this only ever bites on something malformed.
  return parts.join('\n').slice(0, 1024);
}

// ── The message the bot is asked to remember ─────────────────────────────────

export function shareImageUrl(id) {
  return `${publicBaseUrl()}/share/${id}.png`;
}

// The tap has to land on the hand the card is about, not the home screen.
export function shareOpenUrl({ agentId, handId }) {
  return `${MINI_APP_URL}?startapp=hand_${agentId}_${handId}`;
}

/** The InlineQueryResultPhoto both routes hand to Telegram. */
export function photoResult(record) {
  const url = shareImageUrl(record.id);
  return {
    type: 'photo',
    id: record.id,
    photo_url: url,
    thumbnail_url: url,
    photo_width: 1080,
    photo_height: 1080,
    caption: record.caption,
    reply_markup: { inline_keyboard: [[{ text: 'Open', url: shareOpenUrl(record) }]] },
  };
}

// ── The Telegram client ──────────────────────────────────────────────────────
//
// Injected, so the tests hold a fake one. Three methods, each shaped like the
// Bot API call it makes:
//   savePreparedInlineMessage(userId, result) -> { id } | null
//   answerInlineQuery(inlineQueryId, results, opts) -> boolean
//   getUpdates({ offset, timeout, allowed_updates }) -> update[]

export function defaultShareBot(token = process.env.TELEGRAM_BOT_TOKEN || '') {
  if (!token) {
    return {
      async savePreparedInlineMessage() {
        console.warn('[share] TELEGRAM_BOT_TOKEN not set — no prepared message');
        return null;
      },
      async answerInlineQuery() { return false; },
      async getUpdates() { return []; },
    };
  }

  const call = async (method, body, { timeoutMs = 15_000 } = {}) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      const err = new Error(`telegram ${method} ${res.status}: ${json?.description ?? ''}`.trim());
      err.status = res.status;
      throw err;
    }
    return json.result;
  };

  return {
    async savePreparedInlineMessage(userId, result) {
      try {
        return await call('savePreparedInlineMessage', {
          user_id: Number(userId),
          result,
          allow_user_chats: true,
          allow_group_chats: true,
          allow_channel_chats: true,
        });
      } catch (err) {
        console.error('[share] savePreparedInlineMessage failed:', err.message);
        return null;
      }
    },
    async answerInlineQuery(inlineQueryId, results, opts = {}) {
      try {
        await call('answerInlineQuery', { inline_query_id: inlineQueryId, results, ...opts });
        return true;
      } catch (err) {
        console.error('[share] answerInlineQuery failed:', err.message);
        return false;
      }
    },
    getUpdates(params = {}) {
      // The long poll holds for `timeout` seconds server-side; the abort has to
      // outlast it or every poll dies on its own deadline.
      const seconds = Number(params.timeout ?? 25);
      return call('getUpdates', params, { timeoutMs: (seconds + 10) * 1000 });
    },
  };
}

// ── Rate limit ───────────────────────────────────────────────────────────────
//
// Per OWNER, not per IP: rateLimit.js already covers the IP, and the thing
// being protected here is the bot's quota and the disk, both of which are spent
// per person rather than per connection.

const shareHits = new Map();   // ownerId -> ts[]

export function shareRateCheck(ownerId, now = Date.now()) {
  const key = String(ownerId);
  const cutoff = now - SHARE_LIMIT.windowMs;
  const hits = (shareHits.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= SHARE_LIMIT.max) {
    return { ok: false, retryAfterMs: hits[0] + SHARE_LIMIT.windowMs - now };
  }
  hits.push(now);
  shareHits.set(key, hits);
  return { ok: true, remaining: SHARE_LIMIT.max - hits.length };
}

/** Tests only. */
export function _resetShareRate() { shareHits.clear(); }

// ── Decoding what the browser sent ───────────────────────────────────────────

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * base64 (with or without a data: prefix) to a verified PNG buffer.
 * @returns {{ png: Buffer } | { error: string }}
 */
export function decodePng(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return { error: 'png must be a base64 string' };
  const body = raw.startsWith('data:') ? raw.slice(raw.indexOf(',') + 1) : raw;
  // 4 base64 chars per 3 bytes — checked before decoding so an oversized body
  // is refused without allocating it twice.
  if (body.length > Math.ceil(MAX_PNG_BYTES / 3) * 4) return { error: 'png too large' };

  const png = Buffer.from(body, 'base64');
  if (png.length === 0) return { error: 'png is not valid base64' };
  if (png.length > MAX_PNG_BYTES) return { error: 'png too large' };
  // The bytes are hosted publicly and fetched by Telegram. Only a real PNG.
  if (!png.subarray(0, 8).equals(PNG_MAGIC)) return { error: 'png is not a PNG' };
  return { png };
}

// ── Routes ───────────────────────────────────────────────────────────────────

export function installShareRoutes(app, { bot = defaultShareBot(), now = () => Date.now() } = {}) {
  // GET /share/<id>.png — the only public thing here. Registered before the SPA
  // fallback in index.js, which is what keeps it from being served index.html.
  //
  // 32 hex characters, and nothing about them is derived from the owner or the
  // hand, so a card that has not been shared cannot be found by guessing.
  app.get('/share/:file', (req, res) => {
    const m = /^([0-9a-f]{32})\.png$/.exec(String(req.params.file));
    if (!m) return res.status(404).end();
    const file = pngPath(m[1]);
    if (!fs.existsSync(file)) return res.status(404).end();
    res.setHeader('Content-Type', 'image/png');
    // Immutable: the id is random and a card is never rewritten under one.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(file);
  });

  // POST /api/share/prepare { agentId, handId, png, userId }
  //
  // Behind auth, and behind the owner check on top of it: the card carries hole
  // cards, and the prepared message is saved against the CALLER's Telegram id,
  // so preparing someone else's hand would both leak the cards and put the
  // message in the wrong person's picker.
  app.post('/api/share/prepare', telegramAuthMiddleware, async (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your agent' });

    const agentId = String(req.body?.agentId ?? '');
    const handId = String(req.body?.handId ?? '');
    if (!agentId || !handId) return res.status(400).json({ error: 'agentId and handId are required' });

    const found = getFlaggedHand(agentId, userId, handId);
    if (!found) return res.status(404).json({ error: 'Hand not found' });

    const decoded = decodePng(req.body?.png);
    if (decoded.error) return res.status(400).json({ error: decoded.error });

    // Counted after the request is known to be well-formed and legitimate, so a
    // typo cannot spend one of the five.
    const gate = shareRateCheck(userId, now());
    if (!gate.ok) {
      res.setHeader('Retry-After', String(Math.ceil(gate.retryAfterMs / 1000)));
      return res.status(429).json({ error: 'Too many shares — try again later' });
    }

    const record = {
      id: crypto.randomBytes(16).toString('hex'),
      ownerId: userId,
      agentId,
      handId,
      caption: shareCaption(found.hand, found.agentName),
      createdAt: now(),
    };

    try {
      storeShare(record, decoded.png);
    } catch (err) {
      console.error('[share] could not store card:', err.message);
      return res.status(500).json({ error: 'Could not store the card' });
    }

    // A bot that cannot prepare the message is not a failed share: the card is
    // hosted and the inline route can now find it, so the client is told what
    // it got and falls through to the chat picker on its own.
    const prepared = await bot.savePreparedInlineMessage(userId, photoResult(record));
    const preparedId = prepared?.id ? String(prepared.id) : null;

    res.json({ preparedId, url: shareImageUrl(record.id), handId });
  });
}

// ── Inline queries ───────────────────────────────────────────────────────────

/**
 * The hand a query names. The client sends "hand 37" (shareHand.inlineQuery),
 * but a person typing it themselves will send anything, so any query with a
 * number in it is read as that hand and everything else falls back to the
 * newest card the asker has.
 */
export function parseHandId(query) {
  const m = /(\d+)/.exec(String(query ?? ''));
  return m ? m[1] : null;
}

/**
 * Answer one inline query with the asker's own card. `is_personal` is not
 * decoration: these results are private to one user, and without it Telegram
 * would cache one person's card against the query string for everybody.
 */
export async function handleInlineQuery(query, { bot = defaultShareBot() } = {}) {
  const ownerId = String(query?.from?.id ?? '');
  if (!ownerId) return false;

  const handId = parseHandId(query?.query);
  const record = handId ? findShare(ownerId, handId) : latestShare(ownerId);
  const results = record ? [photoResult(record)] : [];

  return bot.answerInlineQuery(query.id, results, { cache_time: 60, is_personal: true });
}

/**
 * The long poll. A webhook would be cheaper, but it needs a public URL
 * registered out of band and it is one more thing that can be silently wrong on
 * a deployment; getUpdates works the moment a token exists, which is the same
 * bar the notifier sets.
 *
 * Stops itself on a 409 — that is Telegram saying a webhook is set or another
 * process is already polling, and in both cases retrying forever would be a
 * loop that only logs.
 */
export function startInlinePolling({
  bot = defaultShareBot(),
  token = process.env.TELEGRAM_BOT_TOKEN || '',
  enabled = process.env.SHARE_INLINE !== '0',
} = {}) {
  if (!token || !enabled) return null;

  let stopped = false;
  let offset = 0;
  const handle = { stop() { stopped = true; } };

  const wait = (ms) => new Promise((r) => { const t = setTimeout(r, ms); t.unref?.(); });

  (async () => {
    while (!stopped) {
      try {
        const updates = await bot.getUpdates({ offset, timeout: 25, allowed_updates: ['inline_query'] });
        for (const update of updates ?? []) {
          offset = Math.max(offset, Number(update?.update_id ?? 0) + 1);
          if (update?.inline_query) {
            await handleInlineQuery(update.inline_query, { bot }).catch(() => {});
          }
        }
      } catch (err) {
        if (err?.status === 409) {
          console.warn('[share] inline polling stopped — another getUpdates consumer or a webhook is set');
          return;
        }
        console.error('[share] getUpdates failed:', err.message);
        await wait(5000);
      }
    }
  })().catch((err) => console.error('[share] inline polling died:', err.message));

  console.log('[share] answering inline queries');
  return handle;
}
