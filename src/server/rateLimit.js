// In-memory sliding-window rate limiter. No external dependencies.
// Each call to rateLimiter() returns an independent middleware with its own
// per-IP tracking window. Configurable via windowMs and max.

// GUEST-1 added `key`: how a request is turned into the thing being counted.
// The guest routes passed their own, because behind a TLS terminator every
// socket has the same address and a per-IP limiter keyed on it is a per-SITE
// limiter wearing a per-IP name.
//
// MONEY-1 job 4 — THAT IS NOW THE DEFAULT, because the sentence above was true
// of every other limiter in the building too and only the guest routes had been
// told.
//
// This is the measured cause of "Could not read your safe". `trust proxy` is
// not set on this app (deliberately — see guest.js), so `req.ip` behind nginx
// is the proxy's own address for EVERY user, and src/index.js's 60-a-minute
// `/api` limiter was therefore a 60-a-minute limit for the whole site. A Mini
// App that polls the roster, the floor and the home on 10- and 30-second timers
// burns that between a handful of people, and the wallet read is simply
// whichever request happened to be unlucky. Probed against the real middleware
// stack: 26 of 90 wallet reads came back `429 {"error":"Too many requests"}`,
// and the route itself never threw once.
//
// Keying on the forwarded address makes every limiter mean what its name says.
// Note what it does to the CHAT limiter (agentProfiles.js, 10/min, the guard on
// model spend): that becomes ten a minute PER OWNER rather than ten a minute
// across the whole site, which is the reading its own comment always described
// — and the site-wide bound on model spend is MAX_CONCURRENT_TABLES and the
// meter, not this.
export function clientIp(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) return forwarded;
  return req?.ip || req?.socket?.remoteAddress || null;
}

export function rateLimiter({ windowMs = 60_000, max = 60, message = 'Too many requests', key = clientIp } = {}) {
  const windows = new Map(); // key -> number[]

  return (req, res, next) => {
    const ip = (key ? key(req) : null) || req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const cutoff = now - windowMs;

    let hits = windows.get(ip);
    if (!hits) {
      hits = [];
      windows.set(ip, hits);
    }

    // Evict timestamps older than the current window.
    let i = 0;
    while (i < hits.length && hits[i] <= cutoff) i++;
    if (i > 0) hits.splice(0, i);

    if (hits.length >= max) {
      return res.status(429).json({ error: message });
    }

    hits.push(now);
    next();
  };
}
