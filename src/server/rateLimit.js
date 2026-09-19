import { BlockList, isIP } from 'node:net';

// In-memory sliding-window rate limiter. No external dependencies.
// Each call to rateLimiter() returns an independent middleware with its own
// per-IP tracking window. Configurable via windowMs and max.

// MONEY-1 separated clients behind the TLS proxy instead of charging every
// visitor to one socket budget. BUG-250 also validates who supplied that
// forwarding header. This is an IP budget, not an owner authentication check.
function canonicalIp(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  const family = isIP(raw);
  if (!family || raw.includes('%')) return null;
  if (family === 4) return raw;
  const ipv6 = new URL(`http://[${raw}]/`).hostname.slice(1, -1);
  // One key for IPv4 clients whether Node reports an IPv4 or mapped socket.
  const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(ipv6);
  if (!mapped) return ipv6;
  const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}

// Trust only the local TLS proxy by default. Deployments with remote proxies
// must name their exact IPs/CIDRs; an empty setting disables forwarding.
// This does not change Express's protocol/hostname or authentication behavior.
export function createClientIp({ trustedProxies = '127.0.0.0/8,::1/128' } = {}) {
  const trusted = new BlockList();
  for (const entry of trustedProxies.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [address, prefix, extra] = entry.split('/');
    const family = isIP(address);
    if (!family || extra !== undefined || (prefix !== undefined && !/^\d+$/.test(prefix))) {
      throw new Error('TRUSTED_PROXY_CIDRS must contain only IP addresses or CIDRs');
    }
    const type = family === 4 ? 'ipv4' : 'ipv6';
    if (prefix === undefined) trusted.addAddress(address, type);
    else trusted.addSubnet(address, Number(prefix), type);
  }
  const isTrusted = (ip) => trusted.check(ip, isIP(ip) === 4 ? 'ipv4' : 'ipv6');
  return (req) => {
    let ip = canonicalIp(req?.socket?.remoteAddress);
    if (!ip) return null;
    if (!isTrusted(ip)) return ip;
    const header = req?.headers?.['x-forwarded-for'];
    if (typeof header !== 'string') return ip;
    // Proxies append to the right. Stop at the first untrusted sender; the
    // remaining left-hand text may have been supplied by that sender.
    for (const hop of header.split(',').reverse()) {
      if (!isTrusted(ip)) break;
      const candidate = canonicalIp(hop);
      if (!candidate) break;
      ip = candidate;
    }
    return ip;
  };
}

export const clientIp = createClientIp({ trustedProxies: process.env.TRUSTED_PROXY_CIDRS });

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
