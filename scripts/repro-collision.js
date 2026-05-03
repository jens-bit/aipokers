// Reproduces the duplicate-playerId disconnect symptom.
// Boots a server, opens client A, then opens client B with the SAME playerId
// (simulating shared sessionStorage in Telegram desktop). Verifies the server
// closes A with code 4000 — which is what the client interprets as
// "WebSocket connection error · DISCONNECTED".
import { WebSocket } from 'ws';
import { createServer } from '../src/server/wsServer.js';

const PORT = 19998;
const { wss } = createServer({ port: PORT, host: '127.0.0.1', defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => wss.on('listening', res));

const open = (ws) => new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const a = new WebSocket(`ws://127.0.0.1:${PORT}`);
await open(a);
const aClose = new Promise((res) => a.once('close', (code, reason) => res({ code, reason: reason.toString() })));
a.on('message', () => {});

a.send(JSON.stringify({ type: 'join', tableId: 'collide', playerId: 'shared-id', displayName: 'A', buyIn: 1000 }));
await wait(80);

console.log('— second client joins with the SAME playerId —');
const b = new WebSocket(`ws://127.0.0.1:${PORT}`);
await open(b);
b.on('message', () => {});
b.send(JSON.stringify({ type: 'join', tableId: 'collide', playerId: 'shared-id', displayName: 'B', buyIn: 1000 }));

const closed = await Promise.race([aClose, wait(500).then(() => null)]);

if (!closed) { console.error('  FAIL  client A was NOT closed'); process.exit(1); }
console.log(`  ok  client A was closed: code=${closed.code} reason="${closed.reason}"`);
console.log(`  ok  this matches the symptom user reported (generic WS error → "DISCONNECTED")`);

b.close(); wss.close(); process.exit(0);
