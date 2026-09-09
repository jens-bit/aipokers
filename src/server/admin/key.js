// src/server/admin/key.js — ADMIN-1 jobs 2 and 5
//
// The one credential this dashboard has, and the four rules it lives under.
//
//   1. THE KEY TRAVELS IN A HEADER, NEVER IN A URL. GET /api/admin/meter takes
//      it as ?key= (METER-1) and that was already the wrong place: a URL is
//      written to every access log, every proxy log, every browser history and
//      every Referer header a page it links to sends. The dashboard's own
//      routes take x-admin-key and nothing else. The meter's query parameter is
//      not changed here — it is a public documented route with a caller — but
//      nothing new is added to it.
//   2. WITH ADMIN_KEY UNSET THE ROUTES DO NOT EXIST. A 404, not a 403, exactly
//      as the meter answers: a deployment that never configured a dashboard
//      should not advertise that it has one.
//   3. NOTHING IS LOGGED. Not the key, not a prefix of it, not its length, and
//      not the owner ids that come back in the response. There is no console
//      line in this file or in the routes it guards, because a log line is the
//      one way a credential escapes a process that never meant to leak it.
//   4. IT IS RATE LIMITED PER KEY, NOT PER IP. Six a minute is ten times what
//      the page needs (it refreshes once a minute) and it is a hard ceiling on
//      how fast a wrong key can be guessed. Keyed on a HASH of what was
//      presented, so the limiter's own Map never holds a credential and a
//      wrong key gets its own bucket rather than exhausting the real one's.

import crypto from 'node:crypto';

import { rateLimiter } from '../rateLimit.js';

// Rule 4. The page fetches three endpoints once a minute and each has its own
// window, so this is the ceiling on ONE endpoint: a hand-refresh or two on top
// of the automatic one is comfortable, a script is not.
export const ADMIN_MAX_PER_MIN = 6;

export const ADMIN_HEADER = 'x-admin-key';

/** The configured key, or '' when there is none. Read per request so a restart
 *  is not needed to configure one, and never cached anywhere. */
export function adminKey() {
  return process.env.ADMIN_KEY || '';
}

// Constant-time and length-safe. timingSafeEqual throws on a length mismatch,
// which would itself be an oracle if it were allowed to answer faster — the
// same comparison meter.js already makes, for the same reason.
export function keyMatches(given, expected) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(String(expected ?? ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Rule 4's other half: what the limiter counts. A hash, so the Map holds no
// credential; salted per process, so two deployments' buckets are not the same
// string and nothing on disk can be compared against it.
const SALT = crypto.randomBytes(16);
function limiterKey(req) {
  const given = String(req?.headers?.[ADMIN_HEADER] ?? '');
  return `k:${crypto.createHash('sha256').update(SALT).update(given).digest('hex').slice(0, 24)}`;
}

/**
 * One endpoint's guard: its own 6-a-minute window, then the key check.
 *
 * The limiter runs FIRST and is keyed on what was presented rather than on
 * whether it was right, which is what makes it a ceiling on guessing. Each
 * call to this function builds an independent window, so the three endpoints
 * the page fetches do not share a budget.
 */
export function adminGuard({ max = ADMIN_MAX_PER_MIN, windowMs = 60_000 } = {}) {
  const limit = rateLimiter({ windowMs, max, key: limiterKey, message: 'Too many admin requests' });

  return (req, res, next) => limit(req, res, () => {
    const expected = adminKey();
    // Rule 2.
    if (!expected) return res.status(404).json({ error: 'Not found' });
    // Rule 1: the header, and only the header. A key in the query string is
    // not read here even if somebody puts one there.
    if (!keyMatches(req.headers?.[ADMIN_HEADER], expected)) return res.status(403).json({ error: 'Forbidden' });
    // Rule 3: no log line, on either branch.
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}
