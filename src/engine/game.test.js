// Smoke tests for the multi-seat NLHE Game. Run with:
//   node src/engine/game.test.js
// Cards are drawn from a real shuffled deck so showdown winners are random,
// but pot conservation, action order, and structural invariants are verified.

import assert from 'node:assert';
import { Game, Streets, Actions } from './game.js';

function totalChips(game) {
  return game.seats.reduce((sum, s) => sum + s.stack, 0) + game.pot;
}

// Plays the hand to completion by always taking the cheapest path forward
// (check if possible, otherwise call, otherwise fold).
function playDownPassive(game) {
  let safety = 200;
  while (
    game.street !== Streets.COMPLETE &&
    game.street !== Streets.SHOWDOWN &&
    safety-- > 0
  ) {
    const seat = game.toAct;
    if (seat === null || seat === undefined) break;
    const legal = game.legalActions(seat);
    if (legal.find((a) => a.type === Actions.CHECK)) {
      game.act(seat, { type: Actions.CHECK });
    } else if (legal.find((a) => a.type === Actions.CALL)) {
      game.act(seat, { type: Actions.CALL });
    } else {
      game.act(seat, { type: Actions.FOLD });
    }
  }
}

let passed = 0;
function ok(name) { passed++; console.log(`  PASS  ${name}`); }
function header(name) { console.log(`\n${name}`); }

// ---------------------------------------------------------------------------
header('Test 1: 2-player heads-up full hand');
{
  const game = new Game({
    tableId: 't1',
    seats: [{ playerId: 'p0', stack: 1000 }, { playerId: 'p1', stack: 1000 }],
    smallBlind: 10,
    bigBlind: 20,
  });
  assert.strictEqual(game.dealerSeat, 0);
  game.startHand();
  assert.strictEqual(game.handNumber, 1);
  assert.strictEqual(game.street, Streets.PREFLOP);
  // HU: button (seat 0) is SB and acts first preflop.
  assert.strictEqual(game.toAct, 0);
  for (const s of game.seats) assert.strictEqual(s.holeCards.length, 2, 'two hole cards each');
  playDownPassive(game);
  assert.strictEqual(game.street, Streets.COMPLETE);
  assert.strictEqual(totalChips(game), 2000, 'pot conservation');
  assert.strictEqual(game.dealerSeat, 1, 'button rotated to seat 1');
  ok('2-player full hand: pot conserved, button rotated');
}

// ---------------------------------------------------------------------------
header('Test 2: 3-player hand — button acts first preflop');
{
  const game = new Game({
    tableId: 't2',
    seats: [
      { playerId: 'p0', stack: 1000 },
      { playerId: 'p1', stack: 1000 },
      { playerId: 'p2', stack: 1000 },
    ],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  // dealer=0; SB=1, BB=2. Preflop UTG = (BB+1)%3 = 0 = button.
  assert.strictEqual(game.toAct, 0, 'button acts first preflop in 3-way');
  // Verify blinds posted
  assert.strictEqual(game.seats[1].contribThisStreet, 10, 'SB');
  assert.strictEqual(game.seats[2].contribThisStreet, 20, 'BB');
  assert.strictEqual(game.seats[0].contribThisStreet, 0, 'button posts no blind in 3-way');
  for (const s of game.seats) assert.strictEqual(s.holeCards.length, 2, 'all dealt');
  playDownPassive(game);
  assert.strictEqual(game.street, Streets.COMPLETE);
  assert.strictEqual(totalChips(game), 3000);
  ok('3-player hand: blinds, action order, dealing, conservation');
}

// ---------------------------------------------------------------------------
header('Test 3: 4-player hand — UTG acts first preflop');
{
  const game = new Game({
    tableId: 't3',
    seats: [
      { playerId: 'p0', stack: 1000 },
      { playerId: 'p1', stack: 1000 },
      { playerId: 'p2', stack: 1000 },
      { playerId: 'p3', stack: 1000 },
    ],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  // dealer=0, SB=1, BB=2, UTG=3
  assert.strictEqual(game.toAct, 3, 'UTG acts first');
  assert.strictEqual(game.seats[1].contribThisStreet, 10);
  assert.strictEqual(game.seats[2].contribThisStreet, 20);
  playDownPassive(game);
  assert.strictEqual(game.street, Streets.COMPLETE);
  assert.strictEqual(totalChips(game), 4000);
  ok('4-player hand: pot conservation, UTG acts first');
}

// ---------------------------------------------------------------------------
header('Test 4: 3-player side pot scenario (100/50/200, all all-in)');
{
  const game = new Game({
    tableId: 't4',
    seats: [
      { playerId: 'p0', stack: 100 },
      { playerId: 'p1', stack: 50 },
      { playerId: 'p2', stack: 200 },
    ],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  // After blinds: SB=p1(10), BB=p2(20). Action: p0 (button = UTG in 3-way).
  assert.strictEqual(game.toAct, 0);
  // p0 raises all-in to 100
  game.act(0, { type: Actions.RAISE, amount: 100 });
  // p1 calls all-in (only has 40 left → contribTotal = 50)
  game.act(1, { type: Actions.CALL });
  // p2 raises all-in to 200
  game.act(2, { type: Actions.RAISE, amount: 200 });
  // All-in across the board → straight to showdown.
  assert.strictEqual(game.street, Streets.COMPLETE);
  assert.strictEqual(totalChips(game), 350, 'all 350 chips conserved');
  assert.ok(game.result, 'result populated');
  assert.strictEqual(game.result.type, 'showdown');
  // Total payouts must equal the pot that was distributed (350 total chips
  // initially; uncalled 100 from p2 was refunded; remaining 250 in pots).
  const totalPaid = game.result.winners.reduce((sum, w) => sum + w.amount, 0);
  // p2 had 100 refunded as part of `_refundUncalled`, so payout total is 250.
  assert.strictEqual(totalPaid, 250, 'side pots sum to refunded total');
  ok('side pot scenario: chips conserved, payouts match pots');
}

// ---------------------------------------------------------------------------
header('Test 5: 2-player button rotation across 3 hands');
{
  const game = new Game({
    tableId: 't5',
    seats: [{ playerId: 'p0', stack: 5000 }, { playerId: 'p1', stack: 5000 }],
    smallBlind: 10,
    bigBlind: 20,
  });
  const seenButtons = [];
  for (let i = 0; i < 3; i++) {
    seenButtons.push(game.dealerSeat);
    game.startHand();
    // SB folds preflop in HU (SB acts first).
    game.act(game.toAct, { type: Actions.FOLD });
    assert.strictEqual(game.street, Streets.COMPLETE);
  }
  assert.deepStrictEqual(seenButtons, [0, 1, 0], 'button alternates each hand');
  assert.strictEqual(totalChips(game), 10_000);
  ok('button rotates across consecutive hands');
}

// ---------------------------------------------------------------------------
header('Test 6: fold to one player (uncontested, no showdown)');
{
  const game = new Game({
    tableId: 't6',
    seats: [
      { playerId: 'p0', stack: 1000 },
      { playerId: 'p1', stack: 1000 },
      { playerId: 'p2', stack: 1000 },
    ],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  // 3-way: button=p0 acts first. Folds. Then SB=p1 folds. BB=p2 wins.
  game.act(0, { type: Actions.FOLD });
  game.act(1, { type: Actions.FOLD });
  assert.strictEqual(game.street, Streets.COMPLETE);
  assert.strictEqual(game.result.type, 'uncontested');
  assert.strictEqual(game.result.winners.length, 1);
  assert.strictEqual(game.result.winners[0].seat, 2);
  // BB wins SB's 10 (BB had already posted 20, gets it back + the 10).
  assert.strictEqual(game.seats[2].stack, 1010, 'BB wins SB');
  assert.strictEqual(totalChips(game), 3000);
  ok('uncontested fold-around: correct winner, no showdown');
}

console.log(`\n${passed} test(s) passed`);
