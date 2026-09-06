import crypto from 'crypto';

// AUTH-1: one credential header (x-telegram-init-data), two signature schemes.
//   1. Mini App initData  — HMAC key = HMAC_SHA256("WebAppData", botToken)
//   2. Login Widget       — HMAC key = SHA256(botToken)
// Both carry the same Telegram user id, so a user sees the same agents in the
// Mini App and on the web. Everything that consumes the credential goes
// through verifyTelegramCredential(); nothing else parses the string.

// Web session length: a Login Widget payload is accepted until its auth_date
// is this old. initData has no such age check (Telegram reissues it per launch).
const LOGIN_MAX_AGE_S = Number(process.env.LOGIN_MAX_AGE_S ?? 30 * 24 * 60 * 60);

// ── GUEST-1 · the third door ─────────────────────────────────────────────────
//
// Two doors existed: Mini App initData and the web Login Widget. Both are
// Telegram, both are signed by the bot token, and both answer the same
// question — "which Telegram user is this". The third door answers a different
// one: "which guest is this", where a guest is an owner with no account behind
// him, holding an httpOnly cookie the server minted.
//
// WHY A RESOLVER RATHER THAN AN IMPORT. guest.js reaches agentProfiles.js (the
// claim moves a roster; the nightly pass retires one) and agentProfiles.js
// imports this file. Importing guest.js from here would close that ring, and a
// cycle through a module whose top level runs is a load-order bug waiting for
// the day somebody imports the three in a different sequence. So the arrow
// points one way — guest.js hands its resolver in, exactly as tableRegistry is
// handed to agentProfiles and the floor is handed to homeGame.
//
// Until something registers one, `guestOwnerFrom` answers null and every path
// below behaves exactly as it did before this tree: a deployment that never
// imports guest.js has no guest door, which is what GUEST_ENABLED=0 means.

let guestResolver = null;

/**
 * Teach auth how to read a guest credential. `resolver(req)` returns the guest
 * owner id this request carries, or null. Called once, by guest.js.
 */
export function setGuestResolver(resolver) {
  guestResolver = typeof resolver === 'function' ? resolver : null;
}

/** The guest owner id behind this request, or null. Never throws. */
export function guestOwnerFrom(req) {
  if (!guestResolver || !req) return null;
  try {
    const ownerId = guestResolver(req);
    return ownerId ? String(ownerId) : null;
  } catch (err) {
    console.error('[auth] guest resolver failed:', err.message);
    return null;
  }
}

export function logAuthWarningIfNeeded() {
  if (!process.env.TELEGRAM_BOT_TOKEN && !process.env.DEV_API_SECRET) {
    console.warn('[auth] !!WARNING!! API is UNPROTECTED — set TELEGRAM_BOT_TOKEN or DEV_API_SECRET to require authentication');
  }
}

export function telegramAuthMiddleware(req, res, next) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const devSecret = process.env.DEV_API_SECRET;

  // GUEST-1: checked FIRST, and it is a pass rather than a reject. A guest
  // carries no Telegram credential and never will, so leaving him to the
  // schemes below would be a 401 on every route in the product. A request that
  // presents no guest cookie falls straight through to the two doors that
  // existed before, unchanged.
  if (guestOwnerFrom(req)) return next();

  if (botToken) {
    const credential = req.headers['x-telegram-init-data'];
    if (!credential || !verifyTelegramCredential(credential, botToken)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  }

  if (devSecret) {
    if (req.headers['x-api-secret'] !== devSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return next();
  }

  // Neither token configured — local dev, allow all.
  next();
}

// AGE-37: non-blocking ownership check, for endpoints that stay public but
// carry private per-agent fields (hole cards on the floor). Unlike the
// middleware this never rejects — it answers "is this caller provably the
// owner of `userId`?" and the route decides what to include.
//
// With a bot token configured the check is exact: the credential must verify
// (either scheme) AND its Telegram user id must equal the requested userId
// (the client sends the Telegram user id verbatim as userId). With only
// DEV_API_SECRET the shared secret is the whole identity. With neither, the
// API is open by design (local dev) and this returns true, matching
// telegramAuthMiddleware.
export function isOwner(req, userId) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const devSecret = process.env.DEV_API_SECRET;

  // GUEST-1: the cookie is an EXACT check like the Telegram one — the owner id
  // it resolves to must be the owner id being asked about. A guest holding
  // somebody else's id in the query string is not that somebody.
  //
  // First, and before the dev-mode "return true" at the foot: a guest asking
  // about an id that is not his must be refused on a keyless dev box too, or
  // the guest limits could be walked around by editing a query parameter.
  const guestId = guestOwnerFrom(req);
  if (guestId) return String(userId) === guestId;

  if (botToken) {
    const credential = req.headers['x-telegram-init-data'];
    if (!credential || !verifyTelegramCredential(credential, botToken)) return false;
    const tgId = telegramUserIdFrom(credential);
    return !!tgId && String(userId) === tgId;
  }
  if (devSecret) return req.headers['x-api-secret'] === devSecret;
  return true;
}

// Pull the Telegram user id out of an (already verified) credential string.
// initData nests it in a `user` JSON blob; the Login Widget puts the fields
// at the top level, so `id` is read directly.
export function telegramUserIdFrom(credential) {
  try {
    const params = new URLSearchParams(credential);
    const raw = params.get('user');
    if (raw) {
      const id = JSON.parse(raw)?.id;
      return id === undefined || id === null ? null : String(id);
    }
    const topLevel = params.get('id');
    return topLevel ? String(topLevel) : null;
  } catch {
    return null;
  }
}

// The single entry point every credential consumer calls. Tries the Mini App
// initData scheme first (the common case, and the only one that can carry a
// `user` field), then the Login Widget scheme for a payload that looks like
// one: top-level `id`, no `user`. A widget-signed string can never satisfy the
// initData HMAC and vice versa, so the order is a fast path, not a fallback
// that weakens either check.
export function verifyTelegramCredential(credential, botToken) {
  if (!credential || !botToken) return false;
  if (verifyTelegramInitData(credential, botToken)) return true;
  if (!looksLikeLoginPayload(credential)) return false;
  return verifyTelegramLoginPayload(credential, botToken);
}

function looksLikeLoginPayload(credential) {
  try {
    const params = new URLSearchParams(credential);
    return params.get('id') !== null && params.get('user') === null;
  } catch {
    return false;
  }
}

// Telegram Login Widget payload — the fields Telegram hands to data-onauth
// (id, first_name, last_name?, username?, photo_url?, auth_date, hash),
// serialised as a URLSearchParams string. Key = SHA256(botToken), NOT the
// "WebAppData" HMAC used for initData.
// https://core.telegram.org/widgets/login#checking-authorization
export function verifyTelegramLoginPayload(payload, botToken) {
  try {
    const params = new URLSearchParams(payload);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');

    const authDate = Number(params.get('auth_date'));
    if (!Number.isFinite(authDate)) return false;
    const ageS = Math.floor(Date.now() / 1000) - authDate;
    if (ageS > LOGIN_MAX_AGE_S) return false;

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(hash.length === computedHash.length ? hash : computedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verifyTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return false;
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const a = Buffer.from(computedHash, 'hex');
    const b = Buffer.from(hash.length === computedHash.length ? hash : computedHash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export { verifyTelegramInitData };
