// src/server/table.session.test.js — SERVER-3
//
// What the v5 watch screen needs on the wire, asserted at the table:
//
//   1. result.deltas rides every HAND_RESULT, so the client stops differencing
//      stack snapshots it may have missed.
//   2. SESSION_END is a first-class message with a reason from the session
//      stop rule, and it arrives BEFORE the TABLE_CLOSED a client tears the
//      screen down on.
//   3. 'worn' actually ends the session — he sits himself at the bar.
//   4. The acting seat's deadline rides the state broadcast.
//   5. The table thread is written as it happens and reads back per session.
//   6. Per-seat face triggers, on the decision and on the result.
//
// Seats are plain (non-AI) connections with an agent id patched onto them —
// the same shape table.events.test.js uses — so every action is driven
// explicitly and no model call, timer or random think delay is anywhere near
// the assertions. The one exception is the deadline test, which needs an AI
// seat and stubs the turn driver out by name.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-server3-'));
_closeForTests();
process.chdir(dir);
process.on('exit', () => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const { saveProfile } = await import('./store.js');
// Seeded before agentProfiles reads (and caches) the store for the first time.
// HERO's STAMINA is on the floor so fatigue can be reached without playing two
// hundred hands; his pocket is an allowance with nothing left in it, which is
// what separates a SESSION_END of 'allowance' from one of 'bust'.
saveProfile('u1', {
  userId: 'u1',
  chat: [],
  agents: [
    {
      id: 'hero', name: 'Hero', status: 'playing', activeTableId: 'tbl',
      attrs: { AGGRESSION: 50, DISCIPLINE: 50, COMPOSURE: 50, FOCUS: 50, READING: 50, STAMINA: 0 },
      pocket: { balance: 0, mode: 'topup', cap: null, realised: 0, ledger: [] },
    },
    {
      id: 'rival', name: 'Rival', status: 'playing', activeTableId: 'tbl',
      pocket: { balance: 50_000, mode: 'auto', cap: 50_000, realised: 0, ledger: [] },
    },
  ],
});

const { Table } = await import('./table.js');
const { Actions } = await import('../engine/game.js');
const { setPersistEnabled } = await import('./opponentStats.js');
const { bus: sessionBus } = await import('./sessions.js');
const { readThread } = await import('./thread.js');
const { getAgentPocket } = await import('./agentProfiles.js');

setPersistEnabled(false);

function fakeWs() {
  return {
    readyState: 1,
    OPEN: 1,
    received: [],
    send(payload) { this.received.push(JSON.parse(payload)); },
    of(type) { return this.received.filter((m) => m.type === type); },
    types() { return this.received.map((m) => m.type); },
  };
}

let tableSeq = 0;

// Two seats, each backed by a real agent record but driven by hand — see the
// header. Returns { table, sockets, sessions }.
function seatedTable({ stacks = [1000, 1000], agents = ['hero', 'rival'] } = {}) {
  const table = new Table({ tableId: `s3-${tableSeq++}`, smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  const sockets = [];
  const sessions = [];
  agents.forEach((agentId, i) => {
    const ws = fakeWs();
    table.seatPlayer(ws, { playerId: `p${i}`, buyIn: stacks[i], displayName: agentId === 'hero' ? 'Hero' : 'Rival' });
    table.agentIds[i] = agentId;
    table.agentUserIds[i] = 'u1';
    table.seatSessionIds[i] = `sess-${table.tableId}-${i}`;
    table.seatSeatedAt[i] = Date.now() - 60_000;
    sockets.push(ws);
    sessions.push(table.seatSessionIds[i]);
  });
  return { table, sockets, sessions };
}

// Check/call the hand down. Same helper shape as table.seats.test.js.
function playDown(table) {
  const before = table.handsThisSession;
  let safety = 400;
  while (table.game && table.handsThisSession === before && safety-- > 0) {
    const seat = table.game.toAct;
    if (seat === null || seat === undefined) break;
    const legal = table.game.legalActions(seat);
    const pick = legal.find((a) => a.type === Actions.CHECK)
      ?? legal.find((a) => a.type === Actions.CALL)
      ?? { type: Actions.FOLD };
    table.applyAction(table.connections[seat], { type: pick.type });
  }
}

// Everything the sessions bus saw while fn ran.
function captureBus(fn) {
  const seen = [];
  const listen = (r) => seen.push(r);
  sessionBus.on('session_end', listen);
  try { fn(); } finally { sessionBus.off('session_end', listen); }
  return seen;
}

// ── 1. deltas ───────────────────────────────────────────────────────────────

test('SERVER-3: result.deltas rides HAND_RESULT, net and summing to zero', () => {
  const { table, sockets } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  playDown(table);

  const [msg] = sockets[0].of('hand_result');
  assert.ok(msg, 'the felt was told the hand finished');
  const d = msg.result.deltas;
  assert.ok(d, 'and the result carries per-seat deltas');
  assert.equal(Object.keys(d).length, 2);
  assert.equal(Number(d[0]) + Number(d[1]), 0, 'a hand moves chips, it never makes them');
  // The contract, stated against the thing the client used to compute it from:
  // the delta IS the stack movement, so nothing has to be differenced. Written
  // this way rather than "the winner is up" because a checked-down heads-up
  // hand can legitimately chop, and a test that only passes when somebody wins
  // is a test that fails on a Tuesday.
  assert.equal(Number(d[0]), table.seatStacks[0] - 1000);
  assert.equal(Number(d[1]), table.seatStacks[1] - 1000);
});

test('SERVER-3: the winner nets what he was paid, not the whole pot', () => {
  const { table, sockets } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  // HU: seat 0 is the button/SB and acts first. He raises, seat 1 folds.
  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: 60 });
  table.applyAction(table.connections[1], { type: Actions.FOLD });

  const [msg] = sockets[0].of('hand_result');
  assert.equal(msg.result.type, 'uncontested');
  // A pot won by a fold still contains the winner's own uncalled raise, which
  // is exactly why `pot` was never the number the ceremony wanted.
  assert.equal(msg.result.pot, 80, 'the pot he takes down');
  assert.equal(msg.result.deltas[0], 20, 'but he is only up the blind he was paid');
  assert.equal(msg.result.deltas[1], -20);
});

// ── 2. SESSION_END ──────────────────────────────────────────────────────────

test('SERVER-3: a bust ends the session with reason bust', () => {
  const { table, sockets, sessions } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  playDown(table);

  // He has nothing left. The between-hands reconcile banks the Game's stacks
  // before it retires anything, so the bust has to be true there too.
  table.game.seats[0].stack = 0;
  table.seatStacks[0] = 0;
  const bus = captureBus(() => table._reconcileSeats());

  const [wire] = sockets[1].of('session_end');
  assert.ok(wire, 'everyone at the table hears that a seat stood up');
  assert.equal(wire.agentId, 'hero');
  assert.equal(wire.reason, 'bust');
  assert.equal(wire.sessionId, sessions[0]);
  assert.equal(wire.tableId, table.tableId);
  assert.ok(wire.duration > 0, 'a stay has a length');
  assert.ok(!('userId' in wire), 'the owner id is routing, not payload');

  assert.equal(bus.length, 1, 'and the floor hears it once');
  assert.equal(bus[0].userId, 'u1', 'with the owner on it, for routing');
  assert.equal(bus[0].reason, 'bust');
});

test('SERVER-3: an exhausted allowance is not the same event as a bust', () => {
  const pocket = getAgentPocket('hero', 'u1');
  const before = { mode: pocket.mode, balance: pocket.balance };
  pocket.mode = 'allowance';
  pocket.balance = 0;   // cannot cover another buy-in at these blinds
  try {
    const { table, sockets } = seatedTable();
    table.maybeStartHand({ clientDriven: true });
    playDown(table);
    table.game.seats[0].stack = 0;
    table.seatStacks[0] = 0;
    table._reconcileSeats();

    const [wire] = sockets[1].of('session_end');
    assert.equal(wire.reason, 'allowance', 'the budget behind him is what ran out');
  } finally {
    pocket.mode = before.mode;
    pocket.balance = before.balance;
  }
});

test('SERVER-3: the owner calling him in reads as calledIn, and the room as stopped', () => {
  const { table, sockets } = seatedTable();
  // Between hands, so the seat leaves immediately and the table — down to one
  // body — closes behind it.
  const bus = captureBus(() => table.sitOutSeat(0));

  assert.equal(bus.length, 2, 'both seats ended a session');
  const byAgent = Object.fromEntries(bus.map((r) => [r.agentId, r.reason]));
  assert.equal(byAgent.hero, 'calledIn', 'he was stopped');
  assert.equal(byAgent.rival, 'stopped', 'the other seat had the room close under him');

  // Ordering is the whole point: TABLE_CLOSED is what a client tears the watch
  // screen down on, so the ceremony has to be in front of it.
  const types = sockets[0].types();
  assert.ok(types.includes('session_end'), 'the ceremony fired');
  assert.ok(types.indexOf('session_end') < types.indexOf('table_closed'),
    'and it arrived before the screen was told to close');
});

test('SERVER-3: a session that just ends reads as stopped', () => {
  const { table, sockets } = seatedTable();
  const bus = captureBus(() => table.closeTable('session hand limit reached'));
  assert.equal(bus.length, 2);
  for (const r of bus) assert.equal(r.reason, 'stopped');
  assert.equal(sockets[0].of('session_end').length, 2, 'one per seat, to every socket');
});

test('SERVER-3: SESSION_END carries the numbers the ceremony prints', () => {
  const { table, sockets } = seatedTable({ stacks: [1000, 1000] });
  table.maybeStartHand({ clientDriven: true });
  // A pot worth remembering, then a fold, so the numbers are known exactly.
  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: 300 });
  table.applyAction(table.connections[1], { type: Actions.FOLD });
  table.closeTable('done');

  const wire = sockets[0].of('session_end').find((m) => m.agentId === 'hero');
  assert.equal(wire.hands, 1, 'hands HE was dealt into');
  assert.equal(wire.net, 20, 'signed chips: final stack minus his buy-in');
  assert.equal(wire.biggestPot, 320, 'the biggest pot he had money in');
  assert.ok(wire.duration >= 60_000, 'how long he sat there');
});

test('SERVER-3: biggestPot is HIS, not the table\'s', () => {
  // Three seats. The hero folds out of a big one and plays a small one.
  const { table, sockets } = seatedTable({
    stacks: [1000, 1000, 1000], agents: ['hero', 'rival', null],
  });
  table.agentIds[2] = null;   // a House regular: no agent, no session
  table.maybeStartHand({ clientDriven: true });

  // 3-handed: UTG is seat 0 (BB is seat 2). Hero folds; the other two build it.
  table.applyAction(table.connections[0], { type: Actions.FOLD });
  table.applyAction(table.connections[1], { type: Actions.RAISE, amount: 400 });
  table.applyAction(table.connections[2], { type: Actions.FOLD });

  table.closeTable('done');
  const wire = sockets[0].of('session_end').find((m) => m.agentId === 'hero');
  assert.equal(wire.biggestPot, 0, 'a monster he folded out of was never his pot');
});

// ── 3. worn ends the session ────────────────────────────────────────────────

test('SERVER-3: STAMINA reaching worn ends the session — he sits himself at the bar', () => {
  const { table, sockets } = seatedTable();
  // Far past 1.5x his fatigue onset (STAMINA 0 puts onset at 40 hands).
  table.handsThisSession = 200;
  table.maybeStartHand({ clientDriven: true });
  const bus = captureBus(() => playDown(table));

  const hero = bus.find((r) => r.agentId === 'hero');
  assert.ok(hero, 'his session ended');
  assert.equal(hero.reason, 'worn', 'and the reason is the fatigue, not a sit-out');
  assert.ok(hero.hands > 40, 'after a long session');
  assert.ok(sockets[0].of('session_end').length >= 1);
});

test('SERVER-3: a fresh seat plays on', () => {
  const { table } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  const bus = captureBus(() => playDown(table));
  assert.equal(bus.length, 0, 'nobody stood up after one hand');
  assert.ok(!table.seatLeaving[0] && !table.seatLeaving[1]);
});

// ── 4. the hero's ring ──────────────────────────────────────────────────────

test('SERVER-3: the acting seat\'s deadline rides the state broadcast', () => {
  const { table, sockets } = seatedTable();
  // An AI seat is the only kind with a server-enforced clock. The turn driver
  // is stubbed by name so the assertions are about the wire, not about a model.
  table.aiSeats[0] = true;
  table._maybeRunAiTurn = async () => {};

  const before = Date.now();
  table.maybeStartHand({ clientDriven: true });

  const state = sockets[0].of('state').at(-1).state;
  assert.ok(state.actionTimer, 'a clock is running');
  assert.equal(state.actionTimer.seat, table.game.toAct, 'on the seat that has to act');
  assert.ok(state.actionTimer.totalMs > 0, 'the ring knows how far round to start');
  assert.ok(state.actionTimer.deadlineTs >= before + state.actionTimer.totalMs - 5,
    'and when it runs out, in server time');
  assert.ok(!('key' in state.actionTimer), 'the internal key never leaves the server');
  table.closeTable('done');   // an AI seat arms the 60s inactivity reaper
});

test('SERVER-3: a human seat gets no ring, because nothing would enforce it', () => {
  const { table, sockets } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  const state = sockets[0].of('state').at(-1).state;
  assert.equal(state.actionTimer, null,
    'a deadline the server will not act on is worse than no ring');
});

test('SERVER-3: the same seat acting twice across a street gets a new clock', () => {
  const { table } = seatedTable();
  table.aiSeats[0] = true;
  table.aiSeats[1] = true;
  table._maybeRunAiTurn = async () => {};
  // Not clientDriven: on an AI-only table the server owns the tempo, and a
  // client asking for a hand is observation rather than causation (AGE-36).
  table.maybeStartHand();

  const first = table.actionTimer;
  assert.ok(first);
  // Re-broadcasting the same turn must not restart his ring mid-think.
  table._broadcastState();
  assert.equal(table.actionTimer, first, 'the same turn keeps the same clock');

  // Act, and the clock moves to the next turn.
  const seat = table.game.toAct;
  table.game.act(seat, { type: Actions.CALL });
  table._logAction(seat, table.game.street, { type: Actions.CALL });
  table._broadcastState();
  assert.notEqual(table.actionTimer?.key, first.key, 'a new turn is a new clock');
  table.closeTable('done');
});

test('SERVER-3: the clock stops when the hand does', () => {
  const { table, sockets } = seatedTable();
  table.aiSeats[0] = true;
  table._maybeRunAiTurn = async () => {};
  table.maybeStartHand({ clientDriven: true });
  assert.ok(table.actionTimer, 'armed during the hand');
  playDown(table);
  assert.equal(table.actionTimer, null, 'and cleared when nobody is on it');
  assert.equal(table.actionDeadline, null);
  const last = sockets[0].of('state').at(-1);
  assert.equal(last.state.actionTimer, null);
  table.closeTable('done');
});

// ── 5. the table thread ─────────────────────────────────────────────────────

test('SERVER-3: the thread records the felt, his voice, yours and theirs', () => {
  const { table, sessions } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: 60 });
  table.sendChat(0, 'Careful with him.', false);           // the owner, at his seat
  table.sendChat(1, 'Again?', true);                        // the opponent, out loud
  table._broadcastDecision({ seat: 0, action: { type: 'raise', amount: 60 }, reasoning: 'He is bluffing.' });
  table.applyAction(table.connections[1], { type: Actions.FOLD });

  const his = readThread(sessions[0], { owner: true });
  const kinds = his.map((r) => r.kind);
  assert.ok(kinds.includes('table'), 'the room');
  assert.ok(kinds.includes('you'), 'the owner whispering at his seat');
  assert.ok(kinds.includes('opponent'), 'the other seat');
  assert.ok(kinds.includes('him'), 'and his own read');

  const raise = his.find((r) => r.kind === 'table' && r.text.includes('raised to'));
  assert.equal(raise.text, 'Hero raised to 60');
  assert.equal(his.find((r) => r.kind === 'him').text, 'He is bluffing.');
  assert.ok(his.some((r) => r.kind === 'table' && r.text.includes('took 80 uncontested')),
    'and how the hand finished');

  // The opponent's own thread is the mirror image: the same room, but the
  // whisper is somebody ELSE speaking.
  const theirs = readThread(sessions[1], { owner: true });
  assert.ok(theirs.some((r) => r.kind === 'opponent' && r.text === 'Careful with him.'));
  assert.ok(!theirs.some((r) => r.text === 'He is bluffing.'), 'never the other man\'s read');
});

test('SERVER-3: a reconnect gets the record back, per session', () => {
  const { table, sessions } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: 80 });
  table.applyAction(table.connections[1], { type: Actions.FOLD });

  // Nothing but the session id is needed to read it back — which is exactly
  // what a client that has just reconnected has.
  const again = readThread(sessions[0], { owner: true });
  assert.ok(again.length > 0, 'the thread survives the socket that was watching it');
  assert.ok(again.every((r) => r.sessionId === sessions[0]));
  assert.ok(again.every((r) => Number.isFinite(r.ts)), 'with server timestamps to order it by');
});

test('SERVER-3: the session id is on the wire for the client to ask with', () => {
  const { table, sockets, sessions } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  const state = sockets[0].of('state').at(-1).state;
  assert.equal(state.sessionId, sessions[0], 'his own stay, on his own snapshot');
  assert.equal(sockets[1].of('state').at(-1).state.sessionId, sessions[1]);
  assert.equal(table.sessionIdAtSeat(0), sessions[0]);
  assert.equal(table.sessionIdFor('hero'), sessions[0]);
  assert.equal(table.sessionIdFor('nobody'), null);
});

test('SERVER-3: a House regular has no stay to keep', () => {
  const table = new Table({ tableId: 's3-house', smallBlind: 10, bigBlind: 20, maxSeats: 6 });
  const agentSeat = table.seatAI({ displayName: 'Hero', agentId: 'hero', userId: 'u1', buyIn: 1000 });
  const houseSeat = table.seatAI({ displayName: 'Granite', stableId: 'granite', buyIn: 1000 });
  assert.match(table.seatSessionIds[agentSeat], /^s_/, 'an agent gets a session');
  assert.equal(table.seatSessionIds[houseSeat], null, 'a House regular does not');
  assert.ok(table.seatSeatedAt[agentSeat] > 0);
  table.closeTable('done');
});

// ── 6. face triggers ────────────────────────────────────────────────────────

test('SERVER-3: dealtStrong fires once, on his first look at a premium holding', () => {
  const { table } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  table.game.seats[0].holeCards = ['Ah', 'Ad'];
  assert.equal(table._decisionEventBefore(0), 'dealtStrong');

  // Second decision of the same hand: he has already reacted to the cards.
  table.currentHandDecisions.push({ seat: 0, action: { type: 'call' } });
  assert.notEqual(table._decisionEventBefore(0), 'dealtStrong');

  table.game.seats[1].holeCards = ['7c', '2d'];
  assert.equal(table._decisionEventBefore(1), null, 'and never on a rag');
});

test('SERVER-3: raisedAgainst needs a raise, not a big blind', () => {
  const { table } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  table.game.seats[0].holeCards = ['7c', '2d'];
  table.game.seats[1].holeCards = ['8c', '3d'];
  // Preflop, the SB owes the blind. That is not somebody raising at him.
  assert.equal(table._decisionEventBefore(0), null);

  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: 90 });
  assert.equal(table._decisionEventBefore(1), 'raisedAgainst', 'now it is');
});

test('SERVER-3: committing the stack outranks everything else', () => {
  const { table } = seatedTable({ stacks: [200, 1000] });
  table.maybeStartHand({ clientDriven: true });
  table.game.seats[0].holeCards = ['Ah', 'Ad'];
  const before = table._decisionEventBefore(0);
  assert.equal(before, 'dealtStrong');
  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: 200 });
  assert.equal(table._decisionEventFor(0, before), 'allIn', 'the loudest thing wins');
});

test('SERVER-3: hand-end triggers ride the result, per seat', () => {
  const { table, sockets } = seatedTable();
  table.maybeStartHand({ clientDriven: true });
  // A pot worth a face: more than 20bb, taken by seat 0.
  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: 600 });
  table.applyAction(table.connections[1], { type: Actions.FOLD });

  const [msg] = sockets[0].of('hand_result');
  assert.equal(msg.result.events[0], 'wonBig', 'he took a big one');
  assert.ok(!(1 in msg.result.events), 'a seat with nothing to react to is absent');
});

test('SERVER-3: a bad beat and a caught bluff are told apart by what he knew', () => {
  const { table } = seatedTable();
  table.maybeStartHand({ clientDriven: true });

  const showdown = { type: 'showdown', pot: 400, winners: [{ seat: 1, amount: 400 }] };

  table.currentHandDecisions = [{ seat: 0, action: { type: 'raise', amount: 100 }, equity: 0.92 }];
  assert.equal(table._handEndEvents(showdown)[0], 'badBeat', 'he was a long way in front');

  table.currentHandDecisions = [{ seat: 0, action: { type: 'bet', amount: 100 }, equity: 0.08 }];
  assert.equal(table._handEndEvents(showdown)[0], 'bluffCaught', 'he fired without the goods');

  table.currentHandDecisions = [{ seat: 0, action: { type: 'call' }, equity: 0.40 }];
  assert.equal(table._handEndEvents(showdown)[0], undefined, 'losing a normal hand is not a face');

  // A fold-out is not a showdown, so neither of the showdown faces can fire.
  const folded = { type: 'uncontested', pot: 400, winners: [{ seat: 1, amount: 400 }] };
  table.currentHandDecisions = [{ seat: 0, action: { type: 'bet', amount: 100 }, equity: 0.08 }];
  assert.equal(table._handEndEvents(folded)[0], undefined);
});
