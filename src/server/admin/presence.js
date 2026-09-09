// src/server/admin/presence.js — ADMIN-1 job 1
//
// Was anybody here.
//
// Everything else in this database records what an owner DID: an agent he
// drafted, a hand his agent played, a chip that moved. None of it records that
// he opened the app, looked at his flat and closed it again — and "active
// owners, last 24 hours" is the first number on the dashboard. So this is the
// one write ADMIN-1 adds to the product, and the rules it lives under are all
// about keeping it small enough to be free.
//
//   1. AT MOST ONE WRITE A MINUTE PER OWNER. A screen polls; the flat polls
//      the home state, the floor polls the ticker, the client re-fetches on
//      every navigation. A row per request would make presence the busiest
//      writer in the product to answer a question that has a one-day
//      resolution. The throttle is in memory and per process, which is exactly
//      right: it may lose a write across a restart, and a lost write inside a
//      minute another write already covered is not a lost fact.
//   2. IT NEVER FAILS A REQUEST. Wrapped end to end. A dashboard that can 500
//      somebody's poker game is not a dashboard, it is an outage.
//   3. IT COUNTS THE OWNER, NOT THE CREDENTIAL. A guest is recorded under his
//      own g_ owner id, like anybody else — the dashboard splits guests out by
//      joining `guests`, so the two numbers cannot drift apart. A request that
//      resolves to nobody (a public route, an unauthenticated poll, the
//      dashboard itself) is not activity and writes nothing.

import { touchOwnerActivity } from '../store.js';
import { guestOwnerFrom, verifyTelegramCredential, telegramUserIdFrom } from '../auth.js';

// Rule 1. One a minute is a hundredth of what a polling client generates and
// still resolves the only two questions the table is asked to the day.
export const TOUCH_EVERY_MS = 60_000;

// The throttle map is bounded: if it ever grows past this many owners it is
// swept of everything older than the window. That is a real ceiling rather
// than a hope — an in-memory Map keyed by a user-supplied id with no bound is
// how a process runs out of memory.
const MAX_TRACKED = 20_000;

const lastWrite = new Map();   // ownerId -> ms

/**
 * Whose request is this? Null when it is nobody's.
 *
 * The three doors, in the order auth.js itself checks them:
 *   · a guest cookie, which resolves to a g_ owner id;
 *   · a Telegram credential (Mini App initData or Login Widget), verified
 *     here before its user id is believed — an unverified credential is a
 *     string somebody typed;
 *   · neither, on a deployment with no bot token, which is local dev and the
 *     one case where auth.js itself answers "yes, you are whoever you say".
 *     Presence follows it rather than inventing a stricter rule of its own:
 *     if isOwner() would hand this request the roster, this is that owner.
 */
export function ownerOf(req) {
  try {
    const guestId = guestOwnerFrom(req);
    if (guestId) return String(guestId);

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken) {
      const credential = req?.headers?.['x-telegram-init-data'];
      if (!credential || !verifyTelegramCredential(credential, botToken)) return null;
      const id = telegramUserIdFrom(credential);
      return id ? String(id) : null;
    }

    // Keyless: the claimed id is the id. Never a fallback on a configured
    // deployment — the branch above returns before reaching here.
    if (process.env.DEV_API_SECRET && req?.headers?.['x-api-secret'] !== process.env.DEV_API_SECRET) return null;
    const claimed = req?.params?.userId ?? req?.query?.userId ?? req?.body?.userId;
    return claimed ? String(claimed) : null;
  } catch {
    return null;
  }
}

/**
 * Record that this owner was here. Returns true when a row was actually
 * written, false when the throttle swallowed it — which is what the test
 * asserts on, and the only reason it returns anything at all.
 */
export function touch(ownerId, { now = Date.now() } = {}) {
  if (!ownerId) return false;
  const id = String(ownerId);
  const last = lastWrite.get(id);
  if (last !== undefined && now - last < TOUCH_EVERY_MS) return false;

  if (lastWrite.size >= MAX_TRACKED) sweep(now);
  lastWrite.set(id, now);

  try {
    touchOwnerActivity(id, now);
    return true;
  } catch (err) {
    // Rule 2, and rule 1's other half: the throttle stamp stays set even on a
    // failed write, so a broken database is hit once a minute per owner rather
    // than once a request.
    console.error('[admin] could not record presence:', err.message);
    return false;
  }
}

function sweep(now) {
  for (const [id, at] of lastWrite) {
    if (now - at >= TOUCH_EVERY_MS) lastWrite.delete(id);
  }
  // Still full — every tracked owner was seen inside the last minute, which on
  // a floor this size means the ceiling is the wrong size, not that anything
  // leaked. Drop the whole map rather than grow past the bound; the cost is at
  // most one extra write per owner.
  if (lastWrite.size >= MAX_TRACKED) lastWrite.clear();
}

/** Express middleware. Mounted once, by installAdminRoutes. */
export function presenceMiddleware({ now = () => Date.now() } = {}) {
  return (req, _res, next) => {
    try {
      touch(ownerOf(req), { now: now() });
    } catch (err) {
      console.error('[admin] presence middleware:', err.message);
    }
    next();
  };
}

/** Drops the throttle. Tests only. */
export function _resetPresence() {
  lastWrite.clear();
}
