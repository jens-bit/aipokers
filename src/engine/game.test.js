// Smoke tests for the multi-seat NLHE Game. Run with:
//   node src/engine/game.test.js
// Cards are drawn from a real shuffled deck so showdown winners are random,
// but pot conservation, action order, and structural invariants are verified.

import assert from 'node:assert';
import { Game, Streets, Actions } from './game.js';
import { createDeck } from './deck.js';

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


// ---------------------------------------------------------------------------
// MST-3: 5- and 6-handed play. The seat ceiling moved from 4 to 6 in Tree 6;
// these cases exist so that is a tested claim rather than an edited constant.
// ---------------------------------------------------------------------------
header('Test 7: 6-player hand - blinds, UTG acts first, conservation');
{
  const game = new Game({
    tableId: 't7',
    seats: Array.from({ length: 6 }, (_, i) => ({ playerId: `p${i}`, stack: 1000 })),
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  // dealer=0, SB=1, BB=2, UTG=3.
  assert.strictEqual(game.toAct, 3, 'UTG acts first 6-handed');
  assert.strictEqual(game.seats[1].contribThisStreet, 10, 'SB');
  assert.strictEqual(game.seats[2].contribThisStreet, 20, 'BB');
  assert.strictEqual(game.seats[0].contribThisStreet, 0, 'button posts no blind');
  for (const s of game.seats) assert.strictEqual(s.holeCards.length, 2, 'all six dealt');
  // Every card in play is distinct - the deal loop must not hand out dupes.
  const dealt = game.seats.flatMap((s) => s.holeCards);
  assert.strictEqual(new Set(dealt).size, 12, 'twelve distinct hole cards');
  playDownPassive(game);
  assert.strictEqual(game.street, Streets.COMPLETE);
  assert.strictEqual(totalChips(game), 6000);
  assert.strictEqual(game.dealerSeat, 1, 'button rotated');
  ok('6-player hand: blinds, action order, distinct deal, conservation');
}

// ---------------------------------------------------------------------------
header('Test 8: blinds rotate across hand boundaries (5-handed, 7 hands)');
{
  const game = new Game({
    tableId: 't8',
    seats: Array.from({ length: 5 }, (_, i) => ({ playerId: `p${i}`, stack: 10_000 })),
    smallBlind: 10,
    bigBlind: 20,
  });
  for (let hand = 0; hand < 7; hand++) {
    const btn = game.dealerSeat;
    game.startHand();
    assert.strictEqual(game.seats[(btn + 1) % 5].contribThisStreet, 10, `hand ${hand}: SB is btn+1`);
    assert.strictEqual(game.seats[(btn + 2) % 5].contribThisStreet, 20, `hand ${hand}: BB is btn+2`);
    assert.strictEqual(game.toAct, (btn + 3) % 5, `hand ${hand}: UTG is btn+3`);
    playDownPassive(game);
    assert.strictEqual(game.dealerSeat, (btn + 1) % 5, `hand ${hand}: button advanced one seat`);
  }
  assert.strictEqual(totalChips(game), 50_000, 'chips conserved over seven hands');
  ok('blinds and button rotate correctly across seven 5-handed hands');
}

// ---------------------------------------------------------------------------
header('Test 9: multiway side pots - two all-ins of different sizes (5-handed)');
{
  //     seat: 0 (BTN) 1 (SB)  2 (BB)   3 (UTG)  4
  //    stack: 1000     60      150      1000     1000
  const game = new Game({
    tableId: 't9',
    seats: [
      { playerId: 'btn',   stack: 1000 },
      { playerId: 'short', stack: 60 },
      { playerId: 'mid',   stack: 150 },
      { playerId: 'utg',   stack: 1000 },
      { playerId: 'folder', stack: 1000 },
    ],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  assert.strictEqual(game.toAct, 3, 'UTG first');
  game.act(3, { type: Actions.RAISE, amount: 300 });
  game.act(4, { type: Actions.FOLD });
  game.act(0, { type: Actions.CALL });        // 300
  game.act(1, { type: Actions.CALL });        // all-in for 60
  game.act(2, { type: Actions.CALL });        // all-in for 150

  // btn and utg still have chips behind, so the hand plays on; they check it
  // down, leaving the three side-pot layers exactly as built preflop.
  assert.strictEqual(game.street, Streets.FLOP, 'two live stacks keep the hand going');
  playDownPassive(game);

  assert.strictEqual(game.street, Streets.COMPLETE, 'runs out once nobody can act');
  assert.strictEqual(game.result.type, 'showdown');
  assert.strictEqual(totalChips(game), 3210, 'every chip accounted for');

  // Layers: 60*4 = 240 (all four), 90*3 = 270 (btn/mid/utg), 150*2 = 300
  // (btn/utg). Nothing is uncalled, so nothing is refunded.
  const paid = game.result.winners.reduce((sum, w) => sum + w.amount, 0);
  assert.strictEqual(paid, 810, 'side pots sum to the whole pot');

  // A player all-in for 60 can only ever collect the main pot.
  const short = game.result.winners.find((w) => w.playerId === 'short');
  if (short) assert.ok(short.amount <= 240, 'short stack cannot win beyond the main pot');
  const mid = game.result.winners.find((w) => w.playerId === 'mid');
  if (mid) assert.ok(mid.amount <= 510, 'mid stack cannot win beyond main + first side pot');
  assert.strictEqual(game.seats[4].stack, 1000, 'the folder kept its stack');
  ok('multiway side pots: layered correctly, chips conserved, eligibility respected');
}

// ---------------------------------------------------------------------------
header('Test 10: multiway split pot (board plays for three contestants)');
{
  // Deal order with dealerSeat 0 and N=4: two passes starting left of the
  // button, so seats 1,2,3,0 then 1,2,3,0; then burn, flop(3), burn, turn,
  // burn, river.
  const scripted = [
    '2c', '2d', '4c', '7h',              // first card to seats 1,2,3,0
    '3c', '3d', '5c', '8h',              // second card to seats 1,2,3,0
    '9c',                                // burn
    'As', 'Ks', 'Qs',                    // flop
    '9d',                                // burn
    'Js',                                // turn
    '9h',                                // burn
    'Ts',                                // river - royal flush on the board
  ];
  const deck = [...scripted, ...createDeck().filter((c) => !scripted.includes(c))];
  assert.strictEqual(deck.length, 52, 'rigged deck is a full deck');

  const game = new Game({
    tableId: 't10',
    seats: Array.from({ length: 4 }, (_, i) => ({ playerId: `p${i}`, stack: 1000 })),
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand(deck);
  game.act(3, { type: Actions.FOLD });   // UTG out
  game.act(0, { type: Actions.CALL });   // BTN calls 20
  game.act(1, { type: Actions.CALL });   // SB completes
  game.act(2, { type: Actions.CHECK });  // BB checks its option
  // Three-way, board plays; check it down.
  playDownPassive(game);

  assert.strictEqual(game.street, Streets.COMPLETE);
  assert.strictEqual(game.result.type, 'showdown');
  assert.deepStrictEqual(game.community, ['As', 'Ks', 'Qs', 'Js', 'Ts'], 'board is the royal');
  assert.strictEqual(game.result.winners.length, 3, 'all three contestants split');
  for (const w of game.result.winners) {
    assert.strictEqual(w.amount, 20, 'each takes back an equal third of the 60 pot');
  }
  assert.strictEqual(totalChips(game), 4000, 'chips conserved');
  for (const s of game.seats) assert.strictEqual(s.stack, 1000, 'everyone is square');
  ok('multiway split: three-way tie, pot divided evenly, chips conserved');
}

// ---------------------------------------------------------------------------
// SERVER-3: result.deltas — per-seat NET chip movement for the hand.
//
// The contract is one sentence: deltas[seat] === endStack - startStack, for
// every seat, on every shape of result the engine can produce. That is what
// lets a client stop differencing stack snapshots across broadcasts it may
// have missed. The corollary — the deltas sum to zero — is chip conservation
// stated per seat, so it is asserted everywhere too.

function assertDeltas(game, startStacks, label) {
  const d = game.result.deltas;
  assert.ok(d && typeof d === 'object', `${label}: result carries deltas`);
  assert.strictEqual(Object.keys(d).length, game.seats.length, `${label}: one entry per seat`);
  let sum = 0;
  game.seats.forEach((s, i) => {
    assert.strictEqual(
      d[i], s.stack - startStacks[i],
      `${label}: seat ${i} delta ${d[i]} should be ${s.stack - startStacks[i]}`,
    );
    sum += d[i];
  });
  assert.strictEqual(sum, 0, `${label}: deltas sum to zero`);
}

// Stacks as they were before the blinds went in — startHand() has already
// moved them, so the chips still on the felt have to be added back.
const stacksBeforeBlinds = (game) => game.seats.map((s) => s.stack + s.contribTotal);

header('Test 11: result.deltas — uncontested pot (everyone folds)');
{
  const game = new Game({
    tableId: 't11',
    seats: [{ playerId: 'p0', stack: 1000 }, { playerId: 'p1', stack: 1000 }],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  const start = stacksBeforeBlinds(game);
  // HU: button (seat 0) is SB, acts first, raises; BB folds.
  game.act(0, { type: Actions.RAISE, amount: 60 });
  game.act(1, { type: Actions.FOLD });
  assert.strictEqual(game.result.type, 'uncontested');
  assertDeltas(game, start, 'uncontested');
  // The winner is up exactly the loser's dead blind, not the whole pot: his own
  // uncalled raise came back to him.
  assert.strictEqual(game.result.deltas[0], 20, 'winner nets the BB he was paid');
  assert.strictEqual(game.result.deltas[1], -20, 'folder is down his big blind');
  ok('uncontested: deltas are net of own contribution and sum to zero');
}

// ---------------------------------------------------------------------------
header('Test 12: result.deltas — showdown, checked down heads-up');
{
  const game = new Game({
    tableId: 't12',
    seats: [{ playerId: 'p0', stack: 1000 }, { playerId: 'p1', stack: 1000 }],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  const start = stacksBeforeBlinds(game);
  playDownPassive(game);
  assert.strictEqual(game.result.type, 'showdown');
  assertDeltas(game, start, 'showdown');
  ok('showdown: deltas match the stack movement seat by seat');
}

// ---------------------------------------------------------------------------
header('Test 13: result.deltas — side pots, three uneven all-ins');
{
  const game = new Game({
    tableId: 't13',
    seats: [
      { playerId: 'short', stack: 100 },
      { playerId: 'mid', stack: 300 },
      { playerId: 'big', stack: 1000 },
    ],
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  const start = stacksBeforeBlinds(game);
  let safety = 30;
  while (game.street !== Streets.COMPLETE && safety-- > 0) {
    const seat = game.toAct;
    if (seat === null || seat === undefined) break;
    const legal = game.legalActions(seat);
    const raise = legal.find((a) => a.type === Actions.RAISE);
    if (raise) game.act(seat, { type: Actions.RAISE, amount: raise.max });
    else if (legal.find((a) => a.type === Actions.CALL)) game.act(seat, { type: Actions.CALL });
    else game.act(seat, { type: Actions.CHECK });
  }
  assert.strictEqual(game.street, Streets.COMPLETE);
  assertDeltas(game, start, 'side pots');
  // Nobody can lose more than they brought.
  assert.ok(game.result.deltas[0] >= -100, 'short stack cannot lose more than 100');
  assert.ok(game.result.deltas[1] >= -300, 'mid stack cannot lose more than 300');
  ok('side pots: deltas bounded by each stack and still sum to zero');
}

// ---------------------------------------------------------------------------
header('Test 14: result.deltas — a folded seat carries its dead money');
{
  const game = new Game({
    tableId: 't14',
    seats: Array.from({ length: 4 }, (_, i) => ({ playerId: `p${i}`, stack: 1000 })),
    smallBlind: 10,
    bigBlind: 20,
  });
  game.startHand();
  const start = stacksBeforeBlinds(game);
  game.act(3, { type: Actions.FOLD });   // UTG folds having put in nothing
  game.act(0, { type: Actions.CALL });
  game.act(1, { type: Actions.FOLD });   // SB folds his 10 into the pot
  game.act(2, { type: Actions.CHECK });
  playDownPassive(game);
  assert.strictEqual(game.street, Streets.COMPLETE);
  assertDeltas(game, start, 'dead money');
  assert.strictEqual(game.result.deltas[3], 0, 'a seat that never invested is flat');
  assert.strictEqual(game.result.deltas[1], -10, 'the folded small blind is down exactly his blind');
  ok('dead money: folders report negative deltas, uninvolved seats report zero');
}

console.log(`\n${passed} test(s) passed`);
