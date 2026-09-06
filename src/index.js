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
import { attachNotify, installNotifyRoutes } from './server/notify.js';
import { installEventRoutes } from './server/events.js';
import { installShareRoutes, startInlinePolling, SHARE_BODY_LIMIT } from './server/share.js';
import { attachTicker } from './server/ticker.js';
import { installMeterRoutes } from './server/meter.js';
import { installRoomRoutes } from './server/rooms.js';
import { installRoomTableRoutes } from './server/roomTables.js';
import { installTapeRoomRoutes } from './server/tapeRoom.js';
import { installPlaceRoutes } from './server/place.js';
import { installGuestRoutes, guestsEnabled } from './server/guest.js';
import { installClaimRoute } from './server/guestClaim.js';
import { handleStart } from './server/guestBot.js';
// BUGS-B/6: /api/stats asks the registry for the floor's counts rather than
// walking the table Map itself, so "how many agents are live" has exactly one
// definition and it is not written out twice.
import * as registry from './server/tableRegistry.js';

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
// SHARE-2: the share card arrives as a base64 PNG, which does not fit inside
// express.json()'s 100kb default. Mounted first and path-scoped, so only this
// one route gets the larger ceiling; body-parser marks the request parsed, so
// the general parser below leaves it alone.
app.use('/api/share/prepare', express.json({ limit: SHARE_BODY_LIMIT }));
app.use(express.json());

// General rate limit on all API routes. Configurable via env.
const rlWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
app.use('/api', rateLimiter({ windowMs: rlWindowMs, max: Number(process.env.RATE_LIMIT_MAX ?? 60) }));

// GUEST-1: POST /api/guest, GET /api/guest/me and POST /api/guest/claim.
// Registered FIRST among the API routes because importing guest.js is what
// teaches auth.js to read a guest cookie, and every route below is gated by
// auth. All three 404 unless GUEST_ENABLED=1.
installGuestRoutes(app);
// GUEST-1 job 3: the claim is registered beside them but lives in its own file,
// because it reaches the roster and guest.js is deliberately a leaf.
installClaimRoute(app);
installAgentProfileRoutes(app);
// EVENT-1: GET /api/events?since=<id> - the floor ticker's poll. Public
// headlines only, no model call, already inside the /api rate limiter above.
installEventRoutes(app);
// SHARE-2: POST /api/share/prepare (auth + owner + 5/hour) and the public
// GET /share/<id>.png the prepared message points at. Registered here, above
// the SPA fallback, so the image is not answered with index.html.
installShareRoutes(app);
// DEEPLINK-1: the notifier's two routes, up here rather than with
// attachNotify() at the foot of this file. The mute is a POST and survived
// down there because the SPA fallback only answers GET — but the budget board
// the YOU screen reads is a GET, and a GET registered after the fallback is
// answered with index.html. Registered once, above it, and attachNotify is
// called without `app` so it does not register them a second time.
installNotifyRoutes(app);
// METER-1: GET /api/meter (the owner's own model spend, behind auth + the
// owner check) and GET /api/admin/meter?key=ADMIN_KEY (everybody's). Both are
// GETs, so like the notifier's board they have to be registered above the SPA
// fallback or they are answered with index.html. Neither triggers a model
// call; both are inside the /api rate limiter above.
installMeterRoutes(app);

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

// CASINO-2: GET /api/rooms/:id/tables — the felts inside one room, each with
// enough on it to draw a miniature of the real game. Registered here for the
// same reason and with the same properties: public snapshot, no model call,
// inside the /api rate limiter.
installRoomTableRoutes(app);

// HOME-STATE-1: POST/GET /api/agents/:id/study — the tape room and the read
// book it fills. Owner-gated, no model call, inside the /api rate limiter
// above. Registered here rather than with the other agent routes because the
// home game it takes him out of is only wired once createServer() has run.
installTapeRoomRoutes(app);

// SERVER-5 job 3: POST /api/agents/:id/place — the five fixtures in the flat,
// through one door. Registered here for the same reason the tape room is: it
// reaches the home game and the table registry, and neither exists until
// createServer() has run.
installPlaceRoutes(app);

// Load the OpenAPI spec once at startup so it can be served cheaply.
const openApiPath = path.join(__dirname, '..', 'openapi.json');
const openApiSpec = existsSync(openApiPath) ? JSON.parse(readFileSync(openApiPath, 'utf8')) : null;

// GET /api/stats — live platform metrics for the home screen and AI agent discovery.
//
// BUGS-B/6: `activeAgents` is the header pill's number — how many agents are
// SEATED on the casino floor this instant. It is counted in tableRegistry, off
// the seats themselves: not off open sockets (a watcher is not a player, and
// one owner on two devices is not two agents) and not off the roster (an agent
// that exists is not an agent that is playing). Home games are somebody's
// living room and are not the casino, so they are out of both figures.
//
// Every field is ALWAYS a number. A client with no number to print has nothing
// to show but a dash, so a thrown counter answers 0 rather than nothing —
// "nobody is playing" is a fact; "—" is a broken pill.
app.get('/api/stats', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let activeTables = 0;
  let activeAgents = 0;
  try {
    activeTables = registry.activeFloorTableCount();
    activeAgents = registry.seatedAgentCount();
  } catch (err) {
    console.error('[ai-poker] floor count failed:', err.message);
  }
  let totalAgents = 0;
  let handsPlayedToday = 0;
  try {
    ({ totalAgents, handsPlayedToday } = getProfileStats());
  } catch (err) {
    console.error('[ai-poker] profile stats failed:', err.message);
  }
  res.json({
    activeTables,
    // The floor, deduped by agent. This is "N agents live".
    activeAgents,
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
  // GUEST-1: `guest` says whether this deployment has the no-account door open.
  // The client asks the same question the login gate already asks, on the same
  // request, so a browser with no session knows whether to draft a guest or to
  // put the Login Widget up — and never renders a "play without an account"
  // button on a server that would 404 it.
  res.json({
    botUsername: (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, ''),
    guest: guestsEnabled(),
  });
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
// the legacy NOTIFY_ENABLED sender into it. Everything it does from here is
// out-of-band — the bus subscription, the restart flush, the timers — and it
// sends nothing at all unless NOTIFY_ENABLED is set. Its HTTP routes are NOT
// registered here: they went in above the SPA fallback (DEEPLINK-1), which is
// where a GET has to be to reach anything.
attachNotify();

// SHARE-2: answer inline queries for the same cards. No-op without a bot
// token, and SHARE_INLINE=0 turns it off on a deployment that would rather
// drive the bot's updates some other way.
//
// GUEST-1 job 5: and `/start guest_<token>`, the other end of the claim wall's
// deep link, rides the SAME loop. Only one process may poll getUpdates per bot
// token, so a second poller would not be a second feature — it would be a race
// for the same updates in which inline sharing intermittently stops working.
startInlinePolling({ onMessage: (message, ctx) => handleStart(message, ctx) });

// EVENTS-3: the public channel. Silent unless TICKER_ENABLED is set and
// TICKER_CHANNEL_ID names a chat. `liveTables` is how a tableId becomes a room
// name ("in the back room") — the same registry the floor and the lobby read,
// handed over as the two-line provider the ticker asks for so nothing in it
// imports table.js.
attachTicker({ liveTables: { getTable: (id) => tables.get(id) ?? null } });
