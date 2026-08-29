// In-memory sliding-window rate limiter. No external dependencies.
// Each call to rateLimiter() returns an independent middleware with its own
// per-IP tracking window. Configurable via windowMs and max.

export function rateLimiter({ windowMs = 60_000, max = 60, message = 'Too many requests' } = {}) {
  const windows = new Map(); // ip -> number[]

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
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
