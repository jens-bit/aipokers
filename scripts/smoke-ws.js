// End-to-end WebSocket smoke test. Boots a server in-process, opens two
// independent clients (simulating two browser tabs), drives a hand, verifies:
//   - each client takes one seat
//   - displayName is propagated through state
//   - opponent's hole cards are hidden
//   - DEAL message starts the next hand
//   - RENAME message updates display names
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
    if (events.find(predicate)) return events.find(predicate);
    await wait(20);
  }
  throw new Error('timed out waiting for predicate');
};
const lastState = (events) => events.filter((m) => m.type === 'state').pop();

let failures = 0;
const check = (label, cond) => {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
};

console.log('\n— two clients join with different playerIds —');
send(a, { type: 'join', tableId: 't1', playerId: 'pa-1', displayName: 'Alice', buyIn: 1000 });
send(b, { type: 'join', tableId: 't1', playerId: 'pb-1', displayName: 'Bob', buyIn: 1000 });
const joinedA = await waitFor(eventsA, (m) => m.type === 'joined');
const joinedB = await waitFor(eventsB, (m) => m.type === 'joined');
check('A is seated', typeof joinedA.seat === 'number');
check('B is seated', typeof joinedB.seat === 'number');
check('seats are distinct', joinedA.seat !== joinedB.seat);

await waitFor(eventsA, (m) => m.type === 'hand_start');
await waitFor(eventsA, (m) => m.type === 'state' && m.state.street === 'preflop');
const stA = lastState(eventsA);
const stB = lastState(eventsB);

check('A sees own hole cards', stA.state.seats[joinedA.seat].holeCards.length === 2);
check('A does NOT see B hole cards', stA.state.seats[joinedB.seat].holeCards.length === 0);
check('B sees own hole cards', stB.state.seats[joinedB.seat].holeCards.length === 2);
check('B does NOT see A hole cards', stB.state.seats[joinedA.seat].holeCards.length === 0);

console.log('\n— displayName is in state —');
check('A sees Alice', stA.state.seats[joinedA.seat].displayName === 'Alice');
check('A sees Bob', stA.state.seats[joinedB.seat].displayName === 'Bob');

console.log('\n— RENAME updates display name —');
send(a, { type: 'rename', displayName: 'Alice the Great' });
await waitFor(eventsB, (m) => m.type === 'state' && m.state.seats[joinedA.seat].displayName === 'Alice the Great');
check('B sees A\'s new name', true);

console.log('\n— third tab cannot join when both seats are filled —');
const c = new WebSocket(`ws://127.0.0.1:${PORT}`);
await open(c);
const eventsC = [];
c.on('message', (d) => eventsC.push(JSON.parse(d.toString())));
send(c, { type: 'join', tableId: 't1', playerId: 'pc-1', displayName: 'Carol', buyIn: 1000 });
const errC = await waitFor(eventsC, (m) => m.type === 'error');
check('third client gets table-full error', /full/i.test(errC.message));
c.close();

console.log('\n— preflop fold ends the hand —');
const sbSeat = stA.state.dealerSeat;
const sbWs = sbSeat === joinedA.seat ? a : b;
send(sbWs, { type: 'action', action: { type: 'fold' } });
await waitFor(eventsA, (m) => m.type === 'hand_result');
check('hand_result delivered to both', !!eventsB.find((m) => m.type === 'hand_result'));

console.log('\n— no auto-deal between hands —');
const startsBefore = eventsA.filter((m) => m.type === 'hand_start').length;
await wait(400);
const startsAfter = eventsA.filter((m) => m.type === 'hand_start').length;
check('no auto-deal', startsBefore === startsAfter);

console.log('\n— either client can DEAL the next hand —');
send(b, { type: 'deal' });
await waitFor(eventsA, (m) => m.type === 'hand_start' && m.handNumber === 2);
check('hand 2 started after DEAL from B', true);

a.close(); b.close();
wss.close();

console.log('\n— summary —');
if (failures === 0) { console.log('all checks passed'); process.exit(0); }
else { console.error(`${failures} checks failed`); process.exit(1); }
