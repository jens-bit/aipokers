import { createServer } from './server/wsServer.js';

const port = Number(process.env.PORT ?? 8765);
const host = process.env.HOST ?? '0.0.0.0';
const smallBlind = Number(process.env.SMALL_BLIND ?? 10);
const bigBlind = Number(process.env.BIG_BLIND ?? 20);

const { wss } = createServer({ port, host, defaultBlinds: { smallBlind, bigBlind } });

wss.on('listening', () => {
  console.log(`[ai-poker] WebSocket server listening on ws://${host}:${port}`);
  console.log(`[ai-poker] default blinds: SB=${smallBlind} BB=${bigBlind}`);
});

const shutdown = (signal) => {
  console.log(`[ai-poker] received ${signal}, shutting down`);
  wss.close(() => process.exit(0));
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
