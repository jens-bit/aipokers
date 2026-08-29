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
