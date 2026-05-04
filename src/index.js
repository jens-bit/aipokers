import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from './server/wsServer.js';
import { installAgentProfileRoutes } from './server/agentProfiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, '..', 'client', 'dist');

const port = Number(process.env.PORT ?? 8765);
const host = process.env.HOST ?? '0.0.0.0';
const smallBlind = Number(process.env.SMALL_BLIND ?? 10);
const bigBlind = Number(process.env.BIG_BLIND ?? 20);

const app = express();
app.use(express.json({ limit: '64kb' }));
installAgentProfileRoutes(app);

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

const httpServer = http.createServer(app);
const { wss } = createServer({
  server: httpServer,
  defaultBlinds: { smallBlind, bigBlind },
});

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
