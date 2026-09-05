import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from './server/wsServer.js';
import { installAgentProfileRoutes, getProfileStats } from './server/agentProfiles.js';
import { readHands } from './server/handHistory.js';
import { logAuthWarningIfNeeded, telegramAuthMiddleware, telegramUserIdFrom } from './server/auth.js';
import { rateLimiter } from './server/rateLimit.js';
import { openStore } from './server/store.js';
import { attachNotify } from './server/notify.js';
import { installEventRoutes } from './server/events.js';
import { installRoomRoutes } from './server/rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '..', 'client', 'dist');
const PUBLIC_DIR = path.join(__dirname, '..', 'client', 'public');

const port = Number(process.env.PORT ?? 8765);
const host = process.env.HOST ?? '0.0.0.0';
const smallBlind = Number(process.env.SMALL_BLIND ?? 10);
const bigBlind = Number(process.env.BIG_BLIND ?? 20);

// SQLITE-1: open (and, on the first boot after the cutover, migrate) the
// store before anything can serve a request. Doing it here means the migration
// log lands at startup and a failed import stops the process instead of
// surfacing halfway through someone's session.
console.log(`[ai-poker] store: ${openStore()}`);

const app = express();
app.use(express.json());

// General rate limit on all API routes. Configurable via env.
const rlWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
app.use('/api', rateLimiter({ windowMs: rlWindowMs, max: Number(process.env.RATE_LIMIT_MAX ?? 60) }));

installAgentProfileRoutes(app);
// EVENT-1: GET /api/events?since=<id> - the floor ticker's poll. Public
// headlines only, no model call, already inside the /api rate limiter above.
installEventRoutes(app);

// Build the HTTP server and attach WebSocket before registering the remaining
// routes so that the tables Map is in scope for /api/stats.
const httpServer = http.createServer(app);
const { wss, tables } = createServer({
  server: httpServer,
  defaultBlinds: { smallBlind, bigBlind },
});

// ROOMS-1: GET /api/rooms — the floor grouped by stakes tier. Registered after
// createServer() because that is where the table registry is wired into
// rooms.js. Public counts only, no model call, inside the /api rate limiter.
installRoomRoutes(app);

// Load the OpenAPI spec once at startup so it can be served cheaply.
const openApiPath = path.join(__dirname, '..', 'openapi.json');
const openApiSpec = existsSync(openApiPath) ? JSON.parse(readFileSync(openApiPath, 'utf8')) : null;

// GET /api/stats — live platform metrics for the home screen and AI agent discovery.
app.get('/api/stats', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let activeTables = 0;
  const activeAgentIds = new Set();
  for (const table of tables.values()) {
    if (table.game !== null) activeTables++;
    for (let i = 0; i < table.aiSeats.length; i++) {
      if (table.aiSeats[i] && table.agentIds[i]) activeAgentIds.add(table.agentIds[i]);
    }
  }
  const { totalAgents, handsPlayedToday } = getProfileStats();
  res.json({
    activeTables,
    activeAgents: activeAgentIds.size,
    handsPlayedToday,
    totalAgents,
    timestamp: new Date().toISOString(),
  });
});

// AUTH-1 — GET /api/auth/config: what the web login gate needs to render the
// Telegram Login Widget. Empty botUsername means web login is not configured
// on this deployment; the client says so rather than showing a dead button.
// Public: the bot username is public information, nothing secret is exposed.
app.get('/api/auth/config', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ botUsername: (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '') });
});

// AUTH-1 — GET /api/auth/me: is the credential this browser holds still good?
// The gate calls it on load; a 401 means the stored web login expired and the
// widget goes back up. Returns the Telegram user id behind either scheme.
app.get('/api/auth/me', telegramAuthMiddleware, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ userId: telegramUserIdFrom(req.headers['x-telegram-init-data'] || '') });
});

// GET /api/history/:userId — last 20 completed hands for a user, newest first.
app.get('/api/history/:userId', (req, res) => {
  const hands = readHands(req.params.userId, 20);
  res.json(hands);
});

// GET /openapi.json — OpenAPI 3.0 spec, CORS-open for AI agent discovery.
if (openApiSpec) {
  app.get('/openapi.json', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSpec);
  });
}

// GET /welcome — serve the landing page (static, no framework).
// Prefer the built copy from client/dist; fall back to client/public for
// dev / WS-only mode. Must be registered before the SPA static fallback
// so it is not swallowed by the catch-all index.html route.
app.get('/welcome', (_req, res) => {
  const built = path.join(STATIC_DIR, 'welcome', 'index.html');
  const source = path.join(PUBLIC_DIR, 'welcome', 'index.html');
  res.setHeader('Cache-Control', 'no-store');  // CACHE-2: Telegram caches index files
  res.sendFile(existsSync(built) ? built : source);
});

if (existsSync(STATIC_DIR)) {
  // CACHE-2: hashed /assets/* are immutable forever; index.html must never
  // be cached so Telegram's webview always fetches the latest entry point.
  app.use(express.static(STATIC_DIR, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }));
  // SPA fallback: any unmatched GET serves index.html so deep links and
  // browser refresh on client-side routes load the app instead of 404ing.
  // Real /assets/* requests are handled by express.static above; only paths
  // it didn't resolve fall through to here.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.setHeader('Cache-Control', 'no-store');  // CACHE-2
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
} else {
  console.warn(`[ai-poker] no client bundle at ${STATIC_DIR} — running WS-only`);
  app.get('/', (_req, res) => {
    res
      .type('text/plain')
      .send('AI Poker server — WS only. Build the client (cd client && npm run build) to serve the UI from this origin.');
  });
}

httpServer.listen(port, host, () => {
  console.log(`[ai-poker] http + ws server listening on ${host}:${port}`);
  console.log(`[ai-poker] default blinds: SB=${smallBlind} BB=${bigBlind}`);
  if (existsSync(STATIC_DIR)) console.log(`[ai-poker] serving client from ${STATIC_DIR}`);
  logAuthWarningIfNeeded();
});

const shutdown = (signal) => {
  console.log(`[ai-poker] received ${signal}, shutting down`);
  wss.close();
  httpServer.close(() => process.exit(0));
  // Hard exit if graceful close hangs.
  setTimeout(() => process.exit(1), 5000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// NOTIFY-1/2: the Telegram push notifier — the only one, since NOTIFY-2 folded
// the legacy NOTIFY_ENABLED sender into it. Last line on purpose: it registers
// POST /api/agents/:id/notify, and the SPA fallback above only answers GET, so
// a POST still reaches it. Everything else it does is out-of-band, and it
// sends nothing at all unless NOTIFY_ENABLED is set.
attachNotify({ app });
