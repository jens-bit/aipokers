// End-to-end repro of a complete hand exercising all four streets, the BB
// option case (Bug 1), action validation, and showdown. Verifies the server
// never rejects an action the client was offered.
import { WebSocket } from 'ws';
import { createServer } from '../src/server/wsServer.js';

const PORT = 19996;
const { wss } = createServer({ port: PORT, host: '127.0.0.1', defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => wss.on('listening', res));

const open = (ws) => new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (label, cond) => {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
};

const a = new WebSocket(`ws://127.0.0.1:${PORT}`);
const b = new WebSocket(`ws://127.0.0.1:${PORT}`);
await Promise.all([open(a), open(b)]);

const events = { a: [], b: [] };
a.on('message', (d) => events.a.push(JSON.parse(d.toString())));
b.on('message', (d) => events.b.push(JSON.parse(d.toString())));

const send = (ws, msg) => ws.send(JSON.stringify(msg));
const waitFor = async (arr, predicate, timeoutMs = 1000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const m = arr.find(predicate);
    if (m) return m;
    await wait(10);
  }
  throw new Error('timed out');
};
const lastState = (arr) => arr.filter((m) => m.type === 'state').pop();
const errorsSince = (arr, idx) => arr.slice(idx).filter((m) => m.type === 'error');

send(a, { type: 'join', tableId: 'full', playerId: 'pa', displayName: 'Alice', buyIn: 1000 });
send(b, { type: 'join', tableId: 'full', playerId: 'pb', displayName: 'Bob', buyIn: 1000 });
const jA = await waitFor(events.a, (m) => m.type === 'joined');
const jB = await waitFor(events.b, (m) => m.type === 'joined');
await waitFor(events.a, (m) => m.type === 'hand_start');

const seatA = jA.seat, seatB = jB.seat;
const ws = (seat) => (seat === seatA ? a : b);
const evs = (seat) => (seat === seatA ? events.a : events.b);

console.log('\n— PREFLOP: BB option scenario (the original bug) —');
let state = lastState(events.a);
const sbSeat = state.state.dealerSeat;
const bbSeat = 1 - sbSeat;
check('SB to act first preflop', state.state.toAct === sbSeat);

// SB calls (limps).
const errBefore = events.a.filter((m) => m.type === 'error').length + events.b.filter((m) => m.type === 'error').length;
send(ws(sbSeat), { type: 'action', action: { type: 'call' } });
await waitFor(events.a, (m) => m.type === 'state' && m.state.toAct === bbSeat);

// Now check what BB was offered. PRE-FIX: would include BET (illegal).
// POST-FIX: should be FOLD + CHECK + RAISE only.
const bbState = lastState(evs(bbSeat));
const bbLegal = bbState.legalActions.map((a) => a.type).sort();
check('BB is offered FOLD+CHECK+RAISE (not BET)', JSON.stringify(bbLegal) === JSON.stringify(['check','fold','raise']));
check('BB legal does NOT include BET (the bug)', !bbLegal.includes('bet'));

// BB exercises the option to check (the option pre-flop after SB call).
send(ws(bbSeat), { type: 'action', action: { type: 'check' } });
await waitFor(events.a, (m) => m.type === 'state' && m.state.street === 'flop');

const errAfterPreflop = events.a.filter((m) => m.type === 'error').length + events.b.filter((m) => m.type === 'error').length;
check('no server-rejected actions during preflop', errAfterPreflop === errBefore);

console.log('\n— FLOP: BB checks, SB checks (no bet, then BET should appear) —');
state = lastState(events.a);
check('flop dealt 3 cards', state.state.community.length === 3);
check('BB acts first postflop', state.state.toAct === bbSeat);

const bbFlopLegal = lastState(evs(bbSeat)).legalActions.map((a) => a.type).sort();
check('on flop with no bet, BB is offered FOLD+CHECK+BET', JSON.stringify(bbFlopLegal) === JSON.stringify(['bet','check','fold']));
check('on flop with no bet, BB legal does NOT include RAISE', !bbFlopLegal.includes('raise'));

send(ws(bbSeat), { type: 'action', action: { type: 'check' } });
await waitFor(events.a, (m) => m.type === 'state' && m.state.toAct === sbSeat);
send(ws(sbSeat), { type: 'action', action: { type: 'check' } });
await waitFor(events.a, (m) => m.type === 'state' && m.state.street === 'turn');

console.log('\n— TURN: BB bets, SB raises, BB calls —');
state = lastState(events.a);
check('turn dealt (4 community cards)', state.state.community.length === 4);

const bbTurnLegal = lastState(evs(bbSeat)).legalActions;
const betOpt = bbTurnLegal.find((a) => a.type === 'bet');
check('BET offered with min/max', betOpt && betOpt.min > 0 && betOpt.max >= betOpt.min);

send(ws(bbSeat), { type: 'action', action: { type: 'bet', amount: 60 } });
await waitFor(events.a, (m) => m.type === 'state' && m.state.toAct === sbSeat && m.state.currentBet === 60);

const sbFacingBet = lastState(evs(sbSeat)).legalActions.map((a) => a.type).sort();
check('SB facing bet is offered FOLD+CALL+RAISE', JSON.stringify(sbFacingBet) === JSON.stringify(['call','fold','raise']));

const raiseOpt = lastState(evs(sbSeat)).legalActions.find((a) => a.type === 'raise');
send(ws(sbSeat), { type: 'action', action: { type: 'raise', amount: raiseOpt.min } });
await waitFor(events.a, (m) => m.type === 'state' && m.state.toAct === bbSeat && m.state.currentBet === raiseOpt.min);

send(ws(bbSeat), { type: 'action', action: { type: 'call' } });
await waitFor(events.a, (m) => m.type === 'state' && m.state.street === 'river');

console.log('\n— RIVER: BB checks, SB checks, showdown —');
state = lastState(events.a);
check('river dealt (5 community cards)', state.state.community.length === 5);
send(ws(bbSeat), { type: 'action', action: { type: 'check' } });
await waitFor(events.a, (m) => m.type === 'state' && m.state.toAct === sbSeat);
send(ws(sbSeat), { type: 'action', action: { type: 'check' } });

const result = await waitFor(events.a, (m) => m.type === 'hand_result');
check('hand_result delivered', result.result.type === 'showdown' || result.result.type === 'uncontested');

const totalErrors = events.a.filter((m) => m.type === 'error').length + events.b.filter((m) => m.type === 'error').length;
check('zero server errors across the whole hand', totalErrors === 0);

a.close(); b.close(); wss.close();

console.log('\n— summary —');
if (failures === 0) { console.log('all checks passed'); process.exit(0); }
else { console.error(`${failures} checks failed`); process.exit(1); }
