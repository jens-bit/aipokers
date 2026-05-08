import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from './server/wsServer.js';
import { installAgentProfileRoutes, getProfileStats } from './server/agentProfiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '..', 'client', 'dist');

const port = Number(process.env.PORT ?? 8765);
const host = process.env.HOST ?? '0.0.0.0';
const smallBlind = Number(process.env.SMALL_BLIND ?? 10);
const bigBlind = Number(process.env.BIG_BLIND ?? 20);

const app = express();
app.use(express.json());
installAgentProfileRoutes(app);

// Build the HTTP server and attach WebSocket before registering the remaining
// routes so that the tables Map is in scope for /api/stats.
const httpServer = http.createServer(app);
const { wss, tables } = createServer({
  server: httpServer,
  defaultBlinds: { smallBlind, bigBlind },
});

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

// GET /openapi.json — OpenAPI 3.0 spec, CORS-open for AI agent discovery.
if (openApiSpec) {
  app.get('/openapi.json', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSpec);
  });
}

if (existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { extensions: ['html'] }));
  // SPA fallback: any unmatched GET serves index.html so deep links and
  // browser refresh on client-side routes load the app instead of 404ing.
  // Real /assets/* requests are handled by express.static above; only paths
  // it didn't resolve fall through to here.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
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
