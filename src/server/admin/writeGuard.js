// src/server/admin/writeGuard.js — ADMIN-2
//
// The write panel's own guard, alongside key.js's read one rather than
// instead of it. Same credential, same header, same "unset means the route
// does not exist" rule — nothing here weakens what key.js already checks,
// it reuses key.js's own adminKey()/keyMatches() so there is exactly one
// place that knows what the key IS, and layers three things read requests
// do not need:
//
//   1. ITS OWN RATE WINDOW, separate from and tighter than the read one.
//      key.js's ADMIN_MAX_PER_MIN=6 is a page-refresh budget; a write is a
//      deliberate, rare act, so its ceiling is lower and its own Map — a
//      burst of writes must never spend the read page's budget, and vice
//      versa.
//   2. KEYED ON THE CLIENT, NOT THE KEY. key.js's own limiter hashes the
//      PRESENTED key so a wrong guess gets its own bucket. That is the
//      right shape for "how fast can a key be guessed", but it is the wrong
//      shape for "how fast can a shared key hurt something" — every
//      legitimate user of one shared ADMIN_KEY would share one bucket. This
//      one keys on the real client address instead (guest.js's clientIp(),
//      which reads X-Forwarded-For rather than the proxy's own socket
//      address — see its own header for why that distinction matters
///     behind a reverse proxy), so one careless or compromised client
//      cannot exhaust the budget for every other admin session.
//   3. A DIFFERENT WRONG-KEY STATUS. 401, not key.js's 403 — ADMIN-2 asked
//      for it explicitly for the write surface. The read guard is
//      unchanged; this is a new, stricter guard beside it, not the same one
//      weakened or loosened.
//
// Nothing here is logged, for the same reason nothing in key.js is: a log
// line is the one way a credential escapes a process that never meant to
// leak it.

import { rateLimiter } from '../rateLimit.js';
import { adminKey, keyMatches, ADMIN_HEADER } from './key.js';
import { clientIp } from '../guest.js';

// A write is a deliberate act, not a page refresh — a third of the read
// budget, on its own window.
export const ADMIN_WRITE_MAX_PER_MIN = 3;

function writeLimiterKey(req) {
  return `wk:${clientIp(req)}`;
}

export function adminWriteGuard({ max = ADMIN_WRITE_MAX_PER_MIN, windowMs = 60_000 } = {}) {
  const limit = rateLimiter({ windowMs, max, key: writeLimiterKey, message: 'Too many admin write requests' });

  return (req, res, next) => limit(req, res, () => {
    const expected = adminKey();
    // Rule: unset means the route does not exist, exactly as the read guard.
    if (!expected) return res.status(404).json({ error: 'Not found' });
    // ADMIN-2's own status for the write surface.
    if (!keyMatches(req.headers?.[ADMIN_HEADER], expected)) return res.status(401).json({ error: 'Unauthorized' });
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
}
