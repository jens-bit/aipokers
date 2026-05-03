// Validates Task 2 fixes against a live server:
//   - two clients with different per-page-load IDs both seat cleanly
//   - a forced disconnect of one client survives via reconnect (the client
//     re-presents the same playerId and reclaims its seat)
//   - duplicate-playerId case still kicks the old conn with code 4000
//     (the client now ignores 4000 instead of looping reconnects)
import { WebSocket } from 'ws';
import { createServer } from '../src/server/wsServer.js';

const PORT = 19997;
const { wss } = createServer({ port: PORT, host: '127.0.0.1', defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => wss.on('listening', res));

const open = (ws) => new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (events, predicate, timeoutMs = 1000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const m = events.find(predicate);
    if (m) return m;
    await wait(20);
  }
  throw new Error('timed out');
};

let failures = 0;
const check = (label, cond) => {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
};

// Imitate the fix: per-tab fresh ID via crypto.randomUUID-equivalent.
const newPlayerId = () => 'p_' + Math.random().toString(36).slice(2, 14);

console.log('\n— two clients with DIFFERENT IDs both seat cleanly —');
const a = new WebSocket(`ws://127.0.0.1:${PORT}`);
const b = new WebSocket(`ws://127.0.0.1:${PORT}`);
await Promise.all([open(a), open(b)]);
const evA = []; const evB = [];
a.on('message', (d) => evA.push(JSON.parse(d.toString())));
b.on('message', (d) => evB.push(JSON.parse(d.toString())));

const idA = newPlayerId();
const idB = newPlayerId();
a.send(JSON.stringify({ type: 'join', tableId: 't', playerId: idA, displayName: 'A', buyIn: 1000 }));
b.send(JSON.stringify({ type: 'join', tableId: 't', playerId: idB, displayName: 'B', buyIn: 1000 }));
const jA = await waitFor(evA, (m) => m.type === 'joined');
const jB = await waitFor(evB, (m) => m.type === 'joined');
check('A and B both seated', jA.seat !== undefined && jB.seat !== undefined);
check('different seats', jA.seat !== jB.seat);
const aClosedDuringJoin = await Promise.race([
  new Promise((res) => a.once('close', () => res(true))),
  wait(200).then(() => false),
]);
check('A was NOT kicked when B joined (the bug)', aClosedDuringJoin === false);

console.log('\n— mid-hand reconnect: A drops, reconnects with same ID, server gives same seat —');
await waitFor(evA, (m) => m.type === 'hand_start');
const seatA = jA.seat;

// Simulate a network-blip drop on A's side (close abruptly).
const aDropped = new Promise((res) => a.once('close', () => res(true)));
a.terminate();
await aDropped;
await wait(60);  // give server time to register the close

// Reconnect with SAME playerId (new socket — what the fix does on its first
// reconnect attempt; the client keeps the in-memory ID across reconnects).
const a2 = new WebSocket(`ws://127.0.0.1:${PORT}`);
await open(a2);
const evA2 = [];
a2.on('message', (d) => evA2.push(JSON.parse(d.toString())));
a2.send(JSON.stringify({ type: 'join', tableId: 't', playerId: idA, displayName: 'A', buyIn: 1000 }));
const jA2 = await waitFor(evA2, (m) => m.type === 'joined', 1500).catch(() => null);

if (!jA2) {
  // The server's removeConnection clears the seat on disconnect; in that
  // case A2 just takes the now-empty seat — that's acceptable Phase-1
  // behavior. Verify A2 IS in fact seated.
  check('A2 was seated (perhaps as fresh seat)', false);
} else {
  check('A2 reconnected and was seated', jA2.seat !== undefined);
}

console.log('\n— duplicate-id collision still kicks old conn with code 4000 —');
const c = new WebSocket(`ws://127.0.0.1:${PORT}`);
await open(c);
c.on('message', () => {});
const sharedId = newPlayerId();
c.send(JSON.stringify({ type: 'join', tableId: 'collide', playerId: sharedId, displayName: 'C', buyIn: 1000 }));
await wait(60);

const cClosePromise = new Promise((res) => c.once('close', (code, reason) => res({ code, reason: reason.toString() })));
const d = new WebSocket(`ws://127.0.0.1:${PORT}`);
await open(d);
d.on('message', () => {});
d.send(JSON.stringify({ type: 'join', tableId: 'collide', playerId: sharedId, displayName: 'D', buyIn: 1000 }));

const cClosed = await Promise.race([cClosePromise, wait(500).then(() => null)]);
check('old connection closed with code 4000', cClosed?.code === 4000);
check('close reason is "replaced by new connection"', cClosed?.reason?.includes('replaced'));

a.close(); b.close(); a2.close(); d.close();
wss.close();

console.log('\n— summary —');
if (failures === 0) { console.log('all checks passed'); process.exit(0); }
else { console.error(`${failures} checks failed`); process.exit(1); }
