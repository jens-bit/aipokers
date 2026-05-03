// End-to-end WebSocket smoke test. Boots a server in-process, opens two
// client sockets, drives a hand and verifies no auto-deal happens, then
// confirms DEAL starts the next hand.
import { WebSocket } from 'ws';
import { createServer } from '../src/server/wsServer.js';

const PORT = 19999;
const { wss } = createServer({ port: PORT, host: '127.0.0.1', defaultBlinds: { smallBlind: 10, bigBlind: 20 } });

await new Promise((res) => wss.on('listening', res));

const open = (ws) => new Promise((res, rej) => {
  ws.once('open', res);
  ws.once('error', rej);
});

const a = new WebSocket(`ws://127.0.0.1:${PORT}`);
const b = new WebSocket(`ws://127.0.0.1:${PORT}`);
await Promise.all([open(a), open(b)]);

const eventsA = [];
const eventsB = [];
a.on('message', (d) => eventsA.push(JSON.parse(d.toString())));
b.on('message', (d) => eventsB.push(JSON.parse(d.toString())));

const send = (ws, msg) => ws.send(JSON.stringify(msg));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (events, predicate, timeoutMs = 1000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (events.find(predicate)) return;
    await wait(20);
  }
  throw new Error('timed out waiting for predicate');
};

let failures = 0;
const check = (label, cond) => {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
};

console.log('\n— join both seats —');
send(a, { type: 'join', tableId: 't1', playerId: 'A', buyIn: 1000 });
send(b, { type: 'join', tableId: 't1', playerId: 'B', buyIn: 1000 });
await waitFor(eventsA, (m) => m.type === 'joined');
await waitFor(eventsB, (m) => m.type === 'joined');
check('both seats joined', true);

await waitFor(eventsA, (m) => m.type === 'hand_start');
check('hand auto-started on second join', true);

await waitFor(eventsA, (m) => m.type === 'state' && m.state.street === 'preflop');
const stateA = eventsA.filter((m) => m.type === 'state').pop();
check('A receives state with street=preflop', stateA.state.street === 'preflop');
check('A sees own hole cards', stateA.state.seats[0].holeCards.length === 2);
check('A does NOT see B hole cards', stateA.state.seats[1].holeCards.length === 0);

console.log('\n— A folds preflop —');
send(a, { type: 'action', action: { type: 'fold' } });
await waitFor(eventsA, (m) => m.type === 'hand_result');
check('hand_result delivered', true);

console.log('\n— verify NO auto-deal happens within 500ms —');
const handStartCount = eventsA.filter((m) => m.type === 'hand_start').length;
await wait(500);
const handStartCountAfter = eventsA.filter((m) => m.type === 'hand_start').length;
check('no auto-deal between hands', handStartCount === handStartCountAfter);

console.log('\n— send DEAL, expect new hand —');
send(a, { type: 'deal' });
await waitFor(eventsA, (m) => m.type === 'hand_start' && m.handNumber === 2);
check('DEAL triggered hand #2', true);

a.close(); b.close();
wss.close();

console.log('\n— summary —');
if (failures === 0) { console.log('all checks passed'); process.exit(0); }
else { console.error(`${failures} checks failed`); process.exit(1); }
