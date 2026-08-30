import crypto from 'crypto';

export function logAuthWarningIfNeeded() {
  if (!process.env.TELEGRAM_BOT_TOKEN && !process.env.DEV_API_SECRET) {
    console.warn('[auth] !!WARNING!! API is UNPROTECTED — set TELEGRAM_BOT_TOKEN or DEV_API_SECRET to require authentication');
  }
}

export function telegramAuthMiddleware(req, res, next) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const devSecret = process.env.DEV_API_SECRET;

  if (botToken) {
    const initData = req.headers['x-telegram-init-data'];
    if (!initData || !verifyTelegramInitData(initData, botToken)) {
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
// With a bot token configured the check is exact: initData must verify AND
// its user.id must equal the requested userId (the client sends the Telegram
// user id verbatim as userId). With only DEV_API_SECRET the shared secret is
// the whole identity. With neither, the API is open by design (local dev) and
// this returns true, matching telegramAuthMiddleware.
export function isOwner(req, userId) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const devSecret = process.env.DEV_API_SECRET;

  if (botToken) {
    const initData = req.headers['x-telegram-init-data'];
    if (!initData || !verifyTelegramInitData(initData, botToken)) return false;
    const tgId = telegramUserIdFrom(initData);
    return !!tgId && String(userId) === tgId;
  }
  if (devSecret) return req.headers['x-api-secret'] === devSecret;
  return true;
}

// Pull user.id out of a (already verified) initData string.
function telegramUserIdFrom(initData) {
  try {
    const raw = new URLSearchParams(initData).get('user');
    if (!raw) return null;
    const id = JSON.parse(raw)?.id;
    return id === undefined || id === null ? null : String(id);
  } catch {
    return null;
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
