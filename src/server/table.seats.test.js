// MST-3: seat-lifecycle tests for the multi-seat Table. Run with:
//   node src/server/table.seats.test.js
//
// These cover what game.test.js cannot: the reconciliation between the table's
// seat roster and the Game instance -- joining a table that is already running,
// leaving one mid-session, stacks persisting across the rebuild, and the blinds
// continuing to rotate correctly through both.
//
// Seats here are plain (non-AI) connections so every action is driven
// explicitly; no model calls, no timers, fully deterministic.

import assert from 'node:assert';
import { Table, MIN_TO_DEAL, SEAT_LIMIT } from './table.js';
import { Streets, Actions } from '../engine/game.js';
import { setPersistEnabled } from './opponentStats.js';

setPersistEnabled(false);

let passed = 0;
function ok(name) { passed++; console.log(`  PASS  ${name}`); }
function header(name) { console.log(`\n${name}`); }

// A WebSocket stand-in that records what the table sent it.
function fakeWs() {
  return {
    readyState: 1,
    OPEN: 1,
    received: [],
    send(payload) { this.received.push(JSON.parse(payload)); },
    typesSeen() { return this.received.map((m) => m.type); },
  };
}

function newTable(opts = {}) {
  return new Table({ tableId: 'seat-test', smallBlind: 10, bigBlind: 20, maxSeats: 6, ...opts });
}

// Seat `n` plain players, each with the same buy-in. Returns their sockets.
function seatPlayers(table, n, buyIn = 1000, offset = 0) {
  const sockets = [];
  for (let i = 0; i < n; i++) {
    const ws = fakeWs();
    table.seatPlayer(ws, { playerId: `p${offset + i}`, buyIn, displayName: `P${offset + i}` });
    sockets.push(ws);
  }
  return sockets;
}

// Check/call the hand down to completion. Completion is measured by the hand
// counter rather than the street, because a hand that ends with a departure is
// immediately followed by a rebuild that puts the new Game back in WAITING.
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
  assert.strictEqual(table.handsThisSession, before + 1, 'hand played to completion');
}

function chipsAtTable(table) {
  return table.pending.reduce((sum, p, i) => (p ? sum + table.seatStack(i) : sum), 0);
}

// ---------------------------------------------------------------------------
header('Test 1: a table seats 2..6 and refuses more');
{
  assert.strictEqual(SEAT_LIMIT, 6);
  assert.throws(() => newTable({ maxSeats: 7 }), /maxSeats/);
  assert.throws(() => newTable({ maxSeats: 1 }), /maxSeats/);
  const table = newTable();
  seatPlayers(table, 6);
  assert.strictEqual(table.seatedCount(), 6);
  assert.strictEqual(table.hasFreeSeat(), false);
  assert.throws(() => seatPlayers(table, 1, 1000, 6), /table full/);
  table.maybeStartHand({ clientDriven: true });
  assert.strictEqual(table.game.seats.length, 6, 'all six are dealt in');
  ok('2..6 seats, seventh refused, all six dealt in');
}

// ---------------------------------------------------------------------------
header('Test 2: join in progress - dealt into the NEXT hand, never mid-hand');
{
  const table = newTable();
  seatPlayers(table, 3);
  table.maybeStartHand({ clientDriven: true });
  const handNumber = table.game.handNumber;
  assert.strictEqual(table.game.seats.length, 3);

  // A fourth agent sits down while the hand is live.
  const late = fakeWs();
  const lateSeat = table.seatPlayer(late, { playerId: 'late', buyIn: 1000, displayName: 'Late' });
  assert.strictEqual(lateSeat, 3, 'took the lowest free seat immediately');
  assert.strictEqual(table.seatedCount(), 4, 'roster grew at once');
  assert.strictEqual(table.game.seats.length, 3, 'but the live hand is untouched');
  assert.strictEqual(table.game.handNumber, handNumber, 'the hand in progress did not restart');

  // Mid-hand a join must not be reconciled in, even if something calls it.
  table._reconcileSeats();
  assert.strictEqual(table.game.seats.length, 3, 'reconcile is a no-op mid-hand');

  playDown(table);
  table.maybeStartHand({ clientDriven: true });
  assert.strictEqual(table.game.seats.length, 4, 'dealt in on the next hand');
  assert.strictEqual(table.game.handNumber, handNumber + 1, 'hand numbering continues');
  assert.strictEqual(table.game.seats[3].playerId, 'late');
  assert.strictEqual(table.currentHandStartStacks[3], 1000, 'joined with a full buy-in');
  assert.strictEqual(table.game.seats[3].holeCards.length, 2, 'and got cards');
  ok('join in progress: seat taken now, cards next hand, no restart');
}

// ---------------------------------------------------------------------------
header('Test 3: stacks persist per seat across the rebuild');
{
  const table = newTable();
  seatPlayers(table, 3);
  table.maybeStartHand({ clientDriven: true });
  playDown(table);
  const banked = [0, 1, 2].map((i) => table.seatStack(i));
  assert.notDeepStrictEqual(banked, [1000, 1000, 1000], 'blinds moved some chips');

  seatPlayers(table, 1, 1000, 3);           // forces a rebuild
  table.maybeStartHand({ clientDriven: true });
  for (const seat of [0, 1, 2]) {
    // The hand in progress has already posted blinds, so compare against the
    // snapshot taken at the deal.
    assert.strictEqual(table.currentHandStartStacks[seat], banked[seat],
      `seat ${seat} carried its stack through the rebuild`);
  }
  const inPlay = table.game.seats.reduce((sum, s) => sum + s.stack, 0) + table.game.pot;
  assert.strictEqual(inPlay, 4000, 'no chips created or destroyed by the rebuild');
  assert.strictEqual(chipsAtTable(table), 4000, 'the ledger agrees with the felt');
  ok('stacks survive the roster change');
}

// ---------------------------------------------------------------------------
header('Test 4: leaving frees the seat next hand and the others play on');
{
  const table = newTable();
  const sockets = seatPlayers(table, 4);
  table.maybeStartHand({ clientDriven: true });

  const res = table.sitOut(sockets[1]);
  assert.deepStrictEqual(res, { pending: true, seat: 1 }, 'sit-out waits for the hand');
  assert.strictEqual(table.game.seats.length, 4, 'still four in the live hand');

  playDown(table);
  // _handCompleted releases the seat immediately once the hand is over.
  assert.strictEqual(table.seatedCount(), 3, 'seat freed');
  assert.strictEqual(table.pending[1].playerId, 'p2', 'seats compacted down');
  assert.ok(sockets[1].typesSeen().includes('table_closed'),
    'the departing seat is told its session ended');
  const others = sockets[0].received.filter((m) => m.type === 'seat_left');
  assert.strictEqual(others.length, 1, 'everyone else gets SEAT_LEFT, not TABLE_CLOSED');
  assert.strictEqual(others[0].seat, 1);
  assert.ok(!sockets[0].typesSeen().includes('table_closed'), 'the table did not close');

  table.maybeStartHand({ clientDriven: true });
  assert.strictEqual(table.game.seats.length, 3, 'three-handed now');
  assert.deepStrictEqual(table.game.seats.map((s) => s.playerId), ['p0', 'p2', 'p3']);
  ok('one seat leaves, three keep playing');
}

// ---------------------------------------------------------------------------
header('Test 5: blinds rotate correctly across joins and leaves');
{
  const table = newTable();
  const sockets = seatPlayers(table, 3);
  const sbOf = () => table.game.seats.findIndex((s) => s.contribThisStreet === 10);
  const bbOf = () => table.game.seats.findIndex((s) => s.contribThisStreet === 20);
  const idOf = (seat) => table.game.seats[seat].playerId;

  table.maybeStartHand({ clientDriven: true });
  // 3-handed, button seat 0 -> SB p1, BB p2.
  assert.strictEqual(idOf(sbOf()), 'p1');
  assert.strictEqual(idOf(bbOf()), 'p2');
  playDown(table);
  // Engine rotated the button to seat 1 (p1) for the next hand.
  assert.strictEqual(table._buttonPlayerId, 'p1', 'button remembered by playerId');

  // A fourth joins. The button must still be p1, so blinds are p2 and p3.
  seatPlayers(table, 1, 1000, 3);
  table.maybeStartHand({ clientDriven: true });
  assert.strictEqual(idOf(table.game.dealerSeat), 'p1', 'button unmoved by the join');
  assert.strictEqual(idOf(sbOf()), 'p2');
  assert.strictEqual(idOf(bbOf()), 'p3');
  playDown(table);
  assert.strictEqual(table._buttonPlayerId, 'p2', 'button advanced to p2');

  // Now the player holding the button leaves. The button walks on to the next
  // surviving seat in the old order -- p3 -- rather than resetting to seat 0.
  table.sitOut(sockets[0]);                       // p0 leaves between hands
  assert.strictEqual(table.seatedCount(), 3);
  table.seatLeaving[table.pending.findIndex((p) => p.playerId === 'p2')] = true;
  table.maybeStartHand({ clientDriven: true });
  assert.deepStrictEqual(table.game.seats.map((s) => s.playerId), ['p1', 'p3']);
  assert.strictEqual(idOf(table.game.dealerSeat), 'p3', 'button walked past the departed seat');
  ok('blinds and button rotate through joins and departures');
}

// ---------------------------------------------------------------------------
header('Test 6: the table closes only below MIN_TO_DEAL');
{
  const table = newTable();
  const sockets = seatPlayers(table, 3);
  table.maybeStartHand({ clientDriven: true });
  table.sitOut(sockets[0]);
  playDown(table);
  assert.strictEqual(table.closed, false, 'two left is still a table');
  assert.strictEqual(table.seatedCount(), 2);

  table.maybeStartHand({ clientDriven: true });
  assert.strictEqual(table.game.seats.length, MIN_TO_DEAL);
  table.sitOut(sockets[1]);
  playDown(table);
  assert.strictEqual(table.closed, true, 'one left is not');
  ok('closes at MIN_TO_DEAL, not before');
}

// ---------------------------------------------------------------------------
header('Test 7: a busted seat is removed and the rest carry on');
{
  const table = newTable();
  seatPlayers(table, 3);
  table.maybeStartHand({ clientDriven: true });
  playDown(table);
  // Bankrupt seat 1 on the felt, the way a lost all-in would. The ledger is
  // re-read from the Game at every reconcile, so this is the honest way to
  // stage it.
  table.game.seats[1].stack = 0;
  table.maybeStartHand({ clientDriven: true });
  assert.strictEqual(table.closed, false);
  assert.strictEqual(table.game.seats.length, 2, 'busted seat dropped, table plays on');
  assert.ok(!table.game.seats.some((s) => s.playerId === 'p1'));
  ok('bust frees one seat instead of ending the table');
}

console.log(`\n${passed} test(s) passed`);
