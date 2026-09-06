// In-memory sliding-window rate limiter. No external dependencies.
// Each call to rateLimiter() returns an independent middleware with its own
// per-IP tracking window. Configurable via windowMs and max.

// GUEST-1 adds `key`: how a request is turned into the thing being counted.
// The default is what it always was — the socket's address — and every existing
// caller keeps it. The guest routes pass their own, because behind a TLS
// terminator every socket has the same address and a per-IP limiter keyed on
// it is a per-SITE limiter wearing a per-IP name. See guest.clientIp().
export function rateLimiter({ windowMs = 60_000, max = 60, message = 'Too many requests', key = null } = {}) {
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
